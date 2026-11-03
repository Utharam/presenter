import { test, expect } from '@playwright/test';

test('app shell loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('HTML Presenter');
  await expect(page.locator('#library-view')).toBeVisible();
});
