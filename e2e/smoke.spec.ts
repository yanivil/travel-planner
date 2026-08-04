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
  await page.getByLabel('Drive to next stop (min) — Pool').fill('25');
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

  // move the reservation before the previous end → hard OVERLAP conflict,
  // shown as a chip on the card AND a card in the conflicts drawer
  await page.getByLabel('Pinned start — Lunch').fill('08:30');
  await expect(page.getByText('08:30–09:30')).toBeVisible();
  await expect(page.getByText(/starts before "Drive" ends \(30 min overlap\)/).first()).toBeVisible();
  await expect(page.locator('.conflict-card.sev-hard')).toBeVisible();
});

test('a soft curfew conflict can be acknowledged and the acknowledgement survives reload', async ({ page }) => {
  await switchToEnglish(page);
  await page.getByLabel('Trip name').fill('Engine');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('button', { name: '+ Add day' }).click();

  const form = page.locator('.add-form');
  await form.getByLabel('Stop name').fill('Dinner');
  await form.getByLabel('Duration (min)').fill('120');
  await form.getByRole('button', { name: 'Add stop' }).click();
  await expect(page.getByText('08:00–10:00')).toBeVisible();

  await page.getByLabel('Back by').fill('09:30');
  await expect(page.getByText(/The day ends 30 min after the 09:30 curfew/).first()).toBeVisible();

  await page.getByRole('button', { name: 'Acknowledge' }).click();
  await expect(page.getByText(/No conflicts/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Acknowledged (1)' })).toBeVisible();

  // the acknowledgement is stored data, not UI state — it survives a reload
  await page.reload();
  await page.getByRole('button', { name: 'Engine' }).click();
  await expect(page.getByText(/No conflicts/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Acknowledged (1)' })).toBeVisible();
});

test('Ctrl+Z undoes the last edit and the Redo button replays it (#16)', async ({ page }) => {
  await switchToEnglish(page);
  await page.getByLabel('Trip name').fill('UndoTrip');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('button', { name: '+ Add day' }).click();

  const form = page.locator('.add-form');
  await form.getByLabel('Stop name').fill('Picnic');
  await form.getByLabel('Duration (min)').fill('60');
  await form.getByRole('button', { name: 'Add stop' }).click();
  await expect(page.getByText('08:00–09:00')).toBeVisible();

  await page.keyboard.press('Control+z');
  await expect(page.getByText('Undone: add stop')).toBeVisible();
  await expect(page.getByText('08:00–09:00')).toBeHidden();

  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByText('Redone: add stop')).toBeVisible();
  await expect(page.getByText('08:00–09:00')).toBeVisible();
});

test('HTML export downloads a self-contained file that opens with zero network (#17)', async ({ page, browserName }) => {
  await switchToEnglish(page);
  await page.getByRole('button', { name: 'Load demo trip (Yahel)' }).click();
  await expect(page.getByRole('heading', { name: 'סופ״ש ביהל (הדגמה)' })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export (HTML)' }).click();
  const download = await downloadPromise;
  const filePath = await download.path();
  const fs = await import('node:fs/promises');
  const content = await fs.readFile(filePath!, 'utf-8');
  expect(content).toContain('tiyul-schema-version');
  expect(content).toContain('חמישי — הגעה');

  // the true zero-bars proof: open the downloaded file itself.
  // Chromium only — Playwright's WebKit doesn't reliably load file:// pages
  // (same family of headless-WebKit limits recorded in TESTING.md §7).
  if (browserName === 'chromium') {
    await page.goto('file://' + filePath);
    await expect(page.getByText('שישי — תמנע')).toBeVisible();
    await expect(page.getByText(/Candles 18:46/)).toBeVisible(); // EN labels, HE data
    await expect(page.getByText('14:00–15:00')).toBeVisible();
  }
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
