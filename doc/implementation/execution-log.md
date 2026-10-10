# 구현 실행 기록

계획: [06-execution-plan.md](06-execution-plan.md) · 시작: 2026-10-03 Asia/Seoul

## 사전 판단

| 판단 | 근거 | 틀릴 때의 비용 |
|---|---|---|
| 현재 체크아웃에서 구현 | 사용자가 이 프로젝트 구현을 시작하라고 요청했다. 제공된 파일 권한은 `.git`을 읽기 전용으로 표시하며 로컬 브랜치 생성도 거부되었다. 사용자 문서와 기준을 같은 폴더에서 보존하고 소스 파일만 변경한다. | main에서 작업 중 별도 코드 분기가 필요해지면 문서·앱 변경을 보존해 분기 이전한다. |
| 원격 프로젝트 공개/배포는 하지 않는다 | 로컬 미리보기와 사용자 검토가 다음 요청이다. | 별도 공개 절차는 나중에 명시적으로 수행해야 한다. |
| Next.js 16 프로젝트를 저장소 안에 구성 | 사용자가 선택한 앱 방향과 Next/Firebase 구현 계획이다. Product Design 플러그인의 독립 Vite 미리보기 런타임은 실제 앱 구조를 대체하지 않는다. | 작은 시안 확인보다 setup이 길지만 최종 앱으로 이어지는 코드를 얻는다. |
| 초기 로컬 미리보기는 Firebase 운영 설정과 분리 | 현재 Firebase 프로젝트 자격 설정이 저장소에 없고 사용자가 서버로 먼저 화면을 보길 원한다. 개발 한정 preview fixture는 명시 배너와 분리된 경로로 제공하고 production에서는 켜지지 않게 한다. | 로컬 임시 데이터는 계정·서버 동기화가 되지 않아 preview 바깥으로 보존할 수 없다. |
| Rules·Emulator는 준비 가능한 즉시 실제 에뮬레이터에서 확인 | 로컬에는 Node 26.4.0/pnpm 11.19.0, Java Runtime 없음. Firebase emulator 테스트는 Java 실행환경이 필요하다. | JDK를 설치할 수 없으면 Rules Emulator 검증은 완료할 수 없다. |
| TDD는 어려운 범위만 | 사용자가 어려운 작업을 제외하고 TDD를 쓰지 말라고 지시했다. Task2·3·4·7의 시간 계산·동시성·ICS 반복/시간대·identity/retry 무결성 계약만 red/green; 다른 작업은 구현 후 필요한 흐름 검증. | ICS DST 오류와 반복 재시도 중복은 사용자 데이터 무결성 위험이므로 어려운 범위다. |
| 일반 구현은 현재 모델, 어려운 계약과 최종 통합 판단은 gpt-6.1-sol xhigh | 최신 모델 배정 요청. 도구는 `fast` 서비스 등급을 별도 인자로 받지 않는다. | 기본 모델 상속은 설정 가능한 동등 경로지만 빠른 서비스 등급은 적용할 수 없다. |

## 실행 결과

