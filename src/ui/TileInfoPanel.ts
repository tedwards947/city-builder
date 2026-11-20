// Tile info panel — shown when the 'inspect' tool is active.
// Displays terrain, zone, development level, coverage status, and a clear
// breakdown of what's blocking the next level of growth.

import { RAIL_GROUND, RAIL_ELEVATED, RAIL_SUBWAY, RAIL_SURFACE } from '../sim/constants';
import { railLinks, stationGrowthMask, stationPeak } from '../sim/rail';
import { railCapacity, railLoad, railVolume } from '../sim/TrafficData';
import { buildingSeats, homeSeat, hasCapacity } from '../sim/serviceCapacity';
import { seatWords, seatsView, homeSeatState } from './capacityFormat';
import { BUILDING_LARGE_POWER_PLANT, BUILDING_LARGE_WATER_PLANT, BUILDING_LARGE_SEWAGE_PLANT, BUILDING_SEAPORT, BUILDING_AIRPORT, BUILDING_STATION, BUILDING_STATION_L, BUILDING_RAMP_ELEVATED, BUILDING_RAMP_SUBWAY, BUILDING_SUBWAY_STATION } from '../sim/constants';
import { buildingTripsAt } from '../sim/buildingTraffic';
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
  ROAD_AVENUE,
  ROAD_HIGHWAY,
  ROAD_STREET,
  VEG_NONE,
  VEG_TREE_1,
  VEG_TREE_2,
  VEG_TREE_3,
  VEG_TREE_4,
  VEG_TREE_5,
  VEG_TREE_6,
  BUILDING_POWER_PLANT,
  BUILDING_WATER_TOWER,
  BUILDING_SEWAGE_PLANT,
  BUILDING_POLICE,
  BUILDING_FIRE,
  BUILDING_SCHOOL,
  BUILDING_HOSPITAL,
  BUILDING_PARK,
} from "../sim/constants";
import {BALANCE} from "../data/balance";
import {buildingUpkeep} from "../sim/serviceValue";
import {taxDemandMult} from "../sim/tax";
import {t} from "../i18n";
import {DEBUG} from "../debug";
import {trafficDebugHtml} from "./trafficDebug";
import {lotProblems, PROBLEM_COLOUR} from "../render/clay/problemPins";
import {lotTrips, tripGrade, TRIP_COLOUR} from "../render/clay/commuteRoute";
import {pcQuote} from "../sim/politics";
import {developedYears, isEstablished, establishedAfterYears} from "../sim/established";
import {PC_SYMBOL, pcAmount} from "./pcFormat";

/** The lot's problems as chips, in the colours of the map badges ('' if it has none). */
function problemChips(world: World, i: number): string {
  const chips = lotProblems(world, i).map((kind) =>
    `<span style="display:inline-block;margin:0 4px 4px 0;padding:0 8px;border-radius:999px;background:${PROBLEM_COLOUR[kind]};color:#fff;font-size:11px;font-weight:600">${t(`ui.badge.${kind}.name`)}</span>`);
  return chips.length ? `<div>${chips.join("")}</div>` : "";
}

/** How far the lot's trips are, each as a bar against the commute limit ('' before the first traffic pass). */
/**
 * What demolishing the thing on this tile would cost in political capital:
 * closing a service, or displacing the residents of a home. Empty if nothing.
 */
function pcRows(world: World, tx: number, ty: number): string {
  const q = pcQuote(world, {type: "bulldoze", tx, ty});
  if (q.cost <= 0) return "";
  const pc = `<span style="color:${q.affordable ? "#7dd8c0" : "#e07070"};font-weight:600">${PC_SYMBOL} ${pcAmount(q.cost)}</span>`;
  const closing = q.parts.some(p => p.reason === "serviceClosed");
  const line = closing
    ? t(q.shortfall > 0 ? "ui.tileInfo.pcCloseLast" : "ui.tileInfo.pcClose", {pc})
    : t("ui.tileInfo.pcDisplace", {n: q.displacedPopulation, pc});
  return `<div class="ti-growth-header">${t("ui.tileInfo.pcHeader")}</div><div class="ti-detail">${line}</div>`;
}

/**
 * How long a lot has stood, once that matters: an established neighbourhood
 * is one Heritage Protection covers. Empty while the feature is off
 * (threshold 0) or the lot has no history yet.
 */
