import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const deck3 = readFileSync(new URL('../fixtures/deck-3slides.html', import.meta.url), 'utf8');
const deckLinks = readFileSync(new URL('../fixtures/deck-links.html', import.meta.url), 'utf8');
const DECK_TITLE = 'Frontend Slides Readiness Test';

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

test('opens a sandboxed blob iframe', async ({ page }) => {
  await openDeck(page, deck3);

  const frame = page.locator('#present-frame');
  await expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
  expect(await frame.getAttribute('src')).toMatch(/^blob:/);
});

test('counter and progress', async ({ page }) => {
  await openDeck(page, deck3);

  const counter = page.locator('#slide-counter');
  await expect(counter).toHaveText('1 / 3');
  await expect(counter).toHaveAttribute('aria-live', 'polite');
  await expect(counter).toHaveAttribute('aria-atomic', 'true');

  const percent = await page.evaluate(() => parseFloat(document.querySelector('#progress-fill').style.width));
  expect(percent).toBeGreaterThanOrEqual(32.33);
  expect(percent).toBeLessThanOrEqual(34.33);
});

test('parent keyboard navigates', async ({ page }) => {
  await openDeck(page, deck3);
  const counter = page.locator('#slide-counter');
  await expect(counter).toHaveText('1 / 3');

  await page.keyboard.press('ArrowRight');
  await expect(counter).toHaveText('2 / 3');
  await page.keyboard.press('End');
  await expect(counter).toHaveText('3 / 3');
  await page.keyboard.press('Home');
  await expect(counter).toHaveText('1 / 3');
  await page.keyboard.press('ArrowLeft');
  await expect(counter).toHaveText('1 / 3');
});

test('iframe keyboard navigates once', async ({ page }) => {
  await openDeck(page, deck3);
  const counter = page.locator('#slide-counter');
  const frameBody = page.frameLocator('#present-frame').locator('body');
  await expect(counter).toHaveText('1 / 3');

  await frameBody.click();
  await page.keyboard.press('ArrowRight');
  await expect(counter).toHaveText('2 / 3');
  await page.keyboard.press('ArrowRight');
  await expect(counter).toHaveText('3 / 3');

  expect(await frameBody.evaluate(() => window.__deckNavCount)).toBe(0);
});

test('F toggles fullscreen', async ({ page }) => {
  await openDeck(page, deck3);

  await page.keyboard.press('f');
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
  await page.keyboard.press('f');
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
});

test('Esc exits with notes closed', async ({ page }) => {
  await openDeck(page, deck3);

  await page.keyboard.press('Escape');
  await expect(page.locator('#library-view')).toBeVisible();
  await expect(page.locator('#present-view')).toBeHidden();
  await expect(page.locator('#present-frame')).toHaveAttribute('src', 'about:blank');
});

test('link click stays in deck frame', async ({ page }) => {
  await openDeck(page, deckLinks, 'Links Deck');
  await expect(page.frameLocator('#present-frame').locator('#ext')).toBeVisible();

  const popupPromise = page.waitForEvent('popup', { timeout: 2000 }).catch(() => null);
  await page.frameLocator('#present-frame').locator('#ext').click();
  const popup = await popupPromise;
  if (popup) await popup.close();
  await page.waitForTimeout(300);

  expect(page.frames().some((frame) => frame.url().startsWith('blob:'))).toBe(true);
  await expect(page.locator('#toast-region')).toContainText('https://example.com/x');
});

test('unsafe link schemes never open an app-origin tab', async ({ page, context }) => {
  const deck = `<!doctype html><html><body>
    <div class="slide"><a id="hash" href="#frag">fragment</a> <a id="js" href="javascript:document.title='pwned'">js</a></div>
    <div class="slide">two</div>
  </body></html>`;
  await openDeck(page, deck, 'Unsafe Links');
  const opened = [];
  context.on('page', (p) => opened.push(p));

  await page.frameLocator('#present-frame').locator('#hash').click();
  await page.waitForTimeout(300);
  await page.frameLocator('#present-frame').locator('#js').click();
  await page.waitForTimeout(300);

  expect(opened).toHaveLength(0);
  expect(page.frames().some((frame) => frame.url().startsWith('blob:'))).toBe(true);
  await expect(page.locator('#toast-region')).toContainText('javascript:');
});

