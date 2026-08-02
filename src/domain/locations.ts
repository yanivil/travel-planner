// Preset locations for M1 (no geocoding until Places, D-007). Coordinates feed
// the zmanim engine; a Google-Maps paste covers everything else.

export interface PresetLocation {
  id: string;
  he: string;
  en: string;
  lat: number;
  lng: number;
}

export const PRESET_LOCATIONS: PresetLocation[] = [
  { id: 'yahel', he: 'קיבוץ יהל (ערבה)', en: 'Kibbutz Yahel (Arava)', lat: 29.878, lng: 35.096 },
  { id: 'jerusalem', he: 'ירושלים', en: 'Jerusalem', lat: 31.778, lng: 35.235 },
  { id: 'telaviv', he: 'תל אביב', en: 'Tel Aviv', lat: 32.08, lng: 34.78 },
  { id: 'haifa', he: 'חיפה', en: 'Haifa', lat: 32.794, lng: 34.989 },
  { id: 'tiberias', he: 'טבריה', en: 'Tiberias', lat: 32.795, lng: 35.53 },
  { id: 'tzfat', he: 'צפת', en: 'Tzfat', lat: 32.965, lng: 35.496 },
  { id: 'beersheva', he: 'באר שבע', en: 'Beer Sheva', lat: 31.253, lng: 34.791 },
  { id: 'eilat', he: 'אילת', en: 'Eilat', lat: 29.558, lng: 34.948 },
  { id: 'mitzpe', he: 'מצפה רמון', en: 'Mitzpe Ramon', lat: 30.61, lng: 34.801 },
  { id: 'katzrin', he: 'קצרין (גולן)', en: 'Katzrin (Golan)', lat: 32.992, lng: 35.689 },
];

/** Rough Israel bounding box — decides the hebcal Israel/Diaspora flag (D-006:
 *  per location, never per user). Good enough until real geocoding (M3). */
export function isInIsrael(lat: number, lng: number): boolean {
  return lat >= 29.3 && lat <= 33.4 && lng >= 34.2 && lng <= 35.95;
}

/** D-006: Jerusalem's minhag is 40 minutes before sunset; the general default is 18. */
export function candleMinsFor(locationName: string | null): number {
  return locationName != null && /jerusalem|ירושלים/i.test(locationName) ? 40 : 18;
}

/** Accepts "31.77, 35.21" or a pasted Google-Maps URL containing "@31.77,35.21". */
export function parseLatLng(text: string): { lat: number; lng: number } | null {
  const m =
    /@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/.exec(text) ??
    /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(text);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    return null;
  return { lat, lng };
}
