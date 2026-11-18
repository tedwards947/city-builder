import './pcOffBaseline';
import { describe, it, expect, afterEach } from 'vitest';
import { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { ZONE_R, BUILDING_PARK, BUILDING_SCHOOL, TERRAIN_GRASS } from '../sim/constants';
import { ServiceSystem } from '../sim/systems/ServiceSystem';
import { REQUEST_KINDS, requestConfig, neighbourhoods, pickRequest, isMet, openRequest, meetRequest, failRequest, neediestFor, requestProgress, planRequest, observeRequests } from '../sim/requests';
import { RequestSystem } from '../sim/systems/RequestSystem';

const cfg = requestConfig();
const saved = structuredClone(cfg);
afterEach(() => {
  const { kinds: _k, ...scalars } = saved;
  Object.assign(cfg, scalars);
  for (const k of Object.keys(saved.kinds)) Object.assign(cfg.kinds[k], saved.kinds[k]);
});

/** A 24×24 map with two 5×5 blocks of homes (one per 12×12 cell), each with a park in the middle; every coverage on. */
function city(): World {
  const w = new World(24, 24, 7);
  const L = w.layers;
  L.terrain.fill(TERRAIN_GRASS);                                 // no water where the test builds
  for (let y = 3; y < 8; y++) {
    for (const x0 of [1, 13]) {
      for (let x = x0; x < x0 + 5; x++) {
        const i = y * 24 + x;
        L.zone[i] = ZONE_R; L.devLevel[i] = 1;
        L.school[i] = L.hospital[i] = L.police[i] = L.fireStation[i] = L.power[i] = L.water[i] = 1;
      }
    }
  }
  // A street along row 8 under both blocks; a park on it under each block's middle (coverage runs along roads).
  for (let x = 0; x < 24; x++) w.setRoad(x, 8, 1);
  w.placeBuilding(3, 9, BUILDING_PARK);
  w.placeBuilding(15, 9, BUILDING_PARK);
  w.budget.politicalCapital = 50;
  return w;
}
function noParks(w: World): void { w.clearTile(3, 9); w.clearTile(15, 9); }
function runDays(w: World, sys: RequestSystem, days: number): void {
  for (let d = 0; d < days * BALANCE.ticksPerDay; d++) { w.tick++; sys.update(w); }
}

describe('request registry', () => {
  it('has the six kinds, switched off with PC off', () => {
    expect(REQUEST_KINDS.map((k) => k.id)).toEqual(['park', 'police', 'fire', 'school', 'hospital', 'utilities', 'trafficJam', 'blight']);
    expect(cfg.spawnEveryDays).toBe(0);
    for (const k of REQUEST_KINDS) expect(cfg.kinds[k.id]).toMatchObject({ days: 0, reward: 0, penalty: 0 });
  });

  it('finds the neighbourhoods and scores need from their own tiles', () => {
    const w = city();
    const areas = neighbourhoods(w);
    expect(areas).toEqual([{ x0: 1, y0: 3, x1: 5, y1: 7 }, { x0: 13, y0: 3, x1: 17, y1: 7 }]);
    const park = REQUEST_KINDS.find((k) => k.id === 'park')!;
    expect(park.need(w, areas[0])).toBeCloseTo(20 / 25);    // road coverage: only the row of homes on the park's street
    w.clearTile(3, 9);                                          // the left park goes
    expect(park.need(w, areas[0])).toBe(1);
    w.layers.abandoned[5 * 24 + 15] = 1;
    expect(REQUEST_KINDS.find((k) => k.id === 'blight')!.need(w, areas[1])).toBeCloseTo(1 / 25);
  });
});

describe('RequestSystem', () => {
  it('opens nothing and draws no randomness while switched off', () => {
    const w = city();
    noParks(w);
    const twin = city();
    noParks(twin);
    const next = twin.rng();                                     // the same city, never run
    runDays(w, new RequestSystem(), 30);
    expect(w.politics.requests).toEqual([]);
    expect(w.rng()).toBe(next);
  });

  it('asks where the need is, then rewards meeting it', () => {
    Object.assign(cfg, { spawnEveryDays: 1, randomness: 0 });
    // A park on the street serves only the row beside it (need 0.8), so: ask only with no park at all, met by one.
    Object.assign(cfg.kinds.park, { days: 10, reward: 15, penalty: 5, askAt: 0.9, metAt: 0.85 });
    const w = city();
    w.clearTile(3, 9);                                          // only the left neighbourhood lacks a park
    const log: string[] = [];
    for (const e of ['requestOpened', 'requestMet', 'requestFailed'] as const) w.events.on(e, (p) => log.push(`${e}:${p.kind}:${p.x0}`));
    const sys = new RequestSystem();
    runDays(w, sys, 1);
    expect(w.politics.requests).toHaveLength(1);
    expect(w.politics.requests[0]).toMatchObject({ id: 1, kind: 'park', y1: 7 });
    expect(isMet(w, w.politics.requests[0])).toBe(false);
    w.placeBuilding(3, 9, BUILDING_PARK);
    runDays(w, sys, 1);
    expect(w.politics.requests).toEqual([]);
    expect(w.budget.politicalCapital).toBe(65);
    expect(log).toEqual(['requestOpened:park:1', 'requestMet:park:1']);
  });

  it('charges the penalty at the deadline, never into debt, and keeps at most maxOpen', () => {
    Object.assign(cfg, { spawnEveryDays: 1, maxOpen: 1 });
    Object.assign(cfg.kinds.park, { days: 3, penalty: 8 });
    const w = city();
    noParks(w);                                     // both neighbourhoods lack a park
    w.budget.politicalCapital = 5;
    const sys = new RequestSystem();
    runDays(w, sys, 2);
    expect(w.politics.requests).toHaveLength(1);                // maxOpen
    runDays(w, sys, 2);
    expect(w.budget.politicalCapital).toBe(0);                  // took 5 of the 8
    expect(w.politics.requests.length).toBeLessThanOrEqual(1);
  });

  it('picks the same request for the same seed', () => {
    Object.assign(cfg.kinds.park, { days: 10 });
    const w1 = city(), w2 = city();
    noParks(w1); noParks(w2);
    const p1 = pickRequest(w1, w1.rng);
    expect(p1).not.toBeNull();
    expect(p1).toEqual(pickRequest(w2, w2.rng));
  });

  it('goes quiet when no neighbourhood needs anything badly enough', () => {
    Object.assign(cfg, { spawnEveryDays: 1 });
    const w = city();                                            // parks, schools, police… all there
    runDays(w, new RequestSystem(), 10);
    expect(w.politics.requests).toEqual([]);
  });

  it('asks for power and water during a shortage, once for the city, met once it has stayed ended', () => {
    Object.assign(cfg, { spawnEveryDays: 1, maxOpen: 3 });
    Object.assign(cfg.kinds.utilities, { days: 30, reward: 10 });
    const w = city();
    const sys = new RequestSystem();
    // Shortage: stats are set by the power and water systems, which this test does not run.
    Object.assign(w.stats, { powerSupply: 10, powerDemand: 20, waterSupply: 50, waterDemand: 20 });
    runDays(w, sys, 3);
    expect(w.politics.requests.map((r) => r.kind)).toEqual(['utilities']); // city-wide: only one
    w.stats.powerSupply = 30;
    runDays(w, sys, 3);                         // averaged over 3 days, then held: not met on the first quiet days
    expect(w.politics.requests.map((r) => r.kind)).toEqual(['utilities']);
    expect(w.budget.politicalCapital).toBe(50);
    runDays(w, sys, 1);
    expect(w.politics.requests).toEqual([]);
    expect(w.budget.politicalCapital).toBe(60);
  });
});

describe('picking', () => {
  it('gives every eligible kind a turn, weighted toward the worst need', () => {
    Object.assign(cfg.kinds.park, { days: 10 });
    Object.assign(cfg.kinds.blight, { days: 10 });
    const w = city();
    noParks(w);                                      // park need 1 in both neighbourhoods
    for (const x of [13, 14]) w.layers.abandoned[5 * 24 + x] = 1; // blight 2/25 = 0.08 on the right…
    for (const x of [15, 16, 17]) w.layers.abandoned[6 * 24 + x] = 1; // …now 5/25 = 0.2, above askAt 0.1
    const counts: Record<string, number> = {};
    let seed = 1;
    const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let k = 0; k < 600; k++) {
      const p = pickRequest(w, rng)!;
      counts[p.kind] = (counts[p.kind] ?? 0) + 1;
      if (p.kind === 'blight') expect(p.area.x0).toBe(13);
    }
    expect(Object.keys(counts).sort()).toEqual(['blight', 'park']);
    // Weighted by worst need: about 1 : 0.2.
    expect(counts.blight / 600).toBeGreaterThan(0.08);
    expect(counts.blight / 600).toBeLessThan(0.28);
  });

  it('skips kinds whose days are 0 (switched off)', () => {
    const w = city();
    noParks(w);                                      // park need 1…
    w.layers.police.fill(0);                                     // …and police need 1
    Object.assign(cfg.kinds.park, { days: 6 });                  // only park is switched on
    for (let k = 0; k < 50; k++) expect(pickRequest(w, w.rng)?.kind).toBe('park');
  });
});

