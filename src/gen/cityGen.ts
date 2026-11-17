// Large-city generator: builds a plausible city of a target population on a
// fresh map, through the same commands a player uses, and fast-forwards the
// simulation until it has grown. For benchmarks and balance tests at sizes
// nobody has played to by hand. Run it with `npm run gen-city` (see
// scripts/gen-city.mjs); nothing in the game uses it.
//
// The plan, all from one seed:
//   • Avenues (arterials) in a rough grid, about `spacing` tiles apart, each
//     wandering a few tiles off its line. They bridge short stretches of water
//     and stop at long ones.
//   • The land between them is cut into districts (cells). Districts near the
//     centre are the core; a wedge of the city, on the side with the most
//     water, is industry, with utility yards on either side of it as a buffer;
//     the rest is residential (Hoyt's sector model, roughly).
//   • Each district gets local streets 3 tiles apart (so every lot touches a
//     road), as a grid or as a spine with cul-de-sacs, with some streets cut
//     short. Shops go along the avenues, homes behind them.
//   • Districts are built a few at a time, nearest the centre first. Between
//     batches the simulation runs; power, water and sewage are added in the
//     utility yards whenever supply nears demand, police, fire, schools,
//     hospitals and parks where new lots lack them, and more districts once
//     the empty lots run low or growth stalls, until what is built would hold
//     the target once it fills in. Roads that can't reach the network (cut off
//     by water) are taken out again.
//
// --style picks the layout (grid, suburban, organic, dense-core; see STYLES),
// so tests can compare how coverage and political capital behave across them.
//
// Deterministic: the same options give the same city. The layout uses its own
// random numbers; the simulation uses the world's, as in the game.

import { World } from '../sim/World';
import { mulberry32 } from '../sim/rng';
import {
  TERRAIN_WATER, ZONE_NONE, ZONE_R, ZONE_C, ZONE_I, ROAD_NONE, ROAD_STREET, ROAD_AVENUE, ROAD_HIGHWAY,
  BUILDING_NONE, BUILDING_POWER_PLANT, BUILDING_WATER_TOWER, BUILDING_SEWAGE_PLANT,
  BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL, BUILDING_PARK,
} from '../sim/constants';
import { BALANCE } from '../data/balance';
import { BuildRoadCommand } from '../commands/BuildRoadCommand';
import { PaintZoneCommand } from '../commands/PaintZoneCommand';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { computeServiceCoverage } from '../sim/systems/ServiceSystem';
import { startCity, cityStats } from '../bench/harness';

export interface GenOptions {
  seed: number;
  /** Population to grow to. */
  target: number;
  /** Map width and height. Picked from `target` if left out. */
  size?: number;
  /** Give up after this many sim ticks, whatever the population. */
  maxTicks?: number;
  /**
   * Ticks to keep running once the target is reached, so traffic, land value,
   * education and the rest settle (default 400). Utilities still keep up;
   * nothing else is built.
   */
  settleTicks?: number;
  /** Street layout (default 'grid'); see STYLES. */
  style?: CityStyle;
  /** Tiles between avenues (default from the style). */
  spacing?: number;
  /** Progress lines. */
  log?: (line: string) => void;
}

export interface GenResult {
  world: World;
  population: number;
  ticks: number;
  /** Districts built, by type. */
  districts: Record<string, number>;
}

/**
 * Layouts, so tests can compare how coverage, traffic and political capital
 * behave across them:
 *   grid       avenue grid, district street grids, a third of the suburbs as cul-de-sacs
 *   suburban   wider-spaced avenues, every residential district a spine (collector) with cul-de-sacs off it
 *   organic    avenues that wander further, streets that jog, uneven blocks, more dead ends
 *   dense-core twice as many avenues in a wider centre full of shops, cul-de-sac suburbs outside
 */
export const STYLES = ['grid', 'suburban', 'organic', 'dense-core'] as const;
export type CityStyle = typeof STYLES[number];

interface StyleDef {
  spacing: number;      // tiles between avenues on a 256+ map
  wander: number;       // how far an avenue strays from its line
  bend: number;         // chance per tile that it steps sideways
  coreRadius: number;   // centre districts, in avenue spacings
  coreAvenues: boolean; // an extra avenue between each pair in the centre
  culs: number;         // share of residential districts laid out as spine + cul-de-sacs
  cut: number;          // chance a grid street stops short of an avenue
  jog: number;          // chance per tile that a street jogs a tile sideways
  wideBlock: number;    // chance a block is 3 lots deep instead of 2
  coreShops: number;    // share of centre lots on an avenue zoned for shops
  coreInnerShops: number; // share of the other centre lots zoned for shops
}

