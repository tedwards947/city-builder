// Balance Lab targets, v0 (approved by the owner 2026-11-16, ordinance targets added).
// The ids are stable: reports compare runs by id. Change a range here, not an id.
//
// THE PRINCIPLE (owner, 2026-11-17): "Traffic jams are a part of the fun of developing a
// city; the goal of play-testing should not be to remove all difficulties, just that the
// difficulties should be fun to resolve."
// So a target checks FAIRNESS, not ease: that a hard thing can be resolved with deliberate
// effort (a better plan, the right building, rerouting), that nothing is impossible or
// farmable, and that the scripted player isn't simply too naive. Never tune a number or
// loosen a target just to make something hard become easy; if a target would only pass
// by removing friction, flag it to the PM instead.

import { BALANCE } from '../data/balance';
import { ORDINANCE_IDS } from '../sim/ordinances';
import { RAIL_GROUND, RAIL_ELEVATED, RAIL_SUBWAY } from '../sim/constants';
import type { RunSummary } from './lab';
import type { StaticProbes } from './probes';
import type { SvcResult, SvcKindStats, SvcPcProbes } from './services';
import type { TradeResult } from './trade';
import type { TaxDebtResult, LevelRun } from './taxdebt';
import type { AirportResult } from './airport';
import type { RailResult, RailFresh } from './rail';
import type { LandscapeResult } from './landscape';

export type Status = 'graded' | 'later';
export type Suite = 'pc' | 'econ' | 'svc' | 'trade' | 'taxdebt' | 'airport' | 'rail' | 'landscape';

export interface Outcome {
  value: unknown;
  /** null = not applicable here (e.g. ordinances off, persona not run on this city). */
  pass: boolean | null;
  /** How far outside the range, ≥ 0 (0 when passing): lets a report say better or worse. */
  miss?: number;
  note?: string;
}

export interface EvalCtx {
  variant: string;
  city: string;
  cityKind: 'fresh' | 'save';
  runs: Record<string, RunSummary>;
  probes: StaticProbes | null;
  refill: { days: number | null; avgSatisfaction: number } | null;
  ordinancesOn: boolean;
  /** Services suite: seating and probes on the Planner's city at the end of the run. */
  svc?: SvcResult | null;
  /** Trade suite: seaport and goods probes on the saved city as it stands. */
  trade?: TradeResult | null;
  /** Debt / tax suite: drain, squeeze and tax-level twin runs on the city. */
  taxdebt?: TaxDebtResult | null;
  /** Airport suite: the airport built on the saved city, against a twin without it. */
  airport?: AirportResult | null;
  /** Rail suite: the suburb probes on a saved city, or the real-money Planner's bank on a fresh map. */
  rail?: RailResult | null;
  railFresh?: RailFresh | null;
  /** Landscape suite: tree, vibe and water probes on a saved city. */
  landscape?: LandscapeResult | null;
  /** Landscape suite: the tree-belt probe (a made-up map, the same for every city; graded on fresh maps). */
  treeBuffer?: number | null;
}

export interface Target {
  id: string;
  /** 'pc': graded per PC variant; 'econ': per economy preset (the real-money Planner). */
  suite: Suite;
  metric: string;
  target: string;
  persona: string;
  cities: string;
  why: string;
  status: Status;
  evaluate(c: EvalCtx): Outcome;
}

const NA = (note: string): Outcome => ({ value: null, pass: null, note });
const NEGLECT_SAVE = 'fresh cities only: on a finished save the Neglecter just leaves a working city alone';
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Pass if lo ≤ v ≤ hi; miss is the relative distance outside. */
export function range(v: number | null | undefined, lo: number, hi = Infinity): Outcome {
  if (v === null || v === undefined || Number.isNaN(v)) return { value: null, pass: false, miss: 1, note: 'no value' };
  const miss = v < lo ? (lo - v) / Math.max(Math.abs(lo), 1e-9) : v > hi ? (v - hi) / Math.max(Math.abs(hi), 1e-9) : 0;
  return { value: r3(v), pass: miss === 0, miss: r3(miss) };
}
function all(parts: Record<string, Outcome>): Outcome {
  // Parts that don't apply (pass null) are reported but neither pass nor fail the whole.
  const vals = Object.values(parts).filter(o => o.pass !== null);
  if (!vals.length) return NA(Object.values(parts).map(o => o.note).filter(Boolean)[0] ?? 'nothing measured');
  return { value: Object.fromEntries(Object.entries(parts).map(([k, o]) => [k, o.value])), pass: vals.every(o => o.pass), miss: r3(vals.reduce((m, o) => Math.max(m, o.miss ?? 0), 0)) };
}
const pcShare = (r: RunSummary) => r.pcShareMean;
const earnedShare = (r: RunSummary) => {
  const one = ['serviceOpened', 'milestone', 'requestMet', 'blightCleared'].reduce((s, k) => s + Math.max(0, r.pcByReason[k] ?? 0), 0);
  const total = one + Math.max(0, r.pcByReason.regen ?? 0);
  return total > 0 ? one / total : null;
};
const metShare = (r: RunSummary) => { const m = sum(r.requests.met), f = sum(r.requests.failed); return m + f ? m / (m + f) : null; };
/** The request kinds one building can answer. */
const COVERAGE_KINDS = ['park', 'police', 'fire', 'school', 'hospital'];
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
const upkeeps = () => ORDINANCE_IDS.map(id => BALANCE.politicalCapital.ordinances[id]?.dailyUpkeep ?? 0).sort((a, b) => a - b);

/** Eminent Domain's net PC for a persona: displacement saved − (enact + upkeep) − regen lost, from its twin runs. */
function eminentNet(withEd: RunSummary | undefined, without: RunSummary | undefined): number | null {
  if (!withEd || !without || withEd.extra.eminentDay === undefined) return null;
  const n = BALANCE.politicalCapital.ordinances.eminentDomain;
  const m = n.modifiers.displacementCost ?? 1;
  const displaced = -(withEd.pcByReason.displacement ?? 0);
  const saved = m > 0 && m < 1 ? displaced * (1 / m - 1) : 0;
  const daysOn = withEd.days - (withEd.extra.eminentDay as number);
  const cost = n.enactCost + n.dailyUpkeep * daysOn;
  const regenLost = (without.pcByReason.regen ?? 0) - (withEd.pcByReason.regen ?? 0);
  return saved - cost - regenLost;
}

