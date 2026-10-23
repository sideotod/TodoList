# TodoList SwiftUI macOS Migration — Design

**Status:** User-approved architecture; implementation plan is under review; no Swift project or implementation code has been created yet.

## Goal and authority

Rebuild TodoList as a native SwiftUI macOS app in a separate directory, matching the supplied v4 screenshots and interaction reference while retaining current account data and Supabase schema. Keep the Next.js application until the native app is actually built, launched, persistence-checked, behavior-checked, and visually reviewed.

The user's latest SwiftUI migration request controls the target platform and architecture. The existing root `AGENTS.md`, `PRODUCT.md`, and earlier v4 web handoff describe the current web implementation and its data contracts; they do not override the user's native-app request. The earlier instruction not to use TDD remains in force: implement a behavior first, then add/run tests for it.

## Repository findings

- The current app has one canonical discriminated record model: `event`, `task`, `deadline`, and `window`. Date-only values are `YYYY-MM-DD`; timed values are UTC ISO instants; each timed record carries an IANA time-zone name.
- Weekly event recurrence stores weekdays and an optional inclusive end date. Period checklist rows are nested under periods; the optional `linkedTaskId` added for v4 makes a linked task's title and completion authoritative.
- The account repository uses `calendar_items.item_data` JSONB, row-level security, an `apply_calendar_item_mutation` RPC, revisions, idempotency receipts, conflict resolution, a local mutation journal, and Supabase Realtime. No destructive database migration is needed for the Swift model.
- The local web store uses `todolist:desktop-preview:v2` and reads a legacy `v1` key. The local JSON backup is `schemaVersion: 1` and contains items, task order, reminder offsets, reminder state, and preferences. The signed-in export is `formatVersion: 1`, containing owner UID, source, canonical items, and pending drafts; the current web app has no matching signed-in restore flow.
- The web local mode is browser-profile scoped. A native app cannot directly read browser `localStorage`, so users must export a JSON file from the web app and import it into TodoList.app.
- Existing preferences include week start, 12/24-hour clock, IANA display zone, accent theme, custom categories, and independent calendar visibility for tasks/events/progress. A configurable visible-hour range was not found in the current source; native settings will add that as a device preference.
- Current reminders use foreground browser polling and cannot fire while that web app is closed. Native scheduling will use macOS local notifications, subject to user authorization.
- Existing authentication is Google OAuth. Supabase needs a native callback URL in its redirect allow-list before that flow can complete. The published project URL and publishable key are client-safe; `service_role` and database credentials must never be shipped.
- The supplied v4 screenshots show a compact 216px-class sidebar, neutral/sage surfaces, dense Korean system typography, Today split into tasks/deadlines and a right mini-calendar/agenda, landscape Progress cards, four calendar modes, and an overlaid right inspector. These screenshots govern geometry and hierarchy; the HTML is an interaction reference only.

### Existing-product features omitted or simplified by the prototype

| Existing feature or production concern | Prototype gap | Native treatment |
| --- | --- | --- |
| Supabase account data, Realtime, revisions, offline outbox, and conflict resolution | Prototype is in-memory/localStorage only | Keep the existing table/RPC/receipt contract and local outbox |
| Current browser localStorage and two JSON backup formats | Demo backup is a different shape and is not server-compatible | Explicit JSON import/export for local and account backups; no direct localStorage access |
| Nested period checklists and independent daily tasks | Demo can otherwise duplicate completion state | Stable linked task IDs; one authoritative TaskItem state |
| Weekly event recurrence and its current whole-series editing behavior | Demo supports weekly recurrence but does not fully specify single-occurrence edits | Preserve existing series representation; make edit scope explicit in the native editor |
| Saved category colors, accent, week start, 12/24h, time zone, and calendar layers | Demo settings are stored-only fields, not a native preferences store | Persist device preferences locally and preserve current JSON fields |
| Local reminders | Web scheduler only polls while the page is open | Use UserNotifications and report authorization accurately |
| Visible time-grid start/end hour | Mentioned in the handoff, but not present in the inspected current preference model | Add a local-only setting with safe defaults; don't change saved record dates |
| Calendar and task ordering, completed items, tombstones, imported metadata | A standalone prototype does not enforce production persistence guarantees | Preserve ordering and active/inactive records in import/store; keep tombstones until acknowledged |

## Approaches considered

1. **SwiftPM + SwiftUI + SwiftData + official Supabase Swift client (recommended).** This creates a reproducible native package and Dock app, uses a native local database and secure auth integration, and can keep the current JSON/RPC protocol. It adds one justified Swift package dependency.
2. **Xcode project + SwiftData + official Supabase Swift client.** This provides Xcode-native asset/signing management, but the requested terminal-first Run action and package-sized project favor SwiftPM; an Xcode project is not needed for the core app.
3. **SwiftPM + custom JSON/SQLite persistence + hand-written Supabase REST/OAuth/WebSocket client.** This avoids a Swift package dependency but recreates authentication, PKCE, WebSocket subscriptions, and database protocol handling, increasing correctness and maintenance risk.

