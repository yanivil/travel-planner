import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// The preview server (what every Playwright suite runs against) serves the
// SAME headers production does: vercel.json is the single source, so the E2E
// suite guards the real CSP — test/prod header drift cannot happen silently.
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const headerRule = vercel.headers[0];
if (!headerRule) throw new Error('vercel.json: expected a header rule to mirror into vite preview');
const securityHeaders = Object.fromEntries(headerRule.headers.map((h) => [h.key, h.value]));

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // registration is manual in main.tsx (offline-readiness signal, D-028)
      injectRegister: null,
      devOptions: { enabled: false },
      // icons must ride the precache: an installed app in airplane mode still
      // draws its own launcher/splash artwork (default globs cover js/css/html only)
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'] },
      manifest: {
        name: 'Tiyul · טיול',
        short_name: 'Tiyul',
        description: 'Multi-family trip planner — timeline, constraints, offline',
        start_url: '/',
        display: 'standalone',
        background_color: '#F2F1EC',
        theme_color: '#20708F',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  preview: { headers: securityHeaders },
});
