# 학생용 할 일·D-Day PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 다듬은 흰 배경 Figma를 실제 월간 할 일 홈으로 구현하고, macOS/iOS PWA의 개인 일정·기간·오프라인 보존·Firebase 동기화를 연결한다.

**Architecture:** Next.js 16 정적 App Router와 Firebase Spark의 Auth/Firestore/Hosting을 사용한다. UI는 repository에만 영속 작업을 맡기며, 시간·projection은 순수 도메인 함수, offline 변경은 IndexedDB journal, online commit은 receipt 우선 revision transaction으로 분리한다. 정적 PWA 셸과 사용자 데이터 캐시는 독립적으로 관리한다.

**Tech Stack:** Next.js 16.x, React/React DOM 19.x, TypeScript, CSS Modules, Firebase Web SDK, native IndexedDB; `[ASSUMPTION] @js-temporal/polyfill`, `ical.js`; dev 후보 Vitest/Testing Library/fake-indexeddb/Firebase Rules Unit Testing/Firebase CLI/Playwright/ESLint.

**Spec:** [전체 구현 설계](05-implementation-design.md), [핵심 구현 계약](04-core-implementation.md), [제품 사양](../02-product-spec.md), [수용 기준](../06-validation-delivery.md).

## Global Constraints

- 모든 설계 문서는 `/Users/changmin/Desktop/projects/TodoList/doc` 안에 한국어로 저장한다.
- Next.js 16 정적 내보내기와 Firebase Hosting/Auth/Firestore **Spark**를 사용한다. 동적 서버 API, Admin SDK, Functions, 서버 cron, 결제 연결은 V1에 넣지 않는다.
- 한국어, Google 로그인, `Asia/Seoul`이 기본값이다. macOS 웹/PWA와 iOS Safari/홈 화면 PWA를 대상으로 한다.
- 홈은 월간 하루 할 일이며 기간형 항목은 제외한다. 미완료 기간 최대 세 개는 고정 표시하고 자동 회전하지 않는다. 초과 항목은 홈을 밀지 않는 3열 오버레이에 표시한다.
- 현재 Figma의 순백 배경·라벤더·날짜 점·선택일 목록·home/calendar/profile 세 아이콘을 유지한다. 프로필은 `/settings`, 전체/날짜 미정 task는 `/tasks`다. 앱명/검색 상단바·박스 테두리·추가 버튼 반복은 만들지 않는다.
- 기간 바는 **시간 경과율**이며 checklist 완료·부모 제출/신청 완료와 독립적이다. 종료 미정 시작 표시 레일은 progressbar가 아니다.
- 4종 `task/deadline/window/event`, 날짜형 포함 종료일, 시간형 종료 제외, time 기간 0길이 거부를 유지한다.
- 시작 표시 기본1일, 정수0~30일. 시간형 24시간 이상 D-N, 24시간 미만 HH:MM, 10분 미만 MM:SS; 날짜형은 달력 D-N만 표시한다. checklist는 사용자 결정에 따라 단일 문서당 최대4개이며 Rules·validator·editor에 같은 상한을 적용한다.
- ICS는 브라우저 파일5MiB/발생2,000개, 기본6개월·최대12개월, 정해진 RRULE subset과 EXDATE만 지원한다. unsupported 구성·부분 실패·중복·tombstone을 숨기지 않는다.
- offline 변경은 IndexedDB transaction complete 뒤에만 저장 성공이며, journal 실패를 서버 직접 write로 우회하지 않는다. 마지막 쓰기 우선·자동 필드 병합을 하지 않는다.
- canonical mutation은 온라인 `runTransaction`만 사용한다. UI의 SDK 직접 접근, SDK의 offline `setDoc/updateDoc/deleteDoc/writeBatch` 경로는 사용하지 않는다.
- 새 코드 TypeScript, 상호작용 파일 최상단 `'use client'`, 2칸 들여쓰기·세미콜론, `any`/production console.log/.env 커밋 금지.
- 새 production 의존성은 `[ASSUMPTION]` 후보와 채택 이유를 먼저 문서/변경 설명에서 검토한다. 원격 push·실제 Firebase 배포·공개 OAuth 설정 변경은 이 구현 수행과 별개다.
- 완료 검증은 `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`; test에 Rules Emulator 검증을 포함한다. 실기기 확인을 브라우저 엔진 테스트로 대신했다고 주장하지 않는다.
- 사용자 지시에 따라 **TDD는 어려운 Task2/3/4/7에만 적용**한다. ICS 반복·시간대·부분 재시도는 DST 경계와 데이터 중복/유실 위험이 높아 Task7도 어려운 범위로 분류한다. 일반 Task1/5/6/8은 먼저 구현하고 필요한 계약·흐름 검증을 추가한다. 설정·스타일을 그대로 복제하는 테스트는 만들지 않는다. Task9는 구현된 앱의 통합 검증이다.

## Review Focus