The recommendation is option 1. The project-specific user instruction names the SwiftPM macOS build workflow, and the official Supabase Swift docs provide a native OAuth path using `ASWebAuthenticationSession` and custom redirect URLs ([OAuth reference](https://supabase.com/docs/reference/swift/auth-signinwithoauth), [Swift app tutorial](https://supabase.com/docs/guides/getting-started/tutorials/with-swift)).

## Proposed architecture

Keep a SwiftPM app under `macos/TodoListApp/` so the web project remains untouched during the migration. Use Swift 6, SwiftUI, AppKit only for native auth presentation/window activation where necessary, and a macOS 14 deployment target (SwiftData availability). Organize the package by responsibility:

```text
macos/TodoListApp/
  Package.swift
  Sources/TodoList/
    App/                 app entry point, window, commands, settings scene
    Domain/              Codable records, time/calendar projections, validation
    Data/                 SwiftData store, backup codec, repository
    Sync/                 Supabase adapter, auth, outbox, conflict handling
    Features/             Today, Progress, Calendar, Inspector, Settings
    DesignSystem/         v4 palette, spacing, type, shared controls
  Tests/TodoListTests/    post-implementation unit/integration tests
```

`TodoAppModel` owns navigation, selected date/view, selected item, search, and sheet state. Feature views receive explicit bindings/actions. `ItemRepository` is the only record mutation API. `CalendarItem` remains the wire-compatible source of truth; checklist links refer to stable task IDs and never maintain a second completion value.

Use `NavigationSplitView` for the sidebar and a right SwiftUI inspector for details. Keep Today’s left urgency/task column and right mini-month/event agenda together in one stable scene. Progress cards adapt 3/2/1 columns with available width. Calendar exposes day/week/month/year navigation, visible layers, recurring event projections, overlap lanes, and a real event editor. A native Settings scene contains display, calendar, notifications, account/sync, and data sections. Use scene storage for route/date/view restoration and macOS window restoration for size/placement.

## Persistence and wire compatibility

Use SwiftData for durable local records and sync metadata, behind `LocalStore`/`ItemRepository` protocols. Store each Codable item payload as data alongside its stable ID and query metadata; store pending operations, account ownership, cached remote revision, conflict snapshot, task order, reminder offsets, and preferences in the same local container. Apply mutations and their outbox entry in one SwiftData transaction. Local-only use works without network or account. Keep tombstones until the account sync protocol safely acknowledges them.

Represent calendar dates as date-only strings and instants as normalized UTC ISO strings at the wire boundary. Do not reinterpret existing instants when a display time zone changes. Use `Calendar`/`TimeZone` for local display and recurrence calculations, with explicit handling for DST gaps/repeated times. Progress elapsed-time is calculated only for meaningful start/end intervals and remains separate from linked-task completion.

The JSON importer first parses and validates the entire file, shows a restore preview, then writes atomically after an explicit user action. It will accept:

1. Existing local `schemaVersion: 1` backups, preserving records, ordering, reminders, categories, and display preferences.
2. Existing signed-in `formatVersion: 1` exports, including pending changes. The import UI will show account ownership and pending drafts before any merge; it must not silently replace newer server data. A same-account import uses revision/conflict handling. Importing into local mode or a different account creates an isolated local copy with remapped item/checklist IDs and no automatic upload until the user chooses to sync.
3. The pre-v2 browser localStorage record format (`version: 1`) if it is supplied as JSON; records are validated and mapped to the current model.

Export local data using the established `schemaVersion: 1` shape. Export account data using the established `formatVersion: 1` shape, retaining pending drafts. Unknown, duplicate, invalid, or oversized input must fail before mutating the current store. Keep the original backup file unchanged and report item counts/results.

## Supabase authentication and synchronization

Use the official `supabase-swift` client for Auth, PostgREST, RPC, and Realtime. **[ASSUMPTION: add the official Swift package dependency; it is needed to preserve the existing Supabase contract without a hand-written auth/WebSocket client.]** The SDK documents Keychain-backed session persistence by default on Apple platforms; verify this against the resolved package version and retain that secure default ([SDK auth configuration](https://github.com/supabase/supabase-swift/blob/main/Sources/Auth/AuthClientConfiguration.swift)). Configure Google OAuth with `ASWebAuthenticationSession` and a registered `todolist://auth/callback` URL; the Supabase dashboard redirect allow-list must include that callback. Load only the project URL and publishable key from app configuration; never include a service-role key.

Preserve the existing table read and mutation RPC exactly: fetch `item_id,item_data` for the authenticated UID; commit via `apply_calendar_item_mutation` with the same operation ID, digest, base revision, mutation kind, and proposed JSON; validate receipts and remote records; observe `calendar_items` Realtime events and reload the authenticated user's snapshot. Persist an ordered outbox locally, retry retryable failures with bounded backoff, resume on network return, and surface conflicts with keep-remote/use-local/edit/restore-as-new choices. Sign-out leaves the local cache intact and stops account requests. A newly configured project must apply the existing SQL migration; this task must not reset or rewrite server data.

Live Google OAuth and cross-device Realtime verification depend on a valid project configuration, a reachable Supabase project, Google provider setup, and the native redirect allow-list. When any is unavailable, local CRUD/offline operation remains usable and the UI reports that exact connection state.

## Feature and interaction plan

- **Today:** selected date header; merged nearest start/deadline list; inline focused task composer; task completion, edit/delete, ordering, category, note, URL, and Progress links; mini-month selection updates the left tasks and right agenda; recurring events appear on their occurrence dates.
- **Progress:** landscape cards, type/active/completed filters, target/title/recent sorting, countdowns, start countdowns, interval elapsed-time only when both endpoints are meaningful, linked task completion, add/edit/delete/complete, and calendar navigation.
- **Calendar:** day/week/month/year views, previous/next/today controls, independent item layers, empty date/time creation, all-day and timed events, weekly recurrence through inclusive end date, overlap columns, and overflow that remains reachable. Selecting an item opens its inspector without losing the underlying date/view.
- **Inspector:** type-specific title, category, timing/time zone, remaining time, interval progress, linked tasks, note/URL, reminder, edit/complete/delete, and calendar navigation. Escape and the close control dismiss it.
- **Search and commands:** global search across tasks/events/periods; ⌘K search, ⌘N new task, ⌘, Settings, keyboard-accessible date/view navigation and inspector dismissal.
- **Settings:** accent/theme and system appearance, categories, week start, 12/24-hour clock, display time zone, visible hours, calendar layers, notification permission and per-item lead time, local/account mode, sync state, import/export, and account sign-in/out.
- **Notifications:** schedule/cancel native local notifications when records or offsets change; request authorization only after the user enables notifications. If authorization is denied, show the actionable OS setting state and keep reminder preferences intact.

## Visual implementation

Use native controls while matching the v4 screenshots: 216px-class source-list sidebar; compact title/toolbar; soft sage selection and accent; near-white content; thin neutral borders; restrained corner radii; Korean-first system typography; tabular countdown digits; landscape Progress cards; the Today two-column ratio; calendar color/category cues; and a right inspector with clear type sections. Avoid default opaque split-column fills where they obscure the reference. Verify 1512×982, 1280×800, and 1024×768 windows and adjust inspector/card widths at each size. The app may use SF Symbols for native actions but will preserve the Todo wordmark/icon assets where practical.

## Build, run, and verification

Add the root `script/build_and_run.sh` as the single kill/build/stage/run entrypoint, staging `dist/TodoList.app` with bundle metadata and launching it through `/usr/bin/open -n`. Add `.codex/environments/environment.toml` with a Run action that invokes the script. Support `--debug`, `--logs`, `--telemetry`, and `--verify`. Never print public configuration values while generating the app bundle.

Implementation precedes test authoring (no TDD). After each vertical slice, add focused Swift Testing/XCTest coverage for Codable compatibility, date/DST and countdown rules, CRUD persistence, task-link synchronization, recurrence, backup import/export, and sync state transitions. Then run `swift build`, `swift test`, and the app script; manually launch and verify persistence across relaunch. Capture actual macOS windows at all three required sizes and record reference comparisons in `docs/swiftui-design-qa.md`.

## Safe migration gates

1. **Completed:** create `codex/swiftui-macos-migration`; checkpoint current web/v4 state as commit `564b88b`.
2. After design and implementation-plan approval, build the native package in `macos/TodoListApp/` without touching web sources or backend data.
3. Validate model/backup compatibility, CRUD, recurrence, all calendar modes, settings, local persistence, account sync (when configured), app launch, and screenshots. Fix every in-scope failure.
4. Delete web-only code/dependencies/config/tests only after all acceptance checks pass, with the checkpoint commit preserved as the rollback path. If live auth, app launch, data restore, or required testing cannot be verified, retain the web project and document the blocker instead of deleting it.
5. Produce `TodoList.app`, migration documentation, and a final inventory of retained/deleted files and limitations.

## Acceptance conditions

- A real Finder/Dock-launchable `TodoList.app` builds from the package without JavaScript/Electron/Tauri or a Next.js server.
- Today, Progress, Calendar day/week/month/year, inspector, Settings, local CRUD, stable linked-task state, import/export, recurrence, and saved preferences work in the launched app.
- Existing local and account backup formats parse without data loss; backend table/RPC/schema and existing records remain unchanged.
- Offline edits persist and remain queued; authenticated data uses the current revision/idempotency/conflict contract.
- Tests and actual macOS screenshots are recorded. Only then may the web implementation be removed.
