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

## Status

**Design phase.** Spec v0.1 approved and merged (PR #1); testing strategy defined (PR #2). Implementation starts with milestone M0 (timeline skeleton + test/CI scaffold). See the roadmap in [PRODUCT_DESIGN.md §8](PRODUCT_DESIGN.md#8-roadmap).