const PC_TARGETS: Omit<Target, 'suite'>[] = [
  { id: 'pc.refill', metric: 'Game days for the Planner\'s city, left alone, to regenerate from 0 PC to 99% of the cap', target: '60–90 days (4–6 min at 1×)', persona: 'planner', cities: 'all', status: 'graded',
    why: 'Decision 2026-11-15: a happy city refills in about 5 minutes at 1×. Owner (2026-11-18): 99% counts as full, since failed requests can hold a city left alone a point short of the cap.',
    evaluate: c => c.refill ? { ...range(c.refill.days ?? Infinity, 60, 90), note: `avg satisfaction ${c.refill.avgSatisfaction}` } : NA('no Planner run') },
  { id: 'pc.tower', metric: 'PC to displace one level-3 home (20 residents) ÷ cap', target: '0.25–0.40', persona: 'probe', cities: 'all', status: 'graded',
    why: 'Owner: a tower costs about a third of the cap.',
    evaluate: c => range((c.probes?.tower as { ratio?: number } | undefined)?.ratio, 0.25, 0.4) },
  { id: 'pc.neighbourhood', metric: 'PC to clear the most populous 12×12 neighbourhood in one go ÷ cap', target: '≥ 2.0', persona: 'probe', cities: 'all', status: 'graded',
    why: 'Core pillar: you can\'t flatten a district in one go.',
    evaluate: c => range((c.probes?.neighbourhood as { ratio?: number } | undefined)?.ratio, 2) },
  { id: 'pc.bank.chaser', metric: '95th percentile of PC ÷ cap over the run', target: '≤ 1.5', persona: 'chaser', cities: 'all', status: 'graded',
    why: 'Rule 5: going over the cap is fine, stockpiling isn\'t.',
    evaluate: c => c.runs.chaser ? range(c.runs.chaser.pcOverCapP95, 0, 1.5) : NA('not run') },
  { id: 'pc.bank.planner', metric: 'Share of the Planner\'s actions refused for PC', target: '≤ 5%', persona: 'planner', cities: 'all', status: 'graded',
    why: 'A thoughtful player shouldn\'t feel starved.',
    evaluate: c => c.runs.planner ? range(c.runs.planner.refusedPcShare, 0, 0.05) : NA('not run') },
  { id: 'pc.neglect', metric: 'Day the Neglecter first hits 0 PC; share of later days below 10% of cap', target: 'by day 150; ≥ 80%', persona: 'neglecter', cities: 'fresh', status: 'graded',
    why: 'Rule 4: an unhappy city drains PC.',
    evaluate: c => { const r = c.runs.neglecter; if (c.cityKind === 'save') return NA(NEGLECT_SAVE); if (!r) return NA('not run'); return all({ firstZeroDay: range(r.firstZeroDay ?? Infinity, 0, 150), below10: range(r.shareBelow10AfterZero, 0.8) }); } },
  { id: 'pc.demolish', metric: 'Share of the Demolisher\'s bulldozes refused for PC', target: '≥ 30%', persona: 'demolisher', cities: 'all', status: 'graded',
    why: 'Core pillar: PC really limits mass demolition.',
    evaluate: c => { const r = c.runs.demolisher; if (!r) return NA('not run'); const t = r.tried.bulldoze ?? 0; return t ? range((r.refused.bulldoze?.politicalCapital ?? 0) / t, 0.3) : { value: 0, pass: false, miss: 1, note: 'nothing to bulldoze' }; } },
  { id: 'pc.order', metric: 'Mean PC ÷ cap over the run, by persona (the end value ties at 0 too often)', target: 'Planner > Sprawler > Neglecter', persona: 'planner, sprawler, neglecter', cities: 'fresh', status: 'graded',
    why: 'Sanity check: playing well pays.',
    evaluate: c => {
      if (c.cityKind === 'save') return NA(NEGLECT_SAVE);
      const seq = ['planner', 'sprawler', 'neglecter'].filter(p => c.runs[p]).map(p => [p, pcShare(c.runs[p])] as const);
      if (seq.length < 2) return NA('fewer than two of the personas ran');
      const pass = seq.every((e, k) => k === 0 || seq[k - 1][1] > e[1]);
      return { value: Object.fromEntries(seq.map(([p, v]) => [p, r3(v)])), pass, miss: pass ? 0 : 1 };
    } },
  { id: 'pc.earned.share', metric: 'Share of PC earned from one-off bonuses (ribbon cuttings, milestones, requests, blight) vs passive regeneration', target: '≥ 50%', persona: 'planner, chaser', cities: 'fresh', status: 'graded',
    why: 'Rule 3: earned bonuses matter more than passive regeneration. Fresh cities only (owner, 2026-11-17): a mature city has no first ribbons or milestones left, so regeneration rightly dominates there.',
    evaluate: c => { if (c.cityKind === 'save') return NA('fresh cities only'); const p: Record<string, Outcome> = {}; for (const k of ['planner', 'chaser']) if (c.runs[k]) p[k] = range(earnedShare(c.runs[k]), 0.5); return all(p); } },
  { id: 'pc.ribbon.first', metric: 'First school / hospital / police opened near the middle of the homes (none of its kind left) ÷ cap', target: '0.05–0.15 each', persona: 'probe', cities: 'all', status: 'graded',
    why: 'A ribbon cutting should feel worth having.',
    evaluate: c => all(Object.fromEntries(['school', 'hospital', 'police'].map(k => [k, range((c.probes?.['ribbon:' + k] as { first?: number } | undefined)?.first, 0.05, 0.15)]))) },
  { id: 'pc.ribbon.second', metric: 'A second building of a kind: its pay per resident for homes the first already serves, and for homes only it serves, each ÷ the first building\'s pay per resident', target: 'overlap ≤ 0.5; new district ≥ 0.8, each kind', persona: 'probe', cities: 'all', status: 'graded',
    why: 'Owner (2026-11-17): a second building should pay little only where it overlaps the first; one serving a new district should pay well.',
    evaluate: c => all(Object.fromEntries(['school', 'hospital', 'police'].flatMap(k => {
      const p = c.probes?.['ribbon:' + k] as { overlapPay?: number | null; newPay?: number | null } | undefined;
      return [[k + '.overlap', p?.overlapPay === null ? NA('re-seats nobody') : range(p?.overlapPay, -Infinity, 0.5)], [k + '.new', p?.newPay === null ? NA('seats nobody new') : range(p?.newPay, 0.8)]];
    }))) },
  { id: 'pc.move', metric: 'Net PC to move a service (open a second on the free lot that serves most of the first one\'s homes, close the first) ÷ cap; negative = a cost', target: 'cost ≤ 0.07 each', persona: 'probe', cities: 'all', status: 'graded',
    why: 'Moving a service is cheap. The second site overlaps the first (owner, 2026-11-17), so the probe measures a move, not stranding homes. Owner (2026-11-18): 0.07, so one closureMultiplier can also make closing the only hospital hurt (pc.closure.lonely).',
    evaluate: c => all(Object.fromEntries(['school', 'hospital', 'police'].map(k => { const m = (c.probes?.['ribbon:' + k] as { moveNet?: number | null } | undefined)?.moveNet; return [k, m === null ? NA('no move site found') : range(m, -0.07)]; }))) },
  { id: 'pc.closure.lonely', metric: 'Closing the city\'s only hospital ÷ cap', target: '≥ 0.15', persona: 'probe', cities: 'all', status: 'graded',
    why: 'A closure should hurt. Owner (2026-11-18): 0.15, so closing the only hospital still costs more than opening one pays (pc.ribbon.first ≤ 0.15), with one closureMultiplier for every kind.',
    evaluate: c => range((c.probes?.['ribbon:hospital'] as { closeLast?: number } | undefined)?.closeLast, 0.15) },
  { id: 'pc.nuisance', metric: 'Power plant beside homes ÷ cap; and in empty land (PC)', target: '0.2–0.5; exactly 0', persona: 'probe', cities: 'all', status: 'graded',
    why: 'Unpopular buildings cost PC near homes, nothing away from them.',
    evaluate: c => { const n = c.probes?.nuisance as { nearHomes: number | null; farFromHomes: number | null } | undefined; if (!n) return NA('no probe'); return all({ near: range(n.nearHomes, 0.2, 0.5), far: n.farFromHomes === null ? NA('no empty land found') : range(n.farFromHomes, 0, 0) }); } },
  { id: 'pc.industrialist', metric: 'Industry zoning ≥ 8 tiles from homes refused for PC (tiles)', target: '0', persona: 'industrialist', cities: 'fresh', status: 'graded',
    why: 'Industry put away from homes should be free.',
    evaluate: c => c.runs.industrialist ? range(c.runs.industrialist.refused.industryFar?.politicalCapital ?? 0, 0, 0) : NA('not run') },
  { id: 'pc.milestone', metric: 'Each milestone payout ÷ cap at the time (min, max)', target: '0.2–0.4', persona: 'sprawler', cities: 'fresh', status: 'graded',
    why: 'Milestones should be noticeable, not a windfall.',
    evaluate: c => { const m = c.runs.sprawler?.milestoneRatios; if (!m) return NA('not run'); if (!m.length) return { value: [], pass: false, miss: 1, note: 'no milestone paid' }; const lo = range(Math.min(...m), 0.2, 0.4), hi = range(Math.max(...m), 0.2, 0.4); return { value: [r3(Math.min(...m)), r3(Math.max(...m))], pass: !!lo.pass && !!hi.pass, miss: Math.max(lo.miss ?? 0, hi.miss ?? 0) }; } },
  { id: 'pc.cap.growth', metric: 'Cap at 10k residents ÷ cap at 0', target: '1.5–3.0', persona: 'static', cities: 'all', status: 'graded',
    why: 'Rule 2: the cap grows with population, not so far that saving up beats it.',
    evaluate: c => range(c.probes?.capGrowth as number | undefined, 1.5, 3) },
  { id: 'pc.request.one', metric: 'Coverage requests met after one building beside the asking home', target: '≥ 80%', persona: 'chaser', cities: 'all', status: 'graded',
    why: 'A reasonable answer usually works (owner, 2026-11-17: lowered from 95% so some requests can take more thought).',
    evaluate: c => { const r = c.runs.chaser; if (!r) return NA('not run'); return r.answered ? { ...range(r.answeredMet / r.answered, 0.8), note: `${r.answeredMet}/${r.answered}` } : NA('no request answered'); } },
  { id: 'pc.request.chaser', metric: 'Share of requests the Request-chaser meets. Coverage and utilities: one building each (leaving out coverage requests it skips because no free lot within 10 tiles could serve half the asking homes). Traffic jams: a plan over several passes (avenues, then a wider ring and the next bottlenecks)', target: 'coverage + utilities ≥ 70%; traffic jams ≥ 30%', persona: 'chaser', cities: 'all', status: 'graded',
    why: 'Requests should be doable. Some in built-up areas are not worth meeting, and a sensible player skips them (owner, 2026-11-17). Traffic jams are meant to be hard (the principle above): the check is that a deliberate plan resolves most of them, not that one upgrade does. Owner (2026-11-18): 30% now that a jam fix must hold for 3 days (#248); to revisit after the owner plays.',
    evaluate: c => {
      const r = c.runs.chaser; if (!r) return NA('not run');
      const pick = (o: Record<string, number>, ks: string[]) => ks.reduce((a, k) => a + (o[k] ?? 0), 0);
      const ks = [...COVERAGE_KINDS, 'utilities'];
      const m = pick(r.requests.met, ks), f = pick(r.requests.failed, ks) - r.skippedFailed;
      const tm = r.requests.met.trafficJam ?? 0, tf = r.requests.failed.trafficJam ?? 0;
      const parts: Record<string, Outcome> = {};
      if (m + f) parts.coverage = range(m / (m + f), 0.7);
      if (tm + tf) parts.trafficJam = range(tm / (tm + tf), 0.3);
      return { ...all(parts), note: `skipped as unmeetable: ${r.skipped}; traffic jams ${tm}/${tm + tf}` };
    } },
  { id: 'pc.request.neglect', metric: 'Share of requests the Neglecter meets', target: '≤ 20%', persona: 'neglecter', cities: 'fresh', status: 'graded',
    why: 'A deadline should mean something.',
    evaluate: c => { const r = c.runs.neglecter; if (c.cityKind === 'save') return NA(NEGLECT_SAVE); if (!r) return NA('not run'); const s = metShare(r); return s === null ? NA('no request closed') : range(s, 0, 0.2); } },
  ...(['buildClose', 'closeReopen', 'placeUndo', 'rezone', 'batchVsSingle'] as const).map((loop): Omit<Target, 'suite'> => ({
    id: 'pc.exploit.' + loop, metric: `Net PC after 20 rounds of the ${loop} loop (worst of the Exploiter's tries)`, target: '≤ 0', persona: 'exploiter', cities: 'all', status: 'graded',
    why: 'No loop should net PC.',
    evaluate: c => { const e = c.runs.exploiter?.extra.exploits as Record<string, Record<string, number | null>> | undefined; if (!e) return NA('not run'); const v = Object.values(e).map(x => x[loop]).filter((x): x is number => x !== null); return v.length ? range(Math.max(...v), -Infinity, 0) : NA('loop not possible here'); },
  })),
  { id: 'pc.undo.exact', metric: 'Worst |PC difference| after doing then undoing a command', target: 'exactly 0', persona: 'exploiter', cities: 'all', status: 'graded',
    why: 'Undo is exact.',
    evaluate: c => { const e = c.runs.exploiter?.extra.exploits as Record<string, Record<string, number | null>> | undefined; if (!e) return NA('not run'); return range(Math.max(...Object.values(e).map(x => x.undoWorstDiff ?? 0)), 0, 0); } },
  { id: 'pc.ord.affordable', metric: 'Day the Planner can first afford an ordinance (enact + 30 days of upkeep), and its population then', target: 'by day 200 or by 5k residents', persona: 'planner', cities: 'all', status: 'graded',
    why: 'Owner: at least one ordinance within reach by mid-game.',
    evaluate: c => {
      if (!c.ordinancesOn) return NA('ordinances off');
      const r = c.runs.planner; if (!r) return NA('not run');
      const d = r.extra.ordinanceAffordableDay as number | undefined;
      if (d === undefined) return { value: null, pass: false, miss: 1, note: 'never affordable' };
      const pop = r.extra.ordinanceAffordablePop as number;
      const pass = d <= 200 || pop <= 5000;
      return { value: { day: d, population: pop }, pass, miss: pass ? 0 : r3((d - 200) / 200) };
    } },
  { id: 'pc.ord.all', metric: 'Fresh city: all eight upkeeps ÷ regen per day at ~2k residents. Saved/large city: regen per day ÷ the 3 and 5 cheapest upkeeps', target: '> 1 (small); ≥ 1 for 3 and < 1 for 5 (large)', persona: 'planner', cities: 'all', status: 'graded',
    why: 'Owner: all eight are too dear for a small city; a large, happy city can keep 3–4.',
    evaluate: c => {
      if (!c.ordinancesOn) return NA('ordinances off');
      const r = c.runs.planner; if (!r) return NA('not run');
      // Upkeep is charged × cap ÷ max (upkeepScale in src/sim/ordinances.ts), so compare like with like.
      if (c.cityKind === 'fresh') {
        if (r.regenPerDayAt2k === null) return NA('never near 2k residents');
        const u = upkeeps().map(x => x * (r.upkeepScaleAt2k ?? 1));
        return { ...range(u.reduce((a, b) => a + b, 0) / Math.max(r.regenPerDayAt2k, 1e-9), 1.000001), note: `regen/day at 2k ${r3(r.regenPerDayAt2k)}` };
      }
      const g = r.regenPerDayLate;
      const u = upkeeps().map(x => x * r.upkeepScaleLate);
      const three = u.slice(0, 3).reduce((a, b) => a + b, 0), five = u.slice(0, 5).reduce((a, b) => a + b, 0);
      return all({ three: range(g / Math.max(three, 1e-9), 1), five: range(g / Math.max(five, 1e-9), -Infinity, 0.999999) });
    } },
  { id: 'pc.ord.eminent', metric: 'Eminent Domain\'s net PC (displacement saved − enact and upkeep − regen lost), from twin runs with and without it', target: '> 0 for the Demolisher; < 0 for the Planner', persona: 'demolisher, planner', cities: 'all', status: 'graded',
    why: 'Owner: it should pay off only for a player who demolishes a lot.',
    evaluate: c => {
      if (!c.ordinancesOn) return NA('ordinances off');
      const d = eminentNet(c.runs['demolisher+eminent'], c.runs.demolisher), p = eminentNet(c.runs['planner+eminent'], c.runs.planner);
      if (d === null && p === null) return NA('Eminent Domain never enacted');
      return all({ demolisher: d === null ? { value: null, pass: false, miss: 1 } : range(d, 1e-9), planner: p === null ? { value: null, pass: false, miss: 1 } : range(p, -Infinity, -1e-9) });
    } },
];

