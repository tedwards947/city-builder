// Leisure in traffic (sim/leisureTraffic.ts, LEISURE_DESIGN.md part 2): the
// `leisure` market. Homes and tourists go to attractions; appeal is a head
// start against travel time; tourists are the city's pull capped by its
// gateways; tickets earn; free attractions send arrivals on to the shops.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { TransitSystem } from '../sim/systems/TransitSystem';
import {
  BUILDING_POLICE, BUILDING_PLAZA, BUILDING_MUSEUM, BUILDING_BIG_PARK, BUILDING_STADIUM, BUILDING_PARK,
  ROAD_STREET, ZONE_R, ZONE_C,
} from '../sim/constants';
import { BALANCE } from '../data/balance';
import {
  attractionAt, cityPull, gatewayCapacity, hasGateway, drawsTourists, touristsArriving, leisureTicketIncome,
  leisureHandicap, leisureReachAt, tourismInfo, leisureCapacity,
} from '../sim/leisureTraffic';
import { landWorld } from './pcTestWorld';

const LE = BALANCE.leisure as unknown as {
  kinds: Record<number, { capacity?: number; appeal?: number; pull?: number; ticket?: number; shopShare?: number }>;
  tripsPerLevel: number; reach: number; gateways: Record<number, number>;
};
const shipped = JSON.parse(JSON.stringify(LE));
const FLOW = BALANCE.transit.flowInterval;
const SIZE = 96, ROW = 13;

let w: World;
let transit: TransitSystem;
let pass = 0;
const idx = (x: number, y: number) => w.grid.idx(x, y);
const zone = (x: number, y: number, z: number, level: number) => {
  w.layers.zone[idx(x, y)] = z; w.layers.devLevel[idx(x, y)] = level; w.layers.landValue[idx(x, y)] = 128;
};
/** `n` level-2 homes on the south side of the street, from x on. */
const homes = (x: number, n: number) => { for (let k = 0; k < n; k++) zone(x + k, ROW + 1, ZONE_R, 2); };
const traffic = () => { w.tick = ++pass * FLOW; transit.update(w); return w.traffic!; };
const sum = (a: Float32Array) => a.reduce((s, v) => s + v, 0);
/** Place a building on the north side of the street, its bottom row touching it. Plaza and museum are 2×2. */
const north = (x: number, kind: number, depth = 2) => expect(w.placeBuilding(x, ROW - depth, kind)).toBe(true);

// A street along y = 13 from x = 2 to 93.
beforeEach(() => {
  w = landWorld(SIZE);
  for (let x = 2; x <= 93; x++) w.setRoad(x, ROW, ROAD_STREET);
  transit = new TransitSystem();
  pass = 0;
  LE.gateways = {};
});
afterEach(() => {
  for (const k in shipped.kinds) LE.kinds[Number(k)] = JSON.parse(JSON.stringify(shipped.kinds[k]));
  LE.tripsPerLevel = shipped.tripsPerLevel; LE.reach = shipped.reach; LE.gateways = { ...shipped.gateways };
});

describe('the leisure market', () => {
  it('ships with the airport as the only gateway, the stadium and the small park not yet destinations', () => {
    expect(shipped.gateways).toEqual({ 13: 60 });
    expect(leisureCapacity(BUILDING_STADIUM)).toBe(0);
    expect(leisureCapacity(BUILDING_PARK)).toBe(0);
    for (const k of [BUILDING_BIG_PARK, BUILDING_PLAZA, BUILDING_MUSEUM]) expect(leisureCapacity(k)).toBeGreaterThan(0);
    // The museum is the star: everything else is measured against it.
    expect(leisureHandicap(BUILDING_MUSEUM)).toBe(0);
    expect(leisureHandicap(BUILDING_PLAZA)).toBeGreaterThan(leisureHandicap(BUILDING_BIG_PARK));
    expect(shipped.kinds[BUILDING_MUSEUM].ticket).toBeGreaterThan(0);
    expect(shipped.kinds[BUILDING_PLAZA].ticket).toBe(0);
  });

  it('does not run with no attraction on a road', () => {
    homes(10, 10);
    north(40, BUILDING_PLAZA, 4);          // two tiles back from the street: no road reaches it
    const t = traffic();
    expect(sum(t.leisure.volume)).toBe(0);
    expect(t.leisure.field.count).toBe(0);
    expect(attractionAt(w, 40, ROW - 4)!.connected).toBe(false);
    expect(leisureReachAt(w, idx(10, ROW + 1))).toBe(0);
    expect(tourismInfo(w)).toEqual({ pull: 0, gatewayCapacity: 0, tourists: 0, arrivals: 0, income: 0 });
  });

  it('homes send leisure trips to an attraction; a free one earns nothing', () => {
    homes(10, 10);                          // 20 levels
    north(30, BUILDING_PLAZA);
    const t = traffic();
    const trips = 20 * LE.tripsPerLevel;
    expect(t.leisure.field.demand).toBeCloseTo(trips);
    const plaza = attractionAt(w, 31, ROW - 1)!;
    expect(plaza.connected).toBe(true);
    expect(plaza.arrivals).toBeCloseTo(trips);
    expect(plaza.capacity).toBe(LE.kinds[BUILDING_PLAZA].capacity);
    expect(plaza.income).toBe(0);
    expect(leisureTicketIncome(w)).toBe(0);
    // The trips are on the street between the homes and the plaza.
    expect(t.leisure.volume[idx(25, ROW)]).toBeGreaterThan(0);
    expect(t.leisure.volume[idx(40, ROW)]).toBe(0);
  });

  it('a ticketed attraction earns its ticket for every trip it takes, up to its capacity', () => {
    homes(10, 10);
    north(30, BUILDING_MUSEUM);
    traffic();
    const trips = 20 * LE.tripsPerLevel;
    expect(attractionAt(w, 30, ROW - 2)!.income).toBeCloseTo(trips * LE.kinds[BUILDING_MUSEUM].ticket!);
    expect(leisureTicketIncome(w)).toBeCloseTo(trips * LE.kinds[BUILDING_MUSEUM].ticket!);
    // More visitors than seats: it earns for a full house, no more.
    LE.kinds[BUILDING_MUSEUM].capacity = 0.5;
    traffic();
    expect(leisureTicketIncome(w)).toBeCloseTo(0.5 * LE.kinds[BUILDING_MUSEUM].ticket!);
  });
});

