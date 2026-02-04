import { useState, useMemo } from 'react';
import {
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Platform,
  View as RNView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { router } from 'expo-router';

import { Text, View, useThemeColors } from '@/components/Themed';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useExerciseStore, EXERCISE_CATEGORIES } from '@/stores/exerciseStore';
import { useHistoryStore } from '@/stores/historyStore';
import { Exercise } from '@/types/database.types';
import { getExerciseGuide, ExerciseGuide } from '@/data/exerciseGuides';

export default function ExerciseSelectScreen() {
  const colors = useThemeColors();
  const { addExercise } = useWorkoutStore();
  const { getAllExercises, searchExercises, addCustomExercise } = useExerciseStore();
  const { getMostPerformedExercises, exerciseRecords } = useHistoryStore();
  const [isCreating, setIsCreating] = useState(false);

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
    border: { borderColor: colors.border },
  }), [colors]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [guideModalVisible, setGuideModalVisible] = useState(false);
  const [selectedGuide, setSelectedGuide] = useState<{ exercise: Exercise; guide: ExerciseGuide } | null>(null);

  const handleShowGuide = (exercise: Exercise) => {
    const guide = getExerciseGuide(exercise.id);
    if (guide) {
      setSelectedGuide({ exercise, guide });
      setGuideModalVisible(true);
    }
  };

  const getDifficultyColor = (difficulty: ExerciseGuide['difficulty']) => {
    switch (difficulty) {
      case 'beginner':
        return '#4CAF50';
      case 'intermediate':
        return '#FF9800';
      case 'advanced':
        return '#F44336';
      default:
        return colors.textSecondary;
    }
  };

  const getDifficultyLabel = (difficulty: ExerciseGuide['difficulty']) => {
    switch (difficulty) {
      case 'beginner':
        return '초급';
      case 'intermediate':
        return '중급';
      case 'advanced':
        return '고급';
      default:
        return difficulty;
    }
  };

  // 최근 사용한 운동 가져오기 (최근 5개, 더 컴팩트하게)
  const recentExercises = useMemo(() => {
    const allExercises = getAllExercises();

    // exerciseRecords에서 가장 최근 운동 순으로 정렬
    const recordEntries = Object.values(exerciseRecords)
      .filter(record => record.records.length > 0)
      .sort((a, b) => {
        const dateA = new Date(a.records[0].date).getTime();
        const dateB = new Date(b.records[0].date).getTime();
        return dateB - dateA;
      })
      .slice(0, 5);

    // exercise_id로 실제 Exercise 객체 찾기
    return recordEntries
      .map(record => allExercises.find(e => e.id === record.exercise_id))
      .filter((e): e is Exercise => e !== undefined);
  }, [exerciseRecords, getAllExercises]);

  // 자주 하는 운동 (최근 운동과 중복 제거)
  const frequentExercises = useMemo(() => {
    const allExercises = getAllExercises();
    const mostPerformed = getMostPerformedExercises();
    const recentIds = new Set(recentExercises.map(e => e.id));

    return mostPerformed
      .filter(item => !recentIds.has(item.exerciseId))
      .slice(0, 3)
      .map(item => allExercises.find(e => e.id === item.exerciseId))
      .filter((e): e is Exercise => e !== undefined);
  }, [getAllExercises, getMostPerformedExercises, recentExercises]);

  const getFilteredExercises = (): Exercise[] => {
    let exercises = getAllExercises();

    if (searchQuery) {
      exercises = searchExercises(searchQuery);
    }

    if (selectedCategory) {
      exercises = exercises.filter((e) => e.category === selectedCategory);
    }

    return exercises;
  };

  const handleSelectExercise = async (exercise: Exercise) => {
    try {
      await addExercise(exercise);
      router.back();
    } catch (error) {
      console.error('Failed to add exercise:', error);
      if (Platform.OS === 'web') {
        alert('운동을 추가할 수 없습니다');
      }
    }
  };

  const handleCreateQuickExercise = async () => {
    if (!searchQuery.trim() || isCreating) return;

    setIsCreating(true);
    try {
      // 기본 카테고리로 커스텀 운동 생성
      const newExercise = await addCustomExercise({
        name: searchQuery.trim(),
        name_ko: searchQuery.trim(),
        category: selectedCategory || 'other',
        muscle_group: [],
        equipment: null,
        user_id: null,
        profile_id: null,
      });

      // 생성된 운동을 현재 워크아웃에 추가
      await addExercise(newExercise);
      router.back();
    } catch (error) {
      console.error('Failed to create quick exercise:', error);
      if (Platform.OS === 'web') {
        alert('운동을 생성할 수 없습니다');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleCategorySelect = (categoryId: string | null) => {
    setSelectedCategory(categoryId);
  };

  const filteredExercises = getFilteredExercises();

  // 검색 중이 아니고 카테고리도 선택 안했을 때만 최근/자주 섹션 표시
  const showQuickAccess = !searchQuery && !selectedCategory;

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      {/* 검색 */}
      <RNView style={styles.searchContainer}>
        <TextInput
          style={[styles.searchInput, dynamicStyles.cardSecondary, { color: colors.text }]}
          placeholder="운동 검색..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={colors.textTertiary}
        />
      </RNView>

      {/* 필터 칩 */}
      <RNView style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {/* 전체 버튼 */}
          <Pressable
            style={[
              styles.filterChip,
              !selectedCategory ? dynamicStyles.primaryBg : dynamicStyles.cardSecondary,
            ]}
            onPress={() => handleCategorySelect(null)}
          >
            <Text
              style={[
                styles.filterChipText,
                !selectedCategory ? styles.filterChipTextActive : dynamicStyles.text,
              ]}
            >
              전체
            </Text>
          </Pressable>

          {/* 카테고리 칩들 */}
          {EXERCISE_CATEGORIES.map((category) => (
            <Pressable
              key={category.id}
              style={[
                styles.filterChip,
                selectedCategory === category.id ? dynamicStyles.primaryBg : dynamicStyles.cardSecondary,
              ]}
              onPress={() => handleCategorySelect(category.id)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedCategory === category.id ? styles.filterChipTextActive : dynamicStyles.text,
                ]}
              >
                {category.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </RNView>

      <ScrollView style={styles.exerciseList}>
        {/* 최근 운동 (빠른 접근) */}
        {showQuickAccess && recentExercises.length > 0 && (
          <RNView style={styles.quickSection}>
            <Text style={[styles.quickSectionTitle, dynamicStyles.textSecondary]}>
              최근 운동
            </Text>
            <RNView style={styles.quickChipsContainer}>
              {recentExercises.map((exercise) => (
                <Pressable
                  key={exercise.id}
                  style={[styles.quickChip, dynamicStyles.card]}
                  onPress={() => handleSelectExercise(exercise)}
                >
                  <Text style={[styles.quickChipText, dynamicStyles.text]} numberOfLines={1}>
                    {exercise.name_ko || exercise.name}
                  </Text>
                  <Text style={[styles.quickChipAdd, dynamicStyles.primary]}>+</Text>
                </Pressable>
              ))}
            </RNView>
          </RNView>
        )}

        {/* 자주 하는 운동 */}
        {showQuickAccess && frequentExercises.length > 0 && (
          <RNView style={styles.quickSection}>
            <Text style={[styles.quickSectionTitle, dynamicStyles.textSecondary]}>
              자주 하는 운동
            </Text>
            <RNView style={styles.quickChipsContainer}>
              {frequentExercises.map((exercise) => (
                <Pressable
                  key={exercise.id}
                  style={[styles.quickChip, dynamicStyles.card]}
                  onPress={() => handleSelectExercise(exercise)}
                >
                  <Text style={[styles.quickChipText, dynamicStyles.text]} numberOfLines={1}>
                    {exercise.name_ko || exercise.name}
                  </Text>
                  <Text style={[styles.quickChipAdd, dynamicStyles.primary]}>+</Text>
                </Pressable>
              ))}
            </RNView>
          </RNView>
        )}

        {/* 운동 목록 헤더 */}
        {(searchQuery || selectedCategory) && (
          <Text style={[styles.listHeader, dynamicStyles.textSecondary]}>
            {searchQuery
              ? `"${searchQuery}" 검색 결과`
              : getCategoryName(selectedCategory!)}
            {' '}({filteredExercises.length})
          </Text>
        )}

        {!searchQuery && !selectedCategory && (
          <Text style={[styles.listHeader, dynamicStyles.textSecondary]}>
            전체 운동 ({filteredExercises.length})
          </Text>
        )}

        {/* 운동 리스트 */}
        {filteredExercises.length > 0 ? (
          filteredExercises.map((exercise) => (
            <RNView key={exercise.id} style={[styles.exerciseItem, dynamicStyles.card]}>
              <Pressable
                style={styles.exerciseInfoPressable}
                onPress={() => handleSelectExercise(exercise)}
              >
                <RNView style={styles.exerciseInfo}>
                  <Text style={[styles.exerciseName, dynamicStyles.text]}>
                    {exercise.name_ko || exercise.name}
                  </Text>
                  <Text style={[styles.exerciseDetail, dynamicStyles.textSecondary]}>
                    {getCategoryName(exercise.category)}
                    {exercise.equipment && ` · ${getEquipmentName(exercise.equipment)}`}
                    {exercise.is_custom && ' · 커스텀'}
                  </Text>
                </RNView>
              </Pressable>
              <RNView style={styles.exerciseActions}>
                {getExerciseGuide(exercise.id) && (
                  <Pressable
                    style={styles.infoButton}
                    onPress={() => handleShowGuide(exercise)}
                    hitSlop={8}
                  >
                    <Text style={[styles.infoIcon, dynamicStyles.textSecondary]}>ℹ️</Text>
                  </Pressable>
                )}
                <Pressable
                  style={styles.addButton}
                  onPress={() => handleSelectExercise(exercise)}
                  hitSlop={8}
                >
                  <Text style={[styles.addIcon, dynamicStyles.primary]}>+</Text>
                </Pressable>
              </RNView>
            </RNView>
          ))
        ) : (
          <RNView style={styles.emptyState}>
            <Text style={[styles.emptyText, dynamicStyles.textSecondary]}>
              검색 결과가 없습니다
            </Text>
            {searchQuery.trim() && (
              <Pressable
                style={[styles.quickCreateButton, dynamicStyles.primaryBg, isCreating && styles.buttonDisabled]}
                onPress={handleCreateQuickExercise}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.quickCreateButtonText}>
                    '{searchQuery.trim()}' 운동 만들고 추가하기
                  </Text>
                )}
              </Pressable>
            )}
          </RNView>
        )}

        {/* 하단 여백 */}
        <RNView style={{ height: 80 }} />
      </ScrollView>

      {/* 커스텀 운동 추가 버튼 */}
      <Pressable
        style={[styles.addCustomButton, dynamicStyles.primaryBg]}
        onPress={() => router.push('/workout/add-exercise')}
      >
        <Text style={styles.addCustomButtonText}>+ 새 운동 만들기</Text>
      </Pressable>

      {/* 운동 가이드 모달 */}
      <Modal
        visible={guideModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setGuideModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setGuideModalVisible(false)}
        >
          <Pressable
            style={[styles.modalContent, dynamicStyles.card]}
            onPress={(e) => e.stopPropagation()}
          >
            {selectedGuide && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {/* 헤더 */}
                <RNView style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, dynamicStyles.text]}>
                    {selectedGuide.exercise.name_ko || selectedGuide.exercise.name}
                  </Text>
                  <RNView
                    style={[
                      styles.difficultyBadge,
                      { backgroundColor: getDifficultyColor(selectedGuide.guide.difficulty) },
                    ]}
                  >
                    <Text style={styles.difficultyText}>
                      {getDifficultyLabel(selectedGuide.guide.difficulty)}
                    </Text>
                  </RNView>
                </RNView>

                {/* 설명 */}
                <RNView style={styles.guideSection}>
                  <Text style={[styles.guideSectionTitle, dynamicStyles.textSecondary]}>
                    설명
                  </Text>
                  <Text style={[styles.guideText, dynamicStyles.text]}>
                    {selectedGuide.guide.description}
                  </Text>
                </RNView>

                {/* 타겟 근육 */}
                <RNView style={styles.guideSection}>
                  <Text style={[styles.guideSectionTitle, dynamicStyles.textSecondary]}>
                    타겟 근육
                  </Text>
                  <Text style={[styles.guideText, dynamicStyles.text]}>
                    {selectedGuide.guide.targetMuscles}
                  </Text>
                </RNView>

                {/* 수행 팁 */}
                <RNView style={styles.guideSection}>
                  <Text style={[styles.guideSectionTitle, dynamicStyles.textSecondary]}>
                    수행 팁
                  </Text>
                  {selectedGuide.guide.tips.map((tip, index) => (
                    <RNView key={index} style={styles.bulletItem}>
                      <Text style={[styles.bullet, dynamicStyles.primary]}>•</Text>
                      <Text style={[styles.bulletText, dynamicStyles.text]}>{tip}</Text>
                    </RNView>
                  ))}
                </RNView>

                {/* 흔한 실수 */}
                <RNView style={styles.guideSection}>
                  <Text style={[styles.guideSectionTitle, dynamicStyles.textSecondary]}>
                    흔한 실수
                  </Text>
                  {selectedGuide.guide.commonMistakes.map((mistake, index) => (
                    <RNView key={index} style={styles.bulletItem}>
                      <Text style={[styles.bullet, { color: '#F44336' }]}>•</Text>
                      <Text style={[styles.bulletText, dynamicStyles.text]}>{mistake}</Text>
                    </RNView>
                  ))}
                </RNView>

                {/* 홈트레이닝 대안 (있는 경우) */}
                {selectedGuide.guide.homeAlternative && (
                  <RNView style={styles.guideSection}>
                    <Text style={[styles.guideSectionTitle, dynamicStyles.textSecondary]}>
                      홈트레이닝 대안
                    </Text>
                    <Text style={[styles.guideText, dynamicStyles.text]}>
                      {selectedGuide.guide.homeAlternative}
                    </Text>
                  </RNView>
                )}

                {/* 닫기 버튼 */}
                <Pressable
                  style={[styles.closeButton, dynamicStyles.cardSecondary]}
                  onPress={() => setGuideModalVisible(false)}
                >
                  <Text style={[styles.closeButtonText, dynamicStyles.text]}>닫기</Text>
                </Pressable>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// 헬퍼 함수들
function getCategoryName(categoryId: string): string {
  const category = EXERCISE_CATEGORIES.find((c) => c.id === categoryId);
  return category?.name || categoryId;
}

function getEquipmentName(equipmentId: string): string {
  const equipmentMap: Record<string, string> = {
    barbell: '바벨',
    dumbbell: '덤벨',
    machine: '머신',
    cable: '케이블',
    kettlebell: '케틀벨',
    bodyweight: '맨몸',
    cardio_machine: '유산소 기구',
    other: '기타',
  };
  return equipmentMap[equipmentId] || equipmentId;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  searchInput: {
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  // 필터 칩
  filterContainer: {
    paddingBottom: 8,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  // 빠른 접근 섹션
  quickSection: {
    marginBottom: 16,
  },
  quickSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  quickChipText: {
    fontSize: 14,
    fontWeight: '500',
    maxWidth: 120,
  },
  quickChipAdd: {
    fontSize: 18,
    fontWeight: '400',
  },
  // 리스트
  exerciseList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listHeader: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  exerciseInfoPressable: {
    flex: 1,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  exerciseDetail: {
    fontSize: 13,
  },
  exerciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoButton: {
    padding: 4,
  },
  infoIcon: {
    fontSize: 18,
  },
  addButton: {
    padding: 4,
  },
  addIcon: {
    fontSize: 24,
    fontWeight: '300',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
  },
  quickCreateButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  quickCreateButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  addCustomButton: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  addCustomButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  difficultyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  guideSection: {
    marginBottom: 16,
  },
  guideSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  guideText: {
    fontSize: 15,
    lineHeight: 22,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  bullet: {
    fontSize: 15,
    marginRight: 8,
    lineHeight: 22,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  closeButton: {
    marginTop: 8,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
