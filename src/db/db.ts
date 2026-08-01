import Dexie, { type EntityTable } from 'dexie';
import type { Trip, Day, Stop } from '../domain/types';

// D-019: the schema is versioned from day one. Every version bump here MUST
// ship a Dexie upgrade() and a migration test that opens a fixture database
// created at the previous version (see src/db/migrations.test.ts).
export const SCHEMA_VERSION = 1;
export const DB_NAME = 'tiyul';

export type TiyulDB = Dexie & {
  trips: EntityTable<Trip, 'id'>;
  days: EntityTable<Day, 'id'>;
  stops: EntityTable<Stop, 'id'>;
};

export function defineSchema(dexie: Dexie): void {
  dexie.version(SCHEMA_VERSION).stores({
    trips: 'id',
    days: 'id, tripId, [tripId+index]',
    stops: 'id, dayId, [dayId+index]',
  });
}

export function createDb(name: string = DB_NAME): TiyulDB {
  const dexie = new Dexie(name) as TiyulDB;
  defineSchema(dexie);
  return dexie;
}

export const db = createDb();
