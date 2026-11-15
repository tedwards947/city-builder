// Traffic on a realistic mid-size city (fixtures/testCity.ts): it has to
// settle quickly and stay put, including after edits, at the shipped balance.

import { describe, it, expect } from 'vitest';
import type { World } from '../sim/World';
import { TransitSystem } from '../sim/systems/TransitSystem';
import { trafficVolume, roadCapacity } from '../sim/TrafficData';
import { BALANCE } from '../data/balance';
import { ROAD_STREET, ROAD_AVENUE } from '../sim/constants';
import { buildCity, population } from './fixtures/testCity';

const interval = BALANCE.transit.flowInterval;

function loads(w: World): number[] {
  const d = w.traffic!;
  return Array.from(w.layers.roadClass, (rc, i) => (rc ? trafficVolume(d, i) / roadCapacity(rc) : 0));
}
/** Road tiles whose load changed by more than `by` × capacity. */
function shifted(a: number[], b: number[], by: number): number {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > by) n++;
  return n;
}

function start() {
  const { world: w } = buildCity();
  const sys = new TransitSystem();
  let pass = 0;
  const step = () => { pass++; w.tick = interval * pass; sys.update(w); };
  const settle = () => { let n = 0; while (!w.traffic!.settled && n < 30) { step(); n++; } return n; };
  step();
  const firstSettle = settle();
  const roads = w.layers.roadClass.reduce((n, rc) => n + (rc ? 1 : 0), 0);
  return { w, sys, step, settle, firstSettle, roads };
}

describe('traffic on the 6,500-person test city', () => {
  it('is the city it claims to be', () => {
    const { world: w } = buildCity();
    expect(population(w)).toBeGreaterThan(6000);
    expect(population(w)).toBeLessThan(7000);
  });

  it('settles within a couple of passes on load', () => {
    const { w, firstSettle } = start();
    expect(w.traffic!.settled).toBe(true);
    expect(firstSettle).toBeLessThanOrEqual(2);
  });

  it('a one-tile road stub settles within two passes and barely moves anything', () => {
    const { w, sys, settle, roads } = start();
    const before = loads(w);
    w.layers.roadClass[w.grid.idx(49, 60)] = ROAD_STREET;
    sys.refreshIfRoadsChanged(w);
    expect(settle()).toBeLessThanOrEqual(2);
    expect(shifted(before, loads(w), 0.25)).toBeLessThan(roads * 0.01);
  });

  it('a big road change settles within two passes and then stays put', () => {
    const { w, sys, step, settle, roads } = start();
    // Upgrade a whole downtown street to an avenue: a real reroute.
    for (let x = 50; x <= 80; x++) w.layers.roadClass[w.grid.idx(x, 59)] = ROAD_AVENUE;
    sys.refreshIfRoadsChanged(w);
    expect(settle()).toBeLessThanOrEqual(2);
    const settled = loads(w);
    for (let k = 0; k < 5; k++) step();          // nothing changes: nothing should move
    expect(shifted(settled, loads(w), 0.01)).toBe(0);
    expect(roads).toBeGreaterThan(1000);
  });

  it('zones growing one at a time do not set the rest of the city shifting', () => {
    const { w, step, roads } = start();
    const before = loads(w);
    for (let k = 0; k < 10; k++) {
      const i = w.grid.idx(7 + k * 2, 9);
      if (w.layers.zone[i] !== 0) w.layers.devLevel[i] = Math.min(3, w.layers.devLevel[i] + 1);
      step();
    }
    // Ten small changes in one suburb: a few roads there change, not hundreds.
    expect(shifted(before, loads(w), 0.25)).toBeLessThan(roads * 0.05);
  });
});
