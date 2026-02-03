import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { Platform } from 'react-native';
import { WorkoutSet } from '@/types/database.types';
import {
  saveWorkoutToCloud,
  fetchWorkoutsFromCloud,
  deleteWorkoutFromCloud,
  mergeWorkouts,
} from '@/services/syncService';

// 웹/네이티브 호환 스토리지
const getStorage = (): StateStorage => {
  if (Platform.OS === 'web') {
    return {
      getItem: (name) => {
        const value = localStorage.getItem(name);
        return value ?? null;
      },
      setItem: (name, value) => {
        localStorage.setItem(name, value);
      },
      removeItem: (name) => {
        localStorage.removeItem(name);
      },
    };
  }
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  return AsyncStorage;
};

// 완료된 운동 세션 타입
export interface CompletedExercise {
  id: string;
  exercise_id: string;
  exercise_name: string;
  exercise_name_ko: string | null;
  category: string;
  sets: WorkoutSet[];
}

export interface CompletedWorkout {
  id: string;
  name: string;
  started_at: string;
  finished_at: string;
  duration_minutes: number;
  exercises: CompletedExercise[];
  total_sets: number;
  total_volume: number; // kg
}

// 운동별 기록 (차트용)
export interface ExerciseRecord {
  exercise_id: string;
  exercise_name: string;
  exercise_name_ko: string | null;
  category: string;
  records: {
    date: string;
    max_weight: number;
    total_volume: number;
    total_sets: number;
    total_reps: number;
    sets: WorkoutSet[];
  }[];
}

// 개인 기록 (PR)
export interface PersonalRecord {
  exercise_id: string;
  exercise_name: string;
  exercise_name_ko: string | null;
  max_weight: number;
  max_reps_at_weight: number;
  achieved_at: string;
  estimated_1rm: number; // Epley formula
}

interface HistoryState {
  completedWorkouts: CompletedWorkout[];
  exerciseRecords: Record<string, ExerciseRecord>;
  personalRecords: Record<string, PersonalRecord>;
  isSyncing: boolean;
  lastSyncedAt: string | null;

  addCompletedWorkout: (workout: CompletedWorkout, userId?: string | null) => void;
  deleteWorkout: (workoutId: string, userId?: string | null) => void;
  syncFromCloud: (userId: string) => Promise<void>;
  syncToCloud: (userId: string) => Promise<void>;
  getWorkoutById: (workoutId: string) => CompletedWorkout | undefined;
  getExerciseHistory: (exerciseId: string) => ExerciseRecord | undefined;
  getRecentWorkouts: (limit?: number) => CompletedWorkout[];
  getWeeklyStats: () => {
    workoutCount: number;
    totalMinutes: number;
    totalVolume: number;
    totalSets: number;
  };
  getMonthlyStats: () => {
    workoutCount: number;
    totalMinutes: number;
    totalVolume: number;
    totalSets: number;
  };
  getAllPersonalRecords: () => PersonalRecord[];
  getExerciseLastPerformed: (exerciseId: string) => string | null;
  getExercisesLastPerformed: () => Record<string, string>;
  getWorkoutStreak: () => number;
  getCategoryStats: () => { category: string; count: number }[];
  // 주간 카테고리별 세트 수 (볼륨 트래킹)
  getWeeklyCategorySets: () => Record<string, number>;
  // 각 카테고리별 마지막 운동 날짜
  getCategoryLastPerformed: () => Record<string, string>;
  getLastWeekStats: () => {
    workoutCount: number;
    totalMinutes: number;
    totalVolume: number;
    totalSets: number;
  };
  getTotalWorkoutCount: () => number;
  getAverageWorkoutDuration: () => number;
  // 최근 4주 볼륨 추이
  getWeeklyVolumeTrend: () => { week: string; volume: number; workouts: number }[];
  // 가장 많이 한 운동 TOP 5
  getMostPerformedExercises: () => { exerciseId: string; name: string; count: number }[];
  // 최근 달성한 PR (30일 이내)
  getRecentPRs: () => PersonalRecord[];
  // 이번 달 운동한 날 수
  getMonthlyWorkoutDays: () => number;
}

