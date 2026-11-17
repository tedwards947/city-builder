// Balance Lab auto-tuner: a deterministic steepest-descent search over the PC keys
// the variants set, scored by the PC targets. It proposes numbers; it never
// changes the game. See scripts/balance-tune.mjs.

import { VARIANT_VALUES } from '../ui/pcVariantValues';
import { runLab, type Report } from './lab';
import type { CitySpec } from './world';

/** A PC number set in the shape of VARIANT_VALUES[x] (applied with applyValues). */
export type ValueTree = Record<string, unknown>;
type Tree = ValueTree;

/** A lever: one or more keys moved together (a group keeps their ratios). */
export interface Param {
  id: string;
  paths: string[];
  /** 'mult': scale by a factor; 'add': step by `step`, clamped to [min, max]. */
  mode: 'mult' | 'add';
  step?: number;
  min?: number;
  max?: number;
  integer?: boolean;
}

const KINDS = ['park', 'school', 'hospital', 'police', 'fire', 'utilities', 'trafficJam', 'blight'];
const ORDS = ['neighbourhoodWatch', 'curfew', 'cleanAirAct', 'businessIncentives', 'freeTransit', 'fastTrackPermits', 'heritageProtection'];

export const PARAMS: Param[] = [
  { id: 'max', paths: ['max'], mode: 'mult', min: 50, integer: true },
  { id: 'capPerResident', paths: ['capPerResident'], mode: 'mult' },
  { id: 'neutralSatisfaction', paths: ['neutralSatisfaction'], mode: 'add', step: 0.05, min: 0, max: 0.95 },
  { id: 'satisfactionRegenBonus', paths: ['satisfactionRegenBonus'], mode: 'mult' },
  { id: 'bulldozePerPop', paths: ['disruptionCosts.bulldozePerPop'], mode: 'mult' },
  { id: 'industrialNuisance', paths: ['nuisance.industrialPerResident'], mode: 'mult' },
  { id: 'buildingNuisance', paths: ['nuisance.buildingPerResident.1', 'nuisance.buildingPerResident.3'], mode: 'mult' },
  { id: 'servicePerResident', paths: [4, 5, 6, 7, 8].map(k => `service.perResident.${k}`), mode: 'mult' },
  { id: 'hospitalPerResident', paths: ['service.perResident.7'], mode: 'mult' },
  { id: 'repeatFactor', paths: ['service.repeatFactor'], mode: 'add', step: 0.1, min: 0, max: 1 },
  { id: 'closureMultiplier', paths: ['service.closureMultiplier'], mode: 'mult', min: 1 },
  { id: 'milestoneRewards', paths: [0, 1, 2, 3, 4, 5].map(k => `milestones.${k}.reward`), mode: 'mult', integer: true },
  { id: 'requestRewards', paths: KINDS.map(k => `requests.kinds.${k}.reward`), mode: 'mult' },
  { id: 'requestPenalties', paths: KINDS.map(k => `requests.kinds.${k}.penalty`), mode: 'mult' },
  { id: 'requestDays', paths: KINDS.map(k => `requests.kinds.${k}.days`), mode: 'mult', min: 5, integer: true },
  { id: 'requestSpawnDays', paths: ['requests.spawnEveryDays'], mode: 'mult', min: 3, integer: true },
  { id: 'overCapFade', paths: ['overCapFadePerDay'], mode: 'add', step: 0.01, min: 0, max: 0.2 },
  { id: 'ordinanceUpkeep', paths: ORDS.map(k => `ordinances.${k}.dailyUpkeep`), mode: 'mult' },
  { id: 'ordinanceEnact', paths: [...ORDS, 'eminentDomain'].map(k => `ordinances.${k}.enactCost`), mode: 'mult', integer: true },
  { id: 'eminentUpkeep', paths: ['ordinances.eminentDomain.dailyUpkeep'], mode: 'mult' },
  { id: 'eminentDiscount', paths: ['ordinances.eminentDomain.modifiers.displacementCost'], mode: 'add', step: 0.1, min: 0.1, max: 0.9 },
];

function getAt(t: Tree, path: string): number | undefined {
  let o: unknown = t;
  for (const k of path.split('.')) { if (o === null || typeof o !== 'object') return undefined; o = (o as Tree)[k]; }
  return typeof o === 'number' ? o : undefined;
}
function setAt(t: Tree, path: string, v: number) {
  const ks = path.split('.');
  let o = t as Tree;
  for (const k of ks.slice(0, -1)) o = o[k] as Tree;
  o[ks[ks.length - 1]] = v;
}
const sig = (v: number) => (v === 0 ? 0 : Number(v.toPrecision(3)));

/** The tree with one lever moved one step in `dir` (±1) at `level` (a factor for 'mult', a step multiplier for 'add'); null if nothing changes. */
export function move(t: Tree, p: Param, dir: 1 | -1, level: number): Tree | null {
  const out = JSON.parse(JSON.stringify(t)) as Tree;
  let changed = false;
  for (const path of p.paths) {
    const v = getAt(out, path);
    if (v === undefined) continue;
    let n = p.mode === 'mult' ? (dir > 0 ? v * level : v / level) : v + dir * (p.step ?? 0.1) * level;
    if (p.min !== undefined) n = Math.max(p.min, n);
    if (p.max !== undefined) n = Math.min(p.max, n);
    n = p.integer ? Math.round(n) : sig(n);
    if (n !== v) { setAt(out, path, n); changed = true; }
  }
  return changed ? out : null;
}

