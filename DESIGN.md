---
name: HTML Presenter
description: A local, read-only stage for HTML decks.
colors:
  work-light: "#e2b04a"
  cue-red: "#e5645f"
  drafting-ground: "#0b0c0e"
  frame-surface: "#14161a"
  raised-frame: "#1b1e24"
  graphite-border: "#262a31"
  chalk-text: "#f2f3f5"
  pencil-muted: "#9aa1ad"
  stage-black: "#000000"
  dropzone-ground: "#0f1115"
  scrim: "rgba(4, 5, 6, 0.74)"
  overlay-35: "rgba(0, 0, 0, 0.35)"
  overlay-55: "rgba(0, 0, 0, 0.55)"
  overlay-68: "rgba(0, 0, 0, 0.68)"
  scrollbar: "#3a3f48"
  scrollbar-hover: "#4a505b"
typography:
  display:
    fontFamily: 'Bahnschrift, "Segoe UI Variable Display", "Segoe UI", sans-serif'
    fontSize: "2.35rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.035em"
  body:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: 'ui-monospace, "Cascadia Code", Consolas, monospace'
    fontSize: "0.72rem"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0.12em"
  caption:
    fontFamily: 'ui-monospace, "Cascadia Code", Consolas, monospace'
    fontSize: "0.78rem"
    fontWeight: 400
    lineHeight: 1.5
  micro:
    fontFamily: 'ui-monospace, "Cascadia Code", Consolas, monospace'
    fontSize: "0.83rem"
    fontWeight: 400
  meta:
    fontFamily: 'ui-monospace, "Cascadia Code", Consolas, monospace'
    fontSize: "0.84rem"
    fontWeight: 400
  control:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "0.85rem"
    fontWeight: 600
  sub:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "0.87rem"
    fontWeight: 400
  hint:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "0.88rem"
    fontWeight: 400
    lineHeight: 1.5
  support:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "0.9rem"
    fontWeight: 400
  lede:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "0.92rem"
    fontWeight: 400
  title-sm:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "1.15rem"
    fontWeight: 600
    lineHeight: 1.28
  title:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "1.2rem"
    fontWeight: 600
    lineHeight: 1.2
  headline:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "1.6rem"
    fontWeight: 600
    lineHeight: 1.2
  notes:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  hand:
    fontFamily: '"Segoe Print", "Ink Free", "Bradley Hand", cursive'
    fontSize: "2.35rem"
    fontWeight: 600
    lineHeight: 1.28
    letterSpacing: "0.005em"
rounded:
  xs: "2px"
  note: "3px"
  sm: "4px"
  md: "6px"
  scroll: "8px"
  lg: "10px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "22px"
  xl: "28px"
  xxl: "52px"
components:
  button-primary:
    backgroundColor: "rgba(226, 176, 74, 0.07)"
    textColor: "{colors.work-light}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "rgba(226, 176, 74, 0.13)"
    textColor: "{colors.work-light}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  button-default:
    backgroundColor: "transparent"
    textColor: "{colors.chalk-text}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  button-default-hover:
    backgroundColor: "rgba(242, 243, 245, 0.045)"
    textColor: "{colors.chalk-text}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  deck-frame:
    backgroundColor: "{colors.frame-surface}"
    textColor: "{colors.chalk-text}"
    rounded: "{rounded.lg}"
    padding: "18px 18px 48px"
  input:
    backgroundColor: "{colors.drafting-ground}"
    textColor: "{colors.chalk-text}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
---

# Design System: HTML Presenter

## Overview

**Creative North Star: "The Rehearsal Storyboard"**

The app is a charcoal drafting table in a dark rehearsal room. Decks are storyboard frames pinned to the wall, numbered in the margin and held by tape; the only warm light is a single gold work lamp. The interface is deliberately closer to a director's cue sheet than to a dashboard: precise linework, honest materials, and handwritten marginalia only where a person would actually write a note.

The system serves an Operate surface, so familiarity and keyboard speed outrank expression. The front page is a calm, professional launcher: a blank 16:9 New deck tile and a Recent decks list. The storyboard world lives in the deck thumbnails, frame numbers, taped dialogs, the Rehearse console, and the built-in tour. The presentation stage itself is pure black and carries no decoration beyond the counter, the progress rule, and the split console.