export function establishedRow(world: World, i: number): string {
  const after = establishedAfterYears();
  const years = Math.floor(developedYears(world, i));
  if (after <= 0 || years <= 0) return "";
  return isEstablished(world, i)
    ? `<div class="ti-detail" style="color:#d9c08a">${t("ui.tileInfo.established", {n: years})}</div>`
    : `<div class="ti-detail" style="color:#9ab">${t("ui.tileInfo.developedFor", {n: years, after})}</div>`;
}

function tripRows(world: World, i: number): string {
  const trips = lotTrips(world, i);
  if (!trips.length) return "";
  const limit = BALANCE.transit.commuteMax;
  const label = {jobs: "ui.tileInfo.tripJobs", shops: "ui.tileInfo.tripShops", customers: "ui.tileInfo.tripCustomers", workers: "ui.tileInfo.tripWorkers"} as const;
  let html = "";
  for (const trip of trips) {
    const reached = trip.time < limit;
    const colour = reached ? TRIP_COLOUR[tripGrade(trip.time)] : TRIP_COLOUR[2];
    const value = trip.time < Infinity ? `${Math.round(trip.time)} / ${limit}` : t("ui.tileInfo.tripNone");
    const width = reached ? Math.max(4, Math.round(trip.time / limit * 100)) : 100;
    html += `<div class="ti-detail" style="display:flex;justify-content:space-between;gap:10px"><span>${t(label[trip.key])}</span><span style="color:${colour};font-weight:600">${value}</span></div>`
      + `<div style="height:5px;border-radius:3px;background:#3a414d;margin:1px 0 3px"><div style="height:100%;width:${width}%;border-radius:3px;background:${colour}"></div></div>`;
  }
  const T = BALANCE.transit;
  const mult = T.accessFloor + (1 - T.accessFloor) * (world.layers.accessibility[i] / 255);
  if (world.layers.devLevel[i] > 0 && mult < 0.9) {
    html += `<div class="ti-detail" style="color:#f0b04c">${t("ui.tileInfo.tripGrowth", {pct: Math.round(mult * 100)})}</div>`;
  }
  return html;
}

interface Req {
  label: string;
  met: boolean;
}

const ZONE_NAME: Record<number, string> = {
  [ZONE_R]: "zones.residential",
  [ZONE_C]: "zones.commercial",
  [ZONE_I]: "zones.industrial",
};

