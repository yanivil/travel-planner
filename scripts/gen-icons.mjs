#!/usr/bin/env node
// Regenerates the committed PWA raster icons from public/icon.svg (the single
// source of truth), using the repo's own Playwright Chromium — no image deps.
// Re-run after any icon.svg change:  node scripts/gen-icons.mjs
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8');

// Maskable icons must bleed to the edge: launchers crop up to ~10% per side
// and apply their own shape, so the rounded card becomes a full square and
// the artwork is pulled into the central 80% safe zone.
const CARD = '<rect width="64" height="64" rx="14" fill="#20708F"/>';
if (!svg.includes(CARD)) throw new Error('icon.svg background changed — update gen-icons.mjs to match');
const maskable = svg
  .replace(
    CARD,
    '<rect width="64" height="64" fill="#20708F"/><g transform="translate(32 32) scale(0.72) translate(-32 -32)">',
  )
  .replace('</svg>', '</g></svg>');

const browser = await chromium.launch();
const page = await browser.newPage();

async function rasterize(source, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><body style="margin:0">${source.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`,
  );
  // omitBackground keeps the rounded corners of the non-maskable icons transparent
  writeFileSync(
    new URL(`../public/${file}`, import.meta.url),
    await page.screenshot({ type: 'png', omitBackground: true }),
  );
  console.log(`${file}  ${size}×${size}`);
}

await rasterize(svg, 192, 'icon-192.png');
await rasterize(svg, 512, 'icon-512.png');
await rasterize(maskable, 192, 'icon-maskable-192.png');
await rasterize(maskable, 512, 'icon-maskable-512.png');
// iOS home screen: full-bleed square; iOS rounds the corners itself
await rasterize(maskable, 180, 'apple-touch-icon.png');

await browser.close();
