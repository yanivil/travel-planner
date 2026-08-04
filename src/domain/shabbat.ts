import { HebrewCalendar, Location, HDate, CandleLightingEvent, HavdalahEvent } from '@hebcal/core';
import { candleMinsFor, isInIsrael } from './locations';

// Offline zmanim (D-006): candle-lighting / havdalah per date + coordinates,
// computed fully client-side. Times are halachic APPROXIMATIONS — the UI must
// say so (upstream's own disclaimer).

export interface DayZmanim {
  candleMin: number | null; // wall-clock minutes in the day's zone
  havdalahMin: number | null;
}

const NONE: DayZmanim = { candleMin: null, havdalahMin: null };

/** Wall-clock minutes of an absolute instant, in an explicit IANA zone —
 *  deterministic under any runtime TZ (validated by the dual-TZ CI). */
export function wallClockMin(instant: Date, zone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return (Number(parts.hour) % 24) * 60 + Number(parts.minute);
}

export function zmanimForDate(
  dateISO: string,
  lat: number,
  lng: number,
  zone: string,
  locationName: string | null,
): DayZmanim {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  if (!m) return NONE;
  // UTC-noon anchor: HDate reads the Date's local calendar fields, and noon UTC
  // lands on the same calendar date in every runtime timezone (D-018 spirit).
  const anchor = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  const hd = new HDate(anchor);
  const il = isInIsrael(lat, lng);
  const location = new Location(lat, lng, il, zone, locationName ?? undefined);
  const events = HebrewCalendar.calendar({
    start: hd,
    end: hd,
    candlelighting: true,
    candleLightingMins: candleMinsFor(locationName),
    location,
    il,
  });
  const out: DayZmanim = { ...NONE };
  // instanceof, never constructor.name — minified builds mangle class names
  // (caught by E2E against the production build before it ever shipped).
  // Both classes always carry eventTime, so no separate null guard is needed.
  for (const ev of events) {
    if (ev instanceof CandleLightingEvent) out.candleMin = wallClockMin(ev.eventTime, zone);
    if (ev instanceof HavdalahEvent) out.havdalahMin = wallClockMin(ev.eventTime, zone);
  }
  return out;
}
