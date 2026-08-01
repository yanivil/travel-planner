export interface SchedulableStop {
  id: string;
  durationMin: number;
  legAfterMin: number | null;
}

export interface ScheduledStop {
  stopId: string;
  startMin: number;
  endMin: number;
  /** Drive minutes to the next stop; null for the last stop. */
  legAfterMin: number | null;
  /** Arrival time at the next stop; null for the last stop. */
  nextArriveMin: number | null;
}

// Pure and total: the timeline recompute. Every edit re-derives all times from
// the day start; nothing downstream is ever stored, so it can never go stale.
export function computeDaySchedule(
  dayStartMin: number,
  stops: readonly SchedulableStop[],
): ScheduledStop[] {
  let cursor = dayStartMin;
  return stops.map((stop, i) => {
    const startMin = cursor;
    const endMin = startMin + stop.durationMin;
    const isLast = i === stops.length - 1;
    const legAfterMin = isLast ? null : (stop.legAfterMin ?? 0);
    const nextArriveMin = isLast ? null : endMin + (legAfterMin ?? 0);
    cursor = nextArriveMin ?? endMin;
    return { stopId: stop.id, startMin, endMin, legAfterMin, nextArriveMin };
  });
}

export function daySpanMin(schedule: readonly ScheduledStop[]): number {
  const first = schedule[0];
  const last = schedule[schedule.length - 1];
  if (!first || !last) return 0;
  return last.endMin - first.startMin;
}
