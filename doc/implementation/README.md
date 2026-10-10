# 구현 준비 문서

작성·조사 기준: 2026-10-03 · Asia/Seoul

사용자가 편집한 흰 배경 Figma를 구현 기준으로 삼는다. 제품 방향은 승인된 상태이며, 이 폴더는 구현 파일·인터페이스·실패 처리·작업 순서를 기록한다. 현재 checkout에는 Next.js 정적 PWA 셸, 주요 화면, 로컬 데스크톱 프리뷰, 도메인·Rules·저장 경계, CRUD, ICS 미리보기/가져오기·JSON 백업이 구현되어 있다. 과거의 자동 검증과 캡처는 기록으로 보존하지만 최신 UI 수정 뒤의 실행·시각 검수와 혼동하지 않는다. 현재 코드별 감사와 동작은 [09 UI 감사·구성요소 동작](09-ui-audit-and-component-behavior.md), 검증 증거는 [검증 결과와 화면 비교](verification.md)를 참고한다.

## 읽기 순서

| 순서 | 문서 | 목적 |
|---|---|---|
| 1 | [전체 구현 설계](05-implementation-design.md) | 화면·모듈·상태 소유권, 의존성 후보와 FR-01~16 연결 |
| 2 | [9단계 실행 계획](06-execution-plan.md) | 실제 파일 경계, 공개 인터페이스, 수행 모델, 검증 명령 |
| 3 | [핵심 구현 계약](04-core-implementation.md) | 시간 의미, 기간 정렬, revision/receipt, 오프라인 CAS·충돌, Rules |
| 4 | [프론트엔드 전달](03-frontend-delivery.md) | Figma 실측·토큰, props, 반응형·접근성·입력 흐름 |
| 5 | [플랫폼 공식 조사](01-platform-research.md) | 정적 내보내기, OAuth, 캐시·PWA, 개발 도구와 Emulator |
| 6 | [ICS·시간 공식 조사](02-import-time-research.md) | RFC·파서 동작, 지원 부분집합, 시간대·중복·오류 처리 |
| 7 | [데스크톱 컴포넌트 시스템 설계](07-component-system-design.md) | 새 데스크톱 화면, 모든 컴포넌트/버튼 동작, Figma 선행과 시각 검수 기준 |
| 8 | [데스크톱 UI 구현 실행 계획](08-desktop-ui-implementation-plan.md) | 승인된 컴포넌트 명세를 Figma·구현·검수 단계로 나눈 실행 순서 |
| 9 | [데스크톱 UI 감사·구성요소 동작](09-ui-audit-and-component-behavior.md) | Figma 관찰 결함, 버튼 동작, C-01–C-33 구현 경계와 현재 검증 상태 |

기존 [제품 문서 안내](../README.md), [제품 사양](../02-product-spec.md), [데이터 계약](../04-firebase-data-sync.md), [수용 기준](../06-validation-delivery.md)도 함께 읽는다. 구체 구현 알고리즘은 핵심 구현 계약, 작업 배정과 파일·검증 순서는 실행 계획이 기준이다.

## 유지하는 제품 결정

화면 배치와 탐색의 최신 기준은 [07 데스크톱 컴포넌트 시스템 설계](07-component-system-design.md)다. 여기와 기존 03/05 문서에서 충돌하는 이전 화면 결정은 07이 대체한다. 사용자가 07을 승인했으며, Figma와 코드 작업 순서는 [08 실행 계획](08-desktop-ui-implementation-plan.md)을 따른다.

- Next.js 16 정적 PWA 구성, 한국어·Asia/Seoul. Firebase Hosting/Auth/Firestore와 Google 로그인은 준비된 후속 동기화 경로이며 이번 화면 검수의 전제조건이 아니다.
- 월간 하루 할 일 홈, 임박 기간 최대3개 고정, 초과 기간은 캘린더를 밀지 않는 3열 오버레이. 자동 회전 없음.
- 순백 배경·라벤더 포인트·일반 콘텐츠의 무테두리 표현, 중앙 home/weekly calendar/settings 세 아이콘.
- Firebase 데이터 동기화는 후순위다. 새 UI 검수 단계의 local preview는 동일 계정/기기 간 동기화를 보장하지 않으며 동기화 완료 상태를 표시하지 않는다.
- 시간 경과율과 하위 할 일 완료·부모 제출/신청 완료를 분리한다. 기기 알림은 설정에서 선택 가능하고 기본 꺼짐이며, 브라우저 미리보기에서만 앱 실행 중 확인한다.
- 기간 항목의 하위 할 일은 단일 Firestore 문서에 최대4개 저장한다. 다섯 번째부터는 저장하지 않고 입력 내용을 보존한다.
- 오프라인 초안을 UID별 IndexedDB에 먼저 보존하고 서버 revision을 비교한다. 충돌에서 두 판본을 보존하며 자동 덮어쓰지 않는다.
- Firebase 없는 `?preview=design`은 입력·편집·삭제·완료·재정렬을 브라우저 localStorage에 저장하고 실제 현재 날짜/시간으로 카운트다운한다. 이는 기기 간 동기화가 아니다.
- 기존 ICS 미리보기·가져오기와 JSON 백업은 Firebase 계정 저장소 경로를 유지한다. 승인된 새 데스크톱 UI 단계에서는 같은 미리보기/복원 흐름을 브라우저 로컬 저장에 연결해 Firebase 없이 검수할 수 있게 한다. 로컬 항목은 기기 간 공유가 아니다. 닫힌 앱의 예약 푸시·결제·소셜·외부 양방향 동기화는 후속 범위다.

