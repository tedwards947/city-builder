import { describe, it, expect } from 'vitest';
import { generateCity } from '../gen/cityGen';
import { saveCityText, loadCityText, cityStats } from '../bench/harness';
import { ROAD_NONE, ROAD_HIGHWAY, ZONE_NONE } from '../sim/constants';

// A small city keeps this quick; the big ones are built by `npm run gen-city`.
const small = () => generateCity({ seed: 3, target: 2500, size: 128, settleTicks: 40 });

describe('large-city generator', () => {
  const a = small();

  it('grows to about the target population', () => {
    expect(a.population).toBeGreaterThanOrEqual(2500 * 0.9);
    expect(a.population).toBeLessThan(2500 * 2);
    const s = cityStats(a.world);
    expect(s.zones.R.tiles).toBeGreaterThan(0);
    expect(s.zones.C.tiles).toBeGreaterThan(0);
    expect(s.zones.I.tiles).toBeGreaterThan(0);
    for (const k of ['power', 'water', 'sewage', 'police', 'fire', 'school', 'hospital']) expect(s.buildings[k]).toBeGreaterThan(0);
  });

  it('gives every lot a road and puts every road on one network', () => {
    const { width, height } = a.world.grid;
    const L = a.world.layers;
    const access = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height
      && L.roadClass[y * width + x] !== ROAD_NONE && L.roadClass[y * width + x] !== ROAD_HIGHWAY;
    const nets = new Set<number>();
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (L.zone[i] !== ZONE_NONE) expect(access(x - 1, y) || access(x + 1, y) || access(x, y - 1) || access(x, y + 1)).toBe(true);
      if (L.roadClass[i] !== ROAD_NONE) nets.add(L.roadNet[i]);
    }
    expect(nets.size).toBe(1);
  });

  it('builds the same city from the same seed', () => {
    const b = small();
    expect(saveCityText(b.world, 'x', 0)).toBe(saveCityText(a.world, 'x', 0));
  });

  it('saves a file the game loads back', () => {
    const text = saveCityText(a.world, 'Generated', 0);
    const back = loadCityText(text);
    expect(back.grid.width).toBe(128);
    expect(back.buildings.length).toBe(a.world.buildings.length);
    expect(Array.from(back.layers.devLevel)).toEqual(Array.from(a.world.layers.devLevel));
  });
});
