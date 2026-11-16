import { describe, it, expect, afterEach } from 'vitest';
import { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { ZONE_R, BUILDING_PARK } from '../sim/constants';
import { REQUEST_KINDS, requestConfig, neighbourhoods, pickRequest, isMet } from '../sim/requests';
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
  for (let y = 3; y < 8; y++) {
    for (const x0 of [1, 13]) {
      for (let x = x0; x < x0 + 5; x++) {
        const i = y * 24 + x;
        L.zone[i] = ZONE_R; L.devLevel[i] = 1;
        L.school[i] = L.hospital[i] = L.police[i] = L.fireStation[i] = L.power[i] = L.water[i] = 1;
      }
    }
  }
  w.buildings.push({ tx: 3, ty: 5, kind: BUILDING_PARK }, { tx: 15, ty: 5, kind: BUILDING_PARK });
  w.budget.politicalCapital = 50;
  return w;
}
function runDays(w: World, sys: RequestSystem, days: number): void {
  for (let d = 0; d < days * BALANCE.ticksPerDay; d++) { w.tick++; sys.update(w); }
}

describe('request registry', () => {
  it('has the six kinds, switched off', () => {
    expect(REQUEST_KINDS.map((k) => k.id)).toEqual(['park', 'schoolOrHospital', 'policeOrFire', 'utilities', 'trafficJam', 'blight']);
    expect(cfg.spawnEveryDays).toBe(0);
    for (const k of REQUEST_KINDS) expect(cfg.kinds[k.id]).toEqual({ days: 0, reward: 0, penalty: 0 });
  });

  it('finds the neighbourhoods and scores need from their own tiles', () => {
    const w = city();
    const areas = neighbourhoods(w);
    expect(areas).toEqual([{ x0: 1, y0: 3, x1: 5, y1: 7 }, { x0: 13, y0: 3, x1: 17, y1: 7 }]);
    const park = REQUEST_KINDS[0];
    expect(park.need(w, areas[0])).toBeCloseTo(4 / 25);     // only the corners are out of reach
    w.buildings.splice(0, 1);                                   // the left park goes
    expect(park.need(w, areas[0])).toBe(1);
    w.layers.abandoned[5 * 24 + 15] = 1;
    expect(REQUEST_KINDS[5].need(w, areas[1])).toBeCloseTo(1 / 25);
  });
});

describe('RequestSystem', () => {
  it('opens nothing and draws no randomness while switched off', () => {
    const w = city();
    w.buildings.length = 0;
    const next = new World(24, 24, 7).rng();
    runDays(w, new RequestSystem(), 30);
    expect(w.politics.requests).toEqual([]);
    expect(w.rng()).toBe(next);
  });

  it('asks where the need is, then rewards meeting it', () => {
    Object.assign(cfg, { spawnEveryDays: 1, randomness: 0 });
    Object.assign(cfg.kinds.park, { days: 10, reward: 15, penalty: 5 });
    const w = city();
    const leftPark = w.buildings.splice(0, 1)[0];               // only the left neighbourhood lacks a park
    const log: string[] = [];
    for (const e of ['requestOpened', 'requestMet', 'requestFailed'] as const) w.events.on(e, (p) => log.push(`${e}:${p.kind}:${p.x0}`));
    const sys = new RequestSystem();
    runDays(w, sys, 1);
    expect(w.politics.requests).toHaveLength(1);
    expect(w.politics.requests[0]).toMatchObject({ id: 1, kind: 'park', x0: 1, x1: 5 });
    expect(isMet(w, w.politics.requests[0])).toBe(false);
    w.buildings.push(leftPark);
    runDays(w, sys, 1);
    expect(w.politics.requests).toEqual([]);
    expect(w.budget.politicalCapital).toBe(65);
    expect(log).toEqual(['requestOpened:park:1', 'requestMet:park:1']);
  });

  it('charges the penalty at the deadline, never into debt, and keeps at most maxOpen', () => {
    Object.assign(cfg, { spawnEveryDays: 1, maxOpen: 1 });
    Object.assign(cfg.kinds.park, { days: 3, penalty: 8 });
    const w = city();
    w.buildings.length = 0;                                     // both neighbourhoods lack a park
    w.budget.politicalCapital = 5;
    const sys = new RequestSystem();
    runDays(w, sys, 2);
    expect(w.politics.requests).toHaveLength(1);                // maxOpen
    runDays(w, sys, 2);
    expect(w.budget.politicalCapital).toBe(0);                  // took 5 of the 8
    expect(w.politics.requests.length).toBeLessThanOrEqual(1);
  });

  it('picks the same request for the same seed', () => {
    const w1 = city(), w2 = city();
    w1.buildings.length = 0; w2.buildings.length = 0;
    expect(pickRequest(w1, w1.rng)).toEqual(pickRequest(w2, w2.rng));
  });
});
