# Task 4 구현 보고

작성: 2026-10-04 · 범위: IndexedDB journal / successor-safe sync / 공개 repository

## 결과와 범위

Task 4의 로컬 저장·동기화·공개 repository를 구현했다. 테스트 전용 실제 IndexedDB 에뮬레이션과 실제 Auth/Firestore Emulator를 각각 실행했다. 이 보고서 첫 작성 당시에는 checklist 20개 최대 payload의 Rules 평가가 표현식 한도에 도달했다. 이후 사용자가 단일 문서 내 안전한 상한 축소를 선택했고, 최대 4개/5개 거부 계약을 Rules에서 검증했다. 이후 전체 unit·Rules/통합·E2E도 통과했다. 당시 단계별 결과는 아래에 역사적 기록으로 유지한다. 최신 결과는 [구현 검증 보고](verification.md)를 기준으로 한다.

- native IndexedDB DB `student-tasks-journal` schema v1의 `drafts` / `heads` / `resolutions` / `imports`를 사용한다. primary key와 index는 모두 UID 범위를 포함한다. 저장/ACK/충돌 해결/삭제는 transaction complete 후에만 완료로 반환한다.
- queued 교체는 최초 base를 보존하고, sending payload는 고정한다. successor ACK는 predecessor receipt revision과 predecessor proposal에만 연결하며 새 operation/digest로 원자 교체한다. ACK 해시 계산 중의 편집도 CAS로 재확인한다.
- 재연결은 queued와 sending을 복구한다. 중복 전송은 같은 ID/digest로 receipt를 재확인한다. 미전송 create-delete는 로컬 취소하며 서버 write를 만들지 않는다.
- transient retry는 jitter를 적용한 1/2/4/8/16/30초 상한이고, background와 dispose에서는 새 송신/타이머를 멈춘다. permission/validation/integrity 오류는 자동 반복하지 않는다. Web Locks와 BroadcastChannel은 조율 수단이며 무결성은 IndexedDB CAS/서버 receipt에 둔다.
- 충돌에서 local/base/remote 판본을 보존한다. keep-remote/use-local/edit/restore-as-new를 제공한다. tombstone의 일반 use-local/edit는 거부하며 새 ID 복원은 원본 tombstone을 보존한다. 재충돌 해결 이력은 최종 확인까지 연결하고 기록을 자동 TTL로 지우지 않는다.
- UID 수명은 고정된 session/ports 인스턴스로 분리한다. dispose 후 늦은 ACK는 이전 UID journal만 정리하며 화면/새 UID에 전달하거나 successor를 송신하지 않는다. 브라우저 runtime이 journal 연결·채널을 닫아도 늦은 ACK는 해당 DB를 재열어 완료할 수 있다.
- 읽기/구독/백업에 canonical과 pending/provenance를 분리한다. journal write 실패는 서버 직접 저장으로 우회하지 않으며 로컬 입력과 sending row를 보존한다. ACK 쓰기 실패도 `localJournal: unavailable`로 노출한다.
- 기기 데이터 정리는 pending/busy/other-tabs를 보호한다. 원격 조회 캐시 정리 후 같은 UID의 journal 전체 snapshot을 한 transaction에서 CAS 재확인해 삭제하므로 다른 탭의 새 초안/가져오기 기록을 지우지 않는다. 다른 UID journal과 서버 canonical 문서는 보존한다. `failed-precondition`은 other-tabs로 구분하고 cache clear 실패 후 terminated SDK singleton을 재사용하지 않는다.
- reminder/notice 타입이나 저장소를 추가하지 않았다. startCountdown은 부모 proposal/checklist와 함께 보존한다.

## 의존성 검토와 계약 구체화

- `[ASSUMPTION] fake-indexeddb@6.2.5`를 테스트 전용 devDependency로 채택했다. native IndexedDB transaction complete/abort, 두 인스턴스 CAS, DB 재연결을 실행하는 데 필요하다. 메모리 Map으로 저널 재시작을 대체하지 않는다. 실행 계획에 명시된 dev 후보이며 production bundle에는 추가하지 않는다. production 의존성을 추가하지 않았다.
- `SaveResult`의 설계 스케치에 생략된 결과를 `stale-local {current,input}` / `cancelled {itemId}`로 명시했다. CAS 실패 입력과 미전송 삭제를 성공 canonical으로 위장하지 않기 위해 필요하다.
- `QueryRange`는 시작 날짜 포함 / 끝 날짜 제외로 해석하며 날짜 미정 task도 반환한다. 이 계약은 다음 화면/가져오기 구현에 전달했다.
- `JournalSnapshot.imports`와 `readImport/saveImport`를 준비했다. ICS 공개 import 메서드와 preview/행별 결과 집계는 실행 계획의 Task 7이 완성할 범위이며 이 task에서 가짜 성공 메서드를 만들지 않았다.

