// Tile info panel — shown when the 'inspect' tool is active.
// Displays terrain, zone, development level, coverage status, and a clear
// breakdown of what's blocking the next level of growth.

import { RAIL_GROUND, RAIL_ELEVATED, RAIL_SUBWAY, RAIL_SURFACE } from '../sim/constants';
import { railLinks, stationGrowthMask, stationPeak } from '../sim/rail';
import { transitIsFree } from '../sim/ordinances';
import { connectionTradeAt } from '../sim/connectionTraffic';
import { railCapacity, railLoad, railVolume } from '../sim/TrafficData';
import { buildingSeats, homeSeat, hasCapacity } from '../sim/serviceCapacity';
import { seatWords, seatsView, homeSeatState } from './capacityFormat';
import { BUILDING_SEWAGE_WORKS, BUILDING_WATERWORKS, BUILDING_FIRE_HQ, BUILDING_POLICE_HQ, BUILDING_GENERAL_HOSPITAL, BUILDING_NUCLEAR_PLANT, BUILDING_UNIVERSITY } from '../sim/constants';
import { BUILDING_MID_PARK, BUILDING_BIG_PARK, BUILDING_BEACH_PARK, BUILDING_LIDO, BUILDING_PLAZA, BUILDING_MUSEUM, BUILDING_STADIUM } from '../sim/constants';
import { BUILDING_LARGE_POWER_PLANT, BUILDING_LARGE_WATER_PLANT, BUILDING_LARGE_SEWAGE_PLANT, BUILDING_SEAPORT, BUILDING_AIRPORT, BUILDING_STATION, BUILDING_STATION_L, BUILDING_STATION_ELEVATED, BUILDING_RAMP_ELEVATED, BUILDING_RAMP_SUBWAY, BUILDING_SUBWAY_STATION } from '../sim/constants';
import { headcountCost, perResidentCost, perUnitCost } from '../sim/runningCost';
import type { BuildingEntity } from '../sim/World';
import { overheadPlatform } from '../sim/buildingShapes';
import { capstoneRow, capstoneResidents, isServiceCapstone, isCapstone, serviceRange } from '../sim/capstones';
import { eventStatus } from '../sim/eventDays';
import { attractionAt, hasGateway, lacksLeisure, leisureReachAt } from '../sim/leisureTraffic';
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
import {buildingUpkeep, residentsCoveredBy} from "../sim/serviceValue";
import {taxDemandMult} from "../sim/tax";
import {t} from "../i18n";
import {doorTile, lotSummary} from "../sim/lots";
import {DEBUG} from "../debug";
import {trafficDebugHtml} from "./trafficDebug";
import {lotProblems, PROBLEM_COLOUR} from "../render/clay/problemPins";
import {lotTrips, tripGrade, TRIP_COLOUR} from "../render/clay/commuteRoute";
import {pcQuote, pcCap, regenPerTick} from "../sim/politics";
import {localTrustEnabled, trustCell, cellTrust, cellCap, refillPerTick} from "../sim/localTrust";
import {identityAt} from "../sim/identity";
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
 * closing a service, displacing the residents of a home, or cutting homes off
 * from their last road. Empty if nothing.
 */
function pcRows(world: World, tx: number, ty: number): string {
  const q = pcQuote(world, {type: "bulldoze", tx, ty});
  if (q.cost <= 0) return "";
  const pc = `<span style="color:${q.affordable ? "#7dd8c0" : "#e07070"};font-weight:600">${PC_SYMBOL} ${pcAmount(q.cost)}</span>`;
  const closing = q.parts.some(p => p.reason === "serviceClosed");
  const line = closing
    ? t(q.shortfall > 0 ? "ui.tileInfo.pcCloseLast" : "ui.tileInfo.pcClose", {pc})
    : t(world.layers.roadClass[world.grid.idx(tx, ty)] !== ROAD_NONE ? "ui.tileInfo.pcCutOff" : "ui.tileInfo.pcDisplace", {n: q.displacedPopulation, pc});
  return `<div class="ti-growth-header">${t("ui.tileInfo.pcHeader")}</div><div class="ti-detail">${line}</div>`;
}

/**
 * Debug-only (?debug=true plays the local trust prototype, sim/localTrust.ts): this tile's neighbourhood's
 * trust, its cap, and how long it takes to refill at today's regen. Empty while the prototype is off.
 */
export function trustRow(world: World, tx: number, ty: number): string {
  if (!localTrustEnabled()) return "";
  const cityCap = pcCap(world), cell = trustCell(world, tx, ty);
  const trust = cellTrust(world, cell, cityCap), cap = cellCap(world, cell, cityCap);
  const perDay = refillPerTick(cap, cityCap, regenPerTick(world, world.stats.satisfaction)) * BALANCE.ticksPerDay;
  const n = {trust: Math.round(trust), cap: Math.round(cap)};
  const line = trust >= cap - 0.5 ? t("ui.tileInfo.trustFull", n)
    : perDay > 0 ? t("ui.tileInfo.trustRefills", {...n, days: Math.max(1, Math.ceil((cap - trust) / perDay))})
    : t("ui.tileInfo.trustStuck", n);
  return `<div class="ti-detail" style="color:${trust < 0.25 * cap ? "#e07070" : "#9ab"}">${line}</div>`;
}

