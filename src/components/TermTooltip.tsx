import { useState } from 'react';
import { StyleSheet, Pressable, Modal, View as RNView } from 'react-native';

import { Text, useThemeColors } from '@/components/Themed';

// 헬스 용어 사전
const TERM_GLOSSARY: Record<string, { title: string; description: string; example?: string }> = {
  rpe: {
    title: 'RPE (자각 피로도)',
    description: '운동 강도를 1-10으로 표현하는 주관적 척도입니다. 10은 더 이상 1회도 못하는 한계, 8은 2회 정도 더 가능한 수준입니다.',
    example: 'RPE 8 = 2회 여유, RPE 9 = 1회 여유',
  },
  volume: {
    title: '볼륨 (Volume)',
    description: '총 운동량을 의미합니다. 일반적으로 무게 × 반복수 × 세트수로 계산됩니다.',
    example: '50kg × 10회 × 3세트 = 1,500kg 볼륨',
  },
  '1rm': {
    title: '1RM (1회 최대 반복)',
    description: '1회만 들어올릴 수 있는 최대 무게입니다. 운동 강도를 설정하는 기준이 됩니다.',
    example: '벤치프레스 1RM 100kg → 70% 강도 = 70kg',
  },
  set: {
    title: '세트 (Set)',
    description: '연속으로 수행하는 운동 동작의 묶음입니다. 세트 사이에는 휴식을 취합니다.',
    example: '10회 × 3세트 = 10회씩 3번 수행',
  },
  rep: {
    title: '렙 / 반복 (Rep)',
    description: '운동 동작을 1회 수행하는 것을 말합니다.',
    example: '스쿼트 1회 = 앉았다 일어나기 1번',
  },
  progression: {
    title: '점진적 과부하',
    description: '근육 성장을 위해 점차 운동 강도(무게, 횟수, 세트)를 높이는 원칙입니다.',
    example: '이번 주 50kg×10회 → 다음 주 50kg×11회',
  },
  deload: {
    title: '디로드 (Deload)',
    description: '피로 회복을 위해 의도적으로 강도를 낮추는 기간입니다. 보통 4-6주마다 1주간 진행합니다.',
  },
  compound: {
    title: '복합 운동 (Compound)',
    description: '여러 관절과 근육을 동시에 사용하는 운동입니다. 효율적인 근력 발달에 좋습니다.',
    example: '스쿼트, 데드리프트, 벤치프레스',
  },
  isolation: {
    title: '고립 운동 (Isolation)',
    description: '단일 관절과 특정 근육만 집중적으로 사용하는 운동입니다.',
    example: '바이셉 컬, 레그 익스텐션',
  },
  failure: {
    title: '근실패 (Failure)',
    description: '더 이상 올바른 자세로 1회도 수행할 수 없는 상태입니다. RPE 10에 해당합니다.',
  },
  superset: {
    title: '슈퍼세트',
    description: '두 가지 운동을 휴식 없이 연속으로 수행하는 방법입니다.',
    example: '벤치프레스 → 바로 로우 수행',
  },
  dropset: {
    title: '드롭세트',
    description: '세트 완료 후 무게를 줄여 바로 추가 반복을 수행하는 고강도 기법입니다.',
  },
  ppl: {
    title: 'PPL 루틴',
    description: 'Push(밀기), Pull(당기기), Legs(하체)로 나누는 분할 운동법입니다.',
    example: '월: 가슴/어깨, 화: 등/이두, 수: 하체',
  },
  rir: {
    title: 'RIR (Reps in Reserve)',
    description: '세트 종료 시 남은 여유 횟수입니다. RPE의 반대 개념입니다.',
    example: 'RIR 2 = 2회 더 할 수 있음 = RPE 8',
  },
};

interface TermTooltipProps {
  term: string;
  children: React.ReactNode;
  style?: any;
}

export default function TermTooltip({ term, children, style }: TermTooltipProps) {
  const [visible, setVisible] = useState(false);
  const colors = useThemeColors();

  const glossaryItem = TERM_GLOSSARY[term.toLowerCase()];

  if (!glossaryItem) {
    return <>{children}</>;
  }

  return (
    <>
      <Pressable onPress={() => setVisible(true)} style={style}>
        <RNView style={styles.termWrapper}>
          {children}
          <Text style={[styles.questionMark, { color: colors.primary }]}>ⓘ</Text>
        </RNView>
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setVisible(false)}
        >
          <RNView style={[styles.tooltip, { backgroundColor: colors.card }]}>
            <Text style={[styles.tooltipTitle, { color: colors.text }]}>
              {glossaryItem.title}
            </Text>
            <Text style={[styles.tooltipDescription, { color: colors.textSecondary }]}>
              {glossaryItem.description}
            </Text>
            {glossaryItem.example && (
              <RNView style={[styles.exampleBox, { backgroundColor: colors.background }]}>
                <Text style={[styles.exampleLabel, { color: colors.primary }]}>예시</Text>
                <Text style={[styles.exampleText, { color: colors.text }]}>
                  {glossaryItem.example}
                </Text>
              </RNView>
            )}
            <Pressable
              style={[styles.closeButton, { backgroundColor: colors.primary }]}
              onPress={() => setVisible(false)}
            >
              <Text style={styles.closeButtonText}>확인</Text>
            </Pressable>
          </RNView>
        </Pressable>
      </Modal>
    </>
  );
}

// 간단한 인라인 버전 - 물음표 아이콘만 표시
export function TermIcon({ term }: { term: string }) {
  const [visible, setVisible] = useState(false);
  const colors = useThemeColors();

  const glossaryItem = TERM_GLOSSARY[term.toLowerCase()];

  if (!glossaryItem) {
    return null;
  }

  return (
    <>
      <Pressable onPress={() => setVisible(true)} hitSlop={8}>
        <Text style={[styles.infoIcon, { color: colors.textSecondary }]}>ⓘ</Text>
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setVisible(false)}
        >
          <RNView style={[styles.tooltip, { backgroundColor: colors.card }]}>
            <Text style={[styles.tooltipTitle, { color: colors.text }]}>
              {glossaryItem.title}
            </Text>
            <Text style={[styles.tooltipDescription, { color: colors.textSecondary }]}>
              {glossaryItem.description}
            </Text>
            {glossaryItem.example && (
              <RNView style={[styles.exampleBox, { backgroundColor: colors.background }]}>
                <Text style={[styles.exampleLabel, { color: colors.primary }]}>예시</Text>
                <Text style={[styles.exampleText, { color: colors.text }]}>
                  {glossaryItem.example}
                </Text>
              </RNView>
            )}
            <Pressable
              style={[styles.closeButton, { backgroundColor: colors.primary }]}
              onPress={() => setVisible(false)}
            >
              <Text style={styles.closeButtonText}>확인</Text>
            </Pressable>
          </RNView>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  termWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  questionMark: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoIcon: {
    fontSize: 14,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  tooltip: {
    borderRadius: 16,
    padding: 20,
    maxWidth: 340,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  tooltipTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  tooltipDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  exampleBox: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  exampleLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  exampleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  closeButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
