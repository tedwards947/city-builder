// Service coverage system.
// Coverage propagates along the road network via BFS, up to `range` road hops
// per building kind. Road tiles within range and their immediate neighbors
// (propagationRange=1) receive coverage — the same pattern as power/water.
// The building's own tile is always covered regardless of road adjacency.
// ServiceSystem runs before ZoneGrowthSystem so it can gate level 2→3 growth.

import type { World } from '../World';
import { ROAD_NONE, ROAD_HIGHWAY, ZONE_NONE, BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL } from '../constants';
import { BALANCE } from '../../data/balance';
import { footprintTiles, footprintEdge } from '../buildingShapes';

/**
 * BFS coverage for a single service building placed at (tx, ty) of kind `kind`.
 * Returns the set of tile indices that would receive coverage.
 * Used by both ServiceSystem.update() and the renderer's hover preview.
 * `range` (road steps) defaults to the kind's range in the balance table.
 */
export function computeServiceCoverage(
  world: World,
  tx: number,
  ty: number,
  kind: number,
  range: number = BALANCE.service.coverageRange[kind] ?? 4,
): Set<number> {
  const { width, height } = world.grid;
  const roadClass = world.layers.roadClass;
  const covered = new Set<number>();

  // The building's own tiles are always covered. (A kind of several tiles
  // anchored where it does not fit is treated as its anchor tile alone.)
  const own = footprintTiles(width, height, tx, ty, kind) ?? [ty * width + tx];
  for (const i of own) covered.add(i);

  // Seed BFS from road tiles at or adjacent to the building.
  // Seeding only happens from STREET or AVENUE. HIGHWAY does not activate a building.
  const visited = new Set<number>();
  const queue: Array<{ idx: number; dist: number }> = [];

  const seed = (stx: number, sty: number) => {
    if (stx < 0 || sty < 0 || stx >= width || sty >= height) return;
    const i = sty * width + stx;
    const rc = roadClass[i];
    if (rc === ROAD_NONE || rc === ROAD_HIGHWAY) return;
    if (visited.has(i)) return;
    visited.add(i);
    queue.push({ idx: i, dist: 0 });
  };
  // From the building's own tiles (never roads once it stands, but they can
  // be while it is only being previewed), then every tile along its edge: for
  // a one-tile building, itself and its west, east, north and south.
  for (const i of own) seed(i % width, (i - (i % width)) / width);
  for (const i of footprintEdge(width, height, own)) seed(i % width, (i - (i % width)) / width);

  let qi = 0;
  while (qi < queue.length) {
    const { idx, dist } = queue[qi++];
    const rtx = idx % width;
    const rty = (idx - rtx) / width;

    // Mark the road tile and its 1-tile neighborhood as covered.
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = rtx + dx, ny = rty + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
          covered.add(ny * width + nx);
        }
      }
    }

    // Expand to adjacent road tiles within range.
    if (dist < range) {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const nx = rtx + dx, ny = rty + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (roadClass[ni] === ROAD_NONE) continue;
        if (visited.has(ni)) continue;
        visited.add(ni);
        queue.push({ idx: ni, dist: dist + 1 });
      }
    }
  }

  return covered;
}

export class ServiceSystem {
  // Coverage only depends on where the roads and buildings are, so the
  // per-building road walks are redone only when one of those changes; every
  // other tick the layers are refilled from the remembered tiles.
  private _world: World | null = null;
  private _key = NaN;
  private _coverage: { kind: number; tiles: Int32Array }[] = [];

  update(world: World): void {
    const services = world.layers.services;
    const police = world.layers.police;
    const fireStation = world.layers.fireStation;
    const school = world.layers.school;
    const hospital = world.layers.hospital;
    services.fill(0);
    police.fill(0);
    fireStation.fill(0);
    school.fill(0);
    hospital.fill(0);

    // A fingerprint of everything coverage depends on: each road tile and its
    // class, each building and its kind, and the coverage ranges.
    const roadClass = world.layers.roadClass;
    const { roads, roadCount } = world.index;
    let key = 0x811c9dc5 | 0;
    const mix = (v: number) => { key = Math.imul(key ^ v, 0x9e3779b1); key ^= key >>> 15; };
    for (let k = 0; k < roadCount; k++) { mix(roads[k]); mix(roadClass[roads[k]]); }
    mix(roadCount);
    for (const b of world.buildings) {
      mix(b.ty * world.grid.width + b.tx); mix(b.kind);
      mix(BALANCE.service.coverageRange[b.kind] ?? -1);
    }
    mix(world.buildings.length);

    if (world !== this._world || key !== this._key) {
      this._world = world;
      this._key = key;
      this._coverage = [];
      for (const b of world.buildings) {
        if (BALANCE.service.coverageRange[b.kind] === undefined) continue; // not a service building
        this._coverage.push({ kind: b.kind, tiles: Int32Array.from(computeServiceCoverage(world, b.tx, b.ty, b.kind)) });
      }
    }

    for (const { kind, tiles } of this._coverage) {
      const own = kind === BUILDING_POLICE ? police
                : kind === BUILDING_FIRE ? fireStation
                : kind === BUILDING_SCHOOL ? school
                : kind === BUILDING_HOSPITAL ? hospital
                : null;
      for (let k = 0; k < tiles.length; k++) {
        services[tiles[k]] = 1;
        if (own) own[tiles[k]] = 1;
      }
    }

    // Count covered developed zones for HUD stat.
    const zone = world.layers.zone;
    const dev = world.layers.devLevel;
    let covered = 0;
    const { zoned, zonedCount } = world.index;
    for (let k = 0; k < zonedCount; k++) {
      const i = zoned[k];
      if (zone[i] !== ZONE_NONE && dev[i] > 0 && services[i] === 1) covered++;
    }
    world.stats.servicesCoveredZones = covered;
  }
}
