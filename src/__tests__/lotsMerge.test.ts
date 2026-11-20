// Merged 2×2 lots, phase 3 (systems/LotMergeSystem.ts, BIG_LOTS_DESIGN.md):
// when lots merge. Four top-level lots of one zone, each happy and on valuable
// land for BALANCE.lots.streakDays days in a row, then a daily chance, with a
// cap on merges per day. Shipped switched off (chance 0).

import { describe, it, expect, afterEach } from 'vitest';
import { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { ZONE_C, ZONE_I, ZONE_R } from '../sim/constants';
import { LOT_LEVEL, lotIsHappy, mergeCandidates } from '../sim/lots';
import { LotMergeSystem } from '../sim/systems/LotMergeSystem';
import { createSystems } from '../sim/createSystems';
import { serialize, deserialize } from '../persistence/Serializer';
import { landWorld } from './pcTestWorld';

const TOP = BALANCE.growth.maxLevel;
const cfg = BALANCE.lots as { chancePerDay: number; streakDays: number; minSatisfaction: number; maxPerDay: number; minLandValue: Record<number, number> };
const shipped = { ...cfg };
afterEach(() => { Object.assign(cfg, shipped); });

/** Top-level lots of `zone` on the 2×2 at (x, y), on land worth `value`. */
function block(w: World, x: number, y: number, zone = ZONE_R, value = 255): number[] {
  const tiles: number[] = [];
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const i = w.grid.idx(x + dx, y + dy);
    w.setZone(x + dx, y + dy, zone);
    w.layers.devLevel[i] = TOP;
    w.layers.landValue[i] = value;
    tiles.push(i);
  }
  return tiles;
}

function city(): World {
  const w = landWorld();
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

  it('it is one of the simulation\'s systems', () => {
    expect(createSystems().systems.some((s) => s instanceof LotMergeSystem)).toBe(true);
  });
});

describe('with merging on', () => {
  it('a block merges once all four lots have been happy and valuable for the whole streak', () => {
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
    expect(seen).toEqual([{ tx: 10, ty: 10, zone: ZONE_R }]);
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
      ['cheap land', (w, i) => { w.layers.landValue[i] = cfg.minLandValue[ZONE_R] - 1; }, (w, i) => { w.layers.landValue[i] = 255; }],
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
    const ruin = block(w, 8, 4);
    w.layers.abandoned[ruin[1]] = 1;
    const mixed = block(w, 12, 4);
    w.setZone(13, 5, ZONE_C);
    w.layers.devLevel[mixed[3]] = TOP;
    w.layers.landValue[mixed[3]] = 255;
    days(w, cfg.streakDays * 3);
    expect(w.layers.lot.every((v) => v === 0)).toBe(true);
    expect(w.lotStreak[low[0]]).toBe(0);
    expect(w.lotStreak[ruin[1]]).toBe(0);
  });

  it('industry merges on cheaper land than homes and shops', () => {
    cfg.chancePerDay = 1;
    const value = cfg.minLandValue[ZONE_I];
    expect(value).toBeLessThan(cfg.minLandValue[ZONE_R]);
    const w = city();
    block(w, 4, 4, ZONE_I, value);
    block(w, 8, 4, ZONE_R, value);
    block(w, 12, 4, ZONE_C, value);
    cfg.maxPerDay = 3;
    days(w, cfg.streakDays);
    expect([mergedAt(w, 4, 4), mergedAt(w, 8, 4), mergedAt(w, 12, 4)]).toEqual([true, false, false]);
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
    const w = city();
    for (const x of [4, 8, 12, 16]) block(w, x, 4);
    const count = () => [4, 8, 12, 16].filter((x) => mergedAt(w, x, 4)).length;
    days(w, cfg.streakDays);
    expect(count()).toBe(1);
    days(w, 1);
    expect(count()).toBe(2);
    cfg.maxPerDay = 2;
    days(w, 1);
    expect(count()).toBe(4);
  });

  it('overlapping blocks never share a tile', () => {
    cfg.chancePerDay = 1;
    cfg.maxPerDay = 9;
    const w = city();
    for (let y = 4; y < 7; y++) for (let x = 4; x < 9; x++) {            // a 5×3 field of ready lots
      w.setZone(x, y, ZONE_R);
      w.layers.devLevel[w.grid.idx(x, y)] = TOP;
      w.layers.landValue[w.grid.idx(x, y)] = 255;
    }
    days(w, cfg.streakDays + 5);
    const anchors = [...w.layers.lot.keys()].filter((i) => w.layers.lot[i] === 1);
    expect(anchors.length).toBeGreaterThanOrEqual(1);
    for (const a of anchors) expect(w.lotTilesAt(a).map((t) => w.layers.lot[t])).toEqual([1, 2, 3, 4]);
    expect(w.layers.lot.filter((v) => v !== 0).length).toBe(anchors.length * 4);
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
      const w = new World(32, 32, 77);
      w.layers.terrain.fill(0);
      w.layers.vegetation.fill(0);
      w.stats.satisfaction = 1;
      for (const x of [4, 8, 12, 16, 20]) block(w, x, 4);
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
