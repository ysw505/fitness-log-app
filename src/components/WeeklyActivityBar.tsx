import { useMemo } from 'react';
import { StyleSheet, Pressable, View as RNView } from 'react-native';
import { router } from 'expo-router';

import { Text, useThemeColors } from '@/components/Themed';
import { useHistoryStore, CompletedWorkout } from '@/stores/historyStore';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function WeeklyActivityBar() {
  const colors = useThemeColors();
  const { completedWorkouts, getWorkoutStreak } = useHistoryStore();

  const streak = getWorkoutStreak();

  const dynamicStyles = useMemo(() => ({
    container: { backgroundColor: colors.card },
    text: { color: colors.text },
    textSecondary: { color: colors.textSecondary },
    primary: { color: colors.primary },
    primaryBg: { backgroundColor: colors.primary },
  }), [colors]);

  // 이번 주 날짜들 계산 (일요일 시작)
  const weekDays = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = 일요일

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - currentDay + i);
      days.push(date);
    }
    return days;
  }, []);

  // 운동 날짜 맵
  const workoutDateMap = useMemo(() => {
    const map = new Map<string, CompletedWorkout[]>();

    completedWorkouts.forEach((workout) => {
      const date = new Date(workout.finished_at);
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(workout);
    });

    return map;
  }, [completedWorkouts]);

  const getWorkoutsForDate = (date: Date): CompletedWorkout[] => {
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    return workoutDateMap.get(dateKey) || [];
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const handleDayPress = (date: Date) => {
    const workouts = getWorkoutsForDate(date);
    if (workouts.length === 1) {
      router.push(`/workout/${workouts[0].id}`);
    } else if (workouts.length > 1) {
      // 여러 개면 기록 탭으로
      router.push('/(tabs)/history');
    }
  };

  return (
    <RNView style={[styles.container, dynamicStyles.container]}>
      <RNView style={styles.header}>
        <Text style={[styles.title, dynamicStyles.text]}>이번 주</Text>
        {streak > 0 && (
          <RNView style={styles.streakBadge}>
            <Text style={styles.streakText}>🔥 {streak}일 연속</Text>
          </RNView>
        )}
      </RNView>

      <RNView style={styles.weekRow}>
        {weekDays.map((date, index) => {
          const workouts = getWorkoutsForDate(date);
          const hasWorkout = workouts.length > 0;
          const todayCheck = isToday(date);

          return (
            <Pressable
              key={index}
              style={styles.dayItem}
              onPress={() => handleDayPress(date)}
              disabled={!hasWorkout}
            >
              <Text
                style={[
                  styles.dayLabel,
                  index === 0 ? { color: '#ef4444' } : dynamicStyles.textSecondary,
                  index === 6 ? { color: '#3b82f6' } : null,
                ]}
              >
                {WEEKDAYS[index]}
              </Text>
              <RNView
                style={[
                  styles.dayCircle,
                  todayCheck && !hasWorkout && [styles.todayCircle, { borderColor: colors.primary }],
                  hasWorkout && [styles.workoutCircle, dynamicStyles.primaryBg],
                ]}
              >
                <Text
                  style={[
                    styles.dayNumber,
                    hasWorkout ? { color: '#fff' } : dynamicStyles.text,
                    todayCheck && !hasWorkout && dynamicStyles.primary,
                  ]}
                >
                  {date.getDate()}
                </Text>
              </RNView>
              {hasWorkout && workouts.length > 1 && (
                <Text style={[styles.workoutCount, dynamicStyles.primary]}>
                  {workouts.length}
                </Text>
              )}
            </Pressable>
          );
        })}
      </RNView>

      <Pressable
        style={styles.viewAllButton}
        onPress={() => router.push('/(tabs)/history')}
      >
        <Text style={[styles.viewAllText, dynamicStyles.primary]}>전체 기록 보기 →</Text>
      </Pressable>
    </RNView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  streakBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  streakText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayItem: {
    alignItems: 'center',
    flex: 1,
  },
  dayLabel: {
    fontSize: 11,
    marginBottom: 6,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCircle: {
    borderWidth: 2,
  },
  workoutCircle: {
    // backgroundColor set dynamically
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '500',
  },
  workoutCount: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  viewAllButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
