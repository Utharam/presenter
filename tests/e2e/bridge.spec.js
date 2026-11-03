import { test, expect } from '@playwright/test';

const harness = (deck) => `/tests/fixtures/bridge-harness.html?deck=${deck}`;

async function waitReady(page) {
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 });
}

async function lastMsg(page, type) {
  return page.evaluate((t) => {
    const found = [...window.__msgs].reverse().find((m) => m.type === t);
    if (!found) return null;
    const { __origin, ...payload } = found;
    return payload;
  }, type);
}

test('ready reports 3 slides / api', async ({ page }) => {
  await page.goto(harness('deck-3slides.html'));
  await waitReady(page);
  expect(await lastMsg(page, 'presenter:ready')).toEqual({ type: 'presenter:ready', total: 3, strategy: 'api' });
});

test('next advances exactly one', async ({ page }) => {
  await page.goto(harness('deck-3slides.html'));
  await waitReady(page);
  await page.evaluate(() => window.__send({ cmd: 'next' }));
  await page.waitForFunction(() => window.__msgs.at(-1)?.type === 'presenter:state', null, { timeout: 10000 });
  expect(await lastMsg(page, 'presenter:state')).toEqual({ type: 'presenter:state', index: 1, total: 3 });
});

test('iframe keys are handled once', async ({ page }) => {
  await page.goto(harness('deck-3slides.html'));
  await waitReady(page);
  await page.evaluate(() => window.__send({ cmd: 'next' }));
  await page.waitForFunction(() => window.__msgs.at(-1)?.type === 'presenter:state', null, { timeout: 10000 });
  await page.locator('#deck-frame').focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => {
    const states = window.__msgs.filter((m) => m.type === 'presenter:state');
    return states.length > 1 && states.at(-1).index === 2;
  }, null, { timeout: 10000 });
  expect(await lastMsg(page, 'presenter:state')).toEqual({ type: 'presenter:state', index: 2, total: 3 });
  const navCount = await page
    .frameLocator('#deck-frame')
    .locator('body')
    .evaluate((b) => window.__deckNavCount);
  expect(navCount).toBe(0);
});

test('no-js deck uses slides strategy', async ({ page }) => {
  await page.goto(harness('deck-nojs.html'));
  await waitReady(page);
  expect(await lastMsg(page, 'presenter:ready')).toEqual({ type: 'presenter:ready', total: 3, strategy: 'slides' });
  await page.locator('#deck-frame').focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => window.__msgs.some((m) => m.type === 'presenter:state'), null, { timeout: 10000 });
  expect(await lastMsg(page, 'presenter:state')).toEqual({ type: 'presenter:state', index: 1, total: 3 });
});

test('no-js deck shows its first slide before any navigation', async ({ page }) => {
  await page.goto(harness('deck-nojs.html'));
  await waitReady(page);
  const slides = await page
    .frameLocator('#deck-frame')
    .locator('.slide')
    .evaluateAll((els) =>
      els.map((el) => ({
        display: getComputedStyle(el).display,
        active: el.classList.contains('active'),
        visible: el.classList.contains('visible'),
      }))
    );
  expect(slides[0]).toEqual({ display: 'block', active: true, visible: true });
  expect(slides.slice(1)).toEqual([
    { display: 'none', active: false, visible: false },
    { display: 'none', active: false, visible: false },
  ]);
});

test('sections deck uses sections strategy and starts on section one', async ({ page }) => {
  await page.goto(harness('deck-sections.html'));
  await waitReady(page);
  expect(await lastMsg(page, 'presenter:ready')).toEqual({
    type: 'presenter:ready',
    total: 3,
    strategy: 'sections',
  });
  const sections = await page
    .frameLocator('#deck-frame')
    .locator('section')
    .evaluateAll((els) =>
      els.map((el) => ({
        display: getComputedStyle(el).display,
        active: el.classList.contains('active'),
        visible: el.classList.contains('visible'),
      }))
    );
  expect(sections[0]).toEqual({ display: 'block', active: true, visible: true });
  expect(sections.slice(1)).toEqual([
    { display: 'none', active: false, visible: false },
    { display: 'none', active: false, visible: false },
  ]);

  await page.locator('#deck-frame').focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => window.__msgs.some((m) => m.type === 'presenter:state'), null, { timeout: 10000 });
  expect(await lastMsg(page, 'presenter:state')).toEqual({ type: 'presenter:state', index: 1, total: 3 });
});

