// Balance Lab: run personas × PC variants × cities, grade the targets, and
// return one self-describing report (see scripts/balance.mjs for the command).

import { BALANCE } from '../data/balance';
import { PC_VARIANTS } from '../ui/pcPresets';
import { applyValues } from '../ui/pcPresets';
import { ordinancesEnabled } from '../sim/ordinances';
import { loadCity, type CitySpec } from './world';
import { PERSONAS, playPersona, type PersonaId, type PersonaRun } from './personas';
import { staticProbes, refillProbe, type StaticProbes } from './probes';
import { TARGETS, type Outcome } from './targets';

export const REPORT_SCHEMA = 'city-builder/balance-lab@1';

export interface RunSummary {
  persona: string;
  days: number;
  end: { population: number; pc: number; cap: number; satisfaction: number; money: number };
  minPc: number;
  /** Mean of PC ÷ cap over all days. */
  pcShareMean: number;
  pcOverCapP95: number;
  firstZeroDay: number | null;
  shareBelow10AfterZero: number | null;
  refusedPcShare: number;
  pcByReason: Record<string, number>;
  tried: Record<string, number>;
  refused: Record<string, Record<string, number>>;
  requests: { opened: Record<string, number>; met: Record<string, number>; failed: Record<string, number> };
  answered: number;
  answeredMet: number;
  milestoneRatios: number[];
  regenPerDayAt2k: number | null;
  regenPerDayLate: number;
  extra: Record<string, unknown>;
  /** Every 10th day: for charts. */
  series: { day: number; pc: number; cap: number; pop: number; sat: number }[];
}

export interface LabOptions {
  variants?: string[];          // 'Off' and/or 'A'..'D'
  cities: CitySpec[];
  personas?: PersonaId[];
  daysFresh?: number;
  daysSave?: number;
  /** The previous report, for trends. */
  previous?: Report | null;
  log?: (line: string) => void;
}

export interface TargetResult extends Outcome { trend?: 'new' | 'same' | 'better' | 'worse' | 'fixed' | 'broke'; prev?: unknown }

export interface Report {
  schema: string;
  generatedAt: string;
  about: string;
  options: { variants: string[]; cities: string[]; personas: string[]; daysFresh: number; daysSave: number };
  variants: { id: string; name: string; desc: string }[];
  personas: { id: string; desc: string }[];
  cities: { id: string; kind: string; population: number }[];
  targets: { id: string; metric: string; target: string; persona: string; cities: string; why: string; status: string;
    results: Record<string, Record<string, TargetResult>> }[];
  summary: Record<string, { pass: number; fail: number; na: number; later: number; failing: string[] }>;
  best: { variant: string; pass: number; of: number } | null;
  runs: Record<string, Record<string, Record<string, RunSummary>>>;
  probes: Record<string, Record<string, { static: StaticProbes | null; refill: { days: number | null; avgSatisfaction: number } | null }>>;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const roundAll = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, r3(v)]));

export function summarise(personaKey: string, run: PersonaRun): RunSummary {
  const { rec, world } = run;
  const ds = rec.days;
  const ratios = ds.map(d => d.pc / Math.max(d.cap, 1e-9)).sort((a, b) => a - b);
  const zeroAt = ds.findIndex(d => d.pc <= 0);
  const after = zeroAt >= 0 ? ds.slice(zeroAt) : [];
  const near2k = ds.filter(d => d.pop >= 1500 && d.pop <= 2500);
  const late = ds.slice(-30);
  const tried = rec.triedTotal();
  return {
    persona: personaKey,
    days: ds.length,
    end: { population: world.stats.population, pc: r3(world.budget.politicalCapital), cap: r3(ds.at(-1)?.cap ?? 0), satisfaction: r3(world.stats.satisfaction), money: Math.round(world.budget.money) },
    minPc: r3(Math.min(...ds.map(d => d.pc))),
    pcShareMean: r3(ratios.reduce((a, b) => a + b, 0) / Math.max(ratios.length, 1)),
    pcOverCapP95: r3(ratios[Math.min(ratios.length - 1, Math.floor(0.95 * ratios.length))] ?? 0),
    firstZeroDay: zeroAt >= 0 ? ds[zeroAt].day - ds[0].day + 1 : null,
    shareBelow10AfterZero: after.length ? r3(after.filter(d => d.pc < 0.1 * d.cap).length / after.length) : null,
    refusedPcShare: tried ? r3(rec.refusedFor('politicalCapital') / tried) : 0,
    pcByReason: roundAll(rec.pcByReason),
    tried: { ...rec.tried },
    refused: JSON.parse(JSON.stringify(rec.refused)),
    requests: JSON.parse(JSON.stringify(rec.requests)),
    answered: rec.answered.size,
    answeredMet: rec.answeredMet,
    milestoneRatios: rec.milestoneRatios.map(r3),
    regenPerDayAt2k: near2k.length ? r3(near2k.reduce((s, d) => s + d.regen, 0) / near2k.length) : null,
    regenPerDayLate: late.length ? r3(late.reduce((s, d) => s + d.regen, 0) / late.length) : 0,
    extra: JSON.parse(JSON.stringify(run.extra)),
    series: ds.filter((_, k) => k % 10 === 9 || k === ds.length - 1).map(d => ({ day: d.day - ds[0].day + 1, pc: r3(d.pc), cap: r3(d.cap), pop: d.pop, sat: r3(d.sat) })),
  };
}

