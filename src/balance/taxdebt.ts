// Balance Lab: the debt PC drain and the city-wide tax level (sim/debt.ts, sim/tax.ts).
// Not part of the game. Targets debt.pcDrain, debt.squeeze, tax.high, tax.low and
// tax.noDominant (owner-approved 2026-11-17) read the result of taxDebtResult().
//
// Probes, all with the Planner on the city's own money:
//   drain     a city held at half its debt limit (in debt, never past the limit) for the
//             30-day grace period, from a full cap: PC lost to the drain ÷ cap.
//   squeeze   fresh town only: twin runs with the drain on and off; PC when the first
//             debt run (before the first services) ends, on ÷ off.
//   levels    the same city played at several tax levels: growth, income, satisfaction,
//             longest debt run. Fresh town: 0, 5, 10, 15, 20 for daysFresh.
//             Saved (mature) cities: 5, 10, 20 for daysSave.
//
// The drain is graded under the tuned PC numbers (TUNED_T, or the lab's custom T):
// the shipped PC numbers are still switched off, and the drain scales with the cap.

import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { applyValues } from '../ui/pcPresets';
import { pcCap } from '../sim/politics';
import { debtLimit } from '../sim/debt';
import { PERSONAS, playPersona } from './personas';
import { Recorder } from './recorder';
import { loadCity, startSim, type CitySpec } from './world';

/** Numbers to try: BALANCE.budget.debtPcDrainPerDay and BALANCE.tax.level's satisfactionPerPoint / demandStrength. */
export interface TaxDebtValues {
  debtPcDrainPerDay?: number;
  satisfactionPerPoint?: number;
  demandStrength?: number;
}

/** Apply `v` to BALANCE; returns a function that puts the old numbers back. */
export function applyTaxDebtValues(v: TaxDebtValues): () => void {
  const budget = BALANCE.budget as { debtPcDrainPerDay: number };
  const level = BALANCE.tax.level as { satisfactionPerPoint: number; demandStrength: number };
  const old = { d: budget.debtPcDrainPerDay, s: level.satisfactionPerPoint, k: level.demandStrength };
  if (v.debtPcDrainPerDay !== undefined) budget.debtPcDrainPerDay = v.debtPcDrainPerDay;
  if (v.satisfactionPerPoint !== undefined) level.satisfactionPerPoint = v.satisfactionPerPoint;
  if (v.demandStrength !== undefined) level.demandStrength = v.demandStrength;
  return () => { budget.debtPcDrainPerDay = old.d; level.satisfactionPerPoint = old.s; level.demandStrength = old.k; };
}

/** One run at one tax level. */
export interface LevelRun {
  level: number;
  popStart: number;
  popEnd: number;
  /** Mean income per day over the last 30 days. */
  incomeLate: number;
  /** Satisfaction at the end, 0–1. */
  satEnd: number;
  longestDebtRun: number;
  gameOverDay: number | null;
}

