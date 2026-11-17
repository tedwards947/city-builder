// Balance Lab, services suite: school and hospital capacity (SERVICES_DESIGN.md,
// engine's src/sim/serviceCapacity.ts). The Planner plays each city under a
// capacity / reach preset; these helpers measure the result. Pure reads: probes
// work on copies or on seat assignments, never on the played city.

import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { BUILDING_SCHOOL, BUILDING_HOSPITAL } from '../sim/constants';
import { assignSeats, buildingReach, homeResidents, serviceCapacity, seatsIfOpened, type BuildingReach } from '../sim/serviceCapacity';
import { pcCap } from '../sim/politics';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import type { Command } from '../commands/Command';
import { findLot } from './town';
import { cloneWorld, startSim, type Sim } from './world';

export const SVC_KINDS = [BUILDING_SCHOOL, BUILDING_HOSPITAL] as const;
export const SVC_NAME: Record<number, 'school' | 'hospital'> = { [BUILDING_SCHOOL]: 'school', [BUILDING_HOSPITAL]: 'hospital' };

/** A capacity (residents per building; 0 = no limit) and optional reach (road steps) per kind. */
export interface SvcPreset { id: string; name: string; desc: string; capacity: Record<number, number>; range?: Record<number, number> }

export const SVC_PRESETS: SvcPreset[] = [
  { id: 'off', name: 'No capacity (shipped)', desc: 'Capacity 0 = reach alone decides, as the game ships today.', capacity: { 6: 0, 7: 0 } },
  { id: 'low', name: 'Small', desc: 'School 1,500, hospital 5,000; shipped reach.', capacity: { 6: 1500, 7: 5000 } },
  { id: 'mid', name: 'Medium', desc: 'School 2,000, hospital 8,000; shipped reach.', capacity: { 6: 2000, 7: 8000 } },
  { id: 'high', name: 'Large', desc: 'School 3,000, hospital 12,000; shipped reach.', capacity: { 6: 3000, 7: 12000 } },
  { id: 'mid-wide', name: 'Medium, wide reach', desc: 'School 2,000 within 16 road steps, hospital 8,000 within 24 (the design doc\'s direction).', capacity: { 6: 2000, 7: 8000 }, range: { 6: 16, 7: 24 } },
];

/** Apply a preset to BALANCE.service; returns a function that puts the shipped numbers back. */
export function applySvcPreset(p: SvcPreset): () => void {
  const cap = { ...BALANCE.service.capacity }, range = { ...BALANCE.service.coverageRange };
  Object.assign(BALANCE.service.capacity, p.capacity);
  if (p.range) Object.assign(BALANCE.service.coverageRange, p.range);
  return () => { Object.assign(BALANCE.service.capacity, cap); Object.assign(BALANCE.service.coverageRange, range); };
}

export interface SvcKindStats {
  buildings: number;
  /** Buildings per 10k residents. */
  per10k: number;
  seatedShare: number;
  /** Residents with no seat because every building in reach is full, and because none reaches them (shares of the population). */
  fullShare: number;
  outOfReachShare: number;
  /** Share of homes whose reported reason (seated / full / out of reach) matches the reach and the buildings' fill. */
  visibleOk: number;
  /** Buildings with no room for even the smallest unseated home in their reach (shown as full). */
  fullBuildings: number;
}

function reachesOf(w: World, kind: number): BuildingReach[] {
  return w.buildings.filter(b => b.kind === kind).map(b => buildingReach(w, b.tx, b.ty, kind));
}

function homesIn(w: World): number[] {
  const out: number[] = [];
  for (let i = 0; i < w.layers.zone.length; i++) if (homeResidents(w, i) > 0) out.push(i);
  return out;
}

