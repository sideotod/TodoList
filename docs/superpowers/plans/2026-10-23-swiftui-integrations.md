# TodoList SwiftUI Integrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve local backup compatibility, Supabase Google OAuth, and offline-first account sync.

> **Superseded notification scope:** On 2026-10-23 the user explicitly removed notifications from the product. Task 2 below is retired: no authorization UI, scheduling, reminder controls, or future notifications. The app only clears pending and delivered requests left by the previous native reminder implementation. Legacy reminder fields remain readable/writable in v1 JSON for backup compatibility and have no runtime effect.

**Architecture:** Validate JSON before local transactions; use `supabase-swift` behind a remote repository adapter; keep mutations in a durable ordered outbox and expose conflicts to the UI.

**Tech Stack:** Swift 6, SwiftUI, SwiftData, official `supabase-swift`, Security/Keychain, XCTest.

**Spec:** `doc/superpowers/specs/2026-10-23-swiftui-macos-migration.md`

## Global Constraints

- Preserve local `schemaVersion: 1` and signed-in `formatVersion: 1` JSON formats.
- Reuse `calendar_items`, `apply_calendar_item_mutation`, existing RLS and revision semantics; do not change backend schema/data.
- Client configuration may contain only Supabase URL and publishable key; never ship secrets.
- OAuth callback is `todolist://auth/callback`; live sign-in requires server allow-list and Google provider configuration.
- Implement behavior before tests; no TDD.

## Review Focus

- Import must prevalidate all items before mutation; malformed later rows cannot leave a partial restore.
- Importing foreign-owner account data must never enqueue writes under the current UID without explicit remap-and-sync action.
- Duplicate/retried RPC operations must validate the receipt and remain idempotent.
- A conflict or retryable network failure must persist across app restart and preserve the current local edit.

---

### Task 1: Implement backup import/export and migration

**Files:**
- Create: `macos/TodoListApp/Sources/TodoList/Data/BackupDocument.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Data/BackupCodec.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Features/Settings/BackupImportView.swift`
- Modify: `macos/TodoListApp/Sources/TodoList/Features/Settings/SettingsView.swift`
- Create: `macos/TodoListApp/Tests/TodoListTests/BackupCodecTests.swift`

**Interfaces:**
- `enum BackupDocument` decodes `.localV1`, `.accountV1`, and legacy `.browserV1` documents.
- `BackupCodec.decode(_ data: Data) throws -> BackupDocument` enforces 5 MiB maximum, unique item IDs, full item validation, and version checks.
- `BackupCodec.encodeLocal(items:preferences:taskOrder:reminders:) throws -> Data` emits the existing `schemaVersion: 1` JSON.
- `BackupCodec.encodeAccount(export:) throws -> Data` emits the existing `formatVersion: 1` account JSON.
- `BackupImporter.preview(_:currentUID:) -> ImportPreview` reports counts, owner, pending operations, and merge/remap action before writes.

- [ ] Implement the three format decoders and local/account encoders while preserving optional fields and linked IDs.
- [ ] Implement import preview, same-owner conflict-aware merge, and foreign/no-owner local-copy remapping.
- [ ] Implement an all-or-nothing repository restore after explicit confirmation; keep the original file untouched.
- [ ] Add `BackupCodecTests.testDecodesLocalAndAccountV1`, `testRejectsMalformedDuplicateAndOversizedBeforeWrite`, `testRemapsLinkedIDsForForeignAccountCopy`, and `testSameOwnerImportPreservesRevisionConflicts`.
- [ ] Run `swift test --package-path macos/TodoListApp`; expected: all backup compatibility and rollback tests pass.

### Task 2: Retired — native local notifications

No further implementation task. Notification authorization, settings, controls, and scheduling were removed at the user's request. `LegacyReminderCleanup` only removes pending and delivered requests previously created by this app; it never asks for permission or creates notifications. The legacy v1 JSON fields remain accepted for backup compatibility.

