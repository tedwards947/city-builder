// Service capacity: a school or hospital with a capacity covers only the
// homes it has seats for. These tests set their own capacities and a short
// reach (8 road steps) for their duration, so the shipped numbers can move.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { ServiceSystem, computeServiceCoverage } from '../sim/systems/ServiceSystem';
import { serviceCapacity, hasCapacity, buildingReach, assignSeats, nothingIsFull, buildingSeats, homeSeat } from '../sim/serviceCapacity';
import { ROAD_STREET, BUILDING_SCHOOL, BUILDING_HOSPITAL, BUILDING_POLICE, BUILDING_FIRE, BUILDING_PARK } from '../sim/constants';
import { BALANCE } from '../data/balance';
import { landWorld, home } from './pcTestWorld';
import { buildLivingCity } from './fixtures/testCity';

const capacity = BALANCE.service.capacity as Record<number, number>;
const reach = BALANCE.service.coverageRange as Record<number, number>;
const shipped = { capacity: { ...capacity }, reach: { ...reach } };

let w: World;
let sys: ServiceSystem;
const idx = (tx: number, ty: number) => w.grid.idx(tx, ty);

/** A street along y = 10 from x = 2 to 28, with homes on its south side at the given x. */
function street(homesAt: number[], level = 2): void {
  for (let tx = 2; tx <= 28; tx++) w.setRoad(tx, 10, ROAD_STREET);
  for (const tx of homesAt) home(w, tx, 11, level);
}
/** A school on the north side of the street at x. */
const school = (tx: number) => w.placeBuilding(tx, 9, BUILDING_SCHOOL);
/** Which of the homes at these x have school coverage after an update. */
function covered(xs: number[]): number[] {
  sys.update(w);
  return xs.filter((tx) => w.layers.school[idx(tx, 11)] === 1);
}
const seatX = (tx: number) => homeSeat(w, tx, 11, BUILDING_SCHOOL)?.seatedAt?.tx ?? null;

beforeEach(() => {
  w = landWorld(); sys = new ServiceSystem();
  capacity[BUILDING_SCHOOL] = 0; capacity[BUILDING_HOSPITAL] = 0;
  reach[BUILDING_SCHOOL] = 8; reach[BUILDING_HOSPITAL] = 8;
});
afterEach(() => {
  for (const k in capacity) delete capacity[k];
  Object.assign(capacity, shipped.capacity);
  Object.assign(reach, shipped.reach);
});

