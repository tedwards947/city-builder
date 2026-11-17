import { describe, it, expect, afterEach } from 'vitest';
import { setBuildingShape, clearBuildingShape, block } from '../sim/buildingShapes';
import { shapeBox, shapeTiles } from '../render/clay/bigBuildings';

const KIND = 200;   // a test-only kind
afterEach(() => clearBuildingShape(KIND));

describe('shapeBox', () => {
  it('is the tile itself for a one-tile building', () => {
    expect(shapeBox(KIND)).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0, drawDx: 0, drawDy: 0 });
  });
  it('draws a square at the left end of its bottom row', () => {
    setBuildingShape(KIND, block(3, 3));
    expect(shapeBox(KIND)).toEqual({ minX: 0, minY: 0, maxX: 2, maxY: 2, drawDx: 0, drawDy: 2 });
  });
  it('finds the lowest row of an L whose bottom-left corner is empty', () => {
    // Anchor top-right; the foot sticks out to the right on the lower row:
    //   A
    //   # #      (the lower row has tiles at dx 0 and 1)
    setBuildingShape(KIND, [[0, 0], [0, 1], [1, 1]]);
    expect(shapeBox(KIND)).toMatchObject({ maxX: 1, maxY: 1, drawDx: 0, drawDy: 1 });
    // The same L mirrored, so the lowest row starts left of the anchor.
    setBuildingShape(KIND, [[0, 0], [0, 1], [-1, 1]]);
    expect(shapeBox(KIND)).toMatchObject({ minX: -1, maxX: 0, drawDx: -1, drawDy: 1 });
  });
  it('notices when a kind is given a new shape', () => {
    setBuildingShape(KIND, block(2, 2));
    expect(shapeBox(KIND).maxX).toBe(1);
    setBuildingShape(KIND, block(3, 3));
    expect(shapeBox(KIND).maxX).toBe(2);
  });
});

describe('shapeTiles', () => {
  it('places the shape at the anchor', () => {
    setBuildingShape(KIND, block(2, 2));
    expect(shapeTiles(KIND, 10, 20)).toEqual([{ x: 10, y: 20 }, { x: 11, y: 20 }, { x: 10, y: 21 }, { x: 11, y: 21 }]);
  });
});

import { placementAnchor } from '../input/InputController';
import { footprintBand } from '../render/clay/bigBuildings';

describe('placementAnchor', () => {
  it('is the pointer tile for a one-tile building', () => {
    expect(placementAnchor(KIND, 7, 9)).toEqual({ tx: 7, ty: 9 });
  });
  it('holds a 3×3 by its centre tile', () => {
    setBuildingShape(KIND, block(3, 3));
    expect(placementAnchor(KIND, 7, 9)).toEqual({ tx: 6, ty: 8 });
  });
  it('holds a 2×2 by the top-left of its four tiles', () => {
    setBuildingShape(KIND, block(2, 2));
    expect(placementAnchor(KIND, 7, 9)).toEqual({ tx: 7, ty: 9 });
  });
  it('allows for a shape that reaches left of its anchor', () => {
    setBuildingShape(KIND, [[0, 0], [-1, 0], [-2, 0]]);   // a row of three, anchor at the right end
    expect(placementAnchor(KIND, 7, 9)).toEqual({ tx: 8, ty: 9 });   // tiles 6, 7, 8: the pointer is the middle one
  });
});

describe('footprintBand', () => {
  const length = (es: { x0: number; y0: number; x1: number; y1: number }[]) => es.reduce((s, e) => s + Math.abs(e.x1 - e.x0) + Math.abs(e.y1 - e.y0), 0);
  it('is the stepped diamond round one tile', () => {
    // Within 2 steps of one tile: 13 tiles, perimeter 20.
    expect(length(footprintBand(KIND, 2))).toBe(20);
  });
  it('is the footprint itself at distance 0', () => {
    setBuildingShape(KIND, block(3, 3));
    expect(length(footprintBand(KIND, 0))).toBe(12);
  });
  it('wraps a square footprint, with straight sides as long as the footprint', () => {
    setBuildingShape(KIND, block(3, 3));
    const band = footprintBand(KIND, 2);
    // A diamond of radius 2 stretched by the 3×3: perimeter 4 × (2r + 1) + 4 × (side − 1) = 20 + 8.
    expect(length(band)).toBe(28);
    expect(band).toContainEqual({ x0: 0, y0: -2, x1: 3, y1: -2 });   // the top side sits 2 above the footprint
  });
});

describe('big building art', () => {
  it('has a sprite per large plant whose plot is the whole footprint at 128px a tile', async () => {
    const { CLAY_SPRITE_DATA } = await import('../render/clay/claySpriteData');
    for (const [id, n] of [['power-large', 3], ['pump-large', 2], ['sewage-large', 2]] as const) {
      const m = CLAY_SPRITE_DATA[id];
      expect(m, id).toBeDefined();
      expect(m.w).toBe(n * 128);
      // Same margins as a one-tile sprite (101px plot in 128), scaled up.
      expect((m.right - m.left + 1) / m.w).toBeGreaterThan(0.76);
      expect((m.right - m.left + 1) / m.w).toBeLessThan(0.82);
    }
  });
});
