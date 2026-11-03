# HTML Presenter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, dark, read-only HTML presentation app with a local IndexedDB library, sandboxed rendering, keyboard navigation, and per-slide session notes.

**Architecture:** Vanilla ES modules served as static files, no build step. The app shell (`app.js`) owns routing and library UI; `presenter.js` renders a deck in a `sandbox="allow-scripts"` iframe from a `blob:` URL and injects `bridge.js` so the sandboxed deck can be navigated over `postMessage`. `library.js` wraps IndexedDB with an in-memory fallback; `core.js` holds pure helpers tested with `node --test`.

**Tech Stack:** Node 24, vanilla ES modules, IndexedDB, `sessionStorage`, `@playwright/test` 1.64.1, a 30-line static file server.

**Spec:** `D:\Projects\Presenter\SPEC.md`

## Global Constraints

- Platform: Windows 11, desktop Chromium/Edge ≥ 120 only. No mobile/touch work.
- No framework, no TypeScript, no bundler, no build step.
- No network requests from app code; all assets local. Deck content may load its own CDN assets.
- iframe sandbox is exactly `allow-scripts`. Never add `allow-same-origin`.
- Deck HTML limit: `25 * 1024 * 1024` UTF-8 bytes (`MAX_HTML_BYTES`).
- Notes live only in `sessionStorage` keyed `presenter:note:<deckId>:<slideIndex>`; never in IndexedDB, never in exports.
- IndexedDB database `html-presenter`, version 1, store `decks` (keyPath `id`), index `updatedAt`.
- Keyboard map is exactly the one in `SPEC.md`; ignore keys while focus is in `input`, `textarea`, or `[contenteditable]`.
- Do not modify `C:\Users\user\.config\opencode\skills\frontend-slides`.
- Every commit message uses `feat:`, `test:`, `docs:`, or `chore:`.

## Review Focus

- **Deck with its own keyboard handler** — arrows must advance exactly one slide, not two; the deck's own listener must not fire (`__deckNavCount === 0`). Tested in Task 3 and Task 6.
- **Typing in the notes panel** — `n`, `Space`, and `ArrowRight` must insert text without changing slides or toggling the panel. Tested in Task 7.
- **Deck with no `.slide`/`section`** — must render as `single` (deck visible, counter hidden, nav disabled), never blank or every slide stacked. Tested in Task 3 and Task 8.
- **Deck near the size limit** — a 5 MiB deck saves fine; anything over 25 MiB is rejected with an inline error and no card. Tested in Task 5 and Task 9.
- **Sandbox escape attempts** — anchor clicks must not navigate the deck frame; they post `presenter:link` and the frame URL stays `blob:`. Tested in Task 3 and Task 6.

## File Structure

```
D:\Projects\Presenter\
  index.html                  app shell: library view, present view, dialogs
  styles.css                  dark tokens, layout, presentation chrome, dialogs
  package.json                scripts + @playwright/test pin
  playwright.config.js        webServer on 4173, Desktop Chrome
  scripts/serve.mjs           static server, MIME map, no-store, traversal guard
  src/core.js                 pure helpers (title, bridge injection, notes key, size)
  src/library.js              IndexedDB CRUD, export/import, in-memory fallback
  src/bridge.js               IIFE injected into decks; nav, keys, read-only, messages
  src/presenter.js            Presenter class: blob iframe, fullscreen, state, notes
  src/app.js                  entry: view state, library UI, dialog wiring, keys
  tests/unit/core.test.js     node:test unit tests
  tests/e2e/*.spec.js         Playwright tests
  tests/fixtures/*.html       decks + harness pages (no external assets)
  README.md                   usage, backup, security, limitations
```

Rationale: `bridge.js` must stand alone (it is injected as text), `presenter.js` owns all iframe/session state, and `app.js` stays a thin coordinator. Files that change together are adjacent; no file should exceed ~400 lines.

---

### Task 1: Scaffold, static server, test harness

**Files:**
- Create: `package.json`, `.gitignore`, `scripts/serve.mjs`, `playwright.config.js`, `index.html`, `styles.css`, `tests/e2e/smoke.spec.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm run serve` on `http://127.0.0.1:4173`; `npm run test:unit`; `npm run test:e2e`; Playwright `baseURL` `http://127.0.0.1:4173`.

- [ ] **Step 1: Initialize the repo**

Run:

```powershell
git init
git rev-parse --is-inside-work-tree
```