describe('appeal against travel time', () => {
  it('a star attraction far away beats a small one nearby, until it is too far', () => {
    const lead = leisureHandicap(BUILDING_PLAZA);             // the museum's head start over the plaza, in tiles
    expect(lead).toBeGreaterThan(10);
    homes(40, 4);                                              // at x 40–43
    north(34, BUILDING_PLAZA);                                 // 5 tiles west of the homes
    north(44 + lead - 10, BUILDING_MUSEUM);                    // well inside its head start to the east
    traffic();
    expect(attractionAt(w, 34, ROW - 1)!.arrivals).toBeCloseTo(0);
    expect(attractionAt(w, 44 + lead - 10, ROW - 1)!.arrivals).toBeCloseTo(8 * LE.tripsPerLevel);
  });

  it('… and loses once the extra drive is longer than its head start', () => {
    const lead = leisureHandicap(BUILDING_PLAZA);
    homes(40, 4);
    north(34, BUILDING_PLAZA);
    north(44 + lead + 10, BUILDING_MUSEUM);
    traffic();
    expect(attractionAt(w, 34, ROW - 1)!.arrivals).toBeCloseTo(8 * LE.tripsPerLevel);
    expect(attractionAt(w, 44 + lead + 10, ROW - 1)!.arrivals).toBeCloseTo(0);
  });

  it('trips drive past a small attraction on the way to a better one', () => {
    homes(10, 4);
    north(20, BUILDING_PLAZA);                                 // on the way
    north(30, BUILDING_MUSEUM);
    const t = traffic();
    expect(t.leisure.field.handicapped).toBe(true);
    expect(attractionAt(w, 20, ROW - 1)!.arrivals).toBeCloseTo(0);
    expect(attractionAt(w, 30, ROW - 1)!.arrivals).toBeCloseTo(8 * LE.tripsPerLevel);
    expect(t.leisure.volume[idx(25, ROW)]).toBeCloseTo(8 * LE.tripsPerLevel);   // past the plaza
  });

  it('when the star is full, the overflow goes to an attraction with room nearby', () => {
    homes(10, 10);                                             // 0.8 trips
    north(22, BUILDING_PLAZA);
    north(30, BUILDING_MUSEUM);
    LE.kinds[BUILDING_MUSEUM].capacity = 0.25;
    LE.kinds[BUILDING_PLAZA].capacity = 0.25;                  // both small: more trips than room in all
    traffic();
    const plaza = attractionAt(w, 22, ROW - 1)!, museum = attractionAt(w, 30, ROW - 1)!;
    expect(museum.arrivals).toBeCloseTo(0.25);
    expect(plaza.arrivals).toBeGreaterThan(0.2);              // its share of the overflow
  });

  it('nobody travels further than the reach, counted after the head start', () => {
    LE.reach = 30;
    homes(10, 4);
    north(50, BUILDING_MUSEUM);                                // 37 tiles from the nearest home
    let t = traffic();
    expect(t.leisure.field.demand).toBe(0);
    expect(t.leisure.field.stranded).toBeCloseTo(8 * LE.tripsPerLevel);
    expect(leisureReachAt(w, idx(13, ROW + 1))).toBe(0);
    homes(40, 2);                                              // 9 and 8 tiles away: in reach
    t = traffic();
    expect(t.leisure.field.demand).toBeCloseTo(4 * LE.tripsPerLevel);
    // A plaza at the same spot is reached from less far: its handicap counts.
    expect(leisureHandicap(BUILDING_PLAZA)).toBeGreaterThan(21);
  });

  it('"To leisure" reach is 1 beside the best attraction and falls with travel time and with less appeal', () => {
    homes(10, 1); homes(29, 1); homes(60, 1);
    north(30, BUILDING_MUSEUM);
    traffic();
    const near = leisureReachAt(w, idx(29, ROW + 1)), mid = leisureReachAt(w, idx(10, ROW + 1)), far = leisureReachAt(w, idx(60, ROW + 1));
    expect(near).toBeGreaterThan(0.97);
    expect(mid).toBeCloseTo(1 - 20 / LE.reach, 1);
    expect(far).toBeCloseTo(1 - 29 / LE.reach, 1);
    // The same spots with a plaza instead: lower by its handicap.
    const w2 = landWorld(SIZE);
    for (let x = 2; x <= 93; x++) w2.setRoad(x, ROW, ROAD_STREET);
    w2.layers.zone[w2.grid.idx(29, ROW + 1)] = ZONE_R; w2.layers.devLevel[w2.grid.idx(29, ROW + 1)] = 2;
    expect(w2.placeBuilding(30, ROW - 2, BUILDING_PLAZA)).toBe(true);
    const t2 = new TransitSystem(); w2.tick = FLOW; t2.update(w2);
    expect(leisureReachAt(w2, w2.grid.idx(29, ROW + 1))).toBeCloseTo(near - leisureHandicap(BUILDING_PLAZA) / LE.reach, 1);
  });
});

