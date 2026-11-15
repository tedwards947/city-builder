// Pollution diffusion system.
// Industry zones and power plants emit pollution each tick.
// Pollution decays over time and diffuses to neighbouring tiles,
// reaching a steady state that reflects the city's industrial footprint.
// The pollution layer feeds back into ZoneGrowthSystem —
// R and C zones above the threshold cannot grow.
//
// Works on the rectangle where pollution can be non-zero this tick — where it
// already is, plus the built-up area (the sources), plus one tile for the
// diffusion step — rather than the whole map. Everything outside is 0 and
// stays 0, so the result is the same as a whole-map pass.

import { World } from '../World';
import { ZONE_I, BUILDING_POWER_PLANT, VEG_NONE } from '../constants';
import { BALANCE } from '../../data/balance';
import { FieldBounds, unionRect, growRect } from '../FieldBounds';

export class PollutionSystem {
  // Reuse buffers to avoid per-tick GC pressure.
  private diffBuf: Float32Array = new Float32Array(0);
  private prevPol: Uint8Array = new Uint8Array(0);
  // Where pollution is non-zero.
  private readonly live = new FieldBounds();

  update(world: World): void {
    const { width, height } = world.grid;
    const n = width * height;
    const pol = world.layers.pollution;
    const zone = world.layers.zone;
    const dev      = world.layers.devLevel;
    const building = world.layers.building;
    const veg      = world.layers.vegetation;

    const { decayRate, diffusionRate, industryOutput, powerPlantOutput, vegDecayMult } = BALANCE.pollution;

    if (this.prevPol.length !== n) this.prevPol = new Uint8Array(n);
    if (this.diffBuf.length !== n) this.diffBuf = new Float32Array(n);
    this.live.scan(pol, width, 0);

    // `src`: where pollution can be non-zero once sources are added.
    // `work`: that plus the one tile diffusion can carry it.
    const src = unionRect(this.live.rect(), world.index.area(world));
    if (src.x1 < src.x0) return; // nothing built, nothing polluted
    const work = growRect(src, width, height, 1);
    const diffBuf = this.diffBuf;
    const prevPol = this.prevPol;

    // Snapshot current values so we can do targeted dirty marking later.
    for (let y = work.y0; y <= work.y1; y++) {
      const a = y * width + work.x0, b = y * width + work.x1 + 1;
      prevPol.set(pol.subarray(a, b), a);
      diffBuf.fill(0, a, b);
    }

    for (let y = src.y0; y <= src.y1; y++) {
      for (let i = y * width + src.x0, rowEnd = y * width + src.x1; i <= rowEnd; i++) {
        // 1. Decay — multiply by decayRate (faster where there are trees).
        let rate = decayRate;
        if (veg[i] !== VEG_NONE) rate *= vegDecayMult;
        let p = Math.floor(pol[i] * rate);

        // 2. Add sources.
        if (zone[i] === ZONE_I && dev[i] > 0) p = Math.min(255, p + dev[i] * industryOutput);
        if (building[i] === BUILDING_POWER_PLANT) p = Math.min(255, p + powerPlantOutput);
        pol[i] = p;
      }
    }

    // 3. Conserving diffusion (Laplacian step).
    //    Each tile transfers diffusionRate × its value to each neighbour,
    //    and subtracts the same amount — so total pollution only decreases via decay.
    for (let y = src.y0; y <= src.y1; y++) {
      for (let x = src.x0; x <= src.x1; x++) {
        const i = y * width + x;
        if (pol[i] === 0) continue;
        const spread = pol[i] * diffusionRate;
        let neighbours = 0;
        if (x > 0)          { diffBuf[i - 1]    += spread; neighbours++; }
        if (x < width - 1)  { diffBuf[i + 1]    += spread; neighbours++; }
        if (y > 0)          { diffBuf[i - width] += spread; neighbours++; }
        if (y < height - 1) { diffBuf[i + width] += spread; neighbours++; }
        diffBuf[i] -= spread * neighbours; // subtract what was given away
      }
    }

    for (let y = work.y0; y <= work.y1; y++) {
      for (let x = work.x0; x <= work.x1; x++) {
        const i = y * width + x;
        pol[i] = Math.min(255, Math.max(0, pol[i] + Math.round(diffBuf[i])));
        // Only mark chunks that actually changed rather than forcing a full redraw.
        if (pol[i] !== prevPol[i]) world.grid.markDirty(x, y);
      }
    }

  }
}
