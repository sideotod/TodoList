# Task 7 — 통합 ICS 가져오기·재시도·JSON 구현 보고

검증일: 2026-10-04 (Asia/Seoul). 이전 격리 parser TDD 증거는 `task-7-parser-report.md`에 유지한다. 이 보고서는 이어서 구현한 repository/journal/UI 통합과 최신 검증을 기록한다.

## 변경 파일과 경계

- `src/features/import/session.ts`: 저장된 세션 검증, source와 사용자 보완값 분리, deterministic primary/clone/tombstone 분류, 도메인 검증, 행별 최신 집계.
- `src/features/import/ImportPreview.tsx`, `ImportPreview.module.css`: 파일·발생 기간·확인된 floating zone, 파일/시리즈 오류, 원본 비교와 복사본 안내, 제목·종료 입력 보완, 명시적 행 체크/동작 선택, 부분 결과 및 같은 계획 재시도. 제목만 보완하면 기존 종료 초·instant를 재작성하지 않는다.
- `src/features/import/ImportControls.tsx`: 캘린더의 가져오기/기록 재열기와 설정의 현재 UID JSON 백업 다운로드.
- `src/lib/repository.ts`: `importIcs`, `updateImportPreview`, `commitIcsImport`, `readImportResult` 공개 구현과 타입. `listImportPreviews`는 재시작 뒤 durable 계획을 다시 여는 read-only 조회다. file bytes를 journal에 남기지 않고 파싱 결과/선택/계획을 저장한다. clear/dispose는 진행 중인 worker를 중단한다.
- `src/lib/storage/contracts.ts`, `journal.ts`: import record version CAS, 계획 operation ID 고정 후 atomic queue, ACK와 draft 제거를 같은 transaction으로 저장, per-operation 오류, conflict resolution과 replacement ACK 연결. 다른 UID 기록은 접근하거나 지우지 않는다.
- `src/lib/storage/sync.ts`: 원격 작업 오류를 해당 import journal에 기록하여 부분 실패가 reload 뒤에도 유지되게 한다.
- `src/features/import/parser-core.ts`, `parser.ts`, `ics.worker.ts`: 파싱 코어를 Worker 생성자와 분리했다. worker→parser→worker 순환으로 production compile이 멈춘 것을 해소하며 기존 parser.ts 공개 API와 parsing policy는 유지한다.
- `src/features/routes/CalendarRoute.tsx`, `ProfileRoute.tsx`: 각각 ImportControls, BackupControls mount/import만 추가했다. 기존 design preview, Figma 화면/CSS는 바꾸지 않았다.
- `tests/import/import-session.test.ts`: 실제 fake IndexedDB와 repository/sync, 외부 원격 fixture로 19개 세션 무결성 테스트.

reminder rule/notice/UI/필드, Task 8/PWA 소스, auth, domain item, package manifest/installed dependency tree는 수정하지 않았다. `.git`은 읽기만 했으며 commit/push를 하지 않았다. 기존 `pnpm build`의 PWA artifact 생성은 실행했지만 해당 구현은 변경하지 않았다.

## 데이터 보존과 재시도 계약

