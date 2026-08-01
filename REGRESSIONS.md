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

*(no entries yet — the log starts counting with the first code PR)*
