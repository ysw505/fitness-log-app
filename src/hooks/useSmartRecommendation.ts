import { useMemo } from 'react';
import { useExerciseStore, EXERCISE_CATEGORIES } from '@/stores/exerciseStore';
import { useHistoryStore } from '@/stores/historyStore';
import { Exercise } from '@/types/database.types';

// 세분화된 근육군 볼륨 목표
const MUSCLE_VOLUME_TARGET: Record<string, { min: number; max: number }> = {
  // 가슴
  chest: { min: 10, max: 20 },
  // 등
  back: { min: 10, max: 20 },
  // 어깨
  shoulders: { min: 8, max: 16 },
  // 하체 세분화
  quadriceps: { min: 8, max: 14 },
  hamstrings: { min: 6, max: 12 },
  glutes: { min: 6, max: 12 },
  calves: { min: 6, max: 12 },
  // 팔 세분화
  biceps: { min: 6, max: 12 },
  triceps: { min: 6, max: 12 },
  forearms: { min: 4, max: 8 },
  // 코어
  core: { min: 6, max: 12 },
  // 레거시 호환
  legs: { min: 12, max: 20 },
  arms: { min: 8, max: 16 },
};

// 회복 시간 (시간)
const RECOVERY_TIME: Record<string, number> = {
  chest: 48,
  back: 48,
  shoulders: 48,
  quadriceps: 72,
  hamstrings: 72,
  glutes: 72,
  calves: 48,
  biceps: 48,
  triceps: 48,
  forearms: 24,
  core: 24,
  legs: 72,
  arms: 48,
};

// 복합 운동의 간접 자극 계수
const INDIRECT_VOLUME_FACTOR = 0.5;

// 복합 운동 목록
const COMPOUND_EXERCISES = new Set([
  'default_bench_press',
  'default_incline_bench_press',
  'default_deadlift',
  'default_barbell_row',
  'default_squat',
  'default_front_squat',
  'default_overhead_press',
  'default_pull_up',
  'default_push_up',
  'default_dumbbell_press',
  'default_leg_press',
  'default_romanian_deadlift',
  'default_cable_row',
  'default_lat_pulldown',
  'default_lunge',
]);

export interface RecommendationResult {
  split: string;
  splitName: string;
  reason: string;
  categories: string[];
  exercises: Exercise[];
  score: number;
}

export interface MuscleVolumeStatus {
  muscle: string;
  muscleName: string;
  currentSets: number;
  targetMin: number;
  targetMax: number;
  status: 'low' | 'optimal' | 'high';
  recoveryStatus: 'fresh' | 'recovered' | 'recovering';
  lastPerformed: string | null;
}

