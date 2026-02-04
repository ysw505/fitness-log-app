import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  Platform,
  Vibration,
  View as RNView,
  AppState,
  AppStateStatus,
  Modal,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Text, useThemeColors } from '@/components/Themed';
import { useWorkoutStore, WorkoutSetWithProfile } from '@/stores/workoutStore';
import { useHistoryStore, PersonalRecord } from '@/stores/historyStore';
import { useProfileStore } from '@/stores/profileStore';

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

// 목표 횟수 범위 설정 (Double Progression)
interface RepRange {
  min: number;
  max: number;
  label: string;
}

// REP_RANGES는 profileStore에서 사용 (사용자 설정)

// 이전 기록 기반 오늘의 추천 계산 (점진적 과부하 원칙)
interface TodayRecommendation {
  weight: number;
  reps: number;
  sets: number;
  message: string;
  subMessage?: string;
  type: 'increase_weight' | 'increase_reps' | 'deload' | 'maintain' | 'warning';
  icon: string;
  color: string;
}

interface ExerciseRecordData {
  max_weight: number;
  total_reps: number;
  total_sets: number;
  sets: any[];
  date?: string;
}

// 세트간 드롭률 계산
const calculateDropRate = (sets: any[]): { dropRate: number; isHighFatigue: boolean } => {
  if (sets.length < 2) return { dropRate: 0, isHighFatigue: false };

  const reps = sets.map((s: any) => s.reps || 0).filter((r: number) => r > 0);
  if (reps.length < 2) return { dropRate: 0, isHighFatigue: false };

  const firstSetReps = reps[0];
  const lastSetReps = reps[reps.length - 1];
  const dropRate = firstSetReps > 0 ? ((firstSetReps - lastSetReps) / firstSetReps) * 100 : 0;

  // 30% 이상 드롭은 높은 피로도
  return { dropRate: Math.round(dropRate), isHighFatigue: dropRate >= 30 };
};


// 디로드 필요 여부 판단
const needsDeload = (records: ExerciseRecordData[], targetRange: RepRange): boolean => {
  if (records.length < 2) return false;

  // 최근 2회 연속으로 목표 최소 횟수 미달인지 확인
  let consecutiveFails = 0;
  for (let i = 0; i < Math.min(2, records.length); i++) {
    const avgReps = Math.round(records[i].total_reps / records[i].total_sets);
    if (avgReps < targetRange.min - 1) { // 최소보다 1회 이상 부족
      consecutiveFails++;
    }
  }

  return consecutiveFails >= 2;
};

const getTodayRecommendation = (
  records: ExerciseRecordData[] | null,
  category: string,
  targetRange: RepRange
): TodayRecommendation | null => {
  if (!records || records.length === 0) return null;

  const prevRecord = records[0];
  if (!prevRecord || prevRecord.max_weight === 0) return null;

  const avgReps = Math.round(prevRecord.total_reps / prevRecord.total_sets);
  const lastSets = prevRecord.sets || [];

  // 카테고리별 무게 증가폭
  const weightIncrement = ['legs', 'back'].includes(category) ? 5 : 2.5;

  // 세트별 횟수 분석
  const repCounts = lastSets.map((s: any) => s.reps || 0).filter((r: number) => r > 0);
  const minReps = repCounts.length > 0 ? Math.min(...repCounts) : avgReps;

  // 세트간 드롭률 분석
  const { dropRate, isHighFatigue } = calculateDropRate(lastSets);

  // 디로드 필요 여부
  if (needsDeload(records, targetRange)) {
    const deloadWeight = Math.round(prevRecord.max_weight * 0.9 / 2.5) * 2.5; // 10% 감량, 2.5kg 단위
    return {
      weight: deloadWeight,
      reps: targetRange.min,
      sets: prevRecord.total_sets,
      message: '디로드 주간',
      subMessage: `2회 연속 ${targetRange.min}회 미달 → 무게 10% 감량 후 다시 시작`,
      type: 'deload',
      icon: '🔄',
      color: '#f59e0b', // amber
    };
  }

  // Double Progression 로직
  if (avgReps >= targetRange.max && minReps >= targetRange.max - 2) {
    // 목표 상한 달성 → 무게 증가
    return {
      weight: prevRecord.max_weight + weightIncrement,
      reps: targetRange.min,
      sets: prevRecord.total_sets,
      message: `무게 +${weightIncrement}kg`,
      subMessage: `${avgReps}회 달성! ${targetRange.min}회부터 다시 시작`,
      type: 'increase_weight',
      icon: '💪',
      color: '#22c55e', // green
    };
  } else if (avgReps >= targetRange.min && avgReps < targetRange.max) {
    // 목표 범위 내 → 횟수 증가 도전
    const targetReps = Math.min(avgReps + 1, targetRange.max);

    // 피로도 경고 추가
    if (isHighFatigue) {
      return {
        weight: prevRecord.max_weight,
        reps: avgReps, // 같은 횟수 유지
        sets: prevRecord.total_sets,
        message: `${avgReps}회 유지`,
        subMessage: `세트간 ${dropRate}% 드롭 → 휴식 늘리거나 현재 무게 적응`,
        type: 'warning',
        icon: '⚠️',
        color: '#f59e0b', // amber
      };
    }

    return {
      weight: prevRecord.max_weight,
      reps: targetReps,
      sets: prevRecord.total_sets,
      message: `${targetReps}회 도전`,
      subMessage: `목표: ${targetRange.min}-${targetRange.max}회 (현재 ${avgReps}회)`,
      type: 'increase_reps',
      icon: '🎯',
      color: '#3b82f6', // blue
    };
  } else if (minReps < targetRange.min) {
    // 목표 하한 미달 → 현재 무게 유지
    return {
      weight: prevRecord.max_weight,
      reps: targetRange.min,
      sets: prevRecord.total_sets,
      message: `${prevRecord.max_weight}kg 유지`,
      subMessage: `목표 ${targetRange.min}회 미달 → 같은 무게로 적응`,
      type: 'maintain',
      icon: '✅',
      color: '#6b7280', // gray
    };
  } else {
    // 기본: 현재 무게 유지
    return {
      weight: prevRecord.max_weight,
      reps: avgReps,
      sets: prevRecord.total_sets,
      message: `${prevRecord.max_weight}kg × ${avgReps}회`,
      subMessage: '지난번과 동일하게 진행',
      type: 'maintain',
      icon: '✅',
      color: '#6b7280', // gray
    };
  }
};