**Key Characteristics:**
- Charcoal ground with a faint 32px drafting grid and a restrained gold pool of light.
- A blank 16:9 New deck tile and a scannable Recent decks list; frames, ticks, and tape belong to the thumbnails and dialogs, not the launcher.
- Gold is a work light, not a brand wash: primary action, focus, progress, and frame numbers.
- Handwriting is marginalia only; controls, labels, and data use system UI or mono.
- Flat at rest; soft depth appears only for hover, dialogs, notes, and toasts.

## Colors

A near-black drafting palette with one warm work light and one cue red for destructive intent.

### Primary
- **Work-Light Gold** (#e2b04a): The Add deck action, focus rings, caret, progress fill, frame numbers, and active notes cues. It behaves like a single lamp, not a decorative accent.

### Neutral
- **Drafting Ground** (#0b0c0e): Page and stage ground. The presentation stage is the same value but without the grid.
- **Frame Surface** (#14161a): Deck frames, dialogs, and the shortcuts sheet.
- **Raised Frame** (#1b1e24): Notes card and toast surfaces that sit above the stage.
- **Graphite Border** (#262a31): Frame outlines, input borders, and rules.
- **Chalk Text** (#f2f3f5): Titles, body copy, and control labels.
- **Pencil Muted** (#9aa1ad): Metadata, supporting copy, and quiet controls.
- **Cue Red** (#e5645f): Delete hover and destructive intent only.
- **Stage Black** (#000000): The presentation viewport and iframe letterbox. It is intentionally darker than the library ground.
- **Dropzone Ground** (#0f1115): The inset drop target inside the add sheet.
- **Scrim** (rgba(4, 5, 6, 0.74)): Dialog backdrop, with no blur.
- **Overlay Blacks** (35%, 55%, 68%): Status chips, counters, and contrast scrims over the black stage.
- **Scrollbar Graphite** (#3a3f48, hover #4a505b): Browser scrollbar thumb, themed from the palette rather than left as a browser default.

### Named Rules
**The One Work-Light Rule.** Gold is used on the primary action, focus, progress, frame numbers, and active notes cues. It never fills large surfaces or decorates inactive states; its rarity is what makes it read as light.

**The No Warm Paper Rule.** The ground is charcoal, never cream. Tape and handwriting may suggest paper, but the surface stays dark so the app and the deck never compete.

## Typography

**Display Font:** Bahnschrift (with Segoe UI Variable Display, Segoe UI)
**Body Font:** system-ui (with Segoe UI)
**Label/Mono Font:** Cascadia Code / Consolas
**Marginalia Font:** Segoe Print / Ink Free

**Character:** A technical title-block display over a quiet UI sans, with mono reserved for measurements and a local handwriting face for annotations. The pairing feels drafted, not decorative.

### Hierarchy
- **Display** (600, 2.35rem, 1): The wordmark only, set in a condensed technical face with a registration cross. The same size in the hand face appears in the built-in tour.
- **Headline** (600, 1.6rem, 1.2): Dialog titles.
- **Title** (600, 1.2rem, 1.2): Short section headings.
- **Title Small** (600, 1.15rem, 1.28): Deck titles on frames.
- **Body** (400, 1rem, 1.55): The default reading size.
- **Lede** (400, 0.92rem): The wordmark's supporting line.
- **Support** (400, 0.9rem): Dropzone titles and key descriptions.
- **Hint** (400, 0.88rem, 1.5): Empty-state hints and secondary prose.
- **Sub** (400, 0.87rem): Sheet subtitles.
- **Control** (600, 0.85rem): Button labels and file-pick links.
- **Meta** (400, 0.84rem, mono): Toast copy.
- **Micro** (400, 0.83rem, mono): Quiet form copy.
- **Caption** (400, 0.78rem, mono): Deck textarea code.
- **Label** (500, 0.72rem, 0.12em, uppercase, mono): Frame numbers, metadata, field labels, counters, and keycaps.
- **Notes** (400, 15px, 1.6): The notes textarea, aligned to its 24px ruled baseline.

### Named Rules
**The Handwriting-Is-Marginalia Rule.** The hand face appears only in the built-in tour, the notes hint, and similar annotations. It never sets a control, a label, a number, or a heading that must be scanned quickly.

**The Mono-Is-Measurement Rule.** Mono is for frame numbers, dates, byte sizes, slide counters, keycaps, and field labels. It is not a costume for general body copy.

## Layout

The shell is a top bar over a library rail. The bar uses a `1fr auto` composition: wordmark and supporting line on the left; Add deck, Import, Export, Tour, Prompt, and Guide on the right. The library is a two-column start screen: a New deck tile and a scannable Recent decks list, with Present, mode caret, Notes, and Delete on each row.

The topbar is product-only: wordmark, tagline, and the Add/Import/Export/Tour/Prompt/Guide actions. The maker lives in a footer below the start screen: a small crosshair, "an Utharam tool," a quiet `utharam.in` link, and an Install app button that appears when the browser reports installability. The start screen is a two-column grid: a 460px New deck tile on the left and a Recent decks list on the right. The tile is a blank 16:9 stage preview with a plus, the words "New deck," a paste/drop subtitle, and a Create a deck action. The recent list is a set of scannable rows, each with a 16:9 thumbnail, mono frame number, title, date/size, and Present, mode caret, Notes, and Delete actions. Adding a deck never removes the New deck tile. The presentation mode dialog is a 700px taped sheet with three mode rows and a display-status line. Presenting opens either the deck alone, a split Rehearse stage with the deck left and presenter console right, or the deck plus a separate speaker window. The add sheet is a centered 720px dialog; the guide and shortcut sheets use the same taped language. Presentation is a full-viewport black stage. Present without notes and speaker view keep the deck full-stage; Rehearse splits the stage into a left deck and a right presenter console, with the status bar at the bottom of the deck pane. Below 760px the start columns stack and thumbnail frame labels are hidden.

At 760px and below the top bar stacks, the empty sheet becomes one column, and frames remain full-width. The product is desktop-first; the narrow layout exists to avoid horizontal overflow, not as a mobile product.

## Elevation & Depth

The system is flat at rest. Frames use a 1px border, a dashed inner guide, and a subtle top-light gradient; no shadow is needed to establish hierarchy. Depth appears only as a response to state: a soft lift on frame hover, a deep soft shadow under dialogs, and a small lift on toasts.

### Shadow Vocabulary
- **Frame hover** (`0 18px 42px rgba(0, 0, 0, 0.38)`): The only shadow on a library frame, paired with a 3px lift.
- **Dialog / notes** (`0 34px 90px rgba(0, 0, 0, 0.62)` and `0 28px 74px rgba(0, 0, 0, 0.68)`): Overlays that must separate from the black stage.
- **Toast** (`0 16px 40px rgba(0, 0, 0, 0.42)`): A quiet lift above the library.

### Named Rules
**The Soft-Depth Rule.** Shadows are soft, offset, and state-driven. Hard offset block shadows and zero-offset colored halos do not belong to this world.

## Shapes

Frames use a 10px radius; controls use 4–6px; the Rehearse console is a flush right-hand panel with a 1px left border. Borders are 1px. Recurring geometry: four L-shaped corner ticks, a dashed inner guide inset 6px, a strip of tape at the top edge of dialogs, a 2px gold inset focus edge on the scratch field, and a 2px progress rule with a gold fill.

The form language is drafted rather than rounded-soft: rectangles with visible corners, registration marks, and ruled lines. There are no nested cards; a frame contains content, not another frame.

## Components

### Buttons
- **Shape:** 4px radius, 1px border, 34px minimum height, 8px 14px padding.
- **Primary:** Transparent ground, Work-Light Gold text, gold-tinted border and 7% gold fill. Used for Add deck, Add a deck, and Save deck.
- **Hover / Focus:** Primary fill rises to 13% gold; focus is a 2px gold outline with 2px offset.
- **Secondary / Quiet:** Transparent ground with a Graphite Border; hover raises a 4.5% chalk wash. Quiet controls in the presentation bar drop the border and use mono text at 55% chalk.

### New Deck Tile
- **Shape:** 10px radius, 1px Graphite Border, Frame Surface ground.
- **Preview:** A 16:9 blank stage inside an 18px inset, with a dashed inner guide, a centered gold plus in a 62px circle, and a mono `16:9 · HTML` label.
- **Copy:** 1.2rem "New deck," a muted paste/drop line, and a gold "Create a deck" action. The whole tile is a button.
- **Hover / Focus:** Border warms to gold, the tile lifts 1px, and the plus circle takes a 10% gold fill.

### Recent Deck Row
- **Shape:** A full-width row with an 8px radius, transparent by default, 1px Graphite Border on hover.
- **Thumbnail:** 92px 16:9 frame (64px on mobile) with a dashed inner guide, a gold play triangle, and a mono frame number (hidden below 760px).
- **Copy:** A 1rem title on one line with ellipsis, plus mono date and byte size.
- **Actions:** A quiet outlined **Open** button and a quiet **Delete** action; the whole row is clickable, while Delete stops propagation.
- **Empty:** A compact dashed panel with "No decks yet." and a paste/drop hint.

### Drop Overlay
- **Style:** A full-window 2px dashed gold frame over a 78% black scrim, with a centered Frame Surface card, a gold plus, "Drop to add a deck," and a one-line release instruction.
- **Behavior:** Appears on any file drag over the library, never over a presentation or open dialog. Dropping an `.html` file loads it into the add sheet; `.json` imports a backup; no drop ever navigates the browser.

### Inputs / Fields
- **Style:** Drafting Ground fill, 1px Graphite Border, 6px radius, 10px 12px padding. The deck textarea is ruled with a 24px baseline and uses mono.
- **Focus:** Gold border and the global 2px gold outline.
- **Error:** Cue Red text in the inline form error; the field remains visible and editable.

### Dialogs
- **Style:** Frame Surface sheet, 10px radius, 30px padding, taped top corners, deep soft shadow, and a 74% black backdrop with no blur.
- **Behavior:** Native `<dialog>`; the add sheet resets on open and focuses the deck textarea; the shortcuts sheet is a mono key/action table.
- **Focus:** The dialog container itself suppresses the global outline; its controls keep the gold ring.

### Guide Dialog
- **Style:** A taped 800px sheet with a five-step list on the left, each step marked by a gold outlined circle, and a key reference on the right behind a 1px dashed rule.
- **Behavior:** Opens from the header Guide button; includes navigation, notes, shortcuts, zoom, `Ctrl`/`Cmd` + drag panning, the canonical hidden speaker-notes contract, and a **Build an AI prompt** button. The in-presentation `?` button still opens the compact shortcut overlay.

### Zoom Controls
- **Style:** A quiet mono group in the presentation status bar: `−`, a `100%` reset button, and `+`.
- **Behavior:** Scales the rendered deck view from 50% to 200%; the app chrome never scales with it. Holding `H` and using the arrow keys pans the zoomed deck by 64px per press; holding `Ctrl`/`Cmd` reveals a hand surface for dragging. Clicking the percentage resets zoom and pan.

### App Footer
- **Style:** A 1px top rule, 48px above, with a small gold crosshair and "an Utharam tool" on the left. The right side carries a quiet dotted `utharam.in` link and an optional **Install app** button.
- **Behavior:** The Install button is hidden until `beforeinstallprompt` fires; it calls `prompt()` and hides after the choice. The link opens `https://utharam.in` in a new tab with `noopener noreferrer`.

### Presentation Mode Dialog
- **Style:** A taped 700px sheet with a display-status strip and three full-width mode rows. Each row has a drawn monitor/notes icon, a title, a one-line explanation, and a right-aligned status tag.
- **Behavior:** One display recommends **Present without notes** and disables **Present with speaker view** with "Needs second display." Rehearse is always available and marked Practice. Clicking a row starts that mode.

### Speaker Window
- **Style:** A compact dark control surface: deck title, slide counter, elapsed timer, current speaker notes, editable scratch notes, next-slide speaker notes, and First/Prev/Next/Last controls. No visual slide thumbnails.
- **Behavior:** Opens on an extended display, including from `S` while focus is inside the deck. Syncs through BroadcastChannel; no backend. The deck window keeps its Rehearse console hidden. A hint tells the presenter to keep the speaker window on the laptop and move the deck to the projector. A blocked popup leaves the deck without notes.

### Rehearse Console
- **Style:** A full-height right-hand console with a Graphite Border on its left, current speaker notes, a quieter next-slide block, a mono elapsed timer with pause/reset, a ruled scratch textarea with a 2px gold inset focus edge, and a bottom row of First/Prev/Next/Last controls with Next in Work-Light Gold.
- **Label:** Mono gold `Slide 1`, a mono timer, and a quiet mono `REHEARSAL` status with a gold dot. The scratch section has a muted label and `Session only` meta.
- **Behavior:** Only available in Rehearse or the one-display `S` split. The console occupies the right pane, opens automatically with the deck without stealing keyboard focus; `N` or a click focuses the scratch textarea, and closing restores focus to the deck. An empty slide says “No speaker notes for this slide.” Speaker notes are text; never HTML. Library notes override embedded notes. `N` collapses the console back to the full deck.

### AI Prompt Builder
- **Style:** A taped 780px sheet. A deck brief, a slide count and density row, speaker-note guidance, a scrollable stack of per-slide outline rows, and a read-only mono prompt output with a gold Copy action.
- **Behavior:** Opens from the header **Prompt** button or Guide. Rows follow the slide count and preserve entered outlines. The prompt combines the chosen density with fixed-stage, max-2-box, type-scale, motion, style-innovation, and self-check rules, and asks for the canonical hidden speaker-notes block in every slide. Presenter never calls an LLM; the user copies the prompt out.

### Speaker Notes Editor
- **Style:** A taped 760px sheet with a scrollable list of slide rows: a mono gold `Slide N` label and a ruled textarea. A quiet status line, **Use deck notes**, and a primary **Done** action.
- **Behavior:** Opens from the **Notes** action on a library row. One field per static slide, pre-filled from embedded notes or existing library overrides. Autosaves into the deck record; library notes override embedded notes. Empty is a valid note. Included in export/import.

### Presentation Status
- **Style:** A bottom bar over pure black: mono counter at the left, a taped NOTE badge when a note exists, and quiet `?` and Exit controls at the right. A 2px progress rule with a gold fill runs along the bottom edge.
- **Behavior:** Hidden counter, progress, and badge for single-strategy decks; notes and shortcuts remain available.

### Toasts
- **Style:** Raised Frame surface, 1px Graphite Border, 6px radius, 16px 18px padding, soft shadow, and a small gold dot. Auto-dismiss after 4s; identical messages replace rather than stack.

## Do's and Don'ts

### Do:
- **Do** keep the New deck tile and Recent decks list as the first view; adding a deck never removes the tile.
- **Do** accept a file drop anywhere on the library page and show the drop overlay.
- **Do** keep the presentation stage pure black; Rehearse splits the deck and console instead of overlaying the slide.
- **Do** use the 2px gold focus ring on every real control, with 2px offset.
- **Do** keep the topbar product-only and the Utharam credit in the footer lockup.
- **Do** default one display to Present without notes; offer speaker view only on an extended display.
- **Do** make Rehearse a left-deck/right-console split with current/next notes, timer, scratch, and controls; never show notes in Present without notes.
- **Do** keep the AI prompt builder and notes editor plain, taped, and consistent with the add sheet; they are authoring tools, not a slide editor.
- **Do** treat `S` as speaker view: speaker window on an extended display, split Rehearse view on one display.
- **Do** keep the hand face for marginalia and the mono face for measurements.
- **Do** use soft, offset shadows only for state and overlays.
- **Do** preserve the recent-row anatomy: frame number, 16:9 thumbnail, title, mono metadata, Present, mode caret, Notes, and Delete.
- **Do** give every overlay a native dialog or labelled dialog role and restore focus on close.

### Don't:
- **Don't** put a kicker or eyebrow above a heading.
- **Don't** use gradient text, glass/blur decoration, colored side stripes, or hard offset shadows.
- **Don't** use emoji or Unicode glyphs as icons; draw inline SVG.
- **Don't** nest a card inside a card or turn the library into an icon + heading + text feature grid.
- **Don't** use the hand face for controls, data, or body copy.
- **Don't** let gold fill large surfaces or decorate inactive states.

