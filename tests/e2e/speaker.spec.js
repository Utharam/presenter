import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const deck3 = readFileSync(new URL('../fixtures/deck-3slides.html', import.meta.url), 'utf8');
const notesDeck = readFileSync(new URL('../fixtures/deck-notes.html', import.meta.url), 'utf8');

async function ready(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.__appReady === true, null, { timeout: 10000 });
}

async function addDeck(page, html, title) {
  await page.click('#add-deck-btn');
  await expect(page.locator('#import-dialog')).toBeVisible();
  await page.fill('#deck-html', html);
  if (title) await page.fill('#deck-title', title);
  await page.click('#save-deck-btn');
  await expect(page.locator('#import-dialog')).toBeHidden();
}

test('one screen defaults to Present without notes', async ({ page }) => {
  await ready(page);
  await addDeck(page, deck3, 'Plain presentation');
  await page.click('#deck-grid .deck-card [data-action="open"]');
  await expect(page.locator('#present-view')).toBeVisible();
  await expect(page.locator('#notes-panel')).toBeHidden();

  await page.keyboard.press('n');
  await expect(page.locator('#notes-panel')).toBeHidden();
  await expect(page.locator('#toast-region')).toContainText('Notes are hidden in Present without notes');
});

test('S on one screen opens the Rehearse console with current and next notes', async ({ page }) => {
  await ready(page);
  await addDeck(page, notesDeck, 'Speaker notes fixture');
  await page.click('#deck-grid .deck-card [data-action="open"]');
  await expect(page.locator('#present-view')).toBeVisible();
  await expect(page.locator('#notes-panel')).toBeHidden();

  await page.keyboard.press('s');
  await expect(page.locator('#notes-panel')).toBeVisible();
  await expect(page.locator('#notes-hint')).toContainText('Rehearsal');
  await expect(page.locator('#deck-notes')).toHaveText('Open with the promise.');
  await expect(page.locator('#next-notes')).toHaveText('Pause after the second frame.');
  await expect(page.locator('#notes-timer')).toBeVisible();
  await expect(page.locator('#notes-timer')).toHaveText(/\d{2}:\d{2}/);

  // Navigation keeps the console up to date.
  await page.locator('#present-viewport').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#slide-counter')).toHaveText('2 / 3');
  await expect(page.locator('#deck-notes')).toHaveText('Pause after the second frame.');
  await expect(page.locator('#next-notes')).toHaveText('Close on the invitation.');

  // N closes and reopens the console; it stays usable.
  await page.keyboard.press('n');
  await expect(page.locator('#notes-panel')).toBeHidden();
  await page.keyboard.press('n');
  await expect(page.locator('#notes-panel')).toBeVisible();
  await expect(page.locator('#deck-notes')).toHaveText('Pause after the second frame.');
  await expect(page.locator('#next-notes')).toHaveText('Close on the invitation.');

  // S again in the Rehearse console is idempotent: the panel stays open.
  await page.keyboard.press('Escape');
  await page.locator('#present-viewport').focus();
  await page.keyboard.press('s');
  await expect(page.locator('#notes-panel')).toBeVisible();
  await expect(page.locator('#notes-hint')).toContainText('Rehearsal');
});

test('Rehearse shows an empty speaker-notes placeholder when a slide has no note', async ({ page }) => {
  await ready(page);
  await addDeck(page, deck3, 'No notes fixture');
  await page.click('#deck-grid .deck-card [data-action="open"]');
  await expect(page.locator('#present-view')).toBeVisible();
  await page.keyboard.press('s');
  await expect(page.locator('#notes-panel')).toBeVisible();
  await expect(page.locator('#deck-notes')).toHaveText('No speaker notes for this slide.');
});

