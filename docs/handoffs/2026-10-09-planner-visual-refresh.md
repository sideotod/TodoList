# Todo Planner Visual Refresh — Handoff

Updated: 2026-10-09  
Repository: `/Users/changmin/Desktop/projects/TodoList`

## Current state

The visual-refresh implementation and 17 follow-up browser comments are implemented in the working tree. The existing Chrome tab at `http://127.0.0.1:3010/settings/?preview=design` was left untouched. The separate Codex in-app browser tab is at `http://127.0.0.1:3010/?preview=design` with the home preview open at 1018×767. The dev server on port 3010 remained active; do not stop it as cleanup.

The requested design work is complete. Preserve all existing changes and the selected asymmetric ripple with connected `TODO` wordmark; do not restart from scratch or change the overall layout. Read this handoff together with:

- `AGENTS.md` — project rules and required checks.
- `PRODUCT.md` — product context.
- `docs/superpowers/specs/2026-10-09-planner-visual-refresh.md` — accepted scope and decisions.
- `docs/superpowers/plans/2026-10-09-planner-visual-refresh.md` — implementation checklist and verification record.
- `brand/DESIGN.md` and `brand/VOICE.md` — brand kit.

## Follow-up comments and verification — 2026-10-09

- Implemented all 17 browser comments while preserving the page structure, task/event semantics, and local category-definition sync model. Category definitions remain per-device; task category/color values remain stored with items.
- The selected asymmetric ripple and connected `TODO` wordmark now have smoother inner contours and a clearer midline O-to-D join. Regenerated the 180, 192, and 512px PNG app icons from `public/icons/app-icon.svg` using the already-installed transitive `sharp` runtime; no dependency was added.
- Selected-day tasks use `기본` when legacy records have no category. Removed redundant pending/completed subheadings and the visible drag handle; task rows support long-press reordering while keyboard reorder and checkbox/title actions remain.
- The category editor uses `분류`, a native custom-color control, and unframed color swatches. New schedule repeat and all-day controls are switches; opening schedule time settings widens the dialog horizontally.
- The all-day lane can collapse. At the reviewed 1018×767 viewport, the 08:00–22:00 week range fits below the compacted header. Schedule detail dialogs show the title and progress card without the generic eyebrow/X; active progress has a reduced-motion-aware glint. Completed schedules have a divider below their heading without moving the cards. Time-zone labels include abbreviations and UTC offsets.
- Visually inspected the home/logo, new task editor, category editor, new schedule editor and expanded time controls, week calendar, timed-event detail card, and completed-schedules pane in the separate in-app browser. The settings route displayed the Firebase setup fallback rather than preferences, so the timezone selector could not be visually inspected; formatter unit tests passed.
- Latest direct checks passed: app TypeScript, E2E-config TypeScript, service-worker TypeScript, ESLint, and Vitest (18 files / 160 tests).
- Project `pnpm` scripts are not runnable in this environment: Node is v26.4.0 instead of `.node-version`'s 24.21.0, and installed pnpm 11.25.0 differs from the pinned 11.19.0. A prior `pnpm test` attempt could not fetch the pinned pnpm (`ERR_PNPM_META_FETCH_FAIL`) and aborted before the script. No Java runtime/JDK 21 is installed, so Firebase rules tests remain blocked.
- Re-ran the preview subset with `node node_modules/@playwright/test/cli.js test --config=playwright.review-run.config.ts`: 21 cases attempted, all stopped before test actions because Chrome exited at startup with `SIGABRT`. The added `design-preview.spec.ts` cases and default `pnpm test:e2e` config were not run.
- The current in-app browser is restored to the home preview. The existing Chrome settings tab was left untouched; port 3010 is still running.
- Stop-hook triage: reduced both all-day chip accent borders from 2px to 1px; a detector recheck of both flagged CSS files returned clean. Persisted only `layout-transition=*` scoped to `src/features/items/ItemEditor.module.css`, with a reason citing the user's sideways-expansion request in browser comment 7. No hook findings remain standing.

