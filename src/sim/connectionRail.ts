// Outside connections, the rail side (CONNECTIONS_DESIGN.md, phase 4): which
// rail points are OPEN. A rail point is open when ground track stands on its
// tile and that track leads, by track and ramps, to a station that a street
// or avenue reaches: only then can anyone who rides in get off. Never in the
// tutorial city.
//
// Worked out from the track and the buildings, and remembered until either
// changes. Nothing is saved.

import type { World } from './World';
import { RAIL_ELEVATED, RAIL_GROUND, RAIL_SUBWAY } from './constants';
import { hasPlatforms, platformLevel, rampLevel, shapeRoles, stationPlatform } from './buildingShapes';
import { LINK_E, LINK_N, LINK_S, LINK_W, railLinks, rampOther } from './rail';
import type { Connection } from './connections';

const NONE: readonly Connection[] = [];
const LEVELS = [RAIL_GROUND, RAIL_ELEVATED, RAIL_SUBWAY];
const slotOf = (level: number): number => (level === RAIL_GROUND ? 0 : level === RAIL_ELEVATED ? 1 : 2);

const cache = new WeakMap<World, { rail: number; edits: number; buildings: number; points: Connection[]; open: readonly Connection[] }>();

/** The rail points riders can come in by: ground track on the tile, leading to a station with a road. */
export function openRails(world: World): readonly Connection[] {
  if (world.connections.length === 0 || world.tutorial || world.railVersion === 0) return NONE;
  const c = cache.get(world);
  if (c && c.rail === world.railVersion && c.edits === world.grid.edits && c.buildings === world.buildings.length && c.points === world.connections) return c.open;
  const open = findOpen(world);
  cache.set(world, { rail: world.railVersion, edits: world.grid.edits, buildings: world.buildings.length, points: world.connections, open });
  return open;
}

/** Whether riders may start on the ground track of tile `i`: only at a rail point with track on it (and not in the tutorial city). */
export function isRailEntryTile(world: World, i: number): boolean {
  if (world.connections.length === 0 || world.tutorial) return false;
  for (const c of world.connections) if (c.tile === i) return c.kind === 'rail' && (world.layers.rail[i] & RAIL_GROUND) !== 0;
  return false;
}

function findOpen(world: World): readonly Connection[] {
  const rail = world.layers.rail;
  const starts = world.connections.filter((c) => c.kind === 'rail' && (rail[c.tile] & RAIL_GROUND) !== 0);
  if (starts.length === 0) return NONE;
  const { width, height } = world.grid;
  const n = width * height;

  // Where riders get off: each station's one track node (as the traffic pass has it), if a road reaches the station.
  const stops = new Set<number>();
  // Ramps join the ground track at one end to the level at the other.
  const ramps = new Map<number, number>();
  for (const b of world.buildings) {
    const anchor = b.ty * width + b.tx;
    const level = rampLevel(b.kind);
    if (level !== 0) {
      const other = rampOther(world, anchor);
      if (other && (rail[anchor] & RAIL_GROUND) && (rail[other.tile] & level)) {
        const a = anchor, z = slotOf(level) * n + other.tile;
        ramps.set(a, z); ramps.set(z, a);
      }
      continue;
    }
    let at = -1;
    if (hasPlatforms(b.kind)) {
      const tiles = world.buildingTilesAt(b.tx, b.ty), roles = shapeRoles(b.kind);
      const platform = tiles.filter((_, k) => roles[k] === 'platform');
      if (platform.length > 0) at = platform[platform.length >> 1];
    } else if (stationPlatform(b.kind, 0).length > 0) {
      const [dx, dy] = stationPlatform(b.kind, b.rot ?? 0)[1], level = platformLevel(b.kind);
      const mid = (b.ty + dy) * width + b.tx + dx;
      if (rail[mid] & level) at = slotOf(level) * n + mid;
    } else continue;
    if (at >= 0 && world.buildingAccessRoads(b.tx, b.ty).length > 0) stops.add(at);
  }
  if (stops.size === 0) return NONE;

  // One walk from each point that has not been reached by an earlier one; points on the same line share the answer.
  const seen = new Int32Array(3 * n);
  const reaches: boolean[] = [false];
  const out: Connection[] = [];
  const stack: number[] = [];
  for (const c of starts) {
    let id = seen[c.tile];
    if (id === 0) {
      id = reaches.length; reaches.push(false);
      seen[c.tile] = id; stack.push(c.tile);
      while (stack.length > 0) {
        const node = stack.pop()!;
        if (stops.has(node)) reaches[id] = true;
        const slot = Math.floor(node / n), i = node - slot * n;
        const links = railLinks(world, i, LEVELS[slot]);
        const base = slot * n;
        if ((links & LINK_W) && seen[base + i - 1] === 0) { seen[base + i - 1] = id; stack.push(base + i - 1); }
        if ((links & LINK_E) && seen[base + i + 1] === 0) { seen[base + i + 1] = id; stack.push(base + i + 1); }
        if ((links & LINK_N) && seen[base + i - width] === 0) { seen[base + i - width] = id; stack.push(base + i - width); }
        if ((links & LINK_S) && seen[base + i + width] === 0) { seen[base + i + width] = id; stack.push(base + i + width); }
        const over = ramps.get(node);
        if (over !== undefined && seen[over] === 0) { seen[over] = id; stack.push(over); }
      }
    }
    if (reaches[id]) out.push(c);
  }
  return out;
}