## 새 구현 기본값 제안

다음은 공급자 정책이나 이미 승인된 제품 제한으로 표현하지 않는다. 이 계획 검토에 포함한 구현 제안이며, 변경 시 관련 타입·Rules·수용 기준을 함께 수정한다.

| 제안 | 이유·사용자 결과 |
|---|---|
| 날짜형 시작은 달력 D-N만 표시 | 실제 시작 시각이 없는 항목에 임의 자정 초 카운트다운을 붙이지 않음. 정확한 시각형에는 10분 미만 MM:SS 적용 |
| 모호한 ICS 시리즈는 제외 또는 원본 수정 후 새 미리보기 | DST gap/fold·알 수 없는 시간대·offset 불일치를 자동 이동하지 않음. 다른 유효 시리즈는 선택 가능 |
| ICS worker 검사100,000회·5초 예산 | 오래된 무한 반복으로 화면이 멈추는 것을 막음. 예산 초과를 부분 성공으로 숨기지 않고 전체 비커밋 결과로 안내 |

서버 영수증·tombstone·송신 snapshot·후속 초안·두 탭 CAS를 포함한 저장 정책은 기존의 데이터 보존 요구를 구현하는 계약이다. 종료 미정 오픈의 시작 전 레일은 위치 표시이며 경과 progressbar가 아니다.

## 조사 방법과 역할

기존과 동일하게 **공식 사실, 공개 화면 관찰, 제품 설계 판단**을 구분한다. 플랫폼·API·라이브러리는 공식 문서/규격/공식 저장소를 검색하고 원문을 확인해 URL·확인일 또는 게시/갱신일을 각 조사 문서에 기록했다. 경쟁 제품 근거는 기존 [레퍼런스 조사](../01-research.md)를 유지하며 새로 관찰하지 않은 정책을 갱신된 사실로 주장하지 않는다.

이번 구현 조사에서 플랫폼, ICS·시간, 프론트엔드 전달·전체 설계 초안은 각각 `gpt-6-luna` + `xhigh` 하위 에이전트가 담당했다. 주 에이전트는 시간 의미·Rules·멱등성·오프라인 보존과 문서 간 계약을 통합했다. 구현에서는 일반 Task1/5/6/8/9가 현재 에이전트 모델을 상속하고, 데이터 무결성 위험이 높은 시간/DST·Rules·offline sync·ICS(Task2/3/4/7)는 `gpt-6.1-sol` + `xhigh`를 사용한다. 현재 도구는 별도 fast 인자를 제공하지 않아 fast 설정 적용을 주장하지 않는다.

사용자 지시대로 **TDD는 어려운 Task2/3/4/7에만 적용**한다. ICS 반복·시간대·재시도는 DST 오류와 데이터 중복/유실 위험이 있어 어렵고 데이터 무결성에 직접 영향을 준다. 나머지는 구현 후 필요한 계약·흐름 검증을 추가하고, 단순 스타일·설정 값을 복제하는 테스트를 만들지 않는다. 필수 test/typecheck/lint/build와 의미 있는 통합 검증은 유지한다.

