# Planner Visual Refresh

## Goal

Apply the selected second logo direction to Todo and finish the still-open browser review comments while preserving the current home and calendar information architecture.

## Approved direction

- Keep white backgrounds and black text/structure. Use the chosen accent only for progress, selected states, category marks, and actions.
- Develop the selected asymmetric ripple direction into an original, connected `TODO` wordmark and matching monochrome app mark. Keep the logo simple and vector-based; animate its inner and outer contours only during deliberate interaction or loading.
- In a genuine app loading state, use a bottom-up accent fill as an indeterminate loading cue, with a reduced-motion alternative.
- Preserve the one-time/weekly schedule flow. Let users enter dates and times first, then show start-focused/deadline-focused treatment only for multi-day schedules. Keep existing event and task data semantics.
- Let users add colored task categories from the home action menu. Keep category definitions in the existing device-preference and backup flow; task category/color values remain part of synced task items. Show each configured category on every selected date, including when it has no tasks. Show the general empty state only when there are no categories and no tasks.
- Keep schedule progress cards and calendar tasks distinct. The week calendar continues to render tasks as a daily count and timed/all-day events as schedule entries.

## Browser review items to finish

1. Put this month’s completed-task count beside the month heading.
2. Add `카테고리 추가` beneath `디데이 정렬`; provide a small name/color editor.
3. Render selected-day task groups by category, including empty categories and uncategorized tasks.
4. Replace the event-time reveal’s awkward below-only layout with a responsive side-by-side reveal on desktop and a compact stacked layout on narrow screens.
5. Position date popovers below their calendar icon; keep time selection centered on its time field.
6. Use a category dropdown below time settings, not a free-text/datalist field.
7. Remove the gap and redundant `마감 시각` label from the task time control.
8. Remove the brand header from the week calendar, bring its content higher, replace the hamburger trigger with a plus, remove `오늘`, and group week arrows at the right.
9. Remove user controls for visible-hour range and use the fixed 08:00–22:00 calendar range.
10. Refine settings dropdown surfaces, remove the discard-dialog divider, and reduce bottom-navigation stutter.
11. Preserve comments already reflected in the code: phase colors, reminder choices, multi-color day markers, completed schedules excluded from active cards, all-day/time-grid separation, and daily task counts.

## Follow-up browser review — 2026-10-09

Keep the selected asymmetric ripple and connected `TODO` wordmark, while smoothing the mark and letter joins so the existing concept reads naturally. Preserve the current page structure, white/black surfaces, teal `#0B756B` default accent, and teal/amber/sage choices.

- Remove redundant pending/completed headings inside each selected-day category; strike-through and checkbox state already communicate completion. Route legacy uncategorized tasks through a basic `기본` category so the UI has no `분류 없음` group.
- Move long-press reorder onto the task row and remove the visible drag handle, while preserving keyboard reorder and normal checkbox/title actions.
- In the item editor, use the concise label `분류`, make category/color selection align cleanly, allow custom colors with a native color control, and show unframed color swatches.
- Expand the whole `새 일정` dialog sideways when event time settings open. Replace one-time/weekly and timed/all-day radio groups with accessible switches; keep exact times visible while all-day is off.
- Add a collapse control to the week all-day lane, move the week view higher, and fit the fixed 08:00–22:00 range within the viewport when space permits.
- In schedule details, remove the generic `일정 상세` eyebrow and top X control; show the schedule title with its progress bar in a compact card. Add a subtle active-progress shimmer at the bar's filled end, disabled for reduced motion.
- Add a divider under the completed-schedules pane title without moving its cards. Display time-zone choices with their zone abbreviation and correct UTC offset (Seoul is KST, UTC+09:00).

Category definitions remain per-device preferences and preview-backup data. Item category/color values remain stored on individual items. Do not add another persistence path or production dependency.

## Boundaries

- Do not add production dependencies.
- Do not change the overall home/calendar layout, item domain kinds, or existing schedule data.
- Use supplied Figma SVG assets for interface icons. The new brand mark is an original SVG.
- Honor `prefers-reduced-motion` for every new motion.
- Keep category definitions portable through the existing preview backup/import flow.

## Verification

- Update focused component, preference, and editor tests where behavior changes.
- Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm test:e2e` as required by `AGENTS.md`.
- Inspect the home, calendar, settings, category editor, and item editor in the running design preview at desktop and mobile widths.
