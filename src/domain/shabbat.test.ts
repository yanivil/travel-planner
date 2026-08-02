import { describe, expect, test } from 'vitest';
import { zmanimForDate } from './shabbat';
import { candleMinsFor, isInIsrael, parseLatLng } from './locations';

// Golden fixtures (TESTING.md): exact values printed from @hebcal/core itself
// on 2026-08-02 and pinned. These run in BOTH CI timezones — the whole point
// is that explicit-zone zmanim never depend on the runtime TZ.

describe('zmanimForDate — golden fixtures', () => {
  test('Yahel, Friday 2026-08-28: candle-lighting 18:46', () => {
    const z = zmanimForDate('2026-08-28', 29.878, 35.096, 'Asia/Jerusalem', 'קיבוץ יהל (ערבה)');
    expect(z.candleMin).toBe(18 * 60 + 46);
    expect(z.havdalahMin).toBeNull();
  });

  test('Yahel, Saturday 2026-08-29: havdalah 19:42', () => {
    const z = zmanimForDate('2026-08-29', 29.878, 35.096, 'Asia/Jerusalem', 'קיבוץ יהל (ערבה)');
    expect(z.havdalahMin).toBe(19 * 60 + 42);
    expect(z.candleMin).toBeNull();
  });

  test('Jerusalem, Friday 2026-08-28: the 40-minute minhag → 18:28', () => {
    const z = zmanimForDate('2026-08-28', 31.778, 35.235, 'Asia/Jerusalem', 'ירושלים');
    expect(z.candleMin).toBe(18 * 60 + 28);
  });

  test('abroad works too (Athens, Diaspora flag): Friday candle 19:42 local', () => {
    const z = zmanimForDate('2026-08-28', 37.98, 23.72, 'Europe/Athens', 'Athens');
    expect(z.candleMin).toBe(19 * 60 + 42);
  });

  test('a plain Wednesday has no candle or havdalah times', () => {
    expect(zmanimForDate('2026-08-26', 29.878, 35.096, 'Asia/Jerusalem', null)).toEqual({
      candleMin: null,
      havdalahMin: null,
    });
  });

  test('garbage dates return the empty result, never throw', () => {
    expect(zmanimForDate('not-a-date', 29.878, 35.096, 'Asia/Jerusalem', null)).toEqual({
      candleMin: null,
      havdalahMin: null,
    });
  });
});

describe('location helpers', () => {
  test('Israel bounding box decides the il flag per location (D-006)', () => {
    expect(isInIsrael(29.878, 35.096)).toBe(true); // Yahel
    expect(isInIsrael(37.98, 23.72)).toBe(false); // Athens
  });

  test('Jerusalem gets 40 candle minutes, everyone else 18', () => {
    expect(candleMinsFor('ירושלים')).toBe(40);
    expect(candleMinsFor('Jerusalem Old City')).toBe(40);
    expect(candleMinsFor('קיבוץ יהל (ערבה)')).toBe(18);
    expect(candleMinsFor(null)).toBe(18);
  });

  test('parseLatLng accepts a Google-Maps paste and a bare pair, rejects junk', () => {
    expect(parseLatLng('https://www.google.com/maps/@29.878,35.096,15z')).toEqual({
      lat: 29.878,
      lng: 35.096,
    });
    expect(parseLatLng('31.77, 35.21')).toEqual({ lat: 31.77, lng: 35.21 });
    expect(parseLatLng('hello')).toBeNull();
    expect(parseLatLng('99,199')).toBeNull();
  });
});
