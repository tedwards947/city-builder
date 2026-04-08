// Zone growth. Eligible tiles (zoned + powered + road access) develop
// gradually at a low random probability per tick.

import { World } from '../World';
import { ZONE_NONE, ZONE_R, ZONE_C, ZONE_I } from '../constants';
import { BALANCE } from '../../data/balance';

export class ZoneGrowthSystem {
  update(world: World): void {
    if (world.tick % BALANCE.growth.tickInterval !== 0) return;
    const { width, height } = world.grid;
    const zone = world.layers.zone;
    const dev = world.layers.devLevel;
    const power = world.layers.power;
    const water = world.layers.water;
    const sewage = world.layers.sewage;
    const services = world.layers.services;
    const education = world.layers.education;
    const pollution = world.layers.pollution;
    const crime = world.layers.crime;
    const roadClass = world.layers.roadClass;
    const congestion = world.layers.congestion;
    const abandoned = world.layers.abandoned;
    const hasPowerSurplus = world.stats.powerSupply >= world.stats.powerDemand;
    const hasWaterSurplus = world.stats.waterSupply >= world.stats.waterDemand;
    const hasSewageSurplus = world.stats.sewageSupply >= world.stats.sewageDemand;

    // Randomize scan order with a prime step to prevent top-left always growing first.
    const n = width * height;
    const step = 97;
    let idx = Math.floor(world.rng() * n);
    for (let k = 0; k < n; k++) {
      const i = (idx + k * step) % n;
      if (zone[i] === ZONE_NONE) continue;
      if (abandoned[i] !== 0) continue;
      if (dev[i] >= BALANCE.growth.maxLevel) continue;
      if (power[i] === 0) continue;
      if (!hasPowerSurplus && dev[i] > 0) continue;  // brownout: cap growth at level 1
      if (water[i] === 0) continue;                   // no water coverage
      if (!hasWaterSurplus && dev[i] > 0) continue;   // drought: cap growth at level 1
      if (dev[i] >= 2 && sewage[i] === 0) continue;    // no sewage: cap at level 2
      if (!hasSewageSurplus && dev[i] >= 2) continue;   // sewage overload: cap at level 2
      if (dev[i] >= 2 && services[i] === 0) continue;   // no service coverage: cap at level 2
      if (zone[i] === ZONE_R && dev[i] >= 2 && education[i] < BALANCE.education.growthThreshold) continue; // education too low
      if (zone[i] === ZONE_R && world.layers.sickness[i] > BALANCE.healthcare.growthThreshold) continue; // too sick to attract residents
      // R and C zones don't grow in heavily polluted or high-crime areas.
      if (zone[i] !== ZONE_I && pollution[i] > BALANCE.pollution.growthThreshold) continue;
      if (zone[i] !== ZONE_I && crime[i] > BALANCE.crime.growthThreshold) continue;
      // Road access: straight-line search in 4 directions, up to 3 tiles.
      // Also track max nearby road congestion for the growth penalty.
      const x = i % width, y = (i - x) / width;
      let hasRoad = false;
      let maxCongestion = 0;
      for (let r = 1; r <= 3; r++) {
        if (x - r >= 0     && roadClass[i - r]         !== 0) { hasRoad = true; if (congestion[i - r]         > maxCongestion) maxCongestion = congestion[i - r]; }
        if (x + r < width  && roadClass[i + r]         !== 0) { hasRoad = true; if (congestion[i + r]         > maxCongestion) maxCongestion = congestion[i + r]; }
        if (y - r >= 0     && roadClass[i - r * width] !== 0) { hasRoad = true; if (congestion[i - r * width] > maxCongestion) maxCongestion = congestion[i - r * width]; }
        if (y + r < height && roadClass[i + r * width] !== 0) { hasRoad = true; if (congestion[i + r * width] > maxCongestion) maxCongestion = congestion[i + r * width]; }
      }
      if (!hasRoad) continue;
      const demandMult = zone[i] === ZONE_R ? world.stats.rDemand
                       : zone[i] === ZONE_C ? world.stats.cDemand
                       : world.stats.iDemand;
      // Congestion penalty: heavily congested roads throttle further growth.
      const congestionMult = 1 - (maxCongestion / 255) * BALANCE.transit.congestionGrowthPenalty;
      // Accessibility multiplier: zones with no road path to complementary zone
      // types grow slower. Only applied at dev >= 1 so new zones can always
      // get started without requiring pre-existing complementary zones nearby.
      let accessMult = 1.0;
      if (dev[i] > 0) {
        const a = world.layers.accessibility[i] / 255;
        accessMult = BALANCE.transit.accessFloor + (1 - BALANCE.transit.accessFloor) * a;
      }
      if (world.rng() < BALANCE.growth.probability * demandMult * congestionMult * accessMult) {
        dev[i]++;
        world.grid.markDirty(x, y);
        world.events.emit('tileDeveloped', { tx: x, ty: y, zone: zone[i], level: dev[i] });
      }
    }
  }
}
