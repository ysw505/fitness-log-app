# 프로젝트 지침

## 프로젝트 개요
- React Native + Expo 54 피트니스 기록 앱
- Supabase (인증, DB, Storage), Zustand (상태관리)
- 타겟: Android 우선, Web 지원

## 빌드 & 테스트
- 웹 빌드: `npx expo export --platform web`
- 안드로이드 빌드: `eas build --platform android --profile preview --non-interactive`
- e2e 전체: `npx playwright test --project=chromium`
- 모바일 뷰포트 테스트: `npx playwright test -g "모바일 뷰포트"`

## GitHub 이슈/코멘트 이미지 읽는 법
1. `WebFetch`로 이슈 페이지에서 이미지 URL 추출 (user-attachments URL)
2. `curl -sL -o /tmp/img.jpg "URL"` 로 다운로드
3. `Read` 도구로 `/tmp/img.jpg` 읽으면 이미지 확인 가능 (multimodal)
- WebFetch는 이미지를 직접 렌더링 못함, 반드시 curl → Read 경로 사용

## Android UI 주의사항
- 컴팩트 한 줄에 고정 너비 요소 많으면 좁은 안드로이드(360px)에서 오버플로우
- `flex: 1` 사용 시 반드시 `minWidth: 0` 같이 설정 (flexbox shrink 문제)
- `overflow: 'hidden'` + `flexShrink: 0` (버튼 등 고정 요소)으로 안전장치
- 요소 많으면 2줄 레이아웃으로 분리가 근본 해결책

## 건의하기 기능
- 앱 내 프로필 탭 > 건의하기 → GitHub 이슈 자동 생성
- 레포: https://github.com/ysw505/fitness-log-app
- 서비스: `src/services/feedbackService.ts`
- GitHub 토큰: `.env`의 `EXPO_PUBLIC_GITHUB_TOKEN`

## 세트 추가 버튼
- 텍스트: "세트 추가" (이전 "+" 에서 변경됨)
- e2e 테스트에서 `page.getByText('세트 추가')` 로 찾음
