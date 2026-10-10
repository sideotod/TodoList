# Planner Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining visual review comments and apply the selected connected ripple logo without changing the app’s top-level layout.

**Architecture:** Keep reusable brand geometry in an SVG-backed React component and app icon assets. Store user-defined categories beside the existing local display preferences so they can be merged with categories inferred from synced task items and included in preview backup data. Keep editor/calendar behavior in the existing feature components and CSS modules.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS Modules, SVG, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-09-planner-visual-refresh.md`

## Global Constraints

- Preserve white backgrounds, black structure/text, and restrained accent usage.
- Do not add production dependencies or use `any`.
- Preserve existing item kinds, event/task distinction, and schedule data.
- Use Figma SVG icon assets for interface controls.
- Respect reduced-motion preferences.

## Review Focus

- Old preference records and backups without custom categories still load; old visible-hour values do not restore a visible setting.
- Empty custom categories remain visible; uncategorized tasks remain accessible.
- Weekly repeating and multi-day schedule data still saves with existing semantics.
- Narrow viewports do not clip the side-revealed event-time fields or popovers.
- Loading and hover motion remain legible with reduced motion enabled.
- Category definitions stay in per-device preferences and preview backups; item category/color values stay on synced items.

---

### Task 1: Brand mark and loading treatment

**Files:**
- Create: `src/features/shell/TodoLogo.tsx` and `src/features/shell/TodoLogo.module.css`
- Modify: `src/features/shell/AppShell.tsx`, `src/features/shell/AppShell.module.css`, `public/icons/app-icon.svg`, raster app icons, `brand/DESIGN.md`
- Test: brand/loading component or shell tests

- [x] Draw an original asymmetric ripple mark with a connected `TODO` wordmark and monochrome default.
- [x] Replace the shell wordmark and app icon assets; show a bottom-up accent fill only in real loading states and provide a reduced-motion state.
- [x] Verify vector and raster icons at app icon sizes.

### Task 2: Category definitions and category creation

**Files:**
- Modify: `src/lib/desktop-preferences.ts`, `src/features/routes/LocalDataSettings.tsx`, `src/domain/task-categories.ts`, `src/features/home/TopActionMenu.tsx`, `src/features/home/HomeExperience.tsx`, `src/features/items/ItemEditor.tsx`
- Create: category editor component and CSS module
- Test: preference, backup compatibility, category grouping, and category creation tests

- [x] Add validated user-defined `{ name, color }` categories to the local preference record with backward-compatible defaults and backup round-trip support.
- [x] Add the action-menu entry and a compact accessible category editor with palette selection.
- [x] Merge configured categories with categories found in items and render selected-day sections, including empty categories and uncategorized tasks.
- [x] Replace the free-text category field with a dropdown placed after time settings.

### Task 3: Item editor and picker refinements

**Files:**
- Modify: `src/features/items/ItemEditor.tsx`, `src/features/items/ItemEditor.module.css`, `src/features/items/ItemTimingFields.tsx`, `src/features/items/DateTimePickerInput.tsx`, `src/features/items/DateTimePickerInput.module.css`, `src/features/items/DialogShell.tsx`
- Test: `tests/e2e/item-editor-preview.spec.ts` and focused unit/component tests

- [x] Reveal event time fields sideways on desktop and in a compact stack on mobile; keep the one-time/weekly and multi-day focus behavior.
- [x] Anchor date popovers to the calendar icon, retain time popover centering, and remove the redundant task deadline label/gap.
- [x] Keep `24시간제` absent from the picker and remove the discard dialog's extra separator.

### Task 4: Calendar and navigation comments

**Files:**
- Modify: `src/features/home/MonthHeader.tsx`, `src/features/home/MonthHeader.module.css`, `src/features/routes/CalendarRoute.tsx`, `src/features/routes/DesktopPreferencesControls.tsx`, `src/features/calendar/WeekCalendarView.tsx`, `src/features/calendar/WeekCalendarHeader.tsx`, `src/features/calendar/WeekCalendarHeader.module.css`, `src/features/shell/AppShell.tsx`, `src/features/shell/BottomNavigation.module.css`
- Test: calendar preview and settings tests

- [x] Align monthly completion text with the month heading.
- [x] Hide the shell logo on the week calendar, use a plus action trigger, remove the Today action, and move week arrows to the right.
- [x] Remove the visible-hour preference control and hard-code the existing 08:00–22:00 view.
- [x] Refine dropdown styling and smooth navigation motion without continuous attention-seeking animation.

### Task 5: Visual verification and required checks

**Files:**
- Modify as needed based on the review

- [x] Inspect desktop and narrow layouts in the design preview, including calendar, settings, editor, category sections, and dialogs.
- [ ] Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm test:e2e`.
- [x] Record any environment limitation rather than claiming an unverified check passed.

### Task 6: Follow-up browser comments — categories and logo

**Files:**
- Modify: `src/features/shell/TodoLogo.tsx`, `src/features/shell/TodoLogo.module.css`, and app icon assets if the shared mark geometry changes
- Modify: `src/domain/task-categories.ts`, `src/features/home/SelectedDayTasks.tsx`, `src/features/home/TaskRow.tsx`, `src/features/home/TaskRow.module.css`
- Modify: `src/features/items/TaskCategoryEditor.tsx` and its CSS module
- Test: domain category normalization/grouping and focused task/category component coverage

