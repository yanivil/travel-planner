# Changelog

All notable **user-visible** changes to Tiyul, per [Keep a Changelog](https://keepachangelog.com/) conventions. Every PR that changes what a user sees or can do adds a line here **in the same PR** (D-021). Milestone closes become tagged GitHub Releases.

Design-phase history (PRs #1–#4) lives in DECISIONS.md and the PRs themselves; this log starts counting with the first shipped code.

## [Unreleased]

### Fixed — numeric fields ate keystrokes (R-001, PR #23)

- Typing multi-digit values into the duration / drive-time fields no longer loses digits: while you type, the field is yours — storage updates sync in only when you leave it.
- Clearer field label: **"נסיעה לעצירה הבאה (דק׳)" / "Drive to next stop (min)"** (was "Drive after (min)"), after owner confusion in field-testing.

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
