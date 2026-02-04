import { useMemo } from 'react';
import { StyleSheet, ScrollView, Pressable, Alert, Platform, View as RNView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';

import { Text, View, useThemeColors } from '@/components/Themed';
import { useHistoryStore, WorkoutSetWithProfile } from '@/stores/historyStore';
import { useTemplateStore } from '@/stores/templateStore';
import { EXERCISE_CATEGORIES } from '@/stores/exerciseStore';

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getWorkoutById, deleteWorkout } = useHistoryStore();
  const { createTemplateFromWorkout } = useTemplateStore();
  const colors = useThemeColors();

  const workout = getWorkoutById(id);

  // 다이나믹 스타일 (다크 테마 지원)
  const dynamicStyles = useMemo(() => ({
    container: { backgroundColor: colors.background },
    title: { color: colors.text },
    date: { color: colors.textSecondary },
    time: { color: colors.textTertiary },
    summaryCard: { backgroundColor: colors.primary },
    sectionTitle: { color: colors.text },
    exerciseCard: { backgroundColor: colors.card },
    exerciseNumber: { color: colors.textTertiary },
    exerciseName: { color: colors.text },
    categoryBadge: { backgroundColor: colors.primaryLight },
    categoryBadgeText: { color: colors.primary },
    exerciseVolume: { color: colors.success },
    setsList: { backgroundColor: colors.cardSecondary },
    setsHeaderBorder: { borderBottomColor: colors.border },
    setHeaderText: { color: colors.textTertiary },
    setNumber: { color: colors.textSecondary },
    setCellText: { color: colors.textSecondary },
    warmupRow: { backgroundColor: colors.warning + '30' },
    dropsetRow: { backgroundColor: colors.error + '20' },
    profileSummaryTitle: { color: colors.textSecondary },
    templateButton: { backgroundColor: colors.primaryLight },
    templateButtonText: { color: colors.primary },
    deleteButton: { backgroundColor: colors.error + '15' },
    deleteButtonText: { color: colors.error },
    notFoundText: { color: colors.textSecondary },
    backButton: { backgroundColor: colors.primary },
  }), [colors]);

  // 멀티 프로필 운동인지 확인
  const isMultiProfile = workout?.profile_ids && workout.profile_ids.length > 1;

  const handleSaveAsTemplate = () => {
    if (!workout) return;

    const templateWorkout = {
      name: workout.name,
      exercises: workout.exercises.map((e) => ({
        exercise_id: e.exercise_id,
        exercise_name: e.exercise_name,
        exercise_name_ko: e.exercise_name_ko,
        category: e.category,
        sets: e.sets.map((s) => ({
          weight: s.weight,
          reps: s.reps,
        })),
      })),
    };

    createTemplateFromWorkout(templateWorkout);

    if (Platform.OS === 'web') {
      alert('템플릿으로 저장되었습니다!');
    } else {
      Alert.alert('완료', '템플릿으로 저장되었습니다!');
    }
  };

  if (!workout) {
    return (
      <View style={[styles.container, dynamicStyles.container]}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundIcon}>🔍</Text>
          <Text style={[styles.notFoundText, dynamicStyles.notFoundText]}>운동 기록을 찾을 수 없습니다</Text>
          <Pressable style={[styles.backButton, dynamicStyles.backButton]} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>돌아가기</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCategoryName = (categoryId: string) => {
    const category = EXERCISE_CATEGORIES.find((c) => c.id === categoryId);
    return category?.name || categoryId;
  };

  const getRpeLabel = (rpe: number | null) => {
    if (rpe === null) return null;
    // RPE 색상 (숫자 기반 그라데이션)
    const getColor = (value: number) => {
      if (value <= 5) return '#22c55e'; // 녹색 - 여유
      if (value <= 6) return '#84cc16'; // 연두
      if (value <= 7) return '#3b82f6'; // 파랑 - 적당
      if (value <= 8) return '#f59e0b'; // 주황
      if (value <= 9) return '#f97316'; // 진한 주황 - 힘듦
      return '#ef4444'; // 빨강 - 한계
    };
    const getLabel = (value: number) => {
      if (value <= 5) return '여유';
      if (value <= 7) return '적당';
      if (value <= 9) return '힘듦';
      return '한계';
    };
    return { label: getLabel(rpe), color: getColor(rpe) };
  };

  const handleDelete = () => {
    if (Platform.OS === 'web') {
      if (confirm('이 운동 기록을 삭제하시겠습니까?')) {
        deleteWorkout(workout.id);
        router.back();
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
            onPress: () => {
              deleteWorkout(workout.id);
              router.back();
            },
          },
        ]
      );
    }
  };

  return (
    <ScrollView style={[styles.container, dynamicStyles.container]}>
      <RNView style={styles.content}>
        {/* 헤더 */}
        <RNView style={styles.header}>
          <Text style={[styles.title, dynamicStyles.title]}>{workout.name}</Text>
          <Text style={[styles.date, dynamicStyles.date]}>{formatDate(workout.started_at)}</Text>
          <Text style={[styles.time, dynamicStyles.time]}>
            {formatTime(workout.started_at)} - {formatTime(workout.finished_at)}
          </Text>
        </RNView>

        {/* 요약 통계 */}
        <RNView style={[styles.summaryCard, dynamicStyles.summaryCard]}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{workout.duration_minutes}</Text>
            <Text style={styles.summaryLabel}>분</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{workout.exercises.length}</Text>
            <Text style={styles.summaryLabel}>운동</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{workout.total_sets}</Text>
            <Text style={styles.summaryLabel}>세트</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {Math.round(workout.total_volume / 1000)}k
            </Text>
            <Text style={styles.summaryLabel}>kg</Text>
          </View>
        </RNView>

        {/* 프로필별 통계 (멀티 프로필 운동인 경우) */}
        {isMultiProfile && (() => {
          // 프로필별 통계 계산
          const profileStats: Record<string, { sets: number; volume: number; name: string }> = {};
          workout.exercises.forEach((exercise) => {
            exercise.sets.forEach((set) => {
              const setWithProfile = set as WorkoutSetWithProfile;
              const profileId = setWithProfile.profile_id || 'unknown';
              const profileName = setWithProfile.profile_name || '알 수 없음';
              if (!profileStats[profileId]) {
                profileStats[profileId] = { sets: 0, volume: 0, name: profileName };
              }
              profileStats[profileId].sets++;
              profileStats[profileId].volume += (set.weight || 0) * (set.reps || 0);
            });
          });

          return (
            <RNView style={styles.profileSummaryContainer}>
              <Text style={[styles.profileSummaryTitle, dynamicStyles.profileSummaryTitle]}>프로필별 기록</Text>
              <RNView style={styles.profileSummaryCards}>
                {Object.entries(profileStats).map(([profileId, stats]) => (
                  <RNView key={profileId} style={[styles.profileSummaryCard, { backgroundColor: colors.primaryLight }]}>
                    <RNView style={[styles.profileAvatarSmall, { backgroundColor: colors.primary }]}>
                      <Text style={styles.profileAvatarText}>{stats.name.charAt(0)}</Text>
                    </RNView>
                    <Text style={[styles.profileSummaryName, { color: colors.text }]}>{stats.name}</Text>
                    <Text style={[styles.profileSummaryStat, { color: colors.primary }]}>
                      {stats.sets}세트 · {stats.volume.toLocaleString()}kg
                    </Text>
                  </RNView>
                ))}
              </RNView>
            </RNView>
          );
        })()}

        {/* 운동 목록 */}
        <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>운동 기록</Text>

        {workout.exercises.map((exercise, exerciseIdx) => {
          const exerciseVolume = exercise.sets.reduce(
            (sum, s) => sum + (s.weight || 0) * (s.reps || 0),
            0
          );

          return (
            <RNView key={exercise.id} style={[styles.exerciseCard, dynamicStyles.exerciseCard]}>
              {/* 운동 헤더 */}
              <RNView style={styles.exerciseHeader}>
                <RNView style={styles.exerciseInfo}>
                  <Text style={[styles.exerciseNumber, dynamicStyles.exerciseNumber]}>#{exerciseIdx + 1}</Text>
                  <RNView style={styles.exerciseNameContainer}>
                    <Text style={[styles.exerciseName, dynamicStyles.exerciseName]}>
                      {exercise.exercise_name_ko || exercise.exercise_name}
                    </Text>
                    <RNView style={[styles.categoryBadge, dynamicStyles.categoryBadge]}>
                      <Text style={[styles.categoryBadgeText, dynamicStyles.categoryBadgeText]}>
                        {getCategoryName(exercise.category)}
                      </Text>
                    </RNView>
                  </RNView>
                </RNView>
                <Text style={[styles.exerciseVolume, dynamicStyles.exerciseVolume]}>
                  {exerciseVolume.toLocaleString()}kg
                </Text>
              </RNView>

              {/* 세트 목록 */}
              <RNView style={[styles.setsList, dynamicStyles.setsList]}>
                <RNView style={[styles.setsHeader, dynamicStyles.setsHeaderBorder]}>
                  <Text style={[styles.setHeaderText, dynamicStyles.setHeaderText, { flex: 0.5 }]}>세트</Text>
                  {isMultiProfile && (
                    <Text style={[styles.setHeaderText, dynamicStyles.setHeaderText, { flex: 0.6 }]}>누구</Text>
                  )}
                  <Text style={[styles.setHeaderText, dynamicStyles.setHeaderText, { flex: 1 }]}>무게</Text>
                  <Text style={[styles.setHeaderText, dynamicStyles.setHeaderText, { flex: 1 }]}>횟수</Text>
                  <Text style={[styles.setHeaderText, dynamicStyles.setHeaderText, { flex: 1 }]}>볼륨</Text>
                  <Text style={[styles.setHeaderText, dynamicStyles.setHeaderText, { flex: 0.7 }]}>RPE</Text>
                </RNView>

                {exercise.sets.map((set, setIdx) => {
                  const rpeInfo = getRpeLabel(set.rpe);
                  const setVolume = (set.weight || 0) * (set.reps || 0);
                  const setWithProfile = set as WorkoutSetWithProfile;

                  return (
                    <RNView
                      key={set.id}
                      style={[
                        styles.setRow,
                        set.is_warmup && dynamicStyles.warmupRow,
                        set.is_dropset && dynamicStyles.dropsetRow,
                      ]}
                    >
                      <RNView style={[styles.setCell, { flex: 0.5 }]}>
                        <Text style={[styles.setNumber, dynamicStyles.setNumber]}>{setIdx + 1}</Text>
                        {set.is_warmup && (
                          <Text style={[styles.setBadge, { color: colors.warning }]}>W</Text>
                        )}
                        {set.is_dropset && (
                          <Text style={[styles.setBadge, { color: colors.error }]}>D</Text>
                        )}
                      </RNView>
                      {isMultiProfile && (
                        <RNView style={[styles.setCell, { flex: 0.6 }]}>
                          <RNView style={[styles.profileBadgeSmall, { backgroundColor: colors.primary + '20' }]}>
                            <Text style={[styles.profileBadgeText, { color: colors.primary }]}>
                              {setWithProfile.profile_name?.charAt(0) || '?'}
                            </Text>
                          </RNView>
                        </RNView>
                      )}
                      <Text style={[styles.setCellText, dynamicStyles.setCellText, { flex: 1 }]}>
                        {set.weight || '-'}kg
                      </Text>
                      <Text style={[styles.setCellText, dynamicStyles.setCellText, { flex: 1 }]}>
                        {set.reps || '-'}회
                      </Text>
                      <Text style={[styles.setCellText, dynamicStyles.setCellText, { flex: 1 }]}>
                        {setVolume > 0 ? setVolume.toLocaleString() : '-'}
                      </Text>
                      <RNView style={[styles.setCell, { flex: 0.7 }]}>
                        {rpeInfo ? (
                          <RNView
                            style={[
                              styles.rpeBadge,
                              { backgroundColor: rpeInfo.color + '20' },
                            ]}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: rpeInfo.color }}>{set.rpe}</Text>
                          </RNView>
                        ) : (
                          <Text style={[styles.setCellText, dynamicStyles.setCellText]}>-</Text>
                        )}
                      </RNView>
                    </RNView>
                  );
                })}
              </RNView>
            </RNView>
          );
        })}

        {/* 템플릿 저장 버튼 */}
        <Pressable style={[styles.templateButton, dynamicStyles.templateButton]} onPress={handleSaveAsTemplate}>
          <Text style={[styles.templateButtonText, dynamicStyles.templateButtonText]}>템플릿으로 저장</Text>
        </Pressable>

        {/* 삭제 버튼 */}
        <Pressable style={[styles.deleteButton, dynamicStyles.deleteButton]} onPress={handleDelete}>
          <Text style={[styles.deleteButtonText, dynamicStyles.deleteButtonText]}>기록 삭제</Text>
        </Pressable>

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
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  date: {
    fontSize: 16,
    marginBottom: 4,
  },
  time: {
    fontSize: 14,
  },
  summaryCard: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  summaryLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  exerciseCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  exerciseInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    backgroundColor: 'transparent',
  },
  exerciseNumber: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 12,
    marginTop: 2,
  },
  exerciseNameContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  exerciseName: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 6,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  exerciseVolume: {
    fontSize: 16,
    fontWeight: '700',
  },
  setsList: {
    borderRadius: 12,
    padding: 12,
  },
  setsHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  setHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  warmupRow: {
    marginHorizontal: -12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  dropsetRow: {
    marginHorizontal: -12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  setCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  setNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  setBadge: {
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  dropBadge: {
  },
  setCellText: {
    fontSize: 14,
    textAlign: 'center',
  },
  rpeBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileBadgeSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  profileSummaryContainer: {
    marginBottom: 24,
    backgroundColor: 'transparent',
  },
  profileSummaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  profileSummaryCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    backgroundColor: 'transparent',
  },
  profileSummaryCard: {
    flex: 1,
    minWidth: 140,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  profileAvatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  profileAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  profileSummaryName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  profileSummaryStat: {
    fontSize: 13,
    fontWeight: '500',
  },
  templateButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  templateButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  notFound: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  notFoundIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  notFoundText: {
    fontSize: 16,
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
