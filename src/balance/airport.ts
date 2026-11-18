// Balance Lab: the airport suite (owner-approved targets, 2026-11-18).
//
// On each saved city: build the airport on free land near the middle of the
// homes, lay a street along its terminal frontage and on to the nearest street,
// and run it for `days` against a twin that gets the same streets and no
// airport. The airport.* targets (targets.ts) read the result. Fresh maps are
// skipped: a new town has neither the homes nor the cash for one.

import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { BUILDING_AIRPORT, BUILDING_NONE, ROAD_HIGHWAY, ROAD_NONE, ROAD_STREET, TERRAIN_WATER, ZONE_NONE, ZONE_R } from '../sim/constants';
import { footprintTiles, shapeRoles } from '../sim/buildingShapes';
import { buildingTripsAt } from '../sim/buildingTraffic';
import { pcCap } from '../sim/politics';
import { cloneWorld, startSim } from './world';

export interface AirportResult {
  site: { x: number; y: number; access: number } | null;
  /** Share of the visitor seats filled on the last day. */
  seats: number | null;
  /** Days for the airport's extra net income (against the twin) to repay its cost; null if it loses money. */
  paybackDays: number | null;
  /** Commercial demand with the airport ÷ the twin's, minus 1. */
  demandGain: number | null;
  /** The airport's cost in days of the twin's own surplus; null if the city runs at a loss. */
  costDays: number | null;
  /** Worst congestion (0–255) on the streets along the terminal. */
  frontJam: number | null;
  /** The request's reward in PC bars at this city's size (a mature city barely grows before it first has the cash). */
  requestBars: number;
  population: number;
  note?: string;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const isStreet = (w: World, i: number) => w.layers.roadClass[i] !== ROAD_NONE && w.layers.roadClass[i] !== ROAD_HIGHWAY;
const free = (w: World, i: number) => w.layers.terrain[i] !== TERRAIN_WATER && w.layers.building[i] === BUILDING_NONE && w.layers.roadClass[i] === ROAD_NONE && w.layers.devLevel[i] === 0 && w.layers.zone[i] === ZONE_NONE;
const ACCESS_MAX = 30;

interface Site { x: number; y: number; front: number[]; path: number[] }

/** Every airport site on free land whose terminal frontage row can be a street that reaches the network. */
function sites(w: World): Site[] {
  const { width, height } = w.grid;
  const roles = shapeRoles(BUILDING_AIRPORT);
  const out: Site[] = [];
  for (let y = 1; y < height; y++) for (let x = 0; x < width; x++) {
    const tiles = footprintTiles(width, height, x, y, BUILDING_AIRPORT, 0);
    if (!tiles || !tiles.every(i => free(w, i))) continue;
    const front = tiles.filter((_, k) => roles[k] === 'frontage').map(i => i - width);
    if (!front.every(i => free(w, i) || isStreet(w, i))) continue;
    if (!w.checkPlacement(x, y, BUILDING_AIRPORT, 0).ok) continue;
    const foot = new Set(tiles), frontSet = new Set(front), prev = new Map<number, number>();
    let frontier = [...front], path: number[] | null = null;
    for (const i of front) prev.set(i, -1);
    for (let d = 1; d <= ACCESS_MAX && frontier.length && !path; d++) {
      const next: number[] = [];
      for (const i of frontier) {
        if (path) break;
        const xx = i % width;
        for (const j of [xx > 0 ? i - 1 : -1, xx < width - 1 ? i + 1 : -1, i >= width ? i - width : -1, i < width * (height - 1) ? i + width : -1]) {
          if (j < 0 || prev.has(j) || foot.has(j)) continue;
          if (isStreet(w, j) && !frontSet.has(j)) { path = [i]; let k = prev.get(i)!; while (k >= 0) { path.push(k); k = prev.get(k)!; } break; }
          if (free(w, j)) { prev.set(j, i); next.push(j); }
        }
      }
      frontier = next;
    }
    if (path) out.push({ x, y, front, path });
  }
  return out;
}

/** The site nearest the middle of the homes, then with the shortest access street. */
function bestSite(w: World): Site | null {
  const { width } = w.grid;
  let sx = 0, sy = 0, n = 0;
  for (let k = 0; k < w.layers.zone.length; k++) if (w.layers.zone[k] === ZONE_R && w.layers.devLevel[k]) { sx += k % width; sy += Math.floor(k / width); n++; }
  if (!n) return null;
  const cx = sx / n, cy = sy / n;
  let best: Site | null = null, bd = Infinity;
  for (const s of sites(w)) { const d = Math.abs(s.x + 6 - cx) + Math.abs(s.y + 2 - cy) + s.path.length * 0.5; if (d < bd) { bd = d; best = s; } }
  return best;
}

function lay(w: World, s: Site): void {
  for (const i of [...s.front, ...s.path]) if (!isStreet(w, i)) w.setRoad(i % w.grid.width, Math.floor(i / w.grid.width), ROAD_STREET);
}

/** The airport probe on a copy of `world`, under the BALANCE numbers in force. */
export function airportResult(world: World, days = 60): AirportResult {
  const reward = BALANCE.politicalCapital.requests.kinds.airport?.reward ?? 0;
  const res: AirportResult = { site: null, seats: null, paybackDays: null, demandGain: null, costDays: null, frontJam: null, requestBars: r3(reward / pcCap(world)), population: world.stats.population };
  const air = cloneWorld(world), twin = cloneWorld(world);
  const site = bestSite(air);
  if (!site) return { ...res, note: 'no free site a street can reach' };
  lay(air, site); lay(twin, site);
  if (!air.placeBuilding(site.x, site.y, BUILDING_AIRPORT, 0)) return { ...res, note: 'placement refused' };
  res.site = { x: site.x, y: site.y, access: site.path.length };
  const m0a = air.budget.money, m0t = twin.budget.money;
  const sa = startSim(air), st = startSim(twin);
  for (let d = 0; d < days; d++) { sa.tick(BALANCE.ticksPerDay); st.tick(BALANCE.ticksPerDay); }
  const trips = buildingTripsAt(air, site.x, site.y);
  const seat = trips?.takes.find(t => t.market === 'visitors');
  res.seats = seat ? r3(seat.trips / seat.capacity) : 0;
  const twinNet = (twin.budget.money - m0t) / days, extra = (air.budget.money - m0a) / days - twinNet;
  const cost = BALANCE.buildings[BUILDING_AIRPORT]?.cost ?? 0;
  res.paybackDays = extra > 0 ? Math.round(cost / extra) : null;
  res.costDays = twinNet > 0 ? Math.round(cost / twinNet) : null;
  res.demandGain = twin.stats.cDemand > 0 ? r3(air.stats.cDemand / twin.stats.cDemand - 1) : null;
  res.frontJam = Math.max(...site.front.map(i => air.layers.congestion[i]));
  return res;
}
