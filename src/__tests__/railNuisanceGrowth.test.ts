// Rail phase 2 (D): track near homes costs political capital, and homes and shops near a working station grow faster.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { BUILDING_STATION, RAIL_ELEVATED, RAIL_GROUND, RAIL_SUBWAY, ROAD_STREET, ZONE_C, ZONE_I, ZONE_R } from '../sim/constants';
import { pcQuote, pcQuoteMany } from '../sim/politics';
import { stationGrowthMask } from '../sim/rail';
import { BuildTrackCommand } from '../commands/BuildTrackCommand';
import { autoRailPath, planAutoRail } from '../input/autoRail';
import { pcActionForTool } from '../ui/pcPreview';
import { TransitSystem } from '../sim/systems/TransitSystem';
import { ZoneGrowthSystem } from '../sim/systems/ZoneGrowthSystem';
import { landWorld, home } from './pcTestWorld';

const N = BALANCE.politicalCapital.nuisance;
const POP = BALANCE.growth.popPerLevel;
let w: World;
const at = (x: number, y: number) => w.grid.idx(x, y);

beforeEach(() => { w = landWorld(48); w.budget.money = 1_000_000; w.budget.politicalCapital = 100; });

describe('track near homes costs political capital', () => {
  it('ground track: each resident within the nuisance bands, by distance', () => {
    home(w, 10, 11, 2);        // 1 away: weight 1
    home(w, 10, 13, 3);        // 3 away: weight 0.6
    home(w, 10, 16, 2);        // 6 away: weight 0.3
    home(w, 10, 17, 2);        // 7 away: out of reach
    const q = pcQuote(w, { type: 'track', tx: 10, ty: 10, level: RAIL_GROUND });
    const rate = N.trackPerResident[RAIL_GROUND];
    expect(rate).toBe(0.01);
    expect(q.cost).toBeCloseTo(rate * (POP[2] * 1 + POP[3] * 0.6 + POP[2] * 0.3), 6);
    expect(q.parts.every(p => p.reason === 'nuisance')).toBe(true);
    expect(q.parts.length).toBe(3);
    expect(q.displacedPopulation).toBe(0);
    expect(q.affordable).toBe(true);
  });

  it('elevated costs half as much again; a subway costs nothing; so does track away from homes', () => {
    home(w, 10, 11, 3);
    const ground = pcQuote(w, { type: 'track', tx: 10, ty: 10, level: RAIL_GROUND }).cost;
    const elevated = pcQuote(w, { type: 'track', tx: 10, ty: 10, level: RAIL_ELEVATED }).cost;
    expect(ground).toBeGreaterThan(0);
    expect(elevated / ground).toBeCloseTo(1.5, 6);
    expect(pcQuote(w, { type: 'track', tx: 10, ty: 10, level: RAIL_SUBWAY }).cost).toBe(0);
    expect(pcQuote(w, { type: 'track', tx: 30, ty: 30, level: RAIL_GROUND }).cost).toBe(0);
  });

  it('track that cannot go there quotes nothing', () => {
    home(w, 10, 11, 3);
    w.layTrack(10, 10);
    expect(pcQuote(w, { type: 'track', tx: 10, ty: 10, level: RAIL_GROUND }).cost).toBe(0);   // already there
    expect(pcQuote(w, { type: 'track', tx: 10, ty: 11, level: RAIL_GROUND }).cost).toBe(0);   // a home: blocked
  });

  it('the command charges it, undo gives it back, and a city short of PC is refused', () => {
    home(w, 10, 11, 3);
    const cost = pcQuote(w, { type: 'track', tx: 10, ty: 10, level: RAIL_GROUND }).cost;
    const cmd = new BuildTrackCommand(10, 10);
    expect(cmd.execute(w)).toBe(true);
    expect(w.budget.politicalCapital).toBeCloseTo(100 - cost, 6);
    cmd.undo(w);
    expect(w.budget.politicalCapital).toBeCloseTo(100, 6);
    expect(w.getRail(10, 10)).toBe(0);
    w.budget.politicalCapital = cost / 2;
    const refused = new BuildTrackCommand(10, 10);
    expect(refused.execute(w)).toBe(false);
    expect(refused.failReason).toBe('politicalCapital');
    expect(w.getRail(10, 10)).toBe(0);
    // A subway under the same spot is never refused for PC.
    expect(new BuildTrackCommand(10, 10, RAIL_SUBWAY).execute(w)).toBe(true);
  });

  it('a line past a row of homes: the tool action and the Auto plan carry the whole cost', () => {
    for (let x = 8; x <= 27; x++) home(w, x, 11, 3);
    expect(pcActionForTool('rail', 10, 10)).toEqual({ type: 'track', tx: 10, ty: 10, level: RAIL_GROUND });
    expect(pcActionForTool('railElevated', 10, 10)).toEqual({ type: 'track', tx: 10, ty: 10, level: RAIL_ELEVATED });
    const tiles = Array.from({ length: 20 }, (_, k) => ({ tx: 8 + k, ty: 10 }));
    const line = pcQuoteMany(w, tiles.map(t => ({ type: 'track' as const, ...t, level: RAIL_GROUND })));
    expect(line.cost).toBeGreaterThan(20 * pcQuote(w, { type: 'track', tx: 8, ty: 10, level: RAIL_GROUND }).cost * 0.9);
    const plan = planAutoRail(w, autoRailPath(w, { tx: 8, ty: 10 }, { tx: 27, ty: 10 }));
    expect(plan.found).toBe(true);
    expect(plan.pc.cost).toBeCloseTo(line.cost, 6);
    // The same line through empty land costs nothing.
    expect(planAutoRail(w, autoRailPath(w, { tx: 8, ty: 30 }, { tx: 27, ty: 30 })).pc.cost).toBe(0);
  });
});

