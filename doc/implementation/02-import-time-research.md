# ICS 가져오기와 시간 입력 조사

확인일: 2026-10-03
기준 문서: [`AGENTS.md`](../../AGENTS.md), [`doc/02-product-spec.md` §7](../02-product-spec.md), [`doc/04-firebase-data-sync.md` §「ICS 가져오기와 시간대」 및 도메인 계약](../04-firebase-data-sync.md)
범위: 공식 규격·프로젝트 문서·공식 라이브러리 동작을 조사하고 구현 계약 후보를 제안한다. 앱 코드와 의존성은 변경하지 않았다.

이 문서는 **공식 사실**과 **TodoList 설계 판단**을 분리한다. 파일 5 MiB, occurrence 2,000개, 미리보기 6개월 기본/12개월 최대, 지원 recurrence 부분집합은 공급자 제한이나 RFC 요구가 아닌 기존 제품 기본값이다. 기존 범위를 줄이지 않는다.

## 확인한 제품 계약과 문서 간 차이

제품 사양은 브라우저에서 ICS 파일을 읽고 선택한 VEVENT occurrence만 저장하며, 파일 5 MiB·고유하게 펼친 occurrence 2,000개·기본 6개월·최대 12개월을 정한다. 지원 RRULE은 DAILY/WEEKLY/MONTHLY/YEARLY, 양수 INTERVAL, COUNT 또는 UNTIL, 주간 plain BYDAY, 월간 양수 BYMONTHDAY, 연간 BYMONTH/BYMONTHDAY, EXDATE다. 존재하지 않는 월 날짜는 건너뛴다. ordinal BYDAY, BYSETPOS, 다중 RRULE, VEVENT RDATE 및 RECURRENCE-ID 예외는 시리즈 오류로 표시한다. 오류가 있는 반복 시리즈에서 기본 occurrence만 몰래 가져오지 않는다.

동기화 문서는 UID와 occurrence key로 identity를 정하고, 아이템 ID를 deterministic hash로 만들며, tombstone/revision/journal/영수증 기반 재시도를 요구한다. 조사 중 발견한 UTC 기반 TZID key의 불안정성을 반영해 기존 04를 **원본 DTSTART 표현을 보존하는 occurrence key**로 갱신했다. 아래 `DATE:…`, `UTC:…`, `TZID=…:…`, `FLOAT=…:…`가 현재 구현 기준이다. 시간대 규칙 데이터 갱신에도 원본 wall time identity를 유지한다.

## 공식 표준 및 라이브러리에서 확인한 사실

### RFC 5545