test('shadow-dom link clicks stay in the deck frame', async ({ page, context }) => {
  const deck = `<!doctype html><html><body>
    <div class="slide"><div id="host"></div></div>
    <div class="slide">two</div>
    <script>
      document.getElementById('host').attachShadow({ mode: 'open' }).innerHTML =
        '<a id="shadow" href="#frag">shadow link</a>';
    </script>
  </body></html>`;
  await openDeck(page, deck, 'Shadow Links');
  const opened = [];
  context.on('page', (p) => opened.push(p));

  await page.frameLocator('#present-frame').locator('#shadow').click();
  await page.waitForTimeout(300);

  expect(opened).toHaveLength(0);
  expect(page.frames().some((frame) => frame.url().startsWith('blob:'))).toBe(true);
  await expect(page.locator('#toast-region')).toContainText('blob:');
});

test('deck cannot forge its own blob url into a new tab', async ({ page, context }) => {
  const deck = `<!doctype html><html><body><div class="slide">forged</div><div class="slide">two</div>
    <script>window.parent.postMessage({ type: 'presenter:link', href: location.href }, '*');</script>
  </body></html>`;
  const opened = [];
  context.on('page', (p) => opened.push(p));
  await openDeck(page, deck, 'Forged Link');
  await page.waitForTimeout(500);

  expect(opened).toHaveLength(0);
  expect(page.frames().some((frame) => frame.url().startsWith('blob:'))).toBe(true);
  await expect(page.locator('#toast-region')).toContainText('blob:');
});

test('zoom scales the deck content, not just the controls', async ({ page }) => {
  await openDeck(page, deck3);
  await expect(page.locator('#slide-counter')).toHaveText('1 / 3');
  await expect(page.locator('#zoom-level')).toHaveText('100%');

  await page.click('#zoom-in-btn');
  await expect(page.locator('#zoom-level')).toHaveText('110%');
  await expect
    .poll(() => page.locator('#present-frame').evaluate((el) => el.style.transform))
    .toContain('scale(1.1)');

  await page.click('#zoom-in-btn');
  await expect(page.locator('#zoom-level')).toHaveText('120%');

  await page.click('#zoom-level');
  await expect(page.locator('#zoom-level')).toHaveText('100%');
  await expect
    .poll(() => page.locator('#present-frame').evaluate((el) => el.style.transform))
    .toBe('none');
});

test('ctrl+drag pans a zoomed deck', async ({ page }) => {
  await openDeck(page, deck3);
  await expect(page.locator('#slide-counter')).toHaveText('1 / 3');
  await page.click('#zoom-in-btn');
  await page.click('#zoom-in-btn');
  await expect(page.locator('#zoom-level')).toHaveText('120%');

  await page.keyboard.down('Control');
  await expect(page.locator('#pan-overlay')).toBeVisible();
  const viewport = await page.locator('#present-viewport').boundingBox();
  await page.mouse.move(viewport.x + viewport.width / 2, viewport.y + viewport.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewport.x + viewport.width / 2 + 80, viewport.y + viewport.height / 2 + 40, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up('Control');
  await expect(page.locator('#pan-overlay')).toBeHidden();

  const transform = await page.locator('#present-frame').evaluate((el) => el.style.transform);
  expect(transform).toMatch(/translate\(/);
});

test('built-in tour opens the About deck', async ({ page }) => {
  await openApp(page);
  await page.click('#tour-btn');
  await expect(page.locator('#present-view')).toBeVisible();
  await expect(page.locator('#library-view')).toBeHidden();
  await expect(page.locator('#slide-counter')).toHaveText('1 / 6', { timeout: 15000 });
  await expect(page.frameLocator('#present-frame').locator('body')).toContainText('Your decks, pinned and ready.');

  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#slide-counter')).toHaveText('2 / 6');
});
