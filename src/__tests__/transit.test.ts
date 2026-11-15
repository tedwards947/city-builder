// TransitSystem — flow-based traffic. Small hand-built maps, exact numbers
// where the model makes them predictable.

import { describe, it, expect } from 'vitest';
import { World } from '../sim/World';
import { TransitSystem } from '../sim/systems/TransitSystem';
import { ZoneGrowthSystem } from '../sim/systems/ZoneGrowthSystem';
import { BALANCE } from '../data/balance';
import { bestAccessRoad, roadCapacity, trafficVolume, travelTime } from '../sim/TrafficData';
import { loadColor, markUpstream, routeFrom } from '../render/TrafficOverlay';
import { trafficTotals } from '../ui/trafficDebug';
import {
  TERRAIN_GRASS, VEG_NONE,
  ZONE_R, ZONE_C, ZONE_I,
  ROAD_STREET, ROAD_AVENUE, ROAD_HIGHWAY,
} from '../sim/constants';

const T = BALANCE.transit;
const interval = T.flowInterval;
const STREET_CAP = BALANCE.roadClasses[ROAD_STREET].capacity;

function makeWorld(w = 16, h = 16) { return new World(w, h, 0); }

function forceBuildable(world: World, tx: number, ty: number) {
  const i = world.grid.idx(tx, ty);
  world.layers.terrain[i] = TERRAIN_GRASS;
  world.layers.vegetation[i] = VEG_NONE;
}

function run(world: World, sys = new TransitSystem(), tick: number = interval) {
  world.tick = tick;
  sys.update(world);
  return sys;
}
/** Road along row y from x0 to x1 inclusive. */
function roadRow(w: World, x0: number, x1: number, y: number, cls = ROAD_STREET) {
  for (let x = x0; x <= x1; x++) { forceBuildable(w, x, y); w.layers.roadClass[w.grid.idx(x, y)] = cls; }
}
/** Road along column x from y0 to y1 inclusive. */
function roadCol(w: World, x: number, y0: number, y1: number, cls = ROAD_STREET) {
  for (let y = y0; y <= y1; y++) { forceBuildable(w, x, y); w.layers.roadClass[w.grid.idx(x, y)] = cls; }
}
function zoneAt(w: World, tx: number, ty: number, zoneType: number, level = 1) {
  forceBuildable(w, tx, ty);
  w.layers.zone[w.grid.idx(tx, ty)]     = zoneType;
  w.layers.devLevel[w.grid.idx(tx, ty)] = level;
}
const cong = (w: World, x: number, y: number) => w.layers.congestion[w.grid.idx(x, y)];
const access = (w: World, x: number, y: number) => w.layers.accessibility[w.grid.idx(x, y)];

/** Homes (level 3) at the west end of a road along row 5, commerce at the east end. */
function simpleTown(cls = ROAD_STREET) {
  const w = makeWorld();
  roadRow(w, 2, 10, 5, cls);
  zoneAt(w, 2, 4, ZONE_R, 3);
  zoneAt(w, 10, 4, ZONE_C, 1);
  return w;
}

