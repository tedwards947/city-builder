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

  // Primitive variants — no allocation, use in hot render loops.
  worldToScreenX(wx: number): number { return (wx - this.x) * this.zoom; }
  worldToScreenY(wy: number): number { return (wy - this.y) * this.zoom; }

  screenToWorld(sx: number, sy: number): { wx: number; wy: number } {
    return { wx: sx / this.zoom + this.x, wy: sy / this.zoom + this.y };
  }

  screenToWorldX(sx: number): number { return sx / this.zoom + this.x; }
  screenToWorldY(sy: number): number { return sy / this.zoom + this.y; }

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
    const bwx = this.screenToWorldX(sx);
    const bwy = this.screenToWorldY(sy);
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    this.x += bwx - this.screenToWorldX(sx);
    this.y += bwy - this.screenToWorldY(sy);
  }

  visibleTileBounds(grid: Grid): TileBounds {
    return {
      x0: Math.max(0, Projection.worldToTileX(this.x) - 1),
      y0: Math.max(0, Projection.worldToTileY(this.y) - 1),
      x1: Math.min(grid.width - 1, Projection.worldToTileX(this.x + this.viewportW / this.zoom) + 1),
      y1: Math.min(grid.height - 1, Projection.worldToTileY(this.y + this.viewportH / this.zoom) + 1),
    };
  }
}
