# 데스크톱 UI 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task by task. Track steps with `- [ ]` checkboxes.

**Goal:** 승인된 작고 조밀한 macOS 데스크톱 프리뷰를 Figma 구성요소 우선으로 설계·구현하고, 각 화면을 Figma 프레임과 대조한다.

**Architecture:** 기존 Next.js 16 route와 로컬 프리뷰 저장소를 유지한다. 먼저 현재 Figma 파일에 모든 구성요소와 화면 상태를 매핑하고 완성한 뒤, 기존 feature 폴더에서 공통 셸·홈·기간 동작·주간 캘린더·환경설정을 구현한다. Firebase 동기화와 macOS 네이티브 패키징은 범위에서 제외한다.

**Tech Stack:** Next.js 16, React 19, TypeScript, 기존 CSS Modules, localStorage 프리뷰, Figma SVG, Playwright와 기존 Vitest. 의존성을 추가하지 않는다.

**Spec:** [doc/implementation/07-component-system-design.md](07-component-system-design.md)

작성 기준: 2026-10-05 · 상태: 코드 구현 완료, 최신 Figma/브라우저 시각 검수 대기 · 현재 메인 에이전트만 사용 · Firebase 제외

## Global Constraints

- 사용자가 편집한 현재 Figma 파일 `o81oyODBLYZuzBAkKcWqgp`를 사용한다. 편집 전에 노드 `84:467`, `84:584`를 확인한다. `use_figma` 전에 `figma-use`, `get_design_context` 전에 `figma-design-to-code`를 읽는다.
- Figma 구성요소와 상태가 먼저다. C-01–C-33을 Figma 구성요소/프레임, 코드, 검수 증거까지 추적한다.
- 코드 변경 전에 `node_modules/next/dist/docs/`에서 설치된 Next.js 16의 관련 가이드를 읽는다. TypeScript, 기존 CSS Modules, 2칸 들여쓰기, 세미콜론을 사용하고 `any`, 프로덕션 `console.log`, 새 프로덕션 의존성을 쓰지 않는다.
- Firebase/Auth/Firestore나 Security Rules를 수정하지 않는다. 브라우저 로컬 저장을 클라우드 동기화로 설명하지 않는다. 기존 repository 경계를 유지한다.
- 사용자가 요청한 대로 일반 UI 작업은 테스트 우선 개발(TDD)을 쓰지 않고 구현 후 실제 흐름을 검증한다. 새 시간 겹침 배치처럼 오류 위험이 높은 알고리즘은 해당 부분만 테스트를 먼저 작성한다.
- 프론트엔드 작업에는 현재 메인 에이전트만 사용하는 Native 방식을 따른다. 실제로 어려운 독립 문제에서 고성능 모델이나 별도 에이전트가 필요해지면 사용 전에 범위와 이유를 알리고 사용자 승인을 받는다.
- 기준 창은 `1000×780px`, 가운데 작업 영역 최대 폭은 `840px`다. 넓은 창에서는 바깥 여백만 커지고 앱 UI 크기는 고정한다. 새 패키지, commit/push, macOS 앱 패키징은 이 작업에 포함하지 않는다.

## Review Focus

- 기준 창 `1000×780`에서 글자·조작 요소·오버레이·하단 탐색이 잘리거나 겹치지 않는가? 모든 Figma 프레임과 프리뷰 캡처를 대조한다.
- `1440×1024`와 `2000×1200`에서 작업 영역이 최대 840px로 유지되고 가운데 놓이는가? 데스크톱 프리뷰의 실제 bounding box를 확인한다.
- 기간 오버레이가 아래 화면을 밀지 않고 덮으며 포커스를 올바르게 돌려주는가? 열기/닫기, 바깥 클릭, Escape, reduced-motion을 확인한다.
- 할 일 완료 상태를 바꾸거나 드래그했을 때 해당 완료 그룹 안에서만 이동하고 새로고침 후 순서가 남는가? 로컬 프리뷰에서 확인한다.
- 주 시작일/시간 표시 설정을 바꿔도 일정이 의도한 Asia/Seoul 날짜·시각에 남는가? DST가 없는 날짜와 연 경계에서 확인한다.

