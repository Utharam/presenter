import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const deck3 = readFileSync(new URL('../fixtures/deck-3slides.html', import.meta.url), 'utf8');
const deckSingle = readFileSync(new URL('../fixtures/deck-single.html', import.meta.url), 'utf8');

async function openApp(page) {
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

async function openDeck(page, html, title) {
  await openApp(page);
  await addDeck(page, html, title);
  await page.click('#deck-grid .deck-card [data-action="open"]');
  await expect(page.locator('#present-view')).toBeVisible();
  await expect(page.locator('#library-view')).toBeHidden();
}

test('edit shortcut is dead in-app', async ({ page }) => {
  await openDeck(page, deck3);

  const frameBody = page.frameLocator('#present-frame').locator('body');
  await frameBody.click();
  await page.keyboard.press('e');
  await page.keyboard.press('E');
  await page.waitForTimeout(200);

  const result = await frameBody.evaluate((body) => ({
    editMode: body.classList.contains('edit-mode'),
    readonly: body.classList.contains('presenter-readonly'),
    editDisplay: getComputedStyle(document.querySelector('.edit-toggle')).display,
  }));

  expect(result.editMode).toBe(false);
  expect(result.readonly).toBe(true);
  expect(result.editDisplay).toBe('none');
});

test('uppercase E is also swallowed', async ({ page }) => {
  const deck = `<!doctype html><html><body><p>read only</p><script>
    document.addEventListener('keydown', (e) => {
      if (e.key === 'E') document.body.classList.add('edit-mode');
    });
  </script></body></html>`;
  await openDeck(page, deck, 'Upper E');
  const body = page.frameLocator('#present-frame').locator('body');
  await body.click();

  await page.keyboard.press('Shift+E');
  await page.waitForTimeout(200);

  const result = await body.evaluate((b) => ({
    editMode: b.classList.contains('edit-mode'),
    readonly: b.classList.contains('presenter-readonly'),
  }));
  expect(result).toEqual({ editMode: false, readonly: true });
});

test('single strategy hides chrome', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openDeck(page, deckSingle);

  await expect(page.frameLocator('#present-frame').locator('h1')).toHaveText('Plain document');
  await expect(page.locator('#slide-counter')).toBeHidden();
  await expect(page.locator('#progress')).toBeHidden();
  await expect(page.locator('#note-badge')).toBeHidden();

  const urlBefore = page.url();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Space');

  await expect(page.locator('#present-view')).toBeVisible();
  expect(page.url()).toBe(urlBefore);
  expect(errors).toEqual([]);
});

test('invalid fragment still renders', async ({ page }) => {
  await openDeck(page, '<div>hi</div>');

  await expect(page.frameLocator('#present-frame').locator('div')).toHaveText('hi');
  await expect(page.locator('#slide-counter')).toBeHidden();
  await expect(page.locator('#progress')).toBeHidden();
});

test('shortcuts overlay', async ({ page }) => {
  await openDeck(page, deck3);
  const dialog = page.locator('#shortcuts-dialog');
  const counter = page.locator('#slide-counter');
  await expect(counter).toHaveText('1 / 3');

  // Parent context.
  await page.keyboard.press('?');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('#present-view')).toBeVisible();

  // Deck iframe context: the bridge posts presenter:shortcuts.
  await page.frameLocator('#present-frame').locator('body').click();
  await page.keyboard.press('?');
  await expect(dialog).toBeVisible();

  // Navigation is guarded while the dialog is open.
  await page.keyboard.press('ArrowRight');
  await expect(counter).toHaveText('1 / 3');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('#present-view')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(counter).toHaveText('2 / 3');
});

