# Tiyul · טיול — travel-planner

An offline-first PWA for planning trips with family and friends — in Israel and abroad — that catches planning mistakes **before** the trip does.

**The core idea:** a trip plan is a living timeline, not a document. Stops get computed drive times between them; a constraint engine continuously checks the schedule (opening hours & last entries, kids' meal windows, Shabbat times per location, enough car seats per day) and flags conflicts with one-tap fixes. The whole trip — schedule, tickets, maps — works with zero bars.

**Built for groups:** participants join from a WhatsApp link with no account or password — RSVP per day/activity, vote in polls, claim shared shopping-list items ("I'm buying the meat") — and expenses split automatically by who attended what.

| Document | What's in it |
|---|---|
| [PRODUCT_DESIGN.md](PRODUCT_DESIGN.md) | Full product spec: personas, acceptance scenarios, feature specs, data model, architecture, roadmap (M0–M3) |
| [DECISIONS.md](DECISIONS.md) | The decision log — every significant choice, with its why and when to revisit |
| [CLAUDE.md](CLAUDE.md) | Working agreements: PR-only workflow, documentation rules, public-repo data policy |
| [TESTING.md](TESTING.md) | Testing strategy: risk-ordered pyramid, tools, E2E suites, binding test policies |
| [REGRESSIONS.md](REGRESSIONS.md) | Escape log — every bug that slipped through, why tests missed it, and the class-level fix |
| [CHANGELOG.md](CHANGELOG.md) | User-visible changes per PR; milestone closes become tagged releases |

## Quickstart

```bash
npm ci            # install
npm run dev       # dev server
npm test          # unit + component tests with coverage gates
npm run e2e       # Playwright E2E (builds + serves automatically)
npm run build     # production build (PWA)
```

**Owner setup (one-time, after PR #5):** import the repo in Vercel/Netlify for per-PR preview deploys (D-021), and enable branch protection on `main` requiring the CI checks (TESTING.md §5).

## Status

**M0 in review (PR #5).** Design docs (PRs #1–#4) are merged; the M0 skeleton — timeline with live recompute, op-based store, versioned schema, Hebrew/RTL, tests at every level, CI — is up for review. M0 exits via the **Yahel field test** (real 3-family trip, Aug 28–31, D-022). Roadmap: [PRODUCT_DESIGN.md §8](PRODUCT_DESIGN.md#8-roadmap).
