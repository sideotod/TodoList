# 구현 기준 Figma 자산

조회·저장일: 2026-10-05 · 기존 사용자 편집 홈과 별도의 컴팩트 데스크톱 화면을 함께 기준으로 한다.

| 파일 | 출처 | 확인 규격·용도 |
|---|---|---|
| [figma-home-desktop.png](figma-home-desktop.png) | [Figma 7:4](https://www.figma.com/design/o81oyODBLYZuzBAkKcWqgp?node-id=7-4) | 1440×1024 PNG · 구현 시 배치/스타일 비교용 |
| [figma-home-ios.png](figma-home-ios.png) | [Figma 7:247](https://www.figma.com/design/o81oyODBLYZuzBAkKcWqgp?node-id=7-247) | 390×844 PNG · 모바일 배치 비교용 |
| [figma-desktop-reference.txt](figma-desktop-reference.txt) | 같은 데스크톱 프레임의 고정밀 design context | React/Tailwind 형태의 조회 결과; 앱 소스가 아닌 레이어/실측 참고 |
| [figma-ios-reference.txt](figma-ios-reference.txt) | 같은 iOS 프레임의 고정밀 design context | 대응 구조/간격 참고; 앱 코드는 TypeScript/CSS Modules로 작성 |
| [figma-source/](figma-source/) | 두 Figma 프레임의 원본 SVG vector layer | home/calendar/profile 아이콘, 선택 날짜, 체크 마크, 날짜 점, 기간 시작 레일. 제공된 SVG의 표기 크기를 보존 |
| [figma-home.svg](../../../public/design/figma-home.svg), [figma-calendar.svg](../../../public/design/figma-calendar.svg), [figma-settings.svg](../../../public/design/figma-settings.svg) | Figma compact desktop Components의 vector layer | 아이콘 전용 하단 탐색용 SVG |
| [figma-hamburger.svg](../../../public/design/figma-hamburger.svg), [figma-period-expand.svg](../../../public/design/figma-period-expand.svg), [figma-task-drag-handle.svg](../../../public/design/figma-task-drag-handle.svg) | Figma compact desktop Components의 vector layer | 상단 메뉴, 기간 오버레이 펼침, task 재정렬용 SVG |
| [figma-add.svg](../../../public/design/figma-add.svg), [figma-month-previous.svg](../../../public/design/figma-month-previous.svg) | Figma compact desktop Components의 vector layer | 일일 할 일 추가와 월 이동용 SVG. 다음 달은 이전 달 벡터를 좌우 반전한다. |
| [컴포넌트 매핑](../component-mapping.md) | Figma page 70:391 및 새 compact screen page 114:713 | C-01–C-33 노드 ID, 코드 책임, 검수 캡처 경로 |

PNG는 Figma 원본 프레임 내보내기다. 정적 비교 자료를 앱 화면에 붙이지 않는다. `figma-source/`의 SVG는 같은 프레임에서 직접 내려받은 소스이며 실제 앱에는 필요한 파일만 `public/design/`으로 복사한다. 임의 아이콘 패키지나 비슷한 그림으로 대체하지 않는다. desktop/mobile에서 크기가 다른 date fill과 progress rail은 각각 변형 SVG를 쓴다. 참고 텍스트의 일시적 자산 URL은 제거했다.

`public/design/figma-month-next.svg`는 가로 340px인 다른 Figma 요소 export로 확인되어 월 이동 아이콘으로 쓰지 않는다. 앱은 이전 화살표 벡터를 반전해 다음 화살표를 표시한다.

사용자 프레임을 이번 단계에서 수정하지 않았다. 이전 제품 화면·생성 시안·프롬프트는 상위 [시각 자료 기록](../../assets/README.md)에 보존한다. 앱의 D-Day·경과율·요일은 해당 Figma 예시 문자열 대신 정확한 날짜와 clock fixture로 계산한다.