const econ = (c: EvalCtx) => c.runs.planner?.econ;

const ECON_TARGETS: Omit<Target, 'suite'>[] = [
  { id: 'econ.firstServices', metric: 'A new city on its own money gets a police station, fire station, school and hospital within the run (a softlock check)', target: 'all four built', persona: 'planner (own money)', cities: 'fresh', status: 'graded',
    why: 'Owner (2026-11-17): a softlock check only. A short early squeeze is fine; being unable ever to afford the first services is not. Long stuck debt is econ.noSoftlock.',
    evaluate: c => {
      if (c.cityKind === 'save') return NA('fresh cities only'); const e = econ(c); if (!e) return NA('not run');
      const ok = e.servicesCompleteDay !== null;
      return { value: e.servicesCompleteDay, pass: ok, miss: ok ? 0 : 1, note: `${e.debtDaysBeforeServices} days in debt before then` };
    } },
  { id: 'econ.noSoftlock', metric: 'Longest run of days in debt', target: '≤ 30', persona: 'planner (own money)', cities: 'all', status: 'graded',
    why: 'No city should be stuck in debt.',
    evaluate: c => { const e = econ(c); if (!e) return NA('not run'); if (e.gameOverDay !== null && e.gameOverDay !== undefined) return { value: e.longestDebtRun, pass: false, miss: 1, note: `game over for debt on day ${e.gameOverDay}` }; return range(e.longestDebtRun, 0, 30); } },
  { id: 'econ.taxSlider', metric: 'A mature city: the city-wide tax level that would put its surplus in the middle of 10–25% (the run\'s level × the tax multiplier needed), against the slider\'s range', target: 'within the slider', persona: 'planner (own money)', cities: 'saved and generated', status: 'graded',
    why: 'Fairness (owner, 2026-11-17): the player has a lever that can reach the target band. The note gives the satisfaction cost of that level.',
    evaluate: c => {
      if (c.cityKind === 'fresh') return NA('mature (saved) cities only'); const e = econ(c); if (!e) return NA('not run');
      const v = e.taxLevelForMidSurplus; if (v === null || v === undefined) return NA('no income');
      const { min, max, neutral, satisfactionPerPoint } = BALANCE.tax.level;
      return { ...range(v, min, max), note: `satisfaction ${((neutral - v) * satisfactionPerPoint >= 0 ? '+' : '')}${Math.round((neutral - v) * satisfactionPerPoint * 100)} points at that level` };
    } },
  { id: 'econ.matureSurplus', metric: 'A mature city\'s (income − expenses) ÷ expenses per day, mean of the last 30 days', target: '0.10–0.25', persona: 'planner (own money)', cities: 'saved and generated', status: 'graded',
    why: 'Owner: a mature city should earn, but big projects should still take saving.',
    evaluate: c => { if (c.cityKind === 'fresh') return NA('not a mature city'); const e = econ(c); return e ? { ...range(e.surplusLate, 0.1, 0.25), note: `income ${e.incomeLate}/day, expenses ${e.expensesLate}/day; tax ×${e.taxForMidSurplus} would centre it` } : NA('not run'); } },
  { id: 'econ.sink', metric: 'Money gained over the run ÷ expenses per day at the end (days of expenses banked; 300 days fresh, 150 saved)', target: '≤ 40', persona: 'planner (own money)', cities: 'all', status: 'graded',
    why: 'Money must not pile up without limit (v0; the owner may adjust). 40 days over a 150-day run is a surplus of about 0.25, the top of econ.matureSurplus.',
    evaluate: c => { const e = econ(c); return e ? { ...range(e.gainInDaysOfExpenses, -Infinity, 40), note: `money ${e.moneyStart} → ${e.moneyEnd}` } : NA('not run'); } },
];


