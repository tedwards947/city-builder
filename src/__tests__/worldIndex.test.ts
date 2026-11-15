// WorldIndex and FieldBounds: the bookkeeping that lets systems skip empty
// land, and checks that skipping it does not change the result.

import { describe, it, expect } from 'vitest';
import { World } from '../sim/World';
import { FieldBounds, unionRect, growRect } from '../sim/FieldBounds';
import { Scheduler } from '../sim/Scheduler';
import { PollutionSystem } from '../sim/systems/PollutionSystem';
import { LandValueSystem } from '../sim/systems/LandValueSystem';
import { VibeSystem } from '../sim/systems/VibeSystem';
import { CrimeSystem } from '../sim/systems/CrimeSystem';
import { BALANCE } from '../data/balance';
import { ZONE_R, ZONE_I, ROAD_STREET, BUILDING_POWER_PLANT, VEG_NONE } from '../sim/constants';

function emptyWorld(w = 64, h = 48) {
  const world = new World(w, h, 3);
  world.layers.vegetation.fill(VEG_NONE);
  return world;
}

describe('WorldIndex', () => {
  it('lists roads and zoned tiles in map order and bounds everything built', () => {
    const w = emptyWorld();
    w.layers.roadClass[w.grid.idx(10, 5)] = ROAD_STREET;
    w.layers.roadClass[w.grid.idx(11, 5)] = ROAD_STREET;
    w.layers.zone[w.grid.idx(10, 6)] = ZONE_R;
    w.layers.zone[w.grid.idx(30, 20)] = ZONE_I;
    w.layers.building[w.grid.idx(40, 9)] = BUILDING_POWER_PLANT;
    const ix = w.index;
    expect(Array.from(ix.roads.subarray(0, ix.roadCount))).toEqual([w.grid.idx(10, 5), w.grid.idx(11, 5)]);
    expect(Array.from(ix.zoned.subarray(0, ix.zonedCount))).toEqual([w.grid.idx(10, 6), w.grid.idx(30, 20)]);
    expect([ix.x0, ix.y0, ix.x1, ix.y1]).toEqual([10, 5, 40, 20]);
  });

  it('an empty map has empty lists and an empty area', () => {
    const w = emptyWorld();
    const ix = w.index;
    expect(ix.roadCount).toBe(0);
    expect(ix.zonedCount).toBe(0);
    const a = ix.area(w);
    expect(a.x1).toBeLessThan(a.x0);
  });

  it('works on maps whose size is not a multiple of four', () => {
    const w = emptyWorld(13, 7);
    w.layers.zone[w.grid.idx(12, 6)] = ZONE_R;      // the very last tile
    w.layers.roadClass[w.grid.idx(0, 0)] = ROAD_STREET;
    const ix = w.index;
    expect(ix.zonedCount).toBe(1);
    expect(ix.roadCount).toBe(1);
    expect([ix.x0, ix.y0, ix.x1, ix.y1]).toEqual([0, 0, 12, 6]);
  });

  it('is rebuilt on every access unless pinned', () => {
    const w = emptyWorld();
    expect(w.index.roadCount).toBe(0);
    w.layers.roadClass[w.grid.idx(3, 3)] = ROAD_STREET;
    expect(w.index.roadCount).toBe(1);

    w.pinIndex();
    w.layers.roadClass[w.grid.idx(4, 3)] = ROAD_STREET;
    expect(w.index.roadCount).toBe(1);               // pinned: one scan per tick
    w.unpinIndex();
    expect(w.index.roadCount).toBe(2);
  });

  it('the Scheduler pins the index for the tick and releases it afterwards', () => {
    const w = emptyWorld();
    let seenDuringTick = -1;
    const probe = {
      update(world: World) {
        world.layers.roadClass[world.grid.idx(5, 5)] = ROAD_STREET;  // would show up if not pinned
        seenDuringTick = world.index.roadCount;
      },
    };
    const scheduler = new Scheduler(w, [probe], 500);
    scheduler.setSpeed(1);
    const start = performance.now();
    for (let k = 1; k <= 3 && seenDuringTick < 0; k++) scheduler.update(start + k * 250); // 500 ms = one tick
    expect(seenDuringTick).toBe(0);
    expect(w.index.roadCount).toBe(1);
  });

  it('area() never shrinks, so a demolished district still gets wound down', () => {
    const w = emptyWorld();
    const far = w.grid.idx(50, 40);
    w.layers.zone[w.grid.idx(5, 5)] = ZONE_R;
    w.layers.zone[far] = ZONE_R;
    w.layers.devLevel[far] = 3;
    const crime = new CrimeSystem();
    for (let k = 0; k < 30; k++) crime.update(w);
    expect(w.layers.crime[far]).toBeGreaterThan(0);

    // Bulldoze the far lot: the built bounds shrink, the area does not.
    w.layers.zone[far] = 0;
    w.layers.devLevel[far] = 0;
    expect(w.index.x1).toBe(5);
    expect(w.index.area(w).x1).toBe(50);
    for (let k = 0; k < 200; k++) crime.update(w);
    expect(w.layers.crime[far]).toBe(0);
  });

  it('area() takes in leftover state on a freshly loaded world', () => {
    // As if loaded from a save: crime still fading where nothing stands.
    const w = emptyWorld();
    w.layers.zone[w.grid.idx(5, 5)] = ZONE_R;
    const leftover = w.grid.idx(40, 30);
    w.layers.crime[leftover] = 90;
    expect(w.index.area(w).x1).toBe(40);
    const crime = new CrimeSystem();
    crime.update(w);
    expect(w.layers.crime[leftover]).toBeLessThan(90);
  });
});

