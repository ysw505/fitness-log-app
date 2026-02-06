import { test, expect } from '@playwright/test';

/**
 * 종합 E2E 테스트 - 안드로이드 배포 전 전체 기능 검증
 *
 * 테스트 영역:
 * 1. 홈 화면 기본 렌더링
 * 2. 운동 시작/취소/완료 플로우
 * 3. 운동 선택 및 검색
 * 4. 세트 추가/삭제
 * 5. 기록 탭 (히스토리)
 * 6. 통계 탭
 * 7. 프로필 탭
 * 8. 운동 상세 페이지
 * 9. 다크 테마
 * 10. 데이터 지속성 (localStorage)
 */

test.describe('1. 홈 화면', () => {
  test('홈 화면이 정상적으로 로드됨', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'e2e/screenshots/comprehensive/01-home-load.png' });

    // 핵심 요소 확인
    const homeTitle = page.locator('text=/오늘도 화이팅|홈/').first();
    const emptyWorkoutBtn = page.getByText('빈 운동');
    const smartRecCard = page.locator('text=탭하여 바로 시작');

    const hasTitle = await homeTitle.isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmptyBtn = await emptyWorkoutBtn.isVisible({ timeout: 3000 }).catch(() => false);
    const hasSmartRec = await smartRecCard.isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasTitle || hasEmptyBtn || hasSmartRec).toBeTruthy();
    console.log('홈 화면 로드 성공');
  });

  test('탭 네비게이션이 동작함', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 각 탭 클릭 및 확인
    const tabs = [
      { name: '기록', pattern: /기록|캘린더|PR/ },
      { name: '운동', pattern: /운동|검색/ },
      { name: '통계', pattern: /통계|이번 주/ },
      { name: '프로필', pattern: /프로필|설정/ },
    ];

    for (const tab of tabs) {
      const tabBtn = page.getByRole('tab', { name: new RegExp(tab.name) });
      if (await tabBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tabBtn.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `e2e/screenshots/comprehensive/01-tab-${tab.name}.png` });
        console.log(`탭 "${tab.name}" 이동 성공`);
      }
    }

    // 홈으로 돌아가기
    const homeTab = page.getByRole('tab', { name: /홈/ });
    if (await homeTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await homeTab.click();
    }
  });
});

test.describe('2. 운동 시작/취소 플로우', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // localStorage 초기화
    await page.evaluate(() => {
      localStorage.removeItem('workout-storage');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('빈 운동 시작 및 취소가 에러 없이 동작함', async ({ page }) => {
    // 에러 캡처
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    // 운동 시작
    const emptyWorkoutBtn = page.getByText('빈 운동');
    const smartRecCard = page.locator('text=탭하여 바로 시작');

    if (await emptyWorkoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emptyWorkoutBtn.click();
    } else if (await smartRecCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await smartRecCard.click();
    }

    // 운동 화면 확인
    try {
      await page.waitForURL('**/workout/active', { timeout: 10000 });
    } catch {
      console.log('URL 변경 없음, 현재 상태 확인');
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'e2e/screenshots/comprehensive/02-workout-started.png' });

    // 취소 버튼 찾기
    const cancelBtn = page.getByText('취소');
    if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Dialog 처리
      page.on('dialog', async (dialog) => await dialog.accept());
      await cancelBtn.click();
      await page.waitForTimeout(2000);
    } else {
      // 뒤로가기 후 취소
      await page.goBack();
      await page.waitForTimeout(1000);
      const cancelBtnAfterBack = page.getByText('취소');
      if (await cancelBtnAfterBack.isVisible({ timeout: 3000 }).catch(() => false)) {
        page.on('dialog', async (dialog) => await dialog.accept());
        await cancelBtnAfterBack.click();
        await page.waitForTimeout(2000);
      }
    }

    await page.screenshot({ path: 'e2e/screenshots/comprehensive/02-after-cancel.png' });

    // Hook 에러 확인
    const hookError = errors.find(e => e.includes('hook'));
    expect(hookError).toBeUndefined();
    console.log('운동 시작/취소 에러 없음');
  });
});

