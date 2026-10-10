# 시간·저장·동기화 구현 계약

작성·확인일: 2026-10-05 · 상태: 구현·로컬 preview 확인 기준 · 작성 책임: 주 에이전트

이 문서는 [제품 사양](../02-product-spec.md), [데이터 설계](../04-firebase-data-sync.md), [카운트다운·알림 로드맵](../05-alerts-native-roadmap.md)을 실제 구현 단위로 구체화한다. 알림 시점과 전체 스위치는 Firebase 항목 계약에서 제외하지만, 로컬 preview는 브라우저 localStorage에서 선택적으로 사용한다. UI와 일반 구현은 현재 에이전트가 수행하고 시간·동기화 의미를 함께 검토한다.

## 1. 책임 경계와 파일

| 파일 | 책임 | 접근 가능한 저장소 |
|---|---|---|
| `src/domain/items.ts` | 기존 4종 항목·제안·시간·체크리스트 타입 | 없음 |
| `src/domain/validation.ts` | `unknown` 입력 검증, 교차 필드·용량 제한 | 없음 |
| `src/domain/time.ts` | 시간대 변환, D-Day, 기간·카운트다운 계산 | 없음 |
| `src/domain/projections.ts` | 날짜별 할 일, 일정 agenda, 상단 3개 기간·전체 기간 그룹 | 없음 |
| `src/lib/repository.ts` | UI가 호출하는 유일한 영속성 API, UID 수명 관리 | 아래 내부 adapter를 조합 |
| `src/lib/storage/contracts.ts` | 저장 내부 타입, journal·remote port | 없음 |
| `src/lib/storage/journal.ts` | IndexedDB 원자적 로컬 저장·복구·완료 처리 | 앱 전용 IndexedDB |
| `src/lib/storage/firestore.ts` | Timestamp 변환, 단일 listener, receipt 우선 transaction | Firestore |
| `src/lib/storage/sync.ts` | 항목별 송신, successor, 재시도·충돌·탭 조율 | port만 호출 |
| `firestore.rules` | UID 격리·형식·revision·item/receipt 원자성 | Firestore Rules |

`repository.ts` 아래 adapter 분리는 DB 접근 예외를 뜻하지 않는다. 앱/컴포넌트는 repository의 공개 타입과 함수만 import한다. ESLint `no-restricted-imports`로 Firebase Firestore SDK 및 journal adapter를 feature/UI에서 직접 import하지 못하게 한다. 인증 SDK는 `src/auth/`만 사용하며 UID를 repository 초기화에 전달한다. PWA Cache Storage는 정적 자산용으로 한정한다.

## 2. 도메인과 입력 기본값

04의 `CalendarItem`, `ProposedCalendarItem`, `PeriodChecklistItem`을 출발점으로 삼는다. reminder rule은 Firebase v1 domain/storage 계약에서 제외하고 로컬 preview store에만 `itemId → minute offset`을 저장한다. revision 없는 새 항목을 `CalendarItem`으로 캐스팅하거나 가짜 revision 0을 만들지 않는다. metadata가 제거된 제안 타입도 4종 discriminated union을 유지한다. SDK 반환값·백업·worker 응답은 `unknown`에서 검증한다. `any`와 무검증 타입 단언으로 실패 데이터를 통과시키지 않는다.

| 입력 | 구현 제한·기본값 | 근거 |
|---|---|---|
| 제목/메모/분류/URL | 200/10,000/64/2,048자; 제목 trim 후 비어 있으면 오류 | 기존 04 계약 |
| URL | 절대 `https:` 또는 `http:`만; 열 때 `noopener noreferrer` | 기존 04 계약 |
| 하위 체크리스트 | 항목당 최대4개, 각 제목 200자, ID 중복 금지 | 사용자 결정에 따라 단일 문서 사용; 최대 payload를 포함한 Emulator 경계 검증 |
| 시작 표시 | enabled=true, daysBefore=1; 정수 0~30 | 기존 02/04 계약 |
| 시간대 | `Asia/Seoul`; 다른 IANA 이름은 실제 해석 가능성 검증 | 기존 사양 |

체크리스트 최대치는 사용자 결정에 따라 항목당 4개다. client validator와 Rules가 같은 상한을 적용하며, 상한 초과 입력은 조용히 버리지 않고 UI draft를 보존한다. 하위 ID는 플랫폼 UUID로 만들고 제목·순서를 ID로 사용하지 않는다.