/**
 * Debug-only (?debug=true, the neighbourhood identities prototype, sim/identity.ts): the tile's neighbourhood
 * type, where it is drifting, and its raw traits. Empty without ?debug=true or for a cell with too few homes.
 */
export function identityRow(world: World, tx: number, ty: number, show = DEBUG): string {
  if (!show) return "";
  const id = identityAt(world, tx, ty);
  if (!id) return "";
  const type = t(`ui.tileInfo.identityType.${id.type}`);
  const line = id.drift
    ? t("ui.tileInfo.identityDrifting", {type, drift: t(`ui.tileInfo.identityType.${id.drift}`)})
    : t("ui.tileInfo.identity", {type});
  const r = id.raw, f2 = (x: number) => (Math.round(x * 100) / 100).toString();
  const traits = t("ui.tileInfo.identityTraits", {
    density: f2(r.density), wealth: f2(r.wealth), shops: Math.round(r.shops * 100), industry: Math.round(r.industry * 100),
    green: f2(r.green), egalitarian: f2(r.egalitarian), planned: f2(r.planned),
  });
  return `<div class="ti-detail" style="color:#9ab">${line}</div><div class="ti-detail" style="color:#789;font-size:11px">${traits}</div>`;
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
  if (world.layers.zone[i] === ZONE_R && world.layers.devLevel[i] > 0) {
    const label = t("ui.tileInfo.tripLeisure");
    if ((world.traffic?.leisure.field.count ?? 0) > 0) {
      const door = world.layers.lot[i] !== 0 ? doorTile(world, i) : i;
      const reach = Math.max(0, Math.min(1, leisureReachAt(world, i, door)));
      const colour = TRIP_COLOUR[reach > 0.66 ? 0 : reach > 0.33 ? 1 : 2];
      html += `<div class="ti-detail" style="display:flex;justify-content:space-between;gap:10px"><span>${label}</span><span style="color:${colour};font-weight:600">${Math.round(reach * 100)}%</span></div>`
        + `<div style="height:5px;border-radius:3px;background:#3a414d;margin:1px 0 3px"><div style="height:100%;width:${Math.max(4, Math.round(reach * 100))}%;border-radius:3px;background:${colour}"></div></div>`;
    } else {
      html += `<div class="ti-detail" style="display:flex;justify-content:space-between;gap:10px;color:#778"><span>${label}</span><span>${t("ui.tileInfo.tripLeisureNone")}</span></div>`;
    }
    const door = world.layers.lot[i] !== 0 ? doorTile(world, i) : i;
    const strain = world.eventStrain[i], dropAfter = BALANCE.leisure.event.dropAfter;
    if (strain > 0 && dropAfter > 0) html += `<div class="ti-detail" style="color:#f0b04c">${t("ui.tileInfo.eventStrain", {n: strain, max: dropAfter})}</div>`;
    const note = leisureNote(world, i, door);
    if (note) html += `<div class="ti-detail" style="color:#f0b04c">${note}</div>`;
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
  [BUILDING_MID_PARK]: "buildings.midPark",
  [BUILDING_BIG_PARK]: "buildings.bigPark",
  [BUILDING_BEACH_PARK]: "buildings.beachPark",
  [BUILDING_LIDO]: "buildings.lido",
  [BUILDING_PLAZA]: "buildings.plaza",
  [BUILDING_MUSEUM]: "buildings.museum",
  [BUILDING_STADIUM]: "buildings.stadium",
  [BUILDING_SEWAGE_WORKS]: "buildings.sewageWorks",
  [BUILDING_WATERWORKS]: "buildings.waterworks",
  [BUILDING_FIRE_HQ]: "buildings.fireHq",
  [BUILDING_POLICE_HQ]: "buildings.policeHq",
  [BUILDING_GENERAL_HOSPITAL]: "buildings.generalHospital",
  [BUILDING_NUCLEAR_PLANT]: "buildings.nuclearPlant",
  [BUILDING_UNIVERSITY]: "buildings.university",
  [BUILDING_STATION]: "buildings.station",
  [BUILDING_STATION_L]: "buildings.station",
  [BUILDING_STATION_ELEVATED]: "buildings.stationElevated",
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
  // A merged 2×2 lot has a road if any of its tiles has (sim/lots.ts).
  const door = doorTile(world, ty * width + tx);
  tx = door % width;
  ty = (door - tx) / width;
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
/** An attraction: visitors against capacity, ticket income, the shops' share, and the warnings. Upkeep last. */
function attractionRows(world: World, tx: number, ty: number, _kind: number): string {
  const a = attractionAt(world, tx, ty);
  if (!a) return "";
  const n1 = (v: number) => v.toFixed(1);
  let html = "";
  if (!a.connected) html += `<div class="ti-detail" style="color:#e55;font-weight:bold;margin-top:4px">${t("ui.tileInfo.attractionNoRoad")}</div>`;
  else {
    const fill = a.capacity > 0 ? Math.min(1, a.arrivals / a.capacity) : 0;
    html += `<div class="ti-detail ti-seats"><span>${t("ui.tileInfo.attractionVisitors", {n: n1(a.arrivals), cap: n1(a.capacity)})}</span></div>`;
    html += `<div class="ti-meter"><span style="width:${(fill * 100).toFixed(1)}%"></span></div>`;
    if (a.income > 0) html += `<div class="ti-detail">${t("ui.tileInfo.attractionEarns", {amount: Math.round(a.income).toLocaleString("en-US")})}</div>`;
    if (a.toShops > 0) html += `<div class="ti-detail">${t("ui.tileInfo.attractionToShops", {n: a.toShops})}</div>`;
  }
  if (a.pull > 0 && !hasGateway(world)) html += `<div class="ti-detail" style="color:#e8b030">${t("ui.tileInfo.attractionResidentsOnly")}</div>`;
  return html;
}

/** The stadium's game days: when the next is, fans in the seats, and how the last went. */
function stadiumRows(world: World): string {
  const s = eventStatus(world);
  if (!s) return "";
  const TPS = 2;  // sim ticks a second at 1x
  const span = (ticks: number) => ticks < 60 * TPS ? t("ui.tileInfo.eventSoon") : t("ui.tileInfo.eventMinutes", {n: Math.round(ticks / (60 * TPS))});
  let html = "";
  if (!s.eventToday) html += `<div class="ti-detail">${t("ui.tileInfo.eventNext", {when: span(s.ticksToEvent)})}</div>`;
  else {
    const stage = t(s.stage === "ramp" ? "ui.tileInfo.eventStageRamp" : s.stage === "drain" ? "ui.tileInfo.eventStageDrain" : "ui.tileInfo.eventStagePeak");
    const left = s.ticksLeft < 60 * TPS ? Math.max(1, Math.round(s.ticksLeft / TPS)) + " s" : Math.round(s.ticksLeft / (60 * TPS)) + " min";
    html += `<div class="ti-detail" style="color:#e8b030;font-weight:bold">${t("ui.tileInfo.eventOn", {stage, left})}</div>`;
  }
  if (!s.connected) html += `<div class="ti-detail" style="color:#e55;font-weight:bold">${t("ui.tileInfo.attractionNoRoad")}</div>`;
  if (s.eventToday) {
    html += `<div class="ti-detail">${t("ui.tileInfo.eventFans", {fans: Math.round(s.fans).toLocaleString("en-US"), seats: s.seats.toLocaleString("en-US")})}</div>`;
    if (s.stuckResidents > 0) html += `<div class="ti-detail" style="color:#f0b04c">${t("ui.tileInfo.eventStuckNow", {n: Math.round(s.stuckResidents).toLocaleString("en-US"), pc: pcAmount(s.pc)})}</div>`;
  }
  if (s.last) html += `<div class="ti-detail">${t("ui.tileInfo.eventLast", {arrived: Math.round(s.last.arrived), wanted: Math.round(s.last.wanted), stuck: Math.round(s.last.stuckResidents).toLocaleString("en-US")})}</div>`;
  return html;
}

const UTILITY_OF: Record<number, { u: 'power' | 'water' | 'sewage'; large: boolean }> = {
  [BUILDING_POWER_PLANT]: { u: 'power', large: false }, [BUILDING_LARGE_POWER_PLANT]: { u: 'power', large: true },
  [BUILDING_WATER_TOWER]: { u: 'water', large: false }, [BUILDING_LARGE_WATER_PLANT]: { u: 'water', large: true },
  [BUILDING_SEWAGE_PLANT]: { u: 'sewage', large: false }, [BUILDING_LARGE_SEWAGE_PLANT]: { u: 'sewage', large: true },
};

/** A day's running cost of a service building (fixed upkeep plus covered residents) or a plant (fixed upkeep plus units supplied). */
function runningCostRows(world: World, kind: number, covered: number): string {
  const day = BALANCE.ticksPerDay, charged = headcountCost(world).charged;
  const fixed = buildingUpkeep(kind) * day;
  const money = (n: number) => Math.round(n).toLocaleString("en-US");
  const per = perResidentCost(kind);
  if (per > 0) {
    return `<div class="ti-detail">${t("ui.tileInfo.runningCostCovered", {amount: money(fixed + covered * per * charged), n: Math.round(covered).toLocaleString("en-US")})}</div>`;
  }
  const util = UTILITY_OF[kind];
  if (!util) return "";
  const s = world.stats;
  const [demand, supply] = util.u === 'power' ? [s.powerDemand, s.powerSupply] : util.u === 'water' ? [s.waterDemand, s.waterSupply] : [s.sewageDemand, s.sewageSupply];
  const out = util.u === 'power' ? (util.large ? BALANCE.power.largePlantOutput : BALANCE.power.plantOutput)
    : util.u === 'water' ? (util.large ? BALANCE.water.largePlantOutput : BALANCE.water.towerOutput)
    : (util.large ? BALANCE.sewage.largePlantOutput : BALANCE.sewage.plantOutput);
  const units = supply > 0 ? out * Math.min(1, demand / supply) : 0;
  return `<div class="ti-detail">${t("ui.tileInfo.plantSupplies", {n: Math.round(units).toLocaleString("en-US"), amount: money(fixed + units * perUnitCost(util.u, util.large) * charged)})}</div>`;
}

/**
 * A capstone's rows from any of its tiles: its reach (a service capstone covers the whole city; a utility one
 * says what it supplies), what it costs a day for the residents it serves, and the no-road warning.
 * (They were missing: the service rows only knew the small kinds and the plants.)
 */
export function capstoneRows(world: World, tx: number, ty: number, kind: number): string {
  const row = capstoneRow(kind);
  if (!row) return "";
  let html = "";
  if (isServiceCapstone(kind)) html += `<div class="ti-detail">${t("ui.tileInfo.coverageWholeCity")}</div>`;
  else html += `<div class="ti-detail">${t(row.need === "sewage" ? "ui.tileInfo.capacity" : "ui.tileInfo.output", {amount: row.output ?? 0})}</div>`;
  const served = capstoneResidents(world, world.stats.population, (b) => residentsCoveredBy(world, b))[kind] ?? 0;
  const day = BALANCE.ticksPerDay, fixed = buildingUpkeep(kind) * day;
  const extra = (headcountCost(world).capstones[kind] ?? 0) * day;
  html += `<div class="ti-detail">${t("ui.tileInfo.runningCostCovered", {amount: Math.round(fixed + extra).toLocaleString("en-US"), n: Math.round(served).toLocaleString("en-US")})}</div>`;
  if (world.buildingAccessRoads(tx, ty).length === 0) {
    html += `<div class="ti-detail" style="color:#e55;font-weight:bold;margin-top:4px">${t("ui.tileInfo.notConnected")}</div>`;
  }
  return html;
}

/** The elevated station whose overhead platform includes tile (tx, ty), if any. */
export function platformStationAt(world: World, tx: number, ty: number): BuildingEntity | null {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const b = world.buildingAt(tx + dx, ty + dy);
    if (b && b.kind === BUILDING_STATION_ELEVATED && b.tx === tx + dx && b.ty === ty + dy
      && overheadPlatform(b.kind, b.rot ?? 0).some(([ox, oy]) => b.tx + ox === tx && b.ty + oy === ty)) return b;
  }
  return null;
}

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
  return html;
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

/** An outside connection point: joined or not, then what comes and goes through it each tick. */
/**
 * The warning under a home's leisure bar, or "" when it isn't held back. Text only: the growth rule is
 * lacksLeisure. "None" only when nothing reaches the home (the bar reads 0%); a partly served home gets the
 * "crowded" text with the same percentage as the bar.
 */
export function leisureNote(world: World, i: number, door: number = i): string {
  if (!lacksLeisure(world, i, door)) return '';
  const reach = Math.max(0, Math.min(1, leisureReachAt(world, i, door)));
  if (reach <= 0) return t("ui.tileInfo.noLeisure");
  return t("ui.tileInfo.leisureCrowded", { pct: Math.round(reach * 100) });
}

export function connectionRows(world: World, i: number): string {
  const c = connectionTradeAt(world, i);
  if (!c) return "";
  const n = (v: number): string => (Math.round(v * 10) / 10).toLocaleString("en-US");
  if (!c.joined) {
    const how = c.kind === 'highway' ? t("ui.tileInfo.connectionBuildHighway") : t("ui.tileInfo.connectionBuildRail");
    return `<div class="ti-detail">${t("ui.tileInfo.connectionPoint")}</div><div class="ti-detail" style="color:#e8b030">${how}</div>`;
  }
  let html = `<div class="ti-detail">${t("ui.tileInfo.connectionPoint")}</div><div class="ti-detail">${t("ui.tileInfo.connectionJoined")}</div>`;
  if (c.open) {
    html += `<div class="ti-detail">${t("ui.tileInfo.connectionVisitors", {n: n(c.visitorsIn), cap: n(c.visitorsCapacity)})}</div>`;
    html += `<div class="ti-detail">${t("ui.tileInfo.connectionExports", {n: n(c.exports), cap: n(c.exportCapacity), amount: Math.round(c.income).toLocaleString("en-US")})}</div>`;
    html += `<div class="ti-detail">${t("ui.tileInfo.connectionResidents", {n: n(c.residentsOut), cap: n(c.residentsOutCapacity)})}</div>`;
  }
  return html;
}

/** A train station: what it does, then riders boarding and fares, or the warning that it has no road. Upkeep either way. */
function stationRows(world: World, tx: number, ty: number, _kind: number): string {
  const i = world.grid.idx(tx, ty);
  let html = `<div class="ti-detail">${t("ui.tileInfo.stationAbout")}</div>`;
  if (world.buildingAccessRoads(tx, ty).length === 0) {
    html += `<div class="ti-detail" style="color:#e55;font-weight:bold;margin-top:4px">${t("ui.tileInfo.stationNoRoad")}</div>`;
  } else {
    const st = world.overheadStationAt(i);
    const anchor = st ? world.grid.idx(st.tx, st.ty) : world.buildingAnchorAt(i);
    const boardings = world.traffic?.rail.stations.find((s) => s.anchor === anchor)?.boardings ?? 0;
    html += `<div class="ti-detail">${t("ui.tileInfo.stationBoardings", {n: Math.round(boardings).toLocaleString("en-US")})}</div>`;
    const fares = boardings * BALANCE.rail.fare;
    if (transitIsFree(world)) html += `<div class="ti-detail">${t("ui.tileInfo.stationFree")}</div>`;
    else if (fares > 0) html += `<div class="ti-detail">${t("ui.tileInfo.stationEarns", {amount: Math.round(fares).toLocaleString("en-US")})}</div>`;
  }
  // Riders on its track: the busiest platform tile, whichever tile was clicked. (Riders get on
  // and off at one platform tile, so the others can be empty at a station that is working.)
  const peak = stationPeak(world, tx, ty);
  if (peak) html += railRows(world, peak.tile, peak.level);
  return html;
}

/** A street or avenue beside any tile of the building at (tx, ty). */
function isBuildingConnected(world: World, tx: number, ty: number): boolean {
  // A street or avenue along the building's body; a seaport's docks do not count.
  return world.buildingAccessRoads(tx, ty).length > 0;
}

export type VerdictTone = "ok" | "warn" | "bad";
export interface Verdict { key: string; params?: Record<string, string | number>; tone: VerdictTone }

const ROAD_JAMMED = 140, ROAD_BUSY = 85;   // congestion (0-255), as the road rows grade it
const STATION_OVER = 1.15;                 // rail load past which the traffic view marks it red

/**
 * One plain line on how this tile is doing: a zone (growing, stuck on what, abandoned), a service
 * (overloaded or fine), a road (clear, busy, jammed), a station (riders, over capacity), a plant
 * (short or fine). null for tiles with nothing to judge. The source is the same checks the rows use.
 */
export function tileVerdict(world: World, tx: number, ty: number): Verdict | null {
  if (!world.grid.inBounds(tx, ty)) return null;
  const i = world.grid.idx(tx, ty), L = world.layers, building = L.building[i];
  if (building !== 0) {
    if (building === BUILDING_STATION || building === BUILDING_STATION_L || building === BUILDING_STATION_ELEVATED || building === BUILDING_SUBWAY_STATION) {
      if (world.buildingAccessRoads(tx, ty).length === 0) return {key: "stationNoRoad", tone: "bad"};
      const peak = stationPeak(world, tx, ty);
      if (!peak || !world.traffic) return {key: "ok", tone: "ok"};
      if (railLoad(world.traffic, peak.tile, peak.level) >= STATION_OVER) return {key: "stationOver", tone: "bad"};
      return {key: "stationRiders", params: {n: Math.round(peak.riders).toLocaleString("en-US")}, tone: "ok"};
    }
    const util = UTILITY_OF[building] ?? (capstoneRow(building) && ["power", "water", "sewage"].includes(capstoneRow(building)!.need) ? {u: capstoneRow(building)!.need as "power" | "water" | "sewage"} : undefined);
    if (util) {
      if (world.buildingAccessRoads(tx, ty).length === 0) return {key: "notConnected", tone: "bad"};
      const s = world.stats;
      const [demand, supply] = util.u === "power" ? [s.powerDemand, s.powerSupply] : util.u === "water" ? [s.waterDemand, s.waterSupply] : [s.sewageDemand, s.sewageSupply];
      if (supply < demand) return {key: "plantShort", params: {supply: Math.round(supply).toLocaleString("en-US"), demand: Math.round(demand).toLocaleString("en-US")}, tone: "bad"};
      return {key: "ok", tone: "ok"};
    }
    if (serviceRange(building) !== undefined) {
      const seats = hasCapacity(building) ? buildingSeats(world, tx, ty) : null;
      const sv = seats ? seatsView(seats) : null;
      if (sv && sv.leftOut > 0) return {key: "overloaded", params: {n: sv.leftOut.toLocaleString("en-US")}, tone: "bad"};
      if (isCapstone(building) && world.buildingAccessRoads(tx, ty).length === 0) return {key: "notConnected", tone: "bad"};
      return {key: "ok", tone: "ok"};
    }
    return null;
  }
  if (L.roadClass[i] !== ROAD_NONE) {
    const cong = L.congestion[i];
    return cong >= ROAD_JAMMED ? {key: "jammed", tone: "bad"} : cong >= ROAD_BUSY ? {key: "busy", tone: "warn"} : {key: "clear", tone: "ok"};
  }
  if (L.zone[i] !== ZONE_NONE && L.terrain[i] !== TERRAIN_WATER) {
    const {reqs, maxLevel} = analyzeZone(world, tx, ty), unmet = reqs.filter((r) => !r.met);
    if (L.abandoned[i] !== 0) {
      return !hasRoadAccess(world, tx, ty) ? {key: "abandonedNoRoad", tone: "bad"}
        : unmet.length > 0 ? {key: "abandonedWhy", params: {why: unmet[0].label.toLowerCase()}, tone: "bad"} : {key: "abandoned", tone: "bad"};
    }
    if (L.devLevel[i] >= maxLevel) return {key: "full", tone: "ok"};
    if (unmet.length > 0) return {key: "stuck", params: {what: unmet[0].label.toLowerCase()}, tone: "warn"};
    return {key: "growing", tone: "ok"};
  }
  return null;
}

/** The verdict as a line under the heading ('' for none). */
export function verdictHtml(v: Verdict | null): string {
  if (!v) return "";
  const color = v.tone === "ok" ? "#7dd87d" : v.tone === "warn" ? "#e0b050" : "#e07070";
  return `<div class="ti-verdict" style="color:${color};font-weight:600">${t("ui.tileInfo.verdict." + v.key, v.params)}</div>`;
}

export class TileInfoPanel {
  private readonly el: HTMLElement;
  private visible = false;

  constructor() {
    this.el = document.getElementById("tile-info")!;
    // The pane follows the hover tile and ignores the pointer, so Details opens while Shift is held.
    window.addEventListener("keydown", (e) => { if (e.key === "Shift") this.shift = true; });
    window.addEventListener("keyup", (e) => { if (e.key === "Shift") this.shift = false; });
    window.addEventListener("blur", () => { this.shift = false; });
  }

  setVisible(v: boolean): void {
    this.visible = v;
    if (!v) this.el.classList.add("hidden");
  }

  update(world: World, tile: {tx: number; ty: number} | null, paused = false): void {
    if (!this.visible) return;
    if (!tile || !world.grid.inBounds(tile.tx, tile.ty)) {
      this.el.classList.add("hidden");
      return;
    }
    this.el.classList.remove("hidden");
    this._render(world, tile.tx, tile.ty, paused);
  }

  private lastKey = "";
  private lastHtml = "";
  private shift = false;

  private _render(world: World, tx: number, ty: number, paused = false): void {
    // Rebuild only when the tile or its data changed (also keeps the Details toggle where the player left it).
    const key = `${tx},${ty},${world.tick},${world.grid.edits},${paused},${this.shift}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    const html = tileInfoHtml(world, tx, ty, paused, DEBUG, DEBUG || this.shift);
    if (html === this.lastHtml) return;
    this.lastHtml = html;
    this.el.innerHTML = html;
  }
}

export function tileInfoHtml(world: World, tx: number, ty: number, paused = false, debug = DEBUG, detailsOpen = debug): string {
    const i = world.grid.idx(tx, ty);
    const terrain = world.layers.terrain[i];
    const zone = world.layers.zone[i];
    const road = world.layers.roadClass[i];
    // An elevated station is overhead, with no tile of its own in the building layer.
    const building = world.layers.building[i] || (world.overheadStationAt(i)?.kind ?? 0);
    const vegetation = world.layers.vegetation[i];
    const dev = world.layers.devLevel[i];
    const pollution = world.layers.pollution[i];
    const crime = world.layers.crime[i];
    const fireRisk = world.layers.fireRisk[i];
    const fire = world.layers.fire[i];

    let html = paused ? `<div class="ti-detail" style="color:#e8b030;font-weight:bold">${t("ui.paused.inspect")}</div>` : "";
    // Coverage is only worked out while time runs: say so where a lot is showing a gap.
    if (paused && zone !== 0 && (world.layers.power[i] === 0 || world.layers.water[i] === 0)) {
      html += `<div class="ti-detail" style="color:#e8b030">${t("ui.paused.coverage")}</div>`;
    }
    html += `<div class="ti-coord">${t("ui.tileInfo.coords", {tx, ty})}</div>`;
    html += connectionRows(world, i);

    // ── Building tile ──────────────────────────────────────────────────────────
    if (building !== 0) {
      const name = BUILDING_NAME[building]
        ? t(BUILDING_NAME[building])
        : `${t("buildings.building")} #${building}`;
      html += `<div class="ti-type">${name}</div>`;
      html += verdictHtml(tileVerdict(world, tx, ty));
      // Show coverage radius for service buildings
      if (building >= BUILDING_POLICE && BALANCE.service.coverageRange[building] !== undefined) {
        const range = BALANCE.service.coverageRange[building];
        html += `<div class="ti-detail">${t("ui.tileInfo.coverageRadius", {range})}</div>`;
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
      if (seats || UTILITY_OF[building]) html += runningCostRows(world, building, seats?.seated ?? 0);
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
      html += capstoneRows(world, tx, ty, building);
      if (building === BUILDING_AIRPORT) html += airportRows(world, tx, ty);
      html += attractionRows(world, tx, ty, building);
      if (building === BUILDING_STADIUM) html += stadiumRows(world);
      if (building === BUILDING_STATION || building === BUILDING_STATION_L || building === BUILDING_STATION_ELEVATED || building === BUILDING_SUBWAY_STATION) html += stationRows(world, tx, ty, building);

      // One cost row: a service or plant's running cost already includes its upkeep; for the rest, the upkeep alone.
      if (!(seats || UTILITY_OF[building] || capstoneRow(building))) {
        const day = buildingUpkeep(building) * BALANCE.ticksPerDay;
        if (day > 0) html += `<div class="ti-detail">${t("ui.tileInfo.costs", {amount: Math.round(day).toLocaleString("en-US")})}</div>`;
      }

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
      html += trustRow(world, tx, ty);
      html += identityRow(world, tx, ty);

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
      const stn = ground ? null : platformStationAt(world, tx, ty);
      if (stn) html += `<div class="ti-detail">${t("ui.tileInfo.stationPlatform")}</div>` + stationRows(world, stn.tx, stn.ty, stn.kind);
      html += railRows(world, i, ground ? RAIL_GROUND : RAIL_ELEVATED);

      // ── Water terrain ──────────────────────────────────────────────────────────
    } else if (terrain === TERRAIN_WATER) {
      html += `<div class="ti-type">${t("terrain.water")}</div>`;
      html += `<div class="ti-note">${t("ui.tileInfo.notBuildable")}</div>`;

      // ── Zone tile ──────────────────────────────────────────────────────────────
    } else if (zone !== ZONE_NONE) {
      const zoneName = ZONE_NAME[zone] ? t(ZONE_NAME[zone]) : t("zones.zone");
      const dots = "●".repeat(dev) + "○".repeat(Math.max(0, BALANCE.growth.maxLevel - dev));
      const isAbandoned = world.layers.abandoned[i] !== 0;
      // A merged lot is one building: say so, with the residents of all its tiles.
      const lot = lotSummary(world, i);
      const levelText = lot ? t(lot.shape === "square" ? "ui.tileInfo.bigLot" : "ui.tileInfo.bigLotPair") : `Lv ${dev}/${BALANCE.growth.maxLevel}`;
      html += `<div class="ti-type">${zoneName} <span class="ti-dots">${dots}</span> ${levelText}</div>`;
      const {reqs, maxLevel} = analyzeZone(world, tx, ty);
      const unmet = reqs.filter((r) => !r.met);
      html += verdictHtml(tileVerdict(world, tx, ty));
      if (lot && lot.residents > 0) html += `<div class="ti-detail">${t("ui.tileInfo.bigLotResidents", {count: lot.residents})}</div>`;
      html += problemChips(world, i);
      if (fire > 0) {
        html += `<div class="ti-detail" style="color:#f60;font-weight:bold">${t("common.onFire")} ${t("common.ticksLeft", {ticks: fire})}</div>`;
      }
      // The Details block: everything that is not a problem right now. (?debug=true opens it and adds the raw numbers.)
      let det = "";
      if (!lot && debug && BALANCE.lots.chancePerDay > 0 && world.lotStreak[i] > 0) {
        det += `<div class="ti-detail">${t("ui.tileInfo.bigLotStreak", {days: Math.min(world.lotStreak[i], BALANCE.lots.streakDays), need: BALANCE.lots.streakDays})}</div>`;
      }
      det += establishedRow(world, i);
      det += pcRows(world, tx, ty);
      if (debug) {
        det += trustRow(world, tx, ty);
        det += identityRow(world, tx, ty, true);
        const distress = world.layers.distress[i];
        if (!isAbandoned && distress > 0) {
          det += `<div class="ti-detail" style="color:#cc5">${t("ui.tileInfo.distress", {distress, threshold: BALANCE.abandonment.abandonThreshold})}</div>`;
        }
      }

      const landValue = world.layers.landValue[i];
      const lvKey = landValue < 60 ? "landValue.low" : landValue < 110 ? "landValue.medium" : landValue < 160 ? "landValue.good" : "landValue.prime";
      det += `<div class="ti-detail">${t("ui.tileInfo.landValue", {value: landValue, label: t(lvKey)})}</div>`;

      const level3 = (v: number) => (v < 40 ? "common.low" : v < 100 ? "common.medium" : "common.high");
      if (pollution > 0) det += `<div class="ti-detail ti-poll">${t("ui.tileInfo.pollution", {value: pollution, label: t(level3(pollution))})}</div>`;
      if (crime > 0) det += `<div class="ti-detail" style="color:#e55">${t("ui.tileInfo.crime", {value: crime, label: t(level3(crime))})}</div>`;

      if (zone === ZONE_R) {
        // Services: only a place that is missing is a line of its own; all seated is one tick.
        let seated = 0, total = 0;
        for (const kind of [BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL]) {
          const seat = hasCapacity(kind) ? homeSeat(world, tx, ty, kind) : null;
          if (!seat) continue;
          total++;
          const state = homeSeatState(seat), key = state === "full" ? "fullState" : state;
          if (state === "has") { seated++; continue; }
          const color = state === "full" ? "#e0b050" : "#e07070";
          html += `<div class="ti-detail">${t(BUILDING_NAME[kind])}: <span style="color:${color}">${t(seatWords(kind) + "." + key)}</span></div>`;
        }
        if (total > 0 && seated === total) html += `<div class="ti-detail" style="color:#7dd87d">${t("ui.tileInfo.allServicesInReach")}</div>`;
        const edu = world.layers.education[i];
        const eduKey = edu < 50 ? "education.uneducated" : edu < 120 ? "education.basic" : edu < 200 ? "education.educated" : "education.highlyEducated";
        det += `<div class="ti-detail" style="color:#5cf">${t("ui.tileInfo.education", {value: edu, label: t(eduKey)})}</div>`;
        const sick = world.layers.sickness[i];
        if (sick > 0) {
          const sickKey = sick < 80 ? "sickness.mild" : sick < 160 ? "sickness.moderate" : "sickness.severe";
          const sickColor = sick < 80 ? "#5cc" : sick < 160 ? "#fc0" : "#f55";
          det += `<div class="ti-detail" style="color:${sickColor}">${t("ui.tileInfo.sickness", {value: sick, label: t(sickKey)})}${!world.layers.hospital[i] ? t("sickness.noHospital") : ""}</div>`;
        }
        const rd = world.layers.recentDeath[i];
        if (rd > 0) html += `<div class="ti-detail" style="color:#ccd;font-weight:bold">${t("ui.tileInfo.recentDeath", {ticks: rd})}</div>`;
      }
      if (fireRisk > 0) det += `<div class="ti-detail" style="color:#f80">${t("ui.tileInfo.fireRisk", {value: fireRisk, label: t(level3(fireRisk))})}</div>`;

      // Demand and tax display
      const demand = zone === ZONE_R ? world.stats.rDemand : zone === ZONE_C ? world.stats.cDemand : world.stats.iDemand;
      const demandColor = demand >= 1.2 ? "#5c5" : demand >= 0.8 ? "#cc5" : "#e55";
      det += `<div class="ti-detail" style="color:${demandColor}">${t("ui.tileInfo.demand", {value: demand.toFixed(2)})}</div>`;
      const neutralRate = zone === ZONE_R ? BALANCE.tax.zoneR : zone === ZONE_C ? BALANCE.tax.zoneC : BALANCE.tax.zoneI;
      const currentRate = zone === ZONE_R ? world.budget.taxRates.R : zone === ZONE_C ? world.budget.taxRates.C : world.budget.taxRates.I;
      const taxMult = Math.max(BALANCE.demand.min, Math.min(BALANCE.demand.max, neutralRate / currentRate * taxDemandMult(world.budget.taxLevel)));
      const taxDelta = Math.round((taxMult - 1) * 100);
      det += `<div class="ti-detail" style="color:${taxDelta >= 0 ? "#5c5" : "#e55"}">${t("ui.tileInfo.taxRate", {rate: currentRate.toFixed(1), sign: taxDelta >= 0 ? "+" : "", delta: taxDelta})}</div>`;
      if (!isAbandoned) det += tripRows(world, i);

      // Growth: only what is still missing, with a count.
      if (!isAbandoned && dev < maxLevel) {
        if (unmet.length > 0) {
          html += `<div class="ti-req"><span class="ti-no">${t("common.no")}</span> ${t("ui.tileInfo.unmetLeft", {n: unmet.length, total: reqs.length, level: dev + 1, list: unmet.map((r) => r.label).join(", ")})}</div>`;
          if (zone === ZONE_R && dev === 2 && world.layers.sewage[i] !== 0 && world.layers.services[i] !== 0
              && world.layers.education[i] < BALANCE.education.growthThreshold) {
            html += `<div class="ti-detail" style="color:#e8b030">${t("ui.tileInfo.needsSchool")}</div>`;
          }
        } else {
          const effectivePct = Math.round((zone === ZONE_R ? (BALANCE.growth.homeProbabilityByLevel[dev] ?? BALANCE.growth.probability) : BALANCE.growth.probability) * demand * 100);
          det += `<div class="ti-growth-ok">${t("ui.tileInfo.allMetGrowing", {pct: effectivePct})}</div>`;
        }
      }
      html += `<details class="ti-details"${detailsOpen ? " open" : ""}><summary style="cursor:pointer;color:#9ab">${t("ui.tileInfo.details")}</summary>${det}</details>`;
      if (!detailsOpen) html += `<div class="ti-hint" style="color:#789;font-size:10px">${t("ui.tileInfo.detailsHint")}</div>`;

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

    if (debug) html += trafficDebugHtml(world, i);

    return html;
}
