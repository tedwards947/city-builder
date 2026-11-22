// The static layer of the map, cached as one canvas per 16×16-tile chunk.
//
// This file decides WHEN a chunk is redrawn; a ChunkPainter (chunkPainter.ts)
// decides what is drawn. A chunk is redrawn only when
//   - what it shows has changed (its signature differs), at once; or
//   - the zoom has changed and then held still, a few chunks per frame; or
//   - it is on screen for the first time, a couple of dozen per frame.
// In between, the cached canvas is copied to the screen, stretched if it was
// drawn at another zoom. Redrawing every visible chunk on every wheel step or
// every sim tick is what used to make zooming and playing stutter.

import type { World } from '../sim/World';
import type { Camera, TileBounds } from './Camera';
import { TILE_SIZE } from './Projection';
import { CHUNK_SIZE } from '../sim/Grid';

export interface ChunkPainter {
  /**
   * A number that changes whenever the picture `paint` would draw for chunk
   * (cx, cy) changes. Sim noise that does not change the picture must not
   * change it, or chunks are redrawn for nothing.
   */
  signature(world: World, cx: number, cy: number): number;
  /** Draws chunk (cx, cy) into `ctx` at `ts` pixels per tile. */
  paint(ctx: CanvasRenderingContext2D, world: World, cx: number, cy: number, ts: number): void;
}

const CHUNK_PX = CHUNK_SIZE * TILE_SIZE;
const ZOOM_SETTLE_MS = 120;               // zoom must hold still this long before chunks are redrawn at the new size
const CHUNK_RESIZES_PER_FRAME = 6;        // chunks redrawn per frame only to change size
const CHUNK_FIRST_DRAWS_PER_FRAME = 24;   // chunks drawn for the first time per frame

export class ChunkCache {
  /** What draws a chunk. Replaceable (tests count redraws with a stand-in). */
  painter: ChunkPainter;

  private _canvases: (HTMLCanvasElement | null)[] = [];
  private _ctxs: (CanvasRenderingContext2D | null)[] = [];
  private _count = 0;
  // One entry per chunk. A chunk canvas is current when it was drawn at
  // `_targetTs` and its signature still matches the world.
  private _sig = new Int32Array(0);
  private _drawnTs = new Float64Array(0);   // tile size the canvas was drawn at; 0 = never
  private _stale = new Uint8Array(0);       // 1 = marked dirty since last checked
  private _targetTs = 0;                    // tile size chunks are being brought to
  private _targetZoom = -1;                 // the zoom `_targetTs` was taken at
  private _zoomSeen = -1;                   // camera zoom on the previous frame
  private _zoomChangedAt = 0;               // when it last changed (ms)
  private _grid: World['grid'] | null = null;

  constructor(painter: ChunkPainter) {
    this.painter = painter;
  }

  /** The tile size the chunk holding tile (tx, ty) was last drawn at; 0 if it never was. */
  tileSizeAt(world: World, tx: number, ty: number): number {
    return this._drawnTs[((ty / CHUNK_SIZE) | 0) * world.grid.chunkCols + ((tx / CHUNK_SIZE) | 0)];
  }