## 검증 증거

명령은 repository root에서 실행했다. pnpm의 비대화형 install 재확인을 위해 `CI=true`를 사용했다. Emulator는 기존 `/private/tmp/todolist-jdk21/Contents/Home`의 JDK21만 사용했으며 system Java/Node 설정은 변경하지 않았다.

| 명령 | 결과 |
|---|---|
| `CI=true pnpm add --save-dev --save-exact fake-indexeddb` | 설치 완료; production 의존성 변경 없음 |
| `CI=true pnpm test:unit tests/storage/journal.test.ts` (RED) | 미구현 journal에서 8건 실패 확인 후 구현·8건 GREEN |
| `CI=true pnpm test:unit tests/storage/sync.test.ts` (RED) | 미구현 sync에서 9건 실패 확인 후 구현; 추가 경계는 각각 RED→GREEN |
| `CI=true pnpm test:unit tests/storage/repository.test.ts` (RED) | 미구현 repository에서 16건 실패 확인 후 구현; 추가 경계는 각각 RED→GREEN |
| `CI=true pnpm test:unit tests/storage/firestore-cache.test.ts` (RED→GREEN) | other-tabs/terminated singleton 실패 2건 확인 뒤 3건 통과 |
| `CI=true pnpm test:unit tests/storage` (최종 집중 검증) | 4 files, 45 tests PASS |
| `CI=true JAVA_HOME=/private/tmp/todolist-jdk21/Contents/Home PATH="/private/tmp/todolist-jdk21/Contents/Home/bin:$PATH" pnpm exec firebase emulators:exec --project demo-todolist --only auth,firestore "pnpm test:rules tests/integration/two-clients-sync.test.ts"` | 4 tests PASS: 독립 기기 충돌/keep-remote, use-local/edit 재충돌, tombstone 새 ID 복원, 동일 operation 중복 송신 |
| 같은 Emulator env로 `pnpm exec firebase emulators:exec ... "pnpm test:rules"` | 71 PASS / 1 FAIL: checklist20 maximum payload만 실패 |
| `CI=true ... pnpm test` | 실행 시 동시 진행 중인 Task7 identity/parser RED 53건으로 unit 단계 중단; 101 PASS. Task4 regression으로 분류하지 않음; root가 Task7 GREEN 후 전체 재실행 |
| `CI=true pnpm typecheck` | 최종 전체 실행 PASS. 진행 중 관찰한 Task7 parser.ts:237 인수 오류는 담당에게 전달 후 해결됨 |
| `CI=true pnpm exec eslint src/lib/repository.ts src/lib/storage tests/storage tests/integration/two-clients-sync.test.ts` | PASS (Task4 오류/경고 없음) |
| `CI=true pnpm lint` | 최종 전체 실행 PASS (오류/경고 없음). 진행 중의 Task5/Task7 unused 경고는 해당 task에서 해결됨 |

핵심 검증 이름은 `two_tabs_stale_local`, `successor_keeps_predecessor_revision`, `late_ack_after_uid_switch`, `idb_abort_preserves_input`이다. 추가로 transaction request 성공 뒤 abort, ACK 해시 도중 successor 교체, 불변 payload digest, 30초 retry cap, background 정지, UID별 cache clear CAS, chain resolution 확인, teardown 이후 ACK, ACK 저널 오류/복구를 검증했다.

전체 검증 로그: `/private/tmp/todolist-task4-full-test.log`, `/private/tmp/todolist-task4-rules.log`, `/private/tmp/todolist-task4-integration.log`.

## 당시 남은 의존성과 후속 상태

1. **체크리스트 저장 결정 — 해결:** 사용자가 한 문서 저장과 안전한 상한 축소를 선택했다. 최대 4개를 저장하고 다섯 번째를 거부하며 Firestore Rules expression 한도를 지키도록 Task3에서 구현·검증했다.
2. **Task7 진행 중 — 해결:** 아래 appendix는 당시 ICS parser/identity RED 실행의 오류 이름을 그대로 보존한다. 이후 Task7 통합 구현과 전체 자동 검증을 완료했으며 현재 결과는 [Task 7 보고](task-7-report.md)와 [구현 검증 보고](verification.md)에 기록했다.
3. **실환경 검증 — 대기:** 자동 build·브라우저/PWA·E2E 확인은 완료했다. 실제 Firebase 프로젝트/Google OAuth와 iPhone 설치형 PWA, 백그라운드 복귀 확인만 실환경 의존 항목으로 남아 있다.

