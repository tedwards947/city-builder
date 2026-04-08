// Tile info panel — shown when the 'inspect' tool is active.
// Displays terrain, zone, development level, coverage status, and a clear
// breakdown of what's blocking the next level of growth.

import type {World} from "../sim/World";
import {
  TERRAIN_GRASS,
  TERRAIN_WATER,
  TERRAIN_SAND,
  ZONE_NONE,
  ZONE_R,
  ZONE_C,
  ZONE_I,
  ROAD_NONE,
  VEG_NONE,
  VEG_TREE_1,
  VEG_TREE_2,
  VEG_TREE_3,
  VEG_TREE_4,
  VEG_TREE_5,
  VEG_TREE_6,
  BUILDING_NONE,
  BUILDING_POWER_PLANT,
  BUILDING_WATER_TOWER,
  BUILDING_SEWAGE_PLANT,
  BUILDING_POLICE,
  BUILDING_FIRE,
  BUILDING_SCHOOL,
  BUILDING_HOSPITAL,
  BUILDING_PARK,
  ROAD_AVENUE,
  ROAD_HIGHWAY,
  ROAD_STREET,
} from "../sim/constants";
import {BALANCE} from "../data/balance";
import {t} from "../i18n";

interface Req {
  label: string;
  met: boolean;
}

const ZONE_NAME: Record<number, string> = {
  [ZONE_R]: "zones.residential",
  [ZONE_C]: "zones.commercial",
  [ZONE_I]: "zones.industrial",
};

const BUILDING_NAME: Record<number, string> = {
  [BUILDING_POWER_PLANT]: "buildings.powerPlant",
  [BUILDING_WATER_TOWER]: "buildings.waterTower",
  [BUILDING_SEWAGE_PLANT]: "buildings.sewagePlant",
  [BUILDING_POLICE]: "buildings.policeStation",
  [BUILDING_FIRE]: "buildings.fireStation",
  [BUILDING_SCHOOL]: "buildings.school",
  [BUILDING_HOSPITAL]: "buildings.hospital",
  [BUILDING_PARK]: "buildings.park",
};

const TERRAIN_NAME: Record<number, string> = {
  [TERRAIN_GRASS]: "terrain.grass",
  [TERRAIN_WATER]: "terrain.water",
  [TERRAIN_SAND]: "terrain.sand",
};

const TREE_SPECIES: Record<number, string> = {
  [VEG_TREE_1]: "trees.oak",
  [VEG_TREE_2]: "trees.maple",
  [VEG_TREE_3]: "trees.pine",
  [VEG_TREE_4]: "trees.spruce",
  [VEG_TREE_5]: "trees.poplar",
  [VEG_TREE_6]: "trees.birch",
};

function hasRoadAccess(world: World, tx: number, ty: number): boolean {
  const {width, height} = world.grid;
  const i = world.grid.idx(tx, ty);
  const x = i % width;
  const y = (i - x) / width;
  const roadClass = world.layers.roadClass;
  for (let r = 1; r <= 3; r++) {
    if (x - r >= 0 && roadClass[i - r] !== ROAD_NONE) return true;
    if (x + r < width && roadClass[i + r] !== ROAD_NONE) return true;
    if (y - r >= 0 && roadClass[i - r * width] !== ROAD_NONE) return true;
    if (y + r < height && roadClass[i + r * width] !== ROAD_NONE) return true;
  }
  return false;
}

