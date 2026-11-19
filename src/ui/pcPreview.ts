// What a tool would cost or earn in political capital on the tile under the
// pointer, shaped for drawing: the fall-off rings round an unpopular building,
// the homes that object (tinted by how much), and the text for the price tag.
// Everything comes from the engine's quote, so the preview and the charge agree.

import type { World } from '../sim/World';
import type { Tool } from '../input/InputController';
import { roadClassForTool, zoneForTool, placementAnchor, trackLevelForTool } from '../input/InputController';
import { placementFor } from '../input/placement';
import { pcQuote, nuisanceRings } from '../sim/politics';
import type { PcQuote, PcQuoteAction, NuisanceConfig, NuisanceSource } from '../sim/politics';
import type { ServiceValueConfig } from '../sim/serviceValue';
import { t } from '../i18n';
import { BALANCE } from '../data/balance';
import { buildingKindForTool } from './Toolbar';
import { PC_SYMBOL, pcAmount } from './pcFormat';

export interface PcPreview {
  at: { tx: number; ty: number };
  /** For a building: its kind and anchor tile, so rings can be measured from its whole footprint. */
  building?: { kind: number; tx: number; ty: number; rot?: number };
  /** Fall-off bands by manhattan distance, nearest first. Empty unless the tool upsets neighbours. */
  rings: { within: number; weight: number }[];
  /** Homes that object, with how strongly (0–1). */
  tints: { tx: number; ty: number; strength: number }[];
  /** The PC part of the price tag: "◆ 18", "+◆ 9", "◆ 0". Empty for none. */
  label: string;
  /** False if the action would be refused for lack of PC. */
  ok: boolean;
  /** The money part of the price tag, if the tool has a fixed price. */
  money?: string;
  /** A second line under the price, e.g. why it is refused. */
  note?: string;
  /** True when the note is a warning about something still allowed (a service building off the road network). */
  warning?: boolean;
  /** True when the note is good news (residents a new school would seat): shown green. */
  good?: boolean;
}

/** The engine action a tool performs on a tile, or null for tools that change nothing. */
export function pcActionForTool(tool: Tool, tx: number, ty: number, world?: World): PcQuoteAction | null {
  if (tool === 'bulldoze') return { type: 'bulldoze', tx, ty };
  const zone = zoneForTool(tool);
  if (zone !== undefined) return { type: 'zone', tx, ty, zone };
  const roadClass = roadClassForTool(tool);
  if (roadClass !== undefined) return { type: 'road', tx, ty, roadClass };
  const level = trackLevelForTool(tool);
  if (level !== undefined) return { type: 'track', tx, ty, level };
  const kind = buildingKindForTool(tool);
  // A building on several tiles is held by its middle; the engine wants its anchor.
  if (kind !== undefined) {
    if (world) { const p = placementFor(world, kind, tx, ty); return { type: 'building', tx: p.tx, ty: p.ty, kind, rot: p.rot }; }
    const a = placementAnchor(kind, tx, ty); return { type: 'building', tx: a.tx, ty: a.ty, kind };
  }
  return null;
}

/**
 * A quote as price-tag text: the cost, then any reward. With `showZero`, a
 * quote that costs nothing reads "◆ 0" (so the player learns that building
 * away from homes is free); without it, nothing.
 */
export function pcLabel(q: PcQuote, showZero = false): string {
  const parts: string[] = [];
  if (q.cost > 0) parts.push(PC_SYMBOL + ' ' + pcAmount(q.cost));
  if (q.reward > 0) parts.push('+' + PC_SYMBOL + ' ' + pcAmount(q.reward));
  if (parts.length === 0 && showZero) parts.push(PC_SYMBOL + ' 0');
  return parts.join(' ');
}

/**
 * The line under a quote's price that says what is going on, or undefined:
 * why it is refused (the city is in political debt, or simply short), that a
 * closure would leave the city in debt (closures are never refused), that the
 * reward is a ribbon cutting, or that the cost is for closing a service.
 */
export function pcNote(q: PcQuote, world: World): string | undefined {
  if (!q.affordable) return t(world.budget.politicalCapital < 0 ? 'ui.hud.pcInDebt' : 'ui.hud.pcShort');
  // What the city will owe afterwards, counting any debt it is already in.
  if (q.shortfall > 0) return t('ui.hud.pcIntoDebt', { pc: PC_SYMBOL + ' ' + pcAmount(Math.max(q.shortfall, q.cost - world.budget.politicalCapital)) });
  if (q.parts.some(p => p.reason === 'serviceOpened')) return t('ui.hud.pcRibbon');
  if (q.parts.some(p => p.reason === 'serviceClosed')) return t('ui.hud.pcClosing');
  return undefined;
}

/**
 * True when a quote is only neighbours objecting and the city can cover it.
 * Zoning shows that quietly: the homes tint, with no rings and no number (the
 * total floats up when the drag ends). The price appears, in red, only when
 * the city would run short.
 */
export function isQuietNuisance(q: PcQuote): boolean {
  return q.affordable && q.parts.length > 0 && q.parts.every(p => p.reason === 'nuisance');
}

/** The homes behind a quote's nuisance cost, for tinting. */
export function nuisanceTints(q: PcQuote): PcPreview['tints'] {
  return q.parts.filter(p => p.reason === 'nuisance').map(p => ({ tx: p.tx, ty: p.ty, strength: p.strength }));
}

/**
 * The preview for `tool` on `tile`, or null when PC does not come into it:
 * the tool neither costs nor earns PC here and is not one that can upset
 * neighbours. Cheap enough to call every frame (the quote scans one radius).
 */
export function hoverPcPreview(
  world: World,
  tool: Tool,
  tile: { tx: number; ty: number },
  nuisance: NuisanceConfig = BALANCE.politicalCapital.nuisance,
  service: ServiceValueConfig = BALANCE.politicalCapital.service,
): PcPreview | null {
  const action = pcActionForTool(tool, tile.tx, tile.ty, world);
  if (!action) return null;
  const source: NuisanceSource | null =
    action.type === 'zone' ? { zone: action.zone } : action.type === 'building' ? { kind: action.kind } : null;
  // Rings are for buildings. Zoning is dragged, and rings chasing the pointer would be noise.
  const rings = source && action.type === 'building' ? nuisanceRings(source, nuisance) : [];
  const q = pcQuote(world, action, nuisance, service);
  // A service building that touches no street or avenue serves only its own tile: say so. It can still be built.
  const offRoad = q.notConnected === true;
  if (q.cost === 0 && q.reward === 0 && rings.length === 0 && !offRoad) return null;
  const quiet = action.type === 'zone' && isQuietNuisance(q);
  return { at: tile, building: action.type === 'building' ? { kind: action.kind, tx: action.tx, ty: action.ty, rot: action.rot } : undefined, rings, tints: nuisanceTints(q), label: quiet ? '' : pcLabel(q, rings.length > 0), ok: q.affordable,
    note: quiet ? undefined : (offRoad && q.affordable ? t('ui.hud.noRoad') : pcNote(q, world)),
    warning: offRoad && q.affordable,
  };
}
