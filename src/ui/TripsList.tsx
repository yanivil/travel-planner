import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../db/db';
import { dispatch } from '../store/ops';
import { loadDemoTrip } from '../fixtures/yahel-demo';

export function TripsList({ onOpen }: { onOpen: (tripId: string) => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const trips = useLiveQuery(() => db.trips.orderBy('id').toArray(), []);

  const createTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = crypto.randomUUID();
    await dispatch({
      t: 'trip/add',
      trip: { id, name: trimmed, createdAt: new Date().toISOString(), maxDriveStretchMin: null },
    });
    setName('');
    onOpen(id);
  };

  const deleteTrip = async (tripId: string) => {
    if (!window.confirm(t('deleteTripConfirm'))) return;
    const trip = await db.trips.get(tripId);
    if (!trip) return;
    const days = await db.days.where('tripId').equals(tripId).toArray();
    const stops = await db.stops.where('dayId').anyOf(days.map((d) => d.id)).toArray();
    const dismissals = await db.dismissals.where('tripId').equals(tripId).toArray();
    await dispatch({ t: 'trip/remove', trip, days, stops, dismissals });
  };

  const loadDemo = async () => {
    const id = await loadDemoTrip();
    onOpen(id);
  };

  return (
    <section aria-label={t('trips')}>
      <h2>{t('trips')}</h2>
      <form className="row" onSubmit={createTrip}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('newTripName')}
          aria-label={t('newTripName')}
        />
        <button type="submit" className="btn-primary">
          {t('create')}
        </button>
        <button type="button" onClick={loadDemo}>
          {t('loadDemo')}
        </button>
      </form>
      <div style={{ marginBlockStart: '1rem' }}>
        {trips?.length === 0 && <p className="muted">{t('empty')}</p>}
        {trips?.map((trip) => (
          <div key={trip.id} className="card trip-item">
            <button type="button" className="trip-open" onClick={() => onOpen(trip.id)}>
              {trip.name}
            </button>
            <button type="button" className="btn-danger btn-ghost" onClick={() => deleteTrip(trip.id)}>
              {t('delete')}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