function analyzeZone(
  world: World,
  tx: number,
  ty: number,
): {level: number; maxLevel: number; reqs: Req[]} {
  const i = world.grid.idx(tx, ty);
  const dev = world.layers.devLevel[i];
  const zone = world.layers.zone[i];
  const maxLevel = BALANCE.growth.maxLevel;

  if (dev >= maxLevel) return {level: dev, maxLevel, reqs: []};

  const power = world.layers.power[i] !== 0;
  const water = world.layers.water[i] !== 0;
  const sewage = world.layers.sewage[i] !== 0;
  const services = world.layers.services[i] !== 0;
  const education = world.layers.education[i];
  const pollution = world.layers.pollution[i];
  const crime = world.layers.crime[i];
  const road = hasRoadAccess(world, tx, ty);

  const hasPowerSurplus = world.stats.powerSupply >= world.stats.powerDemand;
  const hasWaterSurplus = world.stats.waterSupply >= world.stats.waterDemand;
  const hasSewageSurplus = world.stats.sewageSupply >= world.stats.sewageDemand;

  const reqs: Req[] = [];

  reqs.push({label: t("ui.tileInfo.roadAccess"), met: road});
  reqs.push({label: t("ui.tileInfo.powerCoverage"), met: power});
  reqs.push({label: t("ui.tileInfo.waterCoverage"), met: water});

  if (dev >= 1) {
    reqs.push({label: t("ui.tileInfo.powerSurplus"), met: hasPowerSurplus});
    reqs.push({label: t("ui.tileInfo.waterSurplus"), met: hasWaterSurplus});
  }
  if (dev >= 2) {
    reqs.push({label: t("ui.tileInfo.sewageCoverage"), met: sewage});
    reqs.push({label: t("ui.tileInfo.sewageSurplus"), met: hasSewageSurplus});
    reqs.push({label: t("ui.tileInfo.servicesCoverage"), met: services});
    if (zone === ZONE_R) {
      reqs.push({
        label: t("ui.tileInfo.eduLevel", {
          value: education,
          threshold: BALANCE.education.growthThreshold,
        }),
        met: education >= BALANCE.education.growthThreshold,
      });
    }
  }
  if (zone === ZONE_R) {
    const sickness = world.layers.sickness[i];
    reqs.push({
      label: t("ui.tileInfo.sickBelowThreshold", {
        value: sickness,
        threshold: BALANCE.healthcare.growthThreshold,
      }),
      met: sickness <= BALANCE.healthcare.growthThreshold,
    });
  }
  if (zone !== ZONE_I) {
    reqs.push({
      label: t("ui.tileInfo.pollBelowThreshold", {
        value: pollution,
        threshold: BALANCE.pollution.growthThreshold,
      }),
      met: pollution <= BALANCE.pollution.growthThreshold,
    });
    reqs.push({
      label: t("ui.tileInfo.crimeBelowThreshold", {
        value: crime,
        threshold: BALANCE.crime.growthThreshold,
      }),
      met: crime <= BALANCE.crime.growthThreshold,
    });
  }

  return {level: dev, maxLevel, reqs};
}

function isBuildingConnected(world: World, tx: number, ty: number): boolean {
  const {width, height} = world.grid;
  const roadClass = world.layers.roadClass;
  for (const [dx, dy] of [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ] as const) {
    const nx = tx + dx,
      ny = ty + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
    if (roadClass[ny * width + nx] !== ROAD_NONE) return true;
  }
  return false;
}

export class TileInfoPanel {
  private readonly el: HTMLElement;
  private visible = false;

  constructor() {
    this.el = document.getElementById("tile-info")!;
  }

  setVisible(v: boolean): void {
    this.visible = v;
    if (!v) this.el.classList.add("hidden");
  }

  update(world: World, tile: {tx: number; ty: number} | null): void {
    if (!this.visible) return;
    if (!tile || !world.grid.inBounds(tile.tx, tile.ty)) {
      this.el.classList.add("hidden");
      return;
    }
    this.el.classList.remove("hidden");
    this._render(world, tile.tx, tile.ty);
  }

