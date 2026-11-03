# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS/vanilla ES modules, no build step, served by a 30-line local Node static server. Locked by `SPEC.md`; not open for renegotiation.

## Users

A single presenter working at a Windows 11 desktop, often minutes before a talk or review, who already has a self-contained HTML deck (usually exported by the `frontend-slides` skill). They are in a low-light room, possibly on a projector or second display, and need the deck on screen without an account, upload, or network dependency. Assumption (user said to proceed): the operator is also the author of the deck; no separate audience role exists in v1.

## Product Purpose

Keep a local library of HTML decks and present them full-screen with reliable keyboard navigation, a per-slide scratch pad, and no editing surface. Success means a deck can go from clipboard to full-screen in under a minute and never surprise the presenter with skipped slides, lost notes, or a half-broken deck.

## Positioning

A read-only, local-first deck stage: the exact opposite of a slide editor. Decks are untrusted documents rendered in a `sandbox="allow-scripts"` iframe from a `blob:` URL, with a bridge that makes any reasonable HTML deck navigable while preventing the deck's own handlers from double-advancing.

## Operating Context

- Decks are single-file HTML, typically 1920×1080 `.slide` stages, sometimes plain documents with no slide markup.
- The app runs from `http://127.0.0.1:4173` via `npm run serve`; app code makes no network requests.
- Presentation is keyboard-first: arrows, Space, PgUp/PgDn, Home/End, F, N, Esc, ?.
- Notes are session-only scratch text keyed per deck and slide; they die with the tab and never enter exports.
- Backup is manual JSON export/import; IndexedDB is per-browser and can be evicted.

## Capabilities and Constraints

- Add by paste or `.html` drop/choose; title extracted from `<title>` and editable; 25 MiB UTF-8 ceiling.
- A built-in Tour button presents a six-slide, read-only "About Presenter" deck without adding it to the library.
- File drops are accepted anywhere on the library page, show a full-window drop overlay, and never open the file in a browser tab.
- The start screen is a PowerPoint-like launcher: a blank 16:9 New deck tile on the left and a Recent decks list on the right. Paste HTML, choose a file, or drop one anywhere on the page; adding a deck never removes the New deck tile. A Guide button in the header opens the quick guide, key reference, zoom/pan instructions, and a copyable prompt for generating a single-file deck with an LLM.
- Presentation status bar includes deck-view zoom controls (−, percentage, +) that scale the rendered deck from 50% to 200% without scaling the app chrome; hold Ctrl/Cmd and drag to pan while zoomed.
- Decks that initialize on DOMContentLoaded or read localStorage still work: the bridge provides per-frame in-memory storage and upgrades to the deck API when it appears, keeping the deck's own navigator in sync.
- Library CRUD in IndexedDB `html-presenter` v1, store `decks`, index `updatedAt`; in-memory fallback with a persistent amber banner.
- Sandbox is exactly `allow-scripts`; never `allow-same-origin`.
- Bridge is injected at render time so bridge updates apply to old decks.
- Read-only: edit affordances hidden, `E` and `Ctrl/Cmd+S` swallowed inside decks.
- Single-strategy decks render as-is; counter, progress, and nav are disabled.
- Desktop Chromium/Edge ≥120 only. No mobile, thumbnails, speaker view, auto-advance, PDF/PPTX, cloud, or accounts.
- Non-goal: editing, annotations, saved notes, hosting, URL/Drive/Gist loading.

## Brand Commitments

- The palette and tokens in `SPEC.md` are locked: near-black ground `#0b0c0e`, surfaces `#14161a`/`#1b1e24`, border `#262a31`, text `#f2f3f5`, muted `#9aa1ad`, accent `#e2b04a`, danger `#e5645f`, radius 10px.
- No external fonts or assets; fully offline; system UI + monospace stacks.
- Installable PWA: a local manifest, PWA icons, and a service worker that caches the app shell and built-in tour. The library, presenter, notes, and tour work offline after the first load; deck-owned CDN assets may still need a network.
- The user asked for a sketch-like storyboard world, then a more professional PowerPoint-like front page. The storyboard treatment now lives in the deck thumbnails, add/guide dialogs, notes card, and the built-in tour; the start screen is a clean, scannable launcher, not a sketchy hero.
- Utharam (`utharam.in`) is the product's brand home. The topbar stays product-only; the maker is carried in a footer lockup ("an Utharam tool" plus a quiet `utharam.in` link). The link opens in a new tab and is the only external link in app chrome.
- The installable app is named "Presenter"; the PWA description credits Utharam.

## Evidence on Hand

- `SPEC.md` — locked v1 behaviour, protocol, data model, failure table, acceptance criteria.
- `PLAN.md` — task-by-task implementation plan, test list, file map.
- `D:\Projects\frontend-slides-lab\test-deck\index.html` — real 3-slide deck for the acceptance fixture.
- No testimonials, customers, benchmarks, or pricing exist; do not invent any.

## Product Principles

1. The deck is the performance; the app is the stagehand. Chrome stays out of the letterboxed deck.
2. Keyboard truth beats deck cleverness. One press, one slide, always.
3. Local and disposable: no account, no network, no saved notes, no hidden state.
4. Untrusted by default: the deck is a sandboxed document, never a same-origin page.
5. Recover without drama: a missing bridge, blocked storage, or plain document degrades to a usable state, not a dead end.

## Accessibility & Inclusion

- Full keyboard operation; visible 2px gold focus ring on every control.
- Notes and shortcuts are labelled `role="dialog"` with focus moved in and restored.
- Slide-number changes announce through `aria-live="polite"`.
- Text contrast meets 4.5:1 body / 3:1 large; `prefers-reduced-motion` disables transitions and animations.