- Task1 scaffold: 구현 완료, 독립 read-only 리뷰 승인. static App Router 셸, 도메인 입력 계약, 임시 default-deny Rules와 focused tests를 구성했다. Firebase 설정은 공개 placeholder만 두었고 `.env.local`은 없다.
- `CI=true pnpm test`: 통과 — domain unit 8/8, Firestore Emulator Rules 2/2. 기본 sandbox는 localhost Emulator port bind에서 `EPERM`을 반환했지만 권한 검토 후 같은 `demo-todolist` Emulator 검증이 통과했다.
- `CI=true pnpm typecheck`, `CI=true pnpm lint`, `CI=true pnpm build`, `git diff --check`: 통과. 정적 build가 `/`, `/calendar`, `/settings`, `/tasks`를 생성했다.
- 독립 리뷰에서 app/feature의 저장소 우회 경로가 lint로 막히지 않는 점을 발견했다. `eslint.config.mts`에 Firebase SDK 전체와 내부 `src/lib/storage/**` 경로를 제한하고, modular/compat Firestore·Auth·sync/contracts/journal 상대 경로 probe가 모두 lint 오류로 막히는 것을 확인했다. 최종 lint와 diff whitespace 검사는 통과했고 리뷰는 승인됐다.
- 시스템 Node는 `v26.4.0`, shell pnpm은 `11.19.0`; pnpm launcher 자체 Node는 `v24.19.0`. 저장소는 `.node-version`에 `24.21.0`을 pin했다. 기본 system Java는 없으며, Emulator 확인에 Temurin JDK `21.0.12.1`을 `/private/tmp/todolist-jdk21`에 일시 준비했다. system Java 설정은 변경하지 않았다.
- ESLint 10과 현재 `eslint-plugin-react` 조합이 실행 중 API 오류를 내어 ESLint 9.39.5로 고정한 뒤 lint가 통과했다. pnpm의 lifecycle 허용 정책은 설치 오류를 막기 위해 `@firebase/util`, `protobufjs`, `re2`, `unrs-resolver`의 build script를 비활성으로 명시했다. 설치·Emulator 테스트·앱 build를 통과했으며 실제 앱 기능에서 해당 패키지 build가 필요한지는 각 기능 연결 때 검증한다.
- Task1 변경 commit은 `.git` 쓰기가 제한되어 수행하지 않았다. 원격 push·배포는 하지 않는다.
- Task2 시간/domain 구현: 독립 고난도 리뷰에서 추가 수정 발견 없이 승인됐다. TDD 의미 red는 48 failed / 23 passed, green은 71/71. 전체 Emulator 포함 테스트는 unit 71/71 + Rules 2/2, typecheck/lint 통과. DST 전날 알림의 gap/fold 원인 표시는 Task6 UI 계약으로 문서화했다.
- 사용자 범위 변경: 항목별 reminder rule, 전경 notice, notice 저장은 후속으로 미루고 시작 카운트다운 표시만 유지한다. 이에 따라 Task3에서 domain/wire/Rules의 reminders 필드와 reminder 전용 계산 코드·테스트를 제거했다. 체크리스트 상한은 이 시점에는 미결정이었으며, 2026-10-04의 갱신 기록과 아래 현재 작업 상태가 후속 결정을 반영한다.

## 작업 상태

| Task | 상태 | 검토/검증 |
|---|---|---|
| 1 정적 앱 기반과 도메인 계약 | 완료 | 독립 리뷰 승인, test 8+2, typecheck/lint/build 통과, TDD 없음 |
| 2 시간·projection·카운트다운 도메인 | 완료 | 독립 6.1 sol xhigh 리뷰 승인, 시간/projection 의미 red/green. reminder 코드·테스트는 사용자 범위 변경으로 후속 처리 |
| 3 Firestore Rules·receipt transaction | 구현·경계 검증 완료 | 최신 전체 실행은 unit 202/202, Rules 76/76; checklist 최대4개 전체 payload 통과·5개 거부 |
| 4 IndexedDB·sync·repository | 구현·통합 테스트 완료; 전체 Task4 독립 리뷰는 미수행 | 재시도 계획 격리·진행 중 동기화 후속 실행 경로는 별도 6.1 sol xhigh 검토 및 회귀 검증을 통과 |
| 5 Auth와 Figma 화면 | 구현·미리보기 확인 완료; 실 Firebase 로그인 대기 | 고정 샘플 홈 미리보기 브라우저 확인; `.env.local`/Google Auth는 미설정 |
| 6 입력·checklist·충돌 화면 | 기능 연결·자동 UI 수용 완료; 실계정 사용성 검증 대기 | CRUD/editor/checklist/conflict 흐름과 로컬 프리뷰 CRUD/재정렬 E2E 통과; Firebase 실계정은 미연결 |
| 7 ICS worker·파서·identity·import session | 구현·전체 자동 검증 완료 | [Task7 보고](task-7-report.md); 가져오기별 재시도 격리 및 in-flight 후속 재시도를 6.1 sol xhigh가 검토하고 통합 테스트 22/22로 확인 |
| 8 화면 카운트다운·PWA | 구현·build 완료; 실기기 복귀 확인 대기 | manifest/service worker와 update guard 구현, PWA tests 8/8, 실제 Chrome+Hosting Emulator에서 offline calendar 및 `/__/auth` fallback 동작 확인; 실제 iOS background/foreground 확인은 미실행 |
| 9 통합·QA·사용 안내 | 자동 검증·데스크톱 감사 완료; 실환경 확인 대기 | unit 202, Rules 76, typecheck, lint, static build, Chromium E2E 17 통과; Figma 1440×1024/390×844 및 TodoMate 1000×780 화면을 저장 |

