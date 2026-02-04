import { useState, useMemo } from 'react';
import {
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Platform,
  View as RNView,
  Modal,
  Alert,
} from 'react-native';

import { Text, View, useThemeColors } from '@/components/Themed';
import { useExerciseStore, EXERCISE_CATEGORIES } from '@/stores/exerciseStore';
import { useHistoryStore } from '@/stores/historyStore';
import { EQUIPMENT_TYPES } from '@/data/defaultExercises';
import { EXERCISE_GUIDES } from '@/data/exerciseGuides';
import { Exercise } from '@/types/database.types';

export default function ExercisesScreen() {
  const colors = useThemeColors();
  const {
    getAllExercises,
    searchExercises,
    customExercises,
    addCustomExercise,
    removeCustomExercise,
    updateCustomExercise,
  } = useExerciseStore();

  const {
    getExercisesLastPerformed,
    personalRecords,
  } = useHistoryStore();

  // 운동별 마지막 수행일 & PR 데이터
  const lastPerformedDates = useMemo(() => getExercisesLastPerformed(), [getExercisesLastPerformed]);

  // 마지막 수행일 포맷팅
  const formatLastPerformed = (dateString: string | undefined): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '오늘';
    if (diffDays === 1) return '어제';
    if (diffDays < 7) return `${diffDays}일 전`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
    return `${Math.floor(diffDays / 30)}개월 전`;
  };

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
    modalBg: { backgroundColor: colors.background },
    error: { color: colors.error },
    errorBg: { backgroundColor: colors.error },
    warning: { backgroundColor: colors.warning + '20' },
  }), [colors]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // 모달 상태
  const [showAddModal, setShowAddModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // 운동 폼 상태
  const [formName, setFormName] = useState('');
  const [formNameKo, setFormNameKo] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formEquipment, setFormEquipment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // 운동 탭 시 액션 모달 열기
  const handleExercisePress = (exercise: Exercise) => {
    setSelectedExercise(exercise);
    setShowActionModal(true);
  };

  // 삭제
  const handleDeleteExercise = () => {
    if (!selectedExercise || !selectedExercise.is_custom) return;

    const doDelete = async () => {
      try {
        await removeCustomExercise(selectedExercise.id);
        setShowActionModal(false);
        setSelectedExercise(null);
      } catch (error) {
        console.error('Failed to delete exercise:', error);
      }
    };

    if (Platform.OS === 'web') {
      if (confirm(`"${selectedExercise.name_ko || selectedExercise.name}" 운동을 삭제하시겠습니까?`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        '운동 삭제',
        `"${selectedExercise.name_ko || selectedExercise.name}" 운동을 삭제하시겠습니까?`,
        [
          { text: '취소', style: 'cancel' },
          { text: '삭제', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  // 수정 모달 열기
  const handleEditExercise = () => {
    if (!selectedExercise) return;

    setFormName(selectedExercise.name);
    setFormNameKo(selectedExercise.name_ko || '');
    setFormCategory(selectedExercise.category);
    setFormEquipment(selectedExercise.equipment || '');
    setIsEditing(true);
    setShowActionModal(false);
    setShowAddModal(true);
  };

  // 새 운동 추가 모달 열기
  const handleOpenAddModal = () => {
    setFormName('');
    setFormNameKo('');
    setFormCategory('');
    setFormEquipment('');
    setIsEditing(false);
    setSelectedExercise(null);
    setShowAddModal(true);
  };

  // 저장 (추가 또는 수정)
  const handleSaveExercise = async () => {
    if (!formNameKo.trim()) {
      alert('운동 이름을 입력해주세요');
      return;
    }

    if (!formCategory) {
      alert('카테고리를 선택해주세요');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing && selectedExercise) {
        // 수정
        await updateCustomExercise(selectedExercise.id, {
          name: formName.trim() || formNameKo.trim(),
          name_ko: formNameKo.trim(),
          category: formCategory,
          equipment: formEquipment || null,
        });
        if (Platform.OS !== 'web') {
          Alert.alert('완료', '운동이 수정되었습니다');
        }
      } else {
        // 추가
        await addCustomExercise({
          name: formName.trim() || formNameKo.trim(),
          name_ko: formNameKo.trim(),
          category: formCategory,
          muscle_group: [],
          equipment: formEquipment || null,
          user_id: null,
          profile_id: null,
        });
        if (Platform.OS !== 'web') {
          Alert.alert('완료', '운동이 추가되었습니다');
        }
      }

      // 폼 초기화 및 모달 닫기
      setFormName('');
      setFormNameKo('');
      setFormCategory('');
      setFormEquipment('');
      setShowAddModal(false);
      setIsEditing(false);
      setSelectedExercise(null);
    } catch (error) {
      console.error('Failed to save exercise:', error);
      alert('저장에 실패했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 카테고리 아이콘 가져오기
  const getCategoryIcon = (categoryId: string): string => {
    const category = EXERCISE_CATEGORIES.find((c) => c.id === categoryId);
    return (category as any)?.icon || '🏋️';
  };

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
            전체 ({getAllExercises().length})
          </Text>
        </Pressable>
        {EXERCISE_CATEGORIES.map((category) => {
          const count = getAllExercises().filter((e) => e.category === category.id).length;
          if (count === 0) return null;
          return (
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
                {(category as any).icon} {category.name} ({count})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* 운동 목록 */}
      <ScrollView style={styles.exerciseList} showsVerticalScrollIndicator={false}>
        {/* 커스텀 운동 섹션 */}
        {customExercises.length > 0 && !selectedCategory && !searchQuery && (
          <RNView style={styles.categorySection}>
            <Text style={[styles.categorySectionTitle, dynamicStyles.primary]}>
              ⭐ 내가 추가한 운동 ({customExercises.length})
            </Text>
            {customExercises.map((exercise) => (
              <Pressable
                key={exercise.id}
                style={[styles.exerciseItem, dynamicStyles.card]}
                onPress={() => handleExercisePress(exercise)}
              >
                <Text style={styles.exerciseIcon}>{getCategoryIcon(exercise.category)}</Text>
                <RNView style={styles.exerciseInfo}>
                  <Text style={[styles.exerciseName, dynamicStyles.text]}>
                    {exercise.name_ko || exercise.name}
                  </Text>
                  <Text style={[styles.exerciseDetail, dynamicStyles.textSecondary]}>
                    {getCategoryName(exercise.category)}
                    {exercise.equipment && ` • ${getEquipmentName(exercise.equipment)}`}
                  </Text>
                </RNView>
                <Text style={[styles.moreIcon, dynamicStyles.textTertiary]}>⋯</Text>
              </Pressable>
            ))}
          </RNView>
        )}

        {selectedCategory === null && !searchQuery ? (
          // 카테고리별로 표시
          EXERCISE_CATEGORIES.map((cat) => {
            const exercises = groupedExercises[cat.id];
            if (!exercises || exercises.length === 0) return null;
            const defaultExercises = exercises.filter((e) => !e.is_custom);
            if (defaultExercises.length === 0) return null;

            return (
              <RNView key={cat.id} style={styles.categorySection}>
                <Text style={[styles.categorySectionTitle, dynamicStyles.text]}>
                  {(cat as any).icon} {cat.name} ({defaultExercises.length})
                </Text>
                {defaultExercises.map((exercise) => {
                  const lastPerformed = lastPerformedDates[exercise.id];
                  const pr = personalRecords[exercise.id];

                  return (
                    <Pressable
                      key={exercise.id}
                      style={[styles.exerciseItem, dynamicStyles.card]}
                      onPress={() => handleExercisePress(exercise)}
                    >
                      <RNView style={styles.exerciseInfo}>
                        <Text style={[styles.exerciseName, dynamicStyles.text]}>
                          {exercise.name_ko || exercise.name}
                        </Text>
                        <Text style={[styles.exerciseDetail, dynamicStyles.textSecondary]}>
                          {exercise.equipment && getEquipmentName(exercise.equipment)}
                        </Text>
                        {/* 마지막 수행일 & PR 표시 */}
                        {(lastPerformed || pr) && (
                          <RNView style={styles.exerciseMeta}>
                            {lastPerformed && (
                              <Text style={[styles.exerciseMetaText, dynamicStyles.textTertiary]}>
                                {formatLastPerformed(lastPerformed)}
                              </Text>
                            )}
                            {pr && (
                              <Text style={[styles.exerciseMetaText, dynamicStyles.primary]}>
                                PR {pr.max_weight}kg × {pr.max_reps_at_weight}
                              </Text>
                            )}
                          </RNView>
                        )}
                      </RNView>
                    </Pressable>
                  );
                })}
              </RNView>
            );
          })
        ) : (
          // 검색/필터된 목록
          filteredExercises.map((exercise) => {
            const lastPerformed = lastPerformedDates[exercise.id];
            const pr = personalRecords[exercise.id];

            return (
              <Pressable
                key={exercise.id}
                style={[styles.exerciseItem, dynamicStyles.card]}
                onPress={() => handleExercisePress(exercise)}
              >
                <Text style={styles.exerciseIcon}>{getCategoryIcon(exercise.category)}</Text>
                <RNView style={styles.exerciseInfo}>
                  <RNView style={styles.exerciseNameRow}>
                    <Text style={[styles.exerciseName, dynamicStyles.text]}>
                      {exercise.name_ko || exercise.name}
                    </Text>
                    {/* 난이도 배지 */}
                    {EXERCISE_GUIDES[exercise.id] && (
                      <RNView style={[
                        styles.levelBadge,
                        EXERCISE_GUIDES[exercise.id].difficulty === 'beginner' && { backgroundColor: '#22c55e20' },
                        EXERCISE_GUIDES[exercise.id].difficulty === 'intermediate' && { backgroundColor: '#f59e0b20' },
                        EXERCISE_GUIDES[exercise.id].difficulty === 'advanced' && { backgroundColor: '#ef444420' },
                      ]}>
                        <Text style={[
                          styles.levelBadgeText,
                          EXERCISE_GUIDES[exercise.id].difficulty === 'beginner' && { color: '#22c55e' },
                          EXERCISE_GUIDES[exercise.id].difficulty === 'intermediate' && { color: '#f59e0b' },
                          EXERCISE_GUIDES[exercise.id].difficulty === 'advanced' && { color: '#ef4444' },
                        ]}>
                          {EXERCISE_GUIDES[exercise.id].difficulty === 'beginner' ? '초급' :
                           EXERCISE_GUIDES[exercise.id].difficulty === 'intermediate' ? '중급' : '고급'}
                        </Text>
                      </RNView>
                    )}
                  </RNView>
                  <Text style={[styles.exerciseDetail, dynamicStyles.textSecondary]}>
                    {getCategoryName(exercise.category)}
                    {exercise.equipment && ` • ${getEquipmentName(exercise.equipment)}`}
                    {exercise.is_custom && ' • ⭐'}
                  </Text>
                  {/* 마지막 수행일 & PR 표시 */}
                  {(lastPerformed || pr) && (
                    <RNView style={styles.exerciseMeta}>
                      {lastPerformed && (
                        <Text style={[styles.exerciseMetaText, dynamicStyles.textTertiary]}>
                          {formatLastPerformed(lastPerformed)}
                        </Text>
                      )}
                      {pr && (
                        <Text style={[styles.exerciseMetaText, dynamicStyles.primary]}>
                          PR {pr.max_weight}kg × {pr.max_reps_at_weight}
                        </Text>
                      )}
                    </RNView>
                  )}
                </RNView>
                {exercise.is_custom && (
                  <Text style={[styles.moreIcon, dynamicStyles.textTertiary]}>⋯</Text>
                )}
              </Pressable>
            );
          })
        )}

        {filteredExercises.length === 0 && (
          <RNView style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={[styles.emptyText, dynamicStyles.textSecondary]}>검색 결과가 없습니다</Text>
            <Text style={[styles.emptySubtext, dynamicStyles.textTertiary]}>
              새 운동을 직접 추가해보세요
            </Text>
          </RNView>
        )}

        <RNView style={{ height: 100 }} />
      </ScrollView>

      {/* 운동 추가 버튼 */}
      <Pressable
        style={[styles.addButton, dynamicStyles.primaryBg]}
        onPress={handleOpenAddModal}
      >
        <Text style={styles.addButtonText}>+ 새 운동 추가</Text>
      </Pressable>

      {/* 액션 모달 (상세보기/수정/삭제) */}
      <Modal
        visible={showActionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowActionModal(false)}
        >
          <RNView style={[styles.actionModalContent, dynamicStyles.modalBg]}>
            {selectedExercise && (
              <>
                {/* 운동 정보 */}
                <RNView style={styles.actionModalHeader}>
                  <Text style={styles.actionModalIcon}>{getCategoryIcon(selectedExercise.category)}</Text>
                  <RNView style={styles.actionModalTitleContainer}>
                    <Text style={[styles.actionModalTitle, dynamicStyles.text]}>
                      {selectedExercise.name_ko || selectedExercise.name}
                    </Text>
                    {selectedExercise.name_ko && selectedExercise.name !== selectedExercise.name_ko && (
                      <Text style={[styles.actionModalSubtitle, dynamicStyles.textSecondary]}>
                        {selectedExercise.name}
                      </Text>
                    )}
                  </RNView>
                </RNView>

                {/* 상세 정보 */}
                <RNView style={[styles.detailSection, dynamicStyles.cardSecondary]}>
                  <RNView style={styles.detailRow}>
                    <Text style={[styles.detailLabel, dynamicStyles.textSecondary]}>카테고리</Text>
                    <Text style={[styles.detailValue, dynamicStyles.text]}>
                      {getCategoryName(selectedExercise.category)}
                    </Text>
                  </RNView>
                  {selectedExercise.equipment && (
                    <RNView style={styles.detailRow}>
                      <Text style={[styles.detailLabel, dynamicStyles.textSecondary]}>장비</Text>
                      <Text style={[styles.detailValue, dynamicStyles.text]}>
                        {getEquipmentName(selectedExercise.equipment)}
                      </Text>
                    </RNView>
                  )}
                  {selectedExercise.muscle_group && selectedExercise.muscle_group.length > 0 && (
                    <RNView style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                      <Text style={[styles.detailLabel, dynamicStyles.textSecondary]}>근육</Text>
                      <Text style={[styles.detailValue, dynamicStyles.text]}>
                        {selectedExercise.muscle_group.map(getMuscleGroupName).join(', ')}
                      </Text>
                    </RNView>
                  )}
                </RNView>

                {/* 운동 가이드 (있는 경우만 표시) */}
                {selectedExercise && EXERCISE_GUIDES[selectedExercise.id] && (
                  <RNView style={styles.guideSection}>
                    {/* 난이도 배지 */}
                    <RNView style={styles.guideDifficultyRow}>
                      <Text style={[styles.guideLabel, dynamicStyles.textSecondary]}>난이도</Text>
                      <RNView style={[
                        styles.difficultyBadge,
                        EXERCISE_GUIDES[selectedExercise.id].difficulty === 'beginner' && { backgroundColor: '#22c55e20' },
                        EXERCISE_GUIDES[selectedExercise.id].difficulty === 'intermediate' && { backgroundColor: '#f59e0b20' },
                        EXERCISE_GUIDES[selectedExercise.id].difficulty === 'advanced' && { backgroundColor: '#ef444420' },
                      ]}>
                        <Text style={[
                          styles.difficultyText,
                          EXERCISE_GUIDES[selectedExercise.id].difficulty === 'beginner' && { color: '#22c55e' },
                          EXERCISE_GUIDES[selectedExercise.id].difficulty === 'intermediate' && { color: '#f59e0b' },
                          EXERCISE_GUIDES[selectedExercise.id].difficulty === 'advanced' && { color: '#ef4444' },
                        ]}>
                          {EXERCISE_GUIDES[selectedExercise.id].difficulty === 'beginner' ? '초급' :
                           EXERCISE_GUIDES[selectedExercise.id].difficulty === 'intermediate' ? '중급' : '고급'}
                        </Text>
                      </RNView>
                    </RNView>

                    {/* 설명 */}
                    <Text style={[styles.guideDescription, dynamicStyles.text]}>
                      {EXERCISE_GUIDES[selectedExercise.id].description}
                    </Text>

                    {/* 타겟 근육 */}
                    <RNView style={styles.guideTargetRow}>
                      <Text style={[styles.guideLabel, dynamicStyles.textSecondary]}>타겟 근육</Text>
                      <Text style={[styles.guideTargetText, dynamicStyles.primary]}>
                        {EXERCISE_GUIDES[selectedExercise.id].targetMuscles}
                      </Text>
                    </RNView>

                    {/* 팁 */}
                    <RNView style={styles.guideTipsSection}>
                      <Text style={[styles.guideTipsTitle, dynamicStyles.text]}>💡 수행 팁</Text>
                      {EXERCISE_GUIDES[selectedExercise.id].tips.slice(0, 3).map((tip, idx) => (
                        <Text key={idx} style={[styles.guideTipItem, dynamicStyles.textSecondary]}>
                          • {tip}
                        </Text>
                      ))}
                    </RNView>

                    {/* 흔한 실수 */}
                    <RNView style={styles.guideMistakesSection}>
                      <Text style={[styles.guideMistakesTitle, dynamicStyles.text]}>⚠️ 주의할 점</Text>
                      {EXERCISE_GUIDES[selectedExercise.id].commonMistakes.slice(0, 2).map((mistake, idx) => (
                        <Text key={idx} style={[styles.guideMistakeItem, dynamicStyles.textTertiary]}>
                          • {mistake}
                        </Text>
                      ))}
                    </RNView>

                    {/* 홈트 대안 */}
                    {EXERCISE_GUIDES[selectedExercise.id].homeAlternative && (
                      <RNView style={[styles.guideHomeAlt, dynamicStyles.cardSecondary]}>
                        <Text style={[styles.guideHomeAltLabel, dynamicStyles.textSecondary]}>🏠 홈트 대안</Text>
                        <Text style={[styles.guideHomeAltText, dynamicStyles.text]}>
                          {EXERCISE_GUIDES[selectedExercise.id].homeAlternative}
                        </Text>
                      </RNView>
                    )}
                  </RNView>
                )}

                {/* 커스텀 운동인 경우 수정/삭제 버튼 */}
                {selectedExercise.is_custom ? (
                  <RNView style={styles.actionButtons}>
                    <Pressable
                      style={[styles.actionButton, dynamicStyles.card]}
                      onPress={handleEditExercise}
                    >
                      <Text style={styles.actionButtonIcon}>✏️</Text>
                      <Text style={[styles.actionButtonText, dynamicStyles.text]}>수정</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionButton, dynamicStyles.card]}
                      onPress={handleDeleteExercise}
                    >
                      <Text style={styles.actionButtonIcon}>🗑️</Text>
                      <Text style={[styles.actionButtonText, dynamicStyles.error]}>삭제</Text>
                    </Pressable>
                  </RNView>
                ) : (
                  <RNView style={[styles.defaultBadge, dynamicStyles.warning]}>
                    <Text style={[styles.defaultBadgeText, dynamicStyles.textSecondary]}>
                      기본 제공 운동은 수정/삭제할 수 없습니다
                    </Text>
                  </RNView>
                )}

                <Pressable
                  style={[styles.closeButton, dynamicStyles.cardSecondary]}
                  onPress={() => setShowActionModal(false)}
                >
                  <Text style={[styles.closeButtonText, dynamicStyles.textSecondary]}>닫기</Text>
                </Pressable>
              </>
            )}
          </RNView>
        </Pressable>
      </Modal>

      {/* 운동 추가/수정 모달 */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <RNView style={[styles.formModalContainer, dynamicStyles.modalBg]}>
          <RNView style={styles.formModalHeader}>
            <Pressable onPress={() => {
              setShowAddModal(false);
              setIsEditing(false);
            }}>
              <Text style={[styles.formModalCancel, dynamicStyles.textSecondary]}>취소</Text>
            </Pressable>
            <Text style={[styles.formModalTitle, dynamicStyles.text]}>
              {isEditing ? '운동 수정' : '새 운동 추가'}
            </Text>
            <Pressable onPress={handleSaveExercise} disabled={isSubmitting}>
              <Text style={[styles.formModalSave, dynamicStyles.primary]}>
                {isSubmitting ? '저장중...' : '저장'}
              </Text>
            </Pressable>
          </RNView>

          <ScrollView style={styles.formModalContent} keyboardShouldPersistTaps="handled">
            {/* 운동 이름 (한글) */}
            <RNView style={styles.inputGroup}>
              <Text style={[styles.label, dynamicStyles.text]}>운동 이름 *</Text>
              <TextInput
                style={[styles.input, dynamicStyles.cardSecondary, { color: colors.text }]}
                placeholder="예: 타바타 운동, 인터벌 러닝..."
                value={formNameKo}
                onChangeText={setFormNameKo}
                placeholderTextColor={colors.textTertiary}
              />
            </RNView>

            {/* 운동 이름 (영문) */}
            <RNView style={styles.inputGroup}>
              <Text style={[styles.label, dynamicStyles.text]}>영문 이름 (선택)</Text>
              <TextInput
                style={[styles.input, dynamicStyles.cardSecondary, { color: colors.text }]}
                placeholder="예: Tabata Workout"
                value={formName}
                onChangeText={setFormName}
                placeholderTextColor={colors.textTertiary}
              />
            </RNView>

            {/* 카테고리 선택 */}
            <RNView style={styles.inputGroup}>
              <Text style={[styles.label, dynamicStyles.text]}>카테고리 *</Text>
              <RNView style={styles.optionGrid}>
                {EXERCISE_CATEGORIES.map((category) => (
                  <Pressable
                    key={category.id}
                    style={[
                      styles.optionButton,
                      formCategory === category.id ? dynamicStyles.primaryBg : dynamicStyles.cardSecondary,
                    ]}
                    onPress={() => setFormCategory(category.id)}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        formCategory === category.id ? styles.optionButtonTextSelected : dynamicStyles.textSecondary,
                      ]}
                    >
                      {(category as any).icon} {category.name}
                    </Text>
                  </Pressable>
                ))}
              </RNView>
            </RNView>

            {/* 장비 선택 */}
            <RNView style={styles.inputGroup}>
              <Text style={[styles.label, dynamicStyles.text]}>사용 장비 (선택)</Text>
              <RNView style={styles.optionGrid}>
                {EQUIPMENT_TYPES.map((equipment) => (
                  <Pressable
                    key={equipment.id}
                    style={[
                      styles.optionButton,
                      formEquipment === equipment.id ? dynamicStyles.primaryBg : dynamicStyles.cardSecondary,
                    ]}
                    onPress={() =>
                      setFormEquipment(formEquipment === equipment.id ? '' : equipment.id)
                    }
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        formEquipment === equipment.id ? styles.optionButtonTextSelected : dynamicStyles.textSecondary,
                      ]}
                    >
                      {equipment.name}
                    </Text>
                  </Pressable>
                ))}
              </RNView>
            </RNView>

            {/* 도움말 */}
            <RNView style={[styles.helpBox, dynamicStyles.cardSecondary]}>
              <Text style={[styles.helpTitle, dynamicStyles.text]}>💡 팁</Text>
              <Text style={[styles.helpText, dynamicStyles.textSecondary]}>
                타바타, HIIT, 유산소, 스트레칭 등 헬스장 운동 외에도{'\n'}
                자유롭게 운동을 추가할 수 있습니다.
              </Text>
            </RNView>

            <RNView style={{ height: 40 }} />
          </ScrollView>
        </RNView>
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

function getMuscleGroupName(muscleGroup: string): string {
  const muscleMap: Record<string, string> = {
    chest: '가슴',
    back: '등',
    shoulders: '어깨',
    biceps: '이두',
    triceps: '삼두',
    forearms: '전완',
    quadriceps: '대퇴사두',
    hamstrings: '햄스트링',
    glutes: '둔근',
    calves: '종아리',
    core: '코어',
    legs: '하체',
    cardio: '심폐',
    full_body: '전신',
  };
  return muscleMap[muscleGroup] || muscleGroup;
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  categoryChipText: {
    fontSize: 13,
  },
  categoryChipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  exerciseList: {
    flex: 1,
    padding: 16,
    paddingTop: 8,
  },
  categorySection: {
    marginBottom: 24,
  },
  categorySectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  exerciseIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  exerciseDetail: {
    fontSize: 12,
  },
  exerciseMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  exerciseMetaText: {
    fontSize: 11,
  },
  moreIcon: {
    fontSize: 18,
    paddingHorizontal: 8,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
  },
  addButton: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Action Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  actionModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionModalIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  actionModalTitleContainer: {
    flex: 1,
  },
  actionModalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  actionModalSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  detailSection: {
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.1)',
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonIcon: {
    fontSize: 18,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  defaultBadge: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    alignItems: 'center',
  },
  defaultBadgeText: {
    fontSize: 13,
  },
  closeButton: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },

  // Form Modal
  formModalContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  formModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  formModalCancel: {
    fontSize: 16,
  },
  formModalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  formModalSave: {
    fontSize: 16,
    fontWeight: '600',
  },
  formModalContent: {
    flex: 1,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  input: {
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  optionButtonText: {
    fontSize: 13,
  },
  optionButtonTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  helpBox: {
    padding: 16,
    borderRadius: 12,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 13,
    lineHeight: 20,
  },

  // 운동 가이드 스타일
  guideSection: {
    marginBottom: 16,
  },
  guideDifficultyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  guideLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  difficultyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  guideDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  guideTargetRow: {
    marginBottom: 12,
  },
  guideTargetText: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  guideTipsSection: {
    marginBottom: 12,
  },
  guideTipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  guideTipItem: {
    fontSize: 13,
    lineHeight: 20,
    marginLeft: 4,
    marginBottom: 4,
  },
  guideMistakesSection: {
    marginBottom: 12,
  },
  guideMistakesTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  guideMistakeItem: {
    fontSize: 13,
    lineHeight: 20,
    marginLeft: 4,
    marginBottom: 4,
  },
  guideHomeAlt: {
    padding: 12,
    borderRadius: 10,
  },
  guideHomeAltLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  guideHomeAltText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // 운동 목록 난이도 배지
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  levelBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
