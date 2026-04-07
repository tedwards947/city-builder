// Tile info panel — shown when the 'inspect' tool is active.
// Displays terrain, zone, development level, coverage status, and a clear
// breakdown of what's blocking the next level of growth.

import type { World } from '../sim/World';
import {
  TERRAIN_GRASS, TERRAIN_WATER, TERRAIN_SAND,
  ZONE_NONE, ZONE_R, ZONE_C, ZONE_I,
  ROAD_NONE,
  VEG_NONE, VEG_TREE_1, VEG_TREE_2, VEG_TREE_3, VEG_TREE_4, VEG_TREE_5, VEG_TREE_6,
  BUILDING_NONE, BUILDING_POWER_PLANT, BUILDING_WATER_TOWER, BUILDING_SEWAGE_PLANT,

  BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL, BUILDING_PARK,
} from '../sim/constants';
import { BALANCE } from '../data/balance';

interface Req {
  label: string;
  met: boolean;
}

const ZONE_NAME: Record<number, string> = {
  [ZONE_R]: 'Residential',
  [ZONE_C]: 'Commercial',
  [ZONE_I]: 'Industrial',
};

const BUILDING_NAME: Record<number, string> = {
  [BUILDING_POWER_PLANT]: 'Power Plant',
  [BUILDING_WATER_TOWER]: 'Water Tower',
  [BUILDING_SEWAGE_PLANT]: 'Sewage Plant',
  [BUILDING_POLICE]: 'Police Station',
  [BUILDING_FIRE]: 'Fire Station',
  [BUILDING_SCHOOL]: 'School',
  [BUILDING_HOSPITAL]: 'Hospital',
  [BUILDING_PARK]: 'Park',
};

const TERRAIN_NAME: Record<number, string> = {
  [TERRAIN_GRASS]: 'Grass',
  [TERRAIN_WATER]: 'Water',
  [TERRAIN_SAND]: 'Sand',
};

const TREE_SPECIES: Record<number, string> = {
  [VEG_TREE_1]: 'Oak (Deciduous)',
  [VEG_TREE_2]: 'Maple (Deciduous)',
  [VEG_TREE_3]: 'Pine (Evergreen)',
  [VEG_TREE_4]: 'Spruce (Evergreen)',
  [VEG_TREE_5]: 'Poplar (Tall)',
  [VEG_TREE_6]: 'Birch (Tall)',
};

function hasRoadAccess(world: World, tx: number, ty: number): boolean {
  const { width, height } = world.grid;
  const i = world.grid.idx(tx, ty);
  const x = i % width;
  const y = (i - x) / width;
  const roadClass = world.layers.roadClass;
  for (let r = 1; r <= 3; r++) {
    if (x - r >= 0     && roadClass[i - r] !== ROAD_NONE) return true;
    if (x + r < width  && roadClass[i + r] !== ROAD_NONE) return true;
    if (y - r >= 0     && roadClass[i - r * width] !== ROAD_NONE) return true;
    if (y + r < height && roadClass[i + r * width] !== ROAD_NONE) return true;
  }
  return false;
}

function analyzeZone(world: World, tx: number, ty: number): { level: number; maxLevel: number; reqs: Req[] } {
  const i = world.grid.idx(tx, ty);
  const dev = world.layers.devLevel[i];
  const zone = world.layers.zone[i];
  const maxLevel = BALANCE.growth.maxLevel;

  if (dev >= maxLevel) return { level: dev, maxLevel, reqs: [] };

  const power    = world.layers.power[i] !== 0;
  const water    = world.layers.water[i] !== 0;
  const sewage   = world.layers.sewage[i] !== 0;
  const services = world.layers.services[i] !== 0;
  const pollution = world.layers.pollution[i];
  const crime     = world.layers.crime[i];
  const road      = hasRoadAccess(world, tx, ty);

  const hasPowerSurplus  = world.stats.powerSupply  >= world.stats.powerDemand;
  const hasWaterSurplus  = world.stats.waterSupply  >= world.stats.waterDemand;
  const hasSewageSurplus = world.stats.sewageSupply >= world.stats.sewageDemand;

  const reqs: Req[] = [];

  reqs.push({ label: 'Road access (within 3 tiles)', met: road });
  reqs.push({ label: 'Power coverage', met: power });
  reqs.push({ label: 'Water coverage', met: water });

  if (dev >= 1) {
    reqs.push({ label: 'Power surplus city-wide', met: hasPowerSurplus });
    reqs.push({ label: 'Water surplus city-wide', met: hasWaterSurplus });
  }
  if (dev >= 2) {
    reqs.push({ label: 'Sewage coverage', met: sewage });
    reqs.push({ label: 'Sewage surplus city-wide', met: hasSewageSurplus });
    reqs.push({ label: 'Services coverage', met: services });
  }
  if (zone !== ZONE_I) {
    reqs.push({
      label: `Pollution below threshold (${pollution} / ${BALANCE.pollution.growthThreshold})`,
      met: pollution <= BALANCE.pollution.growthThreshold,
    });
    reqs.push({
      label: `Crime below threshold (${crime} / ${BALANCE.crime.growthThreshold})`,
      met: crime <= BALANCE.crime.growthThreshold,
    });
  }

  return { level: dev, maxLevel, reqs };
}

