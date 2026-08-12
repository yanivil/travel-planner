import type { TiyulDB } from '../db/db';
import { db } from '../db/db';
import type { Day, Stop, StopKind } from '../domain/types';

// Sanitized S1-style fixture (TESTING.md §3): the Yahel long-weekend shape with
// no personal data. Real family files stay in gitignored local/ (CLAUDE.md).

interface DemoStop {
  name: string;
  kind: StopKind;
  durationMin: number;
  legAfterMin?: number;
  wazeQuery?: string;
  openMin?: number;
  closeMin?: number;
  lastEntryMin?: number;
}

interface DemoDay {
  title: string;
  date: string;
  startMin: number;
  curfewMin?: number;
  stops: DemoStop[];
}

const ZONE = 'Asia/Jerusalem';

// Mirrors the family's vacation_schedule v6 (2026-08): Timna on the way in
// (Thursday), pool mornings, Eilat on Friday afternoon, a quiet kibbutz
// Shabbat, Sunday departure. Pool runs in sessions: 10:00–14:00 / 16:00–19:00.
// v6 is deliberately conflict-free out of the box — the engine showcase is
// flipping שמירת שבת to 'soft', which flags the Friday-night drive home
// from Eilat (leg arrives 22:00, candles 18:46). E2E asserts both states.
const DAYS: DemoDay[] = [
  {
    title: 'חמישי — תמנע והגעה',
    date: '2026-08-27',
    startMin: 12 * 60 + 30,
    stops: [
      { name: 'פארק תמנע — מסלול ברכב וסיום באגם', kind: 'activity', durationMin: 210, legAfterMin: 30, wazeQuery: 'פארק תמנע', lastEntryMin: 16 * 60 + 30 },
      { name: 'הגעה וקבלת חדרים — קיבוץ יהל', kind: 'lodging', durationMin: 15, wazeQuery: 'קיבוץ יהל' },
      { name: 'בריכה ומנוחה', kind: 'activity', durationMin: 105, openMin: 16 * 60, closeMin: 19 * 60 },
      { name: 'ערב על האש', kind: 'meal', durationMin: 120 },
    ],
  },
  {
    title: 'שישי — בריכה ואילת',
    date: '2026-08-28',
    startMin: 8 * 60,
    stops: [
      { name: 'ארוחת בוקר בקיבוץ', kind: 'meal', durationMin: 120 },
      { name: 'בריכה בקיבוץ ומנוחה', kind: 'activity', durationMin: 180, openMin: 10 * 60, closeMin: 14 * 60 },
      { name: 'התארגנות ומקלחות', kind: 'free', durationMin: 30, legAfterMin: 40 },
      { name: 'אילת — ג׳מבו, אייס מול ובבילון', kind: 'activity', durationMin: 320, wazeQuery: 'אילת' },
      { name: 'ארוחת ערב באילת', kind: 'meal', durationMin: 110, legAfterMin: 40 },
      { name: 'חזרה לקיבוץ יהל', kind: 'lodging', durationMin: 15 },
    ],
  },
  {
    title: 'שבת — קיבוץ ובריכה',
    date: '2026-08-29',
    startMin: 8 * 60 + 30,
    stops: [
      { name: 'ארוחת בוקר בקיבוץ', kind: 'meal', durationMin: 90 },
      { name: 'בריכה וזמן חופשי', kind: 'activity', durationMin: 240, openMin: 10 * 60, closeMin: 14 * 60 },
      { name: 'צהריים — נקניקיות וביצים בפיתה', kind: 'meal', durationMin: 120 },
      { name: 'בריכה — סבב ערב', kind: 'activity', durationMin: 150, openMin: 16 * 60, closeMin: 19 * 60 },
      { name: 'ערב על האש', kind: 'meal', durationMin: 120 },
    ],
  },
  {
    title: 'ראשון — סיום',
    date: '2026-08-30',
    startMin: 8 * 60 + 30,
    stops: [
      { name: 'ארוחת בוקר ומנוחה', kind: 'meal', durationMin: 90 },
      { name: 'בריכה', kind: 'activity', durationMin: 60, openMin: 10 * 60, closeMin: 14 * 60 },
      { name: 'התארגנות ויציאה הביתה', kind: 'free', durationMin: 30 },
    ],
  },
];

export async function loadDemoTrip(target: TiyulDB = db): Promise<string> {
  const tripId = crypto.randomUUID();
  const days: Day[] = [];
  const stops: Stop[] = [];
  DAYS.forEach((demoDay, dayIndex) => {
    const dayId = crypto.randomUUID();
    days.push({
      id: dayId,
      tripId,
      index: dayIndex,
      title: demoDay.title,
      date: demoDay.date,
      startMin: demoDay.startMin,
      zone: ZONE,
      curfewMin: demoDay.curfewMin ?? null,
      lat: 29.878,
      lng: 35.096,
      locationName: 'קיבוץ יהל (ערבה)',
    });
    demoDay.stops.forEach((demoStop, stopIndex) => {
      stops.push({
        id: crypto.randomUUID(),
        dayId,
        index: stopIndex,
        name: demoStop.name,
        kind: demoStop.kind,
        durationMin: demoStop.durationMin,
        legAfterMin: demoStop.legAfterMin ?? null,
        anchorStartMin: null,
        openMin: demoStop.openMin ?? null,
        closeMin: demoStop.closeMin ?? null,
        lastEntryMin: demoStop.lastEntryMin ?? null,
        closedWeekdays: null,
        wazeQuery: demoStop.wazeQuery,
      });
    });
  });
  await target.transaction('rw', target.trips, target.days, target.stops, async () => {
    await target.trips.add({
      id: tripId,
      name: 'סופ״ש ביהל (הדגמה)',
      createdAt: new Date().toISOString(),
      maxDriveStretchMin: 120,
      // the real family drives on Shabbat — checks stay off in the demo, the
      // zmanim badges still show (flip to 'soft' to watch the rule fire)
      observance: 'none',
    });
    await target.days.bulkAdd(days);
    await target.stops.bulkAdd(stops);
  });
  return tripId;
}
