import { test, expect } from '@playwright/test';

// #21 hardening: the preview server serves vercel.json's headers verbatim
// (vite.config single-sources them), so these assertions hold for production.

test('security headers ride every response and the app runs clean under CSP', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (msg) => {
    if (msg.text().includes('Content Security Policy')) violations.push(msg.text());
  });

  const resp = await page.goto('/');
  const csp = resp?.headers()['content-security-policy'] ?? '';
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(resp?.headers()['x-content-type-options']).toBe('nosniff');

  // drive the app far enough to surface runtime CSP breaks (styles, i18n, live queries)
  await page.getByRole('button', { name: 'טעינת טיול הדגמה (יהל)' }).click();
  await expect(page.getByRole('heading', { name: 'סופ״ש ביהל (הדגמה)' })).toBeVisible();
  await expect(page.getByText('14:00–15:00')).toBeVisible();
  expect(violations).toEqual([]);
});

test('the manifest offers Android-grade icons: 192/512 PNG, any + maskable', async ({ page, request }) => {
  const manifest = (await (await request.get('/manifest.webmanifest')).json()) as {
    icons: { src: string; sizes: string; type: string; purpose?: string }[];
  };

  for (const [sizes, purpose] of [
    ['192x192', 'any'],
    ['512x512', 'any'],
    ['192x192', 'maskable'],
    ['512x512', 'maskable'],
  ] as const) {
    const icon = manifest.icons.find(
      (i) => i.sizes === sizes && (i.purpose ?? 'any') === purpose && i.type === 'image/png',
    );
    expect(icon, `manifest icon ${sizes}/${purpose}`).toBeTruthy();
    const r = await request.get(icon!.src);
    expect(r.status()).toBe(200);
    expect(r.headers()['content-type']).toContain('image/png');
    expect((await r.body()).length).toBeGreaterThan(1000); // real pixels, not a stub
  }

  // iOS home-screen icon is linked and served
  expect((await request.get('/apple-touch-icon.png')).status()).toBe(200);

  // and the bytes decode at the declared size (guards a broken rasterization)
  await page.goto('/');
  const naturalWidth = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img.naturalWidth);
        img.onerror = () => reject(new Error('icon-512.png failed to decode'));
        img.src = '/icon-512.png';
      }),
  );
  expect(naturalWidth).toBe(512);
});
