# 프론트엔드 구현 전달 계획

> 구현 담당자는 이 문서의 태스크를 하나씩 완료하고, 각 태스크에 적힌 검증을 남긴다. 이 문서는 구현 계획이며 구현이 완료되었다는 뜻은 아니다.

> 화면 계약은 [07 데스크톱 컴포넌트 시스템 설계](07-component-system-design.md)가 최신 기준이다. 기존의 날짜 중심 주간 agenda, fluid desktop 폭, profile 하단 아이콘 등과 충돌하면 07을 따른다. 사용자가 문서를 검토하기 전 Figma/구현 변경은 하지 않는다.

**목표:** 월간 할 일 홈, 기간 생성, 별도 주간 시간표, 개인 설정을 작은 macOS 데스크톱 화면으로 검수한다. 먼저 브라우저에서 로컬 미리보기를 제공하고 Firebase 동기화·앱 패키징은 후속 단계로 둔다. iOS 레이아웃은 이번 검수에서 다루지 않는다.

**구조:** Next.js 16 정적 앱 화면은 URL 상태와 임시 UI 상태만 소유한다. 로그인, canonical 데이터, IndexedDB 캐시·대기 변경·충돌은 인증/repository 경계를 통해 공유한다. 시간 계산과 기간 목록 선택은 화면 컴포넌트 밖의 순수 selector로 둔다.

**기술:** Next.js 16 App Router, React, TypeScript와 로컬 preview. Firebase/Auth/Firestore와 정적 PWA 셸은 기존 구현 경계이며 이 UI 범위에서 동기화 연결을 요구하지 않는다. 사용자 상호작용이 있는 클라이언트 파일은 첫 줄에 use client를 선언한다.

**기준 문서:** [제품 요구사항](../02-product-spec.md), [UX·프론트엔드 사양](../03-ux-frontend.md), [검증·개발 순서](../06-validation-delivery.md), [프로젝트 지침](../../AGENTS.md).

## 전역 제약

- 화면 데이터 경로는 src/lib/repository.ts로 단일화한다. React 컴포넌트에서 Firebase/Firestore/IndexedDB SDK를 직접 호출하지 않는다.
- UID가 바뀌면 이전 UID의 React snapshot을 먼저 지우고 새 UID 데이터만 표시한다. UID별 미전송 journal은 보존하되 다른 계정으로 표시하거나 보내지 않는다.
- 저장 유형은 task, deadline, window, event 네 종류로 유지한다. 시작/마감/종료 날짜와 시각의 의미는 02/04의 계약을 그대로 따른다.
- 홈에는 날짜가 지정된 task만 날짜 칸에 표시한다. 기간형 deadline/window는 다음 시간 경계에 따라 고른 최대 세 개를 고정 표시한다. 초 단위 갱신만으로 카드 순서를 바꾸지 않는다.
- 최신 홈 디자인에는 앱 이름이나 검색 입력이 없다. 하단 중앙 home/weekly-calendar/settings 아이콘 세 개를 둔다. 계정 화면은 Firebase 동기화 후순위이며 별도 `/account` route는 추가하지 않는다.
- 기간 바는 시간 경과를 나타내고 checklist 완료는 별도 상태다. V1의 startCountdown은 화면 표시 설정이며 별도 알림 규칙을 만들지 않는다.
- 화면 배경은 #FFFFFF, 포인트 라벤더는 #6E4DF5, 미완료 track은 #E8E8F2를 기준으로 한다. 텍스트 색은 primary #211F30, secondary #596178, muted #A1A6B8, outline #8F96AD이며 한국어 서체는 Noto Sans KR이다.
- 시간 경과가 없는 종료 미정 window의 시작 전 레일은 중립 track과 시작점 표시로만 표현한다. 이를 진행률로 해석하지 않는다. 시작 후에는 종료가 없는 기간 레일을 숨기고 “종료 시각 미정” 의미를 유지한다. 알려진 종료가 있는 경우에만 실제 시간 진행 바를 쓴다.
- 기간 checklist는 한 항목당 최대4개다. 사용자가 단일 문서 저장과 안전한 상한 축소를 선택했다. editor/domain validator/Rules가 같은 제한을 적용하고, 다섯 번째 입력은 추가하지 않으며 입력 draft를 보존해 한도를 안내한다.
- 제목은 200자, 메모는 10,000자 한도를 유지하고 입력 단계에서 남은 길이/오류를 알린다. 길이를 조용히 잘라 저장하지 않는다.
- 오프라인 저장 성공, 동기화 대기, 서버 반영 완료, 충돌, 실패를 서로 다른 상태로 표현한다. 충돌 chooser는 서버/로컬 양 판본을 보존하며 명시적인 선택 전에는 홈에서 임의의 판본으로 계산하지 않는다.
- PWA 서비스 워커는 정적 앱 셸만 캐시한다. Auth redirect, 인증 데이터, 사용자 일정은 정적 셸 캐시에 넣지 않는다.
- 새 프로덕션 패키지 후보는 이 문서의 [ASSUMPTION] 목록에 먼저 적는다. 구현 PR에서 필요성과 기존 대안/라이선스를 확인한다.
- 완료 시 pnpm test, pnpm typecheck, pnpm lint, pnpm build를 실행한다. 이 설계 문서 작성에서는 앱 코드나 패키지를 만들거나 설치하지 않았다.

## 확정 시각 기준

이하 Figma의 1440×1024 및 iOS 측정은 이전 시안/이력 자료다. 최신 데스크톱 기준은 [07 데스크톱 컴포넌트 시스템 설계](07-component-system-design.md)의 1000×780 창과 고정 폭이다.

