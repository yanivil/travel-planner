import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../db/db';
import { dispatch } from '../store/ops';
import { DayTimeline } from './DayTimeline';
import { NumberField } from './NumberField';

const DEFAULT_DAY_START_MIN = 8 * 60;
const DEFAULT_ZONE = 'Asia/Jerusalem';

export function TripView({ tripId, onBack }: { tripId: string; onBack: () => void }) {
  const { t } = useTranslation();
  const trip = useLiveQuery(() => db.trips.get(tripId), [tripId]);
  const days = useLiveQuery(
    () => db.days.where('tripId').equals(tripId).sortBy('index'),
    [tripId],
  );
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  const activeDayId = selectedDayId ?? days?.[0]?.id ?? null;
  const [editingName, setEditingName] = useState(false);

  const addDay = async () => {
    const index = days?.length ?? 0;
    const id = crypto.randomUUID();
    await dispatch({
      t: 'day/add',
      day: {
        id,
        tripId,
        index,
        title: t('dayN', { n: index + 1 }),
        startMin: DEFAULT_DAY_START_MIN,
        zone: DEFAULT_ZONE,
        curfewMin: null,
      },
    });
    setSelectedDayId(id);
  };

  if (!trip) return null;

  return (
    <section aria-label={trip.name}>
      <div className="row spread">
        {editingName ? (
          <input
            autoFocus
            aria-label={t('newTripName')}
            defaultValue={trip.name}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            onBlur={(e) => {
              const name = e.target.value.trim();
              if (name && name !== trip.name)
                void dispatch({ t: 'trip/update', id: trip.id, patch: { name }, prev: { name: trip.name } });
              setEditingName(false);
            }}
          />
        ) : (
          <div className="row" style={{ gap: '0.3rem' }}>
            <h2>{trip.name}</h2>
            <button
              type="button"
              className="btn-ghost"
              aria-label={`${t('renameTrip')}: ${trip.name}`}
              onClick={() => setEditingName(true)}
            >
              ✎
            </button>
          </div>
        )}
        <div className="row" style={{ gap: '0.4rem' }}>
          <label className="row" style={{ gap: '0.3rem' }}>
            <span className="muted">{t('maxStretch')}</span>
            <NumberField
              value={trip.maxDriveStretchMin ?? 0}
              ariaLabel={t('maxStretch')}
              onCommit={(v) =>
                void dispatch({
                  t: 'trip/update',
                  id: trip.id,
                  patch: { maxDriveStretchMin: v > 0 ? v : null },
                  prev: { maxDriveStretchMin: trip.maxDriveStretchMin },
                })
              }
            />
          </label>
          <button type="button" onClick={onBack}>
            {t('back')}
          </button>
        </div>
      </div>
      <nav className="day-tabs" aria-label={t('days')}>
        {days?.map((day) => (
          <button
            key={day.id}
            type="button"
            className="day-tab"
            aria-pressed={day.id === activeDayId}
            onClick={() => setSelectedDayId(day.id)}
          >
            {day.title}
          </button>
        ))}
        <button type="button" className="day-tab" onClick={addDay}>
          + {t('addDay')}
        </button>
      </nav>
      {activeDayId && <DayTimeline dayId={activeDayId} />}
    </section>
  );
}
