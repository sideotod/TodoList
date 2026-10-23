# AGENTS.md

## 프로젝트

Swift 6 + SwiftUI + SwiftData 기반 macOS 14 이상 네이티브 TodoList 앱. SwiftPM 실행 타깃은 `macos/TodoListApp/`의 `TodoList`입니다. Next.js 웹 소스는 사용자 요청으로 제거됐으며 Git 이력에 남습니다.

## 작업 원칙

- 사용자 지시: TDD 사용 금지. 구현 후 필요한 테스트로 검증합니다.
- Swift로 구현하고 기능별 View, domain, repository, sync 계층을 분리합니다.
- UI는 네이티브 SwiftUI를 사용하며 HTML/WebView로 대체하지 않습니다.
- 시각 기준은 `design-reference/v4/` PNG, 상호작용 기준은 v4 HTML입니다.
- 원격 데이터 접근은 repository/sync 계층에 둡니다. 백엔드 스키마와 사용자 데이터를 임의로 변경·초기화하지 않습니다.
- JSON wire 형식, 안정적인 항목/연결 ID와 로컬 저장 호환성을 보존합니다.
- 알림 기능은 사용자 요청으로 제거됐습니다. 권한 요청·예약·설정 UI를 재도입하지 않습니다. 기존 예약 삭제와 비활성 JSON 키 호환만 허용합니다.
- Supabase 동기화 미연결 상태를 동작하는 기능처럼 표시하지 않습니다. 현재 제한은 README.md에 기록합니다.
- secret/service_role 키, `.env.local`, 사용자 DB, 토큰을 커밋하지 않습니다.
- `doc/`와 기존 계획은 설계 이력입니다. 최신 사용자 결정과 현재 README/PRODUCT/DESIGN을 우선합니다.

## 빌드와 검증

```sh
swift test --package-path macos/TodoListApp
./script/build_and_run.sh --verify
```

실행은 `script/build_and_run.sh`를 사용합니다. 앱은 `dist/TodoList.app`에 생성합니다. 화면 변경은 실제 macOS 창에서 확인하고 미검증 항목을 `docs/swiftui-design-qa.md`에 남깁니다. Playwright는 참고 HTML에만 쓸 수 있으며 네이티브 UI 검증을 대체하지 않습니다.

삭제된 웹 프로젝트의 pnpm test/typecheck/lint/E2E 명령은 더 이상 적용하지 않습니다. 변경·삭제 목록, 검증 결과와 남은 한계를 기록하고 conventional commit 형식을 사용합니다.
