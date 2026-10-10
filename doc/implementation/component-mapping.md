# 구성요소 ↔ Figma ↔ 코드 매핑

작성 기준: 2026-10-05 · 설계 기준: 승인된 07 컴포넌트 시스템 · 실행 계획: 08 데스크톱 UI · 코드 갱신 후 시각 검수 대기

이 표는 Figma 구성요소를 먼저 확정하고 같은 책임의 코드 구성요소를 구현·검수하기 위한 추적 문서다. 구현된 것으로 표시하지 않은 항목은 Figma 또는 코드 작업이 남아 있다. 사용자가 편집한 기존 프레임은 참고 원본이며 수정·복제하지 않는다.

현재 앱 코드 변경 이후의 최신 `1000×780` 화면 캡처는 아직 생성하지 않았다. `ui-audit/evidence/`의 `*-after.png`와 `assets/verification/` PNG는 이전 화면 상태의 기록이므로 최신 화면과 대조한 검수 증거로 사용하지 않는다. 최신 코드 감사와 Figma에서 남은 시각 차이는 [09 UI 검토·구성요소 동작 문서](09-ui-audit-and-component-behavior.md)에 기록한다.

## 기준 Figma와 시각 토큰

- 파일: [하루 디자인](https://www.figma.com/design/o81oyODBLYZuzBAkKcWqgp)
- 사용자가 편집한 홈: [Home / Monthly Tasks · Desktop — 3-card board alternative](https://www.figma.com/design/o81oyODBLYZuzBAkKcWqgp?node-id=84-467), 1440×930. 기간 요약 영역 84:468은 1312×80이며 카드 84:977, 84:963, 84:970의 폭은 약 426px다. 월간 작업 영역은 84:496/84:498이고 폭 1312px다.
- 기간 목록 열림 원본: [Period overflow overlay](https://www.figma.com/design/o81oyODBLYZuzBAkKcWqgp?node-id=84-584), 1440×930. 패널은 현재 보드의 콘텐츠 위에 떠 있으며 보드의 레이아웃을 밀지 않는다.
- 컴포넌트 페이지: [Desktop Refined / Components](https://www.figma.com/design/o81oyODBLYZuzBAkKcWqgp?node-id=70-391).
- 구성요소 증거: 날짜 셀 70:392/396/401, progress rail 70:405, task row 70:410/413, 기간 단계 세트 71:549, + 버튼 세트 71:574, 하단 탐색 세트 71:592.
- 현재 코드 토큰과 일치하는 Figma 변수: 흰색 #FFFFFF, 기본 글자 #211F30, 보조 글자 #596178, 흐린 글자 #A1A6B8, 보라색 #6E4DF5, 트랙 #E8E8F2, 컨트롤 외곽선 #8F96AD. CSS 원본은 src/styles/tokens.css다.
- 확인된 간격 변수: 0, 8, 12, 16, 24, 48, 80, 112. Noto Sans KR 계열 글꼴과 기존 SVG가 실제 파일에서 확인됐다.
- 컴팩트 구현 규격은 1000×780 창, 최대 840px 콘텐츠 폭이다. 기존 디자인 1440×930 보드의 고정 크기를 이 기준에 맞는 것으로 간주하지 않는다. 새 프레임으로 컴팩트 화면을 별도 작성한다.
- Figma Community의 macOS 라이브러리는 기본 버튼·팝오버 참고에 그친다. 밀도, 흰 배경, 라벤더 색, 기간 카드 형태가 다르므로 라이브러리를 가져와 기존 시각 체계를 바꾸지 않는다.

## 구성요소 추적표

| ID / 구성요소 | Figma 기준·현재 노드 | 구현 소유 코드 | 검수 증거 | 상태 |
|---|---|---|---|---|
| C-01 DesktopCanvas | 1000×780 컴팩트 페이지 [프레임 114:714](https://www.figma.com/design/o81oyODBLYZuzBAkKcWqgp?node-id=114-714), 홈 [114:752](https://www.figma.com/design/o81oyODBLYZuzBAkKcWqgp?node-id=114-752) | src/features/shell/AppShell.tsx, AppShell.module.css | 최신 캡처 대기 | 프레임과 코드 구현 완료, 최신 시각 검수 대기 |
| C-02 HomePeriodBoard | 원본 84:468; 컴팩트 component 106:722 | src/features/home/PeriodProgressSummary.tsx, PeriodProgressSummary.module.css | 최신 캡처 대기 | Figma component 생성 완료 |
| C-03 PeriodCard | 원본 84:977/963/970; 컴팩트 예정 102:722, 102:729, 102:736 | src/features/home/PeriodCard.tsx, PeriodCard.module.css | 최신 캡처 대기 | 예정·진행·종료 component 생성 완료 |
| C-04 PeriodPhaseBar | rail 70:405, 단계 세트 71:549; compact 106:746/751/756 | src/features/home/PeriodCard.tsx, PeriodCard.module.css | 최신 캡처 대기 | 세 단계와 endpoint 생성 완료 |
| C-05 PeriodExpandControl | 원본 화살표 84:988, 기존 SVG public/design/progress-expand-chevron.svg; compact 106:761 | src/features/home/PeriodProgressSummary.tsx, PeriodProgressSummary.module.css | 최신 캡처 대기 | SVG/버튼 component 생성 완료 |
| C-06 PeriodOverflowOverlay | 원본 84:584 / panel 84:1004; compact 106:765; 화면 114:968 | src/features/home/PeriodOverflowOverlay.tsx, PeriodProgressSummary.module.css | 최신 캡처 대기 | 3열/덮개·Escape·바깥 클릭·초점 제한·복귀 구현, 시각 검수 대기 |
| C-07 TopActionMenu | compact menu 103:751; hamburger icon 103:734; 화면 114:1202 | src/features/home/TopActionMenu.tsx, TopActionMenu.module.css | 최신 캡처 대기 | SVG/열림 component 생성 완료 |
| C-08 DailyTaskAddButton | + 변형 71:574; compact 103:754; 화면 114:752 | src/features/home/SelectedDayTasks.tsx, SelectedDayTasks.module.css | 최신 캡처 대기 | 기존 원형 +와 Figma icon 사용 |
| C-09 MonthHeader | 홈 월간 영역 84:498, compact 103:757; 화면 114:752 | src/features/home/MonthHeader.tsx, MonthHeader.module.css | 최신 캡처 대기 | 월 이동 SVG component 구현. 실제 다음 화살표는 이전 화살표 SVG를 좌우 반전 |
| C-10 MonthTaskGrid | 원본 84:498/70:392/396/401; compact 106:810; 화면 114:752 | src/features/home/MonthTaskGrid.tsx, MonthTaskGrid.module.css | 최신 캡처 대기 | 선택·외부 월·task 점 specimen 생성 완료 |
| C-11 SelectedDayTaskList | 원본 84:496 / 7:196; compact 106:882; 화면 114:752 | src/features/home/SelectedDayTasks.tsx, SelectedDayTasks.module.css | 최신 캡처 대기 | 선택일 list component 생성 완료 |
| C-12 TaskRow | 원본 70:410/413; compact 103:763/773, 106:858/869; 기존 SVG check-mark.svg | src/features/home/TaskRow.tsx, TaskRow.module.css | 최신 캡처 대기 | 미완료·완료 상태와 체크 이동 구현 |
| C-13 TaskDragHandle | compact icon component 103:740; 화면 specimen 112:942 | src/features/home/TaskDragHandle.tsx, TaskRow.module.css | 최신 캡처 대기 | 전용 Figma SVG component 생성 완료 |
| C-14 WeeklyCalendarHeader | compact component 110:812; 화면 114:1698 | src/features/calendar/WeekCalendarHeader.tsx, WeekCalendarHeader.module.css | 최신 캡처 대기 | 이전/오늘/다음 주와 기간 목록 이동 구현 |
| C-15 WeekAllDayLane | compact component 110:824; 화면 114:1698 | src/features/calendar/WeekAllDayLane.tsx | 최신 캡처 대기 | 종일/기간/task lane 생성 완료 |
| C-16 WeekTimeGrid | compact component 110:839; 화면 114:1698 | src/features/calendar/WeekTimeGrid.tsx, WeekTimeGrid.module.css, weekly-layout.ts | 최신 캡처 대기 | 7열/시간 눈금·겹침 열·빈 슬롯 추가 구현 |
| C-17 TimedEventBlock | compact component 110:863; 화면 114:1698 | src/features/calendar/TimedEventBlock.tsx | 최신 캡처 대기 | 일정 block 생성 완료 |
| C-18 CalendarDateColumn | compact component 110:866; 화면 114:1698 | src/features/calendar/WeekCalendarView.tsx, WeekCalendarView.module.css | 최신 캡처 대기 | 설정한 주 시작일 기준 7개 날짜 머리 구현 |
| C-19 BottomNavigation | 원본 component set 71:592; compact 110:869; home/calendar/settings icons 103:722/725/730 | src/features/shell/BottomNavigation.tsx, BottomNavigation.module.css | 최신 캡처 대기 | 중앙 아이콘 3개·44px hit target·비활성 중립 색·route 상태 구현 |
| C-20 SettingsSection | compact component 112:823; settings screen 114:1821 | src/features/routes/SettingsSection.tsx, ProfileRoute.module.css | 최신 캡처 대기 | Figma component 생성 완료 |
| C-21 SettingsControl | compact component 112:829; settings screen 114:1821 | src/features/routes/SettingsControl.tsx | 최신 캡처 대기 | Figma component 생성 완료 |
| C-22 NotificationSettings | off component 112:833; settings screen 114:1821 | src/features/routes/LocalNotificationSettings.tsx, LocalNotificationSettings.module.css | 최신 캡처 대기 | 기본 꺼짐 상태 생성 완료 |
| C-23 LocalDataSettings | compact component 112:838; settings screen 114:1821 | src/features/routes/LocalDataSettings.tsx | 최신 캡처 대기 | JSON 백업/복원 안내 생성 완료 |
| C-24 PeriodEditor | 고정 window component 112:842; screen 114:1358 | src/features/items/ItemEditor.tsx, WindowPeriodFields.tsx, ItemTimingFields.tsx, DialogShell.tsx | 최신 캡처 대기 | 시작 countdown 기본값·하위 할 일·신청 완료 구현 |
| C-25 DeadlinePeriodEditor | 고정 deadline component 112:858; screen 114:1528 | src/features/items/ItemEditor.tsx, DeadlinePeriodFields.tsx, ItemTimingFields.tsx, DialogShell.tsx | 최신 캡처 대기 | 선택적 시작일·하위 할 일·제출 완료 구현, countdown 필드 숨김 |
| C-26 DailyTaskEditor | component 112:874 | src/features/items/ItemEditor.tsx, DailyTaskFields.tsx, ItemTimingFields.tsx, DialogShell.tsx | 최신 캡처 대기 | 날짜·시각·날짜 미정 task 입력 구현 |
| C-27 EventEditor | component 112:886 | src/features/items/ItemEditor.tsx, EventFields.tsx, ItemTimingFields.tsx, DialogShell.tsx | 최신 캡처 대기 | 고정 일정 입력·주간 빈 시각 prefill 구현 |
| C-28 ChecklistEditor | component 112:901; form examples 112:842/858 | src/features/items/ChecklistEditor.tsx | 최신 캡처 대기 | 4개 상한/완료 분리 표기 생성 완료 |
| C-29 DialogShell | component 112:908; editor screen 114:1358/1528 | src/features/items/DialogShell.tsx, ItemEditor.module.css | 최신 캡처 대기 | 최초 초점·Tab trap·Escape·닫기 전 변경 확인·원래 초점 복귀 구현 |
| C-30 LocalSaveStatus | Saved/Saving/Error 112:917/920/923 | src/features/shell/LocalSaveStatus.tsx, LocalSaveStatus.module.css | 최신 캡처 대기 | 저장 중/기기에 저장됨/저장 오류를 라이브 상태로 표시 |
| C-31 PeriodList | component 112:926; screen 114:1792 | src/features/calendar/PeriodList.tsx, PeriodList.module.css | 최신 캡처 대기 | 상태별 그룹 및 제목 클릭 편집 구현 |
| C-32 ICSImportControl | 기존 flow ImportControls.tsx/ImportPreview.tsx; component 112:940; screen 114:1698 | src/features/import/LocalICSImportControl.tsx, ImportControls.tsx, ImportPreview.tsx | 최신 캡처 대기 | 로컬 미리보기/선택 저장·오류/중복 표시·Escape·초점 순환 구현 |
| C-33 UndatedTasksRoute | component 112:942 | src/features/routes/TasksRoute.tsx, src/features/tasks/AllTasks.tsx, src/features/home/task-order.ts | 최신 캡처 대기 | 완료 이동·그룹 내 누름 재정렬·키보드·로컬 순서 보존 구현 |

## 공통 SVG와 컴포넌트 결정

확인된 기존 파일은 `public/design/progress-expand-chevron.svg`, `progress-start-not-reached-desktop.svg`, `check-mark.svg`, `event-dot1.svg`, `event-dot2.svg`, `selected-date-fill.svg`, `vector-calendar.svg`, `vector-home-selected.svg`, `user.svg`다. 컴팩트 UI 자산은 `figma-home.svg`, `figma-calendar.svg`, `figma-settings.svg`, `figma-hamburger.svg`, `figma-period-expand.svg`, `figma-task-drag-handle.svg`, `figma-add.svg`, `figma-month-previous.svg`를 사용한다. 다음 달 버튼은 이전 달 Figma SVG를 좌우 반전한다. `figma-month-next.svg`는 340×36의 관련 없는 Figma export이므로 아이콘으로 사용하지 않는다.

Figma 원본 파일의 미리보기는 기존 [홈 PNG](assets/figma-home-desktop.png)와 [iOS PNG](assets/figma-home-ios.png)를 보조 참고로만 사용한다. 최신 구현 화면 캡처와 Figma 프레임을 새로 함께 확인하기 전에는 기존 캡처를 현재 compact 레이아웃 증거로 사용하지 않는다.

컴포넌트 파일 경계는 사용자가 승인한 대로 상호작용 책임별로 둔다. 기간 카드, 오버레이, 햄버거 메뉴, TaskRow/드래그 핸들, 대화상자 shell, 종류별 폼 필드, 주간 시간표 하위 요소, 설정 행은 각각 구별 가능한 모듈로 분리하고 공통 데이터/시간 계산을 복제하지 않는다.
