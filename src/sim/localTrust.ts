// Local trust, PROTOTYPE slice 1 (PC_DESIGN.md, "Redesign in progress"; off unless
// BALANCE.politicalCapital.localTrust.enabled). Each request-grid cell (requests.cellSize) keeps its own
// trust beside the city's PC, which is left exactly as it is for comparison:
//   - every PC part of a command's quote (displacement, nuisance, service closed / opened, blight cleared,
//     a big project) is also charged to the cell of the tile it lands on, which is where the residents live;
//   - a cell holds at most its residents' share of the city's PC cap × shareMult, or (slice 2) `displacements`
//     × what displacing its average home costs, or (play-feel) `homeShare` of what displacing all its homes
//     costs; at least minCap. With `refillDays` it refills in a straight line over that many days. It starts full and regenerates in
//     proportion to its cap, so it fills as fast as the city does;
//   - an action is refused when a cell it would charge cannot cover that cell's part (the city rule, cell by
//     cell: rewards don't offset; a service closure is never refused and may take a cell below 0). With
//     cityGate false (slice 2), only cells refuse: the city's PC is still charged, for comparison;
//   - spillover (slice 3): a cell's displacement loss also comes off its 8 neighbours at `spill` each (to 0,
//     not below; a nuisance or closure does not spill);
//     only the cell where the residents live decides whether the action is refused.
// Not saved, and not shown: the lab reads it through localTrustCells(). Requests met and failed, milestones,
// ordinances and events stay city-wide in this slice.

import type { World } from './World';
import { BALANCE } from '../data/balance';
import { ZONE_R } from './constants';

export interface LocalTrustConfig {
  enabled: boolean; minCap: number; shareMult: number;
  /** False: only local trust refuses an action; the city's PC is still charged, but never refuses (slice 2). */
  cityGate: boolean;
  /** Above 0: a cell holds this many displacements of its average home instead of its share of the city's cap (slice 2). */
  displacements: number;
  /** Spillover (slice 3): when a cell loses trust, each of its 8 neighbours loses this share of the loss too (down to 0, not below). */
  spill: number;
  /** Refill speed against the city's (1 = a cell fills in the same time as the city; 0.25 = four times as long). */
  regenMult: number;
  /**
   * Play-feel sizing (owner's playtest, 2026-11-22): above 0, a cell holds this share of what displacing ALL its
   * homes would cost (0.25: a player can clear about a quarter of a neighbourhood before it refuses).
   */
  homeShare: number;
  /** Above 0: a cell refills its whole cap in this many days, in a straight line, while the city's mood is not draining PC. */
  refillDays: number;
}
const cfg = (): LocalTrustConfig => (BALANCE.politicalCapital as unknown as { localTrust: LocalTrustConfig }).localTrust;
export const localTrustEnabled = (): boolean => cfg()?.enabled === true;

interface State { trust: Map<number, number>; residents: Map<number, number>; homes: Map<number, number>; biggestLot: Map<number, number>; population: number; tick: number; edits: number }
const states = new WeakMap<World, State>();

function cellSize(): number { return (BALANCE.politicalCapital.requests as unknown as { cellSize: number }).cellSize; }

/** The request-grid cell of tile (tx, ty). */
export function trustCell(world: World, tx: number, ty: number): number {
  const cs = cellSize();
  return Math.floor(ty / cs) * Math.ceil(world.grid.width / cs) + Math.floor(tx / cs);
}

function state(world: World): State {
  let s = states.get(world);
  if (!s) states.set(world, s = { trust: new Map(), residents: new Map(), homes: new Map(), biggestLot: new Map(), population: 0, tick: -1, edits: -1 });
  if (s.tick !== world.tick || s.edits !== world.grid.edits) {
    // Residents per cell, once a tick at most.
    s.residents.clear(); s.homes.clear(); s.biggestLot.clear();
    let pop = 0;
    const { zone, devLevel, abandoned } = world.layers, pp = BALANCE.growth.popPerLevel as Record<number, number>;
    const { zoned, zonedCount } = world.index, W = world.grid.width;
    for (let k = 0; k < zonedCount; k++) {
      const i = zoned[k];
      if (zone[i] !== ZONE_R || !devLevel[i] || abandoned[i]) continue;
      const n = pp[devLevel[i]] ?? 0, c = trustCell(world, i % W, Math.floor(i / W));
      s.residents.set(c, (s.residents.get(c) ?? 0) + n);
      s.homes.set(c, (s.homes.get(c) ?? 0) + 1);
      const lot = world.layers.lot[i] ? 4 * n : n;   // a merged 2×2 lot comes down whole
      if (lot > (s.biggestLot.get(c) ?? 0)) s.biggestLot.set(c, lot);
      pop += n;
    }
    s.population = pop;
    s.tick = world.tick; s.edits = world.grid.edits;
  }
  return s;
}

/** Play-feel sizing is on (homeShare > 0): then only displacement is refused locally. */
export const localHomeShareOn = (): boolean => (cfg()?.homeShare ?? 0) > 0;

/** The city gate: false when only local trust refuses (slice 2). */
export const cityGateOn = (): boolean => cfg()?.cityGate !== false;

/**
 * A cell's cap: `displacements` × what displacing its average home costs (slice 2), or else its residents'
 * share of the city's PC cap times shareMult; at least minCap.
 */
