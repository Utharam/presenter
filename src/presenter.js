import { injectBridge, notesKey } from './core.js';

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown', 'PageDown', ' ']);
const PREV_KEYS = new Set(['ArrowLeft', 'ArrowUp', 'PageUp']);
const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function isEditable(target) {
  return target instanceof Element && target.closest('input, textarea, [contenteditable]') !== null;
}

export class Presenter {
  constructor({
    viewport,
    frame,
    counter,
    progress,
    notesPanel,
    notesTextarea,
    notesLabel,
    noteBadge,
  }) {
    this.viewport = viewport;
    this.frame = frame;
    this.counter = counter;
    this.progress = progress;
    this.progressFill = progress.querySelector('#progress-fill');
    this.notesPanel = notesPanel;
    this.notesTextarea = notesTextarea;
    this.notesLabel = notesLabel;
    this.noteBadge = noteBadge;

    this.presentView = document.getElementById('present-view');
    this.libraryView = document.getElementById('library-view');
    this.topbar = document.querySelector('.topbar');
    this.shortcutsDialog = document.getElementById('shortcuts-dialog');
    this.shortcutsBtn = document.getElementById('shortcuts-btn');
    this.exitBtn = document.getElementById('exit-present-btn');
    this.zoomOutBtn = document.getElementById('zoom-out-btn');
    this.zoomInBtn = document.getElementById('zoom-in-btn');
    this.zoomLevel = document.getElementById('zoom-level');
    this.panOverlay = document.getElementById('pan-overlay');

    this.active = false;
    this.deck = null;
    this.index = 0;
    this.total = 0;
    this.strategy = 'single';
    this.blobUrl = null;
    this.bridgePromise = null;
    this.fullscreen = false;
    this.idleTimer = null;
    this.idleDelay = 2000;
    this.zoom = 100;
    this.panX = 0;
    this.panY = 0;
    this.panKey = false;
    this.panning = false;
    this.panStart = null;

    this.exitHandler = null;
    this.linkHandler = null;
    this.errorHandler = null;

    this.handleMessage = this.handleMessage.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handlePanKey = this.handlePanKey.bind(this);
    this.handlePanStart = this.handlePanStart.bind(this);
    this.handlePanMove = this.handlePanMove.bind(this);
    this.handlePanEnd = this.handlePanEnd.bind(this);
    this.handleFullscreenChange = () => {
      this.fullscreen = document.fullscreenElement === this.viewport;
    };

    window.addEventListener('message', this.handleMessage);
    document.addEventListener('keydown', this.handleKeydown);
    window.addEventListener('mousemove', this.handleMouseMove, { passive: true });
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
    this.exitBtn?.addEventListener('click', () => this.exit());
    this.shortcutsBtn?.addEventListener('click', () => this.toggleShortcuts());
    this.zoomOutBtn?.addEventListener('click', () => this.setZoom(this.zoom - 10));
    this.zoomInBtn?.addEventListener('click', () => this.setZoom(this.zoom + 10));
    this.zoomLevel?.addEventListener('click', () => this.setZoom(100));
    document.addEventListener('keydown', this.handlePanKey);
    document.addEventListener('keyup', this.handlePanKey);
    this.panOverlay?.addEventListener('pointerdown', this.handlePanStart);
    this.panOverlay?.addEventListener('pointermove', this.handlePanMove);
    this.panOverlay?.addEventListener('pointerup', this.handlePanEnd);
    this.panOverlay?.addEventListener('pointercancel', this.handlePanEnd);
    this.notesTextarea.addEventListener('input', () => {
      this.saveNotes(this.notesTextarea.value);
    });
  }

  get state() {
    return { index: this.index, total: this.total, strategy: this.strategy };
  }

  onExit(cb) {
    this.exitHandler = cb;
  }

  onLink(cb) {
    this.linkHandler = cb;
  }

  onError(cb) {
    this.errorHandler = cb;
  }

