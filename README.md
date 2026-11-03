# Presenter

A dead-simple, dark, read-only HTML presentation viewer. Paste or drop a
self-contained HTML deck, keep it in a local library, and present it
full-screen with keyboard navigation. Per-slide scratch notes last for the
browser tab only. There is no editing, no account, no backend, no build step,
and no network call from the app itself.

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
the browser's own install control. The service worker caches the app shell and
the built-in tour, so the library, presenter, notes, and tour keep working
offline after the first load. User decks live in IndexedDB; a deck's own CDN
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
- **Present** — click a Recent decks row or its **Open** button. The deck opens
  in a sandboxed iframe with only the status bar, progress bar, notes panel,
  and overlays on top.
  Use the `−` / `100%` / `+` controls to zoom the deck view from 50% to 200%;
  click the percentage to reset. Hold `Ctrl`/`Cmd` and drag to pan while
  zoomed.
- **Notes** — press `N` in presentation mode for a per-slide scratch pad.
  Notes are stored in `sessionStorage`, per deck and slide, and never enter
  IndexedDB or an export.
- **Manage** — **Export** downloads the whole library as JSON; **Import**
  restores a JSON backup. **Delete** removes a deck after confirmation.
- **Guide** — click **Guide** in the header for the quick guide, key reference,
  zoom/pan instructions (`Ctrl`/`Cmd` + drag while zoomed), and a short prompt
  for asking your LLM to generate a single-file HTML deck.
- **Tour** — click **Tour** in the header to present the built-in six-slide
  "About Presenter" deck. The tour is not added to your library.

### Keys

| Key | Action |
| --- | --- |
| `â†’`, `â†“`, `PageDown`, `Space` | Next slide |
| `â†`, `â†‘`, `PageUp` | Previous slide |
| `Home` / `End` | First / last slide |
| `F` | Toggle fullscreen |
| `N` | Toggle the notes panel |
| `?` | Toggle the shortcuts overlay |
| `Esc` | Close notes (then shortcuts), then exit presentation and fullscreen |

Keys are ignored while focus is in an `input`, `textarea`, or
`[contenteditable]`, so typing notes never navigates. In the `single`
strategy, navigation keys are left to the page (scrolling still works).

## Backup warning

The library is local to one browser profile, not synced anywhere. Clearing
site data, using a different browser/profile, or browser storage eviction can
lose every deck. Export JSON regularly and keep a copy outside the browser.
Notes are intentionally disposable: they disappear when the tab closes and
are not part of a backup.

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
  `body.presenter-readonly`, and swallows plain `E` and `Ctrl/Cmd+S` inside
  the deck.
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
- Read-only: deck editing, annotations, saved notes, thumbnails, speaker view,
  auto-advance, and PDF/PPTX export are out of scope.
- Decks with no `.slide` elements and at most one `<section>` use the
  `single` strategy: the page renders as-is with the counter, progress bar,
  and navigation disabled. Slides created only after load may also be seen
  as `single`.
- Notes are session-only and die with the tab. They survive a same-tab reload
  but not a new tab, a new browser session, or an export/import in another
  browser profile.
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
deck fixture through the dialog and walks SPEC criteria 1-14. It blocks the
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
index.html                    app shell: start screen, add dialog, present view, notes, guide
styles.css                    dark tokens, start screen, recent rows, presentation chrome, dialogs
package.json                  scripts and the @playwright/test pin
playwright.config.js          Playwright config; webServer on 127.0.0.1:4173
scripts/serve.mjs             static file server, MIME map, no-store, traversal guard
src/app.js                    entry point: start screen, recent rows, dialogs, drops, toasts
src/presenter.js              sandboxed blob iframe, fullscreen, notes, keyboard, links
src/bridge.js                 injected deck bridge: slide discovery, nav, read-only, messages
src/library.js                IndexedDB CRUD, export/import, in-memory fallback
src/core.js                   pure helpers: title, bridge injection, notes key, size limit
tests/unit/core.test.js       node:test unit tests
tests/e2e/*.spec.js           Playwright: smoke, bridge, library, UI, present, notes,
                              polish, acceptance, PWA
tests/fixtures/               deck fixtures and bridge/library harnesses
tests/fixtures/real-deck.html unmodified 3-slide frontend-slides sample deck
tests/fixtures/deck-late-api.html deck that builds its presentation API on DOMContentLoaded
tests/fixtures/hand-hygiene.html real 10-slide deck that reads localStorage and initializes late
decks/about-presenter.html      built-in six-slide product tour served by the Tour button
manifest.webmanifest          PWA manifest, standalone display, PNG/SVG icons
sw.js                         service worker: app-shell + tour cache, offline fallback
icons/                        PWA icons (192, 512, maskable, Apple touch) and favicon
```

