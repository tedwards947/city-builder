// Balance Lab study (ENGINEER 3, 2026-11-22; docs/PC_OUTCOMES.md): do neighbourhood outcomes move as a city grows?
// For the PC redesign's tiers (PC_DESIGN.md), whose conditions are outcomes. Each request-grid cell
// (requests.cellSize) with homes, sampled every `every` days while the planner plays:
//   commute       residents' mean travel time to a job (jobs market `dist` at the home's best road, street tiles)
//   loadMed/Max   its own streets' peak load over the sample day (volume ÷ capacity): the median tile, the worst tile
//   station       the nearest station's (within 24 tiles of the cell's middle) peak platform load over the day
//   pollution     mean pollution at its homes (0–255; there is no separate noise layer)
//   landValueRel  mean land value at its homes ÷ the city's median home land value
//   crime         mean crime at its homes (0–255)
// Run: node scripts/pc-outcomes.mjs <city file|fresh> <days> <every> <from>
import { BALANCE } from '../data/balance';
import type { World } from '../sim/World';
import { BUILDING_STATION, BUILDING_STATION_ELEVATED, BUILDING_SUBWAY_STATION, RAIL_ELEVATED, RAIL_GROUND, RAIL_SUBWAY, ROAD_HIGHWAY, ROAD_NONE, ZONE_R } from '../sim/constants';
import { railLoad, roadCapacity, trafficVolume } from '../sim/TrafficData';
import { requestConfig } from '../sim/requests';
import { freshWorld, loadSaveText } from './world';
import { playPersona, PERSONAS, type Persona } from './personas';

const D = BALANCE.ticksPerDay;
const r2 = (x: number) => Math.round(x * 100) / 100;

export interface CellSample { pop: number; commute: number | null; loadMed: number | null; loadMax: number | null; station: number | null; stationDist: number | null; pollution: number; landValueRel: number; crime: number }
const STATIONS = [BUILDING_STATION, BUILDING_STATION_ELEVATED, BUILDING_SUBWAY_STATION];

function sample(w: World, sim: { tick(n: number): void }): Record<number, CellSample> {
  const { width, height } = w.grid, L = w.layers, cs = requestConfig().cellSize, cols = Math.ceil(width / cs);
  const cellOf = (i: number) => Math.floor(Math.floor(i / width) / cs) * cols + Math.floor((i % width) / cs);
  const peak = new Map<number, number>();
  // Stations: their tiles (anchor within 8), and each one's peak platform load over the day.
  const stations = w.buildings.filter(b => STATIONS.includes(b.kind)).map(b => {
    const anchor = b.ty * width + b.tx, tiles: number[] = [];
    for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) { const x = b.tx + dx, y = b.ty + dy; if (x >= 0 && y >= 0 && x < width && y < height && w.buildingAnchorAt(y * width + x) === anchor) tiles.push(y * width + x); }
    return { x: b.tx, y: b.ty, tiles, peak: 0 };
  });
  for (let t = 0; t < D; t++) {
    sim.tick(1);
    const d = w.traffic; if (!d) continue;
    for (const st of stations) for (const i of st.tiles) for (const lv of [RAIL_GROUND, RAIL_ELEVATED, RAIL_SUBWAY]) if (L.rail[i] & lv) st.peak = Math.max(st.peak, railLoad(d, i, lv));
    for (let k = 0; k < w.index.roadCount; k++) {
      const i = w.index.roads[k], rc = L.roadClass[i];
      if (rc === ROAD_NONE || rc === ROAD_HIGHWAY) continue;
      const v = trafficVolume(d, i) / roadCapacity(rc);
      if (v > (peak.get(i) ?? 0)) peak.set(i, v);
    }
  }
  const dist = w.traffic?.jobs.field.dist;
  const pp = BALANCE.growth.popPerLevel as Record<number, number>;
  const acc = new Map<number, { pop: number; cw: number; cn: number; loads: number[]; pol: number; lv: number; cr: number }>();
  const get = (c: number) => { let a = acc.get(c); if (!a) acc.set(c, a = { pop: 0, cw: 0, cn: 0, loads: [], pol: 0, lv: 0, cr: 0 }); return a; };
  const lvs: number[] = [];
  for (let k = 0; k < w.index.zonedCount; k++) {
    const i = w.index.zoned[k];
    if (L.zone[i] !== ZONE_R || !L.devLevel[i] || L.abandoned[i]) continue;
    const n = pp[L.devLevel[i]] ?? 0, a = get(cellOf(i));
    a.pop += n; a.pol += L.pollution[i] * n; a.lv += L.landValue[i] * n; a.cr += L.crime[i] * n;
    lvs.push(L.landValue[i]);
    if (!dist) continue;
    const x = i % width;
    let best = Infinity;
    for (const j of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width]) if (j >= 0 && j < width * height && L.roadClass[j] !== ROAD_NONE && dist[j] < best) best = dist[j];
    if (Number.isFinite(best)) { a.cw += best * n; a.cn += n; }
  }
  for (const [i, v] of peak) { const a = acc.get(cellOf(i)); if (a) a.loads.push(v); }
  lvs.sort((p, q) => p - q);
  const lvMed = Math.max(1, lvs[lvs.length >> 1] ?? 1);
  const out: Record<number, CellSample> = {};
  for (const [c, a] of acc) {
    if (a.pop < 40) continue;   // about requests.minHomes homes at level 1–2
    const s = a.loads.sort((p, q) => p - q);
    const cx = (c % cols) * cs + cs / 2, cy = Math.floor(c / cols) * cs + cs / 2;
    let near: (typeof stations)[number] | null = null, nd = Infinity;
    for (const st of stations) { const dd = Math.abs(st.x - cx) + Math.abs(st.y - cy); if (dd < nd) { nd = dd; near = st; } }
    out[c] = {
      pop: a.pop, commute: a.cn ? r2(a.cw / a.cn) : null, loadMed: s.length ? r2(s[s.length >> 1]) : null, loadMax: s.length ? r2(s[s.length - 1]) : null,
      station: near && nd <= 24 ? r2(near.peak) : null, stationDist: near ? Math.round(nd) : null,
      pollution: r2(a.pol / a.pop), landValueRel: r2(a.lv / a.pop / lvMed), crime: r2(a.cr / a.pop),
    };
  }
  return out;
}

/** Sample every `every` days from day `from` to `days` while the planner plays (a fresh 128 map when `text` is null). */
export function pcOutcomes(text: string | null, days = 360, every = 30, from = 0) {
  const w = text ? loadSaveText(text) : freshWorld(128, 7);
  const samples: { day: number; pop: number; cells: Record<number, CellSample> }[] = [];
  const base = PERSONAS.find(p => p.id === 'planner')!;
  const p: Persona = { ...base, day: (c, d) => {
    if (d >= from && (d - from) % every === 0) samples.push({ day: d, pop: c.sim.world.stats.population, cells: sample(c.sim.world, c.sim) });
    base.day(c, d);
  } };
  playPersona(p, w, text === null, days + 1);
  return { size: w.grid.width, cellSize: requestConfig().cellSize, samples };
}
