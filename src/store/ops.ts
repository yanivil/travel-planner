import { db, type TiyulDB } from '../db/db';
import type { Trip, Day, Stop } from '../domain/types';

// D-020: every mutation is an Op carrying enough state to invert itself, so
// undo is a store property, not a UI afterthought (undo UI lands in M1).
export type Op =
  | { t: 'trip/add'; trip: Trip; days?: Day[]; stops?: Stop[] }
  | { t: 'trip/remove'; trip: Trip; days: Day[]; stops: Stop[] }
  | { t: 'trip/update'; id: string; patch: Partial<Trip>; prev: Partial<Trip> }
  | { t: 'day/add'; day: Day; stops?: Stop[] }
  | { t: 'day/remove'; day: Day; stops: Stop[] }
  | { t: 'day/update'; id: string; patch: Partial<Day>; prev: Partial<Day> }
  | { t: 'stop/add'; stop: Stop }
  | { t: 'stop/remove'; stop: Stop }
  | { t: 'stop/update'; id: string; patch: Partial<Stop>; prev: Partial<Stop> }
  | { t: 'stop/move'; dayId: string; from: number; to: number };

export function invert(op: Op): Op {
  switch (op.t) {
    case 'trip/add':
      return { t: 'trip/remove', trip: op.trip, days: op.days ?? [], stops: op.stops ?? [] };
    case 'trip/remove':
      return { t: 'trip/add', trip: op.trip, days: op.days, stops: op.stops };
    case 'trip/update':
      return { t: 'trip/update', id: op.id, patch: op.prev, prev: op.patch };
    case 'day/add':
      return { t: 'day/remove', day: op.day, stops: op.stops ?? [] };
    case 'day/remove':
      return { t: 'day/add', day: op.day, stops: op.stops };
    case 'day/update':
      return { t: 'day/update', id: op.id, patch: op.prev, prev: op.patch };
    case 'stop/add':
      return { t: 'stop/remove', stop: op.stop };
    case 'stop/remove':
      return { t: 'stop/add', stop: op.stop };
    case 'stop/update':
      return { t: 'stop/update', id: op.id, patch: op.prev, prev: op.patch };
    case 'stop/move':
      return { t: 'stop/move', dayId: op.dayId, from: op.to, to: op.from };
  }
}

async function orderedStops(target: TiyulDB, dayId: string): Promise<Stop[]> {
  const stops = await target.stops.where('dayId').equals(dayId).toArray();
  return stops.sort((a, b) => a.index - b.index);
}

async function writeIndexes(target: TiyulDB, stops: Stop[]): Promise<void> {
  await Promise.all(
    stops.map((s, i) => (s.index === i ? Promise.resolve(0) : target.stops.update(s.id, { index: i }))),
  );
}

export async function applyOp(op: Op, target: TiyulDB = db): Promise<void> {
  await target.transaction('rw', target.trips, target.days, target.stops, async () => {
    switch (op.t) {
      case 'trip/add': {
        await target.trips.add(op.trip);
        if (op.days?.length) await target.days.bulkAdd(op.days);
        if (op.stops?.length) await target.stops.bulkAdd(op.stops);
        break;
      }
      case 'trip/remove': {
        await target.stops.where('dayId').anyOf(op.days.map((d) => d.id)).delete();
        await target.days.where('tripId').equals(op.trip.id).delete();
        await target.trips.delete(op.trip.id);
        break;
      }
      case 'trip/update': {
        await target.trips.update(op.id, op.patch);
        break;
      }
      case 'day/add': {
        await target.days.add(op.day);
        if (op.stops?.length) await target.stops.bulkAdd(op.stops);
        break;
      }
      case 'day/remove': {
        await target.stops.where('dayId').equals(op.day.id).delete();
        await target.days.delete(op.day.id);
        break;
      }
      case 'day/update': {
        await target.days.update(op.id, op.patch);
        break;
      }
      case 'stop/add': {
        const existing = await orderedStops(target, op.stop.dayId);
        existing.splice(Math.min(op.stop.index, existing.length), 0, op.stop);
        await target.stops.add(op.stop);
        await writeIndexes(target, existing);
        break;
      }
      case 'stop/remove': {
        await target.stops.delete(op.stop.id);
        await writeIndexes(target, await orderedStops(target, op.stop.dayId));
        break;
      }
      case 'stop/update': {
        await target.stops.update(op.id, op.patch);
        break;
      }
      case 'stop/move': {
        const stops = await orderedStops(target, op.dayId);
        const [moved] = stops.splice(op.from, 1);
        if (!moved) break;
        stops.splice(op.to, 0, moved);
        await writeIndexes(target, stops);
        break;
      }
    }
  });
}

const HISTORY_CAP = 100;

export const history: Op[] = [];

export async function dispatch(op: Op, target: TiyulDB = db): Promise<void> {
  await applyOp(op, target);
  history.push(op);
  if (history.length > HISTORY_CAP) history.shift();
}

export async function undo(target: TiyulDB = db): Promise<boolean> {
  const op = history.pop();
  if (!op) return false;
  await applyOp(invert(op), target);
  return true;
}
