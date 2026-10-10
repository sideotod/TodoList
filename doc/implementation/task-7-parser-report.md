# Task 7 — ICS parser·identity·worker 격리 구현 보고

> 이 보고서는 Task 7 중 parser/identity/worker 선행 범위의 당시 상태 기록이다. 후속 repository/import UI 통합까지 완료했으며 현재 전체 검증 상태는 [통합 보고](task-7-report.md)와 [검증 보고](verification.md)를 기준으로 한다.

검증일: 2026-10-04 (Asia/Seoul)
범위: Task 7 중 브라우저 ICS parse/identity/worker core와 집중 테스트. 이 보고서는 전체 Task 7의 완료를 주장하지 않는다.

## 구현한 파일과 경계

- `src/features/import/contracts.ts`: 도메인의 `ImportSource`, `ProposedEventItem['timing']`을 재사용하는 worker 전용 `ImportOptions`, `ParsedImport`, candidate/issue/message 계약.
- `src/features/import/parser.ts`: 원본 preflight, 엄격한 recurrence subset, 날짜·시간대 변환, 시리즈 오류, 파일/발생/작업 예산, `parseIcsFileInWorker`.
- `src/features/import/identity.ts`: 원본 source occurrence key와 UTF-8 JSON 배열 SHA-256 deterministic primary ID.
- `src/features/import/ics.worker.ts`: 파일 원문과 options를 받아 parser 결과를 반환하는 브라우저 module worker 진입점.
- `tests/import/parser.test.ts`, `identity.test.ts`, `worker.test.ts`: 63개 집중 테스트.
- `tests/fixtures/ics/basic.ics`, `dst-series.ics`, `timezone-mismatch.ics`, `exception.ics`: 원문 fixture.
- `vitest.config.ts`: root가 승인한 include 한 줄에 `tests/import/**/*.test.ts`를 추가했다. 기존 단위 테스트 명령이 import 계약을 실제 실행한다.

repository, IndexedDB/storage, domain item, auth, route, shell, package manifest는 수정하지 않았다. 새 의존성, reminder rule/notice/UI/필드를 추가하지 않았다. `.git`은 읽기만 했으며 commit/push를 하지 않았다.

## 유지한 데이터 무결성 계약

1. DATE DTEND를 24시간 밀리초 계산이 아닌 달력 날짜 계산으로 포함 종료일에 변환한다. 종료 없는 DATE는 하루짜리다. SUMMARY 또는 timed DTEND가 없으면 임의 제목/종료를 만들지 않고 `needs-input`으로 반환한다. timed end repair를 위해 유효한 원본 시작값을 `candidate.start`에 보존한다.
2. UTC는 millisecond precision ISO instant, known IANA TZID는 current runtime IANA 규칙으로 해석한다. floating은 `floatingTimeZone`의 명시적인 확인 없이는 series issue다. custom/unknown TZID에 기기 zone이나 고정 offset을 대입하지 않는다.
3. 선택 범위의 DST gap/fold, embedded VTIMEZONE/runtime IANA offset 불일치는 affected original wall occurrence key와 설명을 남기고 해당 UID 전체를 후보에서 제외한다. EXDATE로 제외되었거나 선택 범위 밖인 occurrence의 DST 문제는 선택 범위의 다른 발생을 막지 않는다. 빈 embedded VTIMEZONE은 검증된 UTC 정의로 간주하지 않는다.
4. DAILY, WEEKLY plain BYDAY, MONTHLY positive BYMONTHDAY, YEARLY BYMONTH/BYMONTHDAY만 허용한다. 양수 INTERVAL, COUNT 또는 type-compatible inclusive UNTIL을 지원한다. ordinal BYDAY/BYSETPOS/WKST/기타 BY 부분, 중복 RRULE/part, RDATE, DURATION, RECURRENCE-ID 예외는 해당 시리즈 오류다. DTSTART가 규칙과 맞지 않거나 UNTIL이 DTSTART보다 앞서는 경우를 추측해서 복구하지 않는다.
5. COUNT는 원본 DTSTART부터 소비하고 EXDATE 이전 발생 슬롯을 다시 채우지 않는다. BY 목록·EXDATE는 set으로 처리하며 2/29, 31일의 없는 날짜를 clamp하지 않는다.
6. timed DTEND는 원본 시작·종료 사이의 **exact duration**을 모든 recurrence에 적용한다. DST를 건널 때 원본 wall-clock end를 반복해서 duration을 바꾸지 않는다. 이는 [RFC 5545 §3.8.5.3](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.8.5.3)의 의미에 따른다. 시간형 DTSTART/DTEND의 원본 표현이 서로 달라도(예: TZID 시작, UTC 종료) 두 instant로 길이를 검증한다.
7. single 또는 `DATE:…`, `UTC:…`, `TZID=<original zone>:<original wall time>`, `FLOAT=<confirmed zone>:<wall time>` key를 사용한다. primary ID는 `ics_${sha256(JSON.stringify([uid, occurrenceKey]))}`다. TZID key에 해석된 instant/tzdb 버전/locale 문자열을 넣지 않는다. fingerprint는 지원 원본 필드, 정규화한 RRULE/EXDATE와 관련 timezone 정의만 포함하며 줄 순서/접힘/CRLF/DTSTAMP에 영향받지 않는다.
8. 브라우저 File.size와 parser UTF-8 byte 한도는 5 MiB(정확한 경계 허용)다. 기본은 Seoul의 오늘부터 6달력개월이며 범위는 시작 포함·끝 제외, 최대 12달력개월이다. EXDATE/set 처리 후 파일 전체 2,001번째 occurrence를 발견하면 전체 결과를 비커밋으로 전환하고 저장 가능한 2,000건 prefix를 반환하지 않는다.
9. 최대 100,000개의 expansion 검사를 수행한다. parser의 5초 실행 검사와 main-thread의 5초 worker watchdog을 함께 둔다. 예산 초과는 전체 후보를 비우는 `expansion-budget-exceeded`이며, 취소는 worker terminate와 AbortError로 끝나므로 부분 결과를 반환하지 않는다. worker의 동기 iterator가 응답하지 않아도 main thread에서 종료할 수 있다. oversized File은 읽기/worker 시작 전에 차단한다.
10. ical.js가 일부 invalid DATE/RRULE에 대해 AST 반환 전에 예외를 던지는 경계를 확인했다. VEVENT의 원본 값은 보존해서 자체 검증하고, 라이브러리에는 안전한 값/parameter AST만 파싱하게 하므로 분리 가능한 invalid UID가 정상적인 다른 UID를 파일 전체 오류로 만들지 않는다. 구조가 깨진 파일은 별도의 전체 파일 오류다.

