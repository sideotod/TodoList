# 구현 플랫폼 기술 조사

- 조사 기준일: 2026-10-03, Asia/Seoul
- 범위: Next.js 16 정적 export, Firebase Hosting/Auth/Firestore Spark, Google OAuth 복귀, PWA 셸·저장·업데이트, Node/pnpm 및 검증 도구
- 사용한 근거: 제품 방향은 `doc/README.md`, `doc/03-ux-frontend.md`, `doc/05-alerts-native-roadmap.md`, `doc/06-validation-delivery.md`를 기준으로 유지했다. 현재 동작은 아래 공식 문서를 검색하고 실제 페이지를 열어 확인했다.
- 제한: 조사 문서만 추가했다. 앱 코드·패키지는 설치하거나 수정하지 않았고, 제품 테스트도 실행하지 않았다. 현재 checkout에는 `package.json`이 없다.

## 요약

Next.js 16의 `output: 'export'`는 빌드 시 HTML/CSS/JS 정적 파일을 내보내 Firebase Hosting에서 제공하는 구성이 가능하다. 런타임 요청을 읽는 API, Server Action, 쿠키·헤더 등 Next 서버 기능은 이 배포에 넣을 수 없다. 데이터와 인증은 브라우저 Firebase SDK가 직접 처리하며, 화면에 필요한 사용자 상태는 명시적으로 클라이언트에서 시작해야 한다.

iOS PWA 로그인은 Firebase가 권장하는 redirect 흐름을 기본으로 하고, OAuth가 돌아온 뒤 앱 시작 시 `getRedirectResult()`와 인증 상태를 처리한다. 앱의 호스트와 `authDomain`을 한 origin으로 맞추는 것이 중요하다. Firebase가 제공하는 `<project>.firebaseapp.com` Hosting 도메인은 제3자 저장소 제한 대응이 필요 없다고 문서화되어 있다. `<project>.web.app` 또는 사용자 도메인을 고르면 그 실제 호스트를 `authDomain`으로 등록하고 `/__/auth/handler`를 Google OAuth 허용 redirect URI에 추가한다.

Firestore `persistentLocalCache`는 canonical 문서의 오프라인 조회용으로 명시적으로 켜고 다중 탭 manager를 설정한다. 앱 전용 UID별 IndexedDB journal은 오프라인 수정 초안·재시도 상태만 보관하며 canonical 문서를 복제하지 않는다. 영구 캐시 그 자체가 revision을 덮어쓰는 것은 아니다. 충돌 위험은 `setDoc`/`updateDoc`/`deleteDoc`/batch처럼 SDK가 오프라인 쓰기를 자체 큐에 쌓는 경로를 사용하면서 제품 journal도 동시에 송신 큐로 운영할 때 생긴다. canonical 변경은 journal commit 후 온라인 `runTransaction`으로만 제출하고 offline transaction 실패는 journal에 둔다. Firestore transaction은 동시 변경 시 callback을 다시 실행할 수 있으므로 부작용 없는 callback, 고정 operation ID·receipt·재시도 계약이 필요하다.

서비스 워커는 첫 성공적인 온라인 방문 뒤 정적 셸을 내려받아야 오프라인 진입을 지원할 수 있다. 브라우저 저장소는 기기 디스크 압박 등으로 제거될 수 있으며, iOS 홈 화면 앱도 백업 저장소로 취급할 수 없다. 오프라인 작성 성공은 IndexedDB transaction이 실제 commit된 뒤에만 표시하고, 클라우드 동기화 전의 데이터가 장기 보관된다고 약속하지 않는다.

## 공식 사실

### Next.js 16 정적 배포와 lint

- Next.js 16 정적 export는 `next.config`의 `output: 'export'`로 켜고 `next build`를 실행한다. 산출물은 기본 `out/`이며 호스트는 HTML/CSS/JS를 정적으로 제공한다. `trailingSlash: true`를 쓰면 `/calendar/` 같은 경로가 `out/calendar/index.html` 형태가 되어 정적 호스트에서 직접 진입시키기 쉽다.
- 정적 export는 서버가 런타임 요청을 처리하지 않는다. `GET` Route Handler는 빌드 시 고정 응답 파일로 만들 수 있지만 요청의 query/header/cookie에 따른 동적 값은 읽을 수 없다. 요청을 사용하는 Route Handler, Server Action, Proxy, 쿠키·헤더·rewrite/redirect, ISR 등은 지원되지 않는다. 따라서 일정 CRUD, Auth, 동기화는 Next API가 아니라 브라우저 Firebase SDK를 통해 수행한다.
- Client Component도 빌드 중 HTML로 사전 렌더된다. `window`, `navigator`, IndexedDB 같은 API를 모듈 평가나 렌더 중에 읽지 말고 클라이언트 마운트 이후 초기화한다.
- Next 16은 Node.js 20.9 이상과 TypeScript 5.1 이상을 요구한다. 공식 지원 브라우저 목록에는 Safari 16.4 이상이 포함된다.
- Next 16에서 `next lint`는 제거됐고 `next build`는 lint를 자동 수행하지 않는다. 별도 ESLint CLI 명령을 `lint` script로 둬야 한다.