function trendOf(now: Outcome, prev: TargetResult | undefined): TargetResult['trend'] {
  if (!prev) return 'new';
  if (now.pass !== prev.pass) return now.pass ? 'fixed' : prev.pass ? 'broke' : 'same';
  const a = now.miss ?? 0, b = prev.miss ?? 0;
  return Math.abs(a - b) < 1e-6 ? 'same' : a < b ? 'better' : 'worse';
}

export function runLab(o: LabOptions): Report {
  const variants = o.variants ?? ['Off', 'A', 'B', 'C', 'D'];
  const personaIds = o.personas ?? PERSONAS.map(p => p.id);
  const daysFresh = o.daysFresh ?? 300, daysSave = o.daysSave ?? 150;
  const log = o.log ?? (() => {});
  const shipped = JSON.parse(JSON.stringify(BALANCE.politicalCapital));
  const report: Report = {
    schema: REPORT_SCHEMA,
    generatedAt: new Date().toISOString(),
    about: 'Balance Lab: scripted players on the real sim, graded against the owner-approved targets (src/balance/targets.ts). Per target: results[variant][city] = { value, pass (null = not applicable), miss (distance outside the range), trend vs the previous run }.',
    options: { variants, cities: o.cities.map(c => c.id), personas: personaIds, daysFresh, daysSave },
    variants: variants.map(v => v === 'Off' ? { id: 'Off', name: 'Off (shipped)', desc: 'The shipped numbers: PC as it is on main today.' } : (() => { const p = PC_VARIANTS.find(x => x.id === v)!; return { id: p.id, name: p.name, desc: p.desc }; })()),
    personas: PERSONAS.filter(p => personaIds.includes(p.id)).map(p => ({ id: p.id, desc: p.desc })),
    cities: [],
    targets: TARGETS.map(t => ({ id: t.id, metric: t.metric, target: t.target, persona: t.persona, cities: t.cities, why: t.why, status: t.status, results: {} })),
    summary: {},
    best: null,
    runs: {},
    probes: {},
  };
  try {
    for (const v of variants) {
      applyValues(BALANCE.politicalCapital as never, shipped);
      if (v !== 'Off') applyValues(BALANCE.politicalCapital as never, PC_VARIANTS.find(x => x.id === v)!.values as never);
      const ordinancesOn = ordinancesEnabled();
      report.runs[v] = {}; report.probes[v] = {};
      for (const city of o.cities) {
        const fresh = city.kind === 'fresh';
        const days = fresh ? daysFresh : daysSave;
        const runs: Record<string, RunSummary> = {};
        const worlds: Record<string, PersonaRun> = {};
        const jobs: { key: string; id: PersonaId; eminent: boolean }[] = [];
        for (const p of PERSONAS) if (personaIds.includes(p.id) && (fresh ? p.fresh : p.save)) jobs.push({ key: p.id, id: p.id, eminent: false });
        if (ordinancesOn) for (const id of ['planner', 'demolisher'] as PersonaId[]) if (jobs.some(j => j.id === id)) jobs.push({ key: id + '+eminent', id, eminent: true });
        for (const j of jobs) {
          const t0 = Date.now();
          const run = playPersona(PERSONAS.find(p => p.id === j.id)!, loadCity(city), fresh, days, { ordinances: j.eminent ? 'eminent' : 'auto' });
          worlds[j.key] = run;
          runs[j.key] = summarise(j.key, run);
          log(`${v} ${city.id} ${j.key}: pop ${run.world.stats.population}, PC ${runs[j.key].end.pc}/${runs[j.key].end.cap} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
        }
        // Probes: on the city as loaded (a save) or as the Planner left it (fresh).
        const probeWorld = fresh ? worlds.planner?.world : loadCity(city);
        const probes = probeWorld ? staticProbes(probeWorld) : null;
        const refill = worlds.planner ? refillProbe(worlds.planner.world) : null;
        if (!report.cities.some(c => c.id === city.id)) report.cities.push({ id: city.id, kind: city.kind, population: fresh ? (worlds.planner?.world.stats.population ?? 0) : loadCity(city).stats.population });
        report.runs[v][city.id] = runs;
        report.probes[v][city.id] = { static: probes, refill };
        for (const [k, t] of TARGETS.entries()) {
          const out = t.evaluate({ variant: v, city: city.id, cityKind: fresh ? 'fresh' : 'save', runs, probes, refill, ordinancesOn });
          const prev = o.previous?.targets.find(x => x.id === t.id)?.results[v]?.[city.id];
          (report.targets[k].results[v] ??= {})[city.id] = { ...out, trend: trendOf(out, prev), ...(prev ? { prev: prev.value } : {}) };
        }
      }
    }
  } finally {
    applyValues(BALANCE.politicalCapital as never, shipped);
  }
  for (const v of variants) {
    const s = { pass: 0, fail: 0, na: 0, later: 0, failing: [] as string[] };
    for (const t of report.targets) for (const [city, r] of Object.entries(t.results[v] ?? {})) {
      if (t.status === 'later') s.later++;
      else if (r.pass === null) s.na++;
      else if (r.pass) s.pass++;
      else { s.fail++; s.failing.push(`${t.id}@${city}`); }
    }
    report.summary[v] = s;
  }
  const ranked = variants.filter(v => v !== 'Off').map(v => ({ variant: v, pass: report.summary[v].pass, of: report.summary[v].pass + report.summary[v].fail })).sort((a, b) => b.pass / Math.max(b.of, 1) - a.pass / Math.max(a.of, 1));
  report.best = ranked[0] ?? null;
  return report;
}