const STYLE_DEFS: Record<CityStyle, StyleDef> = {
  'grid':       { spacing: 22, wander: 3, bend: 0.07, coreRadius: 1.1, coreAvenues: false, culs: 0.35, cut: 0.18, jog: 0,    wideBlock: 0,    coreShops: 1,   coreInnerShops: 0.08 },
  'suburban':   { spacing: 28, wander: 3, bend: 0.05, coreRadius: 1.0, coreAvenues: false, culs: 1,    cut: 0.1,  jog: 0,    wideBlock: 0,    coreShops: 1,   coreInnerShops: 0.08 },
  'organic':    { spacing: 22, wander: 6, bend: 0.16, coreRadius: 1.1, coreAvenues: false, culs: 0.25, cut: 0.35, jog: 0.08, wideBlock: 0.25, coreShops: 1,   coreInnerShops: 0.08 },
  'dense-core': { spacing: 22, wander: 3, bend: 0.07, coreRadius: 1.7, coreAvenues: true,  culs: 0.8,  cut: 0.18, jog: 0,    wideBlock: 0,    coreShops: 0.6, coreInnerShops: 0.15 },
};

type DistrictType = 'core' | 'res' | 'industry' | 'utility' | 'none';

interface Cell {
  id: number;
  tiles: number[];      // every tile of the district, water included
  land: number;         // how many of them are land
  cx: number; cy: number;
  dist: number;         // from the city centre, in tiles
  angle: number;        // from the industrial wedge's axis, in degrees (0–180)
  type: DistrictType;
  arterial: number[];   // avenue tiles along its edge
  neighbours: Set<number>;
  built: boolean;
}

const SERVICE_KINDS = [BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL] as const;
const MAX_BRIDGE = 8;              // longest stretch of water an avenue crosses
const LAYOUT_SALT = 0x9E3779B1;

export function defaultSize(target: number): number {
  return target <= 3000 ? 128 : target <= 20000 ? 256 : 512;
}

