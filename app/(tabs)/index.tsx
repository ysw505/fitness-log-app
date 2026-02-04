import { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Pressable, ScrollView, View as RNView, Modal, Alert, Platform } from 'react-native';
import { router } from 'expo-router';

import { Text, useThemeColors } from '@/components/Themed';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useHistoryStore } from '@/stores/historyStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useProfileStore } from '@/stores/profileStore';
import { useAchievementStore, getBadgeById, getBadgeTierColor, BADGES } from '@/stores/achievementStore';
import { useSmartRecommendation } from '@/hooks/useSmartRecommendation';

// 초보자 팁 데이터
const BEGINNER_TIPS = [
  { icon: '💪', tip: '운동 전 5-10분 워밍업으로 부상을 예방하세요', category: '안전' },
  { icon: '📈', tip: '처음엔 가벼운 무게로 자세를 익히는 게 중요해요', category: '시작' },
  { icon: '🔄', tip: '같은 부위는 48-72시간 휴식을 주세요', category: '회복' },
  { icon: '📝', tip: '매 운동을 기록하면 성장을 눈으로 확인할 수 있어요', category: '기록' },
  { icon: '🎯', tip: 'RPE 7-8 정도로 운동하면 안전하게 성장할 수 있어요', category: '강도' },
  { icon: '🥗', tip: '단백질은 체중 kg당 1.6-2.2g이 근육 성장에 좋아요', category: '영양' },
  { icon: '😴', tip: '수면은 근육 회복의 핵심! 7-9시간을 목표로 해요', category: '회복' },
  { icon: '🏋️', tip: '복합 운동(스쿼트, 데드리프트)이 효율적이에요', category: '운동' },
  { icon: '⏱️', tip: '세트 사이 2-3분 휴식이 근력 운동에 적합해요', category: '휴식' },
  { icon: '📅', tip: '일주일에 3-4회 운동이 초보자에게 적당해요', category: '빈도' },
];

