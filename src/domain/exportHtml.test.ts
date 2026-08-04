import { describe, expect, test } from 'vitest';
import { buildTripExportHtml, exportFileName, type ExportInput } from './exportHtml';
import type { Stop } from './types';

const stop = (id: string, patch: Partial<Stop> = {}): Stop =>
  ({
    id,
    dayId: 'd1',
    index: 0,
    name: `Stop ${id}`,
    kind: 'activity',
    durationMin: 60,
    legAfterMin: null,
    anchorStartMin: null,
    openMin: null,
    closeMin: null,
    lastEntryMin: null,
    closedWeekdays: null,
    ...patch,
  }) as Stop;

const input = (): ExportInput => ({
  trip: { id: 't1', name: 'סופ״ש ביהל', createdAt: 'x', maxDriveStretchMin: null, observance: 'none' },
  days: [
    {
      day: {
        id: 'd1',
        tripId: 't1',
        index: 0,
        title: 'שישי — תמנע',
        date: '2026-08-28',
        startMin: 480,
        zone: 'Asia/Jerusalem',
        curfewMin: 1320,
        lat: 29.878,
        lng: 35.096,
        locationName: 'קיבוץ יהל (ערבה)',
      },
      stops: [
        stop('a', { name: 'בריכה', durationMin: 150, legAfterMin: 25, anchorStartMin: 480 }),
        stop('b', { name: 'תמנע', index: 1, durationMin: 90, wazeQuery: 'פארק תמנע' }),
      ],
      candleMin: 1126,
      havdalahMin: null,
      conflictTexts: ['נסיעה אחרי הדלקת נרות (18:46) — יציאה מ"בריכה"'],
    },
    {
      day: {
        id: 'd2',
        tripId: 't1',
        index: 1,
        title: 'שבת',
        date: '2026-08-29',
        startMin: 600,
        zone: 'Asia/Jerusalem',
        curfewMin: null,
        lat: 29.878,
        lng: 35.096,
        locationName: 'קיבוץ יהל (ערבה)',
      },
      stops: [stop('sat', { name: 'בריכה רגועה', durationMin: 120 })],
      candleMin: null,
      havdalahMin: 1182,
      conflictTexts: [],
    },
  ],
  lang: 'he',
  generatedAtISO: '2026-08-02T21:30:00.000Z',
  schemaVersion: 4,
});

describe('buildTripExportHtml — the never-hostage file (spec §4.7)', () => {
  const html = buildTripExportHtml(input());

  test('is RTL Hebrew with the trip and day content, computed times, and pins', () => {
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="he"');
    expect(html).toContain('סופ״ש ביהל');
    expect(html).toContain('שישי — תמנע');
    expect(html).toContain('08:00–10:30'); // computed, not stored
    expect(html).toContain('📌 08:00–10:30'); // anchored stop carries the pin
    expect(html).toContain('🚗 25 דק׳ · 10:55');
    expect(html).toContain('10:55–12:25');
  });

  test('carries zmanim (both edges), curfew, conflicts, and the Waze link', () => {
    expect(html).toContain('הדלקת נרות 18:46');
    expect(html).toContain('הבדלה 19:42');
    expect(html).toContain('חזרה עד 22:00');
    expect(html).toContain('התנגשויות פתוחות (1)');
    expect(html).toContain('https://waze.com/ul?q=');
  });

  test('is fully self-contained: no external scripts, styles, or images', () => {
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/<link[^>]+href=/);
    expect(html).not.toMatch(/<img/);
  });

  test('embeds the schema version and a round-trippable JSON payload (D-019)', () => {
    expect(html).toContain('name="tiyul-schema-version" content="4"');
    const m = /<script type="application\/json" id="tiyul-data">(.*?)<\/script>/s.exec(html);
    expect(m).not.toBeNull();
    const data = JSON.parse(m![1]!.replace(/<\\\//g, '</'));
    expect(data.schemaVersion).toBe(4);
    expect(data.trip.name).toBe('סופ״ש ביהל');
    expect(data.days[0].stops).toHaveLength(2);
    expect(data.days[0].stops[1].wazeQuery).toBe('פארק תמנע');
  });

  test('escapes HTML in user-entered names (presentation half; JSON keeps the raw value)', () => {
    const evil = input();
    evil.trip = { ...evil.trip, name: '<img src=x onerror=alert(1)>' };
    const out = buildTripExportHtml(evil);
    const presentation = out.split('<script type="application/json"')[0]!;
    expect(presentation).not.toContain('<img src=x');
    expect(presentation).toContain('&lt;img src=x');
    // the payload must round-trip the original, un-mangled
    const m = /<script type="application\/json" id="tiyul-data">(.*?)<\/script>/s.exec(out);
    expect(JSON.parse(m![1]!.replace(/<\\\//g, '</')).trip.name).toBe('<img src=x onerror=alert(1)>');
  });

  test('EN/LTR minimal trip covers the sparse branches: empty day, bare meta, last stop without leg', () => {
    const bare = buildTripExportHtml({
      trip: { id: 't2', name: 'Road trip', createdAt: 'x', maxDriveStretchMin: null, observance: 'none' },
      days: [
        {
          day: { id: 'e1', tripId: 't2', index: 0, title: 'Day 1', startMin: 540, zone: 'Asia/Jerusalem', curfewMin: null, lat: null, lng: null, locationName: null },
          stops: [],
          candleMin: null,
          havdalahMin: null,
          conflictTexts: [],
        },
        {
          day: { id: 'e2', tripId: 't2', index: 1, title: 'Day 2', startMin: 540, zone: 'Asia/Jerusalem', curfewMin: null, lat: null, lng: null, locationName: null },
          stops: [stop('solo', { name: 'Solo stop' })],
          candleMin: null,
          havdalahMin: null,
          conflictTexts: [],
        },
      ],
      lang: 'en',
      generatedAtISO: '2026-08-02T21:30:00.000Z',
      schemaVersion: 4,
    });
    expect(bare).toContain('dir="ltr"');
    expect(bare).toContain('No stops on this day');
    expect(bare).toContain('Solo stop');
    expect(bare).toContain('09:00–10:00');
    expect(bare).not.toContain('Candles');
    expect(bare).not.toContain('Back by');
    expect(bare).not.toContain('Open conflicts');
  });

  test('exportFileName sanitizes to a safe, meaningful name', () => {
    expect(exportFileName('סופ״ש ביהל 2026')).toBe('tiyul-סופש-ביהל-2026.html');
    expect(exportFileName('///')).toBe('tiyul-trip.html');
  });
});
