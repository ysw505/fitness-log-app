import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { Platform } from 'react-native';

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

// 템플릿 운동 타입
export interface TemplateExercise {
  exercise_id: string;
  exercise_name: string;
  exercise_name_ko: string | null;
  category: string;
  target_sets: number;
  target_reps: number;
  target_weight: number | null;
  notes: string | null;
}

// 템플릿 타입
export interface WorkoutTemplate {
  id: string;
  name: string;
  description: string | null;
  exercises: TemplateExercise[];
  created_at: string;
  updated_at: string;
  use_count: number;
  last_used_at: string | null;
}

interface TemplateState {
  templates: WorkoutTemplate[];

  createTemplate: (template: Omit<WorkoutTemplate, 'id' | 'created_at' | 'updated_at' | 'use_count' | 'last_used_at'>) => string;
  updateTemplate: (id: string, updates: Partial<WorkoutTemplate>) => void;
  deleteTemplate: (id: string) => void;
  getTemplate: (id: string) => WorkoutTemplate | undefined;
  incrementUseCount: (id: string) => void;
  createTemplateFromWorkout: (workout: {
    name: string;
    exercises: {
      exercise_id: string;
      exercise_name: string;
      exercise_name_ko: string | null;
      category: string;
      sets: { weight: number | null; reps: number | null }[];
    }[];
  }) => string;
}

const generateId = () => `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const useTemplateStore = create<TemplateState>()(
  persist(
    (set, get) => ({
      templates: [],

      createTemplate: (template) => {
        const id = generateId();
        const now = new Date().toISOString();

        const newTemplate: WorkoutTemplate = {
          ...template,
          id,
          created_at: now,
          updated_at: now,
          use_count: 0,
          last_used_at: null,
        };

        set((state) => ({
          templates: [newTemplate, ...state.templates],
        }));

        return id;
      },

      updateTemplate: (id, updates) => {
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id
              ? { ...t, ...updates, updated_at: new Date().toISOString() }
              : t
          ),
        }));
      },

      deleteTemplate: (id) => {
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id),
        }));
      },

      getTemplate: (id) => {
        return get().templates.find((t) => t.id === id);
      },

      incrementUseCount: (id) => {
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id
              ? {
                  ...t,
                  use_count: t.use_count + 1,
                  last_used_at: new Date().toISOString(),
                }
              : t
          ),
        }));
      },

      createTemplateFromWorkout: (workout) => {
        const exercises: TemplateExercise[] = workout.exercises.map((e) => {
          const avgWeight = e.sets.length > 0
            ? e.sets.reduce((sum, s) => sum + (s.weight || 0), 0) / e.sets.length
            : null;
          const avgReps = e.sets.length > 0
            ? Math.round(e.sets.reduce((sum, s) => sum + (s.reps || 0), 0) / e.sets.length)
            : 10;

          return {
            exercise_id: e.exercise_id,
            exercise_name: e.exercise_name,
            exercise_name_ko: e.exercise_name_ko,
            category: e.category,
            target_sets: e.sets.length || 3,
            target_reps: avgReps,
            target_weight: avgWeight ? Math.round(avgWeight * 2) / 2 : null, // 0.5kg 단위로 반올림
            notes: null,
          };
        });

        return get().createTemplate({
          name: workout.name,
          description: null,
          exercises,
        });
      },
    }),
    {
      name: 'workout-templates-storage',
      storage: createJSONStorage(() => getStorage()),
    }
  )
);
