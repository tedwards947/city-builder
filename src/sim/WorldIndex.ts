// Where the city actually is.
//
// The map can be 512×512 while the city covers a few percent of it. Systems
// that loop over every tile every tick spend nearly all their time on empty
// land. This index lists the tiles that matter, so they can loop over those:
//
//   roads   every road tile
//   zoned   every zoned tile (any level, abandoned or not)
//   bounds  the rectangle containing every road, zone and building
//   area()  that rectangle as it has EVER been since this world was created
//           (it only grows), optionally padded — the part of the map where
//           per-tile state can be anything other than "empty land"
//
// Most systems keep per-tile state (crime, education, distress, coverage…)
// that is only ever non-zero on or near something built, and that takes a
// few ticks to fade after a bulldoze. Looping over area() instead of the
// whole map therefore gives exactly the same result: everything outside it
// has never been built on, so there is nothing there to update. That is also
// why area() never shrinks — a district that was just demolished still has
// state to wind down.
//
// The lists say what a tile WAS when the index was built; read the layers for
// what it is now. During a sim tick the Scheduler builds the index once and
// pins it (`world.pinIndex()`), so all systems share one scan. A system may
// change levels or abandon lots mid-tick; nothing in the sim adds a road,
// zone or building mid-tick (only player commands do, between ticks), so the
// lists stay complete for the tick. Outside a pinned tick — tests, tools —
// `world.index` rebuilds on every access, so it can never be stale.

import type { World } from './World';
import { ROAD_NONE, ZONE_NONE, BUILDING_NONE } from './constants';

export class WorldIndex {
  roads: Int32Array;
  roadCount = 0;
  zoned: Int32Array;
  zonedCount = 0;
  // Inclusive bounds of everything built; x1 < x0 when the map is empty.
  x0 = 0; y0 = 0; x1 = -1; y1 = -1;
  // The same, as a running union over every rebuild (never shrinks).
  private ax0 = 0; private ay0 = 0; private ax1 = -1; private ay1 = -1;
  private seeded = false;

  constructor(n: number) {
    this.roads = new Int32Array(n);
    this.zoned = new Int32Array(n);
  }

  rebuild(world: World): void {
    const { width, height } = world.grid;
    const roadClass = world.layers.roadClass;
    const zone = world.layers.zone;
    const building = world.layers.building;
    const roads = this.roads, zoned = this.zoned;
    let roadCount = 0, zonedCount = 0;
    let x0 = width, y0 = height, x1 = -1, y1 = -1;

    for (let y = 0; y < height; y++) {
      const row = y * width;
      let first = -1, last = -1;
      for (let x = 0; x < width; x++) {
        const i = row + x;
        const rc = roadClass[i], z = zone[i];
        if (rc === ROAD_NONE && z === ZONE_NONE && building[i] === BUILDING_NONE) continue;
        if (rc !== ROAD_NONE) roads[roadCount++] = i;
        if (z !== ZONE_NONE) zoned[zonedCount++] = i;
        if (first < 0) first = x;
        last = x;
      }
      if (first < 0) continue;
      if (first < x0) x0 = first;
      if (last > x1) x1 = last;
      if (y < y0) y0 = y;
      y1 = y;
    }

    this.roadCount = roadCount;
    this.zonedCount = zonedCount;
    if (x1 < 0) { this.x0 = 0; this.y0 = 0; this.x1 = -1; this.y1 = -1; }
    else {
      this.x0 = x0; this.y0 = y0; this.x1 = x1; this.y1 = y1;
      this.include(x0, y0, x1, y1);
    }

    // The first time, also take in any tile that still carries state from
    // something since demolished (a loaded save can have crime or distress
    // winding down where nothing stands any more).
    if (!this.seeded) {
      this.seeded = true;
      const L = world.layers;
      const state = [L.devLevel, L.abandoned, L.distress, L.crime, L.education, L.sickness, L.recentDeath, L.fire, L.fireRisk];
      for (let y = 0; y < height; y++) {
        const row = y * width;
        let first = -1, last = -1;
        for (let x = 0; x < width; x++) {
          const i = row + x;
          let any = 0;
          for (let k = 0; k < state.length; k++) any |= state[k][i];
          if (any === 0) continue;
          if (first < 0) first = x;
          last = x;
        }
        if (first >= 0) this.include(first, y, last, y);
      }
    }
  }

  private include(x0: number, y0: number, x1: number, y1: number): void {
    if (this.ax1 < this.ax0) { this.ax0 = x0; this.ay0 = y0; this.ax1 = x1; this.ay1 = y1; return; }
    if (x0 < this.ax0) this.ax0 = x0;
    if (y0 < this.ay0) this.ay0 = y0;
    if (x1 > this.ax1) this.ax1 = x1;
    if (y1 > this.ay1) this.ay1 = y1;
  }

  /**
   * Everything that has ever been built on, grown by `pad` tiles and clipped
   * to the map. Loop over this (row by row, so tile order is the same as a
   * whole-map loop) instead of over every tile. Empty map → empty rectangle.
   */
  area(world: World, pad = 0): { x0: number; y0: number; x1: number; y1: number } {
    if (this.ax1 < this.ax0) return { x0: 0, y0: 0, x1: -1, y1: -1 };
    const { width, height } = world.grid;
    return {
      x0: Math.max(0, this.ax0 - pad),
      y0: Math.max(0, this.ay0 - pad),
      x1: Math.min(width - 1, this.ax1 + pad),
      y1: Math.min(height - 1, this.ay1 + pad),
    };
  }

  /**
   * The built rectangle grown by `pad` tiles and clipped to the map, for
   * systems whose effects reach beyond the tiles that cause them (pollution,
   * land value, coverage radii). Empty map → an empty rectangle.
   */
  padded(world: World, pad: number): { x0: number; y0: number; x1: number; y1: number } {
    if (this.x1 < this.x0) return { x0: 0, y0: 0, x1: -1, y1: -1 };
    const { width, height } = world.grid;
    return {
      x0: Math.max(0, this.x0 - pad),
      y0: Math.max(0, this.y0 - pad),
      x1: Math.min(width - 1, this.x1 + pad),
      y1: Math.min(height - 1, this.y1 + pad),
    };
  }
}
