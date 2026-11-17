import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../sim/World';
import { TERRAIN_GRASS, TERRAIN_WATER, BUILDING_SEAPORT, BUILDING_LARGE_POWER_PLANT } from '../sim/constants';
import { placementAnchor, placementFor, cyclePlacementTurn, resetPlacementTurn } from '../input/placement';
import { shapeBox, shapeTiles } from '../render/clay/bigBuildings';
import { shapeRoles } from '../sim/buildingShapes';

/** A 40×40 map of grass with open water over the columns x >= 30 (it touches the east edge). */
function coast(): World {
  const w = new World(40, 40, 1);
  w.layers.terrain.fill(TERRAIN_GRASS);
  w.layers.vegetation.fill(0);
  for (let y = 0; y < 40; y++) for (let x = 30; x < 40; x++) w.layers.terrain[w.grid.idx(x, y)] = TERRAIN_WATER;
  return w;
}

beforeEach(() => resetPlacementTurn());

describe('placementAnchor', () => {
  it('puts the middle of a 3×3 on the pointer', () => {
    expect(placementAnchor(BUILDING_LARGE_POWER_PLANT, 10, 10)).toEqual({ tx: 9, ty: 9 });
  });
  it('follows the footprint as a seaport turns', () => {
    for (let rot = 0; rot < 4; rot++) {
      const a = placementAnchor(BUILDING_SEAPORT, 20, 20, rot), box = shapeBox(BUILDING_SEAPORT, rot);
      // The pointer tile is inside the footprint's bounding box, at its middle.
      expect(20 - (a.tx + box.minX)).toBe((box.maxX - box.minX) >> 1);
      expect(20 - (a.ty + box.minY)).toBe((box.maxY - box.minY) >> 1);
    }
  });
});

describe('placementFor', () => {
  it('does not turn a kind without docks', () => {
    const w = coast();
    expect(placementFor(w, BUILDING_LARGE_POWER_PLANT, 10, 10)).toMatchObject({ rot: 0, tx: 9, ty: 9 });
  });
  it('turns a seaport so its docks stand on the open water beside it', () => {
    const w = coast();
    // Held just inland of the east coast: only docks pointing east can reach the water.
    const p = placementFor(w, BUILDING_SEAPORT, 28, 20);
    expect(p.check.ok).toBe(true);
    const tiles = shapeTiles(BUILDING_SEAPORT, p.tx, p.ty, p.rot), roles = shapeRoles(BUILDING_SEAPORT);
    tiles.forEach((t, k) => expect(w.layers.terrain[w.grid.idx(t.x, t.y)] === TERRAIN_WATER, `${t.x},${t.y}`).toBe(roles[k] === 'dock'));
  });
  it('still answers far from water, with the reason', () => {
    const w = coast();
    const p = placementFor(w, BUILDING_SEAPORT, 10, 10);
    expect(p.check.ok).toBe(false);
    expect(p.check.blocked.length).toBeGreaterThan(0);
  });
  it('keeps the way that fits whatever the turn key says, when only one fits', () => {
    const w = coast();
    const first = placementFor(w, BUILDING_SEAPORT, 28, 20).rot;
    cyclePlacementTurn();
    expect(placementFor(w, BUILDING_SEAPORT, 28, 20).rot).toBe(first);
  });
});
