// The title screen's camera tour: WHERE to look. Reads the live city and
// lists the spots worth showing: jams and the busiest roads, the airport, the
// seaport, the busiest stations, clusters of towers, and one wide view of the
// whole town. Pure: reads the world, changes nothing.

import type { World } from '../sim/World';
import { BUILDING_AIRPORT, BUILDING_SEAPORT, BUILDING_STATION, BUILDING_STATION_L, BUILDING_SUBWAY_STATION, ROAD_NONE, ZONE_NONE } from '../sim/constants';
import { buildingShape } from '../sim/buildingShapes';
import { roadCapacity, trafficVolume } from '../sim/TrafficData';
import { focusMarkers } from '../sim/markers';

export type SpotKind = 'focus' | 'jam' | 'busyRoad' | 'airport' | 'seaport' | 'station' | 'towers' | 'overview';

export interface TourSpot {
  kind: SpotKind;
  /** The tile to centre on (may be fractional). */
  tx: number;
  ty: number;
  /** The zoom to view it at, on a desktop-sized window (the tour scales it for small ones). */
  zoom: number;
  /** How much it deserves a visit, 0–1: the chance of being picked goes with it. */
  score: number;
}

/** Zoom per kind of spot: close on a jam or a station, wider on the airport, widest for the whole town. */
export const SPOT_ZOOM: Record<SpotKind, number> = {
  focus: 2.2, jam: 2.6, busyRoad: 2.2, station: 2.4, seaport: 2, towers: 2, airport: 1.6, overview: 0.9,
};

// Roads and towers are judged per square of this many tiles, so that one long jam is one spot, not twenty.
const CELL = 12;
const MAX_JAMS = 4, MAX_BUSY = 4, MAX_STATIONS = 3, MAX_TOWERS = 3;
/** Fewest tower lots in a square for it to count as a cluster. */
const MIN_TOWERS = 3;
/** The development level of a tower. */
const TOWER_LEVEL = 3;

const rankScore = (rank: number): number => 1 / (1 + rank);

/** The city's focus markers (sim/markers.ts) as spots, in the order they were placed. */
export function focusSpots(world: World): TourSpot[] {
  return focusMarkers(world).map(m => ({ kind: 'focus' as const, tx: m.x, ty: m.y, zoom: m.zoom ?? SPOT_ZOOM.focus, score: 1 }));
}

/**
 * The spots the tour visits. A city with focus markers is toured by those
 * alone, in order (`nextTourSpot`); a single marker takes turns with the
 * spots found from the city, since one place is no tour. With no markers,
 * the spots found from the city. Never empty.
 */
export function findTourSpots(world: World): TourSpot[] {
  const focus = focusSpots(world);
  if (focus.length >= 2) return focus;
  return [...focus, ...findCitySpots(world)];
}

