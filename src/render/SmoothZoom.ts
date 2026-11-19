// Smooth zooming for a camera that moves by itself (the title screen's tour).
//
// The map is drawn tile by tile on whole pixels. At a tile size that is not a
// whole number, neighbouring tiles are a pixel wider or narrower than each
// other, and WHICH ones changes with every step of the zoom: while the zoom
// glides, roads and buildings wiggle. So for such a camera the frame is drawn
// off screen at a whole tile size, where every tile is the same, and the
// finished picture is scaled to the camera's real zoom and position in one
// smooth copy. The whole tile size changes only now and then (`pickTile`), so
// the cached chunks and sprites are not re-made on every frame either.

import { Camera } from './Camera';
import { TILE_SIZE } from './Projection';

/** The whole tile sizes (px) a smooth frame may be drawn at: each at most 1.25× the one before. */
export const SMOOTH_TILES: readonly number[] = [4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 56, 64, 80];
/**
 * How far the picture may be scaled before it is drawn at another size: down
 * to MIN, up to MAX. The band is wider than a step of SMOOTH_TILES, so a zoom
 * that hovers around one value does not flip between two sizes.
 */
export const SMOOTH_MIN_SCALE = 0.78, SMOOTH_MAX_SCALE = 1.08;

/**
 * The tile size to draw at, for a camera whose true tile size is `ts`.
 * `current` (the size in use; 0 for none) is kept while `ts` stays within the
 * band around it; otherwise the smallest size that is at least `ts`.
 */
export function pickTile(ts: number, current: number): number {
  if (current > 0 && ts >= current * SMOOTH_MIN_SCALE && ts <= current * SMOOTH_MAX_SCALE) return current;
  for (const size of SMOOTH_TILES) if (size >= ts) return size;
  return SMOOTH_TILES[SMOOTH_TILES.length - 1];
}

export class SmoothZoom {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private tile = 0;
  /** The camera the frame is drawn with: whole tile size, position on whole pixels. */
  private readonly drawCamera = new Camera(1, 1);
  /** This frame's scale (true zoom / drawn zoom) and the part of a pixel the drawn camera was moved by. */
  private scale = 1;
  private fx = 0;
  private fy = 0;

  /**
   * Start a frame for `camera`: where to draw it, and the camera to draw it
   * with. Null where there is no canvas to draw on (tests): draw directly.
   * `dpr` is device pixels per CSS pixel on the screen canvas.
   */
  frame(camera: Camera, dpr: number): { ctx: CanvasRenderingContext2D; camera: Camera } | null {
    if (typeof document === 'undefined') return null;
    this.tile = pickTile(TILE_SIZE * camera.zoom, this.tile);
    const zoom = this.tile / TILE_SIZE;
    this.scale = camera.zoom / zoom;
    // Room for the widest view this size can be asked for, so the canvas is not re-made as the zoom glides.
    const w = Math.ceil(camera.viewportW / SMOOTH_MIN_SCALE) + 2, h = Math.ceil(camera.viewportH / SMOOTH_MIN_SCALE) + 2;
    const pw = Math.ceil(w * dpr), ph = Math.ceil(h * dpr);
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');
    }
    if (!this.ctx) return null;
    if (this.canvas.width !== pw || this.canvas.height !== ph) { this.canvas.width = pw; this.canvas.height = ph; }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const c = this.drawCamera;
    c.zoom = zoom;
    c.resize(w, h);
    // On whole pixels: every tile then starts on one.
    const px = Math.floor(camera.x * zoom), py = Math.floor(camera.y * zoom);
    c.x = px / zoom;
    c.y = py / zoom;
    this.fx = camera.x * zoom - px;
    this.fy = camera.y * zoom - py;
    return { ctx: this.ctx, camera: c };
  }

  /** Copy the frame just drawn to the screen, at the camera's true zoom and position. */
  blit(screen: CanvasRenderingContext2D, camera: Camera, dpr: number): void {
    if (!this.canvas) return;
    const sw = camera.viewportW / this.scale, sh = camera.viewportH / this.scale;
    const smoothing = screen.imageSmoothingEnabled, quality = screen.imageSmoothingQuality;
    screen.imageSmoothingEnabled = true;
    screen.imageSmoothingQuality = 'high';
    screen.drawImage(this.canvas, this.fx * dpr, this.fy * dpr, sw * dpr, sh * dpr, 0, 0, camera.viewportW, camera.viewportH);
    screen.imageSmoothingEnabled = smoothing;
    screen.imageSmoothingQuality = quality;
  }
}
