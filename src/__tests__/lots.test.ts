// Merged 2×2 lots, phase 1 (sim/lots.ts, BIG_LOTS_DESIGN.md): the model. Four
// top-level lots of one zone become one building: its tiles sit at level 4
// with a quarter each in layers.lot, it holds 1.5× what they did, and it comes
// down as a whole, with one undo. Nothing merges on its own yet.

import { describe, it, expect } from 'vitest';
import { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { BUILDING_PARK, ROAD_STREET, ZONE_C, ZONE_I, ZONE_NONE, ZONE_R } from '../sim/constants';
import { LOT_LEVEL, canMergeLot, cleanLots, levelWeight, lotSummary, mergeLot, nearestMergeable } from '../sim/lots';
import { EconomySystem } from '../sim/systems/EconomySystem';
import { FireSystem } from '../sim/systems/FireSystem';
import { utilityDemand } from '../sim/systems/utilityCoverage';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { PaintZoneCommand } from '../commands/PaintZoneCommand';
import { BuildRoadCommand } from '../commands/BuildRoadCommand';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { pcQuote, pcQuoteMany } from '../sim/politics';
import { serialize, deserialize } from '../persistence/Serializer';
import { migrate, SAVE_VERSION, type SaveRecord } from '../persistence/SaveFormat';
import { landWorld, withoutActionCap } from './pcTestWorld';

// These tests check the PC formulas' own prices: the one-action limit is tested in pcActionCap.test.ts.
withoutActionCap();

const TOP = BALANCE.growth.maxLevel;

/** A 2×2 of top-level lots of `zone` with its NW corner at (x, y). */
function block(w: World, x: number, y: number, zone = ZONE_R, level: number = TOP): number[] {
  const tiles: number[] = [];
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    w.setZone(x + dx, y + dy, zone);
    w.layers.devLevel[w.grid.idx(x + dx, y + dy)] = level;
    tiles.push(w.grid.idx(x + dx, y + dy));
  }
  return tiles;
}

/** A world with a merged lot of `zone` at (10, 10)–(11, 11), and plenty of political capital. */
function merged(zone = ZONE_R): { w: World; tiles: number[] } {
  const w = landWorld();
  w.budget.politicalCapital = 1e6;
  const tiles = block(w, 10, 10, zone);
  expect(mergeLot(w, 10, 10)).toBe(true);
  return { w, tiles };
}

const snapshot = (w: World) => ({
  zone: [...w.layers.zone], dev: [...w.layers.devLevel], lot: [...w.layers.lot], road: [...w.layers.roadClass],
  building: [...w.layers.building], variant: [...w.layers.visualVariant], pc: w.budget.politicalCapital, money: w.budget.money,
});

describe('the level tables', () => {
  it('count levels 0 to 3 as themselves, so nothing changes for ordinary lots', () => {
    for (let d = 0; d <= TOP; d++) expect(levelWeight(d)).toBe(d);
  });

  it('give a merged lot 1.5× a top-level lot, in residents and in weight', () => {
    expect(LOT_LEVEL).toBe(TOP + 1);
    expect(levelWeight(LOT_LEVEL)).toBe(1.5 * TOP);
    expect(BALANCE.growth.popPerLevel[LOT_LEVEL]).toBe(1.5 * BALANCE.growth.popPerLevel[TOP]);
  });
});

