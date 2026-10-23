---
name: Todo
description: A Korean-first student planner combining monthly task completion with visible D-day reminders.
colors:
  primary: "#1D1D1F"
  accent: "#0066CC"
  accent-hover: "#0055AA"
  accent-soft: "color-mix(in srgb, var(--color-accent) 12%, #ffffff)"
  background: "#FFFFFF"
  surface: "#FFFFFF"
  secondary: "rgba(29, 29, 31, 0.68)"
  muted: "#6E6E73"
  border: "rgba(29, 29, 31, 0.12)"
  warning: "#8A5200"
  error: "#B3261E"
typography:
  headline:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, SF Pro Text, Apple SD Gothic Neo, Malgun Gothic, Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, SF Pro Text, Apple SD Gothic Neo, Malgun Gothic, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, SF Pro Text, Apple SD Gothic Neo, Malgun Gothic, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.25
rounded:
  control: "8px"
  card-compact: "10px"
  card: "12px"
  dialog: "14px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
---

# Design System: Todo

## Product identity

Todo combines TodoMate-style monthly task management with visible dates and remaining time for important deadlines and schedules. The home screen must keep both jobs present: record and complete daily tasks, while reminding the user what is approaching. D-day is a primary memory aid and part of the product identity.

This is a compact desktop web app used in a window, not a full-screen dashboard or marketing site. Use the available space deliberately. Mobile layout is outside the current redesign phase; shared product data and iOS access remain supported.

## Color

The interface uses a fixed Apple Blue accent, `#0066CC`, selected by the user from the supplied design reference. Use it consistently for primary actions, keyboard focus, selected dates, active navigation, and progress. Keep it limited to meaningful interactive states. Neutral text and surfaces follow the tokens above.

Category colors belong to saved task and schedule data. Preserve those colors when changing the interface accent. Keep warning, error, completion, and schedule-kind meanings distinct. Never rely on color alone: pair it with text, shape, position, or an accessible label. Check contrast for text and controls.

Apple HIG is a reference for deliberate, consistent, accessible color use; it does not prescribe `#0066CC` as one universal accent. The chosen hex comes from the user-provided design reference. This web app uses a fixed fallback accent rather than claiming native adaptive system-color behavior.

## Apple web reference, adapted for Todo

The user-provided `DESIGN-apple.md` describes Apple marketing and store pages. Treat its component recipes as observations, not binding Apple platform rules. Borrow the near-black ink, white and light-neutral surfaces, restrained blue actions, native system font stack, quiet hairlines, and flat ordinary cards. Keep Todo's compact Korean-first hierarchy and 4px spacing rhythm.

Adapt or omit recipes that assume product marketing: no full-bleed dark product tiles, black global navigation, oversized 34–56px headlines, 17px body everywhere, 80px section padding, product photography shadows, or all-pill controls. Keep important dates and names compact enough for a small app window, while raising secondary labels that carry date, schedule-kind, or calendar-legend meaning above micro-text sizes. Retain saved category and semantic status colors because they encode product data, not a competing interface brand. Use subtle overlay elevation when it helps distinguish a popover or dialog from its owner; the “no UI shadow” observation for Apple's marketing pages is not a rule against functional layers.

## Typography and density

Use the system font stack in `src/styles/tokens.css`, including the platform's native UI font and Korean fallbacks. Use weight and spacing to establish hierarchy. Keep dates, times, counts, and countdown digits tabular.

Make task titles, schedule names, dates, and remaining-time values easy to read at normal desktop-window sizes. Use 11px for secondary metadata; do not use it for essential labels, controls, or the meaning of calendar marks. Avoid large empty areas borrowed from marketing pages.

## Layout and information hierarchy

- The home keeps D-day / remaining-time reminders visible near the top.
- The home month grid supports date navigation and displays tasks only. Event/deadline/window markers do not belong here.
- The selected date puts daily tasks and their add action first. A compact event-only agenda follows the tasks. Deadline/window records stay in the D-day strip and full existing list.
- The D-day summary may prioritize a few urgent cards, but a direct path to the full existing list stays visible.
- Weekly calendar, item editor, D-day list, and settings retain their existing product roles and data semantics.
- Re-evaluate layout when it improves date scanning, task completion, or deadline recall. No old page geometry is binding.
- Fit the common home flow into a compact desktop window, including 1000×780, 900×700, and 800×600 viewports. Keep important content and controls in the scrollable workspace without clipping.