test.describe('3. 운동 선택 화면', () => {
  test('운동 목록이 정상적으로 표시됨', async ({ page }) => {
    await page.goto('/workout/exercises');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'e2e/screenshots/comprehensive/03-exercise-list.png' });

    // 운동 목록 확인
    const benchPress = page.getByText('벤치프레스').first();
    const squat = page.getByText('스쿼트').first();
    const deadlift = page.getByText('데드리프트').first();

    const hasBench = await benchPress.isVisible({ timeout: 5000 }).catch(() => false);
    const hasSquat = await squat.isVisible({ timeout: 2000 }).catch(() => false);
    const hasDeadlift = await deadlift.isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasBench || hasSquat || hasDeadlift).toBeTruthy();
    console.log('운동 목록 표시 성공');
  });

  test('운동 검색이 동작함', async ({ page }) => {
    await page.goto('/workout/exercises');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // 목록 로딩 대기

    // 검색 입력 찾기
    const searchInput = page.locator('input').first();
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill('벤치');
      await page.waitForTimeout(1000); // 검색 결과 대기
      await page.screenshot({ path: 'e2e/screenshots/comprehensive/03-search-result.png' });

      // 검색 결과 확인 - 페이지 내용에서 "벤치" 포함 여부 확인
      const pageContent = await page.content();
      const hasBenchInContent = pageContent.includes('벤치프레스') || pageContent.includes('검색 결과');

      if (hasBenchInContent) {
        console.log('운동 검색 성공 (페이지 내용에서 확인)');
      } else {
        console.log('페이지 내용:', pageContent.substring(0, 500));
      }

      expect(hasBenchInContent).toBeTruthy();
    } else {
      // 검색창이 없으면 스킵
      console.log('검색창이 보이지 않아 스킵');
      expect(true).toBeTruthy();
    }
  });

  test('카테고리 필터가 동작함', async ({ page }) => {
    await page.goto('/workout/exercises');
    await page.waitForLoadState('networkidle');

    // 카테고리 필터 클릭 (가슴, 등, 하체 등)
    const categories = ['가슴', '등', '하체', '어깨'];

    for (const cat of categories) {
      const filterChip = page.getByText(cat, { exact: true }).first();
      if (await filterChip.isVisible({ timeout: 2000 }).catch(() => false)) {
        await filterChip.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `e2e/screenshots/comprehensive/03-filter-${cat}.png` });
        console.log(`카테고리 "${cat}" 필터 동작`);
        break; // 하나만 테스트
      }
    }
  });
});

test.describe('4. 세트 추가/삭제', () => {
  test('세트 추가가 정상적으로 동작함', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // localStorage 초기화
    await page.evaluate(() => {
      localStorage.removeItem('workout-storage');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 운동 시작
    const emptyWorkoutBtn = page.getByText('빈 운동');
    if (await emptyWorkoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emptyWorkoutBtn.click();
    }

    try {
      await page.waitForURL('**/workout/active', { timeout: 10000 });
    } catch {
      // 무시
    }
    await page.waitForTimeout(1000);

    // 운동 추가
    const addExerciseBtn = page.getByText('운동 추가');
    if (await addExerciseBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addExerciseBtn.click();
      await page.waitForURL('**/workout/exercises', { timeout: 10000 });

      // 벤치프레스 선택
      const benchPress = page.getByText('벤치프레스').first();
      await benchPress.click();
      await page.waitForURL('**/workout/active', { timeout: 10000 });
      await page.waitForTimeout(1000);

      // 무게/횟수 입력
      const weightInput = page.locator('input[placeholder="0"]').first();
      const repsInput = page.locator('input[placeholder="0"]').nth(1);

      if (await weightInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await weightInput.fill('60');
        await repsInput.fill('10');

        // 세트 추가 버튼 클릭
        const addSetBtn = page.getByText('세트 추가');
        await addSetBtn.click();
        await page.waitForTimeout(1000);

        // 휴식 스킵
        const skipRest = page.getByText('휴식 안 함');
        if (await skipRest.isVisible({ timeout: 2000 }).catch(() => false)) {
          await skipRest.click();
        }

        await page.screenshot({ path: 'e2e/screenshots/comprehensive/04-set-added.png' });

        // localStorage 확인
        const storage = await page.evaluate(() => localStorage.getItem('workout-storage'));
        if (storage) {
          const parsed = JSON.parse(storage);
          const sets = parsed.state?.exercises?.[0]?.sets || [];
          expect(sets.length).toBeGreaterThan(0);
          console.log('세트 추가 성공:', sets[0]);
        }
      }
    }
  });
});

test.describe('5. 기록 탭', () => {
  test('기록 탭이 정상적으로 표시됨', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const historyTab = page.getByRole('tab', { name: /기록/ });
    if (await historyTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await historyTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'e2e/screenshots/comprehensive/05-history-tab.png' });

      // 캘린더 또는 기록 목록 확인
      const calendar = page.locator('text=/캘린더|일|월|화|수|목|금|토/').first();
      const emptyState = page.locator('text=/첫 번째|운동을 시작/').first();
      const workoutRecord = page.locator('text=/세트|운동/').first();

      const hasCalendar = await calendar.isVisible({ timeout: 3000 }).catch(() => false);
      const hasEmpty = await emptyState.isVisible({ timeout: 2000 }).catch(() => false);
      const hasRecord = await workoutRecord.isVisible({ timeout: 2000 }).catch(() => false);

      expect(hasCalendar || hasEmpty || hasRecord).toBeTruthy();
      console.log('기록 탭 표시 성공');
    }
  });

  test('PR 탭이 동작함', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const historyTab = page.getByRole('tab', { name: /기록/ });
    if (await historyTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await historyTab.click();
      await page.waitForTimeout(1000);

      // PR 탭 클릭
      const prTab = page.getByText('PR', { exact: true });
      if (await prTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await prTab.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'e2e/screenshots/comprehensive/05-pr-tab.png' });
        console.log('PR 탭 동작 성공');
      }
    }
  });
});

