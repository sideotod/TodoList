# TodoList SwiftUI Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a runnable SwiftPM macOS shell with a validated, persistent local item repository.

**Architecture:** Keep the JSON wire model independent of SwiftData. Persist encoded item payloads and local metadata through a SwiftData-backed repository so UI and sync later share one local boundary.

**Tech Stack:** Swift 6, SwiftUI, SwiftData, Foundation, XCTest, macOS 14+.

**Spec:** `doc/superpowers/specs/2026-10-23-swiftui-macos-migration.md`

## Global Constraints

- Use macOS 14 minimum deployment target and SwiftPM.
- Preserve `event | task | deadline | window`, optional JSON fields, UTC instants, date-only strings, and IANA time zones.
- Local CRUD must work offline; do not touch existing web or backend data.
- Implement first, then add/run tests; no TDD.

## Review Focus

- JSON encoding must omit absent optional fields instead of emitting `null`; test representative event, task, and period payloads.
- Invalid kind/timing combinations must fail validation before storage; test malformed and incomplete records.
- SwiftData writes must survive store/container recreation; test create, update, delete, and reopen.
- Duplicate IDs and corrupt payloads must not overwrite or crash the local store; test duplicate and decode-failure behavior.
- Date-only values must remain unchanged in non-UTC locales; test serialization in `Asia/Seoul` and a DST-observing zone.

---

### Task 1: Bootstrap the SwiftPM app shell

**Files:**
- Create: `macos/TodoListApp/Package.swift`
- Create: `macos/TodoListApp/Sources/TodoList/App/TodoListApp.swift`
- Create: `macos/TodoListApp/Sources/TodoList/App/RootView.swift`
- Create: `macos/TodoListApp/Sources/TodoList/App/AppModel.swift`
- Create: `macos/TodoListApp/Sources/TodoList/DesignSystem/Theme.swift`
- Create: `macos/TodoListApp/Tests/TodoListTests/AppLaunchTests.swift`

**Interfaces:**
- Produces executable product `TodoList` and test target `TodoListTests`.
- `RootView` receives `AppModel` and renders a three-section `NavigationSplitView` shell with Today selected by default.
- The initial `AppModel` owns the selected section; later plans extend it with repository, date, inspector, and search state.

- [ ] Create the SwiftPM manifest with one macOS executable and one XCTest target; set `.macOS(.v14)`.
- [ ] Implement the SwiftUI `@main` entry point and a resizable `WindowGroup` titled `TodoList`.
- [ ] Implement the root sidebar/detail shell with the v4 sage selection and neutral content tokens.
- [ ] Add `AppLaunchTests.testRootViewConstructsWithTodaySelected`; assert the root view constructs and its initial section is Today.
- [ ] Run `swift build --package-path macos/TodoListApp`; expected: executable links for arm64 macOS.
- [ ] Run `swift test --package-path macos/TodoListApp`; expected: launch test passes.

### Task 2: Define the wire-compatible domain and validation

**Files:**
- Create: `macos/TodoListApp/Sources/TodoList/Domain/CalendarItem.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Domain/ItemTiming.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Domain/ItemValidation.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Domain/ItemCoding.swift`
- Create: `macos/TodoListApp/Tests/TodoListTests/ItemCodingTests.swift`
- Create: `macos/TodoListApp/Tests/TodoListTests/ItemValidationTests.swift`

**Interfaces:**
- `struct CalendarItem: Codable, Hashable, Identifiable, Sendable` stores `id`, `kind`, `title`, optional category/color/notes/URL, `timing`, completion, checklist rows (`id`, `title`, `completed`, optional `linkedTaskId`), event countdown (`enabled`, `daysBefore`, `reference`), `showInProgressSummary`, weekly recurrence (`daysOfWeek`, inclusive `untilDate`), period start countdown (`enabled`, `daysBefore`), optional `revision`, `updatedAt`, `deletedAt`, `lastMutationId`, `lastMutationDigest`, and optional `importSource`.
- `enum ItemKind: String, Codable, CaseIterable, Sendable` has `event`, `task`, `deadline`, `window`.
- `enum ItemTiming: Hashable, Sendable` has `unscheduled`, `date(startDate:endDate:timeZone:)`, and `time(startAt:endAt:timeZone:)`; custom Codable preserves the existing flat JSON keys.
- `ItemValidator.validate(_ item: CalendarItem) throws` enforces existing per-kind required fields, ranges, IDs, and time-zone validity.