date event와 date window에는 startDate가 필수다. date task의 startDate는 반드시 null, deadline만 startDate가 선택이다. 기존 04의 “event startDate 선택” 문장은 타입 정의와 모순이므로 정정한다. time window만 endAt=null을 허용한다. 기간형에서 task/event로 변경할 때 남아 있는 checklist를 자동 삭제하지 않는다. 별도 확인으로 정리한 뒤 변경한다. 부모 completion과 하위 체크 상태는 서로 갱신하지 않는다.

## 3. 시간 함수 계약

`DateOnly`는 검증된 `YYYY-MM-DD` 값, `InstantIso`는 밀리초까지 정규화한 UTC ISO 값, `EpochMs`는 정수 밀리초다. 타입 선언 자체가 런타임 검증을 대신하지 않는다. 공개 타입 이름은 `items.ts`, 계산 반환 타입은 `time.ts`에 둔다.

```ts
type TimingBounds = { startMs: number | null; endExclusiveMs: number | null };
type PeriodPhase = 'scheduled' | 'active' | 'overdue';
type CountdownView =
  | { kind: 'hidden' }
  | { kind: 'days'; text: string; nextUpdateMs: number }
  | { kind: 'hours-minutes'; text: string; nextUpdateMs: number }
  | { kind: 'minutes-seconds'; text: string; nextUpdateMs: number };
type LocalTimeResult =
  | { status: 'valid'; instant: string }
  | { status: 'invalid'; reason: 'invalid-input' | 'unknown-zone' | 'nonexistent-time' }
  | { status: 'ambiguous'; earlier: string; later: string };

function parseLocalDateTime(date: string, clock: string, zone: string): LocalTimeResult;
function getTimingBounds(timing: CalendarItem['timing']): TimingBounds;
function formatDDay(targetDate: string, zone: string, nowMs: number): string;
function getElapsedRatio(bounds: TimingBounds, nowMs: number): number | null;
function getStartCountdown(item: ProposedCalendarItem, nowMs: number): CountdownView;
```

날짜만 있는 값을 `new Date('YYYY-MM-DD')`로 현지 날짜처럼 해석하지 않는다. 날짜의 이동·차이는 Gregorian 달력 연산, instant의 간격은 밀리초 연산을 사용한다. `[ASSUMPTION] @js-temporal/polyfill`을 시간대/DST 처리 후보로 검토하며 native Temporal이 없는 브라우저도 같은 결과를 내게 한다. 모든 `nowMs`를 주입할 수 있어 고정 시간 테스트와 시각 검증이 가능해야 한다.

date 기간은 시작일 현지 자정부터 endDate 다음 날 현지 자정까지다. 다음 날은 달력에 하루를 더한 뒤 해당 시간대에서 변환하며 24시간을 instant에 더하지 않는다. DST 전환·일부 지역의 자정 전환에서 일 시작은 해당 날짜의 첫 유효 instant로 처리한다. 사용자 입력 시각은 DST gap이면 오류, overlap이면 두 UTC 후보를 보여주고 사용자가 고른다. 날짜형 바 계산의 자정 경계 정책과 시간형 입력의 오류 정책은 별개다.

시작·종료가 모두 있으면 경과율은 clamp((now-start)/(end-start), 0, 1); 없으면 null이다. time 기간은 end>start, date 기간은 startDate<=endDate다. 날짜형 하루 event는 정상이며 시간형 길이 0은 오류다. D-Day는 목표 시간대의 달력 날짜 차이로 D-Day/D-N/D+N을 계산한다. 지난 정확한 마감은 같은 날짜여도 `기한 경과`가 우선이다.

### 시작 표시 경계의 구체화

기존 문서의 일 단위·초 단위 표시를 다음처럼 분리한다. 날짜만 입력한 항목에서 정확한 시작 시각을 안다고 암시하지 않기 위한 구체화이며 구현 계획 검토에 포함한다.