describe('TransitSystem — flows and congestion', () => {
  it('no zones → all congestion stays 0', () => {
    const w = makeWorld();
    roadRow(w, 2, 10, 5);
    run(w);
    expect(Array.from(w.layers.congestion).every(v => v === 0)).toBe(true);
    expect(w.stats.avgCongestion).toBe(0);
  });

  it('homes with nowhere to go make no traffic', () => {
    const w = makeWorld();
    roadRow(w, 2, 10, 5);
    zoneAt(w, 2, 4, ZONE_R, 3);
    run(w);
    expect(cong(w, 2, 5)).toBe(0);
  });

  it('traffic runs along the whole road between homes and commerce', () => {
    const w = simpleTown();
    run(w);
    const expected = Math.round(3 * T.tripsRtoC / STREET_CAP * 255);
    expect(expected).toBeGreaterThan(0);
    for (let x = 2; x <= 10; x++) expect(cong(w, x, 5)).toBe(expected);
  });

  it('non-road tiles always have congestion 0', () => {
    const w = simpleTown();
    w.layers.congestion[w.grid.idx(2, 4)] = 99; // stale value on a zone tile
    run(w);
    expect(cong(w, 2, 4)).toBe(0);
    expect(cong(w, 10, 4)).toBe(0);
  });

  it('higher devLevel at the origin produces more traffic', () => {
    const volumeFor = (level: number) => {
      const w = simpleTown();
      w.layers.devLevel[w.grid.idx(2, 4)] = level;
      run(w);
      return cong(w, 6, 5);
    };
    expect(volumeFor(3)).toBeGreaterThan(volumeFor(1));
  });

  it('a dead-end past the last zone carries nothing', () => {
    const w = simpleTown();
    roadRow(w, 11, 14, 5);            // road continues east past the shop
    run(w);
    expect(cong(w, 6, 5)).toBeGreaterThan(0);
    expect(cong(w, 12, 5)).toBe(0);
  });

  it('traffic from several homes adds up toward the destination', () => {
    const w = makeWorld();
    roadRow(w, 2, 12, 5);
    zoneAt(w, 2, 4, ZONE_R, 3);
    zoneAt(w, 6, 4, ZONE_R, 3);
    zoneAt(w, 12, 4, ZONE_C, 1);
    run(w);
    const byte = (homes: number) => Math.round(homes * 3 * T.tripsRtoC / STREET_CAP * 255);
    expect(cong(w, 4, 5)).toBe(byte(1));   // west of the second home
    expect(cong(w, 9, 5)).toBe(byte(2));   // both homes' traffic
  });

  it('carries homes → commerce, homes → industry and industry → commerce, and nothing else', () => {
    // Each pair on its own disconnected road.
    const w = makeWorld(24, 24);
    roadRow(w, 2, 8, 2);  zoneAt(w, 2, 1, ZONE_R, 2);  zoneAt(w, 8, 1, ZONE_C, 1);
    roadRow(w, 2, 8, 8);  zoneAt(w, 2, 7, ZONE_R, 2);  zoneAt(w, 8, 7, ZONE_I, 1);
    roadRow(w, 2, 8, 14); zoneAt(w, 2, 13, ZONE_I, 2); zoneAt(w, 8, 13, ZONE_C, 1);
    roadRow(w, 2, 8, 20); zoneAt(w, 2, 19, ZONE_C, 2); zoneAt(w, 8, 19, ZONE_C, 1);
    run(w);
    const byte = (rate: number) => Math.round(2 * rate / STREET_CAP * 255);
    expect(cong(w, 5, 2)).toBe(byte(T.tripsRtoC));
    expect(cong(w, 5, 8)).toBe(byte(T.tripsRtoI));
    expect(cong(w, 5, 14)).toBe(byte(T.tripsItoC));
    expect(cong(w, 5, 20)).toBe(0);
  });

  it('abandoned zones neither send nor attract traffic', () => {
    const w = simpleTown();
    w.layers.abandoned[w.grid.idx(10, 4)] = 1;
    run(w);
    expect(cong(w, 6, 5)).toBe(0);
    expect(access(w, 2, 4)).toBe(0);
  });

  it('avgCongestion averages over road tiles', () => {
    const w = simpleTown();
    run(w);
    expect(w.stats.avgCongestion).toBe(cong(w, 6, 5));
  });
});