---

## Task 1: Figma 현 상태를 확인하고 구성요소 매핑을 만든다

**Files:** 생성: `doc/implementation/component-mapping.md`. 앱 코드는 수정하지 않는다.

**Interfaces:** 입력: C-01–C-33과 현재 Figma 파일. 산출물: 프레임/구성요소 링크, 확인된 토큰, 구현에서 쓸 SVG 경로.

- [x] Figma의 현재 페이지와 프레임을 확인한다. 사용자가 수정한 `84:467`, `84:584`의 크기·간격·색·구성요소를 기록한다.
- [x] `component-mapping.md`에 C-01–C-33 각각의 Figma 구성요소/프레임, 노드 링크, 코드 위치, 검수 증거 경로 열을 만든다. 실제 확인한 값만 확정 값으로 기록한다.
- [x] 기존 Figma 구성요소와 재사용 가능한 SVG를 식별하고 모든 33개 구성요소에 소유 위치가 있는지 확인한다. 사용자가 편집한 노드를 복제하거나 다시 만들지 않는다.

## Task 2: Figma 토큰·구성요소·상태·화면을 완성한다

**Files:** 기존 Figma 파일. 수정: `doc/implementation/component-mapping.md`, `doc/implementation/assets/README.md`에 최종 노드·SVG 정보를 기록한다.

**Interfaces:** Task 1의 매핑을 입력으로 사용한다. 산출물: 코드에서 임의로 간격/동작을 정하지 않아도 되는 Figma 프레임과 SVG 참조.

- [ ] `Component system` 페이지에 색·글꼴·간격·그림자·focus 토큰과 버튼, 월간 날짜 칸, 할 일 행, 드래그 핸들, 기간 bar/카드, 오버레이, 메뉴, 입력/다이얼로그, 주간 시간표, 하단 탐색, 설정 행을 만든다.
- [ ] focus/hover/pressed/disabled, empty/error/saving, 예정/진행/종료, 미완료/완료, 드래그 대상, 오버레이/메뉴 열림·닫힘 상태를 만든다.
- [ ] `1000×780` 데스크톱 화면 9개를 완성한다: foundation, 홈, 기간 오버레이, 추가 메뉴, 선착순 신청 폼, 기간 내 할 일 폼, 주간 캘린더, 기간 목록, 설정. 주요 이동을 프로토타입으로 연결한다.
- [ ] 기간 양 끝 표기, 제목-bar 간격, 오버레이 가림, 3열 정렬, 하단 중앙 아이콘, 잘림/겹침을 확인한다. 프레임 캡처와 최종 노드·SVG·토큰을 매핑 문서에 기록한다.

## Task 3: 고정 폭 셸과 하단 탐색을 구현한다

**Files:** 수정: `src/features/shell/AppShell.tsx`, `AppShell.module.css`, `BottomNavigation.tsx`, `BottomNavigation.module.css`, `src/app/page.tsx`, `src/app/calendar/page.tsx`, `src/app/settings/page.tsx`(필요한 부분만).

**Interfaces:** Task 2의 셸 토큰과 SVG를 사용한다. 홈·주간 캘린더·설정 route에서 같은 고정 폭 셸을 제공한다.

- [x] route/layout을 바꾸기 전에 설치된 Next.js 16 App Router와 정적 내보내기 가이드를 `node_modules/next/dist/docs/`에서 읽는다.
- [x] 작업 영역을 최대 840px로 가운데 놓고, 넓은 창에서 크기를 고정한다. 기준보다 작은 창에서만 내부 세로 스크롤을 허용한다.
- [x] 아이콘 세 개로 홈·주간 캘린더·설정을 연결한다. Figma SVG, 접근성 이름, 현재 선택 상태, 툴팁, focus, 브라우저 탐색 이력을 맞춘다.
- [ ] `1000×780`, `1440×1024`, `2000×1200`에서 route 동작과 작업 영역 bounding box를 확인하고 캡처를 저장한다.

## Task 4: 홈 기간 카드와 화면을 덮는 오버레이를 구현한다

