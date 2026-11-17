import { describe, it, expect } from 'vitest';
import { generateCity, STYLES } from '../gen/cityGen';
import { saveCityText, loadCityText, cityStats } from '../bench/harness';
import { ROAD_NONE, ROAD_HIGHWAY, ZONE_NONE, ZONE_R, ZONE_C, ZONE_I } from '../sim/constants';

// A small city keeps this quick; the big ones are built by `npm run gen-city`.
const small = () => generateCity({ seed: 3, target: 2500, size: 128, settleTicks: 40 });

describe('large-city generator', () => {
  const a = small();

  it('grows to about the target population', () => {
    expect(a.population).toBeGreaterThanOrEqual(2500 * 0.9);
    expect(a.population).toBeLessThan(2500 * 1.35);
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

  it('keeps homes and shops clear of industry', () => {
    // Homes and shops stay 6 tiles from any industry district, so at least 7 from an industrial lot.
    const { width, height } = a.world.grid;
    const L = a.world.layers;
    const dist = new Int32Array(width * height).fill(-1);
    const queue: number[] = [];
    for (let i = 0; i < L.zone.length; i++) if (L.zone[i] === ZONE_I) { dist[i] = 0; queue.push(i); }
    expect(queue.length).toBeGreaterThan(0);
    for (let h = 0; h < queue.length; h++) {
      const i = queue[h], x = i % width, y = (i - x) / width;
      for (const j of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, y > 0 ? i - width : -1, y < height - 1 ? i + width : -1]) {
        if (j >= 0 && dist[j] < 0) { dist[j] = dist[i] + 1; queue.push(j); }
      }
    }
    let nearest = Infinity;
    for (let i = 0; i < L.zone.length; i++) if (L.zone[i] === ZONE_R || L.zone[i] === ZONE_C) nearest = Math.min(nearest, dist[i]);
    expect(nearest).toBeGreaterThanOrEqual(7);
  });

  it('reports trip lengths and roads over capacity', () => {
    const t = cityStats(a.world).traffic!;
    expect(t).not.toBeNull();
    expect(t.tripLength.jobs).toBeGreaterThan(0);
    expect(t.tripLength.shopping).toBeGreaterThan(0);
    for (const v of Object.values(t.overCapacity)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });

  it('still builds the legacy layout (one industrial wedge, no buffer)', () => {
    const c = generateCity({ seed: 3, target: 2500, size: 128, settleTicks: 40, legacyLayout: true });
    expect(c.population).toBeGreaterThanOrEqual(2500 * 0.9);
    expect(saveCityText(c.world, 'x', 0)).not.toBe(saveCityText(a.world, 'x', 0));
  });

  for (const style of STYLES) {
    it(`builds a working ${style} city`, () => {
      const c = generateCity({ seed: 5, target: 2000, size: 128, style, settleTicks: 20 });
      expect(c.population).toBeGreaterThanOrEqual(2000 * 0.9);
      const L = c.world.layers;
      const nets = new Set<number>();
      for (let i = 0; i < L.roadClass.length; i++) if (L.roadClass[i] !== ROAD_NONE) nets.add(L.roadNet[i]);
      expect(nets.size).toBe(1);
    });
  }
});
