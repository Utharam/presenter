# Presenter

A dead-simple, dark HTML presentation viewer. Paste or drop a
self-contained HTML deck, keep it in a local library, and present it
full-screen with keyboard navigation. Speaker notes can be authored with the
AI prompt builder, embedded in the deck, or edited per slide from the library.
Scratch notes last for the browser tab only. There is no slide editor, no
account, no backend, no build step, and no network call from the app itself.

## Run

Requirements: Node 24+ and a desktop Chromium/Edge 120+.

```powershell
npm install
npm run serve
```

Open `http://127.0.0.1:4173`. To use another port:

```powershell
$env:PORT=5000; npm run serve
```

Everything is served as static files by `scripts/serve.mjs`; there is no
build step. The library lives in IndexedDB in the browser that opened the app.

## Install and offline

Presenter is a PWA. Open it in Edge or Chrome over `http://127.0.0.1:4173`
(or any secure origin) and use the **Install app** button in the footer, or
the browser's own install control. The service worker caches the app shell,
the built-in tour, the speaker window, and the prompt builder, so the library,
presenter, notes, speaker view, prompt builder, and tour keep working offline
after the first load. User decks live in IndexedDB; a deck's own CDN
assets (fonts, images) may still need a network connection.

The topbar stays product-only. Utharam is carried in the footer as
"an Utharam tool" with a quiet `utharam.in` link.

## Usage

- **Add a deck** — click the **New deck** tile or **Add deck** in the header,
  then paste the full HTML, choose an `.html` file, or drop one anywhere on the
  library page. The title is pulled from `<title>` and can be edited before
  saving. The New deck tile stays in place; saved decks appear in the Recent
  decks list. Dropping an `.html` file loads it into the add sheet and never
  opens a browser tab. Dropping a `.json` file restores a backup.
- **Prompt** — open **Prompt** in the header, or **Guide → Build an AI prompt**.
  Choose a slide count and optionally write a content outline and a speaker-note
  outline for each slide. Copy the generated prompt into your LLM; it asks for
  the slides and hidden speaker notes together. Paste the returned HTML back
  through **Add deck**.
- **Present** — click a Recent decks row or its **Present** button. On one
  screen the default is **Present without notes**; on an extended display it
  is **Present with speaker view**. The caret beside Present opens the mode
  dialog: Present with speaker view, Present without notes, or Rehearse.
  The deck opens in a sandboxed iframe with only the status bar, progress bar,
  and Rehearse console. Rehearse splits the deck on the left and the console on
  the right.
  Use the `−` / `100%` / `+` controls to zoom the deck view from 50% to 200%;
  click the percentage to reset. While zoomed, hold `H` and use the arrow keys
  to pan, or hold `Ctrl`/`Cmd` and drag.
- **Notes** — open **Notes** on a deck row to edit one field per slide, saved
  with the deck. In **Rehearse**, the deck and presenter console split
  left/right; `N` collapses or restores the console, and `S` opens the speaker
  window on an extended display or this split Rehearse view on one display. The
  console shows current and next-slide notes, an elapsed timer with pause/reset,
  scratch text, and slide controls. In **Present without notes**, notes are ignored. Scratch
  notes are stored in `sessionStorage`, per deck and slide, and never enter
  IndexedDB or an export.
- **Manage** — **Export** downloads the whole library as JSON, including
  speaker notes; **Import** restores a JSON backup. **Delete** removes a deck
  after confirmation.
- **Guide** — click **Guide** in the header for the quick guide, key reference,
  zoom/pan instructions (`H` + arrows or `Ctrl`/`Cmd` + drag while zoomed), the
  speaker-notes
  contract, and a button that opens the AI prompt builder.
- **Tour** — click **Tour** in the header to present the built-in seven-slide
  "About Presenter" deck. The tour is not added to your library.

## Speaker notes in decks

The canonical authoring form is one hidden block inside each slide:

```html
<aside class="speaker-notes" data-speaker-notes hidden>
  Open with the promise. Pause after the second frame.
</aside>
```

