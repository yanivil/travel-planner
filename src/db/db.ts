import Dexie, { type EntityTable } from 'dexie';
import type { Trip, Day, Stop } from '../domain/types';

// D-019: the schema is versioned from day one. Every version bump here MUST
// ship a Dexie upgrade() and a migration test that opens a fixture database
// created at the previous version (see src/db/migrations.test.ts).
// v2 (M1): Stop.anchorStartMin — null for floaters, wall-clock minutes when pinned.
export const SCHEMA_VERSION = 2;
export const DB_NAME = 'tiyul';

const STORES = {
  trips: 'id',
  days: 'id, tripId, [tripId+index]',
  stops: 'id, dayId, [dayId+index]',
};

export type TiyulDB = Dexie & {
  trips: EntityTable<Trip, 'id'>;
  days: EntityTable<Day, 'id'>;
  stops: EntityTable<Stop, 'id'>;
};

/** The v1 schema exactly as shipped in M0 — kept for migration tests. */
export function defineSchemaV1(dexie: Dexie): void {
  dexie.version(1).stores(STORES);
}

export function defineSchema(dexie: Dexie): void {
  dexie.version(1).stores(STORES);
  dexie
    .version(2)
    .stores(STORES)
    .upgrade(async (tx) => {
      await tx
        .table('stops')
        .toCollection()
        .modify((stop: Record<string, unknown>) => {
          if (!('anchorStartMin' in stop)) stop.anchorStartMin = null;
        });
    });
}

export function createDb(name: string = DB_NAME): TiyulDB {
  const dexie = new Dexie(name) as TiyulDB;
  defineSchema(dexie);
  return dexie;
}

export const db = createDb();
