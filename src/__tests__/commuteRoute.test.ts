import { describe, it, expect } from 'vitest';
import { World } from '../sim/World';
import { TransitSystem } from '../sim/systems/TransitSystem';
import { BALANCE } from '../data/balance';
import { lotTrips, tripGrade } from '../render/clay/commuteRoute';
import { commuteProblem, cutOffProblem, LONG_COMMUTE_ACCESS } from '../render/clay/problemPins';
import { ZONE_R, ZONE_C, ZONE_I, ROAD_STREET } from '../sim/constants';

/** One street along row 5 with a home at x = 2, a shop at `shopX` and (optionally) a factory at `jobX`. */
function street(shopX: number, jobX = -1): { w: World; home: number; shop: number } {
  const w = new World(64, 12, 0);
  w.layers.terrain.fill(0); w.layers.vegetation.fill(0);
  for (let x = 1; x < 63; x++) w.layers.roadClass[5 * 64 + x] = ROAD_STREET;
  const lot = (x: number, zone: number): number => { const i = 4 * 64 + x; w.layers.zone[i] = zone; w.layers.devLevel[i] = 1; return i; };
  const home = lot(2, ZONE_R), shop = lot(shopX, ZONE_C);
  if (jobX >= 0) lot(jobX, ZONE_I);
  w.tick = BALANCE.transit.flowInterval;
  new TransitSystem().update(w);
  return { w, home, shop };
}

describe('commute trips', () => {
  it('gives a home a trip to work and to shops, and a business a trip to homes', () => {
    const { w, home, shop } = street(6, 10);
    const trips = lotTrips(w, home);
    expect(trips.map((t) => t.key)).toEqual(['jobs', 'shops']);
    expect(trips[1].time).toBeLessThan(trips[0].time); // the shop is nearer than the factory
    expect(trips[0].road).toBe(5 * 64 + 2);
    expect(lotTrips(w, shop).map((t) => t.key)).toEqual(['homes']);
  });

  it('reports nothing in reach as an infinite trip with no road', () => {
    const { w, home } = street(6);
    const jobs = lotTrips(w, home)[0];
    expect(jobs.time).toBe(Infinity);
    expect(jobs.road).toBe(-1);
  });

  it('has no trips before the first traffic pass or off a zone', () => {
    const { w, home } = street(6);
    expect(lotTrips(w, 0)).toEqual([]);
    w.traffic = null;
    expect(lotTrips(w, home)).toEqual([]);
  });

  it('flags a lot as a long commute exactly when its nearest trip grades red', () => {
    for (const shopX of [8, 22, 34, 44]) {
      const { w, home } = street(shopX);
      const nearest = Math.min(...lotTrips(w, home).map((t) => t.time));
      const access = w.layers.accessibility[home];
      if (access === 0) { expect(cutOffProblem(w, home)).toBe(true); continue; }
      // Rounding puts the two a hair apart right at the threshold; these distances are clear of it.
      expect(commuteProblem(w, home)).toBe(tripGrade(nearest) === 2);
      expect(access <= LONG_COMMUTE_ACCESS).toBe(tripGrade(nearest) === 2);
    }
  });
});