The bridge also accepts older `aside.notes`, `.notes`, `.slide-notes`, or
`data-notes` markers. It reads the notes as plain text and sends them to
Rehearse or the speaker window. Presenter never executes note markup and hides
the canonical block defensively.

**Three ways to create notes**

- **AI prompt builder** — **Prompt** in the header generates a copyable prompt
  with the exact slide and hidden-notes contract. The AI writes slides and notes
  together; you paste the returned HTML back.
- **Library Notes editor** — the **Notes** action on a deck row gives one field
  per slide. Edits save with the deck in IndexedDB, override embedded notes for
  that slide, and are included in Export/Import.
- **Deck HTML** — write the hidden `aside` yourself or include it in the deck
  you paste.

Notes are optional. The presentation mode decides whether they are used:
Rehearse shows the split deck + console, speaker view puts them in the laptop
window, and Present without notes ignores them. The separate scratch pad is
session-only and never enters the library or a backup.

**Speaker view requires an extended display.** If the laptop and projector are
mirrored, notes would be visible to the room; the app deliberately does not
offer speaker view in that setup. It also does not switch Windows between
Mirror and Extend. On one display, `S` opens the split Rehearse view instead.

### Keys

| Key | Action |
| --- | --- |
| `â†’`, `â†“`, `PageDown`, `Space` | Next slide |
| `â†`, `â†‘`, `PageUp` | Previous slide |
| `Home` / `End` | First / last slide |
| `F` | Toggle fullscreen |
| `N` | Rehearse: toggle the split console. Speaker view: focus/reopen the speaker window. |
| `S` | Speaker view on an extended display; split Rehearse view on one display |
| `H` + arrows | Pan while zoomed |
| `?` | Toggle the shortcuts overlay |
| `Esc` | Close notes (then shortcuts), then exit presentation and fullscreen |

Keys are ignored while focus is in an `input`, `textarea`, or
`[contenteditable]`, so typing notes never navigates. In the `single`
strategy, navigation keys are left to the page (scrolling still works).

## Backup warning

The library is local to one browser profile, not synced anywhere. Clearing
site data, using a different browser/profile, or browser storage eviction can
lose every deck and every library-edited speaker note. Export JSON regularly
and keep a copy outside the browser. Library speaker notes are included in the
export; scratch notes are intentionally disposable and are not.

## Security model

Decks are untrusted documents.

- **Sandbox:** decks render from a `blob:` URL in an iframe with exactly
  `sandbox="allow-scripts"`. There is no `allow-same-origin`, popups,
  downloads, forms, or top navigation. The deck cannot read the app's DOM,
  IndexedDB, or session notes.
- **Bridge:** `src/bridge.js` is injected into a copy of the HTML at render
  time, so the stored deck stays bridge-free and old decks pick up bridge
  updates. The parent only accepts `presenter:*` messages whose
  `event.source` is the presentation iframe.
- **Links:** anchor clicks are intercepted. The parent opens `http:`,
  `https:`, and `mailto:` links in a new tab with `noopener`; `blob:`,
  `javascript:`, `data:`, and other schemes are blocked. This matters because
  a hostile deck can both click a fragment link and forge a
  `presenter:link` message.
- **Read-only:** the bridge hides common edit affordances, adds
  `body.presenter-readonly`, and swallows plain `E`, plain `S` (speaker-view
  request), and `Ctrl/Cmd+S` inside the deck.
- **Network:** app code makes no external requests and all app assets are
  local. A deck may load its own CDN assets (for example Google Fonts); those
  are the deck's requests, not the app's. The Utharam credit link in the
  footer is the only external link in app chrome; it is opened only when the
  user clicks it.

Do not treat the sandbox as permission to present arbitrary hostile pages:
the deck still runs scripts, can consume CPU, and can make its own network
requests.

## Limitations

- Desktop Chromium/Edge only; no mobile or touch navigation.
- No slide-content editor: speaker notes are the only editable deck metadata.
  Annotations, thumbnails, auto-advance, and PDF/PPTX export are out of scope.
