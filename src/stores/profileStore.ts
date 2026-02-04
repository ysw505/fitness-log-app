import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { Platform } from 'react-native';
import { supabase } from '@/services/supabase';
import { FitnessProfile, FitnessProfileInsert, FitnessProfileUpdate } from '@/types/database.types';

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

// 로컬 프로필 ID 생성
const generateLocalProfileId = () => `local_profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// 목표 횟수 범위 타입
export type RepRangeType = 'strength' | 'hypertrophy' | 'endurance';

export interface RepRange {
  min: number;
  max: number;
  label: string;
}

export const REP_RANGES: Record<RepRangeType, RepRange> = {
  strength: { min: 4, max: 6, label: '근력 (4-6회)' },
  hypertrophy: { min: 8, max: 12, label: '근비대 (8-12회)' },
  endurance: { min: 15, max: 20, label: '근지구력 (15-20회)' },
};

interface ProfileState {
  profiles: FitnessProfile[];
  currentProfileId: string | null;
  isLoading: boolean;
  repRangePreference: RepRangeType; // 목표 횟수 범위 설정

  // Computed
  currentProfile: () => FitnessProfile | null;
  getRepRange: () => RepRange;

  // Actions
  fetchProfiles: (userId: string) => Promise<void>;
  selectProfile: (profileId: string) => void;
  createProfile: (userId: string, name: string, data?: Partial<FitnessProfileInsert>) => Promise<FitnessProfile | null>;
  updateProfile: (profileId: string, data: FitnessProfileUpdate) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
  clearProfiles: () => void;
  setRepRangePreference: (type: RepRangeType) => void;

  // 로컬 모드 지원 (로그인 안한 경우)
  initLocalProfiles: () => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profiles: [],
      currentProfileId: null,
      isLoading: false,
      repRangePreference: 'hypertrophy' as RepRangeType,

      currentProfile: () => {
        const { profiles, currentProfileId } = get();
        if (!currentProfileId) return null;
        return profiles.find((p) => p.id === currentProfileId) || null;
      },

      getRepRange: () => {
        const { repRangePreference } = get();
        return REP_RANGES[repRangePreference];
      },

      fetchProfiles: async (userId) => {
        set({ isLoading: true });

        try {
          const { data, error } = await supabase
            .from('fitness_profiles')
            .select('*')
            .eq('user_id', userId)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: true });

          if (error) {
            console.error('Error fetching fitness profiles:', error);
            return;
          }

          const profiles = data || [];
          set({ profiles });

          // 현재 선택된 프로필이 없거나 유효하지 않으면 기본 프로필 선택
          const { currentProfileId } = get();
          if (!currentProfileId || !profiles.find((p) => p.id === currentProfileId)) {
            const defaultProfile = profiles.find((p) => p.is_default) || profiles[0];
            if (defaultProfile) {
              set({ currentProfileId: defaultProfile.id });
            }
          }
        } finally {
          set({ isLoading: false });
        }
      },

      selectProfile: (profileId) => {
        const { profiles } = get();
        if (profiles.find((p) => p.id === profileId)) {
          set({ currentProfileId: profileId });
        }
      },

      createProfile: async (userId, name, data = {}) => {
        try {
          const insertData: FitnessProfileInsert = {
            user_id: userId,
            name,
            is_default: false,
            ...data,
          };

          const { data: newProfile, error } = await supabase
            .from('fitness_profiles')
            .insert(insertData)
            .select()
            .single();

          if (error) {
            console.error('Error creating fitness profile:', error);
            return null;
          }

          set((state) => ({
            profiles: [...state.profiles, newProfile],
          }));

          return newProfile;
        } catch (e) {
          console.error('Error creating profile:', e);
          return null;
        }
      },

      updateProfile: async (profileId, data) => {
        try {
          // 로컬 프로필인 경우 로컬만 업데이트
          if (profileId.startsWith('local_')) {
            set((state) => ({
              profiles: state.profiles.map((p) =>
                p.id === profileId ? { ...p, ...data, updated_at: new Date().toISOString() } : p
              ),
            }));
            return;
          }

          const { error } = await supabase
            .from('fitness_profiles')
            .update(data)
            .eq('id', profileId);

          if (error) {
            console.error('Error updating fitness profile:', error);
            return;
          }

          set((state) => ({
            profiles: state.profiles.map((p) =>
              p.id === profileId ? { ...p, ...data, updated_at: new Date().toISOString() } : p
            ),
          }));
        } catch (e) {
          console.error('Error updating profile:', e);
        }
      },

      deleteProfile: async (profileId) => {
        const { profiles, currentProfileId } = get();

        // 기본 프로필은 삭제 불가
        const profile = profiles.find((p) => p.id === profileId);
        if (profile?.is_default) {
          console.error('Cannot delete default profile');
          return;
        }

        // 최소 1개의 프로필은 유지해야 함
        if (profiles.length <= 1) {
          console.error('Cannot delete last profile');
          return;
        }

        try {
          // 로컬 프로필인 경우 로컬만 삭제
          if (!profileId.startsWith('local_')) {
            const { error } = await supabase
              .from('fitness_profiles')
              .delete()
              .eq('id', profileId);

            if (error) {
              console.error('Error deleting fitness profile:', error);
              return;
            }
          }

          const newProfiles = profiles.filter((p) => p.id !== profileId);

          // 삭제한 프로필이 현재 선택된 프로필이면 기본 프로필로 변경
          let newCurrentProfileId = currentProfileId;
          if (currentProfileId === profileId) {
            const defaultProfile = newProfiles.find((p) => p.is_default) || newProfiles[0];
            newCurrentProfileId = defaultProfile?.id || null;
          }

          set({
            profiles: newProfiles,
            currentProfileId: newCurrentProfileId,
          });
        } catch (e) {
          console.error('Error deleting profile:', e);
        }
      },

      clearProfiles: () => {
        set({
          profiles: [],
          currentProfileId: null,
        });
      },

      setRepRangePreference: (type) => {
        set({ repRangePreference: type });
      },

      // 로컬 모드 (비로그인) 프로필 초기화
      initLocalProfiles: () => {
        const { profiles } = get();

        // 이미 프로필이 있으면 스킵
        if (profiles.length > 0) return;

        const localProfile: FitnessProfile = {
          id: generateLocalProfileId(),
          user_id: 'local',
          name: '나',
          avatar_url: null,
          gender: null,
          birth_year: null,
          height_cm: null,
          weight_kg: null,
          is_default: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        set({
          profiles: [localProfile],
          currentProfileId: localProfile.id,
        });
      },
    }),
    {
      name: 'fitness-profiles-storage',
      storage: createJSONStorage(() => getStorage()),
      partialize: (state) => ({
        profiles: state.profiles,
        currentProfileId: state.currentProfileId,
        repRangePreference: state.repRangePreference,
      }),
    }
  )
);
