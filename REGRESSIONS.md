# Regression log — every escape, and why our tests missed it

A bug that reached `main` (or worse, a real trip) means the test suite had a hole. Each one gets an entry here **in the bug-fix PR itself**, so patterns become visible over time (three timezone escapes → invest in time-property tests, not three patches).

Format:

```
### R-NNN · YYYY-MM-DD · short title
- Escaped to: dev / main / real trip
- Symptom: what the user saw
- Root cause: the actual defect
- Why tests missed it: missing level | wrong fixture | untested edge | environment gap | wrong assumption
- Class-level prevention: the test family / property / rule added (not just the single repro)
- Fix PR: #NN (first commit = failing repro test)
```

Review cadence: skim this log at every milestone close (M0–M3); if an escape class repeats, open a hardening task for that class.

---

### R-001 · 2026-08-01 · Numeric inputs ate keystrokes (333 → 3)
- **Escaped to:** production (owner field-testing, day 0 of M1)
- **Symptom:** typing `333` into the drive-to-next-stop field saved and displayed `3`; the duration field carried the same latent defect.
- **Root cause:** controlled inputs bound directly to live-query state — while the store's async echo is in flight, React resets the DOM to the stale prop value mid-typing, eating digits.
- **Why tests missed it:** the component suite deliberately used single `fireEvent.change` events to *sidestep* the known echo race (a code comment even said so) — the tests were designed around the defect instead of exposing it. Escape class: **test avoided real interaction**.
- **Class-level prevention:** shared `NumberField` (the draft owns the DOM while focused; echoes sync only when idle) is now mandatory for every live-bound numeric input, plus two suite additions: a focused-field protection contract test and a real multi-digit `user.type` journey. Remaining live-bound time inputs (day start, pinned start) audited — they commit whole `HH:MM` values so the window is far smaller, but they're tracked for the same draft treatment under #21.
- **Fix PR:** #23 (first commit is the failing repro, per protocol)
