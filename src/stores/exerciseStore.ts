import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { Platform } from 'react-native';
import { Exercise } from '@/types/database.types';
import { DEFAULT_EXERCISES, EXERCISE_CATEGORIES } from '@/data/defaultExercises';
import { supabase } from '@/services/supabase';

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
const generateLocalId = () => `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

interface ExerciseState {
  customExercises: Exercise[];
  searchQuery: string;
  selectedCategory: string | null;

  // Getters
  getAllExercises: () => Exercise[];
  getExercisesByCategory: (category: string) => Exercise[];
  searchExercises: (query: string) => Exercise[];

  // Actions
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string | null) => void;
  addCustomExercise: (exercise: Omit<Exercise, 'id' | 'created_at' | 'is_custom'>) => Promise<Exercise>;
  removeCustomExercise: (id: string) => Promise<void>;
  updateCustomExercise: (id: string, updates: Partial<Exercise>) => Promise<void>;
}

export const useExerciseStore = create<ExerciseState>()(
  persist(
    (set, get) => ({
      customExercises: [],
      searchQuery: '',
      selectedCategory: null,

      getAllExercises: () => {
        const { customExercises } = get();
        return [...DEFAULT_EXERCISES, ...customExercises];
      },

      getExercisesByCategory: (category: string) => {
        const allExercises = get().getAllExercises();
        return allExercises.filter((e) => e.category === category);
      },

      searchExercises: (query: string) => {
        const allExercises = get().getAllExercises();
        const lowercaseQuery = query.toLowerCase();
        return allExercises.filter(
          (e) =>
            e.name.toLowerCase().includes(lowercaseQuery) ||
            (e.name_ko && e.name_ko.toLowerCase().includes(lowercaseQuery))
        );
      },

      setSearchQuery: (query: string) => {
        set({ searchQuery: query });
      },

      setSelectedCategory: (category: string | null) => {
        set({ selectedCategory: category });
      },

      addCustomExercise: async (exerciseData) => {
        const { data: { user } } = await supabase.auth.getUser();

        const newExercise: Exercise = {
          id: generateLocalId(),
          ...exerciseData,
          is_custom: true,
          user_id: user?.id || null,
          created_at: new Date().toISOString(),
        };

        // 로그인 상태면 Supabase에도 저장 시도
        if (user) {
          try {
            const { data, error } = await supabase
              .from('exercises')
              .insert({
                name: newExercise.name,
                name_ko: newExercise.name_ko,
                category: newExercise.category,
                muscle_group: newExercise.muscle_group,
                equipment: newExercise.equipment,
                weight_unit: newExercise.weight_unit || 'kg',
                is_custom: true,
                user_id: user.id,
              })
              .select()
              .single();

            if (!error && data) {
              newExercise.id = data.id;
            }
          } catch (e) {
            console.error('Failed to sync custom exercise to Supabase:', e);
          }
        }

        set((state) => ({
          customExercises: [...state.customExercises, newExercise],
        }));

        return newExercise;
      },

      removeCustomExercise: async (id: string) => {
        const { data: { user } } = await supabase.auth.getUser();

        // Supabase에서도 삭제 시도
        if (user && !id.startsWith('custom_')) {
          try {
            await supabase.from('exercises').delete().eq('id', id);
          } catch (e) {
            console.error('Failed to delete custom exercise from Supabase:', e);
          }
        }

        set((state) => ({
          customExercises: state.customExercises.filter((e) => e.id !== id),
        }));
      },

      updateCustomExercise: async (id: string, updates: Partial<Exercise>) => {
        const { data: { user } } = await supabase.auth.getUser();

        // Supabase에서도 업데이트 시도
        if (user && !id.startsWith('custom_')) {
          try {
            await supabase.from('exercises').update(updates).eq('id', id);
          } catch (e) {
            console.error('Failed to update custom exercise in Supabase:', e);
          }
        }

        set((state) => ({
          customExercises: state.customExercises.map((e) =>
            e.id === id ? { ...e, ...updates } : e
          ),
        }));
      },
    }),
    {
      name: 'exercise-storage',
      storage: createJSONStorage(() => getStorage()),
      partialize: (state) => ({
        customExercises: state.customExercises,
      }),
    }
  )
);

// 카테고리 정보 export
export { EXERCISE_CATEGORIES };
