import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setLang, type Lang } from '../i18n';
import { TripsList } from './TripsList';
import { TripView } from './TripView';

export function App() {
  const { t, i18n } = useTranslation();
  const [tripId, setTripId] = useState<string | null>(null);

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
        <button type="button" onClick={toggleLang}>
          {t('switchTo')}
        </button>
      </header>
      <main>
        {tripId ? (
          <TripView tripId={tripId} onBack={() => setTripId(null)} />
        ) : (
          <TripsList onOpen={setTripId} />
        )}
      </main>
    </div>
  );
}
