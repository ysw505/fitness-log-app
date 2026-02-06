import { useState, useMemo } from 'react';
import { StyleSheet, FlatList, Pressable, Alert, Platform, View as RNView, ScrollView } from 'react-native';
import { router } from 'expo-router';

import { Text, useThemeColors } from '@/components/Themed';
import { useHistoryStore, CompletedWorkout, PersonalRecord, WorkoutSetWithProfile } from '@/stores/historyStore';
import { EXERCISE_CATEGORIES } from '@/stores/exerciseStore';
import { useProfileStore } from '@/stores/profileStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import WorkoutCalendar from '@/components/WorkoutCalendar';
import { ProfileSwitcher } from '@/components/ProfileSwitcher';

type TabType = 'calendar' | 'records' | 'stats';

export default function HistoryScreen() {
  const colors = useThemeColors();
  const {
    completedWorkouts,
    deleteWorkout,
    getWeeklyStats,
    getAllPersonalRecords,
    getWorkoutStreak,
    getTotalWorkoutCount,
    getLastWeekStats,
    getWeeklyVolumeTrend,
    getMonthlyWorkoutDays,
    getWeeklyCategorySets,
  } = useHistoryStore();

  const [activeTab, setActiveTab] = useState<TabType>('calendar');

  const { profiles, currentProfileId } = useProfileStore();
  const currentProfile = profiles.find((p) => p.id === currentProfileId);

  const { activeSession, startWorkoutFromTemplate } = useWorkoutStore();

  // 다시하기 기능
  const handleRepeatWorkout = async (workout: CompletedWorkout) => {
    if (activeSession) {
      if (Platform.OS === 'web') {
        alert('진행 중인 운동이 있습니다. 먼저 완료해주세요.');
      } else {
        Alert.alert('알림', '진행 중인 운동이 있습니다. 먼저 완료해주세요.');
      }
      return;
    }

    await startWorkoutFromTemplate(workout);
    router.push('/workout/active');
  };

  const weeklyStats = getWeeklyStats();
  const lastWeekStats = getLastWeekStats();
  const personalRecords = getAllPersonalRecords();
  const streak = getWorkoutStreak();
  const totalWorkouts = getTotalWorkoutCount();
  const volumeTrend = getWeeklyVolumeTrend();
  const monthlyDays = getMonthlyWorkoutDays();
  const weeklyCategorySets = getWeeklyCategorySets();

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
    borderBg: { backgroundColor: colors.border },
  }), [colors]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return '오늘';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return '어제';
    } else {
      return date.toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric',
        weekday: 'short',
      });
    }
  };

  const getCategoryName = (categoryId: string) => {
    const category = EXERCISE_CATEGORIES.find((c) => c.id === categoryId);
    return category?.name || categoryId;
  };

  // 볼륨 포맷팅 (0k 문제 해결)
  const formatVolume = (volume: number) => {
    if (volume === 0) return '-';
    if (volume < 1000) return `${Math.round(volume)}kg`;
    if (volume < 10000) return `${(volume / 1000).toFixed(1)}k kg`;
    return `${Math.round(volume / 1000)}k kg`;
  };

  const handleDeleteWorkout = (workout: CompletedWorkout) => {
    if (Platform.OS === 'web') {
      if (confirm('이 운동 기록을 삭제하시겠습니까?')) {
        deleteWorkout(workout.id);
      }
    } else {
      Alert.alert(
        '운동 기록 삭제',
        '이 운동 기록을 삭제하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '삭제',
            style: 'destructive',
            onPress: () => deleteWorkout(workout.id),
          },
        ]
      );
    }
  };

  // 탭 버튼들
  const TabButtons = () => (
    <RNView style={styles.tabHeader}>
      {/* 프로필 스위처 */}
      {profiles.length > 1 && (
        <RNView style={styles.profileSwitcherContainer}>
          <ProfileSwitcher />
        </RNView>
      )}

      <RNView style={styles.tabContainer}>
        {[
          { id: 'calendar' as TabType, label: '기록' },
          { id: 'records' as TabType, label: 'PR' },
          { id: 'stats' as TabType, label: '통계' },
        ].map((tab) => (
          <Pressable
            key={tab.id}
            style={[
              styles.tabButton,
              activeTab === tab.id ? dynamicStyles.primaryBg : dynamicStyles.cardSecondary,
            ]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === tab.id ? { color: '#fff' } : dynamicStyles.textSecondary,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </RNView>
    </RNView>
  );

  // 운동에서 프로필별 통계 계산
  const getProfileStatsInWorkout = (workout: CompletedWorkout) => {
    const profileStats: Record<string, { sets: number; volume: number; name: string }> = {};

    workout.exercises.forEach((exercise) => {
      exercise.sets.forEach((set) => {
        const profileId = set.profile_id || 'unknown';
        const profileName = set.profile_name || '알 수 없음';

        if (!profileStats[profileId]) {
          profileStats[profileId] = { sets: 0, volume: 0, name: profileName };
        }

        profileStats[profileId].sets++;
        profileStats[profileId].volume += (set.weight || 0) * (set.reps || 0);
      });
    });

    return profileStats;
  };

  // 운동 카드
  const renderWorkoutItem = ({ item }: { item: CompletedWorkout }) => {
    const categories = [...new Set(item.exercises.map((e) => e.category))];
    const isMultiProfile = item.profile_ids && item.profile_ids.length > 1;
    const profileStats = isMultiProfile ? getProfileStatsInWorkout(item) : null;

    return (
      <Pressable
        style={[styles.workoutCard, dynamicStyles.card]}
        onPress={() => router.push(`/workout/${item.id}`)}
        onLongPress={() => handleDeleteWorkout(item)}
      >
        <RNView style={styles.workoutHeader}>
          <RNView style={styles.headerLeft}>
            <Text style={[styles.workoutDate, dynamicStyles.primary]}>{formatDate(item.started_at)}</Text>
            <Text style={[styles.workoutDuration, dynamicStyles.textTertiary]}>{item.duration_minutes}분</Text>
          </RNView>
          <Text style={[styles.workoutVolume, dynamicStyles.text]}>
            {item.total_volume.toLocaleString()}kg
          </Text>
        </RNView>

        <Text style={[styles.workoutName, dynamicStyles.text]}>{item.name}</Text>

        {/* 멀티 프로필 운동인 경우 프로필별 통계 표시 */}
        {isMultiProfile && profileStats && (
          <RNView style={styles.profileStatsRow}>
            {Object.entries(profileStats).map(([profileId, stats]) => (
              <RNView key={profileId} style={[styles.profileStatBadge, dynamicStyles.cardSecondary]}>
                <Text style={[styles.profileStatName, dynamicStyles.text]}>{stats.name}</Text>
                <Text style={[styles.profileStatValue, dynamicStyles.textSecondary]}>
                  {stats.sets}세트 · {stats.volume.toLocaleString()}kg
                </Text>
              </RNView>
            ))}
          </RNView>
        )}

        <RNView style={styles.categoryTags}>
          {categories.slice(0, 3).map((cat) => (
            <RNView key={cat} style={[styles.categoryTag, dynamicStyles.primaryLightBg]}>
              <Text style={[styles.categoryTagText, dynamicStyles.primary]}>{getCategoryName(cat)}</Text>
            </RNView>
          ))}
        </RNView>

        <Text style={[styles.exerciseCount, dynamicStyles.textSecondary]}>
          {item.exercises.length}개 운동 · {item.total_sets}세트
        </Text>
      </Pressable>
    );
  };

  // PR 카드
  const renderPRItem = ({ item }: { item: PersonalRecord }) => (
    <RNView style={[styles.prCard, dynamicStyles.card]}>
      <RNView style={styles.prHeader}>
        <Text style={[styles.prExercise, dynamicStyles.text]}>
          {item.exercise_name_ko || item.exercise_name}
        </Text>
        <Text style={[styles.prBadge, { color: colors.primary }]}>PR</Text>
      </RNView>
      <RNView style={styles.prStats}>
        <RNView style={styles.prStatItem}>
          <Text style={[styles.prValue, dynamicStyles.primary]}>{item.max_weight}</Text>
          <Text style={[styles.prLabel, dynamicStyles.textSecondary]}>kg</Text>
        </RNView>
        <Text style={[styles.prX, dynamicStyles.textTertiary]}>×</Text>
        <RNView style={styles.prStatItem}>
          <Text style={[styles.prValue, dynamicStyles.primary]}>{item.max_reps_at_weight}</Text>
          <Text style={[styles.prLabel, dynamicStyles.textSecondary]}>회</Text>
        </RNView>
        <RNView style={[styles.prDivider, dynamicStyles.borderBg]} />
        <RNView style={styles.prStatItem}>
          <Text style={[styles.pr1rm, dynamicStyles.text]}>{item.estimated_1rm}</Text>
          <Text style={[styles.prLabel, dynamicStyles.textSecondary]}>예상 1RM</Text>
        </RNView>
      </RNView>
      <Text style={[styles.prDate, dynamicStyles.textTertiary]}>
        {new Date(item.achieved_at).toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
        에 달성
      </Text>
    </RNView>
  );

  // 달력 탭
  const CalendarTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <RNView style={styles.calendarContainer}>
        <WorkoutCalendar />
      </RNView>

      {/* 최근 운동 목록 */}
      <RNView style={styles.recentSection}>
        <Text style={[styles.sectionTitle, dynamicStyles.text]}>최근 운동</Text>
        {completedWorkouts.slice(0, 10).map((workout) => {
          const isMultiProfile = workout.profile_ids && workout.profile_ids.length > 1;
          const profileStats = isMultiProfile ? getProfileStatsInWorkout(workout) : null;

          return (
            <Pressable
              key={workout.id}
              style={[styles.workoutCard, dynamicStyles.card]}
              onPress={() => router.push(`/workout/${workout.id}`)}
              onLongPress={() => handleDeleteWorkout(workout)}
            >
              <RNView style={styles.workoutHeader}>
                <RNView style={styles.headerLeft}>
                  <Text style={[styles.workoutDate, dynamicStyles.primary]}>{formatDate(workout.started_at)}</Text>
                  <Text style={[styles.workoutDuration, dynamicStyles.textTertiary]}>{workout.duration_minutes}분</Text>
                </RNView>
                <Text style={[styles.workoutVolume, dynamicStyles.text]}>
                  {workout.total_volume.toLocaleString()}kg
                </Text>
              </RNView>
              <Text style={[styles.workoutName, dynamicStyles.text]}>{workout.name}</Text>

              {/* 멀티 프로필 운동인 경우 프로필별 통계 표시 */}
              {isMultiProfile && profileStats && (
                <RNView style={styles.profileStatsRow}>
                  {Object.entries(profileStats).map(([profileId, stats]) => (
                    <RNView key={profileId} style={[styles.profileStatBadge, dynamicStyles.cardSecondary]}>
                      <Text style={[styles.profileStatName, dynamicStyles.text]}>{stats.name}</Text>
                      <Text style={[styles.profileStatValue, dynamicStyles.textSecondary]}>
                        {stats.sets}세트 · {stats.volume.toLocaleString()}kg
                      </Text>
                    </RNView>
                  ))}
                </RNView>
              )}

              <RNView style={styles.workoutCardFooter}>
                <Text style={[styles.exerciseCount, dynamicStyles.textSecondary]}>
                  {workout.exercises.length}개 운동 · {workout.total_sets}세트
                </Text>
                <Pressable
                  style={[styles.repeatButton, dynamicStyles.primaryLightBg]}
                  onPress={() => handleRepeatWorkout(workout)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.repeatButtonText, dynamicStyles.primary]}>다시하기</Text>
                </Pressable>
              </RNView>
            </Pressable>
          );
        })}
      </RNView>
      <RNView style={{ height: 40 }} />
    </ScrollView>
  );

  // PR 탭
  const RecordsTab = () => (
    <RNView style={styles.tabContent}>
      {personalRecords.length === 0 ? (
        <RNView style={styles.emptyState}>
          <Text style={[styles.emptyText, dynamicStyles.text]}>첫 번째 기록을 세워보세요</Text>
          <Text style={[styles.emptySubtext, dynamicStyles.textSecondary]}>
            운동을 하면 자동으로 최고 기록이 저장돼요
          </Text>
          <Pressable
            style={[styles.emptyActionButton, dynamicStyles.primaryBg]}
            onPress={() => router.push('/')}
          >
            <Text style={styles.emptyActionButtonText}>운동 시작하기</Text>
          </Pressable>
        </RNView>
      ) : (
        <FlatList
          data={personalRecords}
          renderItem={renderPRItem}
          keyExtractor={(item) => item.exercise_id}
          contentContainerStyle={styles.prList}
          showsVerticalScrollIndicator={false}
        />
      )}
    </RNView>
  );

  // 이번 주 vs 지난 주 변화량 계산
  const getChangeIndicator = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 'NEW' : '';
    const change = ((current - previous) / previous) * 100;
    if (change > 0) return `+${Math.round(change)}%`;
    if (change < 0) return `${Math.round(change)}%`;
    return '유지';
  };

  // 통계 탭
  const StatsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* 이번 주 vs 지난 주 비교 */}
      <RNView style={[styles.weekComparison, dynamicStyles.card]}>
        <Text style={[styles.sectionTitle, dynamicStyles.text]}>이번 주 vs 지난 주</Text>
        <RNView style={styles.comparisonGrid}>
          <RNView style={styles.comparisonItem}>
            <Text style={[styles.comparisonLabel, dynamicStyles.textSecondary]}>운동 횟수</Text>
            <Text style={[styles.comparisonMainValue, dynamicStyles.text]}>
              {weeklyStats.workoutCount}회
            </Text>
            <Text style={[
              styles.comparisonChange,
              weeklyStats.workoutCount >= lastWeekStats.workoutCount ? { color: '#10b981' } : { color: '#ef4444' }
            ]}>
              {getChangeIndicator(weeklyStats.workoutCount, lastWeekStats.workoutCount)}
            </Text>
          </RNView>
          <RNView style={styles.comparisonItem}>
            <Text style={[styles.comparisonLabel, dynamicStyles.textSecondary]}>총 볼륨</Text>
            <Text style={[styles.comparisonMainValue, dynamicStyles.text]}>
              {formatVolume(weeklyStats.totalVolume)}
            </Text>
            <Text style={[
              styles.comparisonChange,
              weeklyStats.totalVolume >= lastWeekStats.totalVolume ? { color: '#10b981' } : { color: '#ef4444' }
            ]}>
              {getChangeIndicator(weeklyStats.totalVolume, lastWeekStats.totalVolume)}
            </Text>
          </RNView>
          <RNView style={styles.comparisonItem}>
            <Text style={[styles.comparisonLabel, dynamicStyles.textSecondary]}>총 세트</Text>
            <Text style={[styles.comparisonMainValue, dynamicStyles.text]}>
              {weeklyStats.totalSets}세트
            </Text>
            <Text style={[
              styles.comparisonChange,
              weeklyStats.totalSets >= lastWeekStats.totalSets ? { color: '#10b981' } : { color: '#ef4444' }
            ]}>
              {getChangeIndicator(weeklyStats.totalSets, lastWeekStats.totalSets)}
            </Text>
          </RNView>
        </RNView>
      </RNView>

      {/* 4주 볼륨 추이 */}
      <RNView style={[styles.volumeTrendSection, dynamicStyles.card]}>
        <Text style={[styles.sectionTitle, dynamicStyles.text]}>4주 볼륨 추이</Text>
        <RNView style={styles.volumeChart}>
          {volumeTrend.map((week, index) => {
            const maxVolume = Math.max(...volumeTrend.map(w => w.volume), 1);
            const height = (week.volume / maxVolume) * 100;
            return (
              <RNView key={index} style={styles.volumeBarContainer}>
                <Text style={[styles.volumeValue, dynamicStyles.textSecondary]}>
                  {week.volume > 0 ? (week.volume < 1000 ? `${Math.round(week.volume)}` : `${Math.round(week.volume / 1000)}k`) : '-'}
                </Text>
                <RNView style={styles.volumeBarWrapper}>
                  <RNView
                    style={[
                      styles.volumeBar,
                      dynamicStyles.primaryBg,
                      { height: `${Math.max(height, 5)}%` },
                      index === volumeTrend.length - 1 && { opacity: 1 },
                      index < volumeTrend.length - 1 && { opacity: 0.5 },
                    ]}
                  />
                </RNView>
                <Text style={[styles.volumeLabel, dynamicStyles.textTertiary]}>{week.week}</Text>
                <Text style={[styles.volumeWorkouts, dynamicStyles.textTertiary]}>
                  {week.workouts}회
                </Text>
              </RNView>
            );
          })}
        </RNView>
      </RNView>

      {/* 이번 주 부위별 세트 수 */}
      <RNView style={[styles.categorySection, dynamicStyles.card]}>
        <Text style={[styles.sectionTitle, dynamicStyles.text]}>이번 주 부위별 세트</Text>
        {Object.keys(weeklyCategorySets).length === 0 ? (
          <Text style={[styles.noData, dynamicStyles.textSecondary]}>이번 주 첫 운동을 시작해보세요</Text>
        ) : (
          Object.entries(weeklyCategorySets)
            .sort(([, a], [, b]) => b - a)
            .map(([category, sets]) => {
              const maxSets = Math.max(...Object.values(weeklyCategorySets), 1);
              const percentage = (sets / maxSets) * 100;
              return (
                <RNView key={category} style={styles.categoryStatItem}>
                  <RNView style={styles.categoryStatHeader}>
                    <Text style={[styles.categoryStatName, dynamicStyles.text]}>
                      {getCategoryName(category)}
                    </Text>
                    <Text style={[styles.categoryStatCount, dynamicStyles.primary]}>
                      {sets}세트
                    </Text>
                  </RNView>
                  <RNView style={[styles.categoryStatBar, dynamicStyles.cardSecondary]}>
                    <RNView
                      style={[
                        styles.categoryStatFill,
                        dynamicStyles.primaryBg,
                        { width: `${percentage}%` },
                      ]}
                    />
                  </RNView>
                </RNView>
              );
            })
        )}
      </RNView>



      {/* 전체 요약 */}
      <RNView style={[styles.totalSummary, dynamicStyles.primaryBg]}>
        <Text style={styles.totalSummaryTitle}>전체 누적 기록</Text>
        <RNView style={styles.totalSummaryGrid}>
          <RNView style={styles.totalSummaryItem}>
            <Text style={styles.totalSummaryValue}>{totalWorkouts}</Text>
            <Text style={styles.totalSummaryLabel}>총 운동</Text>
          </RNView>
          <RNView style={styles.totalSummaryItem}>
            <Text style={styles.totalSummaryValue}>{monthlyDays}</Text>
            <Text style={styles.totalSummaryLabel}>이번 달 운동일</Text>
          </RNView>
          <RNView style={styles.totalSummaryItem}>
            <Text style={styles.totalSummaryValue}>{streak > 0 ? streak : '-'}</Text>
            <Text style={styles.totalSummaryLabel}>연속 일수</Text>
          </RNView>
        </RNView>
      </RNView>

      <RNView style={{ height: 40 }} />
    </ScrollView>
  );

  return (
    <RNView style={[styles.container, dynamicStyles.container]}>
      <TabButtons />

      {activeTab === 'calendar' && <CalendarTab />}
      {activeTab === 'records' && <RecordsTab />}
      {activeTab === 'stats' && <StatsTab />}
    </RNView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabHeader: {
    padding: 16,
    paddingBottom: 8,
  },
  profileSwitcherContainer: {
    marginBottom: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },

  // Calendar Tab
  calendarContainer: {
    padding: 16,
    paddingTop: 8,
  },
  recentSection: {
    padding: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },

  // Workout Card
  workoutCard: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workoutDate: {
    fontSize: 13,
    fontWeight: '600',
  },
  workoutDuration: {
    fontSize: 12,
  },
  workoutVolume: {
    fontSize: 14,
    fontWeight: '600',
  },
  workoutName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  categoryTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  categoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryTagText: {
    fontSize: 11,
    fontWeight: '500',
  },
  exerciseCount: {
    fontSize: 13,
  },
  workoutCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  repeatButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  repeatButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Profile Stats in workout card
  profileStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 8,
  },
  profileStatBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  profileStatName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  profileStatValue: {
    fontSize: 11,
  },

  // PR Tab
  prList: {
    padding: 16,
    paddingTop: 8,
  },
  prCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  prHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  prExercise: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  prBadge: {
    fontSize: 20,
  },
  prStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  prStatItem: {
    alignItems: 'center',
  },
  prValue: {
    fontSize: 22,
    fontWeight: '600',
  },
  prLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  prX: {
    fontSize: 16,
    marginHorizontal: 8,
  },
  prDivider: {
    width: 1,
    height: 30,
    marginHorizontal: 16,
  },
  pr1rm: {
    fontSize: 20,
    fontWeight: '600',
  },
  prDate: {
    fontSize: 12,
  },

  // Stats Tab - Week Comparison
  weekComparison: {
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
  },
  comparisonGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  comparisonItem: {
    flex: 1,
    alignItems: 'center',
  },
  comparisonLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  comparisonMainValue: {
    fontSize: 17,
    fontWeight: '600',
  },
  comparisonChange: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },

  // Volume Trend
  volumeTrendSection: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
  },
  volumeChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 140,
    marginTop: 8,
  },
  volumeBarContainer: {
    flex: 1,
    alignItems: 'center',
  },
  volumeValue: {
    fontSize: 10,
    marginBottom: 4,
  },
  volumeBarWrapper: {
    flex: 1,
    width: '60%',
    justifyContent: 'flex-end',
  },
  volumeBar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  volumeLabel: {
    fontSize: 10,
    marginTop: 4,
  },
  volumeWorkouts: {
    fontSize: 9,
  },

  // Category Section
  categorySection: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
  },

  // Total Summary
  totalSummary: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 20,
    borderRadius: 16,
  },
  totalSummaryTitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 16,
    textAlign: 'center',
  },
  totalSummaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  totalSummaryItem: {
    alignItems: 'center',
  },
  totalSummaryValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  totalSummaryLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    marginTop: 4,
  },
  categoryStatItem: {
    marginBottom: 12,
  },
  categoryStatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  categoryStatName: {
    fontSize: 14,
    fontWeight: '500',
  },
  categoryStatCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryStatBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  categoryStatFill: {
    height: '100%',
    borderRadius: 4,
  },
  noData: {
    textAlign: 'center',
    marginTop: 20,
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyActionButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyActionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