1. **응답 유실 뒤 다른 기기 수정:** 과거 작업은 receipt로 성공을 인식하지만 successor를 최신 원격 revision으로 자동 rebase하지 않는다. Task3의 `receipt_after_remote_edit`, Task4의 `successor_keeps_predecessor_revision`으로 검증한다.
2. **두 탭·계정 전환 중 늦은 응답:** IndexedDB CAS가 폼 입력을 지키고 이전 UID 응답이 새 계정 화면에 섞이지 않는다. Task4의 `two_tabs_stale_local`/`late_ack_after_uid_switch`, Task5의 `account_transition_hides_previous_data`로 검증한다.
3. **시간대 규칙 변경·DST와 ICS:** 날짜 계산·안정 source key가 UTC 변환과 별개이고 모호한 시리즈를 자동 보정하지 않는다. Task2의 DST 테스트, Task7의 `stable_tzid_key`/`dst_series_issue`로 검증한다.
4. **로컬 저장 실패·앱 업데이트:** 저장 성공을 거짓 표시하거나 dirty 입력을 reload로 버리지 않는다. Task4의 `idb_abort_preserves_input`, Task8의 `update_waits_for_dirty_form`으로 검증한다.
5. **ICS 재가져오기·삭제·중간 중단:** primary/tombstone/복사본을 구분하고 부분 성공 재시도에 새 ID가 생기지 않는다. Task7의 `primary_clone_tombstone`/`resume_partial_import`으로 검증한다.

---

## 실행·검토 방식

구현 수행 방식은 사용자가 지정한 모델 배정을 따른다. 일반 Task1/5/6/8/9는 현재 에이전트 모델을 상속하고, 어려운 Task2/3/4/7 및 시간·보안·동기화·ICS 데이터 무결성의 최종 판단은 `gpt-6.1-sol` + `xhigh`로 맡긴다. 별도 fast 토글을 설정할 수 없다는 현재 도구 제약을 유지한다.

각 task는 구현자 한 명에게 해당 task와 공통 제약·필요한 spec만 전달하고, 독립 구현자들이 같은 파일을 동시에 수정하지 않게 순차 진행한다. task 완료 후 새 검토자가 task diff·테스트 결과를 확인한다. 시간/Rules/sync/ICS 경계의 설계·실패 시나리오는 `gpt-6.1-sol` + `xhigh`가 최종 판정한다. 리뷰를 이유로 이미 동일 코드에서 성공한 검증 전체를 반복하지 않는다. 최종 통합 검토에서만 전체 앱·사양 누락을 다시 본다.

작업 상태·해결된 판단·검증 증거는 `doc/implementation/execution-log.md`에 기록한다. 미전송 사용자 초안이나 source 파일을 작업 로그 정리 대상에 넣지 않는다. 현재 workspace 권한은 `.git`을 읽기 전용으로 표시하므로 branch/commit을 시도하지 않고 소스·문서 변경과 검증을 현재 checkout에 보존한다. 원격 push·배포는 하지 않는다.

## 파일 구조

폴더별 책임은 [전체 설계](05-implementation-design.md) 및 [프론트엔드 파일 맵](03-frontend-delivery.md)을 따른다. 아래 Files가 각 task의 실제 변경 경계다. CSS 파일은 같은 이름의 `.module.css`에 두고 공통 token은 `src/styles/tokens.css` 하나를 소비한다. 여기에서 정의하지 않은 새 저장 컬렉션·공유 타입·프레임워크는 구현자 임의로 도입하지 않는다.

### Task 1: 검증 가능한 정적 앱과 도메인 입력 계약 — 현재 에이전트 모델