- [x] Smooth the selected asymmetric ripple and connected lettering while retaining the current direction and monochrome logo. Regenerated the 180/192/512px PNG icons from the SVG using the already installed `sharp` runtime; no dependency was added.
- [x] Remove pending/completed subgroup labels, use `기본` for legacy unclassified tasks, and preserve completion styling.
- [x] Move hold-to-reorder onto task rows, remove the visible handle, and retain keyboard reordering and normal task actions.
- [x] Support custom hex colors with a native color picker; render unframed color-only swatches and keep legacy palette identifiers readable.

### Task 7: Follow-up browser comments — editor, calendar, details, and settings

**Files:**
- Modify: `src/features/items/ItemEditor.tsx`, `src/features/items/ItemEditor.module.css`, `src/features/items/DialogShell.tsx`, `src/features/items/DialogShell.module.css`
- Modify: `src/features/calendar/WeekCalendarView.tsx`, `src/features/calendar/WeekCalendarView.module.css`, `src/features/calendar/WeekAllDayLane.tsx`, `src/features/calendar/WeekAllDayLane.module.css`, `src/features/calendar/WeekTimeGrid.module.css`
- Modify: `src/features/calendar/CalendarItemDetailsDialog.tsx` and its CSS module, `src/features/home/PeriodCard.module.css`, `src/features/home/PeriodSortDialog.module.css`, `src/features/routes/DesktopPreferencesControls.tsx`
- Test: editor switches/width, all-day collapse, progress presentation, and timezone formatting

- [x] Relabel category selection `분류`, align the field text, and expand the schedule dialog width when event-time fields open.
- [x] Replace repeat and all-day radio options with accessible toggle switches without changing recurrence or time data semantics.
- [x] Let the week all-day lane collapse and compact the page so its schedule range is visible without scrolling at the reviewed viewport.
- [x] Replace the detail dialog's generic heading and top X with a title/progress card, add a restrained active-progress glint, and honor reduced motion.
- [x] Add the completed-schedules header divider without shifting its cards and show timezone abbreviations with accurate UTC offsets.

### Task 8: Follow-up verification and handoff

- [x] Inspect the updated logo, category UI, item editor, week calendar, details dialog, and completed-schedules pane in the existing port-3010 preview. The timezone settings UI was blocked by the Firebase setup fallback; its formatter is covered by unit tests.
- [x] Run focused checks and direct equivalents of required project checks; the pinned pnpm/JDK/Chrome environment does not permit the project scripts or browser E2E.
- [x] Update this verification record and the handoff with concrete results and unresolved environment blockers.

### Verification record

- Direct local binaries passed on 2026-10-09: `node node_modules/typescript/bin/tsc --noEmit`, E2E config typecheck, service-worker typecheck, `node node_modules/eslint/bin/eslint.js .`, and `node node_modules/vitest/vitest.mjs run --config vitest.config.ts` (18 files, 160 tests).
- `pnpm` scripts could not run: the installed pnpm 11.25.0 attempted to fetch the project-pinned 11.19.0 from the npm registry, which is unavailable in this environment.
- Firebase rules tests require the configured JDK 21; no Java runtime is installed.
- Preview E2E could not launch Chrome: all 21 cases stopped at browser startup with Chrome `SIGABRT` before test actions ran. Desktop and 390px mobile layouts were also inspected in the live design preview.
- 2026-10-09 follow-up checks: all four direct checks above were rerun after the browser-comment changes and logo refinement. The `playwright.review-run.config.ts` preview command ran 21 cases, but all stopped at Chrome startup (`SIGABRT`) before test actions. The added `design-preview.spec.ts` checks and default `pnpm test:e2e` configuration were not run. The full unit suite excludes Firebase rules; the rules suite needs JDK 21, which is absent. Project `pnpm` scripts remain unavailable: Node is v26.4.0 instead of `.node-version`'s 24.21.0, and installed pnpm 11.25.0 does not match the package pin 11.19.0; a previous `pnpm test` attempt could not fetch the pinned version and aborted before the test script.
- The 1018×767 port-3010 preview was inspected for the home/logo, task editor, new schedule editor and sideways time reveal, category color editor, 08:00–22:00 week calendar, event detail card, and completed-schedules pane. The settings route shows the Firebase setup fallback instead of preferences, so timezone selector presentation could not be inspected there; timezone output unit tests passed.
- The user directly authorized making the existing asymmetric ripple and connected `TODO` wordmark more natural. The inner contour closure was smoothed, the first O-to-D join now connects at midline, and the three PNG icons were regenerated from `public/icons/app-icon.svg` with the preinstalled `sharp` package. No new dependency was added.
- Stop-hook triage, 2026-10-09: reduced the all-day event chip accent borders from 2px to 1px in `WeekAllDayLane.module.css`; the detector is clean afterward. Added a file-scoped `layout-transition=*` ignore for `ItemEditor.module.css`, since its width animation implements the user's requested horizontal schedule-dialog expansion (comment 7). No other findings remain.
