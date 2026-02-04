import { test, expect } from '@playwright/test';

test.describe('Workout Flow', () => {
  test.beforeEach(async ({ page }) => {
    // 콘솔 로그 캡처
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[finishWorkout]') || text.includes('[addSet]') || text.includes('[addExercise]')) {
        console.log('BROWSER LOG:', text);
      }
    });
  });

  test('should start workout, add exercise, add set, and finish with record saved', async ({ page }) => {
    // 1. 홈 화면으로 이동
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 스크린샷: 홈 화면
    await page.screenshot({ path: 'e2e/screenshots/01-home.png' });
    console.log('Step 1: Home page loaded');

    // 2. 운동 시작 버튼 클릭
    const startButton = page.getByText('운동 시작');
    await expect(startButton).toBeVisible({ timeout: 10000 });
    await startButton.click();
    console.log('Step 2: Clicked 운동 시작');

    // 3. 운동 중 화면 확인
    await page.waitForURL('**/workout/active', { timeout: 10000 });
    await page.screenshot({ path: 'e2e/screenshots/02-active-workout-empty.png' });
    console.log('Step 3: Active workout screen');

    // 4. 운동 추가 버튼 클릭
    const addExerciseButton = page.getByText('운동 추가');
    await expect(addExerciseButton).toBeVisible({ timeout: 5000 });
    await addExerciseButton.click();
    console.log('Step 4: Clicked 운동 추가');

    // 5. 운동 선택 화면
    await page.waitForURL('**/workout/exercises', { timeout: 10000 });
    await page.screenshot({ path: 'e2e/screenshots/03-exercise-list.png' });
    console.log('Step 5: Exercise list screen');

    // 6. 운동 선택 - 새 UI에서는 필터 칩 + 운동 목록 형식
    // 벤치프레스 선택 (전체 목록에서 바로 보임)
    const benchPress = page.getByText('벤치프레스').first();
    if (await benchPress.isVisible({ timeout: 3000 }).catch(() => false)) {
      await benchPress.click();
    } else {
      // 가슴 필터 칩 클릭 후 선택
      const chestFilter = page.getByText('가슴').first();
      if (await chestFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
        await chestFilter.click();
        console.log('Step 6a: Clicked 가슴 filter chip');
        await page.waitForTimeout(500);
        const benchPressFiltered = page.getByText('벤치프레스').first();
        await benchPressFiltered.click();
      } else {
        // 검색으로 대체
        const searchInput = page.locator('input[placeholder="운동 검색..."]');
        await searchInput.fill('벤치');
        await page.waitForTimeout(500);
        const searchResult = page.getByText('벤치프레스').first();
        await searchResult.click();
      }
    }
    console.log('Step 6: Selected an exercise');

    // 7. 운동 중 화면으로 돌아옴
    await page.waitForURL('**/workout/active', { timeout: 10000 });
    await page.waitForTimeout(1000); // 상태 업데이트 대기
    await page.screenshot({ path: 'e2e/screenshots/04-active-with-exercise.png' });
    console.log('Step 7: Back to active workout with exercise');

    // 8. 세트 추가 - 무게와 횟수 입력
    // 무게 입력 필드 찾기
    const weightInput = page.locator('input[placeholder="0"]').first();
    await expect(weightInput).toBeVisible({ timeout: 5000 });
    await weightInput.fill('50');
    console.log('Step 8a: Entered weight 50');

    // 횟수 입력 필드 찾기
    const repsInput = page.locator('input[placeholder="0"]').nth(1);
    await expect(repsInput).toBeVisible({ timeout: 5000 });
    await repsInput.fill('10');
    console.log('Step 8b: Entered reps 10');

    await page.screenshot({ path: 'e2e/screenshots/05-input-filled.png' });

    // 9. 파란색 세트 추가 버튼 클릭
    // 모든 + 텍스트를 가진 요소 찾기
    const plusElements = await page.locator('div:has-text("+")').all();
    console.log(`Found ${plusElements.length} elements with +`);

    // 직접 CSS로 파란색 버튼 찾기 (RGB 59, 130, 246 = #3b82f6)
    const blueButton = page.locator('[style*="background"] >> text="+"').last();
    if (await blueButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await blueButton.click();
      console.log('Step 9: Clicked blue + button');
    } else {
      // 대안: 마지막 + 요소 클릭 (보통 세트 추가 버튼)
      const lastPlus = page.getByText('+', { exact: true }).last();
      await lastPlus.click();
      console.log('Step 9: Clicked last + button');
    }

    await page.waitForTimeout(1000); // 상태 업데이트 대기
    await page.screenshot({ path: 'e2e/screenshots/06-set-added.png' });

    // 휴식 시간 선택이 나타나면 스킵
    const skipRestButton = page.getByText('휴식 안 함');
    if (await skipRestButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipRestButton.click();
      console.log('Step 9a: Skipped rest timer');
    }

    // 10. 세트가 추가되었는지 확인 (로그로 확인됨)
    await page.waitForTimeout(1000); // UI 업데이트 대기
    await page.screenshot({ path: 'e2e/screenshots/07-before-finish.png' });
    console.log('Step 10: Screenshot taken, proceeding to finish');

    // 11. 브라우저 confirm 대화상자 처리 설정
    page.on('dialog', async dialog => {
      console.log('Dialog appeared:', dialog.type(), dialog.message());
      await dialog.accept(); // OK 클릭
    });

    // 운동 완료 버튼 클릭
    const finishButton = page.getByText('운동 완료');
    await expect(finishButton).toBeVisible();
    await finishButton.click();
    console.log('Step 11: Clicked 운동 완료');

    await page.waitForTimeout(3000); // 완료 처리 대기
    await page.screenshot({ path: 'e2e/screenshots/08-after-finish.png' });

    // 13. 홈 화면으로 돌아왔는지 확인 (URL이 / 또는 빈 경로)
    try {
      await page.waitForURL(/\/$|\/\(tabs\)/, { timeout: 10000 });
      console.log('Step 13: Back to home');
    } catch {
      console.log('Step 13: URL did not change, checking current URL:', page.url());
    }

    await page.screenshot({ path: 'e2e/screenshots/09-home-after-workout.png' });

    // 14. 기록 탭으로 이동 (탭바의 기록 버튼)
    const historyTab = page.getByRole('tab', { name: /기록/ });
    await expect(historyTab).toBeVisible({ timeout: 5000 });
    await historyTab.click();
    console.log('Step 14: Clicked 기록 tab');

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'e2e/screenshots/10-history-tab.png' });

    // 15. 최근 운동 기록이 있는지 확인
    // 오늘 날짜로 된 운동 기록이 보이는지
    const today = new Date();
    const todayString = `${today.getMonth() + 1}월 ${today.getDate()}일`;

    // 기록이 보이는지 확인 (세트 수가 0이 아닌지)
    const workoutRecord = page.locator('text=/1세트|1 세트/').first();
    const hasRecord = await workoutRecord.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasRecord) {
      console.log('SUCCESS: Workout record found with sets!');
    } else {
      // 0세트로 표시되는지 확인
      const zeroSets = page.locator('text=/0세트|0 세트/').first();
      const hasZeroSets = await zeroSets.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasZeroSets) {
        console.log('ERROR: Workout saved but shows 0 sets - BUG FOUND!');
        await page.screenshot({ path: 'e2e/screenshots/11-BUG-zero-sets.png' });
      }
    }

    await page.screenshot({ path: 'e2e/screenshots/11-final-history.png' });

    // 16. localStorage로 데이터 검증 (UI 클릭 대신 더 안정적)
    const historyStorage = await page.evaluate(() => {
      return localStorage.getItem('workout-history-storage');
    });

    let hasSavedSets = false;
    if (historyStorage) {
      const parsed = JSON.parse(historyStorage);
      const workouts = parsed.state?.completedWorkouts || [];
      if (workouts.length > 0) {
        const lastWorkout = workouts[0];
        console.log('Saved workout data:', {
          name: lastWorkout.name,
          total_sets: lastWorkout.total_sets,
          total_volume: lastWorkout.total_volume,
          exercises: lastWorkout.exercises?.length,
        });
        // 세트가 저장되었는지 확인
        hasSavedSets = lastWorkout.total_sets > 0 && lastWorkout.total_volume > 0;
      }
    }

    await page.screenshot({ path: 'e2e/screenshots/12-final-verification.png' });

    if (hasSavedSets) {
      console.log('TEST PASSED: Workout with sets is saved correctly in localStorage!');
    } else {
      console.log('TEST FAILED: Sets not saved correctly');
      await page.screenshot({ path: 'e2e/screenshots/13-FAIL-no-sets.png' });
    }

    expect(hasSavedSets).toBeTruthy();
  });

  test('should allow 0kg weight for bodyweight exercises', async ({ page }) => {
    // 1. 홈 화면으로 이동
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 2. 운동 시작
    const startButton = page.getByText('운동 시작');
    await expect(startButton).toBeVisible({ timeout: 10000 });
    await startButton.click();

    // 3. 운동 중 화면
    await page.waitForURL('**/workout/active', { timeout: 10000 });

    // 4. 운동 추가
    const addExerciseButton = page.getByText('운동 추가');
    await expect(addExerciseButton).toBeVisible({ timeout: 5000 });
    await addExerciseButton.click();

    // 5. 운동 선택 (풀업 같은 맨몸 운동)
    await page.waitForURL('**/workout/exercises', { timeout: 10000 });
    const pullUp = page.getByText('풀업').first();
    if (await pullUp.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pullUp.click();
    } else {
      // 아무 운동이나 선택
      const benchPress = page.getByText('벤치프레스').first();
      await benchPress.click();
    }

    // 6. 운동 중 화면으로 돌아옴
    await page.waitForURL('**/workout/active', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // 7. 무게 입력 없이 (0kg), 횟수만 입력
    // 무게 필드를 비워두면 0kg으로 처리됨
    const repsInput = page.locator('input[placeholder="0"]').nth(1);
    await expect(repsInput).toBeVisible({ timeout: 5000 });
    await repsInput.fill('10');
    console.log('Entered reps 10 with 0kg weight (empty = 0kg)');

    // 8. 세트 추가 버튼 클릭
    const blueButton = page.locator('[style*="background"] >> text="+"').last();
    if (await blueButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await blueButton.click();
    } else {
      const lastPlus = page.getByText('+', { exact: true }).last();
      await lastPlus.click();
    }
    console.log('Clicked add set button');

    await page.waitForTimeout(1000);

    // 휴식 시간 스킵
    const skipRestButton = page.getByText('휴식 안 함');
    if (await skipRestButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipRestButton.click();
    }

    // 9. localStorage에서 세트가 추가되었는지 확인
    const workoutStorage = await page.evaluate(() => {
      return localStorage.getItem('workout-storage');
    });

    let hasZeroKgSet = false;
    if (workoutStorage) {
      const parsed = JSON.parse(workoutStorage);
      const exercises = parsed.state?.exercises || [];
      if (exercises.length > 0 && exercises[0].sets?.length > 0) {
        const set = exercises[0].sets[0];
        hasZeroKgSet = set.weight === 0 && set.reps === 10;
        console.log('Set found:', { weight: set.weight, reps: set.reps });
      }
    }

    if (hasZeroKgSet) {
      console.log('SUCCESS: 0kg set was added successfully!');
    } else {
      console.log('Set not found or has wrong values');
      await page.screenshot({ path: 'e2e/screenshots/0kg-test.png' });
    }

    // 테스트 성공 확인 - 0kg 세트가 추가되었으면 성공
    expect(hasZeroKgSet).toBeTruthy();
  });

  test('should verify localStorage persistence', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // localStorage 상태 확인
    const workoutStorage = await page.evaluate(() => {
      return localStorage.getItem('workout-storage');
    });
    console.log('workout-storage:', workoutStorage);

    const historyStorage = await page.evaluate(() => {
      return localStorage.getItem('workout-history-storage');
    });
    console.log('workout-history-storage:', historyStorage);

    // 파싱하여 내용 확인
    if (historyStorage) {
      const parsed = JSON.parse(historyStorage);
      console.log('History workouts count:', parsed.state?.completedWorkouts?.length || 0);
      if (parsed.state?.completedWorkouts?.length > 0) {
        const lastWorkout = parsed.state.completedWorkouts[0];
        console.log('Last workout:', {
          name: lastWorkout.name,
          exercises: lastWorkout.exercises?.length,
          total_sets: lastWorkout.total_sets,
          total_volume: lastWorkout.total_volume,
        });
      }
    }
  });
});
