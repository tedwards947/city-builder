// What the hover route hints show for a BUILDING (a station, the airport, a
// hospital…) rather than a home or a road. Pure: works out which traffic
// nodes to follow; TrafficOverlay draws them.
//
//   A station:  its riders' catchment (every home whose trip passes the
//               station's platform node) and the ride on from there, along
//               the track to where they get off, then the drive.
//   A building with a trip row (BALANCE.transit.buildings): the trips it
//               SENDS (arrivals at the airport heading for shops or jobs) are
//               routed from its quickest access road; the trips it TAKES
//               (visitors, workers) get a catchment from its door roads.

import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { stationPeak } from '../sim/rail';
import { railNode, type TrafficData } from '../sim/TrafficData';

export interface BuildingTrace {
  /** Per market (MARKET_DEFS order): nodes to draw a route from. */
  routes: number[][];
  /** Per market: nodes whose catchment (everything that passes them) to show. */
  targets: number[][];
}

/** The trace for the building on tile `hover`, or null if there is none or nothing to show. */
export function buildingTrace(world: World, data: TrafficData, hover: number): BuildingTrace | null {
  const { width } = world.grid;
  const hx = hover % width, hy = (hover - hx) / width;
  const b = world.buildingAt(hx, hy);
  if (!b) return null;
  const routes: number[][] = data.markets.map(() => []);
  const targets: number[][] = data.markets.map(() => []);
  let any = false;

  const peak = stationPeak(world, hx, hy);
  if (peak) {
    const node = railNode(data, peak.tile, peak.level);
    data.markets.forEach((m, k) => {
      if (!m.def.rides || !(m.volume[node] > 0)) return;
      routes[k].push(node); targets[k].push(node); any = true;
    });
  }

  const row = BALANCE.transit.buildings[b.kind];
  if (row) {
    const roads = world.buildingAccessRoads(b.tx, b.ty);
    data.markets.forEach((m, k) => {
      if (row.sends?.[m.def.key]! > 0) {
        let best = -1;
        for (const ri of roads) if (m.field.dist[ri] < (best < 0 ? Infinity : m.field.dist[best])) best = ri;
        if (best >= 0) { routes[k].push(best); any = true; }
      }
      if (row.takes?.[m.def.key]! > 0) {
        for (const ri of roads) if (m.field.doorCap[ri] > 0) { targets[k].push(ri); any = true; }
      }
    });
  }
  return any ? { routes, targets } : null;
}
