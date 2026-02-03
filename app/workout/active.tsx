import { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Platform,
  Modal,
  Vibration,
  View as RNView,
} from 'react-native';
import { router } from 'expo-router';

import { Text, useThemeColors } from '@/components/Themed';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useHistoryStore } from '@/stores/historyStore';

// RPE 옵션 정의
const RPE_OPTIONS = [
  { value: 5, label: '쉬웠어요', emoji: '😊', color: '#22c55e', suggestion: '+2.5kg 추천' },
  { value: 7, label: '적당했어요', emoji: '💪', color: '#3b82f6', suggestion: '유지' },
  { value: 9, label: '힘들었어요', emoji: '🔥', color: '#f59e0b', suggestion: '유지 or -2.5kg' },
  { value: 10, label: '한계였어요', emoji: '😵', color: '#ef4444', suggestion: '-2.5kg 추천' },
];

// 휴식 시간 옵션 (초)
const REST_TIME_OPTIONS = [60, 90, 120, 180];

// 웹 호환 confirm/alert
const showConfirm = (
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText = '확인'
) => {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: '취소', style: 'cancel' },
      { text: confirmText, onPress: onConfirm },
    ]);
  }
};

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

// RPE 기반 다음 무게 추천
const getRecommendedWeight = (currentWeight: number, rpe: number | null): { weight: number; message: string } | null => {
  if (!rpe || !currentWeight) return null;

  if (rpe <= 5) {
    return { weight: currentWeight + 2.5, message: '쉬웠으니 무게를 올려보세요!' };
  } else if (rpe <= 7) {
    return { weight: currentWeight, message: '좋아요! 이 무게를 유지하세요' };
  } else if (rpe <= 9) {
    return { weight: currentWeight, message: '힘들었네요. 무게 유지하며 적응해보세요' };
  } else {
    return { weight: Math.max(currentWeight - 2.5, 0), message: '한계였어요! 무게를 조금 낮춰보세요' };
  }
};

// 이전 기록 기반 오늘의 추천 계산 (점진적 과부하 원칙)
interface TodayRecommendation {
  weight: number;
  reps: number;
  sets: number;
  message: string;
  type: 'increase_weight' | 'increase_reps' | 'maintain' | 'decrease';
}

const getTodayRecommendation = (
  prevRecord: { max_weight: number; total_reps: number; total_sets: number; sets: any[] } | null,
  category: string
): TodayRecommendation | null => {
  if (!prevRecord || prevRecord.max_weight === 0) return null;

  const avgReps = Math.round(prevRecord.total_reps / prevRecord.total_sets);
  const lastSets = prevRecord.sets || [];

  // 마지막 세션의 평균 RPE 계산
  const rpeValues = lastSets.filter((s: any) => s.rpe != null).map((s: any) => s.rpe);
  const avgRpe = rpeValues.length > 0
    ? rpeValues.reduce((a: number, b: number) => a + b, 0) / rpeValues.length
    : 7; // 기본값

  // 하체는 더 큰 증가폭 (5kg), 상체는 작은 증가폭 (2.5kg)
  const weightIncrement = ['legs', 'back'].includes(category) ? 5 : 2.5;

  if (avgRpe <= 6) {
    // 쉬웠으면 무게 증가
    return {
      weight: prevRecord.max_weight + weightIncrement,
      reps: avgReps,
      sets: prevRecord.total_sets,
      message: `지난번 쉬웠어요! 무게를 ${weightIncrement}kg 올려보세요`,
      type: 'increase_weight',
    };
  } else if (avgRpe <= 7.5) {
    // 적당했으면 횟수 증가 시도
    const targetReps = avgReps < 12 ? avgReps + 1 : avgReps;
    if (targetReps > avgReps) {
      return {
        weight: prevRecord.max_weight,
        reps: targetReps,
        sets: prevRecord.total_sets,
        message: '좋았어요! 같은 무게로 1회 더 해보세요',
        type: 'increase_reps',
      };
    } else {
      // 12회 이상이면 무게 증가
      return {
        weight: prevRecord.max_weight + weightIncrement,
        reps: Math.max(avgReps - 2, 8),
        sets: prevRecord.total_sets,
        message: '12회 달성! 무게를 올리고 횟수를 줄여보세요',
        type: 'increase_weight',
      };
    }
  } else if (avgRpe <= 9) {
    // 힘들었으면 유지
    return {
      weight: prevRecord.max_weight,
      reps: avgReps,
      sets: prevRecord.total_sets,
      message: '지난번 힘들었어요. 같은 무게로 적응해보세요',
      type: 'maintain',
    };
  } else {
    // 한계였으면 무게 감소
    return {
      weight: Math.max(prevRecord.max_weight - weightIncrement, 0),
      reps: avgReps,
      sets: prevRecord.total_sets,
      message: '지난번 너무 힘들었어요. 무게를 줄여보세요',
      type: 'decrease',
    };
  }
};

