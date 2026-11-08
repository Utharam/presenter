# HTML Presenter — v1 Spec

**Status:** Locked for v1
**Owner:** you
**Platform:** Windows 11, desktop only, Chromium/Edge ≥ 120
**Runtime:** static files, no backend, no build step

## Goal

A dead-simple, dark HTML presentation viewer. Paste or drop a self-contained
HTML deck, save it to a local library, and present it full-screen with keyboard
navigation. Speaker notes can be authored with a copyable AI prompt, embedded
in the deck, or edited per slide in the library. Per-slide scratch notes last
for the browser session only. No slide editor, no accounts, no hosting, no
network calls from the app.

The primary source of decks is the `frontend-slides` skill (single-file HTML,
`.slide` elements, 1920×1080 stage), but the app must handle plain HTML decks
reasonably.

## Non-goals (v1)

- Editing slide content, annotations, thumbnails, or speaker-note formatting
  beyond plain text
- Mobile/touch navigation (mobile is explicitly out of scope)
- PDF/PPTX/Google Slides export
- Cloud sync, accounts, sharing, hosting
- Slide thumbnails, grid overview, auto-advance, video export
- A second-device notes server, LAN sync, or cloud sync
- Loading decks directly from Drive/Gist/URL (pasted HTML only)
- A browser extension

## Core user flows

1. **Add** — Library view → "Add deck" → paste HTML or drop/choose `.html` →
   title auto-filled from `<title>` (editable) → Save. The library view is a
   persistent start screen: a blank 16:9 New deck tile plus a Recent decks
   list. A file can be dropped anywhere on the library page.
2. **Prompt** — Header **Prompt** (or Guide → Build an AI prompt) opens the AI
   prompt builder. Set a slide count and density, optionally add a deck brief
   and per-slide content/note outlines, then copy the generated prompt. The prompt asks for slides and hidden speaker notes together using the
   canonical contract, plus fixed-stage and readability rules.
3. **Present** — Click a Recent decks row (or its Present button) → presentation
   view in the default mode. One display → **Present without notes**. Extended
   display → **Present with speaker view**. The caret beside Present opens the
   mode dialog: speaker view, without notes, or Rehearse. Keyboard drives
   navigation. No chrome is visible except status and overlays.
4. **Note** — Edit per-slide speaker notes from **Notes** on a library row. In
   **Rehearse**, the deck and presenter console split left/right; `N` collapses
   or restores the console. It shows current notes, next-slide notes, a timer,
   scratch, and slide controls. `S` opens speaker view on an extended display or
   this split Rehearse view on one display. In **Present without notes**,
   notes are ignored. Library speaker notes persist with the deck; scratch notes
   are session-only.
5. **Manage** — Delete a deck (confirm), export the whole library (including
   speaker notes) to JSON, import a JSON backup.
6. **Escape** — `Esc` closes the Rehearse console first; otherwise exits
   presentation to the library (and exits fullscreen first if active).
7. **Tour** — Header "Tour" presents the built-in seven-slide "About Presenter"
   deck. It is read-only, is not added to the library, and uses the same
   presentation contract and keyboard map as any other deck.

## Presentation contract

Decks are rendered inside a sandboxed iframe:

- `sandbox="allow-scripts"` only. No `allow-same-origin`, no popups, no
  downloads, no top navigation.
- Loaded from a `blob:` URL created from the stored raw HTML.
- The presenter injects `src/bridge.js` into the HTML before rendering; the
  stored copy remains bridge-free so bridge updates apply to old decks.

### Speaker view

- Offered only when `window.screen.isExtended` is true. Mirrored and
  single-screen setups deliberately run **Present without notes**.
- The main window keeps the deck. A separate `speaker.html` window opens on
  the current display and syncs over `BroadcastChannel`; there is no backend.
- The speaker window shows the deck title, `n / total`, elapsed timer, current
  and next speaker notes, editable scratch notes, and prev/next controls. It
  does not render visual slide thumbnails.
- The main window hides its notes panel in speaker mode. `N` focuses or reopens
  the speaker window; a visible **Speaker** button does the same. `S` opens the
  speaker window; on one display it opens the split Rehearse view instead of
  failing.
- If the popup is blocked or `BroadcastChannel` is unavailable, stay in
  **Present without notes** and show a notice; notes are never exposed on the
  projected screen.
- **Speaker notes convention:** the canonical marker is a hidden
  `<aside class="speaker-notes" data-speaker-notes hidden>` element inside each
  slide. The bridge also accepts `aside.notes`, `.notes`, `.slide-notes`, or
  `[data-notes]`. It sends plain text to the parent; the app renders it as text,
  never HTML. Library notes override embedded notes for that slide index,
  including an explicit empty string. Canonical notes are hidden defensively by
  the injected bridge style.

