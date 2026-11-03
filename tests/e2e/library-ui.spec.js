import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const deckHtml = readFileSync(new URL('../fixtures/deck-3slides.html', import.meta.url), 'utf8');
const DECK_TITLE = 'Frontend Slides Readiness Test';

async function ready(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.__appReady === true, null, { timeout: 10000 });
  await page.waitForSelector('#deck-grid');
}

async function addDeck(page, html, title) {
  await page.click('#add-deck-btn');
  await expect(page.locator('#import-dialog')).toBeVisible();
  await page.fill('#deck-html', html);
  if (title !== undefined) await page.fill('#deck-title', title);
  await page.click('#save-deck-btn');
  await expect(page.locator('#import-dialog')).toBeHidden();
}

function cardByTitle(page, title) {
  return page.locator('#deck-grid .deck-card').filter({
    has: page.locator('.deck-title', { hasText: title }),
  });
}

test('add via paste shows a card', async ({ page }) => {
  await ready(page);
  await page.click('#add-deck-btn');
  await page.fill('#deck-html', deckHtml);
  await expect(page.locator('#deck-title')).toHaveValue(DECK_TITLE);
  await page.click('#save-deck-btn');
  const card = cardByTitle(page, DECK_TITLE);
  await expect(card).toBeVisible();
  await expect(card.locator('.deck-title')).toHaveText(DECK_TITLE);
  await expect(card.locator('.deck-meta')).toContainText(/\d+(\.\d+)?\s?(B|KB|MB)/);
});

test('add via file drop fills the dialog and saves', async ({ page }) => {
  await ready(page);
  await page.click('#add-deck-btn');
  const dataTransfer = await page.evaluateHandle((html) => {
    const dt = new DataTransfer();
    dt.items.add(new File([html], 'deck-3slides.html', { type: 'text/html' }));
    return dt;
  }, deckHtml);
  await page.dispatchEvent('#deck-dropzone', 'drop', { dataTransfer });
  await expect(page.locator('#deck-title')).toHaveValue(DECK_TITLE);
  await page.click('#save-deck-btn');
  await expect(cardByTitle(page, DECK_TITLE)).toBeVisible();
});

test('deck survives reload', async ({ page }) => {
  await ready(page);
  await addDeck(page, deckHtml);
  await page.reload();
  await page.waitForFunction(() => window.__appReady === true, null, { timeout: 10000 });
  await expect(cardByTitle(page, DECK_TITLE)).toBeVisible();
});

test('title is editable before save', async ({ page }) => {
  await ready(page);
  await page.click('#add-deck-btn');
  await page.fill('#deck-html', deckHtml);
  await page.fill('#deck-title', 'Rehearsal Cut');
  await page.click('#save-deck-btn');
  await expect(cardByTitle(page, 'Rehearsal Cut')).toBeVisible();
});

test('delete removes deck', async ({ page }) => {
  await ready(page);
  await addDeck(page, deckHtml);
  const card = cardByTitle(page, DECK_TITLE);
  const del = card.locator('button[data-action="delete"]');
  await expect(del).toHaveAttribute('aria-label', `Delete ${DECK_TITLE}`);
  page.on('dialog', (dialog) => dialog.accept());
  await del.click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await page.waitForFunction(() => window.__appReady === true, null, { timeout: 10000 });
  await expect(cardByTitle(page, DECK_TITLE)).toHaveCount(0);
  await expect(page.locator('#deck-grid .empty-deck')).toBeVisible();
});

test('export downloads JSON', async ({ page }) => {
  await ready(page);
  await addDeck(page, deckHtml);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#export-btn'),
  ]);
  expect(download.suggestedFilename()).toMatch(/^html-presenter-decks-\d{4}-\d{2}-\d{2}\.json$/);
  const parsed = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(parsed.version).toBe(1);
  expect(parsed.decks).toHaveLength(1);
  expect(parsed.decks[0].title).toBe(DECK_TITLE);
});