  /**
   * Bring the chunks inside `bounds` up to date, within this frame's budgets.
   * `now` is the frame's time in ms.
   */
  update(world: World, bounds: TileBounds, zoom: number, now: number): void {
    const ts = TILE_SIZE * zoom;

    // Chunks are redrawn at a new tile size only when zoom has changed
    // significantly (> 1%) AND has then held still for a moment; until then
    // the cached canvases are drawn scaled.
    if (zoom !== this._zoomSeen) {
      this._zoomSeen = zoom;
      this._zoomChangedAt = now;
    }
    const zoomSettled = now - this._zoomChangedAt >= ZOOM_SETTLE_MS || this._targetTs === 0;
    if (zoomSettled && Math.abs(zoom - this._targetZoom) > 0.01) {
      this._targetZoom = zoom;
      this._targetTs = ts;
    }

    const grid = world.grid;
    const totalChunks = grid.chunkCols * grid.chunkRows;
    if (grid !== this._grid) {
      // A different world (new game / load): nothing cached is valid.
      this._grid = grid;
      this._drawnTs.fill(0);
    }
    if (totalChunks !== this._count) {
      this._sig = new Int32Array(totalChunks);
      this._drawnTs = new Float64Array(totalChunks);
      this._stale = new Uint8Array(totalChunks);
      // Keep the canvases that still have a place.
      const canvases = new Array(totalChunks).fill(null);
      const ctxs = new Array(totalChunks).fill(null);
      const keep = Math.min(this._canvases.length, totalChunks);
      for (let i = 0; i < keep; i++) {
        canvases[i] = this._canvases[i];
        ctxs[i] = this._ctxs[i];
      }
      this._canvases = canvases;
      this._ctxs = ctxs;
      this._count = totalChunks;
    }

    // Take ownership of the grid's dirty marks. They persist per chunk until
    // that chunk is next on screen, so off-screen changes are not lost.
    const stale = this._stale;
    if (grid.dirtyChunks.size > 0) {
      for (const id of grid.dirtyChunks) stale[id] = 1;
      grid.dirtyChunks.clear();
    }
    const targetTs = this._targetTs;

    const cxMin = (bounds.x0 / CHUNK_SIZE) | 0;
    const cyMin = (bounds.y0 / CHUNK_SIZE) | 0;
    const cxMax = Math.min(grid.chunkCols - 1, (bounds.x1 / CHUNK_SIZE) | 0);
    const cyMax = Math.min(grid.chunkRows - 1, (bounds.y1 / CHUNK_SIZE) | 0);

    // Per frame: a few chunks may be redrawn just to change size, and a few
    // more drawn for the first time; the rest wait for the next frame (an
    // undrawn chunk shows the background until its turn). A chunk whose
    // CONTENT changed is always redrawn at once.
    let resizeBudget = zoomSettled ? CHUNK_RESIZES_PER_FRAME : 0;
    let firstDrawBudget = CHUNK_FIRST_DRAWS_PER_FRAME;
    // Mid-zoom, draw new chunks at the size on screen now rather than the
    // stale target: zooming out reveals many, and the old size is far too big.
    const drawTs = zoomSettled ? targetTs : ts;

    for (let cy = cyMin; cy <= cyMax; cy++) {
      for (let cx = cxMin; cx <= cxMax; cx++) {
        const chunkId = cy * grid.chunkCols + cx;
        const drawnAt = this._drawnTs[chunkId];
        const have = drawnAt > 0;
        const sized = have && Math.abs(drawnAt / targetTs - 1) <= 0.01;
        if (sized && stale[chunkId] === 0) continue;
        if (!have && firstDrawBudget <= 0) continue;
        // Systems mark every chunk dirty on most ticks, so "dirty" only means
        // "check": redraw only if what the chunk draws actually changed.
        const sig = this.painter.signature(world, cx, cy);
        const sameContent = have && sig === this._sig[chunkId];
        if (sameContent) {
          stale[chunkId] = 0;
          if (sized) continue;
          // Only the size is off: redraw it when there is budget, else keep scaling it.
          if (resizeBudget <= 0) continue;
          resizeBudget--;
        } else if (!have) {
          firstDrawBudget--;
        }
        const chunkCtx = this._contextFor(chunkId, drawTs);
        if (chunkCtx !== null) {
          this.painter.paint(chunkCtx, world, cx, cy, drawTs);
          this._sig[chunkId] = sig;
          this._drawnTs[chunkId] = drawTs;
          stale[chunkId] = 0;
        }
      }
    }
  }

  /** Copy the cached chunks inside `bounds` to the screen. */
  draw(ctx: CanvasRenderingContext2D, world: World, camera: Camera, bounds: TileBounds): void {
    const grid = world.grid;
    const ts = TILE_SIZE * camera.zoom;
    const cxMin = (bounds.x0 / CHUNK_SIZE) | 0;
    const cyMin = (bounds.y0 / CHUNK_SIZE) | 0;
    const cxMax = Math.min(grid.chunkCols - 1, (bounds.x1 / CHUNK_SIZE) | 0);
    const cyMax = Math.min(grid.chunkRows - 1, (bounds.y1 / CHUNK_SIZE) | 0);

    for (let cy = cyMin; cy <= cyMax; cy++) {
      for (let cx = cxMin; cx <= cxMax; cx++) {
        const chunkId = cy * grid.chunkCols + cx;
        const chunkCanvas = this._canvases[chunkId];
        if (!chunkCanvas) continue;

        const dstX = Math.floor(camera.worldToScreenX(cx * CHUNK_PX));
        const dstY = Math.floor(camera.worldToScreenY(cy * CHUNK_PX));

        ctx.globalAlpha = 1.0;
        ctx.imageSmoothingEnabled = false;
        if (this._drawnTs[chunkId] === ts) {
          // Drawn at this exact tile size: copy it pixel for pixel. (Stretching
          // it to dstW x dstH squeezes or doubles one row and column, and which
          // one changes as the camera pans, so fine lines shimmer.) The spare
          // pixel on its right and bottom is covered by the next chunk.
          ctx.drawImage(chunkCanvas, dstX, dstY);
        } else {
          // Mid-zoom: scale the whole canvas, spare pixel and all, by the ratio of tile sizes. (Squeezing it
          // into the chunk's own span on screen put the spare edge inside that span, and left a seam.)
          const k = ts / this._drawnTs[chunkId];
          ctx.drawImage(chunkCanvas, dstX, dstY, chunkCanvas.width * k, chunkCanvas.height * k);
        }
      }
    }
  }

  /** The chunk's own canvas context, sized for `ts` pixels per tile; null where there is no DOM. */
  private _contextFor(chunkId: number, ts: number): CanvasRenderingContext2D | null {
    let canvas = this._canvases[chunkId];
    let ctx = this._ctxs[chunkId];

    if (!canvas) {
      if (typeof document === 'undefined') return null;
      canvas = document.createElement('canvas');
      this._canvases[chunkId] = canvas;
      ctx = canvas.getContext('2d');
      this._ctxs[chunkId] = ctx;
    }

    const chunkSizePx = Math.ceil(CHUNK_SIZE * ts) + 1;
    if (canvas.width !== chunkSizePx || canvas.height !== chunkSizePx) {
      canvas.width = chunkSizePx;
      canvas.height = chunkSizePx;
    }

    return ctx || null;
  }
}
