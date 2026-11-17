// Balance Lab: building blocks the scripted players share. Everything goes through
// the real commands, so money and PC are charged exactly as for a player.

import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { coveredBy, homesWithinReach } from '../sim/serviceValue';
import { BuildRoadCommand } from '../commands/BuildRoadCommand';
import { PaintZoneCommand } from '../commands/PaintZoneCommand';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import type { Recorder } from './recorder';
import type { Sim } from './world';
import {
  ZONE_NONE, ZONE_R, ZONE_C, ZONE_I, ROAD_NONE, ROAD_STREET, ROAD_HIGHWAY, BUILDING_NONE,
  BUILDING_POWER_PLANT, BUILDING_WATER_TOWER, BUILDING_SEWAGE_PLANT,
  BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL, BUILDING_PARK,
} from '../sim/constants';

export const SERVICE_KINDS = [BUILDING_PARK, BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL];
export const KIND_NAME: Record<number, string> = {
  [BUILDING_POLICE]: 'police', [BUILDING_FIRE]: 'fire', [BUILDING_SCHOOL]: 'school', [BUILDING_HOSPITAL]: 'hospital', [BUILDING_PARK]: 'park',
  [BUILDING_POWER_PLANT]: 'power', [BUILDING_WATER_TOWER]: 'water', [BUILDING_SEWAGE_PLANT]: 'sewage',
};
export const REQUEST_BUILDING: Record<string, number> = {
  park: BUILDING_PARK, police: BUILDING_POLICE, fire: BUILDING_FIRE, school: BUILDING_SCHOOL, hospital: BUILDING_HOSPITAL,
};

export const isHome = (w: World, i: number) => w.layers.zone[i] === ZONE_R && w.layers.devLevel[i] > 0 && w.layers.abandoned[i] === 0;
export const residentsAt = (w: World, i: number) => (isHome(w, i) ? BALANCE.growth.popPerLevel[w.layers.devLevel[i]] ?? 0 : 0);

/** Whether home tile i has this service's coverage (layers are refreshed every tick). */
export function covered(w: World, kind: number, i: number): boolean {
  const L = w.layers;
  switch (kind) {
    case BUILDING_POLICE: return L.police[i] > 0;
    case BUILDING_FIRE: return L.fireStation[i] > 0;
    case BUILDING_SCHOOL: return L.school[i] > 0;
    case BUILDING_HOSPITAL: return L.hospital[i] > 0;
    default: return coveredBy(w, kind).has(i);
  }
}

/** A free tile beside a street or avenue, nearest (x, y) within maxDist (Chebyshev rings, scanned in a fixed order). */
/** A free, buildable tile beside a street or avenue (not a highway). */
export function isFreeLot(w: World, tx: number, ty: number): boolean {
  const { width: W, height: H } = w.grid, L = w.layers;
  if (tx < 1 || ty < 1 || tx >= W - 1 || ty >= H - 1) return false;
  const i = ty * W + tx;
  if (L.roadClass[i] !== ROAD_NONE || L.zone[i] !== ZONE_NONE || L.building[i] !== BUILDING_NONE || L.terrain[i] === 1) return false;
  return [1, -1, W, -W].some(o => { const r = L.roadClass[i + o]; return r !== ROAD_NONE && r !== ROAD_HIGHWAY; });
}

export function findLot(w: World, x: number, y: number, maxDist: number, skip?: Set<number>): { x: number; y: number } | null {
  const W = w.grid.width;
  const ok = (tx: number, ty: number) => !skip?.has(ty * W + tx) && isFreeLot(w, tx, ty);
  x = Math.round(x); y = Math.round(y);
  for (let d = 0; d <= maxDist; d++) {
    for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
      if (ok(x + dx, y + dy)) return { x: x + dx, y: y + dy };
    }
  }
  return null;
}

/**
 * Place a building of `kind` on the nearest free lot where the command accepts
 * it (some buildings need more room than one tile): tries up to 30 lots.
 * Returns the lot, or null. Refusals for money or PC stop the search.
 */
export function placeNear(sim: Sim, rec: Recorder | null, kind: number, x: number, y: number, maxDist: number, tag = KIND_NAME[kind]): { x: number; y: number } | null {
  const skip = new Set<number>();
  for (let k = 0; k < 30; k++) {
    const lot = findLot(sim.world, x, y, maxDist, skip);
    if (!lot) return null;
    const cmd = new PlaceBuildingCommand(lot.x, lot.y, kind);
    if (rec ? rec.run(sim.history, cmd, tag) : sim.history.run(cmd)) return lot;
    if (cmd.failReason) return null;
    skip.add(sim.world.grid.idx(lot.x, lot.y));
  }
  return null;
}