test('Rehearse splits the deck and console and exposes slide controls', async ({ page }) => {
  await ready(page);
  await addDeck(page, notesDeck, 'Speaker notes fixture');
  await page.click('#deck-grid .deck-card [data-action="open"]');
  await expect(page.locator('#present-view')).toBeVisible();
  await page.keyboard.press('s');
  await expect(page.locator('#notes-panel')).toBeVisible();
  await expect(page.locator('#present-viewport')).toHaveClass(/is-split/);

  const layout = await page.evaluate(() => {
    const viewport = document.querySelector('#present-viewport').getBoundingClientRect();
    const frame = document.querySelector('#present-frame').getBoundingClientRect();
    const panel = document.querySelector('#notes-panel').getBoundingClientRect();
    return {
      viewportWidth: viewport.width,
      frameRight: frame.right,
      panelLeft: panel.left,
      panelWidth: panel.width,
    };
  });
  expect(layout.panelWidth).toBeLessThan(layout.viewportWidth);
  expect(layout.panelLeft).toBeGreaterThan(layout.viewportWidth * 0.5);
  expect(Math.abs(layout.frameRight - layout.panelLeft)).toBeLessThan(2);

  await page.click('#notes-next');
  await expect(page.locator('#slide-counter')).toHaveText('2 / 3');
  await expect(page.locator('#deck-notes')).toHaveText('Pause after the second frame.');
  await page.click('#notes-last');
  await expect(page.locator('#slide-counter')).toHaveText('3 / 3');
  await page.click('#notes-first');
  await expect(page.locator('#slide-counter')).toHaveText('1 / 3');

  await page.click('#notes-timer-reset');
  await expect(page.locator('#notes-timer')).toHaveText(/00:0\d/);
  await page.click('#notes-timer-toggle');
  await expect(page.locator('#notes-timer-toggle')).toHaveText('Resume');
  await page.click('#notes-timer-toggle');
  await expect(page.locator('#notes-timer-toggle')).toHaveText('Pause');

  await page.keyboard.press('n');
  await expect(page.locator('#present-viewport')).not.toHaveClass(/is-split/);
  await page.keyboard.press('n');
  await expect(page.locator('#present-viewport')).toHaveClass(/is-split/);
});

test('S on an extended display opens the speaker window and keeps notes off this screen', async ({ browser }) => {
  const baseURL = test.info().project.use.baseURL;
  const context = await browser.newContext({ baseURL });
  await context.addInitScript(() => {
    Object.defineProperty(screen, 'isExtended', { configurable: true, get: () => true });
  });
  const page = await context.newPage();
  try {
    await ready(page);
    await addDeck(page, notesDeck, 'Speaker notes fixture');
    // Start in Present without notes even with a second display, so S alone
    // triggers the popup.
    await page.click('#deck-grid .deck-card [data-action="modes"]');
    await expect(page.locator('#present-dialog')).toBeVisible();
    const popupPromise = page.waitForEvent('popup');
    await page.click('[data-present-mode="plain"]');
    await expect(page.locator('#present-view')).toBeVisible();
    await expect(page.locator('#notes-panel')).toBeHidden();

    await page.keyboard.press('s');
    const speaker = await popupPromise;

    await expect(page.locator('#notes-panel')).toBeHidden();
    await expect(speaker.locator('#sp-counter')).toHaveText('1 / 3');
    await expect(speaker.locator('#sp-deck-notes')).toHaveText('Open with the promise.');

    // S again with the window already open: it stays open, and the notes
    // panel stays hidden on this screen.
    await page.keyboard.press('s');
    await expect(page.locator('#notes-panel')).toBeHidden();
    await expect(speaker.locator('#sp-counter')).toHaveText('1 / 3');
  } finally {
    await context.close();
  }
});

