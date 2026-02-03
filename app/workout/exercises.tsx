import { useState, useMemo } from 'react';
import {
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Platform,
  View as RNView,
} from 'react-native';
import { router } from 'expo-router';

import { Text, View, useThemeColors } from '@/components/Themed';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useExerciseStore, EXERCISE_CATEGORIES } from '@/stores/exerciseStore';
import { Exercise } from '@/types/database.types';

export default function ExerciseSelectScreen() {
  const colors = useThemeColors();
  const { addExercise } = useWorkoutStore();
  const { getAllExercises, searchExercises } = useExerciseStore();

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

  const filteredExercises = getFilteredExercises();

  // 카테고리별로 그룹화
  const groupedExercises = filteredExercises.reduce((acc, exercise) => {
    const category = exercise.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(exercise);
    return acc;
  }, {} as Record<string, Exercise[]>);

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

      {/* 카테고리 필터 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryContainer}
        contentContainerStyle={styles.categoryContent}
      >
        <Pressable
          style={[
            styles.categoryChip,
            selectedCategory === null ? dynamicStyles.primaryBg : dynamicStyles.cardSecondary,
          ]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text
            style={[
              styles.categoryChipText,
              selectedCategory === null ? styles.categoryChipTextSelected : dynamicStyles.textSecondary,
            ]}
          >
            전체
          </Text>
        </Pressable>
        {EXERCISE_CATEGORIES.map((category) => (
          <Pressable
            key={category.id}
            style={[
              styles.categoryChip,
              selectedCategory === category.id ? dynamicStyles.primaryBg : dynamicStyles.cardSecondary,
            ]}
            onPress={() => setSelectedCategory(category.id)}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === category.id ? styles.categoryChipTextSelected : dynamicStyles.textSecondary,
              ]}
            >
              {category.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* 운동 목록 */}
      <ScrollView style={styles.exerciseList}>
        {selectedCategory === null && !searchQuery ? (
          // 카테고리별로 표시
          Object.entries(groupedExercises).map(([categoryId, exercises]) => {
            const category = EXERCISE_CATEGORIES.find((c) => c.id === categoryId);
            return (
              <RNView key={categoryId} style={styles.categorySection}>
                <Text style={[styles.categorySectionTitle, dynamicStyles.text]}>
                  {category?.name || categoryId}
                </Text>
                {exercises.map((exercise) => (
                  <Pressable
                    key={exercise.id}
                    style={[styles.exerciseItem, dynamicStyles.card]}
                    onPress={() => handleSelectExercise(exercise)}
                  >
                    <RNView style={styles.exerciseInfo}>
                      <Text style={[styles.exerciseName, dynamicStyles.text]}>
                        {exercise.name_ko || exercise.name}
                      </Text>
                      <Text style={[styles.exerciseDetail, dynamicStyles.textSecondary]}>
                        {exercise.equipment && getEquipmentName(exercise.equipment)}
                        {exercise.is_custom && ' • 커스텀'}
                      </Text>
                    </RNView>
                    <Text style={[styles.addIcon, dynamicStyles.primary]}>+</Text>
                  </Pressable>
                ))}
              </RNView>
            );
          })
        ) : (
          // 검색/필터된 목록
          filteredExercises.map((exercise) => (
            <Pressable
              key={exercise.id}
              style={[styles.exerciseItem, dynamicStyles.card]}
              onPress={() => handleSelectExercise(exercise)}
            >
              <RNView style={styles.exerciseInfo}>
                <Text style={[styles.exerciseName, dynamicStyles.text]}>
                  {exercise.name_ko || exercise.name}
                </Text>
                <Text style={[styles.exerciseDetail, dynamicStyles.textSecondary]}>
                  {getCategoryName(exercise.category)}
                  {exercise.equipment && ` • ${getEquipmentName(exercise.equipment)}`}
                  {exercise.is_custom && ' • 커스텀'}
                </Text>
              </RNView>
              <Text style={[styles.addIcon, dynamicStyles.primary]}>+</Text>
            </Pressable>
          ))
        )}

        {filteredExercises.length === 0 && (
          <RNView style={styles.emptyState}>
            <Text style={[styles.emptyText, dynamicStyles.textSecondary]}>검색 결과가 없습니다</Text>
          </RNView>
        )}
      </ScrollView>

      {/* 커스텀 운동 추가 버튼 */}
      <Pressable
        style={[styles.addCustomButton, dynamicStyles.primaryBg]}
        onPress={() => router.push('/workout/add-exercise')}
      >
        <Text style={styles.addCustomButtonText}>+ 새 운동 만들기</Text>
      </Pressable>
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
    bodyweight: '맨몸',
    other: '기타',
  };
  return equipmentMap[equipmentId] || equipmentId;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchInput: {
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },
  categoryContainer: {
    maxHeight: 50,
  },
  categoryContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  categoryChipText: {
    fontSize: 14,
  },
  categoryChipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  exerciseList: {
    flex: 1,
    padding: 16,
  },
  categorySection: {
    marginBottom: 24,
  },
  categorySectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  exerciseDetail: {
    fontSize: 13,
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
  addCustomButton: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  addCustomButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
