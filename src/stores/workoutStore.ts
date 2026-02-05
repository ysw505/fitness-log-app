import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { Platform } from 'react-native';
import { supabase } from '@/services/supabase';
import {
  Exercise,
  WorkoutSession,
  WorkoutSessionInsert,
  WorkoutExerciseInsert,
  WorkoutSetInsert,
  WorkoutSet,
} from '@/types/database.types';
import { WorkoutExerciseWithSets, SetInput } from '@/types/workout.types';
import { useHistoryStore, CompletedWorkout, CompletedExercise } from './historyStore';
import { useProfileStore } from './profileStore';
import { useAchievementStore } from './achievementStore';

// 프로필 ID가 포함된 세트 타입
export interface WorkoutSetWithProfile extends WorkoutSet {
  profile_id?: string;
  profile_name?: string;
}

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

// 로컬 ID 생성
const generateLocalId = () => `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

interface WorkoutState {
  activeSession: WorkoutSession | null;
  exercises: WorkoutExerciseWithSets[];
  currentExerciseIndex: number;
  restTimerSeconds: number;
  isRestTimerRunning: boolean;
  restTimerEndTime: number | null; // 타이머 종료 시각 timestamp (persist용)
  isOfflineMode: boolean;

  // 같이 운동하는 프로필들
  activeProfileIds: string[];
  currentSetProfileId: string | null; // 현재 세트를 기록할 프로필

  // 시간 추적
  totalRestTimeUsed: number; // 총 사용된 휴식 시간 (초)
  lastRestTimerDuration: number; // 마지막으로 설정한 휴식 시간 (초)

  startWorkout: (name?: string, profileIds?: string[]) => Promise<void>;
  startWorkoutFromTemplate: (templateWorkout: CompletedWorkout) => Promise<void>;
  finishWorkout: (customName?: string) => Promise<void>;
  cancelWorkout: () => void;
  addExercise: (exercise: Exercise) => Promise<void>;
  removeExercise: (workoutExerciseId: string) => Promise<void>;
  reorderExercises: (fromIndex: number, toIndex: number) => void;
  addSet: (workoutExerciseId: string, setData: SetInput) => Promise<WorkoutSetWithProfile | null>;
  updateSet: (setId: string, setData: Partial<SetInput>) => Promise<void>;
  removeSet: (setId: string) => Promise<void>;
  setCurrentExerciseIndex: (index: number) => void;
  setCurrentSetProfile: (profileId: string) => void;
  startRestTimer: (seconds: number) => void;
  stopRestTimer: () => void;
  tickRestTimer: () => void;
  restoreRestTimer: () => void; // 앱 시작시 restTimerEndTime에서 남은 시간 복원
  getTimeBreakdown: () => { totalSeconds: number; restSeconds: number; activeSeconds: number };
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      activeSession: null,
      exercises: [],
      currentExerciseIndex: 0,
      restTimerSeconds: 0,
      isRestTimerRunning: false,
      restTimerEndTime: null,
      isOfflineMode: false,
      activeProfileIds: [],
      currentSetProfileId: null,
      totalRestTimeUsed: 0,
      lastRestTimerDuration: 0,

      startWorkout: async (name, profileIds) => {
        const { data: { user } } = await supabase.auth.getUser();

        // 같이 운동할 프로필들 설정 (없으면 현재 프로필만)
        const currentProfileId = useProfileStore.getState().currentProfileId;
        const workoutProfileIds = profileIds || (currentProfileId ? [currentProfileId] : []);

        const sessionName = name || `운동 ${new Date().toLocaleDateString('ko-KR')}`;
        const startedAt = new Date().toISOString();

        // 로그인 안된 경우: 로컬 모드
        if (!user) {
          const localSession: WorkoutSession = {
            id: generateLocalId(),
            user_id: 'local',
            name: sessionName,
            started_at: startedAt,
            finished_at: null,
            duration_minutes: null,
            notes: null,
            created_at: startedAt,
          };

          set({
            activeSession: localSession,
            exercises: [],
            currentExerciseIndex: 0,
            isOfflineMode: true,
            activeProfileIds: workoutProfileIds,
            currentSetProfileId: workoutProfileIds[0] || null,
            totalRestTimeUsed: 0,
            lastRestTimerDuration: 0,
          });
          return;
        }

        // 로그인된 경우: Supabase에 저장
        const insertData: WorkoutSessionInsert = {
          user_id: user.id,
          name: sessionName,
          started_at: startedAt,
        };

        try {
          const { data, error } = await supabase
            .from('workout_sessions')
            .insert(insertData)
            .select()
            .single();

          if (error) {
            // 외래 키 오류 (DB가 초기화되었지만 세션이 남아있는 경우) - 프로필 생성 후 재시도
            if (error.code === '23503' || error.message?.includes('foreign key')) {
              console.warn('User not found in DB, creating profile...');

              // 프로필 자동 생성
              const newProfile = {
                id: user.id,
                display_name: user.user_metadata?.full_name || user.email?.split('@')[0] || '사용자',
                avatar_url: user.user_metadata?.avatar_url || null,
                unit_system: 'metric' as const,
              };

              const { error: profileError } = await supabase
                .from('profiles')
                .upsert(newProfile);

              if (profileError) {
                console.error('Failed to create profile:', profileError);
                throw profileError;
              }

              console.log('Profile created, retrying workout session...');

              // 프로필 생성 후 재시도
              const { data: retryData, error: retryError } = await supabase
                .from('workout_sessions')
                .insert(insertData)
                .select()
                .single();

              if (retryError) throw retryError;

              set({
                activeSession: retryData,
                exercises: [],
                currentExerciseIndex: 0,
                isOfflineMode: false,
                activeProfileIds: workoutProfileIds,
                currentSetProfileId: workoutProfileIds[0] || null,
                totalRestTimeUsed: 0,
                lastRestTimerDuration: 0,
              });
              return;
            }
            throw error;
          }

          set({
            activeSession: data,
            exercises: [],
            currentExerciseIndex: 0,
            isOfflineMode: false,
            activeProfileIds: workoutProfileIds,
            currentSetProfileId: workoutProfileIds[0] || null,
            totalRestTimeUsed: 0,
            lastRestTimerDuration: 0,
          });
        } catch (err) {
          // 네트워크 오류 등 다른 오류 - 로컬 모드로 폴백
          console.warn('Failed to create session in Supabase, falling back to local mode:', err);

          const localSession: WorkoutSession = {
            id: generateLocalId(),
            user_id: 'local',
            name: sessionName,
            started_at: startedAt,
            finished_at: null,
            duration_minutes: null,
            notes: null,
            created_at: startedAt,
          };

          set({
            activeSession: localSession,
            exercises: [],
            currentExerciseIndex: 0,
            isOfflineMode: true,
            activeProfileIds: workoutProfileIds,
            currentSetProfileId: workoutProfileIds[0] || null,
            totalRestTimeUsed: 0,
            lastRestTimerDuration: 0,
          });
        }
      },

      startWorkoutFromTemplate: async (templateWorkout) => {
        const { startWorkout, addExercise } = get();

        // 1. 운동 세션 시작 (같은 이름으로)
        await startWorkout(templateWorkout.name, templateWorkout.profile_ids);

        // 2. 템플릿의 운동들을 추가 (exerciseStore에서 운동 정보 가져오기)
        const { useExerciseStore } = await import('./exerciseStore');
        const allExercises = useExerciseStore.getState().getAllExercises();

        for (const exercise of templateWorkout.exercises) {
          const exerciseData = allExercises.find((e) => e.id === exercise.exercise_id);
          if (exerciseData) {
            await addExercise(exerciseData);
          }
        }
      },

      finishWorkout: async (customName?: string) => {
        const { activeSession, exercises, isOfflineMode, totalRestTimeUsed, isRestTimerRunning, lastRestTimerDuration, restTimerSeconds } = get();
        if (!activeSession) return;

        const { data: { user } } = await supabase.auth.getUser();

        const startTime = new Date(activeSession.started_at);
        const endTime = new Date();
        const durationMinutes = Math.round(
          (endTime.getTime() - startTime.getTime()) / 1000 / 60
        );
        const totalSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

        // 완료된 운동 데이터 생성
        const completedExercises: CompletedExercise[] = exercises.map((e) => ({
          id: e.id,
          exercise_id: e.exercise_id,
          exercise_name: e.exercise.name,
          exercise_name_ko: e.exercise.name_ko ?? null,
          category: e.exercise.category,
          sets: e.sets,
        }));

        const totalSets = exercises.reduce((sum, e) => sum + e.sets.length, 0);
        const totalVolume = exercises.reduce(
          (sum, e) =>
            sum +
            e.sets.reduce((setSum, s) => setSum + (s.weight || 0) * (s.reps || 0), 0),
          0
        );

        // 현재 운동에 참여한 프로필 IDs
        const { activeProfileIds } = get();

        // 시간 분석 계산 - 진행 중인 휴식 타이머도 포함
        let finalRestSeconds = totalRestTimeUsed;
        if (isRestTimerRunning && lastRestTimerDuration > 0) {
          finalRestSeconds += lastRestTimerDuration - restTimerSeconds;
        }
        const activeSeconds = Math.max(0, totalSeconds - finalRestSeconds);

        const completedWorkout: CompletedWorkout = {
          id: activeSession.id,
          name: customName || activeSession.name || '운동',
          started_at: activeSession.started_at,
          finished_at: endTime.toISOString(),
          duration_minutes: durationMinutes,
          exercises: completedExercises,
          total_sets: totalSets,
          total_volume: totalVolume,
          profile_ids: activeProfileIds.length > 0 ? activeProfileIds : undefined,
          rest_seconds: finalRestSeconds,
          active_seconds: activeSeconds,
        };

        // 히스토리에 저장 (로그인된 경우 userId 전달하여 클라우드에도 저장)
        useHistoryStore.getState().addCompletedWorkout(completedWorkout, user?.id);

        // 성취 시스템에 운동 기록 (배지, 스트릭 등 업데이트)
        const exerciseIds = exercises.map(e => e.exercise_id);
        const prCount = Object.keys(useHistoryStore.getState().personalRecords).length;
        useAchievementStore.getState().recordWorkout(totalVolume, exerciseIds, false);
        useAchievementStore.getState().updatePRCount(prCount);

        // 로컬 모드가 아니면 Supabase에도 저장
        if (!isOfflineMode) {
          const { error } = await supabase
            .from('workout_sessions')
            .update({
              finished_at: endTime.toISOString(),
              duration_minutes: durationMinutes,
            })
            .eq('id', activeSession.id);

          if (error) {
            console.error('Failed to update session in Supabase:', error);
          }
        }

        // 상태 클리어
        set({
          activeSession: null,
          exercises: [],
          currentExerciseIndex: 0,
          isOfflineMode: false,
          activeProfileIds: [],
          currentSetProfileId: null,
          restTimerSeconds: 0,
          isRestTimerRunning: false,
          restTimerEndTime: null,
          totalRestTimeUsed: 0,
          lastRestTimerDuration: 0,
        });
      },

      cancelWorkout: () => {
        set({
          activeSession: null,
          exercises: [],
          currentExerciseIndex: 0,
          isOfflineMode: false,
          activeProfileIds: [],
          currentSetProfileId: null,
          restTimerSeconds: 0,
          isRestTimerRunning: false,
          restTimerEndTime: null,
          totalRestTimeUsed: 0,
          lastRestTimerDuration: 0,
        });
      },

      addExercise: async (exercise) => {
        const { activeSession, exercises, isOfflineMode } = get();
        if (!activeSession) return;

        // 기본 운동이나 로컬 커스텀 운동인지 확인 (Supabase에 존재하지 않는 ID)
        const isLocalExercise = exercise.id.startsWith('default_') || exercise.id.startsWith('custom_');

        // 로컬 모드이거나 로컬 운동인 경우 - 로컬로 처리
        if (isOfflineMode || isLocalExercise) {
          const localExercise: WorkoutExerciseWithSets = {
            id: generateLocalId(),
            session_id: activeSession.id,
            exercise_id: exercise.id,
            order_index: exercises.length,
            notes: null,
            created_at: new Date().toISOString(),
            exercise,
            sets: [],
          };

          set({
            exercises: [...exercises, localExercise],
            currentExerciseIndex: exercises.length,
          });
          return;
        }

        const insertData: WorkoutExerciseInsert = {
          session_id: activeSession.id,
          exercise_id: exercise.id,
          order_index: exercises.length,
        };

        const { data, error } = await supabase
          .from('workout_exercises')
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;

        const newExercise: WorkoutExerciseWithSets = {
          ...data,
          exercise,
          sets: [],
        };

        set({
          exercises: [...exercises, newExercise],
          currentExerciseIndex: exercises.length,
        });
      },

      removeExercise: async (workoutExerciseId) => {
        const { exercises, isOfflineMode } = get();

        // 로컬 운동이 아닌 경우에만 Supabase에서 삭제
        const isLocalWorkoutExercise = workoutExerciseId.startsWith('local_');
        if (!isOfflineMode && !isLocalWorkoutExercise) {
          const { error } = await supabase
            .from('workout_exercises')
            .delete()
            .eq('id', workoutExerciseId);

          if (error) throw error;
        }

        set({
          exercises: exercises.filter((e) => e.id !== workoutExerciseId),
        });
      },

      reorderExercises: (fromIndex, toIndex) => {
        const { exercises } = get();
        const newExercises = [...exercises];
        const [removed] = newExercises.splice(fromIndex, 1);
        newExercises.splice(toIndex, 0, removed);
        set({ exercises: newExercises });
      },

      addSet: async (workoutExerciseId, setData) => {
        const { exercises, isOfflineMode, currentSetProfileId } = get();
        const exerciseIndex = exercises.findIndex(
          (e) => e.id === workoutExerciseId
        );
        if (exerciseIndex === -1) return null;

        const completedAt = new Date().toISOString();

        // 현재 선택된 프로필 정보 가져오기
        const profileStore = useProfileStore.getState();
        const currentProfile = profileStore.profiles.find(
          (p) => p.id === (setData.profile_id || currentSetProfileId)
        );

        // 로컬 운동인지 확인 (로컬에서 생성된 운동 ID)
        const isLocalWorkoutExercise = workoutExerciseId.startsWith('local_');

        // 로컬 모드이거나 로컬 운동인 경우
        if (isOfflineMode || isLocalWorkoutExercise) {
          const localSet: WorkoutSetWithProfile = {
            id: generateLocalId(),
            workout_exercise_id: workoutExerciseId,
            set_number: setData.set_number,
            weight: setData.weight ?? null,
            reps: setData.reps ?? null,
            duration_seconds: setData.duration_seconds ?? null,
            distance_meters: null,
            is_warmup: setData.is_warmup ?? false,
            is_dropset: setData.is_dropset ?? false,
            rpe: setData.rpe ?? null,
            note: setData.note ?? null,
            completed_at: completedAt,
            created_at: completedAt,
            profile_id: setData.profile_id || currentSetProfileId || undefined,
            profile_name: currentProfile?.name,
          };

          // 불변 업데이트 사용 (mutation 방지)
          const newExercises = exercises.map((e, i) =>
            i === exerciseIndex
              ? { ...e, sets: [...e.sets, localSet] }
              : e
          );
          set({ exercises: newExercises });
          return localSet;
        }

        const insertData: WorkoutSetInsert = {
          workout_exercise_id: workoutExerciseId,
          set_number: setData.set_number,
          weight: setData.weight,
          reps: setData.reps,
          duration_seconds: setData.duration_seconds,
          is_warmup: setData.is_warmup,
          is_dropset: setData.is_dropset,
          rpe: setData.rpe,
          note: setData.note,
          completed_at: completedAt,
        };

        const { data, error } = await supabase
          .from('workout_sets')
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;

        // 프로필 정보 추가
        const setWithProfile: WorkoutSetWithProfile = {
          ...data,
          profile_id: setData.profile_id || currentSetProfileId || undefined,
          profile_name: currentProfile?.name,
        };

        // 불변 업데이트 사용 (mutation 방지)
        const newExercises = exercises.map((e, i) =>
          i === exerciseIndex
            ? { ...e, sets: [...e.sets, setWithProfile] }
            : e
        );
        set({ exercises: newExercises });
        return setWithProfile;
      },

      updateSet: async (setId, setData) => {
        const { exercises, isOfflineMode } = get();

        // 로컬 세트가 아닌 경우에만 Supabase 업데이트
        const isLocalSet = setId.startsWith('local_');
        if (!isOfflineMode && !isLocalSet) {
          const { error } = await supabase
            .from('workout_sets')
            .update({
              weight: setData.weight,
              reps: setData.reps,
              duration_seconds: setData.duration_seconds,
              is_warmup: setData.is_warmup,
              is_dropset: setData.is_dropset,
              rpe: setData.rpe,
              note: setData.note,
            })
            .eq('id', setId);

          if (error) throw error;
        }

        const newExercises = exercises.map((exercise) => ({
          ...exercise,
          sets: exercise.sets.map((s) =>
            s.id === setId ? { ...s, ...setData } : s
          ),
        }));

        set({ exercises: newExercises });
      },

      removeSet: async (setId) => {
        const { exercises, isOfflineMode } = get();

        // 로컬 세트가 아닌 경우에만 Supabase에서 삭제
        const isLocalSet = setId.startsWith('local_');
        if (!isOfflineMode && !isLocalSet) {
          const { error } = await supabase
            .from('workout_sets')
            .delete()
            .eq('id', setId);

          if (error) throw error;
        }

        const newExercises = exercises.map((exercise) => ({
          ...exercise,
          sets: exercise.sets.filter((s) => s.id !== setId),
        }));

        set({ exercises: newExercises });
      },

      setCurrentExerciseIndex: (index) => {
        set({ currentExerciseIndex: index });
      },

      setCurrentSetProfile: (profileId) => {
        set({ currentSetProfileId: profileId });
      },

      startRestTimer: (seconds) => {
        const endTime = Date.now() + seconds * 1000;
        set({
          restTimerSeconds: seconds,
          isRestTimerRunning: true,
          restTimerEndTime: endTime,
          lastRestTimerDuration: seconds,
        });
      },

      stopRestTimer: () => {
        const { lastRestTimerDuration, restTimerSeconds, totalRestTimeUsed } = get();
        // 사용된 휴식 시간 = 설정된 시간 - 남은 시간 (스킵 시)
        // 타이머가 완료되면 restTimerSeconds가 0이므로 전체 시간이 더해짐
        const usedRestTime = lastRestTimerDuration - restTimerSeconds;
        set({
          restTimerSeconds: 0,
          isRestTimerRunning: false,
          restTimerEndTime: null,
          totalRestTimeUsed: totalRestTimeUsed + Math.max(0, usedRestTime),
        });
      },

      tickRestTimer: () => {
        const { restTimerSeconds, lastRestTimerDuration, totalRestTimeUsed } = get();
        if (restTimerSeconds > 0) {
          set({ restTimerSeconds: restTimerSeconds - 1 });
        } else {
          // 타이머 완료 시 전체 휴식 시간 추가
          set({
            isRestTimerRunning: false,
            restTimerEndTime: null,
            totalRestTimeUsed: totalRestTimeUsed + lastRestTimerDuration,
          });
        }
      },

      restoreRestTimer: () => {
        const { restTimerEndTime, activeSession, lastRestTimerDuration, totalRestTimeUsed } = get();

        // 활성 세션이 없거나 저장된 타이머 종료 시각이 없으면 무시
        if (!activeSession || !restTimerEndTime) {
          set({
            restTimerSeconds: 0,
            isRestTimerRunning: false,
            restTimerEndTime: null,
          });
          return;
        }

        const now = Date.now();
        const remainingMs = restTimerEndTime - now;

        if (remainingMs > 0) {
          // 아직 타이머가 남아있음 - 남은 시간 계산하여 복원
          const remainingSeconds = Math.ceil(remainingMs / 1000);
          set({
            restTimerSeconds: remainingSeconds,
            isRestTimerRunning: true,
          });
        } else {
          // 타이머가 이미 만료됨 - 휴식 시간 추가하고 초기화
          set({
            restTimerSeconds: 0,
            isRestTimerRunning: false,
            restTimerEndTime: null,
            totalRestTimeUsed: totalRestTimeUsed + lastRestTimerDuration,
          });
        }
      },

      getTimeBreakdown: () => {
        const { activeSession, totalRestTimeUsed, isRestTimerRunning, lastRestTimerDuration, restTimerSeconds } = get();

        if (!activeSession) {
          return { totalSeconds: 0, restSeconds: 0, activeSeconds: 0 };
        }

        const startTime = new Date(activeSession.started_at).getTime();
        const now = Date.now();
        const totalSeconds = Math.floor((now - startTime) / 1000);

        // 현재 진행 중인 휴식 타이머의 경과 시간도 포함
        let currentRestUsed = 0;
        if (isRestTimerRunning && lastRestTimerDuration > 0) {
          currentRestUsed = lastRestTimerDuration - restTimerSeconds;
        }

        const restSeconds = totalRestTimeUsed + currentRestUsed;
        const activeSeconds = Math.max(0, totalSeconds - restSeconds);

        return { totalSeconds, restSeconds, activeSeconds };
      },
    }),
    {
      name: 'workout-storage',
      storage: createJSONStorage(() => getStorage()),
      partialize: (state) => ({
        activeSession: state.activeSession,
        exercises: state.exercises,
        currentExerciseIndex: state.currentExerciseIndex,
        isOfflineMode: state.isOfflineMode,
        activeProfileIds: state.activeProfileIds,
        currentSetProfileId: state.currentSetProfileId,
        restTimerEndTime: state.restTimerEndTime,
        totalRestTimeUsed: state.totalRestTimeUsed,
        lastRestTimerDuration: state.lastRestTimerDuration,
      }),
    }
  )
);
