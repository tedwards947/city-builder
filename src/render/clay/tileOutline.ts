/**
 * The outline of an arbitrary set of tiles, as unit edges in tile coordinates.
 * Used to trace a cluster of homes (a resident request) rather than a box.
 */
export interface TilePoint { x: number; y: number }
/** One edge of the outline: from (x0, y0) to (x1, y1), in tile corners. */
export interface TileEdge { x0: number; y0: number; x1: number; y1: number }

const key = (x: number, y: number) => x + ',' + y;

/**
 * Every tile side that has no tile of the set on its other side. Runs of
 * collinear sides are joined into one edge, so a dashed stroke reads evenly.
 */
export function tileSetEdges(tiles: readonly TilePoint[]): TileEdge[] {
  const set = new Set<string>();
  for (const t of tiles) set.add(key(t.x, t.y));
  // Horizontal sides keyed by row, vertical sides keyed by column; the sign keeps
  // a top side from joining a bottom side that merely shares its line.
  const horiz = new Map<string, number[]>(), vert = new Map<string, number[]>();
  const push = (m: Map<string, number[]>, k: string, v: number) => { const a = m.get(k); if (a) a.push(v); else m.set(k, [v]); };
  for (const t of tiles) {
    if (!set.has(key(t.x, t.y - 1))) push(horiz, t.y + ':t', t.x);
    if (!set.has(key(t.x, t.y + 1))) push(horiz, (t.y + 1) + ':b', t.x);
    if (!set.has(key(t.x - 1, t.y))) push(vert, t.x + ':l', t.y);
    if (!set.has(key(t.x + 1, t.y))) push(vert, (t.x + 1) + ':r', t.y);
  }
  const out: TileEdge[] = [];
  const runs = (m: Map<string, number[]>, make: (line: number, from: number, to: number) => TileEdge) => {
    for (const [k, vals] of m) {
      const line = parseInt(k, 10);
      const sorted = [...new Set(vals)].sort((a, b) => a - b);
      let from = sorted[0], prev = sorted[0];
      for (let i = 1; i <= sorted.length; i++) {
        if (i < sorted.length && sorted[i] === prev + 1) { prev = sorted[i]; continue; }
        out.push(make(line, from, prev + 1));
        if (i < sorted.length) from = prev = sorted[i];
      }
    }
  };
  runs(horiz, (y, a, b) => ({ x0: a, y0: y, x1: b, y1: y }));
  runs(vert, (x, a, b) => ({ x0: x, y0: a, x1: x, y1: b }));
  return out;
}

/** The smallest rectangle (inclusive tile coordinates) holding every tile, or null for none. */
export function tileSetBounds(tiles: readonly TilePoint[]): { x0: number; y0: number; x1: number; y1: number } | null {
  if (tiles.length === 0) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const t of tiles) { if (t.x < x0) x0 = t.x; if (t.y < y0) y0 = t.y; if (t.x > x1) x1 = t.x; if (t.y > y1) y1 = t.y; }
  return { x0, y0, x1, y1 };
}

/**
 * A coverage request points at a cluster of homes: `homes` are their tile
 * indices and `seed` the home that asked. Other requests have neither.
 */
export interface ClusterFields { seed?: number; homes?: readonly number[] }

/** The asking homes as tiles, or null when the request is a plain area. */
export function clusterTiles(req: ClusterFields, gridWidth: number): TilePoint[] | null {
  if (!req.homes || req.homes.length === 0 || gridWidth <= 0) return null;
  return req.homes.map(i => ({ x: i % gridWidth, y: Math.floor(i / gridWidth) }));
}

/** The tile of the home that asked, or null when the request is a plain area. */
export function seedTile(req: ClusterFields, gridWidth: number): TilePoint | null {
  if (req.seed === undefined || req.seed < 0 || gridWidth <= 0) return null;
  return { x: req.seed % gridWidth, y: Math.floor(req.seed / gridWidth) };
}