## 2026-10-04 이어받기 기록

- 사용자는 **한 Firestore 문서 유지, 기간 checklist 최대4개**를 선택했다. 4개 모두 제목 200자, 부모의 제목/메모/분류/URL 등도 최대 길이인 쓰기를 create/update/tombstone으로 검증했다. 첫 검증은 expression 예산을 넘었고, 원인은 Rules가 허용 상한 이후의 5~20번째 슬롯도 조건 평가하던 것이었다. `validChecklist`는 허용하는 최대 4개까지만 검사하도록 줄였으며 동일 최대 payload가 통과했다. 상한을 5로 넘긴 쓰기는 거부된다.
- 실행 결과: `pnpm test` unit 172/172, Firestore Rules Emulator 76/76 통과. 순차 재실행한 `pnpm typecheck`, `pnpm lint`, `pnpm build`도 통과한다. 병렬로 실행한 최초 타입 검사는 build가 `.next/types`를 갱신하는 경합으로 실패했고, 순차 재실행에서 통과했다. 린트에서 `TasksRoute` render 중 clock 호출이 발견되어 클릭 핸들러 시점에 날짜를 계산하도록 수정했다.
- 개발 서버는 `http://127.0.0.1:3000/?preview=design`에서 실행 중이며 Codex 브라우저에 월간 홈 미리보기를 열었다. 고정 fixture는 읽기 전용이며 저장/동기화되지 않는다. 실 Firebase web config와 Google OAuth는 아직 설정되지 않았다.
- 구현 모델 배정은 사용자가 요청했지만, 지정한 `gpt-6.1-sol` 고난도 검토 두 건은 계정 사용량 제한으로 시작되지 않았다. 따라서 동기화/충돌/ICS의 새 독립 고난도 모델 리뷰를 통과했다고 주장하지 않는다.
- `2026-10-04` PWA 구현: `useForegroundClock`를 홈·캘린더에 연결했고 Next static build 뒤 TypeScript service worker와 versioned route/static precache를 생성한다. manifest, 192/512/Apple PNG icon, 명시적 update prompt도 연결했다. service worker는 `/__/`와 사용자 응답을 cache하지 않고 route별 offline navigation만 돌려준다. generator와 fetch 정책 모두 `/fonts/` 정적 경로를 지원한다.
- `2026-10-04` 최신 PWA 검증: 코드 변경 후 다시 실행한 `pnpm test` unit 180/180, Rules 76/76; PWA policy/precache focused tests 8/8, `pnpm typecheck`, `pnpm typecheck:sw`, `pnpm lint`, `pnpm build`, `git diff --check`가 통과했다. 실제 Google Chrome을 최신 build의 Firebase Hosting Emulator에 연결해 service worker 1개 등록 및 control, `/`, `/calendar/`, `/settings/`, `/tasks/`와 JS/CSS·아이콘·디자인 이미지·manifest 등 정적 항목 cache, 오프라인 `/calendar/` 직접 진입 200, 오프라인 `/__/auth/handler` network failure(홈 fallback 없음)를 다시 확인했다. 현재 build에 폰트 파일은 없어 `/fonts/` 응답은 별도로 캐시 관찰하지 않았다. Firebase 설정 안내 화면도 HTTP 200으로 보였다. iOS 설치형 PWA는 별도 실기기 검증이 필요하다.
- 월간 홈의 로컬 미리보기에서 Figma에 없는 Next.js 개발 표시가 좌하단에 노출되어 `devIndicators: false`로 숨겼다. 오류/컴파일 메시지는 표준 개발 서버에서 계속 확인할 수 있다. 390×844 화면을 다시 열어 표시가 제거되고 하단 아이콘·홈 콘텐츠가 유지됨을 눈으로 확인했다.
- Hosting smoke 중 `/private/tmp`에 둔 설정의 public path 기준이 달라 404가 났다. 프로젝트 루트의 일회성 `.firebase-hosting-smoke.json`에서 상대 `out` 경로를 사용하자 응답이 정상화됐다. 원인은 프로젝트 빌드 산출물이 아니라 외부 위치의 임시 config 기준 경로였으며 프로젝트 `firebase.json`은 수정하지 않았다.
- `2026-10-04` Task7 통합 완료: ICS worker-safe parser core, 미리보기/수정/선택/커밋, deterministic identity, current-UID 기록 재열기, CAS 기반 고정 plan과 operation ID retry, atomic ACK/error ledger, 결과 집계, JSON 백업을 연결했다. RED/GREEN 증거와 변경 경계는 [Task7 보고](task-7-report.md)에 상세히 남겼다. 최종 검증은 import 82/82, import+storage 128/128, 전체 unit 199/199, Rules/integration 76/76, typecheck/lint/build, diff check 통과다. live Firebase config와 인증이 없어 실제 인증된 import 화면 및 실제 worker 브라우저 smoke는 실행하지 않았다.
- 위 시점의 잔여 사항은 아래 최종 통합 결과에서 갱신했다.
- `2026-10-04` 최종 통합: 기존 전체 E2E 13개 흐름에 고정 design-preview viewport 캡처를 추가해 Chromium 14/14로 확인했다. 캡처는 [`verification.md`](verification.md)와 `assets/verification/`에 보관했다.
- `2026-10-04` 고난도 재시도 검토: `commitIcsImport(B)`가 별도 import A의 영구 실패를 무단 재시도하고, 진행 중인 automatic flush가 명시 재시도 요청을 버리는 두 경계를 실제 IndexedDB/repository로 재현했다. `SyncEngine.retryImport(previewId)`로 plan operation ID 범위만 허용하고 진행 중인 flush 이후에 journal을 다시 읽어 후속 처리하도록 수정했다. 리뷰 에이전트는 두 finding이 해결됐음을 확인했다. 새 회귀 테스트에서 import session 22/22가 통과한다.
- 최종 테스트: `pnpm test` unit 202/202 + Rules/integration 76/76; `pnpm typecheck`; `pnpm lint`; E2E 내부의 `pnpm build`/service-worker 검사; `pnpm test:e2e --project=chromium` 15/15가 모두 통과했다. 명령 재현과 실환경 한계는 [검증 보고](verification.md)를 참고한다.
- `2026-10-04` countdown UI 재개 검증: 정확 시각 기간의 countdown이 10분 경계에서 `00:10`에서 `09:59`로 바뀌고, 복귀 뒤 `00:01`까지 갱신된 다음 시작 순간 사라지는 것을 E2E로 확인했다. 전체 Chromium suite는 15/15다.
- 현재 개발 서버는 `http://127.0.0.1:3000/?preview=design`에 유지한다. 실제 `.env.local`/Firebase 프로젝트·Google OAuth가 없어 실제 cloud account는 연결하지 않았다. 실제 macOS↔iPhone 로그인·홈 화면 설치 및 앱 복귀 카운트다운 확인은 대기 중이다.