describe('merging', () => {
  it('turns four top-level lots of one zone into one building', () => {
    const w = landWorld();
    const tiles = block(w, 10, 10);
    const variants = tiles.map((i) => w.layers.visualVariant[i]);
    const seen: unknown[] = [];
    w.events.on('lotMerged', (e) => seen.push(e));
    expect(canMergeLot(w, 10, 10)).toBe(true);
    expect(mergeLot(w, 10, 10)).toBe(true);
    expect(tiles.map((i) => w.layers.lot[i])).toEqual([1, 2, 3, 4]);
    for (const i of tiles) {
      expect(w.layers.devLevel[i]).toBe(LOT_LEVEL);
      expect(w.layers.zone[i]).toBe(ZONE_R);
      expect(w.lotAnchor(i)).toBe(tiles[0]);
      expect(w.lotTilesAt(i)).toEqual(tiles);
    }
    expect(tiles.map((i) => w.layers.visualVariant[i])).toEqual(variants);   // the anchor's look is kept for the art
    expect(seen).toEqual([{ tx: 10, ty: 10, zone: ZONE_R, shape: 'square' }]);
    expect(w.lotAnchor(w.grid.idx(12, 10))).toBe(-1);
    expect(w.lotTilesAt(w.grid.idx(12, 10))).toEqual([]);
  });

  it('works for shops and industry too', () => {
    for (const zone of [ZONE_C, ZONE_I]) expect(lotSummary(merged(zone).w, 10 + 10 * 32)!.zone).toBe(zone);
  });

  it('refuses anything but a whole 2×2 of top-level lots of one zone', () => {
    const tries: [string, (w: World) => void][] = [
      ['a lower level', (w) => { w.layers.devLevel[w.grid.idx(11, 11)] = TOP - 1; }],
      ['another zone', (w) => { w.setZone(11, 10, ZONE_C); w.layers.devLevel[w.grid.idx(11, 10)] = TOP; }],
      ['an abandoned lot', (w) => { w.layers.abandoned[w.grid.idx(10, 11)] = 1; }],
      ['an unzoned tile', (w) => { w.setZone(10, 10, ZONE_NONE); }],
      ['a road', (w) => { w.setRoad(11, 11, ROAD_STREET); }],
    ];
    for (const [name, spoil] of tries) {
      const w = landWorld();
      block(w, 10, 10);
      spoil(w);
      const before = snapshot(w);
      expect(mergeLot(w, 10, 10), name).toBe(false);
      expect(snapshot(w), name).toEqual(before);
    }
    const w = landWorld();
    block(w, 30, 30);
    expect(mergeLot(w, 31, 31)).toBe(false);          // off the map
    expect(mergeLot(w, -1, 0)).toBe(false);
  });

  it('never overlaps another merged lot', () => {
    const { w } = merged();
    block(w, 12, 10);
    w.layers.devLevel[w.grid.idx(11, 10)] = LOT_LEVEL;                      // (restore what block() did not touch)
    expect(canMergeLot(w, 11, 10)).toBe(false);
    expect(canMergeLot(w, 11, 10, true)).toBe(false);
    expect(mergeLot(w, 12, 10)).toBe(true);                                 // side by side is fine
    expect(w.lotAnchor(w.grid.idx(13, 11))).toBe(w.grid.idx(12, 10));
    expect(w.lotAnchor(w.grid.idx(11, 11))).toBe(w.grid.idx(10, 10));
  });

  it('the debug merge takes any zoned 2×2, and finds the nearest one', () => {
    const w = landWorld();
    block(w, 10, 10, ZONE_C, 1);
    block(w, 20, 20, ZONE_C, 0);
    expect(canMergeLot(w, 10, 10)).toBe(false);
    expect(nearestMergeable(w, 12, 12)).toBeNull();
    expect(nearestMergeable(w, 12, 12, true)).toEqual({ tx: 10, ty: 10 });
    expect(nearestMergeable(w, 19, 19, true)).toEqual({ tx: 20, ty: 20 });
    expect(mergeLot(w, 10, 10, true)).toBe(true);
    expect(w.layers.devLevel[w.grid.idx(11, 11)]).toBe(LOT_LEVEL);
  });
});

describe('capacity', () => {
  it('a merged lot holds 1.5× the residents, pays 1.5× the tax and draws 1.5× the utilities of its four lots', () => {
    const measure = (merge: boolean) => {
      const w = landWorld();
      block(w, 10, 10);
      if (merge) mergeLot(w, 10, 10);
      const before = w.budget.money;
      new EconomySystem().update(w);
      return { population: w.stats.population, income: w.budget.money - before, power: utilityDemand(w, 1, 1), summary: lotSummary(w, w.grid.idx(11, 11)) };
    };
    const four = measure(false), one = measure(true);
    expect(four.population).toBe(4 * BALANCE.growth.popPerLevel[TOP]);
    expect(one.population).toBe(1.5 * four.population);
    expect(one.power).toBe(1.5 * four.power);
    expect(four.income).toBeGreaterThan(0);
    expect(one.income).toBeCloseTo(1.5 * four.income, 6);
    expect(four.summary).toBeNull();
    expect(one.summary).toMatchObject({ zone: ZONE_R, abandoned: false, residents: one.population, weight: 4 * levelWeight(LOT_LEVEL) });
  });
});

