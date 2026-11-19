// NOTE: the shipped showcase is now the owner's hand-built city; this builds a generated one.
// The title screen's showcase city (TODO DESIGN j): a big, live city behind
// the logo for the camera to tour. Built by script, so it can be rebuilt when
// the game changes: `npm run gen-showcase` (scripts/gen-showcase.mjs) writes
// public/showcase.citysave.json.
//
// On top of the large-city generator's dense-core city (src/gen/cityGen.ts):
//   • a seaport by the industry and an airport near the homes, at the sites
//     the Balance Lab's own probes pick (src/balance/trade.ts, airport.ts);
//   • two train lines between straight stations, laid with the rail tool's
//     Auto search (src/input/autoRail.ts); the second must cross the first,
//     which Auto does with ramps and an elevated stretch;
//   • a subway line between two subway stations;
//   • tree belts where homes meet open land and around industry, and the
//     generator's parks;
//   • then the real simulation runs until traffic, riders and the vibes
//     settle. Construction money is topped up, as the generator does; the
//     city then runs on its own money and must end in surplus.
//
// Deterministic: the same options give the same city.

import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import {
  BUILDING_RAMP_ELEVATED, BUILDING_STATION, BUILDING_SUBWAY_STATION, BUILDING_NONE,
  RAIL_ELEVATED, RAIL_GROUND, RAIL_SUBWAY, ROAD_AVENUE, ROAD_NONE, ROAD_HIGHWAY, ROAD_STREET, TERRAIN_WATER,
  VEG_NONE, ZONE_C, ZONE_I, ZONE_NONE, ZONE_R,
} from '../sim/constants';
import { mulberry32 } from '../sim/rng';
import { generateCity, type CityStyle } from './cityGen';
import { startSim, type Sim } from '../balance/world';
import { placeAirport } from '../balance/airport';
import { placeSeaport } from '../balance/trade';
import { cityStations, stationEnds } from '../balance/rail';
import { autoRailPath, type AutoRailStep } from '../input/autoRail';
import { BuildTrackCommand } from '../commands/BuildTrackCommand';
import { BuildRoadCommand } from '../commands/BuildRoadCommand';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { PlantTreesCommand } from '../commands/TreeCommands';
import { canHoldTree } from '../sim/landscaping';

export interface ShowcaseOptions {
  seed?: number;
  /** The generator's layout (default dense-core: tall towers downtown). */
  style?: CityStyle;
  /** Population the generator grows to before the extras go in. */
  target?: number;
  /** Days of the real simulation after the extras, so it settles. */
  settleDays?: number;
  /** Rounds of widening jammed streets to avenues (default 2). */
  widenRounds?: number;
  log?: (line: string) => void;
}

export interface ShowcaseReport {
  population: number;
  money: number;
  /** Money a day over the last 10 settle days. */
  surplusPerDay: number;
  politicalCapital: number;
  pcCap: number;
  abandoned: number;
  /** Developed lots at level 3, by zone. */
  level3: { R: number; C: number; I: number };
  /** Road tiles with congestion ≥ 200 (out of 255): the visible jams. */
  jammedRoads: number;
  /** Of those, avenue tiles. */
  jammedAvenues: number;
  /** Road tiles in all, and avenue tiles. */
  roads: number;
  avenues: number;
  /** Tiles of track by level, and stations. */
  track: { ground: number; elevated: number; subway: number };
  stations: number;
  subwayStations: number;
  riders: number;
  seaport: boolean;
  airport: boolean;
  trees: number;
  parks: number;
  notes: string[];
}

const isStreet = (w: World, i: number) => w.layers.roadClass[i] !== ROAD_NONE && w.layers.roadClass[i] !== ROAD_HIGHWAY;

