// Balance Lab: run personas × PC variants × cities, grade the targets, and
// return one self-describing report (see scripts/balance.mjs for the command).

import { BALANCE } from '../data/balance';
import { PC_VARIANTS } from '../ui/pcPresets';
import { applyValues } from '../ui/pcPresets';
import { TUNED_T } from './tunedT';
import { PC_OFF } from '../data/pcOff';
import { SVC_PRESETS, applySvcPreset, svcResult, addSvcPcProbes, type SvcPreset, type SvcResult } from './services';
import { TRADE_PRESETS, applyTradeValues, tradeResult, type TradePreset, type TradeResult } from './trade';
import { airportResult, type AirportResult } from './airport';
import { railResult, railFresh, type RailResult, type RailFresh } from './rail';
import { landscapeResult, treeBufferResult, type LandscapeResult } from './landscape';
import { lotsResult, type LotsResult } from './lots';
import { stadiumResult, type StadiumResult, type StadiumRun } from './stadium';
import { leisureResult, type LeisureResult } from './leisure';
import { connectionsResult, type ConnectionsResult } from './connections';
import { paceResult } from './pace';
import { TAXDEBT_PRESETS, applyTaxDebtValues, taxDebtResult, type TaxDebtPreset, type TaxDebtResult } from './taxdebt';
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
  /** The city-wide tax level (the slider, BALANCE.tax.level) that would do the same: the run's level × taxForMidSurplus. */
  taxLevelForMidSurplus: number | null;
  /** Day of game over for debt, or null. */
  gameOverDay: number | null;
}

export interface LabOptions {
  /** Which suites to run (default both). */
  suites?: Suite[];
  variants?: string[];          // PC suite: 'Off', 'A'..'D', 'T' (default: all)
  econPresets?: string[];       // economy suite: ids from ECON_PRESETS
  svcPresets?: string[];        // services suite: ids from SVC_PRESETS (src/balance/services.ts) or customSvcPresets
  /** Extra services presets by id (e.g. a reach / capacity sweep point). */
  customSvcPresets?: Record<string, SvcPreset>;
  tradePresets?: string[];      // trade suite: ids from TRADE_PRESETS (src/balance/trade.ts) or customTradePresets
  customTradePresets?: Record<string, TradePreset>;
  taxDebtPresets?: string[];    // debt / tax suite: ids from TAXDEBT_PRESETS (src/balance/taxdebt.ts) or customTaxDebtPresets
  customTaxDebtPresets?: Record<string, TaxDebtPreset>;
  cities: CitySpec[];
  personas?: PersonaId[];
  daysFresh?: number;
  daysSave?: number;
  /** Saved cities above this population are left out of the PC and services suites (big cities are slow). Default 20k. */
  pcMaxPopulation?: number;
  /** Saved cities above this population are left out of the 2×2 lots suite (3 × 360-day runs each). Default 40k. */
  lotsMaxPopulation?: number;
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
  options: { suites: Suite[]; variants: string[]; econPresets: string[]; svcPresets: string[]; tradePresets: string[]; taxDebtPresets: string[]; cities: string[]; personas: string[]; daysFresh: number; daysSave: number; pcMaxPopulation: number };
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
  tradePresets: TradePreset[];
  tradeSummary: Record<string, Summary>;
  tradeBest: Best | null;
  tradeRuns: Record<string, Record<string, TradeResult>>;
  taxDebtPresets: TaxDebtPreset[];
  taxDebtSummary: Record<string, Summary>;
  taxDebtBest: Best | null;
  taxDebtRuns: Record<string, Record<string, TaxDebtResult>>;
  /** Airport suite: the shipped numbers only (key 'shipped'). */
  airportSummary: Record<string, Summary>;
  airportBest: Best | null;
  airportRuns: Record<string, Record<string, AirportResult>>;
  /** Rail suite: the shipped numbers only (key 'shipped'); a RailFresh on fresh maps. */
  railSummary: Record<string, Summary>;
  railBest: Best | null;
  railRuns: Record<string, Record<string, RailResult | RailFresh>>;
  /** Landscape suite: the shipped numbers only (key 'shipped'); fresh maps hold the tree-belt probe. */
  landscapeSummary: Record<string, Summary>;
  landscapeBest: Best | null;
  landscapeRuns: Record<string, Record<string, LandscapeResult | { treeBuffer: number | null }>>;
  /** 2×2 lots suite: the shipped numbers only (key 'shipped'); saved cities only. */
  lotsSummary: Record<string, Summary>;
  lotsBest: Best | null;
  lotsRuns: Record<string, Record<string, LotsResult>>;
  /** Stadium suite: the shipped numbers only (key 'shipped'); saved cities only. */
  stadiumSummary: Record<string, Summary>;
  stadiumBest: Best | null;
  stadiumRuns: Record<string, Record<string, StadiumResult>>;
  /** Leisure suite: the shipped numbers only (key 'shipped'); saved cities only. */
  leisureSummary: Record<string, Summary>;
  leisureBest: Best | null;
  leisureRuns: Record<string, Record<string, LeisureResult>>;
  connectionsSummary: Record<string, Summary>;
  connectionsBest: Best | null;
  connectionsRuns: Record<string, Record<string, ConnectionsResult>>;
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
    taxLevelForMidSurplus: inc > 0 ? Math.round(run.world.budget.taxLevel * (1.175 * exp) / inc * 10) / 10 : null,
    gameOverDay: run.rec.gameOverDay,
  };
}

