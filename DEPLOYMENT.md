# Deployment & operations

The operational facts that would otherwise live only in chat history (per the document-everything rule).

## URLs

- **Production:** https://travel-planner-two-chi.vercel.app — updates automatically on every merge to `main`. This URL *is* the app; installing it (below) is how the family gets Tiyul.
- **Per-deployment URLs** (`travel-planner-<hash>-hand-eman.vercel.app`) and **PR preview URLs**: gated behind the owner's Vercel login (Deployment Protection = Standard).

## The delivery loop (all automatic)

```
branch → PR → GitHub Actions CI (required checks) + Vercel preview deploy
      → owner reviews at the preview URL → owner merges
      → production deploys from main
```

- CI checks required by the `protect-main` ruleset: `typecheck · lint · unit` (TZ=UTC **and** TZ=Asia/Jerusalem) + `e2e (chromium + iphone webkit)`. Bundle budget is advisory.
- No direct pushes to `main`, no force-pushes, no deletions, empty bypass list — enforced by GitHub, including for admins.

## Hosting setup (done 2026-08-01)

- Vercel account **handEman** (Hobby plan — sufficient), project **travel-planner**, imported from GitHub with access granted to this repository only. Framework auto-detected (Vite), build `npm run build`, output `dist`, no environment variables.
- **Deployment Protection: Standard** — previews owner-only, production public (required by the accountless product model; see D-024). Do not switch to "All Deployments": it would put a login wall in front of the family.
- Security headers come from `vercel.json`.

## Installing the app on a phone

- **Android (Chrome):** open the production URL → ⋮ menu → *Add to home screen* / *Install app*.
- **iPhone (Safari):** open the production URL → Share → *Add to Home Screen*.
- Trip data stays on the device in M0 (see SECURITY.md).

## Rollback

1. **Fastest:** Vercel dashboard → Project → Deployments → pick the previous good deployment → ⋯ → *Promote to Production* (or *Instant Rollback* on the current one).
2. **Source-of-truth fix:** `git revert` the offending merge on a branch → PR → merge (CI still applies). Do both when production is broken: promote first, revert second.

## Repo settings inventory

| Setting | State | Where |
|---|---|---|
| Ruleset `protect-main` | Active (PR-only, required checks, no bypass) | GitHub → Settings → Rules |
| Secret scanning + push protection | Enabled | GitHub → Settings → Code security |
| Dependabot alerts + security updates + weekly PRs | Enabled | GitHub → Settings → Code security / `.github/dependabot.yml` |
| Private vulnerability reporting | Enabled | GitHub → Settings → Code security |
| Vercel Deployment Protection | Standard | Vercel → Project → Settings → Deployment Protection |
