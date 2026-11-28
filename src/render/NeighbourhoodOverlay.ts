// The Neighbourhoods view (debug-only, ?debug=true; PC_DESIGN.md step 8 in its simplest form). A
// neighbourhood is one request-grid cell (requests.cellSize tiles square, sim/localTrust.ts trustCell). For
// each cell with homes: a thin border on its edges, a tint from its trust (green full through amber to red
// empty: cellTrust ÷ cellCap), and from mid zoom a label with its identity type (sim/identity.ts), with
// "→ type" when it is drifting.
//
// Light per frame: which cells have homes, and their identities, are worked out once an in-game day (the
// identities walk every cell). Trust is a lookup per cell, so it is refreshed also when the map is edited,
// so the tint answers a bulldozer straight away.

import type { World } from '../sim/World';
import type { Camera, TileBounds } from './Camera';
import { BALANCE } from '../data/balance';
import { ZONE_R } from '../sim/constants';
import { cellCap, cellTrust, localTrustEnabled } from '../sim/localTrust';
import { cellIdentities } from '../sim/identity';
import { pcCap } from '../sim/politics';
import { Projection } from './Projection';
import { t } from '../i18n';

/** Tile size (px) from which each cell shows its identity label. */
const LABEL_MIN_TILE = 12;

interface Cell { cell: number; x0: number; y0: number; homes: number; type: string | null; drift: string | null; frac: number | null }

/** Trust share 0..1 → red (empty) through amber (half) to green (full). */
export function trustColor(frac: number, alpha: number): string {
  const f = Math.max(0, Math.min(1, frac));
  const [r, g, b] = f < 0.5
    ? lerp([220, 60, 50], [230, 170, 50], f / 0.5)
    : lerp([230, 170, 50], [70, 200, 90], (f - 0.5) / 0.5);
  return `rgba(${r},${g},${b},${alpha})`;
}
const lerp = (a: number[], b: number[], k: number) => a.map((v, i) => Math.round(v + (b[i] - v) * k));

export class NeighbourhoodOverlay {
  private world: World | null = null;
  private day = -1;
  private edits = -1;
  private cells: Cell[] = [];

  private refresh(world: World): void {
    const day = Math.floor(world.tick / BALANCE.ticksPerDay);
    const newDay = world !== this.world || day !== this.day;
    if (newDay) {
      const cs = (BALANCE.politicalCapital.requests as unknown as { cellSize: number }).cellSize;
      const { width, height } = world.grid, cols = Math.ceil(width / cs), L = world.layers;
      const homes = new Map<number, number>();
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (L.zone[i] === ZONE_R && L.devLevel[i] > 0) { const c = Math.floor(y / cs) * cols + Math.floor(x / cs); homes.set(c, (homes.get(c) ?? 0) + 1); }
      }
      const ids = cellIdentities(world);
      this.cells = [...homes].map(([cell, n]) => {
        const id = ids.get(cell);
        return {
          cell, x0: (cell % cols) * cs, y0: Math.floor(cell / cols) * cs, homes: n,
          type: id ? t(`ui.tileInfo.identityType.${id.type}`) : null,
          drift: id?.drift ? t(`ui.tileInfo.identityType.${id.drift}`) : null,
          frac: null,
        };
      });
    }
    if (newDay || world.grid.edits !== this.edits) {
      const on = localTrustEnabled(), cityCap = on ? pcCap(world) : 0;
      for (const c of this.cells) {
        if (!on) { c.frac = null; continue; }
        const cap = cellCap(world, c.cell, cityCap);
        c.frac = cap > 0 ? cellTrust(world, c.cell, cityCap) / cap : null;
      }
    }
    this.world = world; this.day = day; this.edits = world.grid.edits;
  }

  draw(ctx: CanvasRenderingContext2D, world: World, camera: Camera, bounds: TileBounds, ts: number): void {
    this.refresh(world);
    const cs = (BALANCE.politicalCapital.requests as unknown as { cellSize: number }).cellSize;
    const X = (tx: number) => Math.round(camera.worldToScreenX(Projection.tileToWorldX(tx)));
    const Y = (ty: number) => Math.round(camera.worldToScreenY(Projection.tileToWorldY(ty)));
    const seen: Cell[] = [];
    for (const c of this.cells) {
      if (c.x0 + cs <= bounds.x0 || c.x0 > bounds.x1 + 1 || c.y0 + cs <= bounds.y0 || c.y0 > bounds.y1 + 1) continue;
      seen.push(c);
      const x = X(c.x0), y = Y(c.y0), w = X(c.x0 + cs) - x, h = Y(c.y0 + cs) - y;
      if (c.frac !== null) { ctx.fillStyle = trustColor(c.frac, 0.34); ctx.fillRect(x, y, w, h); }
    }
    // Borders over the tints: dark under light, so they show on grass and on pale streets alike.
    ctx.lineWidth = 1;
    for (const [stroke, off] of [['rgba(0,0,0,0.45)', 1.5], ['rgba(255,255,255,0.8)', 0.5]] as const) {
      ctx.strokeStyle = stroke;
      for (const c of seen) {
        const x = X(c.x0), y = Y(c.y0), w = X(c.x0 + cs) - x, h = Y(c.y0 + cs) - y;
        ctx.strokeRect(x + off, y + off, w - 1, h - 1);
      }
    }
    if (ts < LABEL_MIN_TILE) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const c of seen) {
      if (c.type === null && c.frac === null) continue;
      const lines = [c.type ?? t('ui.neighbourhoodLegend.fewHomes')];
      if (c.drift) lines.push(`→ ${c.drift}`);
      if (c.frac !== null) lines.push(t('ui.neighbourhoodLegend.trustPct', { pct: Math.round(Math.max(0, c.frac) * 100) }));
      ctx.font = 'bold 11px sans-serif';
      let w = 0;
      for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
      if (w + 16 > X(c.x0 + cs) - X(c.x0)) continue;   // no room in the cell at this zoom
      const cx = (X(c.x0) + X(c.x0 + cs)) / 2, cy = (Y(c.y0) + Y(c.y0 + cs)) / 2, lh = 13, h = lines.length * lh + 6;
      ctx.fillStyle = 'rgba(13,27,42,0.78)';
      ctx.fillRect(Math.round(cx - w / 2 - 6), Math.round(cy - h / 2), Math.ceil(w + 12), h);
      lines.forEach((l, k) => {
        ctx.font = k === 0 ? 'bold 11px sans-serif' : '11px sans-serif';
        ctx.fillStyle = k === 0 ? '#e8eef2' : l.startsWith('→') ? '#f0c060' : c.frac !== null ? trustColor(c.frac, 1) : '#9ab';
        ctx.fillText(l, cx, cy - h / 2 + 3 + lh * k + lh / 2);
      });
    }
    ctx.textAlign = 'left';
  }
}
