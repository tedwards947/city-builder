// Pollution diffusion system.
// Industry zones and power plants emit pollution each tick.
// Pollution decays over time and diffuses to neighbouring tiles,
// reaching a steady state that reflects the city's industrial footprint.
// The pollution layer feeds back into ZoneGrowthSystem —
// R and C zones above the threshold cannot grow.

import { World } from '../World';
import { ZONE_I, BUILDING_POWER_PLANT } from '../constants';
import { BALANCE } from '../../data/balance';

export class PollutionSystem {
  // Reuse a Float32Array buffer to avoid per-tick GC pressure.
  private diffBuf: Float32Array = new Float32Array(0);

  update(world: World): void {
    const { width, height } = world.grid;
    const n = width * height;
    const pol = world.layers.pollution;
    const zone = world.layers.zone;
    const dev = world.layers.devLevel;
    const building = world.layers.building;

    const { decayRate, diffusionRate, industryOutput, powerPlantOutput } = BALANCE.pollution;

    // 1. Decay — multiply every tile by decayRate.
    for (let i = 0; i < n; i++) {
      pol[i] = Math.floor(pol[i] * decayRate);
    }

    // 2. Add sources.
    for (let i = 0; i < n; i++) {
      if (zone[i] === ZONE_I && dev[i] > 0) {
        pol[i] = Math.min(255, pol[i] + dev[i] * industryOutput);
      }
      if (building[i] === BUILDING_POWER_PLANT) {
        pol[i] = Math.min(255, pol[i] + powerPlantOutput);
      }
    }

    // 3. Conserving diffusion (Laplacian step).
    //    Each tile transfers diffusionRate × its value to each neighbour,
    //    and subtracts the same amount — so total pollution only decreases via decay.
    if (this.diffBuf.length !== n) this.diffBuf = new Float32Array(n);
    else this.diffBuf.fill(0);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (pol[i] === 0) continue;
        const spread = pol[i] * diffusionRate;
        let neighbours = 0;
        if (x > 0)          { this.diffBuf[i - 1]    += spread; neighbours++; }
        if (x < width - 1)  { this.diffBuf[i + 1]    += spread; neighbours++; }
        if (y > 0)          { this.diffBuf[i - width] += spread; neighbours++; }
        if (y < height - 1) { this.diffBuf[i + width] += spread; neighbours++; }
        this.diffBuf[i] -= spread * neighbours; // subtract what was given away
      }
    }

    for (let i = 0; i < n; i++) {
      pol[i] = Math.min(255, Math.max(0, pol[i] + Math.round(this.diffBuf[i])));
    }

    world.grid.markAllDirty();
  }
}
