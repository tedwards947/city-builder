// Merged pairs of shops (sim/lots.ts, BIG_LOTS_DESIGN.md; owner, 2026-11-20).
// Shops seldom stand two deep, so two top-level shops side by side, east–west
// ("wide") or north–south ("tall"), can become one building too. Everything
// else is the 2×2's: level 4 on each tile, one building to knock down, burn,
// abandon; the same streak, prime spot, chance, spacing and daily cap. Homes
// and industry stay 2×2 only, and a pair waits where a 2×2 of shops is possible.

import { describe, it, expect, afterEach } from 'vitest';
import { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { ROAD_STREET, ZONE_C, ZONE_I, ZONE_R } from '../sim/constants';
import {
  LOT_LEVEL, canMergeLot, canMergePair, cleanLots, clearOfLots, doorTile, isLotAnchor, lotCounts, lotShape, lotSummary,
  mergeCandidates, mergeLot, mergeReport, levelWeight, type LotShape,
} from '../sim/lots';
import { LotMergeSystem } from '../sim/systems/LotMergeSystem';
import { AbandonmentSystem } from '../sim/systems/AbandonmentSystem';
import { CommandHistory } from '../commands/CommandHistory';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { PaintZoneCommand } from '../commands/PaintZoneCommand';
import { serialize, deserialize } from '../persistence/Serializer';
import { landWorld } from './pcTestWorld';

const TOP = BALANCE.growth.maxLevel;
const cfg = BALANCE.lots as unknown as { chancePerDay: number; industryChancePerDay: number; streakDays: number; maxPerDay: number; spacing: number };
const shipped = { ...cfg };
afterEach(() => { Object.assign(cfg, shipped); });

function lot(w: World, x: number, y: number, zone: number = ZONE_C, level: number = TOP): number {
  const i = w.grid.idx(x, y);
  w.setZone(x, y, zone);
  w.layers.devLevel[i] = level;
  w.layers.landValue[i] = 255;
  return i;
}
function city(size = 32): World {
  const w = landWorld(size);
  w.stats.satisfaction = 1;
  w.budget.politicalCapital = 1e6;
  return w;
}
function days(w: World, n: number, sys = new LotMergeSystem()): void {
  for (let k = 0; k < n; k++) { w.tick += BALANCE.ticksPerDay; sys.update(w); }
}
const q = (w: World, x: number, y: number): number => w.layers.lot[w.grid.idx(x, y)];

describe('merging a pair of shops', () => {
  it('a wide pair: two tiles at level 4, the west one the anchor', () => {
    const w = city();
    const a = lot(w, 10, 10), b = lot(w, 11, 10);
    const seen: unknown[] = [];
    w.events.on('lotMerged', (e) => seen.push(e));
    expect(mergeLot(w, 10, 10, false, 'wide')).toBe(true);
    expect([q(w, 10, 10), q(w, 11, 10)]).toEqual([5, 6]);
    expect([w.layers.devLevel[a], w.layers.devLevel[b]]).toEqual([LOT_LEVEL, LOT_LEVEL]);
    expect(w.lotAnchor(a)).toBe(a);
    expect(w.lotAnchor(b)).toBe(a);
    expect(w.lotTilesAt(b)).toEqual([a, b]);
    expect(lotShape(w, b)).toBe('wide');
    expect(isLotAnchor(q(w, 10, 10))).toBe(true);
    expect(isLotAnchor(q(w, 11, 10))).toBe(false);
    expect(seen).toEqual([{ tx: 10, ty: 10, zone: ZONE_C, shape: 'wide' }]);
  });

  it('a tall pair: the north one the anchor', () => {
    const w = city();
    const a = lot(w, 10, 10), b = lot(w, 10, 11);
    expect(mergeLot(w, 10, 10, false, 'tall')).toBe(true);
    expect([q(w, 10, 10), q(w, 10, 11)]).toEqual([7, 8]);
    expect(w.lotAnchor(b)).toBe(a);
    expect(w.lotTilesAt(a)).toEqual([a, b]);
    expect(lotShape(w, a)).toBe('tall');
  });

  it('only shops pair: homes and industry stay 2×2 only, even forced', () => {
    for (const zone of [ZONE_R, ZONE_I]) for (const shape of ['wide', 'tall'] as LotShape[]) {
      const w = city();
      lot(w, 10, 10, zone); lot(w, 11, 10, zone); lot(w, 10, 11, zone);
      expect(canMergeLot(w, 10, 10, true, shape)).toBe(false);
      expect(mergeLot(w, 10, 10, true, shape)).toBe(false);
      expect(q(w, 10, 10)).toBe(0);
    }
  });

  it('needs two top-level shops, neither already merged, and stays on the map', () => {
    const w = city();
    lot(w, 10, 10); lot(w, 11, 10, ZONE_C, 2);
    expect(canMergeLot(w, 10, 10, false, 'wide')).toBe(false);
    expect(canMergeLot(w, 10, 10, true, 'wide')).toBe(true);    // debug: any level
    lot(w, 20, 20); lot(w, 21, 20); lot(w, 22, 20);
    mergeLot(w, 20, 20, false, 'wide');
    expect(canMergeLot(w, 21, 20, false, 'wide')).toBe(false);  // (21,20) is taken
    lot(w, 31, 5);
    expect(canMergeLot(w, 31, 5, true, 'wide')).toBe(false);
  });

  it('it holds half as much again: each tile counts 4.5 where a level-3 shop counts 3', () => {
    const w = city();
    lot(w, 10, 10); lot(w, 11, 10);
    mergeLot(w, 10, 10, false, 'wide');
    const s = lotSummary(w, w.grid.idx(11, 10))!;
    expect(s.shape).toBe('wide');
    expect(s.tiles.length).toBe(2);
    expect(s.weight).toBe(2 * levelWeight(LOT_LEVEL));
    expect(s.weight).toBe(1.5 * 2 * TOP);
  });
});

describe('a pair is one building', () => {
  function pair(shape: LotShape = 'wide') {
    const w = city();
    const a = lot(w, 10, 10), b = shape === 'wide' ? lot(w, 11, 10) : lot(w, 10, 11);
    mergeLot(w, 10, 10, false, shape);
    return { w, a, b, bx: shape === 'wide' ? 11 : 10, by: shape === 'wide' ? 10 : 11 };
  }

  for (const shape of ['wide', 'tall'] as LotShape[]) {
    it(`${shape}: razing either tile brings both down to empty shop lots`, () => {
      for (const which of [0, 1]) {
        const { w, a, b } = pair(shape);
        expect(w.razeLot(which ? b : a)).toBe(true);
        for (const t of [a, b]) {
          expect(w.layers.lot[t]).toBe(0);
          expect(w.layers.devLevel[t]).toBe(0);
          expect(w.layers.zone[t]).toBe(ZONE_C);
        }
      }
    });

    it(`${shape}: bulldozing or rezoning one tile takes the whole building, and one undo puts it back`, () => {
      for (const make of [(x: number, y: number) => new BulldozeCommand(x, y), (x: number, y: number) => new PaintZoneCommand(x, y, ZONE_R)]) {
        const { w, a, b, bx, by } = pair(shape);
        const history = new CommandHistory(w);
        expect(history.run(make(bx, by))).toBe(true);
        expect(w.layers.lot[a]).toBe(0);
        expect(w.layers.devLevel[a]).toBe(0);
        history.undo();
        expect([w.layers.lot[a], w.layers.lot[b]]).toEqual(shape === 'wide' ? [5, 6] : [7, 8]);
        expect([w.layers.devLevel[a], w.layers.devLevel[b]]).toEqual([LOT_LEVEL, LOT_LEVEL]);
      }
    });
  }

  it('a road through one tile takes the building down', () => {
    const { w, a, b } = pair();
    w.setRoad(11, 10, ROAD_STREET);
    expect(w.layers.lot[a]).toBe(0);
    expect(w.layers.lot[b]).toBe(0);
    expect(w.layers.devLevel[a]).toBe(0);
  });

  it('it goes out through whichever tile has a road', () => {
    const { w, a, b } = pair();
    w.setRoad(12, 10, ROAD_STREET);     // beside the east tile only
    expect(doorTile(w, a)).toBe(b);
    expect(doorTile(w, b)).toBe(b);
  });

  it('it is abandoned as one: both tiles together, one event', () => {
    const { w, a, b } = pair();
    w.setRoad(10, 9, ROAD_STREET);      // a road, but no power or water anywhere
    const seen: unknown[] = [];
    w.events.on('tileAbandoned', (e) => seen.push(e));
    const sys = new AbandonmentSystem();
    for (let k = 0; k < 400 && w.layers.abandoned[a] === 0; k++) { w.tick++; sys.update(w); }
    expect(w.layers.abandoned[a]).not.toBe(0);
    expect(w.layers.abandoned[b]).not.toBe(0);
    expect(seen.length).toBe(1);
  });

  it('it survives a save and a load; a broken one is tidied back to ordinary lots', () => {
    const { w, a, b } = pair('tall');
    const back = deserialize(serialize(w));
    expect([back.layers.lot[a], back.layers.lot[b]]).toEqual([7, 8]);
    expect(back.layers.devLevel[b]).toBe(LOT_LEVEL);

    w.layers.lot[b] = 0;                // half a pair
    cleanLots(w);
    expect(w.layers.lot[a]).toBe(0);
    expect([w.layers.devLevel[a], w.layers.devLevel[b]]).toEqual([TOP, TOP]);

    const h = city();
    const x = lot(h, 5, 5, ZONE_R), y = lot(h, 6, 5, ZONE_R);
    h.layers.lot[x] = 5; h.layers.lot[y] = 6; h.layers.devLevel[x] = h.layers.devLevel[y] = LOT_LEVEL;
    cleanLots(h);                       // homes cannot be a pair
    expect([h.layers.lot[x], h.layers.lot[y]]).toEqual([0, 0]);
  });

  it('the counts for the lab tell pairs from 2×2s', () => {
    const w = city();
    lot(w, 4, 4); lot(w, 5, 4); mergeLot(w, 4, 4, false, 'wide');
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) lot(w, 20 + dx, 20 + dy, ZONE_R);
    mergeLot(w, 20, 20);
    expect(lotCounts(w)).toEqual({ total: 2, byZone: [0, 1, 1, 0].map((_, z) => (z === ZONE_R || z === ZONE_C ? 1 : 0)), pairs: 1 });
  });
});