// The seaport is listed here for its upkeep line and its road warning, like the large plants.
const isLargeUtility = (b: number) => b === BUILDING_LARGE_POWER_PLANT || b === BUILDING_LARGE_WATER_PLANT || b === BUILDING_LARGE_SEWAGE_PLANT || b === BUILDING_SEAPORT;
export const BUILDING_NAME: Record<number, string> = {
  [BUILDING_POWER_PLANT]: "buildings.powerPlant",
  [BUILDING_WATER_TOWER]: "buildings.waterTower",
  [BUILDING_SEWAGE_PLANT]: "buildings.sewagePlant",
  [BUILDING_SEAPORT]: "buildings.seaport",
  [BUILDING_AIRPORT]: "buildings.airport",
  [BUILDING_STATION]: "buildings.station",
  [BUILDING_STATION_L]: "buildings.station",
  [BUILDING_RAMP_ELEVATED]: "buildings.rampElevated",
  [BUILDING_RAMP_SUBWAY]: "buildings.rampSubway",
  [BUILDING_SUBWAY_STATION]: "buildings.subwayStation",
  [BUILDING_LARGE_POWER_PLANT]: "buildings.largePowerPlant",
  [BUILDING_LARGE_WATER_PLANT]: "buildings.largeWaterPlant",
  [BUILDING_LARGE_SEWAGE_PLANT]: "buildings.largeSewagePlant",
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
  const {width} = world.grid;
  const roadClass = world.layers.roadClass;
  const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;
  for (const [dx, dy] of neighbors) {
    const nx = tx + dx, ny = ty + dy;
    if (world.grid.inBounds(nx, ny)) {
      const rc = roadClass[ny * width + nx];
      if (rc !== ROAD_NONE && rc !== ROAD_HIGHWAY) return true;
    }
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

/**
 * The airport: what it does, then (with a road to its terminal) passengers
 * this tick against its seats, what they earn, the arrivals it sends into the
 * city and the boost to shops; without one, the warning. Upkeep either way.
 */
function airportRows(world: World, tx: number, ty: number): string {
  const trips = buildingTripsAt(world, tx, ty), row = BALANCE.transit.buildings[BUILDING_AIRPORT];
  let html = `<div class="ti-detail">${t("ui.tileInfo.airportAbout")}</div>`;
  if (!trips?.connected) html += `<div class="ti-detail" style="color:#e55;font-weight:bold;margin-top:4px">${t("ui.tileInfo.airportNoRoad")}</div>`;
  else {
    const pax = trips.takes.find((m) => m.market === "visitors");
    if (pax) {
      const fill = pax.capacity > 0 ? Math.min(1, pax.trips / pax.capacity) : 0;
      html += `<div class="ti-detail ti-seats"><span>${t("ui.tileInfo.airportPassengers")}</span><b>${t("ui.tileInfo.airportPerTick", {n: Math.round(pax.trips).toLocaleString("en-US"), cap: pax.capacity.toLocaleString("en-US")})}</b></div>`;
      html += `<div class="ti-meter"><span style="width:${(fill * 100).toFixed(1)}%"></span></div>`;
    }
    if (trips.income > 0) html += `<div class="ti-detail">${t("ui.tileInfo.airportEarns", {amount: Math.round(trips.income).toLocaleString("en-US")})}</div>`;
    const sent = (k: string) => Math.round(trips.sends.find((m) => m.market === k)?.trips ?? 0);
    if (trips.sends.length > 0) html += `<div class="ti-detail">${t("ui.tileInfo.airportArrivals", {shops: sent("shopping"), jobs: sent("jobs")})}</div>`;
    const boost = row?.demandMult?.C ?? 1;
    if (boost > 1) html += `<div class="ti-detail">${t("ui.tileInfo.airportDemand", {pct: Math.round((boost - 1) * 100)})}</div>`;
  }
  return html + `<div class="ti-detail">${t("ui.tileInfo.maintenance", {amount: BALANCE.buildings[BUILDING_AIRPORT]?.maintenance ?? 0})}</div>`;
}

/** Notes for the track on other levels of a tile: elevated overhead (unless it is the heading already) and a subway underneath. */
function otherLevelRows(world: World, i: number, elevatedShown = false): string {
  const r = world.layers.rail[i];
  let html = "";
  if (!elevatedShown && (r & RAIL_ELEVATED) !== 0) html += `<div class="ti-detail" style="margin-top:4px">${t("ui.tileInfo.railElevatedOver")}</div>` + railRows(world, i, RAIL_ELEVATED);
  if ((r & RAIL_SUBWAY) !== 0) html += `<div class="ti-detail" style="margin-top:4px">${t("ui.tileInfo.railSubwayUnder")}</div>` + railRows(world, i, RAIL_SUBWAY);
  return html;
}

/** A track tile: riders against capacity (red when over), and a note on a junction. */
function railRows(world: World, i: number, level: number = RAIL_GROUND): string {
  const d = world.traffic;
  let html = "";
  const cap = d ? railCapacity(d, i, level) : 0;
  if (d && cap > 0) {
    const load = railLoad(d, i, level);
    const color = load < 0.5 ? "#5c5" : load < 1 ? "#cc5" : "#e55";
    html += `<div class="ti-detail" style="color:${color}">${t("ui.tileInfo.railRiders", {n: Math.round(railVolume(d, i, level)).toLocaleString("en-US"), cap: Math.round(cap).toLocaleString("en-US")})}</div>`;
  }
  const links = railLinks(world, i, level);
  const joined = (links & 1) + ((links >> 1) & 1) + ((links >> 2) & 1) + ((links >> 3) & 1);
  if (joined === 3) html += `<div class="ti-detail">${t("ui.tileInfo.railJunction3")}</div>`;
  if (joined === 4) html += `<div class="ti-detail">${t("ui.tileInfo.railJunction4")}</div>`;
  return html;
}

/** A train station: what it does, then riders boarding and fares, or the warning that it has no road. Upkeep either way. */
function stationRows(world: World, tx: number, ty: number, kind: number): string {
  const i = world.grid.idx(tx, ty);
  let html = `<div class="ti-detail">${t("ui.tileInfo.stationAbout")}</div>`;
  if (world.buildingAccessRoads(tx, ty).length === 0) {
    html += `<div class="ti-detail" style="color:#e55;font-weight:bold;margin-top:4px">${t("ui.tileInfo.stationNoRoad")}</div>`;
  } else {
    const anchor = world.buildingAnchorAt(i);
    const boardings = world.traffic?.rail.stations.find((s) => s.anchor === anchor)?.boardings ?? 0;
    html += `<div class="ti-detail">${t("ui.tileInfo.stationBoardings", {n: Math.round(boardings).toLocaleString("en-US")})}</div>`;
    const fares = boardings * BALANCE.rail.fare;
    if (fares > 0) html += `<div class="ti-detail">${t("ui.tileInfo.stationEarns", {amount: Math.round(fares).toLocaleString("en-US")})}</div>`;
  }
  // Riders on its track: the busiest platform tile, whichever tile was clicked. (Riders get on
  // and off at one platform tile, so the others can be empty at a station that is working.)
  const peak = stationPeak(world, tx, ty);
  if (peak) html += railRows(world, peak.tile, peak.level);
  return html + `<div class="ti-detail">${t("ui.tileInfo.maintenance", {amount: BALANCE.buildings[kind]?.maintenance ?? 0})}</div>`;
}

/** A street or avenue beside any tile of the building at (tx, ty). */
function isBuildingConnected(world: World, tx: number, ty: number): boolean {
  // A street or avenue along the building's body; a seaport's docks do not count.
  return world.buildingAccessRoads(tx, ty).length > 0;
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

    let html = `<div class="ti-coord">${t("ui.tileInfo.coords", {tx, ty})}</div>`;

    // ── Building tile ──────────────────────────────────────────────────────────
    if (building !== 0) {
      const name = BUILDING_NAME[building]
        ? t(BUILDING_NAME[building])
        : `${t("buildings.building")} #${building}`;
      html += `<div class="ti-type">${name}</div>`;
      // Show coverage radius for service buildings
      if (building >= BUILDING_POLICE && BALANCE.service.coverageRange[building] !== undefined) {
        const range = BALANCE.service.coverageRange[building];
        html += `<div class="ti-detail">${t("ui.tileInfo.coverageRadius", {range})}</div>`;
        html += `<div class="ti-detail">${t("ui.tileInfo.maintenance", {amount: buildingUpkeep(building)})}</div>`;
      }
      // Schools and hospitals serve a limited number of residents: seats (or beds) taken, a bar, and who is left out.
      const seats = hasCapacity(building) ? buildingSeats(world, tx, ty) : null;
      const sv = seats ? seatsView(seats) : null;
      if (sv) {
        const w = seatWords(building), tone = sv.full ? ' full' : '';
        html += `<div class="ti-detail ti-seats${tone}"><span>${t(w + ".label")}${sv.full ? ` <i>${t("ui.capacity.full")}</i>` : ""}</span><b>${sv.figure}</b></div>`;
        html += `<div class="ti-meter${tone}"><span style="width:${(sv.fill * 100).toFixed(1)}%"></span></div>`;
        if (!sv.full) html += `<div class="ti-detail">${t(w + ".free", {n: sv.free.toLocaleString("en-US")})}</div>`;
        if (sv.leftOut > 0) html += `<div class="ti-detail ti-seats full">${t(w + ".leftOut", {n: sv.leftOut.toLocaleString("en-US")})}</div>`;
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
      // The large plants (several tiles): the same lines from any of their tiles.
      if (building === BUILDING_LARGE_POWER_PLANT) html += `<div class="ti-detail">${t("ui.tileInfo.output", {amount: BALANCE.power.largePlantOutput})}</div>`;
      if (building === BUILDING_LARGE_WATER_PLANT) html += `<div class="ti-detail">${t("ui.tileInfo.output", {amount: BALANCE.water.largePlantOutput})}</div>`;
      if (building === BUILDING_LARGE_SEWAGE_PLANT) html += `<div class="ti-detail">${t("ui.tileInfo.capacity", {amount: BALANCE.sewage.largePlantOutput})}</div>`;
      if (isLargeUtility(building)) html += `<div class="ti-detail">${t("ui.tileInfo.maintenance", {amount: BALANCE.buildings[building]?.maintenance ?? 0})}</div>`;
      if (building === BUILDING_AIRPORT) html += airportRows(world, tx, ty);
      if (building === BUILDING_STATION || building === BUILDING_STATION_L || building === BUILDING_SUBWAY_STATION) html += stationRows(world, tx, ty, building);

      // Connectivity warning for utilities
      if (
        (building <= BUILDING_SEWAGE_PLANT || isLargeUtility(building)) &&
        !isBuildingConnected(world, tx, ty)
      ) {
        html += `<div class="ti-detail" style="color:#e55;font-weight:bold;margin-top:4px">${t("ui.tileInfo.notConnected")}</div>`;
      }

      if (fire > 0) {
        html += `<div class="ti-detail" style="color:#f60;font-weight:bold">${t("common.onFire")} ${t("common.ticksLeft", {ticks: fire})}</div>`;
      }
      html += pcRows(world, tx, ty);

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
      if ((world.layers.rail[i] & RAIL_GROUND) !== 0) {
        html += `<div class="ti-detail">${t("ui.tileInfo.railCrossing")}</div>`;
        html += railRows(world, i);
      }
      if (fire > 0) {
        html += `<div class="ti-detail" style="color:#f60;font-weight:bold">${t("common.onFire")}</div>`;
      }

      // ── Rail track (also over water: a bridge) ─────────────────────────────────
    } else if ((world.layers.rail[i] & RAIL_SURFACE) !== 0) {
      const ground = (world.layers.rail[i] & RAIL_GROUND) !== 0;
      html += `<div class="ti-type">${t(ground ? "ui.tileInfo.railTrack" : "ui.tileInfo.railElevated")}</div>`;
      html += railRows(world, i, ground ? RAIL_GROUND : RAIL_ELEVATED);

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
      html += problemChips(world, i);
      html += establishedRow(world, i);
      html += pcRows(world, tx, ty);

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
        // A place at the school and the hospital: has one, or why not (full vs. out of reach: bigger vs. closer).
        for (const kind of [BUILDING_SCHOOL, BUILDING_HOSPITAL]) {
          const seat = hasCapacity(kind) ? homeSeat(world, tx, ty, kind) : null;
          if (!seat) continue;
          const state = homeSeatState(seat), key = state === "full" ? "fullState" : state;
          const color = state === "has" ? "#7dd87d" : state === "full" ? "#e0b050" : "#e07070";
          html += `<div class="ti-detail">${t(BUILDING_NAME[kind])}: <span style="color:${color}">${t(seatWords(kind) + "." + key)}</span></div>`;
        }
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
        Math.min(BALANCE.demand.max, neutralRate / currentRate * taxDemandMult(world.budget.taxLevel)),
      );
      const taxDelta = Math.round((taxMult - 1) * 100);
      const taxColor = taxDelta >= 0 ? "#5c5" : "#e55";
      const taxSign = taxDelta >= 0 ? "+" : "";
      html += `<div class="ti-detail" style="color:${taxColor}">${t("ui.tileInfo.taxRate", {rate: currentRate.toFixed(1), sign: taxSign, delta: taxDelta})}</div>`;

      if (!isAbandoned) html += tripRows(world, i);

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
            (zone === ZONE_R
              ? (BALANCE.growth.homeProbabilityByLevel[dev] ?? BALANCE.growth.probability)
              : BALANCE.growth.probability) * demand * 100,
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

    // Track on the other levels of the tile, whatever stands on it: elevated overhead, a subway underneath.
    {
      const L = world.layers;
      // A home or shop near a station that has a road and riders grows faster.
      if ((L.zone[i] === ZONE_R || L.zone[i] === ZONE_C) && stationGrowthMask(world)?.[i] === 1) {
        html += `<div class="ti-detail" style="color:#5c5">${t("ui.tileInfo.nearStation", {pct: Math.round((BALANCE.rail.stationGrowth.mult - 1) * 100)})}</div>`;
      }
      const elevatedIsHeading = L.building[i] === 0 && L.roadClass[i] === 0 && (L.rail[i] & RAIL_SURFACE) === RAIL_ELEVATED;
      // A subway station's own rows already show its platform's riders.
      if (L.building[i] !== BUILDING_SUBWAY_STATION) html += otherLevelRows(world, i, elevatedIsHeading);
    }

    if (DEBUG) html += trafficDebugHtml(world, i);

    this.el.innerHTML = html;
  }
}