## 변경 파일

- `src/lib/storage/contracts.ts`: journal/ACK/resolution/import ports와 내부 결과.
- `src/lib/storage/journal.ts`: native IndexedDB journal.
- `src/lib/storage/sync.ts`: immutable digest preparation, successor, retry, sender lifetime.
- `src/lib/repository.ts`: 공개 mutation/read/subscribe/backup/clear boundary 및 공개 plain types.
- `src/lib/storage/firestore.ts`: cache clear other-tabs 분류와 terminated singleton 수명.
- `tests/storage/journal.test.ts`, `tests/storage/sync.test.ts`, `tests/storage/repository.test.ts`, `tests/storage/firestore-cache.test.ts`, `tests/storage/helpers.ts`.
- `tests/integration/two-clients-sync.test.ts`.
- `vitest.config.ts`: storage test 포함. 이후 다른 task의 include 확장은 그 task 변경이다.
- `package.json`, `pnpm-lock.yaml`: fake-indexeddb devDependency.
- `doc/implementation/task-4-report.md`: 이 보고서.

`.git`은 읽기 전용인 상태를 유지했으며 branch/commit/push/deploy를 하지 않았다.

## Appendix: 전체 test 실행 중 관찰한 Task7 RED

- `tests/import/identity.test.ts > stable source occurrence identity > stable_tzid_key encodes original TZID wall time without an instant or zone-rule version`
- `tests/import/identity.test.ts > stable source occurrence identity > uses canonical UTF-8 JSON array SHA-256 for primary IDs including Unicode`
- `tests/import/identity.test.ts > semantic component fingerprint > ignores line order, folding, newline style and unrelated timestamp changes`
- `tests/import/identity.test.ts > semantic component fingerprint > changes the source fingerprint for supported content changes while primary identity stays stable`
- `tests/import/parser.test.ts > ICS date, time, and preview repair > ICS-01 converts exclusive DATE DTEND with calendar arithmetic and keeps UTC/IANA instants`
- `tests/import/parser.test.ts > ICS date, time, and preview repair > preserves one-day DATE defaults without inventing a timed end or missing title`
- `tests/import/parser.test.ts > ICS date, time, and preview repair > requires a confirmed floating zone and records the choice in recurring identity`
- `tests/import/parser.test.ts > ICS date, time, and preview repair > rejects invalid event data without repair: DTSTART;VALUE=DATE:20260229`
- `tests/import/parser.test.ts > ICS date, time, and preview repair > rejects invalid event data without repair: DTSTART:20261003T090000+0900`
- `tests/import/parser.test.ts > ICS date, time, and preview repair > rejects invalid event data without repair: DTSTART:20261003T090000Z`
- `tests/import/parser.test.ts > ICS date, time, and preview repair > rejects invalid event data without repair: DTSTART;VALUE=DATE:20261003`
- `tests/import/parser.test.ts > ICS date, time, and preview repair > rejects invalid event data without repair: DTSTART;VALUE=DATE:20261003`
- `tests/import/parser.test.ts > ICS date, time, and preview repair > rejects invalid event data without repair: DTSTART;TZID=Mars/Olympus:20261003T090000`
- `tests/import/parser.test.ts > ICS date, time, and preview repair > rejects invalid event data without repair: DTSTART;VALUE=DATE:20261003`
- `tests/import/parser.test.ts > ICS date, time, and preview repair > reports missing UID, missing DTSTART, duplicate masters, and unsupported components explicitly`
- `tests/import/parser.test.ts > strict recurrence subset and set semantics > ICS-02 preserves COUNT before range filtering and EXDATE consumes its original slot`
- `tests/import/parser.test.ts > strict recurrence subset and set semantics > expands WEEKLY;BYDAY=MO,WE;COUNT=4 without clamping invalid dates`
- `tests/import/parser.test.ts > strict recurrence subset and set semantics > expands WEEKLY;INTERVAL=2;COUNT=3 without clamping invalid dates`
- `tests/import/parser.test.ts > strict recurrence subset and set semantics > expands MONTHLY;BYMONTHDAY=31;COUNT=4 without clamping invalid dates`
- `tests/import/parser.test.ts > strict recurrence subset and set semantics > expands MONTHLY;COUNT=3 without clamping invalid dates`
- `tests/import/parser.test.ts > strict recurrence subset and set semantics > expands YEARLY;BYMONTH=2;BYMONTHDAY=28;COUNT=2 without clamping invalid dates`
- `tests/import/parser.test.ts > strict recurrence subset and set semantics > expands DAILY;UNTIL=20260103 without clamping invalid dates`
- `tests/import/parser.test.ts > strict recurrence subset and set semantics > skips invalid leap-day years rather than moving February 29`
- `tests/import/parser.test.ts > strict recurrence subset and set semantics > uses inclusive UTC UNTIL and matching-source EXDATE for TZID recurrence`
- `tests/import/parser.test.ts > strict recurrence subset and set semantics > deduplicates BY lists and EXDATE values before the occurrence count`
- `tests/import/parser.test.ts > strict recurrence subset and set semantics > blocks the entire unsupported RRULE series: FREQ=HOURLY`
- `tests/import/parser.test.ts > strict recurrence subset and set semantics > blocks the entire unsupported RRULE series: FREQ=DAILY;BYDAY=MO`
- `tests/import/parser.test.ts > strict recurrence subset and set semantics > blocks the entire unsupported RRULE series: FREQ=WEEKLY;BYDAY=2MO`
- `tests/import/parser.test.ts > strict recurrence subset and set semantics > blocks the entire unsupported RRULE series: FREQ=MONTHLY;BYMONTHDAY=-1`
- `tests/import/parser.test.ts > strict recurrence subset and set semantics > blocks the entire unsupported RRULE series: FREQ=YEARLY;BYSETPOS=1`
- `tests/import/parser.test.ts > strict recurrence subset and set semantics > blocks the entire unsupported RRULE series: FREQ=DAILY;INTERVAL=0`
- `tests/import/parser.test.ts > strict recurrence subset and set semantics > blocks the entire unsupported RRULE series: FREQ=DAILY;COUNT=0`
- `tests/import/parser.test.ts > strict recurrence subset and set semantics > blocks the entire unsupported RRULE series: FREQ=DAILY;COUNT=2;UNTIL=20260103`
- `tests/import/parser.test.ts > strict recurrence subset and set semantics > blocks the entire unsupported RRULE series: FREQ=YEARLY;BYMONTH=13`
- `tests/import/parser.test.ts > strict recurrence subset and set semantics > blocks the entire unsupported RRULE series: FREQ=MONTHLY;BYMONTHDAY=32`
- `tests/import/parser.test.ts > strict recurrence subset and set semantics > blocks the entire unsupported RRULE series: FREQ=WEEKLY;WKST=SU`
- `tests/import/parser.test.ts > strict recurrence subset and set semantics > blocks the entire unsupported RRULE series: FREQ=DAILY;COUNT=1.5`
- `tests/import/parser.test.ts > strict recurrence subset and set semantics > blocks the entire unsupported RRULE series: FREQ=DAILY;COUNT=2;COUNT=3`
- `tests/import/parser.test.ts > strict recurrence subset and set semantics > never falls back to the master for an invalid recurrence set`
- `tests/import/parser.test.ts > strict recurrence subset and set semantics > never falls back to the master for an invalid recurrence set`
- `tests/import/parser.test.ts > strict recurrence subset and set semantics > never falls back to the master for an invalid recurrence set`
- `tests/import/parser.test.ts > strict recurrence subset and set semantics > invalidates all master occurrences when a cancelled exception shares its UID`
- `tests/import/parser.test.ts > timezone series policy > dst_series_issue reports affected wall keys and leaves independent series usable`
- `tests/import/parser.test.ts > timezone series policy > does not reject a series for DST ambiguity outside the selected range or excluded by EXDATE`
- `tests/import/parser.test.ts > timezone series policy > blocks known IANA series when embedded timezone offsets disagree`
- `tests/import/parser.test.ts > timezone series policy > accepts matching embedded IANA offsets and does not mistake transition RDATE for event RDATE`
- `tests/import/parser.test.ts > file, range, expansion, and cancellation limits > uses six calendar months from today and rejects ranges longer than twelve calendar months`
- `tests/import/parser.test.ts > file, range, expansion, and cancellation limits > enforces UTF-8 bytes with exactly 5 MiB accepted`
- `tests/import/parser.test.ts > file, range, expansion, and cancellation limits > accepts 2,000 unique candidates and makes 2,001 non-committable without a truncated saveable prefix`
- `tests/import/parser.test.ts > file, range, expansion, and cancellation limits > ends ancient unbounded recurrence with an expansion issue instead of silently skipping it`
- `tests/import/parser.test.ts > file, range, expansion, and cancellation limits > ends at the five-second wall-clock budget before returning candidates`
- `tests/import/parser.test.ts > file, range, expansion, and cancellation limits > aborts cancellation without returning a partial parsed import`
- `tests/import/parser.test.ts > file, range, expansion, and cancellation limits > makes malformed calendar syntax a file issue`