## User decisions that remain binding

- Keep the existing product information architecture and functional layout. Refine detailed interaction and visual design according to the browser comments.
- Use white backgrounds and black structure/text. The default accent is teal `#0B756B`; settings offer teal, amber, and sage combinations. Keep color to accents, categories, selected states, and progress.
- The selected logo is concept 2: an original, asymmetric, organic ripple mark with a connected `TODO` wordmark. Move the inner and outer contours in opposite directions on deliberate interaction. In genuine loading states, fill upward from the bottom with the current accent. Respect reduced motion.
- Do not average multiple logo references. Logosystems is the shape-economy reference; the implementation should stay original.
- Keep the unified `새 일정` creation flow: one-time or weekly repeat, then date/time; for multi-day items, allow start-focused or deadline-focused treatment. Preserve existing stored schedule data while removing retired types from new creation.
- Keep tasks distinct from events. On the week calendar, show tasks as `오늘의 할 일 n개`; show timed and all-day events as schedule entries.
- The user explicitly said not to request Sol/subagent review. Ask the user directly if a material ambiguity requires a decision.

## Implemented work

- Logo and brand: `src/features/shell/TodoLogo.tsx`, its CSS module, `src/features/shell/AppShell.tsx`, app icon SVG/raster assets, and `brand/DESIGN.md`. The icon files are `public/icons/app-icon.svg`, `app-icon-192.png`, `app-icon-512.png`, and `apple-touch-icon.png`; the raster files match the refined vector mark.
- Brand/loading animation: connected monoline wordmark, asymmetric inner/outer contours, bottom-up accent fill during real loading, and reduced-motion handling.
- Categories: `src/domain/task-categories.ts`, desktop preferences, `src/features/items/TaskCategoryEditor.tsx`, home action menu/selected-day groups, and the item category dropdown. Category creation is under `디데이 정렬`; empty configured groups remain visible; generic empty state appears only when there are no groups/tasks. Category color options include teal, amber, blue, violet, coral, and sage.
- **Known scope limitation:** category definitions are currently saved in per-device preferences and included in the local preview backup/import flow; they are not account-synced. Individual task category/color values travel with the task item. If cross-device category-definition sync is required, investigate the existing repository/auth architecture first; do not silently add a new persistence mechanism or production dependency.
- Editor and pickers: event-time fields slide horizontally on desktop and stack vertically on narrow screens. The expanded desktop panel now sizes to its full content and the modal body scrolls; this fixed a reproduced clipping bug. Date pickers open below their calendar trigger and time pickers align to their control. The task deadline label/gap was removed. Time-picker `24시간제 완료` text and the discard-dialog separator are absent. Reminder presets remain 10 minutes, 30 minutes, 1 hour, 1 day, and none.
- Calendar/navigation: month completion count is inline with the month title; week calendar hides shell brand/hamburger, moves arrows right, provides a plus action, removes `오늘`, separates all-day items and timed slots, and uses a fixed 08:00–22:00 visible range. The user-visible time-range preference was removed; obsolete stored values are ignored.
- Visual details: multi-color task markers, progress phase colors, padding, white/black theme, refined dropdowns, and bottom-navigation motion were updated.
- Browser review points are summarized in the spec and plan. E2E expectations for persistent empty categories and the week-calendar header were updated in `tests/e2e/design-preview.spec.ts` and `tests/e2e/item-editor-preview.spec.ts`.
- Follow-up changes cover all 17 new comments; the plan marks implementation and available checks complete. The only unresolved verification is environmental: full pnpm/Firebase rules, preview E2E, and direct visual access to settings preferences/timezone controls.

## Visual verification performed

The earlier phase inspected the design preview at desktop (`1018×767`) and mobile (`390×844`). In this continuation, inspected the home/logo, task editor, category editor, event editor before and after its sideways time reveal, week calendar, event detail card, and completed-schedules pane at 1018×767. The week time grid fits the fixed 08:00–22:00 range at this viewport. Settings showed the Firebase setup fallback instead of preferences, so the timezone selector itself was unavailable for visual inspection. Temporary dialogs were closed without saving, the existing Chrome tab was left untouched, and the home preview remains open.

