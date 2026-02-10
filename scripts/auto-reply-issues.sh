#!/bin/bash
# GitHub 이슈 자동 처리 스크립트
# feedback 이슈 → 개발브랜치 → Claude 분석/수정 → 모바일 e2e 테스트 → 스크린샷 → PR

set -euo pipefail

PROJECT_DIR="/root/fitness-log-app"
GITHUB_TOKEN="$(grep EXPO_PUBLIC_GITHUB_TOKEN ${PROJECT_DIR}/.env | cut -d= -f2)"
REPO="ysw505/fitness-log-app"
API="https://api.github.com/repos/${REPO}"
CLAUDE_BIN="/root/.local/bin/claude"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

post_comment() {
  local issue_number="$1"
  local body="$2"
  curl -s -X POST \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg body "$body" '{body: $body}')" \
    "${API}/issues/${issue_number}/comments" > /dev/null 2>&1
}

add_label() {
  local issue_number="$1"
  local label="$2"
  curl -s -X POST \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "Content-Type: application/json" \
    -d "{\"labels\":[\"${label}\"]}" \
    "${API}/issues/${issue_number}/labels" > /dev/null 2>&1
}

upload_screenshot() {
  local file_path="$1"
  local issue_number="$2"
  local file_name
  file_name=$(basename "$file_path")
  local timestamp
  timestamp=$(date +%s%N | head -c13)
  local remote_path="feedback-images/e2e-${issue_number}-${timestamp}-${file_name}"

  local base64_content
  base64_content=$(base64 -w0 "$file_path")

  local response
  response=$(curl -s -w "\n%{http_code}" -X PUT \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg msg "e2e screenshot issue #${issue_number}" --arg content "$base64_content" '{message: $msg, content: $content}')" \
    "${API}/contents/${remote_path}")

  local http_code
  http_code=$(echo "$response" | tail -1)
  if [ "$http_code" -eq 201 ]; then
    echo "$response" | sed '$d' | jq -r '.content.download_url'
  else
    echo ""
  fi
}

