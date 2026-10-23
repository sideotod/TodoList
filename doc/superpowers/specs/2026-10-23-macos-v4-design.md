# TodoList macOS v4 design

## Intent

Bring the existing Todo planner to the v4 macOS desktop experience. The main user is a Korean university or graduate student planning daily tasks, classes, and deadlines across a desktop and iOS device. Success means that Today, Progress, Calendar, and the shared inspector follow the supplied v4 screenshots and prototype while the existing records, local mode, account sync, and backup path remain usable.

## Goals

- Use the supplied screenshots as the visual reference and `todolist_macos_unified_v4.html` as the interaction reference.
- Keep the current Next.js, React, TypeScript, and Supabase stack and use the existing repository for every record mutation.
- Build an app shell with desktop sidebar navigation and keep the existing mobile/PWA navigation available at narrow widths.
- Make the Today, Progress, day/week/month/year Calendar, shared inspector, and Settings flows usable with mouse and keyboard.
- Keep task completion separate from period elapsed-time progress.
- Preserve recurrence, category data, time-zone settings, notifications, auth, offline drafts, conflict handling, and current backup formats.
- Add only optional JSON fields for stable relationships so old item snapshots remain valid.
- Document the observed v4/production gaps, the data decisions, and any platform limitation that remains.

## Non-goals and anti-goals

- Do not embed or copy the prototype HTML into an iframe or ship it as application logic.
- Do not replace the item repository, Supabase mutation protocol, local journal, or conflict model.
- Do not delete, reset, or silently rewrite existing user records.
- Do not add a production dependency without identifying it as `[ASSUMPTION]` and discussing it in a PR.
- Do not show an action as available if it has no product behavior; do not use a toast or alert instead of the required action.
- Do not imply that a browser notification is scheduled by macOS while the app is closed.

## Approaches considered

1. **Rebuild the current UI around its existing item model and storage boundary (selected).** Reuse the repository, editor, calendar calculations, period projections, local preview storage, sync status, and settings. Add focused view components around them. This best preserves data and lets the v4 layout replace the old composition without introducing a second source of truth.
2. **Port the standalone HTML state and recreate production integrations afterward.** This would map easily to the screenshot, but its demo JSON shape and local-only state conflict with Supabase, revisions, offline drafts, and backup compatibility.
3. **Replace the domain and persistence schema to match the prototype.** This could make the UI model look simpler, but it adds a destructive migration and broadens sync risk without being required by v4.

The first approach is the only one consistent with the request to keep the current data and synchronization behavior. The selected visual change is deliberate: the v4 screenshot's pale sage surfaces, quiet borders, compact system typography, left rail, and inspector take precedence over older page geometry and accent choices where they conflict. Existing saved category colors remain data, not interface chrome.

## Current implementation and gap matrix

| Area | Production now | v4 request | Planned treatment |
| --- | --- | --- | --- |
| Shell | Centered compact frame with brand bar and bottom navigation | macOS chrome and left sidebar | Replace desktop frame and navigation; retain narrow/mobile navigation and auth/sync overlays |
| Today | Month task grid, selected-day task list, and a three-card period strip | Upcoming deadlines/starts and tasks on the left; mini month and selected-day events on the right | Recompose around the selected date and keep existing date navigation, task ordering, and repository mutations |
| Progress | Three period cards appear on Today; no `/progress` route | Dedicated filterable 3-column gallery and CRUD | Add route and reuse period projections/editor and repository |
| Calendar | Weekly time grid and a separate period-list filter | Day, week, month, year plus independent item layers | Keep the established time-grid engine; add shared date toolbar and day/month/year views |
| Detail | Centered dialog with summary, notes/link, countdown switch, and edit action | Shared right-side inspector with dates, checklist, memo, URL, category, actions | Reuse item data and editor; present selection in an inspector with type-specific sections |
| Checklist relation | Period checklist items have stable IDs, but no link to independent tasks | Connected task state must stay synchronized | Add an optional checklist `linkedTaskId`; when linked, the TaskItem completion/title is authoritative and the legacy checklist values remain fallback for unlinked or missing targets |
| Settings | Week start, clock format, zone, color theme; local notification and local backup screens | v4 settings panel and data controls | Reuse saved preferences and local notification/data features; expose calendar layers and retain JSON format |
| Search and shortcuts | No global search workflow found | Search and ⌘K, ⌘N, ⌘, shortcuts in the prototype | Add a searchable item palette and wire shortcuts to existing item/settings routes |
| Backup | Local preview has validated JSON export/import; signed-in repository exports versioned JSON but no restore action | Preserve JSON backup/restore | Keep both existing formats readable and keep restore available in local preview; preserve signed-in export without introducing a new server restore path |
| Notifications | Browser notification permission and foreground polling exist in local preview while the app is open | Preserve notification settings | Preserve honest permission/runtime messaging; do not claim OS background scheduling |

## Data and safety decisions

- The canonical records stay `event | task | deadline | window` and continue to be saved through `src/lib/repository.ts`.
- Existing period checklists use JSON inside `item_data` (`jsonb`). `linkedTaskId?: string` is additive and omitted for old records. No SQL migration is required; validation, projection, export, and import must preserve the optional field.
- For linked checklist rows, the referenced TaskItem supplies title and completion. The checklist's existing `title` and `completed` remain authoritative only when there is no valid link, so the same linked status is not independently edited in two records.
- A missing or deleted linked target falls back to the last stored checklist values. Deleting a linked task must first save an unlink that snapshots the current derived values; if the unlink fails, keep the task.
- Calendar layer visibility and calendar display mode are device preferences. They do not change stored item data.
- Existing date/time values remain in their original time zones and instants. The display setting controls formatting and newly entered times; it does not rewrite existing instants.
- Local preview backup restore validates the full candidate before writing and retains its current explicit replace confirmation. The signed-in repository backup remains an export of canonical records and queued changes; importing that file into an account would require a separate merge/conflict design and is not represented as an existing capability.

## Visual and interaction contract

- Desktop content begins below a thin title bar and beside a roughly 216px sidebar. The selected state uses a soft sage fill; content stays white or near-white with thin neutral borders.
- Today uses a left content column for the shared urgency list and task list, and a right rail for the mini month and selected-day events. `+ 새 할 일` sits in the task heading and opens an inline focused composer.
- Progress uses landscape cards with countdown, endpoint dates, elapsed-time progress only for meaningful periods, and a separately labeled linked-task completion count. Wide screens use three columns, with fewer columns as space narrows.
- Calendar has day, week, month, and year controls. Date navigation and layer toggles remain visible. Existing overlap placement is reused for timed events; month/year summaries must offer an accessible path to overflow.
- Selecting any task, period, or event opens the same right-side inspector. Escape and the close button return focus to the trigger.
- At 1512×982, 1280×800, and 1024×768, no screen may develop unintended horizontal overflow. At narrower PWA widths, current navigation and reachable controls must remain intact.
- Korean copy, platform system fonts, readable secondary text, visible focus, reduced-motion support, and saved category colors are retained.

## Verification

Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `pnpm test:e2e`. Add Playwright captures at 1512×982, 1280×800, and 1024×768 for Today, Progress, all four Calendar modes, task/period/event inspector, and Settings. Compare the matching supplied screenshots where available and record any remaining visual difference or runtime limitation. No test-first/TDD workflow is to be used; tests are authored or adjusted after the corresponding behavior is implemented, as explicitly requested.
