// Merged 2×2 lots: when lots merge (systems/LotMergeSystem.ts, BIG_LOTS_DESIGN.md).
// Four top-level lots of one zone, each happy and in a prime spot for
// BALANCE.lots.streakDays days in a row, then a daily chance, with a cap on
// merges per day and a gap between merged lots. Shipped switched off (chance 0).
//
// Industry has no location test, so the tests of the mechanics use industry;
// "a prime spot" tests homes and shops.

import { describe, it, expect, afterEach } from 'vitest';
import { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { BUILDING_PARK, TERRAIN_WATER, ZONE_C, ZONE_I, ZONE_R } from '../sim/constants';
import { LOT_LEVEL, clearOfLots, jobsNearby, lotIsHappy, mergeCandidates, mergeLot, primeSpot } from '../sim/lots';
import { LotMergeSystem } from '../sim/systems/LotMergeSystem';
import { createSystems } from '../sim/createSystems';
import { serialize, deserialize } from '../persistence/Serializer';
import { landWorld } from './pcTestWorld';

const TOP = BALANCE.growth.maxLevel;
const cfg = BALANCE.lots as unknown as {
  chancePerDay: number; approvedChancePerDay: number; streakDays: number; minSatisfaction: number; maxPerDay: number; spacing: number;
  minLandValue: number; jobsRadius: number; topJobsShare: number; parkRadius: number; waterRadius: number;
};
const shipped = { ...cfg };
afterEach(() => { Object.assign(cfg, shipped); });

function lot(w: World, x: number, y: number, zone: number, level: number = TOP, value = 255): number {
  const i = w.grid.idx(x, y);
  w.setZone(x, y, zone);
  w.layers.devLevel[i] = level;
  w.layers.landValue[i] = value;
  return i;
}
/** Top-level lots of `zone` on the 2×2 at (x, y), on land worth `value`. */
function block(w: World, x: number, y: number, zone = ZONE_I, value = 255): number[] {
  return [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => lot(w, x + dx, y + dy, zone, TOP, value));
}
function city(size = 32): World {
  const w = landWorld(size);
  w.stats.satisfaction = 1;
  return w;
}
/** `n` game days of the merge system alone. */
function days(w: World, n: number, sys = new LotMergeSystem()): void {
  for (let k = 0; k < n; k++) { w.tick += BALANCE.ticksPerDay; sys.update(w); }
}
const mergedAt = (w: World, x: number, y: number): boolean => w.layers.lot[w.grid.idx(x, y)] === 1;

describe('as shipped', () => {
  it('merging is switched off, and the system then does nothing at all', () => {
    expect(BALANCE.lots.chancePerDay).toBe(0);
    const w = city();
    const tiles = block(w, 10, 10);
    let rolls = 0;
    w.rng = () => { rolls++; return 0; };
    days(w, 100);
    expect(rolls).toBe(0);
    expect(tiles.map((i) => w.lotStreak[i])).toEqual([0, 0, 0, 0]);
    expect(mergedAt(w, 10, 10)).toBe(false);
  });

  it('the owner-approved numbers are in place, ready to switch on', () => {
    expect(BALANCE.lots).toMatchObject({ approvedChancePerDay: 0.003, streakDays: 10, minSatisfaction: 0.9, maxPerDay: 1, spacing: 4, minLandValue: 55, jobsRadius: 8, topJobsShare: 0.1, parkRadius: 2, waterRadius: 3 });
  });

  it('it is one of the simulation\'s systems', () => {
    expect(createSystems().systems.some((s) => s instanceof LotMergeSystem)).toBe(true);
  });
});

describe('with merging on', () => {
  it('a block merges once all four lots have counted for the whole streak', () => {
    cfg.chancePerDay = 1;
    const w = city();
    const tiles = block(w, 10, 10);
    const seen: unknown[] = [];
    w.events.on('lotMerged', (e) => seen.push(e));
    days(w, cfg.streakDays - 1);
    expect(tiles.map((i) => w.lotStreak[i])).toEqual(Array(4).fill(cfg.streakDays - 1));
    expect(mergeCandidates(w)).toEqual([]);
    expect(mergedAt(w, 10, 10)).toBe(false);
    days(w, 1);
    expect(tiles.map((i) => w.layers.lot[i])).toEqual([1, 2, 3, 4]);
    for (const i of tiles) expect(w.layers.devLevel[i]).toBe(LOT_LEVEL);
    expect(seen).toEqual([{ tx: 10, ty: 10, zone: ZONE_I }]);
    expect(tiles.map((i) => w.lotStreak[i])).toEqual([0, 0, 0, 0]);
  });

  it('happens only once a game day', () => {
    cfg.chancePerDay = 1;
    cfg.streakDays = 3;
    const w = city();
    const tiles = block(w, 10, 10);
    const sys = new LotMergeSystem();
    for (let k = 0; k < BALANCE.ticksPerDay * 2; k++) { w.tick++; sys.update(w); }
    expect(w.lotStreak[tiles[0]]).toBe(2);
  });

  it('a bad day for one lot starts its streak again, and the block waits for it', () => {
    cfg.chancePerDay = 1;
    const spoil: [string, (w: World, i: number) => void, (w: World, i: number) => void][] = [
      ['distress', (w, i) => { w.layers.distress[i] = 1; }, (w, i) => { w.layers.distress[i] = 0; }],
      ['an unhappy city', (w) => { w.stats.satisfaction = cfg.minSatisfaction - 0.01; }, (w) => { w.stats.satisfaction = 1; }],
    ];
    for (const [name, bad, good] of spoil) {
      const w = city();
      const tiles = block(w, 10, 10);
      days(w, cfg.streakDays - 1);
      bad(w, tiles[2]);
      expect(lotIsHappy(w, tiles[2]), name).toBe(false);
      days(w, 1);
      expect(w.lotStreak[tiles[2]], name).toBe(0);
      expect(mergedAt(w, 10, 10), name).toBe(false);
      good(w, tiles[2]);
      days(w, cfg.streakDays - 1);
      expect(mergedAt(w, 10, 10), name).toBe(false);          // the others are long ready; this one is a day short
      days(w, 1);
      expect(mergedAt(w, 10, 10), name).toBe(true);
    }
  });

  it('lots below the top level, abandoned lots and mixed zones never start', () => {
    cfg.chancePerDay = 1;
    const w = city();
    const low = block(w, 4, 4);
    w.layers.devLevel[low[0]] = TOP - 1;
    const ruin = block(w, 12, 4);
    w.layers.abandoned[ruin[1]] = 1;
    block(w, 20, 4);
    lot(w, 21, 5, ZONE_C);
    days(w, cfg.streakDays * 3);
    expect(w.layers.lot.every((v) => v === 0)).toBe(true);
    expect(w.lotStreak[low[0]]).toBe(0);
    expect(w.lotStreak[ruin[1]]).toBe(0);
  });

  it('a ready block still has to win its daily roll', () => {
    cfg.chancePerDay = 0.1;
    const w = city();
    block(w, 10, 10);
    w.rng = () => 0.5;
    days(w, cfg.streakDays + 20);
    expect(mergedAt(w, 10, 10)).toBe(false);
    w.rng = () => 0.05;
    days(w, 1);
    expect(mergedAt(w, 10, 10)).toBe(true);
  });

  it('no more than the daily cap merge, however many are ready', () => {
    cfg.chancePerDay = 1;
    const w = city(48);
    const xs = [2, 12, 22, 32];
    for (const x of xs) block(w, x, 4);
    const count = () => xs.filter((x) => mergedAt(w, x, 4)).length;
    days(w, cfg.streakDays);
    expect(count()).toBe(1);
    days(w, 1);
    expect(count()).toBe(2);
    cfg.maxPerDay = 2;
    days(w, 1);
    expect(count()).toBe(4);
  });

  it('nothing merges in the tutorial city', () => {
    cfg.chancePerDay = 1;
    const w = city();
    w.tutorial = { step: 0 };
    block(w, 10, 10);
    days(w, cfg.streakDays * 2);
    expect(mergedAt(w, 10, 10)).toBe(false);
  });

  it('the same seed gives the same merges', () => {
    cfg.chancePerDay = 0.3;
    const run = (): number[] => {
      const w = new World(64, 32, 77);
      w.layers.terrain.fill(0);
      w.layers.vegetation.fill(0);
      w.stats.satisfaction = 1;
      for (const x of [2, 12, 22, 32, 42]) block(w, x, 4);
      days(w, cfg.streakDays + 6);
      return [...w.layers.lot];
    };
    expect(run()).toEqual(run());
  });

  it('streaks are saved', () => {
    cfg.chancePerDay = 1;
    const w = city();
    const tiles = block(w, 10, 10);
    days(w, 4);
    const back = deserialize(serialize(w));
    expect(tiles.map((i) => back.lotStreak[i])).toEqual([4, 4, 4, 4]);
    const snap = serialize(w);
    const old = { ...snap.layers } as Record<string, unknown>;
    delete old.lotStreak;                                               // a save from before streaks: they start from 0
    expect(deserialize({ ...snap, layers: old as typeof snap.layers }).lotStreak.every((v) => v === 0)).toBe(true);
  });
});

describe('spacing', () => {
  it('no block merges within the gap of a merged lot', () => {
    cfg.chancePerDay = 1;
    cfg.maxPerDay = 9;
    const w = city(48);
    block(w, 10, 10);
    expect(mergeLot(w, 10, 10)).toBe(true);
    const gap = cfg.spacing;
    const near = 12 + gap - 1, far = 12 + gap;                           // the first column `gap` tiles clear of (11, …) is 12 + gap
    block(w, near, 10);
    block(w, 10, 12 + gap + 6);
    expect(clearOfLots(w, near, 10)).toBe(false);
    expect(clearOfLots(w, far, 10)).toBe(true);
    days(w, cfg.streakDays + 3);
    expect(mergedAt(w, near, 10)).toBe(false);
    expect(mergedAt(w, 10, 12 + gap + 6)).toBe(true);
  });

  it('a field of ready lots gets merged lots a gap apart, never side by side', () => {
    cfg.chancePerDay = 1;
    cfg.maxPerDay = 9;
    const w = city(48);
    for (let y = 4; y < 20; y++) for (let x = 4; x < 20; x++) lot(w, x, y, ZONE_I);
    days(w, cfg.streakDays + 30);
    const anchors = [...w.layers.lot.keys()].filter((i) => w.layers.lot[i] === 1);
    expect(anchors.length).toBeGreaterThan(1);
    expect(w.layers.lot.filter((v) => v !== 0).length).toBe(anchors.length * 4);
    for (const a of anchors) for (const b of anchors) {
      if (a >= b) continue;
      const ax = a % 48, ay = (a - ax) / 48, bx = b % 48, by = (b - bx) / 48;
      // The clear tiles between two 2×2 lots, on whichever axis separates them more.
      expect(Math.max(Math.abs(ax - bx), Math.abs(ay - by)) - 2).toBeGreaterThanOrEqual(cfg.spacing);
    }
  });
});

describe('a prime spot', () => {
  /** A town: 100 homes in a row of blocks, with shops at the east end, so "jobs nearby" falls off to the west. */
  function town(): { w: World; homes: number[] } {
    const w = city(64);
    const homes: number[] = [];
    for (let x = 4; x < 54; x++) for (const y of [20, 21]) homes.push(lot(w, x, y, ZONE_R));
    for (let x = 50; x < 60; x++) for (const y of [24, 25]) lot(w, x, y, ZONE_C, 1);
    return { w, homes };
  }

  it('jobs nearby counts developed, occupied shops and industry within the radius', () => {
    const w = city();
    const here = lot(w, 10, 10, ZONE_R);
    lot(w, 10 + cfg.jobsRadius, 10, ZONE_C, 1);
    lot(w, 10, 10 - cfg.jobsRadius, ZONE_I, 2);
    lot(w, 10 + cfg.jobsRadius + 1, 10, ZONE_C, 1);                       // just out of reach
    lot(w, 12, 12, ZONE_C, 0);                                            // zoned, not built
    w.layers.abandoned[lot(w, 8, 8, ZONE_I, 2)] = 1;                      // abandoned
    lot(w, 9, 9, ZONE_R);                                                 // homes are not jobs
    expect(jobsNearby(w).at(here)).toBe(2);
  });

  it('homes in the top tenth for jobs nearby are prime; the rest are not', () => {
    const { w, homes } = town();
    const jobs = jobsNearby(w);
    const prime = homes.filter((i) => primeSpot(w, i, jobs));
    expect(prime.length).toBeGreaterThan(0);
    expect(prime.length).toBeLessThanOrEqual(homes.length * 0.2);         // about a tenth (ties at the bar count)
    // They are the homes nearest the shops: every prime home has at least as many jobs nearby as any other.
    const least = Math.min(...prime.map((i) => jobs.at(i)));
    for (const i of homes) if (!prime.includes(i)) expect(jobs.at(i)).toBeLessThan(least);
    expect(primeSpot(w, homes[0], jobs)).toBe(false);                     // the far west end
  });

  it('a park or water makes a home prime if it is at least middling for jobs', () => {
    const { w, homes } = town();
    let jobs = jobsNearby(w);
    const middling = homes.find((i) => jobs.at(i) >= jobs.median && jobs.at(i) < jobs.top)!;
    const poor = homes.find((i) => jobs.at(i) < jobs.median)!;
    const mx = middling % 64, px = poor % 64;
    expect(primeSpot(w, middling, jobs)).toBe(false);
    // A park within reach …
    w.layers.building[w.grid.idx(mx, 20 - cfg.parkRadius)] = BUILDING_PARK;
    w.layers.building[w.grid.idx(px, 20 - cfg.parkRadius)] = BUILDING_PARK;
    expect(primeSpot(w, middling, jobs)).toBe(true);
    expect(primeSpot(w, poor, jobs)).toBe(false);                         // below the median: a park is not enough
    // … but not one tile further.
    w.layers.building[w.grid.idx(mx, 20 - cfg.parkRadius)] = 0;
    w.layers.building[w.grid.idx(mx, 20 - cfg.parkRadius - 1)] = BUILDING_PARK;
    expect(primeSpot(w, middling, jobs)).toBe(false);
    // Water reaches a tile further than a park.
    w.layers.building[w.grid.idx(mx, 20 - cfg.parkRadius - 1)] = 0;
    w.layers.terrain[w.grid.idx(mx, 20 - cfg.waterRadius)] = TERRAIN_WATER;
    jobs = jobsNearby(w);
    expect(primeSpot(w, middling, jobs)).toBe(true);
    w.layers.terrain[w.grid.idx(mx, 20 - cfg.waterRadius)] = 0;
    w.layers.terrain[w.grid.idx(mx, 20 - cfg.waterRadius - 1)] = TERRAIN_WATER;
    expect(primeSpot(w, middling, jobs)).toBe(false);
  });

  it('blighted land is never prime for homes and shops, however central', () => {
    const { w, homes } = town();
    const jobs = jobsNearby(w);
    const best = homes.find((i) => primeSpot(w, i, jobs))!;
    w.layers.landValue[best] = cfg.minLandValue - 1;
    expect(primeSpot(w, best, jobs)).toBe(false);
    w.layers.landValue[best] = cfg.minLandValue;
    expect(primeSpot(w, best, jobs)).toBe(true);
  });

  it('industry is prime anywhere, on any land', () => {
    const w = city();
    const i = lot(w, 10, 10, ZONE_I, TOP, 0);
    expect(primeSpot(w, i, jobsNearby(w))).toBe(true);
  });

  it('a city with no jobs has no prime homes', () => {
    const w = city();
    const tiles = block(w, 10, 10, ZONE_R);
    const jobs = jobsNearby(w);
    expect(jobs.top).toBe(Infinity);
    for (const i of tiles) expect(primeSpot(w, i, jobs)).toBe(false);
  });

  it('homes downtown merge; the same homes at the edge of town do not', () => {
    cfg.chancePerDay = 1;
    cfg.maxPerDay = 9;
    const { w } = town();
    days(w, cfg.streakDays + 5);
    const anchors = [...w.layers.lot.keys()].filter((i) => w.layers.lot[i] === 1).map((i) => i % 64);
    expect(anchors.length).toBeGreaterThanOrEqual(1);
    for (const x of anchors) expect(x).toBeGreaterThan(40);               // by the shops, which are at x 50–59
  });
});
