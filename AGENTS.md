# AGENTS.md

## 프로젝트 개요
Next.js 16 기반 일정 캘린더 및 개인용 task 관리 툴(특히 대학생/대학원생 일정 D-Day 관리).
desktop(macos)과 mobile(ios)이 연동되어 확인할 수 있는 것이 핵심

## 개발 환경 셋업
- Node.js: `.node-version`의 24.21.0, pnpm: packageManager pin의 11.19.0
- Supabase 프로젝트와 스키마 설정은 README.md를 참고
- 의존성 설치: `pnpm install --frozen-lockfile`
- 환경변수 예시 복사: `cp .env.example .env.local` (`.env.local`에 실서비스 secret을 저장하거나 commit하지 않음)
- 개발 서버: `pnpm dev`

## 테스트
- 전체 테스트: `pnpm test`
- 특정 unit 파일: `pnpm test:unit <파일명>`
- 브라우저 미리보기 E2E: `pnpm test:e2e`
- 작업 완료 전에 반드시 `pnpm test`와 `pnpm typecheck`를 통과시킬 것

## 빌드 & 배포
- 빌드: `pnpm build`
- 린트: `pnpm lint`
- 배포: main branch push

## 아키텍처 (코드만 봐서는 모를 수 있는 것들)
- 모든 DB 접근은 `src/lib/repository.ts`를 통해서만 (raw SQL 금지)
- `src/payments/` 모듈은 별도의 인증 흐름을 가짐 (`src/auth/`와 분리)
- API 응답은 `src/core/errors.ts`의 ErrorResponse 클래스 사용
- 클라이언트 컴포넌트는 최상단에 'use client' 명시

## 코딩 컨벤션
- 모든 새 코드는 TypeScript로 작성
- 각 파일의 기존 코드 스타일을 따를 것
- 컴포넌트: PascalCase, 유틸 함수: camelCase
- 들여쓰기 2칸, 세미콜론 사용

## 하지 말아야 할 것
- 새 프로덕션 의존성 추가 시 PR에서 먼저 논의 ([ASSUMPTION]으로 후보 명시)
- console.log를 프로덕션 코드에 남기지 말 것
- any 타입 사용 금지
- .env 파일 커밋 금지

## 작업 완료 전 체크리스트
- [ ] 해당 작업의 설계 문서의 내용을 임의로 생략하거나 간략화 한 부분이 있는지 확인 (shorcut 구현 방지)
- [ ] 테스트 통과 (`pnpm test`)
- [ ] 타입 체크 통과 (`pnpm typecheck`)
- [ ] 린트 통과 (`pnpm lint`)
- [ ] 사용자 흐름에 영향이 있으면 E2E 확인 (`pnpm test:e2e`)

## PR 메시지 규칙
- conventional commit 형식 사용 (feat:, fix:, refactor: 등)
- 변경 이유와 영향 범위를 본문에 명시

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
