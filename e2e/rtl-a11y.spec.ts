import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// E2E-4 slice for M0 (TESTING.md §3): Hebrew-first RTL rendering + axe checks
// on the two core screens, in the default (Hebrew) locale.

test('defaults to Hebrew with RTL layout; language toggle flips direction', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(page.getByRole('heading', { name: 'טיולים' })).toBeVisible();

  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

  await page.getByRole('button', { name: 'עברית' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('the demo Yahel trip loads and renders a Hebrew timeline', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'טעינת טיול הדגמה (יהל)' }).click();
  await expect(page.getByRole('heading', { name: 'סופ״ש ביהל (הדגמה)' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'חמישי — תמנע והגעה' })).toBeVisible();
  // Thursday (v6): Timna 12:30–16:00, pool 16:45–18:30, dinner ends 20:30
  await expect(page.getByText('12:30–16:00')).toBeVisible();
  await expect(page.getByText('16:45–18:30')).toBeVisible();
  await expect(page.getByText('18:30–20:30')).toBeVisible();

  // Friday carries real offline zmanim for Yahel: candle badge + Shabbat band.
  // v6 is conflict-free as planned — but flipping שמירת שבת to 'soft' makes
  // the engine flag the Friday-night drive home from Eilat, in Hebrew.
  await page.getByRole('button', { name: 'שישי — בריכה ואילת' }).click();
  await expect(page.getByText('הדלקת נרות 18:46')).toBeVisible();
  await expect(page.getByText('שבת נכנסת · 18:46')).toBeVisible();
  await expect(page.getByText(/נסיעה אחרי הדלקת נרות/)).toHaveCount(0);

  await page.getByLabel('שמירת שבת').selectOption('soft');
  await expect(
    page.getByText(/נסיעה אחרי הדלקת נרות \(18:46\) — יציאה מ"ארוחת ערב באילת"/).first(),
  ).toBeVisible();
});

test('trips screen and timeline have no serious accessibility violations', async ({ page }) => {
  await page.goto('/');
  const home = await new AxeBuilder({ page }).analyze();
  expect(home.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);

  await page.getByRole('button', { name: 'טעינת טיול הדגמה (יהל)' }).click();
  await expect(page.getByRole('button', { name: 'חמישי — תמנע והגעה' })).toBeVisible();
  const timeline = await new AxeBuilder({ page }).analyze();
  expect(timeline.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});
