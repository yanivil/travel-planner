import { describe, expect, test } from 'vitest';
import { computeDaySchedule } from './schedule';
import {
  computeConflicts,
  visibleConflicts,
  weekdayOf,
  type ConflictStop,
  type ConflictDay,
  type ConflictTripSettings,
} from './conflicts';

// Table-driven per rule (TESTING.md): given schedule → expected conflicts,
// severities, and boundary behavior. The engine is the moat — every rule ships
// with its table in the same PR (spec §4.2).

const trip = (patch: Partial<ConflictTripSettings> = {}): ConflictTripSettings => ({
  maxDriveStretchMin: null,
  ...patch,
});
const day = (patch: Partial<ConflictDay> = {}): ConflictDay => ({
  id: 'd1',
  curfewMin: null,
  ...patch,
});

interface StopSpec {
  id: string;
  name?: string;
  durationMin: number;
  legAfterMin?: number | null;
  anchorStartMin?: number | null;
  openMin?: number | null;
  closeMin?: number | null;
  lastEntryMin?: number | null;
  closedWeekdays?: number[] | null;
}

function run(
  startMin: number,
  specs: StopSpec[],
  t: ConflictTripSettings = trip(),
  d: ConflictDay = day(),
) {
  const stops: ConflictStop[] = specs.map((s) => ({
    id: s.id,
    name: s.name ?? `Stop ${s.id}`,
    openMin: s.openMin ?? null,
    closeMin: s.closeMin ?? null,
    lastEntryMin: s.lastEntryMin ?? null,
    closedWeekdays: s.closedWeekdays ?? null,
  }));
  const schedule = computeDaySchedule(
    startMin,
    specs.map((s) => ({
      id: s.id,
      durationMin: s.durationMin,
      legAfterMin: s.legAfterMin ?? null,
      anchorStartMin: s.anchorStartMin ?? null,
    })),
  );
  return computeConflicts(t, d, stops, schedule);
}

describe('clean plans produce zero conflicts', () => {
  test('a feasible day with hours, curfew, and limits set is silent', () => {
    const conflicts = run(
      480,
      [
        { id: 'a', durationMin: 60, legAfterMin: 30, openMin: 420, closeMin: 1080 },
        { id: 'b', durationMin: 90, anchorStartMin: 570, lastEntryMin: 600, legAfterMin: 20 },
        { id: 'c', durationMin: 30 },
      ],
      trip({ maxDriveStretchMin: 120 }),
      day({ curfewMin: 900, date: '2026-08-28' }),
    );
    expect(conflicts).toEqual([]);
  });
});

describe('OVERLAP vs TRANSIT_IMPOSSIBLE (hard) — the two faces of a missed pin', () => {
  test('pin before the previous stop even ends → OVERLAP with both subjects', () => {
    // a: 08:00–09:00; b pinned 08:30 → 30 min overlap
    const conflicts = run(480, [
      { id: 'a', durationMin: 60, legAfterMin: 0 },
      { id: 'b', durationMin: 60, anchorStartMin: 510 },
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      rule: 'OVERLAP',
      severity: 'hard',
      stopIds: ['a', 'b'],
      messageParams: { a: 'Stop a', b: 'Stop b', m: 30 },
    });
  });

  test('pin after the previous end but before the drive completes → TRANSIT_IMPOSSIBLE', () => {
    // a ends 09:00, 30 min drive → arrival 09:30; b pinned 09:10 → short by 20
    const conflicts = run(480, [
      { id: 'a', durationMin: 60, legAfterMin: 30 },
      { id: 'b', durationMin: 60, anchorStartMin: 550 },
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      rule: 'TRANSIT_IMPOSSIBLE',
      severity: 'hard',
      messageParams: { b: 'Stop b', m: 20 },
    });
  });

  test('boundary: pin exactly at arrival is feasible — no conflict', () => {
    const conflicts = run(480, [
      { id: 'a', durationMin: 60, legAfterMin: 30 },
      { id: 'b', durationMin: 60, anchorStartMin: 570 },
    ]);
    expect(conflicts).toEqual([]);
  });
});

describe('opening-hours family', () => {
  test('arrival after last entry → hard, with minutes late and the cutoff time', () => {
    const conflicts = run(480, [
      { id: 'a', durationMin: 120, legAfterMin: 30 },
      { id: 'b', durationMin: 60, lastEntryMin: 600 }, // arrive 10:30, last entry 10:00
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      rule: 'ARRIVE_AFTER_LAST_ENTRY',
      severity: 'hard',
      stopIds: ['b'],
      messageParams: { s: 'Stop b', m: 30, t: '10:00' },
    });
  });

  test('arrival past closing (no last entry set) → ARRIVE_AFTER_CLOSE', () => {
    const conflicts = run(480, [
      { id: 'a', durationMin: 120, legAfterMin: 0 },
      { id: 'b', durationMin: 60, closeMin: 570 },
    ]);
    expect(conflicts[0]).toMatchObject({ rule: 'ARRIVE_AFTER_CLOSE', severity: 'hard' });
  });

  test('last entry set and blown: only the last-entry conflict fires, not close too', () => {
    const conflicts = run(480, [
      { id: 'a', durationMin: 300, legAfterMin: 0 },
      { id: 'b', durationMin: 60, lastEntryMin: 600, closeMin: 660 },
    ]);
    expect(conflicts.map((c) => c.rule)).toEqual(['ARRIVE_AFTER_LAST_ENTRY']);
  });

  test('boundary: arriving exactly at last entry / exactly at close is fine', () => {
    expect(
      run(480, [{ id: 'a', durationMin: 0, lastEntryMin: 480, closeMin: 480 }]),
    ).toEqual([]);
  });

  test('arriving before opening → soft wait conflict', () => {
    const conflicts = run(480, [{ id: 'a', durationMin: 60, openMin: 540 }]);
    expect(conflicts[0]).toMatchObject({
      rule: 'ARRIVE_BEFORE_OPEN',
      severity: 'soft',
      messageParams: { m: 60, t: '09:00' },
    });
  });
});

