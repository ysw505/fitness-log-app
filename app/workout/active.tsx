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
  KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Text, useThemeColors } from '@/components/Themed';
import { TermIcon } from '@/components/TermTooltip';
import { useWorkoutStore, WorkoutSetWithProfile } from '@/stores/workoutStore';
import { useHistoryStore, PersonalRecord } from '@/stores/historyStore';
import { useProfileStore } from '@/stores/profileStore';
import { getNextSetRecommendations, RpeRecommendation } from '@/src/utils/rpeRecommendation';

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
      icon: '📈',
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
        <RNView style={[styles.prBadge, { backgroundColor: colors.primary + '10' }]}>
          <Text style={[styles.prBadgeText, { color: colors.primary }]}>
            PR {personalRecord.max_weight}kg × {personalRecord.max_reps_at_weight}
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
  const [inputValues, setInputValues] = useState<Record<string, { weight: string; reps: string; note: string }>>({});

  // 입력 오류 상태 (빨간 테두리 표시용)
  const [inputErrors, setInputErrors] = useState<Record<string, { weight: boolean; reps: boolean }>>({});

  // 세트 메모 입력 확장 상태
  const [noteExpanded, setNoteExpanded] = useState<Record<string, boolean>>({});

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
    warning: { color: colors.warning },
    warningBorder: { borderColor: colors.warning },
  }), [colors]);

  // 휴식 타이머 상태
  const [restTimerActive, setRestTimerActive] = useState(false);
  const [restTimeRemaining, setRestTimeRemaining] = useState(0);
  const [showRestPicker, setShowRestPicker] = useState(false); // 세트 완료 후 휴식 선택 UI
  const [totalRestTime, setTotalRestTime] = useState(0); // 프로그레스바용
  const restTimerEndTime = useRef<number | null>(null); // 타이머 종료 예정 시간 (timestamp)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appState = useRef(AppState.currentState);

  // RPE 입력 상태
  const [showRpePicker, setShowRpePicker] = useState(false);
  const [pendingSetId, setPendingSetId] = useState<string | null>(null);
  const [selectedRpe, setSelectedRpe] = useState<number | null>(null);

  // RPE 기반 추천 상태
  const [showRpeRecommendation, setShowRpeRecommendation] = useState(false);
  const [rpeRecommendations, setRpeRecommendations] = useState<RpeRecommendation[]>([]);
  const [currentExerciseForRec, setCurrentExerciseForRec] = useState<string | null>(null);

  // 운동 경과 시간
  const [elapsedTime, setElapsedTime] = useState('00:00');

  // 운동 기록 모달 상태
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedExerciseForHistory, setSelectedExerciseForHistory] = useState<{
    id: string;
    name: string;
    name_ko: string | null;
  } | null>(null);

  // 운동 완료 모달 상태
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [workoutName, setWorkoutName] = useState('');

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
      showAlert('휴식 완료!', '다음 세트를 시작하세요');
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

  // RPE 선택 핸들러
  const handleSelectRpe = async (rpe: number | null) => {
    if (pendingSetId && rpe !== null) {
      try {
        await useWorkoutStore.getState().updateSet(pendingSetId, { rpe });

        // RPE 저장 후 다음 세트 추천 계산
        const completedSet = exercises
          .flatMap((ex) => ex.sets)
          .find((set) => set.id === pendingSetId);

        if (completedSet && completedSet.weight && completedSet.reps) {
          const recommendations = getNextSetRecommendations(
            completedSet.weight,
            completedSet.reps,
            rpe
          );

          if (recommendations.length > 0) {
            setRpeRecommendations(recommendations);
            // 완료된 세트가 속한 운동 찾기
            const exerciseForSet = exercises.find((ex) =>
              ex.sets.some((s) => s.id === pendingSetId)
            );
            setCurrentExerciseForRec(exerciseForSet?.id || null);
            setShowRpeRecommendation(true);
          }
        }
      } catch (error) {
        console.error('Failed to update RPE:', error);
      }
    }
    setShowRpePicker(false);
    setPendingSetId(null);
    setSelectedRpe(null);

    // RPE 추천이 표시되지 않으면 바로 휴식 UI 표시
    // 추천이 있으면 추천 선택 후 휴식 UI 표시
    if (!showRpeRecommendation) {
      showRestPickerUI();
    }
  };

  const skipRpe = () => {
    setShowRpePicker(false);
    setPendingSetId(null);
    setSelectedRpe(null);
    showRestPickerUI();
  };

  // RPE 추천 적용 핸들러
  const applyRpeRecommendation = (recommendation: RpeRecommendation) => {
    if (currentExerciseForRec) {
      const exercise = exercises.find((ex) => ex.id === currentExerciseForRec);
      if (exercise) {
        // 다음 세트 입력값에 추천값 설정
        updateInputValue(
          currentExerciseForRec,
          exercise.exercise_db_id,
          exercise.category,
          'weight',
          recommendation.weight.toString()
        );
        updateInputValue(
          currentExerciseForRec,
          exercise.exercise_db_id,
          exercise.category,
          'reps',
          recommendation.reps.toString()
        );
      }
    }

    // 추천 모달 닫고 휴식 UI 표시
    setShowRpeRecommendation(false);
    setRpeRecommendations([]);
    setCurrentExerciseForRec(null);
    showRestPickerUI();
  };

  // RPE 추천 건너뛰기
  const skipRpeRecommendation = () => {
    setShowRpeRecommendation(false);
    setRpeRecommendations([]);
    setCurrentExerciseForRec(null);
    showRestPickerUI();
  };

  // RPE 색상 (숫자에 따른 그라데이션)
  const getRpeColor = (rpe: number) => {
    if (rpe <= 5) return '#22c55e'; // 녹색 - 여유
    if (rpe <= 6) return '#84cc16'; // 연두
    if (rpe <= 7) return '#3b82f6'; // 파랑 - 적당
    if (rpe <= 8) return '#f59e0b'; // 주황
    if (rpe <= 9) return '#f97316'; // 진한 주황 - 힘듦
    return '#ef4444'; // 빨강 - 한계
  };

  const getRpeLabel = (rpe: number) => {
    if (rpe <= 5) return '여유';
    if (rpe <= 7) return '적당';
    if (rpe <= 9) return '힘듦';
    return '한계';
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
      // 이전 세트 값 그대로 사용 (메모는 매 세트마다 새로 작성)
      return {
        weight: lastSet.weight?.toString() || '',
        reps: lastSet.reps?.toString() || '',
        note: '',
      };
    }

    // 첫 세트는 오늘 추천값 사용
    const records = getExerciseRecords(exerciseDbId);
    const todayRec = getTodayRecommendation(records, category, targetRepRange);

    if (todayRec) {
      return {
        weight: todayRec.weight.toString(),
        reps: todayRec.reps.toString(),
        note: '',
      };
    }

    // 이전 기록에서 가져오기
    const prevRecord = records?.[0];
    if (prevRecord && prevRecord.max_weight > 0) {
      return {
        weight: prevRecord.max_weight.toString(),
        reps: Math.round(prevRecord.total_reps / prevRecord.total_sets).toString() || '',
        note: '',
      };
    }

    return { weight: '', reps: '', note: '' };
  };

  const updateInputValue = (exerciseId: string, exerciseDbId: string, category: string, field: 'weight' | 'reps' | 'note', value: string) => {
    setInputValues((prev) => ({
      ...prev,
      [exerciseId]: {
        ...getInputValues(exerciseId, exerciseDbId, category),
        [field]: value,
      },
    }));
  };

  // 운동 내용 기반 스마트 이름 제안
  const getSuggestedWorkoutName = useCallback(() => {
    if (exercises.length === 0) {
      return `운동 ${new Date().toLocaleDateString('ko-KR')}`;
    }

    // 카테고리별 운동 수 계산
    const categoryCounts: Record<string, number> = {};
    const categoryNames: Record<string, string> = {
      chest: '가슴',
      back: '등',
      shoulder: '어깨',
      arm: '팔',
      leg: '하체',
      core: '코어',
      cardio: '유산소',
    };

    exercises.forEach((e) => {
      const category = e.exercise.category;
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    // 가장 많은 카테고리 찾기
    const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);

    if (sortedCategories.length === 0) {
      return `운동 ${new Date().toLocaleDateString('ko-KR')}`;
    }

    const topCategory = sortedCategories[0][0];
    const topCount = sortedCategories[0][1];
    const totalExercises = exercises.length;

    // 한 카테고리가 60% 이상이면 그 카테고리 이름 사용
    if (topCount / totalExercises >= 0.6) {
      return `${categoryNames[topCategory] || topCategory} 운동`;
    }

    // 두 가지 주요 카테고리 조합
    if (sortedCategories.length >= 2) {
      const cat1 = categoryNames[sortedCategories[0][0]] || sortedCategories[0][0];
      const cat2 = categoryNames[sortedCategories[1][0]] || sortedCategories[1][0];
      return `${cat1}/${cat2} 운동`;
    }

    return `${categoryNames[topCategory] || topCategory} 운동`;
  }, [exercises]);

  // 완료 모달 열기
  const handleFinishWorkout = () => {
    if (exercises.length === 0) {
      showAlert('운동 추가 필요', '최소 1개의 운동을 추가해주세요.');
      return;
    }

    const hasSets = exercises.some((e) => e.sets.length > 0);
    if (!hasSets) {
      showAlert('세트 추가 필요', '최소 1개의 세트를 기록해주세요.');
      return;
    }

    setWorkoutName(getSuggestedWorkoutName());
    setShowFinishModal(true);
  };

  // 실제 완료 처리
  const confirmFinishWorkout = async () => {
    try {
      await finishWorkout(workoutName.trim() || undefined);
      setShowFinishModal(false);
      router.replace('/');
    } catch (error) {
      console.error('Failed to finish workout:', error);
      showAlert('오류', '운동 완료 중 오류가 발생했습니다');
    }
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
      const noteValue = values.note?.trim() || undefined;
      const newSet = await addSet(workoutExerciseId, {
        set_number: setNumber,
        weight: weightValue, // 0kg allowed (empty = 0)
        reps: repsValue,
        note: noteValue,
      });

      // 입력값 초기화하여 다음 세트 준비
      setInputValues((prev) => {
        const newValues = { ...prev };
        delete newValues[workoutExerciseId];
        return newValues;
      });

      // RPE 선택 UI 표시 (세트 ID 저장)
      if (newSet && newSet.id) {
        setPendingSetId(newSet.id);
        setShowRpePicker(true);
      } else {
        // 세트 ID를 못 가져온 경우 바로 휴식 선택
        showRestPickerUI();
      }
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
                <Text style={[styles.inlineStatText, dynamicStyles.textSecondary]}>{records.length}회 운동</Text>
              </RNView>

              {/* 역대 최고 무게 */}
              {exercisePR && exercisePR.max_weight > 0 && (
                <RNView style={[styles.inlineStatBadge, dynamicStyles.cardSecondary]}>
                  <Text style={[styles.inlineStatText, dynamicStyles.textSecondary]}>
                    PR {exercisePR.max_weight}kg × {exercisePR.max_reps_at_weight}
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
                    <RNView style={[styles.inlineStatBadge, { backgroundColor: isUp ? '#22c55e10' : '#ef444410' }]}>
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
            <RNView style={[styles.todayRecMessage, { backgroundColor: todayRec.color + '10', borderLeftWidth: 3, borderLeftColor: todayRec.color }]}>
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
                <Text style={[styles.setHeaderText, dynamicStyles.textTertiary, { width: 80 }]}>무게</Text>
                <Text style={[styles.setHeaderText, dynamicStyles.textTertiary, { width: 70 }]}>횟수</Text>
                <Text style={[styles.setHeaderText, dynamicStyles.textTertiary, { width: 36 }]}>RPE</Text>
                <RNView style={{ width: 28 }} />
              </RNView>

              {/* 완료된 세트 rows - 녹색 강조 */}
              {exercise.sets.map((set, index) => {
                const setWithProfile = set as WorkoutSetWithProfile;
                const setRpeColor = set.rpe ? getRpeColor(set.rpe) : null;
                return (
                  <RNView key={set.id}>
                    <RNView
                      style={[
                        styles.completedSetRow,
                        {
                          backgroundColor: colors.success + '15',
                          borderLeftColor: colors.success,
                          borderColor: colors.success + '30',
                        },
                        set.note && styles.completedSetRowWithNote,
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
                      <Text style={[styles.completedSetValue, dynamicStyles.text, { width: 80 }]}>{set.weight}<Text style={dynamicStyles.textTertiary}>kg</Text></Text>
                      <Text style={[styles.completedSetValue, dynamicStyles.text, { width: 70 }]}>{set.reps}<Text style={dynamicStyles.textTertiary}>회</Text></Text>
                      {/* RPE 배지 */}
                      <RNView style={[styles.setRpeBadge, setRpeColor && { backgroundColor: setRpeColor + '20' }]}>
                        {set.rpe && setRpeColor ? (
                          <Text style={[styles.setRpeText, { color: setRpeColor }]}>{set.rpe}</Text>
                        ) : (
                          <Text style={[styles.setRpeText, dynamicStyles.textTertiary]}>{set.rpe || '-'}</Text>
                        )}
                      </RNView>
                      {/* 메모 아이콘 (메모가 있을 때) */}
                      {set.note && (
                        <RNView style={styles.setNoteIndicator}>
                          <Text style={[styles.setNoteIndicatorText, dynamicStyles.textTertiary]}>✎</Text>
                        </RNView>
                      )}
                      <Pressable
                        style={styles.deleteSetButton}
                        onPress={() => handleDeleteSet(set.id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={[styles.deleteSetButtonText, dynamicStyles.textTertiary]}>✕</Text>
                      </Pressable>
                    </RNView>
                    {/* 세트 메모 표시 */}
                    {set.note && (
                      <RNView style={[styles.setNoteRow, { backgroundColor: colors.success + '08' }]}>
                        <Text style={[styles.setNoteText, dynamicStyles.textTertiary]}>{set.note}</Text>
                      </RNView>
                    )}
                  </RNView>
                );
              })}
            </RNView>
          )}


          {/* 입력 영역 - 2줄 컴팩트 디자인 */}
          <RNView style={[styles.compactInputSection, dynamicStyles.cardSecondary]}>
            {/* 줄 1: 무게 × 횟수 입력 */}
            <RNView style={styles.compactInputRow}>
              {/* 세트 번호 */}
              <Text style={[styles.compactSetNum, dynamicStyles.textSecondary]}>{exercise.sets.length + 1}</Text>

              {/* 무게 그룹 */}
              <RNView style={styles.compactInputGroup}>
                <Pressable
                  style={[styles.compactStepBtn, { backgroundColor: colors.border }]}
                  onPress={() => {
                    const currentVal = parseFloat(getInputValues(exercise.id, exercise.exercise_id, exercise.exercise.category).weight) || 0;
                    updateInputValue(exercise.id, exercise.exercise_id, exercise.exercise.category, 'weight', Math.max(0, currentVal - 2.5).toString());
                  }}
                >
                  <Text style={[styles.compactStepBtnText, dynamicStyles.textSecondary]}>−</Text>
                </Pressable>
                <RNView style={[styles.compactValueBox, { backgroundColor: colors.card }]}>
                  <TextInput
                    style={[styles.compactValueInput, { color: colors.text }]}
                    placeholder="0"
                    keyboardType="numeric"
                    value={getInputValues(exercise.id, exercise.exercise_id, exercise.exercise.category).weight || ''}
                    onChangeText={(v) => updateInputValue(exercise.id, exercise.exercise_id, exercise.exercise.category, 'weight', v)}
                    placeholderTextColor={colors.textTertiary}
                  />
                  <Text style={[styles.compactUnit, dynamicStyles.textTertiary]}>kg</Text>
                </RNView>
                <Pressable
                  style={[styles.compactStepBtn, { backgroundColor: colors.primary + '20' }]}
                  onPress={() => {
                    const currentVal = parseFloat(getInputValues(exercise.id, exercise.exercise_id, exercise.exercise.category).weight) || 0;
                    updateInputValue(exercise.id, exercise.exercise_id, exercise.exercise.category, 'weight', (currentVal + 2.5).toString());
                  }}
                >
                  <Text style={[styles.compactStepBtnText, { color: colors.primary }]}>+</Text>
                </Pressable>
              </RNView>

              {/* 구분자 */}
              <Text style={[styles.compactSeparator, dynamicStyles.textTertiary]}>×</Text>

              {/* 횟수 그룹 */}
              <RNView style={[styles.compactInputGroup, inputErrors[exercise.id]?.reps && { borderWidth: 1, borderColor: colors.warning, borderRadius: 8 }]}>
                <Pressable
                  style={[styles.compactStepBtn, { backgroundColor: colors.border }]}
                  onPress={() => {
                    const currentVal = parseInt(getInputValues(exercise.id, exercise.exercise_id, exercise.exercise.category).reps, 10) || 0;
                    updateInputValue(exercise.id, exercise.exercise_id, exercise.exercise.category, 'reps', Math.max(1, currentVal - 1).toString());
                  }}
                >
                  <Text style={[styles.compactStepBtnText, dynamicStyles.textSecondary]}>−</Text>
                </Pressable>
                <RNView style={[styles.compactValueBox, { backgroundColor: colors.card }]}>
                  <TextInput
                    style={[styles.compactValueInput, { color: colors.text }]}
                    placeholder="0"
                    keyboardType="numeric"
                    value={getInputValues(exercise.id, exercise.exercise_id, exercise.exercise.category).reps || ''}
                    onChangeText={(v) => {
                      updateInputValue(exercise.id, exercise.exercise_id, exercise.exercise.category, 'reps', v);
                      if (inputErrors[exercise.id]?.reps) {
                        setInputErrors((prev) => { const n = { ...prev }; delete n[exercise.id]; return n; });
                      }
                    }}
                    placeholderTextColor={colors.textTertiary}
                  />
                  <Text style={[styles.compactUnit, dynamicStyles.textTertiary]}>회</Text>
                </RNView>
                <Pressable
                  style={[styles.compactStepBtn, { backgroundColor: colors.primary + '20' }]}
                  onPress={() => {
                    const currentVal = parseInt(getInputValues(exercise.id, exercise.exercise_id, exercise.exercise.category).reps, 10) || 0;
                    updateInputValue(exercise.id, exercise.exercise_id, exercise.exercise.category, 'reps', (currentVal + 1).toString());
                  }}
                >
                  <Text style={[styles.compactStepBtnText, { color: colors.primary }]}>+</Text>
                </Pressable>
              </RNView>
            </RNView>

            {/* 줄 2: 세트 추가 버튼 */}
            <Pressable
              style={[styles.compactAddBtn, dynamicStyles.primaryBg]}
              onPress={() => handleAddSet(exercise.id, exercise.exercise_id, exercise.exercise.category)}
            >
              <Text style={styles.compactAddBtnText}>세트 추가</Text>
            </Pressable>
            {inputErrors[exercise.id]?.reps && (
              <Text style={[styles.compactErrorText, dynamicStyles.warning]}>1회 이상</Text>
            )}
          </RNView>
        </RNView>
      </ScaleDecorator>
    );
  }, [exercises, colors, dynamicStyles, activeProfileIds, currentSetProfileId, currentProfile, targetRepRange, handleAddSet, handleDeleteSet, getExerciseRecords, getTodayRecommendation, getInputValues, updateInputValue, personalRecords, noteExpanded]);

  // 진행 중인 운동이 없으면 빈 화면 표시
  if (!activeSession) {
    return (
      <RNView style={[styles.container, dynamicStyles.container]}>
        <Text style={dynamicStyles.text}>진행 중인 운동이 없습니다</Text>
      </RNView>
    );
  }

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

      <KeyboardAvoidingView
        style={styles.gestureRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
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
      </KeyboardAvoidingView>

      {/* RPE 선택 (하단 Sheet) */}
      {showRpePicker && (
        <>
          <Pressable style={styles.restSheetOverlay} onPress={skipRpe} />
          <RNView style={[styles.restSheetContainer, dynamicStyles.card]}>
            <RNView style={[styles.restSheetHandle, dynamicStyles.borderBg]} />
            <RNView style={styles.rpeHeaderRow}>
              <Text style={[styles.restSheetTitle, dynamicStyles.text]}>몇 회 더 할 수 있었나요?</Text>
              <TermIcon term="rpe" />
            </RNView>
            <RNView style={styles.rpeOptionsGrid}>
              {[
                { rpe: 6, rir: '4회+', label: '여유' },
                { rpe: 7, rir: '3회', label: '적당' },
                { rpe: 8, rir: '2회', label: '적당' },
                { rpe: 9, rir: '1회', label: '힘듦' },
                { rpe: 10, rir: '0회', label: '한계' },
              ].map(({ rpe, rir, label }) => (
                <Pressable
                  key={rpe}
                  style={[
                    styles.rpeOption,
                    { backgroundColor: getRpeColor(rpe) + '20', borderColor: getRpeColor(rpe) },
                    selectedRpe === rpe && { backgroundColor: getRpeColor(rpe) },
                  ]}
                  onPress={() => setSelectedRpe(rpe)}
                >
                  <Text style={[
                    styles.rpeOptionRir,
                    { color: selectedRpe === rpe ? 'rgba(255,255,255,0.85)' : colors.textTertiary },
                  ]}>
                    {rir}
                  </Text>
                  <Text style={[
                    styles.rpeOptionNumber,
                    { color: selectedRpe === rpe ? '#fff' : getRpeColor(rpe) },
                  ]}>
                    {rpe}
                  </Text>
                  <Text style={[
                    styles.rpeOptionLabel,
                    { color: selectedRpe === rpe ? 'rgba(255,255,255,0.9)' : colors.textTertiary },
                  ]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </RNView>
            <Text style={[styles.rpeHelpText, dynamicStyles.textTertiary]}>
              {selectedRpe
                ? `RPE ${selectedRpe} 선택됨 · ${selectedRpe === 10 ? '더 이상 못 했음' : `${10 - selectedRpe}회 여유 있었음`}`
                : '세트 완료 시 남은 여유 횟수를 선택하세요'}
            </Text>
            <RNView style={styles.rpeButtonRow}>
              <Pressable style={styles.rpeSkipBtn} onPress={skipRpe}>
                <Text style={[styles.rpeSkipBtnText, dynamicStyles.textSecondary]}>건너뛰기</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.rpeConfirmBtn,
                  selectedRpe ? dynamicStyles.primaryBg : dynamicStyles.cardSecondary,
                ]}
                onPress={() => handleSelectRpe(selectedRpe)}
                disabled={!selectedRpe}
              >
                <Text style={[
                  styles.rpeConfirmBtnText,
                  !selectedRpe && dynamicStyles.textTertiary
                ]}>
                  {selectedRpe ? '저장' : 'RPE 선택'}
                </Text>
              </Pressable>
            </RNView>
          </RNView>
        </>
      )}

      {/* RPE 기반 다음 세트 추천 (하단 Sheet) */}
      {showRpeRecommendation && (
        <>
          <Pressable style={styles.restSheetOverlay} onPress={skipRpeRecommendation} />
          <RNView style={[styles.restSheetContainer, dynamicStyles.card]}>
            <RNView style={[styles.restSheetHandle, dynamicStyles.borderBg]} />
            <Text style={[styles.restSheetTitle, dynamicStyles.text]}>다음 세트 추천</Text>
            <Text style={[styles.rpeRecSubtitle, dynamicStyles.textSecondary]}>
              이전 RPE를 기반으로 계산된 추천입니다
            </Text>
            <RNView style={styles.rpeRecOptions}>
              {rpeRecommendations.map((rec, index) => (
                <Pressable
                  key={index}
                  style={[styles.rpeRecOption, dynamicStyles.cardSecondary]}
                  onPress={() => applyRpeRecommendation(rec)}
                >
                  <RNView style={styles.rpeRecOptionContent}>
                    <Text style={[styles.rpeRecWeight, dynamicStyles.text]}>
                      {rec.weight}kg × {rec.reps}회
                    </Text>
                    <Text style={[styles.rpeRecReason, dynamicStyles.textTertiary]}>
                      {rec.reason}
                    </Text>
                  </RNView>
                </Pressable>
              ))}
            </RNView>
            <Pressable style={styles.rpeRecSkipBtn} onPress={skipRpeRecommendation}>
              <Text style={[styles.rpeRecSkipText, dynamicStyles.textSecondary]}>추천 건너뛰기</Text>
            </Pressable>
          </RNView>
        </>
      )}

      {/* 휴식 시간 선택 (하단 Sheet) */}
      {showRestPicker && !restTimerActive && !showRpePicker && !showRpeRecommendation && (
        <>
          <Pressable style={styles.restSheetOverlay} onPress={skipRest} />
          <RNView style={[styles.restSheetContainer, dynamicStyles.card]}>
            <RNView style={[styles.restSheetHandle, dynamicStyles.borderBg]} />
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
                  <RNView style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
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
                      <RNView style={[styles.prCard, { backgroundColor: colors.primary + '10', borderLeftWidth: 3, borderLeftColor: colors.primary }]}>
                        <RNView style={styles.prCardContent}>
                          <Text style={[styles.prCardLabel, { color: colors.primary }]}>PR</Text>
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
                                  {isPR && <Text style={{ color: colors.primary }}> PR</Text>}
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

      {/* 운동 완료 모달 */}
      <Modal
        visible={showFinishModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFinishModal(false)}
      >
        <Pressable
          style={styles.modalOverlayCentered}
          onPress={() => setShowFinishModal(false)}
        >
          <Pressable
            style={[styles.finishModalContent, dynamicStyles.card]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.finishModalTitle, dynamicStyles.text]}>운동 완료</Text>
            <Text style={[styles.finishModalSubtitle, dynamicStyles.textSecondary]}>
              {exercises.length}개 운동 · {exercises.reduce((sum, e) => sum + e.sets.length, 0)}세트
            </Text>

            <RNView style={styles.finishNameSection}>
              <Text style={[styles.finishNameLabel, dynamicStyles.textSecondary]}>운동 이름</Text>
              <TextInput
                style={[styles.finishNameInput, dynamicStyles.cardSecondary, dynamicStyles.text, { borderColor: colors.border }]}
                value={workoutName}
                onChangeText={setWorkoutName}
                placeholder="운동 이름 입력"
                placeholderTextColor={colors.textSecondary}
                maxLength={30}
                selectTextOnFocus
              />
              <Text style={[styles.finishNameHint, dynamicStyles.textTertiary]}>
                수정하지 않아도 자동으로 저장됩니다
              </Text>
            </RNView>

            <RNView style={styles.finishModalButtons}>
              <Pressable
                style={[styles.finishModalCancelBtn, dynamicStyles.cardSecondary]}
                onPress={() => setShowFinishModal(false)}
              >
                <Text style={[styles.finishModalCancelText, dynamicStyles.textSecondary]}>취소</Text>
              </Pressable>
              <Pressable
                style={[styles.finishModalConfirmBtn, dynamicStyles.primaryBg]}
                onPress={confirmFinishWorkout}
              >
                <Text style={styles.finishModalConfirmText}>완료하기</Text>
              </Pressable>
            </RNView>
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
    fontSize: 32,
    fontWeight: '600',
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
    fontSize: 20,
    fontWeight: '600',
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
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    alignItems: 'center',
    zIndex: 11,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  restSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
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
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '500',
  },
  inline1RMBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  inline1RMText: {
    fontSize: 11,
    fontWeight: '500',
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
    textAlignVertical: 'center',
    padding: 0,
    margin: 0,
  },
  inputHint: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  // 새로운 입력 UI 스타일
  newInputContainer: {
    gap: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputRowLabel: {
    width: 36,
    fontSize: 13,
    fontWeight: '600',
  },
  inputControls: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepperBtnLarge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnLargeText: {
    fontSize: 16,
    fontWeight: '700',
  },
  stepperBtnSmall: {
    width: 36,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnSmallText: {
    fontSize: 22,
    fontWeight: '600',
  },
  valueDisplayBox: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    minWidth: 80,
  },
  valueInput: {
    minWidth: 60,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'right',
    padding: 0,
  },
  valueUnit: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 2,
  },
  inputErrorText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: -4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  noteBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
  addSetBtn: {
    flex: 2,
    height: 44,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addSetBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  addSetBtnProfile: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '600',
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
  setActionButtons: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  noteToggleBtn: {
    width: 40,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
  },
  noteToggleBtnText: {
    fontSize: 18,
  },
  noteInputContainer: {
    marginTop: 12,
  },
  noteInput: {
    padding: 10,
    borderRadius: 8,
    fontSize: 14,
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
  modalOverlayCentered: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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

  // RPE 선택 스타일
  rpeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  rpeOptionsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  rpeOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  rpeOptionRir: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  rpeOptionNumber: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 1,
  },
  rpeOptionLabel: {
    fontSize: 9,
    fontWeight: '500',
  },
  rpeHelpText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  rpeButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  rpeSkipBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
  },
  rpeSkipBtnText: {
    fontSize: 15,
    fontWeight: '500',
  },
  rpeConfirmBtn: {
    flex: 2,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
  },
  rpeConfirmBtnDisabled: {
    opacity: 0.5,
  },
  rpeConfirmBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  setRpeBadge: {
    width: 36,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setRpeText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // RPE 추천 스타일
  rpeRecSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  rpeRecOptions: {
    gap: 10,
    marginBottom: 16,
  },
  rpeRecOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  rpeRecOptionContent: {
    alignItems: 'center',
  },
  rpeRecWeight: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  rpeRecReason: {
    fontSize: 13,
    fontWeight: '500',
  },
  rpeRecSkipBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
  },
  rpeRecSkipText: {
    fontSize: 15,
    fontWeight: '500',
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
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  completedSetRowWithNote: {
    marginBottom: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  setNoteIndicator: {
    marginRight: 4,
  },
  setNoteIndicatorText: {
    fontSize: 12,
  },
  setNoteRow: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 4,
    marginLeft: 25,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  setNoteText: {
    fontSize: 12,
    fontStyle: 'italic',
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

  // ===== 운동 완료 모달 스타일 =====
  finishModalContent: {
    width: '90%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  finishModalIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  finishModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  finishModalSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  finishNameSection: {
    width: '100%',
    marginBottom: 20,
  },
  finishNameLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  finishNameInput: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '500',
    borderWidth: 1,
  },
  finishNameHint: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  finishModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  finishModalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishModalCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  finishModalConfirmBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishModalConfirmText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },

  // ===== 컴팩트 입력 스타일 =====
  compactInputSection: {
    borderRadius: 10,
    marginTop: 12,
    padding: 8,
    gap: 8,
    overflow: 'hidden',
  },
  compactInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactSetNum: {
    width: 18,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  compactInputGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  compactStepBtn: {
    width: 28,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  compactStepBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  compactValueBox: {
    flex: 1,
    minWidth: 0,
    height: 34,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    overflow: 'hidden',
  },
  compactValueInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
    padding: 0,
  },
  compactUnit: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 2,
  },
  compactSeparator: {
    fontSize: 13,
    fontWeight: '500',
  },
  compactAddBtn: {
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactAddBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  compactErrorText: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
});