- **시간형:** 노출 경계는 startMs - daysBefore×86,400,000ms다. daysBefore=0이면 시작 전 카운트다운은 나타나지 않고 시작 때 상태가 바뀐다. 24시간 이상 남으면 실제 남은 기간을 올림한 D-N; 24시간 미만이면 HH:MM; 600,000ms 미만이면 MM:SS다. 정확히 10분은 `00:10`, 9분59초는 `09:59`다. 표시 초는 양수 잔여 밀리초를 올림해 0.1초 남았을 때 `00:01`로 보이며, HH:MM은 그 초 값을 분 단위로 내림한다. 시작부터 음수/`00:00` 카운트다운 대신 phase를 표시한다.
- **날짜형:** 시작 날짜 - daysBefore 달력일의 첫 유효 시각부터 노출한다. 시작 날짜까지 달력 D-N만 표시하고 HH:MM/MM:SS를 만들지 않는다. 시작 날짜에 진입하면 진행/접수 중 상태가 된다. 날짜 미정·시작 없는 항목은 hidden이다.
- 카운트다운이 꺼져 있어도 기간 항목은 상단 정렬 후보다. 화면 읽기에는 매초 변경을 live announcement하지 않고 phase 변경만 공지한다.

Figma의 종료일 미정 신청은 시작 전 중립 레일과 시작점으로 표시한다. 이 레일은 **시작 표시**이며 경과율이 아니므로 `role=progressbar`/aria-valuenow를 주지 않는다. 시작 후에는 레일을 숨기고 접수 중 상태와 시작 정보를 유지한다. 끝이 알려진 기간만 실제 progressbar를 사용한다. 시작 없는 마감은 D-Day/정확한 마감 정보만 표시한다.

## 4. 홈 projection과 순위 안정성

```ts
type HomePeriodSelection = { visible: ItemView[]; hiddenIncompleteCount: number };
type PeriodGroups = {
  scheduled: ItemView[]; active: ItemView[]; overdue: ItemView[]; completed: ItemView[];
};
function selectHomePeriods(items: readonly ItemView[], nowMs: number): HomePeriodSelection;
function selectDailyTasks(items: readonly ItemView[], date: string, zone: string): ItemView[];
function selectCalendarAgenda(items: readonly ItemView[], date: string, zone: string): ItemView[];
function selectPeriodGroups(items: readonly ItemView[], nowMs: number): PeriodGroups;
function deriveChecklistStatus(items: readonly PeriodChecklistItem[]): ChecklistStatus;
```

상단 후보는 삭제되지 않은 미완료 deadline/window다. 정렬 그룹은 (1) 미래 시작·진행 중의 알려진 마감/종료, (2) 진행 중 종료 미정, (3) 기한 경과이며 각 그룹에서 (1)은 시간 오름차순, (2)는 시작 오름차순, (3)은 경과한 경계 내림차순이다. 같은 경계는 시작을 종료보다 먼저 두고 마지막 tie는 id 문자열 오름차순으로 고정한다. 최대 세 개를 선택하고 숨겨진 미완료 수만 센다. 완료·삭제는 숨겨진 수에서도 제외한다. 초과 항목은 캘린더를 밀지 않는 3열 오버레이에서 함께 표시한다.

날짜형 마감의 정렬 instant는 endDate 다음 날의 첫 유효 시각, 시작은 startDate 첫 유효 시각이다. 이것은 경계 순서를 결정하는 내부 값이며 UI에 가짜 마감 00:00을 추가하지 않는다. 선택일은 프로필의 Asia/Seoul 달력으로 탐색하고 time 항목은 그 날짜와 교차하는지 판정한다. 상세/행의 실제 시각은 항목 시간대를 표시한다.

기간 순위의 재평가는 데이터/완료 변경, 날짜 경계, 실제 start/end phase 전이에서 한다. 초 단위 렌더가 별도 상태 키로 순위를 교체하지 않는다. 순위용 Firestore 필드나 추가 listener를 만들지 않는다. 홈 날짜 점과 선택일 목록에는 task만 포함한다. 전체/날짜 미정 task는 `/tasks`, 기간·event는 별도 캘린더에서 찾는다.

전체 기간 필터는 `selectPeriodGroups`를 사용한다. scheduled는 시작이 미래, active는 시작 후·종료 전 또는 시작 없는 미래 마감, overdue는 종료 경과·미완료, completed는 부모 completion=completed다. 삭제는 모두 제외하고 completed 분류를 phase보다 먼저 적용한다. 예정은 시작 오름차순, 진행은 알려진 종료/마감 오름차순 뒤 종료 미정, 기한 경과는 최근 경과 먼저, 완료는 target 경계 내림차순이며 동률은 id 오름차순이다. UI에서 다른 규칙으로 재분류하지 않는다.