/** Lay an Auto line as the rail tool does: ramps whole from their low end, track tile by tile. */
function layLine(sim: Sim, steps: AutoRailStep[]): boolean {
  const w = sim.world;
  sim.history.beginBatch();
  for (const s of steps) {
    const cmd = s.ramp === 'low' ? new PlaceBuildingCommand(s.tx, s.ty, BUILDING_RAMP_ELEVATED, s.rot ?? 0)
      : s.ramp === 'high' ? null
      : (w.getRail(s.tx, s.ty) & s.level) !== 0 ? null
      : new BuildTrackCommand(s.tx, s.ty, s.level);
    if (cmd && !sim.history.run(cmd)) { sim.history.cancelBatch(); return false; }
  }
  sim.history.endBatch();
  return true;
}

const pos = (w: World, i: number) => ({ tx: i % w.grid.width, ty: Math.floor(i / w.grid.width) });
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Whether the straight segment from a to b passes within a tile of any of `tiles`. */
function crosses(w: World, a: { x: number; y: number }, b: { x: number; y: number }, tiles: Set<number>): boolean {
  const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  for (let k = 0; k <= steps; k++) {
    const x = Math.round(a.x + (b.x - a.x) * k / steps), y = Math.round(a.y + (b.y - a.y) * k / steps);
    if (tiles.has(w.grid.idx(x, y))) return true;
  }
  return false;
}

type Pt = { x: number; y: number };
interface Line { stations: Pt[]; tiles: Set<number> }
/** Elevated tiles to look for on the second line: enough for the camera to find. */
const ELEVATED_WANT = 12;

/**
 * A train line between two new straight stations, `lo`–`hi` tiles apart, or
 * null. With `cross`, only a pair on either side of that line, and only if
 * Auto bridges it with elevated track.
 */
function trainLine(sim: Sim, lo: number, hi: number, cross: Line | null, log: (s: string) => void): Line | null {
  const w = sim.world;
  const avoid = cross?.stations ?? [];
  const sites = cityStations(w).filter(s => avoid.every(a => dist(a, s) > 12));
  // Without `cross`: the first pair that works. With it: of the pairs that bridge the line,
  // the one with the longest elevated stretch (up to ELEVATED_WANT tiles), so it shows.
  let best: { west: Pt; east: Pt; up: number } | null = null;
  const tryPair = (west: Pt, east: Pt, lay: boolean): number => {
    if (!w.checkPlacement(west.x, west.y, BUILDING_STATION, 0).ok || !w.checkPlacement(east.x, east.y, BUILDING_STATION, 0).ok) return -1;
    if (!sim.history.run(new PlaceBuildingCommand(west.x, west.y, BUILDING_STATION, 0))) return -1;
    if (!sim.history.run(new PlaceBuildingCommand(east.x, east.y, BUILDING_STATION, 0))) { sim.history.undo(); return -1; }
    const path = autoRailPath(w, pos(w, stationEnds(w, west).east), pos(w, stationEnds(w, east).west), RAIL_GROUND);
    const up = path && path.length <= hi * 2 ? path.filter(s => s.level === RAIL_ELEVATED).length : -1;
    if (lay && path && up >= 0 && layLine(sim, path)) {
      log(`train line: stations at ${west.x},${west.y} and ${east.x},${east.y}, ${path.length} tiles, ${up} elevated`);
      laid = new Set(path.map(s => w.grid.idx(s.tx, s.ty)));
      return up;
    }
    sim.history.undo(); sim.history.undo();
    return lay ? -1 : up;
  };
  let laid: Set<number> | null = null;
  const reach = cross ? 40 : 20;
  for (const a of sites.slice(0, reach)) {
    for (const b of sites.filter(s => { const d = dist(a, s); return d >= lo && d <= hi; }).slice(0, reach)) {
      if (Math.abs(a.y - b.y) < 3 && Math.abs(a.x - b.x) < 8) continue;
      if (cross && !crosses(w, { x: a.x + 2, y: a.y + 1 }, { x: b.x + 2, y: b.y + 1 }, cross.tiles)) continue;
      const [west, east] = a.x <= b.x ? [a, b] : [b, a];
      if (!cross) { if (tryPair(west, east, true) >= 0) return { stations: [west, east], tiles: laid! }; continue; }
      const up = Math.min(ELEVATED_WANT, tryPair(west, east, false));
      if (up > 0 && (!best || up > best.up)) best = { west, east, up };
      if (best && best.up >= ELEVATED_WANT) break;
    }
    if (best && best.up >= ELEVATED_WANT) break;
  }
  if (best && tryPair(best.west, best.east, true) >= 0) return { stations: [best.west, best.east], tiles: laid! };
  return null;
}