test('plain doc is single strategy', async ({ page }) => {
  await page.goto(harness('deck-single.html'));
  await waitReady(page);
  expect(await lastMsg(page, 'presenter:ready')).toEqual({ type: 'presenter:ready', total: 1, strategy: 'single' });
  await page.locator('#deck-frame').focus();
  const before = await page.evaluate(() => window.__msgs.filter((m) => m.type === 'presenter:state').length);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => window.__msgs.filter((m) => m.type === 'presenter:state').length);
  expect(after).toBe(before);
});

test('links post presenter:link', async ({ page }) => {
  await page.goto(harness('deck-links.html'));
  await waitReady(page);
  const urlBefore = page.url();
  await page.frameLocator('#deck-frame').locator('#ext').click();
  await page.waitForFunction(
    () => window.__msgs.some((m) => m.type === 'presenter:link'),
    null,
    { timeout: 10000 }
  );
  expect(await lastMsg(page, 'presenter:link')).toEqual({
    type: 'presenter:link',
    href: 'https://example.com/x',
  });
  expect(page.url()).toBe(urlBefore);
});

test('read-only hides edit UI and blocks E', async ({ page }) => {
  await page.goto(harness('deck-3slides.html'));
  await waitReady(page);
  const display = await page
    .frameLocator('#deck-frame')
    .locator('.edit-toggle')
    .evaluate((el) => getComputedStyle(el).display);
  expect(display).toBe('none');
  const readonly = await page
    .frameLocator('#deck-frame')
    .locator('body')
    .evaluate((b) => b.classList.contains('presenter-readonly'));
  expect(readonly).toBe(true);
  await page.locator('#deck-frame').focus();
  await page.keyboard.press('e');
  await page.waitForTimeout(200);
  const editMode = await page
    .frameLocator('#deck-frame')
    .locator('body')
    .evaluate((b) => b.classList.contains('edit-mode'));
  expect(editMode).toBe(false);
});

test('N/F/?/Esc post control messages', async ({ page }) => {
  await page.goto(harness('deck-3slides.html'));
  await waitReady(page);
  await page.locator('#deck-frame').focus();
  await page.keyboard.press('n');
  await page.keyboard.press('f');
  await page.keyboard.press('?');
  await page.keyboard.press('Escape');
  expect(await lastMsg(page, 'presenter:note-toggle')).toEqual({ type: 'presenter:note-toggle' });
  expect(await lastMsg(page, 'presenter:fullscreen')).toEqual({ type: 'presenter:fullscreen' });
  expect(await lastMsg(page, 'presenter:shortcuts')).toEqual({ type: 'presenter:shortcuts' });
  expect(await lastMsg(page, 'presenter:exit')).toEqual({ type: 'presenter:exit' });
});
test('late API deck keeps its own navigator in sync', async ({ page }) => {
  await page.goto(harness('deck-late-api.html'));
  await waitReady(page);
  expect(await lastMsg(page, 'presenter:ready')).toEqual({ type: 'presenter:ready', total: 3, strategy: 'api' });

  await page.locator('#deck-frame').focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => window.__msgs.some((m) => m.type === 'presenter:state'), null, { timeout: 10000 });
  await expect(page.frameLocator('#deck-frame').locator('#nav-label')).toHaveText('Slide 2 / 3');

  await page.frameLocator('#deck-frame').locator('#nav-next').click();
  await page.waitForFunction(() => {
    const states = window.__msgs.filter((m) => m.type === 'presenter:state');
    return states.at(-1)?.index === 2;
  }, null, { timeout: 10000 });
  expect(await lastMsg(page, 'presenter:state')).toEqual({ type: 'presenter:state', index: 2, total: 3 });
});

test('sandboxed localStorage use does not break a deck navigator', async ({ page }) => {
  await page.goto(harness('hand-hygiene.html'));
  await waitReady(page);
  // This deck builds window.presentation on DOMContentLoaded and reads
  // localStorage in its constructor. The ready message may start as "slides";
  // the bridge's upgrade poll must converge on the API and keep the deck's own
  // navigator in sync when the parent sends commands.
  for (let i = 0; i < 6; i += 1) await page.evaluate(() => window.__send({ cmd: 'next' }));
  await page.waitForFunction(
    () => window.__msgs.filter((m) => m.type === 'presenter:state').at(-1)?.index === 6,
    null,
    { timeout: 10000 }
  );
  expect(await lastMsg(page, 'presenter:state')).toEqual({ type: 'presenter:state', index: 6, total: 10 });
  await expect(page.frameLocator('#deck-frame').locator('#deckCounter')).toHaveText('Slide 7 / 10');
});