// Epley 공식으로 1RM 추정
const calculate1RM = (weight: number, reps: number): number => {
  if (reps === 1) return weight;
  if (reps === 0 || weight === 0) return 0;
  return Math.round(weight * (1 + reps / 30));
};

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      completedWorkouts: [],
      exerciseRecords: {},
      personalRecords: {},
      isSyncing: false,
      lastSyncedAt: null,

      addCompletedWorkout: (workout, userId = null) => {
        const { completedWorkouts, exerciseRecords, personalRecords } = get();

        // 운동 기록 추가
        const newWorkouts = [workout, ...completedWorkouts];

        // 운동별 기록 업데이트
        const newExerciseRecords = { ...exerciseRecords };
        const newPersonalRecords = { ...personalRecords };

        workout.exercises.forEach((exercise) => {
          const exerciseId = exercise.exercise_id;

          // 이 운동의 최대 무게와 총 볼륨 계산
          let maxWeight = 0;
          let totalVolume = 0;
          let totalReps = 0;
          let maxRepsAtMaxWeight = 0;

          exercise.sets.forEach((s) => {
            const weight = s.weight || 0;
            const reps = s.reps || 0;
            totalVolume += weight * reps;
            totalReps += reps;

            if (weight > maxWeight) {
              maxWeight = weight;
              maxRepsAtMaxWeight = reps;
            } else if (weight === maxWeight && reps > maxRepsAtMaxWeight) {
              maxRepsAtMaxWeight = reps;
            }
          });

          // 운동별 기록 업데이트
          if (!newExerciseRecords[exerciseId]) {
            newExerciseRecords[exerciseId] = {
              exercise_id: exerciseId,
              exercise_name: exercise.exercise_name,
              exercise_name_ko: exercise.exercise_name_ko,
              category: exercise.category,
              records: [],
            };
          }

          newExerciseRecords[exerciseId].records.unshift({
            date: workout.finished_at,
            max_weight: maxWeight,
            total_volume: totalVolume,
            total_sets: exercise.sets.length,
            total_reps: totalReps,
            sets: exercise.sets,
          });

          // 최근 50개 기록만 유지
          if (newExerciseRecords[exerciseId].records.length > 50) {
            newExerciseRecords[exerciseId].records =
              newExerciseRecords[exerciseId].records.slice(0, 50);
          }

          // PR 업데이트
          const currentPR = newPersonalRecords[exerciseId];
          const estimated1RM = calculate1RM(maxWeight, maxRepsAtMaxWeight);

          if (
            !currentPR ||
            maxWeight > currentPR.max_weight ||
            (maxWeight === currentPR.max_weight &&
             maxRepsAtMaxWeight > currentPR.max_reps_at_weight)
          ) {
            newPersonalRecords[exerciseId] = {
              exercise_id: exerciseId,
              exercise_name: exercise.exercise_name,
              exercise_name_ko: exercise.exercise_name_ko,
              max_weight: maxWeight,
              max_reps_at_weight: maxRepsAtMaxWeight,
              achieved_at: workout.finished_at,
              estimated_1rm: estimated1RM,
            };
          }
        });

        set({
          completedWorkouts: newWorkouts,
          exerciseRecords: newExerciseRecords,
          personalRecords: newPersonalRecords,
        });

        // 로그인된 경우 클라우드에도 저장
        if (userId) {
          saveWorkoutToCloud(userId, workout).catch((error) => {
            console.error('Failed to save workout to cloud:', error);
          });
        }
      },

      deleteWorkout: (workoutId, userId = null) => {
        const { completedWorkouts } = get();
        set({
          completedWorkouts: completedWorkouts.filter((w) => w.id !== workoutId),
        });

        // 로그인된 경우 클라우드에서도 삭제
        if (userId) {
          deleteWorkoutFromCloud(workoutId).catch((error) => {
            console.error('Failed to delete workout from cloud:', error);
          });
        }
      },

      // 클라우드에서 데이터 동기화
      syncFromCloud: async (userId) => {
        set({ isSyncing: true });
        try {
          const cloudWorkouts = await fetchWorkoutsFromCloud(userId);
          const { completedWorkouts } = get();

          // 로컬과 클라우드 데이터 병합
          const mergedWorkouts = mergeWorkouts(completedWorkouts, cloudWorkouts);

          // exerciseRecords와 personalRecords 재계산
          const newExerciseRecords: Record<string, ExerciseRecord> = {};
          const newPersonalRecords: Record<string, PersonalRecord> = {};

          mergedWorkouts.forEach((workout) => {
            workout.exercises.forEach((exercise) => {
              const exerciseId = exercise.exercise_id;

              let maxWeight = 0;
              let totalVolume = 0;
              let totalReps = 0;
              let maxRepsAtMaxWeight = 0;

              exercise.sets.forEach((s) => {
                const weight = s.weight || 0;
                const reps = s.reps || 0;
                totalVolume += weight * reps;
                totalReps += reps;

                if (weight > maxWeight) {
                  maxWeight = weight;
                  maxRepsAtMaxWeight = reps;
                } else if (weight === maxWeight && reps > maxRepsAtMaxWeight) {
                  maxRepsAtMaxWeight = reps;
                }
              });

              if (!newExerciseRecords[exerciseId]) {
                newExerciseRecords[exerciseId] = {
                  exercise_id: exerciseId,
                  exercise_name: exercise.exercise_name,
                  exercise_name_ko: exercise.exercise_name_ko,
                  category: exercise.category,
                  records: [],
                };
              }

              newExerciseRecords[exerciseId].records.push({
                date: workout.finished_at,
                max_weight: maxWeight,
                total_volume: totalVolume,
                total_sets: exercise.sets.length,
                total_reps: totalReps,
                sets: exercise.sets,
              });

              // PR 업데이트
              const currentPR = newPersonalRecords[exerciseId];
              const estimated1RM = calculate1RM(maxWeight, maxRepsAtMaxWeight);

              if (
                !currentPR ||
                maxWeight > currentPR.max_weight ||
                (maxWeight === currentPR.max_weight &&
                  maxRepsAtMaxWeight > currentPR.max_reps_at_weight)
              ) {
                newPersonalRecords[exerciseId] = {
                  exercise_id: exerciseId,
                  exercise_name: exercise.exercise_name,
                  exercise_name_ko: exercise.exercise_name_ko,
                  max_weight: maxWeight,
                  max_reps_at_weight: maxRepsAtMaxWeight,
                  achieved_at: workout.finished_at,
                  estimated_1rm: estimated1RM,
                };
              }
            });
          });

          // records를 날짜순으로 정렬
          Object.values(newExerciseRecords).forEach((record) => {
            record.records.sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            );
            // 최근 50개만 유지
            if (record.records.length > 50) {
              record.records = record.records.slice(0, 50);
            }
          });

          set({
            completedWorkouts: mergedWorkouts,
            exerciseRecords: newExerciseRecords,
            personalRecords: newPersonalRecords,
            lastSyncedAt: new Date().toISOString(),
            isSyncing: false,
          });

          // 로컬에만 있는 운동을 클라우드에 업로드
          const cloudWorkoutIds = new Set(cloudWorkouts.map((w) => w.id));
          const localOnlyWorkouts = completedWorkouts.filter(
            (w) => !cloudWorkoutIds.has(w.id)
          );

          if (localOnlyWorkouts.length > 0) {
            console.log(`Uploading ${localOnlyWorkouts.length} local workouts to cloud`);
            for (const workout of localOnlyWorkouts) {
              await saveWorkoutToCloud(userId, workout);
            }
          }

          console.log('Sync from cloud completed');
        } catch (error) {
          console.error('Sync from cloud failed:', error);
          set({ isSyncing: false });
        }
      },

      // 로컬 데이터를 클라우드에 업로드
      syncToCloud: async (userId) => {
        set({ isSyncing: true });
        try {
          const { completedWorkouts } = get();

          for (const workout of completedWorkouts) {
            await saveWorkoutToCloud(userId, workout);
          }

          set({
            lastSyncedAt: new Date().toISOString(),
            isSyncing: false,
          });

          console.log('Sync to cloud completed');
        } catch (error) {
          console.error('Sync to cloud failed:', error);
          set({ isSyncing: false });
        }
      },

      getWorkoutById: (workoutId) => {
        const { completedWorkouts } = get();
        return completedWorkouts.find((w) => w.id === workoutId);
      },

      getExerciseHistory: (exerciseId) => {
        const { exerciseRecords } = get();
        return exerciseRecords[exerciseId];
      },

      getRecentWorkouts: (limit = 10) => {
        const { completedWorkouts } = get();
        return completedWorkouts.slice(0, limit);
      },

      getWeeklyStats: () => {
        const { completedWorkouts } = get();
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const weekWorkouts = completedWorkouts.filter(
          (w) => new Date(w.finished_at) >= weekAgo
        );

        return {
          workoutCount: weekWorkouts.length,
          totalMinutes: weekWorkouts.reduce((sum, w) => sum + w.duration_minutes, 0),
          totalVolume: weekWorkouts.reduce((sum, w) => sum + w.total_volume, 0),
          totalSets: weekWorkouts.reduce((sum, w) => sum + w.total_sets, 0),
        };
      },

      getMonthlyStats: () => {
        const { completedWorkouts } = get();
        const now = new Date();
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const monthWorkouts = completedWorkouts.filter(
          (w) => new Date(w.finished_at) >= monthAgo
        );

        return {
          workoutCount: monthWorkouts.length,
          totalMinutes: monthWorkouts.reduce((sum, w) => sum + w.duration_minutes, 0),
          totalVolume: monthWorkouts.reduce((sum, w) => sum + w.total_volume, 0),
          totalSets: monthWorkouts.reduce((sum, w) => sum + w.total_sets, 0),
        };
      },

      getAllPersonalRecords: () => {
        const { personalRecords } = get();
        return Object.values(personalRecords).sort(
          (a, b) => b.max_weight - a.max_weight
        );
      },

      getExerciseLastPerformed: (exerciseId) => {
        const { exerciseRecords } = get();
        const record = exerciseRecords[exerciseId];
        if (record && record.records.length > 0) {
          return record.records[0].date;
        }
        return null;
      },

      getExercisesLastPerformed: () => {
        const { exerciseRecords } = get();
        const result: Record<string, string> = {};
        Object.values(exerciseRecords).forEach((record) => {
          if (record.records.length > 0) {
            result[record.exercise_id] = record.records[0].date;
          }
        });
        return result;
      },

      // 운동 스트릭 계산 (연속 운동 일수)
      getWorkoutStreak: () => {
        const { completedWorkouts } = get();
        if (completedWorkouts.length === 0) return 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const workoutDates = new Set(
          completedWorkouts.map((w) => {
            const date = new Date(w.finished_at);
            date.setHours(0, 0, 0, 0);
            return date.getTime();
          })
        );

        let streak = 0;
        let checkDate = new Date(today);

        if (!workoutDates.has(checkDate.getTime())) {
          checkDate.setDate(checkDate.getDate() - 1);
        }

        while (workoutDates.has(checkDate.getTime())) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        }

        return streak;
      },

      // 카테고리별 운동 횟수
      getCategoryStats: () => {
        const { completedWorkouts } = get();
        const categoryCount: Record<string, number> = {};

        completedWorkouts.forEach((workout) => {
          workout.exercises.forEach((exercise) => {
            categoryCount[exercise.category] = (categoryCount[exercise.category] || 0) + 1;
          });
        });

        return Object.entries(categoryCount)
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count);
      },

      // 주간 카테고리별 세트 수 (볼륨 트래킹)
      getWeeklyCategorySets: () => {
        const { completedWorkouts } = get();
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const categorySets: Record<string, number> = {};

        completedWorkouts
          .filter((w) => new Date(w.finished_at) >= weekAgo)
          .forEach((workout) => {
            workout.exercises.forEach((exercise) => {
              categorySets[exercise.category] =
                (categorySets[exercise.category] || 0) + exercise.sets.length;
            });
          });

        return categorySets;
      },

      // 각 카테고리별 마지막 운동 날짜
      getCategoryLastPerformed: () => {
        const { completedWorkouts } = get();
        const categoryLastDate: Record<string, string> = {};

        // 최신 운동부터 순회하므로, 첫 번째로 나온 날짜가 가장 최근
        completedWorkouts.forEach((workout) => {
          workout.exercises.forEach((exercise) => {
            if (!categoryLastDate[exercise.category]) {
              categoryLastDate[exercise.category] = workout.finished_at;
            }
          });
        });

        return categoryLastDate;
      },

      // 지난주 통계 (비교용)
      getLastWeekStats: () => {
        const { completedWorkouts } = get();
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        const lastWeekWorkouts = completedWorkouts.filter((w) => {
          const date = new Date(w.finished_at);
          return date >= twoWeeksAgo && date < weekAgo;
        });

        return {
          workoutCount: lastWeekWorkouts.length,
          totalMinutes: lastWeekWorkouts.reduce((sum, w) => sum + w.duration_minutes, 0),
          totalVolume: lastWeekWorkouts.reduce((sum, w) => sum + w.total_volume, 0),
          totalSets: lastWeekWorkouts.reduce((sum, w) => sum + w.total_sets, 0),
        };
      },

      // 전체 운동 횟수
      getTotalWorkoutCount: () => {
        const { completedWorkouts } = get();
        return completedWorkouts.length;
      },

      // 평균 운동 시간
      getAverageWorkoutDuration: () => {
        const { completedWorkouts } = get();
        if (completedWorkouts.length === 0) return 0;
        const totalMinutes = completedWorkouts.reduce((sum, w) => sum + w.duration_minutes, 0);
        return Math.round(totalMinutes / completedWorkouts.length);
      },

      // 최근 4주 볼륨 추이
      getWeeklyVolumeTrend: () => {
        const { completedWorkouts } = get();
        const weeks: { week: string; volume: number; workouts: number }[] = [];

        for (let i = 0; i < 4; i++) {
          const now = new Date();
          const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
          const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);

          const weekWorkouts = completedWorkouts.filter((w) => {
            const date = new Date(w.finished_at);
            return date >= weekStart && date < weekEnd;
          });

          const weekLabel = i === 0 ? '이번 주' : i === 1 ? '지난 주' : `${i + 1}주 전`;

          weeks.unshift({
            week: weekLabel,
            volume: weekWorkouts.reduce((sum, w) => sum + w.total_volume, 0),
            workouts: weekWorkouts.length,
          });
        }

        return weeks;
      },

      // 가장 많이 한 운동 TOP 5
      getMostPerformedExercises: () => {
        const { completedWorkouts } = get();
        const exerciseCount: Record<string, { name: string; count: number }> = {};

        completedWorkouts.forEach((workout) => {
          workout.exercises.forEach((exercise) => {
            const id = exercise.exercise_id;
            if (!exerciseCount[id]) {
              exerciseCount[id] = {
                name: exercise.exercise_name_ko || exercise.exercise_name,
                count: 0,
              };
            }
            exerciseCount[id].count++;
          });
        });

        return Object.entries(exerciseCount)
          .map(([exerciseId, data]) => ({
            exerciseId,
            name: data.name,
            count: data.count,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
      },

      // 최근 달성한 PR (30일 이내)
      getRecentPRs: () => {
        const { personalRecords } = get();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        return Object.values(personalRecords)
          .filter((pr) => new Date(pr.achieved_at) >= thirtyDaysAgo)
          .sort((a, b) => new Date(b.achieved_at).getTime() - new Date(a.achieved_at).getTime());
      },

      // 이번 달 운동한 날 수
      getMonthlyWorkoutDays: () => {
        const { completedWorkouts } = get();
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const workoutDates = new Set(
          completedWorkouts
            .filter((w) => new Date(w.finished_at) >= monthStart)
            .map((w) => new Date(w.finished_at).toDateString())
        );

        return workoutDates.size;
      },
    }),
    {
      name: 'workout-history-storage',
      storage: createJSONStorage(() => getStorage()),
      partialize: (state) => ({
        completedWorkouts: state.completedWorkouts,
        exerciseRecords: state.exerciseRecords,
        personalRecords: state.personalRecords,
        lastSyncedAt: state.lastSyncedAt,
        // isSyncing은 persist하지 않음
      }),
    }
  )
);