/** Every spot worth a look in `world` right now, found from the live city, in no particular order. Never empty. */
export function findCitySpots(world: World): TourSpot[] {
  const { width, height } = world.grid;
  const L = world.layers, d = world.traffic;
  const spots: TourSpot[] = [];
  const add = (kind: SpotKind, tx: number, ty: number, score: number): void => {
    spots.push({ kind, tx, ty, zoom: SPOT_ZOOM[kind], score });
  };

  // ── Roads and towers, per square ────────────────────────────────────────────
  const cw = Math.ceil(width / CELL), ch = Math.ceil(height / CELL);
  const load = new Float32Array(cw * ch), loadAt = new Int32Array(cw * ch).fill(-1);
  const volume = new Float32Array(cw * ch), volumeAt = new Int32Array(cw * ch).fill(-1);
  const towers = new Uint16Array(cw * ch), towerX = new Float64Array(cw * ch), towerY = new Float64Array(cw * ch);
  let built = 0, builtX = 0, builtY = 0;
  for (let y = 0; y < height; y++) {
    const cy = (y / CELL) | 0;
    for (let x = 0; x < width; x++) {
      const i = y * width + x, c = cy * cw + ((x / CELL) | 0);
      const road = L.roadClass[i];
      if (road !== ROAD_NONE) {
        built++; builtX += x; builtY += y;
        const v = d ? trafficVolume(d, i) : 0;
        if (v > 0) {
          const l = v / roadCapacity(road);
          if (l > load[c]) { load[c] = l; loadAt[c] = i; }
          if (v > volume[c]) { volume[c] = v; volumeAt[c] = i; }
        }
      } else if (L.zone[i] !== ZONE_NONE && L.devLevel[i] > 0) {
        built++; builtX += x; builtY += y;
        if (L.devLevel[i] >= TOWER_LEVEL) { towers[c]++; towerX[c] += x; towerY[c] += y; }
      }
    }
  }
  const cells = Array.from({ length: cw * ch }, (_, c) => c);
  const top = (by: (c: number) => number, min: number, count: number, skip?: Set<number>): number[] =>
    cells.filter(c => by(c) >= min && !skip?.has(c)).sort((a, b) => by(b) - by(a)).slice(0, count);

  const jams = top(c => load[c], 1, MAX_JAMS);
  jams.forEach((c, rank) => add('jam', loadAt[c] % width, (loadAt[c] / width) | 0, rankScore(rank)));
  top(c => volume[c], 1e-6, MAX_BUSY, new Set(jams))
    .forEach((c, rank) => add('busyRoad', volumeAt[c] % width, (volumeAt[c] / width) | 0, 0.7 * rankScore(rank)));
  top(c => towers[c], MIN_TOWERS, MAX_TOWERS)
    .forEach((c, rank) => add('towers', towerX[c] / towers[c], towerY[c] / towers[c], 0.9 * rankScore(rank)));

  // ── Buildings ───────────────────────────────────────────────────────────────
  const centre = (tx: number, ty: number, kind: number, rot = 0): { x: number; y: number } => {
    // The middle of the box round its shape.
    let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
    for (const [dx, dy] of buildingShape(kind, rot)) { x0 = Math.min(x0, dx); y0 = Math.min(y0, dy); x1 = Math.max(x1, dx); y1 = Math.max(y1, dy); }
    return { x: tx + (x0 + x1) / 2, y: ty + (y0 + y1) / 2 };
  };
  const stations: { x: number; y: number; riders: number }[] = [];
  for (const b of world.buildings) {
    if (b.kind === BUILDING_AIRPORT || b.kind === BUILDING_SEAPORT) {
      const at = centre(b.tx, b.ty, b.kind, b.rot);
      add(b.kind === BUILDING_AIRPORT ? 'airport' : 'seaport', at.x, at.y, 1);
    } else if (b.kind === BUILDING_STATION || b.kind === BUILDING_STATION_L || b.kind === BUILDING_SUBWAY_STATION) {
      const anchor = b.ty * width + b.tx;
      const riders = d?.rail.stations.find(s => s.anchor === anchor)?.boardings ?? 0;
      const at = centre(b.tx, b.ty, b.kind, b.rot);
      stations.push({ x: at.x, y: at.y, riders });
    }
  }
  stations.sort((a, b) => b.riders - a.riders).slice(0, MAX_STATIONS)
    .forEach((s, rank) => add('station', s.x, s.y, (s.riders > 0 ? 1 : 0.4) * rankScore(rank)));

  // ── The whole town (or, with nothing built, the middle of the map) ──────────
  if (built > 0) add('overview', builtX / built, builtY / built, 0.5);
  else add('overview', width / 2, height / 2, 0.5);
  return spots;
}

/** Spots nearer than this many tiles count as the same place. */
const SAME_PLACE = 10;
/** How many spots back the tour remembers, so as not to return to one too soon. */
export const TOUR_MEMORY = 3;

const near = (a: TourSpot, b: TourSpot): boolean => Math.abs(a.tx - b.tx) < SAME_PLACE && Math.abs(a.ty - b.ty) < SAME_PLACE;

/**
 * The spot to visit next. `recent` is the spots already shown, newest last.
 * Never the place just shown (when there is any other), and where the city
 * offers the choice not one of the last few places nor the same KIND of spot
 * twice running. Among what is left the pick is random, weighted by score;
 * `random` returns 0–1. Null only when `spots` is empty.
 *
 * FOCUS spots (placed by hand) come first and in their own order: where there
 * are any, the next one after the focus spot last shown is the pick, round
 * and round. Only when the spot just shown was a focus spot and the list also
 * holds other kinds (a city with a single marker) does one of those others
 * get a turn.
 */
export function nextTourSpot(spots: readonly TourSpot[], recent: readonly TourSpot[], random: () => number = Math.random): TourSpot | null {
  if (spots.length === 0) return null;
  const last = recent[recent.length - 1];
  const focus = spots.filter(s => s.kind === 'focus');
  if (focus.length > 0) {
    const others = spots.filter(s => s.kind !== 'focus');
    if (last?.kind !== 'focus' || others.length === 0) {
      let shown = -1;
      for (let k = recent.length - 1; k >= 0 && shown < 0; k--) {
        if (recent[k].kind === 'focus') shown = focus.findIndex(s => s.tx === recent[k].tx && s.ty === recent[k].ty);
      }
      return focus[(shown + 1) % focus.length];
    }
    spots = others;
  }
  const lately = recent.slice(-TOUR_MEMORY);
  let pool = spots.filter(s => !lately.some(r => near(s, r)) && (!last || s.kind !== last.kind));
  if (pool.length === 0) pool = spots.filter(s => !lately.some(r => near(s, r)));
  if (pool.length === 0 && last) pool = spots.filter(s => !near(s, last));
  if (pool.length === 0) pool = spots.slice();
  let total = 0;
  for (const s of pool) total += Math.max(s.score, 0.01);
  let roll = random() * total;
  for (const s of pool) {
    roll -= Math.max(s.score, 0.01);
    if (roll <= 0) return s;
  }
  return pool[pool.length - 1];
}