// ── Services suite (school and hospital capacity), v0 approved by the owner 2026-11-17 ──
// Graded per capacity preset (src/balance/services.ts) on the Planner's city. Reach decides
// who CAN use a building; capacity decides how many get a seat. Hard is fine; unfair or invisible isn't.
type SvcK = SvcKindStats & { growth: { perNewResident: number | null } | null; fix: { share: number | null } | null; pc?: SvcPcProbes | null };
const perKind = (c: EvalCtx, f: (k: SvcK, name: 'school' | 'hospital') => Outcome): Outcome => {
  if (!c.svc) return NA('not run');
  return all({ school: f(c.svc.kinds.school as SvcK, 'school'), hospital: f(c.svc.kinds.hospital as SvcK, 'hospital') });
};
const capOff = (c: EvalCtx) => !c.svc || !Object.values(c.svc.capacity ?? {}).some(v => v > 0);

const SVC_TARGETS: Omit<Target, 'suite'>[] = [
  { id: 'svc.perCapita', metric: 'Schools and hospitals needed per 10k residents: a greedy plan seating 99% of residents (each pick seats the most, capacity respected), whatever the city has built', target: 'schools 3–6; hospitals 1–2', persona: 'planner', cities: 'all', status: 'graded',
    why: 'Services scale with population, not sprawl: capacity should bind, but not fill the map. Accepted exception (owner, 2026-11-17): spread layouts (organic, suburban) need 7–8 schools per 10k; sprawl costs buildings, so a miss there is a fair trade-off, not a bug.',
    evaluate: c => capOff(c) ? NA('no capacity') : perKind(c, (k, n) => (c.svc!.population < 3000 ? NA('under 3k residents') : { ...range(k.neededPer10k, n === 'school' ? 3 : 1, n === 'school' ? 6 : 2), note: `the Planner has ${k.per10k}/10k` })) },
  { id: 'svc.seated', metric: 'Share of residents with a seat at the end of the Planner\'s run', target: 'schools ≥ 90%; hospitals ≥ 95%', persona: 'planner', cities: 'all', status: 'graded',
    why: 'A careful player can serve nearly everyone: hard is fine, impossible is not.',
    evaluate: c => perKind(c, (k, n) => range(k.seatedShare, n === 'school' ? 0.9 : 0.95)) },
  { id: 'svc.growthShock', metric: 'When 5% of homes (seated at the fullest buildings) grow a level: seats lost per resident added', target: '≤ 1.5 each', persona: 'probe', cities: 'all', status: 'graded',
    why: 'Growth near a full school costs a few seats, predictably, without a cascade.',
    evaluate: c => capOff(c) ? NA('no capacity') : perKind(c, k => (k.growth?.perNewResident === null || k.growth === null ? NA('nothing to grow') : range(k.growth.perNewResident, -Infinity, 1.5))) },
  { id: 'svc.fix', metric: 'One new building on the free lot nearest the fullest one: share of its unseated residents then seated', target: '≥ 80% each', persona: 'probe', cities: 'all', status: 'graded',
    why: 'A full school is fixable with the obvious move.',
    evaluate: c => capOff(c) ? NA('no capacity') : perKind(c, k => (k.fix?.share === null || !k.fix ? NA('nothing full') : range(k.fix.share, 0.8))) },
  { id: 'svc.visible', metric: 'Share of homes whose seat or reason (full / out of reach) matches the buildings\' reach and fill', target: '100% each', persona: 'planner', cities: 'all', status: 'graded',
    why: 'The player can always see why a home has no school or hospital.',
    evaluate: c => perKind(c, k => range(k.visibleOk, 1)) },
  { id: 'svc.reachGap', metric: 'Residents out of reach of every school / hospital, after the Planner\'s run', target: '≤ 5% each', persona: 'planner', cities: 'all', status: 'graded',
    why: 'Reach should not strand pockets a reasonable plan cannot cover.',
    evaluate: c => perKind(c, k => range(k.outOfReachShare, -Infinity, 0.05)) },
  { id: 'svc.pc.overlap', metric: 'PC for a school / hospital that only re-seats homes already seated (gains no seat), under the tuned PC numbers', target: 'exactly 0', persona: 'probe', cities: 'all', status: 'graded',
    why: 'Seat-based service rule: no pay for seats nobody needed.',
    evaluate: c => capOff(c) ? NA('no capacity') : perKind(c, k => { const v = k.pc?.overlap; return v === null || v === undefined ? NA('no such lot') : range(Math.abs(v), 0, 1e-9); }) },
  { id: 'svc.pc.relief', metric: 'PC per resident a building beside the fullest one seats ÷ the first building\'s pay per resident', target: '≥ 0.8 each', persona: 'probe', cities: 'all', status: 'graded',
    why: 'Relieving a full school pays like a new one for the residents it seats.',
    evaluate: c => capOff(c) ? NA('no capacity') : perKind(c, k => { const v = k.pc?.relief; return v === null || v === undefined ? NA('nothing full') : range(v, 0.8); }) },
  { id: 'svc.pc.move', metric: 'Net PC ÷ cap to move the busiest school / hospital to the nearby lot where fewest residents lose a seat', target: 'cost ≤ 0.07 each', persona: 'probe', cities: 'all', status: 'graded',
    why: 'Moving a service is cheap when nobody loses a seat.',
    evaluate: c => capOff(c) ? NA('no capacity') : perKind(c, k => { const v = k.pc?.move; return v === null || v === undefined ? NA('no lot') : { ...range(v, -0.05), note: `${k.pc?.moveLost ?? 0} residents lose a seat` }; }) },
  { id: 'svc.pc.loops', metric: 'Net PC of 10 rounds of open-and-close beside the fullest building, and of close-and-reopen of a standing one', target: '≤ 0 each', persona: 'probe', cities: 'all', status: 'graded',
    why: 'No loop nets PC.',
    evaluate: c => capOff(c) ? NA('no capacity') : perKind(c, k => { const a = k.pc?.loopBuildClose, b = k.pc?.loopCloseReopen; const parts: Record<string, Outcome> = {}; if (a !== null && a !== undefined) parts.buildClose = range(a, -Infinity, 0); if (b !== null && b !== undefined) parts.closeReopen = range(b, -Infinity, 0); return Object.keys(parts).length ? all(parts) : NA('not measured'); }) },
];