test('import restores', async ({ page }) => {
  await ready(page);
  await addDeck(page, deckHtml);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#export-btn'),
  ]);
  const backup = await download.path();
  page.on('dialog', (dialog) => dialog.accept());
  await page.click('#deck-grid [data-action="delete"]');
  await expect(page.locator('#deck-grid .deck-card')).toHaveCount(0);
  await page.setInputFiles('#import-file', backup);
  await expect(cardByTitle(page, DECK_TITLE)).toBeVisible();
  await expect(page.locator('#toast-region')).toContainText('Imported 1, skipped 0');
});

test('empty paste is rejected', async ({ page }) => {
  await ready(page);
  await page.click('#add-deck-btn');
  await page.fill('#deck-html', '   ');
  await page.click('#save-deck-btn');
  await expect(page.locator('#import-error')).toHaveText('Paste HTML first');
  await expect(page.locator('#import-dialog')).toBeVisible();
  await expect(page.locator('#deck-grid .deck-card')).toHaveCount(0);
});

test('oversize paste is rejected and near-limit deck saves', async ({ page }) => {
  test.setTimeout(60000);
  await ready(page);
  await page.click('#add-deck-btn');
  await page.evaluate(() => {
    document.querySelector('#deck-html').value = 'x'.repeat(25 * 1024 * 1024 + 1);
  });
  await page.click('#save-deck-btn');
  await expect(page.locator('#import-error')).toContainText('26214401');
  await expect(page.locator('#import-error')).toContainText('25 MiB');
  await expect(page.locator('#deck-grid .deck-card')).toHaveCount(0);

  await page.evaluate(() => {
    document.querySelector('#deck-html').value =
      `<html><head><title>Five MiB</title></head><body>${'x'.repeat(5 * 1024 * 1024)}</body></html>`;
  });
  await page.click('#save-deck-btn');
  await expect(cardByTitle(page, 'Five MiB')).toBeVisible({ timeout: 15000 });
});

test('front page, guide dialog, and Utharam footer persist after saving', async ({ page }) => {
  await ready(page);
  await addDeck(page, deckHtml, DECK_TITLE);

  await expect(page.locator('#front-page')).toBeVisible();
  await expect(page.locator('#library-section')).toBeVisible();
  await expect(page.locator('#deck-count')).toHaveText('1 deck');
  await expect(page.locator('#empty-state')).toBeHidden();
  await expect(page.locator('.app-footer')).toBeVisible();
  await expect(page.getByRole('link', { name: 'utharam.in' })).toHaveAttribute('href', 'https://utharam.in');

  await page.click('#guide-btn');
  await expect(page.locator('#guide-dialog')).toBeVisible();
  await expect(page.locator('#guide-dialog')).toContainText('Ctrl');
  await expect(page.locator('#guide-dialog')).toContainText('drag');
  await expect(page.locator('#guide-dialog')).toContainText('LLM');
  await expect(page.locator('#guide-dialog')).toContainText('self-contained HTML');
  await page.click('#guide-close-btn');
  await expect(page.locator('#guide-dialog')).toBeHidden();
});

test('dropping an html file anywhere opens the add dialog, not a new tab', async ({ page, context }) => {
  await ready(page);
  const opened = [];
  context.on('page', (p) => opened.push(p));
  const dataTransfer = await page.evaluateHandle((html) => {
    const dt = new DataTransfer();
    dt.items.add(new File([html], 'dropped-deck.html', { type: 'text/html' }));
    return dt;
  }, deckHtml);

  await page.dispatchEvent('body', 'dragover', { dataTransfer });
  await page.dispatchEvent('body', 'drop', { dataTransfer });

  await expect(page.locator('#import-dialog')).toBeVisible();
  await expect(page.locator('#deck-html')).toHaveValue(deckHtml);
  expect(opened).toHaveLength(0);
  expect(page.url()).not.toContain('dropped-deck.html');
});
