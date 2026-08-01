# Testing strategy

**The rule in one line: no behavior change merges without tests, and no bug fix merges without a failing-test reproduction plus an explanation of why our tests missed it.**

What breaks a family trip is what we test hardest: wrong arrival times, a missed "last entry", a Shabbat miscalculation, a broken offline bundle at a trailhead with zero bars, money split wrong between families. The test suite is ordered around those risks, not around code coverage vanity.

---

## 1. Levels & tools

| Level | Tool | Scope | Runs |
|---|---|---|---|
| Unit | **Vitest** (+ **fast-check** for property-based) | Pure logic: constraint rules, timeline recompute, money math, time/zmanim wrappers | every PR, < 30s |
| Component | Vitest + **React Testing Library** + user-event, **MSW** (network), **fake-indexeddb** (Dexie) | Timeline interactions, conflict badges, RSVP grid, list claims — behavior via the DOM, never implementation internals | every PR |
| Contract | Vitest against recorded fixtures | Every `RoutingProvider` implementation passes one shared contract suite; sync-queue merge rules | every PR |
| End-to-end | **Playwright** (chromium desktop + iPhone-viewport webkit) | Real built PWA, real IndexedDB/service worker; network mocked at the route layer | every PR (smoke) + full suite nightly & pre-merge to main |
| Accessibility | axe-core (vitest-axe + @axe-core/playwright) | Core screens pass with no serious violations, in LTR **and RTL** | every PR |

Why Playwright over Cypress: **multi-context** in one test (organizer tab + accountless viewer tab simultaneously — our share-link model demands it), first-class offline emulation, mobile viewports, trace viewer for failures.

## 2. What each subsystem requires

- **Constraint engine (the moat — target ~100% branch coverage, test-first):**
  - Table-driven cases per rule (OVERLAP, TRANSIT_IMPOSSIBLE, ARRIVE_AFTER_CLOSE, CLOSED_DAY, SHABBAT_CONFLICT, SEAT_SHORTAGE, MEAL/NAP_WINDOW, DRIVE_STRETCH, NO_BUFFER, HEAT_WINDOW, CURFEW, BOOKING_REQUIRED): given schedule → expected conflicts, severities, and fix suggestions. Every rule ships with its table in the same PR.
  - Shabbat/chag: fixed golden fixtures (location + date → expected candle-lighting/havdalah from @hebcal/core), including chag edge cases and locations abroad.
  - Participant scoping: conflicts fire only for attendees (the grandparents-skip-the-hike case).
- **Timeline recompute (property-based with fast-check):** invariants that must hold for *any* generated day — recompute is deterministic and idempotent; anchors never move; floaters never reorder themselves; downstream times shift by exactly the edit delta; no silent overlap (either fits or flags).
- **Money (property-based + tables):** splits sum exactly to the expense (agorot/cent-safe integer math); settle-up transfers net every balance to zero with minimal transfer count; multi-currency conversion is applied once, never twice.
- **Time & zones:** unit suite runs twice in CI — `TZ=UTC` and `TZ=Asia/Jerusalem`. Flight-day dual-clock rendering tested with DST-transition fixtures. All test clocks frozen (`vi.setSystemTime` / Playwright clock API); no test ever depends on the real current date.
- **Offline:** sync queue unit-tested (LWW-per-field, review-list emission); bundle completeness has an automated audit — every asset the plan references must be in the bundle manifest.
- **Share links & roles:** viewer capabilities (RSVP, claim, vote — but never edit) asserted at both the API-rules layer and E2E.

## 3. End-to-end suites

Core journeys (smoke, every PR):
- **E2E-1 plan & fix:** create trip → add stops → legs computed (mocked routing) → drag a stop past closing time → conflict badge + drawer appear → apply quick fix → conflict clears, downstream times updated.
- **E2E-2 offline:** take trip offline → Playwright network offline → full plan, wallet QR, and Shabbat times readable → edit queues → reconnect → syncs, review list correct.
- **E2E-3 two-user link:** organizer context + accountless viewer context: viewer RSVPs and claims a shopping item → organizer sees headcount and claim live; viewer cannot edit the timeline.
- **E2E-4 Hebrew/RTL smoke:** app in Hebrew renders RTL, timeline and conflict drawer included.

Acceptance suites (full runs): the spec's scenarios **S1–S3** (PRODUCT_DESIGN.md §3) become executable Playwright suites as their features land — S1 uses the anonymized Yahel-style fixture (`fixtures/` — sanitized, no real names; real personal files stay in gitignored `local/`).

## 4. Policies (binding, enforced by PR template + CI)

1. **Every PR that changes behavior adds or updates tests in the same PR.** The PR template's Tests section must list what's covered and explicitly state what is *not* covered and why. "No tests needed" requires a stated reason (pure-docs, config…).
2. **Bug fixes are red→green:** first commit reproduces the bug with a failing test, then the fix turns it green. The PR must answer, in writing: root cause · **why existing tests missed it** (escape class: missing level / wrong fixture / untested edge / environment gap / wrong assumption) · what *class-level* prevention was added (a new property, a fixture family, a lint rule — not just the single case). Each escape gets a numbered entry in [REGRESSIONS.md](REGRESSIONS.md).
3. **CI green is a merge requirement** — typecheck, lint, unit+component (both TZs), contract, E2E smoke, a11y. No manual overrides; if CI is wrong, fix CI in a PR.
4. **Coverage guardrails, not worship:** constraint engine / timeline / money aim at ~100% branch; repo-wide gate 80% statements. Forbidden: asserting implementation details, brittle full-page snapshots, sleeps instead of waits.
5. **Flaky tests are bugs:** quarantine immediately (tagged, tracked in REGRESSIONS.md), fix within a week or delete with a documented decision. Retry-until-green is never policy.
6. **Test naming states behavior:** `flags ARRIVE_AFTER_CLOSE when leg lands after Friday last entry`, arrange-act-assert, one behavior per test.

## 5. CI pipeline (lands with the M0 scaffold — first code PR)

GitHub Actions on every PR: install → typecheck (`tsc --noEmit`) → lint → `vitest run --coverage` (matrix: `TZ=UTC`, `TZ=Asia/Jerusalem`) → Playwright smoke (chromium + iPhone viewport; traces uploaded on failure) → axe checks. Nightly: full E2E + acceptance suites. Once the first CI run is green, **branch protection on `main`** (required checks + PR review) gets enabled — owner action, we'll flag it in the M0 PR.

Local commands (wired in M0): `npm test` · `npm run test:watch` · `npm run e2e` · `npm run e2e:ui`.

## 6. Division of labor

Design docs (this file) define *what must be true*; each feature PR carries the tests proving it. The M0 scaffold PR includes: Vitest + RTL + Playwright + MSW + fast-check configured, the CI workflow, one real example test at every level, and the S1-style fixture — so from the second code PR onward, "add tests" is never blocked on infrastructure.