describe('debug helpers', () => {
  it('open the neediest neighbourhood for a kind, then meet or fail it by hand', () => {
    Object.assign(cfg.kinds.park, { reward: 10, penalty: 4 });
    const w = city();
    w.clearTile(15, 9);                                          // the right neighbourhood loses its park
    const area = neediestFor(w, 'park')!;
    expect(area.x0).toBe(13);
    const log: string[] = [];
    for (const e of ['requestOpened', 'requestMet', 'requestFailed'] as const) w.events.on(e, (p) => log.push(`${e}:${p.id}`));
    const a = openRequest(w, 'park', area, 5, 1);
    const b = openRequest(w, 'park', neighbourhoods(w)[0], 5, 1);
    expect(a.deadlineTick).toBe(w.tick + 5 * BALANCE.ticksPerDay);
    meetRequest(w, a);
    failRequest(w, b);
    meetRequest(w, a);                                           // already closed: nothing
    expect(w.politics.requests).toEqual([]);
    expect(w.budget.politicalCapital).toBe(50 + 10 - 4);
    expect(log).toEqual(['requestOpened:1', 'requestOpened:2', 'requestMet:1', 'requestFailed:2']);
  });
});

describe('met rule and progress', () => {
  /** Police cover over the first `n` of the left block's 25 homes (row by row). */
  function policed(w: World, n: number): void {
    let k = 0;
    for (let y = 3; y < 8; y++) for (let x = 1; x < 6; x++) w.layers.police[y * 24 + x] = k++ < n ? 1 : 0;
  }

  it('is met once the gap has halved, or the target is reached, but not by standing still', () => {
    Object.assign(cfg.kinds.police, { metAt: 0.1 });
    const w = city();
    const area = neighbourhoods(w)[0];
    policed(w, 5);                                               // need 20/25 = 0.8
    const req = openRequest(w, 'police', area, 10, 0.8);
    expect(isMet(w, req)).toBe(false);
    policed(w, 15);                                              // need 0.4: halved
    expect(isMet(w, req)).toBe(true);
    const tiny = openRequest(w, 'police', area, 10, 0.08);       // opened already under the target
    policed(w, 23);                                              // need 0.08, unchanged
    expect(isMet(w, tiny)).toBe(true);                           // target reached counts
    Object.assign(cfg.kinds.police, { metAt: 0 });
    expect(isMet(w, tiny)).toBe(false);                          // half-gap rule alone: no change, no credit
  });

  it('reports progress in the shape the quest log reads', () => {
    Object.assign(cfg.kinds.police, { metAt: 0.1, reward: 10, penalty: 5 });
    const w = city();
    policed(w, 5);
    const req = openRequest(w, 'police', neighbourhoods(w)[0], 10, 0.8);
    policed(w, 10);                                              // need 0.6
    w.tick += 3 * BALANCE.ticksPerDay;
    const p = requestProgress(w, req);
    expect(p).toMatchObject({ unit: 'homes', units: 25, met: false, daysLeft: 7, reward: 10, penalty: 5 });
    expect(p.covered).toBeCloseTo(0.4);
    expect(p.coveredAtOpen).toBeCloseTo(0.2);
    expect(p.coveredNeeded).toBeCloseTo(0.6);                    // 1 − max(0.1, 0.8 / 2)
  });

  it('pays a met request in full, even over the cap', () => {
    Object.assign(cfg.kinds.park, { reward: 15 });
    const w = city();
    w.budget.politicalCapital = 98;                              // cap is 100 in a new city
    const req = openRequest(w, 'park', neighbourhoods(w)[0], 5, 1);
    meetRequest(w, req);
    expect(w.budget.politicalCapital).toBe(113);
  });
});


