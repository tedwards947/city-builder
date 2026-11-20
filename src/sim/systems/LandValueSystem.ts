// Land value and demand curves.
// Land value (0–255) is a per-tile desirability score that modulates tax
// income and provides player feedback about city health.
//
// Demand multipliers (0.25–2.0) adjust zone growth probability based on two
// factors:
//   1. Zone balance — too much of one type slows that type down.
//   2. Tax rates — taxing above the neutral rate (BALANCE.tax.*) suppresses
//      demand for that zone type; taxing below it boosts demand.
//      Formula: taxMult = neutralRate / currentRate, clamped to [0.25, 2.0].
//      Applied after the sqrt so the effect is direct (2× rate → 0.5× demand).
//
// Runs every growth.tickInterval ticks (same cadence as ZoneGrowthSystem).

import { levelWeight } from '../lots';
import { World } from '../World';
import { ZONE_NONE, ZONE_R, ZONE_C, ZONE_I } from '../constants';
import { BALANCE } from '../../data/balance';
import { ordinanceModifier } from '../ordinances';
import { taxDemandMult } from '../tax';
import { goodsDemandMult } from '../goods';
import { portIndustrialDemandMult } from '../seaport';
import { buildingDemandMult } from '../buildingTraffic';
import { isEstablished, establishedAfterYears } from '../established';
import { addLeisureLandValue, leisureLandValueReach } from '../leisure';
import { FieldBounds, unionRect, growRect, type Rect } from '../FieldBounds';

const LV = BALANCE.landValue;
const DM = BALANCE.demand;

// How far a tile's land value looks for things that change it: congestion
// within 2 tiles, industry / neighbours within industryRadius, and coverage
// layers that reach a tile or so off the roads.
const REACH = Math.max(2, LV.industryRadius, BALANCE.power.propagationRange, BALANCE.water.propagationRange, 1);
// Leisure buildings lift land value further out than that (sim/leisure.ts): read when used, the numbers are tuned live.
const reach = (): number => Math.max(REACH, leisureLandValueReach());

export class LandValueSystem {
  // Land value is defined on every tile, but away from the city it sits at a
  // resting value that never changes. So each run only recomputes the tiles
  // that can move — near something built, in pollution, or still easing
  // toward rest — and keeps a running total of the layer for the average.
  private readonly _pollution = new FieldBounds();
  private _layer: Uint8Array | null = null;   // the layer `_total` and `_easing` describe
  private _total = 0;                          // sum of the whole layer
  private _easing: Rect = { x0: 0, y0: 0, x1: -1, y1: -1 }; // tiles that changed last run
  private _acc = new Float64Array(0);          // each tile's target while it is being added up
  private _cong = new Uint8Array(0);           // highest congestion on a road within 2 tiles
  private _trees = new Uint16Array(0);         // trees within treeRadius, while the tree bonus is on

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
    const abandoned = world.layers.abandoned;
    const congestion = world.layers.congestion;
    const roadClass = world.layers.roadClass;
    const veg = world.layers.vegetation;

    // ── Per-tile land value ────────────────────────────────────────────────────
    // Which tiles to recompute. The first run on a layer does the whole map
    // (that also establishes the total). After that: everything within REACH
    // of the built-up area, everything in pollution, and whatever changed
    // last run. A tile outside all three has only resting inputs and did not
    // move last time, so it is at its fixed point and stays there.
    let region: Rect;
    const firstRun = lv !== this._layer;
    if (firstRun) {
      this._layer = lv;
      this._total = 0;
      region = { x0: 0, y0: 0, x1: width - 1, y1: height - 1 };
    } else {
      this._pollution.scan(poll, width, 0);
      region = unionRect(
        unionRect(growRect(world.index.area(world), width, height, reach()), this._pollution.rect()),
        this._easing,
      );
    }

    // Only tiles within REACH of the built-up area can have a road, an
    // industry, a developed or an abandoned lot near enough to matter, so
    // only they need the neighbourhood scans below. Anywhere else those terms
    // are zero (the same reasoning that limits `region` after the first run);
    // this keeps the first run's whole-map pass cheap.
    const near = growRect(world.index.area(world), width, height, reach());

    const riseSmoothing = Math.min(1, LV.smoothing * ordinanceModifier(world, 'landValueGrowth'));
    // Heritage Protection scales the land value of established lots. The
    // per-tile check only runs while it is enacted and has a number.
    const heritage = ordinanceModifier(world, 'establishedLandValue');
    const establishedAfter = heritage !== 1 ? establishedAfterYears() : 0;

