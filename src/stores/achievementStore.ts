import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// 스토리지 선택
const getStorage = () => {
  if (Platform.OS === 'web') {
    return localStorage;
  }
  return AsyncStorage;
};

// 배지 정의
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: number; // 달성 조건 값
  type: 'workout_count' | 'streak' | 'volume' | 'pr_count' | 'exercise_variety';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
}

// 사용자가 획득한 배지
export interface EarnedBadge {
  badgeId: string;
  earnedAt: string;
  value: number; // 달성 시점의 값
}

// 배지 목록
export const BADGES: Badge[] = [
  // 운동 횟수 배지
  { id: 'workout_10', name: '운동 입문', description: '10회 운동 완료', icon: '🏃', requirement: 10, type: 'workout_count', tier: 'bronze' },
  { id: 'workout_50', name: '운동 습관', description: '50회 운동 완료', icon: '💪', requirement: 50, type: 'workout_count', tier: 'silver' },
  { id: 'workout_100', name: '운동 마스터', description: '100회 운동 완료', icon: '🏆', requirement: 100, type: 'workout_count', tier: 'gold' },
  { id: 'workout_365', name: '운동 챔피언', description: '365회 운동 완료', icon: '👑', requirement: 365, type: 'workout_count', tier: 'platinum' },

  // 연속 운동 배지
  { id: 'streak_3', name: '3일 연속', description: '3일 연속 운동', icon: '🔥', requirement: 3, type: 'streak', tier: 'bronze' },
  { id: 'streak_7', name: '1주 연속', description: '7일 연속 운동', icon: '🔥', requirement: 7, type: 'streak', tier: 'silver' },
  { id: 'streak_30', name: '1달 연속', description: '30일 연속 운동', icon: '🔥', requirement: 30, type: 'streak', tier: 'gold' },
  { id: 'streak_100', name: '100일 연속', description: '100일 연속 운동', icon: '🔥', requirement: 100, type: 'streak', tier: 'platinum' },

  // 총 볼륨 배지
  { id: 'volume_10k', name: '10톤 클럽', description: '총 10,000kg 들어올림', icon: '🏋️', requirement: 10000, type: 'volume', tier: 'bronze' },
  { id: 'volume_100k', name: '100톤 클럽', description: '총 100,000kg 들어올림', icon: '🏋️', requirement: 100000, type: 'volume', tier: 'silver' },
  { id: 'volume_1m', name: '1000톤 클럽', description: '총 1,000,000kg 들어올림', icon: '🏋️', requirement: 1000000, type: 'volume', tier: 'gold' },

  // PR 배지
  { id: 'pr_5', name: 'PR 헌터', description: '5개 운동 PR 달성', icon: '⭐', requirement: 5, type: 'pr_count', tier: 'bronze' },
  { id: 'pr_20', name: 'PR 컬렉터', description: '20개 운동 PR 달성', icon: '⭐', requirement: 20, type: 'pr_count', tier: 'silver' },
  { id: 'pr_50', name: 'PR 마스터', description: '50개 운동 PR 달성', icon: '⭐', requirement: 50, type: 'pr_count', tier: 'gold' },

  // 운동 다양성 배지
  { id: 'variety_10', name: '다재다능', description: '10종류 운동 수행', icon: '🎯', requirement: 10, type: 'exercise_variety', tier: 'bronze' },
  { id: 'variety_30', name: '올라운더', description: '30종류 운동 수행', icon: '🎯', requirement: 30, type: 'exercise_variety', tier: 'silver' },
  { id: 'variety_50', name: '운동 백과사전', description: '50종류 운동 수행', icon: '🎯', requirement: 50, type: 'exercise_variety', tier: 'gold' },
];

// 동기부여 메시지
export const MOTIVATION_MESSAGES = {
  workout_complete: [
    '오늘도 수고했어요! 💪',
    '한 걸음 더 성장했어요!',
    '꾸준함이 실력이 됩니다!',
    '오늘의 노력이 내일의 나를 만듭니다!',
    '훌륭해요! 계속 이렇게!',
  ],
  new_pr: [
    '새로운 기록 달성! 🎉',
    'PR 갱신! 대단해요!',
    '한계를 넘었어요!',
    '새로운 자신을 만나세요!',
  ],
  streak_continue: [
    '연속 운동 유지 중! 🔥',
    '꾸준함의 힘을 보여주세요!',
    '멈추지 마세요!',
  ],
  comeback: [
    '다시 돌아왔군요! 환영해요!',
    '새로운 시작이에요!',
    '오늘부터 다시 시작!',
  ],
};

interface AchievementState {
  // 스트릭 관련
  currentStreak: number;
  longestStreak: number;
  lastWorkoutDate: string | null;

  // 통계
  totalWorkouts: number;
  totalVolume: number;
  uniqueExercises: Set<string> | string[]; // persist를 위해 array로 저장
  prCount: number;

  // 획득한 배지
  earnedBadges: EarnedBadge[];

  // 새로 획득한 배지 (알림용)
  newBadges: EarnedBadge[];

  // 주간 목표
  weeklyGoal: number; // 주당 운동 횟수 목표
  thisWeekWorkouts: number;
  weekStartDate: string | null;

  // 액션
  recordWorkout: (volume: number, exerciseIds: string[], isPR: boolean) => EarnedBadge[];
  updatePRCount: (count: number) => EarnedBadge[];
  setWeeklyGoal: (goal: number) => void;
  clearNewBadges: () => void;
  getMotivationMessage: (type: keyof typeof MOTIVATION_MESSAGES) => string;
  checkAndAwardBadges: () => EarnedBadge[];

  // 주간 목표 진행률
  getWeeklyProgress: () => { current: number; goal: number; percent: number };
}

