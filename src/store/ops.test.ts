import { beforeEach, describe, expect, test } from 'vitest';
import { createDb, type TiyulDB } from '../db/db';
import { applyOp, dispatch, history, invert, undo, type Op } from './ops';
import type { Day, Stop, Trip } from '../domain/types';

let db: TiyulDB;

beforeEach(() => {
  db = createDb(`tiyul-test-${crypto.randomUUID()}`);
  history.length = 0;
});

const trip: Trip = { id: 'trip-1', name: 'Test', createdAt: '2026-08-01T00:00:00.000Z' };
const day: Day = { id: 'day-1', tripId: trip.id, index: 0, title: 'Day 1', startMin: 480, zone: 'Asia/Jerusalem' };

function stop(id: string, index: number, patch: Partial<Stop> = {}): Stop {
  return {
    id,
    dayId: day.id,
    index,
    name: `Stop ${id}`,
    kind: 'activity',
    durationMin: 60,
    legAfterMin: null,
    ...patch,
  };
}

async function orderedNames(): Promise<string[]> {
  const stops = await db.stops.where('dayId').equals(day.id).sortBy('index');
  return stops.map((s) => s.name);
}

async function assertIndexIntegrity(): Promise<void> {
  const stops = await db.stops.where('dayId').equals(day.id).sortBy('index');
  stops.forEach((s, i) => expect(s.index).toBe(i));
}

describe('invert is an involution (on canonical ops — arrays always present)', () => {
  const ops: Op[] = [
    { t: 'trip/add', trip, days: [], stops: [] },
    { t: 'trip/remove', trip, days: [day], stops: [stop('a', 0)] },
    { t: 'trip/update', id: trip.id, patch: { name: 'B' }, prev: { name: 'A' } },
    { t: 'day/add', day, stops: [] },
    { t: 'day/remove', day, stops: [stop('a', 0)] },
    { t: 'day/update', id: day.id, patch: { startMin: 500 }, prev: { startMin: 480 } },
    { t: 'stop/add', stop: stop('a', 0) },
    { t: 'stop/remove', stop: stop('a', 0) },
    { t: 'stop/update', id: 'a', patch: { durationMin: 90 }, prev: { durationMin: 60 } },
    { t: 'stop/move', dayId: day.id, from: 0, to: 2 },
  ];

  test.each(ops.map((op) => [op.t, op] as const))('invert(invert(%s)) === op', (_, op) => {
    expect(invert(invert(op))).toEqual(op);
  });
});

describe('applyOp structural integrity', () => {
  beforeEach(async () => {
    await applyOp({ t: 'trip/add', trip }, db);
    await applyOp({ t: 'day/add', day }, db);
    for (const [i, id] of ['a', 'b', 'c'].entries()) {
      await applyOp({ t: 'stop/add', stop: stop(id, i) }, db);
    }
  });

  test('move reorders and renumbers contiguously', async () => {
    await applyOp({ t: 'stop/move', dayId: day.id, from: 0, to: 2 }, db);
    expect(await orderedNames()).toEqual(['Stop b', 'Stop c', 'Stop a']);
    await assertIndexIntegrity();
  });

  test('removing a middle stop closes the index gap', async () => {
    const b = await db.stops.get('b');
    await applyOp({ t: 'stop/remove', stop: b! }, db);
    expect(await orderedNames()).toEqual(['Stop a', 'Stop c']);
    await assertIndexIntegrity();
  });

  test('inserting at an occupied index shifts later stops', async () => {
    await applyOp({ t: 'stop/add', stop: stop('d', 1) }, db);
    expect(await orderedNames()).toEqual(['Stop a', 'Stop d', 'Stop b', 'Stop c']);
    await assertIndexIntegrity();
  });

  test('trip/remove cascades to days and stops', async () => {
    const days = await db.days.where('tripId').equals(trip.id).toArray();
    const stops = await db.stops.where('dayId').anyOf(days.map((d) => d.id)).toArray();
    await applyOp({ t: 'trip/remove', trip, days, stops }, db);
    expect(await db.trips.count()).toBe(0);
    expect(await db.days.count()).toBe(0);
    expect(await db.stops.count()).toBe(0);
  });
});

describe('undo (D-020: every op is reversible)', () => {
  test('a full editing session undoes back to an empty database', async () => {
    await dispatch({ t: 'trip/add', trip }, db);
    await dispatch({ t: 'day/add', day }, db);
    await dispatch({ t: 'stop/add', stop: stop('a', 0) }, db);
    await dispatch({ t: 'stop/add', stop: stop('b', 1, { legAfterMin: 25 }) }, db);
    await dispatch({ t: 'stop/move', dayId: day.id, from: 0, to: 1 }, db);
    await dispatch({ t: 'stop/update', id: 'a', patch: { durationMin: 90 }, prev: { durationMin: 60 } }, db);
    const b = await db.stops.get('b');
    await dispatch({ t: 'stop/remove', stop: b! }, db);

    while (await undo(db)) {
      await assertIndexIntegrity();
    }

    expect(await db.trips.count()).toBe(0);
    expect(await db.days.count()).toBe(0);
    expect(await db.stops.count()).toBe(0);
    expect(history).toHaveLength(0);
  });

  test('undo restores exact field values after an update', async () => {
    await dispatch({ t: 'day/add', day }, db);
    await dispatch({ t: 'day/update', id: day.id, patch: { startMin: 555 }, prev: { startMin: day.startMin } }, db);
    expect((await db.days.get(day.id))?.startMin).toBe(555);
    await undo(db);
    expect((await db.days.get(day.id))?.startMin).toBe(480);
  });

  test('undo on empty history is a safe no-op', async () => {
    expect(await undo(db)).toBe(false);
  });
});