### Presentation modes

- **Rehearse** — a split one-screen rehearsal: deck on the left, presenter
  console on the right. Notes are visible by design. Opens automatically; `N`
  collapses the console. The console shows current and next speaker notes,
  elapsed time with pause/reset, scratch, and slide controls, and says when a
  slide has no note.
- **Present with speaker view** — requires an extended display; deck on the
  projector, speaker window on the laptop.
- **Present without notes** — full-screen deck only; notes disabled. This is
  the default on one display, mirrored, or single-screen setups.
- `S` switches to speaker view from any active mode on an extended display; on
  one display it switches to the split Rehearse view. A blocked popup keeps the
  projected deck note-free.

### Slide discovery (bridge), in order

1. `window.presentation.showSlide(index)` is a function → strategy `api`.
2. `.slide` elements, count > 1 → strategy `slides` (toggle `active` +
   `visible`).
3. `section` elements, count > 1 → strategy `sections` (same toggling).
4. Otherwise → strategy `single`: render as-is, hide counter/progress,
   navigation keys pass through to the page (scrolling still works).

Bridge maintains the authoritative slide index and posts state to the parent.
Only one side handles a key event: key presses with focus inside the iframe
are handled by the bridge; key presses with focus in the parent are handled by
the app. The bridge uses a capture-phase listener plus
`stopImmediatePropagation()` so a deck's own keyboard handler cannot
double-advance.

### Keyboard map (identical in parent and bridge)

| Key | Action |
| --- | --- |
| `ArrowRight`, `ArrowDown`, `PageDown`, `Space` | next slide |
| `ArrowLeft`, `ArrowUp`, `PageUp` | previous slide |
| `Home` | first slide |
| `End` | last slide |
| `F` | toggle fullscreen |
| `N` | Rehearse: collapse/restore the split console. Speaker view: focus/reopen speaker window. Without notes: warn and stay off. |
| `S` | Speaker view on an extended display; split Rehearse view on one display |
| `H` + arrows | pan a zoomed deck |
| `Esc` | close the Rehearse console, else exit presentation |
| `?` (Shift+/) | toggle shortcuts overlay |

Keys are ignored when the event target is an `input`, `textarea`, or
`[contenteditable]` (so typing notes never navigates). In `single` strategy,
navigation keys are not intercepted.

### Bridge ⇄ parent protocol

Parent → iframe:

```js
{ type: 'presenter:cmd', cmd: 'next'|'prev'|'first'|'last'|'goto', index?: number }
```

Iframe → parent:

```js
{ type: 'presenter:ready', total: number, strategy: 'api'|'slides'|'sections'|'single' }
{ type: 'presenter:state', index: number, total: number }
{ type: 'presenter:notes', notes: string[] }
{ type: 'presenter:pan', dx: number, dy: number }
{ type: 'presenter:note-toggle' }
{ type: 'presenter:speaker' }
{ type: 'presenter:fullscreen' }
{ type: 'presenter:shortcuts' }
{ type: 'presenter:exit' }
{ type: 'presenter:link', href: string }
```

The parent accepts messages only when `event.source === iframe.contentWindow`
and `event.data.type` starts with `presenter:`. All anchor clicks inside the
deck are intercepted; the parent opens the href in a new browser tab with
`noopener`.

### Read-only

Best-effort, via the bridge:

- Inject a style hiding common edit affordances and speaker notes:
  `.edit-toggle, .edit-toolbar, .edit-mode, [data-edit-ui], .speaker-notes, [data-speaker-notes] { display: none !important; }`
- Add `body.presenter-readonly` so deck CSS can opt in.
- Swallow plain `E`, plain `S` (speaker view request), and `Ctrl/Cmd+S` in the
  iframe.
- Inline editing inside decks is therefore unavailable; this is intended.

## Visual design (app chrome)

Dark, minimal, high contrast. Presentation area is pure black letterbox.
Present without notes and speaker view keep a full deck; status chrome sits at
the bottom edge. Rehearse splits the stage into a left deck and a right
presenter console.

CSS tokens:

```
--bg:#0b0c0e; --surface:#14161a; --surface-2:#1b1e24;
--border:#262a31; --text:#f2f3f5; --muted:#9aa1ad;
--accent:#e2b04a; --danger:#e5645f; --radius:10px;
--font-ui: system-ui, -apple-system, "Segoe UI", sans-serif;
--font-mono: ui-monospace, "Cascadia Code", Consolas, monospace;
--dur:160ms;
```