describe('when a pair merges', () => {
  /** A row of `n` top-level shops along y, from x. */
  const row = (w: World, x: number, y: number, n: number): number[] => Array.from({ length: n }, (_, k) => lot(w, x + k, y));

  it('two shops side by side, thriving for the streak, merge on the same daily chance as a 2×2', () => {
    cfg.streakDays = 3; cfg.chancePerDay = 1;
    const w = city();
    row(w, 10, 10, 2);
    days(w, 2);
    expect(q(w, 10, 10)).toBe(0);                    // not yet: two days of three
    expect(mergeCandidates(w)).toEqual([]);
    days(w, 1);
    expect([q(w, 10, 10), q(w, 11, 10)]).toEqual([5, 6]);
  });

  it('either way round: one above the other merges too', () => {
    cfg.streakDays = 1; cfg.chancePerDay = 1;
    const w = city();
    lot(w, 10, 10); lot(w, 10, 11);
    days(w, 1);
    expect([q(w, 10, 10), q(w, 10, 11)]).toEqual([7, 8]);
  });

  it('with the chance at 0 nothing merges; homes and industry never pair', () => {
    cfg.streakDays = 1; cfg.chancePerDay = 0; cfg.industryChancePerDay = 1;
    const w = city();
    row(w, 10, 10, 2);
    lot(w, 20, 20, ZONE_I); lot(w, 21, 20, ZONE_I);
    days(w, 5);
    expect(q(w, 10, 10)).toBe(0);
    expect(q(w, 20, 20)).toBe(0);
    cfg.chancePerDay = 1;
    const h = city();
    lot(h, 10, 10, ZONE_R); lot(h, 11, 10, ZONE_R);
    lot(h, 20, 20); lot(h, 21, 20);                  // shops, so the homes have jobs nearby
    days(h, 5);
    expect(q(h, 10, 10)).toBe(0);
  });

  it('where a 2×2 of shops is possible the pair waits for it, even before the square is ready', () => {
    cfg.streakDays = 3; cfg.chancePerDay = 1;
    const w = city();
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) lot(w, 10 + dx, 10 + dy);
    expect(canMergePair(w, 10, 10, 'wide')).toBe(false);
    expect(canMergePair(w, 10, 10, 'tall')).toBe(false);
    days(w, 2);
    w.lotStreak[w.grid.idx(11, 11)] = 0;             // one corner falls behind: three lots ready, one not
    days(w, 1);
    expect(mergeCandidates(w)).toEqual([]);
    expect(q(w, 10, 10)).toBe(0);
    days(w, 3);
    expect([q(w, 10, 10), q(w, 11, 10), q(w, 10, 11), q(w, 11, 11)]).toEqual([1, 2, 3, 4]);
  });

  it('a shop row one lot deep pairs; with a lower lot behind it, it still pairs', () => {
    const w = city();
    row(w, 10, 10, 2);
    lot(w, 10, 11, ZONE_C, 2); lot(w, 11, 11, ZONE_C, 2);   // behind: not top level, so no 2×2 here
    expect(canMergePair(w, 10, 10, 'wide')).toBe(true);
    expect(mergeReport(w).pairs).toBe(1);
  });

  it('pairs keep the same distance from every merged lot, and 2×2s from pairs', () => {
    const w = city();
    row(w, 10, 10, 2);
    mergeLot(w, 10, 10, false, 'wide');
    const gap = BALANCE.lots.spacing;
    expect(clearOfLots(w, 12 + gap, 10, 'wide')).toBe(true);      // one tile beyond the gap
    expect(clearOfLots(w, 11 + gap, 10, 'wide')).toBe(false);
    expect(clearOfLots(w, 10, 11 + gap, 'tall')).toBe(true);
    expect(clearOfLots(w, 10, 10 + gap, 'tall')).toBe(false);
    expect(clearOfLots(w, 11 + gap, 10)).toBe(false);             // a 2×2 too
    expect(clearOfLots(w, 12 + gap, 10)).toBe(true);
  });

  it('a long row of ready shops ends with pairs standing apart, at most one a day', () => {
    cfg.streakDays = 1; cfg.chancePerDay = 1;
    const w = city(48);
    row(w, 4, 10, 30);
    days(w, 1);
    expect(lotCounts(w).total).toBe(1);
    days(w, 40);
    const anchors: number[] = [];
    for (let x = 4; x < 34; x++) if (q(w, x, 10) === 5) anchors.push(x);
    expect(anchors.length).toBeGreaterThan(1);
    for (let k = 1; k < anchors.length; k++) expect(anchors[k] - anchors[k - 1]).toBeGreaterThanOrEqual(2 + BALANCE.lots.spacing);
    expect(lotCounts(w).pairs).toBe(anchors.length);
  });

  it('the same seed gives the same pairs', () => {
    cfg.streakDays = 1; cfg.chancePerDay = 0.3;
    const run = (): string => {
      const w = city(48);
      row(w, 4, 10, 30); row(w, 4, 20, 30);
      days(w, 60);
      return Array.from(w.layers.lot).join('');
    };
    expect(run()).toBe(run());
    expect(run()).toMatch(/56/);
  });
});
