import { Projection } from './Projection';
import { Grid } from '../sim/Grid';

export interface TileBounds {
  x0: number; y0: number; x1: number; y1: number;
}

export class Camera {
  x = 0;
  y = 0;
  zoom = 1.5;
  viewportW: number;
  viewportH: number;
  readonly minZoom = 0.25;
  readonly maxZoom = 4;

  constructor(viewportW: number, viewportH: number) {
    this.viewportW = viewportW;
    this.viewportH = viewportH;
  }

  resize(w: number, h: number): void {
    this.viewportW = w;
    this.viewportH = h;
  }

  worldToScreen(wx: number, wy: number): { sx: number; sy: number } {
    return { sx: (wx - this.x) * this.zoom, sy: (wy - this.y) * this.zoom };
  }

  screenToWorld(sx: number, sy: number): { wx: number; wy: number } {
    return { wx: sx / this.zoom + this.x, wy: sy / this.zoom + this.y };
  }

  screenToTile(sx: number, sy: number): { tx: number; ty: number } {
    const { wx, wy } = this.screenToWorld(sx, sy);
    return Projection.worldToTile(wx, wy);
  }

  centerOnTile(tx: number, ty: number): void {
    const { x, y } = Projection.tileToWorld(tx, ty);
    this.x = x - this.viewportW / (2 * this.zoom);
    this.y = y - this.viewportH / (2 * this.zoom);
  }

  panBy(dsx: number, dsy: number): void {
    this.x -= dsx / this.zoom;
    this.y -= dsy / this.zoom;
  }

  zoomAt(sx: number, sy: number, factor: number): void {
    const before = this.screenToWorld(sx, sy);
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    const after = this.screenToWorld(sx, sy);
    this.x += before.wx - after.wx;
    this.y += before.wy - after.wy;
  }

  visibleTileBounds(grid: Grid): TileBounds {
    const tl = Projection.worldToTile(this.x, this.y);
    const br = Projection.worldToTile(
      this.x + this.viewportW / this.zoom,
      this.y + this.viewportH / this.zoom,
    );
    return {
      x0: Math.max(0, tl.tx - 1),
      y0: Math.max(0, tl.ty - 1),
      x1: Math.min(grid.width - 1, br.tx + 1),
      y1: Math.min(grid.height - 1, br.ty + 1),
    };
  }
}