## 5. Journal의 내구성과 원자성

앱 DB는 `student-tasks-journal`, 최초 schemaVersion=1이다. native IndexedDB를 작은 Promise wrapper로 감싸고 서버 커밋과 혼동되는 request success 대신 **transaction complete**에 저장 성공을 반환한다. 트랜잭션 내부에서 hash 계산·fetch·장시간 await를 하지 않는다. 검증·UUID·SHA-256은 transaction 전, 비교와 레코드 변경은 한 readwrite transaction 안에서 수행한다. 브라우저 저장소 삭제·eviction까지 막는 백업은 아니므로 JSON 내보내기를 함께 제공한다.

| object store | primary key | 내용 |
|---|---|---|
| `drafts` | `[uid, operationId]` | PendingDraft; `[uid,itemId,localSequence]` index |
| `heads` | `[uid,itemId]` | 최신 localSequence/activeOperationId; 동일 항목 CAS |
| `resolutions` | `[uid,resolutionId]` | 충돌 선택과 기존 두 판본; 새 operation 연결, 확인 전 삭제 금지 |
| `imports` | `[uid,previewId]` | preview·확정 행 ID/선택·행별 결과; 일부 성공 재시도 |

canonical 오프라인 읽기는 명시적 Firestore persistent cache를 사용한다. journal에 같은 canonical collection을 별도로 복제하지 않는다. cache 불가·journal 불가를 각각 노출한다. journal 불가 때 저장을 서버로 우회하지 않으며 폼을 유지한다. `navigator.onLine`은 재시도 힌트일 뿐 서버 확인은 snapshot metadata/요청 결과로 판단한다.

`PendingDraft`는 04 필드에 `predecessorOperationId: string | null`을 추가한다. sending 작업 뒤에서 편집한 successor는 predecessor가 확정되기 전에는 송신하지 않는다. 최초 successor도 UUID와 현재 base의 digest를 가진 queued 작업으로 저장한다. predecessor의 receipt resultRevision과 **그 작업의** proposal이 확정되면, 아직 송신하지 않은 successor의 base를 결속하고 새 operation ID/digest로 원자적 대체한다. 기존 queued ID는 송신하지 않는다. 최신 서버 revision으로 임의 rebase하지 않는다.

공개 `saveDraft()`는 로컬 성공 직후 `queued`를 반환하고 온라인 flush는 별도로 시작한다. 서버 성공은 구독/상태로 전달한다. 기존 SaveResult의 saved/conflict는 `resolveConflict`와 내부 remote 결과에도 사용한다. `DraftInput`에 `expectedLocalSequence: number | null`을 추가해 두 탭이 같은 로컬 화면에서 저장할 때 CAS로 stale-local 결과를 반환한다. stale-local이면 기존 로컬안과 새 폼 입력을 모두 유지해 사용자가 재확인한다. IndexedDB가 성공하기 전 checkbox/폼 저장의 성공을 확정하지 않는다.

### 상태 전이

| 상황 | 로컬 원자적 변경 | 서버 처리 |
|---|---|---|
| 새 항목 저장 | base=null, queued + head | 온라인일 때 create revision1 |
| 아직 송신하지 않은 같은 항목 재편집 | 기존 base 유지, 새 proposal/ID/digest로 queued 대체 | 대체된 ID 송신 금지 |
| sending 중 재편집 | 불변 sending 유지, successor + head | predecessor 확정 후 successor 송신 |
| queued 신규 항목 삭제 | create/successor/head 원자적 취소 | 아무 write 없음 |
| sending create 삭제 | delete successor로 보존 | receipt 확인 후 정확한 revision 기준 delete |
| revision 충돌 | local/base/remote + conflicted | 자동 재시도·덮어쓰기 중지 |
| receipt 성공 | 해당 operation만 완료, head가 successor인지 확인 | 이미 적용된 작업 재쓰기 없음 |
| ACK 로컬 처리 중 앱 종료 | 다음 시작에 sending 그대로 복원 | 같은 receipt 확인으로 재개 |

다중 탭은 가능한 환경에서 Web Locks로 UID별 송신을 조율하고 BroadcastChannel로 journal 변화를 알린다. 미지원 환경에서는 중복 송신을 허용하되 서버 receipt와 IndexedDB CAS가 무결성을 보장해야 한다. Web Locks/채널은 정확성의 필수 전제가 아니다. 앱 재개는 queued뿐 아니라 sending도 복구한다. 보존 기록은 충돌 해결 완료 후 명시적으로 정리할 수 있고 미동기화 입력은 자동 TTL로 지우지 않는다.