    // The neighbourhood terms are gathered by SCATTER: instead of every tile
    // looking at the 49 tiles around it, each road and each developed or
    // abandoned lot adds its effect to the tiles around itself. The work is
    // then in proportion to what is built, not to the area times 49. Each
    // tile still receives exactly the same additions in exactly the same
    // order as a tile-by-tile scan would make them (congestion first, then
    // its neighbours in row order), so the results are identical to the bit.
    if (this._acc.length !== n) { this._acc = new Float64Array(n); this._cong = new Uint8Array(n); }
    const acc = this._acc, cong = this._cong;
    // The part of `region` that gets the neighbourhood terms at all.
    const sx0 = Math.max(region.x0, near.x0), sx1 = Math.min(region.x1, near.x1);
    const sy0 = Math.max(region.y0, near.y0), sy1 = Math.min(region.y1, near.y1);

    // 1. Highest congestion on a road within 2 tiles.
    for (let y = sy0; y <= sy1; y++) cong.fill(0, y * width + sx0, y * width + sx1 + 1);
    const { roads, roadCount } = world.index;
    for (let k = 0; k < roadCount; k++) {
      const ri = roads[k];
      const c = congestion[ri];
      if (c === 0 || roadClass[ri] === 0) continue;
      const rx = ri % width, ry = (ri - rx) / width;
      const ax0 = Math.max(sx0, rx - 2), ax1 = Math.min(sx1, rx + 2);
      const ay0 = Math.max(sy0, ry - 2), ay1 = Math.min(sy1, ry + 2);
      for (let y = ay0; y <= ay1; y++) {
        for (let i = y * width + ax0, end = y * width + ax1; i <= end; i++) if (cong[i] < c) cong[i] = c;
      }
    }

    // 2. Each tile's own terms, then the congestion penalty.
    for (let y = region.y0; y <= region.y1; y++) {
      const rowNear = y >= sy0 && y <= sy1;
      for (let x = region.x0; x <= region.x1; x++) {
        const i = y * width + x;
        let target: number = LV.base;
        target += svc[i]   ? LV.serviceBonus : 0;
        target += power[i] ? LV.powerBonus   : 0;
        target += water[i] ? LV.waterBonus   : 0;
        target -= poll[i] * LV.pollutionPenalty;
        if (rowNear && x >= sx0 && x <= sx1) target -= cong[i] * LV.congestionPenalty;
        acc[i] = target;
      }
    }

    // 3. Nearby abandoned lots and industry (penalties) and developed
    //    neighbours (bonus). Sources are visited in row order, so each tile
    //    gets its additions in the order a scan around it would make them.
    const r = LV.industryRadius;
    const qx0 = Math.max(0, sx0 - r), qx1 = Math.min(width - 1, sx1 + r);
    const qy0 = Math.max(0, sy0 - r), qy1 = Math.min(height - 1, sy1 + r);
    for (let qy = qy0; qy <= qy1; qy++) {
      for (let qx = qx0; qx <= qx1; qx++) {
        const q = qy * width + qx;
        // What this tile does to the tiles around it: 1 abandoned, 2 industry, 3 neighbour.
        let what: number;
        if (abandoned[q]) what = 1;
        else if (dev[q] === 0) continue;
        else if (zone[q] === ZONE_I) what = 2;
        else if (zone[q] !== ZONE_NONE) what = 3;
        else continue;
        const reach = what === 3 ? 1 : r;
        const ax0 = Math.max(sx0, qx - reach), ax1 = Math.min(sx1, qx + reach);
        const ay0 = Math.max(sy0, qy - reach), ay1 = Math.min(sy1, qy + reach);
        for (let y = ay0; y <= ay1; y++) {
          for (let x = ax0; x <= ax1; x++) {
            if (x === qx && y === qy) continue;
            const i = y * width + x;
            if (what === 1) acc[i] -= LV.abandonedPenalty;
            else if (what === 2) acc[i] -= LV.industryPenalty / (Math.abs(x - qx) + Math.abs(y - qy));
            else acc[i] += LV.neighborBonus;
          }
        }
      }
    }

    // 3b. Trees nearby (off while treeBonus is 0). Each tree adds one to the
    //     count of every tile within treeRadius of it; the bonus is capped,
    //     so a forest is worth no more than a well-planted street.
    const treeBonus = (LV as { treeBonus: number }).treeBonus;
    if (treeBonus !== 0 && sx0 <= sx1 && sy0 <= sy1) {
      const tr = Math.max(0, LV.treeRadius | 0), cap = LV.treeBonusMax;
      if (this._trees.length !== n) this._trees = new Uint16Array(n);
      const trees = this._trees;
      for (let y = sy0; y <= sy1; y++) trees.fill(0, y * width + sx0, y * width + sx1 + 1);
      const tx0 = Math.max(0, sx0 - tr), tx1 = Math.min(width - 1, sx1 + tr);
      const ty0 = Math.max(0, sy0 - tr), ty1 = Math.min(height - 1, sy1 + tr);
      for (let qy = ty0; qy <= ty1; qy++) {
        for (let qx = tx0; qx <= tx1; qx++) {
          if (veg[qy * width + qx] === 0) continue;
          const ax0 = Math.max(sx0, qx - tr), ax1 = Math.min(sx1, qx + tr);
          const ay0 = Math.max(sy0, qy - tr), ay1 = Math.min(sy1, qy + tr);
          for (let y = ay0; y <= ay1; y++) {
            for (let i = y * width + ax0, end = y * width + ax1; i <= end; i++) trees[i]++;
          }
        }
      }
      for (let y = Math.max(region.y0, sy0); y <= Math.min(region.y1, sy1); y++) {
        for (let i = y * width + sx0, end = y * width + sx1; i <= end; i++) {
          if (trees[i] !== 0) acc[i] += Math.min(cap, trees[i] * treeBonus);
        }
      }
    }

