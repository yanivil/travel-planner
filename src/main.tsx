import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './i18n';
import { applyLangToDocument, initialLang } from './i18n';
import { App } from './ui/App';
import './index.css';

applyLangToDocument(initialLang());

// Manual SW registration so the app can expose a deterministic readiness
// signal for the offline E2E (TESTING.md §7) — and for humans, the moment
// the shell is fully precached for zero-bars use.
declare global {
  interface Window {
    __offlineReady?: boolean;
  }
}
registerSW({
  immediate: true,
  onOfflineReady() {
    window.__offlineReady = true;
  },
});

// D-028: request durable storage once at boot — Android grants it silently for
// installed PWAs; elsewhere it's a harmless no.
void navigator.storage?.persist?.().catch(() => undefined);

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
