# DESIGN.md - Todo

> Visual single source of truth. Read in full before rendering anything for this brand.
> Last updated: 2026-10-09

## Identity

- Name: Todo
- Positioning: A Korean-first calendar and personal planning tool for university and graduate students, across macOS and iOS.
- Audience: Students managing coursework, research, fixed weekly schedules, applications, deadlines, and daily tasks.
- Visual attitude: Quiet precision—white space and black structure, with restrained color reserved for selected states, schedule categories, and urgency.
- Main user impression: Dependable, legible, calm, and easy to scan at a glance.

## Colors

### Core palette

| Role | Token | Value | Usage and source |
|---|---|---|---|
| Primary | `--color-primary` | `#000000` | Main structural mark and strongest emphasis; `src/styles/tokens.css`. |
| Secondary | `--color-brand-secondary` | `rgba(0, 0, 0, 0.68)` | Secondary copy and controls; `src/styles/tokens.css`. |
| Accent, default | `--color-accent` | `#0B756B` | Selected item, primary action, current date, focus, and progress; user-selected default and `src/styles/tokens.css`. |
| Accent, amber | `--color-accent` | `#8A5200` | Optional user-selected theme; `src/styles/tokens.css`. |
| Accent, sage | `--color-accent` | `#456B54` | Optional user-selected theme; `src/styles/tokens.css`. |
| Background | `--color-background` | `#FFFFFF` | All main page backgrounds; user preference and `src/styles/tokens.css`. |
| Surface | `--color-surface` | `#FFFFFF` | Cards, dialogs, controls, and popovers; `src/styles/tokens.css`. |
| Text | `--color-text` | `#000000` | Primary copy; user preference and `src/styles/tokens.css`. |
| Muted text | `--color-muted` | `rgba(0, 0, 0, 0.56)` | Supporting labels; `src/styles/tokens.css`. |
| Border | `--color-border` | `rgba(0, 0, 0, 0.13)` | Quiet separators and outlines; `src/styles/tokens.css`. |

Only the active accent changes between themes. Keep page and surface backgrounds white and primary text black. Accent tints may be mixed over white for selected surfaces, hover, and focus; do not tint whole pages or large containers.

### Category and schedule-state colors

Task categories and calendar schedule markers use the palette in `src/domain/task-categories.ts`: teal `#0B756B` / `#DCEFED`, amber `#8A5200` / `#F6E9D2`, blue `#435CA8` / `#E4E9F8`, violet `#7054A6` / `#EEE8F8`, coral `#A94643` / `#F7E6E4`, and sage `#4F6F52` / `#E6EDE5`. These colors belong on small dots, category marks, and compact schedule chips, never on the page background.

Progress phases have a separate, limited status palette from `src/styles/tokens.css`: before start `#737373`; start soon `#9A6100` with `#FFF1D6`; active `var(--color-accent)`; end soon `#A33C3C` with `#FDE9E9`; ended `var(--color-border-strong)`. Pair each color with a text label, icon, or position so color is not the sole status signal. Timer urgency uses the phase color only near a start or end boundary.

## Typography

- Family: `'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', Arial, sans-serif`, from `src/styles/tokens.css`; no hosted font dependency.
- Headings: 500–650 weight, compact Korean sans-serif; use existing component sizes rather than adding an isolated display face.
- Body and controls: 450–550 weight; keep labels readable at current product density.
- Numeric UI: use tabular numerals for dates, times, counts, and progress values.
- Scale source: `src/styles/tokens.css` defines 8–28px values and a 1.45 copy line-height. Use those tokens; do not introduce arbitrary type sizes.

## Spacing and layout

- Base unit: 4px.
- Spacing scale: 4 / 8 / 12 / 16 / 24px, from `src/styles/tokens.css`.
- Main frame: maximum width 1000px, from `src/features/shell/AppShell.module.css`.
- Preserve the existing page hierarchy, calendar geometry, and task/event flows. Improve control alignment, spacing, responsive fit, and clear all-day/timed-event separation without moving major functional regions.

## Components

- Cards and controls: white surface, black text, 1px black-opacity borders. Existing radius tokens are 8, 11, 10, 12, 14, 15, and 18px; use the component role's existing token.
- Primary actions, focus rings, selected dates, active navigation, and progress fills use the active accent.
- Dropdowns: white popover, restrained black outline and shadow, Figma SVG chevron/check icons, selected accent tint, keyboard navigation, and viewport-aware above/below placement.
- Date/time popovers: anchor to their trigger, stay within the viewport, and align time selection to the center of the time input.
- Schedule hierarchy: show timed events and multi-day schedules on calendar surfaces. Show daily tasks as `오늘의 할 일 n개`, not as events. Use compact category colors to distinguish calendar entries.
- D-day cards: one entry per schedule; use phase colors for pre-start, imminent start, active, imminent end, and ended states.
- Iconography: use supplied Figma SVG assets in `public/design/`; do not replace existing Figma icons with Unicode glyphs, CSS-drawn icons, or icon-font characters.

## Logo

- Direction: the selected second concept is an asymmetric ripple: a black, compact organic ring with a clear white center. Keep its silhouette bold and recognizable at small sizes; do not add dots, clock hands, a square tile, gradients, or a second standalone symbol.
- Wordmark: draw `TODO` as one connected, rounded monoline path. The letter joins should read as intentional letterforms and share a quiet baseline.
- Color: black symbol and wordmark on white or transparent background. During real loading, allow the active accent to rise from the bottom across the mark and wordmark.
- Motion: on deliberate hover/focus interaction, move the outer and inner ring contours gently in opposite directions. Keep the mark still at rest; respect reduced-motion settings.
- Reference: use the shape economy and category grouping at [Logosystems symbol gallery](https://logosystems.app/ko/logos/symbol) as inspiration, and keep the drawn mark original.
- Primary implementation: `src/features/shell/TodoLogo.tsx`; monochrome app icon: `public/icons/app-icon.svg`.

## Motion

- Use the existing 140/180/240ms motion tokens and `cubic-bezier(.32, .72, 0, 1)` panel easing from `src/styles/tokens.css`.
- Open event-time settings beside their trigger on wider screens and below it on narrow screens. Slide the D-day dialog when its completed-schedule pane opens or closes. Use transform and opacity for panel motion and a measured spring-like response for bottom navigation.
- Preserve keyboard focus and content position during transitions. Respect `prefers-reduced-motion` by removing nonessential movement.

## Never do

- Do not add colored page backgrounds, gradients, a permanently tinted surface, or large blocks of accent color.
- Do not represent tasks as timed events or collapse event and task semantics.
- Do not use color as the only indicator for completion, urgency, category, or weekday.
- Do not recreate icons with text glyphs when a Figma SVG asset exists.
- Keep the selected ripple mark monochrome at rest; show accent only during loading or selected/progress states.

## References

- Product behavior and user preferences: `PRODUCT.md`, `AGENTS.md`, and the product review comments in this task.
- Tokens and implementation values: `src/styles/tokens.css`, `src/domain/task-categories.ts`, and the component styles named above.
- Geometric mark reference: [Logosystems symbol gallery](https://logosystems.app/ko/logos/symbol).
- Harmonious palette and contrast references consulted earlier: [Atmos](https://atmos.style/), [Adobe Color](https://color.adobe.com/create/color-accessibility), and [WCAG 2.2 contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
