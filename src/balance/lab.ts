// Balance Lab: run personas × PC variants × cities, grade the targets, and
// return one self-describing report (see scripts/balance.mjs for the command).

import { BALANCE } from '../data/balance';
import { PC_VARIANTS } from '../ui/pcPresets';
import { applyValues } from '../ui/pcPresets';
import { TUNED_T } from './tunedT';
import { SVC_PRESETS, applySvcPreset, svcResult, addSvcPcProbes, type SvcPreset, type SvcResult } from './services';
import { ordinancesEnabled } from '../sim/ordinances';
import { loadCity, type CitySpec } from './world';
import { PERSONAS, playPersona, type PersonaId, type PersonaRun } from './personas';
import { staticProbes, refillProbe, type StaticProbes } from './probes';
import { TARGETS, type Outcome, type Suite, type EvalCtx } from './targets';
import { ECON_PRESETS } from '../ui/econPresets';

export const REPORT_SCHEMA = 'city-builder/balance-lab@2';

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
  /** Coverage requests skipped as unmeetable, and how many of those failed (left out of pc.request.chaser's share). */
  skipped: number;
  skippedFailed: number;
  milestoneRatios: number[];
  regenPerDayAt2k: number | null;
  regenPerDayLate: number;
  /** Ordinance upkeep scale (cap ÷ max, as the sim charges it) over the same days as regenPerDayAt2k / regenPerDayLate. */
  upkeepScaleAt2k: number | null;
  upkeepScaleLate: number;
  extra: Record<string, unknown>;
  /** Money: see EconSummary. */
  econ: EconSummary;
  /** Every 10th day: for charts. */
  series: { day: number; pc: number; cap: number; pop: number; sat: number; money: number; inc: number; exp: number }[];
}

export interface EconSummary {
  moneyStart: number;
  moneyEnd: number;
  /** Days with money below 0 before the city first had a police, fire, school and hospital (all of the run if it never did). */
  debtDaysBeforeServices: number;
  servicesCompleteDay: number | null;
  longestDebtRun: number;
  /** Mean over the last 30 days: income and expenses per day, and (income − expenses) ÷ expenses. */
  incomeLate: number;
  expensesLate: number;
  surplusLate: number;
  /** Money gained over the run ÷ expenses per day at the end (days of expenses banked). */
  gainInDaysOfExpenses: number;
  /** Tax multiplier that would put surplusLate in the middle of 10–25% (income scales with tax rates). */
  taxForMidSurplus: number | null;
}

export interface LabOptions {
  /** Which suites to run (default both). */
  suites?: Suite[];
  variants?: string[];          // PC suite: 'Off', 'A'..'D', 'T' (default: all)
  econPresets?: string[];       // economy suite: ids from ECON_PRESETS
  svcPresets?: string[];        // services suite: ids from SVC_PRESETS (src/balance/services.ts) or customSvcPresets
  /** Extra services presets by id (e.g. a reach / capacity sweep point). */
  customSvcPresets?: Record<string, SvcPreset>;
  cities: CitySpec[];
  personas?: PersonaId[];
  daysFresh?: number;
  daysSave?: number;
  /** Saved cities above this population are left out of the PC and services suites (big cities are slow). Default 20k. */
  pcMaxPopulation?: number;
  /** Extra PC number sets by id (e.g. the auto-tuner's 'T'), each a partial BALANCE.politicalCapital tree like a variant's. */
  customVariants?: Record<string, { name: string; desc: string; values: Record<string, unknown> }>;
  /** The previous report, for trends. */
  previous?: Report | null;
  log?: (line: string) => void;
}

export interface TargetResult extends Outcome { trend?: 'new' | 'same' | 'better' | 'worse' | 'fixed' | 'broke'; prev?: unknown }
/** The variant or preset passing the largest share of graded results; `tied` lists any with the same share. */
type Best = { variant: string; pass: number; of: number; tied: string[] };
type Summary = { pass: number; fail: number; na: number; later: number; failing: string[] };

