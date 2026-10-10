---
name: Todo
description: A quiet Korean-first planner for schedules, academic deadlines, and daily tasks.
colors:
  primary: "#000000"
  accent: "#2C698D"
  accent-hover: "#235677"
  accent-soft: "color-mix(in srgb, var(--color-accent) 12%, #ffffff)"
  accent-sea-glass: "#5C6B73"
  accent-sage-studio: "#52796F"
  accent-mint-condition: "#457B9D"
  accent-deep-sea: "#2C6975"
  accent-matcha: "#588157"
  accent-ink-gold: "#373F51"
  accent-nordic: "#4C566A"
  accent-rose-quartz: "#8F5A73"
  accent-terracotta-field: "#3D405B"
  arctic-item-1: "#E3F6F5"
  arctic-item-2: "#BAE8E8"
  arctic-item-3: "#2C698D"
  arctic-item-4: "#272643"
  sea-glass-item-1: "#E0FBFC"
  sea-glass-item-2: "#C2DFE3"
  sea-glass-item-3: "#9DB4C0"
  sea-glass-item-4: "#5C6B73"
  sage-studio-item-1: "#CAD2C5"
  sage-studio-item-2: "#84A98C"
  sage-studio-item-3: "#52796F"
  sage-studio-item-4: "#354F52"
  mint-condition-item-1: "#F1FAEE"
  mint-condition-item-2: "#A8DADC"
  mint-condition-item-3: "#457B9D"
  mint-condition-item-4: "#1D3557"
  deep-sea-item-1: "#06202A"
  deep-sea-item-2: "#1B3B4B"
  deep-sea-item-3: "#2C6975"
  deep-sea-item-4: "#68B2A0"
  matcha-item-1: "#DAD7CD"
  matcha-item-2: "#A3B18A"
  matcha-item-3: "#588157"
  matcha-item-4: "#3A5A40"
  ink-gold-item-1: "#1B1B1E"
  ink-gold-item-2: "#373F51"
  ink-gold-item-3: "#A9927D"
  ink-gold-item-4: "#F2D398"
  nordic-item-1: "#2E3440"
  nordic-item-2: "#4C566A"
  nordic-item-3: "#D8DEE9"
  nordic-item-4: "#ECEFF4"
  rose-quartz-item-1: "#F7EDF0"
  rose-quartz-item-2: "#E4B5C4"
  rose-quartz-item-3: "#C98CA7"
  rose-quartz-item-4: "#8F5A73"
  terracotta-field-item-1: "#E07A5F"
  terracotta-field-item-2: "#F2CC8F"
  terracotta-field-item-3: "#81B29A"
  terracotta-field-item-4: "#3D405B"
  background: "#FFFFFF"
  surface: "#FFFFFF"
  secondary: "rgba(0, 0, 0, 0.68)"
  border: "rgba(0, 0, 0, 0.13)"
  warning: "#9D6700"
  error: "#E4052C"
typography:
  headline:
    fontFamily: "Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.2
rounded:
  control: "8px"
  field: "10px"
  card-compact: "10px"
  card: "12px"
  card-large: "14px"
  dialog: "18px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card-compact}"
    padding: "8px 13px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.field}"
    padding: "8px 12px"
    height: "42px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    size: "42px"
  navigation:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "4px 14px"
    height: "56px"
  event-block:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.primary}"
    rounded: "{rounded.control}"
    padding: "8px 8px 8px 10px"
---

# Design System: Todo

## Overview

**Creative North Star: "The Research Notebook"**

Todo is a quiet Korean-first planner for university and graduate students. Its visual system supports quick scanning across academic deadlines, timed events, and daily tasks. The interface keeps a white canvas and black text, then uses the selected color theme to mark focus, progress, and schedule categories.

The layout favors compact information with clear roles: the month view supports date selection, the week view lays out seven days against a vertical time scale, and progress cards keep longer deadlines visible. The common controls stay restrained so titles, dates, and remaining time carry the emphasis.

**Key Characteristics:**
- Quiet, monochrome foundation.
- One selectable accent theme at a time.
- Compact, date-led information with clear calendar and task roles.

## Colors

Black text and white surfaces form the neutral base. The active theme supplies the interactive accent and a four-color schedule palette; the settings expose ten palettes: Arctic, Sea Glass, Sage Studio, Mint Condition, Deep Sea, Matcha, Ink & Gold, Nordic, Rose Quartz, and Terracotta Field. Their accent and schedule-item colors are listed in the frontmatter tokens by palette and swatch number.

### Primary
- **Ink:** Primary text, icons, and high-priority labels.
- **Arctic blue-teal:** The implementation's default accent for selection, focus, progress, and navigation state.

### Secondary
- **Theme accents:** The selected theme controls the interface accent and its schedule color set. Keep one theme active across a view.
- **Amber:** Countdown urgency and warning status.
- **Clear red:** Errors and holiday emphasis.