// RPE 표시 컴포넌트
const RpeBadge = ({ rpe }: { rpe: number | null }) => {
  if (!rpe) return null;
  const option = RPE_OPTIONS.find(o => o.value === rpe) || RPE_OPTIONS[1];
  return (
    <RNView style={[styles.rpeBadge, { backgroundColor: option.color + '20' }]}>
      <Text style={[styles.rpeBadgeText, { color: option.color }]}>
        {option.emoji}
      </Text>
    </RNView>
  );
};

// 시간 포맷 (초 -> mm:ss)
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// 1RM 추정 계산 (Epley 공식)
const calculate1RM = (weight: number, reps: number): number => {
  if (reps === 1) return weight;
  if (reps === 0 || weight === 0) return 0;
  return Math.round(weight * (1 + reps / 30));
};

// 무게 조절 단위 (카테고리별)
const WEIGHT_INCREMENTS = {
  small: 2.5,
  large: 5,
};

export default function ActiveWorkoutScreen() {
  const colors = useThemeColors();
  const {
    activeSession,
    exercises,
    finishWorkout,
    cancelWorkout,
    addSet,
    updateSet,
    removeSet,
  } = useWorkoutStore();

  const { getExerciseHistory } = useHistoryStore();

  // 운동별 입력값 관리
  const [inputValues, setInputValues] = useState<Record<string, { weight: string; reps: string }>>({});

  // 동적 스타일
  const dynamicStyles = useMemo(() => ({
    container: { backgroundColor: colors.background },
    card: { backgroundColor: colors.card },
    cardSecondary: { backgroundColor: colors.cardSecondary },
    text: { color: colors.text },
    textSecondary: { color: colors.textSecondary },
    textTertiary: { color: colors.textTertiary },
    primary: { color: colors.primary },
    primaryBg: { backgroundColor: colors.primary },
    primaryLightBg: { backgroundColor: colors.primaryLight },
    border: { borderColor: colors.border },
    borderBg: { backgroundColor: colors.border },
    error: { color: colors.error },
    errorBg: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  }), [colors]);

  // RPE 선택 모달 상태
  const [rpeModalVisible, setRpeModalVisible] = useState(false);
  const [pendingSetId, setPendingSetId] = useState<string | null>(null);
  const [pendingExerciseId, setPendingExerciseId] = useState<string | null>(null);

  // 휴식 타이머 상태
  const [restTimerActive, setRestTimerActive] = useState(false);
  const [restTimeRemaining, setRestTimeRemaining] = useState(0);
  const [selectedRestTime, setSelectedRestTime] = useState(90);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 운동 경과 시간
  const [elapsedTime, setElapsedTime] = useState('00:00');

  // 경과 시간 업데이트
  useEffect(() => {
    if (!activeSession) return;

    const updateElapsedTime = () => {
      const start = new Date(activeSession.started_at).getTime();
      const now = Date.now();
      const diff = Math.floor((now - start) / 1000);
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      if (hours > 0) {
        setElapsedTime(
          `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      } else {
        setElapsedTime(
          `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }
    };

    updateElapsedTime();
    const interval = setInterval(updateElapsedTime, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  // 휴식 타이머 관리
  useEffect(() => {
    if (restTimerActive && restTimeRemaining > 0) {
      timerRef.current = setTimeout(() => {
        setRestTimeRemaining((prev) => prev - 1);
      }, 1000);
    } else if (restTimerActive && restTimeRemaining === 0) {
      // 타이머 완료
      setRestTimerActive(false);
      if (Platform.OS !== 'web') {
        Vibration.vibrate([0, 500, 200, 500]);
      }
      showAlert('휴식 완료!', '다음 세트를 시작하세요 💪');
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [restTimerActive, restTimeRemaining]);

  const startRestTimer = (seconds?: number) => {
    setRestTimeRemaining(seconds || selectedRestTime);
    setRestTimerActive(true);
  };

  const stopRestTimer = () => {
    setRestTimerActive(false);
    setRestTimeRemaining(0);
  };

  // 이전 기록 가져오기
  const getPreviousRecord = (exerciseId: string) => {
    const history = getExerciseHistory(exerciseId);
    if (history && history.records.length > 0) {
      return history.records[0];
    }
    return null;
  };

  // 운동별 입력값 가져오기 (이전 세트 값 + RPE 추천 반영)
  const getInputValues = (exerciseId: string, exerciseDbId: string, category: string) => {
    if (inputValues[exerciseId]) {
      return inputValues[exerciseId];
    }

    const exercise = exercises.find((e) => e.id === exerciseId);
    const lastSet = exercise?.sets[exercise.sets.length - 1];

    if (lastSet) {
      // RPE 기반 추천 무게 계산
      const recommendation = getRecommendedWeight(lastSet.weight || 0, lastSet.rpe);
      return {
        weight: recommendation ? recommendation.weight.toString() : (lastSet.weight?.toString() || ''),
        reps: lastSet.reps?.toString() || '',
      };
    }

    // 첫 세트는 오늘 추천값 사용
    const prevRecord = getPreviousRecord(exerciseDbId);
    const todayRec = getTodayRecommendation(prevRecord, category);

    if (todayRec) {
      return {
        weight: todayRec.weight.toString(),
        reps: todayRec.reps.toString(),
      };
    }

    // 이전 기록에서 가져오기
    if (prevRecord && prevRecord.max_weight > 0) {
      return {
        weight: prevRecord.max_weight.toString(),
        reps: Math.round(prevRecord.total_reps / prevRecord.total_sets).toString() || '',
      };
    }

    return { weight: '', reps: '' };
  };

  // 추천 메시지 가져오기
  const getRecommendationMessage = (exerciseId: string) => {
    const exercise = exercises.find((e) => e.id === exerciseId);
    const lastSet = exercise?.sets[exercise.sets.length - 1];

    if (lastSet?.rpe && lastSet?.weight) {
      return getRecommendedWeight(lastSet.weight, lastSet.rpe);
    }
    return null;
  };

  const updateInputValue = (exerciseId: string, exerciseDbId: string, category: string, field: 'weight' | 'reps', value: string) => {
    setInputValues((prev) => ({
      ...prev,
      [exerciseId]: {
        ...getInputValues(exerciseId, exerciseDbId, category),
        [field]: value,
      },
    }));
  };

  const handleFinishWorkout = async () => {
    showConfirm('운동 완료', '운동을 완료하시겠습니까?', async () => {
      try {
        await finishWorkout();
        // 홈 화면으로 이동 (back 대신 replace 사용하여 확실하게 이동)
        router.replace('/');
      } catch (error) {
        console.error('Failed to finish workout:', error);
        showAlert('오류', '운동 완료 중 오류가 발생했습니다');
      }
    }, '완료');
  };

  const handleCancelWorkout = () => {
    showConfirm(
      '운동 취소',
      '운동을 취소하시겠습니까? 기록이 저장되지 않습니다.',
      () => {
        cancelWorkout();
        router.back();
      },
      '취소하기'
    );
  };

  const handleAddSet = async (workoutExerciseId: string, exerciseDbId: string, category: string) => {
    const values = getInputValues(workoutExerciseId, exerciseDbId, category);
    if (!values.weight || !values.reps) {
      showAlert('입력 오류', '무게와 횟수를 입력해주세요');
      return;
    }

    const currentExercise = exercises.find((e) => e.id === workoutExerciseId);
    const setNumber = (currentExercise?.sets.length || 0) + 1;

    try {
      const newSet = await addSet(workoutExerciseId, {
        set_number: setNumber,
        weight: parseFloat(values.weight),
        reps: parseInt(values.reps, 10),
      });

      // RPE 선택 모달 표시
      if (newSet) {
        setPendingSetId(newSet.id);
        setPendingExerciseId(workoutExerciseId);
        setRpeModalVisible(true);
      }
    } catch (error) {
      console.error('Failed to add set:', error);
    }
  };

  const handleSelectRpe = async (rpe: number) => {
    if (pendingSetId) {
      try {
        await updateSet(pendingSetId, { rpe });

        // 입력값 초기화하여 추천 무게 반영되도록
        if (pendingExerciseId) {
          setInputValues((prev) => {
            const newValues = { ...prev };
            delete newValues[pendingExerciseId];
            return newValues;
          });
        }
      } catch (error) {
        console.error('Failed to update RPE:', error);
      }
    }
    setRpeModalVisible(false);
    setPendingSetId(null);
    setPendingExerciseId(null);

    // 자동으로 휴식 타이머 시작
    startRestTimer();
  };

  const handleSkipRpe = () => {
    setRpeModalVisible(false);
    setPendingSetId(null);
    setPendingExerciseId(null);

    // 휴식 타이머 시작
    startRestTimer();
  };

  const handleDeleteSet = (setId: string) => {
    showConfirm(
      '세트 삭제',
      '이 세트를 삭제하시겠습니까?',
      async () => {
        try {
          await removeSet(setId);
        } catch (error) {
          console.error('Failed to delete set:', error);
        }
      },
      '삭제'
    );
  };

  if (!activeSession) {
    return (
      <RNView style={[styles.container, dynamicStyles.container]}>
        <Text style={dynamicStyles.text}>진행 중인 운동이 없습니다</Text>
      </RNView>
    );
  }

  // 현재 통계 계산
  const totalSets = exercises.reduce((sum, e) => sum + e.sets.length, 0);
  const totalVolume = exercises.reduce(
    (sum, e) => sum + e.sets.reduce((setSum, s) => setSum + (s.weight || 0) * (s.reps || 0), 0),
    0
  );

  return (
    <RNView style={[styles.container, dynamicStyles.container]}>
      {/* 휴식 타이머 배너 */}
      {restTimerActive && (
        <Pressable style={[styles.timerBanner, dynamicStyles.primaryBg]} onPress={stopRestTimer}>
          <RNView style={styles.timerContent}>
            <Text style={styles.timerLabel}>휴식 중</Text>
            <Text style={styles.timerValue}>{formatTime(restTimeRemaining)}</Text>
          </RNView>
          <RNView style={styles.timerProgress}>
            <RNView
              style={[
                styles.timerProgressBar,
                { width: `${(restTimeRemaining / selectedRestTime) * 100}%` },
              ]}
            />
          </RNView>
          <Text style={styles.timerTip}>탭하여 건너뛰기</Text>
        </Pressable>
      )}

      <ScrollView style={styles.scrollView}>
        {/* 헤더 */}
        <RNView style={styles.header}>
          <RNView style={styles.headerTop}>
            <Text style={[styles.sessionName, dynamicStyles.text]}>{activeSession.name}</Text>
            <RNView style={[styles.elapsedTimeBadge, dynamicStyles.primaryLightBg]}>
              <Text style={[styles.elapsedTimeText, dynamicStyles.text]}>{elapsedTime}</Text>
            </RNView>
          </RNView>

          {/* 현재 세션 통계 */}
          <RNView style={[styles.sessionStats, dynamicStyles.cardSecondary]}>
            <RNView style={styles.sessionStat}>
              <Text style={[styles.sessionStatValue, dynamicStyles.text]}>{exercises.length}</Text>
              <Text style={[styles.sessionStatLabel, dynamicStyles.textSecondary]}>운동</Text>
            </RNView>
            <RNView style={[styles.sessionStatDivider, dynamicStyles.borderBg]} />
            <RNView style={styles.sessionStat}>
              <Text style={[styles.sessionStatValue, dynamicStyles.text]}>{totalSets}</Text>
              <Text style={[styles.sessionStatLabel, dynamicStyles.textSecondary]}>세트</Text>
            </RNView>
            <RNView style={[styles.sessionStatDivider, dynamicStyles.borderBg]} />
            <RNView style={styles.sessionStat}>
              <Text style={[styles.sessionStatValue, dynamicStyles.text]}>{totalVolume.toLocaleString()}</Text>
              <Text style={[styles.sessionStatLabel, dynamicStyles.textSecondary]}>kg</Text>
            </RNView>
          </RNView>
        </RNView>

        {/* 휴식 시간 선택 */}
        {!restTimerActive && (
          <RNView style={styles.restTimeSelector}>
            <Text style={[styles.restTimeLabel, dynamicStyles.textSecondary]}>휴식 시간:</Text>
            <RNView style={styles.restTimeOptions}>
              {REST_TIME_OPTIONS.map((time) => (
                <Pressable
                  key={time}
                  style={[
                    styles.restTimeOption,
                    selectedRestTime === time ? dynamicStyles.primaryBg : dynamicStyles.cardSecondary,
                  ]}
                  onPress={() => setSelectedRestTime(time)}
                >
                  <Text
                    style={[
                      styles.restTimeOptionText,
                      selectedRestTime === time ? styles.restTimeOptionTextSelected : dynamicStyles.textSecondary,
                    ]}
                  >
                    {time < 60 ? `${time}초` : `${time / 60}분`}
                  </Text>
                </Pressable>
              ))}
            </RNView>
          </RNView>
        )}

        {exercises.length === 0 ? (
          <RNView style={styles.emptyState}>
            <Text style={[styles.emptyText, dynamicStyles.textSecondary]}>운동을 추가해주세요</Text>
            <Pressable
              style={[styles.addExerciseButton, dynamicStyles.primaryBg]}
              onPress={() => router.push('/workout/exercises')}
            >
              <Text style={styles.addExerciseButtonText}>운동 추가</Text>
            </Pressable>
          </RNView>
        ) : (
          exercises.map((exercise) => {
            const recommendation = getRecommendationMessage(exercise.id);
            const prevRecord = getPreviousRecord(exercise.exercise_id);
            const todayRec = getTodayRecommendation(prevRecord, exercise.exercise.category);

            return (
              <RNView key={exercise.id} style={[styles.exerciseCard, dynamicStyles.card]}>
                <Text style={[styles.exerciseName, dynamicStyles.text]}>
                  {exercise.exercise.name_ko || exercise.exercise.name}
                </Text>

                {/* 이전 기록 & 오늘 추천 */}
                {prevRecord && prevRecord.total_sets > 0 && (
                  <RNView style={styles.recordsContainer}>
                    <RNView style={[styles.prevRecordBox, dynamicStyles.cardSecondary]}>
                      <Text style={[styles.prevRecordLabel, dynamicStyles.textTertiary]}>지난번</Text>
                      <Text style={[styles.prevRecordValue, dynamicStyles.textSecondary]}>
                        {prevRecord.max_weight}kg × {Math.round(prevRecord.total_reps / prevRecord.total_sets) || 0}회
                      </Text>
                    </RNView>
                    {todayRec && (
                      <RNView style={[styles.todayRecBox, dynamicStyles.primaryLightBg]}>
                        <Text style={[styles.todayRecLabel, dynamicStyles.primary]}>오늘 추천</Text>
                        <Text style={[styles.todayRecValue, dynamicStyles.primary]}>
                          {todayRec.weight}kg × {todayRec.reps}회
                        </Text>
                      </RNView>
                    )}
                  </RNView>
                )}

                {/* 추천 메시지 */}
                {todayRec && exercise.sets.length === 0 && (
                  <RNView style={[
                    styles.todayRecMessage,
                    todayRec.type === 'increase_weight' && styles.todayRecMessageIncrease,
                    todayRec.type === 'increase_reps' && styles.todayRecMessageReps,
                    todayRec.type === 'maintain' && styles.todayRecMessageMaintain,
                    todayRec.type === 'decrease' && styles.todayRecMessageDecrease,
                  ]}>
                    <Text style={styles.todayRecMessageIcon}>
                      {todayRec.type === 'increase_weight' ? '💪' :
                       todayRec.type === 'increase_reps' ? '🎯' :
                       todayRec.type === 'maintain' ? '✅' : '⚠️'}
                    </Text>
                    <Text style={[styles.todayRecMessageText, dynamicStyles.text]}>{todayRec.message}</Text>
                  </RNView>
                )}

                {/* 세트 목록 헤더 */}
                {exercise.sets.length > 0 && (
                  <RNView style={styles.setHeader}>
                    <Text style={[styles.setHeaderText, dynamicStyles.textTertiary, { width: 30 }]}>세트</Text>
                    <Text style={[styles.setHeaderText, dynamicStyles.textTertiary, { flex: 1, textAlign: 'center' }]}>무게</Text>
                    <Text style={[styles.setHeaderText, dynamicStyles.textTertiary, { flex: 1, textAlign: 'center' }]}>횟수</Text>
                    <Text style={[styles.setHeaderText, dynamicStyles.textTertiary, { width: 50, textAlign: 'center' }]}>볼륨</Text>
                    <RNView style={{ width: 32 }} />
                    <RNView style={{ width: 28 }} />
                  </RNView>
                )}

                {/* 세트 목록 */}
                {exercise.sets.map((set, index) => {
                  const setVolume = (set.weight || 0) * (set.reps || 0);
                  return (
                    <RNView key={set.id} style={[styles.setRow, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.setNumber, dynamicStyles.textSecondary]}>{index + 1}</Text>
                      <Text style={[styles.setValue, dynamicStyles.text]}>{set.weight} kg</Text>
                      <Text style={[styles.setValue, dynamicStyles.text]}>{set.reps} 회</Text>
                      <Text style={[styles.setVolume, dynamicStyles.textTertiary]}>{setVolume}</Text>
                      <RpeBadge rpe={set.rpe} />
                      <Pressable
                        style={styles.deleteSetButton}
                        onPress={() => handleDeleteSet(set.id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={styles.deleteSetButtonText}>✕</Text>
                      </Pressable>
                    </RNView>
                  );
                })}

                {/* 추천 메시지 */}
                {recommendation && (
                  <RNView style={[styles.recommendationBox, { backgroundColor: colors.warning + '20' }]}>
                    <Text style={styles.recommendationIcon}>💡</Text>
                    <Text style={[styles.recommendationText, dynamicStyles.text]}>{recommendation.message}</Text>
                  </RNView>
                )}

                {/* 1RM 표시 */}
                {exercise.sets.length > 0 && (() => {
                  const bestSet = exercise.sets.reduce((best, set) => {
                    const current1RM = calculate1RM(set.weight || 0, set.reps || 0);
                    const best1RM = calculate1RM(best.weight || 0, best.reps || 0);
                    return current1RM > best1RM ? set : best;
                  }, exercise.sets[0]);
                  const estimated1RM = calculate1RM(bestSet.weight || 0, bestSet.reps || 0);
                  if (estimated1RM > 0) {
                    return (
                      <RNView style={[styles.estimated1RMBox, dynamicStyles.cardSecondary]}>
                        <Text style={[styles.estimated1RMLabel, dynamicStyles.textTertiary]}>예상 1RM</Text>
                        <Text style={[styles.estimated1RMValue, dynamicStyles.primary]}>{estimated1RM}kg</Text>
                      </RNView>
                    );
                  }
                  return null;
                })()}

                {/* 입력 영역 */}
                <RNView style={styles.inputSection}>
                  {/* 무게 입력 */}
                  <RNView style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, dynamicStyles.textSecondary]}>무게 (kg)</Text>
                    <RNView style={styles.inputWithButtons}>
                      <Pressable
                        style={[styles.adjustButton, dynamicStyles.cardSecondary]}
                        onPress={() => {
                          const currentVal = parseFloat(getInputValues(exercise.id, exercise.exercise_id, exercise.exercise.category).weight) || 0;
                          updateInputValue(exercise.id, exercise.exercise_id, exercise.exercise.category, 'weight', Math.max(0, currentVal - WEIGHT_INCREMENTS.large).toString());
                        }}
                      >
                        <Text style={[styles.adjustButtonText, dynamicStyles.textSecondary]}>-5</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.adjustButtonSmall, dynamicStyles.cardSecondary]}
                        onPress={() => {
                          const currentVal = parseFloat(getInputValues(exercise.id, exercise.exercise_id, exercise.exercise.category).weight) || 0;
                          updateInputValue(exercise.id, exercise.exercise_id, exercise.exercise.category, 'weight', Math.max(0, currentVal - WEIGHT_INCREMENTS.small).toString());
                        }}
                      >
                        <Text style={[styles.adjustButtonTextSmall, dynamicStyles.textSecondary]}>-2.5</Text>
                      </Pressable>
                      <TextInput
                        style={[styles.inputCenter, dynamicStyles.card, { borderColor: colors.border, color: colors.text }]}
                        placeholder="0"
                        keyboardType="numeric"
                        value={getInputValues(exercise.id, exercise.exercise_id, exercise.exercise.category).weight}
                        onChangeText={(v) => updateInputValue(exercise.id, exercise.exercise_id, exercise.exercise.category, 'weight', v)}
                        placeholderTextColor={colors.textTertiary}
                        textAlign="center"
                      />
                      <Pressable
                        style={[styles.adjustButtonSmall, dynamicStyles.cardSecondary]}
                        onPress={() => {
                          const currentVal = parseFloat(getInputValues(exercise.id, exercise.exercise_id, exercise.exercise.category).weight) || 0;
                          updateInputValue(exercise.id, exercise.exercise_id, exercise.exercise.category, 'weight', (currentVal + WEIGHT_INCREMENTS.small).toString());
                        }}
                      >
                        <Text style={[styles.adjustButtonTextSmall, dynamicStyles.primary]}>+2.5</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.adjustButton, dynamicStyles.cardSecondary]}
                        onPress={() => {
                          const currentVal = parseFloat(getInputValues(exercise.id, exercise.exercise_id, exercise.exercise.category).weight) || 0;
                          updateInputValue(exercise.id, exercise.exercise_id, exercise.exercise.category, 'weight', (currentVal + WEIGHT_INCREMENTS.large).toString());
                        }}
                      >
                        <Text style={[styles.adjustButtonText, dynamicStyles.primary]}>+5</Text>
                      </Pressable>
                    </RNView>
                  </RNView>

                  {/* 횟수 입력 */}
                  <RNView style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, dynamicStyles.textSecondary]}>횟수</Text>
                    <RNView style={styles.inputWithButtons}>
                      <Pressable
                        style={[styles.adjustButton, dynamicStyles.cardSecondary]}
                        onPress={() => {
                          const currentVal = parseInt(getInputValues(exercise.id, exercise.exercise_id, exercise.exercise.category).reps, 10) || 0;
                          updateInputValue(exercise.id, exercise.exercise_id, exercise.exercise.category, 'reps', Math.max(0, currentVal - 1).toString());
                        }}
                      >
                        <Text style={[styles.adjustButtonText, dynamicStyles.textSecondary]}>-1</Text>
                      </Pressable>
                      <TextInput
                        style={[styles.inputCenterReps, dynamicStyles.card, { borderColor: colors.border, color: colors.text }]}
                        placeholder="0"
                        keyboardType="numeric"
                        value={getInputValues(exercise.id, exercise.exercise_id, exercise.exercise.category).reps}
                        onChangeText={(v) => updateInputValue(exercise.id, exercise.exercise_id, exercise.exercise.category, 'reps', v)}
                        placeholderTextColor={colors.textTertiary}
                        textAlign="center"
                      />
                      <Pressable
                        style={[styles.adjustButton, dynamicStyles.cardSecondary]}
                        onPress={() => {
                          const currentVal = parseInt(getInputValues(exercise.id, exercise.exercise_id, exercise.exercise.category).reps, 10) || 0;
                          updateInputValue(exercise.id, exercise.exercise_id, exercise.exercise.category, 'reps', (currentVal + 1).toString());
                        }}
                      >
                        <Text style={[styles.adjustButtonText, dynamicStyles.primary]}>+1</Text>
                      </Pressable>
                    </RNView>
                  </RNView>

                  {/* 세트 추가 버튼 */}
                  <Pressable
                    style={[styles.addSetButtonLarge, dynamicStyles.primaryBg]}
                    onPress={() => handleAddSet(exercise.id, exercise.exercise_id, exercise.exercise.category)}
                  >
                    <Text style={styles.addSetButtonLargeText}>
                      세트 {exercise.sets.length + 1} 추가
                    </Text>
                  </Pressable>
                </RNView>
              </RNView>
            );
          })
        )}

        <Pressable
          style={[styles.addMoreButton, { borderColor: colors.border }]}
          onPress={() => router.push('/workout/exercises')}
        >
          <Text style={[styles.addMoreButtonText, dynamicStyles.textSecondary]}>+ 운동 추가</Text>
        </Pressable>
      </ScrollView>

      <RNView style={[styles.footer, dynamicStyles.card, { borderTopColor: colors.border }]}>
        <Pressable style={[styles.cancelButton, dynamicStyles.errorBg]} onPress={handleCancelWorkout}>
          <Text style={[styles.cancelButtonText, dynamicStyles.error]}>취소</Text>
        </Pressable>
        <Pressable style={[styles.finishButton, dynamicStyles.primaryBg]} onPress={handleFinishWorkout}>
          <Text style={styles.finishButtonText}>운동 완료</Text>
        </Pressable>
      </RNView>

      {/* RPE 선택 모달 */}
      <Modal
        visible={rpeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleSkipRpe}
      >
        <RNView style={styles.modalOverlay}>
          <RNView style={[styles.modalContent, dynamicStyles.card]}>
            <Text style={[styles.modalTitle, dynamicStyles.text]}>이번 세트 어땠어요?</Text>
            <Text style={[styles.modalSubtitle, dynamicStyles.textSecondary]}>난이도를 선택하면 다음 무게를 추천해드려요</Text>

            <RNView style={styles.rpeOptions}>
              {RPE_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[styles.rpeOption, dynamicStyles.card, { borderColor: option.color }]}
                  onPress={() => handleSelectRpe(option.value)}
                >
                  <Text style={styles.rpeEmoji}>{option.emoji}</Text>
                  <Text style={[styles.rpeLabel, dynamicStyles.text]}>{option.label}</Text>
                  <Text style={[styles.rpeSuggestion, { color: option.color }]}>
                    {option.suggestion}
                  </Text>
                </Pressable>
              ))}
            </RNView>

            <Pressable style={styles.skipButton} onPress={handleSkipRpe}>
              <Text style={[styles.skipButtonText, dynamicStyles.textSecondary]}>건너뛰기</Text>
            </Pressable>
          </RNView>
        </RNView>
      </Modal>
    </RNView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  timerBanner: {
    padding: 16,
  },
  timerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timerLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  timerValue: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  timerProgress: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  timerProgressBar: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  timerTip: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sessionName: {
    fontSize: 22,
    fontWeight: '700',
  },
  elapsedTimeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  elapsedTimeText: {
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  sessionStats: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 12,
  },
  sessionStat: {
    flex: 1,
    alignItems: 'center',
  },
  sessionStatValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  sessionStatLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  sessionStatDivider: {
    width: 1,
  },
  restTimeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  restTimeLabel: {
    fontSize: 14,
    marginRight: 12,
  },
  restTimeOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  restTimeOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  restTimeOptionText: {
    fontSize: 13,
  },
  restTimeOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    marginBottom: 16,
  },
  addExerciseButton: {
    padding: 12,
    borderRadius: 8,
  },
  addExerciseButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  exerciseCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  recordsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  prevRecordBox: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
  },
  prevRecordLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  prevRecordValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  todayRecBox: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
  },
  todayRecLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  todayRecValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  todayRecMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  todayRecMessageIncrease: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  todayRecMessageReps: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  todayRecMessageMaintain: {
    backgroundColor: 'rgba(156, 163, 175, 0.15)',
  },
  todayRecMessageDecrease: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  todayRecMessageIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  todayRecMessageText: {
    flex: 1,
    fontSize: 13,
  },
  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
  },
  setHeaderText: {
    fontSize: 11,
    fontWeight: '500',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  setNumber: {
    width: 30,
    fontSize: 14,
  },
  setValue: {
    flex: 1,
    fontSize: 16,
    textAlign: 'center',
  },
  setVolume: {
    width: 50,
    fontSize: 12,
    textAlign: 'center',
  },
  deleteSetButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  deleteSetButtonText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  rpeBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rpeBadgeText: {
    fontSize: 16,
  },
  recommendationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  recommendationIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  recommendationText: {
    flex: 1,
    fontSize: 13,
  },
  estimated1RMBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  estimated1RMLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  estimated1RMValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  inputSection: {
    marginTop: 16,
    gap: 12,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  inputWithButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  adjustButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 44,
    alignItems: 'center',
  },
  adjustButtonSmall: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  adjustButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  adjustButtonTextSmall: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputCenter: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 18,
    fontWeight: '600',
    minWidth: 60,
  },
  inputCenterReps: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 18,
    fontWeight: '600',
    minWidth: 80,
  },
  addSetButtonLarge: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  addSetButtonLargeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  addMoreButton: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  addMoreButtonText: {
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  finishButton: {
    flex: 2,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  finishButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  rpeOptions: {
    gap: 12,
  },
  rpeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  rpeEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  rpeLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  rpeSuggestion: {
    fontSize: 12,
    fontWeight: '500',
  },
  skipButton: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 14,
  },
});
