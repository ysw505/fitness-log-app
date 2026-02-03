import { useState, useMemo } from 'react';
import { StyleSheet, Pressable, View as RNView, Modal } from 'react-native';
import { router } from 'expo-router';

import { Text, useThemeColors } from '@/components/Themed';
import { useHistoryStore, CompletedWorkout } from '@/stores/historyStore';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function WorkoutCalendar() {
  const colors = useThemeColors();
  const { completedWorkouts } = useHistoryStore();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedWorkouts, setSelectedWorkouts] = useState<CompletedWorkout[]>([]);

  // 동적 스타일
  const dynamicStyles = useMemo(() => ({
    container: { backgroundColor: colors.card },
    text: { color: colors.text },
    textSecondary: { color: colors.textSecondary },
    primary: { color: colors.primary },
    primaryBg: { backgroundColor: colors.primary },
    primaryLight: { backgroundColor: colors.primaryLight },
    border: { borderColor: colors.border },
    modalBg: { backgroundColor: colors.background },
  }), [colors]);

  // 현재 월의 운동 날짜들을 맵으로 저장
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

  // 달력 데이터 생성
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    const lastWeek = weeks[weeks.length - 1];
    while (lastWeek.length < 7) {
      lastWeek.push(null);
    }

    return { weeks, year, month };
  }, [currentDate]);

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const getWorkoutsForDate = (date: Date): CompletedWorkout[] => {
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    return workoutDateMap.get(dateKey) || [];
  };

  const handleDayPress = (date: Date) => {
    const workouts = getWorkoutsForDate(date);
    if (workouts.length > 0) {
      setSelectedDate(date);
      setSelectedWorkouts(workouts);
    }
  };

  const closeModal = () => {
    setSelectedDate(null);
    setSelectedWorkouts([]);
  };

  const monthName = currentDate.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
  });

  // 운동 이름 축약
  const getShortWorkoutName = (workout: CompletedWorkout) => {
    if (workout.exercises.length === 0) return '운동';
    const firstExercise = workout.exercises[0];
    const name = firstExercise.exercise_name_ko || firstExercise.exercise_name;
    // 첫 운동 이름만 짧게
    if (name.length > 4) {
      return name.substring(0, 4);
    }
    return name;
  };

  // 카테고리별 색상
  const getCategoryColor = (category: string) => {
    const categoryColors: Record<string, string> = {
      chest: '#ef4444',
      back: '#3b82f6',
      shoulders: '#8b5cf6',
      legs: '#10b981',
      arms: '#f59e0b',
      core: '#ec4899',
    };
    return categoryColors[category] || colors.primary;
  };

  return (
    <RNView style={[styles.container, dynamicStyles.container]}>
      {/* 헤더 */}
      <RNView style={styles.header}>
        <Pressable onPress={goToPreviousMonth} style={styles.navButton}>
          <Text style={[styles.navButtonText, dynamicStyles.text]}>{'<'}</Text>
        </Pressable>
        <Text style={[styles.monthTitle, dynamicStyles.text]}>{monthName}</Text>
        <Pressable onPress={goToNextMonth} style={styles.navButton}>
          <Text style={[styles.navButtonText, dynamicStyles.text]}>{'>'}</Text>
        </Pressable>
      </RNView>

      {/* 요일 헤더 */}
      <RNView style={styles.weekdayHeader}>
        {WEEKDAYS.map((day, index) => (
          <RNView key={day} style={styles.weekdayCell}>
            <Text
              style={[
                styles.weekdayText,
                index === 0 ? { color: '#ef4444' } : dynamicStyles.textSecondary,
                index === 6 ? { color: '#3b82f6' } : null,
              ]}
            >
              {day}
            </Text>
          </RNView>
        ))}
      </RNView>

      {/* 달력 그리드 */}
      <RNView style={styles.calendarGrid}>
        {calendarData.weeks.map((week, weekIndex) => (
          <RNView key={weekIndex} style={styles.weekRow}>
            {week.map((date, dayIndex) => {
              if (!date) {
                return <RNView key={`empty-${dayIndex}`} style={styles.dayCell} />;
              }

              const workouts = getWorkoutsForDate(date);
              const hasWorkout = workouts.length > 0;
              const todayCheck = isToday(date);

              return (
                <Pressable
                  key={date.toISOString()}
                  style={styles.dayCell}
                  onPress={() => handleDayPress(date)}
                >
                  <RNView style={styles.dayContent}>
                    {/* 날짜 */}
                    <RNView
                      style={[
                        styles.dateCircle,
                        todayCheck && [styles.todayCircle, dynamicStyles.primaryBg],
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          dayIndex === 0 && !todayCheck ? { color: '#ef4444' } : null,
                          dayIndex === 6 && !todayCheck ? { color: '#3b82f6' } : null,
                          !todayCheck && dayIndex !== 0 && dayIndex !== 6 && dynamicStyles.text,
                          todayCheck && { color: '#fff' },
                        ]}
                      >
                        {date.getDate()}
                      </Text>
                    </RNView>

                    {/* 운동 태그들 */}
                    {hasWorkout && (
                      <RNView style={styles.workoutTags}>
                        {workouts.slice(0, 2).map((workout, i) => {
                          const category = workout.exercises[0]?.category || 'chest';
                          return (
                            <RNView
                              key={workout.id}
                              style={[
                                styles.workoutTag,
                                { backgroundColor: getCategoryColor(category) },
                              ]}
                            >
                              <Text style={styles.workoutTagText} numberOfLines={1}>
                                {getShortWorkoutName(workout)}
                              </Text>
                            </RNView>
                          );
                        })}
                        {workouts.length > 2 && (
                          <Text style={[styles.moreText, dynamicStyles.textSecondary]}>
                            +{workouts.length - 2}
                          </Text>
                        )}
                      </RNView>
                    )}
                  </RNView>
                </Pressable>
              );
            })}
          </RNView>
        ))}
      </RNView>

      {/* 상세 모달 */}
      <Modal
        visible={selectedDate !== null}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <Pressable style={[styles.modalContent, dynamicStyles.modalBg]} onPress={(e) => e.stopPropagation()}>
            <RNView style={styles.modalHeader}>
              <Text style={[styles.modalTitle, dynamicStyles.text]}>
                {selectedDate?.toLocaleDateString('ko-KR', {
                  month: 'long',
                  day: 'numeric',
                  weekday: 'short',
                })}
              </Text>
              <Pressable onPress={closeModal} style={styles.closeButton}>
                <Text style={[styles.closeButtonText, dynamicStyles.textSecondary]}>X</Text>
              </Pressable>
            </RNView>

            <RNView style={styles.workoutList}>
              {selectedWorkouts.map((workout) => (
                <Pressable
                  key={workout.id}
                  style={[styles.workoutItem, { borderLeftColor: getCategoryColor(workout.exercises[0]?.category || 'chest') }]}
                  onPress={() => {
                    closeModal();
                    router.push(`/workout/${workout.id}`);
                  }}
                >
                  <RNView style={styles.workoutItemHeader}>
                    <Text style={[styles.workoutName, dynamicStyles.text]}>{workout.name}</Text>
                    <Text style={[styles.workoutTime, dynamicStyles.textSecondary]}>
                      {new Date(workout.finished_at).toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </RNView>
                  <RNView style={styles.workoutDetails}>
                    <Text style={[styles.workoutDetailText, dynamicStyles.textSecondary]}>
                      {workout.exercises.length}개 운동 · {workout.total_sets}세트 · {workout.duration_minutes}분
                    </Text>
                  </RNView>
                  <RNView style={styles.exerciseList}>
                    {workout.exercises.slice(0, 3).map((exercise) => (
                      <Text key={exercise.id} style={[styles.exerciseName, dynamicStyles.textSecondary]} numberOfLines={1}>
                        • {exercise.exercise_name_ko || exercise.exercise_name}
                      </Text>
                    ))}
                    {workout.exercises.length > 3 && (
                      <Text style={[styles.exerciseName, dynamicStyles.textSecondary]}>
                        외 {workout.exercises.length - 3}개
                      </Text>
                    )}
                  </RNView>
                </Pressable>
              ))}
            </RNView>
          </Pressable>
        </Pressable>
      </Modal>
    </RNView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 12,
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
    marginBottom: 12,
  },
  navButton: {
    padding: 8,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  weekdayHeader: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: '500',
  },
  calendarGrid: {
    gap: 2,
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    minHeight: 52,
    padding: 1,
  },
  dayContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 2,
  },
  dateCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCircle: {
    // backgroundColor set dynamically
  },
  dayText: {
    fontSize: 12,
    fontWeight: '500',
  },
  workoutTags: {
    marginTop: 2,
    width: '100%',
    alignItems: 'center',
    gap: 1,
  },
  workoutTag: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    maxWidth: '95%',
  },
  workoutTagText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '600',
  },
  moreText: {
    fontSize: 8,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  workoutList: {
    gap: 12,
  },
  workoutItem: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    paddingVertical: 8,
  },
  workoutItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workoutName: {
    fontSize: 16,
    fontWeight: '600',
  },
  workoutTime: {
    fontSize: 13,
  },
  workoutDetails: {
    marginTop: 4,
  },
  workoutDetailText: {
    fontSize: 13,
  },
  exerciseList: {
    marginTop: 8,
  },
  exerciseName: {
    fontSize: 12,
    marginBottom: 2,
  },
});
