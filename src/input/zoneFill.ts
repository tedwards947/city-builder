// Zone fill mode: point beside a road and click, and the lots along that side
// of the road are zoned in one go. This file is the pure part: which tiles a
// fill takes, and what it costs.
//
// The fill follows ONE road, the one the pointed-at lot touches. It walks
// along that road both ways from the pointer, keeping to the pointer's side
// (like walking with one hand on a wall), and takes the lot beside each road
// tile, up to `reach` lots each way. So:
//   - it follows bends, on the inside and the outside;
//   - inside a ring of road it fills the inner edge, outside it the outer edge;
//   - where a side street joins on the pointer's side, it turns into it;
//   - it stops at a dead end: it does not go round the end of the road, and it
//     never jumps to the frontage of another road that happens to be near;
//   - a highway is not followed (highways give zones no access).
// Pointing at the road itself fills nothing: it does not say which side is
// meant. Pointing at the lot facing the end of a dead-end road takes that lot.
//
// A strip of lots with a road on both sides (a "sandwich") is filled as just
// that strip: the fill stops where either road ends or turns away.
//
// Only empty, unzoned land is zoned, never anything else: a fill does not
// overwrite. Anything already zoned, built on or under water is walked past
// and left alone.

import type { World } from '../sim/World';
import { ROAD_NONE, ROAD_HIGHWAY, ZONE_NONE, ZONE_R, ZONE_C } from '../sim/constants';
import { BALANCE } from '../data/balance';
import type { TilePos } from './dragPath';

/** How the zone tools paint: by dragging over tiles, or by filling along a road. */
export type ZoneMode = 'drag' | 'fill';

/** How many lots a fill reaches along the road, each way from the pointer. */
export const ZONE_FILL_REACH = 8;
/** A pointer this close to a frontage tile (in tiles) still counts as pointing at it. */
const SNAP = 2;

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Whether the tile is a street or avenue. */
function accessAt(world: World, tx: number, ty: number): boolean {
  if (!world.grid.inBounds(tx, ty)) return false;
  const rc = world.layers.roadClass[world.grid.idx(tx, ty)];
  return rc !== ROAD_NONE && rc !== ROAD_HIGHWAY;
}

/** Whether the tile is not a road and touches a street or avenue. */
export function isFrontage(world: World, tx: number, ty: number): boolean {
  const { grid } = world;
  if (!grid.inBounds(tx, ty)) return false;
  if (world.layers.roadClass[grid.idx(tx, ty)] !== ROAD_NONE) return false;
  for (const [dx, dy] of N4) if (accessAt(world, tx + dx, ty + dy)) return true;
  return false;
}

/** Whether the tile has a street or avenue on both its west and east side. */
function sandwichedX(world: World, tx: number, ty: number): boolean {
  return accessAt(world, tx - 1, ty) && accessAt(world, tx + 1, ty);
}
/** Whether the tile has a street or avenue on both its north and south side. */
function sandwichedY(world: World, tx: number, ty: number): boolean {
  return accessAt(world, tx, ty - 1) && accessAt(world, tx, ty + 1);
}

/** Where a fill from `hover` starts: the frontage under or nearest the pointer. None when pointing at a road. */
function seed(world: World, hover: TilePos): TilePos | null {
  const { grid } = world;
  if (!grid.inBounds(hover.tx, hover.ty)) return null;
  if (world.layers.roadClass[grid.idx(hover.tx, hover.ty)] !== ROAD_NONE) return null;
  let best: TilePos | null = null, bestD = Infinity;
  for (let dy = -SNAP; dy <= SNAP; dy++) {
    for (let dx = -SNAP; dx <= SNAP; dx++) {
      const d = dx * dx + dy * dy;
      if (d < bestD && isFrontage(world, hover.tx + dx, hover.ty + dy)) {
        best = { tx: hover.tx + dx, ty: hover.ty + dy };
        bestD = d;
      }
    }
  }
  return best;
}

/**
 * Every lot a fill from `hover` reaches, whatever is on it, the pointed-at one
 * first. Empty if the pointer is not beside (or within two tiles of) a street
 * or avenue.
 */
