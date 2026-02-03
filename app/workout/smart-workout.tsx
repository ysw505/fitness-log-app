import { useState, useMemo } from 'react';
import {
  StyleSheet,
  ScrollView,
  Pressable,
  View as RNView,
} from 'react-native';
import { router } from 'expo-router';

import { Text, useThemeColors } from '@/components/Themed';
import { useExerciseStore, EXERCISE_CATEGORIES } from '@/stores/exerciseStore';
import { useHistoryStore } from '@/stores/historyStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import { Exercise } from '@/types/database.types';

// 운동 분할 유형
type WorkoutSplit = 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'custom';

interface SplitOption {
  id: WorkoutSplit;
  name: string;
  nameEn: string;
  description: string;
  categories: string[];
  icon: string;
}

// 과학적 운동 분할 정의
const WORKOUT_SPLITS: SplitOption[] = [
  {
    id: 'push',
    name: '밀기 운동',
    nameEn: 'Push',
    description: '가슴, 어깨, 삼두',
    categories: ['chest', 'shoulders', 'arms'],
    icon: '💪',
  },
  {
    id: 'pull',
    name: '당기기 운동',
    nameEn: 'Pull',
    description: '등, 이두',
    categories: ['back', 'arms'],
    icon: '🏋️',
  },
  {
    id: 'legs',
    name: '하체 운동',
    nameEn: 'Legs',
    description: '하체, 코어',
    categories: ['legs', 'core'],
    icon: '🦵',
  },
  {
    id: 'upper',
    name: '상체 운동',
    nameEn: 'Upper',
    description: '가슴, 등, 어깨, 팔',
    categories: ['chest', 'back', 'shoulders', 'arms'],
    icon: '👆',
  },
  {
    id: 'lower',
    name: '하체 운동',
    nameEn: 'Lower',
    description: '하체, 코어',
    categories: ['legs', 'core'],
    icon: '👇',
  },
  {
    id: 'custom',
    name: '직접 선택',
    nameEn: 'Custom',
    description: '원하는 부위 선택',
    categories: [],
    icon: '✏️',
  },
];

// 복합 운동 목록 (exercise id 기준)
const COMPOUND_EXERCISES = new Set([
  'default_bench_press',
  'default_incline_bench_press',
  'default_deadlift',
  'default_barbell_row',
  'default_squat',
  'default_front_squat',
  'default_overhead_press',
  'default_pull_up',
  'default_push_up',
  'default_dumbbell_press',
  'default_leg_press',
  'default_romanian_deadlift',
  'default_cable_row',
  'default_lat_pulldown',
]);

// 주간 권장 세트 수 (근육군별)
const WEEKLY_VOLUME_TARGET: Record<string, { min: number; max: number }> = {
  chest: { min: 10, max: 20 },
  back: { min: 10, max: 20 },
  shoulders: { min: 8, max: 16 },
  legs: { min: 12, max: 20 },
  arms: { min: 8, max: 16 },
  core: { min: 6, max: 12 },
};

// 회복 시간 (시간 단위)
const RECOVERY_TIME: Record<string, number> = {
  chest: 48,
  back: 48,
  shoulders: 48,
  legs: 72,
  arms: 48,
  core: 24,
};

