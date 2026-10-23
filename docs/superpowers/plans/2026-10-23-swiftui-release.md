# TodoList SwiftUI Release and Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a launchable TodoList.app, record native QA, then remove web-only source only if every migration gate passes.

**Architecture:** One root script builds the SwiftPM executable, stages a real `.app` bundle, and launches it through Launch Services. Keep the web app and backend untouched until all product and data checks pass.

**Tech Stack:** SwiftPM, SwiftUI, XCTest, macOS Launch Services, shell, TOML.

**Spec:** `doc/superpowers/specs/2026-10-23-swiftui-macos-migration.md`

## Global Constraints

- Keep the Git recovery point `564b88b` and branch history.
- Do not remove the web application before native build, launch, data, behavior, and design checks pass.
- Keep `supabase/` schema and remote user data; do not commit environment secrets.
- Verify actual windows at 1512×982, 1280×800, and 1024×768.
- Implement before tests; no TDD.

## Review Focus

- The staged bundle must be a foreground Dock app with valid executable and bundle identifier, not a bare Swift executable.
- Run script termination must target only the TodoList process and must not touch unrelated applications or user files.
- Missing Supabase config must allow local launch and must not break first-run persistence.
- Screenshots must be from the real native app with representative data, not the HTML prototype or a SwiftUI preview.
- Web cleanup must retain schema, migration docs, data formats, brand assets in use, and the Git recovery commit.

---

### Task 1: Create the repeatable build/run action and native bundle

**Files:**
- Create: `script/build_and_run.sh`
- Create: `.codex/environments/environment.toml`
- Create: `macos/TodoListApp/Resources/Info.plist`
- Create: `macos/TodoListApp/Resources/AppIcon.icns`
- Create/modify: `macos/TodoListApp/Package.swift`
- Create: `.gitignore` entries for SwiftPM and staged app artifacts, preserving current web ignore rules.

**Interfaces:**
- `script/build_and_run.sh [run|--debug|--logs|--telemetry|--verify]` builds `macos/TodoListApp`, stages `dist/TodoList.app`, and launches the bundle with `/usr/bin/open -n`.
- `.codex/environments/environment.toml` exposes one `Run` action calling `./script/build_and_run.sh`.
- The build script reads only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the shell or `.env.local`, never sources/prints the file, and emits local-only bundle configuration when either value is absent.

- [ ] Implement safe process termination scoped to the exact `TodoList` executable.
- [ ] Implement SwiftPM build, app bundle staging, Info.plist/icon installation, and Launch Services open.
- [ ] Implement debug/log/telemetry/verify modes and verify mode's app process/bundle identity check.
- [ ] Add `script/tests/test_build_and_run.sh`; assert Info.plist has `APPL`, the staged executable is present, and the TOML Run action points to the script.
- [ ] Run `./script/build_and_run.sh --verify`; expected: `dist/TodoList.app` opens and the `TodoList` process is present.

### Task 2: Perform product, data, and visual QA

**Files:**
- Create: `docs/swiftui-design-qa.md`
- Create: `docs/swiftui-migration.md`
- Modify: `README.md`, `PRODUCT.md`, `DESIGN.md`, `AGENTS.md`
- Create: native macOS screenshots under `artifacts/swiftui-qa/` (ignored build/QA output).

**Interfaces:**
- QA report maps Today, Progress, Calendar day/week/month/year, task/period/event inspector, and Settings to 1512×982, 1280×800, and 1024×768 captures.
- Migration report records source/format compatibility, test output, Supabase external requirements, and any remaining limitation.

- [ ] Launch the real app and verify CRUD for tasks, Progress, and events; relaunch and verify persistence.
- [ ] Verify recurrence, time-zone/date boundaries, filters/sorting, linked-task status, import/export, and preferences. Confirm the retired reminder feature does not request access or schedule notifications.
- [ ] Capture required native windows and compare typography, spacing, hierarchy, and card proportions with the supplied references.
- [ ] Run `swift build --package-path macos/TodoListApp`, `swift test --package-path macos/TodoListApp`, `bash script/tests/test_build_and_run.sh`, and `./script/build_and_run.sh --verify`; record exact results.
- [ ] Verify live OAuth/sync only if project URL, publishable key, Google provider, and redirect allow-list are available; otherwise retain web source and record the blocker.
- [ ] Update SwiftUI-specific project docs with the verified app architecture and run instructions.

### Task 3: Remove legacy web code only after acceptance gates

**Files:**
- Remove after gate: `src/`, web-only files in `tests/`, `public/` assets not reused by macOS, `package.json`, `pnpm-lock.yaml`, `next.config.*`, `tsconfig.json`, `playwright*.ts`, `vitest.config.ts`, and web build configuration.
- Preserve: `supabase/`, database migration history, JSON compatibility fixtures, needed brand assets, native sources, docs, `.git`, and commit `564b88b`.

**Interfaces:**
- No JavaScript/TypeScript runtime or package manager is required to build/run TodoList.app after cleanup.
- Current user records, Supabase schema/data, auth credentials, backup files, and Git recovery history remain intact.

- [ ] Confirm every acceptance item in the design spec has recorded evidence before removing any web files.
- [ ] Remove only audited web-only files/dependencies and retain database/auth documentation needed by the native client.
- [ ] Rewrite root README/Product/Design/Agent instructions for the SwiftUI project; keep original source recoverable through Git history.
- [ ] Run `rg -n "Next.js|next build|pnpm|React|TypeScript"` on active build/docs and confirm none are required to run the native app.
- [ ] Run final `swift build`, `swift test`, and `./script/build_and_run.sh --verify`; expected: all pass after web cleanup.
- [ ] Review `git diff --check`, `git status`, and file inventory; commit the completed native migration only after all gates pass.
