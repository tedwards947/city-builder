// Balance Lab study (ENGINEER 3, 2026-11-22; docs/PC_OUTCOMES.md): local trust prototype, slice 2.
// Local trust on, the city gate off, each cell sized to `displacements` displacements. A persona plays; with
// `area`, it also redevelops one neighbourhood: from day `areaFrom` to `areaTo`, every other day it bulldozes
// a home (and its 3×3 neighbours that are homes) inside the cell with the most homes and rezones them, then
// stops, and the run goes on so the cell can recover.
// Run: node scripts/trust-study.mjs <persona> <city file|fresh> <days> <displacements> <area 0|1>
import { BALANCE } from '../data/balance';
import { chargeQuote, pcCap, pcQuote } from '../sim/politics';
import { BUILDING_POWER_PLANT } from '../sim/constants';
import { cellCap, cellTrust, lastLocalBlock, localTrustCells, trustCell } from '../sim/localTrust';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { PaintZoneCommand } from '../commands/PaintZoneCommand';
import { cloneWorld, freshWorld, loadSaveText, startSim } from './world';
import { playPersona, PERSONAS, type Persona } from './personas';
import { isHome, ZONE_R } from './town';
import type { World } from '../sim/World';

/** The cell with the most homes. */
function busiestCell(w: World): number {
  const n = new Map<number, number>(), W = w.grid.width;
  for (let i = 0; i < w.layers.zone.length; i++) if (isHome(w, i)) { const c = trustCell(w, i % W, Math.floor(i / W)); n.set(c, (n.get(c) ?? 0) + 1); }
  let best = -1, most = 0;
  for (const [c, k] of n) if (k > most) { most = k; best = c; }
  return best;
}

type LT = { enabled: boolean; cityGate: boolean; displacements: number; spill: number; regenMult: number; homeShare: number; refillDays: number };
/** Play-feel sizing for every run when set (homeShare > 0): see playFeel(). */
let feel: { homeShare: number; refillDays: number } | null = null;
const setTrust = (displacements: number, spill: number, regenMult = 1) => {
  const lt = (BALANCE.politicalCapital as unknown as { localTrust: LT }).localTrust;
  lt.enabled = true; lt.cityGate = false; lt.displacements = displacements; lt.spill = spill; lt.regenMult = regenMult;
  lt.homeShare = feel?.homeShare ?? 0; lt.refillDays = feel?.refillDays ?? 0;
};
/** Use the play-feel sizing (a share of the cell's homes, a straight refill) in the runs that follow. */
export function playFeel(homeShare: number, refillDays: number): void { feel = homeShare > 0 ? { homeShare, refillDays } : null; }

/** Home lots (a merged lot once), as anchor tiles. */
function homeLots(w: World, inCell: number | null): number[] {
  const W = w.grid.width, seen = new Set<number>(), out: number[] = [];
  for (let i = 0; i < w.layers.zone.length; i++) {
    if (!isHome(w, i) || seen.has(i)) continue;
    if (inCell !== null && trustCell(w, i % W, Math.floor(i / W)) !== inCell) continue;
    const lot = w.lotTilesAt(i);
    for (const j of lot.length ? lot : [i]) seen.add(j);
    out.push(i);
  }
  return out;
}

/**
 * The owner's playtest, by hand: (1) in the busiest neighbourhood, bulldoze home lots one by one (nearest its middle
 * first) until one is refused, then let days pass and see when a third and all of its trust are back; (2) a spree:
 * home lots across the whole city in a random order, no time passing, and how much is cleared at the first refusal
 * and at most.
 */
