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
import type { RunSummary } from './lab';
import type { StaticProbes } from './probes';

export type Status = 'graded' | 'later';
export type Suite = 'pc' | 'econ';

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
  const vals = Object.values(parts);
  if (!vals.length) return NA('nothing measured');
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
  { id: 'pc.refill', metric: 'Game days for the Planner\'s city, left alone, to regenerate from 0 PC to the cap', target: '60–90 days (4–6 min at 1×)', persona: 'planner', cities: 'all', status: 'graded',
    why: 'Decision 2026-11-15: a happy city refills in about 5 minutes at 1×.',
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
      return [[k + '.overlap', range(p?.overlapPay, -Infinity, 0.5)], [k + '.new', range(p?.newPay, 0.8)]];
    }))) },
  { id: 'pc.move', metric: 'Net PC to move a service (open a second on the free lot that serves most of the first one\'s homes, close the first) ÷ cap; negative = a cost', target: 'cost ≤ 0.05 each', persona: 'probe', cities: 'all', status: 'graded',
    why: 'Moving a service is cheap. The second site overlaps the first (owner, 2026-11-17), so the probe measures a move, not stranding homes.',
    evaluate: c => all(Object.fromEntries(['school', 'hospital', 'police'].map(k => [k, range((c.probes?.['ribbon:' + k] as { moveNet?: number } | undefined)?.moveNet, -0.05)]))) },
  { id: 'pc.closure.lonely', metric: 'Closing the city\'s only hospital ÷ cap', target: '≥ 0.3', persona: 'probe', cities: 'all', status: 'graded',
    why: 'A closure should hurt.',
    evaluate: c => range((c.probes?.['ribbon:hospital'] as { closeLast?: number } | undefined)?.closeLast, 0.3) },
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
  { id: 'pc.request.chaser', metric: 'Share of requests the Request-chaser meets. Coverage and utilities: one building each (leaving out coverage requests it skips because no free lot within 10 tiles could serve half the asking homes). Traffic jams: a plan over several passes (avenues, then a wider ring and the next bottlenecks)', target: 'coverage + utilities ≥ 70%; traffic jams ≥ 50%', persona: 'chaser', cities: 'all', status: 'graded',
    why: 'Requests should be doable. Some in built-up areas are not worth meeting, and a sensible player skips them (owner, 2026-11-17). Traffic jams are meant to be hard (the principle above): the check is that a deliberate plan resolves most of them, not that one upgrade does. The 50% is a proposal for the owner.',
    evaluate: c => {
      const r = c.runs.chaser; if (!r) return NA('not run');
      const pick = (o: Record<string, number>, ks: string[]) => ks.reduce((a, k) => a + (o[k] ?? 0), 0);
      const ks = [...COVERAGE_KINDS, 'utilities'];
      const m = pick(r.requests.met, ks), f = pick(r.requests.failed, ks) - r.skippedFailed;
      const tm = r.requests.met.trafficJam ?? 0, tf = r.requests.failed.trafficJam ?? 0;
      const parts: Record<string, Outcome> = {};
      if (m + f) parts.coverage = range(m / (m + f), 0.7);
      if (tm + tf) parts.trafficJam = range(tm / (tm + tf), 0.5);
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
    evaluate: c => { const e = econ(c); return e ? range(e.longestDebtRun, 0, 30) : NA('not run'); } },
  { id: 'econ.matureSurplus', metric: 'A mature city\'s (income − expenses) ÷ expenses per day, mean of the last 30 days', target: '0.10–0.25', persona: 'planner (own money)', cities: 'saved and generated', status: 'graded',
    why: 'Owner: a mature city should earn, but big projects should still take saving.',
    evaluate: c => { if (c.cityKind === 'fresh') return NA('not a mature city'); const e = econ(c); return e ? { ...range(e.surplusLate, 0.1, 0.25), note: `income ${e.incomeLate}/day, expenses ${e.expensesLate}/day; tax ×${e.taxForMidSurplus} would centre it` } : NA('not run'); } },
  { id: 'econ.sink', metric: 'Money gained over the run ÷ expenses per day at the end (days of expenses banked; 300 days fresh, 150 saved)', target: '≤ 40', persona: 'planner (own money)', cities: 'all', status: 'graded',
    why: 'Money must not pile up without limit (v0; the owner may adjust). 40 days over a 150-day run is a surplus of about 0.25, the top of econ.matureSurplus.',
    evaluate: c => { const e = econ(c); return e ? { ...range(e.gainInDaysOfExpenses, -Infinity, 40), note: `money ${e.moneyStart} → ${e.moneyEnd}` } : NA('not run'); } },
];

export const TARGETS: Target[] = [
  ...PC_TARGETS.map(t => ({ ...t, suite: 'pc' as const })),
  ...ECON_TARGETS.map(t => ({ ...t, suite: 'econ' as const })),
];
