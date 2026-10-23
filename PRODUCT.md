# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Korean university and graduate students who coordinate classes, research, applications, academic deadlines, and everyday tasks across desktop macOS and iOS devices.

## Product Purpose

Todo combines a calendar with personal task and D-day planning. It helps students see what is happening on a date, what needs daily action, and how much time remains before an important schedule or deadline. Cross-device access between desktop and iOS is a core use case.

## Positioning

Todo presents daily tasks beside near deadlines and starts, with a selected-day agenda and mini calendar in the same workspace. Progress cards track deadline, start, and interval records, while Calendar provides day, week, month, and year views. A timed schedule remains distinct from a daily task.

## Operating Context

Users plan by selected date, review daily tasks and events, and track upcoming or completed academic periods. The product is Korean-first and macOS desktop-first; the desktop and iOS experiences share schedules.

## Capabilities and Constraints

- Create and edit daily tasks, timed calendar events, and period records with optional checklists.
- The Today workspace keeps the nearest deadlines/starts and daily tasks in its main column, with a mini month and selected-day events in the side column.
- Events appear in Calendar, the selected-day agenda, and optionally Progress; they do not become daily tasks.
- Progress separates date countdown, meaningful interval elapsed time, and linked task completion.
- Calendar supports day, week, month, and year views with independent task, event, and period visibility.
- Keep existing period records available when simplifying new-item creation flows.
- Calendar settings include week start, time display, time zone, visible hours, and item layers. The interface uses the quiet sage palette in the v4 reference with selectable accents; task category colors remain independently selectable.
- Use existing item persistence and synchronization flows; do not introduce a separate event storage path.

## Brand Commitments

- Keep the product name Todo.
- Use the supplied v4 desktop visual language: a compact macOS title bar/sidebar, restrained system typography, light neutral surfaces, and a muted sage selected accent.
- Keep selectable interface accent colors separate from saved task and schedule category colors.
- The interface and terminology remain Korean-first.

## Evidence on Hand

- Product and platform description: `AGENTS.md`.
- Current working application and local design preview: this repository's Next.js app and `?preview=design` route.
- Do not invent testimonials, usage figures, customer names, or commercial claims.

## Product Principles

1. Keep a schedule's meaning consistent across calendar, progress-card, sorting, and task views.
2. Make dates and remaining time easy to scan.
3. Preserve existing user data when creation flows change.
4. Keep common planning actions usable across desktop and mobile.
