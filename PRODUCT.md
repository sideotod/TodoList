# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Korean university and graduate students who coordinate classes, research, applications, academic deadlines, and everyday tasks across desktop macOS and iOS devices.

## Product Purpose

Todo combines a calendar with personal task and D-day planning. It helps students see what is happening on a date, what needs daily action, and how much time remains before an important schedule or deadline. Cross-device access between desktop and iOS is a core use case.

## Positioning

Todo presents timed calendar events and date-bound periods as progress cards and sortable D-day items, while keeping daily to-do lists focused on tasks. A new schedule belongs to the calendar and D-day views; it is not a daily task.

## Operating Context

Users plan by month and week, review a selected day's tasks, and track upcoming or completed academic periods and events. The product is Korean-first. The desktop and iOS experiences share schedules.

## Capabilities and Constraints

- Create and edit daily tasks, timed calendar events, and period records with optional checklists.
- The home monthly grid shows task activity only. View schedules in the weekly calendar, home progress cards, D-day sorting, and the compact event-only agenda below daily tasks.
- Events appear in progress cards and D-day sorting, not in the daily task list.
- Keep existing period records available when simplifying new-item creation flows.
- Calendar settings include week start, time display, and time zone. The interface uses one fixed Apple Blue accent; task category colors remain independently selectable.
- Use existing item persistence and synchronization flows; do not introduce a separate event storage path.

## Brand Commitments

- Keep the product name Todo.
- Use a restrained Apple-inspired system font stack, neutral surfaces, and one fixed interface accent: Apple Blue `#0066CC`.
- Keep category colors attached to their task and schedule data; changing the interface accent must not recolor saved categories.
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
