import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { db } from '../db/db';
import { dispatch } from '../store/ops';
import { computeDaySchedule } from '../domain/schedule';
import { computeConflicts, visibleConflicts, type Conflict } from '../domain/conflicts';
import { zmanimForDate } from '../domain/shabbat';
import { PRESET_LOCATIONS, parseLatLng } from '../domain/locations';
import { formatHM, parseHM } from '../domain/time';
import type { StopKind } from '../domain/types';
import { StopRow, type ConflictChip } from './StopRow';
import { ConflictsPanel } from './ConflictsPanel';

const KINDS: StopKind[] = ['activity', 'meal', 'lodging', 'free'];

export function DayTimeline({ dayId }: { dayId: string }) {
  const { t, i18n } = useTranslation();
  const i18nLang = () => i18n.language ?? 'he';
  const day = useLiveQuery(() => db.days.get(dayId), [dayId]);
  const stops = useLiveQuery(
    () => db.stops.where('dayId').equals(dayId).sortBy('index'),
    [dayId],
  );
  const trip = useLiveQuery(
    async () => (day ? db.trips.get(day.tripId) : undefined),
    [day?.tripId],
  );
  const dismissals = useLiveQuery(
    async () => (day ? db.dismissals.where('tripId').equals(day.tripId).toArray() : []),
    [day?.tripId],
  );

  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<StopKind>('activity');
  const [newDuration, setNewDuration] = useState(60);
  const [newLeg, setNewLeg] = useState(0);
  const [newWaze, setNewWaze] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!day || !stops) return null;

  const schedule = computeDaySchedule(day.startMin, stops);
  const scheduleById = new Map(schedule.map((s) => [s.stopId, s]));

  // Zmanim are informational always; they become conflicts only per the
  // trip's observance setting (D-027).
  const zman =
    day.date && day.lat != null && day.lng != null
      ? zmanimForDate(day.date, day.lat, day.lng, day.zone, day.locationName)
      : { candleMin: null, havdalahMin: null };

  // The engine runs on every render — the recompute is pure and cheap, so
  // conflicts can never go stale (spec §4.2).
  const conflicts = computeConflicts(
    { maxDriveStretchMin: trip?.maxDriveStretchMin ?? null, observance: trip?.observance ?? 'none' },
    {
      id: day.id,
      date: day.date,
      curfewMin: day.curfewMin,
      candleMin: zman.candleMin,
      havdalahMin: zman.havdalahMin,
    },
    stops,
    schedule,
  );

  // The Shabbat band sits before the first stop starting at/after candles
  // (or closes the list when the whole plan starts earlier).
  const bandIndex =
    zman.candleMin == null
      ? -1
      : (() => {
          const idx = schedule.findIndex((s) => s.startMin >= zman.candleMin!);
          return idx === -1 ? stops.length : idx;
        })();

  const presetId =
    day.lat != null && day.lng != null
      ? (PRESET_LOCATIONS.find(
          (p) => Math.abs(p.lat - day.lat!) < 0.002 && Math.abs(p.lng - day.lng!) < 0.002,
        )?.id ?? 'custom')
      : '';
  const isHe = i18nLang().startsWith('he');
  const { active, acknowledged } = visibleConflicts(
    conflicts,
    (dismissals ?? []).map((d) => ({ id: d.id, severity: d.severity })),
  );
  const dismissedIds = new Map((dismissals ?? []).map((d) => [d.id, { severity: d.severity }]));

  const conflictText = (c: Conflict) => {
    const params = { ...c.messageParams };
    if (c.rule === 'CLOSED_DAY') params.d = t(`wd${params.d}`);
    return t(c.messageKey, params);
  };
  const chipsByStop = new Map<string, ConflictChip[]>();
  for (const c of active) {
    for (const sid of c.stopIds) {
      const list = chipsByStop.get(sid) ?? [];
      list.push({ severity: c.severity, text: conflictText(c) });
      chipsByStop.set(sid, list);
    }
  }

  const updateDay = (patch: Partial<typeof day>, prev: Partial<typeof day>) =>
    void dispatch({ t: 'day/update', id: day.id, patch, prev });

  const addStop = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    await dispatch({
      t: 'stop/add',
      stop: {
        id: crypto.randomUUID(),
        dayId: day.id,
        index: stops.length,
        name,
        kind: newKind,
        durationMin: Math.max(0, newDuration),
        legAfterMin: newLeg > 0 ? newLeg : null,
        anchorStartMin: null,
        openMin: null,
        closeMin: null,
        lastEntryMin: null,
        closedWeekdays: null,
        wazeQuery: newWaze.trim() || undefined,
      },
    });
    setNewName('');
    setNewWaze('');
  };

  const moveStop = (from: number, to: number) => {
    if (to < 0 || to >= stops.length || from === to) return;
    void dispatch({ t: 'stop/move', dayId: day.id, from, to });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active: dragged, over } = event;
    if (!over || dragged.id === over.id) return;
    const from = stops.findIndex((s) => s.id === dragged.id);
    const to = stops.findIndex((s) => s.id === over.id);
    if (from >= 0 && to >= 0) moveStop(from, to);
  };

  return (
    <section aria-label={day.title}>
      <div className="row">
        <label className="row" style={{ gap: '0.4rem' }}>
          <span className="muted">{t('dayStart')}</span>
          <input
            type="time"
            value={formatHM(day.startMin)}
            onChange={(e) => {
              const startMin = parseHM(e.target.value);
              if (startMin != null) updateDay({ startMin }, { startMin: day.startMin });
            }}
          />
        </label>
        <label className="row" style={{ gap: '0.4rem' }}>
          <span className="muted">{t('dayDate')}</span>
          <input
            type="date"
            aria-label={t('dayDate')}
            value={day.date ?? ''}
            onChange={(e) => updateDay({ date: e.target.value || undefined }, { date: day.date })}
          />
        </label>
        <label className="row" style={{ gap: '0.4rem' }}>
          <span className="muted">{t('curfew')}</span>
          <input
            type="time"
            aria-label={t('curfew')}
            value={day.curfewMin != null ? formatHM(day.curfewMin) : ''}
            onChange={(e) => {
              const curfewMin = parseHM(e.target.value);
              if (curfewMin != null) updateDay({ curfewMin }, { curfewMin: day.curfewMin });
            }}
          />
          {day.curfewMin != null && (
            <button
              type="button"
              className="btn-ghost clear-btn"
              aria-label={`${t('clear')} ${t('curfew')}`}
              onClick={() => updateDay({ curfewMin: null }, { curfewMin: day.curfewMin })}
            >
              ✕
            </button>
          )}
        </label>
        <label className="row" style={{ gap: '0.4rem' }}>
          <span className="muted">{t('location')}</span>
          <select
            aria-label={t('location')}
            value={presetId}
            onChange={(e) => {
              const id = e.target.value;
              if (id === '') {
                updateDay(
                  { lat: null, lng: null, locationName: null },
                  { lat: day.lat, lng: day.lng, locationName: day.locationName },
                );
                return;
              }
              const p = PRESET_LOCATIONS.find((x) => x.id === id);
              if (p)
                updateDay(
                  { lat: p.lat, lng: p.lng, locationName: isHe ? p.he : p.en },
                  { lat: day.lat, lng: day.lng, locationName: day.locationName },
                );
            }}
          >
            <option value="">—</option>
            {PRESET_LOCATIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {isHe ? p.he : p.en}
              </option>
            ))}
            {presetId === 'custom' && (
              <option value="custom" disabled>
                {day.locationName ?? `${day.lat?.toFixed(3)},${day.lng?.toFixed(3)}`}
              </option>
            )}
          </select>
          <input
            aria-label={t('locPaste')}
            placeholder={t('locPaste')}
            size={18}
            onBlur={(e) => {
              const parsed = parseLatLng(e.target.value);
              if (parsed) {
                updateDay(
                  { lat: parsed.lat, lng: parsed.lng, locationName: null },
                  { lat: day.lat, lng: day.lng, locationName: day.locationName },
                );
                e.target.value = '';
              }
            }}
          />
        </label>
        {zman.candleMin != null && (
          <span className="chip sandy" title={t('zmanApprox')}>
            🕯 {t('candleAt', { t: formatHM(zman.candleMin) })}
          </span>
        )}
        {zman.havdalahMin != null && (
          <span className="chip sandy" title={t('zmanApprox')}>
            ✨ {t('havdalahAt', { t: formatHM(zman.havdalahMin) })}
          </span>
        )}
      </div>

      {stops.length === 0 && <p className="muted">{t('noStops')}</p>}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ol className="stop-list">
            {stops.map((stop, i) => {
              const sched = scheduleById.get(stop.id);
              if (!sched) return null;
              return (
                <>
                  {i === bandIndex && (
                    <li key={`band-${stop.id}`} className="shabbat-band" aria-label={t('shabbatEnters', { t: formatHM(zman.candleMin ?? 0) })}>
                      🕯 {t('shabbatEnters', { t: formatHM(zman.candleMin ?? 0) })}
                    </li>
                  )}
                  <StopRow
                    key={stop.id}
                    stop={stop}
                    tripId={day.tripId}
                    scheduled={sched}
                    isFirst={i === 0}
                    isLast={i === stops.length - 1}
                    conflictChips={chipsByStop.get(stop.id) ?? []}
                    onMoveUp={() => moveStop(i, i - 1)}
                    onMoveDown={() => moveStop(i, i + 1)}
                  />
                </>
              );
            })}
            {bandIndex === stops.length && stops.length > 0 && (
              <li className="shabbat-band">
                🕯 {t('shabbatEnters', { t: formatHM(zman.candleMin ?? 0) })}
              </li>
            )}
          </ol>
        </SortableContext>
      </DndContext>

      {stops.length > 0 && (
        <ConflictsPanel
          tripId={day.tripId}
          active={active}
          acknowledged={acknowledged}
          dismissedIds={dismissedIds}
        />
      )}

      <form className="add-form" onSubmit={addStop}>
        <label>
          {t('stopName')}
          <input value={newName} onChange={(e) => setNewName(e.target.value)} />
        </label>
        <label>
          {t('durationMin')}
          <input
            type="number"
            min={0}
            value={newDuration}
            onChange={(e) => setNewDuration(Number(e.target.value))}
          />
        </label>
        <label>
          {t('legMin')}
          <input
            type="number"
            min={0}
            value={newLeg}
            onChange={(e) => setNewLeg(Number(e.target.value))}
          />
        </label>
        <label>
          {t('kindActivity')}
          <select value={newKind} onChange={(e) => setNewKind(e.target.value as StopKind)}>
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`kind${kind[0]?.toUpperCase()}${kind.slice(1)}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('wazePlace')}
          <input value={newWaze} onChange={(e) => setNewWaze(e.target.value)} />
        </label>
        <button type="submit" className="btn-primary">
          {t('addStop')}
        </button>
      </form>
    </section>
  );
}