// Seaport and goods (approved by the owner 2026-11-17). No target on an idle port (building one too
// early is the player's call) or on truck traffic.
const tradeOf = (c: EvalCtx) => c.trade ?? null;
/** The port probe, or n/a when there's no port or no industry reaches it. */
const portOf = (c: EvalCtx): { p: NonNullable<TradeResult['port']> } | Outcome => {
  const t = tradeOf(c);
  if (!t?.port) return NA(t?.note ?? 'no trade probe');
  if (!(BALANCE.port.exportCapacity > 0 && BALANCE.port.exportTripsPerLevel > 0)) return NA('exports switched off');
  if (!(t.port.fullShare > 0)) return NA('no industry within the port\'s reach');
  return { p: t.port };
};
const TRADE_TARGETS: Omit<Target, 'suite'>[] = [
  { id: 'port.payback', metric: 'Game days for a port beside the industrial district to repay its cost from net export income (1 day = 4 s at 1×)', target: '150–450 days', persona: 'probe', cities: 'saves', status: 'graded',
    why: 'Owner: the longer payback, about 10–30 minutes at 1×. A port is an investment, not an instant win.',
    evaluate: c => { const r = portOf(c); if (!('p' in r)) return r; return r.p.paybackDays === null ? { value: null, pass: false, miss: 1, note: 'never pays back' } : range(r.p.paybackDays, 150, 450); } },
  { id: 'port.split', metric: 'Extra export income from a second port on the same district ÷ the first port\'s income', target: '≤ 0.10, unless the first is ≥ 90% full', persona: 'probe', cities: 'saves', status: 'graded',
    why: 'A second port pays only when the first is full: no stacking ports for free money.',
    evaluate: c => { const s = tradeOf(c)?.split; if (!s) return NA('no second port'); if (s.firstFull >= 0.9) return { value: r3(s.gain), pass: true, miss: 0, note: 'first port full' }; return range(s.gain, -Infinity, 0.1); } },
  { id: 'port.farm', metric: 'Port income per industry level served ÷ industry\'s own tax per level; port income ÷ the city\'s whole income', target: '≤ 1.5 and ≤ 0.30', persona: 'probe', cities: 'saves', status: 'graded',
    why: 'Exports reward industry without becoming the economy: no port farm.',
    evaluate: c => { const r = portOf(c); if (!('p' in r)) return r; const parts: Record<string, Outcome> = { share: range(r.p.incomeShare, -Infinity, 0.3) }; if (r.p.perLevelRatio !== null) parts.perLevel = range(r.p.perLevelRatio, -Infinity, 1.5); return all(parts); } },
  { id: 'goods.today', metric: 'Goods shortage with no port: as the city stands when zoning is balanced (shops ≤ 2× industry by level); with shops ≥ 3× industry (dezoned to it, or as it stands) the shortage and the share of shop income lost', target: 'balanced ≤ 0.1; shops ≥ 3×: shortage ≥ 0.3 and 5–20% lost', persona: 'probe', cities: 'saves', status: 'graded',
    why: 'Shops need goods: a lopsided city feels it, a balanced one does not.',
    evaluate: c => {
      const t = tradeOf(c); if (!t) return NA('no trade probe');
      const ratio = t.levels.c / Math.max(1, t.levels.i);
      const parts: Record<string, Outcome> = {};
      if (ratio <= 2) parts.balanced = range(t.shortage, -Infinity, 0.1);
      if (t.heavy) { parts.heavy = range(t.heavy.shortage, 0.3); parts.lost = range(t.heavy.incomeLoss, 0.05, 0.2); }
      return Object.keys(parts).length ? all(parts) : NA('no shops');
    } },
  { id: 'goods.port.fix', metric: 'Goods shortage with shops ≥ 3× industry, after a port opens by the shops ÷ before', target: '≤ 0.5', persona: 'probe', cities: 'saves', status: 'graded',
    why: 'Imports are a real fix for a goods shortage.',
    evaluate: c => { const h = tradeOf(c)?.heavy; if (!h || h.withPort === null) return NA('no port site'); if (!(BALANCE.port.importCapacity > 0)) return NA('imports switched off'); if (!(h.shortage > 0)) return NA('no shortage'); return range(h.withPort / h.shortage, -Infinity, 0.5); } },
];