Use the 4px spacing rhythm in `src/styles/tokens.css`. Keep primary dates and titles close to their supporting information. Use whitespace to group related content, not as decoration.

## Shared components

Repeated controls should share a coherent visual language: typography, border color, radius, focus ring, disabled state, and hover behavior. Popovers, menus, and dialogs share the same surface, border, shadow, focus, and dismissal principles, while retaining sizes and layouts appropriate to their job. Avoid forcing every popup into one shape or dimension.

Ordinary cards stay flat or use a quiet border. Reserve elevation for actual overlays. The bottom navigation has no outer border, background, or shadow. The reserved bottom area and active icon highlight distinguish navigation while preserving 48px hit areas.

Use semantic buttons and inputs, visible keyboard focus, sensible tab order, and reduced-motion support. Touch-specific adaptation is deferred; desktop pointer and keyboard operation remain required. Prefer existing icon assets and clear labels over ambiguous glyphs.

### Desktop component contract (phase 2)

- Source of shared appearance: `src/styles/controls.module.css`; semantic dimensions and layers: `src/styles/tokens.css`.
- Standard actions and selectors: 32px height, 8px radius; button labels use 12px and selector values use 13px. Date/time and text-entry fields can use 36px height. Body text is 13px and meaningful metadata is 11px.
- SVG controls share `src/features/ui/Icon.tsx` (24px viewBox, inherited color, consistent stroke). Existing brand/navigation SVG assets remain.
- A home D-day card is 72px high, with title/countdown on one line, endpoint dates beneath, then a progress track. Detail cards can be taller.
- Popovers: white surface, thin border, 12px radius, shared shadow; viewport fitting with 12px inset. Portal menus explicitly override percentage minimum widths.
- Dialogs: 14px radius, shared surface/border/shadow/backdrop, 20px viewport inset; inner content scrolls while action footer remains reachable. Keep appropriate widths for each job.
- Footer: secondary action before the primary action; destructive action at the opposite edge where applicable. Focus is visible and Escape restores the trigger.
- Portal dropdowns keep Arrow/Home/End navigation and continue Tab/Shift+Tab from the logical trigger position.
- Switch geometry: 38×22px, 18px thumb. Task checkbox: 18px visible square with expanded pointer area.
- Settings content width: up to 680px; rows start at 48px and selectors at 32px. Long settings content scrolls above the reserved navigation area.

## Motion

Motion explains state changes and preserves context. Use existing motion tokens sparingly; remove nonessential transitions under `prefers-reduced-motion`. Do not add animation for decoration.

## Todo mark

Keep the original asymmetric ripple mark, compact and readable at small sizes, with a connected monoline TODO wordmark. Use monochrome at rest; reserve accent for real loading or selected/progress states. Do not copy Apple's logo or add decorative symbols. Primary implementation: `src/features/shell/TodoLogo.tsx`; monochrome app icon: `public/icons/app-icon.svg`.

## Avoid

- Marketing-page hero layouts, product photography, oversized spacing, or ornamental effects.
- Removing or merging tasks, events, deadline/window records, recurrence, checklists, completion state, category colors, or sync behavior.
- Treating a task as a timed event or making a calendar marker's color its only meaning.
- Heavy grid lines, shadows on ordinary cards, inconsistent popup controls, or tiny essential labels.

## Sources

- Product behavior and user-approved requirements: `PRODUCT.md`, `AGENTS.md`, and the redesign roadmap.
- Implementation tokens: `src/styles/tokens.css`, `src/domain/task-categories.ts`, and component styles.
- Color guidance: [Apple Human Interface Guidelines — Color](https://developer.apple.com/design/human-interface-guidelines/color).
- Accessibility contrast reference: [WCAG 2.2 contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