/** Homes without this service, in tile order. */
export function homesLacking(w: World, kind: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < w.layers.zone.length; i++) if (isHome(w, i) && !covered(w, kind, i)) out.push(i);
  return out;
}

/**
 * Place one building of `kind` for the homes that lack it: on the free lot
 * nearest the lacking home with the most lacking homes around it. Works on any
 * city. Returns whether one was placed.
 */
export function serveLacking(sim: Sim, rec: Recorder, kind: number, tag = KIND_NAME[kind]): boolean {
  const w = sim.world, W = w.grid.width;
  const lacking = homesLacking(w, kind);
  if (lacking.length < 6) return false;
  const set = new Set(lacking);
  let best = -1, bestN = 0;
  for (let k = 0; k < lacking.length; k += Math.max(1, Math.floor(lacking.length / 200))) {
    const i = lacking[k];
    let n = 0;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (set.has(i + dy * W + dx)) n++;
    if (n > bestN) { bestN = n; best = i; }
  }
  if (best < 0) return false;
  return placeNear(sim, rec, kind, best % W, Math.floor(best / W), 6, tag) !== null;
}

/** Answer a request with one building of its kind on the free lot within 10 tiles that serves the most asking homes (the request-chaser's move). */
export function answerRequest(sim: Sim, rec: Recorder, reqId: number): 'placed' | 'refused' | 'noLot' | 'gone' {
  const w = sim.world, W = w.grid.width;
  const r = w.politics.requests.find(q => q.id === reqId) as ({ kind: string; seed?: number; x0: number; y0: number; x1: number; y1: number } | undefined);
  if (!r || REQUEST_BUILDING[r.kind] === undefined) return 'gone';
  const x = r.seed !== undefined ? r.seed % W : (r.x0 + r.x1) / 2, y = r.seed !== undefined ? Math.floor(r.seed / W) : (r.y0 + r.y1) / 2;
  const kind = REQUEST_BUILDING[r.kind];
  // Free lots within 10 tiles, best first: the share of the asking homes a building there would serve, then nearness.
  const asking = new Set((r as { homes?: number[] }).homes ?? []);
  const cx = Math.round(x), cy = Math.round(y), lots: { x: number; y: number; n: number; d: number }[] = [];
  for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) {
    if (!isFreeLot(w, cx + dx, cy + dy)) continue;
    const n = asking.size ? homesWithinReach(w, cx + dx, cy + dy, kind).filter(i => asking.has(i)).length : 0;
    lots.push({ x: cx + dx, y: cy + dy, n, d: Math.max(Math.abs(dx), Math.abs(dy)) });
  }
  if (!lots.length) return 'noLot';
  lots.sort((a, b) => b.n - a.n || a.d - b.d || a.y - b.y || a.x - b.x);
  for (const lot of lots.slice(0, 30)) {
    const cmd = new PlaceBuildingCommand(lot.x, lot.y, kind);
    if (rec.run(sim.history, cmd, 'request:' + r.kind)) { rec.answered.add(reqId); return 'placed'; }
    if (cmd.failReason) return 'refused';
  }
  return 'refused';
}

export interface TownOptions {
  /** Zone of each 4×4 cell, or null to leave it empty. */
  zoneOf?: (cx: number, cy: number) => number | null;
  /** Tag a cell's zoning for the recorder. */
  tagOf?: (zone: number) => string;
  /** Put utilities in the town instead of the yard (Industrialist): next to homes, so they cost nuisance PC. */
  utilitiesInTown?: boolean;
}

const N = 16, X0 = 30, Y0 = 30;
const defaultZone = (cx: number, cy: number) => (cx >= N - 4 ? ZONE_I : (cx + cy) % 4 === 0 ? ZONE_C : ZONE_R);

/**
 * A fresh town on a 128 map: 4×4-tile cells on a 16×16 street grid, built from
 * the middle out, homes and shops with an industry district on the east, and a
 * utility yard on a street to the south-east. Each cell has two free tiles
 * (its corner at +1,+1 faces a street: a service lot).
 */
export class Town {
  readonly cells: { cx: number; cy: number; zone: number }[] = [];
  readonly built: { cx: number; cy: number; zone: number }[] = [];
  private next = 0;
  private yardNext = 0;
  private readonly yardY = Y0 + 32;
  private readonly opts: TownOptions;
  private readonly sim: Sim;
  private readonly rec: Recorder;

