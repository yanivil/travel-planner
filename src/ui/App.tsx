import { useEffect, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setLang, type Lang } from '../i18n';
import { canRedo, canUndo, redo, subscribeHistory, undo, type Op } from '../store/ops';
import { TripsList } from './TripsList';
import { TripView } from './TripView';

// Flat i18n keys per op family (slashes/dots would fight i18next's separators).
const OP_KEY: Record<Op['t'], string> = {
  'trip/add': 'opTripAdd',
  'trip/remove': 'opTripRemove',
  'trip/update': 'opTripUpdate',
  'day/add': 'opDayAdd',
  'day/remove': 'opDayRemove',
  'day/update': 'opDayUpdate',
  'stop/add': 'opStopAdd',
  'stop/remove': 'opStopRemove',
  'stop/update': 'opStopUpdate',
  'stop/move': 'opStopMove',
  'dismissal/add': 'opDismissalAdd',
  'dismissal/remove': 'opDismissalRemove',
};

let toastSeq = 0;

export function App() {
  const { t, i18n } = useTranslation();
  const [tripId, setTripId] = useState<string | null>(null);
  const [, bumpHistory] = useReducer((x: number) => x + 1, 0);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  useEffect(() => subscribeHistory(bumpHistory), []);

  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(h);
  }, [toast]);

  const doUndo = async () => {
    const op = await undo();
    if (op) setToast({ id: ++toastSeq, text: `${t('undone')}: ${t(OP_KEY[op.t])}` });
  };
  const doRedo = async () => {
    const op = await redo();
    if (op) setToast({ id: ++toastSeq, text: `${t('redone')}: ${t(OP_KEY[op.t])}` });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // native text editing keeps its own undo — never intercept inside fields
      // (instanceof guard: window/document-targeted events have no .closest)
      const target = e.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable]'))
        return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        void doUndo();
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault();
        void doRedo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

  const toggleLang = () => {
    const next: Lang = i18n.language === 'he' ? 'en' : 'he';
    void setLang(next);
  };

  return (
    <div className="app">
      <header className="app-header">
        <button type="button" className="app-title" onClick={() => setTripId(null)}>
          {t('appTitle')}
        </button>
        <div className="row" style={{ gap: '0.3rem' }}>
          <button
            type="button"
            className="btn-ghost"
            aria-label={t('undo')}
            title={t('undo')}
            disabled={!canUndo()}
            onClick={() => void doUndo()}
          >
            ↩
          </button>
          <button
            type="button"
            className="btn-ghost"
            aria-label={t('redo')}
            title={t('redo')}
            disabled={!canRedo()}
            onClick={() => void doRedo()}
          >
            ↪
          </button>
          <button type="button" onClick={toggleLang}>
            {t('switchTo')}
          </button>
        </div>
      </header>
      <main>
        {tripId ? (
          <TripView tripId={tripId} onBack={() => setTripId(null)} />
        ) : (
          <TripsList onOpen={setTripId} />
        )}
      </main>
      {toast && (
        <div className="toast" role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
}
