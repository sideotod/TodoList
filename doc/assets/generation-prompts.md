# 시안 생성 프롬프트와 실행 기록

첫 라운드 생성일: 2026-10-03 · Product Design ideate와 내장 Image Gen 사용. 기존 프롬프트는 보존하고 아래에 최신 월간 홈 라운드를 추가했다.

프롬프트와 참고 경로를 재현 자료로 보존한다. 영어 생성 요청은 한국어 제품 계약을 대신하지 않는다. 첫 월간 홈 라운드에는 TodoMate 화면 두 장과 기존 시간표 이미지를 붙였고, 후속 정리 라운드에서는 직전 결과를 편집한 경우와 독립 생성한 경우를 각 항목에 표시한다. 배경은 모두 불투명으로 생성했다.

## 주간 학기 플래너

```text
Create realistic, production-quality UI designs with clear hierarchy, strong typography, intentional imagery, and purposeful spacing.
Use case: ui-mockup. Concept direction name: 주간 학기 플래너. Create a new original Korean university/graduate-student calendar PWA primary desktop screen, inspired by the attached reference images' ability to show a calendar and a task list at the same time. The references are MOODBOARD ONLY, not edit targets: do not copy brand, social profiles, screenshot device/background, dates, names or content.
Target dimensions EXACTLY 1440 x 1024. App content only, edge-to-edge base surface; no desktop computer hardware, no browser chrome, no fake centered app window/card.
Goal: see this week's fixed schedules while noticing the next application opening and submission deadline. One clear primary action: '+ 일정 추가'. Keep the hero weekly calendar about 68% of main area and one compact supporting right rail for upcoming time-sensitive events and today's short task list. No card nesting, no KPI dashboard, no graphs, no advertisements, no AI, no social, no billing, no extra feature inventory.
Design system: cool off-white base, restrained navy typography, cobalt primary accent, minimal soft pastel course fills, subtle warm amber for opening times. Readable Korean system-sans-like text (14-16px body), crisp small line icons, strong alignment, sparse borders, minimal shadows. Light and practical academic planner, generous whitespace.
Header: neutral working name '캘린더', week range '9월 28일 – 10월 4일', small '오늘' and week/month switch, understated '동기화 완료', primary add button. Left slim navigation: '캘린더', '할 일', '설정' only.
DATE ANCHOR: Today is Saturday 2026-10-03, Asia/Seoul, example current time 09:40. The actual containing week has 월9/28 화9/29 수9/30 목10/1 금10/2 토10/3 일10/4. Mark today Saturday10/3. Show few plausible past classes on Monday/Wednesday and Friday, a small Saturday '논문 초안 정리' block at14:00, avoid clutter. Header reflects the real week.
Right rail '곧 시작': '연구실 장비 신청', '오늘 10:00 시작', '시작까지 20분'; link/action '신청 페이지'. Below '다가오는 마감': '논문 초안 제출', '10월 9일 18:00', 'D-6', very small elapsed-duration bar with text '기간 70% 경과 · 6일 남음' (period 9/19 18:00 to10/9 18:00). This is TIME ELAPSED, never work completion. Then a very short '오늘 할 일' with two checkbox rows '참고문헌 정리' and '과제 제출 파일 확인'. Example content only, no claims that real registration occurs today.
Prioritize spacing, grouping, alignment, typography; dividers before surface tint, borders sparingly, shadows last. No clipped content, no crowded cards, no fonts below legibility. One coherent design only, no alternatives within one image, no numeric option labels. No OS widgets or background push status: Spark v1 only supports in-app time awareness. Show screen with polished production quality.
```

## 월간 캠퍼스 캘린더