// 이전 기록 표시 컴포넌트 (지난 운동 세트 + PR)
interface PreviousRecordInfoProps {
  prevSets: { weight: number; reps: number }[];
  personalRecord: PersonalRecord | null;
  colors: any;
}

const PreviousRecordInfo = ({ prevSets, personalRecord, colors }: PreviousRecordInfoProps) => {
  if (prevSets.length === 0 && !personalRecord) return null;

  return (
    <RNView style={styles.previousRecordContainer}>
      {/* 이전 운동 세트 표시 */}
      {prevSets.length > 0 && (
        <RNView style={styles.prevSetsRow}>
          <Text style={[styles.prevSetsLabel, { color: colors.textTertiary }]}>
            이전:
          </Text>
          <RNView style={styles.prevSetsList}>
            {prevSets.slice(0, 5).map((set, idx) => (
              <Text key={idx} style={[styles.prevSetItem, { color: colors.textSecondary }]}>
                {set.weight}kg×{set.reps}
              </Text>
            ))}
            {prevSets.length > 5 && (
              <Text style={[styles.prevSetMore, { color: colors.textTertiary }]}>
                +{prevSets.length - 5}
              </Text>
            )}
          </RNView>
        </RNView>
      )}
      {/* PR 배지 */}
      {personalRecord && personalRecord.max_weight > 0 && (
        <RNView style={[styles.prBadge, { backgroundColor: colors.primary + '15' }]}>
          <Text style={[styles.prBadgeIcon]}>🏆</Text>
          <Text style={[styles.prBadgeText, { color: colors.primary }]}>
            PR {personalRecord.max_weight}kg×{personalRecord.max_reps_at_weight}
          </Text>
        </RNView>
      )}
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
    removeSet,
    activeProfileIds,
    currentSetProfileId,
    setCurrentSetProfile,
    restTimerEndTime: storedRestTimerEndTime,
    startRestTimer: storeStartRestTimer,
    stopRestTimer: storeStopRestTimer,
  } = useWorkoutStore();

  const { getExerciseHistory, personalRecords } = useHistoryStore();
  const { profiles, getRepRange } = useProfileStore();

  // 사용자 설정 목표 횟수 범위
  const targetRepRange = getRepRange();

  // 같이 운동하는 프로필들 (activeProfileIds에 해당하는 것만)
  const activeProfiles = profiles.filter((p) => activeProfileIds.includes(p.id));
  const currentProfile = profiles.find((p) => p.id === currentSetProfileId);

  // 운동별 입력값 관리
  const [inputValues, setInputValues] = useState<Record<string, { weight: string; reps: string }>>({});

  // 입력 오류 상태 (빨간 테두리 표시용)
  const [inputErrors, setInputErrors] = useState<Record<string, { weight: boolean; reps: boolean }>>({});

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

  // 휴식 타이머 상태
  const [restTimerActive, setRestTimerActive] = useState(false);
  const [restTimeRemaining, setRestTimeRemaining] = useState(0);
  const [showRestPicker, setShowRestPicker] = useState(false); // 세트 완료 후 휴식 선택 UI
  const [totalRestTime, setTotalRestTime] = useState(0); // 프로그레스바용
  const restTimerEndTime = useRef<number | null>(null); // 타이머 종료 예정 시간 (timestamp)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appState = useRef(AppState.currentState);

  // 운동 경과 시간
  const [elapsedTime, setElapsedTime] = useState('00:00');

  // 운동 기록 모달 상태
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedExerciseForHistory, setSelectedExerciseForHistory] = useState<{
    id: string;
    name: string;
    name_ko: string | null;
  } | null>(null);

  // 앱 시작/화면 진입 시 저장된 휴식 타이머 복원
  useEffect(() => {
    if (activeSession && storedRestTimerEndTime) {
      const remaining = Math.ceil((storedRestTimerEndTime - Date.now()) / 1000);
      if (remaining > 0) {
        restTimerEndTime.current = storedRestTimerEndTime;
        setRestTimeRemaining(remaining);
        setTotalRestTime(remaining);
        setRestTimerActive(true);
      } else {
        // 이미 만료된 타이머 클리어
        storeStopRestTimer();
      }
    }
  }, []); // 컴포넌트 마운트 시 한 번만 실행

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
        // 종료 시간 기준으로 남은 시간 계산 (백그라운드 복귀 대비)
        if (restTimerEndTime.current) {
          const remaining = Math.ceil((restTimerEndTime.current - Date.now()) / 1000);
          setRestTimeRemaining(Math.max(0, remaining));
        } else {
          setRestTimeRemaining((prev) => prev - 1);
        }
      }, 1000);
    } else if (restTimerActive && restTimeRemaining === 0) {
      // 타이머 완료
      setRestTimerActive(false);
      restTimerEndTime.current = null;
      storeStopRestTimer(); // Store에서도 클리어
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

  // 앱 상태 변화 감지 (백그라운드 → 포그라운드)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // 백그라운드에서 포그라운드로 돌아왔을 때
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (restTimerActive && restTimerEndTime.current) {
          const remaining = Math.ceil((restTimerEndTime.current - Date.now()) / 1000);
          if (remaining <= 0) {
            // 이미 시간이 지남 → 타이머 완료 처리
            setRestTimeRemaining(0);
          } else {
            // 남은 시간 업데이트
            setRestTimeRemaining(remaining);
          }
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [restTimerActive]);

  const startRestTimer = (seconds: number) => {
    restTimerEndTime.current = Date.now() + seconds * 1000;
    setRestTimeRemaining(seconds);
    setTotalRestTime(seconds);
    setRestTimerActive(true);
    setShowRestPicker(false);
    // Store에도 저장하여 앱 재시작 시 복원 가능하게
    storeStartRestTimer(seconds);
  };

  const extendRestTimer = (seconds: number) => {
    if (restTimerEndTime.current) {
      restTimerEndTime.current += seconds * 1000;
    }
    setRestTimeRemaining((prev) => prev + seconds);
    setTotalRestTime((prev) => prev + seconds);
  };

  const stopRestTimer = () => {
    setRestTimerActive(false);
    setRestTimeRemaining(0);
    restTimerEndTime.current = null;
    setShowRestPicker(false);
    // Store에서도 클리어
    storeStopRestTimer();
  };

  const showRestPickerUI = () => {
    setShowRestPicker(true);
  };

  const skipRest = () => {
    setShowRestPicker(false);
  };

  // 이전 기록 가져오기 (배열로 반환 - 디로드 판단 등에 사용)
  const getExerciseRecords = (exerciseId: string): ExerciseRecordData[] | null => {
    const history = getExerciseHistory(exerciseId);
    if (history && history.records.length > 0) {
      return history.records;
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
      // 이전 세트 값 그대로 사용
      return {
        weight: lastSet.weight?.toString() || '',
        reps: lastSet.reps?.toString() || '',
      };
    }

    // 첫 세트는 오늘 추천값 사용
    const records = getExerciseRecords(exerciseDbId);
    const todayRec = getTodayRecommendation(records, category, targetRepRange);

    if (todayRec) {
      return {
        weight: todayRec.weight.toString(),
        reps: todayRec.reps.toString(),
      };
    }

    // 이전 기록에서 가져오기
    const prevRecord = records?.[0];
    if (prevRecord && prevRecord.max_weight > 0) {
      return {
        weight: prevRecord.max_weight.toString(),
        reps: Math.round(prevRecord.total_reps / prevRecord.total_sets).toString() || '',
      };
    }

    return { weight: '', reps: '' };
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
    // Allow 0kg (empty = 0kg for bodyweight exercises)
    const weightValue = values.weight === '' ? 0 : parseFloat(values.weight);
    // Reps must be at least 1
    const repsValue = parseInt(values.reps, 10);
    const hasRepsError = !values.reps || isNaN(repsValue) || repsValue <= 0 || isNaN(weightValue) || weightValue < 0;

    if (hasRepsError) {
      // Only show error for reps (weight 0 is always valid)
      setInputErrors((prev) => ({
        ...prev,
        [workoutExerciseId]: { weight: false, reps: true },
      }));
      // Keep hint visible until user fixes it (no auto-dismiss)
      return;
    }

    // Clear any existing errors
    setInputErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[workoutExerciseId];
      return newErrors;
    });

    const currentExercise = exercises.find((e) => e.id === workoutExerciseId);
    const setNumber = (currentExercise?.sets.length || 0) + 1;

    try {
      await addSet(workoutExerciseId, {
        set_number: setNumber,
        weight: weightValue, // 0kg allowed (empty = 0)
        reps: repsValue,
      });

      // 입력값 초기화하여 다음 세트 준비
      setInputValues((prev) => {
        const newValues = { ...prev };
        delete newValues[workoutExerciseId];
        return newValues;
      });

      // 휴식 시간 선택 UI 표시
      showRestPickerUI();
    } catch (error) {
      console.error('Failed to add set:', error);
    }
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

  // 이전 기록 한 번에 복사하기
  const handleCopyPreviousSets = async (
    workoutExerciseId: string,
    prevSets: { weight: number; reps: number }[]
  ) => {
    try {
      for (let i = 0; i < prevSets.length; i++) {
        const prevSet = prevSets[i];
        await addSet(workoutExerciseId, {
          set_number: i + 1,
          weight: prevSet.weight,
          reps: prevSet.reps,
        });
      }
    } catch (error) {
      console.error('Failed to copy previous sets:', error);
      showAlert('오류', '이전 기록을 복사하는 중 오류가 발생했습니다');
    }
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

  // 운동 카드 렌더링 함수 (DraggableFlatList용)
  const renderExerciseCard = useCallback(({ item: exercise, drag, isActive }: RenderItemParams<typeof exercises[0]>) => {
    const records = getExerciseRecords(exercise.exercise_id);
    const prevRecord = records?.[0];
    const todayRec = getTodayRecommendation(records, exercise.exercise.category, targetRepRange);

    // 이전 운동의 개별 세트들 (무게/횟수)
    const prevSets = prevRecord?.sets?.map((s: any) => ({
      weight: s.weight || 0,
      reps: s.reps || 0,
    })).filter((s: any) => s.weight > 0 || s.reps > 0) || [];

    // 이 운동의 PR (개인 기록)
    const exercisePR = personalRecords[exercise.exercise_id] || null;

    return (
      <ScaleDecorator>
        <RNView style={[styles.exerciseCard, dynamicStyles.card, isActive && styles.exerciseCardDragging]}>
          {/* 운동 헤더 (드래그 핸들 + 이름 + 1RM) */}
          <RNView style={styles.exerciseHeader}>
            <Pressable
              onLongPress={drag}
              disabled={isActive}
              style={styles.dragHandle}
            >
              <Text style={[styles.dragHandleText, dynamicStyles.textTertiary]}>⋮⋮</Text>
            </Pressable>
            <Text style={[styles.exerciseName, dynamicStyles.text, { flex: 1 }]}>
              {exercise.exercise.name_ko || exercise.exercise.name}
            </Text>
            {/* 1RM 인라인 표시 */}
            {exercise.sets.length > 0 && (() => {
              const bestSet = exercise.sets.reduce((best, set) => {
                const current1RM = calculate1RM(set.weight || 0, set.reps || 0);
                const best1RM = calculate1RM(best.weight || 0, best.reps || 0);
                return current1RM > best1RM ? set : best;
              }, exercise.sets[0]);
              const estimated1RM = calculate1RM(bestSet.weight || 0, bestSet.reps || 0);
              if (estimated1RM > 0) {
                return (
                  <RNView style={[styles.inline1RMBadge, { backgroundColor: colors.primary + '15' }]}>
                    <Text style={[styles.inline1RMText, { color: colors.primary }]}>1RM {estimated1RM}kg</Text>
                  </RNView>
                );
              }
              return null;
            })()}
          </RNView>

          {/* 인라인 통계 배지들 */}
          {records && records.length > 0 && (
            <RNView style={styles.inlineStatsRow}>
              {/* 운동 횟수 */}
              <RNView style={[styles.inlineStatBadge, dynamicStyles.cardSecondary]}>
                <Text style={[styles.inlineStatIcon]}>📊</Text>
                <Text style={[styles.inlineStatText, dynamicStyles.textSecondary]}>{records.length}회 운동</Text>
              </RNView>

              {/* 역대 최고 무게 */}
              {exercisePR && exercisePR.max_weight > 0 && (
                <RNView style={[styles.inlineStatBadge, dynamicStyles.cardSecondary]}>
                  <Text style={[styles.inlineStatIcon]}>🏆</Text>
                  <Text style={[styles.inlineStatText, dynamicStyles.textSecondary]}>
                    최고 {exercisePR.max_weight}kg×{exercisePR.max_reps_at_weight}
                  </Text>
                </RNView>
              )}

              {/* 트렌드 (최근 볼륨 비교) */}
              {records.length >= 2 && (() => {
                // 볼륨 = max_weight * total_reps
                const recentVolume = records[0].max_weight * records[0].total_reps;
                const prevVolume = records[1].max_weight * records[1].total_reps;
                const diff = recentVolume - prevVolume;
                const percent = prevVolume > 0 ? Math.round((diff / prevVolume) * 100) : 0;
                if (Math.abs(percent) >= 5) {
                  const isUp = diff > 0;
                  return (
                    <RNView style={[styles.inlineStatBadge, { backgroundColor: isUp ? '#22c55e15' : '#ef444415' }]}>
                      <Text style={[styles.inlineStatIcon]}>{isUp ? '📈' : '📉'}</Text>
                      <Text style={[styles.inlineStatText, { color: isUp ? '#22c55e' : '#ef4444' }]}>
                        {isUp ? '+' : ''}{percent}%
                      </Text>
                    </RNView>
                  );
                }
                return null;
              })()}

              {/* 기록 보기 버튼 */}
              <Pressable
                style={[styles.viewHistoryBtn, { backgroundColor: colors.primary + '15' }]}
                onPress={() => {
                  setSelectedExerciseForHistory({
                    id: exercise.exercise_id,
                    name: exercise.exercise.name,
                    name_ko: exercise.exercise.name_ko,
                  });
                  setHistoryModalVisible(true);
                }}
              >
                <Text style={[styles.viewHistoryBtnText, { color: colors.primary }]}>📋 기록 보기</Text>
              </Pressable>
            </RNView>
          )}

          {/* 이전 세트 기록 & PR 배지 */}
          <PreviousRecordInfo
            prevSets={prevSets}
            personalRecord={exercisePR}
            colors={colors}
          />

          {/* 지난번과 동일 버튼 (이전 기록 있고, 현재 세트 없을 때만) */}
          {prevSets.length > 0 && exercise.sets.length === 0 && (
            <Pressable
              style={[styles.copyPrevSetsButton, { backgroundColor: colors.primary + '15' }]}
              onPress={() => handleCopyPreviousSets(exercise.id, prevSets)}
            >
              <Text style={[styles.copyPrevSetsButtonText, { color: colors.primary }]}>
                지난번과 동일
              </Text>
            </Pressable>
          )}

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
                <RNView style={[styles.todayRecBox, { backgroundColor: todayRec.color + '15' }]}>
                  <Text style={[styles.todayRecLabel, { color: todayRec.color }]}>오늘 추천</Text>
                  <Text style={[styles.todayRecValue, { color: todayRec.color }]}>
                    {todayRec.weight}kg × {todayRec.reps}회
                  </Text>
                </RNView>
              )}
            </RNView>
          )}

          {/* 추천 메시지 */}
          {todayRec && exercise.sets.length === 0 && (
            <RNView style={[styles.todayRecMessage, { backgroundColor: todayRec.color + '15' }]}>
              <Text style={styles.todayRecMessageIcon}>{todayRec.icon}</Text>
              <RNView style={styles.todayRecMessageContent}>
                <Text style={[styles.todayRecMessageText, { color: todayRec.color }]}>{todayRec.message}</Text>
                {todayRec.subMessage && (
                  <Text style={[styles.todayRecSubMessage, dynamicStyles.textTertiary]}>{todayRec.subMessage}</Text>
                )}
              </RNView>
            </RNView>
          )}

          {/* 세트 목록 - Hevy/Strong 스타일 */}
          {exercise.sets.length > 0 && (
            <RNView style={styles.setListContainer}>
              {/* 헤더 */}
              <RNView style={styles.setHeader}>
                <Text style={[styles.setHeaderText, dynamicStyles.textTertiary, { width: 40 }]}>세트</Text>
                {activeProfileIds.length > 1 && (
                  <Text style={[styles.setHeaderText, dynamicStyles.textTertiary, { width: 36 }]}></Text>
                )}
                <Text style={[styles.setHeaderText, dynamicStyles.textTertiary, { flex: 1 }]}>kg</Text>
                <Text style={[styles.setHeaderText, dynamicStyles.textTertiary, { flex: 1 }]}>횟수</Text>
                <RNView style={{ width: 28 }} />
              </RNView>

              {/* 완료된 세트 rows - 녹색 강조 */}
              {exercise.sets.map((set, index) => {
                const setWithProfile = set as WorkoutSetWithProfile;
                return (
                  <RNView
                    key={set.id}
                    style={[
                      styles.completedSetRow,
                      {
                        backgroundColor: colors.success + '15',
                        borderLeftColor: colors.success,
                        borderColor: colors.success + '30',
                      }
                    ]}
                  >
                    {/* 체크마크 아이콘 */}
                    <RNView style={[styles.completedCheckmark, { backgroundColor: colors.success }]}>
                      <Text style={styles.completedCheckmarkText}>✓</Text>
                    </RNView>
                    <Text style={[styles.completedSetNumber, dynamicStyles.textTertiary]}>{index + 1}</Text>
                    {activeProfileIds.length > 1 && (
                      <RNView style={[styles.setProfileBadge, { backgroundColor: colors.primary + '20' }]}>
                        <Text style={[styles.setProfileText, { color: colors.primary }]}>
                          {setWithProfile.profile_name?.charAt(0) || '?'}
                        </Text>
                      </RNView>
                    )}
                    <Text style={[styles.completedSetValue, dynamicStyles.textSecondary]}>{set.weight}</Text>
                    <Text style={[styles.completedSetValue, dynamicStyles.textSecondary]}>{set.reps}</Text>
                    <Pressable
                      style={styles.deleteSetButton}
                      onPress={() => handleDeleteSet(set.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={[styles.deleteSetButtonText, dynamicStyles.textTertiary]}>✕</Text>
                    </Pressable>
                  </RNView>
                );
              })}
            </RNView>
          )}


          {/* 입력 영역 - 파란색 강조로 활성 상태 표시 */}
          <RNView
            style={[
              styles.activeInputSection,
              {
                backgroundColor: colors.primary + '12',
                borderColor: colors.primary,
              }
            ]}
          >
            {/* "다음 세트" 라벨 */}
            <RNView style={[styles.nextSetBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.nextSetBadgeText}>세트 {exercise.sets.length + 1}</Text>
            </RNView>
            <RNView style={styles.compactInputRow}>
              {/* 무게 입력 */}
              <RNView style={styles.compactInputGroup}>
                <Text style={[styles.inputLabel, dynamicStyles.textTertiary]}>무게 (kg)</Text>
                <RNView style={[styles.compactStepper, dynamicStyles.cardSecondary]}>
                  <Pressable
                    style={styles.stepperBtn}
                    onPress={() => {
                      const currentVal = parseFloat(getInputValues(exercise.id, exercise.exercise_id, exercise.exercise.category).weight) || 0;
                      updateInputValue(exercise.id, exercise.exercise_id, exercise.exercise.category, 'weight', Math.max(0, currentVal - WEIGHT_INCREMENTS.small).toString());
                    }}
                  >
                    <Text style={[styles.stepperBtnText, dynamicStyles.textSecondary]}>−</Text>
                  </Pressable>
                  <TextInput
                    style={[styles.compactInput, dynamicStyles.cardSecondary, { color: colors.text }]}
                    placeholder="0"
                    keyboardType="numeric"
                    value={getInputValues(exercise.id, exercise.exercise_id, exercise.exercise.category).weight}
                    onChangeText={(v) => updateInputValue(exercise.id, exercise.exercise_id, exercise.exercise.category, 'weight', v)}
                    placeholderTextColor={colors.textTertiary}
                  />
                  <Pressable
                    style={styles.stepperBtn}
                    onPress={() => {
                      const currentVal = parseFloat(getInputValues(exercise.id, exercise.exercise_id, exercise.exercise.category).weight) || 0;
                      updateInputValue(exercise.id, exercise.exercise_id, exercise.exercise.category, 'weight', (currentVal + WEIGHT_INCREMENTS.small).toString());
                    }}
                  >
                    <Text style={[styles.stepperBtnText, dynamicStyles.primary]}>+</Text>
                  </Pressable>
                </RNView>
              </RNView>

              {/* 횟수 입력 */}
              <RNView style={styles.compactInputGroup}>
                <Text style={[styles.inputLabel, dynamicStyles.textTertiary]}>횟수</Text>
                <RNView style={[
                  styles.compactStepper,
                  dynamicStyles.cardSecondary,
                  inputErrors[exercise.id]?.reps && styles.inputIncomplete,
                ]}>
                  <Pressable
                    style={styles.stepperBtn}
                    onPress={() => {
                      const currentVal = parseInt(getInputValues(exercise.id, exercise.exercise_id, exercise.exercise.category).reps, 10) || 0;
                      updateInputValue(exercise.id, exercise.exercise_id, exercise.exercise.category, 'reps', Math.max(1, currentVal - 1).toString());
                      if (inputErrors[exercise.id]?.reps) {
                        setInputErrors((prev) => {
                          const newErrors = { ...prev };
                          delete newErrors[exercise.id];
                          return newErrors;
                        });
                      }
                    }}
                  >
                    <Text style={[styles.stepperBtnText, dynamicStyles.textSecondary]}>−</Text>
                  </Pressable>
                  <TextInput
                    style={[styles.compactInput, dynamicStyles.cardSecondary, { color: colors.text }]}
                    placeholder="0"
                    keyboardType="numeric"
                    value={getInputValues(exercise.id, exercise.exercise_id, exercise.exercise.category).reps}
                    onChangeText={(v) => {
                      updateInputValue(exercise.id, exercise.exercise_id, exercise.exercise.category, 'reps', v);
                      if (inputErrors[exercise.id]?.reps) {
                        setInputErrors((prev) => {
                          const newErrors = { ...prev };
                          delete newErrors[exercise.id];
                          return newErrors;
                        });
                      }
                    }}
                    placeholderTextColor={colors.textTertiary}
                  />
                  <Pressable
                    style={styles.stepperBtn}
                    onPress={() => {
                      const currentVal = parseInt(getInputValues(exercise.id, exercise.exercise_id, exercise.exercise.category).reps, 10) || 0;
                      updateInputValue(exercise.id, exercise.exercise_id, exercise.exercise.category, 'reps', (currentVal + 1).toString());
                      if (inputErrors[exercise.id]?.reps) {
                        setInputErrors((prev) => {
                          const newErrors = { ...prev };
                          delete newErrors[exercise.id];
                          return newErrors;
                        });
                      }
                    }}
                  >
                    <Text style={[styles.stepperBtnText, dynamicStyles.primary]}>+</Text>
                  </Pressable>
                </RNView>
                {/* 인라인 힌트 메시지 */}
                {inputErrors[exercise.id]?.reps && (
                  <Text style={styles.inputHint}>1회 이상 입력하세요</Text>
                )}
              </RNView>

              {/* 세트 추가 버튼 */}
              <Pressable
                style={[styles.compactAddBtn, dynamicStyles.primaryBg]}
                onPress={() => handleAddSet(exercise.id, exercise.exercise_id, exercise.exercise.category)}
              >
                <Text style={styles.compactAddBtnText}>+</Text>
                {activeProfileIds.length > 1 && currentProfile && (
                  <Text style={styles.compactAddBtnProfile}>{currentProfile.name.charAt(0)}</Text>
                )}
              </Pressable>
            </RNView>
          </RNView>
        </RNView>
      </ScaleDecorator>
    );
  }, [exercises, colors, dynamicStyles, activeProfileIds, currentSetProfileId, currentProfile, targetRepRange, handleAddSet, handleDeleteSet, getExerciseRecords, getTodayRecommendation, getInputValues, updateInputValue, personalRecords]);

  return (
    <RNView style={[styles.container, dynamicStyles.container]}>
      {/* 휴식 타이머 배너 */}
      {restTimerActive && (
        <RNView style={[styles.timerBanner, dynamicStyles.primaryBg]}>
          <RNView style={styles.timerContent}>
            <Pressable style={styles.timerSkipBtn} onPress={stopRestTimer}>
              <Text style={styles.timerSkipBtnText}>건너뛰기</Text>
            </Pressable>
            <Text style={styles.timerValue}>{formatTime(restTimeRemaining)}</Text>
            <Pressable style={styles.timerExtendBtn} onPress={() => extendRestTimer(30)}>
              <Text style={styles.timerExtendBtnText}>+30초</Text>
            </Pressable>
          </RNView>
          <RNView style={styles.timerProgress}>
            <RNView
              style={[
                styles.timerProgressBar,
                { width: `${(restTimeRemaining / totalRestTime) * 100}%` },
              ]}
            />
          </RNView>
        </RNView>
      )}

      <GestureHandlerRootView style={styles.gestureRoot}>
        <DraggableFlatList
          data={exercises}
          keyExtractor={(item) => item.id}
          renderItem={renderExerciseCard}
          onDragEnd={({ data }) => {
            // DraggableFlatList가 반환한 새 순서로 한 번에 업데이트
            // 기존 exercises와 순서가 다른 경우에만 업데이트
            const orderChanged = data.some((item, index) => exercises[index]?.id !== item.id);
            if (orderChanged) {
              // 새 순서의 운동 목록으로 직접 업데이트
              useWorkoutStore.setState({ exercises: data });
            }
          }}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <RNView style={styles.header}>
              <RNView style={styles.headerTop}>
                <Text style={[styles.sessionName, dynamicStyles.text]}>{activeSession.name}</Text>
                <RNView style={[styles.elapsedTimeBadge, dynamicStyles.primaryLightBg]}>
                  <Text style={[styles.elapsedTimeText, dynamicStyles.text]}>{elapsedTime}</Text>
                </RNView>
              </RNView>

              {/* 프로필 탭 (같이 운동할 때) */}
              {activeProfileIds.length > 1 && (
                <RNView style={styles.profileTabs}>
                  {activeProfiles.map((profile) => {
                    const isSelected = currentSetProfileId === profile.id;
                    const profileSetCount = exercises.reduce(
                      (sum, e) =>
                        sum +
                        e.sets.filter((s) => (s as WorkoutSetWithProfile).profile_id === profile.id).length,
                      0
                    );
                    const profileVolume = exercises.reduce(
                      (sum, e) =>
                        sum +
                        e.sets
                          .filter((s) => (s as WorkoutSetWithProfile).profile_id === profile.id)
                          .reduce((setSum, s) => setSum + (s.weight || 0) * (s.reps || 0), 0),
                      0
                    );
                    return (
                      <Pressable
                        key={profile.id}
                        style={[
                          styles.profileTab,
                          isSelected ? dynamicStyles.primaryBg : dynamicStyles.cardSecondary,
                        ]}
                        onPress={() => setCurrentSetProfile(profile.id)}
                      >
                        <Text
                          style={[
                            styles.profileTabName,
                            isSelected ? styles.profileTabNameSelected : dynamicStyles.text,
                          ]}
                        >
                          {profile.name}
                        </Text>
                        <Text
                          style={[
                            styles.profileTabStats,
                            isSelected ? styles.profileTabStatsSelected : dynamicStyles.textTertiary,
                          ]}
                        >
                          {profileSetCount}세트 · {profileVolume.toLocaleString()}kg
                        </Text>
                      </Pressable>
                    );
                  })}
                </RNView>
              )}

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
          }
          ListEmptyComponent={
            <RNView style={styles.emptyState}>
              <Text style={[styles.emptyText, dynamicStyles.textSecondary]}>운동을 추가해주세요</Text>
              <Pressable
                style={[styles.addExerciseButton, dynamicStyles.primaryBg]}
                onPress={() => router.push('/workout/exercises')}
              >
                <Text style={styles.addExerciseButtonText}>운동 추가</Text>
              </Pressable>
            </RNView>
          }
          ListFooterComponent={
            exercises.length > 0 ? (
              <Pressable
                style={[styles.addMoreButton, { borderColor: colors.border }]}
                onPress={() => router.push('/workout/exercises')}
              >
                <Text style={[styles.addMoreButtonText, dynamicStyles.textSecondary]}>+ 운동 추가</Text>
              </Pressable>
            ) : null
          }
        />
      </GestureHandlerRootView>

      {/* 휴식 시간 선택 (하단 Sheet) */}
      {showRestPicker && !restTimerActive && (
        <>
          <Pressable style={styles.restSheetOverlay} onPress={skipRest} />
          <RNView style={[styles.restSheetContainer, dynamicStyles.card]}>
            <RNView style={styles.restSheetHandle} />
            <Text style={[styles.restSheetTitle, dynamicStyles.text]}>휴식 시간</Text>
            <RNView style={styles.restSheetOptions}>
              {[60, 90, 120, 180].map((time) => (
                <Pressable
                  key={time}
                  style={[styles.restSheetOption, dynamicStyles.primaryLightBg]}
                  onPress={() => startRestTimer(time)}
                >
                  <Text style={[styles.restSheetOptionText, dynamicStyles.primary]}>
                    {time === 60 ? '1분' : time === 90 ? '1:30' : time === 120 ? '2분' : '3분'}
                  </Text>
                </Pressable>
              ))}
            </RNView>
            <Pressable style={styles.restSheetSkip} onPress={skipRest}>
              <Text style={[styles.restSheetSkipText, dynamicStyles.textSecondary]}>휴식 안 함</Text>
            </Pressable>
          </RNView>
        </>
      )}

      {/* 운동 기록 모달 */}
      <Modal
        visible={historyModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setHistoryModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setHistoryModalVisible(false)}
        >
          <Pressable
            style={[styles.modalContent, dynamicStyles.card]}
            onPress={(e) => e.stopPropagation()}
          >
            {selectedExerciseForHistory && (() => {
              const history = getExerciseHistory(selectedExerciseForHistory.id);
              const pr = personalRecords[selectedExerciseForHistory.id];
              const records = history?.records || [];

              // 차트용 데이터 (최근 10개, 역순으로 오래된 것부터)
              const chartData = records.slice(0, 10).reverse();
              const maxWeight = Math.max(...chartData.map(r => r.max_weight), 1);

              // 통계 계산
              const totalSessions = records.length;
              const avgWeight = totalSessions > 0
                ? Math.round(records.reduce((sum, r) => sum + r.max_weight, 0) / totalSessions)
                : 0;
              const avgVolume = totalSessions > 0
                ? Math.round(records.reduce((sum, r) => sum + r.total_volume, 0) / totalSessions)
                : 0;
              const bestVolumeRecord = records.reduce((best, r) =>
                r.total_volume > (best?.total_volume || 0) ? r : best, records[0]);

              return (
                <>
                  {/* 헤더 */}
                  <RNView style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, dynamicStyles.text]}>
                      {selectedExerciseForHistory.name_ko || selectedExerciseForHistory.name}
                    </Text>
                    <Pressable
                      style={styles.modalCloseBtn}
                      onPress={() => setHistoryModalVisible(false)}
                    >
                      <Text style={[styles.modalCloseBtnText, dynamicStyles.textSecondary]}>✕</Text>
                    </Pressable>
                  </RNView>

                  <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                    {/* PR 카드 */}
                    {pr && pr.max_weight > 0 && (
                      <RNView style={[styles.prCard, { backgroundColor: colors.primary + '15' }]}>
                        <Text style={styles.prCardIcon}>🏆</Text>
                        <RNView style={styles.prCardContent}>
                          <Text style={[styles.prCardLabel, { color: colors.primary }]}>개인 기록 (PR)</Text>
                          <Text style={[styles.prCardValue, { color: colors.primary }]}>
                            {pr.max_weight}kg × {pr.max_reps_at_weight}회
                          </Text>
                          <Text style={[styles.prCardSub, dynamicStyles.textTertiary]}>
                            예상 1RM: {pr.estimated_1rm}kg
                          </Text>
                        </RNView>
                      </RNView>
                    )}

                    {/* 통계 요약 */}
                    <RNView style={styles.statsGrid}>
                      <RNView style={[styles.statCard, dynamicStyles.cardSecondary]}>
                        <Text style={[styles.statCardValue, dynamicStyles.text]}>{totalSessions}</Text>
                        <Text style={[styles.statCardLabel, dynamicStyles.textTertiary]}>총 운동</Text>
                      </RNView>
                      <RNView style={[styles.statCard, dynamicStyles.cardSecondary]}>
                        <Text style={[styles.statCardValue, dynamicStyles.text]}>{avgWeight}kg</Text>
                        <Text style={[styles.statCardLabel, dynamicStyles.textTertiary]}>평균 무게</Text>
                      </RNView>
                      <RNView style={[styles.statCard, dynamicStyles.cardSecondary]}>
                        <Text style={[styles.statCardValue, dynamicStyles.text]}>{avgVolume.toLocaleString()}</Text>
                        <Text style={[styles.statCardLabel, dynamicStyles.textTertiary]}>평균 볼륨</Text>
                      </RNView>
                    </RNView>

                    {/* 무게 추이 차트 */}
                    {chartData.length > 1 && (
                      <RNView style={styles.chartSection}>
                        <Text style={[styles.chartTitle, dynamicStyles.text]}>무게 추이</Text>
                        <RNView style={styles.chartContainer}>
                          {chartData.map((record, idx) => {
                            const barHeight = (record.max_weight / maxWeight) * 100;
                            const isLast = idx === chartData.length - 1;
                            return (
                              <RNView key={idx} style={styles.chartBarWrapper}>
                                <Text style={[styles.chartBarValue, dynamicStyles.textTertiary]}>
                                  {record.max_weight}
                                </Text>
                                <RNView style={styles.chartBarBg}>
                                  <RNView
                                    style={[
                                      styles.chartBar,
                                      {
                                        height: `${barHeight}%`,
                                        backgroundColor: isLast ? colors.primary : colors.primary + '60',
                                      },
                                    ]}
                                  />
                                </RNView>
                                <Text style={[styles.chartBarLabel, dynamicStyles.textTertiary]}>
                                  {new Date(record.date).getMonth() + 1}/{new Date(record.date).getDate()}
                                </Text>
                              </RNView>
                            );
                          })}
                        </RNView>
                      </RNView>
                    )}

                    {/* 최근 기록 리스트 */}
                    <RNView style={styles.historyListSection}>
                      <Text style={[styles.historyListTitle, dynamicStyles.text]}>최근 기록</Text>
                      {records.length === 0 ? (
                        <Text style={[styles.noRecordsText, dynamicStyles.textTertiary]}>
                          아직 기록이 없습니다
                        </Text>
                      ) : (
                        records.slice(0, 10).map((record, idx) => {
                          const date = new Date(record.date);
                          const dateStr = `${date.getMonth() + 1}월 ${date.getDate()}일`;
                          const isPR = pr && record.max_weight === pr.max_weight;
                          return (
                            <RNView
                              key={idx}
                              style={[styles.historyItem, dynamicStyles.cardSecondary]}
                            >
                              <RNView style={styles.historyItemLeft}>
                                <Text style={[styles.historyItemDate, dynamicStyles.text]}>
                                  {dateStr}
                                  {isPR && <Text style={{ color: colors.primary }}> 🏆</Text>}
                                </Text>
                                <Text style={[styles.historyItemSets, dynamicStyles.textTertiary]}>
                                  {record.total_sets}세트 · {record.total_reps}회 · {record.total_volume.toLocaleString()}kg
                                </Text>
                              </RNView>
                              <RNView style={styles.historyItemRight}>
                                <Text style={[styles.historyItemWeight, dynamicStyles.primary]}>
                                  {record.max_weight}kg
                                </Text>
                              </RNView>
                            </RNView>
                          );
                        })
                      )}
                    </RNView>

                    {/* 최고 볼륨 기록 */}
                    {bestVolumeRecord && bestVolumeRecord.total_volume > 0 && (
                      <RNView style={[styles.bestVolumeCard, dynamicStyles.cardSecondary]}>
                        <Text style={styles.bestVolumeIcon}>💪</Text>
                        <RNView style={styles.bestVolumeContent}>
                          <Text style={[styles.bestVolumeLabel, dynamicStyles.textTertiary]}>최고 볼륨</Text>
                          <Text style={[styles.bestVolumeValue, dynamicStyles.text]}>
                            {bestVolumeRecord.total_volume.toLocaleString()}kg
                          </Text>
                          <Text style={[styles.bestVolumeSub, dynamicStyles.textTertiary]}>
                            {new Date(bestVolumeRecord.date).getMonth() + 1}월 {new Date(bestVolumeRecord.date).getDate()}일
                          </Text>
                        </RNView>
                      </RNView>
                    )}
                  </ScrollView>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      <RNView style={[styles.footer, dynamicStyles.card, { borderTopColor: colors.border }]}>
        <Pressable style={[styles.cancelButton, dynamicStyles.errorBg]} onPress={handleCancelWorkout}>
          <Text style={[styles.cancelButtonText, dynamicStyles.error]}>취소</Text>
        </Pressable>
        <Pressable style={[styles.finishButton, dynamicStyles.primaryBg]} onPress={handleFinishWorkout}>
          <Text style={styles.finishButtonText}>운동 완료</Text>
        </Pressable>
      </RNView>
    </RNView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  gestureRoot: {
    flex: 1,
  },
  listContent: {
    padding: 16,
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
  timerSkipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  timerSkipBtnText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    fontWeight: '600',
  },
  timerValue: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  timerExtendBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  timerExtendBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
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
  restSheetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 10,
  },
  restSheetContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    alignItems: 'center',
    zIndex: 11,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  restSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
    marginBottom: 16,
  },
  restSheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  restSheetOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  restSheetOption: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 70,
    alignItems: 'center',
  },
  restSheetOptionText: {
    fontSize: 16,
    fontWeight: '700',
  },
  restSheetSkip: {
    marginTop: 16,
    paddingVertical: 10,
  },
  restSheetSkipText: {
    fontSize: 14,
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
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: '600',
  },
  inline1RMBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  inline1RMText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inlineStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  inlineStatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  inlineStatIcon: {
    fontSize: 11,
  },
  inlineStatText: {
    fontSize: 11,
    fontWeight: '500',
  },
  exerciseCardDragging: {
    opacity: 0.9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  dragHandle: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  dragHandleText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
  },
  reorderButtons: {
    flexDirection: 'column',
    marginRight: 8,
  },
  reorderBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  reorderBtnDisabled: {
    opacity: 0.3,
  },
  reorderBtnText: {
    fontSize: 10,
    fontWeight: '600',
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
  todayRecMessageIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  todayRecMessageContent: {
    flex: 1,
  },
  todayRecMessageText: {
    fontSize: 14,
    fontWeight: '600',
  },
  todayRecSubMessage: {
    fontSize: 12,
    marginTop: 2,
  },
  setListContainer: {
    marginBottom: 8,
  },
  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  setHeaderText: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 6,
    borderRadius: 8,
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
  setValueMain: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  deleteSetButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteSetButtonText: {
    fontSize: 14,
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
  // 컴팩트 입력 스타일
  compactInputSection: {
    marginTop: 12,
  },
  compactInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  compactInputGroup: {
    flex: 1,
  },
  compactInputLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
    textAlign: 'center',
  },
  compactStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    overflow: 'hidden',
  },
  // Subtle incomplete state - amber/orange instead of harsh red
  inputIncomplete: {
    borderColor: '#f59e0b',
    borderWidth: 2,
  },
  stepperBtn: {
    width: 44,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 22,
    fontWeight: '500',
  },
  compactInput: {
    flex: 1,
    height: 48,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  inputHint: {
    fontSize: 11,
    color: '#f59e0b',
    marginTop: 4,
    textAlign: 'center',
  },
  compactAddBtn: {
    width: 52,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
  },
  compactAddBtnText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 28,
  },
  compactAddBtnProfile: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    fontWeight: '700',
    marginTop: -2,
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

  // 프로필 탭 스타일
  profileTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  profileTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  profileTabName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  profileTabNameSelected: {
    color: '#fff',
  },
  profileTabStats: {
    fontSize: 11,
  },
  profileTabStatsSelected: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  setProfileBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setProfileText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // 이전 기록 표시 스타일
  previousRecordContainer: {
    marginBottom: 8,
  },
  prevSetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 6,
  },
  prevSetsLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginRight: 4,
  },
  prevSetsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  prevSetItem: {
    fontSize: 11,
    fontWeight: '500',
  },
  prevSetMore: {
    fontSize: 11,
    fontWeight: '400',
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  prBadgeIcon: {
    fontSize: 10,
  },
  prBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // 시간 분석 스타일
  timeBreakdownContainer: {
    marginTop: 8,
    borderRadius: 12,
    padding: 12,
  },
  timeBreakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeBreakdownLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  timeBreakdownValues: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeBreakdownActive: {
    fontSize: 12,
    fontWeight: '600',
  },
  timeBreakdownSeparator: {
    fontSize: 12,
  },
  timeBreakdownRest: {
    fontSize: 12,
    fontWeight: '500',
  },
  timeBreakdownBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  timeBreakdownActiveBar: {
    height: '100%',
  },
  timeBreakdownRestBar: {
    height: '100%',
  },

  // 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '85%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnText: {
    fontSize: 18,
  },
  modalBody: {
    padding: 16,
  },

  // PR 카드
  prCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  prCardIcon: {
    fontSize: 28,
  },
  prCardContent: {
    flex: 1,
  },
  prCardLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  prCardValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  prCardSub: {
    fontSize: 12,
    marginTop: 2,
  },

  // 통계 그리드
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  statCardValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statCardLabel: {
    fontSize: 11,
    marginTop: 2,
  },

  // 차트
  chartSection: {
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    gap: 4,
  },
  chartBarWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  chartBarValue: {
    fontSize: 9,
    marginBottom: 4,
  },
  chartBarBg: {
    width: '100%',
    height: 80,
    justifyContent: 'flex-end',
    borderRadius: 4,
    overflow: 'hidden',
  },
  chartBar: {
    width: '100%',
    borderRadius: 4,
  },
  chartBarLabel: {
    fontSize: 9,
    marginTop: 4,
  },

  // 기록 리스트
  historyListSection: {
    marginBottom: 16,
  },
  historyListTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  noRecordsText: {
    textAlign: 'center',
    padding: 20,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  historyItemLeft: {
    flex: 1,
  },
  historyItemDate: {
    fontSize: 14,
    fontWeight: '600',
  },
  historyItemSets: {
    fontSize: 12,
    marginTop: 2,
  },
  historyItemRight: {
    alignItems: 'flex-end',
  },
  historyItemWeight: {
    fontSize: 18,
    fontWeight: '700',
  },

  // 최고 볼륨 카드
  bestVolumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  bestVolumeIcon: {
    fontSize: 24,
  },
  bestVolumeContent: {
    flex: 1,
  },
  bestVolumeLabel: {
    fontSize: 12,
  },
  bestVolumeValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  bestVolumeSub: {
    fontSize: 11,
    marginTop: 2,
  },

  // 기록 보기 버튼
  viewHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  viewHistoryBtnText: {
    fontSize: 11,
    fontWeight: '500',
  },

  // 지난번과 동일 버튼
  copyPrevSetsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  copyPrevSetsButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // ===== 완료된 세트 스타일 (녹색 강조) =====
  completedSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 4,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderWidth: 1,
  },
  completedCheckmark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  completedCheckmarkText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  completedSetNumber: {
    width: 24,
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
  },
  completedSetValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },

  // ===== 활성 입력 영역 스타일 (파란색 강조) =====
  activeInputSection: {
    marginTop: 16,
    padding: 16,
    paddingTop: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    position: 'relative',
  },
  nextSetBadge: {
    position: 'absolute',
    top: -10,
    left: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 1,
  },
  nextSetBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
