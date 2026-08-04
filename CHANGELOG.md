# Changelog

All notable **user-visible** changes to Tiyul, per [Keep a Changelog](https://keepachangelog.com/) conventions. Every PR that changes what a user sees or can do adds a line here **in the same PR** (D-021). Milestone closes become tagged GitHub Releases.

Design-phase history (PRs #1–#4) lives in DECISIONS.md and the PRs themselves; this log starts counting with the first shipped code.

## [Unreleased]

### Added — single-file HTML export (PR #31)

- **ייצוא (HTML)** on any trip downloads one self-contained file: the full computed plan — times, drive legs, 📌 pins, zmanim, curfews, open conflicts, Waze links — that opens **from the file itself with zero network**, prints cleanly, and can be sent in WhatsApp. The plan is never hostage (spec §4.7).
- The file embeds the schema version and the raw trip data, so a future version of Tiyul will be able to import it back.

### Added — undo & redo (PR #30)

- **↩ / ↪ in the header, plus Ctrl/Cmd+Z and Ctrl+Shift+Z / Ctrl+Y** — every edit in Tiyul is reversible: stops, days, trips, pins, hours, even conflict acknowledgements. A toast says exactly what was undone ("בוטל: הוספת עצירה").
- A new edit after undo forks the timeline (redo clears), and undoing a trip you're inside returns you safely to the list.
- Text fields keep their native undo — the app never hijacks Ctrl+Z while you're typing.

### Added — Shabbat & calendar awareness (PR #29)

- **Candle-lighting and havdalah times, computed on your device** (works offline) for any day with a date + location — pick from Israeli presets (Yahel, Jerusalem, Tzfat…) or paste coordinates/a Maps link. Jerusalem automatically uses the 40-minute minhag. Times are marked as halachic approximations.
- **A Shabbat band on the timeline** ("שבת נכנסת · 18:46") where candle-lighting falls in your day.
- **New rule: SHABBAT_CONFLICT** — per the trip's new *Shabbat observance* setting (off / warn / strict), the engine flags **driving** after candle-lighting or before havdalah. Dinner running past candles at the lodging is deliberately not a conflict.
- The demo trip carries real Yahel zmanim (candles 18:46 that Friday); its observance ships **off** — flip it to "warn" to watch the Saturday drive to Eilat get flagged.

### Added — the constraint engine (PR #28)

- **Tiyul now argues back.** A conflicts drawer under each day lists everything wrong with the plan — hard blockers (red) and soft warnings (amber) — and every conflicted stop carries a chip.
- **First eight rules:** overlap with a pinned reservation · not-enough-drive-time · arrival after last entry · arrival after closing · arrival before opening · closed-that-weekday · past the day's "back by" curfew · continuous drive over the trip's limit.
- **"ראינו, בסדר" (Acknowledge):** soft warnings can be acknowledged — the acknowledgement is saved, survives reloads and recomputes, can be re-raised, and would automatically return if the situation ever escalates. Hard blockers can't be waved away.
- **New planning facts you can record:** opening hours / last entry / closed weekdays per stop (ⓘ on the stop), a calendar date and a "Back by" time per day, and a max-continuous-drive limit per trip.
- The demo trip's Saturday now deliberately ends 30 minutes past its curfew — open it to see the engine catch it.

### Fixed — numeric fields ate keystrokes (R-001, PR #23)

- Typing multi-digit values into the duration / drive-time fields no longer loses digits: while you type, the field is yours — storage updates sync in only when you leave it.
- Clearer field label: **"נסיעה לעצירה הבאה (דק׳)" / "Drive to next stop (min)"** (was "Drive after (min)"), after owner confusion in field-testing.

### Added — trip rename (PR #24)

- Trip names are now editable: ✎ next to the title (Enter or leaving the field saves; blank names are rejected).

### Added — M1: anchored stops (PR #22)

- **Pin a stop's start time** (📌 on any stop) — reservations and tours no longer drift when earlier plans change.
- Arriving early at a pinned stop shows the **wait as visible slack**; arriving late shows a **"Late by X min" warning** — the plan flags its own impossibilities instead of silently shifting a reservation you can't move.
- Schema upgraded to v2 with an automatic, tested migration — existing trips are untouched.

### Added — M0 skeleton (PR #5)

- Trips: create, open, delete (with confirmation), and a one-tap **demo trip** modeled on a Yahel long weekend.
- Day timeline: add days, add/rename/delete stops, durations and manual drive legs, with **all times recomputed live** from the day start after every edit.
- Reorder stops by drag (mouse/touch/keyboard) or accessible move buttons.
- **Waze deep link** on any stop with a place set.
- Hebrew-first UI with full RTL, English toggle (persisted).
- Local-only storage (IndexedDB) with a versioned schema and migration harness — plans survive reloads and upgrades.
- Installable PWA manifest (offline bundles arrive in M1).
- Foundations: op-based undo-ready store (D-020), wall-clock time types (D-018), dual-timezone CI with tests at every level (D-013).
