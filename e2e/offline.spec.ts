import { test, expect } from '@playwright/test';

// E2E-2 core (TESTING.md §3/§7): the app shell comes back from the service
// worker and the whole plan — including a wallet blob — comes back from
// IndexedDB, with the network dead. Runs only in the offline-chromium project
// (service workers allowed there and nowhere else).

// 1×1 red pixel PNG
const TICKET_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test('shell, plan, zmanim, and wallet all survive a fully offline reload', async ({ page, context }) => {
  await page.goto('/');
  // deterministic SW readiness: the app raises this after precache completes
  await page.waitForFunction(() => window.__offlineReady === true, undefined, { timeout: 30_000 });

  // seed a real plan (Hebrew default UI)
  await page.getByRole('button', { name: 'טעינת טיול הדגמה (יהל)' }).click();
  await expect(page.getByRole('heading', { name: 'סופ״ש ביהל (הדגמה)' })).toBeVisible();

  // attach a ticket to the first Thursday stop
  await page.getByRole('button', { name: /פרטים: הגעה וקבלת חדרים/ }).click();
  await page
    .getByLabel(/צירוף קובץ — הגעה וקבלת חדרים/)
    .setInputFiles({ name: 'ticket.png', mimeType: 'image/png', buffer: TICKET_PNG });
  await expect(page.getByText('ticket.png')).toBeVisible();

  // kill the network, then a full reload — everything must come back
  await context.setOffline(true);
  await page.reload();

  // Playwright's setOffline doesn't flip navigator.onLine / fire the events
  // (TESTING.md §7) — dispatch the event to assert OUR wiring; the event
  // itself is the browser's contract on real connectivity loss.
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.getByText('אופליין')).toBeVisible(); // offline indicator
  await page.getByRole('button', { name: 'סופ״ש ביהל (הדגמה)' }).click();
  await expect(page.getByRole('button', { name: 'חמישי — הגעה' })).toBeVisible();
  await expect(page.getByText('14:00–15:00')).toBeVisible(); // computed plan

  // offline zmanim still compute (hebcal is bundled, no network involved)
  await page.getByRole('button', { name: 'שישי — תמנע' }).click();
  await expect(page.getByText('הדלקת נרות 18:46')).toBeVisible();

  // the wallet blob decodes from IndexedDB — the entrance-gate moment
  await page.getByRole('button', { name: 'חמישי — הגעה' }).click();
  await page.getByRole('button', { name: /פרטים: הגעה וקבלת חדרים/ }).click();
  await expect(page.getByText('ticket.png')).toBeVisible();
  const thumb = page.locator('img.att-thumb').first();
  await expect(thumb).toBeVisible();
  expect(await thumb.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});
