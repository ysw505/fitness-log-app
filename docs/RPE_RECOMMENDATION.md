# RPE 기반 다음 세트 추천 기능

## 개요

이슈 #5의 피드백에 따라 RPE(Rate of Perceived Exertion)를 기반으로 다음 세트의 무게와 횟수를 과학적으로 계산하여 추천하는 기능을 구현했습니다.

## 기능 설명

### 1. RPE란?

RPE는 운동 강도를 주관적으로 측정하는 지표로, 1~10까지의 숫자로 표현됩니다:

- **RPE 10**: 한계 (0 RIR - Reps In Reserve, 더 이상 반복 불가)
- **RPE 9**: 1회 여유
- **RPE 8**: 2회 여유
- **RPE 7**: 3회 여유
- **RPE 6 이하**: 4회 이상 여유

RIR(Reps In Reserve)은 세트를 완료한 후 남은 여유 횟수를 의미합니다.

### 2. 추천 알고리즘

#### 2.1 1RM 추정

**Epley 공식**을 사용하여 1RM(1 Rep Maximum, 최대 1회 들 수 있는 무게)을 추정합니다:

```
1RM = weight × (1 + reps / 30)
```

RPE를 고려한 경우, 실제 수행 횟수에 RIR을 더하여 더 정확한 1RM을 추정합니다:

```
effectiveReps = reps + RIR
1RM = weight × (1 + effectiveReps / 30)
```

#### 2.2 목표 무게 계산

**Brzycki 공식의 역함수**를 사용하여 목표 횟수에 맞는 무게를 계산합니다:

```
percentage = 1 / (1.0278 - 0.0278 × effectiveReps)
calculatedWeight = 1RM × percentage
```

계산된 무게는 2.5kg 단위로 반올림됩니다(일반적인 중량 증가 단위).

#### 2.3 추천 전략

이전 세트의 RPE에 따라 다음 세트를 추천합니다:

##### RPE 6-7 (여유)
부하를 증가시키는 전략:
- **옵션 1**: 무게 2.5kg 증가, 동일 횟수
- **옵션 2**: 무게 5kg 증가, 동일 횟수 (20kg 이상인 경우만)
- **옵션 3**: 동일 무게, 횟수 +2회

##### RPE 8 (적당)
현재 부하를 유지하거나 미세 조정:
- **옵션 1**: 동일 무게/횟수 유지 (RPE 8 목표)
- **옵션 2**: 무게 유지, 횟수 -1회
- **옵션 3**: 무게 +2.5kg, 횟수 -2회

##### RPE 9-10 (힘듦/한계)
부하를 감소시키는 전략:
- **옵션 1**: 무게 5% 감소, 동일 횟수
- **옵션 2**: 무게 10% 감소, 동일 횟수
- **옵션 3**: 동일 무게, 횟수 -2회

### 3. 사용자 경험 (UX)

1. **세트 완료**: 사용자가 세트를 완료하면 RPE 선택 UI가 표시됩니다.
2. **RPE 선택**: 사용자가 RPE를 선택하고 저장합니다.
3. **추천 표시**: RPE를 기반으로 계산된 3가지 추천 옵션이 하단 시트로 표시됩니다.
4. **선택**: 사용자는 추천 옵션 중 하나를 선택하거나 건너뛸 수 있습니다.
5. **자동 입력**: 선택한 추천값이 다음 세트의 무게/횟수 입력란에 자동으로 채워집니다.
6. **휴식 시간**: 추천 선택 후 휴식 시간 선택 UI가 표시됩니다.

## 구현 파일

### 1. 유틸리티 함수
- **파일**: `src/utils/rpeRecommendation.ts`
- **함수**:
  - `estimate1RMWithRPE()`: RPE를 고려한 1RM 추정
  - `getNextSetRecommendations()`: RPE 기반 추천 계산
  - `formatRecommendation()`: 추천 포맷팅

### 2. UI 구현
- **파일**: `app/workout/active.tsx`
- **변경사항**:
  - RPE 추천 상태 관리 추가
  - `handleSelectRpe()` 수정: RPE 저장 후 추천 계산
  - `applyRpeRecommendation()`: 추천 적용 핸들러
  - `skipRpeRecommendation()`: 추천 건너뛰기 핸들러
  - 추천 UI (하단 시트) 추가
  - 추천 관련 스타일 추가

## 과학적 근거

### Epley 공식
- **출처**: Epley, B. (1985). "Poundage Chart"
- **정확도**: 1~10회 범위에서 가장 정확
- **장점**: 간단하고 실용적

### Brzycki 공식
- **출처**: Brzycki, M. (1993). "Strength Testing - Predicting a One-Rep Max from Reps-to-Fatigue"
- **정확도**: 저강도 고반복 범위에서 유용
- **장점**: 다양한 반복 범위 지원

### RPE-RIR 관계
- **출처**: Zourdos et al. (2016). "Novel Resistance Training-Specific Rating of Perceived Exertion Scale Measuring Repetitions in Reserve"
- **검증**: 과학적으로 검증된 주관적 강도 측정 도구

## 향후 개선 사항

1. **개인화**: 사용자의 과거 데이터를 학습하여 개인별 최적화된 추천 제공
2. **운동 종류별 조정**: 컴파운드 운동 vs 아이솔레이션 운동에 따른 차별화
3. **피로도 고려**: 세트 수가 증가할수록 피로도를 반영한 추천
4. **주간 프로그레션**: 주차별 진행 상황을 고려한 점진적 과부하 추천

## 참고 문헌

1. Epley, B. (1985). Poundage Chart. Boyd Epley Workout.
2. Brzycki, M. (1993). Strength Testing—Predicting a One-Rep Max from Reps-to-Fatigue. Journal of Physical Education, Recreation & Dance, 64(1), 88-90.
3. Zourdos, M. C., et al. (2016). Novel Resistance Training-Specific Rating of Perceived Exertion Scale Measuring Repetitions in Reserve. Journal of Strength and Conditioning Research, 30(1), 267-275.
