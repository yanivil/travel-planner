# Working agreements — travel-planner (Tiyul)

Product spec: [PRODUCT_DESIGN.md](PRODUCT_DESIGN.md) · Decision log: [DECISIONS.md](DECISIONS.md)

## Workflow: everything through documented PRs

- **Never commit directly to `main`.** Every change — code, docs, config — goes on a feature branch and lands via a pull request the owner reviews.
- **PR bodies must explain:** what changed, why, how it was tested/verified, and any decisions made. A future reader should understand the PR without this chat.
- **Every significant choice gets a `D-xxx` entry in DECISIONS.md in the same PR** (context → decision → why → revisit-when). If a PR changes an earlier decision, it updates that entry rather than silently diverging.
- **Branch names:** `docs/…`, `feat/…`, `fix/…`, `chore/…`.
- **Code comments** explain constraints and non-obvious whys (e.g., "frozen leg times: offline bundles must not silently restale"), never narrate the obvious.
- Keep PRs reviewable: one topic per PR.

## Repo rules

- **This repo is PUBLIC.** Never commit personal data: real family names, phone numbers, ticket PDFs, or the user's personal trip files (e.g. anything from ~/Downloads). Real-trip data may be used locally as seed fixtures only under `local/` (gitignored).
- Repo docs and code are in English. The product UI is Hebrew + English (full RTL support required).
- The user often communicates in Hebrew — reply in the language they used.

## Product context (one paragraph)

Tiyul is an offline-first PWA for planning multi-family trips (Israel + abroad): a day timeline with computed drive legs, a constraint engine that flags conflicts (opening hours, meal windows, Shabbat times, seat shortages) at planning time, accountless share links for participants (RSVP, polls, shopping-list claims), and per-trip offline bundles (plan, tickets, map tiles). See PRODUCT_DESIGN.md §3 for the three acceptance scenarios (S1–S3) and §8 for the roadmap (M0–M3).
