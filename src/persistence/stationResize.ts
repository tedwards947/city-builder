// Save version 9 → 10: the train stations shrank (the owner's station resize).
//
//   Straight: was a 4×3 block with the platform along its middle row (4
//     tiles), anchored at its top-left. Now 3 platform tiles in a row,
//     anchored at one end.
//   Curved: was a 3×3 block. Now its top-left 2×2 (same anchor, same platform).
//   Subway: the platform went from 4 tiles to 3; nothing is stored for it.
//
// Each new shape lies INSIDE the old one, on the same track, so every station
// of an old city fits: it keeps its place on the line, the tiles it gives up
// become empty land, and the platform tile a straight station gives up stays
// as plain track. Nothing is removed and nothing is refunded.
//
// A shrunk station would lose any road that ran along its old outer wall, one
// tile away now. So where a street or avenue ended against the old building
// across a tile that is now free and beside the platform, that tile becomes a
// street: the station keeps its road.
//
// Works on the saved layers alone (no World), like the other upgrades.

import type { WorldSnapshot } from './SaveFormat';

const STATION = 14, STATION_L = 15, SUBWAY_STATION = 18;
const RAIL_GROUND = 1, ROAD_STREET = 1, ROAD_AVENUE = 2;

type Offset = readonly [number, number];
/** One quarter turn clockwise takes (dx, dy) to (−dy, dx), as in sim/buildingShapes.ts. */
const turn = ([dx, dy]: Offset, rot: number): Offset =>
  (rot === 1 ? [-dy, dx] : rot === 2 ? [-dx, -dy] : rot === 3 ? [dy, -dx] : [dx, dy]);

const block = (w: number, h: number): Offset[] => {
  const out: Offset[] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push([dx, dy]);
  return out;
};

interface Plan {
  /** Every tile of the old shape. */
  old: Offset[];
  /** The tiles the station keeps. */
  keep: Offset[];
  /** Where the anchor moves to (an offset from the old one). */
  anchor: Offset;
  /** Freed tiles beside the platform, each with the tile just outside the old shape beyond it; grouped by side. */
  stubs: { tile: Offset; outside: Offset }[][];
}

const PLANS: Record<number, Plan> = {
  [STATION]: {
    old: block(4, 3),
    keep: [[0, 1], [1, 1], [2, 1]],
    anchor: [0, 1],
    stubs: [
      [0, 1, 2].map(dx => ({ tile: [dx, 0] as Offset, outside: [dx, -1] as Offset })),
      [0, 1, 2].map(dx => ({ tile: [dx, 2] as Offset, outside: [dx, 3] as Offset })),
    ],
  },
  [STATION_L]: {
    old: block(3, 3),
    keep: [[0, 0], [1, 0], [0, 1], [1, 1]],
    anchor: [0, 0],
    stubs: [
      [{ tile: [2, 0], outside: [3, 0] }, { tile: [2, 1], outside: [3, 1] }],
      [{ tile: [0, 2], outside: [0, 3] }, { tile: [1, 2], outside: [1, 3] }],
    ],
  },
};

/**
 * The snapshot with every train station in its new, smaller shape, and a note
 * of how many stations (subway ones included: their platform shrank too) were
 * rebuilt, for the notice shown once after loading. The input is not changed.
 */
export function shrinkStations(snap: WorldSnapshot): WorldSnapshot {
  let rebuilt = snap.buildings.filter(b => b.kind === SUBWAY_STATION).length;
  if (!snap.buildings.some(b => PLANS[b.kind])) return rebuilt > 0 ? { ...snap, upgradeNotes: { ...snap.upgradeNotes, stationsRebuilt: rebuilt } } : snap;
  const { width, height } = snap;
  const building = new Uint8Array(snap.layers.building);
  const roadClass = new Uint8Array(snap.layers.roadClass);
  const visualVariant = new Uint8Array(snap.layers.visualVariant);
  const rail = snap.layers.rail;
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= width || y >= height ? -1 : y * width + x);
  const crossing = (i: number): boolean => i >= 0 && roadClass[i] !== 0 && !!rail && (rail[i] & RAIL_GROUND) !== 0;

  const buildings = snap.buildings.map((b) => {
    const plan = PLANS[b.kind];
    if (!plan) return b;
    const rot = (b.rot ?? 0) & 3;
    const tile = (o: Offset): number => { const [dx, dy] = turn(o, rot); return at(b.tx + dx, b.ty + dy); };
    const old = plan.old.map(tile);
    // Only a station that really stands in the old shape (a damaged save is left alone).
    if (old.some(i => i < 0 || building[i] !== b.kind)) return b;
    const keep = new Set(plan.keep.map(tile));
    for (const i of old) if (!keep.has(i)) { building[i] = 0; visualVariant[i] = 0; }
    for (const side of plan.stubs) {
      for (const s of side) {
        const i = tile(s.tile), out = tile(s.outside);
        if (out < 0 || (roadClass[out] !== ROAD_STREET && roadClass[out] !== ROAD_AVENUE) || crossing(out)) continue;
        // Not next to a level crossing: a road joining one from the side would break it.
        const x = i % width, y = (i - x) / width;
        if ([at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].some(crossing)) continue;
        roadClass[i] = ROAD_STREET;
        break;
      }
    }
    rebuilt++;
    const [ax, ay] = turn(plan.anchor, rot);
    return { ...b, tx: b.tx + ax, ty: b.ty + ay };
  });
  return {
    ...snap, buildings, layers: { ...snap.layers, building, roadClass, visualVariant },
    ...(rebuilt > 0 ? { upgradeNotes: { ...snap.upgradeNotes, stationsRebuilt: rebuilt } } : {}),
  };
}