describe('TransitSystem — scheduling', () => {
  it('does not run on ticks not divisible by flowInterval', () => {
    const w = simpleTown();
    run(w, new TransitSystem(), interval + 1);
    expect(cong(w, 6, 5)).toBe(0);
  });

  it('recomputes when a road is moved (changes that cancel out in a sum)', () => {
    const w = simpleTown();
    const sys = run(w);
    expect(cong(w, 6, 5)).toBeGreaterThan(0);

    // Same number of road tiles, but the road is now cut in the middle.
    w.layers.roadClass[w.grid.idx(6, 5)] = 0;
    forceBuildable(w, 14, 14);
    w.layers.roadClass[w.grid.idx(14, 14)] = ROAD_STREET;
    run(w, sys, interval * 2);
    expect(cong(w, 4, 5)).toBe(0);
    expect(cong(w, 8, 5)).toBe(0);
  });
});

describe('TransitSystem — road classes', () => {
  it('an avenue is less congested than a street for the same traffic', () => {
    const build = (cls: number) => {
      const w = simpleTown(cls);
      for (let x = 3; x <= 5; x++) zoneAt(w, x, 4, ZONE_R, 3);
      run(w);
      return cong(w, 8, 5);
    };
    const street = build(ROAD_STREET), avenue = build(ROAD_AVENUE);
    expect(street).toBeGreaterThan(0);
    expect(avenue).toBeLessThan(street);
  });

  it('traffic takes a faster highway over a shorter street', () => {
    // Homes at the west end, commerce at the east end. Two routes: a direct
    // street along row 8, and a longer loop whose long leg (row 2) is either
    // highway or street, joined by street columns at each end.
    const build = (loopClass: number) => {
      const w = makeWorld(32, 16);
      roadRow(w, 2, 29, 8);
      roadCol(w, 2, 2, 7);
      roadCol(w, 29, 2, 7);
      roadRow(w, 3, 28, 2, loopClass);
      zoneAt(w, 1, 8, ZONE_R, 3);
      zoneAt(w, 30, 8, ZONE_C, 1);
      run(w);
      return { loop: cong(w, 15, 2), direct: cong(w, 15, 8) };
    };
    const withHighway = build(ROAD_HIGHWAY);
    expect(withHighway.loop).toBeGreaterThan(0);
    expect(withHighway.direct).toBe(0);

    const withStreet = build(ROAD_STREET);
    expect(withStreet.loop).toBe(0);
    expect(withStreet.direct).toBeGreaterThan(0);
  });

  it('a highway gives zones no access to the network', () => {
    const w = simpleTown(ROAD_HIGHWAY);
    run(w);
    expect(cong(w, 6, 5)).toBe(0);
    expect(access(w, 2, 4)).toBe(0);
  });

  it('a second road relieves the first for the homes nearer to it', () => {
    // Two rows of homes between two east-west streets, commerce to the east.
    // Without the south street, the south row has to drive round to the north one.
    const build = (withSouth: boolean) => {
      const w = makeWorld(20, 16);
      roadRow(w, 2, 16, 4);
      roadCol(w, 16, 4, 8);
      roadCol(w, 1, 4, 8);
      roadRow(w, 1, 1, 4);
      for (let x = 2; x <= 8; x++) { zoneAt(w, x, 5, ZONE_R, 3); zoneAt(w, x, 7, ZONE_R, 3); }
      roadRow(w, 2, 8, 8);            // south homes' own street, joined at the west end
      if (withSouth) roadRow(w, 9, 16, 8);
      zoneAt(w, 17, 6, ZONE_C, 1);
      run(w);
      return cong(w, 12, 4);
    };
    const alone = build(false), relieved = build(true);
    expect(alone).toBeGreaterThan(0);
    expect(relieved).toBeLessThan(alone);
  });
});