Figma의 현재 홈 두 프레임을 고정밀 디자인 컨텍스트와 스크린샷으로 확인했다. [데스크톱 7:4](https://www.figma.com/design/o81oyODBLYZuzBAkKcWqgp?node-id=7-4)·[iOS 7:247](https://www.figma.com/design/o81oyODBLYZuzBAkKcWqgp?node-id=7-247)의 조회 자산은 [자산 기록](assets/README.md)에 보관했다. 이번 단계에서 Figma는 수정하지 않았다. 원본의 예시 요일·시간 문자열은 앱의 계산 기준으로 하드코딩하지 않는다.

## 실행 준비와 검증 상태

관찰 환경은 Node26.4.0/pnpm11.19.0/Java 없음이다. 저장소는 Node24.21.0/pnpm11.19.0을 pin하고 JDK21을 Emulator 기준으로 문서화한다. 실행 환경의 실제 버전·Emulator 가능 여부는 구현 검증에서 확인한다. 공식 최소 조건과 제품 팀 기준은 [플랫폼 조사](01-platform-research.md)에서 구분한다. 새 production 패키지는 `[ASSUMPTION]` 후보로만 기록한다.

초기 설계 단계에서는 로컬 링크·이미지, PNG 규격, 문서 표와 FR-01~16·Task1~9 연결을 검사했다. 이는 현재 구현의 앱 동작·Emulator·실기기 성공을 대신하지 않는다.

코드 구현 검증에는 `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:e2e`가 포함된다. 이전 구현에서 통과한 결과는 [verification.md](verification.md)에 보존하며, 최신 컴포넌트 작업 이후 다시 실행한 결과는 [09 UI 감사·구성요소 동작](09-ui-audit-and-component-behavior.md)에 분리해 기록한다. 실제 Firebase 프로젝트 설정·Google OAuth·iPhone 설치 확인은 별도 단계다.

진행 중인 작업과 실제 검증 증거는 [구현 실행 기록](execution-log.md)에서 확인한다.

## Firebase 웹 앱 설정과 API 키 발급

초기 로컬 화면을 보는 데는 Firebase 프로젝트/API 키가 필요하지 않다. Firebase 로그인·클라우드 동기화를 연결할 때 다음 순서로 웹 앱 설정을 준비한다.

1. [Firebase Console](https://console.firebase.google.com/)에서 Google 계정으로 로그인하고 **프로젝트 추가**를 선택한다. 표시 이름을 정한다. 생성되는 Project ID는 Firebase 식별자로 쓰이고 나중에 바꿀 수 없으므로 최종 ID를 확인한다.
2. 프로젝트 개요에서 웹 아이콘 `</>`를 눌러 웹 앱을 등록한다. 앱 닉네임을 정하고, Analytics는 현재 범위에서 필요하지 않으므로 켜지 않아도 된다. 앱을 등록하면 Firebase가 웹용 `firebaseConfig`를 보여준다.
3. 이미 등록했다면 설정 톱니바퀴 → **프로젝트 설정** → **일반** → **내 앱** → 해당 웹 앱 → **SDK 설정 및 구성**에서 같은 설정값을 다시 볼 수 있다. `apiKey`, `authDomain`, `projectId`, `appId`를 복사한다. 별도로 임의의 Google Cloud 키를 만들거나 서비스 계정 키를 내려받지 않는다.
4. **빌드 → Authentication → 시작하기**에서 Google 제공업체를 켜고 지원 이메일을 저장한다. 로컬 개발 주소 `localhost`가 승인된 도메인에 있는지 확인한다. 이후 Firebase Hosting 또는 사용자 도메인으로 접속할 때는 그 도메인도 인증 승인 도메인에 추가한다.
5. **빌드 → Firestore Database**에서 데이터베이스를 준비한다. Google 로그인과 Firestore는 같은 Project ID를 사용한다. 실제 사용자 데이터의 접근 권한은 앱의 Security Rules로 제한한다. 위치 선택이 나오면 한국 사용자를 위한 서울 리전 `asia-northeast3`를 후보로 고른다. database location은 생성 후 바꾸기 어려우므로 생성 직전에 확인한다. [Cloud Firestore 지원 지역](https://firebase.google.com/docs/firestore/locations) 표에 `asia-northeast3`가 Seoul로 기록되어 있다.
6. 프로젝트 루트에서 `.env.example`을 `.env.local`로 복사하고 네 값을 채운다. 변수 이름은 구현된 `.env.example`이 기준이다. `.env.local`은 로컬에만 두고 커밋하지 않는다. 개발 서버가 실행 중이었다면 환경변수를 다시 읽도록 재시작한다.
7. 다음 화면에 표시할 Firebase config 값만 앱에 공개될 수 있다. Firebase의 자동 생성 웹 `Browser key`는 Firebase 프로젝트 식별용이며, 사용자 권한 검사는 Authentication/Security Rules가 한다. 이 키를 Gemini나 다른 Google API에 재사용하지 않고 Firebase 관련 API 제한을 유지한다.

Firebase가 웹 앱을 등록하고 config의 `apiKey`에 자동 연결하는 과정은 [웹 앱 등록 공식 안내](https://firebase.google.com/docs/web/setup)에 나와 있다. Firebase는 웹 키를 프로젝트 식별 값으로 설명하며, Firestore 권한은 키 비공개 여부로 관리하지 않고 [Security Rules와 App Check](https://firebase.google.com/docs/projects/api-keys)로 적용한다. 실제 설정 단계는 최신 Firebase Console 화면을 다시 확인한다.

값을 이 대화로 보내지 않아도 된다. 개인 프로젝트의 브라우저 API 키는 `.env.local`에 직접 붙여 넣으면 되고, 비밀인 service account/Admin 자격 증명은 이 웹 앱에 쓰지 않는다.

### 문서 검증 결과

2026-10-03 초기 설계 시점의 Python 기반 문서 구조 검사는 exit0이었다. Markdown17개, 로컬 파일/이미지 링크115개, 표711행, 코드 fence, FR-01~16과 실행 Task1~9 연결, 일반 task에 TDD red 단계가 없는 것을 검사했다. Figma PNG는 1440×1024와390×844다. 이후 구현 문서·소스가 추가되어 이 수치는 현재 전체 저장소 문서의 검증 결과가 아니다. 외부 URL 참조209개를 셌지만 모든 외부 URL의 현재 접근 가능성을 검사한 것은 아니다.

초기 `git diff --check`는 exit0이었지만 당시 doc/가 untracked였으므로 새 문서 검증을 대신하지 않았다. 구현 종료 때는 현재 작업 트리의 문서와 소스, 실제 테스트 결과를 다시 확인한다.
