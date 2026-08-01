import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import { computeDaySchedule, daySpanMin, type SchedulableStop } from './schedule';

const stopArb: fc.Arbitrary<SchedulableStop> = fc.record({
  id: fc.uuid(),
  durationMin: fc.integer({ min: 0, max: 600 }),
  legAfterMin: fc.option(fc.integer({ min: 0, max: 300 }), { nil: null }),
});

const stopsArb = fc.array(stopArb, { minLength: 0, maxLength: 20 });
const startArb = fc.integer({ min: 0, max: 1439 });

describe('computeDaySchedule tables', () => {
  test('empty day yields empty schedule with zero span', () => {
    expect(computeDaySchedule(480, [])).toEqual([]);
    expect(daySpanMin([])).toBe(0);
  });

  test('single stop starts at day start and ends after its duration', () => {
    const [only] = computeDaySchedule(480, [{ id: 'a', durationMin: 150, legAfterMin: 25 }]);
    expect(only).toEqual({
      stopId: 'a',
      startMin: 480,
      endMin: 630,
      legAfterMin: null, // last stop never renders a leg, even if one is set
      nextArriveMin: null,
      slackBeforeMin: 0,
      lateByMin: 0,
    });
  });

  test('chains stops through legs: 08:00 pool 150m → 25m drive → timna 180m', () => {
    const schedule = computeDaySchedule(480, [
      { id: 'pool', durationMin: 150, legAfterMin: 25 },
      { id: 'timna', durationMin: 180, legAfterMin: null },
    ]);
    expect(schedule[0]).toMatchObject({ startMin: 480, endMin: 630, legAfterMin: 25, nextArriveMin: 655 });
    expect(schedule[1]).toMatchObject({ startMin: 655, endMin: 835 });
  });

  test('a null leg between stops behaves as zero drive', () => {
    const schedule = computeDaySchedule(0, [
      { id: 'a', durationMin: 10, legAfterMin: null },
      { id: 'b', durationMin: 10, legAfterMin: null },
    ]);
    expect(schedule[1]?.startMin).toBe(10);
  });
});

describe('anchored stops (D-025)', () => {
  test('an anchor pins the start; early arrival becomes visible slack', () => {
    const schedule = computeDaySchedule(480, [
      { id: 'drive', durationMin: 60, legAfterMin: 0 },
      { id: 'lunch', durationMin: 60, legAfterMin: null, anchorStartMin: 600 },
    ]);
    // chain arrives 09:00, reservation at 10:00 → 60 min slack, start pinned
    expect(schedule[1]).toMatchObject({ startMin: 600, endMin: 660, slackBeforeMin: 60, lateByMin: 0 });
  });

  test('arriving after the anchor is flagged as late, never silently shifted', () => {
    const schedule = computeDaySchedule(480, [
      { id: 'drive', durationMin: 60, legAfterMin: 0 },
      { id: 'tour', durationMin: 90, legAfterMin: null, anchorStartMin: 500 },
    ]);
    // chain arrives 09:00 (540), tour was booked for 08:20 (500) → 40 min late
    expect(schedule[1]).toMatchObject({ startMin: 500, endMin: 590, slackBeforeMin: 0, lateByMin: 40 });
  });

  test('downstream stops chain from the anchored stop planned end', () => {
    const schedule = computeDaySchedule(480, [
      { id: 'a', durationMin: 30, legAfterMin: 10 },
      { id: 'b', durationMin: 60, legAfterMin: 20, anchorStartMin: 600 },
      { id: 'c', durationMin: 15, legAfterMin: null },
    ]);
    expect(schedule[2]?.startMin).toBe(600 + 60 + 20);
  });

  const anchoredStopArb = fc.record({
    id: fc.uuid(),
    durationMin: fc.integer({ min: 0, max: 600 }),
    legAfterMin: fc.option(fc.integer({ min: 0, max: 300 }), { nil: null }),
    anchorStartMin: fc.option(fc.integer({ min: 0, max: 1600 }), { nil: null }),
  });

  test('property: slack and late are exact and mutually exclusive', () => {
    fc.assert(
      fc.property(startArb, fc.array(anchoredStopArb, { maxLength: 15 }), (start, stops) => {
        const schedule = computeDaySchedule(start, stops);
        schedule.forEach((s, i) => {
          const arrival = i === 0 ? start : schedule[i - 1]!.nextArriveMin!;
          const anchor = stops[i]!.anchorStartMin;
          if (anchor == null) {
            expect(s.slackBeforeMin).toBe(0);
            expect(s.lateByMin).toBe(0);
            expect(s.startMin).toBe(arrival);
          } else {
            expect(s.startMin).toBe(anchor);
            expect(s.slackBeforeMin - s.lateByMin).toBe(anchor - arrival);
            expect(Math.min(s.slackBeforeMin, s.lateByMin)).toBe(0);
          }
        });
      }),
    );
  });
});