describe('TransitSystem — accessibility', () => {
  it('zone with no adjacent road has zero accessibility', () => {
    const w = makeWorld();
    zoneAt(w, 5, 5, ZONE_R, 1);
    run(w);
    expect(access(w, 5, 5)).toBe(0);
  });

  it('homes and commerce on the same road tile have full accessibility', () => {
    const w = makeWorld();
    roadRow(w, 5, 5, 5);
    zoneAt(w, 5, 4, ZONE_R, 1);
    zoneAt(w, 5, 6, ZONE_C, 1);
    run(w);
    expect(access(w, 5, 4)).toBe(255);
    expect(access(w, 5, 6)).toBe(255);
  });

  it('accessibility falls with travel time and reaches 0 at commuteMax', () => {
    const w = new World(T.commuteMax + 16, 8, 0);
    const half = 2 + T.commuteMax / 2;
    const far = 2 + T.commuteMax + 4;
    roadRow(w, 2, far, 3);
    zoneAt(w, 2, 2, ZONE_C, 1);
    zoneAt(w, 3, 2, ZONE_R, 1);            // 1 tile away
    zoneAt(w, half, 2, ZONE_R, 1);         // half of commuteMax away
    zoneAt(w, far, 2, ZONE_R, 1);          // beyond commuteMax
    run(w);
    expect(access(w, 3, 2)).toBe(Math.round(255 * (1 - 1 / T.commuteMax)));
    expect(access(w, half, 2)).toBe(Math.round(255 * 0.5));
    expect(access(w, far, 2)).toBe(0);
  });

  it('a faster road raises accessibility over the same distance', () => {
    const build = (cls: number) => {
      const w = makeWorld(32, 8);
      roadRow(w, 2, 26, 3, cls);
      zoneAt(w, 2, 2, ZONE_C, 1);
      zoneAt(w, 26, 2, ZONE_R, 1);
      run(w);
      return access(w, 26, 2);
    };
    expect(build(ROAD_AVENUE)).toBeGreaterThan(build(ROAD_STREET));
  });

  it('disconnected zones have zero accessibility; joining the road fixes it', () => {
    const w = makeWorld();
    roadRow(w, 2, 5, 5);
    roadRow(w, 7, 10, 5);                  // gap at x=6
    zoneAt(w, 2, 4, ZONE_R, 1);
    zoneAt(w, 10, 4, ZONE_C, 1);
    const sys = run(w);
    expect(access(w, 2, 4)).toBe(0);
    expect(access(w, 10, 4)).toBe(0);

    roadRow(w, 6, 6, 5);
    run(w, sys, interval * 2);
    expect(access(w, 2, 4)).toBeGreaterThan(0);
    expect(access(w, 10, 4)).toBeGreaterThan(0);
  });

  it('homes count industry as a destination; undeveloped lots are not destinations', () => {
    const w = makeWorld();
    roadRow(w, 2, 10, 5);
    zoneAt(w, 2, 4, ZONE_R, 1);
    zoneAt(w, 10, 4, ZONE_I, 1);
    zoneAt(w, 6, 4, ZONE_C, 0);            // zoned, nothing built yet
    run(w);
    const eightTiles = Math.round(255 * (1 - 8 / T.commuteMax));
    expect(access(w, 2, 4)).toBe(eightTiles);   // homes → industry, not the empty lot
    expect(access(w, 10, 4)).toBe(eightTiles);  // industry → homes
    expect(access(w, 6, 4)).toBe(Math.round(255 * (1 - 4 / T.commuteMax))); // empty lot still sees homes
  });

  it('zero accessibility slows growth of a developed zone', () => {
    const w = makeWorld();
    zoneAt(w, 2, 2, ZONE_R, 1);
    w.layers.power[w.grid.idx(2, 2)] = 1;
    w.layers.water[w.grid.idx(2, 2)] = 1;
    roadRow(w, 3, 3, 2);
    // No commerce or industry anywhere → accessibility stays 0.
    run(w, new TransitSystem(), 0);
    expect(access(w, 2, 2)).toBe(0);
    // A roll of 0.05 is under the base growth probability (0.08) but over
    // base × accessFloor, so the zone does not grow.
    w.stats.rDemand = 1; w.stats.powerSupply = 9999; w.stats.powerDemand = 0;
    w.stats.waterSupply = 9999; w.stats.waterDemand = 0;
    w.tick = 0;
    w.rng = () => 0.05;
    new ZoneGrowthSystem().update(w);
    expect(w.layers.devLevel[w.grid.idx(2, 2)]).toBe(1);
  });
});