export function cellCap(world: World, cell: number, cityCap: number): number {
  const s = state(world);
  const homeShare = cfg().homeShare ?? 0;
  if (homeShare > 0) {
    const perResident = BALANCE.politicalCapital.disruptionCosts.bulldozePerPop * (cityCap / BALANCE.politicalCapital.max);
    // At least enough to clear its biggest single lot, so no home is ever beyond reach.
    return Math.max(cfg().minCap, homeShare * (s.residents.get(cell) ?? 0) * perResident, (s.biggestLot.get(cell) ?? 0) * perResident);
  }
  const per = cfg().displacements ?? 0;
  if (per > 0) {
    const homes = s.homes.get(cell) ?? 0;
    const avg = homes > 0 ? (s.residents.get(cell) ?? 0) / homes : 0;
    const perResident = BALANCE.politicalCapital.disruptionCosts.bulldozePerPop * (cityCap / BALANCE.politicalCapital.max);
    return Math.max(cfg().minCap, per * avg * perResident);
  }
  const share = s.population > 0 ? (s.residents.get(cell) ?? 0) / s.population : 0;
  return Math.max(cfg().minCap, cityCap * share * (cfg().shareMult ?? 1));
}

/** A cell's trust (a cell not yet touched starts full). */
export function cellTrust(world: World, cell: number, cityCap: number): number {
  const s = state(world);
  return s.trust.get(cell) ?? cellCap(world, cell, cityCap);
}

/** Change a cell's trust; a gain stops at its cap. Returns the change applied. */
export function changeTrust(world: World, cell: number, delta: number, cityCap: number, capped: boolean): number {
  const s = state(world), before = cellTrust(world, cell, cityCap);
  let after = before + delta;
  if (delta > 0 && capped) after = Math.max(before, Math.min(after, cellCap(world, cell, cityCap)));
  s.trust.set(cell, after);
  return after - before;
}

/**
 * A cell's change a tick, given its cap and the city's passive change this tick: with refillDays, a straight
 * refill of the cap over that many days, paused while the city's mood drains PC; otherwise in proportion to its
 * cap (× regenMult for a gain).
 */
export function refillPerTick(cap: number, cityCap: number, cityAmount: number): number {
  const days = cfg().refillDays ?? 0;
  if (days > 0) return cityAmount >= 0 ? cap / (days * BALANCE.ticksPerDay) : 0;
  return cityAmount * cap / Math.max(1e-9, cityCap) * (cityAmount > 0 ? (cfg().regenMult ?? 1) : 1);
}

/** Each tick: every cell with residents regenerates in proportion to its cap (filling as fast as the city), up to its cap. */
export function regenTrust(world: World, cityAmount: number, cityCap: number): void {
  const s = state(world);
  for (const [cell, n] of s.residents) {
    if (n <= 0) continue;
    const t = cellTrust(world, cell, cityCap), cap = cellCap(world, cell, cityCap);
    const amount = refillPerTick(cap, cityCap, cityAmount);
    if (amount > 0) { if (t < cap) s.trust.set(cell, Math.min(cap, t + amount)); }
    else if (t > 0) s.trust.set(cell, Math.max(0, t + amount));
    else if (!s.trust.has(cell)) s.trust.set(cell, t);
  }
}

/** How fast a cell refills compared with the city (localTrust.regenMult). */
export const refillMult = (): number => cfg()?.regenMult ?? 1;

/** The middle tile of a cell, to name it ("the neighbourhood around 34, 56"). */
export function cellMiddle(world: World, cell: number): { tx: number; ty: number } {
  const cs = cellSize(), cols = Math.ceil(world.grid.width / cs);
  return { tx: (cell % cols) * cs + (cs >> 1), ty: Math.floor(cell / cols) * cs + (cs >> 1) };
}

/** The last time a cell refused an action's quote (for the debug toast saying which cell, and why). */
export interface LocalBlock { cell: number; need: number; have: number; tick: number }
const lastBlocks = new WeakMap<World, LocalBlock>();
export function noteLocalBlock(world: World, block: LocalBlock): void { lastBlocks.set(world, block); }
export function lastLocalBlock(world: World): LocalBlock | null { return lastBlocks.get(world) ?? null; }

/** Spillover (slice 3): the share of a cell's loss each of its 8 neighbours also loses. */
export const spillShare = (): number => Math.max(0, cfg()?.spill ?? 0);

/** The 8 cells around `cell` on the grid (fewer at the map's edge). */
export function neighbourCells(world: World, cell: number): number[] {
  const cs = cellSize(), cols = Math.ceil(world.grid.width / cs), rows = Math.ceil(world.grid.height / cs);
  const cx = cell % cols, cy = Math.floor(cell / cols), out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const x = cx + dx, y = cy + dy;
    if (x >= 0 && y >= 0 && x < cols && y < rows) out.push(y * cols + x);
  }
  return out;
}

/** Take `loss` (> 0) off a cell's neighbours' trust, down to 0 and not below. Returns the changes applied, for undo. */
export function spillLoss(world: World, cell: number, loss: number, cityCap: number): [number, number][] {
  const share = spillShare(), out: [number, number][] = [];
  if (!(share > 0) || !(loss > 0)) return out;
  const s = state(world);
  for (const n of neighbourCells(world, cell)) {
    const t = cellTrust(world, n, cityCap), take = Math.min(Math.max(0, t), loss * share);
    if (take > 0) { s.trust.set(n, t - take); out.push([n, -take]); }
  }
  return out;
}

/** For the lab: every cell with residents or trust recorded, with its trust and cap. */
export function localTrustCells(world: World, cityCap: number): { cell: number; residents: number; trust: number; cap: number }[] {
  const s = state(world);
  const cells = new Set<number>([...s.residents.keys(), ...s.trust.keys()]);
  return [...cells].sort((a, b) => a - b).map(cell => ({ cell, residents: s.residents.get(cell) ?? 0, trust: cellTrust(world, cell, cityCap), cap: cellCap(world, cell, cityCap) }));
}