## 2026-10-05 데스크톱 프리뷰 감사·완료

- 사용자가 승인한 `product-design:audit` 흐름으로 변경 전/후 스크린샷을 저장했다. 화면은 1512×790 브라우저, TodoMate 창 기준 1000×780, 2000×1564 참고 viewport에서 확인했다. 결과와 각 측정치는 [UI 감사 문서](ui-audit/current-ui-audit.md)에 기록했다.
- 감사에서 찾은 Figma 대비 색 토큰 차이를 고쳤다(`#6E4DF5` 포인트 포함). 1512×790과 1000×780에서 문서 스크롤이 없고, 3개 기간 카드·날짜/할 일 영역·오버레이가 겹치거나 잘리지 않는 것을 확인했다. 예정 진행의 모호한 점 표식은 제거하고 날짜 일정 점을 7×7px로 키웠다.
- 로컬 preview 날짜 fixture가 정적 생성 날짜에 묶여 브라우저의 현재 날짜와 어긋나던 문제를 수정했다. 현재 `Asia/Seoul` 날짜에 맞춰 예시 날짜를 함께 옮기며, 사용자 선택 날짜와 fixture 날짜를 동기화한다.
- `?preview=design`은 Firebase 없이 localStorage에 할 일/기간 생성·수정·삭제·완료·순서, 개별 알림 시각과 전체 알림 설정을 보존한다. 체크 시 완료 그룹 아래로 이동하며, 네이티브 drag, 280ms press-and-hold 포인터 재정렬, 키보드 위/아래 이동을 지원한다. 기기 알림은 설정에서 켜고 기본 꺼짐이며 미리보기가 열려 있을 때만 확인한다.
- 사용자 기준에 맞춰 홈에는 기간 3개를 고정하고 초과 목록은 3열 오버레이로 표시한다. 미완료/완료 그룹 각각 안에서 순서를 바꿀 수 있도록 E2E 흐름을 확인했다.
- 최종 자동 검증: `pnpm test` unit 202/202, Firestore Rules 76/76; `pnpm typecheck`, `pnpm lint`, `pnpm build`; `pnpm test:e2e --project=chromium` 18/18 통과. E2E에는 preview CRUD/새로고침, 알림 default-off·저장·foreground 1회 전달, press-and-hold reorder, overlay와 체크 이동을 포함한다.
- 사용자 확인용 개발 서버는 `http://127.0.0.1:3001/?preview=design`에서 실행 중이다. Firebase 설정·실제 계정, 닫힌 앱 알림, iPhone 설치형 PWA와 macOS 앱 패키징은 이번 Firebase 제외 로컬 데스크톱 범위 밖이다.

