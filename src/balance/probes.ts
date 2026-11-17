// Balance Lab: one-off measurements on a copy of a city (prices, rewards, loops).
// Each probe works on its own clone with PC raised high, so nothing is refused
// and the original run is untouched; values are PC changes, mostly ÷ the cap.

import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { pcCap } from '../sim/politics';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { PaintZoneCommand } from '../commands/PaintZoneCommand';
import { BuildRoadCommand } from '../commands/BuildRoadCommand';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import type { Command } from '../commands/Command';
import { cloneWorld, startSim, type Sim } from './world';
import { findLot, placeNear, isHome, isFreeLot, residentsAt, KIND_NAME } from './town';
import { homesWithinReach } from '../sim/serviceValue';
import { hasCapacity, seatsIfClosed, seatsIfOpened } from '../sim/serviceCapacity';
import {
  ZONE_NONE, ZONE_C, ZONE_I, ZONE_R, ROAD_NONE, ROAD_STREET, BUILDING_NONE,
  BUILDING_POWER_PLANT, BUILDING_SCHOOL, BUILDING_HOSPITAL, BUILDING_POLICE,
} from '../sim/constants';

const RICH = 1e6;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

function copy(world: World): { sim: Sim; cap: number } {
  const sim = startSim(cloneWorld(world));
  sim.tick(1);
  sim.world.budget.politicalCapital = RICH;
  sim.world.budget.money = 1e9;
  return { sim, cap: pcCap(sim.world) };
}
/** PC change from running cmd (negative = cost). */
function delta(sim: Sim, cmd: Command): number | null {
  const before = sim.world.budget.politicalCapital;
  return sim.history.run(cmd) ? sim.world.budget.politicalCapital - before : null;
}
function homes(w: World): number[] {
  const out: number[] = [];
  for (let i = 0; i < w.layers.zone.length; i++) if (isHome(w, i)) out.push(i);
  return out;
}
/**
 * The home with the most residents within 6 tiles: where the probes put their
 * buildings. (The centre of all homes can fall in a park, a lake or a gap
 * between towns.)
 */
function centroid(w: World): { x: number; y: number } {
  const W = w.grid.width, hs = homes(w);
  if (!hs.length) return { x: W / 2, y: w.grid.height / 2 };
  const res = new Map(hs.map(i => [i, residentsAt(w, i)] as const));
  let best = hs[0], bestN = -1;
  for (let k = 0; k < hs.length; k += Math.max(1, Math.floor(hs.length / 400))) {
    const i = hs[k];
    let n = 0;
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) n += res.get(i + dy * W + dx) ?? 0;
    if (n > bestN) { bestN = n; best = i; }
  }
  return { x: best % W, y: Math.floor(best / W) };
}

/**
 * A spot to build on beside the densest homes. A dense city has no free lot
 * there, so, like a player, clear the 3×3 around it first (not its roads);
 * the PC that clearing costs is not part of what the probes measure.
 */
function spot(sim: Sim): { x: number; y: number } {
  const c = centroid(sim.world), L = sim.world.layers, W = sim.world.grid.width;
  if (findLot(sim.world, c.x, c.y, 3)) return c;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const i = (c.y + dy) * W + c.x + dx;
    if (L.roadClass[i] === ROAD_NONE && (L.zone[i] !== ZONE_NONE || L.building[i] !== BUILDING_NONE)) sim.history.run(new BulldozeCommand(c.x + dx, c.y + dy));
  }
  return c;
}

export interface StaticProbes { cap: number; population: number; [k: string]: unknown }