### Neutral
- **Paper white:** Page and component surfaces.
- **Soft black:** Secondary copy and metadata.
- **Fine gray:** Dividers, field borders, and progress tracks.

The runtime currently defaults to Arctic, while `PRODUCT.md` still describes a different default accent. This document records the implemented runtime palette.

**The One Accent Rule.** Keep focus, selection, progress, and active navigation tied to the selected theme. Do not mix unrelated accent palettes within one view.

## Typography

**Display Font:** Noto Sans KR (with Apple SD Gothic Neo, Malgun Gothic, and Arial fallbacks)  
**Body Font:** Noto Sans KR (same fallback stack)  
**Label/Mono Font:** The same sans-serif stack; numeric dates and times use tabular figures.

**Character:** Plain, legible Korean-first sans-serif typography keeps the interface practical. Weight and size create hierarchy; labels remain compact and secondary information uses softer contrast.

### Hierarchy
- **Headline:** Used for month and week headings and key dialog titles.
- **Body:** Used for task details, settings copy, and editable content.
- **Label:** Used for time labels, dates, helper text, and compact card metadata.
- **Numeric:** Keep dates, times, and countdown digits aligned with tabular numerals.

## Layout

The desktop workspace centers an 840px content area inside a shell capped at 1000px. Home places the month calendar beside the selected day's tasks; the week calendar preserves seven equal day columns and a dedicated time-label gutter. On narrow screens, the home workspace stacks into one column, while the week view retains its seven-day structure and tightens the time gutter.

Use the 4px-based spacing rhythm for control padding and gaps. Keep primary dates, item titles, and times close together; put secondary descriptions below or beside the relevant label. The floating bottom navigation stays centered and clear of the scrollable content.

## Elevation & Depth

The interface is flat by default. Thin borders and white surfaces distinguish cards and fields. Shallow shadows are reserved for popovers, dialogs, and the floating bottom navigation, where they separate overlays from the calendar without making ordinary cards appear raised.

### Shadow Vocabulary
- **Popover:** `0 14px 38px rgba(0, 0, 0, 0.16), 0 2px 8px rgba(0, 0, 0, 0.05)` for dropdown surfaces.
- **Dialog:** `0 20px 60px rgba(0, 0, 0, 0.2)` for modal separation.
- **Editor modal:** `0 10px 26px rgba(0, 0, 0, 0.12)` for item editing surfaces.
- **Bottom navigation:** `0 8px 28px rgba(0, 0, 0, 0.14)` for the floating control.

**The Flat Card Rule.** Keep ordinary cards defined by their border and surface. Reserve visible shadow for floating or modal layers.

## Shapes

Controls use gently rounded corners; compact cards and dialogs step up in radius with their visual importance. The bottom navigation and weekday selectors use pill or circular silhouettes. Borders are thin and neutral, with stronger contrast reserved for focus, selection, and active states.

## Components

### Buttons
- **Shape:** Restrained rounded control corners, with consistent short labels.
- **Primary:** Theme accent fill with white text; used for save and confirm actions.
- **Secondary:** White fill with a fine border and softened text; used for cancel and close actions.
- **Focus:** A clearly visible outline follows the active theme.

### Chips
- **Style:** Circular or pill-shaped choices with a neutral border.
- **State:** Selected days and options use the active theme for emphasis; unselected options remain quiet.

### Cards / Containers
- **Corner Style:** Compact progress cards use the compact card shape; dialogs use the larger dialog shape.
- **Background:** White surfaces with a thin neutral border.
- **Shadow Strategy:** Cards remain flat; use the Elevation section for floating surfaces.
- **Internal Padding:** Compact and consistent, leaving room for readable dates and progress labels.

### Inputs / Fields
- **Style:** White fill, fine neutral stroke, and rounded field corners.
- **Focus:** A visible active-theme outline.
- **Error / Disabled:** Error copy uses the error color; disabled controls use a softened neutral fill and text.

### Navigation
- **Style:** A centered floating pill with icon-first links.
- **Active:** A soft theme-colored indicator sits behind the selected destination; its icon uses the full accent.
- **Motion:** The indicator moves between destinations; honor reduced-motion preferences.

### Timed Schedule Blocks
Timed items use a soft theme-tinted fill and a narrow colored leading edge. Their title and time stay visible within the block; overlapping events use a compact summary that opens the full list.

## Do's and Don'ts

### Do:
- **Do** use the active theme consistently for focus, selection, progress, and event accents.
- **Do** preserve the seven-column calendar and make the time labels easy to scan.
- **Do** distinguish ordinary tasks, timed events, and deadline progress cards by their established layout roles.
- **Do** keep shadows shallow and limited to floating or modal surfaces.

### Don't:
- **Don't** make calendar grid lines or the outer grid border visually heavy; major hour lines should remain only slightly stronger than minor lines.
- **Don't** add decorative shadows to ordinary cards or fields.
- **Don't** mix multiple accent themes in the same view.
- **Don't** round every container into a pill; reserve circular and pill shapes for selectors and navigation.