## 2026-10-05 구성요소 구현 후속

- 승인된 데스크톱 화면 범위를 이어 구현했다. `ItemEditor`를 `DialogShell`, `DailyTaskFields`, `WindowPeriodFields`, `DeadlinePeriodFields`, `EventFields`, 공통 `ItemTimingFields`로 분리했다. 저장 중/저장 완료/저장 오류를 `LocalSaveStatus`로 분리했다. 다이얼로그에는 제목 최초 초점, Tab 순환, Escape, 변경 폐기 확인, 원래 초점 복귀를 붙였다.
- 기간 펼침 UI를 `PeriodOverflowOverlay`로 분리하고 3열·그림자·기존 화면 덮기·키보드 초점 처리를 유지했다. 기간 목록 제목에서 편집을 열 수 있게 연결했다. 주간 시간과 ICS 가져오기 다이얼로그에도 키보드 초점 경계를 보강했다.
- 날짜 미정 할 일에도 홈과 같은 완료/미완료 그룹 이동, 280ms 누름 재정렬, 그룹 간 이동 차단을 연결하고 로컬 순서를 저장한다. 해당 경계에 unit test 4개를 추가했다.
- `pnpm test:unit`: 16개 파일, 213개 테스트 통과. `pnpm typecheck`, `pnpm lint`, `pnpm build`, `git diff --check` 통과. `pnpm test` 재실행은 unit 213개 뒤 Firebase Emulator가 `java -version`에서 종료됐다. 현재 환경에 Java Runtime이 없어 Rules 76개 검증은 수행되지 않았다.
- UI 감사와 C-01–C-33 동작 표를 [09 UI 감사·구성요소 동작](09-ui-audit-and-component-behavior.md)으로 정리했다. 오래된 `*-after.png`를 최신 화면 증거로 쓰지 않도록 [검증 보고](verification.md)와 [컴포넌트 매핑](component-mapping.md)에 명시했다.
- 기준 CSS는 1000×780 window 안에 최대 840×780 앱 프레임을 가운데 둔다. 하단 아이콘 hit target은 44px로 맞추고 비활성 홈 아이콘은 중립화했다.
- 최신 캡처와 사용자 Figma 직접 수정은 남아 있다. Figma 쓰기와 앱 화면 열기를 요청한 도구 호출은 자동 검토에서 선택된 모델의 용량 문제로 거부되어 변경/열기가 실행되지 않았다. 기존 캡처·다른 브라우저·Playwright·CDP를 사용해 우회하지 않았다.
- `pnpm dev --port 3001` 기본 실행은 sandbox port bind `EPERM`, 승인된 로컬 시작은 `EADDRINUSE`를 반환했다. 포트 3001은 사용 중이며 sandbox에서 HTTP 응답/현재 픽셀 상태를 검증하지 못했다. UI를 직접 열어 최신 capture를 저장하는 검수 단계는 미완료다.
