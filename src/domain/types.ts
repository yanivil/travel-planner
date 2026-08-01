// Times follow D-018: planned times are local wall-clock minutes-since-midnight
// plus an IANA zone on the Day. Never UTC instants — a 09:00 hike stays 09:00.

export type StopKind = 'activity' | 'meal' | 'lodging' | 'free';

export interface Trip {
  id: string;
  name: string;
  createdAt: string; // ISO, audit only
}

export interface Day {
  id: string;
  tripId: string;
  index: number;
  title: string;
  date?: string; // ISO calendar date, optional in M0
  startMin: number; // wall-clock minutes since midnight
  zone: string; // IANA zone, e.g. 'Asia/Jerusalem'
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
  wazeQuery?: string;
  note?: string;
}