1. 미리보기는 현재 UID imports journal에 저장된 뒤 반환한다. title/end 보완은 source UID/occurrence key/fingerprint/start를 바꾸지 않는다. 잘못된 보완값과 DST fold 미선택은 `needs-input`으로 남긴다.
2. deterministic primary만 덮어쓰기 기준으로 삼는다. 동일 source의 다른 ID는 relatedCopies로 표시한다. tombstone은 기본 선택하지 않으며 create/replace로 되살리지 않는다. 명시적 add-as-new만 새 ID로 추가한다. keep-existing은 서버 write/fingerprint 변경을 하지 않는다.
3. UI는 어떤 행도 자동으로 체크하지 않는다. create/keep/replace/add-as-new와 나머지 skip을 포함한 전체 계획을 journal version CAS로 먼저 확정한 뒤, 고정된 clone ID/operation ID/digest를 queue에 넣는다. 두 탭이 동시에 확정하면 한 계획으로 수렴한다. 확정 후 선택/보완 변경은 거부하고 새 preview를 요구한다.
4. 기존 canonical 기준 snapshot/revision을 미리보기 때 보존한다. replace 직전 원격 revision/tombstone이 달라졌으면 그 기준으로 conflict를 만들며 최신 내용으로 조용히 rebase하지 않는다. 기존 기기 초안이 있으면 덮어쓰지 않는다. kind 변경 뒤 체크리스트가 있으면 해당 replace 행만 실패하고 자료를 보존한다.
5. 서버 ACK는 해당 draft 제거와 같은 IndexedDB transaction에서 import record에 보존한다. 다음 원격 수정으로 lastMutationId가 바뀌어도 성공 기록은 유지한다. ACK 유실/queue 전 실패/부분 실패/reload/동시 재시도에서 같은 ID와 digest를 사용한다. confirmed 행을 다시 보내거나 revision을 중복 생성하지 않는다.
6. 충돌 해결로 keep-remote를 선택하면 가져오기 행은 건너뜀으로 집계하고 이전 operation을 되살리지 않는다. use-local/edit/restore replacement는 import record에 연결하여 해당 ACK를 집계한다. 명시적인 conflict resolution에서 새 operation을 만드는 것은 원래 import 재시도의 operation 변경과 구분한다.
7. saved receipt만 created/replaced/addedAsNew 완료로 센다. queued/conflicted/failed/skipped를 별도로 표시하고 rowResults 합계가 전체 행 수와 일치한다. sync 상태 변경 뒤 readImportResult로 갱신한다. journal 실패 뒤 원격 직접 쓰기로 우회하지 않는다.
8. 손상된 세션/identity/proposal/digest는 integrity 오류로 보존하며 이전 digest 아래 바뀐 내용으로 다시 보내지 않는다. JSON은 현재 UID의 canonicalItems와 pendingLocalChanges를 분리하고 canonicalSource=server/cache를 명시한다.
9. 기존 parser의 strict RRULE, whole-series 오류, exclusive DATE DTEND, known IANA/unknown/floating/DST/VTIMEZONE 정책, 5 MiB/2,000/100,000 steps/5초 및 cancellation은 그대로 적용한다. 범위의 source calendar date 해석은 이전 보고서에 기록한 core 계약에서의 설계 추론을 유지한다.

## TDD와 실행 증거

명령은 root에서 실행했다. `CI=true`와 command-scoped `--config.verifyDepsBeforeRun=false`는 설치된 runtime/dependency tree를 유지하면서 pnpm의 비대화형 설치 확인을 피한다. 현재 shell Node 26.4.0과 `.node-version` 24.21.0 차이는 그대로다. JDK 21은 기존 `/private/tmp/todolist-jdk21/Contents/Home`을 사용했다.

| 검증/cycle | 실제 결과 |
|---|---|
| 세션 최초 RED: `CI=true pnpm --config.verifyDepsBeforeRun=false test:unit tests/import/import-session.test.ts` | 10 FAIL. 미구현 repository import methods의 `ICS import not implemented`를 확인한 뒤 구현했다. |
| 첫 구현 | 9 PASS / 1 FAIL. online clone의 실제 confirmed 결과를 offline queued로 기대한 fixture를 고쳤다. 서버 확인된 성공을 대기로 강제하지 않았다. |
| conflict-resolution RED | 기존 10 PASS / 새 2 FAIL. keep-remote와 use-local ACK 뒤 row가 failed로 집계되는 경계를 확인했다. 연결 후 12 PASS. |
| 손상 계획 RED | 기존 17 PASS / 새 1 FAIL. altered proposal 아래 동일 digest 계획이 거부되지 않았다. source/proposal/digest 검증 후 GREEN. |
| checklist 보존 RED | 기존 18 PASS / 새 1 FAIL. kind 전환 체크리스트 validation이 전체 commit을 throw했다. 개별 행 failed로 보존하도록 수정했다. |
| 최종 import focused: `CI=true pnpm --config.verifyDepsBeforeRun=false test:unit tests/import` | 4 files / 82 PASS. |
| 최종 import+storage focused: 같은 명령 끝에 `tests/import tests/storage` | 8 files / 128 PASS. |
| 최종 전체 `pnpm test` (아래 명령) | unit 14 files / 199 PASS + Rules/integration 5 files / 76 PASS, exit 0. |
| 최종 `CI=true pnpm --config.verifyDepsBeforeRun=false typecheck` | PASS, exit 0. |
| 최종 `CI=true pnpm --config.verifyDepsBeforeRun=false lint` | PASS, exit 0, warning 없음. |
| 최종 `CI=true pnpm --config.verifyDepsBeforeRun=false build` | PASS. Next.js static routes와 service-worker typecheck/generation 완료. |
| `git diff --check` | PASS. |