/** Seating and visibility for one kind on a world, recomputed from scratch (independent of the sim's cache). */
export function svcKindStats(w: World, kind: number): SvcKindStats {
  const reaches = reachesOf(w, kind), cap = serviceCapacity(kind);
  const s = assignSeats(w, reaches, cap);
  const homes = homesIn(w);
  const pop = homes.reduce((a, i) => a + homeResidents(w, i), 0) || 1;
  const reachSets = reaches.map(r => new Set(r.tiles));
  let seated = 0, full = 0, out = 0, ok = 0;
  for (const i of homes) {
    const n = homeResidents(w, i), b = s.seatOf.get(i);
    const inReach = reachSets.map((set, k) => (set.has(i) ? k : -1)).filter(k => k >= 0);
    if (b !== undefined) { seated += n; if (reachSets[b].has(i) && (!cap || s.seated[b] <= cap)) ok++; }
    else if (s.full.has(i)) { full += n; if (inReach.length && inReach.every(k => cap > 0 && s.seated[k] + n > cap)) ok++; }
    else { out += n; if (!inReach.length) ok++; }
  }
  const fullBuildings = cap ? reaches.filter((_, k) => s.inReachUnseated[k] > 0).length : 0;
  return {
    buildings: reaches.length,
    per10k: r3(reaches.length / (pop / 10_000)),
    seatedShare: r3(seated / pop), fullShare: r3(full / pop), outOfReachShare: r3(out / pop),
    visibleOk: r3(ok / Math.max(homes.length, 1)),
    fullBuildings,
  };
}

/**
 * Growth shock: 5% of homes (the seated homes at the fullest buildings, nearest first)
 * grow one level; how many residents lose a seat per resident added. Computed on seat
 * assignments only: the grown levels are set and put back.
 */
export function growthShock(w: World, kind: number): { addedResidents: number; lostSeats: number; perNewResident: number | null } | null {
  const cap = serviceCapacity(kind);
  if (!cap) return null;
  const reaches = reachesOf(w, kind);
  if (!reaches.length) return null;
  const before = assignSeats(w, reaches, cap);
  const homes = homesIn(w);
  const L = w.layers;
  // Seated homes that can still grow, at the fullest buildings first, then by tile.
  const cands = homes.filter(i => before.seatOf.has(i) && L.devLevel[i] < 3)
    .sort((a, b) => before.seated[before.seatOf.get(b)!] - before.seated[before.seatOf.get(a)!] || a - b);
  const grow = cands.slice(0, Math.max(1, Math.round(homes.length * 0.05)));
  const was = grow.map(i => L.devLevel[i]);
  const resBefore = grow.reduce((a, i) => a + homeResidents(w, i), 0);
  try {
    for (const i of grow) L.devLevel[i]++;
    const added = grow.reduce((a, i) => a + homeResidents(w, i), 0) - resBefore;
    const after = assignSeats(w, reaches, cap);
    let lost = 0;
    for (const i of homes) if (before.seatOf.has(i) && !after.seatOf.has(i)) lost += homeResidents(w, i);
    return { addedResidents: added, lostSeats: lost, perNewResident: added ? r3(lost / added) : null };
  } finally {
    grow.forEach((i, k) => { L.devLevel[i] = was[k]; });
  }
}

/**
 * Fix: the building with the most unseated residents in its reach gets a new one of its
 * kind on the nearest free lot; the share of those unseated residents then seated.
 */
