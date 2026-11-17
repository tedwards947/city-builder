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