describe('FieldBounds', () => {
  it('finds the tiles that differ from the resting value', () => {
    const layer = new Uint8Array(20 * 10).fill(128);
    const b = new FieldBounds();
    b.scan(layer, 20, 128);
    expect(b.empty).toBe(true);
    expect(b.tileCount).toBe(0);

    layer[3 * 20 + 7] = 130;
    layer[8 * 20 + 2] = 0;
    b.scan(layer, 20, 128);
    expect(b.rect()).toEqual({ x0: 2, y0: 3, x1: 7, y1: 8 });
    expect(b.tileCount).toBe(6 * 6);
  });

  it('handles the last tiles of a layer whose length is not a multiple of four', () => {
    const layer = new Uint8Array(7 * 3);
    layer[20] = 5;
    const b = new FieldBounds();
    b.scan(layer, 7, 0);
    expect(b.rect()).toEqual({ x0: 6, y0: 2, x1: 6, y1: 2 });
  });

  it('unionRect and growRect treat empty rectangles as empty', () => {
    const empty = { x0: 0, y0: 0, x1: -1, y1: -1 };
    const r = { x0: 2, y0: 3, x1: 4, y1: 5 };
    expect(unionRect(empty, r)).toEqual(r);
    expect(unionRect(r, empty)).toEqual(r);
    expect(unionRect(r, { x0: 0, y0: 4, x1: 3, y1: 9 })).toEqual({ x0: 0, y0: 3, x1: 4, y1: 9 });
    expect(growRect(r, 6, 6, 2)).toEqual({ x0: 0, y0: 1, x1: 5, y1: 5 });
    const grown = growRect(empty, 6, 6, 2);
    expect(grown.x1).toBeLessThan(grown.x0);
  });
});

