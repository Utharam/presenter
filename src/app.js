import { extractTitle, isOverSizeLimit } from './core.js';
import {
  listDecks,
  putDeck,
  deleteDeck,
  exportDecks,
  importDecks,
  isPersistent,
} from './library.js';
import { buildDeckPrompt } from './prompt-builder.js';
import { Presenter } from './presenter.js';

const $ = (selector) => document.querySelector(selector);

const els = {
  grid: $('#deck-grid'),
  libraryView: $('#library-view'),
  emptyState: $('#empty-state'),
  deckCount: $('#deck-count'),
  addBtn: $('#add-deck-btn'),
  frontAddBtn: $('#front-add-btn'),
  importBtn: $('#import-btn'),
  exportBtn: $('#export-btn'),
  guideBtn: $('#guide-btn'),
  tourBtn: $('#tour-btn'),
  importFile: $('#import-file'),
  storageBanner: $('#storage-banner'),
  toastRegion: $('#toast-region'),
  dropOverlay: $('#drop-overlay'),
  dialog: $('#import-dialog'),
  guideDialog: $('#guide-dialog'),
  guideCloseBtn: $('#guide-close-btn'),
  presentDialog: $('#present-dialog'),
  presentDeckName: $('#present-deck-name'),
  displayStatus: $('#display-status'),
  presentCloseBtn: $('#present-close-btn'),
  form: $('#import-form'),
  dropzone: $('#deck-dropzone'),
  html: $('#deck-html'),
  title: $('#deck-title'),
  deckFile: $('#deck-file'),
  error: $('#import-error'),
  cancelBtn: $('#cancel-import-btn'),

  // LLM prompt builder dialog (UI may land in parallel; every access is guarded)
  promptBtn: $('#prompt-btn'),
  guidePromptBtn: $('#guide-prompt-btn'),
  promptDialog: $('#prompt-dialog'),
  promptCloseBtn: $('#prompt-close-btn'),
  promptBrief: $('#prompt-brief'),
  promptSlideCount: $('#prompt-slide-count'),
  promptDensity: $('#prompt-density'),
  promptNoteGuidance: $('#prompt-note-guidance'),
  promptSlides: $('#prompt-slides'),
  promptOutput: $('#prompt-output'),
  promptCopyBtn: $('#prompt-copy-btn'),
  promptCopyStatus: $('#prompt-copy-status'),

  // Library speaker-notes editor dialog
  notesEditorDialog: $('#notes-editor-dialog'),
  notesEditorDeck: $('#notes-editor-deck'),
  notesEditorList: $('#notes-editor-list'),
  notesEditorStatus: $('#notes-editor-status'),
  notesEditorReset: $('#notes-editor-reset'),
  notesEditorCloseBtn: $('#notes-editor-close-btn'),
  notesEditorDone: $('#notes-editor-done'),
};

const presenter = new Presenter({
  viewport: $('#present-viewport'),
  frame: $('#present-frame'),
  counter: $('#slide-counter'),
  progress: $('#progress'),
  notesPanel: $('#notes-panel'),
  notesTextarea: $('#notes-textarea'),
  notesLabel: $('#notes-label'),
  noteBadge: $('#note-badge'),
});

let decks = [];
let titleTouched = false;
let pendingDeck = null;

// Prompt builder dialog state: per-slide outlines survive count changes.
let promptRows = [];
let promptCopyTimer = null;

// Library notes editor state.
const notesEditorState = {
  deck: null,
  embedded: [],
  saveTimer: null,
  dirty: false,
  open: false,
};

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp));
}

function toast(message) {
  for (const old of els.toastRegion.querySelectorAll('.toast')) {
    if (old.textContent === message) old.remove();
  }
  while (els.toastRegion.children.length >= 2) els.toastRegion.firstElementChild.remove();
  const item = document.createElement('div');
  item.className = 'toast';
  item.textContent = message;
  els.toastRegion.append(item);
  requestAnimationFrame(() => item.classList.add('is-in'));
  window.setTimeout(() => {
    item.classList.add('is-out');
    window.setTimeout(() => item.remove(), 220);
  }, 4000);
}

function updateStorageBanner() {
  els.storageBanner.hidden = isPersistent();
}