/**
 * An elevated line: two straight stations `lo`–`hi` tiles apart, a ramp up just
 * past one platform end and a ramp down just before the other, and elevated
 * track between them laid by Auto (over roads and open land; never over
 * buildings or zones). Auto never builds one by itself here: a ground line
 * finds its way round. Null if no pair works.
 */
function elevatedLine(sim: Sim, lo: number, hi: number, avoid: Pt[], log: (s: string) => void): Line | null {
  const w = sim.world, { width } = w.grid;
  const sites = cityStations(w).filter(s => avoid.every(a => dist(a, s) > 12));
  for (const a of sites.slice(0, 30)) {
    for (const b of sites.filter(s => { const d = dist(a, s); return d >= lo && d <= hi && s.x - a.x >= 12; }).slice(0, 30)) {
      const e1 = stationEnds(w, a).east, w1 = stationEnds(w, b).west;   // a is west of b
      sim.history.beginBatch();
      const ok = sim.history.run(new PlaceBuildingCommand(a.x, a.y, BUILDING_STATION, 0))
        && sim.history.run(new PlaceBuildingCommand(b.x, b.y, BUILDING_STATION, 0))
        && sim.history.run(new PlaceBuildingCommand((e1 + 1) % width, Math.floor(e1 / width), BUILDING_RAMP_ELEVATED, 0))   // high end east
        && sim.history.run(new PlaceBuildingCommand((w1 - 1) % width, Math.floor(w1 / width), BUILDING_RAMP_ELEVATED, 2))   // high end west
        && sim.history.run(new BuildTrackCommand(e1 % width, Math.floor(e1 / width), RAIL_GROUND))
        && sim.history.run(new BuildTrackCommand(w1 % width, Math.floor(w1 / width), RAIL_GROUND));
      const path = ok ? autoRailPath(w, pos(w, e1 + 3), pos(w, w1 - 3), RAIL_ELEVATED) : null;
      if (path && path.length <= hi * 2) {
        for (const st of path) {
          if ((w.getRail(st.tx, st.ty) & st.level) !== 0) continue;
          if (!sim.history.run(new BuildTrackCommand(st.tx, st.ty, st.level))) { sim.history.cancelBatch(); continue; }
        }
        sim.history.endBatch();
        log(`elevated line: stations at ${a.x},${a.y} and ${b.x},${b.y}, ${path.length} elevated tiles`);
        return { stations: [a, b], tiles: new Set(path.map(st => w.grid.idx(st.tx, st.ty))) };
      }
      sim.history.cancelBatch();
    }
  }
  return null;
}

/** A free tile beside a street, near (cx, cy), whose subway platform (4 tiles east–west) fits under the map. */
function subwaySite(w: World, cx: number, cy: number, r: number, avoid: number[]): number {
  const { width, height } = w.grid;
  let best = -1, bd = Infinity;
  for (let y = Math.max(1, cy - r); y <= Math.min(height - 2, cy + r); y++) for (let x = Math.max(3, cx - r); x <= Math.min(width - 4, cx + r); x++) {
    const i = y * width + x;
    const L = w.layers;
    if (L.terrain[i] === TERRAIN_WATER || L.building[i] !== BUILDING_NONE || L.roadClass[i] !== ROAD_NONE || L.rail[i]) continue;
    if (L.zone[i] !== ZONE_NONE && L.devLevel[i] > 0) continue;
    if (![i - 1, i + 1, i - width, i + width].some(j => isStreet(w, j))) continue;
    if (avoid.some(a => Math.abs(a % width - x) + Math.abs(Math.floor(a / width) - y) < 8)) continue;
    const d = Math.abs(x - cx) + Math.abs(y - cy);
    if (d < bd && w.checkPlacement(x, y, BUILDING_SUBWAY_STATION, 0).ok) { bd = d; best = i; }
  }
  return best;
}

