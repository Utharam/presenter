import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const deck3 = readFileSync(new URL('../fixtures/deck-3slides.html', import.meta.url), 'utf8');

const noteKey = (deckId, index = 0) => `presenter:note:${deckId}:${index}`;

async function openApp(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.__appReady === true, null, { timeout: 10000 });
}

async function addDeck(page, html) {
  await page.click('#add-deck-btn');
  await expect(page.locator('#import-dialog')).toBeVisible();
  await page.fill('#deck-html', html);
  await page.click('#save-deck-btn');
  await expect(page.locator('#import-dialog')).toBeHidden();
}

async function openExistingDeck(page) {
  await page.click('#deck-grid .deck-card [data-action="modes"]');
  await expect(page.locator('#present-dialog')).toBeVisible();
  await page.click('[data-present-mode="rehearse"]');
  await expect(page.locator('#present-view')).toBeVisible();
  await expect(page.locator('#library-view')).toBeHidden();
  await expect(page.locator('#notes-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#notes-panel')).toBeHidden();
}

async function openDeck(page, html) {
  await openApp(page);
  await addDeck(page, html);
  const deckId = await page.locator('#deck-grid .deck-card').getAttribute('data-deck-id');
  await openExistingDeck(page);
  return deckId;
}
test('N opens notes for slide 1', async ({ page }) => {
  await openDeck(page, deck3);
  const panel = page.locator('#notes-panel');
  await expect(panel).toBeHidden();

  await page.keyboard.press('n');

  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('role', 'dialog');
  await expect(panel).toHaveAttribute('aria-label', 'Slide notes');
  await expect(panel).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#notes-label')).toHaveText('Slide 1');
  await expect(page.locator('#notes-textarea')).toBeFocused();
});

test('typing does not navigate', async ({ page }) => {
  const deckId = await openDeck(page, deck3);
  await page.keyboard.press('n');
  const textarea = page.locator('#notes-textarea');
  await expect(textarea).toBeFocused();

  await page.keyboard.type('hello');
  await page.keyboard.press('n');
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowRight');

  await expect(page.locator('#slide-counter')).toHaveText('1 / 3');
  await expect(page.locator('#notes-panel')).toBeVisible();
  await expect(textarea).toHaveValue('hellon ');
  expect(await page.evaluate((key) => sessionStorage.getItem(key), noteKey(deckId))).toBe('hellon ');
});

test('Esc closes notes first', async ({ page }) => {
  const deckId = await openDeck(page, deck3);
  await page.keyboard.press('n');
  await page.locator('#notes-textarea').fill('close note');

  await page.keyboard.press('Escape');

  const panel = page.locator('#notes-panel');
  await expect(panel).toBeHidden();
  await expect(panel).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#present-view')).toBeVisible();
  await expect(page.locator('#present-viewport')).toBeFocused();
  expect(await page.evaluate((key) => sessionStorage.getItem(key), noteKey(deckId))).toBe('close note');

  await page.keyboard.press('Escape');
  await expect(page.locator('#library-view')).toBeVisible();
  await expect(page.locator('#present-view')).toBeHidden();
});

test('notes are per slide', async ({ page }) => {
  await openDeck(page, deck3);
  await page.keyboard.press('n');
  const textarea = page.locator('#notes-textarea');
  await textarea.fill('slide one');

  await page.locator('#present-viewport').focus();
  await page.keyboard.press('ArrowRight');

  await expect(page.locator('#slide-counter')).toHaveText('2 / 3');
  await expect(page.locator('#notes-label')).toHaveText('Slide 2');
  await expect(textarea).toHaveValue('');

  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#slide-counter')).toHaveText('1 / 3');
  await expect(page.locator('#notes-label')).toHaveText('Slide 1');
  await expect(textarea).toHaveValue('slide one');
});

test('notes survive same-tab reload', async ({ page }) => {
  const deckId = await openDeck(page, deck3);
  await page.keyboard.press('n');
  await page.locator('#notes-textarea').fill('reload note');
  expect(await page.evaluate((key) => sessionStorage.getItem(key), noteKey(deckId))).toBe('reload note');

  await page.keyboard.press('Escape');
  await expect(page.locator('#notes-panel')).toBeHidden();

  await page.reload();
  await page.waitForFunction(() => window.__appReady === true, null, { timeout: 10000 });
  await openExistingDeck(page);
  await page.keyboard.press('n');

  await expect(page.locator('#notes-textarea')).toHaveValue('reload note');
});

test('notes die with the tab', async ({ page, browser }) => {
  const deckId = await openDeck(page, deck3);
  await page.keyboard.press('n');
  await page.locator('#notes-textarea').fill('tab only note');
  expect(await page.evaluate((key) => sessionStorage.getItem(key), noteKey(deckId))).toBe('tab only note');

  const baseURL = test.info().project.use.baseURL;
  const context = await browser.newContext({ baseURL });
  const fresh = await context.newPage();
  try {
    await openDeck(fresh, deck3);
    await fresh.keyboard.press('n');
    await expect(fresh.locator('#notes-textarea')).toHaveValue('');
  } finally {
    await context.close();
  }
});

test('notes never export', async ({ page }) => {
  const deckId = await openDeck(page, deck3);
  await page.keyboard.press('n');
  const secret = 'private rehearsal note';
  await page.locator('#notes-textarea').fill(secret);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), noteKey(deckId))).toBe(secret);

  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.locator('#library-view')).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#export-btn'),
  ]);
  const json = await readFile(await download.path(), 'utf8');
  expect(json).not.toContain(secret);
  expect(JSON.parse(json).decks).toHaveLength(1);
});

test('note badge reflects presence', async ({ page }) => {
  await openDeck(page, deck3);
  const badge = page.locator('#note-badge');
  await expect(badge).toBeHidden();

  await page.keyboard.press('n');
  await page.locator('#notes-textarea').fill('badge note');
  await page.keyboard.press('Escape');
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText('NOTE');

  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#slide-counter')).toHaveText('2 / 3');
  await expect(badge).toBeHidden();

  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#slide-counter')).toHaveText('1 / 3');
  await expect(badge).toBeVisible();
});