describe('systems that skip empty land give the whole-map answer', () => {
  /** One pollution step over every tile, written the plain way. */
  function referencePollutionStep(w: World): void {
    const { width, height } = w.grid;
    const n = width * height;
    const pol = w.layers.pollution;
    const { decayRate, diffusionRate, industryOutput, powerPlantOutput, vegDecayMult } = BALANCE.pollution;
    for (let i = 0; i < n; i++) pol[i] = Math.floor(pol[i] * (w.layers.vegetation[i] !== VEG_NONE ? decayRate * vegDecayMult : decayRate));
    for (let i = 0; i < n; i++) {
      if (w.layers.zone[i] === ZONE_I && w.layers.devLevel[i] > 0) pol[i] = Math.min(255, pol[i] + w.layers.devLevel[i] * industryOutput);
      if (w.layers.building[i] === BUILDING_POWER_PLANT) pol[i] = Math.min(255, pol[i] + powerPlantOutput);
    }
    const diff = new Float32Array(n);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (pol[i] === 0) continue;
      const spread = pol[i] * diffusionRate;
      let k = 0;
      if (x > 0) { diff[i - 1] += spread; k++; }
      if (x < width - 1) { diff[i + 1] += spread; k++; }
      if (y > 0) { diff[i - width] += spread; k++; }
      if (y < height - 1) { diff[i + width] += spread; k++; }
      diff[i] -= spread * k;
    }
    for (let i = 0; i < n; i++) pol[i] = Math.min(255, Math.max(0, pol[i] + Math.round(diff[i])));
  }

  function industrialWorld() {
    const w = emptyWorld(96, 64);
    for (let x = 40; x <= 46; x++) for (let y = 30; y <= 33; y++) {
      const i = w.grid.idx(x, y);
      w.layers.zone[i] = ZONE_I; w.layers.devLevel[i] = 3;
    }
    w.layers.building[w.grid.idx(48, 31)] = BUILDING_POWER_PLANT;
    for (let x = 60; x < 70; x++) w.layers.vegetation[w.grid.idx(x, 31)] = 1;   // some trees downwind
    return w;
  }

  it('pollution matches a plain whole-map step, including far beyond the built area', () => {
    const a = industrialWorld(), b = industrialWorld();
    const sys = new PollutionSystem();
    for (let k = 0; k < 150; k++) {
      sys.update(a);
      referencePollutionStep(b);
    }
    expect(Array.from(a.layers.pollution)).toEqual(Array.from(b.layers.pollution));
    // It really did spread past the factories.
    expect(a.layers.pollution[a.grid.idx(36, 31)]).toBeGreaterThan(0);
  });

  it('pollution keeps fading where the sources have been removed', () => {
    const w = industrialWorld();
    const sys = new PollutionSystem();
    for (let k = 0; k < 60; k++) sys.update(w);
    w.layers.zone.fill(0); w.layers.devLevel.fill(0); w.layers.building.fill(0);
    for (let k = 0; k < 400; k++) sys.update(w);
    expect(w.layers.pollution.every(v => v === 0)).toBe(true);
  });

  it('average land value equals the average over every tile', () => {
    const w = industrialWorld();
    const lv = new LandValueSystem();
    const pollution = new PollutionSystem();
    const interval = BALANCE.growth.tickInterval;
    for (let k = 1; k <= 40; k++) {
      w.tick = k * interval;
      pollution.update(w);
      if (k === 20) {            // the city changes partway through
        const i = w.grid.idx(10, 10);
        w.layers.zone[i] = ZONE_R; w.layers.devLevel[i] = 2;
      }
      lv.update(w);
      const sum = w.layers.landValue.reduce((s, v) => s + v, 0);
      expect(w.stats.avgLandValue).toBe(Math.round(sum / w.layers.landValue.length));
    }
  });

  it('land far from the city sits at its resting value and stays there', () => {
    const w = industrialWorld();
    const lv = new LandValueSystem();
    const interval = BALANCE.growth.tickInterval;
    const far = w.grid.idx(2, 2);
    for (let k = 1; k <= 30; k++) { w.tick = k * interval; lv.update(w); }
    const resting = w.layers.landValue[far];
    for (let k = 31; k <= 60; k++) { w.tick = k * interval; lv.update(w); }
    expect(w.layers.landValue[far]).toBe(resting);
    expect(Math.abs(resting - BALANCE.landValue.base)).toBeLessThanOrEqual(2);
  });

  it('city-wide vibe averages count the whole map, and a vibe written directly is picked up', () => {
    const w = emptyWorld();
    const vibes = new VibeSystem();
    vibes.update(w);
    expect(w.character.green).toBe(0);

    const i = w.grid.idx(20, 20);
    w.layers.vibeGreen[i] = 255;                       // straight into the layer
    w.tick = 1;                                        // not a diffusion tick
    vibes.update(w);
    const n = w.layers.vibeGreen.length;
    const mean = w.layers.vibeGreen.reduce((s, v) => s + v, 0) / n;
    expect(w.character.green).toBeCloseTo((mean - 128) / 128 * BALANCE.character.axisMax, 10);
    expect(w.character.green).toBeGreaterThan(0);

    // …and it diffuses from there.
    for (let t = 2; t < 40; t++) { w.tick = t; vibes.update(w); }
    expect(w.layers.vibeGreen[w.grid.idx(20, 21)]).toBeGreaterThan(128);
  });
});
