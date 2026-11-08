import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const deck3 = readFileSync(new URL('../fixtures/deck-3slides.html', import.meta.url), 'utf8');
const notesDeck = readFileSync(new URL('../fixtures/deck-notes.html', import.meta.url), 'utf8');

const DECK3_TITLE = 'Frontend Slides Readiness Test';
const NOTES_DECK_TITLE = 'Speaker Notes Fixture';
const OVERRIDE = 'Library override spoken here';

async function ready(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.__appReady === true, null, { timeout: 10000 });
  await page.waitForSelector('#deck-grid');
}

async function addDeck(page, html) {
  await page.click('#add-deck-btn');
  await expect(page.locator('#import-dialog')).toBeVisible();
  await page.fill('#deck-html', html);
  await page.click('#save-deck-btn');
  await expect(page.locator('#import-dialog')).toBeHidden();
}

async function cardByTitle(page, title) {
  const card = page.locator('#deck-grid .deck-card').filter({
    has: page.locator('.deck-title', { hasText: title }),
  });
  await expect(card).toHaveCount(1);
  return card;
}

async function openNotesEditor(page, title) {
  const card = await cardByTitle(page, title);
  const notesBtn = card.locator('button[data-action="notes"]');
  await expect(notesBtn).toHaveAttribute('aria-label', `Edit speaker notes for ${title}`);
  await notesBtn.click();
  await expect(page.locator('#notes-editor-dialog')).toBeVisible();
  await expect(page.locator('#notes-editor-deck')).toHaveText(title);
}

async function presentInRehearse(page, title) {
  const card = await cardByTitle(page, title);
  await card.locator('button[data-action="modes"]').click();
  await expect(page.locator('#present-dialog')).toBeVisible();
  await page.click('[data-present-mode="rehearse"]');
  await expect(page.locator('#present-view')).toBeVisible();
  await expect(page.locator('#library-view')).toBeHidden();
  await expect(page.locator('#notes-panel')).toBeVisible();
  await expect(page.locator('#slide-counter')).toHaveText('1 / 3');
}

test('notes editor shows one field per slide and autosaves edits', async ({ page }) => {
  await ready(page);
  await addDeck(page, deck3);

  await openNotesEditor(page, DECK3_TITLE);

  // deck-3slides has three .slide elements and no embedded notes: three rows,
  // empty fields, not an error.
  const rows = page.locator('#notes-editor-list .notes-editor-row');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('Slide 1');
  await expect(rows.nth(1)).toContainText('Slide 2');
  await expect(rows.nth(2)).toContainText('Slide 3');
  await expect(rows.nth(0).locator('textarea')).toHaveValue('');

  await rows.nth(1).locator('textarea').fill(OVERRIDE);
  await expect(page.locator('#notes-editor-status')).toHaveText('Saved');

  await page.click('#notes-editor-done');
  await expect(page.locator('#notes-editor-dialog')).toBeHidden();
});

test('library notes persist across reload for the edited slide', async ({ page }) => {
  await ready(page);
  await addDeck(page, deck3);

  await openNotesEditor(page, DECK3_TITLE);
  const rows = page.locator('#notes-editor-list .notes-editor-row');
  await rows.nth(1).locator('textarea').fill(OVERRIDE);
  await expect(page.locator('#notes-editor-status')).toHaveText('Saved');
  await page.click('#notes-editor-done');
  await expect(page.locator('#notes-editor-dialog')).toBeHidden();

  await page.reload();
  await page.waitForFunction(() => window.__appReady === true, null, { timeout: 10000 });
  await openNotesEditor(page, DECK3_TITLE);
  await expect(rows.nth(1).locator('textarea')).toHaveValue(OVERRIDE);

  await page.click('#notes-editor-close-btn');
  await expect(page.locator('#notes-editor-dialog')).toBeHidden();
});

test('edited library note is presented in Rehearse for slide 2', async ({ page }) => {
  await ready(page);
  await addDeck(page, deck3);

  await openNotesEditor(page, DECK3_TITLE);
  const rows = page.locator('#notes-editor-list .notes-editor-row');
  await rows.nth(1).locator('textarea').fill(OVERRIDE);
  await expect(page.locator('#notes-editor-status')).toHaveText('Saved');
  await page.click('#notes-editor-done');
  await expect(page.locator('#notes-editor-dialog')).toBeHidden();

  await presentInRehearse(page, DECK3_TITLE);
  await page.locator('#present-viewport').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#slide-counter')).toHaveText('2 / 3');
  await expect(page.locator('#deck-notes')).toContainText(OVERRIDE);
});

test('deck-authored notes are pre-filled and still presented untouched', async ({ page }) => {
  await ready(page);
  await addDeck(page, notesDeck);

  // Opening the editor pre-fills slide 1 with the embedded deck note.
  await openNotesEditor(page, NOTES_DECK_TITLE);
  const rows = page.locator('#notes-editor-list .notes-editor-row');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0).locator('textarea')).toHaveValue('Open with the promise.');
  await expect(rows.nth(1).locator('textarea')).toHaveValue('Pause after the second frame.');
  await page.click('#notes-editor-close-btn');
  await expect(page.locator('#notes-editor-dialog')).toBeHidden();

  // With no library override saved, the deck-authored note is still presented.
  await presentInRehearse(page, NOTES_DECK_TITLE);
  await expect(page.locator('#deck-notes')).toContainText('Open with the promise.');
  await page.locator('#present-viewport').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#slide-counter')).toHaveText('2 / 3');
  await expect(page.locator('#deck-notes')).toContainText('Pause after the second frame.');
});