```text
Create realistic, production-quality UI designs with clear hierarchy, strong typography, intentional imagery, and purposeful spacing.
Use case: ui-mockup. Concept direction name: 월간 캠퍼스 캘린더. Generate one original Korean university/graduate-student calendar PWA primary desktop screen. Attached real product images are moodboard references ONLY for calendar + task coexistence, NOT edit targets. Do not copy reference branding, social/avatar nav, hardware, centered app-window background, dates or example names.
Target dimensions EXACT 1440 x 1024, 1.40625:1 landscape. App content only, no browser/OS/device chrome. Use an edge-to-edge warm ivory base surface, soft forest green primary accent, editorial charcoal Korean typography, warm small amber for opening times. Clean lightweight campus planner, subtly warmer visual language than blue time-grid apps.
Focused hero use case: see a whole month's dates and nearby submission/application times simultaneously. One clear primary action '+ 일정 추가', only supporting calendar navigation and event link. No AI, billing, social, analytics, statcards, photos, fake icons, decorative illustrations, widget ads. Strong typography 14–16px body, no clipped text, roomy cells, restrained separators, no cards within cards and no every-row card/shadows.
Layout: slim top product header '캘린더', modest tabs '캘린더' and '할 일'; second header '2026년 10월' with previous/next, '오늘', '월 / 주'. Dominant monthly calendar about 75% width, right 290px clean upcoming rail. Thin separators, color-coded short event labels. Bottom of rail just two checkbox task rows. Prefer whitespace/grouping over bordered panels.
DATE ANCHOR: Today is Saturday 2026-10-03, Asia/Seoul, illustrative time09:40. Monday-first month grid must have these exact weekday/date pairs and rows: 월 화 수 목 금 토 일; first row9/28 9/29 9/30 10/1 10/2 10/3 10/4; next row5 6 7 8 9 10 11; then12 13 14 15 16 17 18; then19 20 21 22 23 24 25; then26 27 28 29 30 31 11/1. Mark Saturday3 as today with restrained filled green circle. Muted September trailing/November1 dates. Few events only: Oct3 '장비 신청 10:00'; Oct9 '논문 초안 18:00'; Oct16 '과제 제출'; Oct21 '세미나14:00'. Make dates and labels readable.
Right rail '곧 시작': '연구실 장비 신청', '오늘 10:00', '20분 후 시작', small link '신청 페이지'. Next '다가오는 마감': '논문 초안 제출', '10월9일18:00', 'D-6', an unobtrusive time-elapsed bar '기간68% 경과 · 6일 남음' with start9/19 18:00 and end10/9 18:00. This is elapsed time, NOT work-completion percentage. Final two light task rows under '오늘 할 일': '참고문헌 정리', '과제 제출 파일 확인'. Small header '동기화 완료'. All visible event data is clearly ordinary mock content, no vendor logos or claims real academic windows exist today.
One cohesive screen, no multiple alternatives, no numeric option labels. Do not cram a feature inventory. Purposeful spacing and natural viewport ratio.
```

## 차분한 시간표

