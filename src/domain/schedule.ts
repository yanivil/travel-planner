export interface SchedulableStop {
  id: string;
  durationMin: number;
  legAfterMin: number | null;
  /** D-025: non-null pins the start to this wall-clock minute. */
  anchorStartMin?: number | null;
}

export interface ScheduledStop {
  stopId: string;
  startMin: number;
  endMin: number;
  /** Drive minutes to the next stop; null for the last stop. */
  legAfterMin: number | null;
  /** Arrival time at the next stop; null for the last stop. */
  nextArriveMin: number | null;
  /** Idle wait before an anchored stop (arrived early). 0 for floaters. */
  slackBeforeMin: number;
  /** How late the chain arrives at an anchored stop. 0 when feasible. */
  lateByMin: number;
}

// Pure and total: the timeline recompute. Every edit re-derives all times from
// the day start; nothing downstream is ever stored, so it can never go stale.
// D-025 anchor semantics: a pinned start is authoritative — reservations don't
// move because traffic was bad. Early arrival surfaces as slack, impossible
// arrival as lateByMin (flagged, never silently propagated); downstream times
// continue from the anchor's planned end.
export function computeDaySchedule(
  dayStartMin: number,
  stops: readonly SchedulableStop[],
): ScheduledStop[] {
  let cursor = dayStartMin;
  return stops.map((stop, i) => {
    const arriveMin = cursor;
    const anchor = stop.anchorStartMin ?? null;
    const startMin = anchor ?? arriveMin;
    const slackBeforeMin = anchor == null ? 0 : Math.max(0, anchor - arriveMin);
    const lateByMin = anchor == null ? 0 : Math.max(0, arriveMin - anchor);
    const endMin = startMin + stop.durationMin;
    const isLast = i === stops.length - 1;
    const legAfterMin = isLast ? null : (stop.legAfterMin ?? 0);
    const nextArriveMin = isLast ? null : endMin + (legAfterMin ?? 0);
    cursor = nextArriveMin ?? endMin;
    return { stopId: stop.id, startMin, endMin, legAfterMin, nextArriveMin, slackBeforeMin, lateByMin };
  });
}

export function daySpanMin(schedule: readonly ScheduledStop[]): number {
  const first = schedule[0];
  const last = schedule[schedule.length - 1];
  if (!first || !last) return 0;
  return last.endMin - first.startMin;
}
