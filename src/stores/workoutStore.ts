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
  isOfflineMode: boolean;

  startWorkout: (name?: string) => Promise<void>;
  finishWorkout: () => Promise<void>;
  cancelWorkout: () => void;
  addExercise: (exercise: Exercise) => Promise<void>;
  removeExercise: (workoutExerciseId: string) => Promise<void>;
  reorderExercises: (fromIndex: number, toIndex: number) => void;
  addSet: (workoutExerciseId: string, setData: SetInput) => Promise<WorkoutSet | null>;
  updateSet: (setId: string, setData: Partial<SetInput>) => Promise<void>;
  removeSet: (setId: string) => Promise<void>;
  setCurrentExerciseIndex: (index: number) => void;
  startRestTimer: (seconds: number) => void;
  stopRestTimer: () => void;
  tickRestTimer: () => void;
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      activeSession: null,
      exercises: [],
      currentExerciseIndex: 0,
      restTimerSeconds: 0,
      isRestTimerRunning: false,
      isOfflineMode: false,

      startWorkout: async (name) => {
        const { data: { user } } = await supabase.auth.getUser();

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
          });
          return;
        }

        // 로그인된 경우: Supabase에 저장
        const insertData: WorkoutSessionInsert = {
          user_id: user.id,
          name: sessionName,
          started_at: startedAt,
        };

        const { data, error } = await supabase
          .from('workout_sessions')
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;

        set({
          activeSession: data,
          exercises: [],
          currentExerciseIndex: 0,
          isOfflineMode: false,
        });
      },

      finishWorkout: async () => {
        const { activeSession, exercises, isOfflineMode } = get();
        if (!activeSession) return;

        const { data: { user } } = await supabase.auth.getUser();

        const startTime = new Date(activeSession.started_at);
        const endTime = new Date();
        const durationMinutes = Math.round(
          (endTime.getTime() - startTime.getTime()) / 1000 / 60
        );

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

        const completedWorkout: CompletedWorkout = {
          id: activeSession.id,
          name: activeSession.name || '운동',
          started_at: activeSession.started_at,
          finished_at: endTime.toISOString(),
          duration_minutes: durationMinutes,
          exercises: completedExercises,
          total_sets: totalSets,
          total_volume: totalVolume,
        };

        // 히스토리에 저장 (로그인된 경우 userId 전달하여 클라우드에도 저장)
        useHistoryStore.getState().addCompletedWorkout(completedWorkout, user?.id);

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
        });
      },

      cancelWorkout: () => {
        set({
          activeSession: null,
          exercises: [],
          currentExerciseIndex: 0,
          isOfflineMode: false,
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
        const { exercises, isOfflineMode } = get();
        const exerciseIndex = exercises.findIndex(
          (e) => e.id === workoutExerciseId
        );
        if (exerciseIndex === -1) return null;

        const completedAt = new Date().toISOString();

        // 로컬 운동인지 확인 (로컬에서 생성된 운동 ID)
        const isLocalWorkoutExercise = workoutExerciseId.startsWith('local_');

        // 로컬 모드이거나 로컬 운동인 경우
        if (isOfflineMode || isLocalWorkoutExercise) {
          const localSet: WorkoutSet = {
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
            completed_at: completedAt,
            created_at: completedAt,
          };

          const newExercises = [...exercises];
          newExercises[exerciseIndex].sets.push(localSet);
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
          completed_at: completedAt,
        };

        const { data, error } = await supabase
          .from('workout_sets')
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;

        const newExercises = [...exercises];
        newExercises[exerciseIndex].sets.push(data);
        set({ exercises: newExercises });
        return data;
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

      startRestTimer: (seconds) => {
        set({ restTimerSeconds: seconds, isRestTimerRunning: true });
      },

      stopRestTimer: () => {
        set({ restTimerSeconds: 0, isRestTimerRunning: false });
      },

      tickRestTimer: () => {
        const { restTimerSeconds } = get();
        if (restTimerSeconds > 0) {
          set({ restTimerSeconds: restTimerSeconds - 1 });
        } else {
          set({ isRestTimerRunning: false });
        }
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
      }),
    }
  )
);
