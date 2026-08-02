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

const DAYS: DemoDay[] = [
  {
    title: 'חמישי — הגעה',
    date: '2026-08-27',
    startMin: 14 * 60,
    stops: [
      { name: 'הגעה וקבלת חדרים — קיבוץ יהל', kind: 'lodging', durationMin: 60, wazeQuery: 'קיבוץ יהל' },
      { name: 'התארגנות ומנוחה', kind: 'free', durationMin: 60 },
      { name: 'בריכה', kind: 'activity', durationMin: 150, openMin: 10 * 60, closeMin: 19 * 60 },
      { name: 'ערב על האש', kind: 'meal', durationMin: 120 },
    ],
  },
  {
    title: 'שישי — תמנע',
    date: '2026-08-28',
    startMin: 8 * 60,
    stops: [
      { name: 'ארוחת בוקר בקיבוץ', kind: 'meal', durationMin: 60, legAfterMin: 25 },
      { name: 'פארק תמנע — מסלול רכוב', kind: 'activity', durationMin: 180, wazeQuery: 'פארק תמנע', lastEntryMin: 16 * 60 + 30 },
      { name: 'האגם בתמנע', kind: 'activity', durationMin: 90, legAfterMin: 25 },
      { name: 'צהריים ומנוחה', kind: 'meal', durationMin: 60 },
      { name: 'זמן חופשי', kind: 'free', durationMin: 40 },
      { name: 'בריכה', kind: 'activity', durationMin: 150, openMin: 10 * 60, closeMin: 19 * 60 },
      { name: 'ערב על האש', kind: 'meal', durationMin: 120 },
    ],
  },
  {
    title: 'שבת — בריכה ואילת',
    date: '2026-08-29',
    startMin: 8 * 60 + 30,
    // demo of a soft conflict: the day ends 22:30, half an hour past this curfew
    curfewMin: 22 * 60,
    stops: [
      { name: 'ארוחת בוקר בקיבוץ', kind: 'meal', durationMin: 60 },
      { name: 'זמן חופשי', kind: 'free', durationMin: 30 },
      { name: 'בריכה', kind: 'activity', durationMin: 180, openMin: 10 * 60, closeMin: 19 * 60 },
      { name: 'התארגנות ומקלחות', kind: 'free', durationMin: 30, legAfterMin: 45 },
      { name: 'אילת — קניון ובילוי', kind: 'activity', durationMin: 315, wazeQuery: 'אילת' },
      { name: 'ארוחת ערב באילת', kind: 'meal', durationMin: 120, legAfterMin: 45 },
      { name: 'חזרה ליהל', kind: 'lodging', durationMin: 15 },
    ],
  },
  {
    title: 'ראשון — סיום',
    date: '2026-08-30',
    startMin: 8 * 60 + 30,
    stops: [
      { name: 'ארוחת בוקר בקיבוץ', kind: 'meal', durationMin: 60 },
      { name: 'זמן חופשי', kind: 'free', durationMin: 30 },
      { name: 'בריכה', kind: 'activity', durationMin: 60, openMin: 10 * 60, closeMin: 19 * 60 },
      { name: 'איסוף ויציאה הביתה', kind: 'free', durationMin: 30 },
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