export default function HomeScreen() {
  const colors = useThemeColors();
  const { activeSession, exercises, startWorkout, cancelWorkout } = useWorkoutStore();
  const { getRecentWorkouts } = useHistoryStore();
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
  const { getSmartRecommendation } = useSmartRecommendation();

  const [isLoading, setIsLoading] = useState(false);
  const [isSmartLoading, setIsSmartLoading] = useState(false);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00:00');

  // 프로필 선택 모달 상태
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);

  // 초보자 팁 상태 (운동 횟수 10회 이하일 때만 표시)
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * BEGINNER_TIPS.length));
  const [showTipBanner, setShowTipBanner] = useState(true);

  // 로컬 프로필 초기화 (비로그인 시)
  useEffect(() => {
    if (profiles.length === 0) {
      initLocalProfiles();
    }
  }, []);

  // 주간 통계
  const recentWorkouts = getRecentWorkouts(3);
  const weeklyProgress = getWeeklyProgress();
  const { completedWorkouts } = useHistoryStore();
  const totalWorkoutCount = completedWorkouts.length;
  const isBeginnerUser = totalWorkoutCount <= 10;

  // 다음 팁으로 이동
  const nextTip = () => {
    setTipIndex((prev) => (prev + 1) % BEGINNER_TIPS.length);
  };

  const currentTip = BEGINNER_TIPS[tipIndex];

  // 스마트 추천
  const smartRecommendation = useMemo(() => getSmartRecommendation(), [getSmartRecommendation]);

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
    textTertiary: { color: colors.textSecondary, opacity: 0.7 },
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

  // 스마트 추천으로 운동 시작
  const handleStartSmartWorkout = async () => {
    if (isSmartLoading) return;

    // 프로필이 여러 개면 선택 모달 표시
    if (profiles.length > 1) {
      setSelectedProfileIds(profiles.map((p) => p.id));
      setProfileModalVisible(true);
      return;
    }

    setIsSmartLoading(true);
    try {
      await startWorkout(smartRecommendation.splitName);

      // 추천 운동들 추가
      const { addExercise } = useWorkoutStore.getState();
      for (const exercise of smartRecommendation.exercises) {
        await addExercise(exercise);
      }

      router.push('/workout/active');
    } catch (error: any) {
      console.error('Failed to start smart workout:', error);
      alert(error?.message || '운동을 시작할 수 없습니다');
    } finally {
      setIsSmartLoading(false);
    }
  };

  // 스마트 추천 + 프로필 선택 후 시작
  const handleConfirmSmartProfiles = async () => {
    if (selectedProfileIds.length === 0) {
      alert('최소 1명의 프로필을 선택해주세요');
      return;
    }

    setProfileModalVisible(false);
    setIsSmartLoading(true);
    try {
      await startWorkout(smartRecommendation.splitName, selectedProfileIds);

      const { addExercise } = useWorkoutStore.getState();
      for (const exercise of smartRecommendation.exercises) {
        await addExercise(exercise);
      }

      router.push('/workout/active');
    } catch (error: any) {
      console.error('Failed to start smart workout:', error);
      alert(error?.message || '운동을 시작할 수 없습니다');
    } finally {
      setIsSmartLoading(false);
    }
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
      <Text style={[styles.greeting, dynamicStyles.text]}>오늘의 운동</Text>

      {/* 초보자 팁 배너 (10회 이하 운동 기록 시) */}
      {isBeginnerUser && showTipBanner && !activeSession && (
        <RNView style={[styles.tipBanner, dynamicStyles.card]}>
          <RNView style={styles.tipBannerHeader}>
            <RNView style={styles.tipBadgeRow}>
              <Text style={styles.tipBadgeIcon}>💡</Text>
              <Text style={[styles.tipBadgeText, dynamicStyles.primary]}>초보자 팁</Text>
            </RNView>
            <Pressable
              style={[styles.tipDismissBtn, dynamicStyles.cardSecondary]}
              onPress={() => setShowTipBanner(false)}
              hitSlop={8}
            >
              <Text style={[styles.tipDismissText, dynamicStyles.textTertiary]}>닫기</Text>
            </Pressable>
          </RNView>
          <RNView style={styles.tipContent}>
            <Text style={styles.tipIcon}>{currentTip.icon}</Text>
            <RNView style={styles.tipTextContainer}>
              <Text style={[styles.tipCategoryLabel, { color: colors.primary }]}>{currentTip.category}</Text>
              <Text style={[styles.tipText, dynamicStyles.text]}>{currentTip.tip}</Text>
            </RNView>
          </RNView>
          <RNView style={styles.tipFooter}>
            {/* 진행률 dots */}
            <RNView style={styles.tipDots}>
              {BEGINNER_TIPS.slice(0, 5).map((_, idx) => (
                <RNView
                  key={idx}
                  style={[
                    styles.tipDot,
                    idx === tipIndex % 5
                      ? dynamicStyles.primaryBg
                      : { backgroundColor: colors.border },
                  ]}
                />
              ))}
            </RNView>
            <Pressable onPress={nextTip} style={styles.tipNextBtn}>
              <Text style={[styles.tipNextText, dynamicStyles.primary]}>다음 →</Text>
            </Pressable>
          </RNView>
        </RNView>
      )}

      {activeSession ? (
        <ActiveWorkoutCard />
      ) : (
        <RNView style={styles.startButtons}>
          {/* 오늘 추천 (원탭 시작) */}
          <Pressable
            style={[styles.smartRecommendationCard, dynamicStyles.primaryBg, isSmartLoading && styles.startButtonDisabled]}
            onPress={handleStartSmartWorkout}
            disabled={isSmartLoading}
          >
            <RNView style={styles.smartRecHeader}>
              <Text style={styles.smartRecBadge}>오늘 추천</Text>
              <Text style={styles.smartRecReason}>{smartRecommendation.reason}</Text>
            </RNView>
            <Text style={styles.smartRecTitle}>
              {isSmartLoading ? '시작 중...' : smartRecommendation.splitName}
            </Text>
            <Text style={styles.smartRecExercises}>
              {smartRecommendation.exercises.slice(0, 3).map((e) => e.name_ko || e.name).join(', ')}
              {smartRecommendation.exercises.length > 3 && ` 외 ${smartRecommendation.exercises.length - 3}개`}
            </Text>
            <RNView style={styles.smartRecFooter}>
              <Text style={styles.smartRecCount}>{smartRecommendation.exercises.length}개 운동</Text>
              <Text style={styles.smartRecAction}>탭하여 바로 시작 →</Text>
            </RNView>
          </Pressable>

          {/* 빠른 시작 버튼들 */}
          <RNView style={styles.quickStartRow}>
            <Pressable
              style={[styles.quickStartButton, dynamicStyles.card]}
              onPress={handleStartWorkout}
              disabled={isLoading}
            >
              <Text style={[styles.quickStartIcon]}>📝</Text>
              <Text style={[styles.quickStartText, dynamicStyles.text]}>
                {isLoading ? '시작 중...' : '빈 운동'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.quickStartButton, dynamicStyles.card]}
              onPress={() => router.push('/workout/smart-workout')}
            >
              <Text style={[styles.quickStartIcon]}>🎯</Text>
              <Text style={[styles.quickStartText, dynamicStyles.text]}>직접 선택</Text>
            </Pressable>
          </RNView>
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

      {/* 스트릭 배너 (3일 이상일 때만 표시) */}
      {currentStreak >= 3 && (
        <RNView style={[styles.streakBanner, dynamicStyles.card]}>
          <Text style={styles.streakBannerIcon}>🔥</Text>
          <Text style={[styles.streakBannerText, dynamicStyles.text]}>
            {currentStreak}일 연속 운동 중!
          </Text>
          {longestStreak > currentStreak && (
            <Text style={[styles.streakBannerBest, dynamicStyles.textSecondary]}>
              최고 {longestStreak}일
            </Text>
          )}
        </RNView>
      )}

      {/* 주간 목표 (개선된 메시지) */}
      <Pressable
        style={[styles.weeklyGoalSection, dynamicStyles.card]}
        onPress={() => {
          const newGoal = ((weeklyGoal % 7) + 1);
          setWeeklyGoal(newGoal);
        }}
      >
        <RNView style={styles.weeklyGoalHeader}>
          <Text style={[styles.weeklyGoalTitle, dynamicStyles.text]}>이번 주 운동</Text>
          <Text style={[styles.weeklyGoalEdit, dynamicStyles.primary]}>목표 변경</Text>
        </RNView>
        <RNView style={styles.weeklyGoalContent}>
          <Text style={[styles.weeklyGoalValue, dynamicStyles.primary]}>
            {weeklyProgress.current}
          </Text>
          <Text style={[styles.weeklyGoalDivider, dynamicStyles.textSecondary]}>/</Text>
          <Text style={[styles.weeklyGoalTarget, dynamicStyles.textSecondary]}>
            {weeklyProgress.goal}회
          </Text>
        </RNView>
        {/* 프로그레스 바 */}
        <RNView style={[styles.progressBar, dynamicStyles.cardSecondary]}>
          <RNView
            style={[
              styles.progressFill,
              dynamicStyles.primaryBg,
              { width: `${Math.min(weeklyProgress.percent, 100)}%` },
            ]}
          />
        </RNView>
        {/* 긍정적 메시지 */}
        <Text style={[styles.weeklyGoalMessage, dynamicStyles.textSecondary]}>
          {weeklyProgress.percent >= 100
            ? '이번 주 목표 달성! 🎉'
            : weeklyProgress.current === 0
            ? '첫 운동을 시작해볼까요?'
            : weeklyProgress.goal - weeklyProgress.current === 1
            ? '목표까지 딱 1번!'
            : `목표까지 ${weeklyProgress.goal - weeklyProgress.current}번 남았어요`}
        </Text>
      </Pressable>

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
  // 스마트 추천 카드
  smartRecommendationCard: {
    padding: 20,
    borderRadius: 20,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  smartRecHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  smartRecBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    overflow: 'hidden',
  },
  smartRecReason: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  smartRecTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  smartRecExercises: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 12,
    lineHeight: 20,
  },
  smartRecFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  smartRecCount: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  smartRecAction: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },

  // 빠른 시작 버튼들
  quickStartRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickStartButton: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  quickStartIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  quickStartText: {
    fontSize: 14,
    fontWeight: '600',
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

  // 스트릭 배너 (3일 이상일 때)
  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  streakBannerIcon: {
    fontSize: 20,
  },
  streakBannerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  streakBannerBest: {
    fontSize: 12,
  },

  // 주간 목표 (개선된)
  weeklyGoalSection: {
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
  },
  weeklyGoalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  weeklyGoalTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  weeklyGoalEdit: {
    fontSize: 13,
    fontWeight: '500',
  },
  weeklyGoalContent: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  weeklyGoalValue: {
    fontSize: 36,
    fontWeight: '700',
  },
  weeklyGoalDivider: {
    fontSize: 24,
    marginHorizontal: 4,
  },
  weeklyGoalTarget: {
    fontSize: 18,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  weeklyGoalMessage: {
    fontSize: 13,
    textAlign: 'center',
  },

  // 섹션 공통
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
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

  // 초보자 팁 배너
  tipBanner: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  tipBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tipCategoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  tipCategoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tipBannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  tipNextText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tipDismissText: {
    fontSize: 18,
    fontWeight: '400',
  },
  tipContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  tipIcon: {
    fontSize: 24,
  },
  tipText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  tipProgress: {
    fontSize: 11,
    textAlign: 'right',
  },
  // 초보자 팁 배너 - 추가 스타일
  tipBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tipBadgeIcon: {
    fontSize: 16,
  },
  tipBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tipDismissBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tipTextContainer: {
    flex: 1,
    gap: 4,
  },
  tipCategoryLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tipFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tipDots: {
    flexDirection: 'row',
    gap: 6,
  },
  tipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tipNextBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
});
