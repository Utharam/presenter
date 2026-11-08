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
    this.notesHint = document.getElementById('notes-hint');
    this.deckNotesWrap = document.getElementById('deck-notes-wrap');
    this.deckNotesEl = document.getElementById('deck-notes');
    this.speakerBtn = document.getElementById('speaker-btn');
    // Rehearse-console extras; guarded because the HTML may not carry them.
    this.nextNotesWrap = document.getElementById('next-notes-wrap');
    this.nextNotesEl = document.getElementById('next-notes');
    this.notesTimer = document.getElementById('notes-timer');
    this.notesFirstBtn = document.getElementById('notes-first');
    this.notesPrevBtn = document.getElementById('notes-prev');
    this.notesNextBtn = document.getElementById('notes-next');
    this.notesLastBtn = document.getElementById('notes-last');
    this.notesTimerToggle = document.getElementById('notes-timer-toggle');
    this.notesTimerReset = document.getElementById('notes-timer-reset');

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

    this.mode = 'plain';
    this.deckNotes = [];
    this.speakerNotes = [];
    this.presentStartedAt = null;
    this.elapsedElapsed = 0;
    this.elapsedPaused = false;
    this.elapsedTimer = null;
    this.openNotesOnReady = false;
    this.speakerWindow = null;
    this.speakerChannel =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel('presenter-speaker')
        : null;
    if (this.speakerChannel) {
      this.speakerChannel.onmessage = (event) => this.handleSpeakerMessage(event.data);
    }

    this.exitHandler = null;
    this.linkHandler = null;
    this.errorHandler = null;
    this.noticeHandler = null;

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
    this.speakerBtn?.addEventListener('click', () => this.focusSpeaker());
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
    this.notesFirstBtn?.addEventListener('click', () => this.first());
    this.notesPrevBtn?.addEventListener('click', () => this.prev());
    this.notesNextBtn?.addEventListener('click', () => this.next());
    this.notesLastBtn?.addEventListener('click', () => this.last());
    this.notesTimerToggle?.addEventListener('click', () => this.toggleElapsedTimer());
    this.notesTimerReset?.addEventListener('click', () => this.resetElapsedTimer());
    window.addEventListener('blur', () => {
      this.panKey = false;
      this.panning = false;
      this.panStart = null;
      this.updatePanOverlay();
    });
    window.addEventListener('beforeunload', () => this.closeSpeakerWindow());
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

  onNotice(cb) {
    this.noticeHandler = cb;
  }

  openSpeakerWindow(announceBlocked = true) {
    if (!this.speakerChannel) {
      if (announceBlocked) this.noticeHandler?.('Speaker view is not supported in this browser.');
      return false;
    }
    if (this.speakerWindow && !this.speakerWindow.closed) {
      this.speakerWindow.focus();
      return true;
    }
    let win = null;
    try {
      win = window.open('/speaker.html', 'presenter-speaker', 'popup=yes,width=520,height=820');
    } catch {
      win = null;
    }
    if (!win) {
      if (announceBlocked) this.noticeHandler?.('Speaker view was blocked — presenting without notes.');
      return false;
    }
    this.speakerWindow = win;
    this.speakerBtn.hidden = false;
    return true;
  }

  closeSpeakerWindow() {
    if (this.speakerChannel) this.speakerChannel.postMessage({ type: 'exit' });
    if (this.speakerWindow && !this.speakerWindow.closed) {
      try {
        this.speakerWindow.close();
      } catch {
        // Ignore a window that is already gone.
      }
    }
    this.speakerWindow = null;
  }

  focusSpeaker() {
    if (!this.active || this.mode !== 'speaker') {
      this.noticeHandler?.('Speaker view is available in Present with speaker view.');
      return;
    }
    if (this.speakerWindow && !this.speakerWindow.closed) {
      this.speakerWindow.focus();
      return;
    }
    if (!this.openSpeakerWindow()) {
      this.mode = 'plain';
      this.speakerBtn.hidden = true;
      this.notesHint.textContent = 'Session only';
    }
  }

  // `S`: open the speaker view on an extended display, or — on a single
  // display — fall back to the Rehearse console instead of failing. This
  // deliberately overrides Present without notes when the presenter presses
  // S; notes stay on this screen in that case. No display-mode switching, no
  // second-device server.
  toggleSpeakerView() {
    if (!this.active || !this.deck) return;
    if (this.mode === 'speaker') {
      this.focusSpeaker();
      return;
    }
    if (window.screen && window.screen.isExtended) {
      this.mode = 'speaker';
      // Closing saves any open scratch text through the normal path.
      if (!this.notesPanel.hidden) this.closeNotes();
      this.noteBadge.hidden = true;
      this.speakerBtn.hidden = false;
      this.notesHint.textContent = 'Speaker view · notes on the laptop';
      if (this.openSpeakerWindow(false)) {
        this.broadcastSpeakerState();
        this.noticeHandler?.('Speaker view opened — notes are in the speaker window.');
        return;
      }
      // Popup blocked or channel unavailable: never put notes on the
      // projected screen. Keep this mode without notes and let the presenter
      // retry via the speaker button or the mode dialog.
      this.mode = 'plain';
      this.speakerBtn.hidden = true;
      this.notesHint.textContent = 'Session only';
      this.noticeHandler?.('Speaker view was blocked. Presentation stays without notes.');
      this.broadcastSpeakerState();
      return;
    }
    this.mode = 'rehearse';
    this.speakerBtn.hidden = true;
    this.openNotes({ focus: false });
    this.updateNoteBadge();
  }

  handleSpeakerMessage(data) {
    if (!data || typeof data.type !== 'string') return;
    if (data.type === 'hello') {
      this.broadcastSpeakerState();
      return;
    }
    if (!this.active || this.mode !== 'speaker') return;
    if (data.type === 'cmd') {
      if (data.cmd === 'next') this.next();
      else if (data.cmd === 'prev') this.prev();
      else if (data.cmd === 'first') this.first();
      else if (data.cmd === 'last') this.last();
      else if (data.cmd === 'goto') this.goTo(data.index);
      else if (data.cmd === 'exit') this.exit();
      return;
    }
    if (data.type === 'scratch' && Number.isInteger(data.index)) {
      this.setScratchNote(data.index, typeof data.text === 'string' ? data.text : '');
      return;
    }
    if (data.type === 'closed') this.speakerWindow = null;
  }

  scratchMap() {
    const map = {};
    if (!this.deck) return map;
    const total = Math.max(this.total, 1);
    for (let i = 0; i < total; i += 1) {
      map[i] = sessionStorage.getItem(notesKey(this.deck.id, i)) || '';
    }
    return map;
  }

  // Library notes (options.notes) override embedded deck notes for an index,
  // including an empty string, which means "no note for this slide".
  noteFor(index) {
    if (
      Object.prototype.hasOwnProperty.call(this.speakerNotes, index) &&
      typeof this.speakerNotes[index] === 'string'
    ) {
      return this.speakerNotes[index];
    }
    return this.deckNotes[index] || '';
  }

  allNotes() {
    const length = Math.max(this.total, this.deckNotes.length, this.speakerNotes.length);
    const notes = [];
    for (let i = 0; i < length; i += 1) notes.push(this.noteFor(i));
    return notes;
  }

  broadcastSpeakerState() {
    if (!this.speakerChannel || !this.deck) return;
    this.speakerChannel.postMessage({
      type: 'state',
      deckTitle: this.deck.title,
      index: this.index,
      total: Math.max(this.total, 1),
      deckNotes: this.allNotes(),
      scratch: this.scratchMap(),
      mode: this.mode,
    });
  }

  setScratchNote(index, text) {
    if (!this.deck || !Number.isInteger(index)) return;
    const key = notesKey(this.deck.id, index);
    if (text.trim() === '') sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, text);
    if (index === this.index) this.updateNoteBadge();
    this.broadcastSpeakerState();
  }

  async present(deck, options = {}) {
    this.closeSpeakerWindow();

    let mode =
      options.mode === 'speaker'
        ? 'speaker'
        : options.mode === 'rehearse'
          ? 'rehearse'
          : 'plain';

    if (mode === 'speaker' && !(window.screen && window.screen.isExtended)) {
      mode = 'plain';
      this.noticeHandler?.('Speaker view needs a second display — presenting without notes.');
    }

    this.mode = mode;
    this.deckNotes = [];
    this.speakerNotes = Array.isArray(options.notes)
      ? options.notes.map((value) => (typeof value === 'string' ? value : ''))
      : [];

    if (mode === 'speaker' && !this.openSpeakerWindow()) {
      this.mode = 'plain';
      mode = 'plain';
    }

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
      this.closeSpeakerWindow();
      this.mode = 'plain';
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
    this.panKey = false;
    this.panning = false;
    this.panStart = null;
    this.applyViewTransform();
    this.updateZoom();
    this.restartCursorIdle();
    this.openNotesOnReady = mode === 'rehearse';

    this.counter.hidden = false;
    this.progress.hidden = false;
    this.counter.textContent = '1 / 1';
    this.progressFill.style.width = '0%';
    this.noteBadge.hidden = true;
    this.viewport.classList.remove('is-split');
    this.notesPanel.hidden = true;
    this.notesPanel.setAttribute('aria-hidden', 'true');
    this.notesLabel.textContent = 'Slide 1';
    this.notesTextarea.value = '';
    this.deckNotesWrap.hidden = true;
    this.deckNotesEl.textContent = '';
    this.notesHint.textContent = mode === 'rehearse' ? 'Rehearsal' : 'Session only';
    this.speakerBtn.hidden = mode !== 'speaker';
    if (this.nextNotesWrap) this.nextNotesWrap.hidden = true;
    if (this.nextNotesEl) this.nextNotesEl.textContent = '';
    this.startElapsedTimer();

    this.frame.src = this.blobUrl;
    this.presentView.hidden = false;
    this.libraryView.hidden = true;
    // The topbar sits outside #library-view; keep Tab from reaching the Add
    // deck / Import / Export buttons hidden behind the presentation overlay.
    if (this.topbar) this.topbar.inert = true;
    this.viewport.focus();

    if (mode === 'speaker') this.broadcastSpeakerState();
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
        if (this.openNotesOnReady && this.mode === 'rehearse') {
          this.openNotesOnReady = false;
          this.openNotes({ focus: false });
        }
        break;
      case 'presenter:notes':
        this.deckNotes = Array.isArray(data.notes) ? data.notes.map(String) : [];
        this.syncNotes();
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
      case 'presenter:speaker':
        this.toggleSpeakerView();
        break;
      case 'presenter:pan':
        this.panBy(Number(data.dx) || 0, Number(data.dy) || 0);
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
    this.speakerBtn.hidden = this.mode !== 'speaker';

    this.counter.textContent = `${this.index + 1} / ${Math.max(this.total, 1)}`;
    const percent = this.total > 0 ? ((this.index + 1) / this.total) * 100 : 0;
    this.progressFill.style.width = `${Math.min(100, percent).toFixed(2)}%`;
    this.syncNotes();
  }

  readNote(index = this.index) {
    if (!this.deck) return '';
    return sessionStorage.getItem(notesKey(this.deck.id, index)) ?? '';
  }

  updateNoteBadge() {
    const hasNote =
      this.mode === 'rehearse' &&
      Boolean(this.deck) &&
      this.strategy !== 'single' &&
      (this.noteFor(this.index).trim() !== '' || this.readNote().trim() !== '');
    this.noteBadge.hidden = !hasNote;
  }

  syncNotes() {
    if (!this.deck) return;
    if (!this.notesPanel.hidden) {
      this.notesLabel.textContent = `Slide ${this.index + 1}`;
      const deckNote = this.noteFor(this.index);
      this.deckNotesEl.textContent = deckNote || 'No speaker notes for this slide.';
      this.deckNotesEl.classList.toggle('is-empty', deckNote.trim() === '');
      this.deckNotesWrap.hidden = false;
      this.notesTextarea.value = this.readNote();
    }
    this.updateNextNotes();
    this.updateNoteBadge();
    if (this.mode === 'speaker') this.broadcastSpeakerState();
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

  panBy(dx, dy) {
    if (!this.active || this.zoom <= 100) return;
    this.panX += dx;
    this.panY += dy;
    this.clampPan();
    this.applyViewTransform();
  }

  updateZoom() {
    if (!this.zoomLevel) return;
    this.zoomLevel.textContent = `${this.zoom}%`;
    this.zoomLevel.setAttribute('aria-label', `Zoom ${this.zoom}%. Reset to 100%. Hold H and use arrow keys to pan.`);
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
    const isH = event.key === 'h' || event.key === 'H';
    if (event.key !== 'Control' && event.key !== 'Meta' && !isH) return;
    if (event.type === 'keydown' && isEditable(event.target)) return;
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

  openNotes({ focus = true } = {}) {
    if (!this.active || !this.deck || this.mode !== 'rehearse') return;
    const deckNote = this.noteFor(this.index);
    this.notesLabel.textContent = `Slide ${this.index + 1}`;
    this.deckNotesEl.textContent = deckNote || 'No speaker notes for this slide.';
    this.deckNotesEl.classList.toggle('is-empty', deckNote.trim() === '');
    this.deckNotesWrap.hidden = false;
    this.notesTextarea.value = this.readNote();
    this.updateNextNotes();
    this.viewport.classList.add('is-split');
    this.notesPanel.hidden = false;
    this.notesPanel.setAttribute('aria-hidden', 'false');
    this.notesHint.textContent = 'Rehearsal';
    if (focus) this.notesTextarea.focus();
    else this.viewport.focus();
  }

  // Next-slide notes in the Rehearse console; the HTML may not carry these
  // elements at all, in which case this does nothing.
  updateNextNotes() {
    if (!this.nextNotesWrap || !this.nextNotesEl) return;
    const hide = () => {
      this.nextNotesWrap.hidden = true;
      this.nextNotesEl.textContent = '';
    };
    if (!this.deck || this.strategy === 'single') {
      hide();
      return;
    }
    const nextIndex = this.index + 1;
    if (nextIndex >= Math.max(this.total, 1)) {
      hide();
      return;
    }
    const text = this.noteFor(nextIndex);
    if (text.trim() === '') {
      hide();
      return;
    }
    this.nextNotesWrap.hidden = false;
    this.nextNotesEl.textContent = text;
  }

  tickElapsed() {
    if (this.elapsedPaused || this.presentStartedAt === null) return;
    this.elapsedElapsed = Date.now() - this.presentStartedAt;
    if (this.notesTimer) this.notesTimer.textContent = this.formatElapsed(this.elapsedElapsed);
  }

  startElapsedTimer() {
    this.stopElapsedTimer();
    this.presentStartedAt = Date.now();
    this.elapsedElapsed = 0;
    this.elapsedPaused = false;
    if (this.notesTimer) this.notesTimer.textContent = '00:00';
    if (this.notesTimerToggle) {
      this.notesTimerToggle.textContent = 'Pause';
      this.notesTimerToggle.setAttribute('aria-label', 'Pause rehearsal timer');
    }
    this.elapsedTimer = window.setInterval(() => this.tickElapsed(), 500);
  }

  stopElapsedTimer() {
    if (this.elapsedTimer !== null) {
      window.clearInterval(this.elapsedTimer);
      this.elapsedTimer = null;
    }
    this.presentStartedAt = null;
    this.elapsedElapsed = 0;
    this.elapsedPaused = false;
    if (this.notesTimer) this.notesTimer.textContent = '00:00';
    if (this.notesTimerToggle) {
      this.notesTimerToggle.textContent = 'Pause';
      this.notesTimerToggle.setAttribute('aria-label', 'Pause rehearsal timer');
    }
  }

  toggleElapsedTimer() {
    if (this.presentStartedAt === null) return;
    if (this.elapsedPaused) {
      this.presentStartedAt = Date.now() - this.elapsedElapsed;
      this.elapsedPaused = false;
      if (this.notesTimerToggle) {
        this.notesTimerToggle.textContent = 'Pause';
        this.notesTimerToggle.setAttribute('aria-label', 'Pause rehearsal timer');
      }
      this.tickElapsed();
      return;
    }
    this.elapsedElapsed = Date.now() - this.presentStartedAt;
    this.elapsedPaused = true;
    if (this.notesTimer) this.notesTimer.textContent = this.formatElapsed(this.elapsedElapsed);
    if (this.notesTimerToggle) {
      this.notesTimerToggle.textContent = 'Resume';
      this.notesTimerToggle.setAttribute('aria-label', 'Resume rehearsal timer');
    }
  }

  resetElapsedTimer() {
    this.presentStartedAt = Date.now();
    this.elapsedElapsed = 0;
    this.elapsedPaused = false;
    if (this.notesTimer) this.notesTimer.textContent = '00:00';
    if (this.notesTimerToggle) {
      this.notesTimerToggle.textContent = 'Pause';
      this.notesTimerToggle.setAttribute('aria-label', 'Pause rehearsal timer');
    }
  }

  formatElapsed(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  toggleNotes() {
    if (!this.active || !this.deck) return;
    if (this.mode === 'plain') {
      this.noticeHandler?.(
        'Notes are hidden in Present without notes. Choose Present with speaker view or Rehearse.'
      );
      return;
    }
    if (this.mode === 'speaker') {
      this.focusSpeaker();
      return;
    }
    if (!this.notesPanel.hidden) this.closeNotes();
    else this.openNotes();
  }

  closeNotes() {
    if (this.notesPanel.hidden) return;
    this.saveNotes(this.notesTextarea.value);
    this.notesPanel.hidden = true;
    this.notesPanel.setAttribute('aria-hidden', 'true');
    this.viewport.classList.remove('is-split');
    this.viewport.focus();
  }

  saveNotes(text) {
    if (!this.deck) return;
    const value = typeof text === 'string' ? text : '';
    const key = notesKey(this.deck.id, this.index);
    if (value.trim() === '') sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
    this.updateNoteBadge();
    if (this.mode === 'speaker') this.broadcastSpeakerState();
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

    if (this.panKey && this.zoom > 100) {
      let dx = 0;
      let dy = 0;
      if (event.key === 'ArrowRight') dx = 64;
      else if (event.key === 'ArrowLeft') dx = -64;
      else if (event.key === 'ArrowDown') dy = 64;
      else if (event.key === 'ArrowUp') dy = -64;
      if (dx !== 0 || dy !== 0) {
        event.preventDefault();
        this.panBy(dx, dy);
        return;
      }
      if (NEXT_KEYS.has(event.key) || PREV_KEYS.has(event.key) || event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        return;
      }
    }

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

    if (event.key === 's' || event.key === 'S') {
      event.preventDefault();
      this.toggleSpeakerView();
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
    this.closeSpeakerWindow();
    this.stopElapsedTimer();
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
    this.viewport.classList.remove('is-split');
    if (this.topbar) this.topbar.inert = false;
    this.deck = null;
    this.index = 0;
    this.total = 0;
    this.strategy = 'single';
    this.mode = 'plain';
    this.deckNotes = [];
    this.speakerNotes = [];
    this.openNotesOnReady = false;
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
    this.noteBadge.hidden = true;
    this.deckNotesWrap.hidden = true;
    this.deckNotesEl.textContent = '';
    if (this.nextNotesWrap) this.nextNotesWrap.hidden = true;
    if (this.nextNotesEl) this.nextNotesEl.textContent = '';
    this.notesHint.textContent = 'Session only';
    this.speakerBtn.hidden = true;

    this.exitHandler?.();
  }
}
