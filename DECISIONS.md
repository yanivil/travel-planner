# Decision log

Every significant product or technical decision gets an entry here, **in the same PR that implements it**. Format: context → decision → why → revisit-when. Newest at the bottom. This file exists so that six months from now we know not just *what* we did but *why*.

---

### D-001 · 2026-08-01 · Working name: "Tiyul"
**Decision:** working name is Tiyul (טיול); alternates parked: Maslul, Derech.
**Why:** short, Hebrew-native, describes the product; zero branding effort at this stage.
**Revisit when:** before any public release / app-store listing.

### D-002 · 2026-08-01 · PWA over native apps
**Decision:** build one installable Progressive Web App (React + TypeScript + Vite), no iOS/Android native apps.
**Why:** the group-adoption model depends on "open a link, no install"; one codebase; offline achievable with service workers. Original requirement from the product brief.
**Revisit when:** we need capabilities PWAs can't give (reliable background push on iOS, >1 GB storage).

### D-003 · 2026-08-01 · MapLibre GL + OSM tiles (not Google Maps)
**Decision:** maps render with MapLibre GL using OpenStreetMap-based tiles.
**Why:** offline trip bundles require caching map tiles; Google Maps tile licensing forbids that. OSM licensing allows it.
**Trade-off accepted:** weaker POI/business data than Google — mitigated by paste-a-Google-Maps-link import (D-007).

### D-004 · 2026-08-01 · Routing via OpenRouteService behind an abstraction
**Decision:** drive-time legs computed by OpenRouteService (free tier) behind a `RoutingProvider` interface; results cached aggressively and frozen (with timestamp) into offline bundles.
**Why:** cost control during development; the abstraction lets Google Routes API swap in if ORS quality disappoints in Israel.
**Revisit when:** leg-time accuracy complaints on real trips.

### D-005 · 2026-08-01 · Supabase backend; sync = offline queue + last-writer-wins; CRDT deferred
**Decision:** Supabase (Postgres, Auth, Realtime, Storage). Offline edits queue locally and sync with last-writer-wins per field plus a "changed while you were away" review list. CRDT (Yjs/PowerSync) explicitly deferred.
**Why:** fastest path to group sharing with row-level security; CRDT complexity isn't justified before real evidence of concurrent-edit conflicts.
**Revisit when:** M2 instrumentation shows meaningful simultaneous editing.

### D-006 · 2026-08-01 · Hebrew calendar computed client-side with @hebcal/core
**Decision:** Shabbat/chag entry-exit times (per location) computed in the client with @hebcal/core.
**Why:** must work offline (candle-lighting time in a dead zone matters); library is accurate per lat/lng and removes a server dependency.

### D-007 · 2026-08-01 · Places data: manual entry + link-paste in MVP; Places API later
**Decision:** MVP has no paid places search. Stops are created manually or by pasting a Google Maps link (parsed for name/coords). Google Places API integration deferred to M3.
**Why:** Places API is the biggest external cost; opening hours can be entered manually for the ~10 stops of a family trip until the core proves itself.
**Revisit when:** M2 usage shows manual hours entry is a real friction point.

### D-008 · 2026-08-01 · No username/password for participants; magic links + passwordless editors
**Decision:** trip participants view, RSVP, vote, and tick list items through an accountless share link (magic-link identity: open link → pick yourself from the participant list). Editing the plan requires sign-in, but passwordless only: Google or SMS one-time code. The organizer can revoke/rotate a trip link.
**Why:** adoption by grandparents and friends is the hardest product constraint; every account/password step loses people. A leaked link exposes one trip and is revocable; sensitive documents are excluded from v1 anyway (D-011).
**Revisit when:** a real privacy incident, or trips with >20 participants.

### D-009 · 2026-08-01 · Map is a view mode of Plan, not a separate tab; Lists gets the tab
**Decision:** trip tab bar is Plan · People · Lists · Wallet · Money. The map is a timeline⇄map toggle inside Plan.
**Why:** a shared-lists surface earned a top-level tab (D-010) and five tabs is the ceiling; the day editor already pairs timeline+map, so a separate Map tab duplicated a view.
**Trigger:** user's real trip artifacts (Kibbutz Yahel, Aug 2026) — see D-010.

### D-010 · 2026-08-01 · Shared lists = shopping AND packing, linked to expenses
**Decision:** ListItem entity supports kind=shopping (category, quantity, "who buys" claim, bought ✓) and kind=packing/gear (claims). A bought item converts to an expense in one tap, split among beneficiaries. Editable from the accountless link.
**Why:** the user validated the design against their real consolidated shopping list for a 3-family trip (6 adults + 4 kids); the original design only had gear claims. Shopping → expense closes the loop with cost splitting.
**Origin:** user request, 2026-08-01, based on shopping_list_v3.pdf / vacation_schedule_v3.pdf (kept out of the repo — personal data, public repo).

### D-011 · 2026-08-01 · Passports and official IDs stay out of the wallet in v1
**Decision:** the trip wallet holds tickets/confirmations/QR codes; passports and government IDs are excluded.
**Why:** storing identity documents makes the app a liability target; device photo galleries already solve this adequately.
**Revisit when:** strong recurring user demand AND we can afford proper client-side encryption design.

### D-012 · 2026-08-01 · v1 non-goals
**Decision:** no in-app booking/payments, no chat, no turn-by-turn navigation, no flight/hotel search, no social feeds.
**Why:** each one is a product in itself; WhatsApp and Waze already won their niches — we deep-link into them instead of competing.

### D-013 · 2026-08-01 · Testing strategy: risk-ordered pyramid + escape analysis on every bug
**Decision:** Vitest (+fast-check property tests) / React Testing Library + MSW + fake-indexeddb / Playwright (multi-context, offline, mobile viewport, RTL) with axe a11y checks; unit suite runs in both TZ=UTC and TZ=Asia/Jerusalem. Binding policies: tests ship in the same PR as the behavior; bug fixes start with a failing repro test and must document root cause + why tests missed it + class-level prevention (logged in REGRESSIONS.md); CI green required to merge; core logic (constraints, timeline recompute, money) is test-first with ~100% branch target; flaky tests are quarantined then fixed-or-deleted within a week. Full detail: TESTING.md.
**Why:** the product's whole promise is "the plan is correct" — a wrong arrival time or Shabbat miscalculation is product failure, and offline/multi-user paths are where PWAs quietly rot. Owner explicitly requires that every future fix carries tests plus an understanding of why the gap existed (learning loop, not patch loop).
**Trigger:** owner request, 2026-08-01.
**Revisit when:** CI wall-time exceeds ~10 min on PRs, or the regression log shows an escape class the pyramid doesn't address.
