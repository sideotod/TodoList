# Todo brand direction and visual system

## Product and audience

Todo is a Korean-first personal calendar and task manager for university and graduate students. The core user manages coursework, research, recurring classes, deadlines, applications, and daily tasks across desktop macOS and iOS.

The brand should feel calm, dependable, exact about time, and approachable for student life. The main calendar layout, primary functions, and task/schedule distinction remain intact; visual polish should improve clarity and consistency.

## Directions considered

### A. Timeline — selected

| Role | Selected value |
|---|---|
| Primary | `#000000` |
| Secondary | `rgba(0, 0, 0, 0.68)` |
| Accent | `#0B756B` (default), `#8A5200` (amber), or `#456B54` (sage) |
| Background | `#FFFFFF` |
| Surface | `#FFFFFF` |
| Text | `#000000` |

- Typography: existing Korean sans-serif stack with tabular figures for calendar dates, times, and counts. No new font dependency.
- Components: white cards and controls, black text and subtle black-opacity borders, small accent tints for selection, a refined popover dropdown, and Figma SVG icons.
- Mark direction: compact filled geometric forms and purposeful negative space. Keep it black and white; omit thin timeline strokes, dots, and a colored tile. The final mark is awaiting user selection from the four shown candidates.
- Rationale: the white/black foundation keeps dense schedules legible, while adjustable accents support a restrained brand identity and small category/status markers distinguish schedules without recoloring the interface.

### B. Focus — alternate

Use a darker blue-gray with amber to emphasize deadlines and focus intervals. This is warm and purposeful, but it moves the product toward a timer identity and makes amber feel warning-like when repeated.

### C. Campus field notes — alternate

Use paper-like surfaces and plant greens to evoke study notes and research. This feels familiar to students but softens the precision of a calendar grid and introduces tinted surfaces the user rejected.

## Implemented palette rules

- White pages and surfaces; black primary text and structural emphasis.
- Accent selection is available in Settings: `청록`, `앰버`, and `세이지`. Teal is the default.
- Keep accent color to primary actions, focus, current/selected dates, active navigation, and progress emphasis. No colored page background.
- Small calendar category colors use teal, amber, blue, violet, coral, and sage. Progress phases use distinct before-start, start-soon, active, end-soon, and ended states. Pair color with labels or shape.
- Retain the existing design tokens, spacing rhythm, font stack, and radius roles. Do not change major page layout or the core UX flow.

## User-approved visual constraints

- White background and black text are the default; accent color is limited to small emphasis.
- Available accent combinations: teal `#0B756B`, amber `#8A5200`, sage `#456B54`.
- Logo should be a simple geometric shape rather than thin lines and dots. No final candidate has been selected, so leave the production logo unchanged until the user chooses.
- All icon controls use supplied Figma SVG assets where available.
- Settings dropdowns use a consistent white popover. Event time fields expand down within the editor; the D-day dialog slides horizontally as its completed-items pane opens and closes.

## Reference basis

- The shape vocabulary was informed by browsing the [Logosystems symbol gallery](https://logosystems.app/ko/logos/symbol). The shipped logo must be original and must not copy a gallery symbol.
- Palette harmony was considered with [Atmos](https://atmos.style/) and [Adobe Color](https://color.adobe.com/create/color-accessibility); small text contrast is checked against [WCAG 2.2 contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- Exact implementation values are recorded in `brand/DESIGN.md` and `src/styles/tokens.css`.