  constructor(sim: Sim, rec: Recorder, opts: TownOptions = {}) {
    this.sim = sim; this.rec = rec; this.opts = opts;
    const zoneOf = opts.zoneOf ?? defaultZone;
    const c0 = (N - 1) / 2;
    const all: { cx: number; cy: number; zone: number }[] = [];
    for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) { const z = zoneOf(cx, cy); if (z !== null) all.push({ cx, cy, zone: z }); }
    const byCentre = (a: { cx: number; cy: number }, b: { cx: number; cy: number }) =>
      Math.abs(a.cx - c0) + Math.abs(a.cy - c0) - (Math.abs(b.cx - c0) + Math.abs(b.cy - c0)) || a.cy - b.cy || a.cx - b.cx;
    const town = all.filter(c => c.zone !== ZONE_I).sort(byCentre);
    const works = all.filter(c => c.zone === ZONE_I).sort(byCentre);
    while (town.length || works.length) {
      for (let k = 0; k < 4 && town.length; k++) this.cells.push(town.shift()!);
      if (works.length) this.cells.push(works.shift()!);
    }
    for (let rx = X0 + 28; rx <= X0 + N * 4 + 6; rx++) this.road(rx, this.yardY);
  }

  get done(): boolean { return this.next >= this.cells.length; }

  private road(x: number, y: number) {
    if (this.sim.world.layers.roadClass[this.sim.world.grid.idx(x, y)] === ROAD_STREET) return;   // already built: not an action
    this.rec.run(this.sim.history, new BuildRoadCommand(x, y, ROAD_STREET), 'road');
  }

  /** Build the next cell: its four streets and its zones. */
  buildCell(): boolean {
    if (this.done) return false;
    const c = this.cells[this.next++];
    const x = X0 + c.cx * 4, y = Y0 + c.cy * 4;
    for (let k = 0; k <= 4; k++) { this.road(x + k, y); this.road(x + k, y + 4); this.road(x, y + k); this.road(x + 4, y + k); }
    const tag = this.opts.tagOf?.(c.zone) ?? 'zone';
    for (let dy = 1; dy <= 3; dy++) for (let dx = 1; dx <= 3; dx++) {
      if ((dx === 1 && dy === 1) || (dx === 2 && dy === 2)) continue;
      this.rec.run(this.sim.history, new PaintZoneCommand(x + dx, y + dy, c.zone), tag);
    }
    this.built.push(c);
    return true;
  }

  /** Tiles of a built cell's zone (7 per cell). */
  cellTiles(c: { cx: number; cy: number }): { x: number; y: number }[] {
    const x = X0 + c.cx * 4, y = Y0 + c.cy * 4, out: { x: number; y: number }[] = [];
    for (let dy = 1; dy <= 3; dy++) for (let dx = 1; dx <= 3; dx++) if (!((dx === 1 && dy === 1) || (dx === 2 && dy === 2))) out.push({ x: x + dx, y: y + dy });
    return out;
  }
  /** A cell's free middle tile (surrounded by its zone). */
  cellMiddle(c: { cx: number; cy: number }) { return { x: X0 + c.cx * 4 + 2, y: Y0 + c.cy * 4 + 2 }; }

  /** Add a utility when supply is under demand × 1.15. */
  utilities(): void {
    const s = this.sim.world.stats;
    for (const [kind, supply, demand] of [
      [BUILDING_POWER_PLANT, s.powerSupply, s.powerDemand], [BUILDING_WATER_TOWER, s.waterSupply, s.waterDemand],
      [BUILDING_SEWAGE_PLANT, s.sewageSupply, s.sewageDemand],
    ] as [number, number, number][]) {
      if (supply >= demand * 1.15 + 1) continue;
      if (this.opts.utilitiesInTown && kind === BUILDING_POWER_PLANT) {
        const home = this.built.find(c => c.zone === ZONE_R && this.sim.world.layers.building[this.sim.world.grid.idx(X0 + c.cx * 4 + 1, Y0 + c.cy * 4 + 1)] === BUILDING_NONE);
        if (home && this.rec.run(this.sim.history, new PlaceBuildingCommand(X0 + home.cx * 4 + 1, Y0 + home.cy * 4 + 1, kind), 'nuisancePlant')) continue;
      }
      const k = this.yardNext;
      const x = X0 + N * 4 + 6 + (k >> 1), y = this.yardY + ((k & 1) ? 1 : -1);
      for (let rx = X0 + N * 4; rx <= x; rx++) this.road(rx, this.yardY);
      if (this.rec.run(this.sim.history, new PlaceBuildingCommand(x, y, kind), KIND_NAME[kind])) this.yardNext++;
    }
  }
}

export { ZONE_R, ZONE_C, ZONE_I };