describe('CLOSED_DAY (hard) — needs a calendar date', () => {
  test('stop closed on the day-of-week of the day date', () => {
    // 2026-08-28 is a Friday (weekday 5)
    const conflicts = run(
      480,
      [{ id: 'a', durationMin: 60, closedWeekdays: [5, 6] }],
      trip(),
      day({ date: '2026-08-28' }),
    );
    expect(conflicts[0]).toMatchObject({ rule: 'CLOSED_DAY', severity: 'hard', messageParams: { d: 5 } });
  });

  test('no date on the day → the rule cannot fire', () => {
    expect(run(480, [{ id: 'a', durationMin: 60, closedWeekdays: [0, 1, 2, 3, 4, 5, 6] }])).toEqual([]);
  });

  test('weekdayOf is timezone-independent calendar math', () => {
    expect(weekdayOf('2026-08-28')).toBe(5); // Friday
    expect(weekdayOf('2026-08-29')).toBe(6); // Saturday
    expect(weekdayOf('not-a-date')).toBeNull();
  });
});

describe('CURFEW_MISS (soft)', () => {
  test('day ending past the curfew flags the last stop', () => {
    const conflicts = run(
      480,
      [
        { id: 'a', durationMin: 60, legAfterMin: 0 },
        { id: 'b', durationMin: 120 },
      ],
      trip(),
      day({ curfewMin: 600 }),
    );
    expect(conflicts[0]).toMatchObject({
      rule: 'CURFEW_MISS',
      severity: 'soft',
      stopIds: ['b'],
      messageParams: { m: 60, t: '10:00' },
    });
  });

  test('boundary: ending exactly at curfew is fine', () => {
    expect(
      run(480, [{ id: 'a', durationMin: 120 }], trip(), day({ curfewMin: 600 })),
    ).toEqual([]);
  });
});

describe('DRIVE_STRETCH_EXCEEDED (soft)', () => {
  test('a single leg longer than the trip limit flags the stop that owns it', () => {
    const conflicts = run(
      480,
      [
        { id: 'a', durationMin: 30, legAfterMin: 150 },
        { id: 'b', durationMin: 30 },
      ],
      trip({ maxDriveStretchMin: 120 }),
    );
    expect(conflicts[0]).toMatchObject({
      rule: 'DRIVE_STRETCH_EXCEEDED',
      severity: 'soft',
      stopIds: ['a'],
      messageParams: { m: 150, max: 120 },
    });
  });

  test('no limit configured → never fires', () => {
    expect(run(480, [{ id: 'a', durationMin: 30, legAfterMin: 600 }, { id: 'b', durationMin: 1 }])).toEqual([]);
  });
});

describe('stable identity (D-020)', () => {
  test('the id survives changes to durations and message params', () => {
    const before = run(480, [
      { id: 'a', durationMin: 60, legAfterMin: 30 },
      { id: 'b', durationMin: 60, anchorStartMin: 550 },
    ]);
    const after = run(480, [
      { id: 'a', durationMin: 60, legAfterMin: 60 }, // now short by 50, not 20
      { id: 'b', durationMin: 30, anchorStartMin: 550 },
    ]);
    expect(before[0]!.rule).toBe('TRANSIT_IMPOSSIBLE');
    expect(after[0]!.rule).toBe('TRANSIT_IMPOSSIBLE');
    expect(after[0]!.id).toBe(before[0]!.id);
    expect(after[0]!.messageParams.m).not.toBe(before[0]!.messageParams.m);
  });
});

describe('visibleConflicts — acknowledgements that survive and re-raise (D-020)', () => {
  const soft: import('./conflicts').Conflict = {
    id: 'CURFEW_MISS:d1:b',
    rule: 'CURFEW_MISS',
    severity: 'soft',
    dayId: 'd1',
    stopIds: ['b'],
    messageKey: 'k',
    messageParams: {},
  };
  const hardSameId: import('./conflicts').Conflict = { ...soft, severity: 'hard' };

  test('an acknowledged conflict moves to the acknowledged bucket', () => {
    const v = visibleConflicts([soft], [{ id: soft.id, severity: 'soft' }]);
    expect(v.active).toEqual([]);
    expect(v.acknowledged).toHaveLength(1);
  });

  test('escalation re-raises: acknowledged as soft, now hard → active again', () => {
    const v = visibleConflicts([hardSameId], [{ id: soft.id, severity: 'soft' }]);
    expect(v.active).toHaveLength(1);
    expect(v.acknowledged).toEqual([]);
  });

  test('active conflicts sort hard before soft', () => {
    const other: import('./conflicts').Conflict = { ...soft, id: 'X:d1:a', rule: 'OVERLAP', severity: 'hard' };
    const v = visibleConflicts([soft, other], []);
    expect(v.active.map((c) => c.severity)).toEqual(['hard', 'soft']);
  });
});
