# Spike #11 — PMTiles from OPFS, fully offline · **VERDICT: GO**

*2026-08-01 · timeboxed spike for D-003/D-022 · code: `spikes/pmtiles/` (run: `npm i && npx vite build`, copy a `.pmtiles` archive into `dist/`, serve `dist/`)*

## Question

Can a vector-tile region archive (PMTiles) stored **in the browser's OPFS** serve map tiles with **zero network access**, through the maplibre-facing `pmtiles` protocol — i.e., is D-003's offline-maps design sound before we build M3 on it?

## Setup

- Protomaps' official Florence sample archive (**6.6 MB**, zooms 0–15) fetched once and written into OPFS.
- A 12-line custom pmtiles `Source` reading byte ranges via `File.slice().arrayBuffer()` — no HTTP, no service worker, no range-request caching (the exact class of problem D-003 avoids).
- Verification at two layers, **after killing the HTTP server**: direct `PMTiles.getZxy()` and the registered maplibre protocol function.

## Result — PASS

With the server dead, five tiles across zooms 11–15 decoded from OPFS through **both** layers, byte-identical:

| tile (z/x/y) | bytes (direct) | bytes (via protocol) |
|---|---|---|
| 11/1088/746 | 87,386 | 87,386 |
| 12/2176/1493 | 82,446 | 82,446 |
| 13/4352/2986 | 84,917 | 84,917 |
| 14/8704/5972 | 87,297 | 87,297 |
| 15/17408/11944 | 245,465 | 245,465 |

Also proven en route: **OPFS persistence across reloads** (the archive survived multiple page reloads and was reused without re-download).

## Findings & implications

1. **D-003 confirmed.** OPFS + `Blob.slice` byte-ranges + pmtiles directory traversal work end-to-end in the browser. A ~city-scale region at z0–15 is **6.6 MB** — a Yahel-trip bundle (Arava region) should land in the tens of MB, consistent with D-003's revised size expectations.
2. **The custom Source is trivial (12 lines).** `@makina-corpus/maplibre-offline-pmtiles` remains worth evaluating for its download/manage layer at #19, but is not required for the core mechanism.
3. **Headless/hidden-tab caveat (operational, for #19/M3 tests):** MapLibre's render loop is RAF-driven and *never runs* in a hidden tab — in this session's headless pane the map initialized but never requested tiles (and its style→source registration also deferred). Offline-map E2E tests must run headed/visible (or pump frames); prefer explicit `tiles: [...]` source URLs over the TileJSON `url:` form in test styles.
4. **Text layers need precached glyphs/sprites** (known from D-003 research; the spike style used only geometry layers deliberately).
5. **Open piece for M3:** the region-extraction pipeline (`pmtiles extract` CLI or Protomaps API) — the spike used a prebuilt sample to isolate the storage/serving risk.
