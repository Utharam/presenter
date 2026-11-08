import { test, expect } from '@playwright/test';

async function ready(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.__appReady === true, null, { timeout: 10000 });
  await page.waitForSelector('#deck-grid');
}

function rows(page) {
  return page.locator('#prompt-slides .prompt-slide');
}

test('prompt dialog generates the canonical slide + speaker-notes contract', async ({ page }) => {
  await ready(page);

  await page.click('#prompt-btn');
  await expect(page.locator('#prompt-dialog')).toBeVisible();

  await page.fill('#prompt-slide-count', '3');
  await expect(rows(page)).toHaveCount(3);
  await page.fill('#prompt-brief', 'Quarterly review for Orca Labs');
  await rows(page).nth(0).locator('textarea[data-prompt-content]').fill('Why we shipped early');
  await rows(page).nth(0).locator('textarea[data-prompt-note]').fill('Open with the win, then the numbers.');

  const prompt = await page.locator('#prompt-output').inputValue();

  // Canonical per-slide contract, including hidden speaker notes.
  expect(prompt).toContain('<section class="slide">');
  expect(prompt).toContain('<div class="slide-body">');
  expect(prompt).toContain('data-speaker-notes hidden');
  expect(prompt).toContain('Plain spoken notes.');
  expect(prompt).toContain('never mixed into .slide-body');
  expect(prompt).toContain('Return only the complete HTML document.');

  // Every requested slide number gets a content and note outline line.
  for (let i = 1; i <= 3; i++) {
    expect(prompt).toContain(`Slide ${i}`);
    expect(prompt).toContain('Content outline');
    expect(prompt).toContain('Speaker note outline');
  }
  expect(prompt).not.toContain('Slide 4');

  // Entered outlines land in the prompt.
  expect(prompt).toContain('Content outline: Why we shipped early');
  expect(prompt).toContain('Speaker note outline: Open with the win, then the numbers.');
  // Brief lands in the prompt.
  expect(prompt).toContain('Quarterly review for Orca Labs');
});

test('changing the slide count preserves entered outlines', async ({ page }) => {
  await ready(page);

  await page.click('#prompt-btn');
  await page.fill('#prompt-slide-count', '3');
  await expect(rows(page)).toHaveCount(3);
  await rows(page).nth(0).locator('textarea[data-prompt-content]').fill('Keep this outline');
  await rows(page).nth(1).locator('textarea[data-prompt-note]').fill('Note survives count changes');

  await page.fill('#prompt-slide-count', '5');
  await expect(rows(page)).toHaveCount(5);
  await expect(rows(page).nth(0).locator('textarea[data-prompt-content]')).toHaveValue('Keep this outline');
  await expect(rows(page).nth(1).locator('textarea[data-prompt-note]')).toHaveValue(
    'Note survives count changes'
  );

  const prompt = await page.locator('#prompt-output').inputValue();
  expect(prompt).toContain('Content outline: Keep this outline');
  expect(prompt).toContain('Speaker note outline: Note survives count changes');
  for (let i = 1; i <= 5; i++) expect(prompt).toContain(`Slide ${i}`);
  expect(prompt).not.toContain('Slide 6');
});

test('density shapes the prompt and the copy action stays below it', async ({ page }) => {
  await ready(page);
  await page.click('#prompt-btn');

  await page.fill('#prompt-slide-count', '3');
  await page.selectOption('#prompt-density', 'reading');

  let prompt = await page.locator('#prompt-output').inputValue();
  expect(prompt).toContain('Density: Reading-first / high density');
  expect(prompt).toContain('Visual style: many styles are possible');
  expect(prompt).toContain('be innovative');
  expect(prompt).not.toContain('editorial poster, Swiss grid');

  await page.selectOption('#prompt-density', 'speaker');
  prompt = await page.locator('#prompt-output').inputValue();
  expect(prompt).toContain('Density: Speaker-led / low density');

  const layout = await page.evaluate(() => {
    const output = document.querySelector('#prompt-output').getBoundingClientRect();
    const actions = document.querySelector('.prompt-actions').getBoundingClientRect();
    return { outputBottom: output.bottom, actionsTop: actions.top };
  });
  expect(layout.actionsTop).toBeGreaterThanOrEqual(layout.outputBottom - 1);
});

test('guide prompt button opens the same dialog', async ({ page }) => {
  await ready(page);

  await page.click('#guide-btn');
  await expect(page.locator('#guide-dialog')).toBeVisible();
  await page.click('#guide-prompt-btn');
  await expect(page.locator('#prompt-dialog')).toBeVisible();

  const prompt = await page.locator('#prompt-output').inputValue();
  expect(prompt).toContain('data-speaker-notes hidden');
  expect(prompt).toContain('Return only the complete HTML document.');

  await page.click('#prompt-close-btn');
  await expect(page.locator('#prompt-dialog')).toBeHidden();
  await page.click('#guide-close-btn');
  await expect(page.locator('#guide-dialog')).toBeHidden();
});
