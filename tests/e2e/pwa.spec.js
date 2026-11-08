import { test, expect } from '@playwright/test';

test('PWA manifest, icons, and service worker are available', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');

  const manifestResponse = await request.get('/manifest.webmanifest');
  expect(manifestResponse.ok()).toBe(true);
  expect(manifestResponse.headers()['content-type']).toContain('application/manifest+json');
  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe('Presenter');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.some((icon) => icon.sizes === '192x192')).toBe(true);
  expect(manifest.icons.some((icon) => icon.sizes === '512x512')).toBe(true);
  expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);

  const serviceWorker = await request.get('/sw.js');
  expect(serviceWorker.ok()).toBe(true);
  expect(await serviceWorker.text()).toContain('presenter-');

  for (const icon of ['/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png']) {
    const response = await request.get(icon);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');
  }

  for (const asset of ['/speaker.html', '/speaker.css', '/speaker.js', '/src/prompt-builder.js']) {
    expect((await request.get(asset)).ok()).toBe(true);
  }
});

test('service worker caches the shell for offline use', async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { configurable: true, get: () => false });
  });
  const page = await context.newPage();
  await page.goto('/');
  await page.waitForFunction(() => window.__appReady === true);

  await page.evaluate(async () => {
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error('service worker timeout')), 10000)),
    ]);
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 10000 });

  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => window.__appReady === true, null, { timeout: 10000 });
  await expect(page.locator('#front-page')).toBeVisible();
  await expect(page.locator('#deck-grid')).toBeVisible();
  await context.setOffline(false);
  await context.close();
});
