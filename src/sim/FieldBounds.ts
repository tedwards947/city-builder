// Where a per-tile field is anything other than its resting value.
//
// Pollution rests at 0 and the vibe layers at 128; both spread outward from
// the city by diffusion, a tile per step, so they are not confined to the
// built-up area the way most state is. A system that owns such a field finds
// the rectangle where it is "live" with scan(), then works on that rectangle
// (grown by one tile for a diffusion step) instead of the whole map — and
// still gets exactly the whole-map result, because everything outside is at
// rest and stays there.
//
// scan() looks at the whole layer every time, so nothing can go stale: a
// value written straight into the layer by other code is found on the next
// scan. It is cheap because it compares four tiles at a time and almost all
// of the map matches the resting value (about 0.05 ms for a 512×512 layer).

export interface Rect { x0: number; y0: number; x1: number; y1: number }

export class FieldBounds {
  // Inclusive; x1 < x0 when nothing is live.
  x0 = 0; y0 = 0; x1 = -1; y1 = -1;

  get empty(): boolean { return this.x1 < this.x0; }

  /** Number of tiles inside the bounds. */
  get tileCount(): number { return this.empty ? 0 : (this.x1 - this.x0 + 1) * (this.y1 - this.y0 + 1); }

  /** Set the bounds to the tiles of `layer` that differ from `resting`. */
  scan(layer: Uint8Array, width: number, resting: number): void {
    const n = layer.length;
    let x0 = width, y0 = -1, x1 = -1, y1 = -1;
    const visit = (i: number) => {
      if (layer[i] === resting) return;
      const x = i % width, y = (i - x) / width;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y0 < 0) y0 = y; // i only increases, so the first row seen is the top
      y1 = y;
    };

    let done = 0;
    if (layer.byteOffset % 4 === 0) {
      // Four tiles per comparison: a word of four resting bytes needs no closer look.
      const words = new Uint32Array(layer.buffer, layer.byteOffset, n >> 2);
      const restingWord = (resting * 0x01010101) >>> 0;
      for (let w = 0; w < words.length; w++) {
        if (words[w] === restingWord) continue;
        const i = w << 2;
        visit(i); visit(i + 1); visit(i + 2); visit(i + 3);
      }
      done = words.length << 2;
    }
    for (let i = done; i < n; i++) visit(i);

    if (x1 < 0) { this.x0 = 0; this.y0 = 0; this.x1 = -1; this.y1 = -1; }
    else { this.x0 = x0; this.y0 = y0; this.x1 = x1; this.y1 = y1; }
  }

  /** The bounds as a rectangle (empty when nothing is live). */
  rect(): Rect {
    return { x0: this.x0, y0: this.y0, x1: this.x1, y1: this.y1 };
  }
}

/** The smallest rectangle containing both (either may be empty). */
export function unionRect(a: Rect, b: Rect): Rect {
  if (a.x1 < a.x0) return b;
  if (b.x1 < b.x0) return a;
  return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
}

/** `r` grown by `pad` tiles and clipped to the map (empty stays empty). */
export function growRect(r: Rect, width: number, height: number, pad: number): Rect {
  if (r.x1 < r.x0) return r;
  return {
    x0: Math.max(0, r.x0 - pad),
    y0: Math.max(0, r.y0 - pad),
    x1: Math.min(width - 1, r.x1 + pad),
    y1: Math.min(height - 1, r.y1 + pad),
  };
}
