import { test, expect, type Page } from '@playwright/test';

// E2E smoke (TESTING.md §3, E2E-1 slice for M0): create → plan → recompute →
// reorder → persist → Waze deep link. Runs on desktop Chromium + iPhone WebKit.

async function switchToEnglish(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('button', { name: 'עברית' })).toBeVisible();
}

test('plan a day: computed times, leg edits, reorder, persistence, Waze link', async ({ page }) => {
  await switchToEnglish(page);

  // create a trip
  await page.getByLabel('Trip name').fill('Test trip');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name: 'Test trip' })).toBeVisible();

  // add a day — starts at 08:00 by default
  await page.getByRole('button', { name: '+ Add day' }).click();
  await expect(page.getByRole('button', { name: 'Day 1' })).toBeVisible();

  // add two stops
  const form = page.locator('.add-form');
  await form.getByLabel('Stop name').fill('Pool');
  await form.getByLabel('Duration (min)').fill('150');
  await form.getByRole('button', { name: 'Add stop' }).click();
  await expect(page.getByText('08:00–10:30')).toBeVisible();

  await form.getByLabel('Stop name').fill('Timna');
  await form.getByLabel('Duration (min)').fill('180');
  await form.getByLabel('Place for Waze (optional)').fill('Timna Park');
  await form.getByRole('button', { name: 'Add stop' }).click();
  await expect(page.getByText('10:30–13:30')).toBeVisible();

  // set a 25-minute drive after Pool → Timna shifts to 10:55
  await page.getByLabel('Drive after (min) — Pool').fill('25');
  await expect(page.getByText('10:55–13:55')).toBeVisible();
  await expect(page.getByText(/25 min · 10:55/)).toBeVisible();

  // reorder: Pool moves last; Timna leads and all times recompute
  await page.getByRole('button', { name: 'Move down: Pool' }).click();
  await expect(page.getByText('08:00–11:00')).toBeVisible(); // Timna first
  await expect(page.getByText('11:00–13:30')).toBeVisible(); // Pool follows, no leg between

  // Waze deep link carries the encoded place
  await expect(page.getByRole('link', { name: /Waze/ })).toHaveAttribute(
    'href',
    'https://waze.com/ul?q=Timna%20Park&navigate=yes',
  );

  // data survives a full reload (IndexedDB persistence)
  await page.reload();
  await page.getByRole('button', { name: 'Test trip' }).click();
  await expect(page.getByRole('button', { name: 'Day 1' })).toBeVisible();
  await expect(page.getByText('08:00–11:00')).toBeVisible();
});

test('pinning a reservation surfaces slack and lateness (anchors, D-025)', async ({ page }) => {
  await switchToEnglish(page);
  await page.getByLabel('Trip name').fill('Anchors');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('button', { name: '+ Add day' }).click();

  const form = page.locator('.add-form');
  await form.getByLabel('Stop name').fill('Drive');
  await form.getByLabel('Duration (min)').fill('60');
  await form.getByRole('button', { name: 'Add stop' }).click();
  await expect(page.getByText('08:00–09:00')).toBeVisible(); // settle before the next form fill

  await form.getByLabel('Stop name').fill('Lunch');
  await form.getByLabel('Duration (min)').fill('60');
  await form.getByRole('button', { name: 'Add stop' }).click();
  await expect(page.getByText('09:00–10:00')).toBeVisible();

  // pin at the computed start, then move the reservation to 09:45 → slack
  await page.getByRole('button', { name: 'Pin time: Lunch' }).click();
  await page.getByLabel('Pinned start — Lunch').fill('09:45');
  await expect(page.getByText('09:45–10:45')).toBeVisible();
  await expect(page.getByText(/45 min wait/)).toBeVisible();

  // move the reservation before the arrival → flagged late, start stays pinned
  await page.getByLabel('Pinned start — Lunch').fill('08:30');
  await expect(page.getByText('08:30–09:30')).toBeVisible();
  await expect(page.getByText(/Late by 30 min/)).toBeVisible();
});

test('day start edit shifts the whole schedule', async ({ page }) => {
  await switchToEnglish(page);
  await page.getByLabel('Trip name').fill('Shift test');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('button', { name: '+ Add day' }).click();

  const form = page.locator('.add-form');
  await form.getByLabel('Stop name').fill('Breakfast');
  await form.getByLabel('Duration (min)').fill('60');
  await form.getByRole('button', { name: 'Add stop' }).click();
  await expect(page.getByText('08:00–09:00')).toBeVisible();

  await page.getByLabel('Day start').fill('09:30');
  await expect(page.getByText('09:30–10:30')).toBeVisible();
});
