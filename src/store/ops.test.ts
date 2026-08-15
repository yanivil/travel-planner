import { beforeEach, describe, expect, test } from 'vitest';
import { createDb, type TiyulDB } from '../db/db';
import { applyOp, canRedo, canUndo, dispatch, history, invert, redo, resetHistory, sealHistory, undo, type Op } from './ops';
import type { Day, Stop, Trip } from '../domain/types';

let db: TiyulDB;

beforeEach(() => {
  db = createDb(`tiyul-test-${crypto.randomUUID()}`);
  resetHistory();
});

const trip: Trip = { id: 'trip-1', name: 'Test', createdAt: '2026-08-01T00:00:00.000Z', maxDriveStretchMin: null, observance: 'none' };
const day: Day = { id: 'day-1', tripId: trip.id, index: 0, title: 'Day 1', startMin: 480, zone: 'Asia/Jerusalem', curfewMin: null, lat: null, lng: null, locationName: null };

function stop(id: string, index: number, patch: Partial<Stop> = {}): Stop {
  return {
    id,
    dayId: day.id,
    index,
    name: `Stop ${id}`,
    kind: 'activity',
    durationMin: 60,
    legAfterMin: null,
    anchorStartMin: null,
    openMin: null,
    closeMin: null,
    lastEntryMin: null,
    closedWeekdays: null,
    ...patch,
  } as Stop;
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
    { t: 'trip/add', trip, days: [], stops: [], dismissals: [], attachments: [] },
    { t: 'trip/remove', trip, days: [day], stops: [stop('a', 0)], dismissals: [], attachments: [] },
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
    await applyOp({ t: 'trip/remove', trip, days, stops, dismissals: [] }, db);
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
    expect(await undo(db)).toBeNull();
  });

  test('undo then redo replays the exact op and restores history', async () => {
    await dispatch({ t: 'trip/add', trip }, db);
    await dispatch({ t: 'day/add', day }, db);
    expect(canUndo()).toBe(true);
    expect(canRedo()).toBe(false);

    await undo(db);
    expect(await db.days.count()).toBe(0);
    expect(canRedo()).toBe(true);

    const replayed = await redo(db);
    expect(replayed?.t).toBe('day/add');
    expect(await db.days.count()).toBe(1);
    expect(history).toHaveLength(2);
    expect(canRedo()).toBe(false);
  });

  test('a new edit after undo forks the timeline — redo dies', async () => {
    await dispatch({ t: 'trip/add', trip }, db);
    await dispatch({ t: 'day/add', day }, db);
    await undo(db);
    await dispatch({ t: 'day/add', day: { ...day, id: 'day-2' } }, db);
    expect(canRedo()).toBe(false);
    expect(await redo(db)).toBeNull();
  });

  test('redo on empty future is a safe no-op', async () => {
    expect(await redo(db)).toBeNull();
  });

  test('wallet attachments are ops: blob survives add/undo/redo and cascades with the trip (D-028)', async () => {
    await dispatch({ t: 'trip/add', trip }, db);
    const attachment = {
      id: 'att-1',
      tripId: trip.id,
      stopId: 'stop-x',
      name: 'ticket.png',
      mimeType: 'image/png',
      data: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' }),
      createdAt: '2026-08-02T00:00:00.000Z',
    };
    await dispatch({ t: 'attachment/add', attachment }, db);
    expect(await db.attachments.count()).toBe(1);

    await undo(db);
    expect(await db.attachments.count()).toBe(0);
    await redo(db);
    const restored = await db.attachments.get('att-1');
    expect(restored?.name).toBe('ticket.png');
    // fake-indexeddb's cloned Blob is opaque to jsdom (no readable size/bytes)
    // — presence + metadata here; BYTE-level integrity is proven in the
    // offline E2E, where a real browser decodes the stored PNG from IndexedDB.
    expect(restored?.mimeType).toBe('image/png');
    expect(restored?.data).toBeDefined();

    await applyOp({ t: 'trip/remove', trip, days: [], stops: [], dismissals: [], attachments: [attachment] }, db);
    expect(await db.attachments.count()).toBe(0);
    await applyOp({ t: 'trip/add', trip, days: [], stops: [], dismissals: [], attachments: [attachment] }, db);
    expect(await db.attachments.count()).toBe(1);
  });

  test('a coalesced keystroke burst is one entry: db holds the last value, one undo restores the first (#36)', async () => {
    await applyOp({ t: 'trip/add', trip }, db);
    await applyOp({ t: 'day/add', day }, db);
    await applyOp({ t: 'stop/add', stop: stop('a', 0) }, db); // durationMin 60
    const burst = (v: number, prev: number) =>
      dispatch({ t: 'stop/update', id: 'a', patch: { durationMin: v }, prev: { durationMin: prev } }, db, { coalesce: true });

    await burst(3, 60); // user types "333": 3 → 33 → 333
    await burst(33, 3);
    await burst(333, 33);

    expect((await db.stops.get('a'))?.durationMin).toBe(333);
    expect(history).toHaveLength(1);
    await undo(db);
    expect((await db.stops.get('a'))?.durationMin).toBe(60);
    expect(canUndo()).toBe(false);
    await redo(db);
    expect((await db.stops.get('a'))?.durationMin).toBe(333);
  });

  test('sealHistory ends the burst — the next commit is a separate undo step (#36)', async () => {
    await applyOp({ t: 'stop/add', stop: stop('a', 0) }, db);
    await dispatch({ t: 'stop/update', id: 'a', patch: { durationMin: 90 }, prev: { durationMin: 60 } }, db, { coalesce: true });
    sealHistory(); // NumberField blur
    await dispatch({ t: 'stop/update', id: 'a', patch: { durationMin: 75 }, prev: { durationMin: 90 } }, db, { coalesce: true });

    expect(history).toHaveLength(2);
    await undo(db);
    expect((await db.stops.get('a'))?.durationMin).toBe(90);
    await undo(db);
    expect((await db.stops.get('a'))?.durationMin).toBe(60);
  });

  test('coalescing never crosses fields, entities, multi-key patches, or unrelated ops (#36)', async () => {
    await applyOp({ t: 'day/add', day }, db);
    await applyOp({ t: 'stop/add', stop: stop('a', 0) }, db);
    await applyOp({ t: 'stop/add', stop: stop('b', 1) }, db);
    const co = { coalesce: true } as const;

    await dispatch({ t: 'stop/update', id: 'a', patch: { durationMin: 90 }, prev: { durationMin: 60 } }, db, co);
    await dispatch({ t: 'stop/update', id: 'a', patch: { legAfterMin: 10 }, prev: { legAfterMin: null } }, db, co); // other field
    await dispatch({ t: 'stop/update', id: 'b', patch: { legAfterMin: 20 }, prev: { legAfterMin: null } }, db, co); // other stop
    await dispatch({ t: 'day/update', id: day.id, patch: { startMin: 500 }, prev: { startMin: 480 } }, db); // unrelated, plain
    await dispatch({ t: 'stop/update', id: 'b', patch: { legAfterMin: 25 }, prev: { legAfterMin: 20 } }, db, co); // chain was broken
    await dispatch(
      { t: 'stop/update', id: 'b', patch: { legAfterMin: 30, durationMin: 45 }, prev: { legAfterMin: 25, durationMin: 60 } },
      db,
      co, // multi-key patches are never coalescible
    );

    expect(history).toHaveLength(6);
  });

  test('plain dispatches never merge — coalescing is opt-in (#36)', async () => {
    await applyOp({ t: 'stop/add', stop: stop('a', 0) }, db);
    await dispatch({ t: 'stop/update', id: 'a', patch: { durationMin: 90 }, prev: { durationMin: 60 } }, db);
    await dispatch({ t: 'stop/update', id: 'a', patch: { durationMin: 75 }, prev: { durationMin: 90 } }, db);
    expect(history).toHaveLength(2);
  });

  test('undo seals the chain — a later burst forks instead of merging into the undone entry (#36)', async () => {
    await applyOp({ t: 'stop/add', stop: stop('a', 0) }, db);
    await dispatch({ t: 'stop/update', id: 'a', patch: { durationMin: 90 }, prev: { durationMin: 60 } }, db, { coalesce: true });
    await undo(db);
    expect((await db.stops.get('a'))?.durationMin).toBe(60);

    await dispatch({ t: 'stop/update', id: 'a', patch: { durationMin: 75 }, prev: { durationMin: 60 } }, db, { coalesce: true });
    expect(history).toHaveLength(1);
    expect(canRedo()).toBe(false); // the new edit forked the timeline
    await undo(db);
    expect((await db.stops.get('a'))?.durationMin).toBe(60);
  });

  test('acknowledging a conflict is an op: applies, cascades on trip delete, undoes (D-020)', async () => {
    await dispatch({ t: 'trip/add', trip }, db);
    const dismissal = {
      id: 'CURFEW_MISS:day-1:b',
      tripId: trip.id,
      severity: 'soft' as const,
      createdAt: '2026-08-02T00:00:00.000Z',
    };
    await dispatch({ t: 'dismissal/add', dismissal }, db);
    expect(await db.dismissals.count()).toBe(1);

    await undo(db);
    expect(await db.dismissals.count()).toBe(0);
    await dispatch({ t: 'dismissal/add', dismissal }, db);

    await applyOp({ t: 'trip/remove', trip, days: [], stops: [], dismissals: [dismissal] }, db);
    expect(await db.dismissals.count()).toBe(0);
    await applyOp({ t: 'trip/add', trip, days: [], stops: [], dismissals: [dismissal] }, db);
    expect(await db.dismissals.count()).toBe(1);
  });
});
