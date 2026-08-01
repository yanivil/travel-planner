import { describe, expect, test } from 'vitest';
import Dexie from 'dexie';
import { createDb, defineSchema, defineSchemaV1, SCHEMA_VERSION } from './db';

// D-019 / TESTING.md policy 7: the migration harness. When SCHEMA_VERSION bumps
// to N, this file MUST gain a test that (1) builds a database with the version
// N-1 schema definition and fixture rows, (2) reopens it with the current
// defineSchema(), (3) asserts every row survived the upgrade intact.

describe('schema versioning harness', () => {
  test('data written at the current version survives a full close/reopen cycle', async () => {
    const name = `tiyul-migration-${crypto.randomUUID()}`;

    const first = createDb(name);
    await first.trips.add({ id: 't1', name: 'Golan', createdAt: '2026-08-01T00:00:00.000Z' });
    await first.days.add({ id: 'd1', tripId: 't1', index: 0, title: 'Day 1', startMin: 480, zone: 'Asia/Jerusalem' });
    await first.stops.add({
      id: 's1',
      dayId: 'd1',
      index: 0,
      name: 'Banias',
      kind: 'activity',
      durationMin: 120,
      legAfterMin: 25,
      anchorStartMin: null,
    });
    first.close();

    const reopened = createDb(name);
    expect(reopened.verno).toBe(SCHEMA_VERSION);
    expect(await reopened.trips.count()).toBe(1);
    expect(await reopened.days.count()).toBe(1);
    expect((await reopened.stops.get('s1'))?.legAfterMin).toBe(25);
    reopened.close();
  });

  test('a real v1 (M0) database upgrades to v2 with anchorStartMin backfilled as null', async () => {
    const name = `tiyul-migration-v1-${crypto.randomUUID()}`;

    // build the database exactly as M0 shipped it — no anchorStartMin anywhere
    const v1 = new Dexie(name);
    defineSchemaV1(v1);
    await v1.open();
    await v1.table('trips').add({ id: 't1', name: 'Yahel', createdAt: '2026-08-01T00:00:00.000Z' });
    await v1.table('days').add({ id: 'd1', tripId: 't1', index: 0, title: 'Thursday', startMin: 840, zone: 'Asia/Jerusalem' });
    await v1.table('stops').add({ id: 's1', dayId: 'd1', index: 0, name: 'Pool', kind: 'activity', durationMin: 150, legAfterMin: 25 });
    v1.close();

    const upgraded = createDb(name);
    await upgraded.open();
    expect(upgraded.verno).toBe(SCHEMA_VERSION);
    const stop = await upgraded.stops.get('s1');
    expect(stop?.anchorStartMin).toBeNull();
    expect(stop?.legAfterMin).toBe(25);
    expect(stop?.durationMin).toBe(150);
    expect(await upgraded.trips.count()).toBe(1);
    expect(await upgraded.days.count()).toBe(1);
    upgraded.close();
  });

  test('defineSchema declares the advertised SCHEMA_VERSION', () => {
    const dexie = new Dexie(`tiyul-schema-${crypto.randomUUID()}`);
    defineSchema(dexie);
    expect(dexie.verno).toBe(SCHEMA_VERSION);
  });
});
