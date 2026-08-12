import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // registration is manual in main.tsx (offline-readiness signal, D-028)
      injectRegister: null,
      devOptions: { enabled: false },
      manifest: {
        name: 'Tiyul · טיול',
        short_name: 'Tiyul',
        description: 'Multi-family trip planner — timeline, constraints, offline',
        start_url: '/',
        display: 'standalone',
        background_color: '#F2F1EC',
        theme_color: '#20708F',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
});