export function staticProbes(world: World): StaticProbes {
  const base = copy(world);
  const W = base.sim.world.grid.width;
  const out: StaticProbes = { cap: r3(base.cap), population: base.sim.world.stats.population };

  // A tower: the cost of displacing one level-3 home (scaled from the highest level present).
  {
    const { sim, cap } = copy(world);
    const hs = homes(sim.world).sort((a, b) => sim.world.layers.devLevel[b] - sim.world.layers.devLevel[a] || a - b);
    if (hs.length) {
      const i = hs[0], res = residentsAt(sim.world, i);
      const d = delta(sim, new BulldozeCommand(i % W, Math.floor(i / W)));
      if (d !== null && res > 0) out.tower = { costPerLevel3: r3((-d * (BALANCE.growth.popPerLevel[3] ?? 20)) / res), ratio: r3((-d * (BALANCE.growth.popPerLevel[3] ?? 20)) / res / cap), residentsProbed: res };
    }
  }

  // Clearing the most populous 12×12 neighbourhood in one go.
  {
    const { sim, cap } = copy(world);
    const by = new Map<number, { n: number; tiles: number[] }>();
    for (const i of homes(sim.world)) { const k = Math.floor(Math.floor(i / W) / 12) * 1000 + Math.floor((i % W) / 12); const e = by.get(k) ?? { n: 0, tiles: [] }; e.n += residentsAt(sim.world, i); e.tiles.push(i); by.set(k, e); }
    const best = [...by.values()].sort((a, b) => b.n - a.n)[0];
    if (best) {
      const before = sim.world.budget.politicalCapital;
      sim.history.beginBatch();
      for (const i of best.tiles) sim.history.run(new BulldozeCommand(i % W, Math.floor(i / W)));
      sim.history.endBatch();
      out.neighbourhood = { residents: best.n, ratio: r3((before - sim.world.budget.politicalCapital) / cap) };
    }
  }

  // Ribbon cuttings, moving and the lonely closure, per kind. Copy 1: clear the kind, open one
  // near the middle of the homes, a second about 6 tiles east (a new district, mostly), then close
  // the first and the second (the last one). Copy 2: the same first building, then a second on the
  // free lot that serves most of the first one's homes, then close the first: a move.
  // Pay per resident: the first building's PC ÷ the residents it serves (r). A building serving
  // O residents the first already serves and D only it serves earns about r·(D + overlapPay·O).
  for (const kind of [BUILDING_SCHOOL, BUILDING_HOSPITAL, BUILDING_POLICE]) {
    const { sim, cap } = copy(world);
    for (const b of sim.world.buildings.filter(b => b.kind === kind)) sim.history.run(new BulldozeCommand(b.tx, b.ty));
    const before = cloneWorld(sim.world);
    const c = spot(sim);
    const p0 = sim.world.budget.politicalCapital;
    const l1 = placeNear(sim, null, kind, c.x, c.y, 12);
    if (!l1) continue;
    const p1 = sim.world.budget.politicalCapital, first = p1 - p0;
    const res = (w: World, hs: Iterable<number>) => { let n = 0; for (const i of hs) n += residentsAt(w, i); return n; };
    const h1 = new Set(homesWithinReach(sim.world, l1.x, l1.y, kind));
    // Schools and hospitals with a capacity are paid per seat (engine's seat rule), others per resident in reach.
    const seatKind = hasCapacity(kind);
    const anchorOf = (x: number, y: number) => sim.world.buildingAnchorAt(sim.world.grid.idx(x, y));
    const seats1 = seatKind ? seatsIfClosed(sim.world, anchorOf(l1.x, l1.y), kind).lostResidents : 0;
    const perRes = seatKind ? (seats1 > 0 ? first / seats1 : 0) : h1.size ? first / Math.max(res(sim.world, h1), 1e-9) : 0;
    const split = (w: World, x: number, y: number) => {
      const h = homesWithinReach(w, x, y, kind);
      return { O: res(w, h.filter(i => h1.has(i))), D: res(w, h.filter(i => !h1.has(i))) };
    };
    const l2 = placeNear(sim, null, kind, l1.x + 6, l1.y, 8);
    const second = l2 ? sim.world.budget.politicalCapital - p1 : null;
    const s2 = l2 ? split(sim.world, l2.x, l2.y) : null;
    const seats2 = seatKind && l2 ? seatsIfClosed(sim.world, anchorOf(l2.x, l2.y), kind).lostResidents : 0;
    const closeFirstFar = second !== null ? delta(sim, new BulldozeCommand(l1.x, l1.y)) : null;
    const closeLast = second !== null && l2 ? delta(sim, new BulldozeCommand(l2.x, l2.y)) : null;

    // Copy 2: the move to an overlapping site.
    const sim2 = startSim(before);
    sim2.world.budget.politicalCapital = RICH;
    sim2.history.run(new PlaceBuildingCommand(l1.x, l1.y, kind));
    const lots: { x: number; y: number; n: number; d: number }[] = [];
    for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) {
      const x = l1.x + dx, y = l1.y + dy;
      if (!isFreeLot(sim2.world, x, y)) continue;
      lots.push({ x, y, n: split(sim2.world, x, y).O, d: Math.max(Math.abs(dx), Math.abs(dy)) });
    }
    lots.sort((a, b) => b.n - a.n || a.d - b.d || a.y - b.y || a.x - b.x);
    let near: { x: number; y: number; open: number; O: number; D: number; gained: number; reseated: number } | null = null;
    for (const lot of lots.slice(0, 30)) {
      const sp = split(sim2.world, lot.x, lot.y);
      const ch = seatKind ? seatsIfOpened(sim2.world, lot.x, lot.y, kind) : null;
      const d = delta(sim2, new PlaceBuildingCommand(lot.x, lot.y, kind));
      if (d !== null) { near = { x: lot.x, y: lot.y, open: d, ...sp, gained: ch?.gainedResidents ?? 0, reseated: ch ? ch.seatedAtNew - ch.gainedResidents : 0 }; break; }
    }
    const closeFirstNear = near ? delta(sim2, new BulldozeCommand(l1.x, l1.y)) : null;

    // Overlap pay from the overlapping building (mostly overlap); new-district pay from the far one.
    const overlapPay = seatKind
      ? (near && perRes > 0 && near.reseated > 0 ? (near.open - perRes * near.gained) / (perRes * near.reseated) : null)
      : (near && perRes > 0 && near.O > 0 ? (near.open - perRes * near.D) / (perRes * near.O) : null);
    const newPay = seatKind
      ? (second !== null && perRes > 0 && seats2 > 0 ? second / (perRes * seats2) : null)
      : (s2 && second !== null && perRes > 0 && s2.D > 0 ? (second - perRes * (overlapPay ?? 0) * s2.O) / (perRes * s2.D) : null);
    out['ribbon:' + KIND_NAME[kind]] = {
      first: first === null ? null : r3(first / cap),
      second: second === null ? null : r3(second / cap),
      secondOverFirst: first && second !== null ? r3(second / first) : null,
      overlapPay: overlapPay === null ? null : r3(overlapPay),
      newPay: newPay === null ? null : r3(newPay),
      secondNewShare: s2 && s2.O + s2.D > 0 ? r3(s2.D / (s2.O + s2.D)) : null,
      moveNet: near && closeFirstNear !== null ? r3((near.open + closeFirstNear) / cap) : null,
      moveOverlapShare: near && h1.size ? r3(near.O / Math.max(res(sim2.world, h1), 1e-9)) : null,
      moveNetFar: second !== null && closeFirstFar !== null ? r3((second + closeFirstFar) / cap) : null,
      closeLast: closeLast === null ? null : r3(-closeLast / cap),
    };
  }

  // A power plant beside homes, and one far from any home.
  {
    const { sim, cap } = copy(world);
    const c = spot(sim);
    const p0 = sim.world.budget.politicalCapital;
    const near = placeNear(sim, null, BUILDING_POWER_PLANT, c.x, c.y, 12) ? sim.world.budget.politicalCapital - p0 : null;
    let far: number | null = null;
    const L = sim.world.layers, H = sim.world.grid.height;
    for (const [x, y] of [[4, 4], [W - 6, 4], [4, H - 6], [W - 6, H - 6]]) {
      const i = y * W + x;
      if (L.terrain[i] === 1 || L.terrain[i + 1] === 1 || L.roadClass[i] !== ROAD_NONE || L.zone[i + 1] !== ZONE_NONE || L.building[i + 1] !== BUILDING_NONE) continue;
      let homesNear = 0;
      for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) if (isHome(sim.world, i + dy * W + dx)) homesNear++;
      if (homesNear) continue;
      sim.history.run(new BuildRoadCommand(x, y, ROAD_STREET));
      far = delta(sim, new PlaceBuildingCommand(x + 1, y, BUILDING_POWER_PLANT));
      if (far !== null) break;
    }
    out.nuisance = { nearHomes: near === null ? null : r3(-near / cap), farFromHomes: far === null ? null : r3(-far) };
  }

  const pc = BALANCE.politicalCapital;
  out.capGrowth = r3((pc.max + 10000 * pc.capPerResident) / pc.max);
  return out;
}