test('Esc peels notes, then shortcuts, then fullscreen/exit', async ({ page }) => {
  await openDeck(page, deck3);
  const dialog = page.locator('#shortcuts-dialog');
  const notes = page.locator('#notes-panel');

  await page.keyboard.press('f');
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);

  await page.keyboard.press('n');
  await expect(notes).toBeVisible();
  await page.click('#shortcuts-btn');
  await expect(dialog).toBeVisible();

  // 1st Esc: notes only, even with the shortcuts dialog open.
  await page.keyboard.press('Escape');
  await expect(notes).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(page.locator('#present-view')).toBeVisible();
  expect(await page.evaluate(() => document.fullscreenElement !== null)).toBe(true);

  // 2nd Esc: shortcuts dialog only, still in fullscreen presentation.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('#present-view')).toBeVisible();
  expect(await page.evaluate(() => document.fullscreenElement !== null)).toBe(true);

  // 3rd Esc: leave presentation and fullscreen.
  await page.keyboard.press('Escape');
  await expect(page.locator('#library-view')).toBeVisible();
  await expect(page.locator('#present-view')).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
});

test('cursor auto-hides', async ({ page }) => {
  await openDeck(page, deck3);

  // First entry starts the timer.
  await expect
    .poll(() => page.evaluate(() => document.body.classList.contains('cursor-idle')), {
      timeout: 3500,
    })
    .toBe(true);

  await page.locator('#exit-present-btn').hover();
  expect(await page.evaluate(() => document.body.classList.contains('cursor-idle'))).toBe(false);

  await expect
    .poll(() => page.evaluate(() => document.body.classList.contains('cursor-idle')), {
      timeout: 3500,
    })
    .toBe(true);

  await page.locator('#shortcuts-btn').hover();
  await expect
    .poll(() => page.evaluate(() => document.body.classList.contains('cursor-idle')), {
      timeout: 2000,
    })
    .toBe(false);
});

test('tab focus cannot reach hidden library chrome', async ({ page }) => {
  await openDeck(page, deck3);
  expect(await page.evaluate(() => document.querySelector('.topbar').inert)).toBe(true);

  const focused = [];
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press('Tab');
    focused.push(
      await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName || '')
    );
  }
  expect(focused).not.toContain('add-deck-btn');
  expect(focused).not.toContain('import-btn');
  expect(focused).not.toContain('export-btn');
  await expect(page.locator('#present-view')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('#library-view')).toBeVisible();
  expect(await page.evaluate(() => document.querySelector('.topbar').inert)).toBe(false);
});

test('reduced motion', async ({ page }) => {
  await openApp(page);
  await addDeck(page, deck3);

  const card = page.locator('#deck-grid .deck-card').first();
  const baseDuration = await card.evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(baseDuration).not.toBe('0s');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reducedDuration = await card.evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(reducedDuration).toBe('0s');
});

test('storage banner when IndexedDB is missing', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { get: () => undefined });
  });
  await openApp(page);

  const banner = page.locator('#storage-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toHaveText('Storage unavailable — changes will not survive a refresh.');

  await addDeck(page, deck3);
  await expect(page.locator('#deck-grid .deck-card')).toHaveCount(1);
});

test('bridge failure disables presenting', async ({ page }) => {
  await page.route('**/src/bridge.js', (route) => route.abort());
  await openApp(page);
  await addDeck(page, deck3);

  await page.click('#deck-grid .deck-card [data-action="open"]');

  const toastRegion = page.locator('#toast-region');
  await expect(toastRegion).toHaveAttribute('role', 'status');
  await expect(toastRegion).toContainText('Presenter failed to load');
  await expect(page.locator('#library-view')).toBeVisible();
  await expect(page.locator('#present-view')).toBeHidden();
  await expect(page.locator('#deck-grid .deck-card')).toHaveCount(1);

  // Toast auto-dismisses after 4s.
  await expect(page.locator('#toast-region .toast')).toHaveCount(0, { timeout: 6000 });

  // Library remains usable.
  await addDeck(page, deckSingle, 'Still usable');
  await expect(page.locator('#deck-grid .deck-card')).toHaveCount(2);
});
