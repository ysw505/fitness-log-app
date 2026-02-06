import { useState, useMemo } from 'react';
import { StyleSheet, ScrollView, Pressable, View as RNView } from 'react-native';

import { Text, useThemeColors } from '@/components/Themed';
import { useHistoryStore } from '@/stores/historyStore';
import { EXERCISE_CATEGORIES } from '@/stores/exerciseStore';

// 1RM 추정 공식 (Epley)
const calculate1RM = (weight: number, reps: number): number => {
  if (reps === 1) return weight;
  if (reps === 0 || weight === 0) return 0;
  return Math.round(weight * (1 + reps / 30));
};

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
  const [chartPeriod, setChartPeriod] = useState<'1M' | '3M' | 'ALL'>('1M');
  const [showAllRecords, setShowAllRecords] = useState(false);

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

  // 차트 데이터 계산 (기간별 필터링 + 1RM 추정)
  const chartData = useMemo(() => {
    if (!selectedExercise || selectedExercise.records.length === 0) return [];

    const now = new Date();
    let cutoffDate: Date;

    switch (chartPeriod) {
      case '1M':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3M':
        cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        cutoffDate = new Date(0); // ALL
    }

    return selectedExercise.records
      .filter((r) => new Date(r.date) >= cutoffDate)
      .map((r) => {
        const avgReps = Math.round(r.total_reps / r.total_sets) || 1;
        const estimated1RM = calculate1RM(r.max_weight, avgReps);
        return {
          date: new Date(r.date),
          maxWeight: r.max_weight,
          estimated1RM,
          volume: r.total_volume,
          label: new Date(r.date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }),
        };
      })
      .reverse(); // 오래된 순으로 정렬
  }, [selectedExercise, chartPeriod]);

  // 차트 최대/최소값
  const chartMax = chartData.length > 0 ? Math.max(...chartData.map((d) => d.estimated1RM)) : 0;
  const chartMin = chartData.length > 0 ? Math.min(...chartData.map((d) => d.estimated1RM)) : 0;
  const chartRange = chartMax - chartMin || 1;

  // 현재 1RM vs 기간 시작 대비 변화
  const progressChange = useMemo(() => {
    if (chartData.length < 2) return null;
    const first = chartData[0].estimated1RM;
    const last = chartData[chartData.length - 1].estimated1RM;
    const diff = last - first;
    const percent = first > 0 ? Math.round((diff / first) * 100) : 0;
    return { diff, percent };
  }, [chartData]);

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

  // 이번주 vs 지난주 비교
  const volumeChange = lastWeekStats.totalVolume > 0
    ? Math.round(((weeklyStats.totalVolume - lastWeekStats.totalVolume) / lastWeekStats.totalVolume) * 100)
    : weeklyStats.totalVolume > 0 ? 100 : 0;

  const getCategoryName = (categoryId: string) => {
    const category = EXERCISE_CATEGORIES.find((c) => c.id === categoryId);
    return category?.name || categoryId;
  };

  // 부위별 회복 상태 계산
  const recoveryStatus = useMemo(() => {
    const categoryLastWorkout: Record<string, Date> = {};

    // 각 부위의 마지막 운동 날짜 찾기
    completedWorkouts.forEach((workout) => {
      const workoutDate = new Date(workout.finished_at);
      workout.exercises?.forEach((exercise) => {
        const category = exercise?.category;
        if (category && (!categoryLastWorkout[category] || workoutDate > categoryLastWorkout[category])) {
          categoryLastWorkout[category] = workoutDate;
        }
      });
    });

    // 회복 상태 배열로 변환
    const now = new Date();
    const recoveryData = Object.entries(categoryLastWorkout).map(([category, lastDate]) => {
      const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      // 회복 상태: 0-1일: 회복 중(빨강), 2-3일: 적정(초록), 4+일: 오버레스트(주황)
      let status: 'recovering' | 'ready' | 'overrest' = 'ready';
      if (daysSince <= 1) status = 'recovering';
      else if (daysSince >= 4) status = 'overrest';
      return {
        category,
        categoryName: getCategoryName(category),
        daysSince,
        lastDate,
        status,
      };
    });

    // 최근 운동한 순서로 정렬
    return recoveryData.sort((a, b) => a.daysSince - b.daysSince);
  }, [completedWorkouts]);

  const getRecoveryColor = (status: 'recovering' | 'ready' | 'overrest') => {
    switch (status) {
      case 'recovering': return colors.error;
      case 'ready': return colors.success;
      case 'overrest': return colors.warning;
    }
  };

  const getRecoveryLabel = (status: 'recovering' | 'ready' | 'overrest') => {
    switch (status) {
      case 'recovering': return '회복 중';
      case 'ready': return '운동 적기';
      case 'overrest': return '쉬는 중';
    }
  };

  // 데이터가 없을 때
  if (totalWorkouts === 0) {
    return (
      <ScrollView style={[styles.container, dynamicStyles.container]}>
        <RNView style={styles.emptyState}>
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
            <Text style={[styles.summaryValue, dynamicStyles.text]}>{streak}</Text>
            <Text style={[styles.summaryLabel, dynamicStyles.textSecondary]}>연속 일</Text>
          </RNView>

          {/* 이번 주 운동 */}
          <RNView style={[styles.summaryCard, dynamicStyles.card]}>
            <Text style={[styles.summaryValue, dynamicStyles.text]}>{weeklyStats.workoutCount}</Text>
            <Text style={[styles.summaryLabel, dynamicStyles.textSecondary]}>이번 주</Text>
          </RNView>

          {/* 전체 운동 */}
          <RNView style={[styles.summaryCard, dynamicStyles.card]}>
            <Text style={[styles.summaryValue, dynamicStyles.text]}>{totalWorkouts}</Text>
            <Text style={[styles.summaryLabel, dynamicStyles.textSecondary]}>전체</Text>
          </RNView>

          {/* 평균 시간 */}
          <RNView style={[styles.summaryCard, dynamicStyles.card]}>
            <Text style={[styles.summaryValue, dynamicStyles.text]}>{avgDuration}</Text>
            <Text style={[styles.summaryLabel, dynamicStyles.textSecondary]}>평균(분)</Text>
          </RNView>
        </RNView>

        {/* 부위별 회복 상태 */}
        {recoveryStatus.length > 0 && (
          <RNView style={styles.section}>
            <Text style={[styles.sectionTitle, dynamicStyles.text]}>회복 상태</Text>
            <RNView style={[styles.recoveryGrid, dynamicStyles.card]}>
              {recoveryStatus.slice(0, 6).map((item) => (
                <RNView key={item.category} style={styles.recoveryItem}>
                  <RNView style={[styles.recoveryIndicator, { backgroundColor: getRecoveryColor(item.status) + '20' }]}>
                    <RNView style={[styles.recoveryDot, { backgroundColor: getRecoveryColor(item.status) }]} />
                  </RNView>
                  <RNView style={styles.recoveryInfo}>
                    <Text style={[styles.recoveryCategory, dynamicStyles.text]}>{item.categoryName}</Text>
                    <Text style={[styles.recoveryDays, { color: getRecoveryColor(item.status) }]}>
                      {item.daysSince === 0 ? '오늘' : `${item.daysSince}일 전`}
                    </Text>
                  </RNView>
                  <RNView style={[styles.recoveryStatusBadge, { backgroundColor: getRecoveryColor(item.status) + '15' }]}>
                    <Text style={[styles.recoveryStatusText, { color: getRecoveryColor(item.status) }]}>
                      {getRecoveryLabel(item.status)}
                    </Text>
                  </RNView>
                </RNView>
              ))}
            </RNView>
            <RNView style={[styles.recoveryLegend, dynamicStyles.cardSecondary]}>
              <RNView style={styles.recoveryLegendItem}>
                <RNView style={[styles.recoveryLegendDot, { backgroundColor: colors.error }]} />
                <Text style={[styles.recoveryLegendText, dynamicStyles.textTertiary]}>0-1일: 회복 중</Text>
              </RNView>
              <RNView style={styles.recoveryLegendItem}>
                <RNView style={[styles.recoveryLegendDot, { backgroundColor: colors.success }]} />
                <Text style={[styles.recoveryLegendText, dynamicStyles.textTertiary]}>2-3일: 운동 적기</Text>
              </RNView>
              <RNView style={styles.recoveryLegendItem}>
                <RNView style={[styles.recoveryLegendDot, { backgroundColor: colors.warning }]} />
                <Text style={[styles.recoveryLegendText, dynamicStyles.textTertiary]}>4일+: 쉬는 중</Text>
              </RNView>
            </RNView>
          </RNView>
        )}

        {/* 이번 주 운동 */}
        <RNView style={[styles.weeklyCompact, dynamicStyles.card]}>
          <RNView style={styles.weeklyCompactHeader}>
            <Text style={[styles.weeklyCompactTitle, dynamicStyles.text]}>이번 주</Text>
            <RNView style={styles.weeklyCompactStats}>
              <Text style={[styles.weeklyCompactValue, dynamicStyles.primary]}>
                {weeklyStats.workoutCount}회
              </Text>
              {weeklyStats.totalVolume > 0 && (
                <Text style={[styles.weeklyCompactVolume, dynamicStyles.textSecondary]}>
                  · {(weeklyStats.totalVolume / 1000).toFixed(1)}톤
                </Text>
              )}
            </RNView>
          </RNView>

          {/* 요일별 운동 여부 - 심플한 dot 형태 */}
          <RNView style={styles.weeklyDots}>
            {last7DaysData.map((day, index) => (
              <RNView key={index} style={styles.weeklyDotColumn}>
                <RNView
                  style={[
                    styles.weeklyDotIndicator,
                    day.count > 0
                      ? (day.isToday ? dynamicStyles.primaryBg : { backgroundColor: colors.success })
                      : dynamicStyles.cardSecondary,
                  ]}
                >
                  {day.count > 0 && <Text style={styles.weeklyDotCheck}>✓</Text>}
                </RNView>
                <Text style={[
                  styles.weeklyDotLabel,
                  day.isToday ? dynamicStyles.primary : dynamicStyles.textTertiary,
                  day.isToday && { fontWeight: '700' }
                ]}>
                  {day.label}
                </Text>
              </RNView>
            ))}
          </RNView>

          {/* 지난주 대비 변화 */}
          {volumeChange !== 0 && (
            <RNView style={[styles.weeklyCompactChange, { borderTopColor: colors.border }]}>
              <Text style={[styles.weeklyCompactChangeText, dynamicStyles.textSecondary]}>
                지난주 대비{' '}
                <Text style={volumeChange > 0 ? dynamicStyles.success : dynamicStyles.error}>
                  {volumeChange > 0 ? '↑' : '↓'} {Math.abs(volumeChange)}%
                </Text>
              </Text>
            </RNView>
          )}
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
            <Text style={[styles.sectionTitle, dynamicStyles.text]}>개인 기록</Text>
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

                {/* 1RM 추정 + 진행 차트 */}
                {chartData.length > 0 && (
                  <RNView style={styles.chartSection}>
                    {/* 현재 1RM 표시 */}
                    <RNView style={styles.current1RM}>
                      <RNView>
                        <Text style={[styles.current1RMLabel, dynamicStyles.textSecondary]}>추정 1RM</Text>
                        <Text style={[styles.current1RMValue, dynamicStyles.primary]}>
                          {chartData[chartData.length - 1]?.estimated1RM || 0}kg
                        </Text>
                      </RNView>
                      {progressChange && progressChange.diff !== 0 && (
                        <RNView style={[
                          styles.progressBadge,
                          { backgroundColor: progressChange.diff > 0 ? colors.success + '20' : colors.error + '20' }
                        ]}>
                          <Text style={[
                            styles.progressBadgeText,
                            { color: progressChange.diff > 0 ? colors.success : colors.error }
                          ]}>
                            {progressChange.diff > 0 ? '↑' : '↓'} {Math.abs(progressChange.diff)}kg ({Math.abs(progressChange.percent)}%)
                          </Text>
                        </RNView>
                      )}
                    </RNView>

                    {/* 기간 필터 */}
                    <RNView style={styles.periodFilters}>
                      {(['1M', '3M', 'ALL'] as const).map((period) => (
                        <Pressable
                          key={period}
                          style={[
                            styles.periodButton,
                            chartPeriod === period ? dynamicStyles.primaryBg : dynamicStyles.cardSecondary,
                          ]}
                          onPress={() => setChartPeriod(period)}
                        >
                          <Text style={[
                            styles.periodButtonText,
                            chartPeriod === period ? { color: '#fff' } : dynamicStyles.textSecondary,
                          ]}>
                            {period === 'ALL' ? '전체' : period.replace('M', '개월')}
                          </Text>
                        </Pressable>
                      ))}
                    </RNView>

                    {/* 라인 차트 */}
                    {chartData.length >= 2 ? (
                      <RNView style={styles.lineChart}>
                        <RNView style={styles.chartYAxis}>
                          <Text style={[styles.chartYLabel, dynamicStyles.textTertiary]}>{chartMax}</Text>
                          <Text style={[styles.chartYLabel, dynamicStyles.textTertiary]}>{chartMin}</Text>
                        </RNView>
                        <RNView style={styles.chartArea}>
                          {/* 차트 라인 (점들 연결) */}
                          <RNView style={styles.chartLine}>
                            {chartData.map((point, idx) => {
                              const x = (idx / (chartData.length - 1)) * 100;
                              const y = ((chartMax - point.estimated1RM) / chartRange) * 100;
                              return (
                                <RNView
                                  key={idx}
                                  style={[
                                    styles.chartDot,
                                    dynamicStyles.primaryBg,
                                    {
                                      left: `${x}%`,
                                      top: `${y}%`,
                                    },
                                  ]}
                                />
                              );
                            })}
                          </RNView>
                          {/* X축 라벨 */}
                          <RNView style={styles.chartXAxis}>
                            <Text style={[styles.chartXLabel, dynamicStyles.textTertiary]}>
                              {chartData[0]?.label}
                            </Text>
                            <Text style={[styles.chartXLabel, dynamicStyles.textTertiary]}>
                              {chartData[chartData.length - 1]?.label}
                            </Text>
                          </RNView>
                        </RNView>
                      </RNView>
                    ) : (
                      <RNView style={[styles.chartPlaceholder, dynamicStyles.cardSecondary]}>
                        <Text style={[styles.chartPlaceholderText, dynamicStyles.textSecondary]}>
                          기록이 2회 이상이면 차트가 표시됩니다
                        </Text>
                      </RNView>
                    )}
                  </RNView>
                )}

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

                {/* 최근 기록 목록 (Best Set 방식) */}
                <RNView style={styles.recentRecords}>
                  <Pressable
                    style={styles.recentRecordsHeader}
                    onPress={() => setShowAllRecords(!showAllRecords)}
                  >
                    <Text style={[styles.recentRecordsTitle, dynamicStyles.textSecondary]}>세션별 Best Set</Text>
                    <Text style={[styles.recentRecordsToggle, dynamicStyles.primary]}>
                      {showAllRecords ? '접기 ▲' : '더보기 ▼'}
                    </Text>
                  </Pressable>
                  {selectedExercise.records.slice(0, showAllRecords ? 10 : 3).map((record, idx) => {
                    const avgReps = Math.round(record.total_reps / record.total_sets) || 1;
                    const est1RM = calculate1RM(record.max_weight, avgReps);
                    const isPR = idx === 0 && est1RM >= chartMax;
                    return (
                      <RNView key={idx} style={[styles.recordItem, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.recordDate, dynamicStyles.textSecondary]}>
                          {new Date(record.date).toLocaleDateString('ko-KR', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                        <RNView style={styles.recordMain}>
                          <Text style={[styles.recordWeight, dynamicStyles.text]}>
                            {record.max_weight}kg × {avgReps}회
                          </Text>
                          {isPR && <Text style={[styles.prBadge, { color: colors.primary }]}>PR</Text>}
                        </RNView>
                        <Text style={[styles.record1RM, dynamicStyles.textTertiary]}>
                          1RM: {est1RM}kg
                        </Text>
                      </RNView>
                    );
                  })}
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
    fontWeight: '600',
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
    fontWeight: '600',
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

  // 이번 주 운동 (컴팩트)
  weeklyCompact: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  weeklyCompactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  weeklyCompactTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  weeklyCompactStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weeklyCompactValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  weeklyCompactVolume: {
    fontSize: 14,
    marginLeft: 4,
  },
  weeklyDots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weeklyDotColumn: {
    alignItems: 'center',
    flex: 1,
  },
  weeklyDotIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  weeklyDotCheck: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  weeklyDotLabel: {
    fontSize: 12,
  },
  weeklyCompactChange: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  weeklyCompactChangeText: {
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
    fontWeight: '600',
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

  // 차트 섹션
  chartSection: {
    marginBottom: 16,
  },
  current1RM: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  current1RMLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  current1RMValue: {
    fontSize: 28,
    fontWeight: '600',
  },
  progressBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  progressBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  periodFilters: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  periodButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  periodButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  lineChart: {
    flexDirection: 'row',
    height: 100,
    marginBottom: 8,
  },
  chartYAxis: {
    width: 35,
    justifyContent: 'space-between',
    paddingRight: 8,
  },
  chartYLabel: {
    fontSize: 10,
    textAlign: 'right',
  },
  chartArea: {
    flex: 1,
    position: 'relative',
  },
  chartLine: {
    flex: 1,
    position: 'relative',
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e5e5',
  },
  chartDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
    marginTop: -4,
  },
  chartXAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  chartXLabel: {
    fontSize: 10,
  },
  chartPlaceholder: {
    height: 80,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartPlaceholderText: {
    fontSize: 13,
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
    fontWeight: '600',
  },
  exerciseStatLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  recentRecords: {
    paddingTop: 8,
  },
  recentRecordsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recentRecordsTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  recentRecordsToggle: {
    fontSize: 13,
    fontWeight: '500',
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
    width: 55,
  },
  recordMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recordWeight: {
    fontSize: 14,
    fontWeight: '500',
  },
  prBadge: {
    fontSize: 11,
  },
  record1RM: {
    fontSize: 12,
    width: 70,
    textAlign: 'right',
  },

  // 회복 상태
  recoveryGrid: {
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  recoveryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  recoveryIndicator: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recoveryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  recoveryInfo: {
    flex: 1,
  },
  recoveryCategory: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  recoveryDays: {
    fontSize: 13,
    fontWeight: '500',
  },
  recoveryStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  recoveryStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  recoveryLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderRadius: 10,
    marginTop: 10,
    padding: 10,
  },
  recoveryLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recoveryLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recoveryLegendText: {
    fontSize: 11,
  },
});
