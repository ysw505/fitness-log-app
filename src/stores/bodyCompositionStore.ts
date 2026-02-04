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

// 체성분 기록 타입
export interface BodyCompositionRecord {
  id: string;
  date: string; // ISO date string
  weight?: number; // kg
  bodyFat?: number; // percentage
  muscleMass?: number; // kg
  height?: number; // cm (BMI 계산용)
  notes?: string;
  createdAt: string;
}

// BMI 계산 함수
export const calculateBMI = (weightKg: number, heightCm: number): number => {
  if (!weightKg || !heightCm || heightCm <= 0) return 0;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
};

// BMI 카테고리 반환
export const getBMICategory = (bmi: number): string => {
  if (bmi <= 0) return '';
  if (bmi < 18.5) return '저체중';
  if (bmi < 23) return '정상';
  if (bmi < 25) return '과체중';
  if (bmi < 30) return '비만';
  return '고도비만';
};

interface BodyCompositionState {
  records: BodyCompositionRecord[];
  defaultHeight: number | null; // cm, 사용자 기본 키

  // Actions
  addRecord: (record: Omit<BodyCompositionRecord, 'id' | 'createdAt'>) => void;
  updateRecord: (id: string, updates: Partial<Omit<BodyCompositionRecord, 'id' | 'createdAt'>>) => void;
  deleteRecord: (id: string) => void;
  setDefaultHeight: (height: number) => void;

  // Getters
  getRecords: () => BodyCompositionRecord[];
  getLatest: () => BodyCompositionRecord | null;
  getPrevious: () => BodyCompositionRecord | null;
  getRecordById: (id: string) => BodyCompositionRecord | undefined;
  getBMI: (record?: BodyCompositionRecord) => number;
}

const generateId = () => `bc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const useBodyCompositionStore = create<BodyCompositionState>()(
  persist(
    (set, get) => ({
      records: [],
      defaultHeight: null,

      addRecord: (recordData) => {
        const { records, defaultHeight } = get();
        const newRecord: BodyCompositionRecord = {
          ...recordData,
          id: generateId(),
          height: recordData.height || defaultHeight || undefined,
          createdAt: new Date().toISOString(),
        };

        // 날짜 기준 내림차순 정렬 (최신순)
        const newRecords = [newRecord, ...records].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        set({ records: newRecords });

        // height가 설정되면 defaultHeight 업데이트
        if (recordData.height && recordData.height !== defaultHeight) {
          set({ defaultHeight: recordData.height });
        }
      },

      updateRecord: (id, updates) => {
        const { records } = get();
        const updatedRecords = records.map((r) =>
          r.id === id ? { ...r, ...updates } : r
        );
        set({ records: updatedRecords });
      },

      deleteRecord: (id) => {
        const { records } = get();
        set({ records: records.filter((r) => r.id !== id) });
      },

      setDefaultHeight: (height) => {
        set({ defaultHeight: height });
      },

      getRecords: () => {
        const { records } = get();
        return records;
      },

      getLatest: () => {
        const { records } = get();
        if (records.length === 0) return null;
        return records[0]; // 이미 날짜순 정렬됨
      },

      getPrevious: () => {
        const { records } = get();
        if (records.length < 2) return null;
        return records[1];
      },

      getRecordById: (id) => {
        const { records } = get();
        return records.find((r) => r.id === id);
      },

      getBMI: (record) => {
        const { defaultHeight } = get();
        const targetRecord = record || get().getLatest();
        if (!targetRecord?.weight) return 0;
        const height = targetRecord.height || defaultHeight;
        if (!height) return 0;
        return calculateBMI(targetRecord.weight, height);
      },
    }),
    {
      name: 'body-composition-storage',
      storage: createJSONStorage(() => getStorage()),
      partialize: (state) => ({
        records: state.records,
        defaultHeight: state.defaultHeight,
      }),
    }
  )
);