describe('TransitSystem — published traffic data', () => {
  it('world.traffic is null until the first pass, then holds per-flow volumes', () => {
    const w = makeWorld(24, 24);
    expect(w.traffic).toBeNull();
    // Homes at x=2, industry at x=6, commerce at x=10 on one street.
    roadRow(w, 2, 10, 5);
    zoneAt(w, 2, 4, ZONE_R, 2);
    zoneAt(w, 6, 4, ZONE_I, 1);
    zoneAt(w, 10, 4, ZONE_C, 1);
    run(w);
    const d = w.traffic!;
    const at = (x: number) => w.grid.idx(x, 5);
    // Homes → industry stops at the factory; homes → commerce carries on.
    expect(d.volRI[at(4)]).toBeCloseTo(2 * T.tripsRtoI);
    expect(d.volRI[at(8)]).toBe(0);
    expect(d.volRC[at(4)]).toBeCloseTo(2 * T.tripsRtoC);
    expect(d.volRC[at(8)]).toBeCloseTo(2 * T.tripsRtoC);
    // Industry → commerce only exists east of the factory.
    expect(d.volIC[at(4)]).toBe(0);
    expect(d.volIC[at(8)]).toBeCloseTo(1 * T.tripsItoC);
    // The byte layer is the sum over capacity.
    expect(cong(w, 8, 5)).toBe(Math.round(trafficVolume(d, at(8)) / STREET_CAP * 255));
    expect(d.toC.dist[at(10)]).toBe(0);
    expect(d.toC.dist[at(2)]).toBe(8);
  });

  it('volumes are not capped at capacity', () => {
    const w = makeWorld(40, 8);
    roadRow(w, 2, 36, 3);
    for (let x = 2; x <= 30; x++) { zoneAt(w, x, 2, ZONE_R, 3); zoneAt(w, x, 4, ZONE_R, 3); }
    zoneAt(w, 36, 2, ZONE_C, 1);
    run(w);
    const i = w.grid.idx(34, 3);
    expect(cong(w, 34, 3)).toBe(255);
    expect(trafficVolume(w.traffic!, i) / roadCapacity(ROAD_STREET)).toBeGreaterThan(1.5);
  });

  it('version only advances when the pass actually reruns', () => {
    const w = simpleTown();
    const sys = run(w);
    const v = w.traffic!.version;
    run(w, sys, interval * 2);                 // nothing changed
    expect(w.traffic!.version).toBe(v);
    w.layers.devLevel[w.grid.idx(2, 4)] = 1;
    run(w, sys, interval * 3);
    expect(w.traffic!.version).toBe(v + 1);
  });

  it('recompute() runs off-tick and picks up changed balance values', () => {
    const w = simpleTown();
    const sys = run(w);
    const before = cong(w, 6, 5);
    const transit = BALANCE.transit as unknown as Record<string, number>;
    const saved = transit.tripsRtoC;
    try {
      transit.tripsRtoC = saved * 2;
      w.tick = interval + 3;                   // not a traffic tick
      sys.recompute(w);
      expect(cong(w, 6, 5)).toBe(Math.round(3 * saved * 2 / STREET_CAP * 255));
      expect(cong(w, 6, 5)).toBeGreaterThan(before);
    } finally {
      transit.tripsRtoC = saved;
    }
  });

  it('a changed balance value alone triggers a rerun on the next traffic tick', () => {
    const w = simpleTown();
    const sys = run(w);
    const v = w.traffic!.version;
    const cls = BALANCE.roadClasses[ROAD_STREET];
    const saved = cls.capacity;
    try {
      cls.capacity = saved * 2;
      run(w, sys, interval * 2);
      expect(w.traffic!.version).toBe(v + 1);
      expect(cong(w, 6, 5)).toBe(Math.round(3 * T.tripsRtoC / (saved * 2) * 255));
    } finally {
      cls.capacity = saved;
    }
  });
});