Expected: `true`.

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "html-presenter",
  "private": true,
  "type": "module",
  "scripts": {
    "serve": "node scripts/serve.mjs",
    "test": "npm run test:unit && npm run test:e2e",
    "test:unit": "node --test tests/unit",
    "test:e2e": "playwright test"
  },
  "devDependencies": {
    "@playwright/test": "1.64.1"
  }
}
```

Also create `.gitignore` with `node_modules/`, `test-results/`, `playwright-report/`, `.DS_Store`.

- [ ] **Step 3: Create `playwright.config.js`**

```js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [{
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
  }],
  webServer: {
    command: 'node scripts/serve.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 15000,
  },
});
```

- [ ] **Step 4: Install dependencies and browsers**

```powershell
npm install
npx playwright install chromium
```

Expected: install succeeds; Chromium is already cached at `%LOCALAPPDATA%\ms-playwright`.

- [ ] **Step 5: Write the static server `scripts/serve.mjs`**

Requirements: listen on `127.0.0.1`, port `Number(process.env.PORT ?? 4173)`, root `process.cwd()`. Strip query string, map `/` to `/index.html`, resolve the path and reject anything outside root with 404. MIME map for `.html` → `text/html; charset=utf-8`, `.js` → `text/javascript; charset=utf-8`, `.css` → `text/css; charset=utf-8`, `.json` → `application/json`, `.svg` → `image/svg+xml`, `.png` → `image/png`. Send `Cache-Control: no-store`. Log `listening on http://127.0.0.1:<port>`.

- [ ] **Step 6: Write the failing smoke test**

`tests/e2e/smoke.spec.js`:

```js
import { test, expect } from '@playwright/test';

test('app shell loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('HTML Presenter');
  await expect(page.locator('#library-view')).toBeVisible();
});
```

- [ ] **Step 7: Run it and verify it fails**

Run: `npx playwright test tests/e2e/smoke.spec.js`

Expected: FAIL — the page is empty / title missing.

- [ ] **Step 8: Create the minimal shell**

`index.html`: `<!doctype html>`, `<title>HTML Presenter</title>`, a `<main id="library-view">` containing an empty `<div id="deck-grid">`. `styles.css`: the token block from `SPEC.md` plus a black background and `system-ui` font. Keep it minimal; Task 5 fills it in.

- [ ] **Step 9: Run the smoke test and verify it passes**

Run: `npx playwright test tests/e2e/smoke.spec.js`

Expected: `1 passed`.

- [ ] **Step 10: Commit**

```powershell
git add package.json .gitignore scripts/serve.mjs playwright.config.js index.html styles.css tests/e2e/smoke.spec.js
git commit -m "chore: scaffold presenter app and test harness"
```

---

### Task 2: Pure core helpers

**Files:**
- Create: `src/core.js`, `tests/unit/core.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `MAX_HTML_BYTES: number` = `25 * 1024 * 1024`
  - `extractTitle(html: string): string`
  - `injectBridge(html: string, bridgeSource: string): string`
  - `notesKey(deckId: string, index: number): string`
  - `slugify(title: string): string`
  - `isOverSizeLimit(html: string): boolean`

- [ ] **Step 1: Write the failing unit tests**

`tests/unit/core.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractTitle, injectBridge, notesKey, slugify, isOverSizeLimit, MAX_HTML_BYTES,
} from '../../src/core.js';

test('extractTitle reads and decodes <title>', () => {
  assert.equal(extractTitle('<head><title> Hand &amp; Hygiene </title></head>'), 'Hand & Hygiene');
  assert.equal(extractTitle('<p>no title</p>'), '');
  assert.equal(extractTitle('<title>' + 'x'.repeat(300) + '</title>').length, 120);
});

test('injectBridge inserts before the last </body>', () => {
  const out = injectBridge('<html><body><h1>A</h1></body></html>', 'BRIDGE');
  assert.equal(out, '<html><body><h1>A</h1><script data-presenter-bridge>BRIDGE</script></body></html>');
});

test('injectBridge falls back to </html> then append', () => {
  assert.equal(injectBridge('<html><h1>A</h1></html>', 'B'), '<html><h1>A</h1><script data-presenter-bridge>B</script></html>');
  assert.equal(injectBridge('<h1>A</h1>', 'B'), '<h1>A</h1><script data-presenter-bridge>B</script>');
});

test('notesKey and slugify are stable', () => {
  assert.equal(notesKey('abc', 2), 'presenter:note:abc:2');
  assert.equal(slugify('Hand Hygiene: 2026!'), 'hand-hygiene-2026');
  assert.equal(slugify('   '), 'deck');
});