전체 test 명령:

```sh
CI=true JAVA_HOME=/private/tmp/todolist-jdk21/Contents/Home PATH="/private/tmp/todolist-jdk21/Contents/Home/bin:$PATH" pnpm --config.verifyDepsBeforeRun=false test
```

Emulator의 localhost bind에는 승인된 실행 escalation을 사용했다. 최초 두 build는 compile stage에서 멈췄으며 해당 작업의 build process만 종료했다. worker 순환을 분리하는 과정에서 중복 export 문법 오류를 확인해 고쳤고, 이후 focused tests/build를 다시 통과시켰다. 순환 분리 뒤 compile은 약 1.2초에 완료되었다. 정상 테스트와 build 성공을 앞선 실패와 섞어서 주장하지 않는다.

## 2026-10-04 통합 QA 후속 수정

최종 동기화 검토에서 두 가져오기 계획 사이의 재시도 격리 결함이 확인됐다. 가져오기 B의 커밋이 전역 수동 sync를 호출하면서 영구 실패한 A를 다시 보낼 수 있었고, 이미 실행 중인 자동 sync가 있으면 명시적 재시도 요청이 사라질 수 있었다.

- `SyncEngine.retryImport(previewId)`를 추가해 IndexedDB에 보존된 해당 계획의 `operationIds`만 재시도할 수 있게 했다. 자동·일반 동기화는 영구 실패 ICS operation을 계속 건너뛴다.
- 같은 계획 재시도 중 sync가 이미 실행 중이면 완료를 기다린 뒤 journal을 다시 읽어 해당 계획만 처리한다. 다른 일반 변경은 기존 자동 동기화 경로에 남긴다.
- RED/GREEN 회귀 검증: 두 번째 preview를 커밋해도 첫 preview의 영구 실패가 재전송되지 않음, 첫 preview의 명시 재시도가 다른 operation이 실행 중일 때 대기 후 성공함을 실제 IndexedDB journal/repository와 remote fixture로 확인했다. `tests/import/import-session.test.ts` 22/22 통과.
- 최신 전체 자동 검증: unit 202/202, Firestore Rules/integration 76/76, typecheck, lint, production static build, Chromium E2E 15/15 통과. 자세한 사용자 흐름/화면 캡처는 [검증 보고](verification.md)에 기록했다.

## 남은 검증 한계

- 현재 workspace에는 `.env.local`과 인증된 Emulator/browser host가 없다. Chrome의 `/calendar/`가 Firebase 설정 안내를 표시하는 것을 확인했다. root 지시에 따라 authenticated ImportPreview UI/실제 browser worker 실행·취소·모바일 layout 및 JSON download smoke는 제외했다. 디자인 미리보기 탭은 변경하지 않았다.
- worker transport focused 테스트는 browser double로 실제 parser를 실행한다. production module worker chunk의 build는 통과했으나 인증된 실제 화면에서의 실행 확인을 대신하지 않는다.
- repository/journal 19개 세션 테스트는 real fake IndexedDB와 injected remote boundary를 사용한다. 전체 suite의 실제 Firebase Rules/integration 76개가 통과하지만 이 보고서는 새 ICS UI의 live-account E2E나 iOS installed PWA 검증을 주장하지 않는다.
- 알려진 IANA tzdb 규칙에 의존하는 해석, source calendar date로 range를 거르는 설계 추론, 문서에 명시된 strict V1 subset은 유지한다. unsupported 시리즈를 변환해 우회하는 UI는 추가하지 않았다.
