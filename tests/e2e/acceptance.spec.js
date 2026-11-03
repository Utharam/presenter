import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const FIXTURE = fileURLToPath(new URL('../fixtures/real-deck.html', import.meta.url));
const REAL_TITLE = 'Frontend Slides Readiness Test';
const NOTE_TEXT = 'slide two rehearsal n';

// The real deck links Google Fonts. App code is offline, but deck assets may
// use the network, so this test blocks that one external stylesheet to stay
// deterministic in an offline runner. Chromium then logs exactly one
// "Failed to load resource: net::ERR_FAILED" whose console location is the
// fonts host. That specific deck-owned net error is the only console error
// allowed; any app-origin (or any other) error fails the test below.
const FONT_HOST = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

async function ready(page) {
  await page.waitForFunction(() => window.__appReady === true, null, { timeout: 10000 });
}

test('SPEC acceptance criteria 1-9', async ({ page, context }) => {
  test.setTimeout(120000);
  const origin = new URL(test.info().project.use.baseURL).origin;
  const consoleErrors = [];
  const pageErrors = [];
  const externalRequests = [];

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    const url = message.location().url ?? '';
    const deckFontNetError = FONT_HOST.test(url) && /Failed to load resource|net::ERR_/i.test(text);
    if (deckFontNetError) return;
    consoleErrors.push({ text, url });
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith(origin) || url.startsWith('blob:') || url.startsWith('data:')) return;
    if (FONT_HOST.test(url)) return;
    externalRequests.push(url);
  });
  await context.route(FONT_HOST, (route) => route.abort());

  await page.goto('/');
  await ready(page);

  // Criterion 1: add the real deck through the dialog, then survive a reload.
  await page.click('#add-deck-btn');
  await expect(page.locator('#import-dialog')).toBeVisible();
  await page.setInputFiles('#deck-file', FIXTURE);
  await expect(page.locator('#deck-title')).toHaveValue(REAL_TITLE);
  await page.click('#save-deck-btn');
  await expect(page.locator('#import-dialog')).toBeHidden();

  const card = page.locator('#deck-grid .deck-card').filter({
    has: page.locator('.deck-title', { hasText: REAL_TITLE }),
  });
  await expect(card).toHaveCount(1);

  await page.reload();
  await ready(page);
  await expect(card).toHaveCount(1);

  // Criterion 2: present from a blob: iframe with only allow-scripts.
  await card.locator('[data-action="open"]').click();
  await expect(page.locator('#present-view')).toBeVisible();
  await expect(page.locator('#library-view')).toBeHidden();
  const frame = page.locator('#present-frame');
  await expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
  expect(await frame.getAttribute('src')).toMatch(/^blob:/);

  const counter = page.locator('#slide-counter');
  const progress = page.locator('#progress');
  const notesPanel = page.locator('#notes-panel');
  const notesTextarea = page.locator('#notes-textarea');
  const notesLabel = page.locator('#notes-label');
  const deckBody = page.frameLocator('#present-frame').locator('body');

  // Criterion 4: counter and progress agree; both visible for 3 slides.
  await expect(counter).toHaveText('1 / 3');
  await expect(progress).toBeVisible();
  const percent = await page.evaluate(() =>
    parseFloat(document.querySelector('#progress-fill').style.width)
  );
  expect(percent).toBeGreaterThanOrEqual(32.33);
  expect(percent).toBeLessThanOrEqual(34.33);

  // Criterion 3: parent focus advances exactly one slide per press.
  await page.keyboard.press('ArrowRight');
  await expect(counter).toHaveText('2 / 3');
  await page.keyboard.press('ArrowLeft');
  await expect(counter).toHaveText('1 / 3');

  // Criterion 3: iframe focus also advances exactly one slide. The real deck
  // has its own window keydown handler, so currentSlide === 1 proves the bridge
  // swallowed the event instead of the deck double-advancing.
  await deckBody.click({ position: { x: 20, y: 20 } });
  await page.keyboard.press('ArrowRight');
  await expect(counter).toHaveText('2 / 3');
  await expect.poll(() => deckBody.evaluate(() => window.presentation.currentSlide)).toBe(1);
  await page.keyboard.press('ArrowLeft');
  await expect(counter).toHaveText('1 / 3');

  // Criterion 5: F toggles fullscreen (pressed with iframe focus).
  await page.keyboard.press('f');
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
  await page.keyboard.press('f');
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);

  // Criterion 6: add a note on slide 2, then type navigation keys inside the
  // textarea (criterion 7) without moving slides or closing the panel.
  await page.keyboard.press('ArrowRight');
  await expect(counter).toHaveText('2 / 3');
  await page.keyboard.press('n');
  await expect(notesPanel).toBeVisible();
  await expect(notesTextarea).toBeFocused();
  await expect(notesLabel).toHaveText('Slide 2');
  await notesTextarea.fill('slide two rehearsal');
  await page.keyboard.press('Space');
  await page.keyboard.press('n');
  await page.keyboard.press('ArrowRight');
  await expect(counter).toHaveText('2 / 3');
  await expect(notesPanel).toBeVisible();
  await expect(notesTextarea).toHaveValue(NOTE_TEXT);

  // Esc closes notes first, not the presentation.
  await page.keyboard.press('Escape');
  await expect(notesPanel).toBeHidden();
  await expect(page.locator('#present-view')).toBeVisible();

  // Navigate away and back: the slide-2 note is restored.
  await page.keyboard.press('ArrowRight');
  await expect(counter).toHaveText('3 / 3');
  await page.keyboard.press('ArrowLeft');
  await expect(counter).toHaveText('2 / 3');
  await page.keyboard.press('n');
  await expect(notesTextarea).toHaveValue(NOTE_TEXT);
  await page.keyboard.press('Escape');
  await expect(notesPanel).toBeHidden();

  // Criterion 8: E inside the deck never enables edit UI.
  await deckBody.click({ position: { x: 20, y: 20 } });
  await page.keyboard.press('e');
  const readOnly = await deckBody.evaluate((body) => {
    const probe = document.createElement('div');
    probe.className = 'edit-toggle';
    body.appendChild(probe);
    const display = getComputedStyle(probe).display;
    probe.remove();
    return {
      readonly: body.classList.contains('presenter-readonly'),
      editMode: body.classList.contains('edit-mode'),
      editToggleDisplay: display,
    };
  });
  expect(readOnly).toEqual({ readonly: true, editMode: false, editToggleDisplay: 'none' });

  // Exit from the deck (iframe focus) back to the library.
  await page.keyboard.press('Escape');
  await expect(page.locator('#library-view')).toBeVisible();
  await expect(page.locator('#present-view')).toBeHidden();

  // Criterion 9: export, delete, then import the JSON. Notes never export.
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-btn')]);
  const firstExport = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(firstExport.app).toBe('html-presenter');
  expect(firstExport.version).toBe(1);
  expect(firstExport.decks).toHaveLength(1);
  const exportedDeck = firstExport.decks[0];
  expect(exportedDeck.title).toBe(REAL_TITLE);
  expect(exportedDeck.html).toContain('fonts.googleapis.com');
  expect(JSON.stringify(firstExport)).not.toContain(NOTE_TEXT);

  page.once('dialog', (dialog) => dialog.accept());
  await card.locator('[data-action="delete"]').click();
  await expect(page.locator('#deck-grid .deck-card')).toHaveCount(0);

  await page.setInputFiles('#import-file', await download.path());
  await expect(page.locator('#deck-grid .deck-card')).toHaveCount(1);
  await expect(page.locator('#toast-region')).toContainText('Imported 1, skipped 0');

  const [download2] = await Promise.all([page.waitForEvent('download'), page.click('#export-btn')]);
  const secondExport = JSON.parse(await readFile(await download2.path(), 'utf8'));
  expect(secondExport.decks).toEqual(firstExport.decks);

  // Reload: deck persists, and the same-tab note survives because the import
  // preserved the deck id and sessionStorage is per tab.
  await page.reload();
  await ready(page);
  await expect(page.locator('#deck-grid .deck-card')).toHaveCount(1);
  await page.click('#deck-grid .deck-card [data-action="open"]');
  await expect(counter).toHaveText('1 / 3');
  await page.keyboard.press('ArrowRight');
  await expect(counter).toHaveText('2 / 3');
  await page.keyboard.press('n');
  await expect(notesTextarea).toHaveValue(NOTE_TEXT);

  // Criterion 6: a new tab has its own sessionStorage; the note is gone.
  const fresh = await context.newPage();
  try {
    await fresh.goto('/');
    await fresh.waitForFunction(() => window.__appReady === true, null, { timeout: 10000 });
    await fresh.click('#deck-grid .deck-card [data-action="open"]');
    await fresh.waitForFunction(
      () => document.getElementById('slide-counter').textContent === '1 / 3',
      null,
      { timeout: 10000 }
    );
    await fresh.keyboard.press('n');
    await expect(fresh.locator('#notes-textarea')).toHaveValue('');
  } finally {
    await fresh.close();
  }

  // App code makes no external requests; only the deck's font host appears.
  expect(externalRequests).toEqual([]);
  expect(consoleErrors, JSON.stringify(consoleErrors, null, 2)).toEqual([]);
  expect(pageErrors, JSON.stringify(pageErrors, null, 2)).toEqual([]);
});