describe('road-shaped clusters (coverage kinds)', () => {
  /**
   * One 12×12 cell, two separate road branches: a street along row 3 with
   * homes on row 2, and a street along row 9 with homes on row 8 (x 1–8 each).
   * The streets don't meet, so a school on one branch can't reach the other.
   */
  function twoBranches(): World {
    const w = new World(24, 24, 3);
    w.layers.terrain.fill(TERRAIN_GRASS);
    for (const row of [3, 9]) for (let x = 0; x < 10; x++) w.setRoad(x, row, 1);
    for (const row of [2, 8]) for (let x = 1; x <= 8; x++) {
      const i = row * 24 + x;
      w.layers.zone[i] = ZONE_R; w.layers.devLevel[i] = 1;
    }
    return w;
  }
  const rowOf = (i: number) => Math.floor(i / 24);

  it('asks only for the homes the seed can reach by road, not the whole box', () => {
    Object.assign(cfg.kinds.school, { days: 20 });
    const w = twoBranches();
    const plan = planRequest(w, 'school', neighbourhoods(w)[0], w.rng)!;
    expect(plan.homes!.length).toBe(8);                          // one branch, not 16
    const row = rowOf(plan.seed!);
    expect(plan.homes!.every((i) => rowOf(i) === row)).toBe(true);
    expect(plan.area).toEqual({ x0: 1, y0: row, x1: 8, y1: row });
    expect(plan.need).toBe(1);
  });

  it('is met by one school beside the seed’s road', () => {
    Object.assign(cfg.kinds.school, { days: 20, reward: 10 });
    const w = twoBranches();
    const plan = planRequest(w, 'school', neighbourhoods(w)[0], w.rng)!;
    const req = openRequest(w, 'school', plan.area, 20, plan.need, plan);
    expect(isMet(w, req)).toBe(false);
    // A school across the street from the seed, touching the same road.
    const sx = plan.seed! % 24, sy = rowOf(plan.seed!) + 2;
    expect(w.placeBuilding(sx, sy, BUILDING_SCHOOL)).toBe(true);
    new ServiceSystem().update(w);
    // School requests are durable: every home has a seat at once, and it is met after holding three daily checks.
    expect(requestProgress(w, req)).toMatchObject({ met: false, heldDays: 0, holdDays: 3, unmetFull: 0, unmetOutOfReach: 0 });
    const sys = new RequestSystem();
    runDays(w, sys, 2);
    expect(isMet(w, req)).toBe(false);
    observeRequests(w);                         // the third day's reading, without resolving
    expect(isMet(w, req)).toBe(true);
    expect(requestProgress(w, req)).toMatchObject({ met: true, units: 8, homes: plan.homes, unmetFull: 0, unmetOutOfReach: 0, unmetReason: null });
  });

  it('says whether the asking homes are out of reach or turned away by a full school', () => {
    const capacity = BALANCE.service.capacity as Record<number, number>;
    const shipped = capacity[BUILDING_SCHOOL];
    try {
      Object.assign(cfg.kinds.school, { days: 20 });
      const w = twoBranches();
      const plan = planRequest(w, 'school', neighbourhoods(w)[0], w.rng)!;
      const req = openRequest(w, 'school', plan.area, 20, plan.need, plan);
      // No school anywhere: every asking home is out of reach.
      expect(requestProgress(w, req)).toMatchObject({ unmetFull: 0, unmetOutOfReach: 8, unmetReason: 'outOfReach' });

      // A school on the seed's road with seats for three of the eight homes: the other five find it full.
      const residents = BALANCE.growth.popPerLevel[w.layers.devLevel[plan.seed!] as 1 | 2 | 3];
      capacity[BUILDING_SCHOOL] = 3 * residents;
      expect(w.placeBuilding(plan.seed! % 24, rowOf(plan.seed!) + 2, BUILDING_SCHOOL)).toBe(true);
      new ServiceSystem().update(w);
      const p = requestProgress(w, req);
      expect(p).toMatchObject({ unmetFull: 5, unmetOutOfReach: 0, unmetReason: 'full' });
      expect(p.covered).toBeCloseTo(3 / 8);
    } finally {
      capacity[BUILDING_SCHOOL] = shipped;
    }
  });
});
