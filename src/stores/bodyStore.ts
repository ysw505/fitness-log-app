import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Platform } from 'react-native';

// 웹/네이티브 호환 스토리지
const getStorage = () => {
  if (Platform.OS === 'web') {
    return {
      getItem: (name: string) => {
        const item = localStorage.getItem(name);
        return item ? JSON.parse(item) : null;
      },
      setItem: (name: string, value: any) => {
        localStorage.setItem(name, JSON.stringify(value));
      },
      removeItem: (name: string) => {
        localStorage.removeItem(name);
      },
    };
  }
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  return AsyncStorage;
};

// 신체 기록 타입
export interface BodyRecord {
  id: string;
  date: string; // ISO string
  weight?: number; // kg
  bodyFat?: number; // %
  muscleMass?: number; // kg
  note?: string;
}

interface BodyState {
  records: BodyRecord[];

  // 기록 추가
  addRecord: (record: Omit<BodyRecord, 'id'>) => void;

  // 기록 삭제
  deleteRecord: (id: string) => void;

  // 기록 수정
  updateRecord: (id: string, updates: Partial<BodyRecord>) => void;

  // 최근 기록 가져오기
  getLatestRecord: () => BodyRecord | null;

  // 특정 기간 기록 가져오기
  getRecordsByDateRange: (startDate: Date, endDate: Date) => BodyRecord[];

  // 체중 변화 계산
  getWeightChange: (days: number) => { change: number; percent: number } | null;
}

export const useBodyStore = create<BodyState>()(
  persist(
    (set, get) => ({
      records: [],

      addRecord: (record) => {
        const newRecord: BodyRecord = {
          id: `body_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...record,
        };

        set((state) => ({
          records: [newRecord, ...state.records].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          ),
        }));
      },

      deleteRecord: (id) => {
        set((state) => ({
          records: state.records.filter((r) => r.id !== id),
        }));
      },

      updateRecord: (id, updates) => {
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        }));
      },

      getLatestRecord: () => {
        const { records } = get();
        return records.length > 0 ? records[0] : null;
      },

      getRecordsByDateRange: (startDate, endDate) => {
        const { records } = get();
        return records.filter((r) => {
          const date = new Date(r.date);
          return date >= startDate && date <= endDate;
        });
      },

      getWeightChange: (days) => {
        const { records } = get();
        if (records.length < 2) return null;

        const latestWithWeight = records.find((r) => r.weight !== undefined);
        if (!latestWithWeight) return null;

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        // 기준일 이전의 가장 최근 기록 찾기
        const olderRecord = records.find(
          (r) => r.weight !== undefined && new Date(r.date) <= cutoffDate
        );

        if (!olderRecord || olderRecord.weight === undefined || latestWithWeight.weight === undefined) {
          return null;
        }

        const change = latestWithWeight.weight - olderRecord.weight;
        const percent = (change / olderRecord.weight) * 100;

        return { change: Math.round(change * 10) / 10, percent: Math.round(percent * 10) / 10 };
      },
    }),
    {
      name: 'body-storage',
      storage: createJSONStorage(() => getStorage()),
    }
  )
);