export function useSmartRecommendation() {
  const { getAllExercises } = useExerciseStore();
  const {
    getExercisesLastPerformed,
    getCategoryLastPerformed,
    completedWorkouts,
  } = useHistoryStore();

  // 세분화된 근육군별 주간 볼륨 계산 (간접 자극 포함)
  const getWeeklyMuscleVolume = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const muscleVolume: Record<string, number> = {};

    completedWorkouts
      .filter((w) => new Date(w.finished_at) >= weekAgo)
      .forEach((workout) => {
        workout.exercises.forEach((exercise) => {
          const exerciseData = getAllExercises().find(
            (e) => e.id === exercise.exercise_id
          );
          if (!exerciseData) return;

          const setCount = exercise.sets.length;
          const muscleGroups = exerciseData.muscle_group || [exercise.category];
          const isCompound = muscleGroups.length > 1;

          muscleGroups.forEach((muscle, index) => {
            // 첫 번째 근육은 주 자극 (1세트), 나머지는 간접 자극 (0.5세트)
            const factor = isCompound && index > 0 ? INDIRECT_VOLUME_FACTOR : 1;
            muscleVolume[muscle] = (muscleVolume[muscle] || 0) + setCount * factor;
          });
        });
      });

    return muscleVolume;
  }, [completedWorkouts, getAllExercises]);

  // 근육군별 마지막 운동 시간
  const getMuscleLastPerformed = useMemo(() => {
    const muscleLastDate: Record<string, string> = {};

    completedWorkouts.forEach((workout) => {
      workout.exercises.forEach((exercise) => {
        const exerciseData = getAllExercises().find(
          (e) => e.id === exercise.exercise_id
        );
        if (!exerciseData) return;

        const muscleGroups = exerciseData.muscle_group || [exercise.category];
        muscleGroups.forEach((muscle) => {
          if (!muscleLastDate[muscle]) {
            muscleLastDate[muscle] = workout.finished_at;
          }
        });
      });
    });

    return muscleLastDate;
  }, [completedWorkouts, getAllExercises]);

  // 회복 상태 확인
  const getRecoveryStatus = (
    muscle: string
  ): 'recovered' | 'recovering' | 'fresh' => {
    const lastDate = getMuscleLastPerformed[muscle];
    if (!lastDate) return 'fresh';

    const hoursSince =
      (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60);
    const requiredHours = RECOVERY_TIME[muscle] || 48;

    if (hoursSince >= requiredHours) return 'recovered';
    return 'recovering';
  };

  // 볼륨 상태 확인
  const getVolumeStatus = (muscle: string): 'low' | 'optimal' | 'high' => {
    const sets = getWeeklyMuscleVolume[muscle] || 0;
    const target = MUSCLE_VOLUME_TARGET[muscle] || { min: 10, max: 20 };

    if (sets < target.min) return 'low';
    if (sets > target.max) return 'high';
    return 'optimal';
  };

  // 전체 근육 상태 조회
  const getMuscleVolumeStatus = (): MuscleVolumeStatus[] => {
    const muscles = [
      { id: 'chest', name: '가슴' },
      { id: 'back', name: '등' },
      { id: 'shoulders', name: '어깨' },
      { id: 'quadriceps', name: '대퇴사두' },
      { id: 'hamstrings', name: '햄스트링' },
      { id: 'glutes', name: '둔근' },
      { id: 'biceps', name: '이두' },
      { id: 'triceps', name: '삼두' },
      { id: 'core', name: '코어' },
    ];

    return muscles.map((muscle) => {
      const target = MUSCLE_VOLUME_TARGET[muscle.id] || { min: 10, max: 20 };
      return {
        muscle: muscle.id,
        muscleName: muscle.name,
        currentSets: Math.round(getWeeklyMuscleVolume[muscle.id] || 0),
        targetMin: target.min,
        targetMax: target.max,
        status: getVolumeStatus(muscle.id),
        recoveryStatus: getRecoveryStatus(muscle.id),
        lastPerformed: getMuscleLastPerformed[muscle.id] || null,
      };
    });
  };

  // 스마트 추천 계산
  const getSmartRecommendation = (): RecommendationResult => {
    const allExercises = getAllExercises();
    const lastPerformed = getExercisesLastPerformed();

    // 각 분할별 점수 계산
    const splits = [
      {
        id: 'push',
        name: '밀기 운동 (Push)',
        muscles: ['chest', 'shoulders', 'triceps'],
        categories: ['chest', 'shoulders', 'arms'],
      },
      {
        id: 'pull',
        name: '당기기 운동 (Pull)',
        muscles: ['back', 'biceps'],
        categories: ['back', 'arms'],
      },
      {
        id: 'legs',
        name: '하체 운동',
        muscles: ['quadriceps', 'hamstrings', 'glutes', 'calves'],
        categories: ['legs'],
      },
      {
        id: 'upper',
        name: '상체 운동',
        muscles: ['chest', 'back', 'shoulders', 'biceps', 'triceps'],
        categories: ['chest', 'back', 'shoulders', 'arms'],
      },
      {
        id: 'lower',
        name: '하체 + 코어',
        muscles: ['quadriceps', 'hamstrings', 'glutes', 'core'],
        categories: ['legs', 'core'],
      },
    ];

    let bestSplit = splits[0];
    let bestScore = -Infinity;
    let bestReasons: string[] = [];

    splits.forEach((split) => {
      let score = 0;
      const reasons: string[] = [];

      split.muscles.forEach((muscle) => {
        const recovery = getRecoveryStatus(muscle);
        const volume = getVolumeStatus(muscle);

        // 회복 상태 점수
        if (recovery === 'fresh') {
          score += 30;
        } else if (recovery === 'recovered') {
          score += 20;
        } else {
          score -= 30; // 회복 중인 근육은 큰 감점
        }

        // 볼륨 상태 점수
        if (volume === 'low') {
          score += 25;
          reasons.push(`${muscle} 볼륨 부족`);
        } else if (volume === 'high') {
          score -= 15;
        }

        // 마지막 운동 시간
        const lastDate = getMuscleLastPerformed[muscle];
        if (lastDate) {
          const daysSince =
            (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSince > 5) {
            score += 15;
            reasons.push(`${Math.floor(daysSince)}일 전 운동`);
          }
        }
      });

      if (score > bestScore) {
        bestScore = score;
        bestSplit = split;
        bestReasons = reasons.slice(0, 2); // 최대 2개 이유만
      }
    });

    // 추천 운동 생성
    let categoryExercises = allExercises.filter((e) =>
      bestSplit.categories.includes(e.category)
    );

    // Push/Pull일 때 arms 필터링
    if (bestSplit.id === 'push') {
      categoryExercises = categoryExercises.filter((e) => {
        if (e.category === 'arms') {
          return (
            e.muscle_group?.includes('triceps') ||
            e.name.toLowerCase().includes('tricep') ||
            e.name.toLowerCase().includes('dip') ||
            e.name.toLowerCase().includes('pushdown')
          );
        }
        return true;
      });
    } else if (bestSplit.id === 'pull') {
      categoryExercises = categoryExercises.filter((e) => {
        if (e.category === 'arms') {
          return (
            e.muscle_group?.includes('biceps') ||
            e.name.toLowerCase().includes('bicep') ||
            e.name.toLowerCase().includes('curl')
          );
        }
        return true;
      });
    }

    // 복합/고립 분리
    const compoundExercises = categoryExercises.filter((e) =>
      COMPOUND_EXERCISES.has(e.id)
    );
    const isolationExercises = categoryExercises.filter(
      (e) => !COMPOUND_EXERCISES.has(e.id)
    );

    // 마지막 수행일 기준 정렬
    const sortByLastPerformed = (exercises: Exercise[]) => {
      return [...exercises].sort((a, b) => {
        const dateA = lastPerformed[a.id];
        const dateB = lastPerformed[b.id];
        if (!dateA && !dateB) return 0;
        if (!dateA) return -1;
        if (!dateB) return 1;
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      });
    };

    const sortedCompound = sortByLastPerformed(compoundExercises);
    const sortedIsolation = sortByLastPerformed(isolationExercises);

    // 복합 운동 3개 + 고립 운동 2개
    const recommended: Exercise[] = [
      ...sortedCompound.slice(0, 3),
      ...sortedIsolation.slice(0, 2),
    ].slice(0, 5);

    // 이유 생성
    let reason = '';
    if (bestReasons.length > 0) {
      reason = bestReasons[0];
    } else {
      const muscleStatus = getMuscleVolumeStatus().filter((m) =>
        bestSplit.muscles.includes(m.muscle)
      );
      const lowVolume = muscleStatus.filter((m) => m.status === 'low');
      if (lowVolume.length > 0) {
        reason = `${lowVolume[0].muscleName} 볼륨 부족`;
      } else {
        reason = '균형잡힌 훈련';
      }
    }

    return {
      split: bestSplit.id,
      splitName: bestSplit.name,
      reason,
      categories: bestSplit.categories,
      exercises: recommended,
      score: bestScore,
    };
  };

  return {
    getSmartRecommendation,
    getMuscleVolumeStatus,
    getWeeklyMuscleVolume,
    getRecoveryStatus,
    getVolumeStatus,
    MUSCLE_VOLUME_TARGET,
    COMPOUND_EXERCISES,
  };
}