- No external fonts or assets; app works offline.
- Respect `prefers-reduced-motion`: disable transitions.
- Cursor auto-hides after 2s of no mouse movement in presentation mode
  (`body.cursor-idle { cursor: none; }`), returns on movement.
- Focus states use a visible 2px outline in `--accent`.
- The library keeps a PowerPoint-like start screen: a blank 16:9 New deck
  tile and a Recent decks list with thumbnails, frame numbers, title, date,
  size, and Present, mode caret, Notes, and Delete actions. Dropping a file anywhere shows a full-window
  drop overlay and opens the add sheet; it never opens the file in a browser
  tab. Adding a deck never removes the New deck tile. The topbar stays
  product-only; a footer lockup carries "an Utharam tool" and `utharam.in`.
  A **Prompt** button opens the AI prompt builder. A Guide button opens the
  quick guide, key reference, zoom/pan instructions, the speaker-notes
  contract, and a link into the prompt builder. A Tour button opens the built-in
  deck. The presentation status bar includes deck-view zoom controls
  (`−`, percentage reset, `+`, 50–200%); the iframe is scaled, so app chrome
  does not scale. Hold `H` and use the arrow keys, or hold `Ctrl`/`Cmd` and
  drag, to pan a zoomed deck.
- A taped presentation-mode dialog shows the detected display setup and the
  three modes. The speaker window is a compact dark console with notes, timer,
  next-slide notes, and controls.
- A taped **AI deck prompt** dialog holds the deck brief, slide count, density,
  note-guidance field, per-slide content/note outlines, and a read-only
  generated prompt with Copy. A taped **Speaker notes** dialog holds
  one autosaving field per slide and a reset to embedded deck notes.
- The Rehearse console adds next-slide notes, an elapsed timer with pause/reset,
  and slide controls.

## Data model

```ts
type Deck = {
  id: string;        // crypto.randomUUID()
  title: string;     // trimmed, 1..120 chars, fallback "Untitled deck"
  html: string;      // raw pasted HTML, no bridge, max 25 MiB UTF-8
  speakerNotes?: string[]; // per-slide library overrides; editable, exported
  createdAt: number; // Date.now()
  updatedAt: number;
};
```

Storage: IndexedDB database `html-presenter`, version 1, object store `decks`
(`keyPath: 'id'`, index `updatedAt`). Cards are listed by `updatedAt` desc.

If IndexedDB is unavailable (private mode, blocked storage), fall back to an
in-memory `Map` for the session and show a persistent amber banner:
"Storage unavailable — changes will not survive a refresh."

### Notes

The canonical deck-authored marker is
`<aside class="speaker-notes" data-speaker-notes hidden>` inside each slide.
The bridge also accepts `aside.notes`, `.notes`, `.slide-notes`, or
`[data-notes]`. It sends plain text to the parent; the app never executes note
markup and hides the canonical marker defensively.

Library speaker notes are stored as a sparse `speakerNotes` string array on the
deck record. The **Notes** editor writes all visible rows (empty strings are
valid overrides) and autosaves to IndexedDB. A library value at an index
overrides the embedded note, including an explicit empty string. The AI prompt
builder emits the canonical deck-authored contract; it never calls an LLM.

Scratch notes use `presenter:note:<deckId>:<slideIndex>` in `sessionStorage`.
They are plain text, unbounded in practice (~10k chars), cleared when the tab
closes, never written to IndexedDB, and never exported. The speaker window
sends scratch edits to the main tab, which remains authoritative.

Rehearse shows current/next speaker notes plus scratch on this screen. Present
with speaker view shows them in the speaker window. Present without notes hides
them. Export/import includes `speakerNotes`; older imports without the field
remain valid.

### Export format

```json
{
  "app": "html-presenter",
  "version": 1,
  "exportedAt": "2026-11-02T00:00:00.000Z",
  "decks": [ { "id": "...", "title": "...", "html": "...", "speakerNotes": ["", "Library note"], "createdAt": 0, "updatedAt": 0 } ]
}
```

Import validates every entry; invalid entries are skipped and counted.
Filename: `html-presenter-decks-YYYY-MM-DD.json`.

## PWA

- Serve `/manifest.webmanifest` with name "Presenter", `display: standalone`,
  `start_url: "/"`, theme/background `#0b0c0e`, 192/512 icons, and a maskable
  512 icon.
- `/sw.js` precaches the app shell, the built-in tour, the speaker window, and
  the prompt builder. Navigations are
  network-first with a cached `/index.html` fallback; same-origin GET assets
  are network-first with a cache fill and cached fallback.
