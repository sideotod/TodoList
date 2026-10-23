# TodoList SwiftUI v4 Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement v4 Today, Progress, Calendar, shared inspector, and settings as native SwiftUI screens.

**Architecture:** Keep explicit selection/date/view state in `AppModel`; compute presentation through pure projections; send every mutation through `ItemRepository` from the local foundation plan.

**Tech Stack:** Swift 6, SwiftUI, SwiftData-backed repository, XCTest, macOS 14+.

**Spec:** `doc/superpowers/specs/2026-10-23-swiftui-macos-migration.md`

## Global Constraints

- Match the supplied 1512×982 v4 screenshot hierarchy and adapt at 1280×800 and 1024×768.
- Keep stable record IDs, linked task state, category colors, notes, URLs, recurrence, and completion.
- Every visible control must call a real route, selection, editor, preference, or repository action.
- Implement behavior before adding its tests; no TDD.

## Review Focus

- Empty dates, completed-only dates, and dates with recurring events must all show consistent Today tasks and agenda.
- Start-only Progress records must not show elapsed-time progress; task completion is a separate metric.
- Calendar overlap, all-day stacks, and long titles must remain selectable instead of clipping or obscuring events.
- Inspector dismissal must restore the previous route/date selection and keyboard focus.
- At 1024×768, sidebar, view controls, content, and inspector must remain reachable without horizontal overflow.

---

### Task 1: Add native navigation, commands, and shared inspector state

**Files:**
- Modify: `macos/TodoListApp/Sources/TodoList/App/AppModel.swift`
- Modify: `macos/TodoListApp/Sources/TodoList/App/RootView.swift`
- Create: `macos/TodoListApp/Sources/TodoList/App/AppCommands.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Features/Inspector/ItemInspectorView.swift`
- Create: `macos/TodoListApp/Tests/TodoListTests/NavigationStateTests.swift`

**Interfaces:**
- `enum AppRoute: Hashable` has `today`, `progress`, `calendar`; Settings is a separate native scene.
- `enum CalendarViewMode: String, CaseIterable` has `day`, `week`, `month`, `year`.
- `AppModel` exposes `selectedDate`, `calendarViewMode`, `selectedItemID`, `selectedCategoryFilter`, `inspectorPresented`, and `searchPresented`.
- `ItemInspectorView(item:repository:onEdit:onComplete:onDelete:onShowInCalendar:onClose:)` renders type-specific content and exposes real edit/complete/delete/calendar callbacks.

- [ ] Implement persistent split-view selection and an inspector that does not replace the underlying feature route.
- [ ] Wire ⌘N, ⌘K, ⌘, and Escape to new task, search, the native Settings scene, and inspector dismissal.
- [ ] Populate the sidebar's “내 영역” filters from saved categories and apply category selection without changing the selected date.
- [ ] Implement the shared inspector's fields and complete/edit/delete/calendar callbacks for each item kind.
- [ ] Add `NavigationStateTests.testInspectorDismissalPreservesRouteDateAndCategory`; assert main-window context remains intact.
- [ ] Run `swift test --package-path macos/TodoListApp`; expected: navigation and inspector state tests pass.

### Task 2: Implement Today and Progress

**Files:**
- Create: `macos/TodoListApp/Sources/TodoList/Features/Today/TodayView.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Features/Today/TodayProjection.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Features/Today/InlineTaskComposer.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Features/Items/ItemEditorView.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Features/Items/ItemEditorDraft.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Features/Progress/ProgressView.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Features/Progress/ProgressCard.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Features/Progress/ProgressProjection.swift`
- Create: `macos/TodoListApp/Tests/TodoListTests/TodayProjectionTests.swift`
- Create: `macos/TodoListApp/Tests/TodoListTests/ProgressProjectionTests.swift`

**Interfaces:**
- `TodayProjection.nearby(items:now:timeZone:limit:) -> [CalendarItem]` returns the next four upcoming/unfinished starts and deadlines, plus opted-in events.
- `TodayProjection.tasks(on:items:order:completedVisible:categoryFilter:) -> [CalendarItem]` returns ordered tasks for the selected date and selected sidebar category.
- `ProgressProjection.metrics(for:now:items:) -> ProgressMetrics` separates countdown, meaningful interval elapsed percent, and linked-task completion.
- `struct ProgressMetrics` contains `countdownLabel`, optional `elapsedFraction`, and `completedTasks`/`totalTasks`.
- `struct ItemEditorContext` contains optional `dateOnly`, optional `startInstant`, and `timeZone` prefill values.
- `ItemEditorView(initialItem:defaultKind:context:repository:onSaved:onCancel:)` edits all four kinds, category/color, timing/time zone, memo, URL, links, countdown, recurrence, and event Progress visibility.
- `ProgressGalleryView(model:repository:)` supports type/status filters, target/name/recent sort, card selection, and CRUD.

