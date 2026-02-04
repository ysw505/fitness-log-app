import { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Pressable, ScrollView, View as RNView, Modal, Alert, Platform } from 'react-native';
import { router } from 'expo-router';

import { Text, useThemeColors } from '@/components/Themed';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useHistoryStore } from '@/stores/historyStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useProfileStore } from '@/stores/profileStore';
import { useAchievementStore, getBadgeById, getBadgeTierColor, BADGES } from '@/stores/achievementStore';
import WeeklyActivityBar from '@/components/WeeklyActivityBar';

export default function HomeScreen() {
  const colors = useThemeColors();
  const { activeSession, exercises, startWorkout, cancelWorkout } = useWorkoutStore();
  const { getWeeklyStats, getRecentWorkouts } = useHistoryStore();
  const { templates } = useTemplateStore();
  const { profiles, initLocalProfiles } = useProfileStore();
  const {
    currentStreak,
    longestStreak,
    getWeeklyProgress,
    weeklyGoal,
    setWeeklyGoal,
    earnedBadges,
    newBadges,
    clearNewBadges,
  } = useAchievementStore();

  const [isLoading, setIsLoading] = useState(false);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00:00');

  // 프로필 선택 모달 상태
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);

  // 로컬 프로필 초기화 (비로그인 시)
  useEffect(() => {
    if (profiles.length === 0) {
      initLocalProfiles();
    }
  }, []);

  // 주간 통계
  const weeklyStats = getWeeklyStats();
  const recentWorkouts = getRecentWorkouts(3);
  const weeklyProgress = getWeeklyProgress();

  // 새 배지 알림 처리
  useEffect(() => {
    if (newBadges.length > 0) {
      setShowBadgeModal(true);
    }
  }, [newBadges]);

  // 동적 스타일
  const dynamicStyles = useMemo(() => ({
    container: { backgroundColor: colors.background },
    card: { backgroundColor: colors.card },
    cardSecondary: { backgroundColor: colors.cardSecondary },
    text: { color: colors.text },
    textSecondary: { color: colors.textSecondary },
    primary: { color: colors.primary },
    primaryBg: { backgroundColor: colors.primary },
    primaryLightBg: { backgroundColor: colors.primaryLight },
    border: { borderColor: colors.border },
  }), [colors]);

  // 경과 시간 업데이트
  useEffect(() => {
    if (!activeSession) {
      setElapsedTime('00:00');
      return;
    }

    const updateElapsedTime = () => {
      const start = new Date(activeSession.started_at).getTime();
      const now = Date.now();
      const diff = Math.floor((now - start) / 1000);
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      if (hours > 0) {
        setElapsedTime(
          `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      } else {
        setElapsedTime(
          `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }
    };

    updateElapsedTime();
    const interval = setInterval(updateElapsedTime, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  // 통계 계산
  const getTotalSets = () => exercises.reduce((sum, e) => sum + e.sets.length, 0);
  const getTotalVolume = () =>
    exercises.reduce(
      (sum, e) =>
        sum + e.sets.reduce((setSum, s) => setSum + (s.weight || 0) * (s.reps || 0), 0),
      0
    );

  const handleStartWorkout = async () => {
    if (isLoading) return;

    // 프로필이 여러 개면 선택 모달 표시
    if (profiles.length > 1) {
      // 기본적으로 모든 프로필 선택
      setSelectedProfileIds(profiles.map((p) => p.id));
      setProfileModalVisible(true);
      return;
    }

    // 프로필이 1개 이하면 바로 시작
    setIsLoading(true);
    try {
      await startWorkout();
      router.push('/workout/active');
    } catch (error: any) {
      console.error('Failed to start workout:', error);
      alert(error?.message || '운동을 시작할 수 없습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmProfiles = async () => {
    if (selectedProfileIds.length === 0) {
      alert('최소 1명의 프로필을 선택해주세요');
      return;
    }

    setProfileModalVisible(false);
    setIsLoading(true);
    try {
      await startWorkout(undefined, selectedProfileIds);
      router.push('/workout/active');
    } catch (error: any) {
      console.error('Failed to start workout:', error);
      alert(error?.message || '운동을 시작할 수 없습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleProfileSelection = (profileId: string) => {
    setSelectedProfileIds((prev) =>
      prev.includes(profileId)
        ? prev.filter((id) => id !== profileId)
        : [...prev, profileId]
    );
  };

  const handleCancelWorkout = () => {
    const doCancel = () => {
      cancelWorkout();
    };

    if (Platform.OS === 'web') {
      if (window.confirm('운동을 취소하시겠습니까? 기록이 저장되지 않습니다.')) {
        doCancel();
      }
    } else {
      Alert.alert(
        '운동 취소',
        '운동을 취소하시겠습니까? 기록이 저장되지 않습니다.',
        [
          { text: '아니오', style: 'cancel' },
          { text: '취소하기', style: 'destructive', onPress: doCancel },
        ]
      );
    }
  };

  // 진행 중인 운동 카드
  const ActiveWorkoutCard = () => (
    <Pressable
      style={[styles.activeCard, dynamicStyles.primaryLightBg]}
      onPress={() => router.push('/workout/active')}
    >
      {/* 헤더 */}
      <RNView style={styles.activeCardHeader}>
        <RNView style={styles.activeCardHeaderLeft}>
          <Text style={[styles.activeCardLabel, dynamicStyles.primary]}>운동 중</Text>
          <RNView style={styles.liveBadge}>
            <RNView style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </RNView>
        </RNView>
        <Text style={[styles.elapsedTime, dynamicStyles.text]}>{elapsedTime}</Text>
      </RNView>

      {/* 세션 이름 */}
      <Text style={[styles.activeCardTitle, dynamicStyles.text]}>{activeSession?.name}</Text>

      {/* 운동 목록 미리보기 */}
      {exercises.length > 0 ? (
        <RNView style={[styles.exercisePreview, dynamicStyles.cardSecondary]}>
          {exercises.slice(0, 3).map((exercise) => (
            <RNView key={exercise.id} style={[styles.exercisePreviewItem, { borderBottomColor: colors.border }]}>
              <Text style={[styles.exercisePreviewName, dynamicStyles.text]}>
                {exercise.exercise.name_ko || exercise.exercise.name}
              </Text>
              <Text style={[styles.exercisePreviewSets, dynamicStyles.primary]}>
                {exercise.sets.length}세트
              </Text>
            </RNView>
          ))}
          {exercises.length > 3 && (
            <Text style={[styles.moreExercises, dynamicStyles.textSecondary]}>
              +{exercises.length - 3}개 더
            </Text>
          )}
        </RNView>
      ) : (
        <Text style={[styles.noExercises, dynamicStyles.textSecondary]}>운동을 추가해주세요</Text>
      )}

      {/* 하단 통계 */}
      <RNView style={[styles.activeCardStats, dynamicStyles.cardSecondary]}>
        <RNView style={styles.activeCardStat}>
          <Text style={[styles.activeCardStatValue, dynamicStyles.text]}>{exercises.length}</Text>
          <Text style={[styles.activeCardStatLabel, dynamicStyles.textSecondary]}>운동</Text>
        </RNView>
        <RNView style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <RNView style={styles.activeCardStat}>
          <Text style={[styles.activeCardStatValue, dynamicStyles.text]}>{getTotalSets()}</Text>
          <Text style={[styles.activeCardStatLabel, dynamicStyles.textSecondary]}>세트</Text>
        </RNView>
        <RNView style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <RNView style={styles.activeCardStat}>
          <Text style={[styles.activeCardStatValue, dynamicStyles.text]}>
            {getTotalVolume().toLocaleString()}
          </Text>
          <Text style={[styles.activeCardStatLabel, dynamicStyles.textSecondary]}>kg</Text>
        </RNView>
      </RNView>

      {/* 버튼 영역 */}
      <RNView style={styles.activeCardButtons}>
        <Pressable
          style={[styles.cancelWorkoutButton, dynamicStyles.cardSecondary]}
          onPress={(e) => {
            e.stopPropagation();
            handleCancelWorkout();
          }}
        >
          <Text style={[styles.cancelWorkoutButtonText, dynamicStyles.textSecondary]}>취소</Text>
        </Pressable>
        <Pressable
          style={[styles.continueButton, dynamicStyles.primaryBg]}
          onPress={() => router.push('/workout/active')}
        >
          <Text style={styles.continueButtonText}>계속하기 →</Text>
        </Pressable>
      </RNView>
    </Pressable>
  );

  return (
    <ScrollView
      style={[styles.container, dynamicStyles.container]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.greeting, dynamicStyles.text]}>오늘도 화이팅! 💪</Text>

      {activeSession ? (
        <ActiveWorkoutCard />
      ) : (
        <RNView style={styles.startButtons}>
          <Pressable
            style={[styles.startButton, dynamicStyles.primaryBg, isLoading && styles.startButtonDisabled]}
            onPress={handleStartWorkout}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? '시작 중...' : '🏋️ 빈 운동 시작'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.smartButton, dynamicStyles.card]}
            onPress={() => router.push('/workout/smart-workout')}
          >
            <Text style={[styles.smartButtonText, dynamicStyles.text]}>✨ 스마트 운동 추천</Text>
            <Text style={[styles.smartButtonSubtext, dynamicStyles.textSecondary]}>
              부위 선택 → 자동 추천
            </Text>
          </Pressable>
        </RNView>
      )}

      {/* 템플릿 섹션 */}
      {!activeSession && templates.length > 0 && (
        <RNView style={styles.templatesSection}>
          <RNView style={styles.templatesSectionHeader}>
            <Text style={[styles.sectionTitle, dynamicStyles.text]}>빠른 시작</Text>
            <Pressable onPress={() => router.push('/workout/templates')}>
              <Text style={[styles.seeAllText, dynamicStyles.primary]}>전체보기</Text>
            </Pressable>
          </RNView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.templatesScroll}
          >
            {templates.slice(0, 5).map((template) => (
              <Pressable
                key={template.id}
                style={[styles.templateCard, dynamicStyles.primaryLightBg]}
                onPress={() => router.push('/workout/templates')}
              >
                <Text style={[styles.templateCardName, dynamicStyles.text]} numberOfLines={1}>
                  {template.name}
                </Text>
                <Text style={[styles.templateCardInfo, dynamicStyles.textSecondary]}>
                  {template.exercises.length}운동
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </RNView>
      )}

      {/* 주간 활동 */}
      <RNView style={styles.weeklySection}>
        <WeeklyActivityBar />
      </RNView>

      {/* 스트릭 & 주간 목표 섹션 */}
      <RNView style={styles.achievementSection}>
        <RNView style={styles.achievementRow}>
          {/* 스트릭 카드 */}
          <RNView style={[styles.streakCard, dynamicStyles.card]}>
            <Text style={styles.streakIcon}>🔥</Text>
            <RNView style={styles.streakInfo}>
              <Text style={[styles.streakValue, dynamicStyles.text]}>{currentStreak}</Text>
              <Text style={[styles.streakLabel, dynamicStyles.textSecondary]}>연속 운동</Text>
            </RNView>
            {longestStreak > 0 && (
              <Text style={[styles.streakBest, dynamicStyles.textSecondary]}>
                최고 {longestStreak}일
              </Text>
            )}
          </RNView>

          {/* 주간 목표 카드 */}
          <Pressable
            style={[styles.weeklyGoalCard, dynamicStyles.card]}
            onPress={() => {
              const newGoal = ((weeklyGoal % 7) + 1);
              setWeeklyGoal(newGoal);
            }}
          >
            <RNView style={styles.weeklyGoalHeader}>
              <Text style={[styles.weeklyGoalTitle, dynamicStyles.textSecondary]}>주간 목표</Text>
              <Text style={[styles.weeklyGoalEdit, dynamicStyles.primary]}>변경</Text>
            </RNView>
            <RNView style={styles.weeklyGoalProgress}>
              <Text style={[styles.weeklyGoalValue, dynamicStyles.text]}>
                {weeklyProgress.current}/{weeklyProgress.goal}
              </Text>
            </RNView>
            {/* 프로그레스 바 */}
            <RNView style={[styles.progressBar, dynamicStyles.cardSecondary]}>
              <RNView
                style={[
                  styles.progressFill,
                  dynamicStyles.primaryBg,
                  { width: `${weeklyProgress.percent}%` },
                ]}
              />
            </RNView>
            {weeklyProgress.percent >= 100 && (
              <Text style={styles.goalComplete}>목표 달성! 🎉</Text>
            )}
          </Pressable>
        </RNView>

        {/* 획득한 배지 미리보기 */}
        {earnedBadges.length > 0 && (
          <Pressable
            style={[styles.badgesPreview, dynamicStyles.card]}
            onPress={() => router.push('/profile')}
          >
            <RNView style={styles.badgesPreviewHeader}>
              <Text style={[styles.badgesPreviewTitle, dynamicStyles.text]}>획득한 배지</Text>
              <Text style={[styles.badgesPreviewCount, dynamicStyles.primary]}>
                {earnedBadges.length}개
              </Text>
            </RNView>
            <RNView style={styles.badgesPreviewList}>
              {earnedBadges.slice(-5).reverse().map((earned) => {
                const badge = getBadgeById(earned.badgeId);
                if (!badge) return null;
                return (
                  <RNView
                    key={earned.badgeId}
                    style={[styles.badgeIcon, { backgroundColor: getBadgeTierColor(badge.tier) + '20' }]}
                  >
                    <Text style={styles.badgeIconText}>{badge.icon}</Text>
                  </RNView>
                );
              })}
              {earnedBadges.length > 5 && (
                <RNView style={[styles.badgeMore, dynamicStyles.cardSecondary]}>
                  <Text style={[styles.badgeMoreText, dynamicStyles.textSecondary]}>
                    +{earnedBadges.length - 5}
                  </Text>
                </RNView>
              )}
            </RNView>
          </Pressable>
        )}
      </RNView>

      <RNView style={styles.quickStats}>
        <Text style={[styles.sectionTitle, dynamicStyles.text]}>이번 주 요약</Text>
        <RNView style={styles.statsRow}>
          <RNView style={[styles.statItem, dynamicStyles.card]}>
            <Text style={[styles.statValue, dynamicStyles.primary]}>{weeklyStats.workoutCount}</Text>
            <Text style={[styles.statLabel, dynamicStyles.textSecondary]}>운동 횟수</Text>
          </RNView>
          <RNView style={[styles.statItem, dynamicStyles.card]}>
            <Text style={[styles.statValue, dynamicStyles.primary]}>{weeklyStats.totalMinutes}</Text>
            <Text style={[styles.statLabel, dynamicStyles.textSecondary]}>총 시간(분)</Text>
          </RNView>
          <RNView style={[styles.statItem, dynamicStyles.card]}>
            <Text style={[styles.statValue, dynamicStyles.primary]}>{Math.round(weeklyStats.totalVolume / 1000)}k</Text>
            <Text style={[styles.statLabel, dynamicStyles.textSecondary]}>총 볼륨(kg)</Text>
          </RNView>
        </RNView>
      </RNView>

      {/* 최근 운동 */}
      {recentWorkouts.length > 0 && (
        <RNView style={styles.recentWorkouts}>
          <Text style={[styles.sectionTitle, dynamicStyles.text]}>최근 운동</Text>
          {recentWorkouts.map((workout) => (
            <Pressable
              key={workout.id}
              style={[styles.recentWorkoutItem, dynamicStyles.card]}
              onPress={() => router.push(`/workout/${workout.id}`)}
            >
              <RNView style={styles.recentWorkoutInfo}>
                <Text style={[styles.recentWorkoutName, dynamicStyles.text]}>{workout.name}</Text>
                <Text style={[styles.recentWorkoutDate, dynamicStyles.textSecondary]}>
                  {new Date(workout.finished_at).toLocaleDateString('ko-KR', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </RNView>
              <Text style={[styles.recentWorkoutStats, dynamicStyles.primary]}>
                {workout.exercises.length}운동 · {workout.total_sets}세트
              </Text>
            </Pressable>
          ))}
        </RNView>
      )}

      <RNView style={{ height: 20 }} />

      {/* 프로필 선택 모달 */}
      <Modal
        visible={profileModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <RNView style={styles.modalOverlay}>
          <RNView style={[styles.modalContent, dynamicStyles.card]}>
            <Text style={[styles.modalTitle, dynamicStyles.text]}>누구와 운동하나요?</Text>
            <Text style={[styles.modalSubtitle, dynamicStyles.textSecondary]}>
              같이 운동할 프로필을 선택하세요
            </Text>

            <RNView style={styles.profileList}>
              {profiles.map((profile) => {
                const isSelected = selectedProfileIds.includes(profile.id);
                return (
                  <Pressable
                    key={profile.id}
                    style={[
                      styles.profileSelectItem,
                      dynamicStyles.cardSecondary,
                      isSelected && { borderColor: colors.primary, borderWidth: 2 },
                    ]}
                    onPress={() => toggleProfileSelection(profile.id)}
                  >
                    <RNView style={[styles.profileAvatar, { backgroundColor: colors.primary }]}>
                      <Text style={styles.profileAvatarText}>{profile.name.charAt(0)}</Text>
                    </RNView>
                    <Text style={[styles.profileSelectName, dynamicStyles.text]}>
                      {profile.name}
                    </Text>
                    <RNView
                      style={[
                        styles.profileCheckbox,
                        isSelected
                          ? { backgroundColor: colors.primary }
                          : { borderColor: colors.border, borderWidth: 2 },
                      ]}
                    >
                      {isSelected && <Text style={styles.profileCheckmark}>✓</Text>}
                    </RNView>
                  </Pressable>
                );
              })}
            </RNView>

            <Pressable
              style={[styles.modalStartButton, dynamicStyles.primaryBg]}
              onPress={handleConfirmProfiles}
            >
              <Text style={styles.modalStartButtonText}>
                {selectedProfileIds.length === 1
                  ? '혼자 운동 시작'
                  : `${selectedProfileIds.length}명이서 운동 시작`}
              </Text>
            </Pressable>

            <Pressable
              style={styles.modalCancelButton}
              onPress={() => setProfileModalVisible(false)}
            >
              <Text style={[styles.modalCancelButtonText, dynamicStyles.textSecondary]}>취소</Text>
            </Pressable>
          </RNView>
        </RNView>
      </Modal>

      {/* 새 배지 획득 모달 */}
      <Modal
        visible={showBadgeModal && newBadges.length > 0}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowBadgeModal(false);
          clearNewBadges();
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setShowBadgeModal(false);
            clearNewBadges();
          }}
        >
          <RNView style={[styles.badgeModalContent, dynamicStyles.card]}>
            <Text style={styles.badgeModalTitle}>🎉 새 배지 획득!</Text>
            {newBadges.map((earned) => {
              const badge = getBadgeById(earned.badgeId);
              if (!badge) return null;
              return (
                <RNView
                  key={earned.badgeId}
                  style={[styles.newBadgeItem, { backgroundColor: getBadgeTierColor(badge.tier) + '20' }]}
                >
                  <Text style={styles.newBadgeIcon}>{badge.icon}</Text>
                  <RNView style={styles.newBadgeInfo}>
                    <Text style={[styles.newBadgeName, dynamicStyles.text]}>{badge.name}</Text>
                    <Text style={[styles.newBadgeDesc, dynamicStyles.textSecondary]}>
                      {badge.description}
                    </Text>
                  </RNView>
                </RNView>
              );
            })}
            <Pressable
              style={[styles.badgeModalButton, dynamicStyles.primaryBg]}
              onPress={() => {
                setShowBadgeModal(false);
                clearNewBadges();
              }}
            >
              <Text style={styles.badgeModalButtonText}>확인</Text>
            </Pressable>
          </RNView>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  startButtons: {
    gap: 12,
  },
  startButton: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startButtonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  smartButton: {
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  smartButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  smartButtonSubtext: {
    fontSize: 13,
  },

  // 진행 중인 운동 카드
  activeCard: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  activeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  activeCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeCardLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  liveText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: '700',
  },
  elapsedTime: {
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  activeCardTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },

  // 운동 미리보기
  exercisePreview: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  exercisePreviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  exercisePreviewName: {
    fontSize: 15,
    fontWeight: '500',
  },
  exercisePreviewSets: {
    fontSize: 14,
    fontWeight: '600',
  },
  moreExercises: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  noExercises: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },

  // 하단 통계
  activeCardStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  activeCardStat: {
    alignItems: 'center',
    flex: 1,
  },
  activeCardStatValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  activeCardStatLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 30,
  },

  // 계속하기 버튼
  activeCardButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelWorkoutButton: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelWorkoutButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  continueButton: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // 주간 활동
  weeklySection: {
    marginTop: 32,
  },

  // 주간 통계
  quickStats: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },

  // 최근 운동
  recentWorkouts: {
    marginTop: 24,
  },
  recentWorkoutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  recentWorkoutInfo: {
    flex: 1,
  },
  recentWorkoutName: {
    fontSize: 16,
    fontWeight: '600',
  },
  recentWorkoutDate: {
    fontSize: 13,
    marginTop: 2,
  },
  recentWorkoutStats: {
    fontSize: 13,
    fontWeight: '500',
  },

  // 템플릿 섹션
  templatesSection: {
    marginTop: 24,
  },
  templatesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  templatesScroll: {
    paddingRight: 16,
  },
  templateCard: {
    padding: 16,
    borderRadius: 12,
    marginRight: 12,
    minWidth: 140,
  },
  templateCardName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  templateCardInfo: {
    fontSize: 13,
  },

  // 프로필 선택 모달
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  profileList: {
    gap: 12,
    marginBottom: 24,
  },
  profileSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 12,
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  profileSelectName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  profileCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCheckmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalStartButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  modalStartButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalCancelButton: {
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCancelButtonText: {
    fontSize: 14,
  },

  // 성취 섹션
  achievementSection: {
    marginTop: 24,
    gap: 12,
  },
  achievementRow: {
    flexDirection: 'row',
    gap: 12,
  },
  streakCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  streakIcon: {
    fontSize: 32,
  },
  streakInfo: {
    flex: 1,
  },
  streakValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  streakLabel: {
    fontSize: 12,
  },
  streakBest: {
    fontSize: 11,
    position: 'absolute',
    top: 8,
    right: 8,
  },
  weeklyGoalCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
  },
  weeklyGoalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  weeklyGoalTitle: {
    fontSize: 12,
  },
  weeklyGoalEdit: {
    fontSize: 11,
    fontWeight: '500',
  },
  weeklyGoalProgress: {
    marginBottom: 8,
  },
  weeklyGoalValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  goalComplete: {
    fontSize: 11,
    color: '#22c55e',
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },

  // 배지 미리보기
  badgesPreview: {
    padding: 16,
    borderRadius: 16,
  },
  badgesPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgesPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  badgesPreviewCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  badgesPreviewList: {
    flexDirection: 'row',
    gap: 8,
  },
  badgeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIconText: {
    fontSize: 20,
  },
  badgeMore: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeMoreText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // 새 배지 모달
  badgeModalContent: {
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 340,
    alignItems: 'center',
  },
  badgeModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
  },
  newBadgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    width: '100%',
    gap: 12,
  },
  newBadgeIcon: {
    fontSize: 36,
  },
  newBadgeInfo: {
    flex: 1,
  },
  newBadgeName: {
    fontSize: 16,
    fontWeight: '700',
  },
  newBadgeDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  badgeModalButton: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    marginTop: 8,
  },
  badgeModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
