# Unified schedule creation

## Goal

Keep one `새 일정` entry point that covers one-time appointments, weekly repetition, multi-day deadlines, start-focused application windows, same-day events, and events with a known start but no known end. Do not add separate creation-menu items for `기간제` and `선착순`; those are choices inside the same editor. Tasks remain a separate concept and never render as timed events.

## User-approved creation flow

1. Choose `한 번` or `매주 반복`.
2. Enter the date and, when relevant, start/end time.
3. For a multi-day one-time schedule, choose which boundary matters: `시작이 중요해요` or `마감이 중요해요`.

The `새 일정` action in the home menu and week calendar uses this same editor.

## Proposed editor behavior

- One-time schedules support a timed appointment, an all-day schedule, a start-only timed schedule, or a multi-day range.
- Timed schedules require a start. End time is optional and appears behind `종료 시각 설정`; when absent, store no end time and label it `종료 시각 미정`.
- All-day schedules store dates without synthetic times.
- A one-time range spanning more than one calendar date reveals the focus choice. `시작이 중요해요` uses the existing start-focused period behavior; `마감이 중요해요` uses the existing deadline-focused behavior. The UI is unified while old records remain editable.
- Weekly schedules repeat on one or more selected weekdays, initially selecting the weekday of the entered start date. The end date is optional and inclusive. Weekday chips use the product's configured week-start order.
- Weekly schedules are one-day entries (timed or all-day); a multi-day range remains one-time. If a user changes a weekly entry to span multiple days, explain that weekly repetition must be turned off before saving.
- The calendar generates only occurrences needed for its visible date range. The saved object is a series, not a set of duplicate records.
- A recurring schedule has one D-day card and one sort entry for its next upcoming occurrence; its progress/countdown resets for the next occurrence. This preserves the existing behavior where a newly created schedule appears in the top cards and `디데이 정렬`.
- Editing or deleting a recurring item applies to the series. The editor should identify this scope before save/delete; individual occurrence exceptions are outside the first implementation.

## Data and compatibility

- Add optional weekly recurrence metadata to event records: frequency (`weekly`), weekday numbers (0 Sunday through 6 Saturday), and nullable inclusive end date.
- Existing event, deadline, and window snapshots without recurrence remain valid. Existing deadline/window data is not migrated or rewritten.
- A multi-day start-focused new schedule maps to the existing window semantics; a deadline-focused schedule maps to existing deadline semantics. This is an internal projection choice, not a separate creation flow.
- Tasks keep their existing schema and category behavior. Recurrence is not added to tasks.
- Validate weekday uniqueness/range and reject an end date earlier than the series start.
- Series projections keep the original item ID so a calendar occurrence opens the canonical series editor; each rendered occurrence has a date-scoped UI key.
- A start-only timed event retains `endAt: null`. In the time grid it is displayed as a start marker with a short minimum hit target and no fabricated end-time label. It does not create an artificial end deadline.

## Screen details to preserve

- Keep the current editor's overall layout and field hierarchy. Add a compact type selector and weekday chips within the existing editor body.
- Keep event time settings as a downward reveal that visually grows within one section. Use the Figma SVG chevron.
- Keep date/time inputs and the calendar layout; do not move the major page regions.
- Period focus appears only after a one-time schedule spans multiple dates.
- Calendar all-day items stay in the all-day lane; timed items stay in the time grid. Tasks remain represented by the daily count.

## Verification scenarios

1. Save an upcoming one-time appointment and verify it appears in the home progress cards and `디데이 정렬`.
2. Save an all-day event; verify it appears in the all-day lane and not the task list.
3. Save a start-only event; verify it appears in the correct time slot, retains a clear start label, and does not display a fabricated end time.
4. Save a multi-day start-focused window and deadline-focused period; verify the right progress boundary and card state.
5. Save a weekly event for multiple weekdays and navigate across months; verify occurrences retain local wall-clock time and the optional end date is inclusive.
6. Open any occurrence and edit/delete the series; verify all generated views update from the single saved record.
7. Confirm old deadline/window records remain unchanged and editable.

## Design references

- TodoMate's store listing describes user-created categories and task colors, which informed the category control: [App Store](https://apps.apple.com/kr/app/%ED%88%AC%EB%91%90%EB%A9%94%EC%9D%B4%ED%8A%B8-%ED%95%A0-%EC%9D%BC-%EB%AA%A9%EB%A1%9D-%EB%A3%A8%ED%8B%B4-%ED%94%8C%EB%9E%98%EB%84%88/id1505220130).
- This schedule flow is a product inference from the user's five schedule cases and approved sequence, not a claim about another product's behavior.
