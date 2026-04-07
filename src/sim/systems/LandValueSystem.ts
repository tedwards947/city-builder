// Land value and demand curves.
// Land value (0–255) is a per-tile desirability score that modulates tax
// income and provides player feedback about city health.
//
// Demand multipliers (0.25–2.0) adjust zone growth probability based on the
// balance of R / C / I development — too much of one type slows it down.
//
// Runs every growth.tickInterval ticks (same cadence as ZoneGrowthSystem).

import { World } from '../World';
import { ZONE_NONE, ZONE_R, ZONE_C, ZONE_I } from '../constants';
import { BALANCE } from '../../data/balance';

const LV = BALANCE.landValue;
const DM = BALANCE.demand;

export class LandValueSystem {
  update(world: World): void {
    if (world.tick % BALANCE.growth.tickInterval !== 0) return;

    const { width, height } = world.grid;
    const n = width * height;
    const lv    = world.layers.landValue;
    const zone  = world.layers.zone;
    const dev   = world.layers.devLevel;
    const power = world.layers.power;
    const water = world.layers.water;
    const svc   = world.layers.services;
    const poll  = world.layers.pollution;

    // ── Per-tile land value ────────────────────────────────────────────────────
    let lvSum = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;

        let target = LV.base;
        target += svc[i]   ? LV.serviceBonus : 0;
        target += power[i] ? LV.powerBonus   : 0;
        target += water[i] ? LV.waterBonus   : 0;
        target -= poll[i] * LV.pollutionPenalty;

        // Scan neighbourhood for nearby industry (penalty) or developed zones (bonus).
        const r = LV.industryRadius;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const ni = ny * width + nx;
            if (dev[ni] === 0) continue;
            if (zone[ni] === ZONE_I) {
              target -= LV.industryPenalty / (Math.abs(dx) + Math.abs(dy));
            } else if (zone[ni] !== ZONE_NONE && Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
              target += LV.neighborBonus;
            }
          }
        }

        target = Math.max(0, Math.min(255, target));
        // Smooth toward target.
        lv[i] = Math.round(lv[i] * (1 - LV.smoothing) + target * LV.smoothing);
        lvSum += lv[i];
      }
    }
    world.stats.avgLandValue = Math.round(lvSum / n);

    // ── Demand curves ──────────────────────────────────────────────────────────
    // Tally dev levels per zone type across the city.
    let rDev = 0, cDev = 0, iDev = 0;
    for (let i = 0; i < n; i++) {
      if (dev[i] === 0) continue;
      if (zone[i] === ZONE_R) rDev += dev[i];
      else if (zone[i] === ZONE_C) cDev += dev[i];
      else if (zone[i] === ZONE_I) iDev += dev[i];
    }

    // rDemand: R grows fast when there are proportionally more jobs (C+I) than residents.
    const rRatio = (cDev + iDev + 1) / ((rDev + 1) * DM.jobsPerResident);
    // cDemand: C grows fast when there's more R pop than commerce can serve.
    const cRatio = (rDev + 1) / (cDev * DM.residentsPerCommerce + 1);
    // iDemand: I grows fast when combined labor+market exceeds industrial capacity.
    const iRatio = (rDev + cDev + 1) / (iDev * DM.workersPerIndustry + 1);

    const clamp = (v: number) => Math.max(DM.min, Math.min(DM.max, Math.sqrt(v)));
    world.stats.rDemand = clamp(rRatio);
    world.stats.cDemand = clamp(cRatio);
    world.stats.iDemand = clamp(iRatio);
  }
}