## 6. Remote port와 receipt 우선 트랜잭션

```ts
type MutationReceipt = {
  itemId: string; payloadDigest: string; resultRevision: number; createdAt: string;
};
type RemoteCommitResult =
  | { status: 'applied'; receipt: MutationReceipt; remote: CalendarItem }
  | { status: 'already-applied'; receipt: MutationReceipt; remote: CalendarItem }
  | { status: 'conflict'; remote: CalendarItem };

interface RemoteStore {
  subscribe(uid: string, onSnapshot: (value: RemoteSnapshot) => void,
    onError: (error: RepositoryError) => void): () => void;
  commit(uid: string, draft: PendingDraft): Promise<RemoteCommitResult>;
  clearReadCache(): Promise<void>;
}
```

`RemoteSnapshot`은 items, fromCache, hasPendingWrites, receivedAt를 가진 plain 타입이다. `RepositoryError`는 code/message/retryable/fieldIssues를 가진 도메인 오류이며 persistence·auth·validation·permission·quota·integrity를 구분한다. HTTP API가 없어 ErrorResponse를 가짜 REST 경계로 만들지 않는다.

`validateProposedItem(value: unknown): ValidationResult<ProposedCalendarItem>`과 `validateCanonicalItem(value: unknown): ValidationResult<CalendarItem>`을 정의한다. `ValidationResult<T>`는 `{valid:true,value:T}` 또는 `{valid:false,issues:FieldIssue[]}`이며 FieldIssue는 path/code/message다. validation은 동기 함수이며 외부 fetch를 하지 않는다. 시간대·달력 유효성 확인이 필요하면 time 모듈의 순수 검증 함수를 사용한다. `deriveChecklistStatus`는 projections.ts가 소유한다.

commit은 receipt와 item의 읽기를 **모든 write 전에** 끝낸다. receipt가 있으면 itemId/digest/resultRevision을 검증해 해당 작업 성공을 반환한다. item revision이 더 높아도 성공이다. 없으면 create 부재 조건 또는 정확한 baseRevision을 검사한다. 기존 revision의 항목이 물리적으로 없으면 integrity 오류로 남겨 두고 create로 바꾸지 않는다. tombstone은 conflict이고 같은 ID upsert를 금지한다. 일치하면 item 전체·revision+1·serverTimestamp·lastMutation metadata와 create-only receipt를 한 transaction에 쓴다. callback은 재실행될 수 있으므로 UI/journal 변경·UUID/hash 생성은 callback 밖에서만 한다.

SDK commit 성공 뒤 Timestamp가 완성된 canonical을 server read로 확인한다. 확인 read가 실패해도 작업을 실패로 되돌려 쓰지 않고 같은 operation을 유지하여 receipt 재확인한다. receipt가 있어 canonical 최신 값이 tombstone이어도 성공한 과거 작업은 성공이며 화면은 최신 tombstone을 반영한다. receipt를 읽은 것만으로 successor의 base를 최신 remote로 바꾸지 않는다.

네트워크/unavailable/일시 quota는 1s,2s,4s,8s,16s,30s 상한의 jitter 재시도이며 백그라운드에서는 중지한다. permission-denied/무효 입력/다른 digest/무결성 오류는 자동 반복하지 않는다. 사용자 재시도·로그인 변화·서버 snapshot으로 재개할 수 있다. receipt는 문서마다 약 1 write를 추가하며 비용을 운영 문서에 반영한다.

충돌 선택 keep-remote는 local 작업을 명시적으로 종료한다. use-local/edit는 최신 원격안을 base로 새 operation을 만든다. 기존 충돌 판본은 resolution에 보존하고 새 결과를 확인한 뒤 정리한다. 원격이 tombstone이면 일반 use-local을 허용하지 않고 **새 ID로 복원** 버튼과 명시적 안내를 제공한다. 복원은 새 upsert이며 원본 tombstone·receipt를 변경하지 않는다. 다시 revision이 바뀌면 새로운 conflict로 반환한다.

## 7. Security Rules의 실제 검증 범위