describe('TransitSystem — destination capacity', () => {
  /** Keep running traffic passes until the assignment has settled. */
  function settle(w: World, sys = new TransitSystem()) {
    for (let pass = 1; pass <= 30; pass++) {
      run(w, sys, interval * pass);
      if (w.traffic!.settled) break;
    }
    return w.traffic!;
  }

  it('a street of shops fills door by door instead of piling up at the first', () => {
    // Homes at the west end of one street, ten small shops along its east end.
    const w = makeWorld(40, 12);
    roadRow(w, 2, 30, 5);
    for (let x = 2; x <= 11; x++) { zoneAt(w, x, 4, ZONE_R, 3); zoneAt(w, x, 6, ZONE_R, 3); }
    for (let x = 20; x <= 29; x++) zoneAt(w, x, 4, ZONE_C, 1);
    const d = settle(w);
    expect(d.settled).toBe(true);

    const demand = 20 * 3 * T.tripsRtoC;
    const capacity = 10 * T.shopCapacity;
    expect(d.toC.demandRatio).toBeCloseTo(demand / capacity);
    const room = T.shopCapacity * Math.max(1, demand / capacity);

    // No door takes much more than it has room for…
    let ended = 0;
    for (let x = 20; x <= 29; x++) {
      const load = d.toC.doorLoad[w.grid.idx(x, 5)];
      expect(load).toBeLessThanOrEqual(room * 1.2);
      ended += load;
    }
    expect(ended).toBeCloseTo(demand, 3);
    // …so traffic thins out along the street rather than stopping at its start.
    const vol = (x: number) => d.volRC[w.grid.idx(x, 5)];
    expect(vol(19)).toBeCloseTo(demand, 3);
    expect(vol(24)).toBeGreaterThan(demand * 0.25);
    expect(vol(24)).toBeLessThan(vol(20));
    expect(vol(27)).toBeGreaterThan(0);
  });

  it('overflow from a small nearby shop drives on to a bigger one further away', () => {
    const w = makeWorld(36, 12);
    roadRow(w, 2, 30, 5);
    zoneAt(w, 4, 4, ZONE_C, 1);                                   // corner shop, west
    for (let x = 8; x <= 12; x++) { zoneAt(w, x, 4, ZONE_R, 3); zoneAt(w, x, 6, ZONE_R, 3); }
    for (let x = 24; x <= 28; x++) zoneAt(w, x, 4, ZONE_C, 3);    // mall, east
    const d = settle(w);
    expect(d.settled).toBe(true);
    const demand = 10 * 3 * T.tripsRtoC;
    const corner = d.toC.doorLoad[w.grid.idx(4, 5)];
    expect(corner).toBeGreaterThan(0);
    expect(corner).toBeLessThanOrEqual(T.shopCapacity * 1.2);
    // The rest crosses the gap toward the mall.
    expect(d.volRC[w.grid.idx(18, 5)]).toBeGreaterThan(demand - T.shopCapacity * 1.2 - 0.01);
  });

  it('when there are too few shops everywhere, prices stay put and doors share the excess', () => {
    const w = makeWorld(40, 12);
    roadRow(w, 2, 30, 5);
    for (let x = 12; x <= 20; x++) { zoneAt(w, x, 4, ZONE_R, 3); zoneAt(w, x, 6, ZONE_R, 3); }
    zoneAt(w, 4, 4, ZONE_C, 1);
    zoneAt(w, 28, 4, ZONE_C, 1);
    const d = settle(w);
    expect(d.settled).toBe(true);
    expect(d.toC.demandRatio).toBeGreaterThan(4);
    const west = d.toC.doorLoad[w.grid.idx(4, 5)], east = d.toC.doorLoad[w.grid.idx(28, 5)];
    expect(west + east).toBeCloseTo(18 * 3 * T.tripsRtoC, 3);
    // Symmetric town: each shop gets about half.
    expect(Math.abs(west - east) / (west + east)).toBeLessThan(0.25);
  });

  it('abandoned or undeveloped zones are not doors', () => {
    const w = simpleTown();
    zoneAt(w, 6, 4, ZONE_C, 0);
    zoneAt(w, 8, 4, ZONE_C, 2);
    w.layers.abandoned[w.grid.idx(8, 4)] = 1;
    run(w);
    const d = w.traffic!;
    expect(d.toC.doorCap[w.grid.idx(6, 5)]).toBe(0);
    expect(d.toC.doorCap[w.grid.idx(8, 5)]).toBe(0);
    expect(d.toC.doorCap[w.grid.idx(10, 5)]).toBe(T.shopCapacity);
  });
});