`committable`은 파일 전체를 막는 한도/구조 오류 여부다. 개별 `needs-input` candidate나 `seriesIssues`의 저장 허용을 뜻하지 않는다. downstream repository는 유효한 candidate만 결정 대상으로 삼아야 한다. `occurrenceCount`는 지원 규칙을 확장하고 범위·EXDATE·set을 적용한 고유 발생 수이며, 선택 범위 timezone issue로 시리즈 전체가 제외되어도 작업/발생 한도 계산에서는 해당 발생을 보존한다.

## 범위 해석 — 설계 추론 기록

현재 authoritative `04-core-implementation.md`의 ImportOptions.range에는 `{fromDate,toDateExclusive}`만 있고, 이전 조사 API sketch의 `previewTimeZone`은 없다. root의 지시를 따라 DATE 값, TZID/floating 원본 wall date, UTC 원본 UTC date를 선택 범위의 달력 날짜로 사용했다. 기본 오늘 계산과 DATE 저장 zone은 제품 기본값 Asia/Seoul이다. 이 선택은 현재 계약에서 도출한 **설계 추론**이며 사용자 display zone에서의 visible range 의미를 새 필드로 추측해 추가하지 않았다.

## TDD와 실행 증거

명령은 repository root에서 실행했다. pnpm의 자동 의존성 확인이 비대화형 modules purge를 요청하는 것을 피하기 위해 `--config.verifyDepsBeforeRun=false`를 명령에만 사용했고 `CI=true`를 함께 적용했다. 설치된 dependency tree나 시스템 runtime 설정은 바꾸지 않았다. 현재 shell Node는 26.4.0이며 `.node-version` pin 24.21.0과의 환경 차이는 유지한다.

아래 표의 focused 명령은 `CI=true pnpm --config.verifyDepsBeforeRun=false test:unit tests/import`이며 parser만 실행한 두 cycle은 끝에 `tests/import/parser.test.ts`를 사용했다.

