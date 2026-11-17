// Balance Lab: deterministic scripted players. Each one plays a city day by day
// through the real commands; the Recorder sees everything that happens.

import { BALANCE } from '../data/balance';
import { pcCap } from '../sim/politics';
import { ORDINANCE_IDS, enactOrdinance, ordinancesEnabled, type OrdinanceId } from '../sim/ordinances';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { PaintZoneCommand } from '../commands/PaintZoneCommand';
import { Recorder } from './recorder';
import { startSim, type Sim } from './world';
import type { World } from '../sim/World';
import { Town, SERVICE_KINDS, CHASER_KINDS, serveLacking, answerRequest, answerTraffic, isHome, ZONE_R, ZONE_C, ZONE_I } from './town';
import { exploitLoops } from './probes';

export type PersonaId = 'planner' | 'sprawler' | 'demolisher' | 'neglecter' | 'chaser' | 'industrialist' | 'exploiter';

export interface PersonaOptions {
  /** Ordinance behaviour: 'auto' = the persona's own habit; 'eminent' = also enact Eminent Domain once affordable. */
  ordinances?: 'auto' | 'eminent';
  /** Play on the city's own money (economy suite): a fresh city starts with BALANCE.startingMoney, and the persona waits rather than borrow for new blocks and services. */
  realMoney?: boolean;
}

export interface Ctx {
  sim: Sim;
  rec: Recorder;
  town: Town | null;
  opts: PersonaOptions;
  /** Persona-specific results (e.g. exploit loops), copied into the report. */
  extra: Record<string, unknown>;
  /** Requests waiting for the chaser's answer. */
  pending: number[];
  /** Open traffic-jam requests the chaser is still working on. */
  traffic: { id: number; pass: number }[];
  /** A small seeded generator, so choices are the same every run. */
  rand: () => number;
}

export interface Persona {
  id: PersonaId;
  desc: string;
  /** Runs on fresh cities / on loaded saves. */
  fresh: boolean;
  save: boolean;
  day(c: Ctx, day: number): void;
}

const SERVICES_EVERY = 5;

function lcg(seed: number) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32); }

/** Cheapest ordinance to keep for 30 days (enact + 30 days of upkeep). */
export function cheapestOrdinance(): { id: OrdinanceId; cost: number } | null {
  const o = BALANCE.politicalCapital.ordinances;
  let best: { id: OrdinanceId; cost: number } | null = null;
  for (const id of ORDINANCE_IDS) { const n = o[id]; if (!n) continue; const cost = n.enactCost + 30 * n.dailyUpkeep; if (cost > 0 && (!best || cost < best.cost)) best = { id, cost }; }
  return best;
}

function ordinanceHabits(c: Ctx, day: number, keep: OrdinanceId | null) {
  if (!ordinancesEnabled()) return;
  const w = c.sim.world, pc = w.budget.politicalCapital, cap = pcCap(w);
  const cheap = cheapestOrdinance();
  if (cheap && pc >= cheap.cost && c.extra.ordinanceAffordableDay === undefined) {
    c.extra.ordinanceAffordableDay = day; c.extra.ordinanceAffordablePop = w.stats.population;
  }
  if (c.opts.ordinances === 'eminent' && !w.politics.ordinances.active.includes('eminentDomain')) {
    const n = BALANCE.politicalCapital.ordinances.eminentDomain;
    if (n && pc >= n.enactCost + 30 * n.dailyUpkeep && enactOrdinance(w, 'eminentDomain')) c.extra.eminentDay ??= day;
  }
  if (keep && !w.politics.ordinances.active.includes(keep)) {
    const n = BALANCE.politicalCapital.ordinances[keep];
    if (n && pc >= n.enactCost + 30 * n.dailyUpkeep + 0.5 * cap && enactOrdinance(w, keep)) c.extra.keptOrdinanceDay ??= day;
  }
}

/** Money a real-money player keeps in hand before starting a block (roads for a cell cost about 160). */
const BLOCK_RESERVE = 500;

function grow(c: Ctx, day: number, every: number, until = Infinity) {
  if (!c.town) return;
  if (day <= until) c.town.utilities();
  if (day % every === 0 && day <= until && (!c.opts.realMoney || c.sim.world.budget.money >= BLOCK_RESERVE)) c.town.buildCell();
}

function services(c: Ctx, day: number) {
  if (day % SERVICES_EVERY !== 0 || c.sim.world.stats.population < 200) return;
  for (const k of SERVICE_KINDS) {
    if (c.opts.realMoney && c.sim.world.budget.money < (BALANCE.buildings[k]?.cost ?? 0) + BLOCK_RESERVE) continue;
    serveLacking(c.sim, c.rec, k);
  }
}

/** Traffic-jam requests still open, revisited every 3 days with a wider plan (up to 3 more passes). */
const TRAFFIC_REVISIT_DAYS = 3, TRAFFIC_PASSES = 3;

function answer(c: Ctx, day: number) {
  while (c.pending.length) {
    const id = c.pending.shift()!;
    const q = c.sim.world.politics.requests.find(r => r.id === id);
    if (q?.kind === 'trafficJam') c.traffic.push({ id, pass: 0 });
    answerRequest(c.sim, c.rec, id);
  }
  if (day % TRAFFIC_REVISIT_DAYS) return;
  c.traffic = c.traffic.filter(t => {
    const q = c.sim.world.politics.requests.find(r => r.id === t.id) as ({ x0: number; y0: number; x1: number; y1: number } | undefined);
    if (!q || t.pass >= TRAFFIC_PASSES) return false;
    answerTraffic(c.sim, c.rec, t.id, q, ++t.pass);
    return true;
  });
}