describe('growth near a station', () => {
  const T = BALANCE.transit as unknown as { flowInterval: number; buildings: Record<number, unknown> };
  const G = BALANCE.rail.stationGrowth as unknown as { radius: number; mult: number };
  const shippedRows = T.buildings, shippedG = { ...G };
  let transit: TransitSystem;
  const zone = (x: number, y: number, z: number, level: number) => {
    w.layers.zone[at(x, y)] = z; w.layers.devLevel[at(x, y)] = level; w.layers.landValue[at(x, y)] = 128;
  };
  const street = (y: number, x0: number, x1: number) => { for (let x = x0; x <= x1; x++) w.setRoad(x, y, ROAD_STREET); };
  const traffic = () => { for (let k = 1; k <= 12; k++) { w.tick = k * T.flowInterval; transit.update(w); } };

  // A suburb in the west and a town in the east, joined only by a line between two stations
  // (buildings at x 4–7 and x 38–41, y 11–13).
  function line(withTrack = true): void {
    street(10, 2, 12);
    for (let x = 4; x <= 9; x++) zone(x, 9, ZONE_R, 2);
    street(10, 36, 46);
    for (let x = 42; x <= 45; x++) zone(x, 9, ZONE_I, 3);
    w.placeBuilding(4, 11, BUILDING_STATION);
    w.placeBuilding(38, 11, BUILDING_STATION);
    if (withTrack) for (let x = 8; x <= 37; x++) w.layTrack(x, 12);
  }

  beforeEach(() => { T.buildings = {}; transit = new TransitSystem(); });
  afterEach(() => { T.buildings = shippedRows; Object.assign(G, shippedG); });

  it('marks the tiles within 4 of a station that has a road and riders', () => {
    line();
    traffic();
    const mask = stationGrowthMask(w)!;
    expect(mask).not.toBeNull();
    expect(mask[at(5, 9)]).toBe(1);           // 2 north of the building
    expect(mask[at(5, 7)]).toBe(1);           // 4 north
    expect(mask[at(5, 6)]).toBe(0);           // 5 north
    expect(mask[at(11, 11)]).toBe(1);         // 4 east of its east edge
    expect(mask[at(12, 11)]).toBe(0);
    expect(mask[at(9, 9)]).toBe(1);           // 2 east + 2 north of the corner
    expect(mask[at(10, 8)]).toBe(0);          // 3 east + 3 north
    expect(mask[at(40, 9)]).toBe(1);          // the town station is served too (riders arrive)
    expect(mask[at(24, 12)]).toBe(0);         // the line itself gives nothing
  });

  it('gives nothing round a station nobody uses, or with the bonus off', () => {
    line(false);                              // two stations, no track between
    traffic();
    expect(stationGrowthMask(w)).toBeNull();
    for (let x = 8; x <= 37; x++) w.layTrack(x, 12);
    traffic();
    expect(stationGrowthMask(w)).not.toBeNull();
    G.mult = 1;
    expect(stationGrowthMask(w)).toBeNull();
  });

  it('homes and shops beside a served station grow faster than the same ones far away; industry does not', () => {
    line();
    // Three matched pairs of level-1 lots, each on a street: near the suburb station and far from it.
    street(15, 2, 12); street(30, 2, 12);
    const near = { R: [] as number[], C: [] as number[], I: [] as number[] }, far = { R: [] as number[], C: [] as number[], I: [] as number[] };
    for (let x = 2; x <= 4; x++) { zone(x, 14, ZONE_R, 1); near.R.push(at(x, 14)); zone(x, 29, ZONE_R, 1); far.R.push(at(x, 29)); }
    for (let x = 5; x <= 7; x++) { zone(x, 14, ZONE_C, 1); near.C.push(at(x, 14)); zone(x, 29, ZONE_C, 1); far.C.push(at(x, 29)); }
    for (let x = 8; x <= 10; x++) { zone(x, 14, ZONE_I, 1); near.I.push(at(x, 14)); zone(x, 29, ZONE_I, 1); far.I.push(at(x, 29)); }
    traffic();
    const mask = stationGrowthMask(w)!;
    for (const i of [...near.R, ...near.C, ...near.I]) expect(mask[i]).toBe(1);
    for (const i of [...far.R, ...far.C, ...far.I]) expect(mask[i]).toBe(0);
    // Count level-ups over many ticks, putting every lot back to level 1 after each.
    G.mult = 4;                               // a big bonus, so the count is clear of chance
    const growth = new ZoneGrowthSystem();
    const ups = { nearR: 0, farR: 0, nearC: 0, farC: 0, nearI: 0, farI: 0 };
    const tally = (list: number[], key: keyof typeof ups) => { for (const i of list) if (w.layers.devLevel[i] > 1) { ups[key]++; w.layers.devLevel[i] = 1; } };
    // Power and water everywhere, and plenty of both.
    w.layers.power.fill(1); w.layers.water.fill(1);
    w.stats.powerSupply = 9999; w.stats.powerDemand = 0; w.stats.waterSupply = 9999; w.stats.waterDemand = 0;
    w.stats.sewageSupply = 9999; w.stats.sewageDemand = 0;
    for (let k = 0; k < 4000; k++) {
      // Same access and demand for every lot, so only the station differs.
      w.layers.accessibility.fill(255); w.stats.rDemand = 1; w.stats.cDemand = 1; w.stats.iDemand = 1;
      w.tick = (1000 + k) * BALANCE.growth.tickInterval;
      growth.update(w);
      tally(near.R, 'nearR'); tally(far.R, 'farR'); tally(near.C, 'nearC'); tally(far.C, 'farC'); tally(near.I, 'nearI'); tally(far.I, 'farI');
    }
    expect(ups.farR).toBeGreaterThan(10);
    expect(ups.nearR / ups.farR).toBeGreaterThan(2);
    expect(ups.nearC / ups.farC).toBeGreaterThan(2);
    expect(ups.nearI / ups.farI).toBeLessThan(1.6);
  });
});
