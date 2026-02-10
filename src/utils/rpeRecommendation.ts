/**
 * RPE 기반 다음 세트 무게/횟수 추천 유틸리티
 *
 * RPE (Rate of Perceived Exertion): 운동 강도 지표 (1~10)
 * - RPE 10: 한계 (0 RIR - Reps In Reserve)
 * - RPE 9: 1회 여유
 * - RPE 8: 2회 여유
 * - RPE 7: 3회 여유
 * - RPE 6 이하: 4회+ 여유
 */

export interface RpeRecommendation {
  weight: number;
  reps: number;
  reason: string;
}

/**
 * RPE-RIR 관계 테이블
 * RPE 값에 따른 RIR (Reps In Reserve) 매핑
 */
const RPE_TO_RIR: Record<number, number> = {
  10: 0,
  9: 1,
  8: 2,
  7: 3,
  6: 4,
  5: 5,
};

/**
 * Epley 공식을 사용한 1RM 추정
 * 1RM = weight × (1 + reps / 30)
 *
 * @param weight 사용한 무게 (kg)
 * @param reps 수행한 횟수
 * @returns 추정 1RM (kg)
 */
function estimate1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/**
 * RPE를 고려한 1RM 추정
 * 실제 수행 횟수 + RIR을 합산하여 더 정확한 1RM 추정
 *
 * @param weight 사용한 무게 (kg)
 * @param reps 수행한 횟수
 * @param rpe RPE 값 (1-10)
 * @returns 추정 1RM (kg)
 */
export function estimate1RMWithRPE(weight: number, reps: number, rpe: number): number {
  const rir = RPE_TO_RIR[rpe] ?? 4;
  const effectiveReps = reps + rir; // 실제로 할 수 있었던 최대 횟수
  return estimate1RM(weight, effectiveReps);
}

/**
 * 목표 RPE와 횟수에 맞는 무게 계산
 * Brzycki 공식 변형: weight = 1RM / (1.0278 - 0.0278 × reps)
 *
 * @param oneRM 추정 1RM (kg)
 * @param targetReps 목표 횟수
 * @param targetRpe 목표 RPE (기본값: 8)
 * @returns 목표 무게 (kg, 2.5kg 단위로 반올림)
 */
function calculateWeightForReps(oneRM: number, targetReps: number, targetRpe: number = 8): number {
  const rir = RPE_TO_RIR[targetRpe] ?? 2;
  const effectiveReps = targetReps + rir;

  // Brzycki 공식의 역함수
  const percentage = 1 / (1.0278 - 0.0278 * effectiveReps);
  const calculatedWeight = oneRM * percentage;

  // 2.5kg 단위로 반올림 (일반적인 중량 증가 단위)
  return Math.round(calculatedWeight / 2.5) * 2.5;
}

/**
 * 이전 RPE에 따라 다음 세트의 무게와 횟수를 추천
 *
 * 추천 전략:
 * - RPE 6-7 (여유): 무게 증가 (2.5-5kg) 또는 횟수 증가 (+1~2회)
 * - RPE 8 (적당): 동일 무게/횟수 유지 또는 횟수 약간 감소
 * - RPE 9-10 (힘듦/한계): 무게 감소 (5-10%) 또는 횟수 감소
 *
 * @param previousWeight 이전 세트 무게 (kg)
 * @param previousReps 이전 세트 횟수
 * @param previousRpe 이전 세트 RPE (1-10)
 * @returns 추천 무게/횟수 옵션 배열 (최대 3개)
 */
export function getNextSetRecommendations(
  previousWeight: number,
  previousReps: number,
  previousRpe: number
): RpeRecommendation[] {
  const recommendations: RpeRecommendation[] = [];

  // 1RM 추정
  const estimated1RM = estimate1RMWithRPE(previousWeight, previousReps, previousRpe);

  if (previousRpe <= 7) {
    // 여유 있음 → 부하 증가

    // 옵션 1: 무게 2.5kg 증가, 동일 횟수
    const option1Weight = previousWeight + 2.5;
    recommendations.push({
      weight: option1Weight,
      reps: previousReps,
      reason: '무게 증가 (2.5kg ↑)',
    });

    // 옵션 2: 무게 5kg 증가, 동일 횟수
    if (previousWeight >= 20) { // 충분히 무거운 경우만
      const option2Weight = previousWeight + 5;
      recommendations.push({
        weight: option2Weight,
        reps: previousReps,
        reason: '무게 증가 (5kg ↑)',
      });
    }

    // 옵션 3: 동일 무게, 횟수 증가
    recommendations.push({
      weight: previousWeight,
      reps: previousReps + 2,
      reason: '횟수 증가 (+2회)',
    });

  } else if (previousRpe === 8) {
    // 적당 → 유지 또는 미세 조정

    // 옵션 1: 동일 무게/횟수 유지
    recommendations.push({
      weight: previousWeight,
      reps: previousReps,
      reason: '동일 유지 (RPE 8 목표)',
    });

    // 옵션 2: 무게 유지, 횟수 감소
    if (previousReps > 3) {
      recommendations.push({
        weight: previousWeight,
        reps: previousReps - 1,
        reason: '횟수 감소 (-1회)',
      });
    }

    // 옵션 3: 무게 약간 증가, 횟수 감소
    if (previousReps > 5) {
      recommendations.push({
        weight: previousWeight + 2.5,
        reps: previousReps - 2,
        reason: '무게 증가, 횟수 감소',
      });
    }

  } else {
    // RPE 9-10 (힘듦/한계) → 부하 감소

    // 옵션 1: 무게 5% 감소, 동일 횟수
    const option1Weight = Math.round((previousWeight * 0.95) / 2.5) * 2.5;
    recommendations.push({
      weight: Math.max(option1Weight, 2.5), // 최소 2.5kg
      reps: previousReps,
      reason: '무게 감소 (5% ↓)',
    });

    // 옵션 2: 무게 10% 감소, 동일 횟수
    const option2Weight = Math.round((previousWeight * 0.9) / 2.5) * 2.5;
    recommendations.push({
      weight: Math.max(option2Weight, 2.5),
      reps: previousReps,
      reason: '무게 감소 (10% ↓)',
    });

    // 옵션 3: 동일 무게, 횟수 감소
    if (previousReps > 3) {
      recommendations.push({
        weight: previousWeight,
        reps: Math.max(previousReps - 2, 1),
        reason: '횟수 감소 (-2회)',
      });
    }
  }

  // 최대 3개 옵션 반환
  return recommendations.slice(0, 3);
}

/**
 * 추천 옵션을 사용자에게 표시할 문자열로 포맷
 *
 * @param recommendation 추천 옵션
 * @returns 표시용 문자열 (예: "25kg × 10회 (무게 증가)")
 */
export function formatRecommendation(recommendation: RpeRecommendation): string {
  return `${recommendation.weight}kg × ${recommendation.reps}회 (${recommendation.reason})`;
}