export class TileInfoPanel {
  private readonly el: HTMLElement;
  private visible = false;

  constructor() {
    this.el = document.getElementById('tile-info')!;
  }

  setVisible(v: boolean): void {
    this.visible = v;
    if (!v) this.el.classList.add('hidden');
  }

  update(world: World, tile: { tx: number; ty: number } | null): void {
    if (!this.visible) return;
    if (!tile || !world.grid.inBounds(tile.tx, tile.ty)) {
      this.el.classList.add('hidden');
      return;
    }
    this.el.classList.remove('hidden');
    this._render(world, tile.tx, tile.ty);
  }

  private _render(world: World, tx: number, ty: number): void {
    const i = world.grid.idx(tx, ty);
    const terrain  = world.layers.terrain[i];
    const zone     = world.layers.zone[i];
    const road     = world.layers.roadClass[i];
    const building = world.layers.building[i];
    const vegetation = world.layers.vegetation[i];
    const dev      = world.layers.devLevel[i];
    const pollution = world.layers.pollution[i];
    const crime     = world.layers.crime[i];
    const distress  = world.layers.distress[i];

    let html = `<div class="ti-coord">(${tx}, ${ty})</div>`;

    // ── Building tile ──────────────────────────────────────────────────────────
    if (building !== 0) {
      const name = BUILDING_NAME[building] ?? `Building #${building}`;
      html += `<div class="ti-type">${name}</div>`;
      // Show coverage radius for service buildings
      if (building >= BUILDING_POLICE) {
        const range = BALANCE.service.coverageRange[building];
        html += `<div class="ti-detail">Coverage radius: ${range} tiles</div>`;
        html += `<div class="ti-detail">Maintenance: $${BALANCE.maintenance.service[building]}/tick</div>`;
      }
      if (building === BUILDING_POWER_PLANT) {
        html += `<div class="ti-detail">Output: ${BALANCE.power.plantOutput} units/tick</div>`;
      }
      if (building === BUILDING_WATER_TOWER) {
        html += `<div class="ti-detail">Output: ${BALANCE.water.towerOutput} units/tick</div>`;
      }
      if (building === BUILDING_SEWAGE_PLANT) {
        html += `<div class="ti-detail">Capacity: ${BALANCE.sewage.plantOutput} units/tick</div>`;
      }

    // ── Road tile ──────────────────────────────────────────────────────────────
    } else if (road !== ROAD_NONE) {
      const netId = world.layers.roadNet[i];
      const cong  = world.layers.congestion[i];
      const congPct = Math.round(cong / 255 * 100);
      const congLabel = cong < 30  ? 'Free'
                      : cong < 85  ? 'Light'
                      : cong < 140 ? 'Moderate'
                      : cong < 200 ? 'Heavy'
                      :              'Gridlock';
      const congColor = cong < 30  ? '#5c5'
                      : cong < 85  ? '#9c5'
                      : cong < 140 ? '#cc5'
                      : cong < 200 ? '#e95'
                      :              '#e55';
      html += `<div class="ti-type">Road</div>`;
      html += `<div class="ti-detail">Network #${netId}</div>`;
      html += `<div class="ti-detail" style="color:${congColor}">Congestion: ${congLabel} (${congPct}%)</div>`;
      if (cong > 0) {
        const penalty = Math.round((cong / 255) * BALANCE.transit.congestionGrowthPenalty * 100);
        html += `<div class="ti-detail" style="color:#999">Growth penalty to nearby zones: −${penalty}%</div>`;
      }

    // ── Water terrain ──────────────────────────────────────────────────────────
    } else if (terrain === TERRAIN_WATER) {
      html += `<div class="ti-type">Water</div>`;
      html += `<div class="ti-note">Not buildable</div>`;

    // ── Zone tile ──────────────────────────────────────────────────────────────
    } else if (zone !== ZONE_NONE) {
      const zoneName = ZONE_NAME[zone] ?? 'Zone';
      const dots = '●'.repeat(dev) + '○'.repeat(BALANCE.growth.maxLevel - dev);
      const isAbandoned = world.layers.abandoned[i] !== 0;
      html += `<div class="ti-type">${zoneName} <span class="ti-dots">${dots}</span> Lv ${dev}/${BALANCE.growth.maxLevel}${isAbandoned ? ' <span style="color:#e84;font-weight:bold">ABANDONED</span>' : ''}</div>`;

      if (isAbandoned) {
        html += `<div class="ti-detail" style="color:#e84">Abandoned — no residents, no income. Bulldoze to clear.</div>`;
      } else {
        const distress = world.layers.distress[i];
        if (distress > 0) {
          const threshold = BALANCE.abandonment.abandonThreshold;
          html += `<div class="ti-detail" style="color:#cc5">Distress: ${distress}/${threshold} — conditions unmet, risk of abandonment</div>`;
        }
      }

      const landValue = world.layers.landValue[i];
      const lvLabel = landValue < 60 ? 'low' : landValue < 110 ? 'medium' : landValue < 160 ? 'good' : 'prime';
      html += `<div class="ti-detail">Land value: ${landValue} (${lvLabel})</div>`;

      if (pollution > 0) {
        const pLabel = pollution < 40 ? 'low' : pollution < 100 ? 'medium' : 'high';
        html += `<div class="ti-detail ti-poll">Pollution: ${pollution} (${pLabel})</div>`;
      }

      if (crime > 0) {
        const cLabel = crime < 40 ? 'low' : crime < 100 ? 'medium' : 'high';
        html += `<div class="ti-detail" style="color:#e55">Crime: ${crime} (${cLabel})</div>`;
      }

      // Demand and tax display
      const demand = zone === ZONE_R ? world.stats.rDemand
                   : zone === ZONE_C ? world.stats.cDemand
                   : world.stats.iDemand;
      const demandColor = demand >= 1.2 ? '#5c5' : demand >= 0.8 ? '#cc5' : '#e55';
      html += `<div class="ti-detail" style="color:${demandColor}">Demand: ${demand.toFixed(2)}×</div>`;

      const neutralRate = zone === ZONE_R ? BALANCE.tax.zoneR
                        : zone === ZONE_C ? BALANCE.tax.zoneC
                        : BALANCE.tax.zoneI;
      const currentRate = zone === ZONE_R ? world.budget.taxRates.R
                        : zone === ZONE_C ? world.budget.taxRates.C
                        : world.budget.taxRates.I;
      const taxMult = Math.max(BALANCE.demand.min, Math.min(BALANCE.demand.max, neutralRate / currentRate));
      const taxDelta = Math.round((taxMult - 1) * 100);
      const taxColor = taxDelta >= 0 ? '#5c5' : '#e55';
      const taxSign  = taxDelta >= 0 ? '+' : '';
      html += `<div class="ti-detail" style="color:${taxColor}">Tax rate: ${currentRate.toFixed(1)} (${taxSign}${taxDelta}% demand from taxes)</div>`;

      const { reqs, maxLevel } = analyzeZone(world, tx, ty);

      if (isAbandoned) {
        html += `<div class="ti-growth-header" style="color:#e84">Growth blocked — building is abandoned</div>`;
      } else if (dev >= maxLevel) {
        html += `<div class="ti-growth-ok">✦ Fully developed</div>`;
      } else {
        html += `<div class="ti-growth-header">To reach Lv ${dev + 1}:</div>`;
        for (const req of reqs) {
          const icon = req.met ? '<span class="ti-yes">✓</span>' : '<span class="ti-no">✗</span>';
          html += `<div class="ti-req">${icon} ${req.label}</div>`;
        }
        const allMet = reqs.every(r => r.met);
        if (allMet) {
          const effectivePct = Math.round(BALANCE.growth.probability * demand * 100);
          html += `<div class="ti-growth-ok">All met — growing at ~${effectivePct}% chance/interval</div>`;
        }
      }

    // ── Empty tile ─────────────────────────────────────────────────────────────
    } else {
      const terrainName = TERRAIN_NAME[terrain] ?? 'Unknown';
      if (vegetation !== VEG_NONE) {
        const treeName = TREE_SPECIES[vegetation] ?? 'Trees';
        html += `<div class="ti-type">${treeName}</div>`;
        html += `<div class="ti-detail" style="color:#5c5">Improves air quality</div>`;
        html += `<div class="ti-detail">Terrain: ${terrainName}</div>`;
      } else {
        html += `<div class="ti-type">${terrainName}</div>`;
        html += `<div class="ti-note">No zone — place Res/Com/Ind to develop</div>`;
      }
    }

    this.el.innerHTML = html;
  }
}