test('isOverSizeLimit uses UTF-8 bytes', () => {
  assert.equal(MAX_HTML_BYTES, 25 * 1024 * 1024);
  assert.equal(isOverSizeLimit('x'.repeat(10)), false);
  assert.equal(isOverSizeLimit('x'.repeat(MAX_HTML_BYTES + 1)), true);
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `npm run test:unit`

Expected: FAIL — `Cannot find module .../src/core.js`.

- [ ] **Step 3: Implement `src/core.js`**

- `extractTitle`: match `<title[^>]*>([\s\S]*?)</title>` case-insensitively; strip inner tags; decode `&amp; &lt; &gt; &quot; &#39;`; collapse whitespace; trim; return `''` when absent; cap at 120 chars.
- `injectBridge`: find the last case-insensitive `</body>`; else last `</html>`; else append. Insert `<script data-presenter-bridge>${bridgeSource}</script>` at that offset.
- `notesKey`: template above.
- `slugify`: lowercase, non `[a-z0-9]` to `-`, collapse repeats, trim hyphens, max 60, fallback `'deck'`.
- `isOverSizeLimit`: `new TextEncoder().encode(html).length > MAX_HTML_BYTES`.

- [ ] **Step 4: Run tests and verify they pass**

Run: `npm run test:unit`

Expected: `pass 5`.

- [ ] **Step 5: Commit**

```powershell
git add src/core.js tests/unit/core.test.js
git commit -m "feat: add core helpers for titles, bridge injection, size limits"
```

---

### Task 3: Sandboxed deck bridge

**Files:**
- Create: `src/bridge.js`, `tests/fixtures/deck-3slides.html`, `tests/fixtures/deck-nojs.html`, `tests/fixtures/deck-single.html`, `tests/fixtures/deck-links.html`, `tests/fixtures/bridge-harness.html`, `tests/e2e/bridge.spec.js`

**Interfaces:**
- Consumes: `injectBridge` from `src/core.js`.
- Produces: `src/bridge.js` as a self-contained IIFE with no imports, implementing the `SPEC.md` protocol and keymap. Global side effects: none except message listeners.

- [ ] **Step 1: Write fixtures**

- `deck-3slides.html`: exactly 3 `.slide` elements; inline script sets `window.__deckNavCount = 0`, defines `window.presentation = { currentSlide: 0, showSlide(i){...} }`, and adds a **bubble-phase** `keydown` listener that increments `window.__deckNavCount`. Include `<div class="edit-toggle">Edit</div>` and a listener that adds `document.body.classList.add('edit-mode')` on plain `e`.
- `deck-nojs.html`: 3 `.slide` elements, no script, `.slide.active` base CSS.
- `deck-single.html`: `<article><h1>Plain document</h1><p>No slides.</p></article>`.
- `deck-links.html`: one `.slide` with `<a id="ext" href="https://example.com/x">link</a>`.
- No fixture may reference external fonts or assets.

- [ ] **Step 2: Write `tests/fixtures/bridge-harness.html`**

Behavior: read `?deck=` (default `deck-3slides.html`), `fetch('/' + deck)` and `fetch('/src/bridge.js')`, inject via `injectBridge`, create `<iframe id="deck-frame" sandbox="allow-scripts">`, set its `src` to a `blob:` URL, and expose:

```js
window.__msgs = [];                                   // every message received
window.__send = (payload) => frame.contentWindow.postMessage({ type: 'presenter:cmd', ...payload }, '*');
window.__deckNavCount = undefined;                    // read from inside via messages? keep harness-only
```

Message listener pushes `{ ...event.data, __origin: event.origin }` into `__msgs`. Set `window.__ready = true` after the `presenter:ready` message. Import `injectBridge` with `<script type="module">` and top-level await; run on `DOMContentLoaded`.

- [ ] **Step 3: Write the failing bridge tests**

`tests/e2e/bridge.spec.js` — one `test()` per bullet, each asserting exact values:

1. `ready reports 3 slides / api` → last `presenter:ready` is `{ total: 3, strategy: 'api' }`.
2. `next advances exactly one` → `__send({cmd:'next'})` then last state index is `1`.
3. `iframe keys are handled once` → focus `#deck-frame`, `page.keyboard.press('ArrowRight')`, last state index `2`, and the deck's own counter is not increasing (assert `page.frameLocator('#deck-frame').locator('body').evaluate(b => window.__deckNavCount)` equals `0`).
4. `no-js deck uses slides strategy` → `{ total: 3, strategy: 'slides' }`; ArrowRight → index `1`.
5. `plain doc is single strategy` → `{ total: 1, strategy: 'single' }`; ArrowRight produces no new `presenter:state`.
6. `links post presenter:link` → click `#ext`; last message `{ type:'presenter:link', href:'https://example.com/x' }`; `page.url()` unchanged.
7. `read-only hides edit UI and blocks E` → `.edit-toggle` computed `display` is `none`; `body.presenter-readonly` exists; `page.keyboard.press('e')` leaves `body.edit-mode` absent.
8. `N/F/?/Esc post control messages` → focus iframe, press `n`, `f`, `?`, `Escape`; messages include `presenter:note-toggle`, `presenter:fullscreen`, `presenter:shortcuts`, `presenter:exit`.

- [ ] **Step 4: Run and verify they fail**

Run: `npx playwright test tests/e2e/bridge.spec.js`

Expected: FAIL — no bridge behavior.

- [ ] **Step 5: Implement `src/bridge.js`**

Self-contained IIFE:

- Discover strategy in the `SPEC.md` order; keep `index` internal; compute `total`.
- Add a **capture-phase** `window.addEventListener('keydown', ..., true)`; for handled keys call `preventDefault()` + `stopImmediatePropagation()`, except navigation keys in `single` strategy.
- Implement the full keymap; `Escape` posts `presenter:exit`; `n` → `presenter:note-toggle`; `f` → `presenter:fullscreen`; `?` → `presenter:shortcuts`.
- Listen for `message`; handle `presenter:cmd` (`next|prev|first|last|goto`), update index, apply, post `presenter:state`.
- Apply navigation: `api` → `presentation.showSlide(index)`; `slides`/`sections` → toggle `active`/`visible` on the element list; `single` → no-op.
- Post `presenter:ready` once, on load.
- Inject the read-only `<style>` and add `body.presenter-readonly`; swallow plain `e` and `Ctrl/Cmd+S`.
- Intercept anchor clicks in capture phase: `preventDefault()` and post `presenter:link` with the absolute `href`.
- Never use `document.write`; never reference `window.parent` beyond `postMessage`.

- [ ] **Step 6: Run tests and verify they pass**

Run: `npx playwright test tests/e2e/bridge.spec.js`

Expected: all pass.

- [ ] **Step 7: Commit**

```powershell
git add src/bridge.js tests/fixtures tests/e2e/bridge.spec.js
git commit -m "feat: add sandboxed deck bridge with navigation and read-only mode"
```

---

### Task 4: Library storage

**Files:**
- Create: `src/library.js`, `tests/fixtures/library-harness.html`, `tests/e2e/library.spec.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `listDecks(): Promise<Deck[]>`
  - `getDeck(id: string): Promise<Deck | undefined>`
  - `putDeck(deck: Deck): Promise<void>`
  - `deleteDeck(id: string): Promise<void>`
  - `exportDecks(): Promise<string>`
  - `importDecks(json: string): Promise<{ imported: number, skipped: number }>`
  - `isPersistent(): boolean`
  - `Deck = { id: string, title: string, html: string, createdAt: number, updatedAt: number }`

- [ ] **Step 1: Write the harness**

`tests/fixtures/library-harness.html`: `<script type="module">import * as lib from '/src/library.js'; window.lib = lib; window.__ready = true;</script>`. No other markup.

- [ ] **Step 2: Write the failing tests**

`tests/e2e/library.spec.js`:

1. `put/list/get/delete round-trip` — save two decks with distinct `updatedAt`; `listDecks()` returns newest first; `getDeck` matches; after delete only one remains.
2. `export then import restores` — export JSON, delete all (helper in test using `page.evaluate`), import, assert counts `{ imported: 2, skipped: 0 }` and ids match.
3. `import skips duplicates and invalid entries` — import the same JSON twice; second returns `{ imported: 0, skipped: 2 }`; malformed JSON returns `{ imported: 0, skipped: 0 }` without throwing.
4. `falls back to memory without indexedDB` — `addInitScript(() => { Object.defineProperty(window, 'indexedDB', { get: () => undefined }); })`; reload harness; `isPersistent()` is `false`; put + list still work.
5. `writes survive reload` — put, reload harness, `listDecks()` still returns it.

Each test starts by clearing the DB:

```js
await page.evaluate(() => new Promise((r) => {
  const req = indexedDB.deleteDatabase('html-presenter');
  req.onsuccess = req.onerror = req.onblocked = () => r();
}));
```

- [ ] **Step 3: Run and verify they fail**

Run: `npx playwright test tests/e2e/library.spec.js`

Expected: FAIL — module missing.

- [ ] **Step 4: Implement `src/library.js`**

- Open `html-presenter` v1 with store `decks` keyPath `id`, index `updatedAt`.
- All operations return promises and reject on real errors.
- `isPersistent()` is `false` permanently once the module has fallen back.
- Fallback: if `typeof indexedDB === 'undefined'` or `open` errors, use a module-level `Map`; `listDecks` sorts by `updatedAt` desc in both modes.
- `exportDecks` returns the exact JSON shape from `SPEC.md` (`app`, `version`, `exportedAt`, `decks`).
- `importDecks`: JSON parse in `try/catch`; require `version === 1` and `Array.isArray(decks)`; for each entry require non-empty string `id`, string `title`, string `html`, numeric `createdAt`/`updatedAt`; skip ids that already exist or repeat within the payload; count both outcomes.

- [ ] **Step 5: Run tests and verify they pass**

Run: `npx playwright test tests/e2e/library.spec.js`

Expected: all pass.

- [ ] **Step 6: Commit**

```powershell
git add src/library.js tests/fixtures/library-harness.html tests/e2e/library.spec.js
git commit -m "feat: add IndexedDB library with export, import, and memory fallback"
```

---

### Task 5: App shell and library UI

**Files:**
- Modify: `index.html`, `styles.css`
- Create: `src/app.js`, `tests/e2e/library-ui.spec.js`

**Interfaces:**
- Consumes: `src/core.js`, `src/library.js`.
- Produces: DOM contract used by later tasks:
  - `#library-view`, `#deck-grid`, `#add-deck-btn`, `#export-btn`, `#import-btn`, `#import-file`, `#storage-banner`, `#toast-region`
  - `#import-dialog` (`<dialog>`), `#import-form`, `#deck-html` (textarea), `#deck-title` (input), `#deck-file` (input type=file), `#import-error`, `#save-deck-btn`, `#cancel-import-btn`
  - `#present-view` (hidden), `#present-viewport`, `#present-frame`, `#slide-counter`, `#progress` (wrapper), `#progress-fill`, `#notes-panel`, `#notes-textarea`, `#notes-label`, `#note-badge`, `#shortcuts-dialog`, `#shortcuts-btn`, `#exit-present-btn`
  - `window.__appReady = true` after initial library render (test seam)

- [ ] **Step 1: Write the failing UI tests**

`tests/e2e/library-ui.spec.js` (use `tests/fixtures/deck-3slides.html` contents read in Node with `fs`):

1. `add via paste shows a card` — open dialog, fill `#deck-html`, title auto-fills "Frontend Slides Readiness Test", save, card visible with that title.
2. `deck survives reload` — reload, card still visible.
3. `title is editable before save` — change `#deck-title`, card uses the new title.
4. `delete removes deck` — each card contains `<button data-action="delete" aria-label="Delete <title>">Delete</button>`; click it, accept the confirm, card gone after reload.
5. `export downloads JSON` — `page.waitForEvent('download')`; filename matches `html-presenter-decks-YYYY-MM-DD.json`; content parses with `version === 1` and one deck.
6. `import restores` — after export, delete all; set `#import-file` to the downloaded file; card returns.
7. `empty paste is rejected` — error text "Paste HTML first"; no card.
8. `oversize paste is rejected` — evaluate a 25 MiB + 1 HTML string into the textarea; error mentions size; no card. Add a second assertion that a ~5 MiB string saves successfully (this is the near-limit case from Review Focus).

- [ ] **Step 2: Run and verify they fail**

Run: `npx playwright test tests/e2e/library-ui.spec.js`

Expected: FAIL.

- [ ] **Step 3: Build the shell markup and styles**

`index.html`: header with title + Add deck + Import + Export; `#storage-banner` (hidden by default); `#deck-grid`; import `<dialog>`; present view containing viewport, iframe, status bar, notes panel, shortcuts dialog. Use `hidden` attributes, not CSS-only hiding, for views and panels.

`styles.css`: dark tokens, grid layout (auto-fill min 260px), card hover, dialog styles, button focus rings, `body.cursor-idle`, and the reduced-motion media query setting `transition: none !important; animation: none !important`.

- [ ] **Step 4: Implement `src/app.js` (library half)**

- On load: `listDecks()` → render cards (title, date, size via `Blob([html]).size`), set `window.__appReady = true`.
- Add deck: dialog opens, file input reads text and fills the textarea + title from `extractTitle`; drop on the dialog also works; save validates empty and `isOverSizeLimit`, builds `Deck` with `crypto.randomUUID()`, `putDeck`, re-renders, closes.
- Title input always overrides the extracted title.
- Delete: confirm via `confirm()`, `deleteDeck`, re-render.
- Export: `exportDecks()` → `Blob` → temporary `<a download>`; filename uses `slugify`/date.
- Import: read file text → `importDecks` → toast "Imported X, skipped Y" → re-render.
- Storage banner: shown when `isPersistent()` is `false`.
- Card click is wired to a `openDeck(deck)` function that currently only logs; Task 6 replaces it.

- [ ] **Step 5: Run tests and verify they pass**

Run: `npx playwright test tests/e2e/library-ui.spec.js`

Expected: all pass.

- [ ] **Step 6: Manual smoke check**

Run `npm run serve`, open `http://127.0.0.1:4173`, add the real deck from `D:\Projects\frontend-slides-lab\test-deck\index.html` by pasting, reload, delete. Confirm no console errors.

- [ ] **Step 7: Commit**

```powershell
git add index.html styles.css src/app.js tests/e2e/library-ui.spec.js
git commit -m "feat: add dark app shell and library management UI"
```

---

### Task 6: Presentation mode

**Files:**
- Create: `src/presenter.js`
- Modify: `src/app.js`, `index.html`, `styles.css`
- Create: `tests/e2e/present.spec.js`

**Interfaces:**
- Consumes: `injectBridge` (`core.js`), `notesKey` (`core.js`), bridge protocol.
- Produces: `class Presenter` with:
  - `constructor(opts: { viewport: HTMLElement, frame: HTMLIFrameElement, counter: HTMLElement, progress: HTMLElement, notesPanel: HTMLElement, notesTextarea: HTMLTextAreaElement, notesLabel: HTMLElement, noteBadge: HTMLElement })`
  - `async present(deck: Deck): Promise<void>`
  - `next()`, `prev()`, `first()`, `last()`, `goTo(index: number)`
  - `toggleFullscreen(): Promise<void>`
  - `exit(): void`
  - `get state(): { index: number, total: number, strategy: string }`
  - `onExit(cb: () => void): void`
  - `onLink(cb: (href: string) => void): void`
  - `onError(cb: (message: string) => void): void`

- [ ] **Step 1: Write the failing tests**

`tests/e2e/present.spec.js` (seed the library via UI helper or `page.evaluate` on `window.lib` — expose `window.lib` in `app.js` for tests only if needed; prefer seeding through the import dialog):

1. `opens a sandboxed blob iframe` — `#present-view` visible, `#library-view` hidden, iframe `sandbox` attribute equals `allow-scripts`, `src` starts with `blob:`.
2. `counter and progress` — `1 / 3`; `#progress-fill` width ≈ 33.33% (accept ±1%).
3. `parent keyboard navigates` — with focus outside the iframe: ArrowRight → `2 / 3`; End → `3 / 3`; Home → `1 / 3`; ArrowLeft → stays `1 / 3`.
4. `iframe keyboard navigates once` — `page.evaluate(() => document.getElementById('present-frame').focus())`, press ArrowRight twice → `3 / 3`, not skipping.
5. `F toggles fullscreen` — press `f`; `page.evaluate(() => document.fullscreenElement !== null)` is `true`; press `f` again → `false`.
6. `Esc exits with notes closed` — press Escape; `#library-view` visible, `#present-view` hidden, iframe `src` is `about:blank` (blob revoked).
7. `link click stays in deck frame` — seed `deck-links.html`; click the link; frame URL still starts `blob:`; a new page may open (accept and close it).

- [ ] **Step 2: Run and verify they fail**

Run: `npx playwright test tests/e2e/present.spec.js`

Expected: FAIL.

- [ ] **Step 3: Implement `Presenter`**

- `present(deck)`: fetch `/src/bridge.js` once (cache); `injectBridge(deck.html, source)`; create blob `text/html`; set `frame.src`; show `#present-view`; focus frame; listen for messages only when `event.source === frame.contentWindow`.
- Messages: `ready` → store `total`/`strategy`, update counter/progress, show/hide status for `single`; `state` → mirror; `note-toggle` → `toggleNotes()`; `fullscreen` → `toggleFullscreen()`; `shortcuts` → open `#shortcuts-dialog`; `exit` → `exit()`; `link` → `window.open(href, '_blank', 'noopener')`; if the popup is blocked (returns `null`), call `onLink` so the app shows a toast containing the href.
- Parent `keydown`: same map; ignore when target is input/textarea/contenteditable; ignore navigation in `single` strategy.
- Fullscreen: request on `viewport`, `exitFullscreen` on toggle-off; on `fullscreenchange` update internal flag.
- `exit()`: revoke blob URL, set `frame.src = 'about:blank'`, hide present view, clear state, emit `onExit`.
- `next/prev/first/last/goTo` post `presenter:cmd`; do not mutate local index (bridge is authoritative).
- If bridge fetch fails, emit `onError('Presenter failed to load')` and do not present.

- [ ] **Step 4: Wire `openDeck` in `app.js`**

Instantiate one `Presenter`; card click → `present(deck)`; `onExit` → show library; `onError` → toast.

- [ ] **Step 5: Run tests and verify they pass**

Run: `npx playwright test tests/e2e/present.spec.js`

Expected: all pass. If Chromium headless refuses fullscreen, verify manually and mark only that assertion `test.fixme` with a comment — do not fake it.

- [ ] **Step 6: Commit**

```powershell
git add src/presenter.js src/app.js index.html styles.css tests/e2e/present.spec.js
git commit -m "feat: add sandboxed presentation mode with keyboard and fullscreen"
```

---

### Task 7: Per-slide session notes

**Files:**
- Modify: `src/presenter.js`, `src/app.js`, `index.html`, `styles.css`
- Create: `tests/e2e/notes.spec.js`

**Interfaces:**
- Consumes: `notesKey` from `src/core.js`; `Presenter.state`.
- Produces: `Presenter.toggleNotes(): void`, `Presenter.closeNotes(): void`, `Presenter.saveNotes(text: string): void`, and `Presenter` restores the current slide's note whenever state changes.

- [ ] **Step 1: Write the failing tests**

`tests/e2e/notes.spec.js`:

1. `N opens notes for slide 1` — panel visible, textarea focused, `#notes-label` is `Slide 1`.
2. `typing does not navigate` — type `hello n Space` and press ArrowRight inside the textarea; counter stays `1 / 3`; panel stays open.
3. `Esc closes notes first` — press Escape once; panel hidden, `#present-view` still visible.
4. `notes are per slide` — type "slide one" on slide 1; go next; label `Slide 2`, textarea empty; go back; text "slide one" restored.
5. `notes survive same-tab reload` — close notes, reload page, reopen deck, slide 1 note restored.
6. `notes die with the tab` — new browser context: note absent.
7. `notes never export` — export JSON and assert the exported string does not contain the note text.
8. `note badge reflects presence` — `#note-badge` visible on slides with a note, hidden otherwise.

- [ ] **Step 2: Run and verify they fail**

Run: `npx playwright test tests/e2e/notes.spec.js`

Expected: FAIL.

- [ ] **Step 3: Implement notes**

- `toggleNotes` opens/closes `#notes-panel`, reads `sessionStorage.getItem(notesKey(deck.id, index))`, focuses the textarea, sets `aria-hidden` appropriately.
- `saveNotes`: write on `input` (debounced 150ms is fine); remove the key when text is empty.
- On `presenter:state`, reload the textarea from the new index if the panel is open, and update the badge.
- Panel is `role="dialog"` with `aria-label="Slide notes"`; closing restores focus to the presenter viewport.
- Typing keys must not reach navigation: guard on `event.target` being the textarea, and call `stopPropagation` for nav keys there.

- [ ] **Step 4: Run tests and verify they pass**

Run: `npx playwright test tests/e2e/notes.spec.js`

Expected: all pass.

- [ ] **Step 5: Commit**

```powershell
git add src/presenter.js src/app.js index.html styles.css tests/e2e/notes.spec.js
git commit -m "feat: add per-slide session notes"
```

---

### Task 8: Read-only enforcement, shortcuts, failure states, polish

**Files:**
- Modify: `src/bridge.js`, `src/app.js`, `src/presenter.js`, `styles.css`
- Create: `tests/e2e/polish.spec.js`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: no new public API; behavior only.

- [ ] **Step 1: Write the failing tests**

`tests/e2e/polish.spec.js`:

1. `edit shortcut is dead in-app` — present `deck-3slides.html`, focus iframe, press `e`; `#present-frame` content has no `edit-mode` class and `.edit-toggle` is hidden.
2. `single strategy hides chrome` — present `deck-single.html`; `#slide-counter` and `#progress` are hidden; deck text visible; ArrowRight does not change the URL or throw.
3. `invalid fragment still renders` — present `<div>hi</div>`; strategy `single`, text visible.
4. `shortcuts overlay` — focus the deck iframe, press `?`; `#shortcuts-dialog` visible; Escape closes; presentation still visible.
5. `cursor auto-hides` — move mouse; wait 2100ms; `document.body.classList.contains('cursor-idle')` true; move again → false.
6. `reduced motion` — `page.emulateMedia({ reducedMotion: 'reduce' })`; computed `transitionDuration` of a card is `0s`.
7. `storage banner when IndexedDB is missing` — `addInitScript` removing `indexedDB`; reload; `#storage-banner` visible; adding a deck still works in memory.
8. `bridge failure disables presenting` — route `**/src/bridge.js` to abort; clicking a card shows toast "Presenter failed to load"; library still usable.

- [ ] **Step 2: Run and verify they fail**

Run: `npx playwright test tests/e2e/polish.spec.js`

Expected: FAIL.

- [ ] **Step 3: Implement**

- Bridge: read-only style list exactly as `SPEC.md`; add `presenter-readonly`; block `e`/`E` and `Ctrl/Cmd+S` only when the target is not an input/textarea/contenteditable.
- App/presenter: `?` opens the shortcuts dialog from either context (parent keydown or the bridge's `presenter:shortcuts` message). Guard keys while a dialog is open.
- `single`: hide counter, progress, and note badge; skip parent nav; bridge already ignores nav keys in `single`.
- Cursor idle: `mousemove` resets a 2000ms timer that toggles `body.cursor-idle`; only active in present view.
- Reduced motion CSS media query.
- Storage banner + bridge-error handling.
- Toast region: `role="status"`, messages auto-dismiss after 4s.

- [ ] **Step 4: Run tests and verify they pass**

Run: `npx playwright test tests/e2e/polish.spec.js`

Expected: all pass.

- [ ] **Step 5: Commit**

```powershell
git add src/bridge.js src/app.js src/presenter.js styles.css tests/e2e/polish.spec.js
git commit -m "feat: enforce read-only mode and handle presentation edge cases"
```

---

### Task 9: Docs, real-deck fixture, full acceptance

**Files:**
- Create: `README.md`, `tests/fixtures/real-deck.html`, `tests/e2e/acceptance.spec.js`

**Interfaces:**
- Consumes: everything.
- Produces: documented product; full suite green.

- [ ] **Step 1: Copy the real deck fixture**

Copy `D:\Projects\frontend-slides-lab\test-deck\index.html` to `tests/fixtures/real-deck.html` unchanged.

- [ ] **Step 2: Write the acceptance test**

`tests/e2e/acceptance.spec.js`, one test walking criteria 1–9 from `SPEC.md`:

- Import `real-deck.html` via the dialog.
- Open → counter `1 / 3`; ArrowRight → `2 / 3`; ArrowLeft → `1 / 3`.
- Add a note on slide 2, navigate away and back, note restored.
- Export JSON; delete the deck; import the JSON; deck returns.
- Press `e` inside the deck → no edit UI.
- Exit; reload; deck and (same tab) note persistence behave as specced.

- [ ] **Step 3: Run and verify it fails, then passes**

First run before final wiring if anything is missing, then:

Run: `npx playwright test tests/e2e/acceptance.spec.js`

Expected: pass with no console errors (assert `page.on('console')` collects no `error` entries).

- [ ] **Step 4: Write `README.md`**

Sections: What it is; Run (`npm install`, `npm run serve`, open `http://127.0.0.1:4173`); Usage (paste/drop, present, notes, keys table); Backup warning (IndexedDB is per-browser; export regularly); Security model (`allow-scripts`, no same-origin, pasted HTML is untrusted); Limitations (desktop only, no editing, single strategy for non-slide pages, notes die with the tab); Testing (`npm test`); File map.

- [ ] **Step 5: Run the full suite**

Run: `npm test`

Expected: unit `pass 5` (or more); Playwright all pass; no skipped tests except a documented `fixme` for headless fullscreen if unavoidable.

- [ ] **Step 6: Manual acceptance pass**

`npm run serve`, then check by hand: add real deck, present with arrows, fullscreen, notes, export/import, reduced motion via DevTools emulation, and arrow keys after clicking inside the deck.

- [ ] **Step 7: Commit**

```powershell
git add README.md tests/fixtures/real-deck.html tests/e2e/acceptance.spec.js
git commit -m "docs: add usage guide and end-to-end acceptance test"
```

---

## Self-Review Notes

- Spec coverage: rendering (T6), library (T4/T5), bridge/keys/read-only (T3/T6/T8), notes (T7), import/export (T4/T5), failures (T8), data model (T4), visual tokens (T5), accessibility (T5/T7/T8), acceptance (T9).
- Interfaces: `Deck` shape defined in T4 and reused verbatim in T5/T6/T7; `notesKey` in T2 used by T7; bridge message names match `SPEC.md` exactly.
- Deliberate omissions: no thumbnails, grid overview, speaker view, mobile, auto-advance (non-goals).