// ── Debt PC drain and the tax level, approved by the owner 2026-11-17 (ENGINEER 3's proposal, as written) ──
const tdOf = (c: EvalCtx) => c.taxdebt ?? null;
/** The runs at `lv` and at neutral, both from the same saved city. */
const pair = (c: EvalCtx, lv: number): { a: LevelRun; n: LevelRun } | Outcome => {
  const L = tdOf(c)?.levels; const a = L?.[lv], n = L?.[BALANCE.tax.level.neutral];
  return a && n ? { a, n } : NA('not run at that level');
};
/** Residents at the end of the run at `a` against the run at neutral, as a share of neutral's (positive = more). */
const popDiff = (a: LevelRun, n: LevelRun) => r3((a.popEnd - n.popEnd) / Math.max(1, n.popEnd));
const TAXDEBT_TARGETS: Omit<Target, 'suite'>[] = [
  { id: 'debt.pcDrain', metric: 'PC lost to the debt drain over the grace period (city held just below $0 from a full cap) ÷ cap, under the tuned PC numbers', target: '10–25%', persona: 'probe', cities: 'all', status: 'graded',
    why: 'Owner (2026-11-17): debt should cost goodwill you can feel, without being a second game over.',
    evaluate: c => { const d = tdOf(c)?.drain; if (!d) return NA('not run'); if (d.share === null) return { value: null, pass: false, miss: 1, note: 'drain switched off' }; return range(d.share, 0.1, 0.25); } },
  { id: 'debt.squeeze', metric: 'Planner on a fresh town, own money: PC when its first run of debt before the first services ends, drain on ÷ drain off', target: '≥ 0.7', persona: 'planner (own money)', cities: 'fresh', status: 'graded',
    why: 'Owner (2026-11-17): a short early squeeze is normal (econ.firstServices) and shouldn\'t be punished hard.',
    evaluate: c => { const q = tdOf(c)?.squeeze; if (!q) return NA('fresh cities only'); if (q.ratio === null) return q.note === 'drain off' ? { value: null, pass: false, miss: 1, note: 'drain switched off' } : NA(q.note ?? 'no value'); return { ...range(q.ratio, 0.7), note: q.note ?? `${q.debtDays} days in debt, ending day ${q.endDay}` }; } },
  { id: 'tax.high', metric: 'Twin runs of a mature city, 150 days at tax level 20 against 10: residents at the end (share fewer than at 10), income (last 30 days), satisfaction drop in points', target: 'residents 2–8% fewer; income higher; satisfaction 8–20 points lower', persona: 'planner (own money)', cities: 'saves', status: 'graded',
    why: 'Owner (2026-11-17): high tax pays now and costs growth and goodwill. Owner (2026-11-18): a mature city barely grows, so the cost is a gentle exodus (tax.level.exodusPerPoint) measured as residents against level 10; no cap on the income gain.',
    evaluate: c => {
      if (c.cityKind === 'fresh') return NA('mature (saved) cities only');
      const t = pair(c, 20); if (!('a' in t)) return t;
      return { ...all({ residents: range(-popDiff(t.a, t.n), 0.02, 0.08), income: range(t.a.incomeLate - t.n.incomeLate, 1e-9), satisfaction: range(r3((t.n.satEnd - t.a.satEnd) * 100), 8, 20) }), note: `residents ${t.a.popEnd} vs ${t.n.popEnd}; income ${t.a.incomeLate} vs ${t.n.incomeLate}` };
    } },
  { id: 'tax.low', metric: 'Twin runs of a mature city, 150 days at tax level 5 against 10: residents at the end, and income; on the fresh town at level 0, the longest run of days in debt', target: 'residents no fewer (0.5% tolerance), income lower; fresh town at 0: econ.noSoftlock fails (> 30 days in debt or game over)', persona: 'planner (own money)', cities: 'all', status: 'graded',
    why: 'Owner (2026-11-17): low tax buys growth with money; no tax at all is no free lunch. Owner (2026-11-18): the growth check is for mature cities only; a fresh town going broke at low tax is an accepted early-game constraint, but at 0 it must still fail econ.noSoftlock. Built-out land grows no faster at low tax, so the mature check is residents no fewer than at 10, for less income. Owner (2026-11-18): up to 0.5% fewer counts as no fewer (one home of noise).',
    evaluate: c => {
      const L = tdOf(c)?.levels; if (!L) return NA('not run');
      if (c.cityKind === 'fresh') {
        const z = L[0]; if (!z) return NA('not run at 0');
        const stuck = z.gameOverDay !== null || z.longestDebtRun > 30;
        return { value: z.longestDebtRun, pass: stuck, miss: stuck ? 0 : r3((31 - z.longestDebtRun) / 31), note: z.gameOverDay !== null ? `game over on day ${z.gameOverDay}` : `${z.longestDebtRun} days in debt at most` };
      }
      const t = pair(c, 5); if (!('a' in t)) return t;
      return { ...all({ residents: range(popDiff(t.a, t.n), -0.005), income: range(t.n.incomeLate - t.a.incomeLate, 1e-9) }), note: `residents ${t.a.popEnd} vs ${t.n.popEnd}; income ${t.a.incomeLate} vs ${t.n.incomeLate}` };
    } },
  { id: 'tax.noDominant', metric: 'Fresh town, 300 days at tax levels 0, 5, 15, 20: any level with both more income (last 30 days) and more people than level 10', target: 'none', persona: 'planner (own money)', cities: 'fresh', status: 'graded',
    why: 'Owner (2026-11-17): an exploit check; no setting is simply better than neutral.',
    evaluate: c => {
      if (c.cityKind !== 'fresh') return NA('fresh cities only');
      const L = tdOf(c)?.levels; const n = L?.[BALANCE.tax.level.neutral]; if (!L || !n) return NA('not run');
      const beats = Object.values(L).filter(r => r.level !== n.level && r.incomeLate > n.incomeLate && r.popEnd > n.popEnd).map(r => r.level);
      return { value: beats.length ? beats.join(', ') : 'none', pass: beats.length === 0, miss: beats.length, note: Object.values(L).map(r => `${r.level}: pop ${r.popEnd}, income ${r.incomeLate}`).join('; ') };
    } },
];

// The airport (approved by the owner 2026-11-18, "go for it"). Probe on each saved city: the
// airport near the middle of the homes, a street along its terminal, 60 days against a twin
// with the same streets and no airport (src/balance/airport.ts).
const airportOf = (c: EvalCtx): { a: AirportResult } | Outcome => {
  if (c.cityKind === 'fresh') return NA('saved cities only');
  const a = c.airport; if (!a) return NA('no airport probe');
  if (!a.site) return NA(a.note ?? 'no airport site');
  return { a };
};
const AIRPORT_TARGETS: Omit<Target, 'suite'>[] = [
  { id: 'airport.seats', metric: 'Share of the airport\'s visitor seats filled, on cities of 10k residents or more', target: '70–100%', persona: 'probe', cities: 'saves', status: 'graded',
    why: 'Owner (2026-11-18): an airport in a big city is busy.',
    evaluate: c => { const r = airportOf(c); if (!('a' in r)) return r; if (r.a.population < 10000) return NA(`under 10k residents (${r.a.population})`); return range(r.a.seats, 0.7, 1); } },
  { id: 'airport.payback', metric: 'Game days for the airport\'s extra net income (against the twin) to repay its cost', target: '540–900 days (1.5–2.5 game years)', persona: 'probe', cities: 'saves', status: 'graded',
    why: 'Owner (2026-11-18): really expensive, but it pays for itself in a couple of years.',
    evaluate: c => { const r = airportOf(c); if (!('a' in r)) return r; return r.a.paybackDays === null ? { value: null, pass: false, miss: 1, note: 'never pays back' } : range(r.a.paybackDays, 540, 900); } },
  { id: 'airport.demand', metric: 'Commercial demand with the airport ÷ the twin\'s, minus 1', target: '+5–15%', persona: 'probe', cities: 'saves', status: 'graded',
    why: 'Owner (2026-11-18): an airport brings shoppers; shops are in more demand.',
    evaluate: c => { const r = airportOf(c); if (!('a' in r)) return r; return range(r.a.demandGain, 0.05, 0.15); } },
  { id: 'airport.cost', metric: 'The airport\'s build cost in days of the city\'s own surplus (the twin)', target: '≥ 200 days', persona: 'probe', cities: 'saves', status: 'graded',
    why: 'Owner (2026-11-18): really expensive.',
    evaluate: c => { const r = airportOf(c); if (!('a' in r)) return r; return r.a.costDays === null ? NA('the city runs at a loss') : range(r.a.costDays, 200); } },
  { id: 'airport.traffic', metric: 'Worst congestion (0–255) on the plain streets along the terminal', target: '≥ 200 (jams)', persona: 'probe', cities: 'saves', status: 'graded',
    why: 'Owner (2026-11-18): lots of traffic; a terminal on plain streets jams, so the player builds avenues there.',
    evaluate: c => { const r = airportOf(c); if (!('a' in r)) return r; return range(r.a.frontJam, 200); } },
  { id: 'airport.request', metric: '"Residents want an airport" reward ÷ the PC cap at the city\'s size', target: '0.8–1.2 bars', persona: 'probe', cities: 'saves', status: 'graded',
    why: 'Owner (2026-11-18): worth "buku PC", about one full bar. A mature city barely grows before it first has the cash, so its size now stands in for its size then.',
    evaluate: c => { if (c.cityKind === 'fresh') return NA('saved cities only'); const a = c.airport; if (!a) return NA('no airport probe'); return { ...range(a.requestBars, 0.8, 1.2), note: `${a.population} residents` }; } },
];

