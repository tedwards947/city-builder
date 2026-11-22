// Inspect on a capstone: every tile of its footprint is that capstone (name), and every tile shows its
// reach and running-cost rows like a normal service building or plant. (Owner bug: some had no details.)

import { describe, it, expect } from 'vitest';
import { BALANCE } from '../data/balance';
import { BUILDING_STATION_ELEVATED, ROAD_STREET, BUILDING_WATERWORKS, TERRAIN_WATER } from '../sim/constants';
import { capstoneKinds, isServiceCapstone } from '../sim/capstones';
import { footprintTiles, overheadPlatform } from '../sim/buildingShapes';
import { landWorld, homes } from './pcTestWorld';
import { BUILDING_NAME, capstoneRows, platformStationAt } from '../ui/TileInfoPanel';

describe('inspecting a capstone', () => {
  it('every footprint tile is the capstone, named, with reach and running-cost rows', () => {
    const w = landWorld(128);
    for (let x = 2; x <= 120; x++) w.setRoad(x, 10, ROAD_STREET);
    homes(w, 4, 9, 100, 9, 3);
    const placed: [number, number][] = [];
    let x = 2;
    for (const kind of capstoneKinds()) {
      const [sw] = BALANCE.capstones.kinds[kind].size;
      if (kind === BUILDING_WATERWORKS) for (let k = 0; k < sw; k++) w.layers.terrain[w.grid.idx(x + k, 15)] = TERRAIN_WATER;   // a pump stands beside water
      const ok = w.placeBuilding(x, 11, kind);
      placed.push([kind, x]);
      expect(ok, 'place ' + kind).toBe(true);
      x += sw + 1;
    }
    for (const [kind, ax] of placed) {
      const tiles = footprintTiles(w.grid.width, w.grid.height, ax, 11, kind, 0)!;
      expect(tiles.length).toBeGreaterThan(0);
      for (const i of tiles) {
        const tx = i % w.grid.width, ty = (i - tx) / w.grid.width;
        expect(w.layers.building[i]).toBe(kind);
        expect(BUILDING_NAME[kind]).toBeTruthy();
        const html = capstoneRows(w, tx, ty, kind);
        expect(html, `kind ${kind} tile ${tx},${ty}`).toContain('/day');
        if (isServiceCapstone(kind)) expect(html).toContain('whole city');
      }
    }
  });
});

describe('inspecting an elevated station', () => {
  it('each platform tile finds its station, and the tiles round it do not', () => {
    for (const rot of [0, 1, 2, 3]) {
      const w = landWorld(32);
      w.setRoad(5, 20, ROAD_STREET);
      expect(w.placeBuilding(10, 10, BUILDING_STATION_ELEVATED, rot)).toBe(true);
      const b = w.buildingAt(10, 10)!;
      const plat = overheadPlatform(BUILDING_STATION_ELEVATED, rot);
      expect(plat.length).toBe(3);
      for (const [dx, dy] of plat) expect(platformStationAt(w, 10 + dx, 10 + dy)).toBe(b);
      expect(platformStationAt(w, 20, 20)).toBeNull();
    }
  });
});
