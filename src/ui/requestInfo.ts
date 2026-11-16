// Facts about a resident request for the interface: how far along it is, in
// words and percentages, and where on the map it is.

import type { World } from '../sim/World';
import type { OpenRequest, Rect, RequestProgress } from '../sim/requests';
import { requestProgress } from '../sim/requests';
import { t } from '../i18n';

/** A request's progress as the interface shows it: one line of text, and a bar unless it is all-or-nothing. */
export interface ProgressView {
  text: string;
  /** Whole percentages for the bar: how far along, and the tick where it counts as met. Null for a city-wide request. */
  bar: { covered: number; needed: number } | null;
}

/**
 * Whole percentages for a progress figure. Rounds down, and never shows a
 * request that is still open as having reached its target.
 */
export function progressPercents(p: Pick<RequestProgress, 'covered' | 'coveredNeeded' | 'met'>): { covered: number; needed: number } {
  const needed = Math.round(p.coveredNeeded * 100);
  const covered = Math.floor(p.covered * 100);
  return { covered: !p.met && covered >= needed ? Math.max(0, needed - 1) : covered, needed };
}

/** How close a request is to being met, from the engine's own figures (so it matches the rule that decides it). */
export function progressView(world: World, req: OpenRequest): ProgressView {
  const p = requestProgress(world, req);
  if (p.unit === 'city') return { text: t('ui.requests.progressBy.city'), bar: null };
  const bar = progressPercents(p);
  return { text: t('ui.requests.progressBy.' + p.unit, bar), bar };
}

export type AreaName = 'centre' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

/**
 * Where an area is on the map, in thirds: the middle third is the centre,
 * the rest are compass points. There are no street names to go by.
 */
export function areaName(world: World, area: Rect): AreaName {
  const { width, height } = world.grid;
  const cx = (area.x0 + area.x1 + 1) / 2 / width, cy = (area.y0 + area.y1 + 1) / 2 / height;
  const ew = cx < 1 / 3 ? 'w' : cx > 2 / 3 ? 'e' : '';
  const ns = cy < 1 / 3 ? 'n' : cy > 2 / 3 ? 's' : '';
  return ((ns + ew) || 'centre') as AreaName;
}