```text
Create realistic, production-quality UI designs with clear hierarchy, strong typography, intentional imagery, and purposeful spacing.
Use case: ui-mockup. Concept direction name: 차분한 시간표. Design a new original Korean university/graduate student calendar PWA desktop primary screen. Attached real product screenshot references are moodboard ONLY for calendar/task coexistence, not editing targets. Do not copy branding, avatars, social navigation, wallpaper, existing screenshot dates or example names.
Target dimensions EXACTLY 1440 x 1024. Edge-to-edge app content only, no computer hardware, no browser or OS chrome, no centered floating app card. One coherent design, no multiple alternatives or numeric option labels.
Goal: calmly understand the real current week, the nearest application opening and a submission deadline, with one clear '+ 일정 추가' primary action. Different layout from a dense hourly calendar: a spacious, full-width weekly calendar of seven vertical day columns across the upper two-thirds of the content. Each day column is a date-based agenda calendar, with only two or three timestamped rows, not a Kanban status board. No hourly grid. Beneath the calendar, a horizontal grouped area places upcoming opening/deadline text on the left and today's two checkbox tasks on the right. Thin separators and typography, not a card dashboard.
Visual system: near-white neutral base, graphite text, restrained dusty lavender accent for today and primary button, muted copper orange for urgent opening. Spacious margins, no heavy borders or shadows, no nested cards, no KPI widgets, analytics, AI, social, pricing, decorative imagery. Body text 14–16px, strong legible Korean sans typography, aligned time and titles.
Slim header: '캘린더', date range '9월 28일 – 10월 4일', '오늘', '주 / 월', small '동기화 완료', '+ 일정 추가'. Minimal top navigation '캘린더', '할 일'. A secondary quiet subtitle '이번 주' precedes the weekly date columns.
DATE ANCHOR: Today is Saturday 2026-10-03 in Asia/Seoul, illustrative current time09:40. Real containing week columns: 월9/28, 화9/29, 수9/30, 목10/1, 금10/2, 토10/3, 일10/4. Mark today Saturday10/3 with a small lavender highlight. Few plausible sample calendar entries: Monday10:00 '연구 세미나', Wednesday14:00 '통계학 수업', Friday11:00 '지도교수 면담', Saturday10:00 '연구실 장비 신청' and Saturday14:00 '논문 초안 정리'; other days show spacious empty space. Example entries only, no claim these are real academic notices.
Bottom supporting area heading '임박 일정': emphasize '연구실 장비 신청', '오늘10:00 시작', '시작까지20분', subtle underlined '신청 페이지'. Next row '논문 초안 제출', '10월9일18:00 · D-6', small thin duration bar and exact caption '기간68% 경과 · 6일 남음', period9/19 18:00–10/9 18:00. Duration means elapsed time, never task-completion percentage. Two checkbox rows under '오늘 할 일': '참고문헌 정리', '과제 제출 파일 확인'. Keep all lower content concise, grouped with whitespace and minimal separators.
No feature inventory, no extra badges, no fake notification delivery guarantees. Spark v1 supports foreground in-app reminders only. Prioritize spacing, grouping, alignment and typography before tint/borders/shadows. Natural aspect ratio, no stretched type and no clipping.
```

주간 시안 프롬프트의 `70%`는 예시 계산 오류다. 동일 날짜·시각의 올바른 정수 반올림 경과율은 `68%`이며, 이후 프롬프트와 제품 사양에는 이를 반영했다. 실제 구현은 02의 수식과 06의 시간 테스트를 기준으로 한다.



## 최신 라운드 — 월간 할 일 홈

최신 세 호출은 순서대로 독립 실행했다. 모든 호출의 실제 참고 이미지 경로는 다음 세 개였다.

- /Users/changmin/Desktop/projects/TodoList/doc/assets/references/todomate-desktop-calendar-tasks.webp
- /Users/changmin/Desktop/projects/TodoList/doc/assets/references/todomate-desktop-month.webp
- /Users/changmin/Desktop/projects/TodoList/doc/assets/concepts/03-calm-timeboard.png

현재 날짜 anchor는 2026-10-03 토요일 09:40, Asia/Seoul이다. 목표 크기는 각 1440×1024, transparent_background은 false다. 생성 결과는 모두 1487×1058이었다.

