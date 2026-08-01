export const DAY_MIN = 24 * 60;

// Wall-clock display for minutes-since-midnight; values past midnight wrap
// and are marked so a late return (25:15 → "01:15+1") is never silently wrong.
export function formatHM(min: number): string {
  const norm = ((min % DAY_MIN) + DAY_MIN) % DAY_MIN;
  const h = String(Math.floor(norm / 60)).padStart(2, '0');
  const m = String(norm % 60).padStart(2, '0');
  const daysOver = Math.floor(min / DAY_MIN);
  return daysOver >= 1 ? `${h}:${m}+${daysOver}` : `${h}:${m}`;
}

export function parseHM(text: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function formatRange(startMin: number, endMin: number): string {
  return `${formatHM(startMin)}–${formatHM(endMin)}`;
}