test('S from inside the deck iframe opens the speaker window on an extended display', async ({ browser }) => {
  const baseURL = test.info().project.use.baseURL;
  const context = await browser.newContext({ baseURL });
  await context.addInitScript(() => {
    Object.defineProperty(screen, 'isExtended', { configurable: true, get: () => true });
  });
  const page = await context.newPage();
  try {
    await ready(page);
    await addDeck(page, notesDeck, 'Speaker notes fixture');
    await page.click('#deck-grid .deck-card [data-action="modes"]');
    const popupPromise = page.waitForEvent('popup');
    await page.click('[data-present-mode="plain"]');
    await expect(page.locator('#present-view')).toBeVisible();

    // The bridge catches S when focus is inside the sandboxed deck.
    await page.frameLocator('#present-frame').locator('body').click();
    await page.keyboard.press('s');
    const speaker = await popupPromise;

    await expect(page.locator('#notes-panel')).toBeHidden();
    await expect(speaker.locator('#sp-counter')).toHaveText('1 / 3');
    await expect(speaker.locator('#sp-deck-notes')).toHaveText('Open with the promise.');
  } finally {
    await context.close();
  }
});

test('mode dialog disables speaker view on one screen and Rehearse shows deck notes', async ({ page }) => {
  await ready(page);
  await addDeck(page, notesDeck, 'Speaker notes fixture');

  await page.click('#deck-grid .deck-card [data-action="modes"]');
  await expect(page.locator('#present-dialog')).toBeVisible();
  await expect(page.locator('#display-status')).toContainText('One display detected');
  await expect(page.locator('[data-present-mode="speaker"]')).toBeDisabled();
  await expect(page.locator('[data-mode-tag="plain"]')).toHaveText('Recommended');

  await page.click('[data-present-mode="rehearse"]');
  await expect(page.locator('#present-view')).toBeVisible();
  await expect(page.locator('#notes-panel')).toBeVisible();
  await expect(page.locator('#deck-notes')).toHaveText('Open with the promise.');
  await expect(page.locator('#notes-hint')).toContainText('Rehearsal');

  await page.keyboard.press('Escape');
  await expect(page.locator('#notes-panel')).toBeHidden();
  await expect(page.locator('#present-view')).toBeVisible();
});

test('speaker view syncs notes, controls, scratch notes, and the deck stays private', async ({ browser }) => {
  const baseURL = test.info().project.use.baseURL;
  const context = await browser.newContext({ baseURL });
  await context.addInitScript(() => {
    Object.defineProperty(screen, 'isExtended', { configurable: true, get: () => true });
  });
  const page = await context.newPage();
  await ready(page);
  await addDeck(page, notesDeck, 'Speaker notes fixture');
  const deckId = await page.locator('#deck-grid .deck-card').getAttribute('data-deck-id');

  await page.click('#deck-grid .deck-card [data-action="modes"]');
  await expect(page.locator('#present-dialog')).toBeVisible();
  await expect(page.locator('#display-status')).toContainText('Second display detected');
  await expect(page.locator('[data-present-mode="speaker"]')).toBeEnabled();

  const popupPromise = page.waitForEvent('popup');
  await page.click('[data-present-mode="speaker"]');
  const speaker = await popupPromise;

  await expect(page.locator('#present-view')).toBeVisible();
  await expect(speaker.locator('#sp-counter')).toHaveText('1 / 3');
  await expect(speaker.locator('#sp-deck-notes')).toHaveText('Open with the promise.');

  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#slide-counter')).toHaveText('2 / 3');
  await expect(speaker.locator('#sp-counter')).toHaveText('2 / 3');
  await expect(speaker.locator('#sp-deck-notes')).toHaveText('Pause after the second frame.');
  await expect(speaker.locator('#sp-next-notes')).toHaveText('Close on the invitation.');

  await speaker.locator('#sp-next').click();
  await expect(page.locator('#slide-counter')).toHaveText('3 / 3');
  await expect(speaker.locator('#sp-counter')).toHaveText('3 / 3');

  await speaker.locator('#sp-scratch').fill('Remember the closing line.');
  await expect.poll(
    () => page.evaluate((key) => sessionStorage.getItem(key), `presenter:note:${deckId}:2`),
    { timeout: 5000 }
  ).toBe('Remember the closing line.');

  await expect(page.locator('#notes-panel')).toBeHidden();
  await speaker.close();
  await expect(page.locator('#present-view')).toBeVisible();
  await context.close();
});