/** Bulldoze a block of homes and zone it again (it regrows later). */
function demolish(c: Ctx) {
  const w = c.sim.world, W = w.grid.width;
  let tiles: { x: number; y: number }[] = [];
  if (c.town) {
    const cands = c.town.built.filter(b => b.zone === ZONE_R).map(b => ({ b, n: c.town!.cellTiles(b).filter(t => isHome(w, w.grid.idx(t.x, t.y))).length })).filter(e => e.n >= 4);
    if (!cands.length) return;
    tiles = c.town.cellTiles(cands[Math.floor(c.rand() * cands.length)].b);
  } else {
    const hs: number[] = [];
    for (let i = 0; i < w.layers.zone.length; i++) if (isHome(w, i)) hs.push(i);
    if (!hs.length) return;
    const h = hs[Math.floor(c.rand() * hs.length)];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) tiles.push({ x: h % W + dx, y: Math.floor(h / W) + dy });
  }
  for (const t of tiles) if (isHome(w, w.grid.idx(t.x, t.y)) && c.rec.run(c.sim.history, new BulldozeCommand(t.x, t.y), 'bulldoze')) c.rec.run(c.sim.history, new PaintZoneCommand(t.x, t.y, ZONE_R), 'rezone');
}

export const PERSONAS: Persona[] = [
  { id: 'planner', desc: 'Grows steadily and puts services in ahead of demand; keeps one cheap ordinance.', fresh: true, save: true,
    day: (c, d) => { grow(c, d, 3); services(c, d); ordinanceHabits(c, d, 'neighbourhoodWatch'); } },
  { id: 'sprawler', desc: 'Builds a new block every other day, utilities only, never any services.', fresh: true, save: false,
    day: (c, d) => grow(c, d, 2) },
  { id: 'demolisher', desc: 'Plans like the Planner, but from day 40 bulldozes and rezones a block of homes every other day.', fresh: true, save: true,
    day: (c, d) => { grow(c, d, 3); services(c, d); ordinanceHabits(c, d, null); if (d >= 40 && d % 2 === 0) demolish(c); } },
  { id: 'neglecter', desc: 'Builds for 60 days, then stops: no services, no new utilities, no answers.', fresh: true, save: true,
    day: (c, d) => grow(c, d, 3, 60) },
  { id: 'chaser', desc: 'Grows steadily and answers every request: one service building on the lot that serves the asking homes (skipping ones no free lot could meet), a plant for a utilities shortage, avenues for a traffic jam, revisiting a jam that persists with a wider plan.', fresh: true, save: true,
    day: (c, d) => { grow(c, d, 3); answer(c, d); } },
  { id: 'industrialist', desc: 'An industry district behind a buffer of shops, power plants among the homes, and every 10 days industry painted inside a home block.', fresh: true, save: false,
    day: (c, d) => {
      grow(c, d, 3); services(c, d);
      if (d >= 30 && d % 10 === 0 && c.town) {
        const homesCell = c.town.built.filter(b => b.zone === ZONE_R)[d / 10 % 7];
        if (homesCell) { const m = c.town.cellMiddle(homesCell); c.rec.run(c.sim.history, new PaintZoneCommand(m.x, m.y, ZONE_I), 'industryNear'); }
      }
    } },
  { id: 'exploiter', desc: 'Plans like the Planner, and at days 90 and 180 (0 and 30 on a save) tries every known PC loop on a copy of the city.', fresh: true, save: true,
    day: (c, d) => {
      grow(c, d, 3); services(c, d);
      if (d === (c.town ? 90 : 0) || d === (c.town ? 180 : 30)) {
        const e = (c.extra.exploits ??= {}) as Record<string, unknown>;
        e['day' + d] = exploitLoops(c.sim.world);
      }
    } },
];

export interface PersonaRun { world: World; rec: Recorder; extra: Record<string, unknown> }

/** Play `days` game days of a persona on a world (fresh worlds get a Town). */
export function playPersona(p: Persona, world: World, fresh: boolean, days: number, opts: PersonaOptions = {}): PersonaRun {
  // PC suite: PC under test, not money, so every city (fresh or saved) gets plenty; the econ suite plays on the city's own money.
  if (!opts.realMoney) world.budget.money = Math.max(world.budget.money, 1e7);
  else if (fresh) world.budget.money = BALANCE.startingMoney;
  const sim = startSim(world);
  const rec = new Recorder(world);
  const town = fresh ? new Town(sim, rec, p.id === 'industrialist' ? {
    zoneOf: (cx, cy) => (cx >= 14 ? ZONE_I : cx >= 12 ? ZONE_C : (cx + cy) % 4 === 0 ? ZONE_C : ZONE_R),
    tagOf: z => (z === ZONE_I ? 'industryFar' : 'zone'),
    utilitiesInTown: true,
  } : {}) : null;
  const c: Ctx = { sim, rec, town, opts, extra: {}, pending: [], traffic: [], rand: lcg(world.seed ?? 7) };
  world.events.on('requestOpened', q => { if (CHASER_KINDS.includes(q.kind as string)) c.pending.push(q.id as number); });
  for (let d = 0; d < days; d++) {
    if (world.budget.gameOver) break;   // headless ticks would carry on after game over; the run ends there
    p.day(c, d);
    for (let k = 0; k < BALANCE.ticksPerDay; k++) { sim.tick(1); rec.afterTick(); }
  }
  return { world, rec, extra: c.extra };
}