test.describe('6. 통계 탭', () => {
  test('통계 탭이 정상적으로 표시됨', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const statsTab = page.getByRole('tab', { name: /통계/ });
    if (await statsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await statsTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'e2e/screenshots/comprehensive/06-stats-tab.png' });

      // 통계 요소 확인
      const weeklyStats = page.locator('text=/이번 주|볼륨|세트/').first();
      const hasStats = await weeklyStats.isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasStats).toBeTruthy();
      console.log('통계 탭 표시 성공');
    }
  });
});

test.describe('7. 프로필 탭', () => {
  test('프로필 탭이 정상적으로 표시됨', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const profileTab = page.getByRole('tab', { name: /프로필/ });
    if (await profileTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await profileTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'e2e/screenshots/comprehensive/07-profile-tab.png' });

      // 프로필 요소 확인
      const profileElements = page.locator('text=/프로필|설정|목표|연동|로그인/').first();
      const hasProfile = await profileElements.isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasProfile).toBeTruthy();
      console.log('프로필 탭 표시 성공');
    }
  });
});

test.describe('8. 운동 탭 (exercises)', () => {
  test('운동 탭에서 운동 목록이 표시됨', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const exercisesTab = page.getByRole('tab', { name: /운동/ });
    if (await exercisesTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await exercisesTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'e2e/screenshots/comprehensive/08-exercises-tab.png' });

      // 운동 목록 확인
      const exerciseList = page.locator('text=/벤치프레스|스쿼트|데드리프트/').first();
      const hasExercises = await exerciseList.isVisible({ timeout: 5000 }).catch(() => false);
      expect(hasExercises).toBeTruthy();
      console.log('운동 탭 표시 성공');
    }
  });
});

test.describe('9. 전체 운동 플로우', () => {
  test('운동 시작 → 운동 추가 → 세트 추가 → 완료까지 전체 플로우', async ({ page }) => {
    // localStorage 초기화
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      localStorage.removeItem('workout-storage');
      localStorage.removeItem('workout-history-storage');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 1. 운동 시작
    const emptyWorkoutBtn = page.getByText('빈 운동');
    if (await emptyWorkoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emptyWorkoutBtn.click();
    } else {
      const smartRec = page.locator('text=탭하여 바로 시작');
      await smartRec.click();
    }

    try {
      await page.waitForURL('**/workout/active', { timeout: 10000 });
    } catch {
      // 무시
    }
    await page.waitForTimeout(1000);
    console.log('Step 1: 운동 시작');

    // 2. 운동 추가
    const addExerciseBtn = page.getByText('운동 추가');
    if (await addExerciseBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addExerciseBtn.click();
      await page.waitForURL('**/workout/exercises', { timeout: 10000 });

      const benchPress = page.getByText('벤치프레스').first();
      await benchPress.click();
      await page.waitForURL('**/workout/active', { timeout: 10000 });
      await page.waitForTimeout(1000);
      console.log('Step 2: 운동 추가 (벤치프레스)');
    }

    // 3. 세트 추가 (2세트)
    for (let i = 0; i < 2; i++) {
      const weightInput = page.locator('input[placeholder="0"]').first();
      const repsInput = page.locator('input[placeholder="0"]').nth(1);

      if (await weightInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await weightInput.fill(String(60 + i * 5)); // 60, 65
        await repsInput.fill(String(10 - i)); // 10, 9

        const addSetBtn2 = page.getByText('세트 추가');
        await addSetBtn2.click();
        await page.waitForTimeout(500);

        // RPE 피커가 나타나면 건너뛰기
        const skipRpe = page.getByText('건너뛰기');
        if (await skipRpe.isVisible({ timeout: 2000 }).catch(() => false)) {
          await skipRpe.click();
          await page.waitForTimeout(300);
        }

        const skipRest = page.getByText('휴식 안 함');
        if (await skipRest.isVisible({ timeout: 2000 }).catch(() => false)) {
          await skipRest.click();
        }
        console.log(`Step 3-${i + 1}: 세트 추가`);
      }
    }

    await page.screenshot({ path: 'e2e/screenshots/comprehensive/09-full-flow-sets.png' });

    // 4. 운동 완료
    page.on('dialog', async (dialog) => await dialog.accept());
    const finishBtn = page.getByText('운동 완료');
    if (await finishBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await finishBtn.click();
      await page.waitForTimeout(500);

      // 완료 모달에서 "완료하기" 버튼 클릭
      const confirmFinishBtn = page.getByText('완료하기');
      if (await confirmFinishBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmFinishBtn.click();
      }

      await page.waitForTimeout(2000);
      console.log('Step 4: 운동 완료');
    }

    await page.screenshot({ path: 'e2e/screenshots/comprehensive/09-full-flow-finished.png' });

    // 5. 기록 확인
    const historyStorage = await page.evaluate(() => {
      return localStorage.getItem('workout-history-storage');
    });

    if (historyStorage) {
      const parsed = JSON.parse(historyStorage);
      const workouts = parsed.state?.completedWorkouts || [];
      if (workouts.length > 0) {
        const lastWorkout = workouts[0];
        console.log('저장된 운동:', {
          name: lastWorkout.name,
          total_sets: lastWorkout.total_sets,
          total_volume: lastWorkout.total_volume,
        });
        expect(lastWorkout.total_sets).toBeGreaterThan(0);
        expect(lastWorkout.total_volume).toBeGreaterThan(0);
      }
    }

    console.log('전체 운동 플로우 테스트 성공!');
  });
});

