// Zone growth. Eligible tiles (zoned + powered + road access) develop
// gradually at a low random probability per tick.

import { stationGrowthMask } from '../rail';
import { leisureGrowthMult } from '../leisureTraffic';
import { World } from '../World';
import { ZONE_NONE, ZONE_R, ZONE_C, ZONE_I, ROAD_NONE, ROAD_HIGHWAY } from '../constants';
import { BALANCE } from '../../data/balance';
import { ordinanceModifier } from '../ordinances';
import { markDeveloped } from '../established';
import { taxExodusChance } from '../tax';

/** Inverse of `a` modulo `m`, or 0 if there is none (a and m share a factor). */
function modInverse(a: number, m: number): number {
  let r0 = m, r1 = a % m, t0 = 0, t1 = 1;
  while (r1 !== 0) {
    const q = Math.floor(r0 / r1);
    [r0, r1] = [r1, r0 - q * r1];
    [t0, t1] = [t1, t0 - q * t1];
  }
  return r0 === 1 ? ((t0 % m) + m) % m : 0;
}

/**
 * The zoned tiles in the order a scan `i = (start + k·step) mod n`, k = 0…n-1,
 * visits them. The scan reaches tile i at k = (i − start)·step⁻¹ mod n, so
 * sorting by that k gives the order without walking the whole map. Returns
 * null when step has no inverse mod n (the scan then repeats tiles, and the
 * caller walks it as written).
 */
function steppedOrder(world: World, start: number, step: number, n: number): Int32Array | null {
  const inv = modInverse(step, n);
  if (inv === 0) return null;
  const { zoned, zonedCount } = world.index;
  const when = new Float64Array(n > 0 ? zonedCount : 0);
  const order = new Int32Array(zonedCount);
  for (let q = 0; q < zonedCount; q++) {
    // Both factors are below n ≤ 2^20 or so, so the product is exact.
    when[q] = ((((zoned[q] - start) % n) + n) % n) * inv % n;
    order[q] = q;
  }
  order.sort((a, b) => when[a] - when[b]);
  for (let q = 0; q < zonedCount; q++) order[q] = zoned[order[q]];
  return order;
}

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
    const hasPowerSurplus  = world.stats.powerSupply >= world.stats.powerDemand;
    const hasWaterSurplus  = world.stats.waterSupply >= world.stats.waterDemand;
    const hasSewageSurplus = world.stats.sewageSupply >= world.stats.sewageDemand;

    // Ordinances scale the chance to grow: every zone (Fast-Track Permits)
    // and industry on top of that (Clean Air Act).
    const growthAll = ordinanceModifier(world, 'growth');
    const growthIndustry = growthAll * ordinanceModifier(world, 'industrialGrowth');

    // Randomize scan order with a prime step to prevent top-left always growing first.
    const n = width * height;
    const step = 97;
    const nearStation = stationGrowthMask(world);
    let idx = Math.floor(world.rng() * n);
    // Only zoned tiles can grow, so visit just those — in the order the
    // stepped scan would reach them, which keeps the random rolls identical.
    const visit = steppedOrder(world, idx, step, n);
    const count = visit ? visit.length : n;
    for (let k = 0; k < count; k++) {
      const i = visit ? visit[k] : (idx + k * step) % n;
      if (zone[i] === ZONE_NONE) continue;
      if (abandoned[i] !== 0) continue;
      if (dev[i] >= BALANCE.growth.maxLevel) continue;
      
      // Basic requirements for any growth (level 0 -> 1)
      if (power[i] === 0) continue;
      if (water[i] === 0) continue;

      // Resource shortage penalties (soft caps)
      let shortagePenalty = 1.0;
      if (!hasPowerSurplus && dev[i] > 0)  shortagePenalty *= 0.1; // brownout
      if (!hasWaterSurplus && dev[i] > 0)  shortagePenalty *= 0.1; // drought
      if (!hasSewageSurplus && dev[i] >= 2) shortagePenalty *= 0.1; // sewage overload

      // Service/Education/Healthcare requirements
      if (dev[i] >= 2 && sewage[i] === 0) continue;    // no sewage: cap at level 2
      if (dev[i] >= 2 && services[i] === 0) continue;   // no service coverage: cap at level 2
      if (zone[i] === ZONE_R && dev[i] >= 2 && education[i] < BALANCE.education.growthThreshold) continue; // education too low
      if (zone[i] === ZONE_R && world.layers.sickness[i] > BALANCE.healthcare.growthThreshold) continue; // too sick to attract residents
      
      // R and C zones don't grow in heavily polluted or high-crime areas.
      if (zone[i] !== ZONE_I && pollution[i] > BALANCE.pollution.growthThreshold) continue;
      if (zone[i] !== ZONE_I && crime[i] > BALANCE.crime.growthThreshold) continue;
      // Road access: direct adjacency check (1-tile radius).
      // Highways do NOT provide access for growth.
      // Also track max nearby road congestion for the growth penalty.
      const x = i % width, y = (i - x) / width;
      let hasRoad = false;
      let maxCongestion = 0;
      const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;
      for (const [dx, dy] of neighbors) {
        const nx = x + dx, ny = y + dy;
        if (world.grid.inBounds(nx, ny)) {
          const ni = ny * width + nx;
          const rc = roadClass[ni];
          if (rc !== ROAD_NONE && rc !== ROAD_HIGHWAY) {
            hasRoad = true;
            if (congestion[ni] > maxCongestion) maxCongestion = congestion[ni];
          }
        }
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
      const ordinance = zone[i] === ZONE_I ? growthIndustry : growthAll;
      const baseP = zone[i] === ZONE_R ? (BALANCE.growth.homeProbabilityByLevel[dev[i]] ?? BALANCE.growth.probability) : BALANCE.growth.probability;
      // Homes and shops near a station with a road and riders grow faster (sim/rail.ts).
      const station = nearStation !== null && nearStation[i] === 1 && zone[i] !== ZONE_I ? BALANCE.rail.stationGrowth.mult : 1;
      // Homes growing to level 3 want leisure in reach (sim/leisureTraffic.ts); without it they grow slower.
      const leisure = zone[i] === ZONE_R ? leisureGrowthMult(world, i, dev[i] + 1) : 1;
      if (world.rng() < baseP * demandMult * congestionMult * accessMult * shortagePenalty * ordinance * station * leisure) {
        dev[i]++;
        if (dev[i] === 1) markDeveloped(world, i);   // built up from empty: its years start now
        world.grid.markDirty(x, y);
        world.events.emit('tileDeveloped', { tx: x, ty: y, zone: zone[i], level: dev[i] });
      }
    }

    // Tax exodus: while the tax level is above neutral, each developed home
    // may lose one level this pass. No rolls at all while it is off.
    const exodus = taxExodusChance(world.budget.taxLevel);
    if (exodus > 0) {
      const { zoned, zonedCount } = world.index;
      for (let q = 0; q < zonedCount; q++) {
        const i = zoned[q];
        if (zone[i] !== ZONE_R || dev[i] === 0 || abandoned[i] !== 0) continue;
        if (world.rng() >= exodus) continue;
        if (world.layers.lot[i] !== 0) continue;        // a merged 2×2 lot never drops a level: it declines as one building (sim/lots.ts)
        dev[i]--;
        const x = i % width;
        world.grid.markDirty(x, (i - x) / width);
        world.events.emit('tileDeclined', { tx: x, ty: (i - x) / width, zone: ZONE_R, level: dev[i], reason: 'tax' });
      }
    }
  }
}