export function fixProbe(w: World, kind: number): { overflow: number; seatedAfter: number; share: number | null } | null {
  const cap = serviceCapacity(kind);
  if (!cap) return null;
  const reaches = reachesOf(w, kind);
  if (!reaches.length) return null;
  const before = assignSeats(w, reaches, cap);
  let k = -1;
  before.inReachUnseated.forEach((v, j) => { if (v > 0 && (k < 0 || v > before.inReachUnseated[k])) k = j; });
  if (k < 0) return { overflow: 0, seatedAfter: 0, share: null };
  const W = w.grid.width, a = reaches[k].anchor;
  const lot = findLot(w, a % W, Math.floor(a / W), 8);
  if (!lot) return { overflow: before.inReachUnseated[k], seatedAfter: 0, share: 0 };
  const extra = buildingReach(w, lot.x, lot.y, kind);
  const after = assignSeats(w, [...reaches, extra], cap);
  const reachK = new Set(reaches[k].tiles);
  let overflow = 0, fixed = 0;
  for (const i of reachK) {
    const n = homeResidents(w, i);
    if (!n || before.seatOf.has(i) || !before.full.has(i)) continue;
    overflow += n;
    if (after.seatOf.has(i)) fixed += n;
  }
  return { overflow, seatedAfter: fixed, share: overflow ? r3(fixed / overflow) : null };
}

// ── PC service rule under capacity (engine's seat-based rule): probes on copies ──

function pcCopy(w: World): { sim: Sim; cap: number } {
  const sim = startSim(cloneWorld(w));
  sim.tick(1);
  sim.world.budget.politicalCapital = 1e6;
  sim.world.budget.money = 1e9;
  return { sim, cap: pcCap(sim.world) };
}
function pcDelta(sim: Sim, cmd: Command): number | null {
  const before = sim.world.budget.politicalCapital;
  return sim.history.run(cmd) ? sim.world.budget.politicalCapital - before : null;
}
/** Free lots within `d` tiles of (x, y), nearest first, up to `max`. */
function lotsNear(w: World, x: number, y: number, d: number, max: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [], skip = new Set<number>();
  for (let k = 0; k < max; k++) { const l = findLot(w, x, y, d, skip); if (!l) break; out.push(l); skip.add(w.grid.idx(l.x, l.y)); }
  return out;
}

export interface SvcPcProbes {
  /** PC per resident seated by the kind's first building (none of the kind standing). */
  firstPayPerResident: number | null;
  /** PC from a building that only re-seats homes already seated (gains no seat). */
  overlap: number | null;
  /** PC per resident a building beside the fullest one seats, ÷ firstPayPerResident. */
  relief: number | null;
  /** Net PC ÷ cap to move a building to the nearby lot where fewest residents lose a seat, and those residents. */
  move: number | null; moveLost: number | null;
  /** Net PC of 10 rounds of open-and-close beside the fullest building, and of close-and-reopen of a standing one. */
  loopBuildClose: number | null; loopCloseReopen: number | null;
}

