# Task 5 구현 보고서

## 구현 범위

- Next.js App Router에서 홈, 별도 캘린더, 프로필 화면을 연결하고 `AuthProvider`와 계정별 repository provider를 루트에 배치했다.
- 기본 경로는 Firebase 설정이 없으면 설정 안내를 보여준다. 실제 Google redirect 로그인만 사용하며 샘플 로그인이나 실서비스 가짜 일정은 제공하지 않는다.
- 명시적인 개발 미리보기 `/?preview=design`에서만 고정 날짜·요일의 fixture를 보여준다. 배너에는 “디자인 미리보기 · 샘플이며 저장/동기화되지 않음”을 표시하고, 해당 모드에서는 repository 초기화를 막아 Firebase/IndexedDB를 읽거나 쓰지 않는다.
- Figma의 흰 배경·라벤더 색상, 월간 할 일 칸, 상단 최대 2개 기간 진행 행, 시작·종료 표기, 중앙 아이콘 하단바와 테두리 없는 레이아웃을 반영했다. 캘린더는 격자 대신 주/월 날짜 스트립으로 제공한다.
- Figma SVG를 `public/design/`으로 복사해 앱에서 로컬 경로로 사용한다. 신규 production 의존성은 추가하지 않았다.
- Firebase 사용자 데이터는 repository 경계에서만 읽는다. 앱 시작 시 초기 journal 조회가 끝나기 전에는 준비 화면을 보여 계정 데이터가 빈 화면으로 잠깐 보이지 않게 했다.
- 계정 화면에는 사용자 이름·이메일과 동기화 상태, 보존 방식 로그아웃을 연결했다. CRUD 입력과 변경은 Task 6 연결 전까지 비활성/미노출 상태다. 알림 규칙·인앱 알림·알림 설정은 포함하지 않았다.

## 주요 파일

- 라우트 및 루트 Provider: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/calendar/page.tsx`, `src/app/settings/page.tsx`, `src/app/providers.tsx`
- 인증 및 repository 연결: `src/auth/client.ts`, `src/auth/session.tsx`, `src/lib/repository-context.tsx`, `src/lib/repository-runtime.ts`
- 화면 구성: `src/features/routes/`, `src/features/home/`, `src/features/calendar/`, `src/features/shell/`
- Firebase 설정 안내: `src/features/shell/FirebaseSetupGuide.tsx`
- Figma 자산: `public/design/`

## 검증 및 남은 통합 사항

- `CI=true pnpm --config.verifyDepsBeforeRun=false typecheck`: 통과.
- 작성 당시 lint 실행에는 Task7 parser의 unused parameter 경고 1건이 있었으나 해당 후속 변경에서 해결했다. 최신 전체 `pnpm lint`는 경고 없이 통과했다. 현재 결과는 [검증 보고](verification.md)를 기준으로 한다.
- `CI=true pnpm build`: 통과. `/`, `/calendar`, `/settings`, `/tasks`가 정적 페이지로 생성됐다.
- 브라우저 smoke check: `/?preview=design`에서 고정 요일 fixture·배너·비활성 입력을 확인했고, 하단 캘린더 이동 및 “전체 기간 일정 보기”를 클릭해 기간 목록으로 전환되는 것을 확인했다. `/`에서는 Firebase 설정 단계가 보였다. 처음 확인 중 쿼리 변경 시 화면이 갱신되지 않는 문제를 발견해 `useSearchParams`로 수정하고 재확인했다.
- `pnpm test`는 실행하지 않았다. UI wiring의 TDD 테스트를 추가하지 않았고, repository 동작은 Task4의 테스트 범위다.
- macOS에서 확인된 한글 시스템 글꼴은 Apple SD Gothic Neo이므로 CSS는 `Noto Sans KR` 설치 시 우선 사용하고, 기본 설치에서는 Apple SD Gothic Neo/Malgun Gothic으로 대체한다.
