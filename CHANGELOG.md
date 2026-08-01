# Changelog

All notable **user-visible** changes to Tiyul, per [Keep a Changelog](https://keepachangelog.com/) conventions. Every PR that changes what a user sees or can do adds a line here **in the same PR** (D-021). Milestone closes become tagged GitHub Releases.

Design-phase history (PRs #1–#4) lives in DECISIONS.md and the PRs themselves; this log starts counting with the first shipped code.

## [Unreleased]

### Added — M0 skeleton (PR #5)

- Trips: create, open, delete (with confirmation), and a one-tap **demo trip** modeled on a Yahel long weekend.
- Day timeline: add days, add/rename/delete stops, durations and manual drive legs, with **all times recomputed live** from the day start after every edit.
- Reorder stops by drag (mouse/touch/keyboard) or accessible move buttons.
- **Waze deep link** on any stop with a place set.
- Hebrew-first UI with full RTL, English toggle (persisted).
- Local-only storage (IndexedDB) with a versioned schema and migration harness — plans survive reloads and upgrades.
- Installable PWA manifest (offline bundles arrive in M1).
- Foundations: op-based undo-ready store (D-020), wall-clock time types (D-018), dual-timezone CI with tests at every level (D-013).
