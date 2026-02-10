import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * RPE 기반 추천 기능 테스트
 *
 * 이 테스트는 RPE 선택 후 다음 세트 추천이 올바르게 표시되는지 확인합니다.
 */

// 웹 서버 대기 및 초기화 헬퍼
async function waitForWebServer(page) {
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  await page.waitForTimeout(500);
}

test.describe('RPE Recommendation Feature', () => {
  test.beforeEach(async ({ page }) => {
    // 로컬 개발 서버로 이동
    await page.goto('http://localhost:8081/', { waitUntil: 'networkidle' });
    await waitForWebServer(page);

    // 로그인 상태 설정 (localStorage에 인증 토큰 추가)
    await page.evaluate(() => {
      const mockSession = {
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        expires_at: Date.now() + 3600000,
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
        },
      };
      localStorage.setItem('supabase.auth.token', JSON.stringify(mockSession));
    });

    await page.reload({ waitUntil: 'networkidle' });
    await waitForWebServer(page);
  });

  test('should show RPE recommendations after selecting RPE', async ({ page }) => {
    // 1. 홈 화면에서 "빈 운동" 시작
    const startWorkoutButton = page.getByText('빈 운동');
    await expect(startWorkoutButton).toBeVisible({ timeout: 10000 });
    await startWorkoutButton.click();

    await page.waitForURL('**/workout/active', { timeout: 10000 });
    console.log('운동 시작 화면 진입');

    // 2. 운동 추가
    const addExerciseButton = page.getByText('운동 추가');
    await expect(addExerciseButton).toBeVisible({ timeout: 5000 });
    await addExerciseButton.click();
    await page.waitForTimeout(500);

    // 3. 운동 선택 (벤치프레스)
    const benchPress = page.getByText('벤치프레스').first();
    await expect(benchPress).toBeVisible({ timeout: 5000 });
    await benchPress.click();
    await page.waitForTimeout(500);

    console.log('운동 추가 완료');

    // 4. 첫 세트 입력 (50kg × 10회)
    const weightInput = page.locator('input[placeholder="0"]').first();
    const repsInput = page.locator('input[placeholder="0"]').nth(1);

    await weightInput.fill('50');
    await repsInput.fill('10');
    console.log('무게/횟수 입력: 50kg × 10회');

    // 5. 세트 완료 (체크 버튼)
    const checkButton = page.locator('button').filter({ hasText: '✓' }).first();
    await expect(checkButton).toBeVisible({ timeout: 5000 });
    await checkButton.click();
    console.log('세트 완료 버튼 클릭');

    await page.waitForTimeout(1000);

    // 6. RPE 선택 UI 확인
    const rpeTitle = page.getByText('몇 회 더 할 수 있었나요?');
    await expect(rpeTitle).toBeVisible({ timeout: 5000 });
    console.log('RPE 선택 UI 표시됨');

    // RPE 선택 전 스크린샷
    await page.screenshot({
      path: path.join('e2e/screenshots/rpe-recommendation', 'step1-rpe-picker.png'),
      fullPage: true,
    });

    // 7. RPE 8 선택 (적당 - 2회 여유)
    const rpe8Button = page.locator('button').filter({ hasText: /^8$/ }).first();
    await expect(rpe8Button).toBeVisible({ timeout: 3000 });
    await rpe8Button.click();
    console.log('RPE 8 선택');

    await page.waitForTimeout(500);

    // 8. RPE 저장 버튼 클릭
    const saveRpeButton = page.getByText('저장');
    await expect(saveRpeButton).toBeVisible({ timeout: 3000 });
    await saveRpeButton.click();
    console.log('RPE 저장');

    await page.waitForTimeout(1000);

    // 9. 추천 UI 확인
    const recommendationTitle = page.getByText('다음 세트 추천');
    await expect(recommendationTitle).toBeVisible({ timeout: 5000 });
    console.log('추천 UI 표시됨');

    // 추천 UI 스크린샷
    await page.screenshot({
      path: path.join('e2e/screenshots/rpe-recommendation', 'step2-recommendations.png'),
      fullPage: true,
    });

    // 10. 추천 옵션 확인 (RPE 8이므로 유지/감소 옵션)
    const recommendationText = await page.locator('text=/kg × \\d+회/').allTextContents();
    console.log('추천 옵션:', recommendationText);

    expect(recommendationText.length).toBeGreaterThan(0);
    expect(recommendationText.length).toBeLessThanOrEqual(3);

    // 11. 첫 번째 추천 선택
    const firstRecommendation = page.locator('button').filter({ hasText: /kg × \d+회/ }).first();
    await expect(firstRecommendation).toBeVisible({ timeout: 3000 });
    await firstRecommendation.click();
    console.log('첫 번째 추천 선택');

    await page.waitForTimeout(1000);

    // 12. 휴식 시간 선택 UI 확인
    const restTitle = page.getByText('휴식 시간');
    await expect(restTitle).toBeVisible({ timeout: 5000 });
    console.log('휴식 시간 선택 UI 표시됨');

    // 최종 스크린샷
    await page.screenshot({
      path: path.join('e2e/screenshots/rpe-recommendation', 'step3-rest-picker.png'),
      fullPage: true,
    });

    // 13. 다음 세트 입력값 확인 (추천값이 자동 입력되었는지)
    await page.getByText('휴식 안 함').click();
    await page.waitForTimeout(500);

    const nextWeightInput = page.locator('input[placeholder="0"]').nth(2);
    const nextRepsInput = page.locator('input[placeholder="0"]').nth(3);

    const nextWeight = await nextWeightInput.inputValue();
    const nextReps = await nextRepsInput.inputValue();

    console.log('다음 세트 입력값:', { weight: nextWeight, reps: nextReps });

    expect(nextWeight).not.toBe('');
    expect(nextReps).not.toBe('');

    console.log('✅ RPE 추천 기능 테스트 성공');
  });

  test('should allow skipping RPE recommendation', async ({ page }) => {
    // 1. 홈 화면에서 "빈 운동" 시작
    const startWorkoutButton = page.getByText('빈 운동');
    await expect(startWorkoutButton).toBeVisible({ timeout: 10000 });
    await startWorkoutButton.click();

    await page.waitForURL('**/workout/active', { timeout: 10000 });

    // 2. 운동 추가
    const addExerciseButton = page.getByText('운동 추가');
    await expect(addExerciseButton).toBeVisible({ timeout: 5000 });
    await addExerciseButton.click();
    await page.waitForTimeout(500);

    // 3. 운동 선택
    const benchPress = page.getByText('벤치프레스').first();
    await expect(benchPress).toBeVisible({ timeout: 5000 });
    await benchPress.click();
    await page.waitForTimeout(500);

    // 4. 세트 입력 및 완료
    const weightInput = page.locator('input[placeholder="0"]').first();
    const repsInput = page.locator('input[placeholder="0"]').nth(1);

    await weightInput.fill('60');
    await repsInput.fill('8');

    const checkButton = page.locator('button').filter({ hasText: '✓' }).first();
    await checkButton.click();
    await page.waitForTimeout(1000);

    // 5. RPE 선택
    const rpe9Button = page.locator('button').filter({ hasText: /^9$/ }).first();
    await rpe9Button.click();
    await page.waitForTimeout(500);

    const saveRpeButton = page.getByText('저장');
    await saveRpeButton.click();
    await page.waitForTimeout(1000);

    // 6. 추천 건너뛰기
    const skipButton = page.getByText('추천 건너뛰기');
    await expect(skipButton).toBeVisible({ timeout: 5000 });
    await skipButton.click();
    console.log('추천 건너뛰기 클릭');

    await page.waitForTimeout(1000);

    // 7. 휴식 시간 선택 UI 확인 (추천을 건너뛰어도 휴식 UI는 표시되어야 함)
    const restTitle = page.getByText('휴식 시간');
    await expect(restTitle).toBeVisible({ timeout: 5000 });
    console.log('✅ 추천 건너뛰기 후 휴식 UI 표시 성공');
  });
});
