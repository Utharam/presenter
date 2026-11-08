/* ===========================================
   SPEAKER VIEW
   Receives state from the main Presenter window
   over BroadcastChannel. No backend, no network.
   =========================================== */

const els = {
  title: document.getElementById('sp-title'),
  counter: document.getElementById('sp-counter'),
  timer: document.getElementById('sp-timer'),
  timerToggle: document.getElementById('sp-timer-toggle'),
  timerReset: document.getElementById('sp-timer-reset'),
  deckNotes: document.getElementById('sp-deck-notes'),
  nextNotes: document.getElementById('sp-next-notes'),
  scratch: document.getElementById('sp-scratch'),
  save: document.getElementById('sp-save'),
  close: document.getElementById('sp-close'),
  first: document.getElementById('sp-first'),
  prev: document.getElementById('sp-prev'),
  next: document.getElementById('sp-next'),
  last: document.getElementById('sp-last'),
};

const state = {
  deckTitle: '',
  index: 0,
  total: 1,
  deckNotes: [],
  scratch: {},
  mode: 'speaker',
};

let renderedIndex = null;
let saveTimer = null;
let timerId = null;
let timerStartedAt = 0;
let timerElapsed = 0;
let timerPaused = false;

const channel =
  'BroadcastChannel' in window ? new BroadcastChannel('presenter-speaker') : null;

function send(message) {
  channel?.postMessage(message);
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

function tick() {
  timerElapsed = Date.now() - timerStartedAt;
  els.timer.textContent = formatTime(timerElapsed);
}

function startTimer() {
  if (timerId !== null) return;
  timerStartedAt = Date.now() - timerElapsed;
  timerId = window.setInterval(tick, 250);
  timerPaused = false;
  els.timerToggle.textContent = 'Pause';
}

function pauseTimer() {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
    timerElapsed = Date.now() - timerStartedAt;
    els.timer.textContent = formatTime(timerElapsed);
  }
  timerPaused = true;
  els.timerToggle.textContent = 'Resume';
}

function resetTimer() {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
  timerElapsed = 0;
  timerPaused = false;
  els.timer.textContent = '00:00';
  startTimer();
}

function sendScratchSoon() {
  const index = Number(els.scratch.dataset.index);
  if (!Number.isInteger(index)) return;
  els.save.textContent = 'Saving…';
  if (saveTimer !== null) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    send({ type: 'scratch', index, text: els.scratch.value });
    els.save.textContent = 'Saved';
  }, 150);
}

function flushScratch() {
  if (saveTimer === null) return;
  window.clearTimeout(saveTimer);
  saveTimer = null;
  const index = Number(els.scratch.dataset.index);
  if (Number.isInteger(index)) {
    send({ type: 'scratch', index, text: els.scratch.value });
  }
}

function render(next) {
  Object.assign(state, next);

  els.title.textContent = state.deckTitle || 'Presenter';
  els.counter.textContent = `${state.index + 1} / ${Math.max(state.total, 1)}`;
  document.body.classList.remove('sp-waiting');

  const current = state.deckNotes[state.index] || '';
  els.deckNotes.textContent = current || 'No deck notes for this slide.';
  els.deckNotes.classList.toggle('sp-muted', current === '');

  const nextIndex = state.index + 1;
  const nextNote =
    state.deckNotes[nextIndex] || state.scratch[nextIndex] || '';
  els.nextNotes.textContent = nextNote || 'No note for the next slide.';
  els.nextNotes.classList.toggle('sp-muted', nextNote === '');

  if (state.index !== renderedIndex) {
    flushScratch();
    renderedIndex = state.index;
    els.scratch.dataset.index = String(state.index);
    els.scratch.value = state.scratch[state.index] || '';
  } else if (
    document.activeElement !== els.scratch &&
    els.scratch.value !== (state.scratch[state.index] || '')
  ) {
    els.scratch.value = state.scratch[state.index] || '';
  }

  if (!timerPaused) startTimer();
}

function sendCommand(cmd) {
  flushScratch();
  send({ type: 'cmd', cmd });
}

els.close.addEventListener('click', () => {
  flushScratch();
  send({ type: 'closed' });
  window.close();
});

els.first.addEventListener('click', () => sendCommand('first'));
els.prev.addEventListener('click', () => sendCommand('prev'));
els.next.addEventListener('click', () => sendCommand('next'));
els.last.addEventListener('click', () => sendCommand('last'));

els.timerToggle.addEventListener('click', () => {
  if (timerPaused) startTimer();
  else pauseTimer();
});

els.timerReset.addEventListener('click', resetTimer);

els.scratch.addEventListener('input', sendScratchSoon);

window.addEventListener('keydown', (event) => {
  const target = event.target;
  if (target instanceof Element && target.closest('textarea, input, [contenteditable]')) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === ' ' || event.key === 'PageDown') {
    event.preventDefault();
    sendCommand('next');
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp') {
    event.preventDefault();
    sendCommand('prev');
  } else if (event.key === 'Home') {
    event.preventDefault();
    sendCommand('first');
  } else if (event.key === 'End') {
    event.preventDefault();
    sendCommand('last');
  } else if (event.key === 'Escape') {
    event.preventDefault();
    sendCommand('exit');
  }
});

window.addEventListener('pagehide', () => {
  flushScratch();
  send({ type: 'closed' });
});

if (channel) {
  channel.onmessage = (event) => {
    const data = event.data;
    if (!data) return;
    if (data.type === 'state') render(data);
    if (data.type === 'exit') {
      flushScratch();
      window.close();
    }
  };
  send({ type: 'hello' });
} else {
  document.body.classList.add('sp-waiting');
  els.title.textContent = 'Speaker view is not supported in this browser';
}