export function generateCity(opts: GenOptions): GenResult {
  const size = opts.size ?? defaultSize(opts.target);
  const style = STYLE_DEFS[opts.style ?? 'grid'];
  if (!style) throw new Error(`unknown style "${opts.style}" (one of ${STYLES.join(', ')})`);
  const S = opts.spacing ?? Math.round(style.spacing * (size <= 128 ? 16 / 22 : 1));
  const coreR = S * style.coreRadius;
  const maxTicks = opts.maxTicks ?? 12000;
  const settleTicks = opts.settleTicks ?? 400;
  const log = opts.log ?? (() => {});
  const rng = mulberry32((opts.seed ^ LAYOUT_SALT) >>> 0);

  const world = new World(size, size, opts.seed, { waterAmount: 'medium', vegAmount: 'low' });
  const W = size, H = size, N = W * H;
  const L = world.layers;
  const isWater = (i: number) => L.terrain[i] === TERRAIN_WATER;

  // ── Centre and the industrial wedge ──────────────────────────────────────
  let X0 = W >> 1, Y0 = H >> 1;
  for (let r = 0; r < W && isWater(Y0 * W + X0); r++) { X0 = (W >> 1) + r; }
  const cityRadius = Math.min(W * 0.48, Math.sqrt((opts.target / 12) * 2.4 / Math.PI) + S);
  let axis = 0, best = -1;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    let water = 0;
    for (let i = 0; i < N; i += 3) {
      if (!isWater(i)) continue;
      const x = i % W, y = (i - x) / W;
      const d = Math.hypot(x - X0, y - Y0);
      if (d < S || d > cityRadius) continue;
      if (angleBetween(Math.atan2(y - Y0, x - X0), a) < 30) water++;
    }
    const score = water + rng() * 4;
    if (score > best) { best = score; axis = a; }
  }

  // ── Avenues ──────────────────────────────────────────────────────────────
  const art = new Uint8Array(N);
  const lineOffsets = (centre: number, extent: number): number[] => {
    const out: number[] = [];
    const first = centre - Math.floor(centre / S) * S;
    for (let p = first; p < extent; p += S) out.push(p + Math.floor(rng() * 5) - 2);
    return out;
  };
  const layLine = (base: number, horizontal: boolean, within = Infinity) => {
    const path: number[] = [];
    let off = 0;
    const len = horizontal ? W : H;
    for (let t = 0; t < len; t++) {
      const prev = off;
      if (rng() < style.bend) off = Math.max(-style.wander, Math.min(style.wander, off + (rng() < 0.5 ? -1 : 1)));
      const at = (o: number) => {
        const p = base + o;
        if (p < 1 || p >= (horizontal ? H : W) - 1) return -1;
        const [x, y] = horizontal ? [t, p] : [p, t];
        if (within !== Infinity && Math.max(Math.abs(x - X0), Math.abs(y - Y0)) > within) return -1;
        return y * W + x;
      };
      if (off !== prev) { const j = at(prev); if (j >= 0) path.push(j); }
      const j = at(off);
      if (j >= 0) path.push(j);
    }
    // Bridge short stretches of water; leave a gap at long ones.
    let k = 0;
    while (k < path.length) {
      if (!isWater(path[k])) { art[path[k]] = 1; k++; continue; }
      let e = k;
      while (e < path.length && isWater(path[e])) e++;
      if (e - k <= MAX_BRIDGE && k > 0 && e < path.length) for (let q = k; q < e; q++) art[path[q]] = 1;
      k = e;
    }
  };
  const rows = lineOffsets(Y0, H), cols = lineOffsets(X0, W);
  for (const y of rows) layLine(y, true);
  for (const x of cols) layLine(x, false);
  if (style.coreAvenues) {
    // Halfway between each pair of avenues near the centre, out to the next avenue past the core.
    const reach = coreR + (S >> 1);
    for (let k = 1; k < rows.length; k++) { const m = (rows[k - 1] + rows[k]) >> 1; if (Math.abs(m - Y0) < reach) layLine(m, true, reach); }
    for (let k = 1; k < cols.length; k++) { const m = (cols[k - 1] + cols[k]) >> 1; if (Math.abs(m - X0) < reach) layLine(m, false, reach); }
  }

  // ── Districts: the regions the avenues enclose ───────────────────────────
  const cellOf = new Int32Array(N).fill(-1);
  const cells: Cell[] = [];
  const stack: number[] = [];
  for (let s = 0; s < N; s++) {
    if (art[s] || cellOf[s] >= 0) continue;
    const id = cells.length;
    const tiles: number[] = [];
    const visit = (j: number) => { if (!art[j] && cellOf[j] < 0) { cellOf[j] = id; stack.push(j); } };
    cellOf[s] = id; stack.push(s);
    while (stack.length) {
      const i = stack.pop()!;
      tiles.push(i);
      const x = i % W, y = (i - x) / W;
      if (x > 0) visit(i - 1);
      if (x < W - 1) visit(i + 1);
      if (y > 0) visit(i - W);
      if (y < H - 1) visit(i + W);
    }

    let land = 0, sx = 0, sy = 0;
    for (const i of tiles) { const x = i % W; sx += x; sy += (i - x) / W; if (!isWater(i)) land++; }
    const cx = sx / tiles.length, cy = sy / tiles.length;
    const dist = Math.hypot(cx - X0, cy - Y0);
    const angle = angleBetween(Math.atan2(cy - Y0, cx - X0), axis);
    let type: DistrictType;
    if (land < 30 || land > S * S * 4) type = 'none';
    else if (dist < coreR) type = 'core';
    else if (angle < 32) type = 'industry';
    else if (angle < 52) type = 'utility';
    else type = 'res';
    cells.push({ id, tiles, land, cx, cy, dist, angle, type, arterial: [], neighbours: new Set(), built: false });
  }
  for (let i = 0; i < N; i++) {
    if (!art[i]) continue;
    const x = i % W, y = (i - x) / W;
    const near: number[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const c = cellOf[ny * W + nx];
      if (c >= 0 && !near.includes(c)) near.push(c);
    }
    for (const c of near) {
      cells[c].arterial.push(i);
      for (const d of near) if (d !== c) cells[c].neighbours.add(d);
    }
  }

  // ── Building helpers (the player's commands, with the money topped up) ───
  const fund = () => { if (world.budget.money < 1e7) world.budget.money = 1e8; };
  const road = (i: number, cls: number) => { fund(); return new BuildRoadCommand(i % W, (i / W) | 0, cls).execute(world); };
  const zone = (i: number, z: number) => { fund(); return new PaintZoneCommand(i % W, (i / W) | 0, z).execute(world); };
  const place = (i: number, kind: number) => { fund(); return new PlaceBuildingCommand(i % W, (i / W) | 0, kind).execute(world); };
  const accessRoad = (i: number) => {
    const x = i % W, y = (i - x) / W;
    const ok = (j: number) => L.roadClass[j] !== ROAD_NONE && L.roadClass[j] !== ROAD_HIGHWAY;
    return (x > 0 && ok(i - 1)) || (x < W - 1 && ok(i + 1)) || (y > 0 && ok(i - W)) || (y < H - 1 && ok(i + W));
  };
  const freeLot = (i: number) => !isWater(i) && L.roadClass[i] === ROAD_NONE && L.building[i] === BUILDING_NONE;

  const utilitySlots: number[] = [];
  const serviceTargets: number[] = [];

  /**
   * Remove roads just built that can't reach the city's network (an avenue
   * piece cut off by a lake, say). They come back if a later district
   * reaches them. The network is whatever joins the first road built.
   */
  let hub = -1;
  const reach = new Uint8Array(N);
  const pruneCutOff = (built: number[]) => {
    if (hub < 0 || L.roadClass[hub] === ROAD_NONE) {
      // The first district's road nearest the centre.
      let d = Infinity;
      for (const i of built) { const x = i % W, dd = Math.abs(x - X0) + Math.abs((i - x) / W - Y0); if (dd < d) { d = dd; hub = i; } }
      if (hub < 0) return;
    }
    reach.fill(0);
    const isRoad = (j: number) => L.roadClass[j] !== ROAD_NONE && L.roadClass[j] !== ROAD_HIGHWAY;
    const stack = [hub];
    reach[hub] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % W, y = (i - x) / W;
      if (x > 0 && !reach[i - 1] && isRoad(i - 1)) { reach[i - 1] = 1; stack.push(i - 1); }
      if (x < W - 1 && !reach[i + 1] && isRoad(i + 1)) { reach[i + 1] = 1; stack.push(i + 1); }
      if (y > 0 && !reach[i - W] && isRoad(i - W)) { reach[i - W] = 1; stack.push(i - W); }
      if (y < H - 1 && !reach[i + W] && isRoad(i + W)) { reach[i + W] = 1; stack.push(i + W); }
    }
    for (const i of built) if (!reach[i] && isRoad(i)) new BulldozeCommand(i % W, (i / W) | 0).execute(world);
  };

  /** Local streets for one district, as tile indices. Streets that can't reach an avenue are dropped. */
  const planStreets = (c: Cell): number[] => {
    const inCell = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && cellOf[y * W + x] === c.id && !isWater(y * W + x);
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (const i of c.tiles) { const x = i % W, y = (i - x) / W; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const horizontal = rng() < 0.5;
    // Work in (u, v): u along the parallel streets, v across them.
    const [u0, u1, v0, v1] = horizontal ? [x0, x1, y0, y1] : [y0, y1, x0, x1];
    const tile = (u: number, v: number) => horizontal ? [u, v] : [v, u];
    const plan = new Set<number>();
    const put = (u: number, v: number) => { const [x, y] = tile(u, v); if (inCell(x, y)) plan.add(y * W + x); };
    const culs = c.type === 'res' && rng() < style.culs;
    const spine = (u0 + u1) >> 1;
    for (let v = v0 + 2; v <= v1 - 1; v += rng() < style.wideBlock ? 4 : 3) {
      // Each parallel street runs the width of the district; some stop short of an avenue.
      let a = u0, b = u1;
      if (culs) {
        if (rng() < 0.7) a = Math.min(spine, u0 + 2 + Math.floor(rng() * 3));
        if (rng() < 0.7) b = Math.max(spine, u1 - 2 - Math.floor(rng() * 3));
      } else if (rng() < style.cut) {
        if (rng() < 0.5) a += 2 + Math.floor(rng() * 4); else b -= 2 + Math.floor(rng() * 4);
      }
      // Organic streets jog a tile to one side and back now and then.
      let jog = 0;
      for (let u = a; u <= b; u++) {
        if (style.jog && rng() < style.jog) {
          const next = jog === 0 ? (rng() < 0.5 ? -1 : 1) : 0;
          put(u, v + jog);
          jog = next;
        }
        put(u, v + jog);
      }
    }
    // Cross streets: a spine for cul-de-sac districts, otherwise every 9–13 tiles, some only part way.
    const crosses = culs ? [spine] : [];
    if (!culs) for (let u = u0 + 6 + Math.floor(rng() * 5); u < u1 - 4; u += 9 + Math.floor(rng() * 5)) crosses.push(u);
    for (const u of crosses) {
      let a = v0, b = v1;
      if (!culs && rng() < 0.3) { const m = v0 + Math.floor(rng() * (v1 - v0)); if (rng() < 0.5) a = m; else b = m; }
      for (let v = a; v <= b; v++) put(u, v);
    }
    // Keep only what connects to an avenue around the district.
    const keep = new Set<number>();
    const queue: number[] = [];
    for (const i of plan) {
      const x = i % W, y = (i - x) / W;
      const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = x + dx, ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < W && ny < H && art[ny * W + nx] === 1;
      });
      if (touches) { keep.add(i); queue.push(i); }
    }
    while (queue.length) {
      const i = queue.pop()!;
      const x = i % W, y = (i - x) / W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
        if (j >= 0 && plan.has(j) && !keep.has(j)) { keep.add(j); queue.push(j); }
      }
    }
    return [...keep].sort((p, q) => p - q);
  };

  const buildCell = (c: Cell) => {
    c.built = true;
    const built: number[] = [];
    for (const i of c.arterial) if (road(i, ROAD_AVENUE)) built.push(i);
    for (const i of planStreets(c)) if (road(i, ROAD_STREET)) built.push(i);
    pruneCutOff(built);
    const lots = c.tiles.filter((i) => freeLot(i) && accessRoad(i));
    if (c.type === 'utility') { utilitySlots.push(...lots); return; }
    const onAvenue = (i: number) => {
      const x = i % W, y = (i - x) / W;
      return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = x + dx, ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < W && ny < H && L.roadClass[ny * W + nx] === ROAD_AVENUE;
      });
    };
    // Shops along the avenues, more of them while shops are in demand.
    const s = world.stats;
    const shopShare = Math.max(0.15, Math.min(0.85, 0.4 * s.cDemand / Math.max(0.25, s.rDemand)));
    for (const i of lots) {
      let z: number;
      if (c.type === 'industry') z = ZONE_I;
      else if (c.type === 'core') z = rng() < (onAvenue(i) ? style.coreShops : style.coreInnerShops) ? ZONE_C : ZONE_R;
      else z = onAvenue(i) && rng() < shopShare ? ZONE_C : ZONE_R;
      if (zone(i, z)) serviceTargets.push(i);
    }
  };

  /** Police, fire, schools and hospitals where the zoned lots lack them, then parks among the homes. */
  const placeServices = () => {
    const placed: Record<number, number> = {};
    const kinds: number[] = [...SERVICE_KINDS, BUILDING_PARK];
    for (const kind of kinds) {
      const range = BALANCE.service.coverageRange[kind] ?? 4;
      const wants = (i: number) => L.zone[i] !== ZONE_NONE && L.building[i] === BUILDING_NONE
        && (L.zone[i] !== ZONE_I || kind === BUILDING_POLICE || kind === BUILDING_FIRE)
        && (kind !== BUILDING_PARK || L.zone[i] === ZONE_R);
      const covered = new Uint8Array(N);
      for (const b of world.buildings) {
        if (b.kind !== kind) continue;
        for (const j of computeServiceCoverage(world, b.tx, b.ty, kind)) covered[j] = 1;
      }
      const minGain = kind === BUILDING_PARK ? 30 : 10;
      for (const u of serviceTargets) {
        if (covered[u] || !wants(u)) continue;
        // Try lots spread over the square around u that the building could reach it from.
        const ux = u % W, uy = (u - ux) / W;
        const r = Math.max(2, range - 2);
        const lots: number[] = [];
        for (let y = Math.max(0, uy - r); y <= Math.min(H - 1, uy + r); y++) {
          for (let x = Math.max(0, ux - r); x <= Math.min(W - 1, ux + r); x++) {
            const t = y * W + x;
            if (Math.abs(x - ux) + Math.abs(y - uy) > r) continue;
            if (freeLot(t) && accessRoad(t) && L.devLevel[t] === 0 && L.zone[t] !== ZONE_I && !covered[t]) lots.push(t);
          }
        }
        let bestTile = -1, bestGain = 0, bestSet: Set<number> | null = null;
        const tries = Math.min(lots.length, 14);
        const offset = Math.floor(rng() * Math.max(1, lots.length));
        for (let k = 0; k < tries; k++) {
          const t = lots[(offset + Math.floor(k * lots.length / tries)) % lots.length];
          const set = computeServiceCoverage(world, t % W, (t / W) | 0, kind);
          let gain = 0;
          for (const j of set) if (!covered[j] && wants(j)) gain++;
          if (gain > bestGain) { bestGain = gain; bestTile = t; bestSet = set; }
        }
        if (bestTile < 0 || bestGain < minGain) { covered[u] = 1; continue; }
        if (!place(bestTile, kind)) { covered[u] = 1; continue; }
        placed[kind] = (placed[kind] ?? 0) + 1;
        for (const j of bestSet!) covered[j] = 1;
      }
    }
    return placed;
  };

  /** Power, water and sewage: keep supply a step ahead of demand. */
  const utilities: [number, number, () => number, () => number][] = [
    [BUILDING_POWER_PLANT, BALANCE.power.plantOutput, () => world.stats.powerSupply, () => world.stats.powerDemand],
    [BUILDING_WATER_TOWER, BALANCE.water.towerOutput, () => world.stats.waterSupply, () => world.stats.waterDemand],
    [BUILDING_SEWAGE_PLANT, BALANCE.sewage.plantOutput, () => world.stats.sewageSupply, () => world.stats.sewageDemand],
  ];
  let outOfYard = false;
  const topUpUtilities = (): boolean => {
    let short = false;
    for (const [kind, output, supply, demand] of utilities) {
      let have = supply();
      const want = demand() * 1.12 + output;
      while (have < want) {
        // Power plants (they pollute) go nearest the industry, the rest furthest from it.
        let pick = -1, key = Infinity;
        for (let k = 0; k < utilitySlots.length; k++) {
          const t = utilitySlots[k];
          if (!freeLot(t) || !accessRoad(t)) continue;
          const x = t % W, y = (t - x) / W;
          const a = angleBetween(Math.atan2(y - Y0, x - X0), axis);
          const kk = kind === BUILDING_POWER_PLANT ? a - Math.hypot(x - X0, y - Y0) * 0.05 : -a;
          if (kk < key) { key = kk; pick = t; }
        }
        if (pick < 0 || !place(pick, kind)) { short = true; break; }
        have += output;
      }
    }
    if (short && !outOfYard) { outOfYard = true; log('  utility yards are full; adding one'); }
    if (!short) outOfYard = false;
    return short;
  };

  // ── Grow the city ────────────────────────────────────────────────────────
  const counts: Record<string, number> = {};
  const nextCell = (prefer: DistrictType | null): Cell | null => {
    const anyBuilt = cells.some((c) => c.built);
    let pick: Cell | null = null, pickScore = Infinity, pref: Cell | null = null, prefScore = Infinity;
    for (const c of cells) {
      if (c.built || c.type === 'none') continue;
      if (anyBuilt && ![...c.neighbours].some((n) => cells[n].built)) continue;
      const score = c.dist + (c.id * 2654435761 % 97) / 97 * S * 0.4;
      if (score < pickScore) { pickScore = score; pick = c; }
      if (c.type === prefer && score < prefScore) { prefScore = score; pref = c; }
    }
    if (pref && pick && prefScore <= pickScore + S * 2.5) return pref;
    return pick;
  };
  const build = (c: Cell) => { buildCell(c); counts[c.type] = (counts[c.type] ?? 0) + 1; };
  /** Build toward the nearest district of type `t` until one is built (a few districts at most). */
  const buildType = (t: DistrictType): boolean => {
    for (let k = 0; k < 20; k++) {
      const c = nextCell(t);
      if (!c) return false;
      build(c);
      if (c.type === t) return true;
    }
    return false;
  };

  const city = startCity(world);
  // Build while what is built would not hold the target once it fills in,
  // then let it fill in. Room to grow is estimated from the homes not yet at
  // the top level; `fill` is the share of that room that ends up used.
  const fill = 0.9;
  const top = BALANCE.growth.popPerLevel[BALANCE.growth.maxLevel] ?? 20;
  const room = () => {
    let homes = 0, emptyR = 0, emptyC = 0, emptyI = 0, zonedR = 0;
    for (const i of serviceTargets) {
      const z = L.zone[i];
      if (L.abandoned[i]) continue;
      if (z === ZONE_R) {
        zonedR++;
        if (L.devLevel[i] === 0) emptyR++;
        homes += top - (BALANCE.growth.popPerLevel[L.devLevel[i]] ?? 0);
      } else if (z === ZONE_C && L.devLevel[i] === 0) emptyC++;
      else if (z === ZONE_I && L.devLevel[i] === 0) emptyI++;
    }
    return { homes, emptyR, emptyC, emptyI, zonedR };
  };

  const projected = () => world.stats.population + room().homes * fill;

  // Start with the core (as much of it as the target needs) and the nearest yard and industry.
  for (let c = nextCell(null); c && c.type === 'core'; c = nextCell(null)) {
    build(c);
    if (projected() >= opts.target) break;
  }
  if (!cells.some((c) => c.built)) { const c = nextCell(null); if (c) build(c); }
  buildType('utility');
  buildType('industry');
  placeServices();
  topUpUtilities();

  let lastPop = 0, lastCheck = 0, stalls = 0, building = true, settledFrom = -1;
  while (world.tick < maxTicks) {
    city.tick(10);
    const short = topUpUtilities();
    if (world.tick - lastCheck < 50 && !short) continue;
    const pop = world.stats.population;
    const r = room();
    const grew = pop - lastPop;
    stalls = grew < Math.max(20, pop * 0.004) ? stalls + 1 : 0;
    lastPop = pop; lastCheck = world.tick;
    const s = world.stats;
    const willHold = pop + r.homes * fill;

    if (!building) {
      // Filling in. Done once growth has stopped (or the target is passed) and
      // it has had settleTicks to settle; back to building if it fell short.
      if (short && buildType('utility')) { placeServices(); continue; }
      if (pop < opts.target * 0.95 && stalls >= 3 && nextCell(null)) { building = true; settledFrom = -1; }
      else {
        if (settledFrom < 0 && (stalls >= 3 || pop >= opts.target)) settledFrom = world.tick;
        if (settledFrom >= 0 && world.tick - settledFrom >= settleTicks) break;
        continue;
      }
    }
    if (willHold >= opts.target) {
      building = false;
      log(`tick ${world.tick}  pop ${pop}  enough built for about ${Math.round(willHold)}; letting it fill in`);
      continue;
    }
    const roomy = r.emptyR > Math.max(60, r.zonedR * 0.22) && stalls < 3;
    if (roomy && !short) continue;

    // Build about a quarter as much again, leaning to whatever is in demand.
    const before = serviceTargets.length;
    let added = 0;
    while (serviceTargets.length - before < Math.max(150, before * 0.25) && projected() < opts.target) {
      const prefer: DistrictType | null = short ? 'utility'
        : s.iDemand > 1.3 && r.emptyI < 40 ? 'industry'
        : null;
      const c = nextCell(prefer);
      if (!c) break;
      build(c);
      added++;
      if (short && c.type === 'utility') break;
    }
    const placed = placeServices();
    log(`tick ${world.tick}  pop ${pop}  demand R ${s.rDemand.toFixed(2)} C ${s.cDemand.toFixed(2)} I ${s.iDemand.toFixed(2)}  `
      + `empty lots R ${r.emptyR} C ${r.emptyC} I ${r.emptyI}  +${added} districts  services ${JSON.stringify(placed)}`);
    if (added === 0) {
      if (stalls >= 6) { log('  no room left to build; stopping'); break; }
    } else stalls = 0;
  }

  world.budget.money = 250_000;
  log(`done at tick ${world.tick}: population ${world.stats.population}, districts ${JSON.stringify(counts)}`);
  log(JSON.stringify(cityStats(world)));
  return { world, population: world.stats.population, ticks: world.tick, districts: counts };
}

/** The angle between two directions, in degrees (0–180). */
function angleBetween(a: number, b: number): number {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d * 180 / Math.PI;
}
