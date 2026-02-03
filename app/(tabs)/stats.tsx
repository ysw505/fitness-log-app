import { useState, useMemo } from 'react';
import { StyleSheet, ScrollView, Pressable, View as RNView } from 'react-native';

import { Text, useThemeColors } from '@/components/Themed';
import { useHistoryStore } from '@/stores/historyStore';
import { EXERCISE_CATEGORIES } from '@/stores/exerciseStore';

export default function StatsScreen() {
  const colors = useThemeColors();
  const {
    exerciseRecords,
    getMonthlyStats,
    getWeeklyStats,
    getLastWeekStats,
    getAllPersonalRecords,
    completedWorkouts,
    getWorkoutStreak,
    getCategoryStats,
    getTotalWorkoutCount,
    getAverageWorkoutDuration,
  } = useHistoryStore();

  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);

  const monthlyStats = getMonthlyStats();
  const weeklyStats = getWeeklyStats();
  const lastWeekStats = getLastWeekStats();
  const personalRecords = getAllPersonalRecords();
  const streak = getWorkoutStreak();
  const categoryStats = getCategoryStats();
  const totalWorkouts = getTotalWorkoutCount();
  const avgDuration = getAverageWorkoutDuration();

  // 동적 스타일
  const dynamicStyles = useMemo(() => ({
    container: { backgroundColor: colors.background },
    card: { backgroundColor: colors.card },
    cardSecondary: { backgroundColor: colors.cardSecondary },
    text: { color: colors.text },
    textSecondary: { color: colors.textSecondary },
    textTertiary: { color: colors.textTertiary },
    primary: { color: colors.primary },
    primaryBg: { backgroundColor: colors.primary },
    primaryLightBg: { backgroundColor: colors.primaryLight },
    border: { borderColor: colors.border },
    success: { color: colors.success },
    successBg: { backgroundColor: colors.success },
    warning: { color: colors.warning },
    warningBg: { backgroundColor: colors.warning },
    error: { color: colors.error },
  }), [colors]);

  // 운동 기록이 있는 운동 목록
  const exercisesWithRecords = useMemo(() => {
    return Object.values(exerciseRecords).filter((r) => r.records.length > 0);
  }, [exerciseRecords]);

  // 선택된 운동의 기록
  const selectedExercise = selectedExerciseId
    ? exerciseRecords[selectedExerciseId]
    : exercisesWithRecords[0];

  // 최근 7일 운동 데이터
  const last7DaysData = useMemo(() => {
    const days = [];
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();

      const workoutsOnDay = completedWorkouts.filter(
        (w) => new Date(w.finished_at).toDateString() === dateStr
      );

      const volume = workoutsOnDay.reduce((sum, w) => sum + w.total_volume, 0);
      const count = workoutsOnDay.length;

      days.push({
        label: dayNames[date.getDay()],
        volume,
        count,
        isToday: i === 0,
      });
    }

    return days;
  }, [completedWorkouts]);

  const maxVolume = Math.max(...last7DaysData.map((d) => d.volume), 1);

  // 이번주 vs 지난주 비교
  const volumeChange = lastWeekStats.totalVolume > 0
    ? Math.round(((weeklyStats.totalVolume - lastWeekStats.totalVolume) / lastWeekStats.totalVolume) * 100)
    : weeklyStats.totalVolume > 0 ? 100 : 0;

  const getCategoryName = (categoryId: string) => {
    const category = EXERCISE_CATEGORIES.find((c) => c.id === categoryId);
    return category?.name || categoryId;
  };

  // 데이터가 없을 때
  if (totalWorkouts === 0) {
    return (
      <ScrollView style={[styles.container, dynamicStyles.container]}>
        <RNView style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={[styles.emptyTitle, dynamicStyles.text]}>아직 운동 기록이 없어요</Text>
          <Text style={[styles.emptySubtitle, dynamicStyles.textSecondary]}>
            운동을 시작하면 여기서{'\n'}통계를 확인할 수 있어요
          </Text>
        </RNView>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[styles.container, dynamicStyles.container]}>
      <RNView style={styles.content}>
        {/* 요약 카드 */}
        <RNView style={styles.summaryCards}>
          {/* 스트릭 */}
          <RNView style={[styles.summaryCard, dynamicStyles.card]}>
            <Text style={styles.summaryIcon}>🔥</Text>
            <Text style={[styles.summaryValue, dynamicStyles.text]}>{streak}</Text>
            <Text style={[styles.summaryLabel, dynamicStyles.textSecondary]}>연속 일</Text>
          </RNView>

          {/* 이번 주 운동 */}
          <RNView style={[styles.summaryCard, dynamicStyles.card]}>
            <Text style={styles.summaryIcon}>💪</Text>
            <Text style={[styles.summaryValue, dynamicStyles.text]}>{weeklyStats.workoutCount}</Text>
            <Text style={[styles.summaryLabel, dynamicStyles.textSecondary]}>이번 주</Text>
          </RNView>

          {/* 전체 운동 */}
          <RNView style={[styles.summaryCard, dynamicStyles.card]}>
            <Text style={styles.summaryIcon}>🏆</Text>
            <Text style={[styles.summaryValue, dynamicStyles.text]}>{totalWorkouts}</Text>
            <Text style={[styles.summaryLabel, dynamicStyles.textSecondary]}>전체</Text>
          </RNView>

          {/* 평균 시간 */}
          <RNView style={[styles.summaryCard, dynamicStyles.card]}>
            <Text style={styles.summaryIcon}>⏱️</Text>
            <Text style={[styles.summaryValue, dynamicStyles.text]}>{avgDuration}</Text>
            <Text style={[styles.summaryLabel, dynamicStyles.textSecondary]}>평균(분)</Text>
          </RNView>
        </RNView>

        {/* 주간 운동 현황 */}
        <RNView style={styles.section}>
          <RNView style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, dynamicStyles.text]}>주간 운동 현황</Text>
            {volumeChange !== 0 && (
              <RNView style={[
                styles.changeBadge,
                volumeChange > 0 ? { backgroundColor: colors.success + '20' } : { backgroundColor: colors.error + '20' }
              ]}>
                <Text style={[
                  styles.changeBadgeText,
                  volumeChange > 0 ? dynamicStyles.success : dynamicStyles.error
                ]}>
                  {volumeChange > 0 ? '↑' : '↓'} {Math.abs(volumeChange)}%
                </Text>
              </RNView>
            )}
          </RNView>

          <RNView style={[styles.weeklyChart, dynamicStyles.card]}>
            <RNView style={styles.chartBars}>
              {last7DaysData.map((day, index) => (
                <RNView key={index} style={styles.barColumn}>
                  <Text style={[styles.barValue, dynamicStyles.textSecondary]}>
                    {day.volume > 0 ? (day.volume >= 1000 ? `${Math.round(day.volume / 1000)}k` : day.volume) : ''}
                  </Text>
                  <RNView style={[styles.barWrapper, dynamicStyles.cardSecondary]}>
                    <RNView
                      style={[
                        styles.bar,
                        {
                          height: maxVolume > 0 ? `${(day.volume / maxVolume) * 100}%` : 0,
                          backgroundColor: day.isToday ? colors.primary : colors.success,
                        },
                      ]}
                    />
                  </RNView>
                  <Text style={[
                    styles.barLabel,
                    day.isToday ? dynamicStyles.primary : dynamicStyles.textTertiary,
                    day.isToday && { fontWeight: '700' }
                  ]}>
                    {day.label}
                  </Text>
                  {day.count > 0 && (
                    <RNView style={[styles.workoutDot, day.isToday ? dynamicStyles.primaryBg : dynamicStyles.successBg]} />
                  )}
                </RNView>
              ))}
            </RNView>

            {/* 범례 */}
            <RNView style={[styles.chartLegend, { borderTopColor: colors.border }]}>
              <Text style={[styles.legendText, dynamicStyles.textSecondary]}>
                이번 주: {weeklyStats.workoutCount}회 운동, {(weeklyStats.totalVolume / 1000).toFixed(1)}톤 볼륨
              </Text>
            </RNView>
          </RNView>
        </RNView>

        {/* 많이 한 부위 */}
        {categoryStats.length > 0 && (
          <RNView style={styles.section}>
            <Text style={[styles.sectionTitle, dynamicStyles.text]}>많이 운동한 부위</Text>
            <RNView style={[styles.categoryList, dynamicStyles.card]}>
              {categoryStats.slice(0, 5).map((stat, index) => {
                const maxCount = categoryStats[0]?.count || 1;
                const percentage = (stat.count / maxCount) * 100;

                return (
                  <RNView key={stat.category} style={styles.categoryItem}>
                    <RNView style={styles.categoryInfo}>
                      <Text style={[styles.categoryRank, dynamicStyles.textTertiary]}>#{index + 1}</Text>
                      <Text style={[styles.categoryName, dynamicStyles.text]}>
                        {getCategoryName(stat.category)}
                      </Text>
                      <Text style={[styles.categoryCount, dynamicStyles.primary]}>{stat.count}회</Text>
                    </RNView>
                    <RNView style={[styles.categoryBarBg, dynamicStyles.cardSecondary]}>
                      <RNView
                        style={[
                          styles.categoryBar,
                          dynamicStyles.primaryBg,
                          { width: `${percentage}%` }
                        ]}
                      />
                    </RNView>
                  </RNView>
                );
              })}
            </RNView>
          </RNView>
        )}

        {/* 개인 기록 (PR) */}
        {personalRecords.length > 0 && (
          <RNView style={styles.section}>
            <Text style={[styles.sectionTitle, dynamicStyles.text]}>개인 기록 (PR) 🏆</Text>
            <RNView style={[styles.prList, dynamicStyles.card]}>
              {personalRecords.slice(0, 5).map((pr, index) => (
                <RNView
                  key={pr.exercise_id}
                  style={[
                    styles.prItem,
                    index < personalRecords.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }
                  ]}
                >
                  <RNView style={styles.prInfo}>
                    <Text style={[styles.prExercise, dynamicStyles.text]}>
                      {pr.exercise_name_ko || pr.exercise_name}
                    </Text>
                    <Text style={[styles.prDate, dynamicStyles.textTertiary]}>
                      {new Date(pr.achieved_at).toLocaleDateString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </RNView>
                  <RNView style={styles.prValues}>
                    <Text style={[styles.prWeight, dynamicStyles.warning]}>{pr.max_weight}kg</Text>
                    <Text style={[styles.prReps, dynamicStyles.textSecondary]}>× {pr.max_reps_at_weight}회</Text>
                  </RNView>
                </RNView>
              ))}
            </RNView>
          </RNView>
        )}

        {/* 운동별 진행 상황 */}
        {exercisesWithRecords.length > 0 && (
          <RNView style={styles.section}>
            <Text style={[styles.sectionTitle, dynamicStyles.text]}>운동별 진행 상황</Text>

            {/* 운동 선택 버튼들 */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.exerciseTabs}
              contentContainerStyle={styles.exerciseTabsContent}
            >
              {exercisesWithRecords.map((exercise) => {
                const isSelected = selectedExercise?.exercise_id === exercise.exercise_id;
                return (
                  <Pressable
                    key={exercise.exercise_id}
                    style={[
                      styles.exerciseTab,
                      isSelected ? dynamicStyles.primaryBg : dynamicStyles.cardSecondary,
                    ]}
                    onPress={() => setSelectedExerciseId(exercise.exercise_id)}
                  >
                    <Text
                      style={[
                        styles.exerciseTabText,
                        isSelected ? styles.exerciseTabTextSelected : dynamicStyles.textSecondary,
                      ]}
                      numberOfLines={1}
                    >
                      {exercise.exercise_name_ko || exercise.exercise_name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* 선택된 운동의 기록 */}
            {selectedExercise && selectedExercise.records.length > 0 && (
              <RNView style={[styles.exerciseDetail, dynamicStyles.card]}>
                <RNView style={styles.exerciseDetailHeader}>
                  <Text style={[styles.exerciseDetailName, dynamicStyles.text]}>
                    {selectedExercise.exercise_name_ko || selectedExercise.exercise_name}
                  </Text>
                  <RNView style={[styles.exerciseCategoryBadge, dynamicStyles.primaryLightBg]}>
                    <Text style={[styles.exerciseCategoryText, dynamicStyles.primary]}>
                      {getCategoryName(selectedExercise.category)}
                    </Text>
                  </RNView>
                </RNView>

                {/* 운동 통계 */}
                <RNView style={[styles.exerciseStats, dynamicStyles.cardSecondary]}>
                  <RNView style={styles.exerciseStat}>
                    <Text style={[styles.exerciseStatValue, dynamicStyles.text]}>
                      {selectedExercise.records[0]?.max_weight || 0}kg
                    </Text>
                    <Text style={[styles.exerciseStatLabel, dynamicStyles.textTertiary]}>최근 최대</Text>
                  </RNView>
                  <RNView style={styles.exerciseStat}>
                    <Text style={[styles.exerciseStatValue, dynamicStyles.text]}>
                      {selectedExercise.records.length}
                    </Text>
                    <Text style={[styles.exerciseStatLabel, dynamicStyles.textTertiary]}>총 세션</Text>
                  </RNView>
                  <RNView style={styles.exerciseStat}>
                    <Text style={[styles.exerciseStatValue, dynamicStyles.text]}>
                      {(selectedExercise.records.reduce((sum, r) => sum + r.total_volume, 0) / 1000).toFixed(1)}k
                    </Text>
                    <Text style={[styles.exerciseStatLabel, dynamicStyles.textTertiary]}>총 볼륨</Text>
                  </RNView>
                </RNView>

                {/* 최근 기록 목록 */}
                <RNView style={styles.recentRecords}>
                  <Text style={[styles.recentRecordsTitle, dynamicStyles.textSecondary]}>최근 기록</Text>
                  {selectedExercise.records.slice(0, 5).map((record, idx) => (
                    <RNView key={idx} style={[styles.recordItem, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.recordDate, dynamicStyles.textSecondary]}>
                        {new Date(record.date).toLocaleDateString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                      <Text style={[styles.recordWeight, dynamicStyles.text]}>
                        {record.max_weight}kg × {Math.round(record.total_reps / record.total_sets)}회
                      </Text>
                      <Text style={[styles.recordVolume, dynamicStyles.textTertiary]}>
                        {record.total_volume.toLocaleString()}kg
                      </Text>
                    </RNView>
                  ))}
                </RNView>
              </RNView>
            )}
          </RNView>
        )}

        <RNView style={{ height: 40 }} />
      </RNView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },

  // 요약 카드
  summaryCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    minWidth: '22%',
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 11,
    marginTop: 4,
  },

  // 섹션
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  changeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  changeBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // 주간 차트
  weeklyChart: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chartBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 150,
    paddingTop: 20,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
  },
  barValue: {
    fontSize: 10,
    marginBottom: 4,
    height: 14,
  },
  barWrapper: {
    width: '60%',
    height: 100,
    justifyContent: 'flex-end',
    borderRadius: 6,
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    borderRadius: 6,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 12,
    marginTop: 8,
  },
  workoutDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },
  chartLegend: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  legendText: {
    fontSize: 13,
  },

  // 카테고리
  categoryList: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryItem: {
    marginBottom: 14,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryRank: {
    fontSize: 12,
    fontWeight: '600',
    width: 24,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  categoryCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  categoryBar: {
    height: '100%',
    borderRadius: 4,
  },

  // PR
  prList: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  prItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  prInfo: {
    flex: 1,
  },
  prExercise: {
    fontSize: 15,
    fontWeight: '600',
  },
  prDate: {
    fontSize: 12,
    marginTop: 2,
  },
  prValues: {
    alignItems: 'flex-end',
  },
  prWeight: {
    fontSize: 18,
    fontWeight: '700',
  },
  prReps: {
    fontSize: 13,
    marginTop: 2,
  },

  // 운동별 진행
  exerciseTabs: {
    marginBottom: 12,
  },
  exerciseTabsContent: {
    paddingRight: 16,
    gap: 8,
  },
  exerciseTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  exerciseTabText: {
    fontSize: 14,
    maxWidth: 120,
  },
  exerciseTabTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  exerciseDetail: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  exerciseDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  exerciseDetailName: {
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
  },
  exerciseCategoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  exerciseCategoryText: {
    fontSize: 12,
    fontWeight: '500',
  },
  exerciseStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  exerciseStat: {
    alignItems: 'center',
  },
  exerciseStatValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  exerciseStatLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  recentRecords: {
    paddingTop: 8,
  },
  recentRecordsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  recordItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  recordDate: {
    fontSize: 13,
    width: 60,
  },
  recordWeight: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  recordVolume: {
    fontSize: 13,
  },
});
