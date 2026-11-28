// Neighbourhood identities, PROTOTYPE (PC_DESIGN.md step 7; debug-only: nothing in play reads this). Each
// request-grid cell with homes gets traits from what is already there, and the nearest of five types:
//   egalitarian, green, planned  the vibe layers at its homes when BALANCE.vibe.mode is 'target'; otherwise
//                                PROXIES (owner 2026-11-22), since the legacy layers stay at neutral in play:
//                                green        share of the cell's tiles under trees or parks
//                                planned      share of its road tiles that run straight or cross (not corners or dead ends)
//                                egalitarian  how even its homes' land values are: 1 − their spread ÷ mean
//   density                      its homes' mean level
//   wealth                       its homes' land value ÷ the city's median home land value
//   shops                        commerce levels in the cell ÷ (homes + commerce)
//   industry                     industry levels in the cell and the 8 around it ÷ all levels there
// Traits are scaled against the city's own cells (how far from this city's average, in spreads), so a label
// says "greener and richer than the rest of this city" and a city is never all one type. Drift: with a
// sample from about three months back, the type a cell's traits are heading for, if it is another one.

import type { World } from './World';
import { BALANCE } from '../data/balance';
import { ZONE_C, ZONE_I, ZONE_R } from './constants';
import { levelWeight } from './lots';
import { countsAsPark } from './leisure';
import { ROAD_NONE } from './constants';

export type IdentityType = 'familySuburb' | 'workingClass' | 'leafyWealthy' | 'downtown' | 'creative';
export const IDENTITY_TYPES: readonly IdentityType[] = ['familySuburb', 'workingClass', 'leafyWealthy', 'downtown', 'creative'];
const TRAITS = ['egalitarian', 'green', 'planned', 'density', 'wealth', 'shops', 'industry'] as const;
type Trait = typeof TRAITS[number];
export type Traits = Record<Trait, number>;

/** Each type's profile, in spreads from the city's average (0 = average; unlisted traits 0). */
const PROFILES: Record<IdentityType, Partial<Traits>> = {
  familySuburb: { density: -1, shops: -0.6, planned: 0.6, green: 0.4, industry: -0.4 },
  workingClass: { wealth: -1, industry: 1, egalitarian: 0.6, green: -0.4 },
  leafyWealthy: { green: 1, wealth: 1, density: -0.6, industry: -0.8, egalitarian: -0.4 },
  downtown:     { density: 1, shops: 1, green: -0.6, wealth: 0.4 },
  creative:     { shops: 0.6, planned: -1, egalitarian: 0.6, density: 0.3, wealth: -0.3 },
};

export interface CellIdentity { cell: number; homes: number; raw: Traits; scaled: Traits; type: IdentityType; drift: IdentityType | null }

const cellSize = (): number => (BALANCE.politicalCapital.requests as unknown as { cellSize: number; minHomes: number }).cellSize;
const minHomes = (): number => (BALANCE.politicalCapital.requests as unknown as { cellSize: number; minHomes: number }).minHomes;

/** Raw traits of every cell with enough homes. */
export function cellTraits(world: World): Map<number, { homes: number; raw: Traits }> {
  const { width, height } = world.grid, L = world.layers, cs = cellSize(), cols = Math.ceil(width / cs), rows = Math.ceil(height / cs);
  type Acc = { homes: number; lv: number; lv2: number; lvl: number; r: number; c: number; i: number; tiles: number; green: number; roads: number; straight: number; ve: number; vg: number; vp: number };
  const acc = new Map<number, Acc>();
  const get = (c: number) => { let a = acc.get(c); if (!a) acc.set(c, a = { homes: 0, lv: 0, lv2: 0, lvl: 0, r: 0, c: 0, i: 0, tiles: 0, green: 0, roads: 0, straight: 0, ve: 0, vg: 0, vp: 0 }); return a; };
  // Proxies for green and planned, from every tile: trees and parks; straight or crossing road tiles.
  const isRoad = (j: number) => L.roadClass[j] !== ROAD_NONE;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const t = y * width + x, a = get(Math.floor(y / cs) * cols + Math.floor(x / cs));
    a.tiles++;
    if (L.vegetation[t] || (L.building[t] && countsAsPark(L.building[t]))) a.green++;
    if (isRoad(t)) {
      a.roads++;
      const ew = x > 0 && x < width - 1 && isRoad(t - 1) && isRoad(t + 1), ns = y > 0 && y < height - 1 && isRoad(t - width) && isRoad(t + width);
      if (ew || ns) a.straight++;
    }
  }
  const homeLv: number[] = [];
  // Read the index once: outside a tick it is not pinned, and every `world.index` rebuilds it (that was the whole cost).
  const { zoned, zonedCount } = world.index;
  for (let k = 0; k < zonedCount; k++) {
    const t = zoned[k];
    if (!L.devLevel[t] || L.abandoned[t]) continue;
    const c = Math.floor(Math.floor(t / width) / cs) * cols + Math.floor((t % width) / cs), a = get(c), w = levelWeight(L.devLevel[t]);
    if (L.zone[t] === ZONE_R) {
      a.homes++; a.lv += L.landValue[t]; a.lv2 += L.landValue[t] ** 2; a.lvl += L.devLevel[t]; a.r += w;
      a.ve += (L.vibeEgalitarian[t] - 128) / 128; a.vg += (L.vibeGreen[t] - 128) / 128; a.vp += (L.vibePlanned[t] - 128) / 128;
      homeLv.push(L.landValue[t]);
    } else if (L.zone[t] === ZONE_C) a.c += w;
    else if (L.zone[t] === ZONE_I) a.i += w;
  }
  homeLv.sort((x, y) => x - y);
  const median = Math.max(1, homeLv[homeLv.length >> 1] ?? 1);
  const out = new Map<number, { homes: number; raw: Traits }>();
  for (const [c, a] of acc) {
    if (a.homes < minHomes()) continue;
    // Industry in the cell and the 8 around it, as a share of all developed levels there.
    let ind = 0, all = 0;
    const cx = c % cols, cy = Math.floor(c / cols);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      const b = acc.get(y * cols + x); if (!b) continue;
      ind += b.i; all += b.r + b.c + b.i;
    }
    const mean = a.lv / a.homes, sd = Math.sqrt(Math.max(0, a.lv2 / a.homes - mean * mean));
    // With the vibe layers in target mode (BALANCE.vibe.mode), they carry the character: read them at the homes.
    const vibe = BALANCE.vibe.mode === 'target';
    out.set(c, { homes: a.homes, raw: {
      egalitarian: vibe ? a.ve / a.homes : 1 - sd / Math.max(1, mean),             // proxy unless vibe
      green: vibe ? a.vg / a.homes : a.green / Math.max(1, a.tiles),               // proxy unless vibe
      planned: vibe ? a.vp / a.homes : a.roads >= 5 ? a.straight / a.roads : 0.5,  // proxy unless vibe
      density: a.lvl / a.homes, wealth: a.lv / a.homes / median,
      shops: a.c / Math.max(1e-9, a.r + a.c), industry: all > 0 ? ind / all : 0,
    } });
  }
  return out;
}