[RFC 5545](https://www.rfc-editor.org/rfc/rfc5545.html)는 IETF Standards Track 문서로 2009년 9월 발행됐다. 아래 요약은 RFC의 규범적 문구다.

| 주제 | RFC 사실 | 구현에 미치는 영향 |
|---|---|---|
| 날짜·시각 종류 | DATE는 날짜 값이다. DATE-TIME은 UTC(`Z`), TZID가 붙은 local time, 또는 TZID가 없는 floating time일 수 있다. RFC DATE-TIME에서 숫자 offset 표기는 허용하지 않는다. [§3.3.4–3.3.5](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.3.5) | `20261003T090000+0900` 같은 공급자 확장 문법을 추측하지 말고 명시 오류로 둔다. DATE를 UTC 자정으로 바꾸지 않는다. |
| TZID / VTIMEZONE | TZID는 VCALENDAR 안의 대응 VTIMEZONE 정의를 참조하며 RFC는 각 TZID마다 그 정의를 요구한다. TZID가 없는 local DATE-TIME은 floating이다. [§3.2.19](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.2.19), [§3.6.5](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.6.5) | 제품의 UTC/IANA 지원과 RFC의 VTIMEZONE 요구 사이에 상호운용 정책이 필요하다(아래 설계 판단). |
| RRULE 종료 | COUNT와 UNTIL은 함께 쓸 수 없다. COUNT는 DTSTART를 첫 발생으로 센다. UNTIL은 포함 경계다. TZID DTSTART에는 UTC UNTIL이 필요하다. INTERVAL 생략 시 1이다. 종료 조건이 없으면 규칙이 무한할 수 있다. [§3.3.10](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.3.10) | 범위를 벗어난 첫 DTSTART부터 순서를 계산해야 COUNT 의미가 보존된다. 최근 범위에서만 시작하는 임의의 재기준화를 하지 않는다. 오래된/무한 규칙에는 별도 작업량 제한이 필요하다. |
| DTSTART 및 recurrence set | VEVENT는 UID, DTSTAMP를 요구한다. METHOD 없는 VCALENDAR에서 VEVENT는 DTSTART도 요구한다. recurrence set은 DTSTART/RRULE/RDATE를 합친 뒤 EXDATE를 제거하고 중복 occurrence를 제거한다. [§3.6.1](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.6.1), [§3.8.5.1](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.8.5.1) | 앱은 RDATE가 미지원이므로 VEVENT에서 발견하면 시리즈 전체 오류로 둔다. VTIMEZONE 내부의 transition RDATE는 VEVENT recurrence RDATE와 다르므로 지원 여부를 혼동하지 않는다. |
| UID·예외 | UID는 전역 고유 식별자다. RECURRENCE-ID는 변경 전 원래 발생 시각/날짜를 가리킨다. [§3.8.4.4](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.8.4.4), [§3.8.4.7](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.8.4.7) | UID 누락/중복 master를 합성 ID나 제목으로 보정하지 않는다. 수정·취소된 개별 반복 예외가 있으면 그 UID의 시리즈 전체를 오류로 둔다. |
| 종료 | DTEND는 배타적이다. DATE DTSTART에 DTEND가 없으면 하루짜리이며, DATE-TIME DTSTART에 DTEND가 없으면 0 길이다. DTEND와 DURATION은 상호 배타적이다. [§3.6.1](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.6.1) | 종일 종료는 달력 날짜에서 하루를 빼 포함 종료일을 만든다. 시각형 양의 길이 계약과 맞지 않는 0 길이는 종료시각을 임의로 만들지 않고 입력을 요청한다. |
| DST | 명시 DATE-TIME의 반복 벽시각(fold)은 첫 번째 발생으로 해석한다. 존재하지 않는 명시 local time(gap)은 전환 전 offset을 사용한다. [§3.3.5](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.3.5) | 이는 사용자가 새 시간을 직접 입력할 때의 제품 정책과 분리한다. recurrence 설명 안에는 gap occurrence를 무시하라는 MUST 문장과 마지막에 explicit DATE-TIME처럼 처리하라는 문장이 함께 있어 모호하다(아래 참조). |

**DST recurrence gap 모호성:** §3.3.10은 잘못된 날짜 및 존재하지 않는 local time occurrence를 세지 않고 무시하라고 적은 뒤, 끝부분에서 계산된 local start가 존재하지 않거나 중복되면 explicit DATE-TIME처럼 해석한다고 한다. explicit 규칙을 따르면 gap은 전환 전 offset으로 변환되어 wall time이 이동된 instant가 된다. 한쪽을 조용히 선택하면 누락/이동이 사용자에게 숨겨진다. ical.js 소스의 timezone 변환은 벽시각에서 offset을 선택하고 gap을 명시적 오류로 반환하는 정책을 제공하지 않는다. 따라서 이 경계는 라이브러리 기본값으로 결정하지 말고 전체 시리즈 preview issue로 표시해야 한다.

### Mozilla ical.js 실제 코드/문서 검토

[ical.js 공식 저장소](https://github.com/mozilla-comm/ical.js)는 RFC 5545 parser와 recurrence API를 제공하며 README에 “웹 사용을 염두에 둠”, “의존성 없음”, MPL-2.0이라고 명시한다. 확인 당시 `package.json`은 2.2.1이며 GitHub release는 2025-08-08이다. [README](https://github.com/mozilla-comm/ical.js), [package.json](https://github.com/mozilla-comm/ical.js/blob/main/package.json), [release](https://github.com/mozilla-comm/ical.js/releases/tag/v2.2.1).

공식 [Parsing iCalendar wiki](https://github.com/mozilla-comm/ical.js/wiki/Parsing-iCalendar)는 `ICAL.parse` → `ICAL.Component` → `ICAL.Event` 계층과 `RecurExpansion` 고수준 경로를 소개한다. `RecurExpansion`은 RRULE, RDATE, EXDATE를 다룰 수 있고, low-level `RecurIterator`는 RRULE 순회를 제공한다. [소스: recur_expansion.js](https://github.com/mozilla-comm/ical.js/blob/main/lib/ical/recur_expansion.js), [소스: recur_iterator.js](https://github.com/mozilla-comm/ical.js/blob/main/lib/ical/recur_iterator.js). 즉 parser 기능 폭은 제품 V1보다 넓다. 파싱 성공을 제품 지원 승인으로 간주하지 말고 AST preflight에서 미지원 구조를 차단한다. iterator의 `maxTries`는 불가능한 다음 발생을 찾는 내부 탐색 방지선이지, 전체 결과 개수/벽시계 실행시간의 UI 한도가 아니다.

시간대 소스는 `ICAL.Time`을 OS zone 독립 벽시각 값으로 보유하고 `toUnixTime()` 변환 때 `Timezone.utcOffset()`을 참조한다. TZID가 component tree에 있으면 embedded VTIMEZONE을 우선하고, 없으면 `TimezoneService`를 조회한다. [time.js](https://github.com/mozilla-comm/ical.js/blob/main/lib/ical/time.js), [timezone.js](https://github.com/mozilla-comm/ical.js/blob/main/lib/ical/timezone.js), [timezone_service.js](https://github.com/mozilla-comm/ical.js/blob/main/lib/ical/timezone_service.js). timezone offset 코드는 transition 이전/이후의 offset을 골라 주지만 gap의 reject/report 상태를 반환하는 API가 아니다. 반복된 시각에 대한 별도 branch에는 TODO 주석이 있어 “RFC의 fold/gap 정책을 모두 정확히 구현한다”고 소스만으로 보증할 수 없다. 실행 가능한 fixture로 선택한 고정 버전을 검증하기 전에는 실제 offset 결과를 보장하지 않는다는 것이 조사 한계다.

stock ical.js는 IANA timezone DB를 bundle size 때문에 등록하지 않는다. 공식 README는 ICS 안에 timezone 정의가 없으면 별도 `ical.timezones.js` 또는 자체 빌드 timezone data가 필요하다고 말한다. [README timezone 설명](https://github.com/mozilla-comm/ical.js#timezones). 공식 wiki는 IANA 표준 이름은 실무에서 VTIMEZONE 없이 사용되는 경우가 있고, 앱이 timezone data를 `TimezoneService`에 등록할 수 있다고 설명한다. [Common Use Cases: Time zones](https://github.com/mozilla-comm/ical.js/wiki/Common-Use-Cases#time-zones, 2024-05-05 수정). 이는 RFC의 MUST와 다르므로 둘을 표준 사실로 합쳐 말하지 않는다.

## 시간 입력 및 변환 계약 제안

**공식 사실:** ECMAScript Temporal은 calendar date, local PlainDateTime, exact Instant, zone-aware ZonedDateTime을 구분한다. `ZonedDateTime`은 instant, zone, calendar를 함께 나타내며 offset은 시각/정책에 따라 바뀐다. [TC39 Temporal 문서](https://tc39.es/proposal-temporal/docs/timezone.html), [MDN ZonedDateTime](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/ZonedDateTime). Temporal proposal은 Stage 4다. 2026-10-03 기준 TC39 repo는 Firefox 139(2025-05-27), Chrome 144(2026-01-13), Node 26(2026-05-05)을 shipped로 표시하지만 Safari(JavaScriptCore) shipped 표시는 없다. MDN은 `Temporal.ZonedDateTime`을 아직 Limited availability로 표시한다. [TC39 implementation status](https://github.com/tc39/proposal-temporal#status). 따라서 현재 browser `Temporal` 전역만 가정하면 안 된다.

**설계 판단:** date-only UI는 `YYYY-MM-DD`와 `Temporal.PlainDate` 의미로 보관하며 instant로 변환하지 않는다. 정확 시각 UI의 draft는 `{ date: 'YYYY-MM-DD', time: 'HH:mm[:ss]', timeZone: 'Area/City' }`를 유지한다. 검증 후 ZonedDateTime으로 해석해 `startAt/endAt`는 UTC ISO instant, `timeZone`은 IANA identifier로 저장한다. draft wall-time도 남겨 오류/수정 때 입력을 보존한다. 앱 문서의 `DateTiming.endDate`는 포함 날짜이므로 ICS의 DATE DTEND는 `PlainDate.from(DTEND).subtract({days: 1})`로 변환한다. 24시간 밀리초를 빼지 않는다. 예: DTSTART `2026-06-28`, exclusive DTEND `2026-07-09` → endDate `2026-07-08`.

| 입력/원본 | 제안 정책 |
|---|---|
| 사용자 수동 exact time | 유효한 IANA zone을 명시한다. gap은 오류로 남겨 다른 시각을 입력하게 한다. fold는 서로 다른 두 instant/offset을 확인하고 “첫 번째/두 번째” 선택을 요구한다. 자동으로 earlier/later를 택하지 않는다. Temporal `disambiguation: 'reject'`를 기본 변환에 사용하고, 오류 시 earlier/later 후보를 계산하여 fold 여부를 판별한다. |
| ICS UTC `Z` | UTC instant를 보존한다. 화면 표시 zone과 별개로 `timeZone: 'UTC'` 또는 제품이 정의한 display zone을 선택해야 하는 도메인 매핑을 명시한다. source occurrence key는 원본 UTC 값을 canonical ISO로 정규화한다. |
| ICS IANA TZID | 알려진 IANA TZID는 VTIMEZONE 유무와 무관하게 지원한다. 없는 경우는 RFC 엄격 적합이 아닌 명시적 제품 허용 확장으로 현재 IANA tzdb에서 instant를 계산한다. key는 원본 wall time/TZID여서 tzdb 업데이트가 import identity를 바꾸지 않는다. Embedded IANA VTIMEZONE이 있으면 선택 범위 occurrence에서 source VTIMEZONE offset과 runtime IANA zone 해석 offset을 비교한다. |
| ICS custom/unknown TZID 또는 복잡한 VTIMEZONE | 기존 스펙 범위대로 해당 시리즈를 unsupported 오류로 표시한다. 기기 zone 또는 고정 offset을 대입하지 않는다. known IANA TZID라도 embedded VTIMEZONE의 source offset과 runtime zone offset이 selected occurrence에서 다르면 `timezone-policy-mismatch` 시리즈 issue로 막는다. 어느 규칙을 자동 우선하지 않는다. |
| ICS floating DATE-TIME | 사용자/기기 zone 자동 사용 금지. 기본은 `floating-time-needs-zone`으로 preview error/필수 선택을 표시한다. 사용자가 IANA zone을 확인한 경우에만 변환하고 occurrence key는 `FLOAT=<confirmed-IANA>:<walltime>`으로 기록한다. 이 매핑은 import plan에 영구 보존한다. |
| ICS DST fold | RFC 명시 DATE-TIME 규칙은 첫 번째 occurrence지만 제품은 선택 범위에 해당 occurrence가 있는 recurrence 시리즈를 전체 preview issue로 막고, 영향 occurrence와 이유를 보여준다. 사용자가 확인하기 전에 default 선택이나 자동 저장을 하지 않는다. |
| ICS DST gap | 명시 DATE-TIME RFC 해석은 전환 전 offset을 쓰지만 recurrence prose가 상충한다. 제품은 선택 범위에 gap occurrence가 있는 시리즈 전체를 preview issue로 막고, 영향 occurrence와 이유를 보여준다. ical.js 결과를 정답으로 간주하거나 wall time을 자동 이동하지 않는다. 사용자가 검토하기 전 해당 시리즈는 저장 불가다. 독립적인 다른 시리즈는 선택/import 가능하다. |

선택 범위에 DST gap/fold 또는 VTIMEZONE-policy mismatch가 있는 시리즈는 그 시리즈 전체 occurrence 선택·저장을 막는다. 영향을 받은 occurrence와 사유를 보여주고, 같은 preview에서 시각을 강제로 보정하지 않는다. 시리즈를 제외하거나 원본 파일의 시간대/시각을 수정해 새 preview를 만들기 전까지 issue를 unresolved로 둔다. 독립 UID의 정상 시리즈는 계속 선택할 수 있다. 이는 timezone 해석을 자동으로 보정하지 않는 보수적 제품 정책이다. 현재 기본 사용자 zone이 Asia/Seoul인 점을 이유로 이 범위를 줄이거나 DST occurrence를 버리는 제품 shortcut을 추가하지 않는다. 최종 UI/API는 [핵심 구현 계약](04-core-implementation.md)의 시리즈 제외·새 파일 재시도 정책을 따른다. 수동 항목 입력의 fold 후보 선택과 ICS 시리즈 지원 정책은 구분한다.

## 파일, 반복, 미리보기 한도

### 한도 정의

1. 선택 즉시 `file.size > 5 * 1024 * 1024` byte면 파일 전체를 거부한다. 정확히 5 MiB는 허용한다. [제품 한도]이며 Blob/File의 `size`는 byte 수를 돌려주는 읽기 전용 값이다. [MDN Blob.size](https://developer.mozilla.org/en-US/docs/Web/API/Blob/size) (2026-10-03 확인).
2. 선택한 달력 범위는 `[fromDate, toDateExclusive)`이며 달력 단위로 계산한다. 오늘 기준 6개월이 초기값이고 최대 12개월이다. `180일/365일` 근사치가 아니라 PlainDate `add({months: 6|12})`를 쓴다. 12개월 초과는 preview 시작 전에 거부한다.
3. 2,000은 선택 범위 안에서 EXDATE 적용과 RFC recurrence set 내부의 중복 제거를 마친 **고유 VEVENT occurrence 수의 파일 전체 합계**다. 기존 저장소에서 이미 발견된 duplicate도 preview candidate 수에 포함하며, server dedupe/action 선택 전 계산한다. 2,000까지 preview 완료, 2,001 발견 시 전체 preview를 `limit-exceeded`/비커밋 상태로 전환한다. 앞의 2,000개만 저장하거나 자동 truncate하지 않는다. 사용자는 범위를 줄여 다시 계산한다.
4. 결과 제한과 별개로 recurrence iterator 검사 횟수와 worker 벽시계 시간을 둔다. 아주 오래전 DTSTART를 가진 unbounded rule이 범위에 닿으려고 수백만 번 순회할 수 있다. 이 보호 한도는 제품 지원 범위를 축소하는 occurrence 수 제한이 아니라 실행 중단 방지 장치다. 발생하면 `expansion-budget-exceeded`로 전체 결과를 비커밋하고 기간 단축 또는 파일 오류를 알린다.
5. 파일 크기/파싱 구조가 치명적으로 잘못된 경우 전체 파일 오류다. 정상적인 다른 시리즈와 분리 가능한 UID별 지원 오류는 행/시리즈별 이유로 표시하며, 선택 가능한 독립 항목의 부분 저장은 허용한다. 미지원 recurrence 또는 선택 범위 timezone issue가 발견된 해당 시리즈 내부는 부분 저장하지 않는다.

### RRULE 사전 검증

범위를 펼치기 전 VCALENDAR/VEVENT를 AST로 검사하고 아래 목록 밖인 recurrence part를 거부한다. 라이브러리가 이해한다고 제품 지원으로 승격하지 않는다.

| FREQ | V1 허용 recurrence part | DTSTART 기본값 및 규칙 |
|---|---|---|
| DAILY | INTERVAL, COUNT 또는 UNTIL | 월/일/시간은 DTSTART 기준. BYxxx는 거부. |
| WEEKLY | INTERVAL, COUNT 또는 UNTIL, 선택적 plain BYDAY weekday 집합 | BYDAY 생략이면 DTSTART weekday. `-1MO`, `2TU` 같은 ordinal은 거부. |
| MONTHLY | INTERVAL, COUNT 또는 UNTIL, 선택적 양수 BYMONTHDAY 집합 | BYMONTHDAY 생략이면 DTSTART day. 해당 월에 없는 일자(예: 31일)는 그 달 occurrence를 내지 않는다. clamp 금지. |
| YEARLY | INTERVAL, COUNT 또는 UNTIL, 선택적 BYMONTH 및 BYMONTHDAY | 생략 필드는 DTSTART에서 상속. 윤일/없는 조합은 생략. |

모든 빈도에서 INTERVAL은 양수 정수다. COUNT와 UNTIL 동시 지정, 0/음수 범위 값, unsupported BYxxx/BYSETPOS, 여러 RRULE, RDATE, VEVENT RECURRENCE-ID, DURATION을 사용하는 시리즈는 전체 시리즈 오류다. EXDATE는 DTSTART와 같은 DATE/DATE-TIME 타입 및 같은 source zone 기준으로 읽어 합집합 후 제거한다. RRULE에 DTSTART가 빠졌거나 값 타입이 호환되지 않는 잘못된 구성은 복구하지 않는다. UNTIL 포함 경계와 `COUNT`의 DTSTART 포함 의미를 지키며, EXDATE로 제외된 원 occurrence도 RRULE이 계산하는 COUNT 슬롯에서는 이미 소비됐다고 처리한다.

### identity, 원본 변경, 삭제 및 복구

부모 결정에 따른 canonical occurrence key:

```text
single
DATE:YYYY-MM-DD
UTC:<canonical ISO instant>
TZID=<원본 TZID>:YYYY-MM-DDTHH:mm:ss
FLOAT=<사용자 확정 IANA zone>:YYYY-MM-DDTHH:mm:ss
```

TZID recurrence의 key는 instant나 tzdb 버전이 아니라 원래 local wall time과 원본 TZID로 만든다. 따라서 DST/tzdb 데이터 갱신 후에도 같은 원본 occurrence ID가 유지된다. DATE와 UTC도 value type을 구분한다. UID와 occurrence key의 primary ID는 `ics_${sha256(JSON.stringify([uid, occurrenceKey]))}`처럼 canonical JSON array에 고정하고 같은 구현 전반에서 동일한 UTF-8/hex encoding을 사용한다. fingerprint는 단순 파일 전체 hash가 아니라 VEVENT의 지원 필드(UID, summary, DTSTART/DTEND value type+TZID+원본 값, description/URL, RRULE, EXDATE)와 해당 값 해석에 관련된 timezone 정의를 canonicalize해 만든다. line order/CRLF/접힘 표현/DTSTAMP처럼 내용 identity와 무관한 변동으로 fingerprint를 흔들지 않는다.

- UID 누락 시 파일 preview error. UID/hash-title 대체는 금지한다. 하나의 UID에 unsupported modified/cancelled RECURRENCE-ID가 존재하면 그 UID 시리즈 전체가 오류다.
- 동일 UID/occurrenceKey/fingerprint면 skip duplicate. 같은 key의 fingerprint 변경은 diff preview 후 `keep-existing`, `replace`, `add-as-new` 중 선택한다. 자동 덮어쓰기는 없다.
- `[PARENT DESIGN DECISION]` Primary ID는 위 deterministic ID 하나다. `add-as-new`는 새로운 UUID clone을 만들되 같은 `importSource`를 보존한다. 다음 import dedupe는 primary ID만 조회하며 기존 clone은 연결된 복사본으로 preview에 표시하고 canonical match로 쓰지 않는다. 이렇게 하면 동일 UID/key를 여러 복사본에 두면서 primary lookup을 결정적으로 유지한다.
- `[PARENT DESIGN DECISION]` primary가 tombstone이면 `deleted-source`를 보여주고 같은 ID를 살리지 않는다. 사용자가 명시적으로 새 항목을 추가한 경우에만 새 ID를 만든다. 삭제 문서 lookup은 repository에서 active 문서뿐 아니라 tombstone도 포함한다.
- 최종 결정: `keep-existing`는 서버 write/fingerprint 변경 없이 기존 내용을 유지한다. 다음 파일에서도 원본 차이가 다시 안내될 수 있다. source baseline 자동 갱신은 넣지 않는다. `replace`를 명시적으로 선택했을 때만 일반 revision transaction으로 fingerprint와 본문을 갱신한다.
- ICS SUMMARY 누락은 타이틀 입력 override를 요구한다. 시각형 DTSTART에 양의 DTEND가 없으면 종료시각을 입력하도록 한다. DATE DTSTART에 DTEND가 없는 경우에만 RFC의 1일 의미로 자동완성한다. VEVENT DURATION은 V1 미지원으로 정확한 의미를 축약하지 않고 해당 series/row 오류로 표시한다. Preview override는 원본 fingerprint/occurrence key와 분리해 보존하며 override 변경으로 source identity를 바꾸지 않는다.

### 부분 성공, journal, 멱등 재시도

가져오기 전체를 단일 트랜잭션처럼 취급하지 않는다. 선택 항목마다 일반 repository/journal mutation을 하나 만든다. 실제 Firestore mutation 전 import plan을 IndexedDB에 저장하고, 행마다 `primaryId`, 선택 action, `operationId`, `payloadDigest`, `baseRevision`, `componentFingerprint`, `cloneId?`, 결과 상태를 보존한다. `add-as-new` clone UUID도 첫 송신 전 journal에 고정한다. retry가 입력 파일 재파싱이나 새 ID 발급을 하지 않게 한다.

각 row는 일반 동기화 계약의 불변 operation ID+digest를 따른다. 응답을 잃으면 같은 ID/digest로 재시도해 receipt를 먼저 확인한다. ACK를 받은 row만 완료 처리하고 이미 성공한 행은 재전송하지 않는다. replace 시 preview의 revision을 base로 유지해 다른 기기 수정은 기존 conflict 흐름으로 보낸다. 일부 행 성공/일부 충돌/오류/미선택을 명확히 구분해 사용자에게 집계한다. 배치 재시작에 operation ID가 달라지는 구현은 중복/revision 증가를 만들므로 금지한다.

## 구현 API 스케치

아래 signature는 기존 repository 계약과 연동할 설계 초안이다. `ProposedCalendarItem` 타입은 프로젝트 도메인 타입으로 대체하며 `any`는 쓰지 않는다.

```ts
type ImportDateRange = {
  fromDate: string;
  toDateExclusive: string;
  previewTimeZone: string;
};

type ImportLimits = {
  maxFileBytes: 5_242_880;
  maxOccurrences: 2_000;
  maxExpansionSteps: number;
  maxWorkerMilliseconds: number;
};

type ImportIssueCode =
  | 'file-too-large' | 'occurrence-limit' | 'expansion-budget-exceeded'
  | 'missing-uid' | 'duplicate-series-master' | 'missing-dtstart'
  | 'missing-summary' | 'timed-end-input-required'
  | 'floating-time-needs-zone' | 'unknown-timezone' | 'timezone-policy-mismatch'
  | 'unsupported-rule' | 'unsupported-exception' | 'unsupported-rdate'
  | 'unsupported-duration' | 'invalid-date' | 'zero-duration'
  | 'dst-gap-review' | 'dst-fold-review' | 'invalid-component';

type ImportIssue = {
  code: ImportIssueCode;
  message: string;
  occurrenceKey?: string;
};

type ImportRowStatus =
  | 'ready' | 'needs-input' | 'duplicate' | 'source-changed' | 'deleted-source' | 'error';

type ImportPreviewOverrides = {
  title?: string;
  endWallTime?: { date: string; time: string; timeZone: string };
};

type ImportPreviewRow = {
  rowKey: string;
  uid: string;
  occurrenceKey: string;
  componentFingerprint: string;
  primaryId: string;
  item: ProposedCalendarItem | null;
  previewOverrides: ImportPreviewOverrides;
  status: ImportRowStatus;
  issues: ImportIssue[];
  existingItemId?: string;
  existingRevision?: number;
};

type ImportSeriesIssue = {
  uid: string;
  code: 'dst-gap-review' | 'dst-fold-review' | 'timezone-policy-mismatch';
  affectedOccurrenceKeys: string[];
  explanation: string;
  resolution: 'unresolved' | 'skip-series';
};

type IcsPreview = {
  state: 'ready' | 'needs-confirmation' | 'not-committable';
  range: ImportDateRange;
  rows: ImportPreviewRow[];
  seriesIssues: ImportSeriesIssue[];
  occurrenceCount: number;
  limitExceeded: boolean;
};

function parseIcsFileInWorker(
  file: File,
  options: { range: ImportDateRange; limits: ImportLimits },
): Promise<IcsPreview>;

type LocalDateTimeInput = {
  date: string;
  time: string;
  timeZone: string;
  foldChoice: 'unresolved' | 'earlier' | 'later';
};

type LocalDateTimeResolution =
  | { kind: 'resolved'; instantIso: string; timeZone: string; offset: string }
  | { kind: 'ambiguous'; earlier: { instantIso: string; offset: string }; later: { instantIso: string; offset: string } }
  | { kind: 'nonexistent'; issue: 'dst-gap' }
  | { kind: 'invalid'; field: 'date' | 'time' | 'timeZone' };

function resolveLocalDateTime(input: LocalDateTimeInput): LocalDateTimeResolution;

type ImportRowAction =
  | { rowKey: string; action: 'create' | 'skip' }
  | { rowKey: string; action: 'keep-existing' | 'replace' }
  | { rowKey: string; action: 'add-as-new'; cloneId: string };

function commitIcsImport(
  plan: IcsImportPlan,
  repository: CalendarRepository,
): Promise<ImportCommitRowResult[]>;
```

`occurrenceCount`는 파일 내 전체 UID에서 선택 범위·EXDATE·중복 처리 후 만들 수 있는 고유 row를 센다. `limitExceeded`나 unresolved `seriesIssues`가 있으면 `commitIcsImport`가 영향을 받는 시리즈를 거부하도록 API invariant로 강제한다. Missing SUMMARY와 timed DTSTART without DTEND는 `needs-input` row로 preview title/endWallTime override가 해결하기 전 저장되지 않는다. worker 결과는 사용자 확인 전 repository를 호출하지 않는다.

### 기존 04 문서의 `ImportCandidate` / `ImportDecision` 패치 제안

현재 04 문서의 `ImportDecision`은 `create|skip|replace|add-as-new`만 있어 source가 바뀌었는데 기존 내용을 유지하는 선택, tombstone, preview 입력 repair, 시리즈 단위 timezone issue를 표현하지 못한다. 구현 PR에서 아래처럼 확장하는 것이 좋다. type은 설계 초안이며 기존 repository response naming과 맞춰 정리한다.

```ts
type ImportPreviewOverride = {
  title?: string;
  endWallTime?: { date: string; time: string; timeZone: string };
};

type ImportCandidate = {
  key: string;
  uid: string;
  occurrenceKey: string;
  componentFingerprint: string;
  primaryItemId: string;
  title: string | null;
  timing: EventItem['timing'] | null;
  previewOverrides: ImportPreviewOverride;
  disposition: 'new' | 'duplicate' | 'changed-source' | 'deleted-source' | 'needs-input' | 'error';
  existingItemId?: string;
  existingRevision?: number;
  issues: ImportIssue[];
};

type ImportDecision = {
  candidateKey: string;
  action: 'create' | 'skip' | 'keep-existing' | 'replace' | 'add-as-new';
};
```

`ImportPreview`에는 `toDateExclusive`, occurrence count/limit 상태, `seriesIssues: ImportSeriesIssue[]`를 추가한다. `ImportIssue`는 현재 자유문자열 code 대신 위의 literal issue code를 사용하고 affected occurrence key를 둔다. summary/end repair는 candidate에 저장된 `previewOverrides`로 표시/검증하며 commit 시 원본 source fingerprint와 분리한다. `ImportDecision`은 사용자의 row action만 표현한다. `add-as-new` 새 ID를 caller가 매 retry마다 다시 보내지 않도록 import plan 저장 시 clone ID/operation ID/digest를 journal에 한 번 기록하고 `commitIcsImport(previewId, decisions)` 재실행은 저장된 값을 재사용한다. `create`는 deterministic primary ID, `keep-existing`는 표시 내용 유지, `replace`는 preview revision 기준 conflict 보호, `add-as-new`는 UUID clone + 원본 importSource 보존을 의미한다. primary tombstone은 `deleted-source`로 후보에 남기며 `create` action을 허용하지 않는다.

## 의존성 후보

새 production dependency는 `AGENTS.md`에 따라 PR에서 먼저 논의해야 한다. 다음은 `[ASSUMPTION]` 후보다.

| 역할/후보 | 이유·라이선스·위험 | 대안 |
|---|---|---|
| ICS parser: [`ical.js`](https://github.com/mozilla-comm/ical.js) 2.2.1 | RFC 형식 parser, Component/Event/recurrence model, 공식 README상 runtime dependency 0개, MPL-2.0. RRULE 언어가 제품보다 넓고 stock에 tzdb 없음. MPL-2.0 배포 의무를 PR에서 검토하고 제품 subset preflight/fixture 검증을 별도로 유지해야 한다. | parser 없이 직접 RFC line folding/escaping/DATE-TIME/RRULE 문법을 구현하면 RFC parser 역할까지 유지보수해야 하므로 권장하지 않음. 설치하지 않았다. |
| Temporal: [`temporal-polyfill`](https://github.com/fullcalendar/temporal-polyfill) 1.0.5 | Temporal semantics로 PlainDate/Instant/zone conversion과 DST reject/fold 후보 계산을 표현하기 용이. 공식 TC39 repo가 stable release available로 목록. 패키지는 MIT, npm version history는 2026-10-03 조회 시 1.0.5를 21일 전 발행으로 표시(약 2026-09-12); `temporal-spec`/`temporal-utils` runtime dependency가 package metadata에 명시됨. README는 ISO+Gregorian 기본 entry가 19.5 kB min+gzip이라고 주장하며 실제 번들 측정은 별도 필요. [README](https://github.com/fullcalendar/temporal-polyfill/tree/main/polyfill), [package.json](https://raw.githubusercontent.com/fullcalendar/temporal-polyfill/main/polyfill/package.json), [TC39 목록](https://github.com/tc39/proposal-temporal#polyfills). | 현재 Safari 지원을 포함하려면 native Temporal 단독은 부족하다(MDN Limited availability). `Intl.DateTimeFormat` 기반 직접 zone 변환은 dependency를 줄이지만 gap/fold 역변환을 직접 설계/테스트해야 하므로 사용자 수동 입력에는 더 위험하다. Temporal polyfill 채택 여부 역시 PR 논의 전 설치하지 않는다. |

날짜형 계산은 앱 도메인이 이미 달력 문자열로 저장하므로 polyfill 없이 검증·add day도 가능하다. polyfill은 수동 wall-time↔instant 해석과 정확 zone offset 처리에 필요한지 scope를 좁혀 평가한다. ical.js와 Temporal 후보는 서로 역할이 달라 대체 관계가 아니다.

## UI 비동기 처리 제안

5 MiB 파싱과 unbounded recurrence expansion은 메인 스레드에서 실행하지 않는다. Blob/File `size`로 UI에서 빠르게 거부한 다음 dedicated Web Worker로 파일과 범위·한도를 전달한다. Web Workers는 무거운 처리 중 UI main thread가 막히지 않도록 별도 thread에서 동작하며 `postMessage()`로 값 전달한다. [MDN Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) (last modified 2025-04-03; 확인일 2026-10-03). Worker는 parser/preflight/occurrence expansion/fingerprint까지만 하고 IndexedDB·Firestore를 호출하지 않는다. progress, cancel, worker error/timeout 메시지를 UI에 돌려준다. worker 종료는 무한/장기 계산을 중단하는 장치로 둔다. 발생 한도를 넘어가면 그때까지 만든 partial 결과는 preview/commit하지 않는다. Worker 메시지 직렬화는 structured clone 크기에 주의하며, file bytes 전체를 여러 번 복제하지 않는다.

## fixture 및 테스트 수용 사례

| Fixture | 기대 결과 |
|---|---|
| 5 MiB 정확히 / 5 MiB+1 byte | 첫 파일은 허용, 둘째는 파일 전체 거부. |
| 2,000개 / 2,001개 고유 occurrence | 앞의 것은 commit 가능한 preview, 뒤의 것은 전체 결과 비커밋 상태; 첫 2,000개 저장 금지. 기간을 줄여 다시 계산 가능. |
| 기본 6개월, 선택 12개월, 12개월 초과; `2026-08-31`에서 월 증가 | PlainDate 기반 경계. 월말 overflow 정책을 고정(Temporal add의 constrain 결과)을 하고 매월/연간 recurrence의 invalid day는 skip하여 clamp하지 않음. |
| DAILY `INTERVAL=2;COUNT=4`, 이전 DTSTART에서 선택 범위 시작 | DTSTART가 COUNT 1번으로 계산되고 occurrence #1/#3 범위 여부 정확. COUNT와 UNTIL 동시 지정 거부; UNTIL 경계 포함; TZID DTSTART의 비-UTC UNTIL 거부. |
| WEEKLY `BYDAY=MO,WE;INTERVAL=2`, BYDAY omitted, ordinal `2MO` | 2주 간격 요일 set, 생략 시 DTSTART weekday, ordinal 시리즈 전체 오류. |
| MONTHLY `BYMONTHDAY=31` 및 YEARLY `BYMONTH=2;BYMONTHDAY=29` | 2월/30일 달은 occurrence를 만들지 않음. 윤년만 2/29. DTSTART 31일 기준 clamp 금지. |
| EXDATE가 DTSTART와 중간 occurrence를 제거, 중복 RRULE/DTSTART occurrence | 제외 및 duplicate elimination 후 최종 row 집합; EXDATE date/time zone type mismatch는 오류. |
| VEVENT RDATE, DURATION, RECURRENCE-ID modified/cancelled, 다중 RRULE, BYSETPOS | 관련 UID 시리즈 전체 preview error; 기본 occurrence를 임의로 저장하지 않음. 같은 VTIMEZONE 내부 RDATE는 unsupported VEVENT recurrence로 오인하지 않음. |
| UID 없는 이벤트, 동일 UID의 중복 master, SUMMARY 누락, timed DTSTART without DTEND | 각각 identity 오류, ambiguous-series 오류, title override, 양의 endWallTime override 입력 row. 제목/종료 시각을 원본 fingerprint에 넣거나 자동 추측하지 않음. DATE without DTEND만 하루 자동완성. |
| UTC Z, IANA+embedded matching VTIMEZONE, IANA TZID without VTIMEZONE, unknown/custom TZID, timezone mismatch, floating | UTC instant를 보존. embedded custom은 unsupported로 거부. IANA 미첨부는 명시적 제품 확장 경로. unknown/mismatch는 오류. floating은 사용자 IANA 선택 전 저장 불가. |
| 수동 America/New_York DST fold / gap | fold에서 earlier/later offset 둘 다 표시하고 선택 전 저장 안 됨. gap은 오류, 값이 자동 이동하지 않음. RFC explicit DTSTART fold 첫 instance 결과, explicit gap 전 transition offset 결과를 별도 검증. |
| DST gap이 생기는 WEEKLY recurrence / fold recurrence / IANA VTIMEZONE offset 불일치 | affected occurrence key/reason을 표시하고 해당 UID 시리즈 전체를 unresolved로 막음. 다른 UID는 계속 선택 가능. 사용자 explicit resolution 전 저장 불가. 같은 preview의 강제 보정은 금지; series skip 또는 원본 수정 후 새 파일 preview. 수동 입력에서는 별도로 fold 후보 선택을 제공. |
| DATE DTSTART 2026-06-28, exclusive DTEND 2026-07-09 / DTEND 없음 | inclusive endDate 2026-07-08 / 2026-06-28. 시간대/DST를 거치지 않음. |
| 같은 UID/key/정의 동일·변경·tzdb update, tombstone, clone, retry | 같은 source는 deterministic primary ID+fingerprint 중복. component 변화는 diff. TZDB update여도 raw TZID key ID 불변. primary tombstone은 deleted-source. clone은 UUID가 retry까지 불변. ACK 유실 후 같은 opId/digest receipt 재조회는 중복 revision을 만들지 않음. |
| 일부 행 저장 성공, 다른 행 충돌/오류, 앱 재시작 | 완료 행 재전송 없음. 실패/충돌 행만 journal에 남아 같은 operation/clone ID로 재시도. stale replace는 conflict. |
| 수백 년 전 unbounded RRULE, 2,000 초과, worker cancel/timeout | UI main thread 입력/스크롤이 응답함. step/time cap이면 전체 미완성 preview 비커밋; worker 종료 후 상태 일관성 유지. |

## 확인한 공식 출처 목록

| 출처 | 발행/갱신 정보 | 사실 사용처 |
|---|---|---|
| [IETF RFC Editor, RFC 5545](https://www.rfc-editor.org/rfc/rfc5545.html) | 2009-09 발행 | DTSTART, DATE-TIME/zone, RRULE, UID, 예외, DTEND/EXDATE 규칙. |
| [Mozilla ical.js repository](https://github.com/mozilla-comm/ical.js) / [package.json](https://github.com/mozilla-comm/ical.js/blob/main/package.json) | 2.2.1; GitHub latest release 2025-08-08. README/wiki 확인일 2026-10-03. | parser 지원/계층, MPL-2.0, 의존성 없음, timezone DB 미포함. |
| [ical.js Parsing iCalendar wiki](https://github.com/mozilla-comm/ical.js/wiki/Parsing-iCalendar) | 2024-03-25 수정 | Component/Event/Recurrence API 접근. |
| [ical.js Common Use Cases](https://github.com/mozilla-comm/ical.js/wiki/Common-Use-Cases#time-zones) | 2024-05-05 수정 | IANA 이름의 VTIMEZONE 실무와 TimezoneService. |
| [TC39 Temporal timezone docs](https://tc39.es/proposal-temporal/docs/timezone.html) 및 [proposal repository](https://github.com/tc39/proposal-temporal) | 문서 조회/상태 확인일 2026-10-03; 각 browser ship 날짜는 해당 README에 기재 | temporal type separation, disambiguation 옵션, 구현 현황 및 polyfill 후보 목록. |
| [FullCalendar temporal-polyfill](https://github.com/fullcalendar/temporal-polyfill) / [npm version history](https://www.npmjs.com/package/temporal-polyfill?activeTab=versions) | 1.0.5; npm 기준 2026-09-12 전후 발행 | MIT, stable package/version, browser support/size 주장은 공식 README. |
| [MDN Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) | last modified 2025-04-03 | background worker로 긴 처리를 main UI thread 밖에서 수행. |
| [MDN Blob.size](https://developer.mozilla.org/en-US/docs/Web/API/Blob/size) | 페이지에 별도 갱신일을 확인할 수 없어 확인일만 기록 | file-size byte preflight 근거. |


## 통합 설계에서 정리한 구현 선택

이 문서의 API 스케치는 조사 후보이며 최종 Repository/ImportOptions/ImportPreview/ImportDecision/Result는 [핵심 구현 계약 10절](04-core-implementation.md)을 따른다. parse worker는 `parseIcsFileInWorker(file, options)`이고 공개 저장소는 `importIcs(file, options?)`·`updateImportPreview`·`commitIcsImport`·`readImportResult`를 제공한다. UI가 저장 port를 직접 받거나 새 CalendarRepository를 중복 정의하지 않는다.

Temporal 채택 후보는 통합 설계와 맞춰 `[ASSUMPTION] @js-temporal/polyfill` 하나로 정리한다. 위 fullcalendar의 temporal-polyfill은 비교 대안이며 동시에 설치하지 않는다. 2026-10-03 확인한 [js-temporal README](https://github.com/js-temporal/temporal-polyfill/blob/main/README.md)는 명시적 모듈 import와 ES2020 번들을 설명하고, [package metadata](https://raw.githubusercontent.com/js-temporal/temporal-polyfill/main/package.json)는 ISC·JSBI 의존성을 표시한다. 실제 설치 시 정확한 안정 patch를 재확인하고 번들·DST fixture를 검증한다.

반복 실행 예산100,000회·5초, date-only countdown과 기간 checklist 최대4개, 모호한 ICS 시리즈를 제외/원본 수정으로 처리하는 경계는 구현 선택이다. checklist 상한은 사용자 결정 및 최대 payload Emulator 검증을 반영했다. 한도 초과는 비커밋 issue로 표시하며 앞부분만 성공 저장하지 않는다.
