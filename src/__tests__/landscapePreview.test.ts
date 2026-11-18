import { describe, it, expect, beforeEach } from 'vitest';
import type { World } from '../sim/World';
import { TERRAIN_SAND, TERRAIN_WATER, BUILDING_SEAPORT, BUILDING_LARGE_WATER_PLANT, ROAD_STREET } from '../sim/constants';
import { EditWaterCommand } from '../commands/EditWaterCommand';
import { landWorld } from './pcTestWorld';
import { landscapePreview } from '../ui/landscapePreview';
import { brushTiles, mixedSpecies, speciesGroups, setTreeChoice, stepLandscapeBrush, setLandscapeBrush, landscapeBrush } from '../input/landscape';

let w: World;
const idx = (x: number, y: number) => w.grid.idx(x, y);
const at = { tx: 0, ty: 0 };
const texts = (p: ReturnType<typeof landscapePreview>) => p!.lines.map(l => l.text).join('\n');
const tones = (p: ReturnType<typeof landscapePreview>) => p!.lines.map(l => l.tone);

beforeEach(() => {
  w = landWorld(); w.budget.money = 1000; w.budget.politicalCapital = 100;
  // A sea over y 0–9 with its beach along y = 10.
  for (let y = 0; y <= 9; y++) for (let x = 0; x < 32; x++) w.layers.terrain[idx(x, y)] = TERRAIN_WATER;
  for (let x = 0; x < 32; x++) w.layers.terrain[idx(x, 10)] = TERRAIN_SAND;
  setTreeChoice(0);
});

describe('the brush', () => {
  it('is 1, 9 or 21 tiles: round, 3 across is the full square and 5 across loses its corners', () => {
    expect([0, 1, 2].map(r => brushTiles(w, 15, 15, r).length)).toEqual([1, 9, 21]);
    expect(brushTiles(w, 0, 15, 1)).toHaveLength(6);   // clipped at the map's edge
  });

  it('[ and ] step the size and stop at the ends', () => {
    setLandscapeBrush(1);
    stepLandscapeBrush(1); stepLandscapeBrush(1);
    expect(landscapeBrush()).toBe(2);
    stepLandscapeBrush(-1); stepLandscapeBrush(-1); stepLandscapeBrush(-1);
    expect(landscapeBrush()).toBe(0);
  });

  it('Mixed gives each tile a fixed species, all six used; one species groups everything', () => {
    const tiles = Array.from({ length: 200 }, (_, k) => 2000 + k);
    expect(tiles.map(mixedSpecies)).toEqual(tiles.map(mixedSpecies));
    expect(new Set(tiles.map(mixedSpecies)).size).toBe(6);
    expect([...speciesGroups(tiles, 3).keys()]).toEqual([3]);
  });
});

describe('the tag', () => {
  it('trees: the species, how many and the price; nothing to do on water', () => {
    const p = landscapePreview(w, 'trees', brushTiles(w, 15, 20, 1), at)!;
    expect(p.change).toHaveLength(9);
    expect(p.species).toHaveLength(9);
    expect(texts(p)).toContain('Mixed');
    expect(texts(p)).toContain('9 trees');
    expect(texts(landscapePreview(w, 'trees', [idx(5, 5)], at))).toContain('Nothing to change');
  });

  it('trees: a city in the red plants nothing, and the tag says so', () => {
    w.budget.money = -1;
    expect(tones(landscapePreview(w, 'trees', [idx(15, 20)], at))).toContain('bad');
  });

  it('water over a road: red, "bulldoze the road first"', () => {
    w.setRoad(15, 20, ROAD_STREET);
    const p = landscapePreview(w, 'addWater', [idx(14, 20), idx(15, 20)], at)!;
    expect(p.blocked).toEqual([idx(15, 20)]);
    expect(texts(p)).toContain('bulldoze the road first');
  });

  it('a water pump left dry: an amber warning and a ring round it', () => {
    for (let x = 5; x <= 12; x++) w.setRoad(x, 12, ROAD_STREET);
    expect(w.placeBuilding(8, 10, BUILDING_LARGE_WATER_PLANT)).toBe(true);   // x 8–9, y 10–11: the sea right above it
    const p = landscapePreview(w, 'removeWater', [idx(8, 9), idx(9, 9)], at)!;
    expect(texts(p)).toContain('water pump dry');
    expect(p.rings).toEqual([{ anchor: idx(8, 10), tone: 'warn' }]);
  });

  it('a port cut off from the sea, then reconnected by a canal', () => {
    expect(w.placeBuilding(10, 10, BUILDING_SEAPORT)).toBe(true);
    // Fill in everything but a pond in front of the docks and a canal from it to the top edge.
    const fill: number[] = [];
    for (let y = 0; y <= 9; y++) for (let x = 0; x < 32; x++) if (!(y >= 8 && x >= 9 && x <= 15) && !(x === 12 && y <= 7)) fill.push(idx(x, y));   // a one-tile canal up to the edge stays
    expect(new EditWaterCommand(fill, false).execute(w)).toBe(true);
    // Filling one tile of the canal cuts the port off.
    const cut = landscapePreview(w, 'removeWater', [idx(12, 7)], at);
    const canalUp = Array.from({ length: 7 }, (_, y) => idx(12, y));
    expect(texts(cut)).toContain('Cuts the seaport off');
    expect(texts(cut)).toContain('upkeep continues');
    expect(cut!.rings[0]).toEqual({ anchor: idx(10, 10), tone: 'warn' });
    // Close it, then dig back to the top edge: the tag says trade starts again.
    expect(new EditWaterCommand([idx(12, 7), ...canalUp.filter(i => w.layers.terrain[i] === TERRAIN_WATER)], false).execute(w)).toBe(true);
    const dig = landscapePreview(w, 'addWater', [...canalUp, idx(12, 7)], at)!;
    expect(texts(dig)).toContain('Reconnects the seaport');
    expect(dig.rings).toEqual([{ anchor: idx(10, 10), tone: 'good' }]);
  });
});