kill_port() {
  local pids
  pids=$(lsof -ti:8081 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 2
  fi
}

if [ -z "$GITHUB_TOKEN" ]; then
  log "ERROR: GitHub 토큰을 찾을 수 없습니다"
  exit 1
fi

# feedback 라벨 + open 상태 이슈 조회
issues=$(curl -s \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "${API}/issues?labels=feedback&state=open&per_page=20")

issue_count=$(echo "$issues" | jq 'length')
log "feedback 이슈 ${issue_count}개 발견"

if [ "$issue_count" -eq 0 ]; then
  log "처리할 이슈 없음"
  exit 0
fi

while read -r issue; do
  issue_number=$(echo "$issue" | jq -r '.number')
  issue_title=$(echo "$issue" | jq -r '.title')
  issue_body=$(echo "$issue" | jq -r '.body // ""')
  issue_images=$(echo "$issue" | jq -r '.body // "" | capture("!\\[(?<alt>[^]]*)\\]\\((?<url>[^)]+)\\)"; "g") | .url' 2>/dev/null || true)
  labels=$(echo "$issue" | jq -r '[.labels[].name] | join(",")')

  if echo "$labels" | grep -q "auto-replied"; then
    log "#${issue_number} - 이미 처리됨, 스킵"
    continue
  fi

  log "#${issue_number} 처리 시작: ${issue_title}"

  # 1단계: 접수 확인
  post_comment "$issue_number" "👋 피드백 확인했습니다! 분석 및 처리를 시작합니다.

🤖 *자동 처리 시스템*"

  # 2단계: 개발 브랜치 생성
  branch_name="fix/issue-${issue_number}"
  cd "$PROJECT_DIR"
  git checkout -- e2e/screenshots/ 2>/dev/null || true
  rm -rf test-results/ 2>/dev/null || true
  git checkout master 2>/dev/null || true
  git pull origin master 2>/dev/null || true
  git branch -D "$branch_name" 2>/dev/null || true
  git checkout -b "$branch_name"
  log "#${issue_number} - 브랜치 생성: ${branch_name} (현재: $(git branch --show-current))"

  # 3단계: 이미지 다운로드
  image_context=""
  img_idx=0
  if [ -n "$issue_images" ]; then
    while IFS= read -r img_url; do
      [ -z "$img_url" ] && continue
      img_path="/tmp/issue-${issue_number}-img-${img_idx}.jpg"
      curl -sL -o "$img_path" "$img_url" 2>/dev/null && {
        image_context="${image_context} 첨부 이미지 ${img_idx}: ${img_path}"
        img_idx=$((img_idx + 1))
      }
    done <<< "$issue_images"
  fi

  # 4단계: Claude 분석 + 코드 수정
  claude_prompt="GitHub 이슈 #${issue_number} 피드백을 처리해줘.

제목: ${issue_title}
내용: ${issue_body}
${image_context}

지침:
1. 피드백 내용을 분석해서 실제 앱 코드 수정이 필요한지 판단해
2. 수정이 필요하면 코드를 수정하고 웹 빌드(npx expo export --platform web)로 검증해
3. 수정이 불필요한 단순 의견이면 분석 결과만 정리해
4. 절대로 git 명령어를 실행하지 마 (git commit, git push, git checkout 등 모든 git 명령 금지)
5. 마지막에 반드시 다음 형식으로 요약을 출력해:

===SUMMARY_START===
상태: [수정완료|분석완료|수정불필요]
내용: [한국어로 2~3문장 요약]
변경파일: [수정한 파일 목록, 없으면 '없음']
===SUMMARY_END==="

  log "#${issue_number} - Claude 분석 시작"

  claude_output=$(cd "$PROJECT_DIR" && "$CLAUDE_BIN" -p "$claude_prompt" \
    --model sonnet \
    --print \
    --dangerously-skip-permissions \
    --allowedTools "Read Edit Write Bash Glob Grep" \
    2>/dev/null) || {
    log "#${issue_number} - Claude 처리 실패"
    post_comment "$issue_number" "⚠️ 자동 처리 중 오류가 발생했습니다. 개발자가 직접 확인하겠습니다.

🤖 *자동 처리 시스템*"
    add_label "$issue_number" "auto-replied"
    git checkout master 2>/dev/null
    git branch -D "$branch_name" 2>/dev/null || true
    continue
  }

  # 4.5단계: Claude가 브랜치를 변경했을 수 있으므로 복구
  current_branch=$(git branch --show-current 2>/dev/null)
  if [ "$current_branch" != "$branch_name" ]; then
    log "#${issue_number} - 브랜치 복구: ${current_branch} → ${branch_name}"
    git checkout "$branch_name" 2>/dev/null || git checkout -b "$branch_name" 2>/dev/null || true
  fi

  # 5단계: 요약 추출
  summary=$(echo "$claude_output" | sed -n '/===SUMMARY_START===/,/===SUMMARY_END===/p' | grep -v '===SUMMARY')
  status_line=$(echo "$summary" | grep '상태:' | sed 's/상태: *//')
  content_line=$(echo "$summary" | grep '내용:' | sed 's/내용: *//')
  files_line=$(echo "$summary" | grep '변경파일:' | sed 's/변경파일: *//')

  if [ -z "$status_line" ]; then
    status_line="분석완료"
    content_line="처리 결과를 확인해주세요."
    files_line="없음"
  fi

  log "#${issue_number} - 처리 결과: ${status_line}"

  # 6단계: 모바일 e2e 테스트 (Android + iPhone 뷰포트)
  log "#${issue_number} - 모바일 e2e 테스트 시작"
  kill_port

  e2e_results=""
  overall_passed=true

  for project in "mobile-android" "mobile-android-small" "mobile-iphone" "mobile-iphone-small"; do
    log "#${issue_number} - 테스트: ${project}"
    test_output=""
    test_ok=false
    test_output=$(cd "$PROJECT_DIR" && CI=1 npx playwright test --project="$project" \
      --reporter=list 2>&1) && test_ok=true || test_ok=false

    passed=$(echo "$test_output" | grep -oP '\d+ passed' | grep -oP '\d+' || echo "0")
    failed=$(echo "$test_output" | grep -oP '\d+ failed' | grep -oP '\d+' || echo "0")

    if [ "$test_ok" = true ]; then
      e2e_results="${e2e_results}
| ${project} | ✅ 통과 | ${passed}개 통과 |"
    else
      e2e_results="${e2e_results}
| ${project} | ❌ 실패 | ${passed}개 통과, ${failed}개 실패 |"
      overall_passed=false
    fi
  done

  kill_port

  e2e_table="| 뷰포트 | 결과 | 상세 |
|--------|------|------|${e2e_results}"

  if [ "$overall_passed" = true ]; then
    e2e_summary="✅ 모든 모바일 뷰포트 테스트 통과"
  else
    e2e_summary="⚠️ 일부 뷰포트에서 테스트 실패"
  fi

  log "#${issue_number} - e2e 완료: ${e2e_summary}"

  # 7단계: 스크린샷 수집 및 업로드
  screenshot_markdown=""
  mapfile -t screenshot_arr < <(find "${PROJECT_DIR}/e2e/screenshots" -name "*.png" -mmin -10 -type f 2>/dev/null | sort | head -8 || true)

  if [ ${#screenshot_arr[@]} -eq 0 ]; then
    mapfile -t screenshot_arr < <(find "${PROJECT_DIR}/e2e/screenshots" -name "*.png" -type f 2>/dev/null | sort | head -8 || true)
  fi

  if [ ${#screenshot_arr[@]} -gt 0 ]; then
    log "#${issue_number} - ${#screenshot_arr[@]}개 스크린샷 업로드 중"
    sc_idx=0
    for sc_file in "${screenshot_arr[@]}"; do
      [ -z "$sc_file" ] && continue
      sc_url=$(upload_screenshot "$sc_file" "$issue_number")
      if [ -n "$sc_url" ]; then
        sc_name=$(basename "$sc_file" .png | sed 's/-/ /g')
        screenshot_markdown="${screenshot_markdown}
![${sc_name}](${sc_url})"
        sc_idx=$((sc_idx + 1))
      fi
    done
    log "#${issue_number} - ${sc_idx}개 스크린샷 업로드 완료"
  fi

  # 8단계: 코드 변경이 있으면 커밋 + 푸시 + PR
  pr_url=""
  has_changes=$(git status --porcelain 2>/dev/null | grep -v '^?? e2e/' | grep -v '^?? test-results/' || true)

  if [ -n "$has_changes" ] && [ "$status_line" = "수정완료" ]; then
    log "#${issue_number} - 변경사항 커밋 및 PR 생성"

    git add -A
    git reset -- e2e/screenshots/ test-results/ playwright-report/ 2>/dev/null || true
    git reset -- '*.apk' '*.aab' '*.ipa' download/ scripts/auto-reply.log .env 2>/dev/null || true
    git commit -m "Fix: issue #${issue_number} - ${issue_title}

${content_line}

Closes #${issue_number}
Co-Authored-By: Claude AI <noreply@anthropic.com>"

    git push -u origin "$branch_name" --force 2>/dev/null

    # PR 생성
    pr_response=$(curl -s -w "\n%{http_code}" -X POST \
      -H "Authorization: Bearer ${GITHUB_TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      -H "Content-Type: application/json" \
      -d "$(jq -n \
        --arg title "Fix: #${issue_number} ${issue_title}" \
        --arg head "$branch_name" \
        --arg base "master" \
        --arg body "## Issue #${issue_number}: ${issue_title}

${content_line}

**변경 파일:** ${files_line}

### E2E 테스트
${e2e_summary}

${e2e_table}

Closes #${issue_number}

---
🤖 *자동 생성된 PR*" \
        '{title: $title, head: $head, base: $base, body: $body}')" \
      "${API}/pulls")

    pr_http=$(echo "$pr_response" | tail -1)
    if [ "$pr_http" -eq 201 ]; then
      pr_url=$(echo "$pr_response" | sed '$d' | jq -r '.html_url')
      log "#${issue_number} - PR 생성: ${pr_url}"
    else
      log "#${issue_number} - PR 생성 실패 (HTTP ${pr_http})"
    fi
  else
    log "#${issue_number} - 코드 변경 없음, PR 스킵"
  fi

  # master로 복귀
  git checkout master 2>/dev/null
  if [ -z "$has_changes" ] || [ "$status_line" != "수정완료" ]; then
    git branch -D "$branch_name" 2>/dev/null || true
  fi

  # 9단계: 결과 코멘트
  result_comment="## 처리 결과

**상태:** ${status_line}
**내용:** ${content_line}
**변경 파일:** ${files_line}"

  if [ -n "$pr_url" ]; then
    result_comment="${result_comment}
**PR:** ${pr_url}"
  fi

  result_comment="${result_comment}

### 모바일 E2E 테스트
${e2e_summary}

${e2e_table}"

  if [ -n "$screenshot_markdown" ]; then
    result_comment="${result_comment}

### 검증 스크린샷
${screenshot_markdown}"
  fi

  result_comment="${result_comment}

---
🤖 *이 응답은 AI가 자동으로 작성했습니다*"

  post_comment "$issue_number" "$result_comment"
  add_label "$issue_number" "auto-replied"
  log "#${issue_number} - 완료"

  rm -f /tmp/issue-${issue_number}-img-*.jpg 2>/dev/null

done < <(echo "$issues" | jq -c '.[]')

log "전체 처리 완료"
