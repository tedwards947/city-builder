// Markers: named points on the map that are NOT part of the city. They are not
// a building or a tile layer, so the sim, zoning and growth never see them.
// `world.markers` is a plain saved list. Today the only kind is 'focus': a
// point of interest for the title screen's camera tour, placed with
// ?debug=true (ui/MarkerPanel.ts). `kind` leaves room for scenario or tutorial
// triggers later.

import type { World } from './World';

export type MarkerKind = 'focus';

export interface Marker {
  /** The tile. */
  x: number;
  y: number;
  kind: MarkerKind;
  /** For 'focus': the zoom to view it at on a desktop-sized window (see title/CameraTour.ts viewScale). Missing = the tour's default. */
  zoom?: number;
  /** A note for whoever placed it. Never shown to players. */
  label?: string;
}

/** Position in `world.markers` of the marker on tile (tx, ty), or -1. */
export function markerIndexAt(world: World, tx: number, ty: number): number {
  return world.markers.findIndex(m => m.x === tx && m.y === ty);
}

/** The focus markers, in the order they were placed. */
export function focusMarkers(world: World): Marker[] {
  return world.markers.filter(m => m.kind === 'focus');
}

/**
 * A saved list made safe to load: entries that are not a marker on the map
 * are dropped, and there is at most one marker per tile (the first wins).
 * Anything that is not a list (an older save) gives an empty one.
 */
export function cleanMarkers(raw: unknown, width: number, height: number): Marker[] {
  if (!Array.isArray(raw)) return [];
  const out: Marker[] = [];
  const taken = new Set<number>();
  for (const r of raw as Partial<Marker>[]) {
    if (!r || typeof r.kind !== 'string' || !Number.isInteger(r.x) || !Number.isInteger(r.y)) continue;
    const x = r.x as number, y = r.y as number;
    if (x < 0 || y < 0 || x >= width || y >= height || taken.has(y * width + x)) continue;
    taken.add(y * width + x);
    const m: Marker = { x, y, kind: r.kind };
    if (typeof r.zoom === 'number' && Number.isFinite(r.zoom) && r.zoom > 0) m.zoom = r.zoom;
    if (typeof r.label === 'string' && r.label !== '') m.label = r.label.slice(0, 80);
    out.push(m);
  }
  return out;
}
