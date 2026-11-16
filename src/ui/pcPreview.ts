// What a tool would cost or earn in political capital on the tile under the
// pointer, shaped for drawing: the fall-off rings round an unpopular building,
// the homes that object (tinted by how much), and the text for the price tag.
// Everything comes from the engine's quote, so the preview and the charge agree.

import type { World } from '../sim/World';
import type { Tool } from '../input/InputController';
import { roadClassForTool, zoneForTool } from '../input/InputController';
import { pcQuote, nuisanceRings } from '../sim/politics';
import type { PcQuote, PcQuoteAction, NuisanceConfig, NuisanceSource } from '../sim/politics';
import { BALANCE } from '../data/balance';
import { buildingKindForTool } from './Toolbar';
import { PC_SYMBOL, pcAmount } from './pcFormat';

export interface PcPreview {
  at: { tx: number; ty: number };
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
}

/** The engine action a tool performs on a tile, or null for tools that change nothing. */
export function pcActionForTool(tool: Tool, tx: number, ty: number): PcQuoteAction | null {
  if (tool === 'bulldoze') return { type: 'bulldoze', tx, ty };
  const zone = zoneForTool(tool);
  if (zone !== undefined) return { type: 'zone', tx, ty, zone };
  const roadClass = roadClassForTool(tool);
  if (roadClass !== undefined) return { type: 'road', tx, ty, roadClass };
  const kind = buildingKindForTool(tool);
  if (kind !== undefined) return { type: 'building', tx, ty, kind };
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
): PcPreview | null {
  const action = pcActionForTool(tool, tile.tx, tile.ty);
  if (!action) return null;
  const source: NuisanceSource | null =
    action.type === 'zone' ? { zone: action.zone } : action.type === 'building' ? { kind: action.kind } : null;
  const rings = source ? nuisanceRings(source, nuisance) : [];
  const q = pcQuote(world, action, nuisance);
  if (q.cost === 0 && q.reward === 0 && rings.length === 0) return null;
  return { at: tile, rings, tints: nuisanceTints(q), label: pcLabel(q, rings.length > 0), ok: q.affordable };
}
