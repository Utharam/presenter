---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

# index.html — Library + Present surface

**Mode:** Operate. **Scope:** the whole app shell (library view, add dialog, present view, notes, shortcuts). The deck inside the iframe is never restyled.

## Direction contract

**THESIS:** A professional, PowerPoint-like launcher inside the rehearsal storyboard world: a blank 16:9 New deck tile and a scannable Recent decks list, with copy/paste and drop-anywhere as the core gesture. The launcher refuses a cluttered card wall and the old sketchy front page.

**OWN-WORLD:** Near-black drafting ground with a faint 32px blueprint grid; bone-white 1px linework; the locked gold `#e2b04a` behaves like a single work light. The start screen is clean charcoal panels and scannable rows; frames, corner ticks, tape, and handwriting live in the deck thumbnails, dialogs, Rehearse console, and built-in tour. Buttons are drawn rectangles; primary actions are gold ink on dark. No glass, no gradient text, no hard block shadows.

**STORY:** The operator opens the app to a blank 16:9 New deck tile and a Recent decks list. They can build a copyable AI prompt for slides + hidden speaker notes, paste HTML, or drop a file anywhere; then review the title, save, and present from a row. The New deck tile never disappears; the Prompt, Guide, and Tour live in the header. Presenting opens a mode dialog: one display defaults to Present without notes, an extended display recommends Present with speaker view, and Rehearse is always explicit. In speaker view the deck stays on the projector and the notes window stays on the laptop. On one display, Rehearse becomes a left-deck/right-console split; `S` opens that split or the speaker window on an extended display. Speaker notes are edited per slide from the library and hidden from the audience.

**FIRST VIEWPORT:** Wordmark "Presenter" and the tagline "Your decks, pinned and ready." at top left; the topbar stays product-only; Add deck, Import, Export, Tour, Prompt, and Guide at top right. Below, a two-column start screen: on the left, a 460px New deck tile with a blank 16:9 stage preview, a gold plus, "Paste HTML or drop an .html file," and a Create a deck action; on the right, a Recent decks panel with a count and scannable rows (16:9 thumbnail, frame number, title, date/size, Present, mode caret, Notes, Delete). A full-window dashed gold drop overlay appears during any file drag. Below the start screen, an app footer carries a small gold crosshair, "an Utharam tool," a quiet utharam.in link, and an Install app button that appears when installable. Each row carries Present, a mode caret, Notes, and Delete. When empty, the Recent panel says "No decks yet. Paste HTML or drop a file to start." The mode dialog shows the detected display setup, disables speaker view on one screen, and marks the recommended mode. The Prompt dialog is a taped sheet with a deck brief, slide count, density, per-slide content/note outlines, and a copyable prompt; the Speaker Notes dialog is a taped sheet with one autosaving field per slide. Rehearse is a split stage: deck left, presenter console right with current/next notes, timer with pause/reset, scratch, and slide controls.

**FORM:** Brief-pinned sketch-storyboard world, now expressed as a professional launcher plus storyboard thumbnails and taped dialogs; no concept roll.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