    // 3c. Leisure buildings (parks, plazas, a museum) lift the land round them (sim/leisure.ts).
    addLeisureLandValue(world, acc, Math.max(region.x0, sx0), Math.max(region.y0, sy0), Math.min(region.x1, sx1), Math.min(region.y1, sy1));

    // 4. Ease each tile toward its target.
    let delta = 0;
    let cx0 = width, cy0 = height, cx1 = -1, cy1 = -1; // tiles that changed this run
    for (let y = region.y0; y <= region.y1; y++) {
      for (let x = region.x0; x <= region.x1; x++) {
        const i = y * width + x;
        let target = acc[i];

        if (establishedAfter > 0 && isEstablished(world, i, establishedAfter)) target *= heritage;

        target = Math.max(0, Math.min(255, target));
        // Smooth toward target. Rent Control slows rises (not falls).
        const before = lv[i];
        const smoothing = target > before ? riseSmoothing : LV.smoothing;
        const after = Math.round(before * (1 - smoothing) + target * smoothing);
        lv[i] = after;
        if (firstRun) delta += after;
        else delta += after - before;
        if (after !== before) {
          if (x < cx0) cx0 = x;
          if (x > cx1) cx1 = x;
          if (y < cy0) cy0 = y;
          if (y > cy1) cy1 = y;
        }
      }
    }
    this._total += delta;
    this._easing = { x0: cx0, y0: cy0, x1: cx1, y1: cy1 };
    world.stats.avgLandValue = Math.round(this._total / n);

    // ── Demand curves ──────────────────────────────────────────────────────────
    // Tally dev levels per zone type across the city.
    let rDev = 0, cDev = 0, iDev = 0;
    const { zoned, zonedCount } = world.index;
    for (let k = 0; k < zonedCount; k++) {
      const i = zoned[k];
      if (dev[i] === 0) continue;
      if (zone[i] === ZONE_R) rDev += levelWeight(dev[i]);
      else if (zone[i] === ZONE_C) cDev += levelWeight(dev[i]);
      else if (zone[i] === ZONE_I) iDev += levelWeight(dev[i]);
    }

    // rDemand: R grows fast when there are proportionally more jobs (C+I) than residents.
    const rRatio = (cDev + iDev + 1) / ((rDev + 1) * DM.jobsPerResident);
    // cDemand: C grows fast when there's more R pop than commerce can serve.
    const cRatio = (rDev + 1) / (cDev * DM.residentsPerCommerce + 1);
    // iDemand: I grows fast when combined labor+market exceeds industrial capacity.
    const iRatio = (rDev + cDev + 1) / (iDev * DM.workersPerIndustry + 1);

    // Tax demand multipliers — neutral at default rate, inverse of rate change.
    const { taxRates } = world.budget;
    const TAX = BALANCE.tax;
    const taxClamp = (v: number) => Math.max(DM.min, Math.min(DM.max, v));
    // The city-wide tax level moves all three the same way (exactly 1 at the neutral level).
    const cityTax = taxDemandMult(world.budget.taxLevel);
    const rTaxMult = taxClamp(TAX.zoneR / taxRates.R * cityTax);
    const cTaxMult = taxClamp(TAX.zoneC / taxRates.C * cityTax);
    const iTaxMult = taxClamp(TAX.zoneI / taxRates.I * cityTax);

    const sqrtClamp = (v: number) => Math.max(DM.min, Math.min(DM.max, Math.sqrt(v)));
    world.stats.rDemand = taxClamp(sqrtClamp(rRatio) * rTaxMult * buildingDemandMult(world, 'R'));
    // Business Incentives scales demand for shops and industry. Shops short of goods are in
    // less demand (sim/goods.ts); a connected seaport raises demand for industry (sim/seaport.ts).
    // A building can scale any of the three while it stands on a road (an airport and shops: sim/buildingTraffic.ts).
    world.stats.cDemand = taxClamp(sqrtClamp(cRatio) * cTaxMult * ordinanceModifier(world, 'commercialDemand') * goodsDemandMult(world) * buildingDemandMult(world, 'C'));
    world.stats.iDemand = taxClamp(sqrtClamp(iRatio) * iTaxMult * ordinanceModifier(world, 'industrialDemand') * portIndustrialDemandMult(world) * buildingDemandMult(world, 'I'));
  }
}
