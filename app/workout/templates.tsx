import { useState, useMemo } from 'react';
import {
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  TextInput,
  Modal,
  View as RNView,
} from 'react-native';
import { router } from 'expo-router';

import { Text, useThemeColors } from '@/components/Themed';
import { useTemplateStore, WorkoutTemplate, TemplateExercise } from '@/stores/templateStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useExerciseStore, EXERCISE_CATEGORIES } from '@/stores/exerciseStore';
import { Exercise } from '@/types/database.types';

export default function TemplatesScreen() {
  const colors = useThemeColors();
  const { templates, deleteTemplate, createTemplate, updateTemplate } = useTemplateStore();
  const { startWorkout, addExercise } = useWorkoutStore();
  const { getAllExercises } = useExerciseStore();

  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplate | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // 템플릿 생성/편집 상태
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [selectedExercises, setSelectedExercises] = useState<TemplateExercise[]>([]);
  const [exercisePickerVisible, setExercisePickerVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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
    error: { color: colors.error },
    errorBg: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
    success: { color: colors.success },
    successBg: { backgroundColor: colors.success },
  }), [colors]);

  const getCategoryName = (categoryId: string) => {
    const category = EXERCISE_CATEGORIES.find((c) => c.id === categoryId);
    return category?.name || categoryId;
  };

  const handleDeleteTemplate = (template: WorkoutTemplate) => {
    if (Platform.OS === 'web') {
      if (confirm(`"${template.name}" 템플릿을 삭제하시겠습니까?`)) {
        deleteTemplate(template.id);
      }
    } else {
      Alert.alert(
        '템플릿 삭제',
        `"${template.name}" 템플릿을 삭제하시겠습니까?`,
        [
          { text: '취소', style: 'cancel' },
          {
            text: '삭제',
            style: 'destructive',
            onPress: () => deleteTemplate(template.id),
          },
        ]
      );
    }
  };

  const handleStartFromTemplate = async (template: WorkoutTemplate) => {
    try {
      await startWorkout(template.name);
      const allExercises = getAllExercises();
      for (const templateExercise of template.exercises) {
        const exercise = allExercises.find((e) => e.id === templateExercise.exercise_id);
        if (exercise) {
          await addExercise(exercise);
        }
      }
      useTemplateStore.getState().incrementUseCount(template.id);
      router.replace('/workout/active');
    } catch (error) {
      console.error('Failed to start workout from template:', error);
      if (Platform.OS === 'web') {
        alert('템플릿에서 운동을 시작할 수 없습니다');
      } else {
        Alert.alert('오류', '템플릿에서 운동을 시작할 수 없습니다');
      }
    }
  };

  const openTemplateDetail = (template: WorkoutTemplate) => {
    setSelectedTemplate(template);
    setDetailModalVisible(true);
  };

  // 템플릿 생성 모달 열기
  const openCreateModal = () => {
    setEditMode(false);
    setTemplateName('');
    setTemplateDescription('');
    setSelectedExercises([]);
    setCreateModalVisible(true);
  };

  // 템플릿 편집 모달 열기
  const openEditModal = (template: WorkoutTemplate) => {
    setEditMode(true);
    setSelectedTemplate(template);
    setTemplateName(template.name);
    setTemplateDescription(template.description || '');
    setSelectedExercises([...template.exercises]);
    setDetailModalVisible(false);
    setCreateModalVisible(true);
  };

  // 운동 추가
  const handleAddExercise = (exercise: Exercise) => {
    const newExercise: TemplateExercise = {
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      exercise_name_ko: exercise.name_ko,
      category: exercise.category,
      target_sets: 3,
      target_reps: 10,
      target_weight: null,
      notes: null,
    };
    setSelectedExercises([...selectedExercises, newExercise]);
    setExercisePickerVisible(false);
    setSearchQuery('');
  };

  // 운동 제거
  const handleRemoveExercise = (index: number) => {
    setSelectedExercises(selectedExercises.filter((_, i) => i !== index));
  };

  // 운동 세트/횟수 수정
  const updateExerciseTarget = (index: number, field: 'target_sets' | 'target_reps' | 'target_weight', value: string) => {
    const numValue = parseInt(value, 10) || 0;
    setSelectedExercises(selectedExercises.map((e, i) =>
      i === index ? { ...e, [field]: field === 'target_weight' && numValue === 0 ? null : numValue } : e
    ));
  };

  // 템플릿 저장
  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      if (Platform.OS === 'web') {
        alert('템플릿 이름을 입력해주세요');
      } else {
        Alert.alert('오류', '템플릿 이름을 입력해주세요');
      }
      return;
    }

    if (selectedExercises.length === 0) {
      if (Platform.OS === 'web') {
        alert('최소 1개 이상의 운동을 추가해주세요');
      } else {
        Alert.alert('오류', '최소 1개 이상의 운동을 추가해주세요');
      }
      return;
    }

    if (editMode && selectedTemplate) {
      updateTemplate(selectedTemplate.id, {
        name: templateName.trim(),
        description: templateDescription.trim() || null,
        exercises: selectedExercises,
      });
    } else {
      createTemplate({
        name: templateName.trim(),
        description: templateDescription.trim() || null,
        exercises: selectedExercises,
      });
    }

    setCreateModalVisible(false);
    if (Platform.OS === 'web') {
      alert(editMode ? '템플릿이 수정되었습니다' : '템플릿이 생성되었습니다');
    }
  };

  // 운동 필터링
  const filteredExercises = useMemo(() => {
    let exercises = getAllExercises();
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      exercises = exercises.filter(
        (e) =>
          e.name.toLowerCase().includes(query) ||
          (e.name_ko && e.name_ko.toLowerCase().includes(query))
      );
    }
    if (selectedCategory) {
      exercises = exercises.filter((e) => e.category === selectedCategory);
    }
    return exercises;
  }, [getAllExercises, searchQuery, selectedCategory]);

  return (
    <RNView style={[styles.container, dynamicStyles.container]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* 템플릿 생성 버튼 */}
        <Pressable
          style={[styles.createButton, dynamicStyles.primaryBg]}
          onPress={openCreateModal}
        >
          <Text style={styles.createButtonText}>+ 새 템플릿 만들기</Text>
        </Pressable>

        {templates.length === 0 ? (
          <RNView style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={[styles.emptyText, dynamicStyles.text]}>저장된 템플릿이 없습니다</Text>
            <Text style={[styles.emptySubtext, dynamicStyles.textSecondary]}>
              위 버튼을 눌러 나만의 운동 루틴을{'\n'}
              템플릿으로 만들어보세요
            </Text>
          </RNView>
        ) : (
          templates.map((template) => (
            <Pressable
              key={template.id}
              style={[styles.templateCard, dynamicStyles.card]}
              onPress={() => openTemplateDetail(template)}
              onLongPress={() => handleDeleteTemplate(template)}
            >
              <RNView style={styles.templateHeader}>
                <RNView style={styles.templateHeaderLeft}>
                  <Text style={[styles.templateName, dynamicStyles.text]}>{template.name}</Text>
                  {template.use_count > 0 && (
                    <Text style={[styles.useCountText, dynamicStyles.textTertiary]}>{template.use_count}회 사용</Text>
                  )}
                </RNView>
                <Text style={[styles.templateArrow, dynamicStyles.textTertiary]}>›</Text>
              </RNView>

              {template.description && (
                <Text style={[styles.templateDescription, dynamicStyles.textSecondary]}>{template.description}</Text>
              )}

              <RNView style={styles.exercisePreview}>
                {template.exercises.slice(0, 4).map((exercise, idx) => (
                  <RNView key={idx} style={[styles.exerciseChip, dynamicStyles.cardSecondary]}>
                    <Text style={[styles.exerciseChipText, dynamicStyles.textSecondary]} numberOfLines={1}>
                      {exercise.exercise_name_ko || exercise.exercise_name}
                    </Text>
                  </RNView>
                ))}
                {template.exercises.length > 4 && (
                  <RNView style={[styles.exerciseChip, dynamicStyles.cardSecondary]}>
                    <Text style={[styles.exerciseChipText, dynamicStyles.textTertiary]}>
                      +{template.exercises.length - 4}
                    </Text>
                  </RNView>
                )}
              </RNView>
            </Pressable>
          ))
        )}
      </ScrollView>

      {/* 템플릿 상세 모달 */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        {selectedTemplate && (
          <RNView style={[styles.modalContainer, dynamicStyles.container]}>
            <RNView style={[styles.modalHeader, dynamicStyles.card, { borderBottomColor: colors.border }]}>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setDetailModalVisible(false)}
              >
                <Text style={[styles.modalCloseText, dynamicStyles.textSecondary]}>닫기</Text>
              </Pressable>
              <Text style={[styles.modalTitle, dynamicStyles.text]}>{selectedTemplate.name}</Text>
              <Pressable
                style={styles.modalStartButton}
                onPress={() => openEditModal(selectedTemplate)}
              >
                <Text style={[styles.modalStartText, dynamicStyles.primary]}>편집</Text>
              </Pressable>
            </RNView>

            <ScrollView style={styles.modalContent}>
              {selectedTemplate.description && (
                <Text style={[styles.modalDescription, dynamicStyles.textSecondary]}>
                  {selectedTemplate.description}
                </Text>
              )}

              <Text style={[styles.modalSectionTitle, dynamicStyles.text]}>운동 목록</Text>

              {selectedTemplate.exercises.map((exercise, idx) => (
                <RNView key={idx} style={[styles.detailExerciseCard, dynamicStyles.card]}>
                  <RNView style={styles.detailExerciseHeader}>
                    <Text style={[styles.detailExerciseNumber, dynamicStyles.textTertiary]}>#{idx + 1}</Text>
                    <RNView style={styles.detailExerciseInfo}>
                      <Text style={[styles.detailExerciseName, dynamicStyles.text]}>
                        {exercise.exercise_name_ko || exercise.exercise_name}
                      </Text>
                      <RNView style={[styles.detailCategoryBadge, dynamicStyles.primaryLightBg]}>
                        <Text style={[styles.detailCategoryText, dynamicStyles.primary]}>
                          {getCategoryName(exercise.category)}
                        </Text>
                      </RNView>
                    </RNView>
                  </RNView>

                  <RNView style={[styles.detailTargets, dynamicStyles.cardSecondary]}>
                    <RNView style={styles.detailTarget}>
                      <Text style={[styles.detailTargetValue, dynamicStyles.text]}>
                        {exercise.target_sets}
                      </Text>
                      <Text style={[styles.detailTargetLabel, dynamicStyles.textSecondary]}>세트</Text>
                    </RNView>
                    <RNView style={styles.detailTarget}>
                      <Text style={[styles.detailTargetValue, dynamicStyles.text]}>
                        {exercise.target_reps}
                      </Text>
                      <Text style={[styles.detailTargetLabel, dynamicStyles.textSecondary]}>횟수</Text>
                    </RNView>
                    {exercise.target_weight && (
                      <RNView style={styles.detailTarget}>
                        <Text style={[styles.detailTargetValue, dynamicStyles.text]}>
                          {exercise.target_weight}
                        </Text>
                        <Text style={[styles.detailTargetLabel, dynamicStyles.textSecondary]}>kg</Text>
                      </RNView>
                    )}
                  </RNView>
                </RNView>
              ))}

              <RNView style={[styles.templateInfo, dynamicStyles.cardSecondary]}>
                <Text style={[styles.templateInfoText, dynamicStyles.textSecondary]}>
                  생성: {new Date(selectedTemplate.created_at).toLocaleDateString('ko-KR')}
                </Text>
                {selectedTemplate.last_used_at && (
                  <Text style={[styles.templateInfoText, dynamicStyles.textSecondary]}>
                    마지막 사용: {new Date(selectedTemplate.last_used_at).toLocaleDateString('ko-KR')}
                  </Text>
                )}
              </RNView>

              <Pressable
                style={[styles.startTemplateButton, dynamicStyles.successBg]}
                onPress={() => {
                  setDetailModalVisible(false);
                  handleStartFromTemplate(selectedTemplate);
                }}
              >
                <Text style={styles.startTemplateButtonText}>이 템플릿으로 운동 시작</Text>
              </Pressable>

              <Pressable
                style={[styles.deleteTemplateButton, dynamicStyles.errorBg]}
                onPress={() => {
                  setDetailModalVisible(false);
                  handleDeleteTemplate(selectedTemplate);
                }}
              >
                <Text style={[styles.deleteTemplateText, dynamicStyles.error]}>템플릿 삭제</Text>
              </Pressable>
            </ScrollView>
          </RNView>
        )}
      </Modal>

      {/* 템플릿 생성/편집 모달 */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <RNView style={[styles.modalContainer, dynamicStyles.container]}>
          <RNView style={[styles.modalHeader, dynamicStyles.card, { borderBottomColor: colors.border }]}>
            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setCreateModalVisible(false)}
            >
              <Text style={[styles.modalCloseText, dynamicStyles.textSecondary]}>취소</Text>
            </Pressable>
            <Text style={[styles.modalTitle, dynamicStyles.text]}>
              {editMode ? '템플릿 편집' : '새 템플릿'}
            </Text>
            <Pressable style={styles.modalStartButton} onPress={handleSaveTemplate}>
              <Text style={[styles.modalStartText, dynamicStyles.primary]}>저장</Text>
            </Pressable>
          </RNView>

          <ScrollView style={styles.modalContent}>
            {/* 템플릿 이름 */}
            <Text style={[styles.inputLabel, dynamicStyles.text]}>템플릿 이름 *</Text>
            <TextInput
              style={[styles.textInput, dynamicStyles.cardSecondary, { color: colors.text }]}
              placeholder="예: 가슴 + 삼두 루틴"
              value={templateName}
              onChangeText={setTemplateName}
              placeholderTextColor={colors.textTertiary}
            />

            {/* 설명 */}
            <Text style={[styles.inputLabel, dynamicStyles.text]}>설명 (선택)</Text>
            <TextInput
              style={[styles.textInput, styles.textInputMultiline, dynamicStyles.cardSecondary, { color: colors.text }]}
              placeholder="예: 월요일 루틴, 상체 집중"
              value={templateDescription}
              onChangeText={setTemplateDescription}
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={2}
            />

            {/* 운동 목록 */}
            <RNView style={styles.exercisesHeader}>
              <Text style={[styles.inputLabel, dynamicStyles.text]}>운동 목록 ({selectedExercises.length})</Text>
              <Pressable
                style={[styles.addExerciseButton, dynamicStyles.primaryLightBg]}
                onPress={() => setExercisePickerVisible(true)}
              >
                <Text style={[styles.addExerciseButtonText, dynamicStyles.primary]}>+ 운동 추가</Text>
              </Pressable>
            </RNView>

            {selectedExercises.length === 0 ? (
              <RNView style={[styles.noExercises, dynamicStyles.cardSecondary]}>
                <Text style={[styles.noExercisesText, dynamicStyles.textSecondary]}>
                  운동을 추가해주세요
                </Text>
              </RNView>
            ) : (
              selectedExercises.map((exercise, idx) => (
                <RNView key={idx} style={[styles.exerciseEditCard, dynamicStyles.card]}>
                  <RNView style={styles.exerciseEditHeader}>
                    <Text style={[styles.exerciseEditNumber, dynamicStyles.textTertiary]}>#{idx + 1}</Text>
                    <Text style={[styles.exerciseEditName, dynamicStyles.text]} numberOfLines={1}>
                      {exercise.exercise_name_ko || exercise.exercise_name}
                    </Text>
                    <Pressable onPress={() => handleRemoveExercise(idx)}>
                      <Text style={[styles.removeButton, dynamicStyles.error]}>삭제</Text>
                    </Pressable>
                  </RNView>

                  <RNView style={styles.exerciseEditInputs}>
                    <RNView style={styles.exerciseEditInput}>
                      <Text style={[styles.exerciseEditInputLabel, dynamicStyles.textSecondary]}>세트</Text>
                      <TextInput
                        style={[styles.exerciseEditInputField, dynamicStyles.cardSecondary, { color: colors.text }]}
                        keyboardType="numeric"
                        value={exercise.target_sets.toString()}
                        onChangeText={(v) => updateExerciseTarget(idx, 'target_sets', v)}
                      />
                    </RNView>
                    <RNView style={styles.exerciseEditInput}>
                      <Text style={[styles.exerciseEditInputLabel, dynamicStyles.textSecondary]}>횟수</Text>
                      <TextInput
                        style={[styles.exerciseEditInputField, dynamicStyles.cardSecondary, { color: colors.text }]}
                        keyboardType="numeric"
                        value={exercise.target_reps.toString()}
                        onChangeText={(v) => updateExerciseTarget(idx, 'target_reps', v)}
                      />
                    </RNView>
                    <RNView style={styles.exerciseEditInput}>
                      <Text style={[styles.exerciseEditInputLabel, dynamicStyles.textSecondary]}>무게(kg)</Text>
                      <TextInput
                        style={[styles.exerciseEditInputField, dynamicStyles.cardSecondary, { color: colors.text }]}
                        keyboardType="numeric"
                        placeholder="-"
                        value={exercise.target_weight?.toString() || ''}
                        onChangeText={(v) => updateExerciseTarget(idx, 'target_weight', v)}
                        placeholderTextColor={colors.textTertiary}
                      />
                    </RNView>
                  </RNView>
                </RNView>
              ))
            )}

            <RNView style={{ height: 40 }} />
          </ScrollView>
        </RNView>
      </Modal>

      {/* 운동 선택 모달 */}
      <Modal
        visible={exercisePickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setExercisePickerVisible(false)}
      >
        <RNView style={[styles.modalContainer, dynamicStyles.container]}>
          <RNView style={[styles.modalHeader, dynamicStyles.card, { borderBottomColor: colors.border }]}>
            <Pressable
              style={styles.modalCloseButton}
              onPress={() => {
                setExercisePickerVisible(false);
                setSearchQuery('');
                setSelectedCategory(null);
              }}
            >
              <Text style={[styles.modalCloseText, dynamicStyles.textSecondary]}>닫기</Text>
            </Pressable>
            <Text style={[styles.modalTitle, dynamicStyles.text]}>운동 추가</Text>
            <RNView style={{ width: 50 }} />
          </RNView>

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
            style={styles.categoryFilter}
            contentContainerStyle={styles.categoryFilterContent}
          >
            <Pressable
              style={[
                styles.categoryChip,
                selectedCategory === null ? dynamicStyles.primaryBg : dynamicStyles.cardSecondary,
              ]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[
                styles.categoryChipText,
                selectedCategory === null ? styles.categoryChipTextSelected : dynamicStyles.textSecondary,
              ]}>
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
                <Text style={[
                  styles.categoryChipText,
                  selectedCategory === category.id ? styles.categoryChipTextSelected : dynamicStyles.textSecondary,
                ]}>
                  {category.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* 운동 목록 */}
          <ScrollView style={styles.exercisePickerList}>
            {filteredExercises.map((exercise) => {
              const isAdded = selectedExercises.some((e) => e.exercise_id === exercise.id);
              return (
                <Pressable
                  key={exercise.id}
                  style={[styles.exercisePickerItem, dynamicStyles.card, isAdded && styles.exercisePickerItemAdded]}
                  onPress={() => !isAdded && handleAddExercise(exercise)}
                  disabled={isAdded}
                >
                  <RNView style={styles.exercisePickerInfo}>
                    <Text style={[styles.exercisePickerName, dynamicStyles.text]}>
                      {exercise.name_ko || exercise.name}
                    </Text>
                    <Text style={[styles.exercisePickerCategory, dynamicStyles.textSecondary]}>
                      {getCategoryName(exercise.category)}
                    </Text>
                  </RNView>
                  {isAdded ? (
                    <Text style={[styles.addedText, dynamicStyles.textTertiary]}>추가됨</Text>
                  ) : (
                    <Text style={[styles.addIcon, dynamicStyles.primary]}>+</Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </RNView>
      </Modal>
    </RNView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  createButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    marginTop: 20,
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
    lineHeight: 20,
  },
  templateCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  templateHeaderLeft: {
    flex: 1,
  },
  templateName: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  useCountText: {
    fontSize: 12,
  },
  templateArrow: {
    fontSize: 24,
    fontWeight: '300',
    marginLeft: 8,
  },
  templateDescription: {
    fontSize: 14,
    marginBottom: 10,
  },
  exercisePreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  exerciseChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  exerciseChipText: {
    fontSize: 13,
    maxWidth: 100,
  },

  // 모달 스타일
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalCloseButton: {
    padding: 4,
    minWidth: 50,
  },
  modalCloseText: {
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalStartButton: {
    padding: 4,
    minWidth: 50,
    alignItems: 'flex-end',
  },
  modalStartText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  detailExerciseCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  detailExerciseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  detailExerciseNumber: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 12,
    marginTop: 2,
  },
  detailExerciseInfo: {
    flex: 1,
  },
  detailExerciseName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  detailCategoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  detailCategoryText: {
    fontSize: 11,
    fontWeight: '500',
  },
  detailTargets: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderRadius: 8,
    padding: 12,
  },
  detailTarget: {
    alignItems: 'center',
  },
  detailTargetValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  detailTargetLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  templateInfo: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  templateInfoText: {
    fontSize: 13,
    marginBottom: 4,
  },
  startTemplateButton: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  startTemplateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteTemplateButton: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 40,
  },
  deleteTemplateText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // 생성/편집 모달
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  textInputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  exercisesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  addExerciseButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addExerciseButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  noExercises: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  noExercisesText: {
    fontSize: 14,
  },
  exerciseEditCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  exerciseEditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseEditNumber: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 8,
  },
  exerciseEditName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  removeButton: {
    fontSize: 14,
    fontWeight: '500',
  },
  exerciseEditInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  exerciseEditInput: {
    flex: 1,
  },
  exerciseEditInputLabel: {
    fontSize: 11,
    marginBottom: 4,
    textAlign: 'center',
  },
  exerciseEditInputField: {
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    textAlign: 'center',
  },

  // 운동 선택기
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchInput: {
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },
  categoryFilter: {
    maxHeight: 50,
  },
  categoryFilterContent: {
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
  exercisePickerList: {
    flex: 1,
    padding: 16,
  },
  exercisePickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  exercisePickerItemAdded: {
    opacity: 0.5,
  },
  exercisePickerInfo: {
    flex: 1,
  },
  exercisePickerName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  exercisePickerCategory: {
    fontSize: 13,
  },
  addedText: {
    fontSize: 14,
  },
  addIcon: {
    fontSize: 24,
    fontWeight: '300',
  },
});
