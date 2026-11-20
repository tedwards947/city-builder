import { describe, it, expect } from 'vitest';
import { planBigLot, bigLotRise, MAX_FLOORS, LOW_VIEW_FLOORS, FLOOR_TILES, MAX_LOT_RISE, planPair, pairRise } from '../render/clay/bigLots';
import { CLAY_SPRITE_DATA } from '../render/clay/claySpriteData';
import { ZONE_R, ZONE_C, ZONE_I } from '../sim/constants';

const all = (zone: number) => Array.from({ length: 256 }, (_, v) => planBigLot(zone, v));

describe('merged 2×2 lot buildings', () => {
  it('mixes towers with low buildings for homes and shops; industry builds low works', () => {
    for (const zone of [ZONE_R, ZONE_C]) {
      const towers = all(zone).filter((p) => p.form === 'tower').length;
      expect(towers).toBeGreaterThan(100);
      expect(towers).toBeLessThan(200);
    }
    expect(all(ZONE_I).every((p) => p.form === 'works')).toBe(true);
    expect(all(ZONE_C).some((p) => p.form === 'mall')).toBe(true);
    expect(all(ZONE_R).some((p) => p.form === 'courtyard')).toBe(true);
  });

  it('keeps towers between 8 and 26 floors, varied, and everything inside the lot', () => {
    const floors = new Set<number>();
    for (const zone of [ZONE_R, ZONE_C, ZONE_I]) for (const p of all(zone)) {
      expect(p.floors).toBeLessThanOrEqual(MAX_FLOORS);
      if (p.form === 'tower') { expect(p.floors).toBeGreaterThanOrEqual(8); floors.add(p.floors); }
      for (const b of [p, p.podium].filter(Boolean) as { x: number; y: number; w: number; d: number }[]) {
        expect(b.x).toBeGreaterThanOrEqual(0); expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w).toBeLessThanOrEqual(2); expect(b.y + b.d).toBeLessThanOrEqual(2);
      }
    }
    expect(floors.size).toBeGreaterThanOrEqual(5);
    expect(floors.has(MAX_FLOORS)).toBe(true);
  });

  it('is the same building every time for the same lot', () => {
    expect(planBigLot(ZONE_R, 77)).toEqual(planBigLot(ZONE_R, 77));
  });

  it('rises at true height, and only a few floors with Low buildings on', () => {
    const tallest = all(ZONE_R).find((p) => p.floors === MAX_FLOORS)!;
    expect(bigLotRise(tallest, false)).toBeCloseTo(MAX_FLOORS * FLOOR_TILES - tallest.y);
    expect(bigLotRise(tallest, true)).toBeCloseTo(Math.max(0, LOW_VIEW_FLOORS * FLOOR_TILES - tallest.y));
    expect(bigLotRise(tallest, false)).toBeLessThanOrEqual(MAX_LOT_RISE);
  });

  it('gives shop pairs art of their own shape, mid-size, the same every time', () => {
    for (const shape of ['wide', 'tall'] as const) {
      const arts = new Set<string>();
      for (let v = 0; v < 256; v++) {
        const p = planPair(shape, v);
        arts.add(p.art);
        expect(p.art.startsWith('c-' + shape + '-')).toBe(true);
        expect(CLAY_SPRITE_DATA['pairs/' + p.art]).toBeDefined();
        expect(pairRise(p)).toBeLessThanOrEqual(MAX_LOT_RISE);
      }
      expect(arts.size).toBe(4);
      expect(planPair(shape, 9)).toEqual(planPair(shape, 9));
    }
  });
});