describe('tourists', () => {
  // A police station stands in for the airport as the gateway (the airport needs a 12×5 site).
  const gateway = (x: number, cap: number) => { LE.gateways = { [BUILDING_POLICE]: cap }; expect(w.placeBuilding(x, ROW - 1, BUILDING_POLICE)).toBe(true); };

  it('with no gateway there are no tourists: residents only', () => {
    north(30, BUILDING_MUSEUM);
    expect(drawsTourists(BUILDING_MUSEUM)).toBe(true);
    expect(drawsTourists(BUILDING_STADIUM)).toBe(false);
    expect(drawsTourists(BUILDING_POLICE)).toBe(false);
    expect(cityPull(w)).toBe(LE.kinds[BUILDING_MUSEUM].pull);
    expect(hasGateway(w)).toBe(false);
    expect(touristsArriving(w)).toBe(0);
    const t = traffic();
    expect(t.leisure.field.demand).toBe(0);
  });

  it('tourists are the pull of the attractions on a road, capped by the gateways', () => {
    gateway(10, 1000);
    north(30, BUILDING_MUSEUM);
    north(40, BUILDING_PLAZA);
    north(50, BUILDING_PLAZA, 4);                              // no road: draws nobody
    const pull = LE.kinds[BUILDING_MUSEUM].pull! + LE.kinds[BUILDING_PLAZA].pull!;
    expect(cityPull(w)).toBe(pull);
    expect(touristsArriving(w)).toBe(pull);
    const t = traffic();
    expect(t.leisure.field.demand).toBeCloseTo(pull);
    expect(t.leisure.volume[idx(20, ROW)]).toBeCloseTo(pull);  // on the road from the gateway
    expect(tourismInfo(w).tourists).toBe(pull);
    // A small gateway caps them.
    LE.gateways = { [BUILDING_POLICE]: 5 };
    expect(gatewayCapacity(w)).toBe(5);
    expect(touristsArriving(w)).toBe(5);
    expect(traffic().leisure.field.demand).toBeCloseTo(5);
  });

  it('tourists pay for tickets like anyone else', () => {
    gateway(10, 1000);
    north(30, BUILDING_MUSEUM);
    traffic();
    const m = LE.kinds[BUILDING_MUSEUM];
    expect(leisureTicketIncome(w)).toBeCloseTo(Math.min(m.pull!, m.capacity!) * m.ticket!);
  });
});

describe('free attractions and the shops', () => {
  it('a share of a free attraction\'s arrivals goes on to the shops, one pass later', () => {
    LE.tripsPerLevel = 1;
    homes(10, 5);                                              // 10 trips
    north(30, BUILDING_PLAZA);
    for (const x of [50, 51, 52, 53, 54, 55]) zone(x, ROW + 1, ZONE_C, 3);
    let t = traffic();
    const base = t.shopping.field.demand;
    expect(attractionAt(w, 30, ROW - 1)!.arrivals).toBeCloseTo(10);
    expect(attractionAt(w, 30, ROW - 1)!.toShops).toBe(5);
    t = traffic();
    expect(t.shopping.field.demand).toBeCloseTo(base + 5);
    // A ticketed one sends nobody on.
    expect(shipped.kinds[BUILDING_MUSEUM].shopShare).toBe(0);
  });
});