- Decks with no `.slide` elements and at most one `<section>` use the
  `single` strategy: the page renders as-is with the counter, progress bar,
  and navigation disabled. Slides created only after load may also be seen
  as `single`.
- The library Notes editor maps static `.slide`/`section` markup. A deck that
  builds its slide list at runtime may show one editor row even though the
  presenter discovers more slides; the AI prompt and normal static decks are
  unaffected.
- Scratch notes are session-only and die with the tab. They survive a same-tab
  reload but not a new tab, a new browser session, or an export/import in
  another browser profile. Deck-authored and library speaker notes persist.
- Speaker view requires an extended display. Mirrored or single-screen setups
  use the split Rehearse view (`S`) instead; there is no second-device notes
  server. There are no visual thumbnail previews in speaker view, only controls
  and notes.
- Relative links in a deck have no meaningful base URL once the HTML is
  stored; prefer absolute `http(s)` links.
- If IndexedDB is unavailable, the app falls back to an in-memory library for
  the session and shows a persistent amber banner. A refresh loses those
  decks.

## Testing

```powershell
npm test          # unit tests + all Playwright tests
npm run test:unit # node --test tests/unit/*.test.js
npm run test:e2e  # Playwright; starts the static server on port 4173
```

Playwright uses a desktop Chrome viewport. The acceptance test adds the real
deck fixture through the dialog and walks SPEC criteria 1-9. The speaker tests
walk criteria 15-16; the prompt-builder and notes-editor tests cover criteria
17-19. The acceptance test blocks the
fixture's external Google Fonts stylesheet so the suite is deterministic
offline; that one deck-owned net error is the only console error it filters.
Any app-origin console error or uncaught page error fails the test. To rerun
the serial suite or catch races:

```powershell
npx playwright test --workers=1
npx playwright test tests/e2e/acceptance.spec.js --repeat-each=2
```

## File map

```
index.html                    app shell: start screen, add/prompt/notes dialogs, present view, guide
styles.css                    dark tokens, start screen, recent rows, presentation chrome, dialogs
package.json                  scripts and the @playwright/test pin
playwright.config.js          Playwright config; webServer on 127.0.0.1:4173
scripts/serve.mjs             static file server, MIME map, no-store, traversal guard
src/app.js                    entry point: start screen, recent rows, prompt builder, notes editor
src/presenter.js              sandboxed blob iframe, modes, console, speaker sync, keyboard, links
src/bridge.js                 injected deck bridge: discovery, nav, canonical notes, read-only, messages
src/library.js                IndexedDB CRUD, export/import of decks + speaker notes, memory fallback
src/prompt-builder.js         pure LLM prompt contract for slides + hidden speaker notes
src/core.js                   pure helpers: title, bridge injection, notes key, size limit
tests/unit/core.test.js       node:test unit tests
tests/unit/prompt-builder.test.js prompt builder unit tests
tests/e2e/*.spec.js           Playwright: smoke, bridge, library, UI, present, notes,
                              prompt builder, notes editor, polish, acceptance, speaker, PWA
tests/fixtures/               deck fixtures and bridge/library harnesses
tests/fixtures/real-deck.html unmodified 3-slide frontend-slides sample deck
tests/fixtures/deck-late-api.html deck that builds its presentation API on DOMContentLoaded
tests/fixtures/hand-hygiene.html real 10-slide deck that reads localStorage and initializes late
tests/fixtures/deck-notes.html deck with per-slide speaker notes for the speaker-view tests
decks/about-presenter.html      built-in seven-slide product tour served by the Tour button
speaker.html / speaker.css / speaker.js
                              separate speaker window: notes, timer, next, scratch
tests/e2e/speaker.spec.js     one-screen default, mode dialog, speaker sync
manifest.webmanifest          PWA manifest, standalone display, PNG/SVG icons
sw.js                         service worker: app-shell + tour cache, offline fallback
icons/                        PWA icons (192, 512, maskable, Apple touch) and favicon
```

