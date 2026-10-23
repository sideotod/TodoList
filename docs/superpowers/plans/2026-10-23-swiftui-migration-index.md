# TodoList SwiftUI macOS Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a native macOS TodoList.app matching v4 while preserving existing records, backups, and Supabase behavior.

**Architecture:** Build a SwiftPM app in `macos/TodoListApp/` with a wire-compatible domain, SwiftData local repository, SwiftUI feature views, then add backup, native notifications, and Supabase sync. Keep all web code until the release plan's validation gate passes.

**Tech Stack:** Swift 6, SwiftUI, SwiftData, Swift Testing/XCTest, macOS 14+, official `supabase-swift` package.

**Spec:** `doc/superpowers/specs/2026-10-23-swiftui-macos-migration.md`

## Global Constraints

- Existing web code stays until the native app builds, launches, persists data, passes the feature checks, and has screenshot review.
- Use SwiftPM and macOS 14 minimum deployment target.
- Keep `event | task | deadline | window`, current Supabase table/RPC/revision behavior, and JSON formats compatible.
- Do not change or clear backend schema/data, local browser data, or auth credentials.
- Do not ship a `service_role` key or database password.
- Implement each behavior before adding its tests; do not use TDD.
- Verify 1512×982, 1280×800, and 1024×768 actual macOS windows.
- Keep the published package dependency assumption limited to the official Supabase Swift SDK.

## Plan Set and Order

Each plan produces a reviewable milestone. Complete them in order; the release plan's cleanup is conditional on every acceptance gate.

1. [Foundation and local data](2026-10-23-swiftui-foundation.md)
2. [v4 product experience](2026-10-23-swiftui-v4-experience.md)
3. [Backup, notifications, auth, and sync](2026-10-23-swiftui-integrations.md)
4. [App bundle, QA, docs, and conditional web cleanup](2026-10-23-swiftui-release.md)

## Review Focus

- Legacy date-only values and UTC instants around DST/time-zone boundaries must retain their original meaning; test spring gaps, fall repeats, and midnight date changes.
- A linked checklist task deleted or unavailable must fall back to its last saved checklist text/state and never silently drop the task; test unlink/delete behavior.
- Importing malformed, duplicate-ID, foreign-account, or oversized backups must leave the current local store unchanged; test preflight and rollback.
- Replaying the same Supabase operation must be idempotent, while a newer remote revision must surface a conflict; test receipts and outbox recovery.
- Weekly recurring timed events crossing DST or an inclusive `untilDate` must display only valid occurrences; test boundaries and multi-day events.