describe('service capacity', () => {
  it("ships with the owner's numbers: schools and hospitals reach far and are limited by capacity, police and fire too (pacing, 2026-11-20)", () => {
    expect(shipped.capacity).toEqual({ [BUILDING_POLICE]: 3000, [BUILDING_FIRE]: 4000, [BUILDING_SCHOOL]: 4000, [BUILDING_HOSPITAL]: 8000 });
    expect(shipped.reach[BUILDING_SCHOOL]).toBe(20);
    expect(shipped.reach[BUILDING_HOSPITAL]).toBe(30);
    Object.assign(capacity, shipped.capacity);
    expect(serviceCapacity(BUILDING_SCHOOL)).toBe(4000);
    expect(hasCapacity(BUILDING_HOSPITAL)).toBe(true);
    expect(serviceCapacity(BUILDING_POLICE)).toBe(3000);
    expect(serviceCapacity(BUILDING_FIRE)).toBe(4000);
    // Parks are served by reach alone.
    for (const kind of [BUILDING_PARK]) {
      expect(serviceCapacity(kind)).toBe(0);
      expect(hasCapacity(kind)).toBe(false);
    }
  });

  it('with no capacity, or one nobody reaches, every layer is exactly as reach alone gives', () => {
    street([4, 5, 9, 10, 11, 14, 17, 22, 27], 3);
    school(10); school(20);
    w.placeBuilding(6, 9, BUILDING_HOSPITAL);
    w.placeBuilding(15, 9, BUILDING_POLICE);
    w.placeBuilding(24, 9, BUILDING_PARK);
    const snap = () => {
      new ServiceSystem().update(w);
      const L = w.layers;
      return [L.services, L.police, L.fireStation, L.school, L.hospital].map((a) => Array.from(a).join(''));
    };
    const plain = snap();
    capacity[BUILDING_SCHOOL] = 1e9;
    capacity[BUILDING_HOSPITAL] = 1e9;
    expect(snap()).toEqual(plain);
    // The walk with distances covers the same tiles in the same order.
    const dist = new Map<number, number>();
    expect([...computeServiceCoverage(w, 10, 9, BUILDING_SCHOOL, undefined, dist)]).toEqual([...computeServiceCoverage(w, 10, 9, BUILDING_SCHOOL)]);
    expect(dist.size).toBe(computeServiceCoverage(w, 10, 9, BUILDING_SCHOOL).size);
  });

  it('a home is seated at its nearest building with room; the farthest go without', () => {
    street([10, 11, 12, 13, 14, 25]);                // 10 residents each
    school(10);
    capacity[BUILDING_SCHOOL] = 30;
    // Road steps from the school: 10 and 11 sit beside its own road tile (0), then 12 (1), 13 (2), 14 (3).
    expect(covered([10, 11, 12, 13, 14, 25])).toEqual([10, 11, 12]);
    expect(buildingSeats(w, 10, 9)).toEqual({ capacity: 30, seated: 30, inReachUnseated: 20 });
    expect(homeSeat(w, 12, 11, BUILDING_SCHOOL)).toEqual({ seatedAt: { tx: 10, ty: 9 }, reason: null });
    expect(homeSeat(w, 13, 11, BUILDING_SCHOOL)).toEqual({ seatedAt: null, reason: 'full' });
    expect(homeSeat(w, 25, 11, BUILDING_SCHOOL)).toEqual({ seatedAt: null, reason: 'outOfReach' });
    expect(homeSeat(w, 20, 11, BUILDING_SCHOOL)).toBeNull();        // not a home
    // The road tiles and empty lots it reaches are covered as before; only the unseated homes are not.
    expect(w.layers.school[idx(13, 10)]).toBe(1);
    expect(w.layers.school[idx(13, 11)]).toBe(0);
    // A full school is not the only service: the same homes still count as served by a police station.
    w.placeBuilding(16, 9, BUILDING_POLICE);
    sys.update(w);
    expect(w.layers.services[idx(13, 11)]).toBe(1);
    expect(w.layers.school[idx(13, 11)]).toBe(0);
  });

  it('a full school does not leave a home without the services layer if nothing else reaches it', () => {
    street([10, 11, 12]);
    school(10);
    capacity[BUILDING_SCHOOL] = 20;
    sys.update(w);
    expect(w.layers.services[idx(12, 11)]).toBe(0);
    expect(w.layers.services[idx(11, 11)]).toBe(1);
  });

  it('overflow falls to the next nearest building', () => {
    street([8, 9, 10, 11, 12, 13, 14, 15, 16]);
    school(9); school(15);
    capacity[BUILDING_SCHOOL] = 40;
    expect(covered([8, 9, 10, 11, 12, 13, 14, 15, 16])).toEqual([8, 9, 10, 11, 13, 14, 15, 16]);
    // 8, 9, 10 (distance 0) and 11 (1) fill the west school; 14, 15, 16 (0) and 13 (1) fill the
    // east one; 12 is two steps from both and finds both full.
    expect([8, 9, 10, 11, 12, 13, 14, 15, 16].map(seatX)).toEqual([9, 9, 9, 9, null, 15, 15, 15, 15]);
    // With room for one more home each, 12 goes to the west school: equal distance, lower building tile.
    capacity[BUILDING_SCHOOL] = 50;
    expect(seatX(12)).toBe(9);
    capacity[BUILDING_SCHOOL] = 40;
    expect(buildingSeats(w, 9, 9)).toEqual({ capacity: 40, seated: 40, inReachUnseated: 10 });
    expect(buildingSeats(w, 15, 9)).toEqual({ capacity: 40, seated: 40, inReachUnseated: 10 });
  });

  it('a home is seated whole: one too big for the room left is passed over for a smaller one', () => {
    street([10, 12]);                                 // 10 residents each
    home(w, 14, 11, 1);                               // 4 residents, further away
    school(10);
    capacity[BUILDING_SCHOOL] = 14;
    expect(covered([10, 12, 14])).toEqual([10, 14]);
    expect(buildingSeats(w, 10, 9)).toEqual({ capacity: 14, seated: 14, inReachUnseated: 10 });
  });

  it('does not depend on the order things were built in', () => {
    const build = (order: number[]) => {
      w = landWorld();
      street([6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18], 3);
      for (const tx of order) school(tx);
      capacity[BUILDING_SCHOOL] = 60;
      return [6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18].map(seatX);
    };
    const a = build([9, 12, 15]);
    expect(build([15, 9, 12])).toEqual(a);
    expect(build([12, 15, 9])).toEqual(a);
    expect(a.filter((x) => x !== null).length).toBe(9);          // 3 schools × 3 towers
  });

  it('seating follows the homes once a game day, and the roads and buildings at once', () => {
    street([10, 11, 12], 1);                          // 4 residents each
    school(10);
    capacity[BUILDING_SCHOOL] = 20;
    w.tick = 1;
    expect(covered([10, 11, 12])).toEqual([10, 11, 12]);
    // The homes grow to 10 residents each: only two fit now, but nothing changes until the day turns.
    for (const tx of [10, 11, 12]) w.layers.devLevel[idx(tx, 11)] = 2;
    w.tick = 2;
    expect(covered([10, 11, 12])).toEqual([10, 11, 12]);
    w.tick = BALANCE.ticksPerDay;
    expect(covered([10, 11, 12])).toEqual([10, 11]);
    // A second school is felt on the next tick, not the next day.
    school(13);
    w.tick = BALANCE.ticksPerDay + 1;
    expect(covered([10, 11, 12])).toEqual([10, 11, 12]);
    // So is a change of capacity.
    w.clearTile(13, 9);
    capacity[BUILDING_SCHOOL] = 10;
    w.tick = BALANCE.ticksPerDay + 2;
    expect(covered([10]).length).toBe(1);
    // And switching capacity off again restores plain reach.
    capacity[BUILDING_SCHOOL] = 0;
    w.tick = BALANCE.ticksPerDay + 3;
    expect(covered([10, 11, 12])).toEqual([10, 11, 12]);
  });

  it("the system's own road walk gives the same tiles, order and distances as computeServiceCoverage", () => {
    const { world } = buildLivingCity();
    reach[BUILDING_SCHOOL] = 20; reach[BUILDING_HOSPITAL] = 30;
    const system = new ServiceSystem();
    let checked = 0;
    for (const b of world.buildings) {
      if (BALANCE.service.coverageRange[b.kind] === undefined) continue;
      const want = buildingReach(world, b.tx, b.ty, b.kind);
      const got = system.reachOf(world, b.tx, b.ty, b.kind);
      expect(Array.from(got.tiles)).toEqual(Array.from(want.tiles));
      expect(Array.from(got.dist)).toEqual(Array.from(want.dist));
      // Nearest first: the seating relies on it.
      for (let k = 1; k < got.dist.length; k++) expect(got.dist[k]).toBeGreaterThanOrEqual(got.dist[k - 1]);
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('the layers the system writes are exactly the reach minus the homes assignSeats leaves without a seat', () => {
    const { world } = buildLivingCity();
    reach[BUILDING_SCHOOL] = 20; reach[BUILDING_HOSPITAL] = 30;
    const kinds = [[BUILDING_SCHOOL, world.layers.school], [BUILDING_HOSPITAL, world.layers.hospital]] as const;
    // From plenty of room (the quick test passes) down to hardly any (most homes turned away).
    for (const cap of [1e9, 4000, 1500, 600, 200, 40]) {
      capacity[BUILDING_SCHOOL] = cap; capacity[BUILDING_HOSPITAL] = cap * 2;
      new ServiceSystem().update(world);
      for (const [kind, layer] of kinds) {
        const reaches = world.buildings.filter((b) => b.kind === kind).map((b) => buildingReach(world, b.tx, b.ty, kind));
        const { full } = assignSeats(world, reaches, serviceCapacity(kind));
        const want = new Uint8Array(layer.length);
        for (const r of reaches) for (const t of r.tiles) if (!full.has(t)) want[t] = 1;
        expect(Array.from(layer).join('')).toBe(Array.from(want).join(''));
        if (cap <= 200) expect(full.size).toBeGreaterThan(0);
        if (cap === 1e9) expect(full.size).toBe(0);
      }
    }
  });

  it('seating a home at its nearest building when everyone fits is what the full seating gives', () => {
    street([8, 9, 10, 11, 12, 13, 14, 15, 16]);
    school(9); school(15);
    // 50 each: the quick test passes (nearest loads are 50 and 40) and nobody is turned away.
    capacity[BUILDING_SCHOOL] = 50;
    expect(covered([8, 9, 10, 11, 12, 13, 14, 15, 16]).length).toBe(9);
    expect([8, 9, 10, 11, 12, 13, 14, 15, 16].map(seatX)).toEqual([9, 9, 9, 9, 9, 15, 15, 15, 15]);
  });

  it('the quick test and the full seating agree on whether anyone is turned away', () => {
    street([8, 9, 10, 11, 12, 13, 14, 15, 16]);
    school(9); school(15);
    const reaches = [buildingReach(w, 9, 9, BUILDING_SCHOOL), buildingReach(w, 15, 9, BUILDING_SCHOOL)];
    // Each school reaches all nine homes (90 residents).
    expect(nothingIsFull(w, reaches, 90)).toBe(true);
    expect(assignSeats(w, reaches, 90).full.size).toBe(0);
    expect(nothingIsFull(w, reaches, 0)).toBe(true);
    // Between them they have room at 45 each, but the quick test cannot tell: it defers to the seating.
    expect(nothingIsFull(w, reaches, 50)).toBe(false);
    expect(assignSeats(w, reaches, 50).full.size).toBe(0);
    expect(assignSeats(w, reaches, 40).full.size).toBe(1);
  });

  it("a kind with no capacity reports each building's nearest residents and nobody unseated", () => {
    street([8, 9, 10, 14, 15, 16]);
    school(9); school(15);
    expect(buildingSeats(w, 9, 9)).toEqual({ capacity: 0, seated: 30, inReachUnseated: 0 });
    expect(buildingSeats(w, 15, 9)).toEqual({ capacity: 0, seated: 30, inReachUnseated: 0 });
    expect(buildingSeats(w, 3, 3)).toBeNull();
    expect(seatX(10)).toBe(9);
    expect(seatX(14)).toBe(15);
  });
});