| 실행/cycle | 실제 결과 |
|---|---|
| 최초 `pnpm test:unit tests/import` | Vitest 전에 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` 발생. production 구현은 하지 않은 상태였다. |
| 자동 dependency check를 끈 최초 focused | parser module 미존재 suite error. 테스트를 쓴 뒤 빈 export scaffold를 추가해 assertion-level RED로 바꿨다. |
| parser/identity 최초 assertion-level RED | 2 files / 53 FAIL. 빈 candidates, 빈 stable key, 빈 deterministic hash가 literal 기대값을 만족하지 못했다. |
| 첫 parser 구현 focused | 50 PASS / 3 FAIL. numeric offset 날짜와 library가 거부하는 BYMONTH/BYMONTHDAY가 UID issue로 격리되지 않았다. |
| raw invalid-series 격리·exact-duration·mixed end 표현 테스트 추가 RED | parser 46 PASS / 6 FAIL. independent UID가 사라지는 결과, DST 뒤 종료가 1시간 늦어진 결과, 혼합 UTC/TZID를 거부하는 결과를 확인했다. |
| 해당 수정 후 focused GREEN | 2 files / 56 PASS. |
| worker 및 end-repair 계약 RED | 54 PASS / 7 FAIL. 미구현 worker 5건, start metadata 1건과 strengthened 5 MiB fixture 1건. 마지막 fixture는 calendar 종료 뒤 공백이 fold로 읽힌 부적합 fixture였으므로 valid DESCRIPTION padding으로 고쳤다. |
| worker/start 구현 후 focused GREEN | 3 files / 61 PASS, unhandled rejection 없음. |
| UNTIL-before-DTSTART·empty VTIMEZONE RED | parser 52 PASS / 2 FAIL. 원본 첫 occurrence가 조용히 사라지고 빈 timezone이 확인된 정의로 취급됨을 확인했다. |
| 마지막 focused GREEN | **3 files / 63 PASS**. |
| `CI=true pnpm --config.verifyDepsBeforeRun=false typecheck` | 첫 parser 구현 후 PASS. 중간 실행은 동시 ItemEditor의 unscheduled timeZone/completion 오류로 FAIL했으나 마지막 실행은 **PASS**. import 관련 TypeScript 오류는 없다. |
| `CI=true pnpm --config.verifyDepsBeforeRun=false lint` | **exit 0**. ItemEditor metadata destructuring의 unused 변수 5개 warning만 존재한다. import 파일 경고/오류는 없다. |
| JDK 없는 최초 `CI=true … pnpm test` | unit **169 PASS** 후 Java Runtime 없음으로 Emulator 시작 실패. |
| 기존 temporary JDK를 지정한 sandbox `pnpm test` | unit **169 PASS**, 이후 Emulator localhost port bind `EPERM`으로 시작 실패. |
| 동일 명령의 승인된 port escalation 재실행 | unit **10 files / 169 PASS**, Rules/integration **71 PASS / 1 FAIL (72건)**. 아래 기존 checklist 실패 때문에 전체 명령 exit 1. |

최종 전체 명령:

```sh
CI=true JAVA_HOME=/private/tmp/todolist-jdk21/Contents/Home PATH="/private/tmp/todolist-jdk21/Contents/Home/bin:$PATH" pnpm --config.verifyDepsBeforeRun=false test
```

전체 test의 유일한 실패:

```text
tests/rules/items.test.ts > canonical item Rules > accepts 20 checklist rows with complex timing and start countdown
FirebaseError: PERMISSION_DENIED — maximum of 1000 expressions to evaluate has been reached
```

이는 Task3/Task4 보고에 이미 남아 있는 checklist 20행 최대 payload Rules 한도 문제다. 이 parser scope에서 Firestore Rules/도메인 checklist 상한을 수정하지 않았다. 이 실패를 숨기거나 전체 `pnpm test`가 통과했다고 표시하지 않는다.

## 통합에서 이어갈 일

- repository의 ImportPreview/Decision/Result 공개 타입과 parser candidate를 연결한다. `needs-input` title/end repair는 source fingerprint/key와 별도로 저장·검증한다.
- deterministic primary lookup, related clone 표시, tombstone default skip, replace revision conflict, clone ID/operation ID journal 고정 및 부분 성공 재시도는 repository/IndexedDB integration의 후속 범위다. 이번 primary hash 검증만으로 이 계약들이 구현되었다고 주장하지 않는다.
- JSON backup, 실제 `/calendar`의 worker preview/행 선택/저장, `/settings` export 연결은 후속 범위다.
- worker client의 단위 테스트는 Node에서 실제 parser를 실행하는 browser transport double을 사용한다. 실제 Next.js 번들의 module worker 실행과 브라우저 UI 취소는 연결한 화면에서 integration/browser 검증해야 한다.
- build는 이 격리 scope에서 별도로 실행하지 않았다. 실제 import를 연결한 route bundle의 build/browser 검증은 root 통합에서 수행한다.
