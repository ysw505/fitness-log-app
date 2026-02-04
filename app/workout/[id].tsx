import { StyleSheet, ScrollView, Pressable, Alert, Platform } from 'react-native';
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
      <View style={styles.container}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundIcon}>🔍</Text>
          <Text style={styles.notFoundText}>운동 기록을 찾을 수 없습니다</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
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
    const labels: Record<number, { emoji: string; label: string; color: string }> = {
      5: { emoji: '😊', label: '쉬움', color: '#22c55e' },
      7: { emoji: '💪', label: '적당', color: '#3b82f6' },
      9: { emoji: '🔥', label: '힘듦', color: '#f59e0b' },
      10: { emoji: '😵', label: '한계', color: '#ef4444' },
    };
    return labels[rpe] || null;
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
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.title}>{workout.name}</Text>
          <Text style={styles.date}>{formatDate(workout.started_at)}</Text>
          <Text style={styles.time}>
            {formatTime(workout.started_at)} - {formatTime(workout.finished_at)}
          </Text>
        </View>

        {/* 요약 통계 */}
        <View style={styles.summaryCard}>
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
        </View>

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
            <View style={styles.profileSummaryContainer}>
              <Text style={styles.profileSummaryTitle}>프로필별 기록</Text>
              <View style={styles.profileSummaryCards}>
                {Object.entries(profileStats).map(([profileId, stats]) => (
                  <View key={profileId} style={[styles.profileSummaryCard, { backgroundColor: colors.primaryLight }]}>
                    <View style={[styles.profileAvatarSmall, { backgroundColor: colors.primary }]}>
                      <Text style={styles.profileAvatarText}>{stats.name.charAt(0)}</Text>
                    </View>
                    <Text style={[styles.profileSummaryName, { color: colors.text }]}>{stats.name}</Text>
                    <Text style={[styles.profileSummaryStat, { color: colors.primary }]}>
                      {stats.sets}세트 · {stats.volume.toLocaleString()}kg
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })()}

        {/* 운동 목록 */}
        <Text style={styles.sectionTitle}>운동 기록</Text>

        {workout.exercises.map((exercise, exerciseIdx) => {
          const exerciseVolume = exercise.sets.reduce(
            (sum, s) => sum + (s.weight || 0) * (s.reps || 0),
            0
          );

          return (
            <View key={exercise.id} style={styles.exerciseCard}>
              {/* 운동 헤더 */}
              <View style={styles.exerciseHeader}>
                <View style={styles.exerciseInfo}>
                  <Text style={styles.exerciseNumber}>#{exerciseIdx + 1}</Text>
                  <View style={styles.exerciseNameContainer}>
                    <Text style={styles.exerciseName}>
                      {exercise.exercise_name_ko || exercise.exercise_name}
                    </Text>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>
                        {getCategoryName(exercise.category)}
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.exerciseVolume}>
                  {exerciseVolume.toLocaleString()}kg
                </Text>
              </View>

              {/* 세트 목록 */}
              <View style={styles.setsList}>
                <View style={styles.setsHeader}>
                  <Text style={[styles.setHeaderText, { flex: 0.5 }]}>세트</Text>
                  {isMultiProfile && (
                    <Text style={[styles.setHeaderText, { flex: 0.6 }]}>누구</Text>
                  )}
                  <Text style={[styles.setHeaderText, { flex: 1 }]}>무게</Text>
                  <Text style={[styles.setHeaderText, { flex: 1 }]}>횟수</Text>
                  <Text style={[styles.setHeaderText, { flex: 1 }]}>볼륨</Text>
                  <Text style={[styles.setHeaderText, { flex: 0.7 }]}>RPE</Text>
                </View>

                {exercise.sets.map((set, setIdx) => {
                  const rpeInfo = getRpeLabel(set.rpe);
                  const setVolume = (set.weight || 0) * (set.reps || 0);
                  const setWithProfile = set as WorkoutSetWithProfile;

                  return (
                    <View
                      key={set.id}
                      style={[
                        styles.setRow,
                        set.is_warmup && styles.warmupRow,
                        set.is_dropset && styles.dropsetRow,
                      ]}
                    >
                      <View style={[styles.setCell, { flex: 0.5 }]}>
                        <Text style={styles.setNumber}>{setIdx + 1}</Text>
                        {set.is_warmup && (
                          <Text style={styles.setBadge}>W</Text>
                        )}
                        {set.is_dropset && (
                          <Text style={[styles.setBadge, styles.dropBadge]}>D</Text>
                        )}
                      </View>
                      {isMultiProfile && (
                        <View style={[styles.setCell, { flex: 0.6 }]}>
                          <View style={[styles.profileBadgeSmall, { backgroundColor: colors.primary + '20' }]}>
                            <Text style={[styles.profileBadgeText, { color: colors.primary }]}>
                              {setWithProfile.profile_name?.charAt(0) || '?'}
                            </Text>
                          </View>
                        </View>
                      )}
                      <Text style={[styles.setCellText, { flex: 1 }]}>
                        {set.weight || '-'}kg
                      </Text>
                      <Text style={[styles.setCellText, { flex: 1 }]}>
                        {set.reps || '-'}회
                      </Text>
                      <Text style={[styles.setCellText, { flex: 1 }]}>
                        {setVolume > 0 ? setVolume.toLocaleString() : '-'}
                      </Text>
                      <View style={[styles.setCell, { flex: 0.7 }]}>
                        {rpeInfo ? (
                          <View
                            style={[
                              styles.rpeBadge,
                              { backgroundColor: rpeInfo.color + '20' },
                            ]}
                          >
                            <Text style={{ fontSize: 12 }}>{rpeInfo.emoji}</Text>
                          </View>
                        ) : (
                          <Text style={styles.setCellText}>-</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}

        {/* 템플릿 저장 버튼 */}
        <Pressable style={styles.templateButton} onPress={handleSaveAsTemplate}>
          <Text style={styles.templateButtonText}>템플릿으로 저장</Text>
        </Pressable>

        {/* 삭제 버튼 */}
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>기록 삭제</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </View>
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
    color: '#1f2937',
  },
  date: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 4,
  },
  time: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#3b82f6',
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
    color: '#1f2937',
  },
  exerciseCard: {
    backgroundColor: '#fff',
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
    color: '#9ca3af',
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
    color: '#1f2937',
    marginBottom: 6,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 11,
    color: '#3b82f6',
    fontWeight: '500',
  },
  exerciseVolume: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
  },
  setsList: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
  },
  setsHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  setHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  warmupRow: {
    backgroundColor: '#fef3c7',
    marginHorizontal: -12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  dropsetRow: {
    backgroundColor: '#fce7f3',
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
    color: '#374151',
  },
  setBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#f59e0b',
    marginLeft: 4,
  },
  dropBadge: {
    color: '#ec4899',
  },
  setCellText: {
    fontSize: 14,
    color: '#374151',
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
    color: '#374151',
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
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  templateButtonText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#fee2e2',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  deleteButtonText: {
    color: '#ef4444',
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
    color: '#6b7280',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#3b82f6',
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