describe('it is one building', () => {
  it('bulldozing any tile brings the whole of it down, and one undo puts it back', () => {
    for (let q = 0; q < 4; q++) {
      const { w, tiles } = merged();
      const before = snapshot(w);
      const cmd = new BulldozeCommand(10 + (q & 1), 10 + (q >> 1));
      expect(cmd.execute(w)).toBe(true);
      for (const i of tiles) {
        expect(w.layers.devLevel[i]).toBe(0);
        expect(w.layers.lot[i]).toBe(0);
        expect(w.layers.zone[i]).toBe(i === tiles[q] ? ZONE_NONE : ZONE_R);   // the rest of the land stays zoned, empty
      }
      expect(w.budget.politicalCapital).toBeLessThan(before.pc);
      cmd.undo(w);
      expect(snapshot(w)).toEqual(before);
    }
  });

  it('so does rezoning a tile, a road through it, and a building on part of it', () => {
    const acts: [string, () => { execute(w: World): boolean; undo(w: World): void }][] = [
      ['rezone', () => new PaintZoneCommand(11, 10, ZONE_C)],
      ['road', () => new BuildRoadCommand(10, 11, ROAD_STREET)],
      ['building', () => new PlaceBuildingCommand(11, 11, BUILDING_PARK)],
    ];
    for (const [name, make] of acts) {
      const { w, tiles } = merged();
      w.budget.money = 1e6;
      const before = snapshot(w);
      const cmd = make();
      expect(cmd.execute(w), name).toBe(true);
      for (const i of tiles) {
        expect(w.layers.lot[i], name).toBe(0);
        expect(w.layers.devLevel[i], name).toBe(0);
      }
      expect(tiles.filter((i) => w.layers.zone[i] === ZONE_R).length, name).toBe(3);
      cmd.undo(w);
      expect(snapshot(w), name).toEqual(before);
    }
  });

  it('the price is for everybody in it, once, whichever tiles are touched', () => {
    const { w } = merged();
    const everyone = 4 * BALANCE.growth.popPerLevel[LOT_LEVEL];
    const one = pcQuote(w, { type: 'bulldoze', tx: 11, ty: 11 });
    expect(one.displacedPopulation).toBe(everyone);
    expect(one.parts.filter((p) => p.reason === 'displacement').length).toBe(4);
    // Four ordinary top-level homes cost 4 × 20 residents; the merged lot 4 × 30.
    const plain = landWorld();
    plain.budget.politicalCapital = 1e6;
    block(plain, 10, 10);
    const each = pcQuote(plain, { type: 'bulldoze', tx: 11, ty: 11 });
    expect(one.cost).toBeCloseTo(4 * 1.5 * each.cost, 6);
    // A drag over two of its tiles, or a rezone, or a road: the same people, counted once.
    const two = pcQuoteMany(w, [{ type: 'bulldoze', tx: 10, ty: 10 }, { type: 'bulldoze', tx: 11, ty: 10 }]);
    expect(two.displacedPopulation).toBe(everyone);
    expect(two.cost).toBeCloseTo(one.cost, 6);
    expect(pcQuote(w, { type: 'zone', tx: 10, ty: 11, zone: ZONE_I }).displacedPopulation).toBe(everyone);
    expect(pcQuote(w, { type: 'road', tx: 10, ty: 11, roadClass: ROAD_STREET }).displacedPopulation).toBe(everyone);
  });

  it('clearing an abandoned one rewards all four tiles', () => {
    const { w, tiles } = merged(ZONE_C);
    for (const i of tiles) w.layers.abandoned[i] = 1;
    const q = pcQuote(w, { type: 'bulldoze', tx: 10, ty: 10 });
    expect(q.parts.filter((p) => p.reason === 'blightCleared').length).toBe(4);
    expect(q.displacedPopulation).toBe(0);
  });

  it('a fire that guts it leaves four empty lots', () => {
    const { w, tiles } = merged(ZONE_I);
    w.rng = () => 0.99;                                // no new fires, no spreading
    w.setFire(11, 10, 1);                              // about to burn out, with no fire station
    new FireSystem().update(w);
    for (const i of tiles) {
      expect(w.layers.lot[i]).toBe(0);
      expect(w.layers.devLevel[i]).toBe(0);
      expect(w.layers.zone[i]).toBe(ZONE_I);
    }
  });
});

describe('saving', () => {
  it('a merged lot saves and loads as itself', () => {
    const { w, tiles } = merged();
    const back = deserialize(serialize(w));
    expect(tiles.map((i) => back.layers.lot[i])).toEqual([1, 2, 3, 4]);
    for (const i of tiles) expect(back.layers.devLevel[i]).toBe(LOT_LEVEL);
    expect([...back.layers.lot]).toEqual([...w.layers.lot]);
  });

  it('a save from before merged lots loads with none, at the new version', () => {
    const { w } = merged();
    const snap = serialize(w);
    const old = { ...snap.layers } as Record<string, unknown>;
    delete old.lot;
    const rec = migrate({ version: 10, userId: 'u', slot: 0, meta: { name: 'x', savedAt: 0, tick: 0, population: 0, money: 0 }, snapshot: { ...snap, layers: old } } as unknown as SaveRecord);
    expect(rec.version).toBe(SAVE_VERSION);
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(11);
    const back = deserialize(rec.snapshot);
    expect(back.layers.lot.every((v) => v === 0)).toBe(true);
    // Level 4 with no lot layer cannot be a merged lot: it loads as an ordinary top-level lot.
    expect(back.layers.devLevel[back.grid.idx(10, 10)]).toBe(TOP);
  });

  it('a damaged lot layer is put right on load', () => {
    const { w, tiles } = merged();
    block(w, 20, 20);
    mergeLot(w, 20, 20);
    w.layers.lot[tiles[3]] = 0;                        // a quarter missing: not a merged lot any more
    w.layers.lot[w.grid.idx(5, 5)] = 2;                // a stray quarter on empty land
    cleanLots(w);
    for (const i of tiles) { expect(w.layers.lot[i]).toBe(0); expect(w.layers.devLevel[i]).toBe(TOP); }
    expect(w.layers.lot[w.grid.idx(5, 5)]).toBe(0);
    expect(w.lotAnchor(w.grid.idx(21, 21))).toBe(w.grid.idx(20, 20));      // the sound one is untouched
    expect(w.layers.devLevel[w.grid.idx(21, 21)]).toBe(LOT_LEVEL);
  });
});