/** Days for this city, untouched, to regenerate from 0 PC to the cap (null if it never does within maxDays). */
export function refillProbe(world: World, maxDays = 300): { days: number | null; avgSatisfaction: number } {
  const sim = startSim(cloneWorld(world));
  sim.tick(1);
  sim.world.budget.politicalCapital = 0;
  let sat = 0;
  for (let d = 1; d <= maxDays; d++) {
    sim.tick(BALANCE.ticksPerDay);
    sat += sim.world.stats.satisfaction;
    if (sim.world.budget.politicalCapital >= pcCap(sim.world)) return { days: d, avgSatisfaction: r3(sat / d) };
  }
  return { days: null, avgSatisfaction: r3(sat / maxDays) };
}

/** Net PC of each known loop, 20 rounds, no time passing; and the worst undo mismatch. Positive net = an exploit. */
export function exploitLoops(world: World, rounds = 20): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  const W = world.grid.width;
  const lotNearHomes = (sim: Sim) => { const c = spot(sim); return findLot(sim.world, c.x, c.y, 12); };
  const run = (name: string, body: (sim: Sim) => boolean) => {
    const { sim } = copy(world);
    spot(sim);   // any clearing happens before the count starts
    const before = sim.world.budget.politicalCapital;
    out[name] = body(sim) ? r3(sim.world.budget.politicalCapital - before) : null;
  };
  run('buildClose', sim => {
    const c = spot(sim);
    const l = placeNear(sim, null, BUILDING_SCHOOL, c.x, c.y, 12); if (!l) return false;
    sim.history.run(new BulldozeCommand(l.x, l.y));
    for (let k = 1; k < rounds; k++) { sim.history.run(new PlaceBuildingCommand(l.x, l.y, BUILDING_SCHOOL)); sim.history.run(new BulldozeCommand(l.x, l.y)); }
    return true;
  });
  run('closeReopen', sim => {
    const b = sim.world.buildings.find(b => b.kind === BUILDING_SCHOOL || b.kind === BUILDING_HOSPITAL || b.kind === BUILDING_POLICE);
    if (!b) return false;
    const { tx, ty, kind } = b;
    for (let k = 0; k < rounds; k++) { sim.history.run(new BulldozeCommand(tx, ty)); sim.history.run(new PlaceBuildingCommand(tx, ty, kind)); }
    return true;
  });
  run('placeUndo', sim => {
    const l = lotNearHomes(sim); if (!l) return false;
    for (let k = 0; k < rounds; k++) if (sim.history.run(new PlaceBuildingCommand(l.x, l.y, BUILDING_SCHOOL))) sim.history.undo();
    return true;
  });
  run('rezone', sim => {
    const hs = homes(sim.world).slice(0, rounds);
    if (!hs.length) return false;
    for (const i of hs) { sim.history.run(new PaintZoneCommand(i % W, Math.floor(i / W), ZONE_C)); sim.history.run(new PaintZoneCommand(i % W, Math.floor(i / W), ZONE_R)); }
    return true;
  });
  // A drag of industry beside homes, as one batch vs tile by tile: positive = the batch is cheaper.
  {
    const { sim } = copy(world);
    const L = sim.world.layers, strip: number[] = [];
    for (const h of homes(sim.world)) {
      for (const o of [1, -1, W, -W, 2, -2]) {
        const i = h + o;
        if (strip.length < 6 && !strip.includes(i) && L.zone[i] === ZONE_NONE && L.roadClass[i] === ROAD_NONE && L.building[i] === BUILDING_NONE && L.terrain[i] !== 1) strip.push(i);
      }
      if (strip.length >= 6) break;
    }
    if (strip.length) {
      const p0 = sim.world.budget.politicalCapital;
      for (const i of strip) sim.history.run(new PaintZoneCommand(i % W, Math.floor(i / W), ZONE_I));
      const single = p0 - sim.world.budget.politicalCapital;
      for (let k = 0; k < strip.length; k++) sim.history.undo();
      const p1 = sim.world.budget.politicalCapital;
      sim.history.beginBatch();
      for (const i of strip) sim.history.run(new PaintZoneCommand(i % W, Math.floor(i / W), ZONE_I));
      sim.history.endBatch();
      out.batchVsSingle = r3(single - (p1 - sim.world.budget.politicalCapital));
    } else out.batchVsSingle = null;
  }
  // Undo exactness: do then undo each kind of action; the worst |PC difference|.
  {
    let worst = 0;
    const tries: ((sim: Sim) => Command | null)[] = [
      sim => { const l = lotNearHomes(sim); return l ? new PlaceBuildingCommand(l.x, l.y, BUILDING_HOSPITAL) : null; },
      sim => { const h = homes(sim.world)[0]; return h === undefined ? null : new BulldozeCommand(h % W, Math.floor(h / W)); },
      sim => { const h = homes(sim.world)[0]; return h === undefined ? null : new PaintZoneCommand(h % W, Math.floor(h / W), ZONE_I); },
      sim => { const h = homes(sim.world)[0]; return h === undefined ? null : new BuildRoadCommand(h % W, Math.floor(h / W), ROAD_STREET); },
      sim => { const b = sim.world.buildings.find(b => b.kind === BUILDING_SCHOOL); return b ? new BulldozeCommand(b.tx, b.ty) : null; },
    ];
    for (const make of tries) {
      const { sim } = copy(world);
      const cmd = make(sim);
      if (!cmd) continue;
      const before = sim.world.budget.politicalCapital;
      if (sim.history.run(cmd)) { sim.history.undo(); worst = Math.max(worst, Math.abs(sim.world.budget.politicalCapital - before)); }
    }
    out.undoWorstDiff = worst;
  }
  return out;
}
