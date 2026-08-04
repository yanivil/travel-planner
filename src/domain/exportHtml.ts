import type { Day, Stop, Trip } from './types';
import { computeDaySchedule } from './schedule';
import { formatHM, formatRange } from './time';
import { wazeUrl } from './waze';

// Single-file HTML export (spec §4.7, "never hostage"): one self-contained,
// offline-readable, print-friendly file. No external scripts, styles, or
// fonts — it must open from file:// with zero bars. Embeds the schema version
// and the raw trip JSON (D-019) so a future import can round-trip it.

export interface ExportDay {
  day: Day;
  stops: Stop[];
  candleMin: number | null;
  havdalahMin: number | null;
  conflictTexts: string[];
}

export interface ExportInput {
  trip: Trip;
  days: ExportDay[];
  lang: 'he' | 'en';
  generatedAtISO: string;
  schemaVersion: number;
}

const LABELS = {
  he: {
    generated: 'הופק',
    curfew: 'חזרה עד',
    candles: 'הדלקת נרות',
    havdalah: 'הבדלה',
    conflicts: 'התנגשויות פתוחות',
    drive: 'נסיעה',
    min: 'דק׳',
    approx: 'זמנים משוערים',
    empty: 'אין עצירות ביום הזה',
  },
  en: {
    generated: 'Generated',
    curfew: 'Back by',
    candles: 'Candles',
    havdalah: 'Havdalah',
    conflicts: 'Open conflicts',
    drive: 'drive',
    min: 'min',
    approx: 'approximate times',
    empty: 'No stops on this day',
  },
} as const;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function exportFileName(tripName: string): string {
  const safe = tripName.replace(/[^\p{L}\p{N} _-]/gu, '').trim().replace(/\s+/g, '-');
  return `tiyul-${safe || 'trip'}.html`;
}

export function buildTripExportHtml({ trip, days, lang, generatedAtISO, schemaVersion }: ExportInput): string {
  const L = LABELS[lang];
  const dir = lang === 'he' ? 'rtl' : 'ltr';

  const daySections = days
    .map(({ day, stops, candleMin, havdalahMin, conflictTexts }) => {
      const schedule = computeDaySchedule(day.startMin, stops);
      const meta: string[] = [];
      if (day.date) meta.push(esc(day.date));
      if (day.locationName) meta.push(esc(day.locationName));
      if (candleMin != null) meta.push(`🕯 ${L.candles} ${formatHM(candleMin)}`);
      if (havdalahMin != null) meta.push(`✨ ${L.havdalah} ${formatHM(havdalahMin)}`);
      if (day.curfewMin != null) meta.push(`${L.curfew} ${formatHM(day.curfewMin)}`);

      const rows = schedule
        .map((sched, i) => {
          const stop = stops[i]!;
          const pin = stop.anchorStartMin != null ? '📌 ' : '';
          const waze = stop.wazeQuery
            ? ` <a href="${esc(wazeUrl(stop.wazeQuery))}">Waze ↗</a>`
            : '';
          const leg =
            sched.legAfterMin != null
              ? // nextArriveMin is non-null exactly when a leg exists (schedule invariant)
                `<div class="leg">🚗 ${sched.legAfterMin} ${L.min} · ${formatHM(sched.nextArriveMin!)}</div>`
              : '';
          return `<div class="stop"><span class="t">${pin}${formatRange(sched.startMin, sched.endMin)}</span> <span class="n">${esc(stop.name)}</span>${waze}</div>${leg}`;
        })
        .join('\n');

      const conflictsBlock = conflictTexts.length
        ? `<div class="conflicts"><strong>${L.conflicts} (${conflictTexts.length}):</strong><ul>${conflictTexts
            .map((c) => `<li>${esc(c)}</li>`)
            .join('')}</ul></div>`
        : '';

      return `<section class="day">
<h2>${esc(day.title)}</h2>
${meta.length ? `<p class="meta">${meta.join(' · ')}${candleMin != null || havdalahMin != null ? ` <small>(${L.approx})</small>` : ''}</p>` : ''}
${rows || `<p class="meta">${L.empty}</p>`}
${conflictsBlock}
</section>`;
    })
    .join('\n');

  const payload = JSON.stringify({
    schemaVersion,
    trip,
    days: days.map((d) => ({ day: d.day, stops: d.stops })),
  }).replace(/<\//g, '<\\/');

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="tiyul-schema-version" content="${schemaVersion}" />
<title>${esc(trip.name)}</title>
<style>
body { font-family: system-ui, sans-serif; max-width: 720px; margin: 0 auto; padding: 16px; color: #22333b; }
h1 { font-size: 1.4rem; margin-bottom: 0; }
.sub { color: #52646c; font-size: 0.85rem; margin-top: 2px; }
.day { border-top: 2px solid #d9d6cb; margin-top: 20px; padding-top: 8px; break-inside: avoid; }
h2 { font-size: 1.05rem; }
.meta { color: #52646c; font-size: 0.85rem; }
.stop { padding: 3px 0; }
.t { font-variant-numeric: tabular-nums; color: #52646c; font-size: 0.9rem; }
.n { font-weight: 600; }
.leg { color: #52646c; font-size: 0.82rem; padding-inline-start: 14px; }
.conflicts { background: #f6ecd9; border-radius: 8px; padding: 6px 10px; font-size: 0.85rem; margin-top: 6px; }
.conflicts ul { margin: 4px 0 0; padding-inline-start: 18px; }
a { color: #20708f; }
@media print { body { max-width: none; } a { text-decoration: none; color: inherit; } }
</style>
</head>
<body>
<h1>${esc(trip.name)}</h1>
<p class="sub">${L.generated} ${esc(generatedAtISO.slice(0, 16).replace('T', ' '))} · Tiyul</p>
${daySections}
<script type="application/json" id="tiyul-data">${payload}</script>
</body>
</html>`;
}
