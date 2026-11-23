// Balance Lab study (ENGINEER 3, 2026-11-23): the vibe layers in 'legacy' and 'target' mode.
//   spread       the planner plays `days`: how far the layers move at developed tiles, the city's character,
//                and (target mode) how well the vibe traits agree with the identity proxies, cell by cell
//   persistence  a big park built on homes at day 0 (and, separately, a park bulldozed), nothing else done:
//                the green at that spot over `days`
// Run: node scripts/vibe-study.mjs spread|persist <city file|fresh> <days> <legacy|target>
import { BALANCE } from '../data/balance';
import type { World } from '../sim/World';
import { countsAsPark } from '../sim/leisure';
import { cellTraits } from '../sim/identity';
import { vibeTargets } from '../sim/vibeTargets';
import { freshWorld, loadSaveText, startSim } from './world';
import { playPersona, PERSONAS, type Persona } from './personas';

const setMode = (mode: string) => { (BALANCE.vibe as { mode: string }).mode = mode; };
const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };

function spreadOf(w: World) {
  const L = w.layers, axes = { egalitarian: L.vibeEgalitarian, green: L.vibeGreen, planned: L.vibePlanned } as const;
  const devd: number[] = [];
  for (let i = 0; i < L.zone.length; i++) if ((L.zone[i] && L.devLevel[i]) || L.building[i]) devd.push(i);
  const out: Record<string, unknown> = {};
  for (const [k, a] of Object.entries(axes)) {
    const v = devd.map(i => a[i] - 128);
    out[k] = { off8: Math.round(v.filter(x => Math.abs(x) > 8).length / Math.max(1, v.length) * 100) / 100, p10: q(v, 0.1), p50: q(v, 0.5), p90: q(v, 0.9) };
  }
  return out;
}

/** Spearman-style agreement: share of cell pairs ordered the same way by a vibe axis and by its proxy. */
function agreement(w: World) {
  const W = w.grid.width, cs = 12, cols = Math.ceil(W / cs), traits = cellTraits(w);
  const L = w.layers, res: Record<string, number | null> = {};
  for (const [axis, layer] of [['green', L.vibeGreen], ['planned', L.vibePlanned], ['egalitarian', L.vibeEgalitarian]] as const) {
    const pairs: [number, number][] = [];
    for (const [cell, t] of traits) {
      const x0 = (cell % cols) * cs, y0 = Math.floor(cell / cols) * cs;
      let s = 0, n = 0;
      for (let y = y0; y < Math.min(w.grid.height, y0 + cs); y++) for (let x = x0; x < Math.min(W, x0 + cs); x++) { s += layer[y * W + x]; n++; }
      pairs.push([s / n, t.raw[axis]]);
    }
    let same = 0, all = 0;
    for (let a = 0; a < pairs.length; a++) for (let b = a + 1; b < pairs.length; b++) {
      const d1 = pairs[a][0] - pairs[b][0], d2 = pairs[a][1] - pairs[b][1];
      if (d1 === 0 || d2 === 0) continue;
      all++; if (Math.sign(d1) === Math.sign(d2)) same++;
    }
    res[axis] = all ? Math.round(same / all * 100) / 100 : null;
  }
  return res;
}

export function vibeSpread(text: string | null, days: number, mode: string) {
  setMode(mode);
  const w = text ? loadSaveText(text) : freshWorld(128, 7);
  const t0 = Date.now();
  playPersona(PERSONAS.find(p => p.id === 'planner')!, w, text === null, days);
  return { mode, days, pop: w.stats.population, secs: Math.round((Date.now() - t0) / 1000), spread: spreadOf(w), character: { ...w.character }, agreement: agreement(w) };
}

export function vibePersist(text: string, days: number, mode: string) {
  setMode(mode);
  const w = loadSaveText(text), W = w.grid.width, H = w.grid.height, L = w.layers;
  startSim(w).tick(10 * BALANCE.ticksPerDay);
  // The greenest spot by what stands there (the same in either mode), then every tree and park within 6 tiles cleared.
  const goal = vibeTargets(w).green;
  let at = 0;
  for (let i = 0; i < goal.length; i++) if (goal[i] > goal[at]) at = i;
  const ax = at % W, ay = Math.floor(at / W), before = L.vibeGreen[at];
  const idle: Persona = { ...PERSONAS[0], day: () => {} };
  playPersona(idle, w, false, 30);                          // a month untouched first
  const steady = L.vibeGreen[at];
  for (let y = Math.max(0, ay - 6); y <= Math.min(H - 1, ay + 6); y++) for (let x = Math.max(0, ax - 6); x <= Math.min(W - 1, ax + 6); x++) {
    const j = y * W + x;
    L.vegetation[j] = 0;
    if (L.building[j] && countsAsPark(L.building[j])) w.clearTile(x, y);
  }
  w.grid.markAllDirty();
  const trace: number[] = [L.vibeGreen[at]];
  for (let d = 30; d <= days; d += 30) { playPersona(idle, w, false, 30); trace.push(L.vibeGreen[at]); }
  return { mode, at: [ax, ay], targetBefore: goal[at], greenAtLoad: before, afterAMonthUntouched: steady, targetAfterClearing: vibeTargets(w).green[at], greenEvery30DaysAfterClearing: trace };
}
