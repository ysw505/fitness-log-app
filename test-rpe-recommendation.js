/**
 * RPE 추천 알고리즘 간단 검증 스크립트
 * Node.js로 직접 실행하여 알고리즘 동작 확인
 */

// RPE-RIR 관계 테이블
const RPE_TO_RIR = {
  10: 0,
  9: 1,
  8: 2,
  7: 3,
  6: 4,
  5: 5,
};

// 1RM 추정
function estimate1RM(weight, reps) {
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

// RPE를 고려한 1RM 추정
function estimate1RMWithRPE(weight, reps, rpe) {
  const rir = RPE_TO_RIR[rpe] ?? 4;
  const effectiveReps = reps + rir;
  return estimate1RM(weight, effectiveReps);
}

// 다음 세트 추천
function getNextSetRecommendations(previousWeight, previousReps, previousRpe) {
  const recommendations = [];
  const estimated1RM = estimate1RMWithRPE(previousWeight, previousReps, previousRpe);

  console.log(`\n추정 1RM: ${estimated1RM.toFixed(1)}kg`);

  if (previousRpe <= 7) {
    // 여유 있음 → 부하 증가
    recommendations.push({
      weight: previousWeight + 2.5,
      reps: previousReps,
      reason: '무게 증가 (2.5kg ↑)',
    });

    if (previousWeight >= 20) {
      recommendations.push({
        weight: previousWeight + 5,
        reps: previousReps,
        reason: '무게 증가 (5kg ↑)',
      });
    }

    recommendations.push({
      weight: previousWeight,
      reps: previousReps + 2,
      reason: '횟수 증가 (+2회)',
    });
  } else if (previousRpe === 8) {
    // 적당 → 유지 또는 미세 조정
    recommendations.push({
      weight: previousWeight,
      reps: previousReps,
      reason: '동일 유지 (RPE 8 목표)',
    });

    if (previousReps > 3) {
      recommendations.push({
        weight: previousWeight,
        reps: previousReps - 1,
        reason: '횟수 감소 (-1회)',
      });
    }

    if (previousReps > 5) {
      recommendations.push({
        weight: previousWeight + 2.5,
        reps: previousReps - 2,
        reason: '무게 증가, 횟수 감소',
      });
    }
  } else {
    // RPE 9-10 (힘듦/한계) → 부하 감소
    const option1Weight = Math.round((previousWeight * 0.95) / 2.5) * 2.5;
    recommendations.push({
      weight: Math.max(option1Weight, 2.5),
      reps: previousReps,
      reason: '무게 감소 (5% ↓)',
    });

    const option2Weight = Math.round((previousWeight * 0.9) / 2.5) * 2.5;
    recommendations.push({
      weight: Math.max(option2Weight, 2.5),
      reps: previousReps,
      reason: '무게 감소 (10% ↓)',
    });

    if (previousReps > 3) {
      recommendations.push({
        weight: previousWeight,
        reps: Math.max(previousReps - 2, 1),
        reason: '횟수 감소 (-2회)',
      });
    }
  }

  return recommendations.slice(0, 3);
}

// 테스트 케이스
console.log('=== RPE 추천 알고리즘 검증 ===\n');

console.log('--- 테스트 1: RPE 6 (여유) ---');
console.log('이전 세트: 50kg × 10회 @ RPE 6');
let recommendations = getNextSetRecommendations(50, 10, 6);
recommendations.forEach((rec, i) => {
  console.log(`  옵션 ${i + 1}: ${rec.weight}kg × ${rec.reps}회 (${rec.reason})`);
});

console.log('\n--- 테스트 2: RPE 8 (적당) ---');
console.log('이전 세트: 60kg × 8회 @ RPE 8');
recommendations = getNextSetRecommendations(60, 8, 8);
recommendations.forEach((rec, i) => {
  console.log(`  옵션 ${i + 1}: ${rec.weight}kg × ${rec.reps}회 (${rec.reason})`);
});

console.log('\n--- 테스트 3: RPE 9 (힘듦) ---');
console.log('이전 세트: 80kg × 5회 @ RPE 9');
recommendations = getNextSetRecommendations(80, 5, 9);
recommendations.forEach((rec, i) => {
  console.log(`  옵션 ${i + 1}: ${rec.weight}kg × ${rec.reps}회 (${rec.reason})`);
});

console.log('\n--- 테스트 4: RPE 10 (한계) ---');
console.log('이전 세트: 100kg × 3회 @ RPE 10');
recommendations = getNextSetRecommendations(100, 3, 10);
recommendations.forEach((rec, i) => {
  console.log(`  옵션 ${i + 1}: ${rec.weight}kg × ${rec.reps}회 (${rec.reason})`);
});

console.log('\n--- 테스트 5: RPE 7 (적당-여유) ---');
console.log('이전 세트: 40kg × 12회 @ RPE 7');
recommendations = getNextSetRecommendations(40, 12, 7);
recommendations.forEach((rec, i) => {
  console.log(`  옵션 ${i + 1}: ${rec.weight}kg × ${rec.reps}회 (${rec.reason})`);
});

console.log('\n--- 1RM 추정 검증 ---');
console.log('50kg × 10회 @ RPE 6 (실제 14회 가능):');
const oneRM1 = estimate1RMWithRPE(50, 10, 6);
console.log(`  추정 1RM: ${oneRM1.toFixed(1)}kg`);

console.log('80kg × 8회 @ RPE 8 (실제 10회 가능):');
const oneRM2 = estimate1RMWithRPE(80, 8, 8);
console.log(`  추정 1RM: ${oneRM2.toFixed(1)}kg`);

console.log('100kg × 1회 @ RPE 10 (실제 1회):');
const oneRM3 = estimate1RMWithRPE(100, 1, 10);
console.log(`  추정 1RM: ${oneRM3.toFixed(1)}kg`);

console.log('\n✅ 모든 테스트 완료!');