기본 deny, UID 경로 일치, 모든 nested allowed/required keys, 타입별 timing/completion/checklist/countdown, title 길이, revision+1, request.time, immutable ID/source identity, tombstone 불변을 검사한다. v1에서는 reminder 설정 필드를 허용하지 않는다. 날짜의 Gregorian 유효성과 실제 IANA 존재는 client validator/decoder에서 확인한다. Rules는 모양·길이·순서만 검사한다는 기존 04 경계를 유지하며, malformed 서버 문서를 decoder가 화면에 그대로 쓰지 않게 한다.

Rules에 임의 길이 list 전체 타입을 한 번에 검사하는 기능은 없다. 사용자 결정에 따라 checklist 한 항목당 4개로 제한하고, 최대 허용치까지만 유한 슬롯 검증을 펼친다. 최대 길이 공통 필드·시간형 timing·시작 표시·4개 최대 길이 checklist의 create/update/tombstone이 expression/access 제한 안에서 통과하고, 5개는 거부됨을 Emulator로 검증했다.

item write는 getAfter(receipt)로 같은 itemId/digest/resultRevision/request.time을 요구하며 기존 receipt가 없어야 한다. receipt create는 getAfter(item)과 lastMutationId/digest/revision을 역으로 확인해 단독 receipt 위조를 막는다. item update/receipt create 두 write만 포함하고 다른 UID·물리 삭제·receipt update/delete는 모두 거부한다. digest는 operation payload 결속을 위한 클라이언트/adapter 계약이며 **Rules가 SHA-256을 재계산한다는 주장은 하지 않는다**. revision과 source identity 보안은 Rules에서 별도로 검증한다.

## 8. 계정 수명과 캐시

`createRepository(session: { uid: string; generation: number }, ports: RepositoryPorts)`로 인스턴스를 만든다. ports는 RemoteStore/JournalStore/clock/idFactory를 주입하며 production 조합은 factory 안에서 같은 계약으로 연결한다. UID 전환에서 listener/clock/import worker/flush를 해제하고 UI를 즉시 비운다. 이전 응답은 이전 UID journal의 operation에만 적용하고 새 인스턴스에는 전달하지 않는다. 오래된 auth session은 신규 송신을 시작하지 않는다. 로그아웃은 대기 변경을 flush/보관/내보내기/명시적 폐기 중 선택하는 기존 흐름을 유지한다.

Firestore persistentLocalCache는 지원을 탐지해 다중 탭 구성을 사용하고 실패는 cache unavailable로 노출한다. journal DB와 SDK cache는 독립이다. cache 삭제는 terminate→clearIndexedDbPersistence 순서와 다른 탭 실패를 처리하며 journal 초안을 먼저 선택 없이 지우지 않는다. 최초 오프라인/미인증은 빈 서버라고 표시하지 않는다. 오프라인 재실행에서 저장된 Auth UID가 복원되면 해당 UID의 cache/journal만 보여 주고 미확인 서버 상태를 표시한다.

## 9. 공개 repository·가져오기 계약의 정제

기존 04의 repository 인터페이스는 유지하되 다음 구현 메서드·타입 보완을 함께 적용한다. 공통 view/error/import 타입은 `src/domain/items.ts` 또는 공개 `src/lib/repository.ts`에서 export하고 UI가 내부 storage/contracts를 참조하지 않는다. worker 전용 ParsedImport/ImportOptions는 `src/features/import/contracts.ts`에서 export한다. Repository도 이를 `import type`으로 참조할 수 있으나 React 컴포넌트나 UI 코드는 import하지 않는다.

```ts
interface Repository {
  listItems(range: QueryRange): Promise<ItemView[]>;
  subscribeItems(range: QueryRange, onItems: (items: ItemView[]) => void): () => void;
  readItem(id: string): Promise<ItemView | null>;
  saveDraft(input: DraftInput): Promise<SaveResult>;
  resolveConflict(itemId: string, choice: ConflictChoice): Promise<SaveResult>;
  importIcs(file: File, options?: ImportOptions): Promise<ImportPreview>;
  updateImportPreview(previewId: string, edits: ImportCandidateEdit[]): Promise<ImportPreview>;
  commitIcsImport(previewId: string, decisions: ImportDecision[]): Promise<ImportResult>;
  readImportResult(previewId: string): Promise<ImportResult>;
  exportBackup(): Promise<BackupExport>;
  clearDeviceData(options: { discardPending: boolean }): Promise<DeviceDataClearResult>;
  flushPending(): Promise<void>;
  subscribeSyncState(onState: (state: SyncState) => void): () => void;
  dispose(): void;
}
```