/** A subway line between two subway stations, one in the downtown core and one 30–60 tiles out. */
function subwayLine(sim: Sim, cx: number, cy: number, log: (s: string) => void): boolean {
  const w = sim.world, { width } = w.grid;
  let a = -1;
  for (const r of [8, 16, 24, 32]) if ((a = subwaySite(w, cx, cy, r, [])) >= 0) break;
  if (a < 0) return false;
  const ax = a % width, ay = Math.floor(a / width);
  for (const [dx, dy] of [[40, 0], [-40, 0], [0, 40], [0, -40], [30, 30], [-30, 30], [30, -30], [-30, -30]]) {
    const b = subwaySite(w, ax + dx, ay + dy, 12, [a]);
    if (b < 0) continue;
    const [west, east] = a % width <= b % width ? [a, b] : [b, a];
    if (!sim.history.run(new PlaceBuildingCommand(west % width, Math.floor(west / width), BUILDING_SUBWAY_STATION, 0))) continue;
    if (!sim.history.run(new PlaceBuildingCommand(east % width, Math.floor(east / width), BUILDING_SUBWAY_STATION, 0))) { sim.history.undo(); continue; }
    // From just past the west station's east platform end to just past the east station's west end.
    const path = autoRailPath(w, pos(w, west + 3), pos(w, east - 2), RAIL_SUBWAY);
    if (path && layLine(sim, path)) { log(`subway: stations at ${pos(w, west).tx},${pos(w, west).ty} and ${pos(w, east).tx},${pos(w, east).ty}, ${path.length} tiles`); return true; }
    sim.history.undo(); sim.history.undo();
  }
  return false;
}

/** Trees on free land beside homes and shops (some of it) and round industry (most of it). */
function plantTrees(sim: Sim, rng: () => number): number {
  const w = sim.world, { width, height } = w.grid, L = w.layers;
  const near = (i: number, r: number, zone: number) => {
    const x = i % width, y = Math.floor(i / width);
    for (let yy = Math.max(0, y - r); yy <= Math.min(height - 1, y + r); yy++) for (let xx = Math.max(0, x - r); xx <= Math.min(width - 1, x + r); xx++) {
      const j = yy * width + xx; if (L.zone[j] === zone && L.devLevel[j]) return true;
    }
    return false;
  };
  const bySpecies: number[][] = [[], [], [], [], [], [], []];
  for (let i = 0; i < L.zone.length; i++) {
    if (L.vegetation[i] !== VEG_NONE || !canHoldTree(w, i)) continue;
    const p = near(i, 3, ZONE_I) ? 0.85 : (near(i, 2, ZONE_R) || near(i, 2, ZONE_C)) ? 0.55 : 0;
    if (rng() < p) bySpecies[1 + Math.floor(rng() * 6)].push(i);
  }
  let n = 0;
  for (let s = 1; s <= 6; s++) if (bySpecies[s].length && sim.history.run(new PlantTreesCommand(bySpecies[s], s))) n += bySpecies[s].length;
  return n;
}

