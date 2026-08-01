import type { ScheduledStop } from './schedule';
import { formatHM } from './time';

// The constraint engine (spec §4.2, D-020, issue #14). Pure and total: given a
// day's data + its computed schedule, emit conflicts. Every conflict carries a
// STABLE identity (rule + subject stops) so acknowledgements survive recomputes;
// message params refresh freely without changing identity.

export type Severity = 'hard' | 'soft';

export type RuleId =
  | 'OVERLAP'
  | 'TRANSIT_IMPOSSIBLE'
  | 'ARRIVE_AFTER_LAST_ENTRY'
  | 'ARRIVE_AFTER_CLOSE'
  | 'ARRIVE_BEFORE_OPEN'
  | 'CLOSED_DAY'
  | 'CURFEW_MISS'
  | 'DRIVE_STRETCH_EXCEEDED';

export interface Conflict {
  /** Stable identity: rule + day + subject stops. Params are NOT part of it. */
  id: string;
  rule: RuleId;
  severity: Severity;
  dayId: string;
  stopIds: string[];
  messageKey: string;
  messageParams: Record<string, string | number>;
}

export interface ConflictStop {
  id: string;
  name: string;
  openMin: number | null;
  closeMin: number | null;
  lastEntryMin: number | null;
  closedWeekdays: number[] | null;
}

export interface ConflictDay {
  id: string;
  date?: string; // ISO YYYY-MM-DD
  curfewMin: number | null;
}

export interface ConflictTripSettings {
  maxDriveStretchMin: number | null;
}

export interface DismissalRecord {
  id: string; // conflict id
  severity: Severity; // severity at the time of acknowledgement
}

/** Calendar weekday (0=Sunday…6=Saturday) — computed via UTC so the answer is
 *  identical in every runtime timezone (a date is a calendar fact, D-018). */
export function weekdayOf(dateISO: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
}

const conflictId = (rule: RuleId, dayId: string, stopIds: string[]) =>
  `${rule}:${dayId}:${[...stopIds].sort().join('+')}`;

const make = (
  rule: RuleId,
  severity: Severity,
  dayId: string,
  stopIds: string[],
  messageKey: string,
  messageParams: Record<string, string | number>,
): Conflict => ({ id: conflictId(rule, dayId, stopIds), rule, severity, dayId, stopIds, messageKey, messageParams });

/** The chain's physical arrival at a stop (before any anchor pinning). */
const arrivalMin = (s: ScheduledStop) => s.startMin - s.slackBeforeMin + s.lateByMin;

export function computeConflicts(
  trip: ConflictTripSettings,
  day: ConflictDay,
  stops: readonly ConflictStop[],
  schedule: readonly ScheduledStop[],
): Conflict[] {
  const conflicts: Conflict[] = [];
  const weekday = day.date != null ? weekdayOf(day.date) : null;

  schedule.forEach((sched, i) => {
    const stop = stops[i];
    if (!stop) return;
    const arrival = arrivalMin(sched);

    // OVERLAP / TRANSIT_IMPOSSIBLE — a pinned start the chain can't honor
    // (D-025: lateness is flagged, never propagated). Overlap when the pin is
    // before the previous stop even ENDS; otherwise the time exists but the
    // drive doesn't fit.
    if (sched.lateByMin > 0 && i > 0) {
      const prev = schedule[i - 1]!;
      const prevStop = stops[i - 1]!;
      if (sched.startMin < prev.endMin) {
        conflicts.push(
          make('OVERLAP', 'hard', day.id, [prevStop.id, stop.id], 'conflictOverlap', {
            a: prevStop.name,
            b: stop.name,
            m: prev.endMin - sched.startMin,
          }),
        );
      } else {
        conflicts.push(
          make('TRANSIT_IMPOSSIBLE', 'hard', day.id, [prevStop.id, stop.id], 'conflictTransit', {
            b: stop.name,
            m: sched.lateByMin,
          }),
        );
      }
    }

    // Opening-hours family. Last-entry beats close (arrival past close implies
    // past last entry — emit the most actionable one only).
    if (stop.lastEntryMin != null && arrival > stop.lastEntryMin) {
      conflicts.push(
        make('ARRIVE_AFTER_LAST_ENTRY', 'hard', day.id, [stop.id], 'conflictLastEntry', {
          s: stop.name,
          m: arrival - stop.lastEntryMin,
          t: formatHM(stop.lastEntryMin),
        }),
      );
    } else if (stop.closeMin != null && arrival > stop.closeMin) {
      conflicts.push(
        make('ARRIVE_AFTER_CLOSE', 'hard', day.id, [stop.id], 'conflictClose', {
          s: stop.name,
          t: formatHM(stop.closeMin),
        }),
      );
    } else if (stop.openMin != null && arrival < stop.openMin) {
      conflicts.push(
        make('ARRIVE_BEFORE_OPEN', 'soft', day.id, [stop.id], 'conflictBeforeOpen', {
          s: stop.name,
          m: stop.openMin - arrival,
          t: formatHM(stop.openMin),
        }),
      );
    }

    if (weekday != null && stop.closedWeekdays?.includes(weekday)) {
      conflicts.push(
        make('CLOSED_DAY', 'hard', day.id, [stop.id], 'conflictClosedDay', {
          s: stop.name,
          d: weekday,
        }),
      );
    }

    // DRIVE_STRETCH — continuous drive after this stop exceeds the trip limit.
    if (
      trip.maxDriveStretchMin != null &&
      sched.legAfterMin != null &&
      sched.legAfterMin > trip.maxDriveStretchMin
    ) {
      conflicts.push(
        make('DRIVE_STRETCH_EXCEEDED', 'soft', day.id, [stop.id], 'conflictDriveStretch', {
          s: stop.name,
          m: sched.legAfterMin,
          max: trip.maxDriveStretchMin,
        }),
      );
    }
  });

  // CURFEW — the day must end by day.curfewMin.
  const last = schedule[schedule.length - 1];
  const lastStop = stops[stops.length - 1];
  if (day.curfewMin != null && last && lastStop && last.endMin > day.curfewMin) {
    conflicts.push(
      make('CURFEW_MISS', 'soft', day.id, [lastStop.id], 'conflictCurfew', {
        m: last.endMin - day.curfewMin,
        t: formatHM(day.curfewMin),
      }),
    );
  }

  return conflicts;
}

export interface VisibleConflicts {
  active: Conflict[];
  /** Acknowledged and currently suppressed (shown collapsed in the drawer). */
  acknowledged: Conflict[];
}

/** D-020: an acknowledgement survives recomputes and re-raises only when the
 *  conflict escalated (was acknowledged as soft, is now hard). */
export function visibleConflicts(
  conflicts: readonly Conflict[],
  dismissals: readonly DismissalRecord[],
): VisibleConflicts {
  const byId = new Map(dismissals.map((d) => [d.id, d]));
  const active: Conflict[] = [];
  const acknowledged: Conflict[] = [];
  for (const c of conflicts) {
    const d = byId.get(c.id);
    const escalated = d != null && c.severity === 'hard' && d.severity === 'soft';
    if (d && !escalated) acknowledged.push(c);
    else active.push(c);
  }
  const order = { hard: 0, soft: 1 } as const;
  active.sort((a, b) => order[a.severity] - order[b.severity]);
  return { active, acknowledged };
}
