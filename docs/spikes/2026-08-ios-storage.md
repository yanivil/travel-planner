# Spike #12 — iOS PWA storage & persist() · **PARTIAL: probe shipped, device pass pending**

*2026-08-01 · timeboxed spike for D-022 · probe: `/storage-probe.html` (temporary diagnostic page, ships with the app until the device pass completes; results never leave the device)*

## Question

What storage quota does an installed (home-screen) Tiyul actually get on the family's real phones, does `persist()` hold, and which OPFS write APIs exist there — the numbers that size the offline bundle work (#19)?

## What happened to the Simulator plan

The dev Mac has **Command Line Tools only — no Xcode, no iOS runtimes, no simulator**. Installing Xcode (~10 GB, Apple ID required) is an owner decision and *not* required: the credible test was always the **real-device pass at Yahel** (family iPhones + the owner's Galaxy), which this spike now makes a 2-minute task.

## The probe (ready now)

Open **`https://travel-planner-two-chi.vercel.app/storage-probe.html`** on any phone (preview URL until merged). It auto-reports:

- browser vs **installed** mode (`display-mode: standalone`) — run it both ways on iPhone: Safari tab first, then Add to Home Screen → open the icon
- `storage.estimate()` quota **before/after `persist()`**, and whether persist is granted
- OPFS capabilities: `getDirectory` / main-thread `createWritable` (expected only iOS 18.4+) / **worker `createSyncAccessHandle`** (expected 15.2+) — this decides whether #19's OPFS writes need the worker fallback on the family's iOS versions
- optional **1 GB fill test** (semi-random payload — constant fills get compressed and under-report; verified during calibration below)

**Screenshot each state and attach to issue #12.**

## Chromium baseline (captured in this spike, desktop)

- Quota = **~60% of disk** (878 GB on this machine), matching Chromium policy; `persist()` denied without site engagement (expected for a fresh profile — retest on the real phones).
- Full OPFS support (all three capabilities ✓).
- **1 GB IndexedDB fill completed with zero quota errors**; after switching the probe to semi-random payloads, reported usage tracks written bytes 1:1 (first run with constant bytes was silently compressed ~20× — worth knowing when reading `estimate()` anywhere).

## What we already know from primary sources (research, PR #3)

WebKit's published policy: home-screen web apps get the **browser-level quota (up to ~60% of disk)**, are **exempt from the 7-day eviction** counter, and honor `persist()` from iOS 17. The device pass converts this from "documented" to "measured on the phones that will run Tiyul at Yahel."

## Exit criteria for closing #12

1. Probe screenshots from ≥1 family iPhone (Safari tab + installed) and the owner's Galaxy S24+ (installed), attached to the issue.
2. Numbers recorded here; `/storage-probe.html` removed from `public/` in the same PR that closes the issue.