**Files:**
- Create: `package.json`, `pnpm-lock.yaml`, `.gitignore`, `.env.example`, `.node-version`, `next.config.ts`, `tsconfig.json`, `eslint.config.mts`, `vitest.config.ts`, `vitest.rules.config.ts`, `playwright.config.ts`, `firebase.json`, `.firebaserc`, `firestore.indexes.json`.
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/calendar/page.tsx`, `src/app/tasks/page.tsx`, `src/app/settings/page.tsx`, `src/app/globals.css`, `src/styles/tokens.css`.
- Create: `src/domain/items.ts`, `src/domain/validation.ts`, `src/lib/errors.ts`, `tests/fixtures/items.ts`, `tests/domain/validation.test.ts`.
- Modify: `AGENTS.md`의 setup 안내; `README.md`의 실제 로컬 준비/검증 명령. 기존 규칙을 삭제하지 않는다.

**Interfaces:**
- Consumes: 기존04와 핵심 구현 계약의 4종 타입, 입력 한도, proposed/canonical metadata 분리.
- Produces: `CalendarItem`, `ProposedCalendarItem`, `ItemView`, `PendingDraft`, `DraftInput`, `RepositoryError`, `ValidationResult<T>`, `FieldIssue`.
- Produces: `validateProposedItem(value: unknown): ValidationResult<ProposedCalendarItem>`, `validateCanonicalItem(value: unknown): ValidationResult<CalendarItem>`.
- Produces: `makeTask(overrides?)`, `makeDeadline(overrides?)`, `makeWindow(overrides?)`, `makeEvent(overrides?)` 테스트 fixture factory. 유효 기본값은 Asia/Seoul·2026-10-03·명시적 id이며 canonical metadata는 별도 factory로 붙인다.

- [ ] **Step 1: 환경과 의존성 후보를 확인하고 최소 테스트 실행 환경을 만든다.** Node24 LTS·JDK21을 프로젝트/CI 기준으로 준비하고 pnpm 정확 버전을 pin한다. 현재 Node26.4.0/pnpm11.19.0/Java 없음 관찰값을 바꾸지 않고 기록한 뒤 실제 준비 결과를 기록한다. production 후보는 설계 검토에서 확인된 것만 설치하고 lockfile을 남긴다. .env.example만 예외적으로 추적하며 실제 .env는 제외한다.
- [ ] **Step 2: 타입·validator와 정적 route 셸을 구현한다.** `unknown`을 discriminated union으로 검증하며 도메인 시간형 값은 UTC ISO를 유지한다. 시간대·실제 Gregorian 확인은 Task2 함수로 연결할 명확한 helper 경계를 둔다. `output:'export'`, 서버 기능 없음, CSS tokens를 설정한다. `typecheck=tsc --noEmit`, `lint=eslint .`, `test:unit=vitest run`, `test:rules=vitest run --config vitest.rules.config.ts`로 정의하고 test는 unit + demo-todolist Emulator rules를 실행한다.
- [ ] **Step 3: 입력 계약의 회귀 검증을 추가한다.** `reject_blank_title`, `task_has_no_range`, `event_requires_start_and_end`, `window_unknown_end_only_for_time`, `checklist_limits_and_unique_ids`, `metadata_not_allowed_in_proposal`에서 공백 제목/기간task/date 종료미정/5개·중복ID/위조 metadata가 valid=false인지 확인한다. 날짜 event의 같은 시작·종료는 valid=true이며 time event 동일 instant는 false다.
- [ ] **Step 4: `pnpm test:unit tests/domain/validation.test.ts`를 실행하고 계약 위반을 고친다.** 의도적으로 기능을 비우거나 구현을 되돌려 red 단계를 만들지 않는다.
- [ ] **Step 5: validator 테스트·typecheck·lint·static build를 확인한다.** 아직 Rules 파일이 없는 단계는 임시 기본 deny 규칙을 설정하고 fake 통과를 만들지 않는다. 날짜/time 세부 검증은 Task2 후에도 회귀한다. 기존 Prisma migrate 안내는 실제 Emulator 명령으로 교체하고 repository/auth/no-any 제약을 유지한다.
- [ ] **Step 6: 실제 수정 파일과 검증 결과를 ledger에 남긴다.** 현재 workspace의 `.git`은 읽기 전용이므로 commit은 수행하지 않는다.

### Task 2: 시간·홈 projection·카운트다운 계산 — gpt-6.1-sol xhigh

**Files:**
- Create: `src/domain/time.ts`, `src/domain/projections.ts`.
- Modify: `src/domain/validation.ts`의 시간대·달력 helper 연결.
- Test: `tests/domain/time.test.ts`, `tests/domain/projections.test.ts`.

**Interfaces:**
- Consumes: Task1 타입/fixture/ValidationResult; 핵심 설계3·4·9절.
- Produces: `parseLocalDateTime(date,clock,zone): LocalTimeResult`, `getTimingBounds(timing): TimingBounds`, `formatDDay(targetDate,zone,nowMs): string`, `getElapsedRatio(bounds,nowMs): number|null`, `getStartCountdown(item,nowMs): CountdownView`.
- Produces: `deriveChecklistStatus(items): ChecklistStatus`, `selectHomePeriods(items,nowMs): HomePeriodSelection`, `selectDailyTasks(items,date,zone): ItemView[]`, `selectCalendarAgenda(items,date,zone): ItemView[]`, `selectPeriodGroups(items,nowMs): PeriodGroups`.

- [ ] **Step 1: TIME-01~15·DATA-06 테스트를 쓴다.** Seoul 오늘10/03→10/09 D-6; 날짜10/01~10/03은10/04 00:00 종료; New York DST 날 날짜차1; 시간형600000ms=`00:10`/599000ms=`09:59`/100ms=`00:01`; 날짜형 시작에 초 표시 없음; daysBefore0 hidden; 부모 completion과 checklist 독립을 검사한다.
- [ ] **Step 2: `pnpm test:unit tests/domain` 실패를 확인한다.** 테스트의 now는 Date.now를 숨겨 쓰지 않고 정확한 UTC instant를 주입한다.
- [ ] **Step 3: 명시한 순수 함수를 구현한다.** 달력 이동과 instant 간격을 분리하고 DST gap 오류/overlap 두 후보를 반환한다. 입력 validator가 실제 잘못된 날짜를 거부한다. `selectHomePeriods`는 고정2개·hidden 미완료 수·미래→종료미정→기한경과 그룹과 안정tie를 따른다. 홈task와 event/기간을 분리한다.
- [ ] **Step 4: `dst_nonexistent_and_ambiguous_input`, `home_overflow_and_phase_transition`를 추가 검증한다.** countdown 날짜·instant 경계는 알림 규칙과 독립적으로 검사한다.
- [ ] **Step 5: domain 테스트·typecheck를 확인한다.** Task1의 validator 회귀도 포함한다.

### Task 3: Firestore canonical·Rules·멱등 commit — gpt-6.1-sol xhigh

**Files:**
- Create: `src/lib/firebase/config.ts`, `src/lib/storage/contracts.ts`, `src/lib/storage/firestore.ts`.
- Create/Modify: `firestore.rules`, `firestore.indexes.json`, `firebase.json`.
- Test: `tests/rules/items.test.ts`, `tests/rules/receipts.test.ts`, `tests/integration/firestore-commit.test.ts`.

**Interfaces:**
- Consumes: Task1 검증된 CalendarItem/ProposedCalendarItem/PendingDraft, Task2 시간 검증.
- Produces: `RemoteStore`, `RemoteSnapshot`, `MutationReceipt`, `RemoteCommitResult`; `createFirestoreStore(config: FirebasePublicConfig): RemoteStore`.
- Produces: `readFirebaseConfig(env: PublicEnvironment): ConfigResult`는 configured/missing/invalid를 구분한다. PublicEnvironment는 필요한 공개 env 키의 record이며 configured 결과만 FirebasePublicConfig를 가진다. 브라우저 initialize/cache는 client에서만 실행한다.

- [ ] **Step 1: client validator를 우회하는 Rules 공격 테스트와 remote commit 실패 테스트를 만든다.** AUTH-01~02, revision1/+1, 유형별 필수 키, 4개 checklist 상한, 구버전 reminder field 거부, receipt 단독write, 다른UID, tombstone update/delete, 같은ID의 다른digest 거부를 확인한다. Rules test는 demo-todolist만 허용하고 production 설정이면 중지한다.
- [ ] **Step 2: `pnpm exec firebase emulators:exec --project demo-todolist --only auth,firestore "pnpm test:rules"`로 실패를 확인한다.** Emulator 미기동을 기능의 실패 테스트와 혼동하지 않는다.
- [ ] **Step 3: wire encode/decode, UID listener, receipt 우선transaction, Rules를 구현한다.** UTC ISO↔Timestamp는 adapter 내부만, persistent cache는 조회용, canonical write는 runTransaction만 사용한다. callback에 UI/journal side effect를 넣지 않고 모든read 선행·item+receipt 두write를 원자적으로 저장한다. malformed remote는 decoder 오류로 남기고 UI에 무검증 데이터를 보내지 않는다.
- [ ] **Step 4: `receipt_after_remote_edit`를 검증한다.** A operation이revision2 commit→ACK손실→B가revision3→A 같은operation retry는 already-applied, receipt.resultRevision=2/remote.revision=3이며 추가write가 없다. revision 불일치/tombstone은 conflict, 기존revision 항목 물리 소실은 integrity 오류다.
- [x] **Step 5: 체크리스트 상한 결정을 적용한 뒤 정상write와 경계 밖write를 실제 Emulator에서 확인한다.** 사용자 결정으로 단일 문서 최대4개를 적용했다. 최대 길이 공통 필드·timing·countdown·4개 checklist의 create/update/tombstone이 통과하고 5개가 거부됨을 검증했다. 허용치 이후 슬롯을 Rules에서 불필요하게 검사하던 코드를 제거해 expression 한도를 지켰다.
- [ ] **Step 6: Rules/integration·typecheck·lint를 확인하고 결과를 ledger에 남긴다.**

### Task 4: IndexedDB journal·successor·repository — gpt-6.1-sol xhigh

**Files:**
- Create: `src/lib/storage/journal.ts`, `src/lib/storage/sync.ts`, `src/lib/repository.ts`.
- Modify: `src/lib/storage/contracts.ts`의 JournalStore/internal result.
- Test: `tests/storage/journal.test.ts`, `tests/storage/sync.test.ts`, `tests/storage/repository.test.ts`, `tests/integration/two-clients-sync.test.ts`.

**Interfaces:**
- Consumes: Task1 DraftInput/ItemView/PendingDraft/RepositoryError, Task3 RemoteStore, Task2 projections.
- Produces: 기존04의 `Repository` 공개 계약, `createRepository(session: {uid:string;generation:number}, ports: RepositoryPorts): Repository`. RepositoryPorts는 remote/journal/clock/idFactory를 포함하며 테스트에서 주입한다. Repository는 `dispose():void`도 가진다.
- Produces: `saveDraft(input: DraftInput): Promise<SaveResult>`는 IDB 성공 직후 queued, `flushPending():Promise<void>`, `resolveConflict(itemId,choice):Promise<SaveResult>`, 읽기/구독/백업을 제공한다. import 메서드는 Task7에서 같은 repository에 완성한다.
- Produces: `ConflictChoice`에 `{choice:'restore-as-new'}`를 추가한다. tombstone의 일반 use-local은 불가하다. SyncState/ItemView는 기존04를 사용하며 cache provenance를 추가한다.
- Produces: `clearDeviceData(options:{discardPending:boolean}):Promise<DeviceDataClearResult>`는 핵심 구현 계약의 pending/busy/other-tabs 보호와 현재 UID journal 경계를 따른다. 정리 실패/다른 계정 journal 보존을 storage 테스트에 포함한다.

- [ ] **Step 1: SYNC-02~13·AUTH-03 실패 테스트를 만든다.** IndexedDB transaction abort 뒤 저장 실패/입력 유지, 인스턴스 재생성 뒤 queued/sending 복원, CAS stale-local, 미전송 create-delete의 serverwrite0, sending create-delete의 receipt 확인 순서, UID 격리를 확인한다.
- [ ] **Step 2: `pnpm test:unit tests/storage`로 실패를 확인한다.** fake-indexeddb를 쓰되 memory map으로 대체해 재시작 테스트를 통과시키지 않는다.
- [ ] **Step 3: journal store와 sync 상태 전이를 구현한다.** transaction complete로 해결, hash/네트워크는 IDB transaction 밖, 불변sending＋queuedsuccessor, operation별ACK, head 비교, revision conflict 두 판본, 원본tombstone을 남기는 새ID 복원을 구현한다. 모든primary/index key에 UID를 포함한다.
- [ ] **Step 4: `successor_keeps_predecessor_revision`, `two_tabs_stale_local`, `late_ack_after_uid_switch`, `idb_abort_preserves_input`을 검증한다.** ACK 뒤 원격 추가 수정이 있어도 successor base는 predecessor receipt revision이며 stale-local 입력도 보존한다. UID B로 A의 지연 응답을 보내지 않는다. 같은payload 두 송신에서 serverrevision은 한 번만 증가한다.
- [ ] **Step 5: `two-clients-sync.test.ts`에서 실제 Emulator와 journal을 결합한다.** stale base/title만 변경해도 자동merge 없이 conflict, keep/edit/restore-as-new, 해결 중 다른 변경에 재conflict를 확인한다. 네트워크/권한 오류별 재시도와 중지를 나눈다.
- [ ] **Step 6: unit·Rules/integration·typecheck·lint를 확인하고 결과를 ledger에 남긴다.** SDKcache unavailable/journal unavailable을 성공 저장으로 표시하지 않는다.

### Task 5: Auth와 Figma의 반응형 홈·별도 캘린더 — 현재 에이전트 모델

**Files:**
- Create: `src/auth/client.ts`, `src/auth/session.ts`, `src/app/providers.tsx`.
- Create: `src/features/shell/AppShell.tsx`, `BottomNavigation.tsx`, `SyncStatus.tsx`, `src/features/home/MonthTaskGrid.tsx`, `PeriodProgressSummary.tsx`, `SelectedDayTasks.tsx`.
- Create: `src/features/calendar/CalendarMonthView.tsx`, `SelectedDayAgenda.tsx`, `PeriodList.tsx`, `src/features/tasks/AllTasks.tsx`, `src/features/account/AccountSettings.tsx` 및 대응 CSS Modules.
- Modify: 4개 route page/layout과 `src/styles/tokens.css`.
- Create: `public/design/`의 Figma 원본 정적 SVG, `public/fonts/`의 허가된 Noto Sans KR와 라이선스 기록.
- Test: `tests/ui/home.test.tsx`, `tests/ui/navigation.test.tsx`, `tests/auth/session.test.ts`.

**Interfaces:**
- Consumes: Repository/ItemView/SyncState, Task2 selectors. feature는 SDK/internal adapter를 import하지 않는다.
- Produces: `AuthSession` (signed-out/resolving/signed-in/error, signed-in만 uid/generation 보유), `signInWithGoogle():Promise<void>`, `requestSignOut(choice: SignOutChoice):Promise<void>`. SignOutChoice는 flush/export-and-retain/retain/discard를 구분한다.
- Produces: `useRepository(): Repository`, `useItems(): readonly ItemView[]`, `useSyncState(): SyncState` provider hooks. signed-out일 때 repository hook을 사용하는 화면을 mount하지 않는다.
- Produces: `useFormGuard(): FormGuardRegistry`; `FormGuardRegistry.register(id:string, dirty:boolean):()=>void`로 dirty editor와 reload guard를 연결한다.

- [ ] **Step 1: Figma 고정밀 design_context와 화면을 재확인하고 asset을 지정 방법으로 저장해 구현한다.** 흰 배경·lavender tokens·Noto Sans KR, desktop1440×1024/iOS390×844를 기준으로 source icon24px을 그대로 사용한다. CSS Modules의 유동 layout으로 변환하고 SVG 루트 치수를 변형하지 않는다. 768–1439px 세로 순서, 44px hitbox, safe-area와 긴 task의 줄바꿈을 구현한다.
- [ ] **Step 2: Google redirect/Auth 복원·동일 domain auth helper·Emulator mode를 연결한다.** 설정이 부족하면 구성 안내를 제공하고 production에서 fake login/sync sample을 자동 생성하지 않는다. fixture preview는 test 안에서만 제공한다. UID 변경의 dispose/clear, cache-only 상태, 최초 offline을 명시한다.
- [ ] **Step 3: UI-01/06/07/08·AUTH-03의 주요 흐름 검증을 추가한다.** 0/1/2/3개 기간, 홈task만 표시, overflow 수, 단일 추가, home/calendar/profile route, 날짜 키보드, account_transition_hides_previous_data를 확인한다. mocked repository로 view 계약을 검증하며 mock을 실제 Google 로그인 성공 증거로 쓰지 않는다.
- [ ] **Step 4: `pnpm test:unit tests/ui/home.test.tsx tests/ui/navigation.test.tsx tests/auth/session.test.ts`를 실행하고 발견한 흐름 오류를 고친다.**
- [ ] **Step 5: UI 테스트·typecheck·lint·build를 확인한다.** 시각 비교는 Task9에서 같은 viewport/고정 fixture를 사용하고 실데이터와 혼동하지 않는다.

### Task 6: 4종 CRUD·checklist·충돌 선택 UI — 현재 에이전트 모델

**Files:**
- Create: `src/features/items/ItemEditor.tsx`, `ItemDetailDialog.tsx`, `ChecklistEditor.tsx`, `src/features/sync/ConflictDialog.tsx` 및 대응 CSS Modules.
- Modify: SelectedDayTasks/SelectedDayAgenda/PeriodList/AccountSettings의 동작 연결.
- Test: `tests/ui/item-editor.test.tsx`, `tests/ui/checklist.test.tsx`, `tests/ui/conflict-dialog.test.tsx`.

**Interfaces:**
- Consumes: validator/time parser/Repository.saveDraft/resolveConflict, ItemView.localDraft의 localSequence, Task5 FormGuardRegistry.
- Produces: `ItemEditor({initial: ItemView|null,selectedDate:string,onClose:()=>void})`, 기간형 ChecklistEditor, ConflictDialog. initial.display를 편집하며 initial.canonical/localDraft/localSequence에서 base와 CAS 값을 고정한다. 폼은 입력 저장 완료까지 입력 state를 유지한다.
- Produces: `ChecklistEditor({value:readonly PeriodChecklistItem[],onChange:(next:PeriodChecklistItem[])=>void})`, `ConflictDialog({itemId:string,onClose:()=>void})`. 상세의 체크 변경도 부모 전체 snapshot을 saveDraft로 보낸다.

- [ ] **Step 1: repository 공개 API로 CRUD/완료/삭제/period checklist를 연결한다.** 홈 추가는 한 곳, event는 /calendar, 날짜 미정 task는 /tasks에서 제공한다. countdown 표시 옵션은 기간 item에 저장하며 reminder rule editor는 두지 않는다. 유형 변경에서 checklist를 조용히 버리지 않는다. 부모 제출/신청 완료는 상세에서 명시한다.
- [ ] **Step 2: conflict local/remote/base 차이와 keep-remote/use-local/edit/new-ID restore를 만든다.** 재충돌에서도 편집안을 남긴다. Escape/focus trap/focus restore, 오류 field label, 연속 저장 방지를 확인한다. 저장 버튼과 checkbox는 local 성공 전에 성공 toast를 표시하지 않는다.
- [ ] **Step 3: DATA-01~04/06·UI-02/05의 입력·저장 흐름 검증을 추가한다.** 유형별 입력, window start/endnull, checklist 결정 상한·초과 입력 보존·완료 후 재개, completion 분리, DTSTART 입력의 DST gap/fold 후보 선택, IDB 실패 시 dialog/값 보존을 확인한다.
- [ ] **Step 4: `pnpm test:unit tests/ui/item-editor.test.tsx tests/ui/checklist.test.tsx tests/ui/conflict-dialog.test.tsx`를 실행하고 발견한 오류를 고친다.**
- [ ] **Step 5: tests/typecheck/lint를 확인한다.**

### Task 7: ICS worker·preview·재시도·JSON — gpt-6.1-sol xhigh

**Files:**
- Create: `src/features/import/contracts.ts`, `parser-core.ts`, `ics.worker.ts`, `parser.ts`, `identity.ts`, `session.ts`, `ImportPreview.tsx`, `ImportControls.tsx` 및 CSS Modules.
- Modify: repository import/backup 공개 API, journal imports store·atomic queue/ACK·operation error, calendar/settings 연결.
- Test: `tests/import/parser.test.ts`, `identity.test.ts`, `import-session.test.ts`, `worker.test.ts` 및 ICS fixture 문자열.

**Interfaces:**
- Consumes: [ICS 조사](02-import-time-research.md)의 지원 subset/zone policy, Task2 time, Task4 journal/repository.
- Produces: `parseIcsFileInWorker(file:File, options:ImportOptions):Promise<ParsedImport>`, `makeImportPrimaryId(uid:string,occurrenceKey:string):Promise<string>`. ParsedImport는 저장소 비교 전 parser 결과이며 ImportOptions/ParsedImport는 import/contracts.ts가 정의한다.
- Produces: Repository의 `importIcs(file:File,options?:ImportOptions):Promise<ImportPreview>`, `updateImportPreview(previewId:string,edits:ImportCandidateEdit[]):Promise<ImportPreview>`, `commitIcsImport(previewId:string,decisions:ImportDecision[]):Promise<ImportResult>`, `readImportResult(previewId:string):Promise<ImportResult>`, `listImportPreviews():Promise<ImportPreview[]>`, `exportBackup():Promise<BackupExport>`. 공통 ImportPreview/Decision/Result 타입은 공개 repository 경계에 한 번 정의한다. `ImportPreview({file:File|null,initialPreview?:ImportPreview|null,onClose:()=>void})`가 파일/범위 선택, 재열기와 결과 표시를 소유한다.

- [x] **Step 1: 어려운 ICS 시간·identity 계약에 failing fixture를 먼저 작성한다.** DATE DTEND 배타→포함, UTC/IANA/floating, RRULE subset/EXDATE, calendar edge, UID/SUMMARY 누락, unknownTZID/exception series, stable TZID key, primary/clone/tombstone과 retry identity를 검증했다. 최초 session TDD에서 10개 미구현 실패를 기록했고 후속 conflict/digest/checklist 보존 경계도 별도 RED/GREEN cycle로 확인했다. 상세 증거는 [Task 7 보고](task-7-report.md)와 parser 선행 보고에 있다.
- [x] **Step 2: parser worker와 preview를 구현한다.** 기본 오늘부터 6달력개월/최대 12개월, 5 MiB/2,000 occurrence, strict subset의 whole-series issues, 알려진 IANA와 custom/mismatch/DST 오류 처리를 구현했다. 누락 title/end 보완, 100,000회·5초 예산과 worker 취소를 연결했다. worker-safe parser core를 분리해 production module cycle을 없앴다.
- [x] **Step 3: 멱등 import session과 JSON export를 연결한다.** 현재 UID canonical/pending을 분리하고 server/cache 출처를 표시한다. plan version CAS와 고정 operation/clone ID로 retry, atomic queue/ACK와 per-operation 오류를 저장한다. 결과는 행별 saved/queued/conflicted/failed/skipped를 구분하며 queued를 서버 성공으로 표시하지 않는다. JSON export는 canonical/pending을 나누고 source를 기록한다.
- [x] **Step 4: focused test를 실행한다.** `tests/import` 82개, `tests/import`+`tests/storage` 128개가 통과했다. worker protocol은 parser를 실행하는 test double로 검증했다.
- [x] **Step 5: `stable_tzid_key`, `dst_series_issue`, `primary_clone_tombstone`, `resume_partial_import`를 검증한다.** primary/copy/tombstone, source-only edits, plan CAS, conflict keep-remote/use-local ACK, request/ACK loss, concurrent retry, persisted replacement ID와 digest, reload/partial failure를 검증했다. 실제 인증된 UI smoke는 Firebase 설정이 없어 대기 상태다.
- [x] **Step 6: import tests·Rules/integration·typecheck·lint·build를 확인한다.** 최종 `pnpm test`에서 unit 199개와 Rules/integration 76개, `typecheck`, `lint`, `build`, `git diff --check`가 통과했다. 변경은 커밋하거나 push하지 않았다.

### Task 8: 전경 카운트다운·안전한 PWA — 현재 에이전트 모델

**Files:**
- Create: `src/features/shell/useForegroundClock.ts`, `src/pwa/client.ts`, `src/pwa/service-worker.ts`, `scripts/generate-sw.ts`, `tsconfig.sw.json`.
- Create: `public/manifest.webmanifest`, `public/icons/`, `src/features/shell/UpdatePrompt.tsx` 및 CSS.
- Modify: providers/layout/PeriodProgressSummary/AccountSettings, package build script, firebase.json cache headers.
- Test: PWA guard policy `tests/pwa/update-policy.test.ts`, `tests/pwa/precache.test.ts`, foreground countdown lifecycle verification.

**Interfaces:**
- Consumes: Task2 CountdownView and selectors, provider의 dirty-form guard.
- Produces: `useForegroundClock(initialNowMs:number):number`, `registerPwa(onUpdateAvailable):Promise<PwaRegistrationHandle>`, `applyWaitingUpdate(registration,input):UpdateGuardResult`. Update guard는 dirty form, local write, journal availability, waiting/active worker와 사용자의 명시 동의를 확인한다.
- Produces: 정적 `out/sw.js`, build별 precache 목록. source는 TypeScript로 작성·별도 WebWorker lib로 typecheck하고 generator가 빌드 후 JS로 내보낸다.

- [x] **Step 1: 전경 clock을 구현한다.** `useForegroundClock(initialNowMs)`를 홈·캘린더에 연결했다. 보이는 동안 1초 갱신하고 탭 복귀·focus·pageshow에서 현재 시각을 다시 읽는다. notice/OS Notification 권한/푸시 경로는 추가하지 않았다.
- [x] **Step 2: service worker와 manifest를 구현한다.** 정적 asset과 export route shell만 precache한다. navigation은 요청한 route만 오프라인 캐시에서 찾고 모든 route에 home HTML을 반환하지 않는다. `/__/`는 fetch/cache에서 제외한다. 설치 캐시가 실패하면 신규 cache만 지우고 기존 worker를 유지한다. 대기 worker는 사용자 동작과 입력 내구성 확인 뒤에만 활성화하며 최근 두 cache를 보존한다.
- [x] **Step 3: 카운트다운 표시와 PWA 회귀 검증을 추가한다.** 정확 시각 기간을 생성해 `00:10 → 09:59 → 00:01 → 숨김`을 확인했다. 시계 전진 뒤 `pageshow`/`focus` 복귀 이벤트에서 화면 값을 다시 계산하며, 별도의 1초 live announcement는 하지 않는다. dirty form·local write·journal unavailable 차단은 정책 단위 테스트로 확인한다. 최신 전체 검증은 Chromium E2E 17/17이다.
- [x] **Step 4: countdown/PWA focused tests를 실행한다.** `tests/pwa/update-policy.test.ts`와 `tests/pwa/precache.test.ts`를 통과했다. PWA policy/precache tests는 8개다.
- [x] **Step 5: `update_waits_for_dirty_form`, `no_auth_navigation_fallback`, `offline_calendar_direct_route`를 확인한다.** 실제 Chrome과 Hosting Emulator에서 worker가 등록되어 `/`, `/calendar/`, `/settings/`, `/tasks/` 및 정적 자산을 cache하는 것을 확인했다. 오프라인 직접 `/calendar/` 진입은 200이었고 `/__/auth/handler`는 network 오류로 끝나 홈 화면으로 fallback하지 않았다. 사용자가 탭한 업데이트 guard는 dirty form·local write·journal 상태·명시 동의를 단위 테스트로 확인했다. PWA 이름은 `일정과 할 일`이며 앱 화면에 이름을 추가하지 않았다.
- [x] **Step 6: unit/typecheck/SWtypecheck/lint/staticbuild를 확인한다.** 전체 최종 수치는 실행 기록에 적고, countdown UI lifecycle 및 실 iOS 검증은 남은 작업으로 유지한다.

### Task 9: 통합 검증·Figma 비교·사용 안내 — 현재 에이전트 모델, 최종 고난도 판단은 gpt-6.1-sol xhigh

**Files:**
- Create: `tests/e2e/home.spec.ts`, `crud.spec.ts`, `offline-sync.spec.ts`, `import.spec.ts`, `pwa.spec.ts`, `tests/e2e/fixtures.ts`, `scripts/serve-export.ts`.
- Modify: `playwright.config.ts`, `README.md`, `AGENTS.md`, `doc/implementation/execution-log.md`, `doc/06-validation-delivery.md`의 실제 결과.
- Create: `doc/implementation/verification.md`, `doc/implementation/assets/verification/`의 비교 화면.

**Interfaces:**
- Consumes: 완성된4route/repository/auth/emulator, 정적out, Figma assets,06의 DATA/TIME/AUTH/SYNC/ICS/UI ID.
- Produces: `pnpm test:e2e`는 demo-todolist Emulator+정적서버에서 실행; production project 설정이면 중지한다. 고정시간 Figma fixture 주입은 test harness에서만 제공하고 사용자 앱에 sample 데이터를 자동 저장하지 않는다.

- [x] **Step 1: 실제 사용자 흐름 E2E를 작성한다.** 생성→체크→기간숨김/overflow→별도calendar, 두 browser context 동일UID 충돌/다른UID격리, offline재실행, ICS부분실패재시도, SWdeep route를 검사한다. 고정 디자인 미리보기는 E2E build에서만 켜고 모의Auth가 실제Google/iOS검증은 아니라는 경계를 기록한다.
- [x] **Step 2: `pnpm test:e2e`를 실행해 빠진 흐름·회귀를 확인하고 구현 경계의 결함을 수정했다.** 영구 실패 import가 앱 reload 뒤 자동 재전송되던 동기화 결함과 가져오기 계획 간 재시도 누출/재시도 유실을 실패 시나리오로 재현하고 수정했다.
- [x] **Step 3: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:e2e`를 최종 상태에서 확인했다.** 최신 전체 Chromium E2E는 preview CRUD·알림 1회 전달·홀드 재정렬을 포함해 18/18이다. 결과는 [구현 검증 보고](verification.md)에 기록했다.
- [x] **Step 4: 1440×1024·390×844의 같은 fixture/viewport에서 Figma와 렌더 화면을 비교했다.** 월간 홈, 기간 3개 요약과 초과 항목 3열 오버레이, 선택일 할 일, 중앙 icon navigation을 확인하고 캡처를 [검증 자산](assets/verification/)에 저장했다. 시간순 계산에 따라 Figma 예시와 행 순서는 달라질 수 있음을 검증 보고에 기록했다.
- [ ] **Step 5: macOS↔실제iPhone·Google redirect·홈화면설치·백그라운드복귀를 별도 확인한다.** 장비/계정 설정 없이 실행 못하면 `실기기 확인 대기`로 기록하고 자동테스트 결과와 분리한다. live Firebase 공개config/OAuth console 준비가 필요한 단계만 사용자 정보로 연결하며 비밀키를 요청하지 않는다.
- [x] **Step 6: FR-01~16 누락·임의 축약을 최종 검토하고 사용자 로컬 preview를 연다.** 실행 설명·환경변수·알림 한계·JSON 백업을 문서화하고 자동배포/push를 하지 않았다. `AGENTS.md`의 명령도 실제 package scripts에 맞췄다.
- [x] **Step 7: 수정 파일·검증 결과를 ledger에 기록하고 사용자에게 로컬 preview를 안내한다.** Firebase 실제 프로젝트·Google OAuth·iOS 설치 및 countdown 백그라운드 복귀는 별도 확인 대기로 남겼다.

