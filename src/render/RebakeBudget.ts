// Zoom smoothing for anything cached at a tile size (building sprites, tree
// clumps, cars).
//
// Re-making every cached picture on every wheel step is what made zooming
// stutter. Instead: while the tile size is changing, draw what you have,
// stretched; once the size has held still for a moment, re-make the pictures
// at the new size, a few per frame.
//
//   const rebake = new RebakeBudget(24);
//   // once per frame, before drawing:
//   rebake.begin(tile, now);
//   // when a cached picture was made at another size:
//   if (rebake.allow(tile)) { ...re-make it at `tile`... } else { ...draw it stretched... }

export class RebakeBudget {
  private readonly perFrame: number;
  private readonly settleMs: number;
  private size = -1;     // tile size of the frame in progress; -1 = begin() never called
  private since = 0;     // when the tile size last changed (ms)
  private left = 0;      // re-makes still allowed this frame

  /** `perFrame` re-makes are allowed per frame once the size has held still for `settleMs`. */
  constructor(perFrame: number, settleMs = 120) {
    this.perFrame = perFrame;
    this.settleMs = settleMs;
  }

  /** Call once per frame before drawing, with the tile size and the frame's time in ms. */
  begin(size: number, now: number): void {
    if (size !== this.size) { this.size = size; this.since = now; }
    this.left = now - this.since >= this.settleMs ? this.perFrame : 0;
  }

  /**
   * Whether a picture cached at another size may be re-made at `size` right
   * now. Uses up one of the frame's re-makes. A caller drawing at a size other
   * than the frame's (or one that never calls `begin`) is always allowed: it
   * is not part of the zoom being smoothed.
   */
  allow(size: number): boolean {
    if (size !== this.size) return true;
    if (this.left <= 0) return false;
    this.left--;
    return true;
  }
}
