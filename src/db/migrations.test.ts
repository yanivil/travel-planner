import { describe, expect, test } from 'vitest';
import Dexie from 'dexie';
import { createDb, defineSchema, defineSchemaV1, defineSchemaV2, defineSchemaV3, defineSchemaV4, SCHEMA_VERSION } from './db';

// D-019 / TESTING.md policy 7: the migration harness. When SCHEMA_VERSION bumps
// to N, this file MUST gain a test that (1) builds a database with the version
// N-1 schema definition and fixture rows, (2) reopens it with the current
// defineSchema(), (3) asserts every row survived the upgrade intact.

describe('schema versioning harness', () => {
  test('data written at the current version survives a full close/reopen cycle', async () => {
    const name = `tiyul-migration-${crypto.randomUUID()}`;

    const first = createDb(name);
    await first.trips.add({ id: 't1', name: 'Golan', createdAt: '2026-08-01T00:00:00.000Z', maxDriveStretchMin: null, observance: 'none' });
    await first.days.add({ id: 'd1', tripId: 't1', index: 0, title: 'Day 1', startMin: 480, zone: 'Asia/Jerusalem', curfewMin: null, lat: null, lng: null, locationName: null });
    await first.stops.add({
      id: 's1',
      dayId: 'd1',
      index: 0,
      name: 'Banias',
      kind: 'activity',
      durationMin: 120,
      legAfterMin: 25,
      anchorStartMin: null,
      openMin: null,
      closeMin: null,
      lastEntryMin: null,
      closedWeekdays: null,
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

  test('a real v2 (anchors) database upgrades to v3: nulls backfilled, dismissals table added', async () => {
    const name = `tiyul-migration-v2-${crypto.randomUUID()}`;

    // build the database exactly as the anchors release shipped it
    const v2 = new Dexie(name);
    defineSchemaV2(v2);
    await v2.open();
    await v2.table('trips').add({ id: 't1', name: 'Yahel', createdAt: '2026-08-01T00:00:00.000Z' });
    await v2.table('days').add({ id: 'd1', tripId: 't1', index: 0, title: 'Friday', startMin: 480, zone: 'Asia/Jerusalem' });
    await v2.table('stops').add({ id: 's1', dayId: 'd1', index: 0, name: 'Timna', kind: 'activity', durationMin: 180, legAfterMin: 25, anchorStartMin: 565 });
    v2.close();

    const upgraded = createDb(name);
    await upgraded.open();
    expect(upgraded.verno).toBe(SCHEMA_VERSION);
    const stop = await upgraded.stops.get('s1');
    expect(stop?.anchorStartMin).toBe(565); // v2 data intact
    expect(stop?.openMin).toBeNull();
    expect(stop?.closedWeekdays).toBeNull();
    expect((await upgraded.days.get('d1'))?.curfewMin).toBeNull();
    expect((await upgraded.trips.get('t1'))?.maxDriveStretchMin).toBeNull();
    expect(await upgraded.dismissals.count()).toBe(0); // table exists and is empty
    upgraded.close();
  });

  test('a real v3 (engine) database upgrades to v4: zmanim fields and observance backfilled', async () => {
    const name = `tiyul-migration-v3-${crypto.randomUUID()}`;

    const v3 = new Dexie(name);
    defineSchemaV3(v3);
    await v3.open();
    await v3.table('trips').add({ id: 't1', name: 'Yahel', createdAt: '2026-08-01T00:00:00.000Z', maxDriveStretchMin: 120 });
    await v3.table('days').add({ id: 'd1', tripId: 't1', index: 0, title: 'Friday', date: '2026-08-28', startMin: 480, zone: 'Asia/Jerusalem', curfewMin: 1320 });
    await v3.table('dismissals').add({ id: 'CURFEW_MISS:d1:s1', tripId: 't1', severity: 'soft', createdAt: '2026-08-01T00:00:00.000Z' });
    v3.close();

    const upgraded = createDb(name);
    await upgraded.open();
    expect(upgraded.verno).toBe(SCHEMA_VERSION);
    const trip = await upgraded.trips.get('t1');
    expect(trip?.observance).toBe('none'); // existing trips stay quiet (D-027)
    expect(trip?.maxDriveStretchMin).toBe(120);
    const dayRow = await upgraded.days.get('d1');
    expect(dayRow?.lat).toBeNull();
    expect(dayRow?.lng).toBeNull();
    expect(dayRow?.locationName).toBeNull();
    expect(dayRow?.curfewMin).toBe(1320);
    expect(await upgraded.dismissals.count()).toBe(1); // acknowledgements survive
    upgraded.close();
  });

  test('a real v4 (Shabbat) database upgrades to v5: attachments table exists, data intact', async () => {
    const name = `tiyul-migration-v4-${crypto.randomUUID()}`;

    const v4 = new Dexie(name);
    defineSchemaV4(v4);
    await v4.open();
    await v4.table('trips').add({ id: 't1', name: 'Yahel', createdAt: 'x', maxDriveStretchMin: 120, observance: 'soft' });
    await v4.table('days').add({ id: 'd1', tripId: 't1', index: 0, title: 'Friday', startMin: 480, zone: 'Asia/Jerusalem', curfewMin: null, lat: 29.878, lng: 35.096, locationName: 'קיבוץ יהל (ערבה)' });
    v4.close();

    const upgraded = createDb(name);
    await upgraded.open();
    expect(upgraded.verno).toBe(SCHEMA_VERSION);
    expect((await upgraded.trips.get('t1'))?.observance).toBe('soft');
    expect((await upgraded.days.get('d1'))?.locationName).toBe('קיבוץ יהל (ערבה)');
    expect(await upgraded.attachments.count()).toBe(0); // new table, empty
    upgraded.close();
  });

  test('defineSchema declares the advertised SCHEMA_VERSION', () => {
    const dexie = new Dexie(`tiyul-schema-${crypto.randomUUID()}`);
    defineSchema(dexie);
    expect(dexie.verno).toBe(SCHEMA_VERSION);
  });
});
