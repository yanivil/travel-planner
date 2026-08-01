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
import { formatHM, parseHM } from '../domain/time';
import type { StopKind } from '../domain/types';
import { StopRow } from './StopRow';

const KINDS: StopKind[] = ['activity', 'meal', 'lodging', 'free'];

export function DayTimeline({ dayId }: { dayId: string }) {
  const { t } = useTranslation();
  const day = useLiveQuery(() => db.days.get(dayId), [dayId]);
  const stops = useLiveQuery(
    () => db.stops.where('dayId').equals(dayId).sortBy('index'),
    [dayId],
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

  const setDayStart = async (text: string) => {
    const startMin = parseHM(text);
    if (startMin == null) return;
    await dispatch({
      t: 'day/update',
      id: day.id,
      patch: { startMin },
      prev: { startMin: day.startMin },
    });
  };

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
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = stops.findIndex((s) => s.id === active.id);
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
            onChange={(e) => setDayStart(e.target.value)}
          />
        </label>
      </div>

      {stops.length === 0 && <p className="muted">{t('noStops')}</p>}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ol className="stop-list">
            {stops.map((stop, i) => {
              const sched = scheduleById.get(stop.id);
              if (!sched) return null;
              return (
                <StopRow
                  key={stop.id}
                  stop={stop}
                  scheduled={sched}
                  isFirst={i === 0}
                  isLast={i === stops.length - 1}
                  onMoveUp={() => moveStop(i, i - 1)}
                  onMoveDown={() => moveStop(i, i + 1)}
                />
              );
            })}
          </ol>
        </SortableContext>
      </DndContext>

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
