import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import { formatHM, parseHM, formatRange } from './time';

describe('formatHM', () => {
  test.each([
    [0, '00:00'],
    [480, '08:00'],
    [485, '08:05'],
    [1439, '23:59'],
  ])('%i → %s', (min, expected) => {
    expect(formatHM(min)).toBe(expected);
  });

  test('times past midnight wrap and are explicitly marked, never silently wrong', () => {
    expect(formatHM(1440)).toBe('00:00+1');
    expect(formatHM(1515)).toBe('01:15+1');
    expect(formatHM(2 * 1440 + 60)).toBe('01:00+2');
  });
});

describe('parseHM', () => {
  test.each([
    ['08:05', 485],
    ['8:05', 485],
    ['00:00', 0],
    ['23:59', 1439],
    [' 12:30 ', 750],
  ])('%s → %i', (text, expected) => {
    expect(parseHM(text)).toBe(expected);
  });

  test.each([['24:00'], ['12:60'], ['abc'], [''], ['12'], ['1:2'], ['-1:00']])(
    'rejects %s',
    (text) => {
      expect(parseHM(text)).toBeNull();
    },
  );

  test('roundtrip: parse(format(m)) === m for any same-day minute', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1439 }), (min) => {
        expect(parseHM(formatHM(min))).toBe(min);
      }),
    );
  });
});

describe('formatRange', () => {
  test('renders start–end with an en dash', () => {
    expect(formatRange(480, 630)).toBe('08:00–10:30');
  });
});
