# DESIGN.md - Todo

> Brand summary. Current product/component rules are in the root DESIGN.md.
> Last updated: 2026-10-10

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
| Primary | `--color-primary` | `#1D1D1F` | Main text and strongest emphasis; `src/styles/tokens.css`. |
| Secondary | `--color-brand-secondary` | `rgba(29, 29, 31, 0.68)` | Secondary copy and controls; `src/styles/tokens.css`. |
| Accent | `--color-accent` | `#0066CC` | Fixed Apple Blue for selected state, primary action, focus, and progress; chosen by the user and `src/styles/tokens.css`. |
| Accent hover | `--color-accent-hover` | `#0055AA` | Hover state for accent controls; `src/styles/tokens.css`. |
| Background | `--color-background` | `#FFFFFF` | Main application canvas; `src/styles/tokens.css`. |
| Surface | `--color-surface` | `#FFFFFF` | Cards, dialogs, controls, and popovers; `src/styles/tokens.css`. |
| Text | `--color-text` | `#1D1D1F` | Primary copy; `src/styles/tokens.css`. |
| Muted text | `--color-muted` | `#6E6E73` | Supporting labels; `src/styles/tokens.css`. |
| Border | `--color-border` | `rgba(29, 29, 31, 0.12)` | Quiet separators and outlines; `src/styles/tokens.css`. |

The interface accent is fixed Apple Blue; the color preference remains only as a compatibility field for existing saved preferences. Do not recolor category data when changing interface styling. Accent tints may be mixed over white for selected surfaces, hover, and focus; do not tint whole pages or large containers. The hex is the user's choice from the supplied reference, not a value prescribed by Apple HIG.

### Category and schedule-state colors

Task categories and calendar schedule markers use the palette in `src/domain/task-categories.ts`: teal `#0B756B` / `#DCEFED`, amber `#8A5200` / `#F6E9D2`, blue `#435CA8` / `#E4E9F8`, violet `#7054A6` / `#EEE8F8`, coral `#A94643` / `#F7E6E4`, and sage `#4F6F52` / `#E6EDE5`. These colors belong on small dots, category marks, and compact schedule chips, never on the page background.

Progress phases have a separate, limited status palette from `src/styles/tokens.css`: before start `#737373`; start soon `#9A6100` with `#FFF1D6`; active `var(--color-accent)`; end soon `#A33C3C` with `#FDE9E9`; ended `var(--color-border-strong)`. Pair each color with a text label, icon, or position so color is not the sole status signal. Timer urgency uses the phase color only near a start or end boundary.

## Typography

- Family: `system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Apple SD Gothic Neo', 'Malgun Gothic', Arial, sans-serif`, from `src/styles/tokens.css`; no hosted font dependency.
- Headings: 500–650 weight, compact Korean sans-serif; use existing component sizes rather than adding an isolated display face.
- Body and controls: 450–550 weight; keep labels readable at current product density.
- Numeric UI: use tabular numerals for dates, times, counts, and progress values.
- Scale source: `src/styles/tokens.css` defines 8–28px values and a 1.45 copy line-height. Use those tokens; do not introduce arbitrary type sizes.

## Spacing and layout

- Base unit: 4px.
- Spacing scale: 4 / 8 / 12 / 16 / 24px, from `src/styles/tokens.css`.
- Main frame: maximum width 1000px, from `src/features/shell/AppShell.module.css`; design for a compact desktop window rather than a full-screen dashboard.
- Reconsider page hierarchy and calendar geometry when evidence shows a scanning or completion problem. Preserve product meanings and task/event flows, not old page layout.

## Components

- Cards and controls: white surface, black text, 1px black-opacity borders. Use 8px controls, 10px compact cards, 12px popovers, and 14px dialogs from the current role tokens.
- Primary actions, focus rings, selected dates, active navigation, and progress fills use Apple Blue.
- Repeated controls share `src/styles/controls.module.css` typography, border, radius, focus, disabled, and hover rules. Popovers, menus, and dialogs share surface and behavior rules, but keep role-appropriate dimensions.
- Dropdowns: white popover, restrained neutral outline and shadow, selected accent tint, keyboard navigation, and viewport-aware above/below placement.
- Date/time popovers: anchor to their trigger, stay within the viewport, and align time selection to the center of the time input.
- Home hierarchy: task-only month grid and tasks first in the selected day; event-only secondary agenda below tasks. Deadline/window records appear in D-day. Weekly calendar preserves all schedule meanings.
- D-day cards: compact 72px home entries with title/countdown on one line; use phase colors for pre-start, imminent start, active, imminent end, and ended states.
- Iconography: prefer existing, clear icon assets or labeled controls; do not use ambiguous Unicode glyphs.

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