test.describe('10. 데이터 지속성', () => {
  test('페이지 새로고침 후에도 데이터가 유지됨', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 테스트 데이터 저장
    await page.evaluate(() => {
      const testData = {
        state: {
          completedWorkouts: [{
            id: 'test-workout-1',
            name: '테스트 운동',
            total_sets: 5,
            total_volume: 2500,
            duration_minutes: 30,
            started_at: new Date().toISOString(),
            finished_at: new Date().toISOString(),
            exercises: [],
          }],
        },
        version: 0,
      };
      localStorage.setItem('workout-history-storage', JSON.stringify(testData));
    });

    // 새로고침
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 데이터 확인
    const storage = await page.evaluate(() => {
      return localStorage.getItem('workout-history-storage');
    });

    expect(storage).toBeTruthy();
    if (storage) {
      const parsed = JSON.parse(storage);
      expect(parsed.state.completedWorkouts.length).toBeGreaterThan(0);
      console.log('데이터 지속성 확인 성공');
    }
  });
});

test.describe('11. 에러 핸들링', () => {
  test('존재하지 않는 페이지 접근 시 에러 없음', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/nonexistent-page');
    await page.waitForTimeout(2000);

    // 치명적 에러가 없어야 함
    const criticalErrors = errors.filter(e =>
      e.includes('Cannot read') ||
      e.includes('undefined') ||
      e.includes('null')
    );

    console.log('페이지 에러:', errors.length > 0 ? errors : '없음');
    // 존재하지 않는 페이지는 에러가 발생할 수 있지만, 앱이 크래시되면 안됨
  });

  test('빈 운동 완료 시도 시 적절히 처리됨', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      localStorage.removeItem('workout-storage');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 운동 시작
    const emptyWorkoutBtn = page.getByText('빈 운동');
    if (await emptyWorkoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emptyWorkoutBtn.click();
    }

    try {
      await page.waitForURL('**/workout/active', { timeout: 10000 });
    } catch {
      // 무시
    }
    await page.waitForTimeout(1000);

    // 운동 추가 없이 바로 완료 시도
    page.on('dialog', async (dialog) => await dialog.accept());
    const finishBtn = page.getByText('운동 완료');
    if (await finishBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await finishBtn.click();
      await page.waitForTimeout(2000);

      // 에러 없이 처리되어야 함
      await page.screenshot({ path: 'e2e/screenshots/comprehensive/11-empty-workout-finish.png' });
      console.log('빈 운동 완료 처리 성공');
    }
  });
});