presenter.onExit(() => {
  els.libraryView.hidden = false;
});
presenter.onError((message) => toast(message));
presenter.onNotice((message) => toast(message));
presenter.onLink((href) => toast(`Could not open link — ${href}`));

function hasExtendedDisplay() {
  return Boolean(window.screen && window.screen.isExtended);
}

function defaultPresentMode() {
  return hasExtendedDisplay() ? 'speaker' : 'plain';
}

function openPresentDialog(deck) {
  pendingDeck = deck;
  els.presentDeckName.textContent = deck.title;
  const extended = hasExtendedDisplay();
  els.displayStatus.textContent = extended
    ? 'Second display detected — speaker view keeps notes on this laptop.'
    : 'One display detected — presentation runs without notes. Rehearse is available for practice.';

  for (const button of els.presentDialog.querySelectorAll('[data-present-mode]')) {
    const mode = button.dataset.presentMode;
    const tag = button.querySelector('[data-mode-tag]');
    const recommended = (extended && mode === 'speaker') || (!extended && mode === 'plain');
    button.dataset.recommended = recommended ? 'true' : 'false';
    if (mode === 'speaker') {
      button.disabled = !extended;
      tag.textContent = extended ? 'Recommended' : 'Needs second display';
    } else if (mode === 'plain') {
      tag.textContent = extended ? 'No notes' : 'Recommended';
    } else {
      tag.textContent = 'Practice';
    }
  }

  els.presentDialog.showModal();
}

function startPresentation(deck, mode) {
  els.presentDialog.close();
  els.toastRegion.replaceChildren();
  let chosen = mode;
  if (chosen === 'speaker' && !hasExtendedDisplay()) {
    chosen = 'plain';
    toast('Speaker view needs a second display — presenting without notes.');
  }
  presenter
    .present(deck, {
      mode: chosen,
      notes: Array.isArray(deck.speakerNotes) ? deck.speakerNotes : [],
    })
    .catch(() => toast('Presenter failed to load'));
}

function openDeck(deck) {
  startPresentation(deck, defaultPresentMode());
}

async function openTour() {
  try {
    const response = await fetch('/decks/about-presenter.html', { cache: 'no-store' });
    if (!response.ok) throw new Error('Tour fetch failed');
    const html = await response.text();
    const now = Date.now();
    openDeck({ id: 'about-presenter', title: 'About Presenter', html, createdAt: now, updatedAt: now });
  } catch {
    toast('Tour failed to load');
  }
}

function buildCard(deck, index) {
  const article = document.createElement('article');
  article.className = 'deck-card';
  article.dataset.deckId = deck.id;
  article.innerHTML = `
    <div class="deck-thumb" aria-hidden="true">
      <span class="frame-no"></span>
      <span class="thumb-play"></span>
    </div>
    <div class="deck-info">
      <h2 class="deck-title"></h2>
      <p class="deck-meta">
        <span class="deck-date"></span>
        <span class="meta-dot">·</span>
        <span class="deck-size"></span>
      </p>
    </div>
    <div class="deck-actions">
      <button type="button" class="deck-open" data-action="open">Open</button>
      <button type="button" class="deck-modes" data-action="modes" aria-label="Presentation options"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4.5 6 8.5l4-4"/></svg></button>
      <button type="button" class="deck-notes-btn" data-action="notes">Notes</button>
      <button type="button" class="card-delete" data-action="delete">Delete</button>
    </div>
  `;

  article.querySelector('.frame-no').textContent = `FRAME ${String(index + 1).padStart(2, '0')}`;
  const titleEl = article.querySelector('.deck-title');
  titleEl.textContent = deck.title;
  titleEl.title = deck.title;
  article.querySelector('.deck-date').textContent = formatDate(deck.updatedAt);
  article.querySelector('.deck-size').textContent = formatBytes(new Blob([deck.html]).size);

  const openBtn = article.querySelector('[data-action="open"]');
  openBtn.setAttribute('aria-label', `Present ${deck.title}`);
  openBtn.textContent = 'Present';

  const modesBtn = article.querySelector('[data-action="modes"]');
  modesBtn.setAttribute('aria-label', `Presentation options for ${deck.title}`);
  modesBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    openPresentDialog(deck);
  });

  const notesBtn = article.querySelector('.deck-notes-btn[data-action="notes"]');
  notesBtn.setAttribute('aria-label', `Edit speaker notes for ${deck.title}`);
  notesBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    openNotesEditor(deck);
  });

  const deleteBtn = article.querySelector('[data-action="delete"]');
  deleteBtn.setAttribute('aria-label', `Delete ${deck.title}`);
  deleteBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    deleteWithConfirm(deck);
  });

  article.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="delete"]')) return;
    openDeck(deck);
  });

  return article;
}
function render() {
  for (const card of els.grid.querySelectorAll('.deck-card')) card.remove();
  els.emptyState.hidden = decks.length > 0;
  els.deckCount.textContent = `${decks.length} ${decks.length === 1 ? 'deck' : 'decks'}`;
  const fragment = document.createDocumentFragment();
  decks.forEach((deck, index) => fragment.append(buildCard(deck, index)));
  els.grid.append(fragment);
  updateStorageBanner();
}

