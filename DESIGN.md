---
name: Todo
description: A Korean-first student planner combining monthly task completion with visible D-day reminders.
colors:
  primary: "#292E2B"
  accent: "#5B9275"
  accent-hover: "#477B61"
  accent-soft: "#E4ECE5"
  background: "#FBFCFA"
  surface: "#FFFFFF"
  secondary: "#66716A"
  muted: "#77827B"
  border: "#E6EAE5"
  warning: "#8A5200"
  error: "#B3261E"
typography:
  headline:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, SF Pro Text, Apple SD Gothic Neo, Malgun Gothic, Arial, sans-serif"
    fontSize: "32px"
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

This is a macOS-first desktop web app used in a window, not a full-screen dashboard or marketing site. Use the available space deliberately. The desktop layout follows the v4 reference; narrow PWA navigation and shared iOS data access remain supported.

## Color

The v4 reference sets a restrained sage interface over white and warm-neutral surfaces. Use sage for the default selection, focus, active navigation, and primary action. Settings may select sage, arctic, rose, or amber accents. Accent choices apply to interface controls only; saved task category colors remain unchanged. Keep warning, error, completion, and schedule-kind meanings distinct, and never rely on color alone.

## macOS desktop language

The supplied `design-reference/v4` screenshots are the visual authority for the redesigned desktop surfaces. Use a thin title bar, a quiet 216px-class sidebar, compact sections, pale surfaces, thin neutral borders, and a right-side inspector. Do not retain the older centered frame, bottom-only desktop navigation, monthly-grid-first home, or modal detail geometry where those conflict with v4. Keep the product Korean-first and sized for normal desktop windows rather than a full-screen marketing page.

## Typography and density

Use the system font stack in `src/styles/tokens.css`, including the platform's native UI font and Korean fallbacks. Use weight and spacing to establish hierarchy. Keep dates, times, counts, and countdown digits tabular.

Make task titles, schedule names, dates, and remaining-time values easy to read at normal desktop-window sizes. Use 11px for secondary metadata; do not use it for essential labels, controls, or the meaning of calendar marks. Avoid large empty areas borrowed from marketing pages.

## Layout and information hierarchy

- Today keeps the next deadlines and starts visible above the selected-day task list. The task add action sits beside its heading and expands an inline focused composer.
- Today places the mini month and selected-day event agenda in the side column. Selecting a date updates both columns.
- Progress is a dedicated landscape card gallery at wide sizes, with type filters, sorting, and an inspector path.
- Calendar supports day, week, month, and year views. Calendar item layers remain independently toggleable.
- The inspector uses a right-side panel for tasks, periods, and events.
- Preserve existing item data semantics in the editor and repository.
- Re-evaluate layout when it improves date scanning, task completion, or deadline recall. No old page geometry is binding.
- Fit the common home flow into a compact desktop window, including 1000×780, 900×700, and 800×600 viewports. Keep important content and controls in the scrollable workspace without clipping.

Use the 4px spacing rhythm in `src/styles/tokens.css`. Keep primary dates and titles close to their supporting information. Use whitespace to group related content, not as decoration.

## Shared components

Repeated controls should share a coherent visual language: typography, border color, radius, focus ring, disabled state, and hover behavior. Popovers, menus, and dialogs share the same surface, border, shadow, focus, and dismissal principles, while retaining sizes and layouts appropriate to their job. Avoid forcing every popup into one shape or dimension.

Ordinary cards stay flat or use a quiet border. Reserve elevation for the inspector and other actual overlays. Desktop navigation is a full-height sidebar below the title bar; the existing mobile bottom navigation remains visually quiet and preserves 48px hit areas.

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
