// What a Landscape stroke would do, for the map preview and the cursor tag
// (art/clay-set/landscape-tools.html, picks C1, D1–D4, E1: everything in the
// tag by the pointer). Built every frame from the engine's quotes.

import type { World } from '../sim/World';
import type { Tool } from '../input/InputController';
import { treeQuote, waterQuote } from '../sim/landscaping';
import { mixedSpecies, treeChoice } from '../input/landscape';
import { WILD_SPECIES } from '../render/clay/wildTrees';
import { t } from '../i18n';

export type TagTone = 'title' | 'money' | 'bad' | 'pc' | 'warn' | 'good' | 'dim';
export interface TagLine { text: string; tone: TagTone }

export interface LandscapePreview {
  tool: 'trees' | 'addWater' | 'removeWater';
  /** Every tile under the brush or the stroke so far (outlined). */
  brush: readonly number[];
  /** Tiles that would change, and for trees the species each would get. */
  change: readonly number[];
  species: readonly number[];
  /** Tiles that block the stroke (red): roads, or roads and buildings when removing water. */
  blocked: readonly number[];
  /** Buildings (anchor tiles) and zoned lots that adding water would bulldoze. */
  demolished: readonly number[];
  /** Buildings to ring (anchor tiles): a port cut off or a pump left dry (warn), a port reconnected (good). */
  rings: readonly { anchor: number; tone: 'warn' | 'good' }[];
  /** Where the tag goes. */
  at: { tx: number; ty: number };
  lines: TagLine[];
}

const dollars = (n: number) => n > 0 ? '$' + Math.round(n).toLocaleString('en-US') : t('ui.toolbar.free');

export function landscapePreview(world: World, tool: Tool, tiles: readonly number[], at: { tx: number; ty: number }): LandscapePreview | null {
  if (tool !== 'trees' && tool !== 'addWater' && tool !== 'removeWater') return null;
  const lines: TagLine[] = [];
  if (tool === 'trees') {
    const choice = treeChoice();
    // Mixed: quote each species' share; the price per tree is the same, so this sums exactly.
    const groups = new Map<number, number[]>();
    for (const i of tiles) { const s = choice > 0 ? choice : mixedSpecies(i); (groups.get(s) ?? groups.set(s, []).get(s)!).push(i); }
    const change: number[] = [], species: number[] = [];
    let cost = 0, affordable = true;
    for (const [s, g] of groups) {
      const q = treeQuote(world, g, s);
      for (const i of q.tiles) { change.push(i); species.push(s); }
      cost += q.cost; affordable &&= q.affordable;
    }
    const name = choice > 0 ? t(('ui.landscape.' + WILD_SPECIES[choice - 1]) as 'ui.landscape.beech') : t('ui.landscape.mixed');
    lines.push({ text: t('ui.toolbar.trees') + ': ' + name, tone: 'title' });
    if (change.length === 0) lines.push({ text: t('ui.landscape.nothing'), tone: 'dim' });
    else {
      lines.push({ text: t('ui.landscape.trees', { n: change.length }) + ' · ' + dollars(cost), tone: affordable ? 'money' : 'bad' });
      if (!affordable) lines.push({ text: t('ui.landscape.debt'), tone: 'bad' });
    }
    return { tool, brush: tiles, change, species, blocked: [], demolished: [], rings: [], at, lines };
  }

  const add = tool === 'addWater', q = waterQuote(world, tiles, add);
  lines.push({ text: t(add ? 'ui.toolbar.addWater' : 'ui.toolbar.removeWater'), tone: 'title' });
  if (q.tiles.length === 0 && q.blocked.length === 0) lines.push({ text: t('ui.landscape.nothing'), tone: 'dim' });
  if (q.tiles.length > 0) lines.push({ text: t('ui.landscape.tiles', { n: q.tiles.length }) + ' · ' + dollars(q.cost), tone: q.affordable ? 'money' : 'bad' });
  if (q.blocked.length > 0) lines.push({ text: t(add ? 'ui.landscape.blockedRoad' : 'ui.landscape.blockedBuilt', { n: q.blocked.length }), tone: 'bad' });
  if (q.demolished.length > 0) {
    lines.push({ text: t('ui.landscape.floods', { n: q.demolished.length, p: Math.round(q.pc.displacedPopulation) }), tone: 'bad' });
    if (q.pc.cost > 0) lines.push({ text: t('ui.landscape.pcCost', { n: '−' + Math.round(q.pc.cost) }), tone: q.pc.affordable ? 'pc' : 'bad' });
  }
  // A port or pump in more than one place says how many.
  const times = (n: number) => n > 1 ? ' ×' + n : '';
  if (q.portsCutOff.length > 0) {
    lines.push({ text: t('ui.landscape.portCutOff') + times(q.portsCutOff.length), tone: 'warn' });
    lines.push({ text: t('ui.landscape.portCutOffNote'), tone: 'warn' });
  }
  if (q.pumpsDry.length > 0) lines.push({ text: t('ui.landscape.pumpDry') + times(q.pumpsDry.length), tone: 'warn' });
  if (q.portsReconnected.length > 0) lines.push({ text: t('ui.landscape.portReconnected') + times(q.portsReconnected.length), tone: 'good' });
  if (q.tiles.length > 0 && !q.affordable) lines.push({ text: t('ui.landscape.debt'), tone: 'bad' });
  const rings = [
    ...q.portsCutOff.map(anchor => ({ anchor, tone: 'warn' as const })),
    ...q.pumpsDry.map(anchor => ({ anchor, tone: 'warn' as const })),
    ...q.portsReconnected.map(anchor => ({ anchor, tone: 'good' as const })),
  ];
  return { tool, brush: tiles, change: q.tiles, species: [], blocked: q.blocked, demolished: q.demolished, rings, at, lines };
}
