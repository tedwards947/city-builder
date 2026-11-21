// A PLACEHOLDER map for the tutorial (TUTORIAL_DESIGN.md), until the owner
// hand-builds the real one: 48×48 with a highway stub coming in from the west
// edge onto open land, a pond and a stream, woods round the edges and in
// clumps, and a Focus marker labelled
// "power" where the first street would end. `npm run gen-tutorial` writes it
// to public/tutorial/tutorial.citysave.json.
//
// To replace it with a hand-made map: open the game with ?debug=true, Menu →
// New city → "Tutorial 48×48" (blank land), build the map, Menu → Save →
// save to file, and put the file at that path. The map needs a highway stub
// (a highway that ends on land); a Focus marker labelled "power" is optional
// and shows the suggested spot for the plant.

import { resetConnections } from '../sim/connections';
import { World } from '../sim/World';
import { ROAD_HIGHWAY, TERRAIN_GRASS, TERRAIN_WATER, VEG_NONE } from '../sim/constants';
import { mulberry32 } from '../sim/rng';
import { TUTORIAL } from '../tutorial/rules';

export const TUTORIAL_MAP_SIZE = 48;
/** The open land for the first steps: columns x0..x1, `half` rows either side of the highway's row. No tree is planted there. */
export const CLEAR = { x0: 0, x1: 34, half: 9 };
/** The stream's column at row `y`: it wanders a tile or two as it runs south from the pond. */
const STREAM_X = (y: number): number => 40 + Math.round(1.6 * Math.sin(y / 3.1));

/** A map of bare land: no water, no trees. */
export function blankWorld(width: number, height: number, seed = 1): World {
  const w = new World(width, height, seed);
  w.layers.terrain.fill(TERRAIN_GRASS);
  w.layers.vegetation.fill(VEG_NONE);
  w.grid.markAllDirty();
  return w;
}

export function buildTutorialMap(): World {
  const N = TUTORIAL_MAP_SIZE;
  const w = blankWorld(N, N, 1);
  const { terrain, vegetation } = w.layers;
  const row = N / 2;
  // A pond in the north-east, and a little stream winding from it to the south edge.
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if ((x - 39) ** 2 + ((y - 8) * 1.3) ** 2 <= 36) terrain[y * N + x] = TERRAIN_WATER;
  }
  for (let y = 12; y < N; y++) terrain[y * N + STREAM_X(y)] = TERRAIN_WATER;

  // Trees: woods along the edges, thick by the water, a dozen clumps, and a
  // scatter everywhere else. The land for the first steps is kept open: a
  // broad band along the highway stub and ahead of it (CLEAR).
  const rng = mulberry32(20261119);
  const clumps = Array.from({ length: 12 }, () => ({ x: rng() * N, y: rng() * N, r: 2.5 + rng() * 2.5, species: 1 + Math.floor(rng() * 6) }));
  const nearWater = (x: number, y: number, by: number): boolean => {
    for (let dy = -by; dy <= by; dy++) for (let dx = -by; dx <= by; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < N && ny < N && terrain[ny * N + nx] === TERRAIN_WATER) return true;
    }
    return false;
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    const roll = rng(), pick = 1 + Math.floor(rng() * 6);   // drawn for every tile, so one change does not reshuffle the rest
    if (terrain[i] === TERRAIN_WATER) continue;
    if (x >= CLEAR.x0 && x <= CLEAR.x1 && y >= row - CLEAR.half && y <= row + CLEAR.half) continue;
    const edge = Math.min(x, y, N - 1 - x, N - 1 - y);
    const clump = clumps.find((c) => Math.hypot(x - c.x, y - c.y) <= c.r);
    const chance = edge <= 1 ? 0.9 : edge <= 4 ? 0.6 : nearWater(x, y, 2) ? 0.55 : clump ? 0.75 : 0.05;
    if (roll < chance) vegetation[i] = clump && roll < 0.5 ? clump.species : pick;   // a clump is mostly one kind of tree
  }
  // The highway stub: in from the west edge, ending on open land.
  for (let x = 0; x <= 7; x++) w.setRoad(x, row, ROAD_HIGHWAY);
  resetConnections(w);   // the stub is the map's one outside connection
  // Where the first ten tiles of street end: a spot for the power plant.
  w.markers.push({ x: 18, y: row, kind: 'focus', label: 'power' });
  w.budget.money = TUTORIAL.startMoney;
  return w;
}