  private _render(world: World, tx: number, ty: number): void {
    const i = world.grid.idx(tx, ty);
    const terrain = world.layers.terrain[i];
    const zone = world.layers.zone[i];
    const road = world.layers.roadClass[i];
    const building = world.layers.building[i];
    const vegetation = world.layers.vegetation[i];
    const dev = world.layers.devLevel[i];
    const pollution = world.layers.pollution[i];
    const crime = world.layers.crime[i];
    const fireRisk = world.layers.fireRisk[i];
    const fire = world.layers.fire[i];
    const distress = world.layers.distress[i];

    let html = `<div class="ti-coord">${t("ui.tileInfo.coords", {tx, ty})}</div>`;

    // ── Building tile ──────────────────────────────────────────────────────────
    if (building !== 0) {
      const name = BUILDING_NAME[building]
        ? t(BUILDING_NAME[building])
        : `${t("buildings.building")} #${building}`;
      html += `<div class="ti-type">${name}</div>`;
      // Show coverage radius for service buildings
      if (building >= BUILDING_POLICE) {
        const range = BALANCE.service.coverageRange[building];
        html += `<div class="ti-detail">${t("ui.tileInfo.coverageRadius", {range})}</div>`;
        html += `<div class="ti-detail">${t("ui.tileInfo.maintenance", {amount: BALANCE.buildings[building]?.maintenance ?? 0})}</div>`;
      }
      if (building === BUILDING_POWER_PLANT) {
        html += `<div class="ti-detail">${t("ui.tileInfo.output", {amount: BALANCE.power.plantOutput})}</div>`;
      }
      if (building === BUILDING_WATER_TOWER) {
        html += `<div class="ti-detail">${t("ui.tileInfo.output", {amount: BALANCE.water.towerOutput})}</div>`;
      }
      if (building === BUILDING_SEWAGE_PLANT) {
        html += `<div class="ti-detail">${t("ui.tileInfo.capacity", {amount: BALANCE.sewage.plantOutput})}</div>`;
      }

      // Connectivity warning for utilities
      if (
        building <= BUILDING_SEWAGE_PLANT &&
        !isBuildingConnected(world, tx, ty)
      ) {
        html += `<div class="ti-detail" style="color:#e55;font-weight:bold;margin-top:4px">${t("ui.tileInfo.notConnected")}</div>`;
      }

      if (fire > 0) {
        html += `<div class="ti-detail" style="color:#f60;font-weight:bold">${t("common.onFire")} ${t("common.ticksLeft", {ticks: fire})}</div>`;
      }

      // ── Road tile ──────────────────────────────────────────────────────────────
    } else if (road !== ROAD_NONE) {
      const netId = world.layers.roadNet[i];
      const cong = world.layers.congestion[i];
      const congPct = Math.round((cong / 255) * 100);
      const congKey =
        cong < 30
          ? "congestion.free"
          : cong < 85
            ? "congestion.light"
            : cong < 140
              ? "congestion.moderate"
              : cong < 200
                ? "congestion.heavy"
                : "congestion.gridlock";
      const congLabel = t(congKey);
      const congColor =
        cong < 30
          ? "#5c5"
          : cong < 85
            ? "#9c5"
            : cong < 140
              ? "#cc5"
              : cong < 200
                ? "#e95"
                : "#e55";
      const roadKey =
        road === ROAD_STREET
          ? "roads.street"
          : road === ROAD_AVENUE
            ? "roads.avenue"
            : "roads.highway";
      html += `<div class="ti-type">${t(roadKey)}</div>`;
      html += `<div class="ti-detail">${t("ui.tileInfo.network", {id: netId})}</div>`;
      html += `<div class="ti-detail" style="color:${congColor}">${t("ui.tileInfo.congestion", {label: congLabel, pct: congPct})}</div>`;
      if (cong > 0) {
        const penalty = Math.round(
          (cong / 255) * BALANCE.transit.congestionGrowthPenalty * 100,
        );
        html += `<div class="ti-detail" style="color:#999">${t("ui.tileInfo.growthPenalty", {penalty})}</div>`;
      }
      if (fire > 0) {
        html += `<div class="ti-detail" style="color:#f60;font-weight:bold">${t("common.onFire")}</div>`;
      }

      // ── Water terrain ──────────────────────────────────────────────────────────
    } else if (terrain === TERRAIN_WATER) {
      html += `<div class="ti-type">${t("terrain.water")}</div>`;
      html += `<div class="ti-note">${t("ui.tileInfo.notBuildable")}</div>`;

      // ── Zone tile ──────────────────────────────────────────────────────────────
    } else if (zone !== ZONE_NONE) {
      const zoneName = ZONE_NAME[zone] ? t(ZONE_NAME[zone]) : t("zones.zone");
      const dots = "●".repeat(dev) + "○".repeat(BALANCE.growth.maxLevel - dev);
      const isAbandoned = world.layers.abandoned[i] !== 0;
      html += `<div class="ti-type">${zoneName} <span class="ti-dots">${dots}</span> Lv ${dev}/${BALANCE.growth.maxLevel}${isAbandoned ? ` <span style="color:#e84;font-weight:bold">${t("ui.tileInfo.abandoned")}</span>` : ""}</div>`;

      if (fire > 0) {
        html += `<div class="ti-detail" style="color:#f60;font-weight:bold">${t("common.onFire")} ${t("common.ticksLeft", {ticks: fire})}</div>`;
      }

      if (isAbandoned) {
        html += `<div class="ti-detail" style="color:#e84">${t("ui.tileInfo.growthBlockedAbandoned")}</div>`;
      } else {
        const distress = world.layers.distress[i];
        if (distress > 0) {
          const threshold = BALANCE.abandonment.abandonThreshold;
          html += `<div class="ti-detail" style="color:#cc5">${t("ui.tileInfo.distress", {distress, threshold})}</div>`;
        }
      }

      const landValue = world.layers.landValue[i];
      const lvKey =
        landValue < 60
          ? "landValue.low"
          : landValue < 110
            ? "landValue.medium"
            : landValue < 160
              ? "landValue.good"
              : "landValue.prime";
      const lvLabel = t(lvKey);
      html += `<div class="ti-detail">${t("ui.tileInfo.landValue", {value: landValue, label: lvLabel})}</div>`;

      if (pollution > 0) {
        const pKey =
          pollution < 40
            ? "common.low"
            : pollution < 100
              ? "common.medium"
              : "common.high";
        const pLabel = t(pKey);
        html += `<div class="ti-detail ti-poll">${t("ui.tileInfo.pollution", {value: pollution, label: pLabel})}</div>`;
      }

      if (crime > 0) {
        const cKey =
          crime < 40
            ? "common.low"
            : crime < 100
              ? "common.medium"
              : "common.high";
        const cLabel = t(cKey);
        html += `<div class="ti-detail" style="color:#e55">${t("ui.tileInfo.crime", {value: crime, label: cLabel})}</div>`;
      }

      if (zone === ZONE_R) {
        const edu = world.layers.education[i];
        const eduKey =
          edu < 50
            ? "education.uneducated"
            : edu < 120
              ? "education.basic"
              : edu < 200
                ? "education.educated"
                : "education.highlyEducated";
        const eduLabel = t(eduKey);
        html += `<div class="ti-detail" style="color:#5cf">${t("ui.tileInfo.education", {value: edu, label: eduLabel})}</div>`;

        const sick = world.layers.sickness[i];
        if (sick > 0) {
          const sickKey =
            sick < 80
              ? "sickness.mild"
              : sick < 160
                ? "sickness.moderate"
                : "sickness.severe";
          const sickLabel = t(sickKey);
          const sickColor = sick < 80 ? "#5cc" : sick < 160 ? "#fc0" : "#f55";
          html += `<div class="ti-detail" style="color:${sickColor}">${t("ui.tileInfo.sickness", {value: sick, label: sickLabel})}${!world.layers.hospital[i] ? t("sickness.noHospital") : ""}</div>`;
        }

        const rd = world.layers.recentDeath[i];
        if (rd > 0) {
          html += `<div class="ti-detail" style="color:#ccd;font-weight:bold">${t("ui.tileInfo.recentDeath", {ticks: rd})}</div>`;
        }
      }

      if (fireRisk > 0) {
        const fKey =
          fireRisk < 40
            ? "common.low"
            : fireRisk < 100
              ? "common.medium"
              : "common.high";
        const fLabel = t(fKey);
        html += `<div class="ti-detail" style="color:#f80">${t("ui.tileInfo.fireRisk", {value: fireRisk, label: fLabel})}</div>`;
      }

      // Demand and tax display
      const demand =
        zone === ZONE_R
          ? world.stats.rDemand
          : zone === ZONE_C
            ? world.stats.cDemand
            : world.stats.iDemand;
      const demandColor =
        demand >= 1.2 ? "#5c5" : demand >= 0.8 ? "#cc5" : "#e55";
      html += `<div class="ti-detail" style="color:${demandColor}">${t("ui.tileInfo.demand", {value: demand.toFixed(2)})}</div>`;

      const neutralRate =
        zone === ZONE_R
          ? BALANCE.tax.zoneR
          : zone === ZONE_C
            ? BALANCE.tax.zoneC
            : BALANCE.tax.zoneI;
      const currentRate =
        zone === ZONE_R
          ? world.budget.taxRates.R
          : zone === ZONE_C
            ? world.budget.taxRates.C
            : world.budget.taxRates.I;
      const taxMult = Math.max(
        BALANCE.demand.min,
        Math.min(BALANCE.demand.max, neutralRate / currentRate),
      );
      const taxDelta = Math.round((taxMult - 1) * 100);
      const taxColor = taxDelta >= 0 ? "#5c5" : "#e55";
      const taxSign = taxDelta >= 0 ? "+" : "";
      html += `<div class="ti-detail" style="color:${taxColor}">${t("ui.tileInfo.taxRate", {rate: currentRate.toFixed(1), sign: taxSign, delta: taxDelta})}</div>`;

      const {reqs, maxLevel} = analyzeZone(world, tx, ty);

      if (isAbandoned) {
        html += `<div class="ti-growth-header" style="color:#e84">${t("ui.tileInfo.growthBlockedAbandoned")}</div>`;
      } else if (dev >= maxLevel) {
        html += `<div class="ti-growth-ok">${t("ui.tileInfo.fullyDeveloped")}</div>`;
      } else {
        html += `<div class="ti-growth-header">${t("ui.tileInfo.toReachLevel", {level: dev + 1})}</div>`;
        for (const req of reqs) {
          const icon = req.met
            ? `<span class="ti-yes">${t("common.yes")}</span>`
            : `<span class="ti-no">${t("common.no")}</span>`;
          html += `<div class="ti-req">${icon} ${req.label}</div>`;
        }
        const allMet = reqs.every((r) => r.met);
        if (allMet) {
          const effectivePct = Math.round(
            BALANCE.growth.probability * demand * 100,
          );
          html += `<div class="ti-growth-ok">${t("ui.tileInfo.allMetGrowing", {pct: effectivePct})}</div>`;
        }
      }

      // ── Empty tile ─────────────────────────────────────────────────────────────
    } else {
      const terrainName = TERRAIN_NAME[terrain]
        ? t(TERRAIN_NAME[terrain])
        : t("terrain.unknown");
      if (vegetation !== VEG_NONE) {
        const treeName = TREE_SPECIES[vegetation]
          ? t(TREE_SPECIES[vegetation])
          : t("trees.trees");
        html += `<div class="ti-type">${treeName}</div>`;
        html += `<div class="ti-detail" style="color:#5c5">${t("ui.tileInfo.improvesAirQuality")}</div>`;
        html += `<div class="ti-detail">${t("ui.tileInfo.terrain", {terrain: terrainName})}</div>`;
      } else {
        html += `<div class="ti-type">${terrainName}</div>`;
        html += `<div class="ti-note">${t("ui.tileInfo.noZone")}</div>`;
      }
    }

    this.el.innerHTML = html;
  }
}