- The footer shows an **Install app** button when the browser fires
  `beforeinstallprompt`; it calls `prompt()` and hides after the choice.
- After the first load, the library, presenter, prompt builder, keyboard
  navigation, notes, speaker view, and tour work offline. Deck-owned CDN fonts/images may still require a
  network.
- The service worker is skipped in automation (`navigator.webdriver`) so tests
  exercise route failures directly.

## Failure behavior

| Condition | Behavior |
| --- | --- |
| Empty/whitespace paste | Inline error "Paste HTML first"; nothing saved |
| HTML > 25 MiB | Inline error with size; nothing saved |
| No slides detected | Strategy `single`; deck visible, counter hidden, nav off |
| Bridge script fails to load | Present is disabled with "Presenter failed to load"; library still works |
| IndexedDB write fails (quota) | Toast "Could not save — storage full"; deck not added |
| Invalid JSON import | Toast with imported/skipped counts; no crash |
| Sandboxed deck tries popups/top nav/downloads | Silently blocked by the browser; presenter unaffected |
| Speaker view on one/mirrored display | Speaker option disabled in the mode dialog; default is Present without notes |
| Speaker popup blocked or BroadcastChannel unavailable | Stay in Present without notes and show a notice; never expose notes on the projected screen |
| Speaker view on one display / `S` pressed | Open the split Rehearse view instead |
| Library speaker-note save fails | Toast "Could not save notes"; deck stays usable |
| Deck-authored or library notes contain HTML | Sent and shown as plain text; markup never executes |

## Accessibility

- All controls are real buttons/inputs with labels; full keyboard operation.
- The Rehearse console is a labelled `role="dialog"` side pane with focus moved
  into the textarea and restored to the deck on close. The speaker window is a
  separate labelled window with real buttons and keyboard navigation.
- Prompt builder and Speaker notes editor are labelled dialogs with real
  buttons, labelled fields, and live save/copy status.
- Shortcuts overlay is `role="dialog"`, closes on `Esc`.
- Status updates use `aria-live="polite"` for slide number changes and the
  notes-editor autosave status.

## Acceptance criteria

1. Add a deck by paste and by file drop; it appears in the library and survives
   a reload.
2. Clicking a deck presents it in a `blob:` iframe with
   `sandbox="allow-scripts"` and no other sandbox flags.
3. Arrows/Space/PgUp/PgDn/Home/End navigate exactly one slide per press, even
   for decks with their own keyboard handler.
4. Counter shows `current / total` and progress bar matches; hidden for
   `single` strategy.
5. `F` toggles fullscreen; `Esc` closes notes first, then exits presentation.
6. Scratch notes are per slide, survive slide changes and a same-tab reload,
   never appear in exports, and are gone in a new tab. Library speaker notes
   persist with the deck and are included in exports.
7. Typing `n`, space, or arrows in the notes textarea never changes slides.
8. `E` inside a deck never enables editing; edit UI stays hidden.
9. Export → delete → import restores the library byte-for-byte.
10. `npm test` passes (unit + Playwright) on a clean checkout.
11. Presentation zoom scales the deck content (not the app chrome) from 50% to
    200%, resets to 100%, and `H` + arrows or `Ctrl`/`Cmd` + drag pans a zoomed
    deck without changing slides.
12. The Tour button presents the built-in About Presenter deck (7 slides);
    arrow navigation keeps the app and deck counters in sync.
13. Dropping an `.html` file anywhere on the library page opens the add sheet
    with the file loaded, and never opens the file in a browser tab.
14. The manifest, 192/512/maskable icons, and service worker are present;
    after one online load the app shell opens offline.
15. One display defaults to Present without notes; `N` warns and never shows
    notes. Rehearse is an explicit choice and shows a left deck / right console
    split with current/next notes, a timer, scratch, and slide controls.
16. On an extended display, Present with speaker view opens a separate speaker
    window; slide changes, speaker notes, scratch notes, and controls stay in
    sync. A blocked popup keeps the projected deck without notes.
17. The AI prompt builder generates a copyable prompt with the canonical
    slide/hidden-notes contract, every requested slide number, the entered
    outlines, and the selected density; changing the count preserves rows.
18. The library Notes editor shows one field per static slide, pre-fills
    embedded notes, autosaves edits into the deck record, and those notes
    override embedded notes in Rehearse.
19. `S` opens the speaker window on an extended display (including when focus
    is inside the deck) and the split Rehearse view with current/next notes,
    a timer, and slide controls on one display.