### 월간 집중형

    Create a realistic, production-quality Korean desktop web-app UI concept, 1440 x 1024, for a student-focused monthly task planner with D-Day period tracking. Current date anchor: Saturday, October 3, 2026, Asia/Seoul. The attached two TodoMate screenshots are layout references only: use the recognizable information structure of a compact month grid on the left and the selected day's task list on the right, with a slim horizontal social/friends strip at the top replaced entirely by time-sensitive period progress summaries. Do not copy any brand, avatar, names, colors, wallpaper, device frame, or sample content. The attached third image is palette mood only: calm muted lavender and pale lilac accents, graphite text, white/light warm-gray surfaces, restrained dividers.

    Direction name: 월간 집중형.
    Make the month task grid the clear hero and primary product surface. Keep a clean top header with app title '하루', navigation '홈' active and '캘린더', month title '2026년 10월', previous/next and today controls, and one primary '+ 할 일 추가' action. Immediately below the header, replace the old friends strip with a calm horizontal '기간 진행' band containing two concise items: '국가연구과제 신청' with an elapsed-time bar and caption '기간 68% 경과 · 6일 남음', plus '수강신청 오픈' with an exact countdown '08:00' and a small clear start-time label. The progress bar means only elapsed calendar time. Beside the first bar show the distinct text '미완료(2/3)' meaning two remaining checklist items of three; show the tiny checklist as an indicator, not a second bar. Do not make period items appear in the monthly task cells.

    Below, show a spacious October 2026 Monday-first monthly grid with accurate dates/weekdays and small daily task labels/check states inside date cells, selected day October 3 highlighted. The right rail shows '10월 3일 오늘 할 일' with two realistic Korean student task checkbox rows. No event clutter, no social features, no AI, no billing, no advertising, no made-up onboarding. Use natural hierarchy and generous space, not a wall of cards. Ensure Hangul is legible, dates are accurate, and all visible content fits naturally without clipping.

### 학기 리듬 보드

    Create one realistic, production-quality Korean desktop web-app UI design, 1440 x 1024, for a university/graduate student task planner. Current date anchor is Saturday, October 3, 2026 at 09:40, Asia/Seoul. Use the attached TodoMate screens only as composition references: top horizontal area that used to show friends becomes a student deadline/progress summary; the central experience is a Monday-first monthly task grid and a selected-date checklist. Use the attached third concept only as a palette reference: muted lavender/lilac, graphite typography, white and very light warm-gray, thin dividers. Do not copy brands, avatars, wallpaper, devices, existing dates or text.

    Concept name: 학기 리듬 보드.
    Make the top time-sensitive summary band visually calm and easy to scan, with a compact heading and two grouped rows rather than a large dashboard. One period item is '논문 초안 제출', from Sep 19 18:00 to Oct 9 18:00, and its slim bar must say exactly '기간 68% 경과 · 6일 남음'. Its child checklist status is '미완료(2/3)' where exactly TWO of three subtasks remain unchecked; show one checkmark and two empty boxes if boxes appear. The bar represents elapsed time only and must remain visually separate from child-task completion. The second period item is '수강신청 본신청', opens TODAY Oct 3 at 09:48; with current time 09:40, show a compact second-accurate countdown '08:00' plus '오늘 09:48 시작'. The threshold format in the product is MM:SS below ten minutes.

    Below the summary band, set a balanced two-column TodoMate-like workspace: broad October 2026 monthly grid with concise day-task labels in date cells, and a narrower right column headed '10월 3일 오늘 할 일' with a short actionable checklist. Do not show period items inside date-cell tasks. Use actual October 2026 calendar weekday alignment, today/selected date October 3 (Saturday) visibly marked. Header: product name '하루', '홈' active, '캘린더' as secondary route, '2026년 10월', previous/next, today, and one strong '+ 할 일 추가' action. Prioritize usable tasks over decorative scheduling. Generous spacing, restrained grouping, no nested cards, readable Hangul, no clutter, all content fits without clipping.