export function zoneFillReach(world: World, hover: TilePos, reach = ZONE_FILL_REACH): TilePos[] {
  const { grid } = world;
  const start = seed(world, hover);
  if (!start) return [];
  const out: TilePos[] = [start];
  const taken = new Set<number>([grid.idx(start.tx, start.ty)]);
  // Started between two roads: stay between those two roads.
  const keepX = sandwichedX(world, start.tx, start.ty);
  const keepY = sandwichedY(world, start.tx, start.ty);

  /**
   * Walk along the road from road tile (rx, ry), travelling (tx, ty), with the
   * lots on side (sx, sy). The side keeps its hand (left or right of travel)
   * through every turn.
   */
  const walk = (rx: number, ry: number, tx: number, ty: number, sx: number, sy: number): void => {
    let lots = 0;
    // Each turn or step is one iteration; the bound only guards against a bug looping forever.
    for (let guard = 0; guard < reach * 8 && lots < reach; guard++) {
      if (accessAt(world, rx + sx, ry + sy)) {
        // The road turns (or a side street joins) on our side: go round the inside of the corner.
        rx += sx; ry += sy;
        const ntx = sx, nty = sy;
        sx = -tx; sy = -ty;
        tx = ntx; ty = nty;
        continue;
      }
      // The lot beside this road tile.
      const lx = rx + sx, ly = ry + sy;
      if (!grid.inBounds(lx, ly)) return;
      if (world.layers.roadClass[grid.idx(lx, ly)] !== ROAD_NONE) return;   // a highway: not ours to follow
      if ((keepX && !sandwichedX(world, lx, ly)) || (keepY && !sandwichedY(world, lx, ly))) return;
      const li = grid.idx(lx, ly);
      if (!taken.has(li)) {
        taken.add(li);
        out.push({ tx: lx, ty: ly });
        lots++;
      }
      if (accessAt(world, rx + tx, ry + ty)) {
        rx += tx; ry += ty;                               // straight on
      } else if (accessAt(world, rx - sx, ry - sy)) {
        // The road turns away from our side: go round the outside of the corner.
        const ntx = -sx, nty = -sy;
        sx = tx; sy = ty;
        tx = ntx; ty = nty;
      } else {
        return;                                           // dead end
      }
    }
  };

  for (const [dx, dy] of N4) {
    const rx = start.tx + dx, ry = start.ty + dy;
    if (!accessAt(world, rx, ry)) continue;
    const sx = -dx, sy = -dy;                             // from the road tile toward the lot
    // The two ways along the road, as seen from the lot.
    const ways = [[-sy, sx], [sy, -sx]] as const;
    // A road tile with nothing either way along it is the end of a road
    // pointing at the lot: the lot faces a dead end, and is all there is.
    const behind = accessAt(world, rx - sx, ry - sy);
    for (const [tx, ty] of ways) {
      const ahead = accessAt(world, rx + tx, ry + ty);
      const otherWay = accessAt(world, rx - tx, ry - ty);
      if (ahead) walk(rx + tx, ry + ty, tx, ty, sx, sy);
      else if (behind && otherWay) {
        // The road turns away from the lot right here: round the outside of the corner.
        walk(rx, ry, -sx, -sy, tx, ty);
      }
    }
  }
  return out;
}

export interface ZoneFillPlan {
  /** The tiles that will be zoned. */
  tiles: TilePos[];
  cost: number;
  affordable: boolean;
}

/** What a fill of `zone` from `hover` would zone and cost. Reads the world, changes nothing. */
export function planZoneFill(world: World, hover: TilePos, zone: number, reach = ZONE_FILL_REACH): ZoneFillPlan {
  const tiles = zoneFillReach(world, hover, reach).filter(({ tx, ty }) =>
    world.isBuildable(tx, ty) && world.layers.zone[world.grid.idx(tx, ty)] === ZONE_NONE);
  const each = zone === ZONE_R ? BALANCE.costs.zoneR : zone === ZONE_C ? BALANCE.costs.zoneC : BALANCE.costs.zoneI;
  const cost = tiles.length * each;
  return { tiles, cost, affordable: world.budget.money >= cost };
}
