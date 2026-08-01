# Security

## Reporting a vulnerability

Use GitHub's **private vulnerability reporting** on this repository (Security tab → "Report a vulnerability"). Please do not open public issues for security problems.

## Where trip data lives (the honest map)

| Milestone | Where the data is | Who can see it |
|---|---|---|
| **M0 (current)** | Only in the browser's IndexedDB on the device that typed it. The deployed site serves static code; nothing is uploaded. | Only that device. Opening the URL elsewhere shows an empty app. |
| **M1 (read-only share)** | Device + the project's Supabase database, **only for trips the organizer explicitly shares**. | Holders of the trip's share-link token (read-only). |
| **M2 (group)** | Device + Supabase; participants' RSVPs/claims write back and sync. | Trip members and link holders, per role. Ships **only after the documented security review** (D-022): RLS policies, link entropy + revocation, rate limiting, no PII in logs, and trip deletion purging server data. |

Rule of thumb: **unshared trip = only on your device; shared trip = your device + our database, readable only through the trip's link or its members.**

## Posture (established by the 2026-08-01 M0 audit, D-024)

- **Repo:** public; secret scanning + push protection enabled; Dependabot alerts, security updates, and weekly update PRs enabled; full-history audit found no secrets and no personal data (fixtures are sanitized; real trip files stay in gitignored `local/`).
- **CI:** `GITHUB_TOKEN` restricted to `contents: read`; no secrets used by workflows; `npm audit` (high+) blocks merges.
- **`main`:** protected by an active ruleset — PR-only, required status checks, no force-push/deletion, empty bypass list.
- **Deployment (Vercel):** static hosting only, no server code or env vars; security headers via `vercel.json` (nosniff, DENY framing, strict referrer, minimal Permissions-Policy). Deployment Protection = **Standard**: previews require the owner's Vercel login; production is public **by design** — the accountless share-link model depends on it.
- **App:** React auto-escaping throughout (no `dangerouslySetInnerHTML`/`eval`); the only external navigation is Waze deep links, URL-encoded with `rel="noreferrer"`.

## Accepted risks & deferred items

- **Historical commits carry the owner's personal email** (normal git metadata in public repos). History rewrite rejected — disruption outweighs benefit. Future commits switched to the GitHub noreply address on 2026-08-01 (repo-local git config).
- **CSP** deferred to M1, when the app's real external endpoints (routing, tiles, weather) are known and can be allow-listed precisely.
- **Dependabot PRs** are exempt from the PR template's Tests section (dependency-only), but still require green CI and owner merge.