**Files:** 수정: `src/features/home/HomeExperience.tsx`, `HomeExperience.module.css`, `PeriodProgressSummary.tsx`, `PeriodProgressSummary.module.css`. 생성: `src/features/home/PeriodCard.tsx` / `.module.css`, `PeriodOverflowOverlay.tsx` / `.module.css`.

**Interfaces:** 기존 기간 projection과 Task 3 셸을 사용한다. 홈에는 최대 3개 카드와 접근 가능한 추가 목록을 제공한다.

- [x] 가장 급한 진행 중/예정 기간 최대 3개를 Figma 간격으로 표시한다. 카드에는 제목, 진행 bar, 시작/종료 끝점, 남은 시간/하위 할 일 요약 한 가지만 두어 문구를 중복하지 않는다.
- [x] 예정/진행/종료 색을 구분하고 시간 경과율과 하위 할 일 완료를 분리한다.
- [x] Figma SVG 화살표에서 3열 오버레이를 열고 전체 기간을 급한 순으로 표시한다. 높이는 최대 `70vh`, 넘치는 항목은 패널 안에서만 스크롤하며 홈 레이아웃 좌표를 유지한다.
- [ ] 바깥 클릭/Escape/닫기 버튼, 포커스 복귀, reduced-motion을 구현한다. 기간 0/1/2/3/4+/7개를 확인하고 `1000×780` 닫힘/열림 캡처를 저장한다.

## Task 5: 월간 할 일·추가 메뉴·완료·순서를 구현한다

**Files:** 수정: `src/features/home/MonthTaskGrid.tsx`, `MonthTaskGrid.module.css`, `SelectedDayTasks.tsx`, `SelectedDayTasks.module.css`, `task-order.ts`, `src/lib/local-preview-store.ts`, `src/features/items/ItemEditor.tsx`, `ItemEditor.module.css`, `src/features/routes/TasksRoute.tsx`, `src/features/tasks/AllTasks.tsx` / `.module.css`. 생성: `src/features/home/TopActionMenu.tsx` / `.module.css`, `src/features/home/TaskRow.tsx`, `TaskDragHandle.tsx`, `src/features/items/DialogShell.tsx`, `DailyTaskFields.tsx`, `WindowPeriodFields.tsx`, `DeadlinePeriodFields.tsx`; `tests/e2e/design-preview.spec.ts`와 관련 E2E를 보강한다.

**Interfaces:** 홈 편집기는 선택 날짜를 받는다. 추가 메뉴는 고정된 `window` 또는 `deadline` 유형을 연다. `ItemEditor`에 선택적 `fixedKind?: ItemKind`를 추가해 새 진입에서 유형을 바꾸지 못하게 하고, 기존 편집 흐름의 유형 수정은 유지한다.

- [x] 월 이동, 날짜 선택, 선택일 목록, 하루 할 일 점 표기를 Figma에 맞춘다. 기간/고정 일정은 할 일 점에 섞지 않는다.
- [x] 선택 날짜의 `+`는 `task` 폼을 연다. 햄버거에는 `선착순 신청 추가`(`window`)와 `기간 내 할 일 추가`(`deadline`)만 둔다.
- [x] 미완료/완료 그룹을 분리한다. 체크한 항목은 완료 그룹 맨 아래로, 체크 해제 항목은 미완료 그룹 맨 아래로 옮긴다. 전용 누름-드래그 조작은 280ms 뒤 시작하고 현재 그룹 내에서만 재정렬한다. 키보드 재정렬도 그룹을 벗어나지 않게 한다.
- [ ] 날짜별 순서와 완료 상태를 로컬 프리뷰 새로고침 후에도 보존한다. 월 경계·날짜 전환·추가/취소·두 고정 유형 폼·완료/재개방·그룹 제한 드래그·키보드·새로고침을 E2E로 확인한다.
- [x] 날짜 미정 task route의 홈 진입·빈 상태·추가·완료·그룹 제한 재정렬을 완성한다. 기간 하위 할 일의 최대 4개와 부모 완료 상태 분리를 확인한다.
- [x] 편집 다이얼로그의 최초 포커스/Tab trap/Escape와 취소를 확인한다. 로컬 저장이 성공한 뒤에만 기기 저장 상태를 보이고 실패 시 입력 내용을 보존한다.

