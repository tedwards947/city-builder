// Durable requests: a kind whose need swings by itself (traffic) asks only on
// a need that has lasted, and is met only once the fix has held. The rule is
// per kind (smoothDays / holdDays); these tests switch it on for blight, whose
// need a test can set exactly.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { ZONE_R, TERRAIN_GRASS } from '../sim/constants';
import { requestConfig, openRequest, requestProgress, isMet, smoothDaysOf, holdDaysOf, type Rect } from '../sim/requests';
import { RequestSystem } from '../sim/systems/RequestSystem';
import { serialize, deserialize } from '../persistence/Serializer';

const cfg = requestConfig();
const saved = structuredClone(cfg);
const blight = cfg.kinds.blight;

beforeEach(() => {
  Object.assign(blight, { days: 30, reward: 10, penalty: 4, smoothDays: 3, holdDays: 3 });
});
afterEach(() => {
  const { kinds: _k, ...scalars } = saved;
  Object.assign(cfg, scalars);
  delete blight.smoothDays; delete blight.holdDays;
  for (const k of Object.keys(saved.kinds)) Object.assign(cfg.kinds[k], saved.kinds[k]);
});

const AREA: Rect = { x0: 1, y0: 3, x1: 5, y1: 7 };

/** One 5×5 block of homes: a single neighbourhood of 25 lots. */
function city(): World {
  const w = new World(24, 24, 7);
  w.layers.terrain.fill(TERRAIN_GRASS);
  for (let y = 3; y < 8; y++) for (let x = 1; x < 6; x++) {
    const i = y * 24 + x;
    w.layers.zone[i] = ZONE_R; w.layers.devLevel[i] = 1;
  }
  w.budget.politicalCapital = 50;
  return w;
}
/** Abandon `n` lots inside the block (not its corners, so the neighbourhood keeps its outline): blight need n / 25. */
function ruin(w: World, n: number): void {
  const inner: number[] = [];
  for (let y = 4; y < 7; y++) for (let x = 1; x < 6; x++) inner.push(y * 24 + x);
  inner.forEach((i, k) => { w.layers.abandoned[i] = k < n ? 1 : 0; });
}
function runDays(w: World, sys: RequestSystem, days: number): void {
  for (let d = 0; d < days * BALANCE.ticksPerDay; d++) { w.tick++; sys.update(w); }
}

describe('durable requests', () => {
  it('ship on for traffic only: three days to ask, three days held to be met', () => {
    expect(saved.kinds.trafficJam).toMatchObject({ smoothDays: 3, holdDays: 3 });
    expect(smoothDaysOf('trafficJam')).toBe(3);
    expect(holdDaysOf('trafficJam')).toBe(3);
    for (const k of ['park', 'police', 'fire', 'school', 'hospital', 'utilities']) {
      expect(smoothDaysOf(k)).toBe(1);
      expect(holdDaysOf(k)).toBe(1);
    }
  });

  it('does not ask on a one-day spike, only on a need that has lasted', () => {
    Object.assign(cfg, { spawnEveryDays: 1, maxOpen: 3 });
    const w = city();
    const sys = new RequestSystem();
    runDays(w, sys, 3);                         // three quiet readings
    ruin(w, 6);                                 // 0.24, well above askAt 0.1, for one day
    runDays(w, sys, 1);
    ruin(w, 0);
    runDays(w, sys, 4);
    expect(w.politics.requests).toEqual([]);

    ruin(w, 6);                                 // and now it stays
    runDays(w, sys, 1);                         // average 0.08: not yet
    expect(w.politics.requests).toEqual([]);
    runDays(w, sys, 1);                         // average 0.16
    expect(w.politics.requests.map((r) => r.kind)).toEqual(['blight']);
    const r = w.politics.requests[0];
    expect(r.needAtOpen).toBeCloseTo(0.16);     // opens at the averaged need, with its readings
    expect(r.samples).toEqual([0, 0.24, 0.24]);
  });

  it('is not met by a dip of a day or two', () => {
    const w = city();
    const sys = new RequestSystem();
    ruin(w, 5);
    const r = openRequest(w, 'blight', AREA, 30, 0.2);
    runDays(w, sys, 3);
    ruin(w, 0);                                 // the need vanishes…
    runDays(w, sys, 2);
    ruin(w, 5);                                 // …and comes back
    runDays(w, sys, 5);
    expect(w.politics.requests).toEqual([r]);
    expect(r.heldDays).toBe(0);
    expect(w.budget.politicalCapital).toBe(50);
  });

  it('is met once the averaged need has passed on three daily checks in a row; a relapse starts the count again', () => {
    const w = city();
    const sys = new RequestSystem();
    ruin(w, 5);
    const r = openRequest(w, 'blight', AREA, 30, 0.2);
    runDays(w, sys, 3);                         // readings 0.2, 0.2, 0.2
    ruin(w, 0);
    runDays(w, sys, 1);                         // average 0.133: above half the opening need
    expect(r.heldDays).toBe(0);
    runDays(w, sys, 2);                         // 0.067, then 0: two days held
    expect(r.heldDays).toBe(2);
    let p = requestProgress(w, r);
    expect([p.met, p.heldDays, p.holdDays]).toEqual([false, 2, 3]);
    expect(p.covered).toBe(1);
    expect(isMet(w, r)).toBe(false);

    ruin(w, 10);                                // a relapse: average 0.133
    runDays(w, sys, 1);
    expect(r.heldDays).toBe(0);
    ruin(w, 0);
    runDays(w, sys, 4);                         // 0.133, 0.133, then 0 twice: two days held
    expect(w.politics.requests).toEqual([r]);
    p = requestProgress(w, r);
    expect(p.heldDays).toBe(2);
    runDays(w, sys, 1);
    expect(w.politics.requests).toEqual([]);
    expect(w.budget.politicalCapital).toBe(60);
  });

  it('keeps the timer: unfixed, it fails at the deadline; part-way through its hold, it is not failed by the clock', () => {
    const sys = new RequestSystem();
    const unfixed = city();
    ruin(unfixed, 5);
    openRequest(unfixed, 'blight', AREA, 4, 0.2);
    runDays(unfixed, sys, 4);
    expect(unfixed.politics.requests).toEqual([]);
    expect(unfixed.budget.politicalCapital).toBe(46);

    const fixedLate = city();
    ruin(fixedLate, 5);
    const r = openRequest(fixedLate, 'blight', AREA, 4, 0.2);
    runDays(fixedLate, sys, 2);                 // readings 0.2, 0.2
    ruin(fixedLate, 0);
    runDays(fixedLate, sys, 2);                 // 0.133, then 0.067: held 1 on deadline day
    expect(fixedLate.politics.requests).toEqual([r]);
    runDays(fixedLate, sys, 2);
    expect(fixedLate.politics.requests).toEqual([]);
    expect(fixedLate.budget.politicalCapital).toBe(60);
  });

  it('saves the readings and the days held', () => {
    const w = city();
    ruin(w, 5);
    const r = openRequest(w, 'blight', AREA, 30, 0.2);
    runDays(w, new RequestSystem(), 3);
    ruin(w, 0);
    runDays(w, new RequestSystem(), 2);
    const back = deserialize(serialize(w)).politics.requests[0];
    expect(back.samples).toEqual(r.samples);
    expect(back.heldDays).toBe(1);
    expect(back.samples).not.toBe(r.samples);
  });
});
