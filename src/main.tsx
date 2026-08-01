import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import { applyLangToDocument, initialLang } from './i18n';
import { App } from './ui/App';
import './index.css';

applyLangToDocument(initialLang());

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
