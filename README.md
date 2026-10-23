# TodoList for macOS

Swift 6 + SwiftUI + SwiftData 기반 네이티브 일정·할 일 앱입니다. macOS 14 이상과 Xcode의 Swift 도구가 필요합니다. 실행에는 Node.js, React, Next.js, Electron이 필요하지 않습니다.

## 빌드와 실행

```sh
./script/build_and_run.sh
```

`dist/TodoList.app`을 생성하고 실행합니다. Finder에서 이 앱을 열거나 Dock에 추가할 수 있습니다. Codex Run 버튼도 같은 스크립트를 사용합니다. 현재 번들은 개발용이며 배포용 서명·공증은 별도입니다.

```sh
./script/build_and_run.sh --verify
./script/build_and_run.sh --logs
./script/build_and_run.sh --design-preview
swift test --package-path macos/TodoListApp
```

`--design-preview`는 별도 환경설정과 메모리 샘플 데이터를 사용합니다. 이 모드의 항목 변경은 재실행 시 유지되지 않습니다. 실제 데이터 저장은 기본 실행 모드에서 사용하세요.

## 현재 기능과 제한

- 오늘, Progress, 캘린더 일·주·월·년 보기와 상세 인스펙터, 항목 편집, 반복 일정, 검색, 설정을 SwiftUI로 구현했습니다.
- 일반 실행에서는 SwiftData에 로컬 데이터를 저장합니다. 네트워크 없이 로컬 항목을 변경할 수 있습니다.
- 데이터 설정에서 기존 로컬 v1 JSON 백업을 가져오고 내보냅니다. 브라우저 localStorage를 자동으로 읽지는 않습니다.
- Google OAuth와 세션 복원 코드는 있지만 실제 서버 인증은 환경별 검증이 필요합니다. **서버 데이터 동기화, revision RPC, outbox 전송 및 충돌 해결 연결은 아직 미완료입니다. 로컬 변경은 Supabase에 업로드되지 않습니다.** 계정 형식 JSON 복구와 ICS 가져오기도 아직 지원하지 않습니다.
- 알림 기능은 제거했습니다. 구버전 예약 정리와 예전 JSON 필드 호환 처리만 남습니다.
- 요구된 세 창 크기와 모든 화면의 디자인 비교·전체 UI CRUD 검증은 완료되지 않았습니다. [디자인 QA](docs/swiftui-design-qa.md)를 참고하세요.

## Supabase 설정

앱 설정의 계정 화면에서 프로젝트 URL과 publishable key를 입력할 수 있습니다. 또는 `.env.example`을 `.env.local`로 복사해 공개 설정만 입력하면 빌드 스크립트가 앱 번들에 포함합니다. `service_role`·secret key를 넣거나 환경설정 파일을 커밋하지 마세요. 기존 `NEXT_PUBLIC_SUPABASE_*` 변수도 호환 별칭으로 읽습니다.

Supabase Google 제공자 및 redirect allow list에 `todolist://auth/callback` 설정이 필요합니다. 기존 백엔드 스키마는 `supabase/migrations/`에 보존합니다.

## 저장소와 복구

- 네이티브 소스와 테스트: `macos/TodoListApp/`
- 빌드 스크립트: `script/build_and_run.sh`
- v4 시각·상호작용 기준: `design-reference/v4/`
- `doc/`의 이전 제품 문서는 설계 이력이며 현재 실행 지침이 아닙니다.

2026-10-23 사용자 요청으로 기존 웹 소스·의존성·웹 테스트·빌드 산출물을 제거했습니다. 사용자 데이터와 Supabase 스키마, Git 이력은 삭제하지 않았습니다. 삭제 전 웹 소스는 `f24429f` 커밋에서 확인하거나 `git restore --source=f24429f -- <경로>`로 복구할 수 있습니다. 전체 네이티브 마이그레이션 완료를 의미하지는 않습니다.