기존 Figma archive는 [데스크톱 홈 7:4](https://www.figma.com/design/o81oyODBLYZuzBAkKcWqgp?node-id=7-4)와 [iOS 홈 7:247](https://www.figma.com/design/o81oyODBLYZuzBAkKcWqgp?node-id=7-247)다. 아래 수치는 이전 시안의 이력 자료이며 현재 desktop 구현 기준이 아니다. 화면 안의 예시 문구·요일·시각은 제품 데이터나 테스트 fixture로 복사하지 않는다. 현재 컴포넌트 크기와 배치는 07 문서 및 사용자가 편집한 Figma의 최신 상태를 적용한다.

| 대상 | 기준 |
|---|---|
| 이전 데스크톱 archive | 1440×1024, 좌우 여백 64px, 상단 시작 96px. 구현 기준에서 제외 |
| 데스크톱 기간 영역 | 약 1314×175px; 제목 영역 260px, track 약 820px, 상태 영역 약 186px; 열 사이 간격 24px |
| 데스크톱 작업 공간 | 월간 영역 828px + 간격 64px + 선택 날짜 목록 420px |
| 데스크톱 보조 메뉴 | 32×32px, 화면 위 64px·오른쪽 62px 위치. 시각 요소의 의미를 추가로 추측하지 말고 최종 Figma의 동작과 맞춘다. |
| 데스크톱 하단 내비게이션 | 260×52px, 아래 24px, 아이콘 24px. 보이는 레이블 없이 접근성 이름을 제공한다. |
| iOS 프레임 | 390×844, 좌우 여백 18px, 상단 시작 30px |
| iOS 기간 영역 | 354×184px |
| iOS 월간 영역 | y=226px, 높이 296px |
| iOS 선택 날짜 할 일 | y=534px, 높이 약 156px |
| iOS 하단 내비게이션 | y=784px, 높이 46px. 보이는 아이콘은 24px, 실제 조작 영역은 최소 44×44 CSS px로 넓힌다. |

화면은 흰 캔버스, 무테두리 날짜 배치, 라벤더 선택·진행 포인트, 여백과 타이포 위계로 구분한다. 데스크톱은 월간 달력과 선택일 목록을 좌우로 놓고, iOS는 기간 요약 → 월간 날짜 → 선택 날짜 목록 순서로 세로 배치한다. 숫자 측정값은 Figma 비교 기준이며 중간 폭 720–1024px에서는 두 열을 무리하게 유지하지 말고 접어 페이지 가로 overflow를 막는다. 1024px와 768px 부근, 좁은 모바일 폭에서 실제 wrap과 scroll을 검증한다.

## 라우트와 컴포넌트 파일 맵

당시에는 이 경로를 scaffold 후보로 제안했다. 이미 구현된 파일과 겹칠 경우 기존 동작/data contracts를 먼저 읽고 07에 명시된 component 경계에 맞게 변경한다.

| 파일 | 책임 |
|---|---|
| src/app/layout.tsx | 정적 metadata, viewport, Noto Sans KR 연결, 공통 client provider 경계 |
| src/app/globals.css, src/styles/tokens.css | 전역 reset과 화면 전역 CSS custom-property tokens |
| src/app/page.tsx | 홈 화면 진입 및 URL 월/선택일 상태 전달 |
| src/app/calendar/page.tsx | 주간 시간표와 전체 기간 목록 query view (세부 화면은 07) |
| src/app/tasks/page.tsx | 모든 task와 날짜 미정 task |
| src/app/settings/page.tsx | 로컬 캘린더/알림/데이터 설정. Firebase 계정·동기화 UI는 후속 |
| src/app/providers.tsx | 인증/session 경계와 repository snapshot provider. 이 파일 및 그 하위 상호작용 파일은 use client |
| src/auth/client.ts, src/auth/session.ts | browser Google Auth 구성, redirect 복귀와 UID generation/session lifecycle |
| src/features/shell/AppShell.tsx | 흰 앱 캔버스, route outlet, UID별 화면 수명주기 |
| src/features/shell/BottomNavigation.tsx | 하단 중앙 home/weekly calendar/settings 아이콘 |
| src/features/shell/SyncStatus.tsx | 기기 저장·대기·동기화·충돌·오류 상태와 해당 항목 요약 |
| src/features/shell/useForegroundClock.ts, src/features/shell/UpdatePrompt.tsx | foreground 시각 재계산, 안전한 PWA 업데이트 상태와 명시적 적용 |
| src/features/home/MonthTaskGrid.tsx | 홈 월간 task 점, 무테두리 날짜, 키보드 날짜 탐색 |
| src/features/home/PeriodProgressSummary.tsx | 고정된 최대 3개 기간, 3열 팝오버, countdown/track/checklist 표현 |
| src/features/home/SelectedDayTasks.tsx | 선택일 task 목록, 실제 task 완료, 유일한 홈 + 진입점 |
| src/features/calendar/WeekCalendarView.tsx | /calendar 주간 날짜 열, 시간 눈금, 종일 레인과 일정 block |
| src/features/calendar/WeekTimeGrid.tsx, WeekAllDayLane.tsx | 시간 event, deadline marker와 종일/기간/일일 task 표현 |
| src/features/calendar/PeriodList.tsx | 예정·진행·기한 경과·완료 기간 filter projection과 그룹별 목록 |
| src/features/tasks/AllTasks.tsx | 전체 task와 날짜 미정 task |
| src/features/items/ItemEditor.tsx, DailyTaskEditor.tsx | type-specific 생성/수정 폼과 필드 오류 |
| src/features/items/ItemDetailDialog.tsx | 항목 상세, D-Day/시간대/완료/삭제, 편집 진입 |
| src/features/items/ChecklistEditor.tsx | 기간 checklist 추가·체크·수정·삭제와 파생 완료 |
| src/features/sync/ConflictDialog.tsx | 원격·로컬 판본 비교와 서버 유지/내 수정 적용/직접 편집 |
| src/features/import/ImportPreview.tsx | ICS 파일 미리보기, 중복·원본 차이·행별 오류·선택 저장 |
| src/features/import/contracts.ts, ics.worker.ts, parser.ts, identity.ts | ICS preview/import 계약, 브라우저 parse worker, subset 검사와 원본 occurrence identity |
| src/features/account/AccountSettings.tsx | UID 상태, 로그아웃/계정 전환, JSON export, 미동기화 변경 확인, PWA 안내 |
| public/design/*.svg, public/icons/*, public/fonts/* | 승인된 Figma 정적 아이콘, 설치 아이콘, 라이선스가 확인된 Noto Sans KR 자산 |
| src/lib/errors.ts, src/lib/firebase/config.ts | repository 오류 표면과 공개 Firebase config/emulator mode 검증 |
| src/domain/items.ts | CalendarItem/ProposedCalendarItem, timing, completion, checklist 타입의 authoritative contract |
| src/domain/validation.ts | unknown 입력 검증, 교차 필드·크기·용량 제한 |
| src/domain/time.ts | DateOnly/InstantIso/DST, D-Day, countdown, 기간 bounds/progress |
| src/domain/projections.ts | 홈 임박 기간 선택·정렬, 일별 task, 달력 agenda selector |
| src/lib/repository.ts | `createRepository(session, ports)`, `saveDraft()` 등 UI 공개 영속성 경계; repository 함수와 반환 타입은 04-core-implementation.md를 따른다. |
| src/lib/storage/contracts.ts | journal·remote adapter 내부 타입. feature/UI에서 import하지 않는다. |
| src/lib/storage/journal.ts | native IndexedDB journal 트랜잭션·복구·ACK |
| src/lib/storage/firestore.ts | persistentLocalCache 초기화, read listener, receipt-first online transaction |
| src/lib/storage/sync.ts | queued/sending/successor·retry·충돌 송신 조정 |
| src/styles/tokens.css, src/app/globals.css | 공유 CSS tokens와 전역 reset |
| src/pwa/client.ts, src/pwa/service-worker.ts, public/manifest.webmanifest, public/sw.js | PWA client lifecycle, worker source/build output, 정적 설치 metadata. UID 데이터 캐시는 포함하지 않는다. |
| scripts/generate-sw.ts, tsconfig.sw.json | `out/` 해시 자산 precache 목록 생성과 worker 전용 typecheck 설정 |

컴포넌트 파일은 렌더링과 사용자 의도 전달에 집중한다. 모든 공유 시간·projection selector는 src/domain 아래에서 같은 snapshot을 순수하게 변환한다. React state에 계산된 정렬 결과를 별도로 복사하지 않는다. repository 아래 adapter는 내부 저장 경계이며 화면에서 직접 import하지 않는다. 공개 함수의 정확한 입력·반환 타입은 04-core의 계약을 사용한다. 화면에서 직접 쓰는 순수 함수 후보는 `parseLocalDateTime`, `getTimingBounds`, `formatDDay`, `getElapsedRatio`, `getStartCountdown`, `selectHomePeriods`, `selectDailyTasks`, `selectCalendarAgenda`, `deriveChecklistStatus`다.

## UI 경계와 TypeScript 인터페이스 초안

> 아래 props와 화면 모듈은 기존 month/week 날짜 중심 캘린더의 이력이다. 새 데스크톱 component props와 화면 계약은 07을 따른다. 데이터/repository type 설명은 계속 유효하다.

아래는 컴포넌트가 소비할 화면 계약이다. persisted entity 세부 필드와 repository public method/return type은 04-core-implementation.md 및 doc/04-firebase-data-sync.md에 정의된 authoritative 타입을 그대로 소비한다. 화면 컴포넌트는 Firestore 문서 형식이나 storage adapter 내부 타입을 직접 소비하지 않는다.

| 계약 | 제안 형태 |
|---|---|
| ItemKind | task \| deadline \| window \| event |
| DateOnly | YYYY-MM-DD 달력 날짜 문자열. UTC 자정 instant로 변환하지 않는다. |
| CalendarItem['timing'] | unscheduled/date/time의 저장 타입을 그대로 소비한다. 별도 TimePoint 타입을 만들지 않는다. |
| ItemView | display 제안 + canonical/localDraft/syncState/snapshotSource/localSequence. 실제 필드는 공개 repository 타입을 그대로 소비한다. |
| ChecklistStatus | total, remaining. 화면 라벨은 0개 숨김, 1개 미완료/완료, 2개 이상은 미완료(남은 수/전체 수), 모두 완료는 완료 |
| StartCountdownDisplay | enabled, daysBefore: 0..30. 기본값은 enabled=true, daysBefore=1. 정확한 시작 instant 기준 노출 시점은 N×24시간 전이다. daysBefore=0은 시작 전 노출 없이 시작 시점의 상태로 전환한다. 화면에서 남은 시간을 표시하며 OS/인앱 알림을 예약하지 않는다. |
| SyncState | 기존 connection/localJournal/firestoreCache/pendingCount/conflictCount와 핵심 구현 설계의 localWriteInFlight/error. loading/cached/pending/동기화 완료는 이 계약을 화면 문구로 투영한 것이며 별도 저장 enum이 아니다. |
| DraftInput | itemId/baseRevision/baseSnapshot/proposedSnapshot/mutationKind/expectedLocalSequence. proposedSnapshot은 4종 판별 union이다. |
| 충돌 화면 입력 | ItemView의 canonical/localDraft/conflictRemote를 소비한다. 별도 ConflictView 저장 타입을 만들지 않고 두 판본을 선택 전까지 보존한다. |

컴포넌트 props는 아래 경계로 고정한다.

| 컴포넌트 | props / 출력 이벤트 |
|---|---|
| MonthTaskGrid | month: string(YYYY-MM), selectedDate: string(YYYY-MM-DD), tasksByDate: ReadonlyMap<string, readonly ItemView[]>, onMonthChange(month), onSelectDate(date) |
| PeriodProgressSummary | selection: HomePeriodSelection, nowMs: number, onOpenItem(id), onOpenAllOverflow(). selectHomePeriods 결과를 받아 독립 재정렬하지 않음 |
| SelectedDayTasks | date, tasks, syncById, onToggleComplete(id), onOpenItem(id), onAddTask(date) |
| CalendarMonthView | month, view: month \| week, selectedDate, itemsByDate, onMonthChange, onViewChange, onSelectDate |
| SelectedDayAgenda | selectedDate, chronologicalItems, onOpenItem, onAddEvent(selectedDate) |
| PeriodList | groups: PeriodGroups from the period projection, selectedFilter, onFilterChange(filter), onOpenItem(id) |
| AllTasks | tasks: readonly ItemView[], onToggleComplete(id), onOpenItem(id), onAddTask() |
| ItemEditor | initial: ItemView 또는 null, selectedDate: string, onClose(). display 편집과 canonical/localDraft/localSequence의 base·CAS 보존; repository/saveDraft·FormGuardRegistry를 공개 provider로 사용 |
| ChecklistEditor | value: readonly PeriodChecklistItem[], onChange(next: PeriodChecklistItem[]). parent editor가 전체 제안 snapshot 저장 |
| SyncStatus | state: SyncState, lastConfirmedServerAt?, onRetry(), onOpenConflict(itemId) |
| ConflictDialog | itemId: string, onClose(). repository에서 해당 ItemView/판본을 읽고 공개 resolveConflict 호출 |
| ImportPreview | file: File 또는 null, onClose(). 파일/범위·시간대 확인, repository 공개 preview/repair/commit/read 결과 API 연결 |
| AccountSettings | authState, syncState, pendingCount, pwaInstallState, onSignIn(), onSignOut(), onExport(), onClearDeviceData() |
| UpdatePrompt | state: PwaState, canApply: boolean, onApplyUpdate(), onDismiss() |

ItemEditor의 입력 의미:

- task: 제목 필수, 날짜/마감 선택, 명시적 완료. 날짜 미정은 /tasks에서 찾을 수 있다.
- deadline: 마감 날짜 또는 정확한 시각 필수, 기간 시작 선택, checklist 및 제출 완료 별도.
- window: 날짜 기간은 시작/종료 모두 필수. 정확한 시각 시작의 종료 미정은 허용하고 UI에 종료 시각 미정으로 표시한다.
- event: 시작/종료 필수, 완료 상태 없음. 날짜형 종료일 포함, 시간형 종료 instant는 배타적.
- 기간 detail에서 startCountdown enabled와 0–30일 daysBefore 범위를 저장한다. 정확한 instant 시작은 N×24시간 전에 표시한다. date-only 시작은 해당 시간대의 달력 D-N/D-Day만 사용한다. HH:MM/MM:SS는 표시 단위 올림 초를 사용해 실제 시작 전에 00:00이 되지 않도록 한다. V1에는 별도 알림 설정 흐름이 없다.
- 제목 최대 200자, 메모 최대 10,000자를 입력 단계와 repository validation에서 유지한다. checklist는 최대4개로 validator와 Rules가 제한하고 초과 시 저장 한도를 안내하며 text draft를 보존한다.
- 생성/수정 오류는 field-level로 표시한다. 기간 끝이 시작보다 빠름, 0 길이 시간형 event, 잘못된 kind별 필드 조합은 저장 전에 거부한다.

## React 상태 소유권

| 상태 | 단일 소유자 | URL/보존 규칙 |
|---|---|---|
| 인증 UID와 sign-in/out 진행 | auth adapter를 감싼 providers | UID 전환 때 이전 provider tree/snapshot 폐기. 첫 로그인은 온라인이 필요하다는 안내 |
| canonical, 로컬 캐시, journal, 충돌 판본 | repository subscription | UID 단위 분리. 화면은 repository projection을 구독하고 mutation command만 반환 |
| 월, 선택 날짜, 캘린더 month/week, period filter, 상세 item id | 라우트 query adapter | URL에 반영. UID·제목·메모·시각 원문은 query에 넣지 않음. 브라우저 back/forward로 상태 복원 |
| 열려 있는 메뉴, editor draft, modal, ICS preview selection | 해당 page feature의 React state | 페이지/대화상자 수명만. 저장 성공 전 editor draft를 지우지 않음 |
| 현재 시각 | shared clock hook/service | 화면 visibility 복귀 시 현재 시각으로 재계산. 초 카운트다운은 홈 summary 순서를 재정렬하지 않음 |
| derived calendar days, period order/progress/checklist label | 순수 selector | canonical snapshot + route state + now를 입력으로 매번 파생. 서버 저장하지 않음 |
| PWA 설치/update prompt | PWA adapter | 설치 사실이 server sync나 closed-app notification 보장을 뜻한다고 말하지 않음 |

## 사용자 흐름

1. **인증과 앱 진입:** 온라인에서 Google 로그인 → UID별 repository snapshot 초기화 → 로딩 중 월간 그리드와 선택일 목록 skeleton, 홈 기간 영역 → 서버 snapshot/receipt가 확인되면 동기화됨, 기기 cache만 있으면 마지막 확인 기기 캐시로 표시한다. 캐시 없는 첫 로그인은 오프라인 쓰기를 허용하는 것처럼 안내하지 않는다.
2. **홈 월간 수행:** 선택 날짜 옆 유일한 + → task 또는 기간형 선택 → task는 선택 날짜를 초기값으로, deadline/window는 종류별 시간 입력 → IndexedDB 저장 성공 뒤에만 기기에 저장됨/동기화 대기 표시 → server ack 뒤 동기화됨 표시.
3. **기간 카드/초과 보기:** 다음 관련 시각 경계가 가까운 미완료 기간 최대 3개를 고정한다. 초과 버튼을 누르면 기존 세 개를 포함한 전체 목록이 3열 팝오버로 겹쳐 보이며 캘린더를 밀지 않는다. 초 단위 카운트다운은 현재 카드 안에서만 바뀐다.
4. **날짜 탐색:** 그리드 좌/우는 하루, 위/아래는 한 주, Home/End는 해당 주 양 끝, Enter/Space는 선택이다. 월 이동 후 날짜와 focus를 보존한다. 선택일 목록에는 task만 둔다. 날짜 미정 task 진입은 날짜 미정 링크 및 추가 메뉴에서 /tasks로 이동한다.
5. **캘린더 탐색:** 하단 calendar icon → 주간 시간표 → 날짜 헤더와 시간 눈금에서 고정 일정 확인/추가. 종일 할 일·기간은 위 종일 레인, 시간이 정해진 고정 event는 시간 블록으로 보인다. 사용자 동작과 Figma 계약은 07의 C-14~C-18을 따른다. ICS 파일 미리보기와 저장은 캘린더에서 진입한다.
6. **항목 편집/삭제:** 상세 열기→편집→kind별 필수값 검증→local journal 저장→sync 상태. 삭제 전 항목명과 결과를 확인한다. tombstone이 된 ID는 재사용하지 않는다.
7. **기간 checklist:** 상세에서 하위 항목을 추가/체크/수정/삭제한다. 기간 완료/신청 완료, 시간 progress와 checklist 완료는 각기 독립 상태다. 모두 완료 후 새 checklist를 추가하면 파생 상태를 미완료로 바꾼다.
8. **충돌 해결:** 해당 row에 해결 필요 표시→ConflictDialog에서 원격/내 판본 비교→서버 유지, 내 수정 재적용, 직접 편집 선택. 확인 전에 자동 병합/덮어쓰기하지 않는다. 원격 변경이 다시 생기면 새 충돌을 보여준다. 원격 삭제 항목을 다시 쓸 때는 사용자가 선택 후 새 ID로 복구한다.
9. **계정·설정:** profile icon은 /settings로 간다. Google 계정, sync 상태/재시도, JSON export, 캐시 정리 전 미전송 변경 확인, ICS 가져오기 도움/캘린더 이동 링크, PWA 설치/업데이트를 안내한다. V1은 카운트다운만 화면에 표시하고 알림은 예약하지 않는다. JSON은 현재 UID canonical과 pendingLocalChanges를 별도 배열로 보존한다.
10. **PWA 업데이트/복귀:** 업데이트 적용 전 journal 저장 완료와 입력 draft 상태를 확인한다. 저장 중이면 update를 늦춘다. 탭이 다시 보이면 countdown을 현재 시각으로 재계산하고 지난 초 tick을 재생하지 않는다.

## 구현 태스크와 검증 초안

각 태스크는 다른 업무와 독립 리뷰가 가능한 결과를 남긴다. 아래 test ID는 [검증·개발 순서](../06-validation-delivery.md)의 원래 ID를 사용한다. 프론트엔드 테스트는 화면 계약을 확인하고, Security Rules/repository 통합 조건은 저장 경계 구현과 함께 검증한다.

아래 화면 모듈 번호는 UI 책임을 나누는 분류다. 실제 구현 순서·담당 모델·파일·테스트 command는 [실행 계획의 Task1~9](06-execution-plan.md)가 단일 기준이며 별개의 실행 계획을 다시 승인받지 않는다.

### 화면 모듈 1: 앱 셸, route/query, 인증 경계

**파일:** src/app/layout.tsx, src/app/providers.tsx, src/app/page.tsx, src/app/calendar/page.tsx, src/app/tasks/page.tsx, src/app/settings/page.tsx, src/features/shell/*.

**생산 인터페이스:** 인증 상태, route query adapter, 세 아이콘 하단 navigation. profile icon target은 /settings.

- [ ] Google 로그인/로그아웃 중 상태, 첫 로그인 오프라인 안내와 UID 변경 snapshot 초기화를 provider에 연결한다.
- [ ] /, /calendar, /tasks, /settings route를 구현하고 월·선택 날짜·view·filter·item ID query 복원을 구현한다.
- [ ] home/weekly calendar/settings 하단 아이콘을 중앙 배치하고 보이는 label 없이 name, selected state, focus ring, 44×44px hitbox를 제공한다. component 위치/아이콘 계약은 07을 따른다.
- [ ] UI-01~03, AUTH-01, AUTH-03을 검사한다. 다른 UID로 바꾸면 이전 snapshot이 그려지지 않고 미전송 A 데이터를 B로 보내지 않는다.

### 화면 모듈 2: 날짜/시간·projection selector와 기간 요약 순수 로직

**파일:** src/domain/time.ts, src/domain/projections.ts.

**생산 인터페이스:** DateOnly/InstantIso 변환, D-Day/countdown/progress, 월간 date/task map, 정렬 경계와 홈 최대 3개 selector. 도메인 타입과 함수 서명은 04-core의 계약을 사용한다.

- [ ] 날짜형과 시각형을 분리해 D-Day, 기간 바, window 시작 레일의 표시 모델을 만든다.
- [ ] 진행 중 deadline은 마감, 진행 중 window는 알려진 종료, 미래 시작 항목은 시작을 정렬 경계로 쓴다. 경과 항목은 최근 순이며 알려진 미래 경계 뒤에 놓는다.
- [ ] 의미 있는 상태 전환/편집 때만 홈 순서를 재선택하고 단순 초 단위 tick은 기존 visible ID를 고정한다.
- [ ] TIME-01~15, UI-08을 단위 테스트한다. 정확한 시각 시작의 노출 경계는 N×24시간, 24시간 이상은 남은 실제 시간 올림 D-N, 24시간 미만은 표시 단위 올림 HH:MM/MM:SS로 계산한다. date-only 시작은 달력 D-N/D-Day만 표시한다. daysBefore=0은 사전 노출 없음이다.
- [ ] 종료 미정 window는 start 전 neutral rail + start dot, start 후 rail 없음, known end만 actual progressbar다.

### 화면 모듈 3: 홈 월간 그리드·선택일 목록·기간 요약

**파일:** src/features/home/MonthTaskGrid.tsx, PeriodProgressSummary.tsx, SelectedDayTasks.tsx.

**생산 인터페이스:** 화면 모듈 2 selectors와 UI props 계약을 사용한다.

- [ ] 무테두리 7열 일요일 시작 월간 grid에 task dot과 선택일을 표시한다. 월마다 4–6주 행을 수용한다.
- [ ] 월간 날짜 칸과 선택일 목록에는 task만 넣고, event/deadline/window는 넣지 않는다. task 완료 checkbox는 선택일 목록에만 둔다.
- [ ] 기간 행은 title+countdown, 양 끝 endpoint와 known-end progress, 별도 checklist 상태로 그린다. 진행률 퍼센트/남은 일수 텍스트와 기간 checklist checkbox는 반복 표시하지 않는다.
- [ ] 최대 3개 기간 카드를 고정하고 팝오버에는 전체 미완료 기간을 3열로 표시한다. 초과가 없으면 열기 버튼을 숨긴다.
- [ ] UI-01, UI-02, UI-03, UI-04, UI-06, UI-08, TIME-06~14를 컴포넌트 테스트로 검사한다.

### 화면 모듈 4: 캘린더·항목 상세와 CRUD 편집

**파일:** src/features/calendar/CalendarMonthView.tsx, SelectedDayAgenda.tsx, src/features/items/ItemEditor.tsx, ItemDetailDialog.tsx.

**생산 인터페이스:** ItemView, DraftInput, repository mutation adapter.

- [ ] /calendar에 주간 날짜 열과 시간 눈금을 표시한다. 고정 event는 시간 블록, 기간/종일/날짜 task는 위쪽 레인, 정확한 마감 task는 시간 마감 표식으로 표시한다. 각 클릭 동작은 07을 따른다.
- [ ] event/task/deadline/window editor variant를 구현한다. event 종료/시작, deadline due, window start 및 미정 종료 허용 조건을 kind별 검증한다.
- [ ] 선택 날짜 task의 기본 날짜, /tasks의 날짜 미정 목록, item query 상세, 필드 단위 validation, 삭제 확인을 연결한다.
- [ ] DATA-01~05, TIME-03~08, UI-02, UI-07를 검증한다.

### 화면 모듈 5: checklist, countdown preference와 계정 설정

**파일:** src/features/items/ChecklistEditor.tsx, src/features/account/AccountSettings.tsx, src/app/settings/page.tsx.

**생산 인터페이스:** ChecklistEditor mutation props, StartCountdownDisplay 설정, JSON export/cache clear.

- [ ] 기간 checklist CRUD와 완료 파생 요약을 구현한다. 한 기간 최대4개를 저장하고, 다섯 번째 입력은 draft를 보존한 채 제한을 안내한다. startCountdown 설정은 checklist/제출 완료와 독립적으로 편집한다.
- [ ] 제목 200자·메모 10,000자 한도를 입력/UI/repository 경계에서 일치시킨다.
- [ ] /settings에 Google 계정, 동기화 상태, JSON export, 캐시 정리 전 대기 변경 처리, PWA 설치/업데이트, ICS 진입 설명, V1은 알림을 예약하지 않는다는 설명을 연결한다.
- [ ] DATA-04~07, DATA-05, TIME-10~13, TIME-15, SYNC-11을 검증한다.

### 화면 모듈 6: 오프라인·동기화 상태·충돌 chooser

**파일:** src/features/shell/SyncStatus.tsx, src/features/sync/ConflictDialog.tsx, src/lib/repository.ts 공개 경계와 src/lib/storage/* 내부 adapter.

**생산 인터페이스:** 04-core의 `createRepository(session, ports)`/`saveDraft()` public contract, SyncState, 충돌 상태의 ItemView, uid-scoped snapshot과 local journal acknowledgement. UI는 공개 경계만 사용하고 `RemoteStore`, journal, Firestore adapter를 직접 부르지 않는다.

- [ ] local DB 성공 이후에만 기기에 저장됨을 표시하고 pending/syncing/server-confirmed synced/cached-only/conflict/failed label을 구분한다. cache만 있을 때 서버 최신 값을 주장하지 않는다.
- [ ] 온라인 복귀, 재실행, retry, 응답 유실과 receipt, 송신 중 새 초안에서 snapshot/ack를 정확히 합친다.
- [ ] conflict chooser는 서버 유지/내 수정 다시 적용/양 판본 직접 편집을 제공한다. checklist 충돌도 parent snapshot 전체를 판본으로 표시한다.
- [ ] AUTH-01~03, SYNC-01~13, UI-05, DATA-05를 저장 adapter 통합 및 UI 흐름 테스트로 검증한다.

### 화면 모듈 7: ICS preview, countdown 갱신과 PWA 수명주기

**파일:** src/features/import/ImportPreview.tsx(미구현), `src/features/shell/useForegroundClock.ts`, `src/pwa/client.ts`, `src/pwa/service-worker.ts`, `scripts/generate-sw.ts`.

**생산 인터페이스:** ICS preview rows/occurrence keys, repository의 draft API와 멱등 import identity, static shell update gate.

- [ ] ICS 파일을 서버 업로드 없이 브라우저에서 읽고 미리보기→중복/원본 변경 판별→행 선택→부분 성공 결과를 제공한다.
- [ ] UID/occurrence key와 지원 RRULE subset 계약을 따른다. 지원하지 않는 구성은 행별 오류로 설명하고 추측 변환하지 않는다.
- [x] 홈·캘린더 카운트다운 clock은 foreground 1초 갱신과 focus/pageshow/visibility 복귀 재평가를 사용하고 초 단위 live announcement를 두지 않는다. V1에는 foreground notice나 OS 알림을 제공하지 않는다. Chromium E2E에서 `00:10 → 09:59 → 00:01 → 숨김` UI 복귀 전환을 확인했다. 실제 iOS 백그라운드 복귀는 실기기 검증에 남아 있다.
- [x] 정적 앱 셸만 캐시하고 update가 pending journal 저장/진행 중 draft를 덮지 않도록 한다. 실 Chrome에서 cache 대상과 offline calendar route를 확인했다.
- [x] dirty form draft, local write, journal availability를 확인한 뒤 사용자가 업데이트를 선택한 경우에만 `skipWaiting()`을 부른다. install/activate/controllerchange에 따른 자동 reload는 하지 않는다. guard는 단위 테스트로 검증했다.
- [ ] ICS-01~09, TIME-10~15, SYNC-03, SYNC-10, UI-03을 검증한다.

### 화면 모듈 8: 데스크톱·iOS 시각 검증과 release gates

**파일:** visual test/e2e 파일 경로는 첫 구현 scaffold 및 test runner를 확인한 뒤 확정.

- [ ] desktop 1440×1024, intermediate 1024px 및 768px 근처, iOS 390×844에서 screenshot을 남겨 Figma 토큰·간격·배치와 확인한다.
- [ ] 실제 iPhone Safari/PWA에서 터치 영역, 방향 전환, 확대, offline relaunch, Google 로그인 후 복귀와 계정 전환을 확인한다.
- [ ] 키보드만으로 날짜 grid와 모든 modal 흐름을 끝내고 focus return/roving focus를 확인한다. VoiceOver와 색각/명도 검사도 기록한다.
- [ ] 최소 test suite, typecheck, lint, static build를 모두 성공시킨다. 결과와 미지원 항목을 기록한다.

## FR-01~FR-16 추적과 테스트 범위

| FR | 프론트엔드 작업 | 검증 ID 및 핵심 커버리지 |
|---|---|---|
| FR-01 인증/계정 격리 | 화면 모듈 1, 6 | AUTH-01~03, SYNC-01, SYNC-03: Google UID, 접근 격리, 계정 전환 중 pending 보존 |
| FR-02 홈/별도 캘린더 | 화면 모듈 1~4 | UI-01~03, UI-06~08: 홈에 task만, 기간 최대 3+전체 팝오버, 별도 event/기간 탐색 |
| FR-03 네 종류 CRUD | 화면 모듈 4 | DATA-01~03: 4종 필드 유지, 필드 오류, 날짜 미정 task, 종료 미정 window |
| FR-04 완료 의미 분리 | 화면 모듈 4, 5 | DATA-04, DATA-06: task/제출/신청 명시 완료, event 체크 없음, 기간 checklist 파생 |
| FR-05 D-Day/countdown | 화면 모듈 2, 3, 5 | TIME-01~05, TIME-10~13, TIME-15: date-only D-N과 timed countdown 분리, N×24시간 노출, ceil 단위 표시, 10분 경계 |
| FR-06 기간 진행 | 화면 모듈 2, 3 | TIME-06~08, TIME-13, UI-04: 0..100 clamp, 종료 미정 레일의 비율 오인 방지, aria 설명 |
| FR-07 임박 기간 | 화면 모듈 2, 3 | TIME-09, TIME-14, UI-08: 시각 경계 전환/순서 고정/초과 수/완료 제외 |
| FR-08 사전 알림 | 로컬 설정·scheduler | 설정에서 선택 가능·기본 꺼짐; 항목별 시점과 권한, 브라우저 로컬 저장을 확인; 닫힌 앱·Firebase 알림은 후속 |
| FR-09 ICS | 화면 모듈 7 | ICS-01~09: 종일/TZID/RRULE subset/EXDATE/중복/부분 실패/제한 |
| FR-10 오프라인 변경 | 화면 모듈 6, 7 | SYNC-02~04, SYNC-10: local save, reload 복원, DB 실패와 cache freshness |
| FR-11 충돌 보존/선택 | 화면 모듈 6 | SYNC-05~09, SYNC-11~13: base revision, 삭제/새 ID 복구, checklist whole-snapshot conflict |
| FR-12 저장/동기화 상태 | 화면 모듈 1, 6 | SYNC-10, UI-05: 캐시만 존재/서버 snapshot·receipt 확인을 분리하고 대기·완료·충돌·실패 표현 |
| FR-13 반응형/접근성 | 화면 모듈 1, 3, 4, 8 | UI-01~07: 키보드, 터치, screen reader, 확대, 오류/빈/로딩 화면 |
| FR-14 JSON/이동성 | 화면 모듈 5, 6 | DATA-05, AUTH-03: current UID canonical과 pending 배열 분리, 캐시 삭제 전 경고 |
| FR-15 기간 checklist | 화면 모듈 5, 6 | DATA-06~07, SYNC-11: 0/1/2+개, 완료 후 추가 시 미완료, 결정된 상한 초과 안내, 오프라인 충돌 |
| FR-16 start display | 화면 모듈 2, 5, 7 | TIME-10~13, TIME-15: 기본 1일/N×24시간/0–30, date-only D-N, 올림 경계 |

## 테스트와 visual QA

이하의 1440×1024/iOS 중심 visual 검증은 과거 구현용이다. 현재 데스크톱 시각 수용 조건은 07의 `1000×780` 기준 창, 고정 최대 폭, 여섯 화면별 Figma 비교다. Firebase 동기화·iOS 검수는 후속 범위다.

테스트 층은 필요한 결과만 나눠 검증한다. 순수 date/time/period selector 단위 테스트, React 상호작용 테스트, repository/Auth Emulator 통합 테스트, browser visual/e2e 흐름, 실제 iPhone PWA 확인을 수행한다. 프로젝트에 test runner가 없으면 후보 설치는 테스트용 dev dependency로 별도 검토하며, 이 문서 작업에서는 설치하지 않는다.

1. **순수 selector:** 2026-10-03을 Asia/Seoul 고정 now로 둬 2026-10-03/10-09/10-02가 D-Day/D-6/D+1인지 확인한다. DST 23/25시간, 날짜형 포함 종료일, 시간형 종료 순간, due/start 경계, date-only 시작의 D-N/D-Day, timed start의 N×24h 노출, 24시간 전환, ceil 기반 HH:MM/MM:SS와 시작 시 0 표시 전환, countdown 10:00/9:59, 기간 progress 0/중간/100, start-only window 레일을 테스트한다.
2. **홈 UI:** 0/1/2/3개 이상 기간, 초과 수와 route query, 경과/완료 항목, checkbox 위치, 단일 +, 무테두리 월간, title/countdown와 checklist 양쪽 상태를 검사한다. 초 tick 뒤 visible ID가 변하지 않고 의미 상태 변화 시에만 정렬이 달라지는지 확인한다.
3. **캘린더/입력:** keyboard roving focus, query restore, month/week 전환, 날짜 미정 task, 네 kind의 필드 조합, field-level 오류, modal focus trap/복귀/Escape, 날짜형 all-day 종료 경계, checklist derivation을 확인한다.
4. **동기화/계정:** Auth emulator에서 다른 UID 접근 거부, A→B 로그인 때 데이터 분리, IndexedDB 실패 후 성공 오인 금지, server ack 뒤 새 local draft 보존, 재시도 idempotency와 양 판본 충돌 chooser를 검증한다. 서버 snapshot/receipt 전에는 synced를 표시하지 않고 cache-only 문구를 사용한다.
5. **ICS/PWA:** 정상/오류/중복/원본 변경/반복 파일 fixture에서 저장 결과를 확인한다. background→foreground 뒤 countdown 재계산, 과거 초 tick 미재생, update 중 pending journal 보호, static shell 외 인증 경로 cache 금지를 검사한다. local preview의 알림 기본 꺼짐, 권한 선택, 항목별 시점과 foreground 전달도 확인한다. 닫힌 앱 알림과 Firebase 알림은 후속이다.
6. **Figma screenshot 비교:** 07에 적힌 홈 기본·기간 오버레이·햄버거·기간 입력 두 종류·주간 시간표·설정을 1000×780에서 캡처한다. 동일 fixture/clock으로 Figma와 비교하고 1440×1024 이상에서는 작업 영역이 커지지 않는지 확인한다.
7. **접근성:** 마우스·키보드의 모든 메뉴, 칸, 다이얼로그, 설정을 확인한다. focus ring/name/state, 키보드 재정렬, modal focus 복귀, reduced-motion을 검사한다. iPhone/VoiceOver는 이 단계 뒤 별도 검수한다.

Figma에 보이는 예시 요일/시간에는 fixture로 쓰지 않는 샘플 값이 있다. 날짜·요일 조합은 실제 달력과 맞추고 “현재 시각”은 fake clock으로 고정해 screenshots/test가 실행 날짜마다 변하지 않도록 한다. 종료 미정 window의 중립 레일은 time progressbar로 노출하지 않으며, 알려진 종료가 있는 시간 바만 접근성 range semantics를 갖는다.

완료 전 저장 경계 테스트는 Firestore/Auth Emulator와 필요 repository adapter 환경에서 실행한다. 개발 종료 조건은 pnpm test, pnpm typecheck, pnpm lint, pnpm build 모두 성공이며, 실기기 검증은 자동 browser screenshot 성공으로 대체하지 않는다.

## [ASSUMPTION] 패키지 후보

새 앱 manifest나 코드가 없는 상태에서 아래는 선택 후보이며 확정 dependency가 아니다. 기존 package manifest 확인 후 정말 필요한 항목만 구현 PR에 표시한다.

| 후보 | 필요 조건 | 검토 경계 |
|---|---|---|
| next, react, react-dom | Next.js 16 정적 앱 scaffold | 지원되는 stable patch와 Next/React 호환성을 구현 시점에 확인 |
| firebase | browser Google Auth와 Firestore 연결 | modular SDK; React component가 직접 import하지 않음 |
| @js-temporal/polyfill | native Temporal 없이 Safari/DST 계약을 충족해야 할 때 | native API와 결과·브라우저 지원·라이선스를 비교 |
| ical.js | ICS subset을 브라우저에서 parse/expand해야 할 때 | AST preflight로 02의 subset을 강제하고 미지원 변환을 차단 |
| test/dev tooling | 기존 package/scripts가 없을 때 | Vitest, Testing Library, fake-indexeddb, Rules testing, firebase-tools, Playwright, TypeScript, ESLint 후보는 구현 계획 문서를 따른다 |

native IndexedDB와 CSS Modules를 우선 사용한다. UI, calendar, state management, IndexedDB wrapper용 production package는 후보에 추가하지 않는다. 후보는 설치 허가나 실제 설치 사실을 뜻하지 않는다.

## 구현 전에 풀어야 할 계약 연결

새 화면·구성요소의 기준, Figma 작업 순서, UI 수용 조건은 07에서 상세히 정의한다. 이 문서의 후속 구현 태스크 표는 화면 범위가 승인된 뒤 07 기준으로 다시 맞춘다.

- 저장 entity, revision, receipt, journal, 충돌 payload는 [04 Firebase·데이터·동기화](../04-firebase-data-sync.md)의 계약과 props/model view를 최종 일치시킨다. 위 UI view는 persisted schema를 대체하지 않는다.
- 현재 로컬 미리보기는 [05 알림·네이티브 로드맵](../05-alerts-native-roadmap.md)에 따라 기본 꺼짐의 브라우저 기기 알림을 제공한다. 이 설정은 Firebase revision에 들어가지 않으며 앱이 닫힌 동안의 예약은 하지 않는다.
- 최신 화면에서 하단 내비게이션은 home/weekly calendar/settings 세 아이콘이다. 선택된 아이콘·기어 여부와 hitbox는 07 및 Figma에서 확정한다.
- /tasks는 바닥 내비게이션 항목을 추가하지 않는다. 선택 날짜 목록의 날짜 미정 링크와 추가 메뉴가 /tasks 진입 경로다.
- Settings 화면에 ICS 도움과 캘린더 이동 진입점을 두되 실제 ICS 가져오기와 occurrence 목록은 /calendar에서 실행한다.
- Figma 프레임은 홈 두 개만 전달됐다. 캘린더와 settings의 새 픽셀 배치·실제 프레임을 본 문서에서 만들어내지 않는다. 구현 시에는 동일한 색/타입/터치 규칙을 적용하고 화면 결과를 별도 검토한다.

## 검토 초점

- 시작/종료가 날짜 전용인지 instant인지: D-Day, inclusive date range, 기간 progress와 화면 카운트다운이 다른 계약으로 계산되는지 확인한다.
- 종료 미정 window: 시작 전 시작점 레일이 progress처럼 보이거나 시작 뒤 없는 기간 바를 계속 보여주지 않는지 확인한다.
- countdown tick와 상태 변화: 초 단위 tick으로 홈의 두 고정 기간이 바뀌어 읽던 행이 사라지지 않는지 확인한다.
- 날짜형 시작과 정확한 시각 시작: date-only는 D-N/D-Day만 표시하고 timed countdown에서 N×24시간 노출, 24시간 경계, ceil 렌더링이 지켜지는지 확인한다.
- 오프라인/UID 전환/ACK: 기기 저장 실패를 성공이라고 알리거나 이전 UID pending data를 새 계정에 노출/송신하지 않는지 확인한다.
- 동기화 확인 표현: device cache만 있을 때 동기화됨이라고 표시하지 않고, server snapshot/receipt 확인 뒤에만 synced가 되는지 확인한다.
- 동일 항목 양쪽 편집/삭제: 양 판본 보존, chooser 이전 자동 병합 금지, tombstone ID 재사용 금지가 지켜지는지 확인한다.
- 기간 완료 vs checklist 완료 vs event: 시간을 마쳤다는 이유로 자동 완료되지 않으며 kind에 없는 checkbox를 만들지 않는지 확인한다.
- checklist/title/memo 제한: checklist 4개, 제목 200자 및 메모 10,000자 한도가 조용한 잘림 없이 유지되는지 확인한다.
- PWA 설치/알림 의미: 설치를 서버 sync/closed app push 보장으로 표현하지 않고, 화면 카운트다운을 알림 예약이나 notice로 설명하지 않는지 확인한다.

---

## 현 상태와 미완료 범위

이 문서는 화면/인터페이스/테스트 범위를 구현 단계에서 실행할 수 있도록 정리한 초안이다. 실제 Next 앱, adapter, test runner, 브라우저 캡처, 실기기 동작을 만들거나 검사하지 않았다. 구현 단계에서 UI 시안을 기능 계약보다 우선해 원본 범위를 줄이지 않는다.