export default function SmartWorkoutScreen() {
  const colors = useThemeColors();
  const { getAllExercises } = useExerciseStore();
  const {
    getExercisesLastPerformed,
    getWeeklyCategorySets,
    getCategoryLastPerformed,
  } = useHistoryStore();
  const { startWorkout, addExercise } = useWorkoutStore();

  const [selectedSplit, setSelectedSplit] = useState<WorkoutSplit | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);
  const [step, setStep] = useState<'split' | 'categories' | 'exercises'>('split');
  const [isLoading, setIsLoading] = useState(false);

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
    success: { color: colors.success },
    successBg: { backgroundColor: colors.success },
    error: { color: colors.error },
    warning: { color: colors.warning },
    warningBg: { backgroundColor: colors.warning },
  }), [colors]);

  // 주간 볼륨 데이터
  const weeklyVolume = useMemo(() => getWeeklyCategorySets(), [getWeeklyCategorySets]);
  const categoryLastPerformed = useMemo(() => getCategoryLastPerformed(), [getCategoryLastPerformed]);

  // 회복 완료된 카테고리 확인
  const getRecoveryStatus = (category: string): 'recovered' | 'recovering' | 'fresh' => {
    const lastDate = categoryLastPerformed[category];
    if (!lastDate) return 'fresh';

    const hoursSince = (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60);
    const requiredHours = RECOVERY_TIME[category] || 48;

    if (hoursSince >= requiredHours) return 'recovered';
    return 'recovering';
  };

  // 볼륨 상태 확인
  const getVolumeStatus = (category: string): 'low' | 'optimal' | 'high' => {
    const sets = weeklyVolume[category] || 0;
    const target = WEEKLY_VOLUME_TARGET[category] || { min: 10, max: 20 };

    if (sets < target.min) return 'low';
    if (sets > target.max) return 'high';
    return 'optimal';
  };

  // 스마트 추천 점수 계산
  const getSmartRecommendation = useMemo(() => {
    const recommendations: { category: string; score: number; reasons: string[] }[] = [];

    EXERCISE_CATEGORIES.forEach((cat) => {
      let score = 0;
      const reasons: string[] = [];

      // 회복 상태 점수
      const recovery = getRecoveryStatus(cat.id);
      if (recovery === 'fresh') {
        score += 30;
        reasons.push('처음 운동하는 부위');
      } else if (recovery === 'recovered') {
        score += 20;
        reasons.push('회복 완료');
      } else {
        score -= 20;
        reasons.push('아직 회복 중');
      }

      // 볼륨 상태 점수
      const volume = getVolumeStatus(cat.id);
      if (volume === 'low') {
        score += 25;
        reasons.push('주간 볼륨 부족');
      } else if (volume === 'high') {
        score -= 15;
        reasons.push('주간 볼륨 충분');
      }

      // 마지막 운동 시간
      const lastDate = categoryLastPerformed[cat.id];
      if (lastDate) {
        const daysSince = (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > 7) {
          score += 15;
          reasons.push(`${Math.floor(daysSince)}일 전 운동`);
        } else if (daysSince > 3) {
          score += 10;
        }
      } else {
        score += 10;
      }

      recommendations.push({ category: cat.id, score, reasons });
    });

    return recommendations.sort((a, b) => b.score - a.score);
  }, [categoryLastPerformed, weeklyVolume]);

  // 분할 선택
  const handleSplitSelect = (split: SplitOption) => {
    setSelectedSplit(split.id);

    if (split.id === 'custom') {
      setSelectedCategories([]);
      setStep('categories');
    } else {
      // 분할에 해당하는 카테고리 자동 선택
      setSelectedCategories(split.categories);
      generateRecommendedExercises(split.categories);
    }
  };

  // 카테고리 토글 (직접 선택 모드)
  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((c) => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  // 추천 운동 생성 (복합 운동 우선)
  const generateRecommendedExercises = (categories: string[]) => {
    const lastPerformed = getExercisesLastPerformed();
    const allExercises = getAllExercises();

    // 선택된 카테고리의 운동들 필터링
    let categoryExercises = allExercises.filter((e) =>
      categories.includes(e.category)
    );

    // Push/Pull 분할일 경우 arms 카테고리에서 적절한 운동만 선택
    if (selectedSplit === 'push') {
      categoryExercises = categoryExercises.filter((e) => {
        if (e.category === 'arms') {
          // 삼두 운동만 (이름에 tricep이 포함되거나, push 관련 동작)
          const name = e.name.toLowerCase();
          return name.includes('tricep') || name.includes('dip') || name.includes('pushdown');
        }
        return true;
      });
    } else if (selectedSplit === 'pull') {
      categoryExercises = categoryExercises.filter((e) => {
        if (e.category === 'arms') {
          // 이두 운동만 (이름에 bicep/curl이 포함)
          const name = e.name.toLowerCase();
          return name.includes('bicep') || name.includes('curl');
        }
        return true;
      });
    }

    // 복합/고립 운동 분리
    const compoundExercises = categoryExercises.filter((e) =>
      COMPOUND_EXERCISES.has(e.id)
    );
    const isolationExercises = categoryExercises.filter((e) =>
      !COMPOUND_EXERCISES.has(e.id)
    );

    // 마지막 수행일 기준 정렬
    const sortByLastPerformed = (exercises: Exercise[]) => {
      return [...exercises].sort((a, b) => {
        const dateA = lastPerformed[a.id];
        const dateB = lastPerformed[b.id];
        if (!dateA && !dateB) return 0;
        if (!dateA) return -1;
        if (!dateB) return 1;
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      });
    };

    const sortedCompound = sortByLastPerformed(compoundExercises);
    const sortedIsolation = sortByLastPerformed(isolationExercises);

    // 복합 운동 2-3개 + 고립 운동 1-2개 선택
    const recommended: Exercise[] = [];

    // 카테고리별로 균등하게 복합 운동 선택
    const compoundPerCategory = Math.max(1, Math.ceil(3 / categories.length));
    categories.forEach((cat) => {
      const catCompound = sortedCompound.filter((e) => e.category === cat);
      recommended.push(...catCompound.slice(0, compoundPerCategory));
    });

    // 고립 운동 추가 (총 4-5개가 되도록)
    const remainingSlots = Math.max(0, 5 - recommended.length);
    recommended.push(...sortedIsolation.slice(0, remainingSlots));

    setSelectedExercises(recommended.slice(0, 5));
    setStep('exercises');
  };

  // 직접 선택에서 다음 단계로
  const handleCategoryNext = () => {
    if (selectedCategories.length === 0) return;
    generateRecommendedExercises(selectedCategories);
  };

  // 운동 토글
  const toggleExercise = (exercise: Exercise) => {
    setSelectedExercises((prev) =>
      prev.find((e) => e.id === exercise.id)
        ? prev.filter((e) => e.id !== exercise.id)
        : [...prev, exercise]
    );
  };

  // 운동 시작
  const handleStartWorkout = async () => {
    if (selectedExercises.length === 0 || isLoading) return;

    setIsLoading(true);
    try {
      const split = WORKOUT_SPLITS.find((s) => s.id === selectedSplit);
      const sessionName = split?.id !== 'custom'
        ? `${split?.name || '운동'}`
        : [...new Set(selectedExercises.map((e) => {
            const cat = EXERCISE_CATEGORIES.find((c) => c.id === e.category);
            return cat?.name || e.category;
          }))].join(' + ') + ' 운동';

      await startWorkout(sessionName);

      for (const exercise of selectedExercises) {
        await addExercise(exercise);
      }

      router.replace('/workout/active');
    } catch (error) {
      console.error('Failed to start workout:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 마지막 수행일 포맷
  const formatLastPerformed = (exerciseId: string) => {
    const lastPerformed = getExercisesLastPerformed();
    const date = lastPerformed[exerciseId];
    if (!date) return '처음';

    const lastDate = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '오늘';
    if (diffDays === 1) return '어제';
    if (diffDays < 7) return `${diffDays}일 전`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
    return `${Math.floor(diffDays / 30)}개월 전`;
  };

  // 추가 가능한 운동 목록
  const availableExercises = useMemo(() => {
    const allExercises = getAllExercises();
    const lastPerformed = getExercisesLastPerformed();

    let exercises = allExercises.filter((e) =>
      selectedCategories.includes(e.category) &&
      !selectedExercises.find((s) => s.id === e.id)
    );

    // Push/Pull 분할 필터링
    if (selectedSplit === 'push') {
      exercises = exercises.filter((e) => {
        if (e.category === 'arms') {
          const name = e.name.toLowerCase();
          return name.includes('tricep') || name.includes('dip') || name.includes('pushdown');
        }
        return true;
      });
    } else if (selectedSplit === 'pull') {
      exercises = exercises.filter((e) => {
        if (e.category === 'arms') {
          const name = e.name.toLowerCase();
          return name.includes('bicep') || name.includes('curl');
        }
        return true;
      });
    }

    return exercises.sort((a, b) => {
      const dateA = lastPerformed[a.id];
      const dateB = lastPerformed[b.id];
      if (!dateA && !dateB) return 0;
      if (!dateA) return -1;
      if (!dateB) return 1;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });
  }, [getAllExercises, selectedCategories, selectedExercises, selectedSplit]);

  // 볼륨 바 컴포넌트
  const VolumeBar = ({ category }: { category: string }) => {
    const sets = weeklyVolume[category] || 0;
    const target = WEEKLY_VOLUME_TARGET[category] || { min: 10, max: 20 };
    const percentage = Math.min(100, (sets / target.max) * 100);
    const status = getVolumeStatus(category);

    let barColor = colors.success;
    if (status === 'low') barColor = colors.warning;
    if (status === 'high') barColor = colors.error;

    return (
      <RNView style={styles.volumeContainer}>
        <RNView style={[styles.volumeBar, { backgroundColor: colors.cardSecondary }]}>
          <RNView
            style={[
              styles.volumeFill,
              { width: `${percentage}%`, backgroundColor: barColor },
            ]}
          />
        </RNView>
        <Text style={[styles.volumeText, dynamicStyles.textTertiary]}>
          {sets}/{target.min}-{target.max}세트
        </Text>
      </RNView>
    );
  };

  return (
    <RNView style={[styles.container, dynamicStyles.container]}>
      {step === 'split' ? (
        <>
          {/* 분할 선택 화면 */}
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
            <Text style={[styles.title, dynamicStyles.text]}>오늘의 운동</Text>
            <Text style={[styles.subtitle, dynamicStyles.textSecondary]}>
              과학적 분할 훈련으로 효율적인 운동을 시작하세요
            </Text>

            {/* 스마트 추천 */}
            <RNView style={[styles.smartRecommendBox, dynamicStyles.primaryLightBg]}>
              <Text style={[styles.smartRecommendTitle, dynamicStyles.primary]}>
                🎯 AI 추천
              </Text>
              <Text style={[styles.smartRecommendText, dynamicStyles.text]}>
                {getSmartRecommendation[0]?.reasons[0] && (
                  <>
                    <Text style={{ fontWeight: '700' }}>
                      {EXERCISE_CATEGORIES.find((c) => c.id === getSmartRecommendation[0].category)?.name}
                    </Text>
                    {' '}운동을 추천해요 ({getSmartRecommendation[0].reasons[0]})
                  </>
                )}
              </Text>
            </RNView>

            {/* 분할 옵션 */}
            <Text style={[styles.sectionTitle, dynamicStyles.text]}>운동 분할 선택</Text>
            <RNView style={styles.splitGrid}>
              {WORKOUT_SPLITS.map((split) => (
                <Pressable
                  key={split.id}
                  style={[styles.splitCard, dynamicStyles.card]}
                  onPress={() => handleSplitSelect(split)}
                >
                  <Text style={styles.splitIcon}>{split.icon}</Text>
                  <Text style={[styles.splitName, dynamicStyles.text]}>{split.name}</Text>
                  <Text style={[styles.splitNameEn, dynamicStyles.textTertiary]}>
                    {split.nameEn}
                  </Text>
                  <Text style={[styles.splitDesc, dynamicStyles.textSecondary]}>
                    {split.description}
                  </Text>
                </Pressable>
              ))}
            </RNView>

            {/* 주간 볼륨 현황 */}
            <Text style={[styles.sectionTitle, dynamicStyles.text]}>
              주간 볼륨 현황
            </Text>
            <RNView style={[styles.volumeCard, dynamicStyles.card]}>
              {EXERCISE_CATEGORIES.map((cat) => {
                const recovery = getRecoveryStatus(cat.id);
                return (
                  <RNView key={cat.id} style={styles.volumeRow}>
                    <RNView style={styles.volumeLabel}>
                      <Text style={[styles.volumeCatName, dynamicStyles.text]}>
                        {cat.name}
                      </Text>
                      {recovery === 'recovering' && (
                        <Text style={[styles.recoveryBadge, dynamicStyles.warningBg]}>
                          회복 중
                        </Text>
                      )}
                    </RNView>
                    <VolumeBar category={cat.id} />
                  </RNView>
                );
              })}
              <Text style={[styles.volumeHint, dynamicStyles.textTertiary]}>
                * 주간 10-20세트가 근비대에 최적입니다
              </Text>
            </RNView>
          </ScrollView>
        </>
      ) : step === 'categories' ? (
        <>
          {/* 카테고리 직접 선택 화면 */}
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
            <Text style={[styles.title, dynamicStyles.text]}>운동 부위 선택</Text>
            <Text style={[styles.subtitle, dynamicStyles.textSecondary]}>
              원하는 부위를 선택하세요
            </Text>

            <RNView style={styles.categoriesGrid}>
              {EXERCISE_CATEGORIES.map((category) => {
                const isSelected = selectedCategories.includes(category.id);
                const recovery = getRecoveryStatus(category.id);
                const volume = getVolumeStatus(category.id);

                return (
                  <Pressable
                    key={category.id}
                    style={[
                      styles.categoryCard,
                      isSelected ? dynamicStyles.primaryBg : dynamicStyles.card,
                    ]}
                    onPress={() => toggleCategory(category.id)}
                  >
                    <RNView style={styles.categoryHeader}>
                      <Text
                        style={[
                          styles.categoryName,
                          isSelected ? styles.categoryNameSelected : dynamicStyles.text,
                        ]}
                      >
                        {category.name}
                      </Text>
                      {recovery === 'recovering' && !isSelected && (
                        <RNView style={[styles.miniTag, dynamicStyles.warningBg]}>
                          <Text style={styles.miniTagText}>회복 중</Text>
                        </RNView>
                      )}
                    </RNView>
                    <Text
                      style={[
                        styles.categoryNameEn,
                        isSelected ? styles.categoryNameEnSelected : dynamicStyles.textTertiary,
                      ]}
                    >
                      {category.name_en}
                    </Text>
                    {!isSelected && (
                      <Text style={[styles.volumeHintSmall, dynamicStyles.textTertiary]}>
                        {weeklyVolume[category.id] || 0}세트/주
                        {volume === 'low' && ' (부족)'}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </RNView>
          </ScrollView>

          <RNView style={[styles.footer, dynamicStyles.card, { borderTopColor: colors.border }]}>
            <Pressable
              style={[styles.backButton, dynamicStyles.cardSecondary]}
              onPress={() => setStep('split')}
            >
              <Text style={[styles.backButtonText, dynamicStyles.textSecondary]}>이전</Text>
            </Pressable>
            <Pressable
              style={[
                styles.nextButton,
                selectedCategories.length > 0 ? dynamicStyles.primaryBg : dynamicStyles.cardSecondary,
              ]}
              onPress={handleCategoryNext}
              disabled={selectedCategories.length === 0}
            >
              <Text
                style={[
                  styles.nextButtonText,
                  selectedCategories.length > 0 ? styles.buttonTextActive : dynamicStyles.textTertiary,
                ]}
              >
                {selectedCategories.length > 0
                  ? `${selectedCategories.length}개 선택 - 다음`
                  : '부위를 선택해주세요'}
              </Text>
            </Pressable>
          </RNView>
        </>
      ) : (
        <>
          {/* 운동 선택 화면 */}
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
            <Text style={[styles.title, dynamicStyles.text]}>추천 운동</Text>
            <Text style={[styles.subtitle, dynamicStyles.textSecondary]}>
              복합 운동 → 고립 운동 순서로 구성했어요
            </Text>

            {/* 선택된 운동 */}
            <Text style={[styles.sectionTitle, dynamicStyles.text]}>
              오늘의 운동 ({selectedExercises.length})
            </Text>
            <RNView style={styles.exercisesList}>
              {selectedExercises.map((exercise, index) => (
                <Pressable
                  key={exercise.id}
                  style={[styles.exerciseCard, dynamicStyles.primaryLightBg]}
                  onPress={() => toggleExercise(exercise)}
                >
                  <RNView style={styles.exerciseOrder}>
                    <Text style={[styles.exerciseOrderText, dynamicStyles.primary]}>
                      {index + 1}
                    </Text>
                  </RNView>
                  <RNView style={styles.exerciseInfo}>
                    <RNView style={styles.exerciseNameRow}>
                      <Text style={[styles.exerciseName, dynamicStyles.text]}>
                        {exercise.name_ko || exercise.name}
                      </Text>
                      {COMPOUND_EXERCISES.has(exercise.id) && (
                        <RNView style={[styles.compoundTag, dynamicStyles.primaryBg]}>
                          <Text style={styles.compoundTagText}>복합</Text>
                        </RNView>
                      )}
                    </RNView>
                    <Text style={[styles.exerciseLastDate, dynamicStyles.textSecondary]}>
                      {formatLastPerformed(exercise.id)}
                    </Text>
                  </RNView>
                  <Text style={[styles.removeText, dynamicStyles.error]}>제거</Text>
                </Pressable>
              ))}
            </RNView>

            {/* 추가 가능한 운동 */}
            {availableExercises.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, dynamicStyles.text]}>
                  다른 운동 추가
                </Text>
                <RNView style={styles.exercisesList}>
                  {availableExercises.slice(0, 10).map((exercise) => (
                    <Pressable
                      key={exercise.id}
                      style={[styles.exerciseCard, dynamicStyles.card]}
                      onPress={() => toggleExercise(exercise)}
                    >
                      <RNView style={[styles.exerciseOrder, { opacity: 0.3 }]}>
                        <Text style={dynamicStyles.textTertiary}>+</Text>
                      </RNView>
                      <RNView style={styles.exerciseInfo}>
                        <RNView style={styles.exerciseNameRow}>
                          <Text style={[styles.exerciseName, dynamicStyles.text]}>
                            {exercise.name_ko || exercise.name}
                          </Text>
                          {COMPOUND_EXERCISES.has(exercise.id) && (
                            <RNView style={[styles.compoundTag, dynamicStyles.cardSecondary]}>
                              <Text style={[styles.compoundTagText, dynamicStyles.textSecondary]}>
                                복합
                              </Text>
                            </RNView>
                          )}
                        </RNView>
                        <Text style={[styles.exerciseLastDate, dynamicStyles.textSecondary]}>
                          {formatLastPerformed(exercise.id)}
                        </Text>
                      </RNView>
                      <Text style={[styles.addText, dynamicStyles.primary]}>추가</Text>
                    </Pressable>
                  ))}
                </RNView>
              </>
            )}
          </ScrollView>

          <RNView style={[styles.footer, dynamicStyles.card, { borderTopColor: colors.border }]}>
            <Pressable
              style={[styles.backButton, dynamicStyles.cardSecondary]}
              onPress={() => {
                if (selectedSplit === 'custom') {
                  setStep('categories');
                } else {
                  setStep('split');
                }
              }}
            >
              <Text style={[styles.backButtonText, dynamicStyles.textSecondary]}>이전</Text>
            </Pressable>
            <Pressable
              style={[
                styles.startButton,
                selectedExercises.length > 0 ? dynamicStyles.successBg : dynamicStyles.cardSecondary,
              ]}
              onPress={handleStartWorkout}
              disabled={selectedExercises.length === 0 || isLoading}
            >
              <Text
                style={[
                  styles.startButtonText,
                  selectedExercises.length > 0 ? styles.buttonTextActive : dynamicStyles.textTertiary,
                ]}
              >
                {isLoading ? '시작 중...' : `${selectedExercises.length}개 운동 시작`}
              </Text>
            </Pressable>
          </RNView>
        </>
      )}
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
    padding: 20,
    paddingBottom: 100,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 24,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 16,
  },
  smartRecommendBox: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  smartRecommendTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  smartRecommendText: {
    fontSize: 15,
    lineHeight: 22,
  },
  splitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  splitCard: {
    width: '47%',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  splitIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  splitName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  splitNameEn: {
    fontSize: 12,
    marginBottom: 6,
  },
  splitDesc: {
    fontSize: 12,
    textAlign: 'center',
  },
  volumeCard: {
    padding: 16,
    borderRadius: 12,
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  volumeLabel: {
    width: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  volumeCatName: {
    fontSize: 14,
    fontWeight: '500',
  },
  recoveryBadge: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 9,
    color: '#fff',
    overflow: 'hidden',
  },
  volumeContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  volumeBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  volumeFill: {
    height: '100%',
    borderRadius: 4,
  },
  volumeText: {
    fontSize: 11,
    width: 70,
    textAlign: 'right',
  },
  volumeHint: {
    fontSize: 11,
    marginTop: 4,
  },
  volumeHintSmall: {
    fontSize: 11,
    marginTop: 4,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    width: '47%',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: '700',
  },
  categoryNameSelected: {
    color: '#fff',
  },
  categoryNameEn: {
    fontSize: 13,
    marginTop: 2,
  },
  categoryNameEnSelected: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  miniTag: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniTagText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '600',
  },
  exercisesList: {
    gap: 8,
    marginBottom: 16,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 12,
  },
  exerciseOrder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseOrderText: {
    fontSize: 14,
    fontWeight: '700',
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '600',
  },
  compoundTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  compoundTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  exerciseLastDate: {
    fontSize: 13,
    marginTop: 2,
  },
  removeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  addText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  nextButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextActive: {
    color: '#fff',
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  startButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
