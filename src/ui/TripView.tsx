import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db, SCHEMA_VERSION } from '../db/db';
import { dispatch } from '../store/ops';
import { computeDaySchedule } from '../domain/schedule';
import { computeConflicts, visibleConflicts } from '../domain/conflicts';
import { zmanimForDate } from '../domain/shabbat';
import { buildTripExportHtml, exportFileName, type ExportDay } from '../domain/exportHtml';
import { DayTimeline } from './DayTimeline';
import { NumberField } from './NumberField';
import type { Trip } from '../domain/types';

const DEFAULT_DAY_START_MIN = 8 * 60;
const DEFAULT_ZONE = 'Asia/Jerusalem';

export function TripView({ tripId, onBack }: { tripId: string; onBack: () => void }) {
  const { t, i18n } = useTranslation();
  // undefined = still loading, null = the trip is gone (e.g. its creation was
  // just undone) — in that case fall back to the list instead of a blank view
  const trip = useLiveQuery(async () => (await db.trips.get(tripId)) ?? null, [tripId]);
  useEffect(() => {
    if (trip === null) onBack();
  }, [trip, onBack]);
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
        lat: null,
        lng: null,
        locationName: null,
      },
    });
    setSelectedDayId(id);
  };

  if (!trip) return null;

  // Gathers everything, recomputes schedules/zmanim/conflicts, and hands one
  // self-contained HTML file to the browser (spec §4.7 — never hostage).
  const exportTrip = async () => {
    const dayRows = await db.days.where('tripId').equals(trip.id).sortBy('index');
    const dismissals = (await db.dismissals.where('tripId').equals(trip.id).toArray()).map((x) => ({
      id: x.id,
      severity: x.severity,
    }));
    const exportDays: ExportDay[] = await Promise.all(
      dayRows.map(async (d) => {
        const stops = await db.stops.where('dayId').equals(d.id).sortBy('index');
        const zman =
          d.date && d.lat != null && d.lng != null
            ? zmanimForDate(d.date, d.lat, d.lng, d.zone, d.locationName)
            : { candleMin: null, havdalahMin: null };
        const schedule = computeDaySchedule(d.startMin, stops);
        const conflicts = computeConflicts(
          { maxDriveStretchMin: trip.maxDriveStretchMin, observance: trip.observance },
          { id: d.id, date: d.date, curfewMin: d.curfewMin, candleMin: zman.candleMin, havdalahMin: zman.havdalahMin },
          stops,
          schedule,
        );
        const { active } = visibleConflicts(conflicts, dismissals);
        const conflictTexts = active.map((c) => {
          const params = { ...c.messageParams };
          if (c.rule === 'CLOSED_DAY') params.d = t(`wd${params.d}`);
          return t(c.messageKey, params);
        });
        return { day: d, stops, candleMin: zman.candleMin, havdalahMin: zman.havdalahMin, conflictTexts };
      }),
    );
    const html = buildTripExportHtml({
      trip,
      days: exportDays,
      lang: i18n.language.startsWith('he') ? 'he' : 'en',
      generatedAtISO: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
    });
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName(trip.name);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

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
            <span className="muted">{t('observance')}</span>
            <select
              aria-label={t('observance')}
              value={trip.observance}
              onChange={(e) =>
                void dispatch({
                  t: 'trip/update',
                  id: trip.id,
                  patch: { observance: e.target.value as Trip['observance'] },
                  prev: { observance: trip.observance },
                })
              }
            >
              <option value="none">{t('obsNone')}</option>
              <option value="soft">{t('obsSoft')}</option>
              <option value="hard">{t('obsHard')}</option>
            </select>
          </label>
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
          <button type="button" onClick={() => void exportTrip()}>
            {t('exportHtml')}
          </button>
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