describe('computeDaySchedule properties', () => {
  test('every stop occupies exactly its duration', () => {
    fc.assert(
      fc.property(startArb, stopsArb, (start, stops) => {
        const schedule = computeDaySchedule(start, stops);
        schedule.forEach((s, i) => {
          expect(s.endMin - s.startMin).toBe(stops[i]?.durationMin);
        });
      }),
    );
  });

  test('each stop starts exactly at the previous end plus the leg', () => {
    fc.assert(
      fc.property(startArb, stopsArb, (start, stops) => {
        const schedule = computeDaySchedule(start, stops);
        for (let i = 1; i < schedule.length; i++) {
          const prev = schedule[i - 1]!;
          expect(schedule[i]!.startMin).toBe(prev.endMin + (stops[i - 1]!.legAfterMin ?? 0));
          expect(prev.nextArriveMin).toBe(schedule[i]!.startMin);
        }
      }),
    );
  });

  test('start times never decrease', () => {
    fc.assert(
      fc.property(startArb, stopsArb, (start, stops) => {
        const schedule = computeDaySchedule(start, stops);
        for (let i = 1; i < schedule.length; i++) {
          expect(schedule[i]!.startMin).toBeGreaterThanOrEqual(schedule[i - 1]!.startMin);
        }
      }),
    );
  });

  test('day span equals total durations plus all non-final legs', () => {
    fc.assert(
      fc.property(startArb, stopsArb, (start, stops) => {
        const schedule = computeDaySchedule(start, stops);
        const durations = stops.reduce((sum, s) => sum + s.durationMin, 0);
        const legs = stops.slice(0, -1).reduce((sum, s) => sum + (s.legAfterMin ?? 0), 0);
        expect(daySpanMin(schedule)).toBe(stops.length === 0 ? 0 : durations + legs);
      }),
    );
  });

  test('shifting the day start shifts every time by the same delta', () => {
    fc.assert(
      fc.property(startArb, fc.integer({ min: -240, max: 240 }), stopsArb, (start, delta, stops) => {
        const base = computeDaySchedule(start, stops);
        const shifted = computeDaySchedule(start + delta, stops);
        base.forEach((s, i) => {
          expect(shifted[i]!.startMin).toBe(s.startMin + delta);
          expect(shifted[i]!.endMin).toBe(s.endMin + delta);
        });
      }),
    );
  });

  test('recompute is pure: same input, same output', () => {
    fc.assert(
      fc.property(startArb, stopsArb, (start, stops) => {
        expect(computeDaySchedule(start, stops)).toEqual(computeDaySchedule(start, stops));
      }),
    );
  });

  test('with a uniform leg, reordering stops never changes the day span', () => {
    fc.assert(
      fc.property(
        startArb,
        fc.integer({ min: 0, max: 120 }),
        fc.array(fc.record({ id: fc.uuid(), durationMin: fc.integer({ min: 0, max: 600 }) }), {
          minLength: 1,
          maxLength: 10,
        }),
        (start, leg, cores) => {
          const stops = cores.map((c) => ({ ...c, legAfterMin: leg }));
          const spanA = daySpanMin(computeDaySchedule(start, stops));
          const reversed = [...stops].reverse();
          const spanB = daySpanMin(computeDaySchedule(start, reversed));
          expect(spanB).toBe(spanA);
        },
      ),
    );
  });
});