export interface TaxDebtResult {
  /** PC lost to the drain over the grace period ÷ the cap; null when the drain is off. */
  drain: { share: number | null; days: number };
  /** Fresh town only. */
  squeeze: { ratio: number | null; debtDays: number; endDay: number | null; note?: string } | null;
  levels: Record<number, LevelRun>;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const planner = () => PERSONAS.find(p => p.id === 'planner')!;

/** Longest run of days with money below 0. */
function longestDebt(rec: Recorder): number {
  let best = 0, run = 0;
  for (const d of rec.days) { run = d.money < 0 ? run + 1 : 0; best = Math.max(best, run); }
  return best;
}

function playLevel(city: CitySpec, fresh: boolean, days: number, level: number): LevelRun {
  const world = loadCity(city);
  world.budget.taxLevel = level;
  const popStart = world.stats.population;
  const run = playPersona(planner(), world, fresh, days, { realMoney: true });
  const late = run.rec.days.slice(-30);
  return {
    level,
    popStart,
    popEnd: run.world.stats.population,
    incomeLate: Math.round(late.reduce((s, d) => s + d.inc, 0) / Math.max(1, late.length)),
    satEnd: r3(run.world.stats.satisfaction),
    longestDebtRun: longestDebt(run.rec),
    gameOverDay: run.rec.gameOverDay,
  };
}

/** PC lost to the drain while the city is held at half its debt limit for `days` days, from a full cap, ÷ the cap. */
function drainProbe(city: CitySpec, days: number): number | null {
  if (!(BALANCE.budget.debtPcDrainPerDay > 0)) return null;
  const world: World = loadCity(city);
  const sim = startSim(world);
  const rec = new Recorder(world);
  world.budget.politicalCapital = pcCap(world);
  for (let d = 0; d < days; d++) {
    // Half the limit, not -1: one tick's income must not lift the city out of debt before the day's check.
    for (let k = 0; k < BALANCE.ticksPerDay; k++) { world.budget.money = -debtLimit(world) / 2; sim.tick(1); rec.afterTick(); }
  }
  return r3(-(rec.pcByReason.debt ?? 0) / pcCap(world));
}

/** Fresh town: PC when the first debt run before the first services ends, drain on ÷ drain off. */
function squeezeProbe(city: CitySpec, days: number): NonNullable<TaxDebtResult['squeeze']> {
  if (!(BALANCE.budget.debtPcDrainPerDay > 0)) return { ratio: null, debtDays: 0, endDay: null, note: 'drain off' };
  const on = playPersona(planner(), loadCity(city), true, days, { realMoney: true });
  const days0 = on.rec.days;
  const until = on.rec.allServicesDay ?? days0.length;
  const start = days0.findIndex((d, i) => i < until && d.money < 0);
  if (start < 0) return { ratio: 1, debtDays: 0, endDay: null, note: 'never in debt before the first services' };
  let end = start;
  while (end < days0.length && days0[end].money < 0) end++;
  end = Math.min(end, days0.length - 1);
  const restore = applyTaxDebtValues({ debtPcDrainPerDay: 0 });
  let off;
  try { off = playPersona(planner(), loadCity(city), true, end + 1, { realMoney: true }); } finally { restore(); }
  const pcOn = days0[end].pc, pcOff = off.rec.days[end]?.pc ?? off.world.budget.politicalCapital;
  return { ratio: pcOff > 0 ? r3(pcOn / pcOff) : null, debtDays: end - start, endDay: end + 1, ...(pcOff > 0 ? {} : { note: 'no PC without the drain either' }) };
}

/**
 * All probes on one city. `pcValues` is the PC number set to grade the drain under
 * (the drain scales with the cap); BALANCE.politicalCapital is put back afterwards.
 */
export function taxDebtResult(city: CitySpec, daysFresh: number, daysSave: number, pcValues: Record<string, unknown>): TaxDebtResult {
  const fresh = city.kind === 'fresh';
  const levels: Record<number, LevelRun> = {};
  for (const lv of fresh ? [0, 5, 10, 15, 20] : [5, 10, 20]) levels[lv] = playLevel(city, fresh, fresh ? daysFresh : daysSave, lv);
  const shippedPc = structuredClone(BALANCE.politicalCapital);
  applyValues(BALANCE.politicalCapital as never, pcValues as never);
  try {
    const grace = BALANCE.budget.debtGraceDays || 30;
    return { drain: { share: drainProbe(city, grace), days: grace }, squeeze: fresh ? squeezeProbe(city, daysFresh) : null, levels };
  } finally {
    applyValues(BALANCE.politicalCapital as never, shippedPc as never);
  }
}

// ── Presets the lab grades ──────────────────────────────────────────────────

export interface TaxDebtPreset { id: string; name: string; desc: string; values: TaxDebtValues }

export const TAXDEBT_PRESETS: TaxDebtPreset[] = [
  { id: 'shipped', name: 'Shipped', desc: 'As in BALANCE (the drain switched off until the PC numbers ship).', values: {} },
  { id: 'proposed', name: 'Proposed', desc: 'ENGINEER 3 sweep, 2026-11-18 (balance-results/taxdebt.json): drain 0.75 a day, so a city in debt for the 30-day grace period loses 15% of its cap under preset T (22.5% with the shipped PC cap). Tax level as shipped: no value of satisfactionPerPoint / demandStrength passes tax.high / tax.low (see TODO.md).', values: { debtPcDrainPerDay: 0.75 } },
];