export interface Eval { score: number; pass: number; graded: number; results: Record<string, boolean>; values: Tree }

/** Score a PC number set: each failing graded result costs 1 + its miss (capped at 3); lower is better. */
export function evaluate(values: Tree, cities: CitySpec[], days: number): Eval {
  const r: Report = runLab({ suites: ['pc'], variants: ['T'], customVariants: { T: { name: 'Tuned', desc: '', values } }, cities, daysFresh: days, daysSave: Math.min(days, 150) });
  let score = 0, pass = 0, graded = 0;
  const results: Record<string, boolean> = {};
  for (const t of r.targets) {
    if (t.status !== 'graded') continue;
    for (const [city, o] of Object.entries(t.results.T ?? {})) {
      if (o.pass === null) continue;
      graded++;
      results[`${t.id}@${city}`] = o.pass;
      if (o.pass) pass++; else score += 1 + Math.min(o.miss ?? 1, 3);
    }
  }
  return { score: Math.round(score * 1000) / 1000, pass, graded, results, values };
}

export interface TuneResult {
  start: string;
  evals: number;
  startEval: Omit<Eval, 'values'>;
  best: Eval;
  /** Every target@city that passed in at least one evaluated set, with the fewest other results lost at such a set. */
  passedSomewhere: Record<string, { lostElsewhere: string[] }>;
  steps: { param: string; dir: number; level: number; score: number; pass: number }[];
}

/** Scores many number sets; results in input order. One process: `localEvaluator`; many: scripts/balance-pool.mjs. */
export type EvaluateMany = (trees: ValueTree[]) => Promise<Eval[]>;

export const localEvaluator = (cities: CitySpec[], days: number): EvaluateMany =>
  async trees => trees.map(t => evaluate(t, cities, days));

/** Step size per refinement level: a factor for 'mult' levers, a multiple of `step` for 'add' levers. */
const LEVELS: { mult: number; add: number }[] = [{ mult: 1.5, add: 1 }, { mult: 1.25, add: 0.5 }, { mult: 1.1, add: 0.25 }];

/**
 * Steepest-descent search from a variant's numbers: each round scores every
 * lever moved one step up and down (one batch, so it runs in parallel), keeps
 * the best move if it lowers the score, and refines the step when none does.
 * Deterministic whatever the evaluator's worker count: ties go to the first
 * candidate in PARAMS order.
 */
export async function tune(start: 'A' | 'B' | 'C' | 'D', evaluateMany: EvaluateMany, opts: { budget?: number; log?: (l: string) => void } = {}): Promise<TuneResult> {
  const budget = opts.budget ?? 150, log = opts.log ?? (() => {});
  const startValues = JSON.parse(JSON.stringify(VARIANT_VALUES[start])) as Tree;
  let [best] = await evaluateMany([startValues]);
  const startEval = { score: best.score, pass: best.pass, graded: best.graded, results: best.results };
  let evals = 1;
  const seen: Eval[] = [best];
  const steps: TuneResult['steps'] = [];
  log(`${start}: start score ${best.score}, ${best.pass}/${best.graded}`);
  for (const level of LEVELS) {
    while (evals < budget) {
      const cands: { p: Param; dir: 1 | -1; values: Tree }[] = [];
      for (const p of PARAMS) for (const dir of [1, -1] as const) {
        const values = move(best.values, p, dir, p.mode === 'mult' ? level.mult : level.add);
        if (values) cands.push({ p, dir, values });
      }
      const batch = cands.slice(0, budget - evals);
      if (!batch.length) break;
      const es = await evaluateMany(batch.map(c => c.values));
      evals += es.length; seen.push(...es);
      let k = -1;
      es.forEach((e, i) => { if (e.score < (k < 0 ? best.score - 1e-9 : es[k].score)) k = i; });
      if (k < 0) break;
      best = es[k];
      const { p, dir } = batch[k];
      steps.push({ param: p.id, dir, level: level.mult, score: best.score, pass: best.pass });
      log(`${start}: ${p.id} ${dir > 0 ? 'up' : 'down'} ×${level.mult} → score ${best.score}, ${best.pass}/${best.graded} (eval ${evals})`);
    }
  }
  const passedSomewhere: TuneResult['passedSomewhere'] = {};
  for (const e of seen) for (const [k, ok] of Object.entries(e.results)) {
    if (!ok) continue;
    const lost = Object.entries(best.results).filter(([kk, b]) => b && e.results[kk] === false).map(([kk]) => kk);
    if (!passedSomewhere[k] || lost.length < passedSomewhere[k].lostElsewhere.length) passedSomewhere[k] = { lostElsewhere: lost };
  }
  return { start, evals, startEval, best, passedSomewhere, steps };
}

/** Keys whose value differs between two trees, as path → [from, to]. */
export function diff(a: Tree, b: Tree, prefix = ''): Record<string, [unknown, unknown]> {
  const out: Record<string, [unknown, unknown]> = {};
  for (const k of new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])) {
    const x = (a ?? {})[k], y = (b ?? {})[k], p = prefix ? `${prefix}.${k}` : k;
    if (x && y && typeof x === 'object' && typeof y === 'object') Object.assign(out, diff(x as Tree, y as Tree, p));
    else if (JSON.stringify(x) !== JSON.stringify(y)) out[p] = [x, y];
  }
  return out;
}
