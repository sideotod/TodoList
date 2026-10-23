# macOS v4 implementation log

## Start state

- Branch: `codex/macos-v4-redesign` (created from `codex/desktop-ui-components` at `cfb3565`).
- Worktree started clean.
- Baseline `pnpm test`: 23 files / 198 tests passed.
- Baseline `pnpm typecheck`: passed.
- Baseline `pnpm lint`: passed.
- Baseline `pnpm test:e2e`: sandbox first denied local server bind; elevated run started. Partial baseline before interrupt: 5 passed, 4 failed, 1 interrupted, 44 not run. One failure exposed recurring event edit using the clicked occurrence date instead of the stored series start; other initial failures used old menu/detail locators that need review against v4.
- Runtime used: Node `v26.4.0` and pnpm `11.25.0`; repository pins Node `24.21.0` and pnpm `11.19.0`.

## Decisions

- Ruling: keep the current item/repository/sync model and build the v4 screens over it — replacing storage would break offline drafts, conflict resolution, and cross-device sync.
- Ruling: link checklist rows to independent tasks by optional task ID and derive linked title/completion from the task — this avoids maintaining a second writable completion value; legacy checklist fields remain fallback.
- Ruling: preserve local-preview JSON restore and signed-in JSON export as separate existing flows — the signed-in export has no matching import implementation to preserve.
- Ruling: use the repository's versioned settings storage and add v4 accent choices without changing saved category colors.

## Task status

- [x] Inspect app, domain model, persistence, settings, tests, and v4 package.
- [x] Record gap matrix, design decisions, and implementation plan.
- [x] Implement shell and route navigation.
- [x] Implement Today and inline composer.
- [x] Implement Progress, linked checklist projection, and shared inspector.
- [x] Implement Calendar day/week/month/year and independent layers.
- [x] Finish settings/search/shortcut integration.
- [x] Capture required viewports, run final verification, and document remaining gaps.

## Implementation summary

- Added the v4 macOS shell, sidebar navigation, global search, Today layout, inline task creation, selected-day agenda, mini calendar, and grouped task list while retaining the existing mobile navigation.
- Replaced the old image lockup with the v4 checkbox wordmark and added working title-bar back, Today, create, and search controls.
- Added a dedicated Progress route with three-column cards, type/filter/sort controls, countdown and elapsed-time indicators, task completion projection, and calendar navigation.
- Added day, week, month, and year calendar views with task/event/progress visibility layers and shared item detail/edit flows.
- Added stable optional task IDs to checklist rows so linked independent tasks project their title and completion into Progress without duplicating writable completion state. Legacy checklist text/completion remains the fallback.
- Kept persistence on the existing repository and item payload model. No destructive migration, database reset, or production dependency was added.
- Retained the existing authentication, sync, local preview, settings, and backup paths; updated the settings page to use a Suspense boundary for Next.js static rendering.
- TDD was not used, as explicitly requested. Tests were run after implementation for verification.

## Final verification

- `pnpm test`: passed, 24 files / 203 tests.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm build`: passed, including the service-worker TypeScript build and Next.js static generation.
- `pnpm test:e2e`: passed, 55 tests. The final run includes the settings Suspense fix.
- `git diff --check`: passed.
- Playwright captured Today, Progress, Calendar day/week/month/year, task/Progress/event detail, and settings at 1512×982, 1280×800, and 1024×768 in `test-results/macos-v4/`; the captures were visually reviewed after the final shell update. No automated pixel-diff score was run.
- Verification used Node `v26.4.0` and pnpm `11.25.0`, rather than the repository-pinned Node `24.21.0` and pnpm `11.19.0`.

## Remaining gaps and visual differences

- Signed-in Supabase authentication and cross-device synchronization were not live-verified because this environment did not provide service credentials. The existing repository-backed path remains in place.
- Browser notifications depend on the existing running browser context and user permission. Native macOS notification authorization is outside this web app's current implementation.
- The existing signed-in JSON flow exports data; a corresponding signed-in import path was not present in the baseline. Local-preview restore remains available.
- The Today task list groups populated categories, whereas the reference screenshot presents a flatter list with category badges. Progress card details and calendar headers/range controls differ slightly from the reference. Year view is a 12-month grid rather than a native Apple Calendar-style year canvas. These captures were reviewed visually but not measured with pixel-diff tooling.