describe('TransitSystem — congestion slows roads', () => {
  const street = BALANCE.roadClasses[ROAD_STREET];
  const transit = BALANCE.transit as unknown as Record<string, number>;

  /** Run `fn` with a street capacity small enough for a few homes to jam it. */
  function withTinyStreets<R>(fn: () => R): R {
    const saved = street.capacity;
    street.capacity = 4;
    try { return fn(); } finally { street.capacity = saved; }
  }

  it('a jammed road takes longer, which lowers accessibility', () => {
    const build = () => {
      const w = makeWorld(36, 12);
      roadRow(w, 2, 26, 5);
      for (let x = 2; x <= 9; x++) { zoneAt(w, x, 4, ZONE_R, 1); zoneAt(w, x, 6, ZONE_R, 1); }
      for (let x = 22; x <= 26; x++) zoneAt(w, x, 4, ZONE_C, 3);
      run(w);
      return w;
    };
    const free = build();                    // 5.3 trips on a 20-trip street: free flow
    const jammed = withTinyStreets(build);   // the same trips on a 4-trip street
    const at = free.grid.idx(2, 5);
    expect(travelTime(free.traffic!.toC, at)).toBeCloseTo(20);
    expect(travelTime(jammed.traffic!.toC, at)).toBeGreaterThan(24);
    expect(access(jammed, 2, 4)).toBeLessThan(access(free, 2, 4));
  });

  it('traffic spreads over two routes once the shorter one jams', () => {
    // Homes on a western stub, shops on an eastern stub, joined by a north
    // loop and a slightly longer south loop.
    const build = () => {
      const w = makeWorld(32, 20);
      roadRow(w, 2, 6, 10);
      roadCol(w, 6, 4, 17);
      roadCol(w, 22, 4, 17);
      roadRow(w, 7, 21, 4);
      roadRow(w, 7, 21, 17);
      roadRow(w, 23, 27, 10);
      for (let x = 2; x <= 5; x++) { zoneAt(w, x, 9, ZONE_R, 3); zoneAt(w, x, 11, ZONE_R, 3); }
      for (let x = 24; x <= 27; x++) zoneAt(w, x, 9, ZONE_C, 3);
      const sys = new TransitSystem();
      for (let pass = 1; pass <= 12; pass++) run(w, sys, interval * pass);
      const d = w.traffic!;
      return { north: d.volRC[w.grid.idx(14, 4)], south: d.volRC[w.grid.idx(14, 17)] };
    };
    const total = 8 * 3 * T.tripsRtoC;

    const spread = withTinyStreets(build);
    expect(spread.north + spread.south).toBeCloseTo(total, 1);
    expect(spread.north).toBeGreaterThan(total * 0.3);
    expect(spread.south).toBeGreaterThan(total * 0.3);

    // With the slowdown switched off, everything takes the shorter route.
    const savedDelay = transit.congestionDelay;
    transit.congestionDelay = 0;
    try {
      const oneWay = withTinyStreets(build);
      expect(oneWay.south).toBe(0);
      expect(oneWay.north).toBeCloseTo(total, 3);
    } finally {
      transit.congestionDelay = savedDelay;
    }
  });

  it('light traffic does not slow a road at all', () => {
    const w = simpleTown();
    run(w);
    expect(travelTime(w.traffic!.toC, w.grid.idx(2, 5))).toBe(8);
    expect(w.traffic!.settled).toBe(true);
  });
});

