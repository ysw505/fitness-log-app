# AGENTS.md - 자동화 시스템 가이드

## 건의하기 이미지 업로드 (feedbackService)

### 구조
- `src/services/feedbackService.ts` - GitHub Contents API로 이미지 업로드 + 이슈 생성
- `app/(tabs)/profile.tsx` - 피드백 모달 UI, ImagePicker `base64: true`로 직접 base64 획득
- `app.json` - `expo-image-picker` 플러그인 등록 (Android 권한)

### 핵심 포인트
- ImagePicker에서 `base64: true` 옵션으로 base64를 직접 받음 (URI → base64 변환 불필요)
- `expo-file-system` 의존성 제거됨 - Android에서 URI→base64 변환 실패 문제 해결
- `feedbackImages` 상태: `{uri: string; base64: string}[]` 타입
- 이미지 품질: `quality: 0.5` (업로드 크기 최적화)

---

## 이슈 자동 처리 시스템 (Cron Job)

### 스크립트
- `scripts/auto-reply-issues.sh` - 메인 자동화 스크립트
- 로그: `scripts/auto-reply.log`

### Cron 설정
```
*/30 * * * * /root/fitness-log-app/scripts/auto-reply-issues.sh >> /root/fitness-log-app/scripts/auto-reply.log 2>&1
```

### 동작 흐름
1. GitHub API로 `feedback` 라벨 + `open` 이슈 조회
2. `auto-replied` 라벨 없는 새 이슈만 처리
3. 접수 확인 코멘트 게시
4. `fix/issue-{번호}` 개발 브랜치 생성
5. 첨부 이미지 다운로드 (있는 경우)
6. **Claude CLI (sonnet)** 로 이슈 분석 + 필요시 코드 수정
   - `--dangerously-skip-permissions --allowedTools "Read Edit Write Bash Glob Grep"`
   - 웹 빌드(`npx expo export --platform web`)로 검증
   - git commit/push는 하지 않음 (스크립트가 처리)
7. **모바일 e2e 테스트** - 4개 뷰포트:
   - `mobile-android` (Pixel 5, 393px)
   - `mobile-android-small` (Pixel 2, 411px)
   - `mobile-iphone` (iPhone 14, 390px)
   - `mobile-iphone-small` (iPhone SE, 375px)
8. 스크린샷 최대 8장 GitHub 레포에 업로드
9. 코드 변경 있으면 → 커밋 → 푸시 → **PR 자동 생성** (master 대상)
10. 결과 코멘트 게시 (상태/요약/테스트 결과 테이블/스크린샷)
11. `auto-replied` 라벨 추가 (중복 방지)
12. master로 복귀, 변경 없으면 브랜치 삭제

### 라벨
- `feedback` - 앱 내 건의하기로 생성된 이슈
- `auto-replied` - 자동 처리 완료된 이슈

### 이슈 코멘트 구조
```markdown
## 처리 결과
**상태:** 수정완료|분석완료|수정불필요
**내용:** 요약
**변경 파일:** 파일 목록
**PR:** PR URL (수정 시)

### 모바일 E2E 테스트
| 뷰포트 | 결과 | 상세 |

### 검증 스크린샷
![screenshot](url)
```

---

## E2E 테스트

### 설정
- `playwright.config.ts` - 5개 프로젝트 (chromium + 4 모바일)
- `e2e/workout.spec.ts` - 운동 플로우 테스트
- `e2e/comprehensive.spec.ts` - 종합 기능 테스트

### 실행
```bash
# 전체
npx playwright test --project=chromium

# 모바일
npx playwright test --project=mobile-android
npx playwright test --project=mobile-iphone

# 특정 테스트
npx playwright test -g "모바일 뷰포트"
```

### 스크린샷 경로
- `e2e/screenshots/` - 기본 스크린샷
- `e2e/screenshots/comprehensive/` - 종합 테스트 스크린샷

---

## 빌드

### 웹
```bash
npx expo export --platform web
```

### Android APK (로컬)
```bash
export ANDROID_HOME=/opt/android-sdk
eas build --platform android --profile preview --non-interactive --local
```
- 결과물: `build-{timestamp}.apk`

### 환경변수
- `.env` - `EXPO_PUBLIC_GITHUB_TOKEN`, Supabase 키
- GitHub 토큰: 이슈 생성, 이미지 업로드, PR 생성에 사용