- [ ] Build the v4 Today two-column layout with urgency list, task list, mini month, selected-day agenda, and inline auto-focused task creation.
- [ ] Wire Today task check/edit/delete/reorder and selected-date interactions to `ItemRepository`.
- [ ] Implement the shared item editor and route Task/Progress create and edit actions to it; keep the inline Today composer as a focused title-first path.
- [ ] Build responsive Progress cards and type/status filters, sorting, D-day/countdown, interval bar, linked task count, and opted-in event summaries.
- [ ] Wire Progress add/edit/complete/delete and calendar target selection.
- [ ] Add `TodayProjectionTests.testNearbyReturnsFourNearestStartsAndDeadlines`, `testCategoryFilterKeepsSelectedDate`, and `testMissingLinkedTaskUsesSavedChecklistValue`.
- [ ] Add `ProgressProjectionTests.testStartOnlyHasNoElapsedBar`, `testIntervalProgressDiffersFromChecklistCompletion`, `testLinkedTaskCompletionIsAuthoritative`, and `testOptedInEventAppearsInProgress`.
- [ ] Run `swift test --package-path macos/TodoListApp`; expected: Today/Progress projection and CRUD tests pass.

### Task 3: Implement Calendar day/week/month/year and recurrence

**Files:**
- Create: `macos/TodoListApp/Sources/TodoList/Features/Calendar/CalendarView.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Features/Calendar/CalendarProjection.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Features/Calendar/WeeklyRecurrence.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Features/Calendar/DayCalendarView.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Features/Calendar/WeekCalendarView.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Features/Calendar/MonthCalendarView.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Features/Calendar/YearCalendarView.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Features/Calendar/EventEditorView.swift`
- Create: `macos/TodoListApp/Tests/TodoListTests/CalendarProjectionTests.swift`

**Interfaces:**
- `CalendarProjection.visibleItems(on:items:layers:timeZone:) -> [CalendarItem]` expands recurring events without persisting duplicate occurrences.
- `CalendarProjection.overlapLanes(for:) -> [CalendarLane]` assigns timed events to non-overlapping visual lanes.
- `WeeklyRecurrence.occurrence(of:on:) -> CalendarItem?` returns an event occurrence only on selected weekdays between start and inclusive `untilDate`.
- `CalendarView(model:repository:preferences:)` owns day/week/month/year controls, previous/next/today, layer toggles, and creation actions.
- `EventEditorView` wraps `ItemEditorView` with event defaults from a selected date/time slot.

- [ ] Implement calendar toolbar, date navigation, layer visibility, and four native views.
- [ ] Implement recurring event projection with time-zone and DST handling, multi-day duration, inclusive end date, and edit-series scope.
- [ ] Implement empty date/time-slot event creation and event edit/delete through the shared editor and repository; persist recurrence and `showInProgressSummary`.
- [ ] Add `CalendarProjectionTests.testWeeklyUntilDateIsInclusive`, `testTimedOccurrenceResolvesDSTGapAndRepeat`, `testOverlappingEventsUseSeparateLanes`, and `testAllDayOverflowRemainsSelectable`.
- [ ] Run `swift test --package-path macos/TodoListApp`; expected: calendar and recurrence tests pass.

### Task 4: Implement search and v4 settings presentation

**Files:**
- Create: `macos/TodoListApp/Sources/TodoList/Features/Search/GlobalSearchView.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Features/Settings/SettingsView.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Features/Settings/CalendarPreferencesView.swift`
- Modify: `macos/TodoListApp/Sources/TodoList/App/TodoListApp.swift`
- Modify: `macos/TodoListApp/Sources/TodoList/App/RootView.swift`
- Modify: `macos/TodoListApp/Sources/TodoList/DesignSystem/Theme.swift`
- Create: `macos/TodoListApp/Tests/TodoListTests/SearchAndPreferencesTests.swift`

**Interfaces:**
- `ItemSearch.filter(_:query:) -> [CalendarItem]` searches title, category, notes, and URL without changing records.
- `SettingsView(preferencesStore:)` edits accent/system appearance, categories, week start, clock, time zone, visible hours, and calendar layers in the native `Settings` scene.

- [ ] Implement global search with result selection opening the shared inspector.
- [ ] Implement settings controls backed by `PreferencesStore`, including migration defaults for absent calendar layer/visible-hour fields.
- [ ] Add the native `Settings` scene and a sidebar settings link that opens it without replacing the active planner window.
- [ ] Apply theme/accent tokens without recoloring stored category colors.
- [ ] Add `SearchAndPreferencesTests.testSearchMatchesTitleCategoryNotesAndURL` and `testPreferencesMigrateDefaultsAndRoundTrip`.
- [ ] Run `swift test --package-path macos/TodoListApp`; expected: search/preferences tests pass.
- [ ] Commit the verified milestone as `feat: implement native v4 planner views`.