export function handStudy(text: string, spill: number, which: 'busiest' | 'median' = 'busiest', maxDays = 90) {
  setTrust(0, spill);
  const w0 = loadSaveText(text), D = BALANCE.ticksPerDay;
  startSim(w0).tick(2 * D);
  const W = w0.grid.width;
  let cell = busiestCell(w0);
  if (which === 'median') {
    // The neighbourhood of median size among those with at least 10 home lots.
    const counts = new Map<number, number>();
    for (const i of homeLots(w0, null)) { const c = trustCell(w0, i % W, Math.floor(i / W)); counts.set(c, (counts.get(c) ?? 0) + 1); }
    const ranked = [...counts.entries()].filter(([, n]) => n >= 10).sort((a, b) => a[1] - b[1]);
    if (ranked.length) cell = ranked[ranked.length >> 1][0];
  }
  // (1) one neighbourhood
  const w = cloneWorld(w0), cap0 = cellCap(w, cell, pcCap(w));
  const mid = { x: (cell % Math.ceil(W / 12)) * 12 + 6, y: Math.floor(cell / Math.ceil(W / 12)) * 12 + 6 };
  const lots = homeLots(w, cell).sort((a, b) => (Math.abs(a % W - mid.x) + Math.abs(Math.floor(a / W) - mid.y)) - (Math.abs(b % W - mid.x) + Math.abs(Math.floor(b / W) - mid.y)));
  let cleared = 0, refusedAt: number | null = null;
  for (const i of lots) {
    const cmd = new BulldozeCommand(i % W, Math.floor(i / W));
    if (cmd.execute(w)) cleared++;
    else if (cmd.failReason === 'politicalCapital') { refusedAt = cleared; break; }
  }
  const sim = startSim(w);
  let third: number | null = null, full: number | null = null, oneMore: number | null = null;
  const nextLot = homeLots(w, cell)[0];
  for (let d = 1; d <= maxDays && full === null; d++) {
    sim.tick(D);
    const cap = pcCap(w), share = cellTrust(w, cell, cap) / cellCap(w, cell, cap);
    if (third === null && share >= 1 / 3) third = d;
    if (full === null && share >= 0.99) full = d;
    if (oneMore === null && nextLot !== undefined && pcQuote(w, { type: 'bulldoze', tx: nextLot % W, ty: Math.floor(nextLot / W) }).affordable) oneMore = d;
  }
  // (2) a spree across the city
  const ws = cloneWorld(w0), all = homeLots(ws, null);
  let r = 99991;
  const rnd = () => (r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  for (let k = all.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [all[k], all[j]] = [all[j], all[k]]; }
  let done = 0, firstRefusal: number | null = null, firstWhy: unknown = null;
  for (const i of all) {
    const cmd = new BulldozeCommand(i % W, Math.floor(i / W));
    if (cmd.execute(ws)) done++;
    else if (cmd.failReason === 'politicalCapital' && firstRefusal === null) {
      firstRefusal = done;
      const q = pcQuote(ws, { type: 'bulldoze', tx: i % W, ty: Math.floor(i / W) }), cap = pcCap(ws);
      const c = trustCell(ws, i % W, Math.floor(i / W));
      firstWhy = { at: [i % W, Math.floor(i / W)], cost: Math.round(q.cost), reasons: [...new Set(q.parts.map(p => p.reason))], have: Math.round(cellTrust(ws, c, cap)), cap: Math.round(cellCap(ws, c, cap)), lot: ws.lotTilesAt(i).length, partCells: [...new Set(q.parts.map(p => trustCell(ws, p.tx, p.ty)))].length };
    }
  }
  return {
    pop: w0.stats.population, cellLots: lots.length, cellCap: Math.round(cap0),
    oneCell: { cleared, refusedAfter: refusedAt, shareOfLots: lots.length ? Math.round(cleared / lots.length * 100) / 100 : null, daysToThird: third, daysToFull: full, daysToOneMore: oneMore },
    spree: { lots: all.length, firstRefusalAt: firstRefusal, firstRefusalShare: firstRefusal !== null ? Math.round(firstRefusal / all.length * 100) / 100 : null, maxClearedShare: Math.round(done / all.length * 100) / 100, firstWhy },
  };
}

/**
 * One-off big builds on the city as loaded: up to `n` power plants, each on a free lot beside homes with a road,
 * placed one after another (each charged, so later ones see the trust earlier ones used). How many would be refused.
 */
export function bigBuilds(text: string, displacements: number, spill: number, n = 5, regenMult = 1) {
  setTrust(displacements, spill, regenMult);
  const w = loadSaveText(text), W = w.grid.width, H = w.grid.height, L = w.layers;
  startSim(w).tick(2 * BALANCE.ticksPerDay);
  const results: { refused: boolean; local: boolean; cost: number; need?: number; have?: number; cap?: number; fresh?: boolean }[] = [];
  const used: { x: number; y: number }[] = [];
  for (let y = 2; y < H - 2 && results.length < n; y += 3) for (let x = 2; x < W - 2 && results.length < n; x += 3) {
    if (used.some(u => Math.abs(u.x - x) + Math.abs(u.y - y) < 20)) continue;
    let homes = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (isHome(w, (y + dy) * W + x + dx)) homes++;
    if (homes < 6 || !w.canPlaceBuilding(x, y, BUILDING_POWER_PLANT)) continue;
    if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => L.roadClass[(y + dy) * W + x + dx] !== 0)) continue;
    const q = pcQuote(w, { type: 'building', tx: x, ty: y, kind: BUILDING_POWER_PLANT });
    const blk = !q.affordable ? lastLocalBlock(w) : null;
    results.push({ refused: !q.affordable, local: q.localBlocked === true, cost: Math.round(q.cost), ...(blk ? { need: Math.round(blk.need), have: Math.round(blk.have), cap: Math.round(cellCap(w, blk.cell, pcCap(w))), fresh: blk.have >= cellCap(w, blk.cell, pcCap(w)) - 1 } : {}) });
    if (q.affordable && w.placeBuilding(x, y, BUILDING_POWER_PLANT)) chargeQuote(w, q, x, y);
    used.push({ x, y });
  }
  return { displacements, spill, tried: results.length, refused: results.filter(r => r.refused).length, costs: results.map(r => r.cost), blocked: results.filter(r => r.refused) };
}

