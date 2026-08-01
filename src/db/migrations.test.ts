import { describe, expect, test } from 'vitest';
import Dexie from 'dexie';
import { createDb, defineSchema, SCHEMA_VERSION } from './db';

// D-019 / TESTING.md policy 7: the migration harness. When SCHEMA_VERSION bumps
// to N, this file MUST gain a test that (1) builds a database with the version
// N-1 schema definition and fixture rows, (2) reopens it with the current
// defineSchema(), (3) asserts every row survived the upgrade intact.
// With only v1 in existence, the harness proves the reopen path itself.

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
    });
    first.close();

    const reopened = createDb(name);
    expect(reopened.verno).toBe(SCHEMA_VERSION);
    expect(await reopened.trips.count()).toBe(1);
    expect(await reopened.days.count()).toBe(1);
    expect((await reopened.stops.get('s1'))?.legAfterMin).toBe(25);
    reopened.close();
  });

  test('defineSchema declares the advertised SCHEMA_VERSION', () => {
    const dexie = new Dexie(`tiyul-schema-${crypto.randomUUID()}`);
    defineSchema(dexie);
    expect(dexie.verno).toBe(SCHEMA_VERSION);
  });
});