// Rail (approved by the owner 2026-11-18, RAIL_DESIGN.md). Probe on each saved city: a suburb
// 50–90 tiles out joined to the city by a long street (power, water and services come along
// roads only) and by one line, against a twin with the street only (src/balance/rail.ts).
// On a fresh map: a real-money Planner's bank against a starter line's price.
const railOf = (c: EvalCtx): { r: RailResult } | Outcome => {
  if (c.cityKind === 'fresh') return NA('saved cities only');
  const r = c.rail; if (!r) return NA('no rail probe');
  if (r.lineTiles === null) return NA(r.note ?? 'no suburb site');
  return { r };
};
const RAIL_TARGETS: Omit<Target, 'suite'>[] = [
  { id: 'rail.suburb', metric: 'A suburb joined to the city by a long street and one line: its homes\' job access ÷ the city\'s median, and its home levels ÷ the street-only twin\'s after 180 days', target: 'access ≥ 25% of the city\'s; levels ≥ 1.25×', persona: 'probe', cities: 'saves', status: 'graded',
    why: 'Owner (2026-11-18): make suburbs truly possible. A suburb only rail reaches in time grows. Owner (2026-11-19): access floor 30% → 25%; after the station resize and the level-crossing change gen-s1 sat at 29.8%.',
    evaluate: c => { const o = railOf(c); if (!('r' in o)) return o; const r = o.r;
      return all({ access: range(r.cityAccess ? r.suburbAccess! / r.cityAccess : null, 0.25), levels: range(r.streetLevels ? r.railLevels! / r.streetLevels : null, 1.25) }); } },
  { id: 'rail.beatsRoad', metric: 'The suburb\'s job access with the line ÷ with the long street only', target: '≥ 5×', persona: 'probe', cities: 'saves', status: 'graded',
    why: 'Owner (2026-11-18): rail is a very powerful highway; a long street brings services, not commuters.',
    evaluate: c => { const o = railOf(c); if (!('r' in o)) return o; return range(o.r.suburbAccess! / Math.max(1, o.r.streetAccess ?? 0), 5); } },
  { id: 'rail.freight', metric: 'Freight (goods, seaport cargo: every market that never rides) on any tile of track', target: '0', persona: 'probe', cities: 'saves', status: 'graded',
    why: 'RAIL_DESIGN.md: freight never rides.',
    evaluate: c => { const o = railOf(c); if (!('r' in o)) return o; return range(o.r.freightOnTrack, 0, 0); } },
  { id: 'rail.junctions', metric: 'Load at a 3-way and a 4-way junction laid on the suburb line, scaled to plain track at 0.5', target: '3-way ≤ 0.9; 4-way ≥ 1.2 (it jams first)', persona: 'probe', cities: 'saves', status: 'graded',
    why: 'Owner (2026-11-18): 4-way junctions much worse than 3-way; jams should be fun to resolve.',
    evaluate: c => { const o = railOf(c); if (!('r' in o)) return o; if (o.r.junction3 === null) return NA('no room for the junction spurs');
      return all({ three: range(o.r.junction3, 0, 0.9), four: range(o.r.junction4, 1.2) }); } },
  { id: 'rail.parallel', metric: 'A big suburb (3,000+ residents, full) on one line: the worst load; then with a second line to another city station: the worst load on either', target: 'one line > 1.0; the second line cuts the worst load by ≥ 25%', persona: 'probe', cities: 'saves', status: 'graded',
    why: 'Owner (2026-11-18): an overloaded line slows down; the fix is a parallel line. Owner (2026-11-18): the second half is a cut of at least a quarter; testcity1 is n/a (its big suburb rides too little to fill a line).',
    evaluate: c => { if (c.city === 'testcity1') return NA('owner: testcity1\'s suburb rides too little'); const o = railOf(c); if (!('r' in o)) return o; if (o.r.oneLine === null) return NA('no site for the big suburb');
      const cut = o.r.twoLines === null || !o.r.oneLine ? null : 1 - o.r.twoLines / o.r.oneLine;
      return all({ one: range(o.r.oneLine, 1.0001), cut: o.r.twoLines === null ? NA('no room for a second line') : range(cut, 0.25) }); } },
  { id: 'rail.early', metric: 'A starter line (two stations and 60 tiles of track) ÷ a fresh real-money Planner\'s bank at day 180', target: '≥ 2', persona: 'planner (own money)', cities: 'fresh', status: 'graded',
    why: 'Owner (2026-11-18): rail is gated by cost, not by an unlock: not an early-game buy.',
    evaluate: c => { if (c.cityKind !== 'fresh') return NA('fresh map only'); const f = c.railFresh; if (!f) return NA('not run');
      return { ...range(f.starterCost / Math.max(1, f.bank180), 2), note: `${f.starterCost} vs ${f.bank180}` }; } },
  { id: 'rail.midgame', metric: 'The starter line ÷ the fresh Planner\'s bank at day 360; on saved cities, in days of the city\'s surplus', target: '≤ 40% of the bank; 7–30 days of surplus', persona: 'planner (own money) / probe', cities: 'all', status: 'graded',
    why: 'Owner (2026-11-18): rail is affordable mid-game.',
    evaluate: c => {
      if (c.cityKind === 'fresh') { const f = c.railFresh; if (!f) return NA('not run'); return { ...range(f.starterCost / Math.max(1, f.bank360), 0, 0.4), note: `${f.starterCost} vs ${f.bank360}` }; }
      const o = railOf(c); if (!('r' in o)) return o; return o.r.lineCostDays === null ? NA('the city runs at a loss') : range(o.r.lineCostDays, 7, 30); } },
  { id: 'rail.crossing', metric: 'On a bare map: how much longer a level crossing makes the trips through it. A full line across a busy avenue (road load ≥ 1); a quarter-full line across a quiet street (road load ≤ 0.5)', target: 'busy ≥ 10%; quiet ≤ 1%', persona: 'probe', cities: 'fresh', status: 'graded',
    why: 'Owner (2026-11-19): a level crossing should hurt the road in proportion to the trains. A full line across a busy avenue jams it, so an elevated hop pays off; a quiet line across a quiet street barely matters. Jams stay fun to resolve: bridge, subway, a second line, or move the road.',
    evaluate: c => { if (c.cityKind !== 'fresh') return NA('fresh map only'); const x = c.railFresh?.crossing; if (!x) return NA('not run');
      return all({ busy: range(x.busy, 0.1), busyRoad: range(x.busyRoad, 1), quiet: range(x.quiet, 0, 0.01), quietRoad: range(x.quietRoad, 0, 0.5) }); } },
  { id: 'rail.pays', metric: 'The suburb at full size: (its home taxes + fares) ÷ the upkeep of a starter line (two stations and 60 tiles of track)', target: '0.8–2.0', persona: 'probe', cities: 'saves', status: 'graded',
    why: 'RAIL_DESIGN.md: rail mostly costs money; its payoff is a city that works. A full suburb roughly pays for its line. Owner (2026-11-18): graded on a fixed 60-tile line, as the probe\'s own line length depends on the map. Owner (2026-11-18): band 0.8–2.0; a rich suburb more than paying for its line is fine.',
    evaluate: c => { const o = railOf(c); if (!('r' in o)) return o; return range(o.r.pays, 0.8, 2.0); } },
  { id: 'rail.subwayCost', metric: '60 tiles of subway track: price in days of the city\'s surplus (the street-only twin)', target: '60–120 days at 10–25k residents; ≤ 30 days at 40k or more', persona: 'probe', cities: 'saves', status: 'graded',
    why: 'Owner (2026-11-19): subway at 25× ground build cost is a big-city project, really, really expensive (RAIL_DESIGN.md).',
    evaluate: c => { const o = railOf(c); if (!('r' in o)) return o; const r = o.r;
      if (!r.surplusPerDay || r.surplusPerDay <= 0) return NA('the city runs at a loss');
      const days = 60 * BALANCE.rail.track[RAIL_SUBWAY].cost / r.surplusPerDay;
      if (r.population >= 40000) return range(days, 0, 30);
      if (r.population < 10000 || r.population >= 25000) return NA(`${r.population} residents: outside both bands`);
      return range(days, 60, 120); } },
  { id: 'rail.elevatedCost', metric: 'Elevated track\'s build cost ÷ ground track\'s, for the same line', target: '2.5–4×', persona: 'probe', cities: 'saves', status: 'graded',
    why: 'Owner (2026-11-19): elevated at 3× ground buys no level crossings and passing over roads.',
    evaluate: c => { if (c.cityKind === 'fresh') return NA('saved cities only'); const t = BALANCE.rail.track; return range(t[RAIL_ELEVATED].cost / t[RAIL_GROUND].cost, 2.5, 4); } },
  { id: 'rail.nuisance', metric: '20 tiles of ground track on the free straight run with the most homes within 2 tiles: PC ÷ the PC cap; elevated ÷ ground on the same run; subway, and ground track far from homes', target: '0.05–0.4 bars where the run touches 40+ homes; elevated 1.3–1.7×; subway and empty land 0', persona: 'probe', cities: 'saves', status: 'graded',
    why: 'Owner (2026-11-19): track beside homes is a nuisance, a seventh of an industrial tile a tile; elevated is worse, a subway upsets nobody. Graded only where a run beside homes exists (on a built-out city all land near homes is zoned). Homes count once per track tile they are within 2 of.',
    evaluate: c => { if (c.cityKind === 'fresh') return NA('saved cities only'); const n = c.rail?.nuisance; if (!n) return NA('no 20-tile run of free land');
      if (n.homes < 40) return NA(`the best run touches ${n.homes} homes (under 40)`);
      return all({ bars: range(n.groundBars, 0.05, 0.4), elevated: range(n.elevatedRatio, 1.3, 1.7), subway: range(n.subwayPc, 0, 0), empty: n.emptyPc === null ? NA('no run far from homes') : range(n.emptyPc, 0, 0) }); } },
  { id: 'rail.stationGrowth', metric: 'Suburb homes within 4 tiles of a served station: median days to level 3 with the station bonus against without (growth alone after 30 days of the line, 20 seeds, 360 days); and rail.suburb with the bonus on', target: '15–30% sooner; rail.suburb still passes', persona: 'probe', cities: 'saves', status: 'graded',
    why: 'Owner (2026-11-19): homes and shops near a station grow faster, kept small because rail already brings a suburb its job access.',
    evaluate: c => { const o = railOf(c); if (!('r' in o)) return o; const g = o.r.stationGrowth; if (!g) return NA('no suburb site');
      return { ...all({ sooner: range(g.sooner, 0.15, 0.3), suburb: range(o.r.streetLevels ? o.r.railLevels! / o.r.streetLevels : null, 1.25) }), note: `${g.homes} homes: ${g.daysOff} → ${g.daysOn} days` }; } },
];