## 요구사항·검증 연결

| FR | 소유 task | 검증 기준 |
|---|---|---|
| 01 계정·동기화 | 3/4/5/9 | AUTH-01~03, SYNC-01 |
| 02 홈·캘린더 | 2/5/9 | UI-01/06/07/08 |
| 03 CRUD | 1/6/9 | DATA-01~03 |
| 04 완료 | 2/6 | DATA-04/06 |
| 05 D-Day | 2/8 | TIME-01~05/10~13 |
| 06 시간 바 | 2/5 | TIME-06~08, UI-04 |
| 07 임박·상단2개 | 2/5 | TIME-09/14, UI-08 |
| 08 화면 카운트다운 | 2/5/8 | TIME-10~15 |
| 09 ICS | 7/9 | ICS-01~09 |
| 10 오프라인 | 4/8/9 | SYNC-02~04, PWA 재실행 |
| 11 충돌 | 3/4/6/9 | SYNC-05~09/11 |
| 12 상태 | 4/5/6 | SYNC-10, UI-05 |
| 13 접근성·반응형 | 5/6/9 | UI-01~07 |
| 14 이동성 | 4/5/7 | DATA-05, AUTH-03 |
| 15 하위목록 | 1/2/4/6 | DATA-06~07, SYNC-11 |
| 16 시작표시설정 | 1/2/5/6/8 | TIME-10~13, TIME-15 |

## 계획 자체 검토

기존16개 FR과 DATA/TIME/AUTH/SYNC/ICS/UI 시나리오를 위 task에 연결했다. reminder rules와 notice는 사용자 결정으로 후속 범위에 뒀으며 checklist 상한은 단일 문서당 4개로 결정해 Emulator 경계 검증을 마쳤다. 범위 밖인 네이티브·닫힌앱push·social/결제·학교공지자동수집·외부실시간sync를 V1에 끼워 넣지 않았다. stable import identity/primary clone, checklist 상한, date-only countdown, local CAS/successor, snapshot provenance는 구체화된 새 설계이며 원본 스케치와 함께 정합화한다. task간 정확한 공통 타입은 핵심 구현 설계/Task1에서 정의하고 screen 별로 새저장모델을 만들지 않는다. 앱의 전체 QA와 실제 Firebase 설정은 미완료다.