출처: [정적 export 문서](https://nextjs.org/docs/app/guides/static-exports), [Next.js 16 업그레이드·런타임 요구사항](https://nextjs.org/docs/app/guides/upgrading/version-16), [ESLint 설정](https://nextjs.org/docs/app/api-reference/config/eslint). 정적 export·v16 페이지 최종 갱신일은 2026-08-25다.

### Firebase Google 로그인과 브라우저 저장소

- Firebase Google Web SDK는 `signInWithPopup()`과 `signInWithRedirect()`를 제공하고, 모바일 기기에서는 redirect 방식을 선호한다고 안내한다. redirect 뒤 앱이 시작될 때 `getRedirectResult()`로 결과를 처리하는 흐름을 문서화한다.
- Firebase redirect 로그인은 앱과 별도 호스트의 Auth helper iframe을 사용한다. Safari 16.1+, Firefox 109+, Chrome 115+에서 제3자 저장소 제한이 이 흐름을 막을 수 있다. Firebase Hosting의 `<project>.firebaseapp.com` 하위 도메인은 별도 대응이 필요 없다고 명시한다. `web.app` 하위 도메인이나 사용자 도메인에서는 앱 호스트를 `authDomain`으로 설정하고 `https://<app-domain>/__/auth/handler`를 OAuth provider에 허가해야 한다. `continue_uri`의 Firebase 허용 도메인 등록도 필요하다.
- 팝업은 플랫폼에서 차단되거나 모바일에 덜 적합할 수 있다. iOS Safari와 홈 화면 앱에서는 redirect를 우선 시험하고, macOS는 redirect 또는 팝업을 선택하되 팝업 실패 때 redirect로 이어지는 경로를 준비한다.
- Firebase Auth 웹 로그인 상태는 기본적으로 `local` 지속성이라 브라우저 종료 뒤에도 유지된다(브라우저 저장소가 지원되는 경우). redirect는 시작 시 지정한 persistence 설정을 복귀 뒤 사용자에게 적용한다. Auth 상태 지속성은 Firestore 오프라인 문서 캐시와 별개다.
- Firebase Hosting은 OAuth helper를 `/__/` 예약 경로에서 제공한다. 서비스 워커의 catch-all navigation fallback과 Cache API에서 `/__/`를 제외해야 한다.
- Firebase web config의 API key, project ID, app ID는 Firebase 프로젝트에 연결하는 공개 식별자다. 이 값은 비밀로 취급하지 않는다. Firestore 데이터 보호는 API key 숨김이 아니라 UID 조건을 포함한 Security Rules에 둔다. 서비스 계정·Admin 비밀·서버 토큰은 정적 번들에 넣을 수 없다.

출처: [Google 로그인](https://firebase.google.com/docs/auth/web/google-signin), [제3자 저장소 제한에 대한 redirect 모범 사례](https://firebase.google.com/docs/auth/web/redirect-best-practices), [Auth 상태 지속성](https://firebase.google.com/docs/auth/web/auth-state-persistence), [Hosting 예약 URL](https://firebase.google.com/docs/hosting/reserved-urls), [Firebase web config와 API key](https://firebase.google.com/docs/projects/api-keys). Google 로그인·예약 URL 페이지는 2026-09-24, redirect 페이지는 2026-09-01에 갱신됐다. Auth 상태 지속성 문서에는 갱신일이 표시되지 않았다.

### Firestore 오프라인 저장과 충돌

- Firestore 웹 오프라인 지속성은 기본 비활성이고, 아무 cache 설정도 하지 않을 때 메모리 캐시가 기본이다. `persistentLocalCache()`는 IndexedDB에 서버에서 읽은 문서를 보관한다. 탭 manager를 생략하면 single-tab persistence가 기본이므로 다중 탭 제품은 `persistentLocalCache({ tabManager: persistentMultipleTabManager() })`를 명시해야 한다. 공식 API reference는 multi-tab manager가 SDK의 query와 mutation을 여러 탭 사이에서 동기화한다고 설명한다.
- SDK는 영구 캐시를 canonical 오프라인 읽기에 사용하고, cache 문서는 앱 전용 journal에 복제하지 않는다. collection query가 캐시에서 빈 결과를 내면 “서버에 데이터가 없음”을 증명하지 않으며, snapshot의 `fromCache`가 true면 오래되거나 불완전할 수 있다. UI는 cache/server 상태를 구분해 표시한다. 웹 영구 캐시는 세션 사이에 자동 삭제되지 않으며 Firestore SDK 관리 대상이다.
- Firebase 문서의 last-write-wins 설명은 동일 문서에 여러 **오프라인 변경 쓰기**를 SDK가 큐에 넣어 재연결 후 동기화할 때 적용된다. persistent read cache만 활성화했다고 canonical 문서가 수정되지는 않는다. 제품의 canonical 쓰기 경로에서 `setDoc`/`updateDoc`/`deleteDoc`/`writeBatch`를 금지하고, write callback이 온라인에서만 성공하는 `runTransaction`만 사용하면 SDK의 별도 mutation queue와 사용자 지정 journal이 경합하지 않는다. Firestore transaction은 오프라인에서 실패하고 동시 변경 시 callback 전체를 다시 실행할 수 있으므로 callback 밖에서만 IndexedDB/UI 부작용을 처리한다. `writeBatch`는 오프라인에 지속되고 재연결 뒤 실행되므로 이 계약에는 사용하지 않는다.
- SDK cache 초기화 시 명시적인 다중 탭 영구 cache를 먼저 시도한다. 지원 실패·IndexedDB 초기화 오류는 `cache unavailable`로 드러내며 영구 cache를 조용히 메모리 cache로 낮춰 “오프라인 재실행 지원”으로 표시하지 않는다. 필요하면 별도의 온라인 전용 read mode를 제공하되, journal 실패 때 서버 직접 쓰기로 우회하지 않는다. cache purge는 다른 탭에서 실패할 수 있고 진행 중 SDK pending write도 지울 수 있으므로, 모든 mutation SDK API 금지 및 사용자 확인/보존 절차와 함께 관리한다.

출처: [Firestore 오프라인 데이터](https://firebase.google.com/docs/firestore/manage-data/enable-offline), [transaction과 batch](https://firebase.google.com/docs/firestore/manage-data/transactions), [Firestore JavaScript API reference](https://firebase.google.com/docs/reference/js/firestore). 오프라인 문서는 2026-09-24 갱신으로 기록되어 있고, transaction 및 API reference 문서에는 갱신일이 표시되지 않았다. API reference는 `clearIndexedDbPersistence()`가 cache 문서와 pending write를 함께 지우고 아직 시작하지 않은 인스턴스에서 호출해야 한다고 설명한다.

### 서비스 워커와 기기 저장소

- 브라우저는 `register()`가 호출되면 서비스 워커 파일을 내려받는다. 워커의 `install`에서 `event.waitUntil()`로 정적 자산 전체 캐시를 완료해야 설치가 성공한다. 오프라인 진입은 이 첫 다운로드와 cache commit 이후에만 가능하다.
- 새 워커는 기본적으로 기존 워커가 제어하는 탭이 없어질 때까지 대기한다. `skipWaiting()`은 업데이트를 즉시 적용하지만 기존 버전의 페이지가 새 버전 워커와 섞일 수 있다. 따라서 사용자에게 준비 상태를 보여주고, journal의 IndexedDB write transaction을 끝낸 다음 명시적으로 전환·재로드하는 흐름이 적합하다.
- Firebase Hosting의 Cache API, IndexedDB, 서비스 워커 캐시는 origin 저장소다. WebKit은 Safari 17/iOS 17부터 Storage API를 지원하고, `navigator.storage.estimate()`, `persisted()`, `persist()`를 제공한다. `persist()` 승인은 홈 화면 앱 등 사용자 상호작용을 고려하는 heuristic에 달렸다. 저장 quota를 넘기면 `QuotaExceededError`가 발생하고, 저장 압박이나 origin 전체 사용량에 따라 best-effort 저장소가 제거될 수 있다.
- iOS 홈 화면 웹 앱은 WebKit의 ITP 7일 스크립트 저장 삭제 규칙에서 예외지만, 이는 기기 저장 압박·사용자 데이터 삭제·앱 제거에 의한 손실을 막는 백업 보장이 아니다. WebKit은 홈 화면 앱의 웹사이트 데이터를 Safari와 분리한다고 설명하므로 Safari 탭과 설치형 PWA가 로그인/로컬 상태를 공유한다고 가정하지 않는다.

출처: [서비스 워커 수명주기](https://web.dev/articles/service-worker-lifecycle), [WebKit 저장소 정책](https://webkit.org/blog/14403/updates-to-storage-policy/), [WebKit Tracking Prevention](https://webkit.org/tracking-prevention/). WebKit 저장소 정책 게시일은 2023-08-10이다. 서비스 워커와 Tracking Prevention 페이지에는 게시/갱신일이 표시되지 않았다.

### Node, pnpm 및 테스트 도구

- Next.js 16의 공식 최소 Node는 20.9이지만 Node 공식 release 표에서 Node 20은 2026-03-24 EOL이다. 2026-10-03에 Node 24는 LTS, Node 26은 Current로 표시된다. 배포 빌드에는 Node 24 LTS 계열을 맞추는 편이 안전하다.
- `packageManager` 필드에 `pnpm@<정확한 버전>`을 기록하면 Corepack 등 패키지 매니저 shim이 프로젝트의 버전을 선택할 수 있다. `pnpm-lock.yaml`을 저장소에 넣고 CI에서 frozen lockfile 설치를 사용한다.
- Next.js 16 문서는 ESLint 또는 Biome를 CLI로 실행하도록 안내한다. `next build`는 lint를 돌리지 않으므로 `pnpm lint`를 별도로 실행한다.
- Next.js 문서는 Vitest를 단위 테스트 후보로, Playwright를 브라우저 E2E 후보로 안내한다. Firebase Local Emulator Suite는 Auth·Firestore·Hosting을 로컬에서 실행할 수 있고 `emulators:exec`는 CI 실행에도 적합하다. Emulator의 Auth는 Google 같은 외부 identity provider 흐름을 흉내 낼 수 있지만 실제 브라우저의 iOS 저장소 분할·홈 화면 복귀를 완전히 재현하지 않는다.
- Firebase Emulator 설치 문서는 Node.js 16 이상, Java JDK 11 이상을 요구한다. 프로젝트의 재현 환경은 Node 24 LTS와 JDK 21로 맞추는 것을 권한다. JDK 21은 문서의 공급자 최소 요구가 아니라 팀의 일관된 baseline 선택이다.

출처: [Node 릴리스 표](https://nodejs.org/en/about/previous-releases), [Corepack의 packageManager pin](https://github.com/nodejs/corepack#when-authoring-packages), [pnpm package.json 문서](https://pnpm.io/package_json), [Next.js 테스트 안내](https://nextjs.org/docs/app/guides/testing), [Firebase Emulator 설치](https://firebase.google.com/docs/emulator-suite/install_and_configure), [Auth Emulator 차이](https://firebase.google.com/docs/emulator-suite/connect_auth). Node 릴리스 표는 Node 24의 최종 업데이트를 2026-09-07, Node 20 EOL을 2026-03-24로 표시한다. Next 테스트 문서 갱신일은 2026-02-03, Emulator 설치 문서는 2026-10-01이다. pnpm/Corepack 문서는 갱신일을 표시하지 않았다.

## 설계 판단과 권장 구현 경계

### 정적 Next.js와 Hosting

`next.config.ts`는 `output: 'export'`를 사용한다. 직접 URL 진입을 단순화하려고 `trailingSlash: true`를 선택하고, `next/image`를 쓴다면 정적 export에서 기본 최적화 loader가 지원되지 않으므로 `images.unoptimized: true` 또는 정적 asset 방식으로 둔다. 사용자 데이터가 필요한 상세 route는 동적 경로를 만들지 않고 현재 문서처럼 query item ID를 읽는다. `/calendar?filter=period`의 query는 URL 상태일 뿐 서버 요청 기능을 요구하지 않는다.

`pnpm build`가 만든 `out/`을 Firebase Hosting의 `public`으로 지정한다. `/`, `/calendar/`, `/tasks/`, `/settings/`는 각각 빌드 시 생성된 `index.html`로 직접 제공한다. 설정은 기존 IA대로 `/settings` 안에서 profile icon/account affordance가 있는 3-nav를 유지하고 `/account` 새 route는 만들지 않는다. 정적 파일을 이미 모두 만들므로 불필요한 catch-all rewrite는 생략한다. Hosting emulator에서 각 route의 새로고침과 `?filter=period` 진입을 확인한다. Hosting rewrite를 추가할 때도 `/__/` 요청은 건드리지 않는다.

폴더 경계는 제품 사양을 유지한다: `src/app/`은 정적 route와 셸, `src/features/`는 달력·할 일 UI, `src/lib/auth/`는 Firebase Auth adapter, `src/lib/repository.ts`는 공개 저장 계약, 그 아래 adapter가 Firestore와 IndexedDB를 맡는다. React 컴포넌트는 Firebase SDK를 직접 호출하지 않는다. `use client` 파일도 `window`/IndexedDB/Auth 초기화를 렌더 중에 하지 않는다.

클라이언트 Firebase 설정은 `NEXT_PUBLIC_FIREBASE_*`처럼 빌드 시 포함되는 공개 변수로 구성한다. 이 설정은 secret vault가 아니며 값을 공개해도 되는 형태로만 둔다. Security Rules는 로그인 UID가 자신의 canonical item과 receipt 경로만 읽고 쓰도록 하고, 잘못된 데이터 shape·revision을 거부한다. Next API나 Server Action을 두지 않는다.

### Google OAuth 복귀

배포 호스트를 하나의 정식 HTTPS origin으로 선택하고 iOS Safari, 홈 화면 앱, macOS Safari/Chrome 모두 그 origin을 열도록 안내한다. Firebase의 기본 `<project>.firebaseapp.com` 도메인을 쓴다면 그 설정을 유지한다. `<project>.web.app` 또는 custom domain을 쓴다면 Firebase config의 `authDomain`도 그 앱 host에 맞춘다. Google OAuth authorized redirect URI에 `https://<host>/__/auth/handler`, Firebase Auth authorized domains에 host를 등록한다.

iOS 진입 버튼은 사용자 동작 안에서 `signInWithRedirect()`를 부른다. 로그인 전 화면 위치는 현재 URL에 저장된 안전한 route/query로 유지하고, 일정 제목·메모·UID 등은 URL에 넣지 않는다. 모든 app boot에서 `getRedirectResult()`를 처리한 다음 `onAuthStateChanged`를 구독해 세션을 표시한다. `setPersistence(auth, browserLocalPersistence)`를 로그인 동작 전에 명시하면 redirect 사이의 기본 선택이 드러난다. 이 저장은 기기 origin에 한정되며 Safari 탭에서 로그인한 세션이 설치형 PWA에도 넘어간다고 보장하지 않는다.

Firebase emulator는 사용자 생성과 rule 통합 테스트에 사용하지만, OAuth provider로 실제 Google 계정을 쓰는 기기 검증은 별도로 한다. iOS 기기에서 Safari 탭과 홈 화면 standalone 앱 각각 로그인, Google 화면에서 취소/앱 전환 후 복귀, redirect 뒤 원래 route 복원, 앱 강제 종료 후 재개, 다른 UID 전환을 직접 확인한다. popup을 제공한다면 iOS에서 popup 차단·실패 뒤 redirect 대안을 확인한다.

### PWA 캐시와 업데이트 계약

Service Worker와 Cache API는 플랫폼 API라 별도 production package를 추가하지 않는다. `next build` 후 Node 스크립트가 `out/`을 살펴 해시가 붙은 앱 CSS/JS, 필요한 route HTML, 아이콘과 폰트를 버전별 precache 목록으로 쓸 수 있다. 정적 셸만 저장하고 다음 응답은 저장하지 않는다: `/__/` Auth helper와 Firebase config, OAuth callback/result, Firestore/Auth SDK 요청·응답, 사용자별 canonical 데이터.

서비스 워커는 exact-path 정적 asset cache와 이미 빌드된 route별 HTML fallback만 처리한다. Firebase Hosting의 `/__/`는 cache/fallback 양쪽에서 network passthrough로 둔다. 개인 데이터 읽기 캐시는 UID별 IndexedDB와 repository가 책임진다. 가능하면 HTML과 `/sw.js`는 재검증, 이름이 해시된 asset은 immutable cache header로 제공한다.

새 워커가 설치되어 대기하면 UI에 업데이트와 미동기화 건수를 알린다. 먼저 진행 중인 journal IndexedDB 쓰기가 commit됐는지 확인한다. 사용자가 업데이트를 적용하면 새 워커를 활성화하고 페이지를 재로드한다. `skipWaiting()`을 자동 호출하거나 이전 Cache API/IndexedDB 전체를 지우지 않는다. IndexedDB schema 변경은 이전 버전의 journal을 보존하는 additive migration으로 하고, 여러 탭은 같은 writer/ack 계약을 유지한다. 이 제품에서 “초안 저장”은 commit된 로컬 journal을 뜻하며 “서버 동기화 완료”와 구별한다.

오프라인 약속은 이전에 온라인에서 앱 셸을 설치·캐시하고 해당 UID가 로그인해 서버 snapshot을 받은 뒤, 로컬 저장 transaction이 성공한 기기에 한한다. 첫 접속은 HTML·JS 다운로드와 서비스 워커 설치, Google 인증이 필요하므로 인터넷 없이 첫 설치·첫 로그인은 불가능하다. 저장 공간 quota 오류는 성공 토스트 대신 입력을 유지하고 재시도/JSON export를 안내한다. PWA cache와 journal 모두 브라우저 best-effort 저장이며 사용자 제거·기기 공간 부족 뒤 데이터가 남는다고 보장하지 않는다.

### Firestore canonical cache와 별도 journal

Firestore 초기화는 client-only lazy bootstrap에서 브라우저 API를 사용할 수 있을 때 한 번 호출한다: `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`. Client Component가 정적 HTML 생성 중에도 사전 렌더되므로 이 호출을 서버/import 시점에 실행하지 않는다. cache 문서는 Firestore SDK 소유로 두고 앱 전용 IndexedDB에 같은 canonical collection을 복제하지 않는다. 다중 탭 영구 cache 초기화가 지원되지 않으면 `cache unavailable`을 노출한다. silent memory fallback으로 기기 재시작 뒤에도 오프라인 snapshot이 있다고 표시하지 않는다. 초기화/capability/IndexedDB 실패를 잡아 상태를 결정하고, Firestore instance가 이미 시작한 뒤 다른 cache 옵션으로 다시 초기화할 수 있다고 가정하지 않는다.

앱 journal은 UID별 미동기화 mutation 및 receipt/resolution만 저장한다. canonical 화면은 Firestore listener/query에서 받은 validated snapshot과 cache provenance를 쓴다. `fromCache: true`이면 데이터가 오래되거나 불완전할 수 있고, cache query 결과가 비었다고 서버에 canonical 항목이 없다고 단정하지 않는다. 필요한 첫 snapshot이 없어 offline read를 채울 수 없는 UI는 “아직 이 기기에서 받은 데이터 없음”으로 구분한다. journal의 transaction complete 뒤 화면에 `기기에 저장됨 · 동기화 대기`를 표시한다. `navigator.onLine`은 전송 가능성을 확정하지 않으므로 실제 transaction 실패와 응답 불명확성은 그대로 journal에 남긴다.

canonical mutation 코드는 `runTransaction`을 online-only commit 수단으로만 사용한다. `setDoc`, `updateDoc`, `deleteDoc`, `writeBatch` 등 SDK의 offline-persisted mutation queue로 들어가는 API를 repository canonical write path에서 금지한다. transaction은 오프라인이면 실패한다. 실패하면 mutation을 자체 journal에 유지하고, 서버 snapshot과 receipt가 확인된 뒤에만 ack한다. callback은 재실행돼도 부작용이 없도록 side effect-free로 작성한다. 응답이 끊긴 요청은 같은 operation ID로 재시도해 receipt를 대조하며 새 문서/revision을 중복 생성하지 않는다. revision mismatch는 last-write-wins나 필드별 자동 merge로 바꾸지 않고 사용자 충돌 선택 흐름에 남긴다.

cache와 journal은 서로 다른 실패 상태다. cache 초기화 불가여도 online server read/write 경로는 가능할 수 있지만 offline canonical read는 약속하지 않는다. journal을 열거나 commit하지 못하면 폼을 보존하고 해당 초안은 서버 직접 write로 우회하지 않는다. Auth 전환은 listener를 UID별로 재생성하고 path/rules도 UID 범위로 강제한다. Firestore cache purge가 필요할 때는 다른 탭을 감지·정리한 다음 `terminate()`→`clearIndexedDbPersistence()` 순서를 사용한다. 이 API는 pending SDK write까지 함께 지우며 secure erase가 아니므로 canonical mutation SDK queue를 금지하고, journal 초안은 사용자 선택 없이 삭제하지 않는다.

저장소가 없거나 지워진 경우는 서버 canonical 데이터를 다시 받아 재구성할 수 있어야 한다. 단, 아직 서버로 전송하지 않은 변경은 로컬 백업(export) 외에 클라우드 복구 수단이 없음을 사용자에게 명시한다. `navigator.storage.estimate()`를 진단에 사용하고 quota 오류는 모두 처리한다. `persist()` 요청은 영구 보존 약속이 아니며, 승인 여부와 WebKit/브라우저 정책을 UI가 숨기지 않도록 한다.

## Node/pnpm 환경과 명령 초안

Next/React patch 번호는 문서만 보고 추정해 고정하지 않는다. 구현 시 `next`는 16.x, `react`/`react-dom`은 19.x 범위에서 Next peer requirements를 확인해 함께 선택하고, 첫 설치가 선택한 정확한 patch를 manifest와 lockfile에 기록한다. CI의 frozen lockfile 설치와 `pnpm list next react react-dom`으로 검증한다. Node는 24 LTS 계열을 로컬과 CI에서 선택하고 `.nvmrc` 또는 `.node-version`에 정확한 설치 버전을 기록한다. `package.json`에는 지원하는 `engines.node` 범위와 조사 시점의 정확한 `packageManager: "pnpm@11.19.0"`을 넣고 `pnpm-lock.yaml`을 commit한다. Corepack이 설치된 환경은 `corepack enable` 후 pin을 이용할 수 있지만 현재 checkout 환경에는 `corepack` 명령이 없다. pnpm 11.19.0을 직접 제공하는 CI/runtime이면 manifest pin과 frozen lockfile을 검증한다. Emulator는 공급자 최소가 JDK 11이지만 재현 baseline으로 JDK 21을 선택한다.

권장 script 의미는 다음과 같다. 테스트 runner 버전·scripts는 구현 시작 시 선택한 toolchain에 맞게 추가한다.

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "test": "pnpm test:unit && pnpm exec firebase emulators:exec --project demo-todolist --only auth,firestore \"pnpm test:rules\"",
    "test:unit": "vitest run --config vitest.config.ts",
    "test:rules": "vitest run --config vitest.rules.config.ts",
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  }
}
```

`test:rules`는 Emulator를 시작하지 않는 별도 Vitest config로 두고 이미 실행 중인 demo Auth/Firestore Emulator에 연결한다. `tests/rules/**`와 실제 Emulator가 필요한 `tests/integration/**`를 함께 실행한다. unit config는 두 폴더와 E2E를 제외한다. 따라서 `pnpm test`는 unit suite 후 `emulators:exec` 안에서 Rules·저장 통합 suite를 돌려 완료 뒤 Emulator를 종료한다. `firebase-tools`는 이 명령을 제공하는 개발 도구여서 설치 시 devDependency/실행 환경을 준비해야 하며 production bundle dependency로 추가하지 않는다.

`build`는 Next 정적 export 후 선택적인 precache manifest 생성 단계를 이어 실행할 수 있다. `next start`는 정적 결과를 Firebase Hosting에 제공하는 명령이 아니므로 제품의 주요 확인 경로로 쓰지 않는다. `lint`에는 절대로 `next lint`를 넣지 않는다. `pnpm build` 성공 외에 `pnpm lint`를 따로 실행한다.

구현 후 개발·검증 명령은 다음 순서가 가능하다.

```sh
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e
```

먼저 `pnpm build`로 `out/`을 만든 뒤 `test:e2e`가 Auth/Firestore Emulator와 정적 서버를 시작해 Playwright를 실행한다. Hosting의 직접 경로·헤더 설정은 별도 Hosting Emulator 확인에 포함한다. 프로젝트 ID는 앱 설정·Firebase CLI·Emulator 전부 `demo-todolist`로 맞춘다. `pnpm test`는 auth/firestore emulator를 자체 실행하므로 별도 start 명령을 먼저 켜지 않는다. `.env.example`에는 빌드에 들어가는 공개 Firebase web config placeholder만 적는다. 서비스 계정 키나 Admin credential을 넣지 않는다.

저장소의 현재 `AGENTS.md` 셋업에는 Prisma migrate가 남아 있지만 제품 문서는 Spark Firebase를 선택했다. 이 조사 파일은 AGENTS를 바꾸지 않는다. 구현 단계에서 Firebase Emulator/Rules 명령과 실제 scripts에 맞게 해당 개발 안내를 정합시키는 작업이 필요하다.

### 조사 당시 checkout 도구 관찰값

2026-10-03 초기 설계 시점에 이 checkout에서 `node --version`은 `v26.4.0`, `pnpm --version`은 `11.19.0`을 출력했다. 공식 Node 릴리스 표에서 Node 26은 Current이고 Node 24는 LTS이므로 구현·CI baseline은 Node 24로 둔다. `corepack --version`은 command not found, `java -version`은 시스템 Java Runtime을 찾지 못해 실패했다. Firebase Emulator의 공식 최소 JDK는 11이며 재현 baseline은 JDK 21로 선택했다. 그 당시에는 package manifest가 없어 검증 명령을 실행할 수 없었으나, 이후 Node/pnpm pin·manifest·scripts·Emulator 설정이 추가됐다. 현재 명령의 검증 결과는 [구현 실행 기록](execution-log.md)을 따른다.

## 자동 검증과 실기기 검증

### 자동으로 확인할 항목

- `pnpm test`: 순수 도메인 규칙과 journal state machine. D-Day/date-only, IANA 시간대의 DST 경계, 포함 종료일, D+1/정확한 시작, 기간 정렬, receipt와 retry, 삭제 tombstone, ACK 뒤 추가 편집, UID 분리 등을 고정 입력으로 검사한다.
- Firebase Auth/Firestore Emulator: unauthenticated 차단, UID A/B 격리, 검증되지 않은 kind/revision/필드 거부, 같은 base revision의 충돌, operation 재시도와 receipt 멱등성을 검사한다. Emulator는 자동화를 위한 경로이며 Spark 실제 배포 권한/결제 상태를 검증하지 않는다.
- Browser E2E (Chromium 중심): 정적 Hosting에서 `/`, `/calendar/`, `/tasks/`, `/settings/` 직접 새로고침, query 필터, 로그인 상태 렌더링, journal 쓰기 대기/복구, offline 이후 캐시된 셸과 route 재진입, service worker가 `/__/`를 통과시키는지, 대기 업데이트 적용 뒤 복구를 검사한다. persistent Firestore cache가 두 탭에서 같은 server snapshot을 재사용하고 재실행 후에도 보유하는지, `fromCache` UI가 오래된/빈 snapshot을 서버 부재로 오해하지 않는지 검사한다. 네트워크를 끈 뒤 canonical `runTransaction`은 실패하고 draft는 journal에만 남는지, `hasPendingWrites` SDK mutation queue가 생기지 않는지 테스트한다. 저장소 초기화 실패와 journal transaction 실패는 서로 다른 상태로 만들고 서버 write fallback이 없음을 확인한다.
- 필수 CI 명령은 `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`다. Next build는 lint를 대신하지 않는다. E2E/emulator는 CI에서 별도 job으로 실행하고 production Firebase project에 접속하지 않도록 demo project를 사용한다.

### 실제 macOS/iOS에서 확인할 항목

- macOS Safari와 Chrome에서 실제 Google 계정 redirect/popup, 로그인 복귀 후 URL/선택 날짜 유지, 인증 상태 앱 재실행, 로그아웃과 다른 UID 전환.
- 지원 iOS 버전의 Safari 탭과 홈 화면 설치형 PWA 각각에서 Google 계정 선택, OAuth 취소/앱 전환/잠금 뒤 돌아오기, `getRedirectResult()` 결과, 권한/쿠키 저장 제한, 동일 origin 세션 범위를 확인한다. Auth Emulator와 Playwright는 이 동작을 증명하지 못한다.
- 한 번 로그인·동기화·서비스 워커 설치 후 비행기 모드로 닫고 재실행, 달력 조회, task 추가/수정/삭제, 페이지 종료 후 재실행, 다시 온라인으로 동기화하는 흐름을 확인한다. 새 기기·앱 삭제·사이트 데이터 초기화 상태에서 첫 오프라인 사용이 불가능한 것도 안내와 일치시킨다.
- 오프라인 pending 중 서비스 워커가 업데이트될 때 초안 write가 commit된 뒤에만 새 버전이 적용되는지, 이전/다음 HTML·bundle 혼합이 없는지, 로그인 redirect 예약 URL이 끊기지 않는지 테스트한다. 두 탭에서 송신과 ack가 겹칠 때도 변경이 보존돼야 한다.
- quota 오류는 자동화에서 강제 주입하고, 실기기에서는 저장 공간이 낮거나 사이트 데이터를 제거한 뒤 복구 문구와 서버 재다운로드를 확인한다. 브라우저 자동 테스트는 실제 OS의 storage eviction 여부나 장기간 보존을 증명하지 않는다.

제품 코드가 없는 현재 checkout에서는 이 명령들을 성공했다고 기록할 수 없다. 조사 시점에 `package.json`이 없어 테스트, 타입 검사, lint, build는 실행하지 않았다.

## [ASSUMPTION] production 의존성 후보

아래는 구현 PR에서만 검토할 후보이며, 이 조사에서 추가하거나 설치하지 않았다.

| 후보 | 이유 | 대안 | 라이선스 |
|---|---|---|---|
| `[ASSUMPTION] firebase` (Firebase JavaScript SDK) | Google Auth·Firestore modular client와 인증 복귀 처리를 이용한다. | Firebase REST/Google OAuth를 직접 붙일 수 있으나 token refresh, listener, transaction, emulator 연결을 앱이 직접 소유해야 한다. | upstream은 Apache-2.0이며 protobuf 일부는 BSD-3-Clause. [저장소 LICENSE](https://github.com/firebase/firebase-js-sdk/blob/main/LICENSE) |
| `[ASSUMPTION] ical.js` | RFC 5545의 줄 접기·escaping·VEVENT·RRULE·EXDATE를 처리하고 제품 지원 subset으로 제한할 수 있다. upstream은 의존성 없는 parser라고 설명한다. TZID가 ICS에 정의되지 않은 경우 기본 timezone bundle을 포함하지 않는 점을 확인해 입력 오류 규칙과 함께 평가한다. | 문서의 엄격한 subset만 자체 구현. RFC edge case와 반복 규칙 검증 부담이 커진다. | MPL-2.0. [upstream README·라이선스](https://github.com/kewisch/ical.js) |
| `[ASSUMPTION] @js-temporal/polyfill` | 동일한 IANA 시간대/DST 경계 계산을 지원 브라우저에서 일관되게 사용할 후보. TC39 README는 Temporal을 Stage 4라 설명하지만 이 polyfill은 “alpha release available”로 표기하므로 안정성·제품 타입/serializer 호환·bundle 영향을 구현 PR에서 먼저 확인한다. | `Intl.DateTimeFormat`/`Date`로 필요한 날짜/시간 연산만 구현. date-fns와 `@date-fns/tz`는 대안 조사군이며 이 후보와 동시에 채택하지 않는다. | ISC. [upstream README·package metadata·LICENSE](https://github.com/js-temporal/temporal-polyfill) |

후보의 정확한 배포 버전은 고정하지 않았다. 구현에서 제품 동작과 Next peer compatibility를 검증한 뒤 manifest/lockfile에 선택 patch를 저장한다.

Service Worker, Cache API, IndexedDB, URLSearchParams, `Intl`, browser visibility API는 플랫폼 기능으로 먼저 구성한다. 달력 전체 렌더러나 PWA 플러그인을 추가하는 것은 현 선택된 화면/정적 Hosting에 필수라고 확인되지 않았다.

## 확인 출처

아래 공식/프로젝트 1차 자료를 검색한 뒤 실제 페이지를 열었다. 갱신일을 표시한 자료는 기준일과 함께 적었고, 원문에 날짜가 노출되지 않는 경우 그 사실을 적었다.

| 출처 | 게시/갱신일(페이지 표기) | 확인한 내용 |
|---|---|---|
| [Next.js Static Exports](https://nextjs.org/docs/app/guides/static-exports) | 2026-08-25 갱신 | export 구성·정적 route handler·지원 안 되는 런타임 기능 |
| [Next.js 16 Upgrade](https://nextjs.org/docs/app/guides/upgrading/version-16) | 2026-08-25 갱신 | Node/TypeScript 최소 버전·브라우저·`next lint` 제거 |
| [Firebase Google Sign-In](https://firebase.google.com/docs/auth/web/google-signin) | 2026-09-24 갱신 | 모바일 redirect 권장 및 `getRedirectResult()` |
| [Firebase Redirect Best Practices](https://firebase.google.com/docs/auth/web/redirect-best-practices) | 2026-09-01 갱신 | Safari 제3자 저장소·authDomain과 authorized redirect URI |
| [Firebase Auth Persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence) | 날짜 미표시 | 기본 local persistence와 redirect persistence |
| [Firebase Firestore Offline](https://firebase.google.com/docs/firestore/manage-data/enable-offline) | 2026-09-24 갱신 | 기본 memory cache·다중 탭 persistent cache·cache provenance·offline write 동기화 |
| [Firebase Firestore Transactions](https://firebase.google.com/docs/firestore/manage-data/transactions) | 날짜 미표시 | transaction retry/offline failure·batch의 오프라인 실행 |
| [Firebase JavaScript API reference](https://firebase.google.com/docs/reference/js/firestore) | 날짜 미표시 | persistent cache/tab manager API·purge가 pending writes도 지움 |
| [Firebase Hosting Reserved URLs](https://firebase.google.com/docs/hosting/reserved-urls) | 2026-09-24 갱신 | Auth helper `/__/`와 SW navigation fallback 예외 |
| [web.dev Service Worker Lifecycle](https://web.dev/articles/service-worker-lifecycle) | 날짜 미표시 | 설치 캐시·waiting·`skipWaiting()` 업데이트 영향 |
| [MDN Manifest display mode](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/display) | 2026-10-04 확인, 페이지 갱신일 미표시 | standalone display mode와 브라우저 UI 표시 범위 |
| [Apple Configuring Web Applications](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html) | 2026-10-04 확인, archived 문서 | 홈 화면 웹 앱 구성과 PNG `apple-touch-icon` 메타데이터 |
| [WebKit Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/) | 2023-08-10 게시 | iOS/macOS 저장 quota, eviction, Storage API |
| [WebKit Tracking Prevention](https://webkit.org/tracking-prevention/) | 날짜 미표시 | 7일 ITP 규칙 및 Home Screen 앱 데이터 분리/예외 |
| [Node.js release table](https://nodejs.org/en/about/previous-releases) | 표의 버전별 last updated | 2026-10-03 당시 v24 LTS, v26 Current, v20 EOL; 이 checkout은 v26.4.0 |
| [Corepack packageManager field](https://github.com/nodejs/corepack#when-authoring-packages) | 날짜 미표시 | 정확한 package manager 버전 선언 |
| [pnpm package.json](https://pnpm.io/package_json) | 날짜 미표시 | pnpm/Node 버전 제약 field |
| [Next.js Testing](https://nextjs.org/docs/app/guides/testing) | 2026-02-03 갱신 | Vitest·Playwright 등 테스트 유형/도구 |
| [Firebase Emulator setup](https://firebase.google.com/docs/emulator-suite/install_and_configure) | 2026-10-01 갱신 | CLI·Auth/Firestore/Hosting emulator와 Java 요구사항 |
| [Firebase Auth Emulator](https://firebase.google.com/docs/emulator-suite/connect_auth) | 날짜 미표시 | 웹 연결, 외부 IDP 에뮬레이션과 production 차이 |
| [Firebase Rules unit tests](https://firebase.google.com/docs/rules/unit-tests) | 날짜 미표시 | `@firebase/rules-unit-testing`, Auth 상태 mock |
| [Firebase Web config/API key](https://firebase.google.com/docs/projects/api-keys) | 2026-10-03에 열린 페이지 | config 값은 공개이며 Rules/App Check가 보안 경계 |
| [Firebase SDK LICENSE](https://github.com/firebase/firebase-js-sdk/blob/main/LICENSE) | 2026-10-03에 열린 저장소 | Apache-2.0 및 protobuf BSD-3-Clause 예외 |
| [TC39 Temporal / polyfill status](https://github.com/tc39/proposal-temporal/blob/main/README.md) | 2026-10-03 확인; 갱신일 미표시 | Temporal Stage 4와 `@js-temporal/polyfill`의 alpha release 표기 |
| [js-temporal polyfill upstream](https://github.com/js-temporal/temporal-polyfill) | 2026-10-03 확인; 페이지에 갱신일 미표시 | package metadata의 Temporal polyfill 기능·ISC license; 특정 patch 채택은 미정 |
| [ical.js upstream](https://github.com/kewisch/ical.js) | 최신 release 표기는 2025-08-08; 페이지 갱신일 미표시 | RFC 5545 parser 기능·TZID timezone bundle 주의·MPL-2.0 |