### Task 3: Add Supabase config and native Google OAuth

**Files:**
- Modify: `macos/TodoListApp/Package.swift`
- Modify: `macos/TodoListApp/Sources/TodoList/App/TodoListApp.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Sync/SupabaseConfiguration.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Sync/SupabaseAuthService.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Features/Settings/AccountSettingsView.swift`
- Create: `macos/TodoListApp/Tests/TodoListTests/SupabaseConfigurationTests.swift`

**Interfaces:**
- Add the official `supabase-swift` package product to the app target (the approved `[ASSUMPTION]`).
- `SupabaseConfiguration.load(bundle:environment:) throws -> SupabaseConfiguration` requires only a valid project URL and publishable key.
- `SupabaseAuthService.signInWithGoogle() async throws` presents `ASWebAuthenticationSession`; `handleCallback(_:) async throws` completes the PKCE callback.
- The resolved SDK must retain its Apple Keychain session-storage default.

- [ ] Add and resolve the official Swift SDK dependency; pin the resolved version in `Package.resolved`.
- [ ] Implement configuration validation and read public values from app bundle configuration without logging them.
- [ ] Register `todolist://auth/callback` and wire SwiftUI `.onOpenURL` to Supabase callback handling.
- [ ] Implement account sign-in/out UI and explicit missing-config/provider/redirect errors.
- [ ] Add `SupabaseConfigurationTests.testMissingConfigKeepsLocalMode`, `testRejectsNonHTTPSRemoteHostButAllowsLocalhost`, and `testRecognizesNativeCallbackURL`.
- [ ] Run `swift build --package-path macos/TodoListApp` and `swift test --package-path macos/TodoListApp`; expected: SDK resolves, compiles, and auth configuration tests pass.

### Task 4: Implement remote store, outbox, conflicts, and recovery

**Files:**
- Create: `macos/TodoListApp/Sources/TodoList/Sync/RemoteItemStore.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Sync/SyncOutbox.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Sync/SyncCoordinator.swift`
- Create: `macos/TodoListApp/Sources/TodoList/Features/Sync/ConflictResolutionView.swift`
- Modify: `macos/TodoListApp/Sources/TodoList/Data/SwiftDataItemRepository.swift`
- Create: `macos/TodoListApp/Tests/TodoListTests/SyncCoordinatorTests.swift`

**Interfaces:**
- `protocol RemoteItemStore` exposes `fetchSnapshot(uid:) async throws -> [CalendarItem]`, `commit(uid:operation:) async throws -> RemoteCommitResult`, and `updates(uid:) -> AsyncThrowingStream<Void, Error>`.
- `SyncCoordinator.flush(uid:) async` serializes outbox writes, verifies receipts, retries bounded retryable errors, and stops on conflict/auth failure.
- `ConflictResolutionView` supports keep-remote/use-local/edit/restore-as-new for a persisted conflict.

- [ ] Implement row snapshot fetch and Realtime reload using `user_id=eq.<uid>`.
- [ ] Implement operation digest, RPC payload, receipt validation, and idempotent replay against the existing RPC.
- [ ] Implement durable ordered outbox, bounded retry/backoff, relaunch recovery, network-return retry, and conflict persistence.
- [ ] Implement conflict resolution and sign-out behavior that retains local cache and stops account requests.
- [ ] Add `SyncCoordinatorTests.testAppliedAndAlreadyAppliedReceiptsAreIdempotent`, `testNewerRemoteRevisionPersistsConflict`, and `testRetryableOutboxResumesAfterRestart` using a fake remote.
- [ ] Run `swift test --package-path macos/TodoListApp`; expected: all sync state-transition tests pass.
- [ ] When project configuration is available, verify Google sign-in, same-account read/write, Realtime refresh, and offline replay without modifying SQL or clearing remote data.
- [ ] Commit the verified integration milestone as `feat: add native backup and sync`.
