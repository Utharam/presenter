import { extractTitle, isOverSizeLimit } from './core.js';
import {
  listDecks,
  putDeck,
  deleteDeck,
  exportDecks,
  importDecks,
  isPersistent,
} from './library.js';
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
  form: $('#import-form'),
  dropzone: $('#deck-dropzone'),
  html: $('#deck-html'),
  title: $('#deck-title'),
  deckFile: $('#deck-file'),
  error: $('#import-error'),
  cancelBtn: $('#cancel-import-btn'),
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
presenter.onLink((href) => toast(`Could not open link — ${href}`));

function openDeck(deck) {
  els.toastRegion.replaceChildren();
  presenter.present(deck).catch(() => toast('Presenter failed to load'));
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

function wireEvents() {
  els.addBtn.addEventListener('click', openImportDialog);
  els.frontAddBtn.addEventListener('click', openImportDialog);
  els.cancelBtn.addEventListener('click', () => els.dialog.close());
  els.tourBtn.addEventListener('click', openTour);
  els.guideBtn.addEventListener('click', () => els.guideDialog.showModal());
  els.guideCloseBtn.addEventListener('click', () => els.guideDialog.close());

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


