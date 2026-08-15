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

### D-003 · 2026-08-01 · MapLibre GL + vector PMTiles regions (not Google Maps; not raster tile caching)
**Decision:** maps render with MapLibre GL; offline regions ship as per-trip **vector PMTiles archives stored in OPFS**, served via the pmtiles protocol; style/glyphs/sprites precached by the service worker. Evaluate `@makina-corpus/maplibre-offline-pmtiles` before building our own.
**Updated 2026-08-01 (research):** originally "cached raster OSM tiles". Changed because service-worker/HTTP caching of range requests is unreliable across browsers (Cache API can't store 206 responses; Safari has a history of dropping Range through SWs), and vector region extracts are roughly 10× smaller — tens of MB per trip instead of hundreds.
**Why:** offline bundles require locally-stored map data; Google tile licensing forbids caching entirely; PMTiles turns a tile pyramid into one portable file.
**Trade-off accepted:** weaker POI/business data than Google — mitigated by paste-a-Google-Maps-link import (D-007).

### D-004 · 2026-08-01 · Routing via OpenRouteService behind an abstraction
**Decision:** drive-time legs computed by OpenRouteService (free tier) behind a `RoutingProvider` interface; results cached aggressively and frozen (with timestamp) into offline bundles.
**Why:** cost control during development; the abstraction lets Google Routes API swap in if ORS quality disappoints in Israel.
**Revisit when:** leg-time accuracy complaints on real trips.

### D-005 · 2026-08-01 · Supabase backend; sync = offline queue + last-writer-wins; upgrade path = PowerSync
**Decision:** Supabase (Postgres, Auth, Realtime, Storage). Offline edits queue locally and sync with last-writer-wins per field plus a "changed while you were away" review list. When real concurrency demands more, the designated upgrade is **PowerSync** — not CRDTs. Queue entries stay row-shaped (per-row ops + `updated_at`) so that migration is mechanical.
**Updated 2026-08-01 (research):** originally "CRDT (Yjs/PowerSync) deferred". Ecosystem review: Supabase still has no first-party offline; PowerSync is the official-partner sync engine with true offline (local SQLite; OPFS on web since 2025, Safari-compatible VFS); ElectricSQL and Zero explicitly don't target client persistence; Legend-State is lighter but has reported lost-update issues after long offline periods.
**Why:** fastest path to group sharing with row-level security; sync-engine complexity isn't justified before real evidence of concurrent-edit conflicts.
**Revisit when:** M2 instrumentation shows meaningful simultaneous editing.

### D-006 · 2026-08-01 · Hebrew calendar computed client-side with @hebcal/core
**Decision:** Shabbat/chag entry-exit times (per location) computed in the client with @hebcal/core.
**Why:** must work offline (candle-lighting time in a dead zone matters); library is accurate per lat/lng and removes a server dependency.
**Implementation notes (added 2026-08-01, research):** pin v6+ (ESM-only, ~54 KB gz incl. deps — acceptable); the Israel/Diaspora flag changes holiday scheduling and must be set **per trip location, not per user**; Jerusalem candle-lighting default is 40 min before sunset (not the general 18); use IANA timezone names only; expose candle/havdalah offsets in family profiles; show "times are approximations — consult your halachic authority" near displayed times (mirrors upstream's own disclaimer).

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

### D-014 · 2026-08-01 · Competitive-research feature additions and their phases
**Context:** owner-requested three-sweep research before M0 — competitor audit (Wanderlog/TripIt/Troupe/Roadtrippers/Tripomatic/Polarsteps/Stippl/Kayak/Splitwise/Tricount/PackPoint + OSS TREK), Reddit pain-mining, HN/technical validation. Core finding: our four pillars (constraint engine, per-activity RSVP wired to money/seats, accountless links, offline-as-free-core) are whitespace — no product has them; the gaps were import/export surfaces, pre-trip decision tools, organizer-burden tools, money depth, weather.
**Decision:** fold in — **M1:** single-file HTML export; desktop-first planning requirement. **M2:** calendar export (.ics + live feed), idea shortlist, date-grid polls, task claims, hide-costs toggle on share links, settle-up payment deep links (Bit/Paybox/Venmo/PayPal). **M3:** Open-Meteo weather joining the constraint engine, budget-vs-actual, announcement blasts, reorder-for-less-driving quick fix, packing auto-seed from stop tags. **Later/v2:** email confirmation import + flight alerts (flagship, D-016), post-trip memories, receipt OCR, room assignments. Declined: live location sharing (privacy), AI-first framing.
**Why:** every added item has multi-source evidenced demand; placements follow dependency order (sharing/expense machinery lands in M2) and risk.
**Revisit when:** M2 ships — re-rank M3/v2 against real usage.

### D-015 · 2026-08-01 · Weather source: Open-Meteo
**Decision:** weather forecasts come from Open-Meteo (key-free, free for non-commercial), fetched per outdoor-tagged stop, cached into offline bundles with a "forecast as of" stamp; feeds HEAT_WINDOW and rain warnings (M3).
**Why:** no API-key operations burden; competitors treat per-item weather as a differentiator (TripIt/IBM) while our constraint engine can act on it, not just display it.
**Revisit when:** forecast quality for Israel micro-climates (Arava, Golan) proves insufficient — then evaluate IMS data.

### D-016 · 2026-08-01 · Confirmation email import is the flagship v2 bet; booking stays a non-goal
**Decision:** v1 ships without booking-email import. It is recorded as the **first major v2 feature** (trips@ forwarding address → auto-created flight/lodging blocks; flight alerts ride on it). In-app *booking* remains a permanent non-goal — import of already-made bookings is a distinct job.
**Why:** it's the most-loved feature in the category (TripIt/Kayak) and the top wish in every launch thread — but it needs inbound-email infrastructure and resilient parsing (TripIt's 2024 import breakage shows the maintenance cost), which would sink v1 velocity. Deferring is a bet we consciously document rather than drift into.
**Revisit when:** v1 has real users; or a maintained parsing library/service makes the cost drop.

### D-017 · 2026-08-01 · Positioning: private, no-telemetry, never-hostage
**Decision:** no analytics/telemetry beyond anonymous crash reporting (opt-in), no ads, no data resale — stated publicly; every trip is exportable (single-file HTML in M1, calendar in M2). Marketing leads with the constraint engine and the timeline-map, never "AI-powered".
**Why:** research signal was unambiguous — monetization distrust and signup walls kill launches on HN; privacy-stance OSS planners attract users on that stance alone; TripIt data-loss threads show "my plan vanished" is the category's deepest fear; AI-planner framing draws skepticism (generic itineraries) while *"AI drafts, constraint engine verifies"* (future) does not.
**Revisit when:** monetization is ever considered — this decision constrains which models are acceptable.

### D-018 · 2026-08-01 · Planned times are local wall-clock + IANA zone, never UTC instants
**Decision:** all planned times (stops, meals, curfews) are stored as local wall-clock time plus IANA zone; flights carry origin-zone departure and destination-zone arrival. UTC instants are reserved for derived/audit fields (leg computed-at, sync timestamps).
**Why:** the classic scheduling-app trap — a 09:00 hike must stay 09:00 through a DST transition or an edit made from another timezone; storing instants silently shifts family plans. Decided before M0 writes the first type because retrofitting time semantics is a full rewrite.
**Revisit when:** never expected; any exception gets its own entry.

### D-019 · 2026-08-01 · Schema versioning, migrations, and versioned exports from day one
**Decision:** the IndexedDB schema is versioned from M0; every schema change ships a Dexie migration **and a migration test** (prior-version fixture → upgrade → integrity assertions, TESTING.md policy 7); every export embeds its schema version.
**Why:** offline-first means user data lives on devices for years; the first unmigrated schema change after real trips exist corrupts family data — "never hostage" (D-017) includes never corrupted by an upgrade.
**Revisit when:** never expected.

### D-020 · 2026-08-01 · Editing trust: undo/redo + conflict dismissal with stable identity
**Decision:** (a) the store is op-based from M0 so every edit is reversible; undo/redo UI ships in M1. (b) Conflicts carry a stable identity (rule + subject blocks); dismissing a soft conflict survives recomputes and re-raises only on escalation (soft→hard) or materially changed facts (M1, with the engine).
**Why:** phone drag-editing guarantees accidental edits and spreadsheet users expect Ctrl+Z; and un-dismissable warnings train users to ignore all warnings — alert fatigue would kill the constraint engine, the product's moat.
**Revisit when:** multi-user editing (M2) — undo semantics across users need a fresh look.

### D-021 · 2026-08-01 · Delivery workflow: PR preview deploys, changelog, releases, repo hygiene
**Decision:** every PR gets a preview deploy (owner reviews by using the app); merges to main auto-deploy to staging; CHANGELOG.md entry in every user-visible PR; milestone close = git tag + GitHub Release; GitHub Milestones/Issues track feature work; secrets only in vaults (.env.example in repo); Dependabot + `npm audit` (high+) in CI; bundle-size PR comments, Lighthouse advisory from M1; nightly non-blocking live-API canary.
**Why:** the owner's review gate becomes "click and try it" instead of "read the diff"; the changelog/releases extend the documentation ethos to the product; the hygiene items are table stakes for a public repo.
**Revisit when:** CI cost or preview-deploy limits bite.

### D-022 · 2026-08-01 · Three gates: Yahel field test closes M0; security review gates M2; spikes open M1
**Decision:** (a) M0's exit criterion is the real thing — the Yahel 3-family trip (Aug 28–31, 2026) planned in the app and used in the field, seeding REGRESSIONS.md with real escapes. (b) M2 ships only after a documented security & privacy review: share-link threat model (entropy, revocation), RLS policy review, rate limiting, no PII in logs, and trip-deletion purges server data. (c) M1 opens with two time-boxed spikes before deeper building: real-iPhone storage/persist() behavior with an oversized bundle, and a PMTiles offline render proof.
**Why:** (a) the calendar gift is real — M0 (~2–3 wks) can land before the trip, and no test plan beats a desert weekend with four kids; (b) M2 is where family data meets accounts and capability URLs — reviewing after shipping would be malpractice given D-017's promises; (c) both spikes de-risk the two bets with the thinnest in-the-wild evidence.
**Revisit when:** the Yahel dates move; or M2 scope changes materially.

### D-023 · 2026-08-01 · M0 implementation choices
**Decision:** data layer is Dexie + `useLiveQuery` directly — no state-management library (the op dispatcher is the single write path; live queries are the read path). Reordering ships two ways: dnd-kit drag (pointer/keyboard) *and* accessible move buttons — the buttons are the CI-tested path, drag is layered on top. Editable inputs carry per-stop accessible names ("Drive after (min) — Pool") so screen readers and tests target rows unambiguously. No router in M0 (two-screen state machine). Times render from minutes-since-midnight ints (D-018); past-midnight wraps display explicitly as "+1", never silently. Hebrew is the default locale. PWA manifest ships now; service-worker offline is deliberately M1. E2E runs against the production build with `serviceWorkers: 'block'` and `retries: 0`.
**Why:** fewest moving parts that honor the day-one foundations (D-018/019/020); accessible-buttons-as-tested-path keeps the reorder feature honestly covered while dnd gesture testing (flaky in CI) waits for the visual-regression decision at M2; Hebrew default matches the first real users (the Yahel families).
**Revisit when:** M1 UI work (map pane, undo UI) strains the no-router or no-state-lib choices.

### D-024 · 2026-08-01 · M0 security audit: clean, plus hardening shipped
**Context:** owner-requested audit before M1, triggered by the public repo + new Vercel deployment.
**Audit result:** full-history scan found no secrets and no personal data (only generic PDF filenames in D-010's text); 0 dependency vulnerabilities; no dangerous DOM patterns; secret scanning + push protection already on; ruleset verified. Vercel serves static code only — no server data exists in M0.
**Hardening decided and shipped:** CI `GITHUB_TOKEN` → `contents: read`; Dependabot enabled (alerts + security updates + weekly grouped PRs for npm and Actions); GitHub private vulnerability reporting enabled; security headers via `vercel.json` (nosniff, DENY framing, strict referrer, minimal Permissions-Policy — extend, don't drop, if M3 ever needs geolocation); SECURITY.md (posture + data-location map) and DEPLOYMENT.md (URLs, delivery loop, rollback runbook, settings inventory) added.
**Vercel Deployment Protection = Standard, deliberately:** previews are owner-only; production is public because the accountless share-link model requires it. "All Deployments" would wall the family out and is documented as the wrong setting.
**Accepted risk:** historical commits expose the owner's personal email (standard git metadata); history rewrite rejected — disruption outweighs benefit; future commits may use the GitHub noreply address at the owner's discretion.
**Deferred:** CSP to M1 (endpoints unknown until routing/tiles/weather land); the full server-side threat model remains gated on M2 (D-022).
**Update 2026-08-12 (D-029):** the CSP deferral is revised — shipped early with a self-only allow-list rather than waiting on endpoints that are blocked on provisioning; and the noreply author-email switch has been in effect since 2026-08-01.
**Revisit when:** M1 introduces external APIs (add CSP, extend headers) and at the M2 security gate.

### D-025 · 2026-08-01 · Anchor semantics: pinned starts are authoritative; lateness is flagged, never propagated
**Decision:** an anchored stop always starts at its `anchorStartMin` — the schedule renders the *plan's intent*. Early chain arrival becomes visible `slackBeforeMin` (idle wait); impossible arrival becomes `lateByMin`, surfaced as a warning chip (and, from the constraint engine in #14, a conflict). Downstream stops chain from the anchor's planned end. Floaters behave exactly as in M0 (verified by property test).
**Why:** a 13:00 reservation does not move because traffic was bad — silently shifting it would hide exactly the mistake the product exists to catch. The engine's job is to flag; the human's (later, quick fixes') job is to resolve.
**Revisit when:** the auto-solver ("make this day work") needs to propose anchor changes explicitly.

### D-026 · 2026-08-02 · Constraint engine v1 semantics
**Decision:** (a) **Severity is per rule and static in v1** — hard: OVERLAP, TRANSIT_IMPOSSIBLE, ARRIVE_AFTER_LAST_ENTRY, ARRIVE_AFTER_CLOSE, CLOSED_DAY; soft: ARRIVE_BEFORE_OPEN, CURFEW_MISS, DRIVE_STRETCH_EXCEEDED. Only soft conflicts are acknowledgeable; hard means infeasible. (b) **Stable identity** = rule + day + sorted subject-stop ids; message params are excluded, so numbers refresh without resurrecting acknowledgements, and the D-020 escalation contract (acked-as-soft → now-hard ⇒ re-raise) is implemented even though static severities can't yet trigger it. (c) **Last-entry suppresses close** for the same stop — one actionable message, not two. (d) **Arrival** is the chain's physical arrival (start − slack + late), so anchored stops are judged by when you actually get there. (e) **Weekdays are UTC calendar math** — timezone-independent (validated by the dual-TZ CI). (f) **Acknowledgements are ops** — undoable, and they cascade away with their trip. (g) ARRIVE_BEFORE_OPEN added beyond the issue's list (symmetric to closing, soft — waiting outside with kids is real).
**Why:** each choice favors trust: static severities keep messages predictable; param-free identity is what lets "ראינו, בסדר" survive edits; single-message suppression avoids alert fatigue (the engine's failure mode per spec §4.2).
**Deferred:** quick-fix suggestions (M3 per roadmap), SHABBAT_CONFLICT (#15, needs hebcal), meal/nap windows (M2 participant profiles).
**Revisit when:** configurable severities (spec: "severity is configurable per constraint") or participant scoping arrive.

### D-027 · 2026-08-02 · Shabbat awareness v1: zmanim always shown, conflicts opt-in, driving is the trigger
**Decision:** (a) Zmanim (candle-lighting/havdalah via @hebcal/core, D-006) display informationally whenever a day has a date + location — regardless of observance. (b) SHABBAT_CONFLICT fires only per the trip-level **observance** setting (none/soft/hard; participant profiles are M2), and existing trips are backfilled to **none** — the rule is opt-in, never retroactive noise. (c) v1's trigger is **driving**: a leg arriving after candle-lighting or departing before havdalah. A dinner running past candles at the lodging is deliberately NOT a conflict — flagging Shabbat dinner is alert fatigue, the engine's failure mode. (d) Locations come from a preset Israeli list or a pasted coordinate/Maps link (no geocoding until M3, D-007); the Israel/Diaspora flag derives from a bounding box; Jerusalem's 40-minute candle minhag is detected by name. (e) Implementation notes: HDate anchored via UTC-noon so the calendar date is TZ-independent; event detection uses instanceof, never constructor.name — the minified production build mangles class names (caught by E2E against the real build, exactly what it exists for).
**Why:** the most Israeli feature in the spec must earn trust on day one: always-visible times build habit, opt-in enforcement respects that the first real family (Yahel) drives on Shabbat, and the driving-only trigger makes every flag defensible.
**Revisit when:** participant observance profiles (M2) — per-family severity and non-driving checks; chag multi-day handling beyond what hebcal returns per-date.

### D-028 · 2026-08-02 · Offline bundle v1: shell precache verified, wallet blobs in IndexedDB, opt-in durability
**Decision:** (a) The app shell rides the existing Workbox precache (vite-plugin-pwa generateSW), but registration moved to manual (`injectRegister: null` + `registerSW` in main) so the app exposes a deterministic **offline-readiness signal** (`__offlineReady` after precache) — for users and for the offline E2E. (b) **Wallet attachments** are Blobs in a new v5 `attachments` table (id/tripId/stopId/name/mime/data), capped at **10MB/file**, full ops citizens: undoable, redo-able, cascading with their trip. (c) `navigator.storage.persist()` is requested once at boot — durable storage where granted (installed Android per #12's measurements), harmless elsewhere. (d) A 🔌 indicator renders on the browser's offline events. (e) The offline E2E runs in a dedicated `offline-chromium` Playwright project (SWs allowed there only, per TESTING.md §7); it proves shell-from-SW + plan-from-IDB + zmanim computing + the wallet PNG *decoding* offline. Two §7 caveats hit and recorded in-test: `setOffline` doesn't flip `navigator.onLine`/fire events (we dispatch to test our wiring), and fake-indexeddb blobs are opaque to jsdom (byte integrity is the E2E's job). Map tiles remain M3 (PMTiles per spike #11).
**Why:** the field-test promise is "the plan and the tickets work in the desert" — this ships exactly that surface with the smallest new machinery, on storage whose durability the owner's own device already verified.
**Revisit when:** #18 adds computed legs (freshness stamps join the bundle) and M3 adds map regions.

### D-029 · 2026-08-12 · CSP ships now, self-only — not waiting for the endpoints
**Context:** D-024 deferred CSP until the app's real endpoints (routing, sync, tiles) were known; #18/#20 are blocked on owner-provisioned services with no ETA, leaving a public PWA with no CSP indefinitely.
**Decision:** ship a strict self-only policy now: `default-src 'self'`; `style-src` allows inline (React `style={}` attributes); `img-src` adds `data:`/`blob:` (wallet thumbnails); workers/manifest self-only; `object-src`/`base-uri`/`form-action`/`frame-ancestors` locked down. Each future integration widens **exactly one directive in the PR that introduces the endpoint** (ORS/Supabase → `connect-src`, tile source → `img-src`/`connect-src`). **`vercel.json` is the single header source** — `vite.config.ts` mirrors it into the preview server, so the entire Playwright matrix (including the offline service-worker journey) runs under the production CSP, and `e2e/pwa.spec.ts` asserts the headers plus zero CSP console violations while driving the app. Bundled into the same hardening pass (#21): committed PNG icons — 192/512 any + maskable + apple-touch-icon, regenerated from `icon.svg` by `scripts/gen-icons.mjs` (rasterized with the repo's own Playwright Chromium, no new deps), riding the SW precache so an installed app owns its artwork offline; and an `android` Playwright project (Pixel 7 descriptor ≈ the owner's Galaxy S24+) running the full non-offline suite.
**Why:** the deferral's cost flipped — waiting protects nothing while the endpoints idle, and the single-source mirror turns any future CSP breakage into a red E2E instead of a production surprise. Hebcal stays eagerly bundled: in a fully-precached PWA, lazy-loading saves no meaningful first paint and buys an async seam in the zmanim path (parked in #36).
**Revisit when:** #18 (ORS) or #20 (Supabase) lands — each widens its directive deliberately, in its own PR.

### D-030 · 2026-08-12 · The demo trip tracks the family's real schedule (v6) and ships conflict-free
**Context:** the owner delivered vacation_schedule v6: Timna moves to the arrival Thursday (12:30, on the way in), Eilat moves to Friday afternoon (return 22:00), Shabbat becomes a quiet kibbutz/pool day, Sunday departs 11:00, and the pool runs in sessions (10:00–14:00 / 16:00–19:00). The old demo carried a deliberately-broken Saturday (30-min curfew miss) as the engine's out-of-the-box showcase.
**Decision:** the demo fixture mirrors v6 faithfully (sanitized as always — the source PDF stays out of the public repo per repo rules) and now loads with **zero conflicts, like the family's actual plan**. The engine showcase moves to a real tension in the data: flipping שמירת שבת to 'soft' flags the Friday-night drive home from Eilat (leg arrives 22:00, candles 18:46) — E2E asserts both states (clean load; toggle → the Hebrew SHABBAT_CONFLICT). Pool session windows ride the stops as opening-hours facts. The PDF's optional "night hike in Timna" is not modeled — Tiyul has no optional-stop concept (backlog candidate if it recurs).
**Why:** the demo doubles as the S1 acceptance fixture; a fabricated conflict taught the wrong first impression (plans arrive broken) and drifted from the artifact it mirrors. A toggle-triggered conflict demonstrates the engine on honest data — and matches how this family actually decides (they drive on Shabbat; the app informs, not judges).
**Revisit when:** the family publishes v7, or M2 participant profiles move observance off the trip level.

### D-031 · 2026-08-12 · Undo coalescing: dispatch metadata + seal-on-blur, never timers
**Context:** NumberField commits on every keystroke (a deliberate R-001 consequence — live recompute while typing), so "333" produced three ops and undo replayed the burst digit by digit (#36).
**Decision:** coalescing lives in the op store as **dispatch metadata**, not op shape: `dispatch(op, db, { coalesce: true })` folds a commit into the previous history entry when both target the same single field of the same entity — the entry keeps its original `prev`, so one undo restores the pre-burst value. The chain breaks on **sealHistory()** (called by NumberField on blur — imported directly there so no call site can forget it), on any other op, on undo/redo, and on reset. **No timers/clocks anywhere** — sealing is event-driven, so the behavior is deterministic in tests and identical on slow devices. Ops' shape, involution, and persistence are untouched; coalescing is opt-in per dispatch site (the three NumberField sites), so time-pickers, clears, toggles, and renames keep one-op-per-action semantics. Additionally, **all store mutations (dispatch/undo/redo) serialize through one promise queue**: UI sites fire-and-forget (`void dispatch`), so two fast keystrokes are concurrent promises — unserialized, their apply/push steps interleave on a slow IndexedDB and corrupt the open chain (a latent history-ordering race that coalescing surfaced; caught by CI on this PR's first run). Queue order = call order, deterministically, still with no timers. CI forensics (temporary in-CI instrumentation) also showed **jsdom fires spurious blur events between keystrokes on slow runners** — a real browser doesn't — so seal-on-blur granularity is asserted at the store level only, and the DOM test tolerates a single split (TESTING.md §7 updated).
**Why:** the alternatives were worse: a debounce timer makes undo behavior racy and untestable under our no-sleeps policy; committing only on blur would regress live recompute (the value you see while typing *is* the plan); changing the Op shape would ripple through invert/persistence for what is purely a history-granularity concern.
**Revisit when:** time-input bursts (hours fields fire per segment on some keyboards) start showing the same digit-by-digit undo annoyance — the same flag drops in per site.