- `ConflictChoice`는 기존 keep-remote/use-local/edit에 restore-as-new를 추가한다. 원격 tombstone에 일반 use-local/edit를 허용하지 않고 새 ID 복원을 명시적으로 선택하게 한다.
- `ItemView`에는 `snapshotSource: 'server'|'cache'|'none'`과 `localSequence: number|null`을 추가한다. 현재 서버 확인·캐시 여부와 local CAS에 필요한 값이지 별도 저장 모델이 아니다. `SyncState`는 기존 connection/localJournal/firestoreCache/pendingCount/conflictCount에 `localWriteInFlight: boolean`과 `error: RepositoryError|null`을 추가한다. provider는 PWA 업데이트 전에 이를 확인한다.
- `DeviceDataClearResult`는 `{status:'cleared'}` 또는 `{status:'blocked',reason:'pending'|'busy'|'other-tabs'}`다. dirty form은 화면에서 먼저 막고, pending/conflict가 있으면 기본 discardPending=false로 막는다. 사용자가 백업/폐기를 명시적으로 선택한 경우에만 true를 보낸다. repository가 송신·listener·worker를 멈추고 remote 조회 캐시를 정리한 뒤 현재 UID journal 레코드를 한 transaction으로 지운다. 다른 UID의 journal은 건드리지 않는다. Firestore 조회 캐시 정리는 origin 전체에 영향을 준다고 화면에 설명하며 다른 탭 때문에 실패하면 journal을 지우지 않는다. 캐시 정리 뒤 journal 실패는 오류로 보고하고 저장 성공을 표시하지 않는다. 완료 뒤 provider를 새 인스턴스로 복원하며 canonical 서버 문서는 삭제하지 않는다.
- `ImportOptions`는 `range: {fromDate:string;toDateExclusive:string}`와 `floatingTimeZone?:string`이다. 기본은 오늘부터6달력개월, 최대12달력개월; 범위는 시작 포함/끝 제외다. floating은 사용자에게 적용 시간대를 확인받기 전 commit 불가다. options가 없으면 기본 preview로 시작하고 범위/시간대 변경은 같은 파일로 다시 preview한다.
- `ImportCandidate`는 기존 key/uid/occurrenceKey/fingerprint/title/timing/existingItemId/revision에 primaryItemId/previewOverrides/relatedCopies/issues를 추가한다. disposition은 new/duplicate/changed-source/deleted-source/needs-input/error다. relatedCopies는 id/revision/deletedAt의 목록이며 덮어쓰기 비교 기준은 deterministic primary다. 일부 잘못된 파일/UID 시리즈는 item이 없을 수 있어 issue를 별도로 남긴다.
- `ImportCandidateEdit`는 candidateKey와 overrides다. override는 title, date event의 endDate, time event의 endLocalTime(date/clock/timeZone/foldChoice)만 허용한다. 자동 기본 마감/제목을 지어내지 않는다. `updateImportPreview`가 검증·변환하고 canonical/identity는 바꾸지 않는다. source fingerprint와 사용자가 보완한 값은 구분한다.
- `ImportPreview`는 기존 previewId/fileName/candidates/issues를 유지하고 기존 period를 `range: {fromDate:string;toDateExclusive:string}`로 대체한다. occurrenceCount/limitExceeded/seriesIssues를 추가한다. seriesIssues는 uid/code/affectedOccurrenceKeys/explanation을 보존한다. 2,001건 또는 worker budget 초과는 preview 전체 비커밋, unsupported/DST/mismatch는 해당 시리즈 비커밋이다. 유효한 독립 UID는 선택 가능하다.
- `ImportDecision.action`은 create/skip/keep-existing/replace/add-as-new다. keep-existing는 서버 write와 fingerprint 변경 없이 기존 항목을 유지하므로 다음 파일에서도 원본 차이가 다시 안내될 수 있다. 별도 “변경을 계속 무시” baseline 기능을 자동 추가하지 않는다. add-as-new의 clone ID/operation은 imports journal에 먼저 고정한다.
- `ImportResult`는 기존 created/skipped/replaced/addedAsNew/issues에 queued/conflicted/failed와 rowResults를 추가한다. rowResults는 candidateKey/action/itemId/operationId/status/issue를 가지며 status는 saved/queued/conflicted/failed/skipped다. confirmed count만 생성/교체 완료로 세고 queued는 동기화 대기다. sync 상태 변화 뒤 readImportResult로 최신 집계를 읽는다.