// Landscaping (approved by the owner 2026-11-19, LANDSCAPING_DESIGN.md). Probes on each saved city
// (src/balance/landscape.ts); the tree-belt probe is a made-up map, graded on fresh maps.
const landOf = (c: EvalCtx): { l: LandscapeResult } | Outcome => {
  if (c.cityKind === 'fresh') return NA('saved cities only');
  return c.landscape ? { l: c.landscape } : NA('no landscape probe');
};
const LANDSCAPE_TARGETS: Omit<Target, 'suite'>[] = [
  { id: 'land.treeHome', metric: 'Land value gained by a level-3 home with 8 trees within 2 tiles', target: '+12–20', persona: 'probe', cities: 'saves', status: 'graded',
    why: 'Owner (2026-11-19): a tree belt is worth having, but it isn\'t a service (about half the service bonus of 35).',
    evaluate: c => { const o = landOf(c); if (!('l' in o)) return o; return o.l.treeHome === null ? NA(o.l.note ?? 'no bare level-3 home') : range(o.l.treeHome, 12, 20); } },
  { id: 'land.treePayback', metric: 'Days for one tree, on the free tile that reaches the most level-3 homes, to repay its price in extra home tax', target: '60–180 days', persona: 'probe', cities: 'saves', status: 'graded',
    why: 'Owner (2026-11-19): trees beside homes pay off; trees in the wild never do (decoration).',
    evaluate: c => { const o = landOf(c); if (!('l' in o)) return o; const p = o.l.payback; if (p.homes === 0) return NA('no free tile near a level-3 home'); return { ...(p.days === null ? { value: null, pass: false, miss: 1 } : range(p.days, 60, 180)), note: `${p.homes} homes in reach` }; } },
  { id: 'land.treeShock', metric: 'Change in a mature save\'s income when the tree bonus is switched on (wild trees count too)', target: '≤ 3%', persona: 'probe', cities: 'saves', status: 'graded',
    why: 'Owner (2026-11-19): no windfall for maps that happen to be wooded.',
    evaluate: c => { const o = landOf(c); if (!('l' in o)) return o; return range(o.l.shock, -0.03, 0.03); } },
  { id: 'land.treeSpam', metric: 'Every free tile within 2 of a home planted: income gain', target: 'gain ≤ 10%', persona: 'probe', cities: 'saves', status: 'graded',
    why: 'Owner (2026-11-19): no money printer. Owner (2026-11-19): the price half (≥ 30 days of surplus) is dropped; mature cities have too few free tiles near homes for any price that keeps land.treePayback.',
    evaluate: c => { const o = landOf(c); if (!('l' in o)) return o; const s = o.l.spam; return { ...range(s.gain, 0, 0.1), note: s.priceDays === null ? `${s.trees} trees` : `${s.trees} trees, ${s.priceDays} days of surplus` }; } },
  { id: 'land.treeBuffer', metric: 'Pollution at the nearest homes behind a 3-tile tree belt from level-3 industry, against bare land (a made-up map)', target: '15–35% lower', persona: 'probe', cities: 'fresh', status: 'graded',
    why: 'Owner (2026-11-19): tree belts buffer industry from homes. Tunes pollution.vegDecayMult.',
    evaluate: c => c.cityKind !== 'fresh' ? NA('graded on fresh maps (the probe is a made-up map)') : range(c.treeBuffer, 0.15, 0.35) },
  { id: 'vibe.treeGreen', metric: 'Green vibe from 50 trees planted near homes ÷ one park; share left after clearing them', target: '0.75–1.25 parks; ≤ 10% left after clearing', persona: 'probe', cities: 'saves', status: 'graded',
    why: 'Owner (2026-11-19): trees are a small, steady green push; clearing them takes it back.',
    evaluate: c => { const o = landOf(c); if (!('l' in o)) return o; const g = o.l.green; return g.parks === null ? NA('fewer than 50 free tiles near homes') : all({ parks: range(g.parks, 0.75, 1.25), left: range(g.left, -0.1, 0.1) }); } },
  { id: 'water.canal', metric: 'A 20-tile canal\'s price in days of the city\'s surplus', target: '1–5 days', persona: 'probe', cities: 'saves', status: 'graded',
    why: 'Owner (2026-11-19): reconnecting a cut-off port is worth doing.',
    evaluate: c => { const o = landOf(c); if (!('l' in o)) return o; if (o.l.surplus <= 0) return NA('the city runs at a loss'); return o.l.canalDays === null ? NA('no 20-tile site') : range(o.l.canalDays, 1, 5); } },
  { id: 'water.reclaim', metric: 'Filling a 10×10 block of water: share of 30 days of the city\'s surplus', target: '25–100%', persona: 'probe', cities: 'saves', status: 'graded',
    why: 'Owner (2026-11-19): reclaiming land is a project, not a whim.',
    evaluate: c => { const o = landOf(c); if (!('l' in o)) return o; if (o.l.surplus <= 0) return NA('the city runs at a loss'); return o.l.reclaimShare === null ? NA('no 10×10 block of water') : range(o.l.reclaimShare, 0.25, 1); } },
];

export const TARGETS: Target[] = [
  ...PC_TARGETS.map(t => ({ ...t, suite: 'pc' as const })),
  ...ECON_TARGETS.map(t => ({ ...t, suite: 'econ' as const })),
  ...SVC_TARGETS.map(t => ({ ...t, suite: 'svc' as const })),
  ...TRADE_TARGETS.map(t => ({ ...t, suite: 'trade' as const })),
  ...TAXDEBT_TARGETS.map(t => ({ ...t, suite: 'taxdebt' as const })),
  ...AIRPORT_TARGETS.map(t => ({ ...t, suite: 'airport' as const })),
  ...RAIL_TARGETS.map(t => ({ ...t, suite: 'rail' as const })),
  ...LANDSCAPE_TARGETS.map(t => ({ ...t, suite: 'landscape' as const })),
];
