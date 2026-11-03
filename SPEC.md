# HTML Presenter — v1 Spec

**Status:** Locked for v1
**Owner:** you
**Platform:** Windows 11, desktop only, Chromium/Edge ≥ 120
**Runtime:** static files, no backend, no build step

## Goal

A dead-simple, dark, read-only HTML presentation viewer. Paste or drop a
self-contained HTML deck, save it to a local library, and present it
full-screen with keyboard navigation. Per-slide scratch notes last for the
browser session only. No editing, no accounts, no hosting, no network calls.

The primary source of decks is the `frontend-slides` skill (single-file HTML,
`.slide` elements, 1920×1080 stage), but the app must handle plain HTML decks
reasonably.

## Non-goals (v1)

- Editing deck content, annotations, or saved notes
- Mobile/touch navigation (mobile is explicitly out of scope)
- PDF/PPTX/Google Slides export
- Cloud sync, accounts, sharing, hosting
- Slide thumbnails, grid overview, speaker view, auto-advance, video export
- Loading decks directly from Drive/Gist/URL (pasted HTML only)
- A browser extension

## Core user flows

1. **Add** — Library view → "Add deck" → paste HTML or drop/choose `.html` →
   title auto-filled from `<title>` (editable) → Save. The library view is a
   persistent start screen: a blank 16:9 New deck tile plus a Recent decks
   list. A file can be dropped anywhere on the library page.
2. **Present** — Click a Recent decks row (or its Open button) → full-screen-capable presentation view.
   Keyboard drives navigation. No chrome is visible except status and overlays.
3. **Note** — Press `N` during presentation → bottom notes panel for the
   current slide → type → close. Notes are keyed per slide, never saved to the
   library, and vanish when the tab closes.
4. **Manage** — Delete a deck (confirm), export the whole library to JSON,
   import a JSON backup.
5. **Escape** — `Esc` closes the notes panel first; otherwise exits
   presentation to the library (and exits fullscreen first if active).
6. **Tour** — Header "Tour" presents the built-in six-slide "About Presenter"
   deck. It is read-only, is not added to the library, and uses the same
   presentation contract and keyboard map as any other deck.

## Presentation contract

Decks are rendered inside a sandboxed iframe:

- `sandbox="allow-scripts"` only. No `allow-same-origin`, no popups, no
  downloads, no top navigation.
- Loaded from a `blob:` URL created from the stored raw HTML.
- The presenter injects `src/bridge.js` into the HTML before rendering; the
  stored copy remains bridge-free so bridge updates apply to old decks.

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
| `N` | toggle notes panel |
| `Esc` | close notes panel, else exit presentation |
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
{ type: 'presenter:note-toggle' }
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

- Inject a style hiding common edit affordances:
  `.edit-toggle, .edit-toolbar, .edit-mode, [data-edit-ui] { display: none !important; }`
- Add `body.presenter-readonly` so deck CSS can opt in.
- Swallow plain `E` and `Ctrl/Cmd+S` in the iframe.
- Inline editing inside decks is therefore unavailable; this is intended.

## Visual design (app chrome)

Dark, minimal, high contrast. Presentation area is pure black letterbox.
Chrome never overlays the deck except the status bar (bottom-left/right) and
the notes panel.

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
  size, and Open/Delete actions. Dropping a file anywhere shows a full-window
  drop overlay and opens the add sheet; it never opens the file in a browser
  tab. Adding a deck never removes the New deck tile. The topbar stays
  product-only; a footer lockup carries "an Utharam tool" and `utharam.in`.
  A Guide button in the header opens the quick guide, key reference, zoom/pan
  instructions, and an LLM prompt for generating a single-file deck. A Tour
  button opens the built-in deck. The presentation status bar includes deck-view zoom controls
  (`−`, percentage reset, `+`, 50–200%); the iframe is scaled, so app chrome
  does not scale. Hold `Ctrl`/`Cmd` and drag while zoomed to pan the deck.

## Data model

```ts
type Deck = {
  id: string;        // crypto.randomUUID()
  title: string;     // trimmed, 1..120 chars, fallback "Untitled deck"
  html: string;      // raw pasted HTML, no bridge, max 25 MiB UTF-8
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

- Key: `presenter:note:<deckId>:<slideIndex>` in `sessionStorage`.
- Value: plain text, unbounded (practical limit ~10k chars).
- Cleared when the tab closes. Never written to IndexedDB, never exported.

### Export format

```json
{
  "app": "html-presenter",
  "version": 1,
  "exportedAt": "2026-11-02T00:00:00.000Z",
  "decks": [ { "id": "...", "title": "...", "html": "...", "createdAt": 0, "updatedAt": 0 } ]
}
```

Import validates every entry; invalid entries are skipped and counted.
Filename: `html-presenter-decks-YYYY-MM-DD.json`.

## PWA

- Serve `/manifest.webmanifest` with name "Presenter", `display: standalone`,
  `start_url: "/"`, theme/background `#0b0c0e`, 192/512 icons, and a maskable
  512 icon.
- `/sw.js` precaches the app shell and the built-in tour. Navigations are
  network-first with a cached `/index.html` fallback; same-origin GET assets
  are network-first with a cache fill and cached fallback.
- The footer shows an **Install app** button when the browser fires
  `beforeinstallprompt`; it calls `prompt()` and hides after the choice.
- After the first load, the library, presenter, keyboard navigation, notes,
  and tour work offline. Deck-owned CDN fonts/images may still require a
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

## Accessibility

- All controls are real buttons/inputs with labels; full keyboard operation.
- Notes panel is a labelled `role="dialog"` with focus moved into the textarea
  and restored on close.
- Shortcuts overlay is `role="dialog"`, closes on `Esc`.
- Status updates use `aria-live="polite"` for slide number changes.

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
6. Notes are per slide, survive slide changes and a same-tab reload, never
   appear in exports, and are gone in a new tab.
7. Typing `n`, space, or arrows in the notes textarea never changes slides.
8. `E` inside a deck never enables editing; edit UI stays hidden.
9. Export → delete → import restores the library byte-for-byte.
10. `npm test` passes (unit + Playwright) on a clean checkout.
11. Presentation zoom scales the deck content (not the app chrome) from 50% to
    200%, resets to 100%, and `Ctrl`/`Cmd` + drag pans a zoomed deck.
12. The Tour button presents the built-in About Presenter deck (6 slides);
    arrow navigation keeps the app and deck counters in sync.
13. Dropping an `.html` file anywhere on the library page opens the add sheet
    with the file loaded, and never opens the file in a browser tab.
14. The manifest, 192/512/maskable icons, and service worker are present;
    after one online load the app shell opens offline.
