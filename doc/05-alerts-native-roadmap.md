# 05 — 카운트다운·알림 범위와 네이티브 로드맵

수정일: 2026-10-05 · 현재 단계: 데스크톱 로컬 미리보기 · Firebase 동기화 제외

## 화면 카운트다운

- `deadline`/`window`와 `event`에서 시작 카운트다운 표시를 고를 수 있다. 기간형 항목은 시작 시각을 기준으로 하고, 이벤트는 기준 시각을 시작 또는 종료로 선택한다. 기간형 기본 표시 시점은 시작 1일 전이며 0~30일로 바꿀 수 있다. 이벤트는 기본 꺼짐이다.
- 시간형 시작은 24시간 이상이면 `D-N`, 24시간 미만이면 `HH:MM`, 10분 미만이면 `MM:SS`로 표시한다. 날짜형은 날짜 차이만 표시한다.
- 카운트다운은 시간대가 포함된 시작 시각과 현재 시각의 차이로 계산한다. 화면에 표시하는 설정은 알림 설정과 별개이며, 카운트다운 표시만 켜도 알림 권한을 요청하지 않는다.
- 종료 시각이 있는 기간 bar는 시간 경과율을 뜻하고, 하위 체크리스트 완료 상태는 별도 텍스트로 표시한다. 앱 복귀 시 남은 시간을 다시 계산하며 시간을 누적 감소시키지 않는다.
- 화면 읽기 도구에 매초 바뀌는 텍스트를 반복 공지하지 않는다. 시작·진행·종료 단계가 바뀔 때 상태를 알린다.

## 현재 제공하는 기기 알림

사용자 결정에 따라 알림 전체 스위치와 항목별 시간을 제공한다. 전체 설정과 항목별 설정은 이 브라우저의 `localStorage`에만 저장된다. **기본은 꺼짐**이며, 새 항목의 알림도 기본 꺼짐이다. Firebase 데이터 타입, Firestore Rules, 동기화 revision에는 알림 값을 넣지 않는다.

- 전체 켜기: 설정 화면에서 사용자가 직접 켠 경우에만 브라우저 알림 권한을 요청한다. 취소·거부 상태는 알림을 활성화하지 않는다.
- 항목별 시점: 알림 끔, 기준 시각, 10분 전, 1시간 전, 24시간 전 중 고른다.
- 알림 기준 시각: `window`는 시작, `task`/`deadline`은 기한·종료다. 이벤트 알림은 지원하지 않는다. 날짜만 있는 항목은 해당 항목 시간대의 09:00을 기준으로 삼으며 기본 입력 시간대는 사용자 설정의 앱 시간대(`Asia/Seoul`)다.
- 알림은 미리보기가 열린 동안 10초 간격으로 확인한다. 설정 시각부터 최대 60초 안에 확인한 알림만 전달하고, 앱을 닫았거나 기기가 절전 중이어서 놓친 과거 알림은 앱 복귀 후 재생하지 않는다.
- 이 방식은 browser `Notification` API를 사용한다. API 표준은 사용자 허가가 주어진 경우에 알림을 표시하도록 정의한다. [Notifications API Standard](https://notifications.spec.whatwg.org/).

**이 버전은 예약 보장을 제공하지 않는다.** 앱을 닫은 상태의 알림, 서비스 워커의 로컬 예약, Web Push, FCM, 서버 cron/Functions는 현재 범위가 아니다. 브라우저 권한과 운영체제 알림 설정은 사용자가 제어한다.

## 후속 알림 기능

실사용에서 앱을 닫은 뒤에도 알림이 필요한지 확인한 다음, 기기 로컬 예약과 서버 알림 중 전달 방식을 설계한다. 알림의 전달 시각을 보장하는 표현은 피하고 권한·절전·집중 모드·네트워크에 따른 지연과 누락 상태를 노출한다.

### 네이티브 로컬 알림

macOS/iOS 설치 앱의 닫힌 상태 예약이 필요해지면 TypeScript + Expo/React Native를 후보로 검토한다. 기기 예약은 서버 푸시와 달리 계정의 여러 기기에 즉시 일치하지 않는다. OS 권한, Focus, 일정 수정·삭제에 따른 알림 취소, 오프라인 변경과 예약 수평선을 실기기에서 확인한다. [Apple 로컬 알림 예약](https://developer.apple.com/documentation/usernotifications/scheduling-a-notification-locally-from-your-app), [Expo Notifications](https://docs.expo.dev/versions/v56.0.0/sdk/notifications/).

### Web Push와 서버 예약

Web Push는 제품·비용 결정을 거친다. Apple은 iOS/iPadOS 16.4 이상에서 홈 화면에 추가한 web app의 Web Push 지원을 설명한다. 브라우저 지원, 사용자 권한과 best-effort 전달 시각을 함께 검증한다. [Apple Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [FCM `isSupported`](https://firebase.google.com/docs/reference/js/messaging#issupported).

Firebase Cloud Functions 배포에는 Blaze가 필요하다. 실제 프로젝트에 결제 연결, 발송량·비용 한도, 토큰 수명, 삭제·로그아웃 시 토큰 정리, 중복 방지, 재시도와 지연 표기를 따로 설계하고 사용자 비용 선택을 받은 뒤에만 착수한다. [Firebase Functions 시작 안내](https://firebase.google.com/docs/functions/get-started), [Firebase 요금제 비교](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans?hl=EN&rd=1&visit_id=638920144206502039-1497185943).

## 검증 기준

- 카운트다운의 기본 1일, 끄기, 0일, 30일 경계와 `Asia/Seoul`의 D-Day·시·분·초 전환을 확인한다.
- 전체 기기 알림은 기본 꺼짐이며, 항목별 설정을 골라도 권한을 요청하지 않는다. 설정에서 전체 알림을 켤 때만 권한 흐름이 시작된다.
- 브라우저 알림 미지원·권한 거부·미결정 상태에서 데이터는 보존하고 켜짐으로 표시하지 않는다.
- 시작·마감 시각과 10분/1시간/24시간 전 규칙이 한 번씩만 표시되고, 완료된 항목은 알리지 않는다.
- 날짜만 있는 항목의 기준은 항목 시간대 09:00이다. 시작·마감 시각이 있는 항목은 정확한 instant를 쓴다.
- 앱을 닫은 상태에서 전달을 주장하지 않는다. 재실행 후 지난 알림을 재생하지 않는다.
- local-only reminder 값은 Firebase 저장·동기화·프로필 계정 범위와 혼동되지 않는다고 UI와 문서에 표시한다.

## 기록·보안 원칙

Firebase 알림 스키마·token collection과 서버 키는 현재 범위에 추가하지 않는다. 일정 제목·연구 주제·메모를 analytics나 진단 로그에 넣지 않는다. 브라우저 알림 내용에는 제목과 남은 시점만 사용하고 메모·외부 링크는 표시하지 않는다.
