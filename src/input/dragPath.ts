// Pure tile-path helpers for drag-to-paint. No DOM, no world access.

export interface TilePos { tx: number; ty: number }

/**
 * All tiles on the line from `a` to `b`, inclusive of both ends, in order.
 * The path is 4-connected (each step moves along exactly one axis), so a fast
 * drag between two pointer samples leaves no gaps and no diagonal-only joins —
 * which matters for roads, where diagonal neighbours are not connected.
 */
export function tilesBetween(a: TilePos, b: TilePos): TilePos[] {
  const out: TilePos[] = [{ tx: a.tx, ty: a.ty }];
  const dx = Math.abs(b.tx - a.tx);
  const dy = Math.abs(b.ty - a.ty);
  const sx = b.tx > a.tx ? 1 : -1;
  const sy = b.ty > a.ty ? 1 : -1;
  let tx = a.tx, ty = a.ty;
  let ix = 0, iy = 0;
  while (ix < dx || iy < dy) {
    // Step along whichever axis is further behind the ideal line.
    // Compare (ix + 0.5) / dx with (iy + 0.5) / dy without dividing.
    if (iy >= dy || (ix < dx && (1 + 2 * ix) * dy <= (1 + 2 * iy) * dx)) {
      tx += sx; ix++;
    } else {
      ty += sy; iy++;
    }
    out.push({ tx, ty });
  }
  return out;
}

export type Axis = 'x' | 'y';

/**
 * Which axis a straight-line (road) drag should lock to, given where it
 * started and where the pointer is now. Returns null while the pointer is
 * still on the start tile. Ties go to the x axis.
 */
export function dominantAxis(start: TilePos, current: TilePos): Axis | null {
  const dx = Math.abs(current.tx - start.tx);
  const dy = Math.abs(current.ty - start.ty);
  if (dx === 0 && dy === 0) return null;
  return dx >= dy ? 'x' : 'y';
}

/**
 * Tiles of a straight line from `start` toward `current`, constrained to
 * `axis`, inclusive of the start tile, ordered outward from the start.
 */
export function axisLockedLine(start: TilePos, current: TilePos, axis: Axis): TilePos[] {
  const end: TilePos = axis === 'x'
    ? { tx: current.tx, ty: start.ty }
    : { tx: start.tx, ty: current.ty };
  return tilesBetween(start, end);
}