function trendOf(now: Outcome, prev: TargetResult | undefined): TargetResult['trend'] {
  if (!prev) return 'new';
  if (now.pass !== prev.pass) return now.pass ? 'fixed' : prev.pass ? 'broke' : 'same';
  const a = now.miss ?? 0, b = prev.miss ?? 0;
  return Math.abs(a - b) < 1e-6 ? 'same' : a < b ? 'better' : 'worse';
}

export function runLab(o: LabOptions): Report {
  const suites = o.suites ?? ['pc', 'econ', 'svc', 'trade', 'taxdebt', 'airport', 'rail', 'landscape', 'lots', 'stadium', 'leisure', 'connections'];
  const variants = suites.includes('pc') ? (o.variants ?? ['Off', 'A', 'B', 'C', 'D', 'T']) : [];
  // 'T' is the auto-tuner's current best (src/balance/tunedT.ts) unless the caller passes its own.
  o = { ...o, customVariants: { T: { name: 'Tuned', desc: 'The auto-tuner\'s current best PC numbers (src/balance/tunedT.ts).', values: TUNED_T }, ...o.customVariants } };
  // 'tight' is the shipped numbers spelled out (since #184), so the default list leaves it out.
  const presets = suites.includes('econ') ? (o.econPresets ?? ECON_PRESETS.map(p => p.id).filter(id => id !== 'tight')) : [];
  const svcPresetOf = (id: string): SvcPreset => o.customSvcPresets?.[id] ?? SVC_PRESETS.find(p => p.id === id)!;
  const svcIds = suites.includes('svc') ? (o.svcPresets ?? SVC_PRESETS.map(p => p.id)) : [];
  const tradePresetOf = (id: string): TradePreset => o.customTradePresets?.[id] ?? TRADE_PRESETS.find(p => p.id === id)!;
  const tradeIds = suites.includes('trade') ? (o.tradePresets ?? TRADE_PRESETS.map(p => p.id)) : [];
  const taxDebtPresetOf = (id: string): TaxDebtPreset => o.customTaxDebtPresets?.[id] ?? TAXDEBT_PRESETS.find(p => p.id === id)!;
  const taxDebtIds = suites.includes('taxdebt') ? (o.taxDebtPresets ?? TAXDEBT_PRESETS.map(p => p.id)) : [];
  const airportIds = suites.includes('airport') ? ['shipped'] : [];
  const railIds = suites.includes('rail') ? ['shipped'] : [];
  const landscapeIds = suites.includes('landscape') ? ['shipped'] : [];
  const lotsIds = suites.includes('lots') ? ['shipped'] : [];
  const stadiumIds = suites.includes('stadium') ? ['shipped'] : [];
  const leisureIds = suites.includes('leisure') ? ['shipped'] : [];
  const connectionsIds = suites.includes('connections') ? ['shipped'] : [];
  const personaIds = o.personas ?? PERSONAS.map(p => p.id);
  const daysFresh = o.daysFresh ?? 300, daysSave = o.daysSave ?? 150;
  const pcMaxPop = o.pcMaxPopulation ?? 20_000;
  const log = o.log ?? (() => {});
  const shippedPc = JSON.parse(JSON.stringify(BALANCE.politicalCapital));
  const shippedEcon = { maintenance: { ...BALANCE.maintenance }, tax: { ...BALANCE.tax, level: { ...BALANCE.tax.level } }, budget: { ...BALANCE.budget } };
  const report: Report = {
    schema: REPORT_SCHEMA,
    generatedAt: new Date().toISOString(),
    about: 'Balance Lab: scripted players on the real sim, graded against the owner-approved targets (src/balance/targets.ts). Three suites: "pc" targets are graded per PC variant (results[variant][city]); "econ" targets per economy preset (results[preset][city]; "shipped" is Tight since 2026-11-17, "original" the numbers before), with PC at the shipped numbers; "svc" targets per school / hospital capacity preset (results[preset][city]), PC and economy as shipped; "trade" targets per seaport / goods preset (results[preset][city]), probes on each saved city as it stands; "taxdebt" targets per debt-drain / tax-level preset (results[preset][city]), the real-money Planner at several tax levels plus debt probes under the tuned PC numbers; "airport" targets under the shipped numbers (results.shipped[city]), the airport built on each saved city against a twin without it; "rail" targets under the shipped numbers (results.shipped[city]), a suburb joined to each saved city by a long street and one line against a street-only twin, and a real-money Planner\'s bank on fresh maps; "landscape" targets under the shipped numbers (results.shipped[city]), tree, green-vibe and water probes on each saved city, and a tree-belt probe on a made-up map graded on fresh maps; "lots" targets under the shipped numbers (results.shipped[city]), 2×2 merge runs (3 seeds × 360 days, the save\'s own merged lots undone first) and a capacity probe on each saved city up to 40k residents. Each result = { value, pass (null = not applicable), miss (distance outside the range), trend vs the previous run }.',
    options: { suites, variants, econPresets: presets, svcPresets: svcIds, tradePresets: tradeIds, taxDebtPresets: taxDebtIds, cities: o.cities.map(c => c.id), personas: personaIds, daysFresh, daysSave, pcMaxPopulation: pcMaxPop },
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
    tradePresets: tradeIds.map(id => tradePresetOf(id)),
    tradeSummary: {},
    tradeBest: null,
    tradeRuns: {},
    taxDebtPresets: taxDebtIds.map(id => taxDebtPresetOf(id)),
    taxDebtSummary: {},
    taxDebtBest: null,
    airportSummary: {},
    airportBest: null,
    airportRuns: {},
    railSummary: {},
    railBest: null,
    railRuns: {},
    landscapeSummary: {},
    landscapeBest: null,
    landscapeRuns: {},
    lotsSummary: {},
    lotsBest: null,
    lotsRuns: {},
    stadiumSummary: {},
    stadiumBest: null,
    stadiumRuns: {},
    leisureSummary: {},
    leisureBest: null,
    leisureRuns: {},
    connectionsSummary: {},
    connectionsBest: null,
    connectionsRuns: {},
    taxDebtRuns: {},
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
      applyValues(BALANCE.politicalCapital as never, structuredClone(PC_OFF) as never); // Off = PC effects at 0; the shipped numbers are T
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
      Object.assign(BALANCE.maintenance, shippedEcon.maintenance); Object.assign(BALANCE.tax, shippedEcon.tax, { level: { ...shippedEcon.tax.level } }); Object.assign(BALANCE.budget, shippedEcon.budget);
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
        // The mid-game pacing probe (econ.fixCost): saved cities, shipped numbers only.
        const pace = !fresh && id === 'shipped' ? paceResult(loadCity(city)) : null;
        if (pace) log(`econ ${id} ${city.id}: pace at neutral tax ${pace.surplusPerResident}/resident, costs ${pace.costShare} of income, police +${pace.police.more}, fire +${pace.fire.more}, fix ${pace.fixDays ?? '-'} days`);
        grade('econ', id, city, { runs: { planner: s }, probes: null, refill: null, ordinancesOn: false, pace });
      }
    }
    Object.assign(BALANCE.maintenance, shippedEcon.maintenance); Object.assign(BALANCE.tax, shippedEcon.tax, { level: { ...shippedEcon.tax.level } }); Object.assign(BALANCE.budget, shippedEcon.budget);
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
    // ── Trade suite: seaport and goods probes on each saved city as it stands (a fresh map has no coast) ──
    for (const id of tradeIds) {
      const restore = applyTradeValues(tradePresetOf(id).values);
      try {
        report.tradeRuns[id] = {};
        for (const city of o.cities) {
          if (city.kind === 'fresh' || popOf(city) > pcMaxPop) continue;
          const t0 = Date.now();
          const trade = tradeResult(loadCity(city));
          report.tradeRuns[id][city.id] = trade;
          log(`trade ${id} ${city.id}: shortage ${trade.shortage}, heavy ${trade.heavy?.shortage ?? '-'}, payback ${trade.port?.paybackDays ?? '-'} days (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
          grade('trade', id, city, { runs: {}, probes: null, refill: null, ordinancesOn: false, trade });
        }
      } finally { restore(); }
    }
    // ── Debt / tax suite: the real-money Planner at several tax levels, and the debt drain under the tuned PC numbers ──
    for (const id of taxDebtIds) {
      const restore = applyTaxDebtValues(taxDebtPresetOf(id).values);
      try {
        report.taxDebtRuns[id] = {};
        for (const city of o.cities) {
          if (city.kind !== 'fresh' && popOf(city) > pcMaxPop) continue;
          const t0 = Date.now();
          const td = taxDebtResult(city, daysFresh, daysSave, o.customVariants?.T?.values ?? TUNED_T);
          report.taxDebtRuns[id][city.id] = td;
          log(`taxdebt ${id} ${city.id}: drain ${td.drain.share ?? '-'}, squeeze ${td.squeeze?.ratio ?? '-'}, levels ${Object.values(td.levels).map(r => `${r.level}:${r.popEnd}/${r.incomeLate}`).join(' ')} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
          grade('taxdebt', id, city, { runs: {}, probes: null, refill: null, ordinancesOn: false, taxdebt: td });
        }
      } finally { restore(); }
    }
    // ── Airport suite: the airport on each saved city, 60 days against a twin, shipped numbers ──
    for (const id of airportIds) {
      applyValues(BALANCE.politicalCapital as never, shippedPc);
      report.airportRuns[id] = {};
      for (const city of o.cities) {
        if (city.kind === 'fresh' || popOf(city) > pcMaxPop) continue;
        const t0 = Date.now();
        const a = airportResult(loadCity(city));
        report.airportRuns[id][city.id] = a;
        log(`airport ${id} ${city.id}: seats ${a.seats ?? '-'}, payback ${a.paybackDays ?? '-'} days, demand ${a.demandGain ?? '-'}, jam ${a.frontJam ?? '-'}${a.note ? ` (${a.note})` : ''} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
        grade('airport', id, city, { runs: {}, probes: null, refill: null, ordinancesOn: false, airport: a });
      }
    }
    // ── Rail suite: a suburb on each saved city (180 days against a street-only twin); the Planner's bank on fresh maps ──
    for (const id of railIds) {
      applyValues(BALANCE.politicalCapital as never, shippedPc);
      report.railRuns[id] = {};
      for (const city of o.cities) {
        if (city.kind !== 'fresh' && popOf(city) > pcMaxPop) continue;
        const t0 = Date.now();
        if (city.kind === 'fresh') {
          const f = railFresh(city.size, city.seed);
          report.railRuns[id][city.id] = f;
          log(`rail ${id} ${city.id}: bank ${f.bank180} at day 180, ${f.bank360} at 360; starter line ${f.starterCost}; crossing busy +${(f.crossing.busy * 100).toFixed(1)}% (road ${f.crossing.busyRoad}), quiet +${(f.crossing.quiet * 100).toFixed(1)}% (road ${f.crossing.quietRoad}) (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
          grade('rail', id, city, { runs: {}, probes: null, refill: null, ordinancesOn: false, railFresh: f });
        } else {
          const r = railResult(loadCity(city));
          report.railRuns[id][city.id] = r;
          log(`rail ${id} ${city.id}: access ${r.suburbAccess ?? '-'}/${r.cityAccess ?? '-'} (street ${r.streetAccess ?? '-'}), levels ${r.railLevels ?? '-'} vs ${r.streetLevels ?? '-'}, lines ${r.oneLine ?? '-'}→${r.twoLines ?? '-'}, pays ${r.pays ?? '-'}, nuisance ${r.nuisance?.groundBars ?? '-'} bars (${r.nuisance?.homes ?? 0} homes), station growth ${r.stationGrowth?.sooner ?? '-'}${r.note ? ` (${r.note})` : ''} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
          grade('rail', id, city, { runs: {}, probes: null, refill: null, ordinancesOn: false, rail: r });
        }
      }
    }
    // ── Landscape suite: tree, vibe and water probes on each saved city; the tree belt on fresh maps ──
    for (const id of landscapeIds) {
      applyValues(BALANCE.politicalCapital as never, shippedPc);
      report.landscapeRuns[id] = {};
      let buffer: number | null | undefined;
      for (const city of o.cities) {
        if (city.kind !== 'fresh' && popOf(city) > pcMaxPop) continue;
        const t0 = Date.now();
        if (city.kind === 'fresh') {
          if (buffer === undefined) buffer = treeBufferResult();
          report.landscapeRuns[id][city.id] = { treeBuffer: buffer };
          log(`landscape ${id} ${city.id}: tree belt ${buffer ?? '-'} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
          grade('landscape', id, city, { runs: {}, probes: null, refill: null, ordinancesOn: false, treeBuffer: buffer });
        } else {
          const l = landscapeResult(loadCity(city));
          report.landscapeRuns[id][city.id] = l;
          log(`landscape ${id} ${city.id}: tree home +${l.treeHome ?? '-'}, payback ${l.payback.days ?? '-'} days (${l.payback.homes} homes), shock ${l.shock ?? '-'}, spam ${l.spam.gain ?? '-'} / ${l.spam.priceDays ?? '-'} days, green ${l.green.parks ?? '-'} parks, canal ${l.canalDays ?? '-'} days, reclaim ${l.reclaimShare ?? '-'}${l.note ? ` (${l.note})` : ''} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
          grade('landscape', id, city, { runs: {}, probes: null, refill: null, ordinancesOn: false, landscape: l });
        }
      }
    }
    // ── 2×2 lots suite: merge runs and the capacity probe on each saved city ──
    const lotsMaxPop = o.lotsMaxPopulation ?? 40_000;
    for (const id of lotsIds) {
      applyValues(BALANCE.politicalCapital as never, shippedPc);
      report.lotsRuns[id] = {};
      for (const city of o.cities) {
        if (city.kind === 'fresh' || popOf(city) > lotsMaxPop) continue;
        const t0 = Date.now();
        const l = lotsResult(loadCity(city));
        report.lotsRuns[id][city.id] = l;
        const g = l.homesShops, i = l.industry;
        log(`lots ${id} ${city.id}: homes+shops first ${g.firstMean ?? '-'} (${g.first.map(d => d ?? '-').join('/')}), by 90 ${g.by90}, by ${l.days} ${g.byEnd}, edge ${g.edgeShare ?? '-'}, 16×16 ${g.maxWindow}; industry by 90 ${i.by90}, by ${l.days} ${i.byEnd}, edge ${i.edgeShare ?? '-'}; shop pairs first ${l.pairs.firstMean ?? '-'}, by 90 ${l.pairs.by90}, by ${l.days} ${l.pairs.byEnd}; capacity ${l.capacity.map(k => `${k.zone}${k.shape === 'square' ? '' : 'p'}:${k.weight}/${k.trips ?? '-'}`).join(' ')}${l.undone ? `; ${l.undone} merged lots undone` : ''} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
        grade('lots', id, city, { runs: {}, probes: null, refill: null, ordinancesOn: false, lots: l });
      }
    }
    // ── Stadium suite: three events as is, with avenues and prepared, on each saved city ──
    for (const id of stadiumIds) {
      applyValues(BALANCE.politicalCapital as never, shippedPc);
      report.stadiumRuns[id] = {};
      for (const city of o.cities) {
        if (city.kind === 'fresh') continue;
        const t0 = Date.now();
        const s = stadiumResult(loadCity(city));
        report.stadiumRuns[id][city.id] = s;
        const fmt = (r: StadiumRun) => `fans ${r.wantedShare}× seats (filled ${r.fill}), stuck ${r.stuckShare}, smooth ${r.smooth}/${r.events.length}, PC −${r.pcLoss} +${r.pcReward} of cap an event, ${r.declined} homes down, ${r.netPerDay ?? '-'} a day`;
        const one = s.oneLine;
        log(`stadium ${id} ${city.id}: ${s.asBuilt ? `as built ${fmt(s.asBuilt)}; one line ${one && 'events' in one ? `(${one.line} tiles) ${fmt(one)}` : one?.note ?? '-'}` : s.note} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
        grade('stadium', id, city, { runs: {}, probes: null, refill: null, ordinancesOn: false, stadium: s });
      }
    }
    // ── Leisure suite: museum, leisure need and tourism on each saved city ──
    for (const id of leisureIds) {
      applyValues(BALANCE.politicalCapital as never, shippedPc);
      report.leisureRuns[id] = {};
      for (const city of o.cities) {
        if (city.kind === 'fresh') continue;
        const t0 = Date.now();
        const l = leisureResult(loadCity(city));
        report.leisureRuns[id][city.id] = l;
        const m = l.museum, t = l.tourism;
        log(`leisure ${id} ${city.id}: museum ${m?.paybackDays ?? '-'} days (${m?.netPerDay ?? '-'} a day); need ${l.need.lacking ?? '-'} of ${l.need.homes} homes lacking; tourism ${t?.share ?? '-'} (${t?.income ?? '-'} a day)${l.note ? ` (${l.note})` : ''} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
        grade('leisure', id, city, { runs: {}, probes: null, refill: null, ordinancesOn: false, leisure: l });
      }
    }
    // ── Connections suite: highway and rail points joined on copies of each saved city ──
    for (const id of connectionsIds) {
      applyValues(BALANCE.politicalCapital as never, shippedPc);
      report.connectionsRuns[id] = {};
      for (const city of o.cities) {
        if (city.kind === 'fresh') continue;
        const t0 = Date.now();
        const r = connectionsResult(loadCity(city));
        report.connectionsRuns[id][city.id] = r;
        const hw = (h: { meetsClass: number; meetBefore: number; meetPeak: number }) => `road ${h.meetsClass} ${h.meetBefore}→${h.meetPeak}`;
        const rl = r.rail && 'inPerTick' in r.rail ? `rail ${r.rail.inPerTick} in, track ${r.rail.trackPeak}, jammed ${r.rail.jammedBefore}→${r.rail.jammedAfter}` : `rail: ${r.rail?.note ?? '-'}`;
        log(`connections ${id} ${city.id}: ${r.note ?? `one ${r.one ? `${hw(r.one)}, $${r.one.exportIncomePerDay} exports` : '-'}; two ${r.two ? `${hw(r.two[0])} / ${hw(r.two[1])}` : '-'}; industry ${r.industry ? `${r.industry.base}→${r.industry.one}` : '-'}; ${rl}`} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
        grade('connections', id, city, { runs: {}, probes: null, refill: null, ordinancesOn: false, connections: r });
      }
    }
  } finally {
    applyValues(BALANCE.politicalCapital as never, shippedPc);
    Object.assign(BALANCE.maintenance, shippedEcon.maintenance); Object.assign(BALANCE.tax, shippedEcon.tax, { level: { ...shippedEcon.tax.level } }); Object.assign(BALANCE.budget, shippedEcon.budget);
  }
  for (const c of o.cities) report.cities.push({ id: c.id, kind: c.kind, population: population.get(c.id) ?? popOf(c) });
  finishReport(report, {
    pc: variants, econ: presets, svc: svcIds, trade: tradeIds, taxdebt: taxDebtIds, airport: airportIds,
    rail: railIds, landscape: landscapeIds, lots: lotsIds, stadium: stadiumIds, leisure: leisureIds, connections: connectionsIds,
  });
  return report;
}

/** Where each suite's summary and best live in the report. */
const SUMMARY_FIELDS: Record<Suite, [keyof Report, keyof Report]> = {
  pc: ['summary', 'best'], econ: ['econSummary', 'econBest'], svc: ['svcSummary', 'svcBest'], trade: ['tradeSummary', 'tradeBest'],
  taxdebt: ['taxDebtSummary', 'taxDebtBest'], airport: ['airportSummary', 'airportBest'], rail: ['railSummary', 'railBest'],
  landscape: ['landscapeSummary', 'landscapeBest'], lots: ['lotsSummary', 'lotsBest'], stadium: ['stadiumSummary', 'stadiumBest'],
  leisure: ['leisureSummary', 'leisureBest'], connections: ['connectionsSummary', 'connectionsBest'],
};

/** Count pass / fail / n/a per suite and key (variant or preset), pick each suite's best, and the economy verdict. */
function finishReport(report: Report, keys: Partial<Record<Suite, string[]>>): void {
  const summarize = (suite: Suite, ks: string[], into: Report['summary']) => {
    for (const k of ks) {
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
    const ranked = ks.filter(k => k !== 'Off' && k !== 'original').map(k => ({ variant: k, pass: into[k].pass, of: into[k].pass + into[k].fail })).sort((a, b) => b.pass / Math.max(b.of, 1) - a.pass / Math.max(a.of, 1));
    if (!ranked.length) return null;
    const share = (x: { pass: number; of: number }) => x.pass / Math.max(x.of, 1);
    return { ...ranked[0], tied: ranked.slice(1).filter(x => share(x) === share(ranked[0])).map(x => x.variant) };
  };
  const r = report as unknown as Record<string, unknown>;
  for (const [suite, [sumKey, bestKey]] of Object.entries(SUMMARY_FIELDS) as [Suite, [string, string]][]) {
    const into = (r[sumKey] ??= {}) as Report['summary'];
    r[bestKey] = summarize(suite, keys[suite] ?? [], into);
  }
  report.econVerdict = (keys.econ ?? []).length ? econVerdict(report) : null;
}

const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
/** `into` with everything in `from` added, recursing through plain objects (leaves from `from` win). */
function deepMerge(into: Record<string, unknown>, from: Record<string, unknown>): Record<string, unknown> {
  for (const [k, v] of Object.entries(from)) into[k] = isPlain(v) && isPlain(into[k]) ? deepMerge(into[k] as Record<string, unknown>, v) : v;
  return into;
}

/**
 * One report from several that each ran some suites on some cities (npm run
 * balance -- --jobs N runs one child per suite and city): runs, results and
 * cities joined, the targets in TARGETS order, summaries counted again.
 */
export function mergeReports(parts: Report[]): Report {
  if (!parts.length) throw new Error('nothing to merge');
  const out = JSON.parse(JSON.stringify(parts[0])) as Report;
  const byId = new Map(out.targets.map(t => [t.id, t]));
  const ids = (xs: { id: string }[]) => new Set(xs.map(x => x.id));
  const bag = out as unknown as Record<string, Record<string, unknown>>;
  for (const p of parts.slice(1)) {
    for (const [k, v] of Object.entries(p)) {
      if (k.endsWith('Runs') || k === 'runs' || k === 'probes') deepMerge((bag[k] ??= {}), v as Record<string, unknown>);
    }
    for (const t of p.targets) {
      const have = byId.get(t.id);
      if (have) deepMerge(have.results as Record<string, unknown>, t.results as Record<string, unknown>);
      else byId.set(t.id, JSON.parse(JSON.stringify(t)));
    }
    const cities = ids(out.cities);
    for (const c of p.cities) if (!cities.has(c.id)) out.cities.push(c);
    for (const key of ['variants', 'econPresets', 'personas'] as const) {
      const list = out[key] as { id: string }[], have = ids(list);
      for (const x of p[key] as { id: string }[]) if (!have.has(x.id)) list.push(x);
    }
  }
  out.targets = TARGETS.filter(t => byId.has(t.id)).map(t => byId.get(t.id)!);
  out.options.suites = [...new Set(parts.flatMap(p => p.options.suites))];
  out.options.cities = out.cities.map(c => c.id);
  const keys: Partial<Record<Suite, string[]>> = {};
  for (const [suite, [sumKey]] of Object.entries(SUMMARY_FIELDS) as [Suite, [keyof Report, keyof Report]][])
    keys[suite] = [...new Set(parts.flatMap(p => Object.keys((p[sumKey] ?? {}) as object)))];
  finishReport(out, keys);
  return out;
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
    const label = r.econPresets.find(x => x.id === p)?.name ?? p;
    const lvl = big.map(c => r.econRuns[p]?.[c]?.econ.taxLevelForMidSurplus).filter((x): x is number => x !== null && x !== undefined);
    const { min, max } = BALANCE.tax.level;
    const slider = lvl.length ? `, tax level ${Math.min(...lvl)}–${Math.max(...lvl)} on the slider (${min}–${max}${lvl.every(x => x >= min && x <= max) ? ', within reach' : ', OUT of range'})` : '';
    lines.push(`${label}: early game ${earlyOk ? 'ok' : 'NOT ok'}; mature surplus ${surplus || 'no big city'}${tax.length ? `; tax ×${Math.min(...tax)}–${Math.max(...tax)}${slider} would centre it` : ''}.`);
  }
  const fits = r.econPresets.map(x => x.id).filter(p => ok('econ.firstServices', p, early) && ok('econ.noSoftlock', p, early) && big.length > 0 && ok('econ.matureSurplus', p, big));
  const head = !big.length ? 'No big city (≥ 40k) in this run: run npm run gen-city first to judge scale.'
    : fits.length ? `Preset(s) meeting the early game and the mature surplus at scale: ${fits.join(', ')}. No money sink needed for these.`
    : 'No preset meets both the early game and the mature surplus at scale: a money sink (e.g. the tax-rate slider) is needed, or a blend with lower taxes at scale.';
  return [head, ...lines].join('\n');
}