// 날짜만 비교 (시간 무시)
const getDateOnly = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// 이번 주 월요일 날짜 구하기
const getWeekStartDate = (): string => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // 월요일 기준
  const monday = new Date(now.setDate(diff));
  return getDateOnly(monday);
};

export const useAchievementStore = create<AchievementState>()(
  persist(
    (set, get) => ({
      currentStreak: 0,
      longestStreak: 0,
      lastWorkoutDate: null,
      totalWorkouts: 0,
      totalVolume: 0,
      uniqueExercises: [],
      prCount: 0,
      earnedBadges: [],
      newBadges: [],
      weeklyGoal: 3, // 기본 주 3회
      thisWeekWorkouts: 0,
      weekStartDate: null,

      recordWorkout: (volume, exerciseIds, isPR) => {
        const today = getDateOnly(new Date());
        const { lastWorkoutDate, currentStreak, longestStreak, totalWorkouts, totalVolume, uniqueExercises, weekStartDate, thisWeekWorkouts, prCount } = get();

        // 스트릭 계산
        let newStreak = currentStreak;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = getDateOnly(yesterday);

        if (lastWorkoutDate === today) {
          // 오늘 이미 운동했으면 스트릭 유지
        } else if (lastWorkoutDate === yesterdayStr) {
          // 어제 운동했으면 스트릭 증가
          newStreak = currentStreak + 1;
        } else if (lastWorkoutDate === null) {
          // 첫 운동
          newStreak = 1;
        } else {
          // 하루 이상 빠졌으면 스트릭 리셋
          newStreak = 1;
        }

        // 주간 목표 체크
        const currentWeekStart = getWeekStartDate();
        let weekWorkouts = thisWeekWorkouts;
        if (weekStartDate !== currentWeekStart) {
          // 새로운 주 시작
          weekWorkouts = 1;
        } else if (lastWorkoutDate !== today) {
          // 같은 주, 새로운 날
          weekWorkouts = thisWeekWorkouts + 1;
        }

        // 유니크 운동 업데이트
        const exerciseSet = new Set(Array.isArray(uniqueExercises) ? uniqueExercises : []);
        exerciseIds.forEach(id => exerciseSet.add(id));

        // PR 카운트 업데이트
        const newPRCount = isPR ? prCount + 1 : prCount;

        set({
          currentStreak: newStreak,
          longestStreak: Math.max(newStreak, longestStreak),
          lastWorkoutDate: today,
          totalWorkouts: lastWorkoutDate === today ? totalWorkouts : totalWorkouts + 1,
          totalVolume: totalVolume + volume,
          uniqueExercises: Array.from(exerciseSet),
          weekStartDate: currentWeekStart,
          thisWeekWorkouts: weekWorkouts,
          prCount: newPRCount,
        });

        // 배지 체크
        return get().checkAndAwardBadges();
      },

      updatePRCount: (count) => {
        set({ prCount: count });
        return get().checkAndAwardBadges();
      },

      setWeeklyGoal: (goal) => {
        set({ weeklyGoal: Math.max(1, Math.min(7, goal)) });
      },

      clearNewBadges: () => {
        set({ newBadges: [] });
      },

      getMotivationMessage: (type) => {
        const messages = MOTIVATION_MESSAGES[type];
        return messages[Math.floor(Math.random() * messages.length)];
      },

      checkAndAwardBadges: () => {
        const { currentStreak, totalWorkouts, totalVolume, prCount, uniqueExercises, earnedBadges } = get();
        const earnedIds = new Set(earnedBadges.map(b => b.badgeId));
        const newlyEarned: EarnedBadge[] = [];

        const values: Record<Badge['type'], number> = {
          workout_count: totalWorkouts,
          streak: currentStreak,
          volume: totalVolume,
          pr_count: prCount,
          exercise_variety: Array.isArray(uniqueExercises) ? uniqueExercises.length : 0,
        };

        BADGES.forEach(badge => {
          if (!earnedIds.has(badge.id) && values[badge.type] >= badge.requirement) {
            const earned: EarnedBadge = {
              badgeId: badge.id,
              earnedAt: new Date().toISOString(),
              value: values[badge.type],
            };
            newlyEarned.push(earned);
          }
        });

        if (newlyEarned.length > 0) {
          set({
            earnedBadges: [...earnedBadges, ...newlyEarned],
            newBadges: newlyEarned,
          });
        }

        return newlyEarned;
      },

      getWeeklyProgress: () => {
        const { weeklyGoal, thisWeekWorkouts, weekStartDate } = get();
        const currentWeekStart = getWeekStartDate();

        // 새로운 주면 리셋
        const current = weekStartDate === currentWeekStart ? thisWeekWorkouts : 0;
        const percent = Math.min(100, Math.round((current / weeklyGoal) * 100));

        return { current, goal: weeklyGoal, percent };
      },
    }),
    {
      name: 'achievement-storage',
      storage: createJSONStorage(() => getStorage()),
      partialize: (state) => ({
        currentStreak: state.currentStreak,
        longestStreak: state.longestStreak,
        lastWorkoutDate: state.lastWorkoutDate,
        totalWorkouts: state.totalWorkouts,
        totalVolume: state.totalVolume,
        uniqueExercises: state.uniqueExercises,
        prCount: state.prCount,
        earnedBadges: state.earnedBadges,
        weeklyGoal: state.weeklyGoal,
        thisWeekWorkouts: state.thisWeekWorkouts,
        weekStartDate: state.weekStartDate,
      }),
    }
  )
);

// 헬퍼 함수
export const getBadgeById = (id: string): Badge | undefined => {
  return BADGES.find(b => b.id === id);
};

export const getBadgeTierColor = (tier: Badge['tier']): string => {
  const colors = {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
    platinum: '#E5E4E2',
  };
  return colors[tier];
};
