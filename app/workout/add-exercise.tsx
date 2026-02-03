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
import { useExerciseStore, EXERCISE_CATEGORIES } from '@/stores/exerciseStore';
import { EQUIPMENT_TYPES } from '@/data/defaultExercises';

export default function AddExerciseScreen() {
  const colors = useThemeColors();
  const { addCustomExercise } = useExerciseStore();

  const [name, setName] = useState('');
  const [nameKo, setNameKo] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedEquipment, setSelectedEquipment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSubmit = async () => {
    if (!nameKo.trim()) {
      alert('운동 이름을 입력해주세요');
      return;
    }

    if (!selectedCategory) {
      alert('카테고리를 선택해주세요');
      return;
    }

    setIsSubmitting(true);

    try {
      await addCustomExercise({
        name: name.trim() || nameKo.trim(),
        name_ko: nameKo.trim(),
        category: selectedCategory,
        muscle_group: [],
        equipment: selectedEquipment || null,
        user_id: null,
      });

      if (Platform.OS === 'web') {
        alert('운동이 추가되었습니다');
      }
      router.back();
    } catch (error) {
      console.error('Failed to add custom exercise:', error);
      alert('운동 추가에 실패했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={[styles.container, dynamicStyles.container]}>
      <RNView style={styles.content}>
        {/* 운동 이름 (한글) */}
        <RNView style={styles.inputGroup}>
          <Text style={[styles.label, dynamicStyles.text]}>운동 이름 *</Text>
          <TextInput
            style={[styles.input, dynamicStyles.cardSecondary, { color: colors.text }]}
            placeholder="예: 컨센트레이션 컬"
            value={nameKo}
            onChangeText={setNameKo}
            placeholderTextColor={colors.textTertiary}
          />
        </RNView>

        {/* 운동 이름 (영문) - 선택사항 */}
        <RNView style={styles.inputGroup}>
          <Text style={[styles.label, dynamicStyles.text]}>영문 이름 (선택)</Text>
          <TextInput
            style={[styles.input, dynamicStyles.cardSecondary, { color: colors.text }]}
            placeholder="예: Concentration Curl"
            value={name}
            onChangeText={setName}
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
                  selectedCategory === category.id ? dynamicStyles.primaryBg : dynamicStyles.cardSecondary,
                ]}
                onPress={() => setSelectedCategory(category.id)}
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    selectedCategory === category.id ? styles.optionButtonTextSelected : dynamicStyles.textSecondary,
                  ]}
                >
                  {category.name}
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
                  selectedEquipment === equipment.id ? dynamicStyles.primaryBg : dynamicStyles.cardSecondary,
                ]}
                onPress={() =>
                  setSelectedEquipment(
                    selectedEquipment === equipment.id ? '' : equipment.id
                  )
                }
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    selectedEquipment === equipment.id ? styles.optionButtonTextSelected : dynamicStyles.textSecondary,
                  ]}
                >
                  {equipment.name}
                </Text>
              </Pressable>
            ))}
          </RNView>
        </RNView>

        {/* 저장 버튼 */}
        <Pressable
          style={[styles.submitButton, dynamicStyles.primaryBg, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? '저장 중...' : '운동 추가'}
          </Text>
        </Pressable>
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
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  optionButtonText: {
    fontSize: 14,
  },
  optionButtonTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  submitButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