## Checks and environment limits

Passed using the local binaries:

- `node node_modules/typescript/bin/tsc --noEmit`
- `node node_modules/typescript/bin/tsc --noEmit --project tests/e2e/tsconfig.json`
- `node node_modules/typescript/bin/tsc --noEmit --project tsconfig.sw.json`
- `node node_modules/eslint/bin/eslint.js .`
- `node node_modules/vitest/vitest.mjs run --config vitest.config.ts` — 18 files, 160 tests passed.

Not completed:

- Project scripts through `pnpm` were not rerun because Node v26.4.0 and installed pnpm 11.25.0 do not match the project pins (Node 24.21.0 / pnpm 11.19.0). A previous `pnpm test` attempt failed to fetch the pinned version (`ERR_PNPM_META_FETCH_FAIL`) and aborted before running tests. Direct equivalents for TypeScript, ESLint, and unit tests passed.
- The Firebase rules portion of `pnpm test` needs JDK 21. No Java runtime is installed (`java -version` reported no runtime).
- The direct preview Playwright run (`node node_modules/@playwright/test/cli.js test --config=playwright.review-run.config.ts`) attempted all 21 tests, but Chrome exited with `SIGABRT` at browser startup before any test actions ran.
- That preview-only config selects `item-editor-preview.spec.ts`, so it does not cover the follow-up assertions in `design-preview.spec.ts`. The default `pnpm test:e2e` suite remains unrun because the pinned Node/pnpm environment is unavailable.
- The local preview's settings route rendered the Firebase setup fallback; the time-zone formatter passed direct unit tests, but its selector presentation was not visually confirmed.

The plan file records these limitations. Do not report the full `pnpm test` or E2E suite as passing. If the environment becomes available, rerun the checks required by `AGENTS.md`.

## Related product landscape

The user asked whether similar planners exist. Official product pages reviewed:

- [MyStudyLife tour](https://mystudylife.com/tour/) — student-focused classes, homework/tasks, exams, calendar, and partial task progress; closest academic planner comparison.
- [TickTick calendar help](https://help.ticktick.com/articles/7055782166172532736) — multiple calendar views for task planning.
- [Structured](https://structured.app/) — tasks and events in a visual daily timeline.

Positioning recommendation is an inference, not a uniqueness claim: emphasize multi-day application/deadline progress cards while keeping timed events and daily TODOs distinct.

## Remaining verification

When the pinned toolchain is available, run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm test:e2e`; JDK 21 is required for Firebase rules tests. If the Firebase settings fallback is removed for the preview, visually confirm the timezone selector labels. No further design implementation is pending.

## Prompt for the next agent

```text
Continue the existing TodoList planner visual-refresh task in `/Users/changmin/Desktop/projects/TodoList`. First read `AGENTS.md`, `PRODUCT.md`, `docs/handoffs/2026-10-09-planner-visual-refresh.md`, the linked spec/plan, and `brand/DESIGN.md`/`brand/VOICE.md`. Inspect the current working tree and live preview before editing. Preserve all existing user changes and the selected asymmetric ripple + connected TODO logo; do not restart the design or alter the overall functional layout.

All requested visual-refresh and browser-comment work is complete. Preserve the current asymmetric ripple and connected `TODO` logo, white/black surfaces, teal `#0B756B` default accent, teal/amber/sage theme choices, one-time/weekly `새 일정` flow, and task/event distinction. Category definitions are local per device; task category/color values are stored with items. Do not change this sync model or add a production dependency.

No implementation work remains. The remaining checks are blocked by Node/pnpm pin mismatch, absent JDK 21, Chrome `SIGABRT`, and the Firebase setup fallback hiding timezone preferences in the preview. Do not clean/reset the repository or stop the existing port-3010 dev server.
```