async function refresh() {
  decks = await listDecks();
  render();
}

async function deleteWithConfirm(deck) {
  if (!window.confirm(`Delete "${deck.title}"? This cannot be undone.`)) return;
  await deleteDeck(deck.id);
  await refresh();
  toast('Deck deleted');
}

function openImportDialog() {
  titleTouched = false;
  els.form.reset();
  els.error.textContent = '';
  els.dialog.showModal();
  els.html.focus();
}

async function loadDeckFile(file) {
  const text = await file.text();
  els.html.value = text;
  if (!titleTouched) els.title.value = extractTitle(text);
  els.error.textContent = '';
}

function todayStamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

async function handleExport() {
  const json = await exportDecks();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `html-presenter-decks-${todayStamp()}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('Library exported');
}

async function handleImportFile(file) {
  const text = await file.text();
  const { imported, skipped } = await importDecks(text);
  await refresh();
  toast(`Imported ${imported}, skipped ${skipped}`);
}

function wireDrop(target, onDrop) {
  target.addEventListener('dragover', (event) => {
    event.preventDefault();
    els.dropzone.classList.add('is-dragover');
  });
  target.addEventListener('dragleave', (event) => {
    if (!target.contains(event.relatedTarget)) els.dropzone.classList.remove('is-dragover');
  });
  target.addEventListener('drop', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    els.dropzone.classList.remove('is-dragover');
    const file = event.dataTransfer?.files?.[0];
    if (file) await onDrop(file);
  });
}

function hasFiles(event) {
  return Boolean(event.dataTransfer && Array.from(event.dataTransfer.types || []).includes('Files'));
}

function canAcceptDrop() {
  return !els.libraryView.hidden && !document.querySelector('dialog[open]');
}

function hideDropOverlay() {
  els.dropOverlay.hidden = true;
}

async function handleDroppedFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.json')) {
    await handleImportFile(file);
    return;
  }
  if (!/\.html?$/.test(name) && file.type !== 'text/html') {
    toast('Drop an .html deck or a .json backup');
    return;
  }
  openImportDialog();
  await loadDeckFile(file);
}

function setupGlobalDrop() {
  document.addEventListener('dragover', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    if (canAcceptDrop()) els.dropOverlay.hidden = false;
  });

  document.addEventListener('dragleave', (event) => {
    if (hasFiles(event) && !event.relatedTarget) hideDropOverlay();
  });

  document.addEventListener('drop', async (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    hideDropOverlay();
    if (!canAcceptDrop()) return;
    const file = event.dataTransfer.files?.[0];
    if (file) await handleDroppedFile(file);
  });

  document.addEventListener('dragend', hideDropOverlay);
  window.addEventListener('blur', hideDropOverlay);
}

// ---------------------------------------------------------------------------
// LLM prompt builder dialog
// ---------------------------------------------------------------------------

function escapePromptCellText(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function readPromptSlideCount() {
  const raw = Math.floor(Number(els.promptSlideCount?.value));
  if (!Number.isFinite(raw)) return 6;
  return Math.min(30, Math.max(1, raw));
}

function resizePromptRows(rows, count) {
  const next = [];
  for (let i = 0; i < count; i++) {
    next.push({ content: rows[i]?.content ?? '', notes: rows[i]?.notes ?? '' });
  }
  return next;
}

function renderPromptRows() {
  if (!els.promptSlides) return;
  promptRows = resizePromptRows(promptRows, readPromptSlideCount());
  els.promptSlides.innerHTML = promptRows
    .map(
      (row, index) =>
        `<div class="prompt-slide" data-slide-index="${index}"><span class="prompt-slide-no">Slide ${index + 1}</span><label class="field"><span class="field-label">Content outline</span><textarea data-prompt-content rows="2" placeholder="Optional.">${escapePromptCellText(row.content)}</textarea></label><label class="field"><span class="field-label">Speaker note outline</span><textarea data-prompt-note rows="2" placeholder="Optional. The AI fills gaps.">${escapePromptCellText(row.notes)}</textarea></label></div>`
    )
    .join('');
  updatePromptOutput();
}

function updatePromptOutput() {
  if (!els.promptOutput) return;
  els.promptOutput.value = buildDeckPrompt({
    brief: els.promptBrief?.value ?? '',
    slideCount: readPromptSlideCount(),
    slides: promptRows,
    noteGuidance: els.promptNoteGuidance?.value ?? '',
    density: els.promptDensity?.value ?? 'speaker',
  });
}

function handlePromptSlideInput(event) {
  const field = event.target;
  if (!(field instanceof HTMLTextAreaElement)) return;
  const row = field.closest('.prompt-slide[data-slide-index]');
  if (!row) return;
  const index = Number(row.dataset.slideIndex);
  if (!Number.isInteger(index)) return;
  if (!promptRows[index]) promptRows[index] = { content: '', notes: '' };
  if (field.hasAttribute('data-prompt-content')) promptRows[index].content = field.value;
  else if (field.hasAttribute('data-prompt-note')) promptRows[index].notes = field.value;
  updatePromptOutput();
}

function openPromptDialog() {
  if (!els.promptDialog) return;
  renderPromptRows();
  els.promptDialog.showModal();
  els.promptBrief?.focus();
}

function setPromptCopyStatus(text) {
  if (!els.promptCopyStatus) return;
  els.promptCopyStatus.textContent = text;
  window.clearTimeout(promptCopyTimer);
  if (text) {
    promptCopyTimer = window.setTimeout(() => {
      if (els.promptCopyStatus) els.promptCopyStatus.textContent = '';
    }, 2000);
  }
}

async function copyPromptOutput() {
  const output = els.promptOutput;
  const text = output?.value ?? '';
  if (!text || !output) return;
  try {
    await navigator.clipboard.writeText(text);
    setPromptCopyStatus('Copied');
    return;
  } catch {
    // Clipboard API unavailable or denied — fall back to select + execCommand.
  }
  try {
    output.focus();
    output.select();
    if (!document.execCommand('copy')) throw new Error('copy rejected');
    output.setSelectionRange(text.length, text.length);
    setPromptCopyStatus('Copied');
  } catch {
    setPromptCopyStatus('Select and copy');
  }
}

// ---------------------------------------------------------------------------
// Library speaker-notes editor
// ---------------------------------------------------------------------------

function normalizeNoteText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

// Static inspection only: DOMParser never runs deck scripts, so API-generated
// decks may report a single static slide. The notes editor still lets the
// viewer add per-slide library notes on top.
function extractSlideNote(slideEl) {
  const dedicated = slideEl.querySelector('[data-speaker-notes]') ?? slideEl.querySelector('.speaker-notes');
  if (dedicated) return normalizeNoteText(dedicated.textContent);
  if (slideEl.hasAttribute('data-notes')) return normalizeNoteText(slideEl.getAttribute('data-notes'));
  const legacy =
    slideEl.querySelector('aside.notes') ??
    slideEl.querySelector('.notes') ??
    slideEl.querySelector('.slide-notes');
  if (legacy) return normalizeNoteText(legacy.textContent);
  const dataEl = slideEl.querySelector('[data-notes]');
  if (dataEl) {
    return normalizeNoteText(
      dataEl.hasAttribute('data-notes') ? dataEl.getAttribute('data-notes') : dataEl.textContent
    );
  }
  return '';
}

function extractEmbeddedNotes(html) {
  let doc;
  try {
    doc = new DOMParser().parseFromString(html || '', 'text/html');
  } catch {
    return [];
  }
  let slideEls = doc.querySelectorAll('.slide');
  if (slideEls.length < 2) slideEls = doc.querySelectorAll('section');
  if (slideEls.length < 2) return doc.body ? [extractSlideNote(doc.body)] : [];
  return Array.from(slideEls, (el) => extractSlideNote(el));
}

function noteValueAt(overrides, embedded, index) {
  if (index < overrides.length) return overrides[index] ?? '';
  const value = embedded[index];
  return typeof value === 'string' ? value : '';
}

function renderNotesRows() {
  if (!els.notesEditorList) return 0;
  const deck = notesEditorState.deck;
  const overrides = Array.isArray(deck?.speakerNotes) ? deck.speakerNotes : [];
  const total = Math.max(notesEditorState.embedded.length, overrides.length, 1);
  els.notesEditorList.innerHTML = Array.from(
    { length: total },
    (_, index) =>
      `<label class="notes-editor-row"><span class="notes-editor-slide">Slide ${index + 1}</span><textarea data-notes-index="${index}" rows="3" placeholder="Optional. Leave blank for no note."></textarea></label>`
  ).join('');
  setNotesValues(overrides);
  return total;
}

function setNotesValues(values) {
  if (!els.notesEditorList) return;
  for (const field of els.notesEditorList.querySelectorAll('textarea[data-notes-index]')) {
    const index = Number(field.dataset.notesIndex);
    field.value = noteValueAt(values, notesEditorState.embedded, Number.isInteger(index) ? index : 0);
  }
}

function setNotesStatus(text) {
  if (els.notesEditorStatus && notesEditorState.open) els.notesEditorStatus.textContent = text;
}

async function saveNotesNow() {
  window.clearTimeout(notesEditorState.saveTimer);
  notesEditorState.saveTimer = null;
  const deck = notesEditorState.deck;
  const list = els.notesEditorList;
  if (!deck || !list) return;

  const fields = Array.from(list.querySelectorAll('textarea[data-notes-index]'));
  if (!fields.length) return;
  const notes = fields.map((field) => field.value);

  deck.speakerNotes = notes;
  deck.updatedAt = Date.now();
  setNotesStatus('Saving…');
  try {
    await putDeck(deck);
    const cached = decks.find((entry) => entry.id === deck.id);
    if (cached && cached !== deck) {
      cached.speakerNotes = notes;
      cached.updatedAt = deck.updatedAt;
    }
    notesEditorState.dirty = false;
    setNotesStatus('Saved');
  } catch {
    toast('Could not save notes');
  }
}

function scheduleNotesSave() {
  if (!notesEditorState.deck) return;
  notesEditorState.dirty = true;
  setNotesStatus('Saving…');
  window.clearTimeout(notesEditorState.saveTimer);
  notesEditorState.saveTimer = window.setTimeout(() => {
    void saveNotesNow();
  }, 500);
}

function useDeckNotes() {
  const deck = notesEditorState.deck;
  if (!deck) return;
  notesEditorState.embedded = extractEmbeddedNotes(deck.html);
  setNotesValues(notesEditorState.embedded);
  notesEditorState.dirty = true;
  void saveNotesNow();
}

function openNotesEditor(deck) {
  if (!els.notesEditorDialog) return;
  notesEditorState.open = true;
  notesEditorState.deck = deck;
  notesEditorState.embedded = extractEmbeddedNotes(deck.html);
  notesEditorState.dirty = false;
  renderNotesRows();
  setNotesStatus('');
  els.notesEditorDeck.textContent = deck.title;
  els.notesEditorDialog.showModal();
}

async function closeNotesEditor() {
  if (!els.notesEditorDialog) return;
  window.clearTimeout(notesEditorState.saveTimer);
  notesEditorState.saveTimer = null;
  if (notesEditorState.dirty) await saveNotesNow();
  notesEditorState.open = false;
  els.notesEditorDialog.close();
  // Refresh after the dialog closes so card dates reflect the autosave.
  await refresh();
}

function wireEvents() {
  els.addBtn.addEventListener('click', openImportDialog);
  els.frontAddBtn.addEventListener('click', openImportDialog);
  els.cancelBtn.addEventListener('click', () => els.dialog.close());
  els.tourBtn.addEventListener('click', openTour);
  els.guideBtn.addEventListener('click', () => els.guideDialog.showModal());
  els.guideCloseBtn.addEventListener('click', () => els.guideDialog.close());
  els.presentCloseBtn.addEventListener('click', () => els.presentDialog.close());
  els.presentDialog.addEventListener('click', (event) => {
    const modeBtn = event.target.closest('[data-present-mode]');
    if (!modeBtn || modeBtn.disabled || !pendingDeck) return;
    startPresentation(pendingDeck, modeBtn.dataset.presentMode);
  });

  els.html.addEventListener('input', () => {
    if (!titleTouched) els.title.value = extractTitle(els.html.value);
  });
  els.title.addEventListener('input', () => {
    titleTouched = true;
  });

  els.deckFile.addEventListener('change', async () => {
    const file = els.deckFile.files?.[0];
    if (file) await loadDeckFile(file);
    els.deckFile.value = '';
  });

  wireDrop(els.form, loadDeckFile);
  setupGlobalDrop();

  els.form.addEventListener('submit', async (event) => {
    event.preventDefault();
    els.error.textContent = '';

    const html = els.html.value;
    if (!html.trim()) {
      els.error.textContent = 'Paste HTML first';
      els.html.focus();
      return;
    }
    if (isOverSizeLimit(html)) {
      const bytes = new TextEncoder().encode(html).length;
      els.error.textContent = `Deck is ${bytes} bytes — over the 25 MiB limit.`;
      return;
    }

    const now = Date.now();
    const title = (els.title.value.trim() || extractTitle(html) || 'Untitled deck').slice(0, 120);
    const deck = {
      id: crypto.randomUUID(),
      title,
      html,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await putDeck(deck);
    } catch {
      toast('Could not save — storage full');
      return;
    }

    await refresh();
    els.dialog.close();
    toast('Deck saved');
  });

  els.importBtn.addEventListener('click', () => els.importFile.click());
  els.importFile.addEventListener('change', async () => {
    const file = els.importFile.files?.[0];
    if (file) await handleImportFile(file);
    els.importFile.value = '';
  });

  els.exportBtn.addEventListener('click', handleExport);

  // --- LLM prompt builder dialog ---
  els.promptBtn?.addEventListener('click', openPromptDialog);
  els.guidePromptBtn?.addEventListener('click', openPromptDialog);
  els.promptCloseBtn?.addEventListener('click', () => els.promptDialog?.close());
  els.promptBrief?.addEventListener('input', updatePromptOutput);
  els.promptNoteGuidance?.addEventListener('input', updatePromptOutput);
  els.promptDensity?.addEventListener('change', updatePromptOutput);
  els.promptSlideCount?.addEventListener('input', renderPromptRows);
  els.promptSlides?.addEventListener('input', handlePromptSlideInput);
  els.promptCopyBtn?.addEventListener('click', () => {
    void copyPromptOutput();
  });

  // --- Library speaker-notes editor dialog ---
  els.notesEditorList?.addEventListener('input', scheduleNotesSave);
  els.notesEditorReset?.addEventListener('click', useDeckNotes);
  els.notesEditorCloseBtn?.addEventListener('click', () => {
    void closeNotesEditor();
  });
  els.notesEditorDone?.addEventListener('click', () => {
    void closeNotesEditor();
  });
  els.notesEditorDialog?.addEventListener('close', () => {
    // Esc / programmatic close: flush a pending autosave, then refresh so the
    // card date reflects it. Button paths already save and refresh first.
    const pending = notesEditorState.dirty;
    notesEditorState.open = false;
    if (pending) {
      void saveNotesNow().then(() => refresh());
    }
  });

  const installBtn = $('#install-btn');
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    if (installBtn) installBtn.hidden = false;
  });
  installBtn?.addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    installBtn.hidden = true;
  });
  window.addEventListener('appinstalled', () => {
    if (installBtn) installBtn.hidden = true;
  });
}

async function init() {
  wireEvents();
  await refresh();
  window.__appReady = true;
}

if ('serviceWorker' in navigator && !navigator.webdriver) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

init();