## Task 6: 주간 시간표·기간 목록·로컬 ICS 가져오기를 구현한다

**Files:** 수정: `src/features/routes/CalendarRoute.tsx`, `src/features/calendar/PeriodList.tsx` / `.module.css`, `SelectedDayAgenda.tsx` / `.module.css`, `calendar-dates.ts`, `src/features/import/ImportControls.tsx`, `ImportPreview.tsx`. 생성: `src/features/calendar/WeekCalendarView.tsx` / `.module.css`, `WeekCalendarHeader.tsx`, `WeekAllDayLane.tsx`, `WeekTimeGrid.tsx`, `TimedEventBlock.tsx`, `weekly-layout.ts`. 필요할 때만 `src/app/calendar/page.tsx`, `src/lib/local-preview-store.ts`를 수정한다. 테스트: `tests/features/weekly-layout.test.ts`와 관련 E2E.

**Interfaces:** `WeekCalendarViewProps`는 `{ items: readonly ItemView[]; weekStartsOn: 0 | 1; timeFormat: '24h' | '12h'; timeZone: string; visibleStartHour: number; visibleEndHour: number; onOpen(item: ItemView): void; onAdd(date: string, startTime: string): void }`다. Task 6에서는 기본값 일요일/24시간/Asia/Seoul/08–22를 전달하고, Task 7에서 저장된 설정으로 연결한다. 시간 이벤트 레이아웃 함수는 `layoutTimedEvents(events: readonly { id: string; startMinute: number; endMinute: number }[]): readonly { id: string; column: number; columnCount: number }[]`를 제공한다. 입력/수정은 기존 `ItemEditor`를 고정 `event` 유형으로 연다.

- [x] 캘린더 route의 기본 화면을 월간 격자에서 7일 시간표와 종일/기간 lane으로 바꾼다. 홈의 월간 격자는 유지한다.
- [x] 이전/오늘/다음 주, 날짜 열, 기본 `08:00–22:00` 시간 눈금, 고정 일정 block, 하루 할 일 마감 표식, 기간 연결 표시를 만든다. 설정한 주 시작일과 24시간 표시를 적용한다.
- [x] 고정 일정 block 선택은 편집을 열고 빈 시간 선택은 날짜·시각이 미리 입력된 고정 일정 폼을 연다. 일정 종료가 시작보다 이르거나 종일인 경우를 처리한다.
- [ ] 겹치는 일정은 가로 열로 나누고, 겹치지 않는 연속 일정은 같은 열을 재사용한다. 제목이 좁으면 잘라 표시하고 편집에서 전체 제목을 확인할 수 있게 한다.
- [ ] 겹침 배치는 오류 위험이 있는 알고리즘이므로 해당 부분만 TDD를 적용한다. `tests/features/weekly-layout.test.ts`에 비겹침, 30분, 여러 시간, 부분/중첩 겹침, 연속 일정 테스트를 먼저 쓰고 실패를 확인한 후 구현해 통과시킨다. 일정 배치 패키지나 사용자 승인 없는 모델 확장은 추가하지 않는다.
- [x] `기간` 버튼을 기존 전체 기간/완료 목록으로 연결한다. 제목 클릭 편집을 추가했다.
- [x] 로컬 프리뷰에서도 `.ics` 파일이 기존 미리보기 화면을 열게 한다. 선택·검증한 항목만 로컬 저장하고 취소/오류에서는 저장 항목을 바꾸지 않는다. 로그인 repository 경로는 유지한다.

## Task 7: 저장되는 데스크톱 설정을 구현한다

**Files:** 수정: `src/features/routes/ProfileRoute.tsx`와 CSS, `LocalNotificationSettings.tsx` / `.module.css`, `BottomNavigation.tsx`, `src/features/items/ItemEditor.tsx`. 생성: `src/lib/desktop-preferences.ts`, `src/features/routes/SettingsSection.tsx`, `SettingsControl.tsx`, `LocalDataSettings.tsx`, `src/features/items/EventFields.tsx`, `src/features/shell/LocalSaveStatus.tsx`. 테스트: `tests/e2e/local-preview.spec.ts` 및 관련 백업/가져오기 E2E.