### 월간 작업대

    Design a single realistic Korean desktop web-app screen, 1440 x 1024, for a student monthly todo planner with period countdown/progress. Date anchor: Saturday, October 3, 2026, 09:40 in Asia/Seoul. Use the attached TodoMate desktop screenshots as composition inspiration only: monthly date cells containing daily tasks, the top strip that used to be friends repurposed for period progress, and selected-day task access. Use the attached 'calm timeboard' only for its muted lavender palette. Do not copy exact branding, avatars, social mechanics, wallpaper, device, or existing wording.

    Concept name: 월간 작업대.
    Make the month task calendar unmistakably dominant across nearly the full content width; place the selected day's task checklist in a shallow full-width work strip beneath the grid rather than a tall right-side column. The top summary band should replace the old social/friends row with one strong but restrained start countdown and one smaller deadline progress item:
    - '수강신청 본신청', starts Oct 3 09:48; current time 09:40, exact large countdown '08:00' and '오늘 09:48 시작'.
    - '논문 초안 제출', Sep 19 18:00 – Oct 9 18:00; time elapsed only, '기간 68% 경과 · 6일 남음'. Place beside it the separate child status '미완료(2/3)' meaning two of three children remain incomplete; if boxes are depicted, exactly one is checked and exactly two are unchecked. Never blend checklist completion into the duration bar. Period items must not appear in date-cell task lists.

    Header says '하루', with '홈' active and '캘린더' as the separate secondary page; show month '2026년 10월', previous/next, today, and one prominent '+ 할 일 추가'. Use a Monday-first October 2026 grid and correct weekday/date pairing, selected today October 3 Saturday. Put concise checkbox-like daily task labels in a few monthly cells; fixed appointments are omitted from this home task grid and reserved for the separate calendar page. Beneath the calendar, show '10월 3일 · 오늘 할 일' and two clear task rows with checkboxes. Preserve open airy rhythm despite the broad grid. Premium-quality spacing, lavender accent, graphite text, delicate lines, minimal surface tint, readable Korean typography, all visible content fits naturally without clipping; no analytics dashboard, no decorative feature inventory, no nested cards, no social feed, no AI or billing.


## 피드백 반영 라운드 — 간결한 무테두리 월간 홈

생성일: 2026-10-03 · 1440×1024 데스크톱 · Asia/Seoul. 사용자는 직전 세트의 두 번째 월간 구성을 선택했다. 이 라운드는 기간 바 양 끝 날짜/시각만 보이기, 진행 영역 체크박스 삭제, 시작 카운트다운 중복 제거, 앱 이름/검색 헤더 제거, 중앙 아이콘 전용 하단 내비게이션, 여백 기반 무테두리 화면을 공통 제약으로 한다. 저장 위치/최종 표시명은 [자산 인덱스](README.md)를 따른다.

첫 최종 정리 이미지는 중복 문구와 선을 제거하기 위해 직전 탐색 이미지 하나를 붙여 편집했다. 나머지 두 장에는 정리된 방향 이미지와 TodoMate 월간 캡처 `references/todomate-desktop-month.webp`, 기존 라벤더 시간표 `concepts/03-calm-timeboard.png`를 함께 첨부했다. 아래 프롬프트 블록은 반복 가능한 핵심 요청을 보존한다.

### 경계 없는 월간 — 편집 프롬프트

```text
Edit the attached previously generated 1440x1024 Korean student planner UI. Preserve the same overall composition: two concise period rows at top, a large October 2026 month calendar on the left, selected-day task list on the right, and a centered icon-only bottom navigation. This is a cleanup pass based on direct user feedback.

Remove the text '기간 68% 경과 · 6일 남음' completely. The period bar is self-explanatory. For each period, show only its title, the bar, start date/time at the bar's left end, end date/time at the right end, and (for the deadline with subtasks) plain text '미완료 (2/3)' with no checkbox. Keep exactly one '08:00' countdown integrated near the upcoming application's bar start. Do not repeat '시작 예정', start time, countdown, progress percentage, remaining days, descriptive subtitle, or explanatory copy elsewhere in that row. Keep one '종료일 미정' at the bar end for the application whose end is unknown.

Remove all card borders, panel boundaries, vertical divider rules, background fills inside sections, shadows, and all individual calendar cell borders. Use one uninterrupted pale near-white lavender canvas. Separate month, daily tasks, and progress rows by generous whitespace and typography only. In the month calendar, remove the boxes around each date; retain weekday alignment and date placement with very subtle tiny task dots only. Keep the existing selected date visually identifiable through a soft lavender text/dot emphasis, not a bordered square. No app header, app name, search, notifications, profile, labels under navigation, or extra add buttons. Keep only one plus icon beside the selected-day list heading and only two centered unlabeled nav icons (home/calendar) at the bottom. Preserve concise Korean text and the exact October 2026 weekday/date arrangement. No additional metrics or duplicate information.
```