### ICS 실행 정책을 확정하는 제안

알려진 IANA TZID는 VTIMEZONE 유무 모두 해석한다. 없는 경우 RFC의 엄격한 교환 형식보다 넓은 제품 허용 확장이라고 기록한다. 포함된 IANA VTIMEZONE과 runtime zone의 선택 발생 offset이 다르면 해당 시리즈 오류다. unknown/custom TZID는 미지원이다. DST gap/fold/mismatch 시리즈는 같은 preview에서 강제로 “문제없음” 처리하지 않는다. **시리즈 제외 또는 원본 시간대/시각을 수정한 새 파일로 다시 preview**하도록 안내한다. 앱의 수동 시간 입력은 여전히 gap 오류/fold 후보 선택을 지원한다. 이 경계는 자동으로 시간을 이동하거나 복잡한 시리즈 편집 UI를 임의 추가하는 것을 피하기 위한 제안이다.

worker는 parser AST/recurrence/offset 검증과 fingerprint만 계산하고 저장소에 접근하지 않는다. 기본 실행 예산은 검사100,000회·벽시계5초다. 오래된 DTSTART/무한 recurrence가 예산을 넘으면 전체 비커밋 issue로 반환하고 cancel은 worker를 종료한다. 이는 `[구현 기본값 제안]`이며 실데이터 fixture의 처리량을 측정해 조정할 수 있으나 partial 2,000개만 성공으로 저장하지 않는다. 미리보기 occurrence2,000 한도는 파일 내 EXDATE/중복 발생 제거 후, 기존 DB duplicate를 제거하기 전에 센다.

## 11. 핵심 검증과 근거

자동 검증은 시간/DST 경계, indexedDB complete 전 실패, ACK 유실 뒤 다른 기기 수정, successor의 정확한 base, 동일 payload 탭 중복, 로컬 CAS 충돌, tombstone 복원, UID 늦은 응답을 포함한다. Emulator는 adapter happy path만이 아니라 클라이언트 validator를 우회한 공격형 write를 검사한다. Firefox/WebKit 엔진 테스트는 실제 iOS 설치·Google redirect·저장 eviction 확인을 대신하지 않는다.

| 출처 | 확인일·근거 유형 | 확인한 사실 / 적용한 판단 |
|---|---|---|
| [Firestore 트랜잭션](https://firebase.google.com/docs/firestore/manage-data/transactions) | 2026-10-03 · 공식 | callback 재실행·offline 실패·atomic write; journal과 UI side effect를 callback 밖에 둠 |
| [Rules 필드 검증](https://firebase.google.com/docs/firestore/security/rules-fields) | 2026-10-03 · 공식 | list/map 전체 원소 검증 shorthand 없음; 유한 슬롯 검증을 선택 |
| [Rules 구조·한도](https://firebase.google.com/docs/firestore/security/rules-structure) | 2026-10-03 · 공식 | 문서 접근·expression 제한; 최대 데이터 Emulator 검증 필요 |
| [IndexedDB 사용](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB) | 2026-10-03 · API 설명 | 요청·transaction 수명이 별개; complete 이후 저장 성공, upgrade 중 데이터 보존 |
| [Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API) | 2026-10-03 · API 설명 | 같은 origin의 작업 조율; 지원 여부와 무관한 멱등성 설계 |
| [Temporal polyfill metadata](https://raw.githubusercontent.com/js-temporal/temporal-polyfill/main/package.json) | 2026-10-03 · 공식 저장소 | ISC 라이선스·JSBI 의존성, 실제 선택 patch는 설치 때 검증 |
| [ESLint TS 설정](https://eslint.org/docs/latest/use/configure/configuration-files#typescript-configuration-files) | 2026-10-03 · 공식 | config도 .mts로 작성, Node에서 jiti2.2+ 또는 명시적 native TS flag 필요; dev jiti를 후보로 둠 |

위 문서는 기술 사실을 뒷받침한다. checklist 상한·retry 상한·정렬 tie·변환 정책은 이 제품의 설계 결정이며 공급자가 권장하거나 보장한 값이 아니다. checklist 상한은 아직 선택되지 않았다.
