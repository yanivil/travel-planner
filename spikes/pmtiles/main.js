// Spike #11 (D-022): prove a PMTiles archive stored in OPFS renders in MapLibre
// with zero network access for tile reads. Success = feature counts > 0 both
// before AND after the HTTP server is killed (new tiles must come from OPFS).
import { Map as MaplibreMap, addProtocol } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { PMTiles, Protocol } from 'pmtiles';

const logEl = document.querySelector('#log');
const log = (msg, cls = '') => {
  const line = document.createElement('div');
  if (cls) line.className = cls;
  line.textContent = msg;
  logEl.appendChild(line);
};

// pmtiles custom Source backed by an OPFS file — byte ranges via Blob.slice,
// so tile reads never touch the network.
class OPFSSource {
  constructor(file) {
    this.file = file;
  }
  getKey() {
    return 'opfs-firenze';
  }
  async getBytes(offset, length) {
    const blob = this.file.slice(offset, offset + length);
    return { data: await blob.arrayBuffer() };
  }
}

async function ensureArchiveInOPFS() {
  const root = await navigator.storage.getDirectory();
  try {
    const fh = await root.getFileHandle('firenze.pmtiles');
    const file = await fh.getFile();
    if (file.size > 1_000_000) {
      log(`OPFS: archive already present (${(file.size / 1e6).toFixed(1)} MB)`);
      return file;
    }
  } catch {
    /* not present yet */
  }
  log('one-time download of the archive into OPFS…');
  const res = await fetch('/firenze.pmtiles');
  const buf = await res.arrayBuffer();
  const fh = await root.getFileHandle('firenze.pmtiles', { create: true });
  const w = await fh.createWritable();
  await w.write(buf);
  await w.close();
  log(`OPFS: stored ${(buf.byteLength / 1e6).toFixed(1)} MB`, 'ok');
  return fh.getFile();
}

function countFeatures(map) {
  const layers = ['water', 'roads', 'buildings', 'earth', 'landuse'];
  const counts = {};
  for (const l of layers) {
    counts[l] = map.querySourceFeatures('fi', { sourceLayer: l }).length;
  }
  return counts;
}

async function main() {
  log(`OPFS available: ${!!navigator.storage?.getDirectory}`);
  const file = await ensureArchiveInOPFS();

  const p = new PMTiles(new OPFSSource(file));
  const protocol = new Protocol();
  protocol.add(p);
  let reqCount = 0;
  const tileFn = async (params, abortController) => {
    reqCount += 1;
    if (reqCount <= 4) log(`protocol req #${reqCount}: ${params.type} ${params.url.slice(0, 70)}`);
    try {
      const r = await protocol.tile(params, abortController);
      if (reqCount <= 4) log(`protocol ok #${reqCount}: bytes=${r?.data?.byteLength ?? JSON.stringify(r?.data)?.length ?? 0}`);
      return r;
    } catch (e) {
      log(`protocol ERR: ${e.message}`, 'bad');
      throw e;
    }
  };
  addProtocol('pmtiles', tileFn);
  window.addEventListener('unhandledrejection', (e) =>
    log(`UNHANDLED: ${e.reason?.message ?? e.reason}`, 'bad'),
  );

  const header = await p.getHeader();
  log(`header via OPFS: zoom ${header.minZoom}–${header.maxZoom} ✓`, 'ok');

  const map = new MaplibreMap({
    container: 'map',
    center: [11.2558, 43.7696],
    zoom: 13,
    style: {
      version: 8,
      sources: {
        fi: {
          type: 'vector',
          tiles: ['pmtiles://opfs-firenze/{z}/{x}/{y}'],
          minzoom: 0,
          maxzoom: 15,
        },
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#f2efe9' } },
        { id: 'earth', type: 'fill', source: 'fi', 'source-layer': 'earth', paint: { 'fill-color': '#e8e4d8' } },
        { id: 'landuse', type: 'fill', source: 'fi', 'source-layer': 'landuse', paint: { 'fill-color': '#dfe8d8' } },
        { id: 'water', type: 'fill', source: 'fi', 'source-layer': 'water', paint: { 'fill-color': '#a0c8f0' } },
        { id: 'buildings', type: 'fill', source: 'fi', 'source-layer': 'buildings', paint: { 'fill-color': '#d9d0c9' } },
        { id: 'roads', type: 'line', source: 'fi', 'source-layer': 'roads', paint: { 'line-color': '#996644', 'line-width': 1 } },
      ],
    },
  });

  map.on('error', (e) => log(`MAP ERROR: ${e.error?.message ?? e}`, 'bad'));

  // This spike may run in a hidden tab where RAF never fires (headless pane);
  // pump the render loop manually so tile loading proceeds. Real apps in real
  // tabs don't need this — documented in the findings.
  let pumpErrLogged = false;
  setInterval(() => {
    try {
      map._render(performance.now());
    } catch (e) {
      if (!pumpErrLogged) {
        pumpErrLogged = true;
        log(`pump note: ${e.message}`);
      }
    }
  }, 80);
  map.once('idle', () => {
    const counts = countFeatures(map);
    log(`ONLINE PHASE — rendered features: ${JSON.stringify(counts)}`, 'ok');
    log('PHASE 1 DONE — kill the server, then call window.__offlinePhase()');
  });

  // Phase 2: with the server dead, pan+zoom to force NEW tile loads — every
  // byte must come from OPFS. Result is appended to the DOM log.
  window.__offlinePhase = () =>
    new Promise((resolve) => {
      map.once('idle', () => {
        const counts = countFeatures(map);
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        const verdict = total > 0 ? 'OFFLINE RENDER PROOF: PASS' : 'OFFLINE RENDER PROOF: FAIL';
        log(`OFFLINE PHASE — new-area features: ${JSON.stringify(counts)}`, total > 0 ? 'ok' : 'bad');
        log(verdict, total > 0 ? 'ok' : 'bad');
        resolve(verdict);
      });
      map.jumpTo({ center: [11.2858, 43.7896], zoom: 15 });
    });

  window.__map = map;
  window.__p = p;
  window.__tileFn = tileFn;

  // Environment-independent offline proof: after the server is killed, pull
  // tile buffers for many z/x/y straight through the OPFS-backed PMTiles
  // (data layer) AND through the maplibre-facing protocol fn (adapter layer).
  const lonLatToTile = (lon, lat, z) => {
    const n = 2 ** z;
    const x = Math.floor(((lon + 180) / 360) * n);
    const rad = (lat * Math.PI) / 180;
    const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
    return { x, y };
  };
  window.__offlineDataProof = async () => {
    const results = [];
    for (const z of [11, 12, 13, 14, 15]) {
      const { x, y } = lonLatToTile(11.2558, 43.7696, z);
      const direct = await p.getZxy(z, x, y);
      const viaProtocol = await tileFn(
        { type: 'arrayBuffer', url: `pmtiles://opfs-firenze/${z}/${x}/${y}` },
        new AbortController(),
      );
      results.push({
        tile: `${z}/${x}/${y}`,
        directBytes: direct?.data?.byteLength ?? 0,
        protocolBytes: viaProtocol?.data?.byteLength ?? 0,
      });
    }
    const allOk = results.every((r) => r.directBytes > 0 && r.protocolBytes > 0);
    const verdict = allOk ? 'OFFLINE DATA PROOF: PASS' : 'OFFLINE DATA PROOF: FAIL';
    log(JSON.stringify(results, null, 1), allOk ? 'ok' : 'bad');
    log(verdict, allOk ? 'ok' : 'bad');
    return { verdict, results };
  };
}

main().catch((e) => log(`FATAL: ${e.message}`, 'bad'));