/** The nearest type to traits scaled against the city. */
export function nearestType(scaled: Traits): IdentityType {
  let best: IdentityType = 'familySuburb', bestD = Infinity;
  for (const type of IDENTITY_TYPES) {
    const prof = PROFILES[type];
    let d = 0;
    for (const t of TRAITS) d += (scaled[t] - (prof[t] ?? 0)) ** 2;
    if (d < bestD) { bestD = d; best = type; }
  }
  return best;
}

function scaler(all: Traits[]): (raw: Traits) => Traits {
  const mean = {} as Traits, sd = {} as Traits;
  for (const t of TRAITS) {
    const xs = all.map(r => r[t]);
    const m = xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
    const v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, xs.length);
    mean[t] = m; sd[t] = Math.sqrt(v) || 1;
  }
  return (raw) => { const z = {} as Traits; for (const t of TRAITS) z[t] = (raw[t] - mean[t]) / sd[t]; return z; };
}

// Drift: one sample a month per world, the last few kept.
const MONTH_DAYS = 30, KEEP = 4;
const history = new WeakMap<World, { day: number; raw: Map<number, Traits> }[]>();

const cache = new WeakMap<World, { day: number; ids: Map<number, CellIdentity> }>();
/** How many times identities were worked out (a test reads it). */
export const identityStats = { computes: 0 };

/** Every cell's identity now (and, from about three months back, where it is heading). Worked out once a game day at most (drift is monthly; recomputing every tick while Inspect was open took the game to about 1 fps). */
export function cellIdentities(world: World): Map<number, CellIdentity> {
  const day = Math.floor(world.tick / BALANCE.ticksPerDay), c = cache.get(world);
  if (c && c.day === day) return c.ids;
  identityStats.computes++;
  const ids = computeIdentities(world);
  cache.set(world, { day, ids });
  return ids;
}

function computeIdentities(world: World): Map<number, CellIdentity> {
  const traits = cellTraits(world);
  const scale = scaler([...traits.values()].map(v => v.raw));
  const day = Math.floor(world.tick / BALANCE.ticksPerDay);
  let h = history.get(world);
  if (!h) history.set(world, h = []);
  if (!h.length || day - h[h.length - 1].day >= MONTH_DAYS) {
    h.push({ day, raw: new Map([...traits].map(([c, v]) => [c, v.raw])) });
    if (h.length > KEEP) h.shift();
  }
  const past = h.length > 1 ? h[0] : null;
  const out = new Map<number, CellIdentity>();
  for (const [cell, { homes, raw }] of traits) {
    const scaled = scale(raw), type = nearestType(scaled);
    let drift: IdentityType | null = null;
    const before = past?.raw.get(cell);
    if (before && past && day - past.day >= 2 * MONTH_DAYS) {
      // Extend the move since then by the same again: the type it is heading for.
      const then = scale(before), ahead = {} as Traits;
      for (const t of TRAITS) ahead[t] = scaled[t] + (scaled[t] - then[t]);
      const next = nearestType(ahead);
      if (next !== type) drift = next;
    }
    out.set(cell, { cell, homes, raw, scaled, type, drift });
  }
  return out;
}

/** The identity of the cell under tile (tx, ty), or null if it has too few homes. */
export function identityAt(world: World, tx: number, ty: number): CellIdentity | null {
  const cs = cellSize();
  const cell = Math.floor(ty / cs) * Math.ceil(world.grid.width / cs) + Math.floor(tx / cs);
  return cellIdentities(world).get(cell) ?? null;
}