export function svcPcProbes(w: World, kind: number): SvcPcProbes | null {
  const standing = w.buildings.filter(b => b.kind === kind);
  if (!standing.length) return null;
  const out: SvcPcProbes = { firstPayPerResident: null, overlap: null, relief: null, move: null, moveLost: null, loopBuildClose: null, loopCloseReopen: null };
  const cap0 = serviceCapacity(kind);

  // First-time pay: clear the kind, reopen at the first building's site.
  {
    const { sim } = pcCopy(w);
    const at = standing[0];
    for (const b of sim.world.buildings.filter(b => b.kind === kind)) sim.history.run(new BulldozeCommand(b.tx, b.ty));
    const g = seatsIfOpened(sim.world, at.tx, at.ty, kind).gainedResidents;
    const d = pcDelta(sim, new PlaceBuildingCommand(at.tx, at.ty, kind));
    if (d !== null && g > 0) out.firstPayPerResident = d / g;
  }
  const seat = assignSeats(w, standing.map(b => buildingReach(w, b.tx, b.ty, kind)), cap0);
  // Overlap: a lot beside a standing building where opening gains no seat but seats someone.
  {
    const { sim } = pcCopy(w);
    search: for (const b of standing) for (const l of lotsNear(sim.world, b.tx, b.ty, 3, 8)) {
      const ch = seatsIfOpened(sim.world, l.x, l.y, kind);
      if (ch.gainedResidents === 0 && ch.seatedAtNew > 0) { out.overlap = pcDelta(sim, new PlaceBuildingCommand(l.x, l.y, kind)); break search; }
    }
  }
  // Relief and the build/close loop, beside the fullest building.
  let fullest = -1;
  seat.inReachUnseated.forEach((v, k) => { if (v > 0 && (fullest < 0 || v > seat.inReachUnseated[fullest])) fullest = k; });
  if (fullest >= 0) {
    const b = standing[fullest];
    const { sim } = pcCopy(w);
    const l = lotsNear(sim.world, b.tx, b.ty, 8, 1)[0];
    if (l) {
      const g = seatsIfOpened(sim.world, l.x, l.y, kind).gainedResidents;
      const d = pcDelta(sim, new PlaceBuildingCommand(l.x, l.y, kind));
      if (d !== null && g > 0 && out.firstPayPerResident) out.relief = r3(d / g / out.firstPayPerResident);
      let net = d ?? 0;
      const c = pcDelta(sim, new BulldozeCommand(l.x, l.y)); net += c ?? 0;
      for (let k = 1; k < 10; k++) { net += pcDelta(sim, new PlaceBuildingCommand(l.x, l.y, kind)) ?? 0; net += pcDelta(sim, new BulldozeCommand(l.x, l.y)) ?? 0; }
      out.loopBuildClose = r3(net);
    }
  }
  // Close and reopen a standing building, 10 rounds.
  {
    const { sim } = pcCopy(w);
    const b = standing[0];
    let net = 0;
    for (let k = 0; k < 10; k++) { net += pcDelta(sim, new BulldozeCommand(b.tx, b.ty)) ?? 0; net += pcDelta(sim, new PlaceBuildingCommand(b.tx, b.ty, kind)) ?? 0; }
    out.loopCloseReopen = r3(net);
  }
  // Move: the busiest building to the lot within 10 tiles where fewest residents lose a seat.
  {
    let busiest = 0;
    seat.seated.forEach((v, k) => { if (v > seat.seated[busiest]) busiest = k; });
    const b = standing[busiest], others = standing.filter((_, k) => k !== busiest).map(x => buildingReach(w, x.tx, x.ty, kind));
    const before = seat;
    let best: { x: number; y: number; lost: number } | null = null;
    for (const l of lotsNear(w, b.tx, b.ty, 10, 40)) {
      const after = assignSeats(w, [...others, buildingReach(w, l.x, l.y, kind)], cap0);
      let lost = 0;
      for (const i of before.seatOf.keys()) if (!after.seatOf.has(i)) lost += homeResidents(w, i);
      if (!best || lost < best.lost) best = { ...l, lost };
    }
    if (best) {
      const { sim, cap } = pcCopy(w);
      const o = pcDelta(sim, new PlaceBuildingCommand(best.x, best.y, kind));
      const c = o !== null ? pcDelta(sim, new BulldozeCommand(b.tx, b.ty)) : null;
      if (o !== null && c !== null) { out.move = r3((o + c) / cap); out.moveLost = best.lost; }
    }
  }
  return out;
}

export interface SvcResult {
  population: number;
  kinds: Record<'school' | 'hospital', SvcKindStats & { growth: ReturnType<typeof growthShock>; fix: ReturnType<typeof fixProbe>; pc?: SvcPcProbes | null }>;
}

export function svcResult(w: World): SvcResult {
  const kinds = {} as SvcResult['kinds'];
  for (const k of SVC_KINDS) kinds[SVC_NAME[k]] = { ...svcKindStats(w, k), growth: growthShock(w, k), fix: fixProbe(w, k) };
  return { population: w.stats.population, kinds };
}

/** The PC probes for both kinds, under whatever PC numbers BALANCE holds now. */
export function addSvcPcProbes(r: SvcResult, w: World): void {
  for (const k of SVC_KINDS) r.kinds[SVC_NAME[k]].pc = svcPcProbes(w, k);
}

function r3(v: number) { return Math.round(v * 1000) / 1000; }
