// Buildings that stop working without a street or avenue beside them, and
// which of them an action has just cut off (bulldozing their road, or
// upgrading it to a highway, which gives no access). CommandHistory takes a
// snapshot before each action and compares after; the toast and the red
// outline during a drag come from that.
//
// Parks are left out on purpose (owner: they can be decorative). The small
// and large utility plants are left out too, though they also need a street
// or avenue to supply (systems/utilityCoverage.ts): a shortage warning covers
// them. The capstones are all in: losing one loses the whole city's supply or
// service at once.

import type { World } from './World';
import {
  BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL,
  BUILDING_SEAPORT, BUILDING_AIRPORT, BUILDING_STATION, BUILDING_STATION_L, BUILDING_SUBWAY_STATION,
  BUILDING_SEWAGE_WORKS, BUILDING_WATERWORKS, BUILDING_FIRE_HQ, BUILDING_POLICE_HQ, BUILDING_GENERAL_HOSPITAL, BUILDING_NUCLEAR_PLANT, BUILDING_UNIVERSITY,
} from './constants';

/** Kinds that do nothing without a street or avenue (World.buildingAccessRoads). */
export const NEEDS_ROAD: ReadonlySet<number> = new Set([
  BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL,
  BUILDING_SEAPORT, BUILDING_AIRPORT, BUILDING_STATION, BUILDING_STATION_L, BUILDING_SUBWAY_STATION,
  BUILDING_SEWAGE_WORKS, BUILDING_WATERWORKS, BUILDING_FIRE_HQ, BUILDING_POLICE_HQ, BUILDING_GENERAL_HOSPITAL, BUILDING_NUCLEAR_PLANT, BUILDING_UNIVERSITY,
]);

/** Anchor tile → kind, for every NEEDS_ROAD building that has a road right now. */
export type RoadSnapshot = Map<number, number>;

export interface CutOffBuilding {
  kind: number;
  tx: number;
  ty: number;
  /** Its footprint, for the outline and the camera: corners, inclusive, and every tile. */
  x0: number; y0: number; x1: number; y1: number;
  tiles: { x: number; y: number }[];
}

export function roadSnapshot(world: World): RoadSnapshot {
  const out: RoadSnapshot = new Map();
  const w = world.grid.width;
  for (const b of world.buildings) {
    if (!NEEDS_ROAD.has(b.kind)) continue;
    if (world.buildingAccessRoads(b.tx, b.ty).length > 0) out.set(b.ty * w + b.tx, b.kind);
  }
  return out;
}

/** Buildings that had a road in `before`, still stand, and have none now. A building that was removed is not listed. */
export function cutOffSince(world: World, before: RoadSnapshot): CutOffBuilding[] {
  if (before.size === 0) return [];
  const w = world.grid.width;
  const out: CutOffBuilding[] = [];
  for (const b of world.buildings) {
    if (before.get(b.ty * w + b.tx) !== b.kind) continue;
    if (world.buildingAccessRoads(b.tx, b.ty).length > 0) continue;
    const tiles = world.buildingTilesAt(b.tx, b.ty).map((i) => ({ x: i % w, y: (i - (i % w)) / w }));
    if (tiles.length === 0) tiles.push({ x: b.tx, y: b.ty });
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const t of tiles) { x0 = Math.min(x0, t.x); y0 = Math.min(y0, t.y); x1 = Math.max(x1, t.x); y1 = Math.max(y1, t.y); }
    out.push({ kind: b.kind, tx: b.tx, ty: b.ty, x0, y0, x1, y1, tiles });
  }
  return out;
}