export interface Report {
  schema: string;
  generatedAt: string;
  about: string;
  options: { suites: Suite[]; variants: string[]; econPresets: string[]; svcPresets: string[]; cities: string[]; personas: string[]; daysFresh: number; daysSave: number; pcMaxPopulation: number };
  variants: { id: string; name: string; desc: string }[];
  econPresets: { id: string; name: string; desc: string; values: Record<string, unknown> }[];
  personas: { id: string; desc: string }[];
  cities: { id: string; kind: string; population: number }[];
  targets: { id: string; suite: Suite; metric: string; target: string; persona: string; cities: string; why: string; status: string;
    results: Record<string, Record<string, TargetResult>> }[];
  /** PC suite, per variant. */
  summary: Record<string, Summary>;
  best: Best | null;
  /** Economy suite, per preset. */
  econSummary: Record<string, Summary>;
  econBest: Best | null;
  /** Plain-text answer: which preset gets closest, and whether a money sink is needed at scale. */
  econVerdict: string | null;
  /** Services suite, per capacity preset. */
  svcPresets: SvcPreset[];
  svcSummary: Record<string, Summary>;
  svcBest: Best | null;
  /** Services suite: seating and probes on the Planner's city, per preset and city. */
  svcRuns: Record<string, Record<string, SvcResult>>;
  runs: Record<string, Record<string, Record<string, RunSummary>>>;
  probes: Record<string, Record<string, { static: StaticProbes | null; refill: { days: number | null; avgSatisfaction: number } | null }>>;
  /** Economy suite: the real-money Planner, per preset and city. */
  econRuns: Record<string, Record<string, RunSummary>>;
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
    skipped: rec.skipped.size,
    skippedFailed: rec.skippedFailed,
    milestoneRatios: rec.milestoneRatios.map(r3),
    regenPerDayAt2k: near2k.length ? r3(near2k.reduce((s, d) => s + d.regen, 0) / near2k.length) : null,
    regenPerDayLate: late.length ? r3(late.reduce((s, d) => s + d.regen, 0) / late.length) : 0,
    upkeepScaleAt2k: near2k.length ? r3(near2k.reduce((s, d) => s + d.cap, 0) / near2k.length / BALANCE.politicalCapital.max) : null,
    upkeepScaleLate: late.length ? r3(late.reduce((s, d) => s + d.cap, 0) / late.length / BALANCE.politicalCapital.max) : 1,
    extra: JSON.parse(JSON.stringify(run.extra)),
    econ: econOf(run),
    series: ds.filter((_, k) => k % 10 === 9 || k === ds.length - 1).map(d => ({ day: d.day - ds[0].day + 1, pc: r3(d.pc), cap: r3(d.cap), pop: d.pop, sat: r3(d.sat), money: Math.round(d.money), inc: Math.round(d.inc), exp: Math.round(d.exp) })),
  };
}

function econOf(run: PersonaRun): EconSummary {
  const ds = run.rec.days;
  const until = run.rec.allServicesDay ?? ds.length;
  let longest = 0, cur = 0;
  for (const d of ds) { cur = d.money < 0 ? cur + 1 : 0; longest = Math.max(longest, cur); }
  const late = ds.slice(-30);
  const inc = late.reduce((s, d) => s + d.inc, 0) / Math.max(late.length, 1);
  const exp = late.reduce((s, d) => s + d.exp, 0) / Math.max(late.length, 1);
  const moneyStart = ds[0]?.money ?? 0, moneyEnd = ds.at(-1)?.money ?? 0;
  const expEnd = ds.at(-1)?.exp ?? 0;
  return {
    moneyStart: Math.round(moneyStart), moneyEnd: Math.round(moneyEnd),
    debtDaysBeforeServices: ds.slice(0, until).filter(d => d.money < 0).length,
    servicesCompleteDay: run.rec.allServicesDay,
    longestDebtRun: longest,
    incomeLate: Math.round(inc), expensesLate: Math.round(exp),
    surplusLate: exp > 0 ? r3((inc - exp) / exp) : 0,
    gainInDaysOfExpenses: expEnd > 0 ? r3((moneyEnd - moneyStart) / expEnd) : 0,
    taxForMidSurplus: inc > 0 ? r3((1.175 * exp) / inc) : null,
  };
}

function trendOf(now: Outcome, prev: TargetResult | undefined): TargetResult['trend'] {
  if (!prev) return 'new';
  if (now.pass !== prev.pass) return now.pass ? 'fixed' : prev.pass ? 'broke' : 'same';
  const a = now.miss ?? 0, b = prev.miss ?? 0;
  return Math.abs(a - b) < 1e-6 ? 'same' : a < b ? 'better' : 'worse';
}