  async present(deck) {
    if (this.blobUrl) {
      const previous = this.blobUrl;
      this.blobUrl = null;
      if (this.frame.getAttribute('src') === previous) this.frame.src = 'about:blank';
      URL.revokeObjectURL(previous);
    }

    let bridgeSource;
    try {
      bridgeSource = await this.loadBridge();
    } catch {
      this.errorHandler?.('Presenter failed to load');
      return;
    }

    const html = injectBridge(deck.html, bridgeSource);
    const blob = new Blob([html], { type: 'text/html' });
    this.blobUrl = URL.createObjectURL(blob);

    this.deck = deck;
    this.index = 0;
    this.total = 0;
    this.strategy = 'single';
    this.active = true;
    this.zoom = 100;
    this.panX = 0;
    this.panY = 0;
    this.applyViewTransform();
    this.updateZoom();
    this.restartCursorIdle();

    this.counter.hidden = false;
    this.progress.hidden = false;
    this.counter.textContent = '1 / 1';
    this.progressFill.style.width = '0%';
    this.noteBadge.hidden = true;
    this.notesPanel.hidden = true;
    this.notesPanel.setAttribute('aria-hidden', 'true');
    this.notesLabel.textContent = 'Slide 1';
    this.notesTextarea.value = '';

    this.frame.src = this.blobUrl;
    this.presentView.hidden = false;
    this.libraryView.hidden = true;
    // The topbar sits outside #library-view; keep Tab from reaching the Add
    // deck / Import / Export buttons hidden behind the presentation overlay.
    if (this.topbar) this.topbar.inert = true;
    this.viewport.focus();
  }

  loadBridge() {
    if (!this.bridgePromise) {
      this.bridgePromise = fetch('/src/bridge.js').then((response) => {
        if (!response.ok) throw new Error('Bridge fetch failed');
        return response.text();
      });
      this.bridgePromise.catch(() => {
        this.bridgePromise = null;
      });
    }
    return this.bridgePromise;
  }

  handleMessage(event) {
    if (!this.active) return;
    if (event.source !== this.frame.contentWindow) return;
    const data = event.data;
    if (!data || typeof data.type !== 'string' || !data.type.startsWith('presenter:')) return;

    switch (data.type) {
      case 'presenter:ready':
        this.total = Number.isFinite(data.total) ? data.total : 1;
        this.strategy = data.strategy || 'single';
        this.index = 0;
        this.syncChrome();
        break;
      case 'presenter:state':
        if (!this.notesPanel.hidden) this.saveNotes(this.notesTextarea.value);
        this.index = Number.isFinite(data.index) ? data.index : 0;
        if (Number.isFinite(data.total)) this.total = data.total;
        this.syncChrome();
        break;
      case 'presenter:note-toggle':
        this.toggleNotes();
        break;
      case 'presenter:fullscreen':
        this.toggleFullscreen();
        break;
      case 'presenter:shortcuts':
        this.toggleShortcuts();
        break;
      case 'presenter:exit':
        this.handleEscape();
        break;
      case 'presenter:link':
        this.openLink(data.href);
        break;
    }
  }

  syncChrome() {
    const single = this.strategy === 'single';
    this.counter.hidden = single;
    this.progress.hidden = single;
    if (single) this.noteBadge.hidden = true;

    this.counter.textContent = `${this.index + 1} / ${Math.max(this.total, 1)}`;
    const percent = this.total > 0 ? ((this.index + 1) / this.total) * 100 : 0;
    this.progressFill.style.width = `${Math.min(100, percent).toFixed(2)}%`;
    this.syncNotes();
  }

  readNote() {
    if (!this.deck) return '';
    return sessionStorage.getItem(notesKey(this.deck.id, this.index)) ?? '';
  }

  updateNoteBadge() {
    const hasNote = Boolean(this.deck) && this.strategy !== 'single' && this.readNote().trim() !== '';
    this.noteBadge.hidden = !hasNote;
  }

  syncNotes() {
    if (!this.deck) return;
    if (!this.notesPanel.hidden) {
      this.notesLabel.textContent = `Slide ${this.index + 1}`;
      this.notesTextarea.value = this.readNote();
    }
    this.updateNoteBadge();
  }

  send(cmd, index) {
    const target = this.frame.contentWindow;
    if (!target) return;
    const message = { type: 'presenter:cmd', cmd };
    if (index !== undefined) message.index = index;
    target.postMessage(message, '*');
  }