export function trustStudy(personaId: string, text: string | null, days: number, displacements: number, area: boolean, areaFrom = 10, areaTo = 120, spill = 0, regenMult = 1) {
  setTrust(displacements, spill, regenMult);
  const w = text ? loadSaveText(text) : freshWorld(128, 7);
  const base = PERSONAS.find(p => p.id === personaId)!;
  let target = -1, firstRefusal: number | null = null, recovered: number | null = null;
  const trace: number[] = [];
  let rand = 12345;
  const next = () => (rand = (Math.imul(rand, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const p: Persona = { ...base, day: (c, d) => {
    base.day(c, d);
    const ww = c.sim.world, cap = pcCap(ww), W = ww.grid.width;
    if (area && d === areaFrom) target = busiestCell(ww);
    if (target >= 0) {
      const share = cellTrust(ww, target, cap) / cellCap(ww, target, cap);
      trace.push(Math.round(share * 100) / 100);
      if (d > areaTo && recovered === null && share >= 0.99) recovered = d - areaTo;
    }
    if (!area || target < 0 || d < areaFrom || d > areaTo || d % 2) return;
    const homes: number[] = [];
    for (let i = 0; i < ww.layers.zone.length; i++) if (isHome(ww, i) && trustCell(ww, i % W, Math.floor(i / W)) === target) homes.push(i);
    if (!homes.length) return;
    const h = homes[Math.floor(next() * homes.length)];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = h % W + dx, y = Math.floor(h / W) + dy;
      if (!isHome(ww, y * W + x) || trustCell(ww, x, y) !== target) continue;
      if (c.rec.run(c.sim.history, new BulldozeCommand(x, y), 'areaBulldoze')) c.rec.run(c.sim.history, new PaintZoneCommand(x, y, ZONE_R), 'areaRezone');
      else if (firstRefusal === null) firstRefusal = d;
    }
  } };
  const run = playPersona(p, w, text === null, days);
  const rec = run.rec, cap = pcCap(w);
  const cells = localTrustCells(w, cap).filter(x => x.residents >= 40 && x.cell !== target);
  const shares = cells.map(x => x.trust / x.cap).sort((a, b) => a - b);
  const areaTried = rec.triedTotal(['areaBulldoze']), areaRefused = rec.refusedFor('politicalCapital', ['areaBulldoze']);
  return {
    persona: personaId, displacements, spill, areaBot: area, days: rec.days.length, pop: w.stats.population,
    targetCap: target >= 0 ? Math.round(cellCap(w, target, cap)) : null,
    area: area ? { tried: areaTried, refused: areaRefused, refusedShare: areaTried ? Math.round(areaRefused / areaTried * 100) / 100 : null, firstRefusalDay: firstRefusal, recoveredDaysAfterStop: recovered, minShare: trace.length ? Math.min(...trace) : null, traceEvery10: trace.filter((_, k) => k % 10 === 0) } : null,
    otherRefused: rec.refusedFor('politicalCapital') - areaRefused,
    otherTried: rec.triedTotal() - areaTried - rec.triedTotal(['areaRezone']),
    otherByTag: Object.fromEntries(Object.entries(rec.refused).filter(([t]) => t !== 'areaBulldoze').map(([t, r]) => [t, r.politicalCapital ?? 0]).filter(([, v]) => (v as number) > 0)),
    otherCellsP10: shares.length ? Math.round(shares[Math.floor(0.1 * shares.length)] * 100) / 100 : null,
    cityPcEnd: Math.round(w.budget.politicalCapital), cityCap: Math.round(cap),
  };
}