### 한 줄 타임라인 — 독립 생성 프롬프트

```text
Generate one independent desktop UI concept at 1440×1024 for a Korean university student task calendar. Use the attached refined iteration as strict visual and information-architecture grounding, along with the clean TodoMate month screenshot and muted lavender palette reference. Preserve a compact progress area at top, broad monthly task calendar on the left, selected-day task list on the right, centered icon-only bottom navigation.

Each period is one clean horizontal timeline row: short title left; one generous slim bar in the middle; start date/time at its left endpoint and end date/time at its right endpoint; concise plain-text checklist state far right only for the deadline. No standalone percentage, remaining-days metric, checklist checkboxes in the progress area, duplicate countdown or repeated status. For the not-yet-started application, integrate exactly one '08:00' countdown beside the bar's start marker; no second start time or '시작 예정' message. If no end is known, show '종료일 미정' once at the right endpoint.

Keep actual task checkboxes in the selected-day task list. Add only one small plus icon beside that list title. Remove app title, top app header/navigation rows, search, profile and notifications. Bottom center has only home and calendar icons, one selected in lavender, with no visible text labels.

Use mock data anchored 2026-10-03 Saturday 09:40 Asia/Seoul, correct Monday-first October 2026 layout. Periods: 논문 초안 제출, 9월 19일 18:00–10월 9일 18:00, about 68% bar fill and '미완료 (2/3)'; 수강신청 본신청 begins 10월 3일 09:48, end unknown, one 08:00 countdown. Selected date tasks: 연구실 장비 신청, 논문 초안 정리, 지도교수 면담 준비.

Use one nearly white lavender canvas, graphite type and restrained lavender accents. No cards, panels, outlines, boxes, shadows, separate backgrounds, calendar cell borders or visible column divider. Use whitespace, alignment, typography and tiny task dots. Clean TodoMate-like month view, readable Korean, no extra labels/features/metrics, no clipped content.
```

### 캘린더 우선 캔버스 — 독립 생성 프롬프트

```text
Create a distinct desktop concept at 1440×1024 for a Korean student monthly task planner. Use the attached simplified month-first concept as the selected structural direction and ground calendar styling in the TodoMate monthly screenshot. Keep the muted lavender/graphite palette.

Prioritize the month calendar: the selected-day task list is a quiet narrow right column; October occupies most of the page. At top show only two light, unboxed period rows. Each row has a short title, clean progress track, and start/end labels aligned to the exact track endpoints. For 논문 초안 제출 show 9월 19일 18:00 to 10월 9일 18:00 and plain text '미완료 (2/3)' as separate checklist state; no checkboxes in the period summary. Do not show elapsed percent, remaining days, extra date summary or descriptive text. For 수강신청 본신청 show exactly one '08:00' countdown beside its starting marker, start 10월 3일 09:48 on the left, and '종료일 미정' once at the right. The empty track communicates not started; do not duplicate its status.

No app name, header bar, search, notifications/profile controls, or text labels beneath navigation. Put only centered home/calendar outline icons at bottom, home selected in lavender. No global add button: one small plus only by the selected-day list heading. Task checkboxes only in that list.

Use date anchor 2026-10-03 Saturday 09:40 Asia/Seoul, correct Monday-first October 2026 placement, selected October 3. Selected-day tasks: 연구실 장비 신청, 논문 초안 정리, 지도교수 면담 준비. Dates use open alignment and tiny task dots; no individual square cells or visible grid lines. Selected date gets soft lavender text/circle tint without border.

Use a single nearly-white lavender background, graphite type and restrained accents. No boxes, cards, panel fills, outlines, shadows, strong dividers or contrasting backgrounds. Separate sections by typography, whitespace and alignment. No extra metrics, repeated labels, decorative imagery, invented features or clipped text.
```
