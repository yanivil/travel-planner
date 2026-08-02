import Dexie, { type EntityTable } from 'dexie';
import type { Trip, Day, Stop, Dismissal } from '../domain/types';

// D-019: the schema is versioned from day one. Every version bump here MUST
// ship a Dexie upgrade() and a migration test that opens a fixture database
// created at the previous version (see src/db/migrations.test.ts).
// v2 (M1): Stop.anchorStartMin — null for floaters, wall-clock minutes when pinned.
// v3 (M1 #14): opening-hours fields on stops, Day.curfewMin,
//              Trip.maxDriveStretchMin, and the dismissals table (D-020).
export const SCHEMA_VERSION = 3;
export const DB_NAME = 'tiyul';

const STORES_V1 = {
  trips: 'id',
  days: 'id, tripId, [tripId+index]',
  stops: 'id, dayId, [dayId+index]',
};

const STORES_V3 = {
  ...STORES_V1,
  dismissals: 'id, tripId',
};

export type TiyulDB = Dexie & {
  trips: EntityTable<Trip, 'id'>;
  days: EntityTable<Day, 'id'>;
  stops: EntityTable<Stop, 'id'>;
  dismissals: EntityTable<Dismissal, 'id'>;
};

/** The v1 schema exactly as shipped in M0 — kept for migration tests. */
export function defineSchemaV1(dexie: Dexie): void {
  dexie.version(1).stores(STORES_V1);
}

/** The v2 schema exactly as shipped with anchors — kept for migration tests. */
export function defineSchemaV2(dexie: Dexie): void {
  dexie.version(1).stores(STORES_V1);
  dexie
    .version(2)
    .stores(STORES_V1)
    .upgrade(async (tx) => {
      await tx
        .table('stops')
        .toCollection()
        .modify((stop: Record<string, unknown>) => {
          if (!('anchorStartMin' in stop)) stop.anchorStartMin = null;
        });
    });
}

export function defineSchema(dexie: Dexie): void {
  defineSchemaV2(dexie);
  dexie
    .version(3)
    .stores(STORES_V3)
    .upgrade(async (tx) => {
      await tx
        .table('stops')
        .toCollection()
        .modify((stop: Record<string, unknown>) => {
          if (!('openMin' in stop)) stop.openMin = null;
          if (!('closeMin' in stop)) stop.closeMin = null;
          if (!('lastEntryMin' in stop)) stop.lastEntryMin = null;
          if (!('closedWeekdays' in stop)) stop.closedWeekdays = null;
        });
      await tx
        .table('days')
        .toCollection()
        .modify((day: Record<string, unknown>) => {
          if (!('curfewMin' in day)) day.curfewMin = null;
        });
      await tx
        .table('trips')
        .toCollection()
        .modify((trip: Record<string, unknown>) => {
          if (!('maxDriveStretchMin' in trip)) trip.maxDriveStretchMin = null;
        });
    });
}

export function createDb(name: string = DB_NAME): TiyulDB {
  const dexie = new Dexie(name) as TiyulDB;
  defineSchema(dexie);
  return dexie;
}

export const db = createDb();