export function runLab(o: LabOptions): Report {
  const suites = o.suites ?? ['pc', 'econ', 'svc'];
  const variants = suites.includes('pc') ? (o.variants ?? ['Off', 'A', 'B', 'C', 'D', 'T']) : [];
  // 'T' is the auto-tuner's current best (src/balance/tunedT.ts) unless the caller passes its own.
  o = { ...o, customVariants: { T: { name: 'Tuned', desc: 'The auto-tuner\'s current best PC numbers (src/balance/tunedT.ts).', values: TUNED_T }, ...o.customVariants } };
  const presets = suites.includes('econ') ? (o.econPresets ?? ECON_PRESETS.map(p => p.id)) : [];
  const svcPresetOf = (id: string): SvcPreset => o.customSvcPresets?.[id] ?? SVC_PRESETS.find(p => p.id === id)!;
  const svcIds = suites.includes('svc') ? (o.svcPresets ?? SVC_PRESETS.map(p => p.id)) : [];
  const personaIds = o.personas ?? PERSONAS.map(p => p.id);
  const daysFresh = o.daysFresh ?? 300, daysSave = o.daysSave ?? 150;
  const pcMaxPop = o.pcMaxPopulation ?? 20_000;
  const log = o.log ?? (() => {});
  const shippedPc = JSON.parse(JSON.stringify(BALANCE.politicalCapital));
  const shippedEcon = { maintenance: { ...BALANCE.maintenance }, tax: { ...BALANCE.tax } };
  const report: Report = {
    schema: REPORT_SCHEMA,
    generatedAt: new Date().toISOString(),
    about: 'Balance Lab: scripted players on the real sim, graded against the owner-approved targets (src/balance/targets.ts). Three suites: "pc" targets are graded per PC variant (results[variant][city]); "econ" targets per economy preset (results[preset][city]), with PC at the shipped numbers; "svc" targets per school / hospital capacity preset (results[preset][city]), PC and economy as shipped. Each result = { value, pass (null = not applicable), miss (distance outside the range), trend vs the previous run }.',
    options: { suites, variants, econPresets: presets, svcPresets: svcIds, cities: o.cities.map(c => c.id), personas: personaIds, daysFresh, daysSave, pcMaxPopulation: pcMaxPop },
    variants: variants.map(v => v === 'Off' ? { id: 'Off', name: 'Off (shipped)', desc: 'The shipped numbers: PC as it is on main today.' }
      : o.customVariants?.[v] ? { id: v, name: o.customVariants[v].name, desc: o.customVariants[v].desc }
      : (() => { const p = PC_VARIANTS.find(x => x.id === v)!; return { id: p.id, name: p.name, desc: p.desc }; })()),
    econPresets: presets.map(id => { const p = ECON_PRESETS.find(x => x.id === id)!; return { id: p.id, name: p.name, desc: p.desc, values: p.values }; }),
    personas: PERSONAS.filter(p => personaIds.includes(p.id)).map(p => ({ id: p.id, desc: p.desc })),
    cities: [],
    targets: TARGETS.filter(t => suites.includes(t.suite)).map(t => ({ id: t.id, suite: t.suite, metric: t.metric, target: t.target, persona: t.persona, cities: t.cities, why: t.why, status: t.status, results: {} })),
    summary: {},
    best: null,
    econSummary: {},
    econBest: null,
    econVerdict: null,
    svcPresets: svcIds.map(id => svcPresetOf(id)),
    svcSummary: {},
    svcBest: null,
    svcRuns: {},
    runs: {},
    probes: {},
    econRuns: {},
  };
  const population = new Map<string, number>();
  const popOf = (city: CitySpec) => { if (!population.has(city.id)) population.set(city.id, city.kind === 'fresh' ? 0 : loadCity(city).stats.population); return population.get(city.id)!; };
  const grade = (suite: Suite, key: string, city: CitySpec, ctx: Omit<EvalCtx, 'variant' | 'city' | 'cityKind'>) => {
    for (const t of report.targets) {
      if (t.suite !== suite) continue;
      const def = TARGETS.find(x => x.id === t.id)!;
      const out = def.evaluate({ ...ctx, variant: key, city: city.id, cityKind: city.kind === 'fresh' ? 'fresh' : 'save' });
      const prev = o.previous?.targets?.find(x => x.id === t.id)?.results[key]?.[city.id];
      (t.results[key] ??= {})[city.id] = { ...out, trend: trendOf(out, prev), ...(prev ? { prev: prev.value } : {}) };
    }
  };
  try {
    // ── PC suite ──
    for (const v of variants) {
      applyValues(BALANCE.politicalCapital as never, shippedPc);
      if (v !== 'Off') applyValues(BALANCE.politicalCapital as never, (o.customVariants?.[v]?.values ?? PC_VARIANTS.find(x => x.id === v)!.values) as never);
      const ordinancesOn = ordinancesEnabled();
      report.runs[v] = {}; report.probes[v] = {};
      for (const city of o.cities) {
        const fresh = city.kind === 'fresh';
        if (!fresh && popOf(city) > pcMaxPop) continue;
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
          log(`pc ${v} ${city.id} ${j.key}: pop ${run.world.stats.population}, PC ${runs[j.key].end.pc}/${runs[j.key].end.cap} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
        }
        // Probes: on the city as loaded (a save) or as the Planner left it (fresh).
        const probeWorld = fresh ? worlds.planner?.world : loadCity(city);
        const probes = probeWorld ? staticProbes(probeWorld) : null;
        const refill = worlds.planner ? refillProbe(worlds.planner.world) : null;
        if (fresh && worlds.planner) population.set(city.id, worlds.planner.world.stats.population);
        report.runs[v][city.id] = runs;
        report.probes[v][city.id] = { static: probes, refill };
        grade('pc', v, city, { runs, probes, refill, ordinancesOn });
      }
    }
    applyValues(BALANCE.politicalCapital as never, shippedPc);
    // ── Economy suite: the Planner on the city's own money, per preset ──
    for (const id of presets) {
      Object.assign(BALANCE.maintenance, shippedEcon.maintenance); Object.assign(BALANCE.tax, shippedEcon.tax);
      applyValues(BALANCE as never, ECON_PRESETS.find(p => p.id === id)!.values as never);
      report.econRuns[id] = {};
      for (const city of o.cities) {
        const fresh = city.kind === 'fresh';
        const t0 = Date.now();
        const run = playPersona(PERSONAS.find(p => p.id === 'planner')!, loadCity(city), fresh, fresh ? daysFresh : daysSave, { realMoney: true });
        const s = summarise('planner', run);
        if (fresh && !population.get(city.id)) population.set(city.id, run.world.stats.population);
        report.econRuns[id][city.id] = s;
        log(`econ ${id} ${city.id}: pop ${run.world.stats.population}, money ${s.econ.moneyStart} → ${s.econ.moneyEnd}, surplus ${s.econ.surplusLate} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
        grade('econ', id, city, { runs: { planner: s }, probes: null, refill: null, ordinancesOn: false });
      }
    }
    Object.assign(BALANCE.maintenance, shippedEcon.maintenance); Object.assign(BALANCE.tax, shippedEcon.tax);
    // ── Services suite: the Planner per capacity / reach preset, PC and economy as shipped ──
    for (const id of svcIds) {
      const restore = applySvcPreset(svcPresetOf(id));
      try {
        report.svcRuns[id] = {};
        for (const city of o.cities) {
          const fresh = city.kind === 'fresh';
          if (!fresh && popOf(city) > pcMaxPop) continue;
          const t0 = Date.now();
          const run = playPersona(PERSONAS.find(p => p.id === 'planner')!, loadCity(city), fresh, fresh ? daysFresh : daysSave);
          const svc = svcResult(run.world);
          // PC rule probes under the tuned PC numbers (shipped PC pays nothing).
          applyValues(BALANCE.politicalCapital as never, (o.customVariants?.T?.values ?? TUNED_T) as never);
          try { addSvcPcProbes(svc, run.world); } finally { applyValues(BALANCE.politicalCapital as never, shippedPc); }
          report.svcRuns[id][city.id] = svc;
          log(`svc ${id} ${city.id}: pop ${svc.population}, schools ${svc.kinds.school.buildings} (${Math.round(svc.kinds.school.seatedShare * 100)}% seated), hospitals ${svc.kinds.hospital.buildings} (${Math.round(svc.kinds.hospital.seatedShare * 100)}%) (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
          grade('svc', id, city, { runs: { planner: summarise('planner', run) }, probes: null, refill: null, ordinancesOn: false, svc });
        }
      } finally { restore(); }
    }
  } finally {
    applyValues(BALANCE.politicalCapital as never, shippedPc);
    Object.assign(BALANCE.maintenance, shippedEcon.maintenance); Object.assign(BALANCE.tax, shippedEcon.tax);
  }
  for (const c of o.cities) report.cities.push({ id: c.id, kind: c.kind, population: population.get(c.id) ?? popOf(c) });
  const summarize = (suite: Suite, keys: string[], into: Report['summary']) => {
    for (const k of keys) {
      const s = { pass: 0, fail: 0, na: 0, later: 0, failing: [] as string[] };
      for (const t of report.targets) {
        if (t.suite !== suite) continue;
        for (const [city, r] of Object.entries(t.results[k] ?? {})) {
          if (t.status === 'later') s.later++;
          else if (r.pass === null) s.na++;
          else if (r.pass) s.pass++;
          else { s.fail++; s.failing.push(`${t.id}@${city}`); }
        }
      }
      into[k] = s;
    }
    const ranked = keys.filter(k => k !== 'Off' && k !== 'shipped' && k !== 'off').map(k => ({ variant: k, pass: into[k].pass, of: into[k].pass + into[k].fail })).sort((a, b) => b.pass / Math.max(b.of, 1) - a.pass / Math.max(a.of, 1));
    if (!ranked.length) return null;
    const share = (x: { pass: number; of: number }) => x.pass / Math.max(x.of, 1);
    return { ...ranked[0], tied: ranked.slice(1).filter(x => share(x) === share(ranked[0])).map(x => x.variant) };
  };
  report.best = summarize('pc', variants, report.summary);
  report.econBest = summarize('econ', presets, report.econSummary);
  report.econVerdict = presets.length ? econVerdict(report) : null;
  report.svcBest = summarize('svc', svcIds, report.svcSummary);
  return report;
}

/**
 * Does any preset hit the mature-city surplus at scale while keeping the early
 * game out of long debt? If not, how big a tax change (a money sink, or the
 * tax-rate slider) the big cities would need.
 */
function econVerdict(r: Report): string {
  const big = r.cities.filter(c => c.kind === 'save' && c.population >= 40_000).map(c => c.id);
  const early = r.cities.filter(c => c.kind === 'fresh').map(c => c.id);
  const ok = (t: string, p: string, cities: string[]) => cities.every(c => r.targets.find(x => x.id === t)?.results[p]?.[c]?.pass !== false);
  const lines: string[] = [];
  for (const p of r.econPresets.map(x => x.id)) {
    const earlyOk = ok('econ.firstServices', p, early) && ok('econ.noSoftlock', p, early);
    const surplus = big.map(c => `${c} ${r.econRuns[p]?.[c]?.econ.surplusLate ?? '?'}`).join(', ');
    const tax = big.map(c => r.econRuns[p]?.[c]?.econ.taxForMidSurplus).filter((x): x is number => x !== null && x !== undefined);
    lines.push(`${p}: early game ${earlyOk ? 'ok' : 'NOT ok'}; mature surplus ${surplus || 'no big city'}${tax.length ? `; tax ×${Math.min(...tax)}–${Math.max(...tax)} would centre it` : ''}.`);
  }
  const fits = r.econPresets.map(x => x.id).filter(p => ok('econ.firstServices', p, early) && ok('econ.noSoftlock', p, early) && big.length > 0 && ok('econ.matureSurplus', p, big));
  const head = !big.length ? 'No big city (≥ 40k) in this run: run npm run gen-city first to judge scale.'
    : fits.length ? `Preset(s) meeting the early game and the mature surplus at scale: ${fits.join(', ')}. No money sink needed for these.`
    : 'No preset meets both the early game and the mature surplus at scale: a money sink (e.g. the tax-rate slider) is needed, or a blend with lower taxes at scale.';
  return [head, ...lines].join('\n');
}
