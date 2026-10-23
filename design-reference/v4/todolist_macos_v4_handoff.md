# Todo — macOS-first unified planner, v4 handoff

Reference repository: https://github.com/sideotod/TodoList  
Prototype: `todolist_macos_unified_v4.html`  
Snapshot fixture date: **2026-10-23, 14:53 (Asia/Seoul)**  
Preview viewport: **1512 × 982**, desktop-first.  

## 1. UX updates from v3

- Keep the existing two-surface desktop layout and Progress 3-column, landscape-style cards.
- Remove the top-right main-page 'new task' primary button. Put **＋ 새 할 일** to the **right of 오늘 할 일**; the button expands and focuses a compact inline composer directly beneath the heading.
- Move **selected day's events** into the right column **under the monthly mini calendar**. Events are clickable and editable; `＋ 새 일정` creates a timed event.
- Merge **가까운 중요한 날** into **가까운 마감과 시작**; the combined list shows the four nearest upcoming or unfinished important items. The right column has no duplicate Progress list.
- Keep regular tasks as a quiet, plain list. Linked Progress text is a link to its shared detail panel.
- Keep Progress as three landscape cards per row with category, title, D-day/countdown, time-progress bar for intervals, and linked task completion count. A start-only card has no arbitrary elapsed-time bar.
- Calendar retains day/week/month/year. Clicking a calendar item opens its actual inspector; clicking a day opens day view; clicking a year-month opens month view; empty time slots create an event.

## 2. Interactive behavior implemented in the standalone demo

| Area | Interactions |
|---|---|
| Today | Change date via mini calendar; toggle/completed-only tasks; show/hide quick-add; create task; open task detail; edit title, date, category, memo, URL, linked Progress; toggle complete; reorder up/down; confirm delete; filter by area; open linked Progress |
| Progress | Type filters; sort by target/name/recent; open card inspector; add/edit/complete/delete a period; choose deadline/start/window and notification preference; link a new named task to a period; update linked checklist completion across Today and Progress; open target date in Calendar |
| Calendar | Day/week/month/year; previous/next/today; independent event/task/period layer visibility; date navigation; create/edit/delete events; weekly recurrence with until date; optional event inclusion in Progress and Today urgency list; click timed blocks, all-day items, tasks |
| Search and navigation | Sidebar navigation; sidebar area filters; top back/Today/new-task/search; global search for tasks/events/periods; ⌘K search; ⌘N new task; ⌘, settings; Escape closes inspector |
| Settings and data | Accent choices; week-start, 12/24-hour preference, time-grid visible hour range, time-zone preference (non-converting demo field), notification preference (stored only); JSON export/import; reset sample data |
| State | In-memory interactive state, with optional browser `localStorage` persistence where the browser permits it |

## 3. Detailed inspector structure

### Task inspector

1. Title, category, notes.
2. Completion toggle and chosen action date.
3. Linked Progress, if any.
4. Related HTTP(S) link if any.
5. Edit, up/down reordering, delete with confirmation.

### Period inspector

1. Title and type.
2. Remaining D-day or exact countdown (for near-term starts).
3. Elapsed-time progress (only for meaningful start–end intervals).
4. Start/end dates, notification setting.
5. Linked checklist; each check updates the same task in Today.
6. Memo, link, edit, add task, show in calendar, mark complete, delete.

### Event inspector

1. Title, date, start/end clock time.
2. Weekly recurrence (where present), category and notes.
3. Edit, create a related preparation task, delete single/non-repeating event or whole repeating series.
4. Optional `showInProgressSummary`: when selected, renders in the Progress card gallery and the combined nearby-urgency preview.

## 4. Important differences between prototype and production repository

The HTML is an **independent preview**. It **does not** modify or connect to `sideotod/TodoList`, Supabase, auth, Realtime, OS notification scheduling, or PWA service workers. The demo JSON backup is a **prototype schema**, not guaranteed compatible with the repository's production backup schema.

Production work should preserve the domain model in `src/domain/items.ts` with `event | task | deadline | window`, existing optional `EventCountdown`, `showInProgressSummary`, weekly recurrence, `PeriodChecklistItem`, `startCountdown`, item category and categoryColor, notes, URL, time zone, and item synchronization metadata.

Especially important: production `PeriodChecklistItem` is currently nested in a period, while a daily task is a separate item. Use stable cross-entity IDs or an explicit mapping; **do not** maintain two unsynchronized sources of truth. Migration must retain existing period data and active/inactive items.

Other repository features to retain in implementation:
- Supabase OAuth login and account-based cross-device sync; offline drafts, conflict and revision handling.
- Preview data creation/editing/deletion/completion/reordering in browser local storage.
- JSON export/import and backup, ideally using the repository's validated existing format.
- Week start, 12/24h clock, time zone, visible time-grid bounds, selectable accent palette.
- Optional notifications (off by default), including platform permission flow and actual scheduling.
- Weekly repeating classes/events with a bounded end date; editing a single occurrence vs whole series should be explicitly designed in production (v4 demo edits **whole series**).
- Confirmations for destructive operations, accessible keyboard navigation, and `?preview=design` review path.

### Recommended implementation components

- `TodayPage`: `UpcomingRibbon`, `TaskList`, `InlineTaskComposer`, `MiniMonth`, `SelectedDayEvents`.
- `ProgressPage`: `ProgressFilters`, `ProgressGrid`, `PeriodCard`.
- `CalendarPage`: four views sharing the same item selectors; `CalendarToolbar` and item-layer filters.
- `ItemInspector` with reusable forms for `task/event/deadline/window`.
- `AppSettings` and existing repository storage adapters; avoid directly reading/writing database from UI.

## 5. Acceptance criteria for Codex

1. The Today layout matches v4 screenshots at 1512×982 and adapts to 1280×800 and 1024×768 without unintended horizontal clipping. Progress uses a 3-column gallery at wide sizes and two columns at narrower sizes.
2. The new-task button is located to the right of the Today Tasks heading, and opens a focused inline composer.
3. Today's events are under the miniature calendar in the right column. There is no duplicate 'nearby important dates' section.
4. All visible buttons, tappable cards, calendar layers, navigation, filters, sort controls, menus and inspectors have meaningful behavior; do not replace required features with fake toasts.
5. Task and period checklist status is synchronized; period countdown and actual task completion are **different metrics**.
6. Calendar supports day/week/month/year, repeated classes, date/time editing, event-summary opt-in and period targets.
7. No existing records are dropped during UI migration. Keep repository backup compatibility and auth/sync, where configured.
8. Verify using Playwright screenshots of Today, Progress, four calendar modes, task/period/event inspector, settings, and major CRUD flows.
9. Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:e2e`, following `AGENTS.md` and existing Next.js documentation. No new package should be added without justification.

## 6. Prototype test results

Playwright Chromium tests on 2026-10-23 covered 28+ flows including CRUD for tasks/periods/repeated events, linked checklist, calendar modes, search, settings, JSON export, import/reset, project filters, optional event visibility in Progress, and page-error capture. No uncaught script errors occurred in those flows. Full browser reload persistence and actual macOS/Safari system integration **were not verified** in this runtime; those must be tested in the actual app.
