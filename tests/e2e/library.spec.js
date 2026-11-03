import { test, expect } from '@playwright/test';

const HARNESS = '/tests/fixtures/library-harness.html';

function makeDeck(id, title, updatedAt) {
  return { id, title, html: `<p>${id}</p>`, createdAt: updatedAt - 1000, updatedAt };
}

async function openLibrary(page) {
  await page.goto(HARNESS);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 });
}

async function clearDb(page) {
  await page.evaluate(() => new Promise((r) => {
    const req = indexedDB.deleteDatabase('html-presenter');
    req.onsuccess = req.onerror = req.onblocked = () => r();
  }));
}

test.beforeEach(async ({ page }) => {
  await openLibrary(page);
  await clearDb(page);
});

test('put/list/get/delete round-trip', async ({ page }) => {
  const d1 = makeDeck('deck-a', 'Alpha', 1000);
  const d2 = makeDeck('deck-b', 'Beta', 2000);
  await page.evaluate((decks) => Promise.all(decks.map((d) => window.lib.putDeck(d))), [d1, d2]);
  const list = await page.evaluate(() => window.lib.listDecks());
  expect(list.map((d) => d.id)).toEqual(['deck-b', 'deck-a']);
  const got = await page.evaluate(() => window.lib.getDeck('deck-a'));
  expect(got).toEqual(d1);
  await page.evaluate(() => window.lib.deleteDeck('deck-a'));
  const after = await page.evaluate(() => window.lib.listDecks());
  expect(after.map((d) => d.id)).toEqual(['deck-b']);
});

test('export then import restores', async ({ page }) => {
  const d1 = makeDeck('e-1', 'One', 5000);
  const d2 = makeDeck('e-2', 'Two', 6000);
  await page.evaluate((decks) => Promise.all(decks.map((d) => window.lib.putDeck(d))), [d1, d2]);
  const json = await page.evaluate(() => window.lib.exportDecks());
  const parsed = JSON.parse(json);
  expect(parsed.app).toBe('html-presenter');
  expect(parsed.version).toBe(1);
  expect(typeof parsed.exportedAt).toBe('string');
  expect(parsed.decks).toHaveLength(2);
  await page.evaluate(async () => {
    for (const d of await window.lib.listDecks()) await window.lib.deleteDeck(d.id);
  });
  expect(await page.evaluate(() => window.lib.listDecks())).toHaveLength(0);
  expect(await page.evaluate((j) => window.lib.importDecks(j), json)).toEqual({ imported: 2, skipped: 0 });
  const restored = await page.evaluate(() => window.lib.listDecks());
  expect(restored.map((d) => d.id).sort()).toEqual(['e-1', 'e-2']);
  const fresh = await page.evaluate(() => window.lib.getDeck('e-1'));
  expect(fresh).toEqual(d1);
});

test('import skips duplicates and invalid entries', async ({ page }) => {
  const d1 = makeDeck('dup-1', 'One', 7000);
  const d2 = makeDeck('dup-2', 'Two', 8000);
  await page.evaluate((decks) => Promise.all(decks.map((d) => window.lib.putDeck(d))), [d1, d2]);
  const json = await page.evaluate(() => window.lib.exportDecks());
  expect(await page.evaluate((j) => window.lib.importDecks(j), json)).toEqual({ imported: 0, skipped: 2 });
  expect(await page.evaluate((j) => window.lib.importDecks(j), json)).toEqual({ imported: 0, skipped: 2 });
  expect(await page.evaluate((j) => window.lib.importDecks('{not json'))).toEqual({ imported: 0, skipped: 0 });
});

test('mixed import counts duplicate and invalid entries', async ({ page }) => {
  const one = makeDeck('mix-1', 'One', 11000);
  const two = makeDeck('mix-2', 'Two', 12000);
  const payload = {
    app: 'html-presenter',
    version: 1,
    exportedAt: new Date().toISOString(),
    decks: [
      one,
      { ...one },
      { id: 'bad-1', title: 'Missing fields' },
      { id: '', title: 'Empty id', html: '<p>x</p>', createdAt: 1, updatedAt: 1 },
      two,
    ],
  };
  const json = JSON.stringify(payload);
  expect(await page.evaluate((j) => window.lib.importDecks(j), json)).toEqual({ imported: 2, skipped: 3 });
  expect(await page.evaluate((j) => window.lib.importDecks(j), json)).toEqual({ imported: 0, skipped: 5 });
  const list = await page.evaluate(() => window.lib.listDecks());
  expect(list.map((d) => d.id)).toEqual(['mix-2', 'mix-1']);
});

test('falls back to memory without indexedDB', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { get: () => undefined });
  });
  await page.goto(HARNESS);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 });
  expect(await page.evaluate(() => window.lib.isPersistent())).toBe(false);
  const d = makeDeck('mem-1', 'Memo', 9000);
  await page.evaluate((deck) => window.lib.putDeck(deck), d);
  const list = await page.evaluate(() => window.lib.listDecks());
  expect(list.map((x) => x.id)).toEqual(['mem-1']);
  expect(await page.evaluate(() => window.lib.getDeck('mem-1'))).toEqual(d);
});

test('writes survive reload', async ({ page }) => {
  const d = makeDeck('p-1', 'Persist', 10000);
  await page.evaluate((deck) => window.lib.putDeck(deck), d);
  await page.reload();
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 });
  const list = await page.evaluate(() => window.lib.listDecks());
  expect(list.map((x) => x.id)).toEqual(['p-1']);
});