**Interfaces:** `DesktopPreferences`는 `weekStartsOn: 0 | 1`, `timeFormat: '24h' | '12h'`, `timeZone: string`, `visibleStartHour: number`, `visibleEndHour: number`를 갖는다. `readDesktopPreferences(): DesktopPreferences`와 `saveDesktopPreferences(value: DesktopPreferences): void`를 내보낸다. 시간대는 `Intl.DateTimeFormat`으로 검증하고 기본값은 일요일, 24시간, `Asia/Seoul`, `08–22`로 둔다.

- [x] 프리뷰의 프로필 화면을 설정 위계와 Figma 아이콘으로 바꾼다. 비프리뷰 계정 모드에서 쓰는 기존 계정/동기화 기능은 유지한다.
- [x] 시간 표시, 주 시작일, 시간 범위, 시간대, 알림을 기기에 저장한다. 알림 기본값은 꺼짐이고 카운트다운 화면 표시와 분리한다.
- [x] 설정 변경을 주간 시간표에 반영한다. 로컬 프리뷰의 JSON 내보내기/복원은 복원 전 요약과 명시 확인을 제공하고, 기존 로그인 repository 백업 경로도 유지한다. 로컬 데이터가 다른 기기와 자동 공유된다고 표현하지 않는다.
- [ ] 기본값·저장/재열기/새로고침·주 시작/시간 범위/시간대 변경·알림 꺼짐·잘못된 백업·복원 취소·저장 실패를 확인한다.

## Task 8: 모든 구성요소를 대조하고 프리뷰를 검증한다

**Files:** 갱신: `doc/implementation/component-mapping.md`, `doc/implementation/assets/README.md`, `doc/implementation/assets/verification/`. 앞선 단계에서 발견한 결함과 필요한 기존 unit/E2E만 수정한다.

**Interfaces:** 07의 acceptance 기준과 모든 앞선 작업을 입력으로 사용한다. 산출물: 화면별 Figma/실행 캡처, 검수 결과, 사용자가 확인할 개발 서버.

- [ ] 홈, 오버레이, 메뉴, 두 기간 폼, 주간 캘린더, 기간 목록, 설정을 `1000×780`에서 캡처한다. C-01–C-33 행마다 Figma 링크와 해당 실행 캡처를 기록한다.
- [ ] 텍스트-bar 간격, 크기, 아이콘 정렬, 오버레이 가림, 격자, 잘림, 빈/오류/focus 상태, 1440px 이상 고정 폭을 대조한다. 발견한 시각 불일치를 수정하고 해당 캡처를 다시 만든다.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:e2e`를 실행한다. `pnpm test`는 Firebase Emulator Rules도 실행한다. JDK 21이 없어 시작하지 못하면 환경 제약과 실패 위치를 기록하고 통과로 보고하지 않는다.
- [ ] 현재 개발 서버를 `http://localhost:3001/?preview=design`에서 유지하거나 실행하고 홈·주간·설정의 로컬 저장 흐름을 직접 확인한다. macOS 앱 패키징은 다음 단계라고 명시한다.

### 현재 실행 메모

기능 코드는 준비됐고 C-01–C-33 구성요소별 동작표는 [09-ui-audit-and-component-behavior.md](09-ui-audit-and-component-behavior.md)에 있다. `pnpm test:unit` 213개, `pnpm typecheck`, `pnpm lint`가 최신 코드에서 통과했다. 전체 `pnpm test`의 Rules 단계는 JDK가 없어 시작되지 않았으며 `pnpm build`와 최신 브라우저 흐름 검증은 아직 남아 있다. Figma 직접 편집과 앱 화면 열기는 도구 자동 검토에서 현재 모델 용량을 이유로 거부되어 수행하지 못했고 다른 UI 경로로 우회하지 않았다. 따라서 마지막 캡처 대조 단계는 완료되지 않았다.
