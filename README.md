# TodoList

Next.js 16 기반 개인 일정·할 일 PWA입니다. 월간 할 일 홈과 별도 캘린더, 기간 카운트다운·체크리스트를 제공합니다. Supabase 설정 없이 시작하면 로컬 모드로 동작하고 데이터는 이 브라우저에 저장됩니다. Supabase를 연결하면 계정 간 동기화를 사용할 수 있습니다. 알림은 설정에서 선택하고 기본은 꺼져 있으며, 로컬 데이터의 JSON 백업은 설정에서 관리합니다. [검증 결과와 화면 비교](doc/implementation/verification.md)를 참고하세요.

## 로컬 준비

- Node.js는 `.node-version`에 지정한 24.21.0을 사용합니다. pnpm은 `package.json`의 `packageManager`에 고정된 11.19.0을 사용합니다.
- 의존성을 설치합니다:

  ```sh
  pnpm install --frozen-lockfile
  ```

- Supabase 설정 없이도 계정 없이 사용할 수 있으며 일정과 설정은 브라우저 `localStorage`에 저장됩니다. 이 데이터는 브라우저 프로필과 주소가 같은 기기에서만 사용할 수 있습니다. 계정 동기화를 연결하려면:

  ```sh
  cp .env.example .env.local
  ```

- `.env.local`은 git에 포함하지 않습니다. 브라우저 설정에는 Supabase project URL과 publishable key만 사용합니다. `service_role` 키나 데이터베이스 암호를 프론트엔드에 넣지 마세요.

새 Supabase 프로젝트를 만들고 Google OAuth 제공자를 설정한 뒤 `supabase/migrations/20261010000000_initial_schema.sql`을 SQL Editor에서 적용합니다. Authentication의 Site URL/redirect allow list에도 개발 주소와 배포 도메인을 추가합니다. 기존 Firebase 사용자나 일정은 가져오지 않습니다.

## 개발 및 검증

앱을 실행합니다:

```sh
pnpm dev
```

브라우저에서 `http://127.0.0.1:3000/`을 열면 로컬 모드로 일정을 기록할 수 있습니다. 생성·수정·삭제·완료한 항목은 이 브라우저에 저장되고 새로고침 후에도 유지됩니다. 다른 브라우저나 기기와 공유하려면 설정에서 JSON 백업을 내보내거나 Supabase 계정 동기화를 구성하세요. `?preview=design`은 샘플 일정이 포함된 디자인 확인 경로입니다.

검증 명령은 다음과 같습니다:

```sh
pnpm test:unit
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e
```

`pnpm test`는 unit suite를 실행합니다. 특정 unit 파일은 `pnpm test:unit tests/domain/validation.test.ts`로 실행하고, `pnpm test:e2e`는 로컬 브라우저 미리보기 흐름을 검증합니다. `pnpm build`는 `out/`에 정적 산출물을 생성합니다.

## 의존성 판단

- `[ASSUMPTION] @js-temporal/polyfill`: 지원 Safari에서도 같은 시간대·DST 입력 처리를 제공하기 위한 후보입니다. 기본 `Intl`만으로는 모호한 현지 시각의 두 UTC 후보를 다루기 어렵습니다. ISC 라이선스이며 JSBI를 사용합니다.
- `@supabase/supabase-js`: Supabase Auth, Postgres RPC, RLS 기반 일정 저장, Realtime 갱신 연결에 사용합니다.
