// Times follow D-018: planned times are local wall-clock minutes-since-midnight
// plus an IANA zone on the Day. Never UTC instants — a 09:00 hike stays 09:00.

export type StopKind = 'activity' | 'meal' | 'lodging' | 'free';

// v4: trip-level Shabbat observance (participant profiles are M2, spec §4.5).
export type Observance = 'none' | 'soft' | 'hard';

export interface Trip {
  id: string;
  name: string;
  createdAt: string; // ISO, audit only
  // v3: group tolerance for continuous driving (participant profiles are M2).
  maxDriveStretchMin: number | null;
  // v4: decides whether SHABBAT_CONFLICT fires, and how hard.
  observance: Observance;
}

export interface Day {
  id: string;
  tripId: string;
  index: number;
  title: string;
  date?: string; // ISO calendar date, optional in M0
  startMin: number; // wall-clock minutes since midnight
  zone: string; // IANA zone, e.g. 'Asia/Jerusalem'
  // v3: "back home/hotel by" — CURFEW_MISS raises when the day ends later.
  curfewMin: number | null;
  // v4: the day's (lodging) location — feeds offline zmanim (D-006/D-027).
  lat: number | null;
  lng: number | null;
  locationName: string | null;
}

export interface Stop {
  id: string;
  dayId: string;
  index: number;
  name: string;
  kind: StopKind;
  durationMin: number;
  legAfterMin: number | null; // manual drive minutes to the NEXT stop (M0; auto legs are M1)
  // D-025: a non-null value pins the start (reservation/tour); floaters carry null.
  anchorStartMin: number | null;
  // v3: opening-hours facts feeding the constraint engine (all optional).
  openMin: number | null;
  closeMin: number | null;
  lastEntryMin: number | null;
  closedWeekdays: number[] | null; // 0=Sunday…6=Saturday
  wazeQuery?: string;
  note?: string;
}

// v5: a wallet attachment (spec §4.3) — ticket/QR/PDF stored as a Blob so the
// entrance-gate moment works with zero bars. Capped at 10MB per file (D-028).
export interface Attachment {
  id: string;
  tripId: string;
  stopId: string;
  name: string;
  mimeType: string;
  data: Blob;
  createdAt: string; // ISO, audit only
}

// v3: an acknowledged conflict (D-020) — id IS the conflict's stable identity.
export interface Dismissal {
  id: string;
  tripId: string;
  severity: 'hard' | 'soft'; // severity at acknowledgement time (re-raise on escalation)
  createdAt: string; // ISO, audit only
}