export function buildShowcase(opts: ShowcaseOptions = {}): { world: World; report: ShowcaseReport } {
  const seed = opts.seed ?? 3, log = opts.log ?? (() => {});
  const { world } = generateCity({ seed, target: opts.target ?? 19000, style: opts.style ?? 'dense-core', size: 256, log: undefined });
  log(`generated: ${world.stats.population} residents`);
  const notes: string[] = [];
  const sim = startSim(world);
  const fund = () => { if (world.budget.money < 5e6) world.budget.money = 5e6; };
  const pc = () => { world.budget.politicalCapital = Math.max(world.budget.politicalCapital, 1e6); };
  const money0 = world.budget.money, pc0 = world.budget.politicalCapital;
  fund(); pc();

  // Middle of the shops: the downtown core.
  const { width } = world.grid;
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < world.layers.zone.length; i++) if (world.layers.zone[i] === ZONE_C && world.layers.devLevel[i]) { sx += i % width; sy += Math.floor(i / width); n++; }
  const cx = Math.round(sx / Math.max(1, n)), cy = Math.round(sy / Math.max(1, n));

  const seaport = placeSeaport(world);
  if (!seaport) notes.push('no seaport site');
  const airport = placeAirport(world);
  if (!airport) notes.push('no airport site');
  log(`seaport ${seaport}, airport ${airport}`);

  const line1 = trainLine(sim, 45, 90, null, log);
  if (!line1) notes.push('no first train line');
  const line2 = elevatedLine(sim, 25, 70, line1?.stations ?? [], log) ?? trainLine(sim, 30, 90, line1, log);
  if (!line2) notes.push('no second train line');
  if (!subwayLine(sim, cx, cy, log)) notes.push('no subway line');

  const trees = plantTrees(sim, mulberry32(seed ^ 0x7EE5));
  log(`planted ${trees} trees`);

  // Traffic: settle, then widen the worst streets to avenues, as a player would, so a few
  // busy avenues stay jammed but the city doesn't seize up. Twice.
  for (let round = 0; round < (opts.widenRounds ?? 2); round++) {
    for (let d = 0; d < 20; d++) { sim.tick(BALANCE.ticksPerDay); fund(); pc(); }
    let widened = 0;
    for (let i = 0; i < world.layers.roadClass.length; i++) {
      if (world.layers.roadClass[i] !== ROAD_STREET || world.layers.congestion[i] < 200) continue;
      if (sim.history.run(new BuildRoadCommand(i % width, Math.floor(i / width), ROAD_AVENUE))) widened++;
    }
    log(`round ${round + 1}: widened ${widened} jammed street tiles to avenue`);
  }

  // The construction is paid for; the city now runs on its own money and political capital.
  world.budget.money = Math.max(money0, 250_000);
  world.budget.politicalCapital = pc0;
  const days = opts.settleDays ?? 60;
  let m10 = 0;
  for (let d = 0; d < days; d++) {
    if (d === days - 10) m10 = world.budget.money;
    sim.tick(BALANCE.ticksPerDay);
  }

  const L = world.layers;
  const level3 = { R: 0, C: 0, I: 0 };
  let abandoned = 0, jammed = 0, jammedAv = 0, roads = 0, avenues = 0, ground = 0, elevated = 0, subway = 0, treeCount = 0;
  for (let i = 0; i < L.zone.length; i++) {
    if (L.abandoned[i]) abandoned++;
    if (L.devLevel[i] === 3 && !L.abandoned[i]) { if (L.zone[i] === ZONE_R) level3.R++; else if (L.zone[i] === ZONE_C) level3.C++; else if (L.zone[i] === ZONE_I) level3.I++; }
    if (L.roadClass[i] !== ROAD_NONE) { roads++; if (L.roadClass[i] === ROAD_AVENUE) avenues++; if (L.congestion[i] >= 200) { jammed++; if (L.roadClass[i] === ROAD_AVENUE) jammedAv++; } }
    if (L.rail[i] & RAIL_GROUND) ground++;
    if (L.rail[i] & RAIL_ELEVATED) elevated++;
    if (L.rail[i] & RAIL_SUBWAY) subway++;
    if (L.vegetation[i] !== VEG_NONE) treeCount++;
  }
  const kinds = (k: number) => world.buildings.filter(b => b.kind === k).length;
  const report: ShowcaseReport = {
    population: world.stats.population,
    money: Math.round(world.budget.money),
    surplusPerDay: Math.round((world.budget.money - m10) / 10),
    politicalCapital: Math.round(world.budget.politicalCapital),
    pcCap: Math.round(BALANCE.politicalCapital.max + world.stats.population * BALANCE.politicalCapital.capPerResident),
    abandoned, level3, jammedRoads: jammed, jammedAvenues: jammedAv, roads, avenues,
    track: { ground, elevated, subway },
    stations: kinds(BUILDING_STATION), subwayStations: kinds(BUILDING_SUBWAY_STATION),
    riders: Math.round(world.traffic?.rail.boardings ?? 0),
    seaport, airport, trees: treeCount, parks: kinds(8), notes,
  };
  return { world, report };
}