  setZoom(value) {
    const next = Math.max(50, Math.min(200, Math.round(Number(value) || 100)));
    this.zoom = next;
    if (next === 100) {
      this.panX = 0;
      this.panY = 0;
    } else {
      this.clampPan();
    }
    this.applyViewTransform();
    this.updateZoom();
    this.updatePanOverlay();
  }

  applyViewTransform() {
    if (!this.frame) return;
    if (this.zoom === 100 && this.panX === 0 && this.panY === 0) {
      this.frame.style.transform = 'none';
      return;
    }
    this.frame.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom / 100})`;
  }

  clampPan() {
    if (this.zoom <= 100) {
      this.panX = 0;
      this.panY = 0;
      return;
    }
    const maxX = ((this.zoom / 100) - 1) * this.viewport.clientWidth / 2;
    const maxY = ((this.zoom / 100) - 1) * this.viewport.clientHeight / 2;
    this.panX = Math.max(-maxX, Math.min(maxX, this.panX));
    this.panY = Math.max(-maxY, Math.min(maxY, this.panY));
  }

  updateZoom() {
    if (!this.zoomLevel) return;
    this.zoomLevel.textContent = `${this.zoom}%`;
    this.zoomLevel.setAttribute('aria-label', `Zoom ${this.zoom}%. Reset to 100%`);
  }

  updatePanOverlay() {
    if (!this.panOverlay) return;
    const active = this.active && this.panKey && this.zoom > 100;
    this.panOverlay.hidden = !active;
    if (!active) {
      this.panning = false;
      this.panStart = null;
      this.panOverlay.classList.remove('is-panning');
    }
  }

  handlePanKey(event) {
    if (!this.active) return;
    if (event.key !== 'Control' && event.key !== 'Meta') return;
    this.panKey = event.type === 'keydown';
    if (!this.panKey) {
      this.panning = false;
      this.panStart = null;
      this.panOverlay?.classList.remove('is-panning');
    }
    this.updatePanOverlay();
  }

  handlePanStart(event) {
    if (!this.active || !this.panKey || this.zoom <= 100) return;
    event.preventDefault();
    this.panning = true;
    this.panStart = { x: event.clientX, y: event.clientY, panX: this.panX, panY: this.panY };
    this.panOverlay.classList.add('is-panning');
    this.panOverlay.setPointerCapture?.(event.pointerId);
  }

  handlePanMove(event) {
    if (!this.panning || !this.panStart) return;
    event.preventDefault();
    this.panX = this.panStart.panX + (event.clientX - this.panStart.x);
    this.panY = this.panStart.panY + (event.clientY - this.panStart.y);
    this.clampPan();
    this.applyViewTransform();
  }

  handlePanEnd() {
    if (!this.panning) return;
    this.panning = false;
    this.panStart = null;
    this.panOverlay?.classList.remove('is-panning');
  }

  next() {
    this.send('next');
  }

  prev() {
    this.send('prev');
  }

  first() {
    this.send('first');
  }

  last() {
    this.send('last');
  }

  goTo(index) {
    if (Number.isInteger(index)) this.send('goto', index);
  }

  async toggleFullscreen() {
    if (!this.active) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await this.viewport.requestFullscreen();
    } catch {
      this.fullscreen = document.fullscreenElement === this.viewport;
      return;
    }
    this.fullscreen = document.fullscreenElement === this.viewport;
  }

  toggleNotes() {
    if (!this.active || !this.deck) return;
    if (!this.notesPanel.hidden) {
      this.closeNotes();
      return;
    }
    this.notesLabel.textContent = `Slide ${this.index + 1}`;
    this.notesTextarea.value = this.readNote();
    this.notesPanel.hidden = false;
    this.notesPanel.setAttribute('aria-hidden', 'false');
    this.notesTextarea.focus();
  }

  closeNotes() {
    if (this.notesPanel.hidden) return;
    this.saveNotes(this.notesTextarea.value);
    this.notesPanel.hidden = true;
    this.notesPanel.setAttribute('aria-hidden', 'true');
    this.viewport.focus();
  }

  saveNotes(text) {
    if (!this.deck) return;
    const value = typeof text === 'string' ? text : '';
    const key = notesKey(this.deck.id, this.index);
    if (value.trim() === '') sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
    this.updateNoteBadge();
  }

  handleEscape() {
    // Peel one surface per press: notes, then an open shortcuts dialog, then
    // the presentation itself (which exits fullscreen first).
    if (!this.notesPanel.hidden) {
      this.closeNotes();
      return;
    }
    if (this.closeOpenDialog()) return;
    this.exit();
  }

  closeOpenDialog() {
    const open = document.querySelector('dialog[open]');
    if (!open) return false;
    open.close();
    return true;
  }

  handleMouseMove() {
    if (!this.active) return;
    this.restartCursorIdle();
  }

  restartCursorIdle() {
    document.body.classList.remove('cursor-idle');
    if (this.idleTimer !== null) window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => {
      this.idleTimer = null;
      if (this.active) document.body.classList.add('cursor-idle');
    }, this.idleDelay);
  }

  stopCursorIdle() {
    if (this.idleTimer !== null) {
      window.clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    document.body.classList.remove('cursor-idle');
  }

  toggleShortcuts() {
    if (!this.shortcutsDialog) return;
    if (this.shortcutsDialog.open) this.shortcutsDialog.close();
    else this.shortcutsDialog.showModal();
  }

  handleKeydown(event) {
    if (!this.active) return;
    const openDialog = document.querySelector('dialog[open]');
    if (openDialog) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.handleEscape();
      } else if (event.key === '?') {
        event.preventDefault();
        openDialog.close();
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.handleEscape();
      return;
    }

    if (isEditable(event.target)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.key === '?') {
      event.preventDefault();
      this.toggleShortcuts();
      return;
    }

    if (event.key === 'f' || event.key === 'F') {
      event.preventDefault();
      this.toggleFullscreen();
      return;
    }

    if (event.key === 'n' || event.key === 'N') {
      event.preventDefault();
      this.toggleNotes();
      return;
    }

    if (this.strategy === 'single') return;

    if (NEXT_KEYS.has(event.key)) {
      event.preventDefault();
      this.next();
    } else if (PREV_KEYS.has(event.key)) {
      event.preventDefault();
      this.prev();
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.first();
    } else if (event.key === 'End') {
      event.preventDefault();
      this.last();
    }
  }

  openLink(href) {
    if (!href) return;
    // A deck is untrusted and can post presenter:link itself. Only open
    // web/mail schemes: `blob:` would re-open this deck unsandboxed at the
    // app origin (and `javascript:`/`data:` are unsafe in a new tab).
    let url = null;
    try {
      url = new URL(href);
    } catch {
      url = null;
    }
    if (!url || !SAFE_LINK_PROTOCOLS.has(url.protocol)) {
      this.linkHandler?.(href);
      return;
    }
    let popup = null;
    try {
      popup = window.open(url.href, '_blank', 'noopener');
    } catch {
      popup = null;
    }
    if (!popup) this.linkHandler?.(href);
  }

  exit() {
    if (!this.active) return;
    this.stopCursorIdle();
    if (!this.notesPanel.hidden) {
      this.saveNotes(this.notesTextarea.value);
      this.notesPanel.hidden = true;
      this.notesPanel.setAttribute('aria-hidden', 'true');
    }
    this.noteBadge.hidden = true;
    this.active = false;

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    const url = this.blobUrl;
    this.blobUrl = null;
    this.frame.src = 'about:blank';
    if (url) URL.revokeObjectURL(url);

    this.presentView.hidden = true;
    this.notesPanel.hidden = true;
    if (this.topbar) this.topbar.inert = false;
    this.deck = null;
    this.index = 0;
    this.total = 0;
    this.strategy = 'single';
    this.fullscreen = false;
    this.zoom = 100;
    this.panX = 0;
    this.panY = 0;
    this.panKey = false;
    this.panning = false;
    this.applyViewTransform();
    this.updatePanOverlay();
    this.updateZoom();
    this.counter.hidden = false;
    this.progress.hidden = false;
    this.counter.textContent = '1 / 1';
    this.progressFill.style.width = '0%';

    this.exitHandler?.();
  }
}
