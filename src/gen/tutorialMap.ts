// A PLACEHOLDER map for the tutorial (TUTORIAL_DESIGN.md), until the owner
// hand-builds the real one: 48×48 of open land with a highway stub coming in
// from the west edge, a pond, a few trees, and a Focus marker labelled
// "power" where the first street would end. `npm run gen-tutorial` writes it
// to public/tutorial/tutorial.citysave.json.
//
// To replace it with a hand-made map: open the game with ?debug=true, Menu →
// New city → "Tutorial 48×48" (blank land), build the map, Menu → Save →
// save to file, and put the file at that path. The map needs a highway stub
// (a highway that ends on land); a Focus marker labelled "power" is optional
// and shows the suggested spot for the plant.

import { World } from '../sim/World';
import { ROAD_HIGHWAY, TERRAIN_GRASS, TERRAIN_WATER, VEG_NONE } from '../sim/constants';
import { TUTORIAL } from '../tutorial/rules';

export const TUTORIAL_MAP_SIZE = 48;

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
  // A pond in the north-east.
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if ((x - 39) ** 2 + ((y - 8) * 1.3) ** 2 <= 36) terrain[y * N + x] = TERRAIN_WATER;
  }
  // A few trees along the south edge and by the pond.
  for (let x = 2; x < N - 2; x += 3) vegetation[(N - 3 - (x % 2)) * N + x] = 1 + (x % 6);
  for (const [x, y] of [[31, 5], [32, 9], [33, 13], [36, 15], [41, 15], [45, 12]] as const) vegetation[y * N + x] = 1 + ((x + y) % 6);
  // The highway stub: in from the west edge, ending on open land.
  const row = N / 2;
  for (let x = 0; x <= 7; x++) w.setRoad(x, row, ROAD_HIGHWAY);
  // Where the first ten tiles of street end: a spot for the power plant.
  w.markers.push({ x: 18, y: row, kind: 'focus', label: 'power' });
  w.budget.money = TUTORIAL.startMoney;
  return w;
}