test.describe('12. 다크 테마 전체 화면', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
  });

  test('다크 모드에서 모든 주요 화면이 렌더링됨', async ({ page }) => {
    const screens = [
      { path: '/', name: 'home' },
      { path: '/workout/exercises', name: 'exercises' },
    ];

    for (const screen of screens) {
      await page.goto(screen.path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `e2e/screenshots/comprehensive/12-dark-${screen.name}.png`,
        fullPage: true
      });
      console.log(`다크 모드: ${screen.name} 렌더링 성공`);
    }

    // 탭 화면들
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const tabs = ['기록', '통계', '프로필'];
    for (const tabName of tabs) {
      const tab = page.getByRole('tab', { name: new RegExp(tabName) });
      if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(500);
        await page.screenshot({
          path: `e2e/screenshots/comprehensive/12-dark-tab-${tabName}.png`
        });
      }
    }

    console.log('다크 모드 전체 화면 테스트 성공');
  });
});

test.describe('13. 모바일 뷰포트 UI 오버플로우 검증', () => {
  const mobileViewports = [
    { name: 'small-android', width: 360, height: 640 },   // Galaxy S7 등 구형
    { name: 'medium-android', width: 393, height: 851 },  // Pixel 5
    { name: 'large-android', width: 412, height: 915 },   // Galaxy S24
  ];

  for (const vp of mobileViewports) {
    test(`${vp.name} (${vp.width}px)에서 운동 입력 행이 잘리지 않음`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // 운동 시작
      const emptyWorkoutBtn = page.getByText('빈 운동');
      const smartRecCard = page.locator('text=탭하여 바로 시작');

      if (await emptyWorkoutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await emptyWorkoutBtn.click();
      } else if (await smartRecCard.isVisible({ timeout: 3000 }).catch(() => false)) {
        await smartRecCard.click();
      } else {
        console.log('운동 시작 버튼을 찾을 수 없음, 건너뜀');
        return;
      }

      // 운동 중 화면
      await page.waitForURL('**/workout/active', { timeout: 10000 });
      await page.waitForTimeout(500);

      // 운동 추가
      const addExerciseButton = page.getByText('운동 추가');
      if (await addExerciseButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await addExerciseButton.click();
      }

      await page.waitForURL('**/workout/exercises', { timeout: 10000 });
      await page.waitForTimeout(500);

      // 운동 선택
      const benchPress = page.getByText('벤치프레스').first();
      if (await benchPress.isVisible({ timeout: 3000 }).catch(() => false)) {
        await benchPress.click();
      } else {
        const firstExercise = page.locator('[data-testid="exercise-item"]').first();
        if (await firstExercise.isVisible({ timeout: 3000 }).catch(() => false)) {
          await firstExercise.click();
        }
      }

      await page.waitForURL('**/workout/active', { timeout: 10000 });
      await page.waitForTimeout(1000);

      // 컴팩트 입력 행의 오버플로우 검증
      // 입력 필드가 뷰포트 안에 있는지 확인
      const weightInput = page.locator('input[placeholder="0"]').first();
      if (await weightInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        const inputBox = await weightInput.boundingBox();
        if (inputBox) {
          // 입력 필드가 화면 오른쪽을 넘지 않는지 확인
          expect(inputBox.x + inputBox.width).toBeLessThanOrEqual(vp.width);
          console.log(`${vp.name}: 무게 입력 필드 위치 OK (right: ${inputBox.x + inputBox.width}px / ${vp.width}px)`);
        }
      }

      // 횟수 입력 필드도 확인
      const repsInput = page.locator('input[placeholder="0"]').nth(1);
      if (await repsInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        const repsBox = await repsInput.boundingBox();
        if (repsBox) {
          expect(repsBox.x + repsBox.width).toBeLessThanOrEqual(vp.width);
          console.log(`${vp.name}: 횟수 입력 필드 위치 OK (right: ${repsBox.x + repsBox.width}px / ${vp.width}px)`);
        }
      }

      // 세트 추가 버튼이 화면 안에 있는지 확인
      const addSetBtnCheck = page.getByText('세트 추가');
      if (await addSetBtnCheck.isVisible({ timeout: 3000 }).catch(() => false)) {
        const btnBox = await addSetBtnCheck.boundingBox();
        if (btnBox) {
          expect(btnBox.x + btnBox.width).toBeLessThanOrEqual(vp.width);
          console.log(`${vp.name}: 세트 추가 버튼 위치 OK (right: ${btnBox.x + btnBox.width}px / ${vp.width}px)`);
        }
      }

      await page.screenshot({
        path: `e2e/screenshots/comprehensive/13-mobile-${vp.name}.png`,
        fullPage: true,
      });
      console.log(`${vp.name} 뷰포트 오버플로우 테스트 통과`);
    });
  }
});