- [ ] Implement the Codable domain types and custom timing encoder/decoder to preserve the existing JSON object shape.
- [ ] Implement kind-specific validation, including the current 200-character title, 10,000-character note, 64-character category, 2,048-character URL, and four-checklist-row limits.
- [ ] Add `ItemCodingTests.testProposalOmitsMissingMetadataAndOptionalNulls`; assert absent optional/server keys are not encoded as `null`.
- [ ] Add `ItemCodingTests.testCanonicalRoundTripPreservesLinkedChecklistAndRecurrence`; assert linked IDs, weekdays, inclusive end date, and event countdown survive encode/decode.
- [ ] Add `ItemValidationTests.testRejectsInvalidRangeAndKindTiming`; assert invalid input throws before persistence.
- [ ] Add `ItemValidationTests.testRejectsInvalidTimeZoneAndEmptyID`; assert invalid zones and empty item IDs are rejected.
- [ ] Run `swift test --package-path macos/TodoListApp`; expected: codec and validation tests pass without changing sample JSON semantics.

### Task 3: Persist local records and preferences

**Files:**
- Create: `macos/TodoListApp/Sources/TodoList/Data/StoredItem.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Data/StoredOperation.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Data/LocalStore.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Data/ItemRepository.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Data/SwiftDataItemRepository.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Data/PreferencesStore.swift`
- Create: `macos/TodoListApp/Tests/TodoListTests/LocalRepositoryTests.swift`

**Interfaces:**
- `@MainActor protocol ItemRepository` exposes `listItems() async throws -> [CalendarItem]`, `item(id:) async throws -> CalendarItem?`, `upsert(_:) async throws`, and `delete(id:) async throws`.
- `SwiftDataItemRepository` implements the protocol using a local SwiftData container; stored payloads remain Codable JSON data.
- `PreferencesStore` loads/saves versioned preferences for week start, time format, time zone, accent, categories, calendar layers, and visible hours/order. Legacy reminder keys are retained solely for persisted-preference and JSON compatibility.

- [ ] Implement SwiftData models for records and persisted mutation metadata without changing remote schema.
- [ ] Implement the repository transaction boundary so an item edit and any account-scoped pending operation are saved together; local-only edits remain local records.
- [ ] Implement versioned device preference load/save with defaults matching current web preferences.
- [ ] Add `LocalRepositoryTests.testUpsertSurvivesContainerReopen`, `testDeletePersistsTombstone`, and `testFailedTransactionKeepsPreviousPayload`; assert durable CRUD and rollback.
- [ ] Add `PreferencesStoreTests.testLegacyDefaultsAndRoundTrip`; assert absent preference fields get defaults and saved values reload exactly.
- [ ] Run `swift test --package-path macos/TodoListApp`; expected: all local persistence tests pass after recreating the SwiftData container.

### Task 4: Verify the local-only vertical slice

**Files:**
- Modify: `macos/TodoListApp/Sources/TodoList/App/RootView.swift`
- Modify: `macos/TodoListApp/Sources/TodoList/App/AppModel.swift`
- Modify: `macos/TodoListApp/Tests/TodoListTests/AppLaunchTests.swift`

**Interfaces:**
- `@MainActor @Observable final class AppModel` owns route, selected date, and an injected `ItemRepository`.
- Local-only startup must require neither Supabase configuration nor network access.

- [ ] Inject `SwiftDataItemRepository` into the app model and load locally stored items at launch.
- [ ] Add a visible local-only/sync status and empty state to the root detail view.
- [ ] Add `AppLaunchTests.testOfflineLaunchNeedsNoSupabaseConfiguration`; assert the root loads with an in-memory store when no remote config exists.
- [ ] Run `swift build --package-path macos/TodoListApp` and `swift test --package-path macos/TodoListApp`; expected: offline shell builds and opens with local store available.
- [ ] Commit the verified milestone as `feat: add native SwiftUI local foundation`.
