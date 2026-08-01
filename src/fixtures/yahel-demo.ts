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
}

interface DemoDay {
  title: string;
  startMin: number;
  stops: DemoStop[];
}

const ZONE = 'Asia/Jerusalem';

const DAYS: DemoDay[] = [
  {
    title: 'חמישי — הגעה',
    startMin: 14 * 60,
    stops: [
      { name: 'הגעה וקבלת חדרים — קיבוץ יהל', kind: 'lodging', durationMin: 60, wazeQuery: 'קיבוץ יהל' },
      { name: 'התארגנות ומנוחה', kind: 'free', durationMin: 60 },
      { name: 'בריכה', kind: 'activity', durationMin: 150 },
      { name: 'ערב על האש', kind: 'meal', durationMin: 120 },
    ],
  },
  {
    title: 'שישי — תמנע',
    startMin: 8 * 60,
    stops: [
      { name: 'ארוחת בוקר בקיבוץ', kind: 'meal', durationMin: 60, legAfterMin: 25 },
      { name: 'פארק תמנע — מסלול רכוב', kind: 'activity', durationMin: 180, wazeQuery: 'פארק תמנע' },
      { name: 'האגם בתמנע', kind: 'activity', durationMin: 90, legAfterMin: 25 },
      { name: 'צהריים ומנוחה', kind: 'meal', durationMin: 60 },
      { name: 'זמן חופשי', kind: 'free', durationMin: 40 },
      { name: 'בריכה', kind: 'activity', durationMin: 150 },
      { name: 'ערב על האש', kind: 'meal', durationMin: 120 },
    ],
  },
  {
    title: 'שבת — בריכה ואילת',
    startMin: 8 * 60 + 30,
    stops: [
      { name: 'ארוחת בוקר בקיבוץ', kind: 'meal', durationMin: 60 },
      { name: 'זמן חופשי', kind: 'free', durationMin: 30 },
      { name: 'בריכה', kind: 'activity', durationMin: 180 },
      { name: 'התארגנות ומקלחות', kind: 'free', durationMin: 30, legAfterMin: 45 },
      { name: 'אילת — קניון ובילוי', kind: 'activity', durationMin: 315, wazeQuery: 'אילת' },
      { name: 'ארוחת ערב באילת', kind: 'meal', durationMin: 120, legAfterMin: 45 },
      { name: 'חזרה ליהל', kind: 'lodging', durationMin: 15 },
    ],
  },
  {
    title: 'ראשון — סיום',
    startMin: 8 * 60 + 30,
    stops: [
      { name: 'ארוחת בוקר בקיבוץ', kind: 'meal', durationMin: 60 },
      { name: 'זמן חופשי', kind: 'free', durationMin: 30 },
      { name: 'בריכה', kind: 'activity', durationMin: 60 },
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
      startMin: demoDay.startMin,
      zone: ZONE,
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
        wazeQuery: demoStop.wazeQuery,
      });
    });
  });
  await target.transaction('rw', target.trips, target.days, target.stops, async () => {
    await target.trips.add({
      id: tripId,
      name: 'סופ״ש ביהל (הדגמה)',
      createdAt: new Date().toISOString(),
    });
    await target.days.bulkAdd(days);
    await target.stops.bulkAdd(stops);
  });
  return tripId;
}