describe('traffic overlay helpers', () => {
  // A T-junction: west arm and north arm both feed the east arm to commerce.
  function junction() {
    const w = makeWorld(20, 16);
    roadRow(w, 2, 14, 8);
    roadCol(w, 8, 2, 7);
    zoneAt(w, 2, 9, ZONE_R, 1);    // west home
    zoneAt(w, 7, 2, ZONE_R, 1);    // north home
    zoneAt(w, 14, 9, ZONE_C, 1);
    run(w);
    return w;
  }

  it('routeFrom follows the road from a building to its destination', () => {
    const w = junction();
    const d = w.traffic!;
    const start = bestAccessRoad(w, w.grid.idx(7, 2), d.toC);
    expect(start).toBe(w.grid.idx(8, 2));
    const path = routeFrom(d.toC, start);
    expect(path[0]).toBe(w.grid.idx(8, 2));
    expect(path).toContain(w.grid.idx(8, 8));           // through the junction
    expect(path[path.length - 1]).toBe(w.grid.idx(14, 8)); // the shop's door
    expect(path.length).toBe(6 + 6 + 1);
  });

  it('routeFrom is empty when there is no way there', () => {
    const w = junction();
    expect(routeFrom(w.traffic!.toI, w.grid.idx(8, 2))).toEqual([]);   // no industry
    expect(routeFrom(w.traffic!.toC, -1)).toEqual([]);
  });

  it('markUpstream marks exactly the roads whose traffic passes a tile', () => {
    const w = junction();
    const d = w.traffic!;
    const up = new Uint8Array(w.grid.width * w.grid.height);

    markUpstream(d.toC, w.grid.idx(11, 8), up);          // east arm: everything west and north
    expect(up[w.grid.idx(11, 8)]).toBe(1);
    expect(up[w.grid.idx(2, 8)]).toBe(1);
    expect(up[w.grid.idx(8, 2)]).toBe(1);
    expect(up[w.grid.idx(13, 8)]).toBe(0);               // downstream

    markUpstream(d.toC, w.grid.idx(8, 4), up);           // north arm: only the north arm above it
    expect(up[w.grid.idx(8, 2)]).toBe(1);
    expect(up[w.grid.idx(2, 8)]).toBe(0);
    expect(up[w.grid.idx(11, 8)]).toBe(0);
  });

  it('loadColor distinguishes empty, full and overloaded roads', () => {
    const colors = [0, 0.05, 0.5, 1, 2, 4].map(loadColor);
    expect(new Set(colors).size).toBe(colors.length);
    expect(loadColor(10)).toBe(loadColor(4));            // scale tops out
  });

  it('trafficTotals summarises the last pass', () => {
    const w = junction();
    expect(trafficTotals(makeWorld())).toBeNull();
    const tot = trafficTotals(w)!;
    expect(tot.homes).toBe(2);
    expect(tot.trips).toBeCloseTo(2 * T.tripsRtoC);
    expect(tot.cutOffPct).toBe(0);
    expect(tot.avgCommute).toBeCloseTo((12 + 12) / 2);
    expect(tot.overPct).toBe(0);
    expect(tot.roads).toBe(13 + 6);
    expect(tot.usedPct).toBe(100);                       // every tile is on a route here
  });
});
