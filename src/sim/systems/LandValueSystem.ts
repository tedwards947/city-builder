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

import { World } from '../World';
import { ZONE_NONE, ZONE_R, ZONE_C, ZONE_I } from '../constants';
import { BALANCE } from '../../data/balance';
import { ordinanceModifier } from '../ordinances';
import { isEstablished, establishedAfterYears } from '../established';
import { FieldBounds, unionRect, growRect, type Rect } from '../FieldBounds';

const LV = BALANCE.landValue;
const DM = BALANCE.demand;

// How far a tile's land value looks for things that change it: congestion
// within 2 tiles, industry / neighbours within industryRadius, and coverage
// layers that reach a tile or so off the roads.
const REACH = Math.max(2, LV.industryRadius, BALANCE.power.propagationRange, BALANCE.water.propagationRange, 1);

export class LandValueSystem {
  // Land value is defined on every tile, but away from the city it sits at a
  // resting value that never changes. So each run only recomputes the tiles
  // that can move — near something built, in pollution, or still easing
  // toward rest — and keeps a running total of the layer for the average.
  private readonly _pollution = new FieldBounds();
  private _layer: Uint8Array | null = null;   // the layer `_total` and `_easing` describe
  private _total = 0;                          // sum of the whole layer
  private _easing: Rect = { x0: 0, y0: 0, x1: -1, y1: -1 }; // tiles that changed last run

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
        unionRect(growRect(world.index.area(world), width, height, REACH), this._pollution.rect()),
        this._easing,
      );
    }

    // Only tiles within REACH of the built-up area can have a road, an
    // industry, a developed or an abandoned lot near enough to matter, so
    // only they need the neighbourhood scans below. Anywhere else those terms
    // are zero (the same reasoning that limits `region` after the first run);
    // this keeps the first run's whole-map pass cheap.
    const near = growRect(world.index.area(world), width, height, REACH);

    const riseSmoothing = Math.min(1, LV.smoothing * ordinanceModifier(world, 'landValueGrowth'));
    // Heritage Protection scales the land value of established lots. The
    // per-tile check only runs while it is enacted and has a number.
    const heritage = ordinanceModifier(world, 'establishedLandValue');
    const establishedAfter = heritage !== 1 ? establishedAfterYears() : 0;

    let delta = 0;
    let cx0 = width, cy0 = height, cx1 = -1, cy1 = -1; // tiles that changed this run
    for (let y = region.y0; y <= region.y1; y++) {
      const rowNear = y >= near.y0 && y <= near.y1;
      for (let x = region.x0; x <= region.x1; x++) {
        const i = y * width + x;

        let target: number = LV.base;
        target += svc[i]   ? LV.serviceBonus : 0;
        target += power[i] ? LV.powerBonus   : 0;
        target += water[i] ? LV.waterBonus   : 0;
        target -= poll[i] * LV.pollutionPenalty;

        if (rowNear && x >= near.x0 && x <= near.x1) {
          // Find max congestion on adjacent roads (within 2 tiles)
          let maxNearbyCongestion = 0;
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
              const ni = ny * width + nx;
              if (roadClass[ni] !== 0 && congestion[ni] > maxNearbyCongestion) {
                maxNearbyCongestion = congestion[ni];
              }
            }
          }
          target -= maxNearbyCongestion * LV.congestionPenalty;

          // Scan neighbourhood for nearby industry (penalty) or developed zones (bonus).
          const r = LV.industryRadius;
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
              const ni = ny * width + nx;

              if (abandoned[ni]) {
                target -= LV.abandonedPenalty;
                continue;
              }

              if (dev[ni] === 0) continue;
              if (zone[ni] === ZONE_I) {
                target -= LV.industryPenalty / (Math.abs(dx) + Math.abs(dy));
              } else if (zone[ni] !== ZONE_NONE && Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
                target += LV.neighborBonus;
              }
            }
          }
        }

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

    // Tax demand multipliers — neutral at default rate, inverse of rate change.
    const { taxRates } = world.budget;
    const TAX = BALANCE.tax;
    const taxClamp = (v: number) => Math.max(DM.min, Math.min(DM.max, v));
    const rTaxMult = taxClamp(TAX.zoneR / taxRates.R);
    const cTaxMult = taxClamp(TAX.zoneC / taxRates.C);
    const iTaxMult = taxClamp(TAX.zoneI / taxRates.I);

    const sqrtClamp = (v: number) => Math.max(DM.min, Math.min(DM.max, Math.sqrt(v)));
    world.stats.rDemand = taxClamp(sqrtClamp(rRatio) * rTaxMult);
    // Business Incentives scales demand for shops and industry.
    world.stats.cDemand = taxClamp(sqrtClamp(cRatio) * cTaxMult * ordinanceModifier(world, 'commercialDemand'));
    world.stats.iDemand = taxClamp(sqrtClamp(iRatio) * iTaxMult * ordinanceModifier(world, 'industrialDemand'));
  }
}
