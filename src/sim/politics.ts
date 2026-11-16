// Political capital (PC): the one place that prices it, reads its cap and
// writes its value.
//
// Pricing:
//   - pcQuote / pcQuoteMany: what an action would cost or earn, and why. Pure:
//     they read the world and change nothing. Commands and UI previews both use
//     them, so a preview never disagrees with what a click charges.
// Writing: everything that changes `world.budget.politicalCapital` goes through
// this file, so the rules (cap, events, later a floor at zero) live in one place:
//   - chargeQuote / refundCharges: a command applying and undoing its quote;
//   - changePc: one cost or reward;
//   - regenPc:  the passive per-tick change from PoliticsSystem.

import type { World } from './World';
import { ROAD_NONE, ROAD_HIGHWAY, ZONE_NONE, ZONE_R, ZONE_I } from './constants';
import { BALANCE } from '../data/balance';

/** Why political capital changed. */
export type PcReason =
  | 'displacement'    // residents lost their homes (bulldoze, rezone, road or building over homes)
  | 'blightCleared'   // an abandoned building was cleared
  | 'nuisance';       // something unpopular (industry, a power or sewage plant) was put near homes

export interface PcChangeInfo {
  /** The tile the change came from, if it has one. */
  tx?: number;
  ty?: number;
  /** True when a command is being undone: the change reverses an earlier one. */
  undo?: boolean;
}

/** The most political capital passive regeneration can reach. */
export function pcCap(_world: World): number {
  return BALANCE.politicalCapital.max;
}

/**
 * Add `delta` to political capital (negative for a cost) and tell listeners.
 * Emits `pcChanged`; see CityEvents for the payload. A zero delta does nothing.
 * CommandHistory adds these up into one `pcAction` per finished player action.
 */
export function changePc(world: World, delta: number, reason: PcReason, info: PcChangeInfo = {}): void {
  if (delta === 0) return;
  world.budget.politicalCapital += delta;
  world.events.emit('pcChanged', {
    delta,
    reason,
    tx: info.tx,
    ty: info.ty,
    undo: info.undo === true,
  });
}

/**
 * Apply one tick of passive regeneration, stopping at the cap. No event: it
 * happens every tick, and the HUD reads the value directly.
 */
export function regenPc(world: World, amount: number): void {
  world.budget.politicalCapital = Math.min(pcCap(world), world.budget.politicalCapital + amount);
}

// ── Displacement ─────────────────────────────────────────────────────────────

export interface Disruption {
  /** Residents who lose their home if this tile's zone is removed. */
  displacedPopulation: number;
  /** Political capital charged for that displacement. */
  pcCost: number;
  /** Political capital granted for clearing an abandoned (blighted) building. */
  pcReward: number;
}

/**
 * Political consequences of wiping whatever currently stands on a tile.
 *   - Populated, non-abandoned residential → displacement cost.
 *   - Abandoned developed tile of any zone → blight-clearing reward.
 */
export function tileDisruption(world: World, tx: number, ty: number): Disruption {
  const i = world.grid.idx(tx, ty);
  const costs = BALANCE.politicalCapital.disruptionCosts;
  const isAbandoned = world.layers.abandoned[i] !== 0;
  const dev = world.layers.devLevel[i];
  const displacedPopulation =
    !isAbandoned && world.layers.zone[i] === ZONE_R
      ? (BALANCE.growth.popPerLevel[dev] ?? 0)
      : 0;
  return {
    displacedPopulation,
    pcCost: displacedPopulation * costs.bulldozePerPop,
    pcReward: isAbandoned && dev > 0 ? dev * costs.abandonedBuildingReward : 0,
  };
}

const N4 = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;

/**
 * The developed, non-abandoned zone tiles beside (tx, ty) that would be left
 * with no street or avenue if (tx, ty) became a highway. Reads the world,
 * changes nothing.
 */
export function zonesCutOffByHighway(world: World, tx: number, ty: number): { tx: number; ty: number }[] {
  const { grid, layers } = world;
  const out: { tx: number; ty: number }[] = [];
  for (const [dx, dy] of N4) {
    const nx = tx + dx, ny = ty + dy;
    if (!grid.inBounds(nx, ny)) continue;
    const ni = grid.idx(nx, ny);
    if (layers.zone[ni] === ZONE_NONE || layers.devLevel[ni] === 0 || layers.abandoned[ni] !== 0) continue;
    let hasAccess = false;
    for (const [adx, ady] of N4) {
      const ax = nx + adx, ay = ny + ady;
      if (ax === tx && ay === ty) continue;            // the tile that becomes a highway
      if (!grid.inBounds(ax, ay)) continue;
      const rc = layers.roadClass[grid.idx(ax, ay)];
      if (rc !== ROAD_NONE && rc !== ROAD_HIGHWAY) { hasAccess = true; break; }
    }
    if (!hasAccess) out.push({ tx: nx, ty: ny });
  }
  return out;
}

// ── Nuisance (unpopular things near homes) ───────────────────────────────────

export interface NuisanceConfig {
  /**
   * Fall-off bands by manhattan distance, nearest first: a home within `within`
   * tiles objects at `weight` (0–1). The last band's `within` is the radius.
   */
  bands: readonly { within: number; weight: number }[];
  /** PC per resident at weight 1 for each industrial tile zoned. 0 = off. */
  industrialPerResident: number;
  /** PC per resident at weight 1, by building kind. Missing or 0 = off. */
  buildingPerResident: Readonly<Record<number, number>>;
}

/** What is being placed, for nuisance purposes: a zone or a building kind. */
export type NuisanceSource = { zone: number } | { kind: number };

/** PC per resident at weight 1 for placing this; 0 if it is not a nuisance. */
function nuisanceRate(source: NuisanceSource, cfg: NuisanceConfig): number {
  if ('zone' in source) return source.zone === ZONE_I ? cfg.industrialPerResident : 0;
  return cfg.buildingPerResident[source.kind] ?? 0;
}

/**
 * The fall-off rings (manhattan distance, nearest first) to draw round the
 * pointer for a tool: the same bands the cost uses. Empty if the tool is not
 * a nuisance (or nuisance costs are switched off).
 */
export function nuisanceRings(
  source: NuisanceSource,
  cfg: NuisanceConfig = BALANCE.politicalCapital.nuisance,
): { within: number; weight: number }[] {
  return nuisanceRate(source, cfg) > 0 ? cfg.bands.map(b => ({ ...b })) : [];
}

// ── Quotes ───────────────────────────────────────────────────────────────────

/** A player action that can cost or earn political capital. */
export type PcQuoteAction =
  | { type: 'bulldoze'; tx: number; ty: number }
  | { type: 'zone'; tx: number; ty: number; zone: number }
  | { type: 'building'; tx: number; ty: number; kind: number }
  | { type: 'road'; tx: number; ty: number; roadClass: number };

/** One contribution to a quote: who objects (or is pleased), and by how much. */
export interface PcPart {
  reason: PcReason;
  /** The tile responsible: the home displaced or objecting, the ruin cleared. */
  tx: number;
  ty: number;
  /** Signed change to PC: negative for a cost. */
  amount: number;
  /** How strongly this tile feels it, 0–1: the fall-off weight for a nuisance, otherwise 1. */
  strength: number;
}

export interface PcQuote {
  /** Total PC the action costs (0 or more). */
  cost: number;
  /** Total PC the action earns (0 or more). */
  reward: number;
  /** False if the action would be refused for lack of PC right now. */
  affordable: boolean;
  /** Residents who lose their homes. */
  displacedPopulation: number;
  /** Every contribution, in the order it is charged. */
  parts: PcPart[];
}

function emptyQuote(): PcQuote {
  return { cost: 0, reward: 0, affordable: true, displacedPopulation: 0, parts: [] };
}

function addPart(q: PcQuote, reason: PcReason, tx: number, ty: number, amount: number, strength = 1): void {
  if (amount === 0) return;
  q.parts.push({ reason, tx, ty, amount, strength });
  if (amount < 0) q.cost += -amount; else q.reward += amount;
}

/** An action is refused when it has a cost the city cannot cover. Rewards do not offset it. */
function canAfford(world: World, cost: number): boolean {
  return !(cost > 0 && world.budget.politicalCapital < cost);
}

/**
 * What `action` would cost or earn in political capital right now, and why.
 * Reads the world, changes nothing. An action that would do nothing (painting
 * a zone a tile already has, a road where one cannot go) quotes as empty.
 * It scans at most the nuisance radius round the tile, so it is cheap enough
 * to call every frame for a hover preview.
 */
export function pcQuote(
  world: World,
  action: PcQuoteAction,
  nuisance: NuisanceConfig = BALANCE.politicalCapital.nuisance,
): PcQuote {
  const q = emptyQuote();
  const { grid, layers } = world;
  const { tx, ty } = action;
  if (!grid.inBounds(tx, ty)) return q;
  const i = grid.idx(tx, ty);
  const d = tileDisruption(world, tx, ty);

  switch (action.type) {
    case 'bulldoze':
      addPart(q, 'displacement', tx, ty, -d.pcCost);
      addPart(q, 'blightCleared', tx, ty, d.pcReward);
      break;
    case 'zone': {
      if (!world.isBuildable(tx, ty) || layers.roadClass[i] !== ROAD_NONE) return q;
      if (layers.zone[i] === action.zone && layers.abandoned[i] === 0) return q;
      addPart(q, 'displacement', tx, ty, -d.pcCost);
      addPart(q, 'blightCleared', tx, ty, d.pcReward);
      break;
    }
    case 'building':
      // Building over a ruin earns nothing: only bulldozing or rezoning clears blight.
      if (!world.isBuildable(tx, ty)) return q;
      addPart(q, 'displacement', tx, ty, -d.pcCost);
      break;
    case 'road': {
      if (!world.isBuildable(tx, ty, true) || layers.roadClass[i] >= action.roadClass) return q;
      addPart(q, 'displacement', tx, ty, -d.pcCost);
      // A highway gives no access: homes left with no other road abandon.
      if (action.roadClass === ROAD_HIGHWAY) {
        for (const z of zonesCutOffByHighway(world, tx, ty)) {
          const zi = grid.idx(z.tx, z.ty);
          if (layers.zone[zi] !== ZONE_R) continue;
          const pop = BALANCE.growth.popPerLevel[layers.devLevel[zi]] ?? 0;
          addPart(q, 'displacement', z.tx, z.ty, -(pop * BALANCE.politicalCapital.disruptionCosts.bulldozePerPop));
        }
      }
      break;
    }
  }
  if (q.parts.some(p => p.reason === 'displacement' && p.tx === tx && p.ty === ty)) {
    q.displacedPopulation = d.displacedPopulation;
  }

  // Homes nearby object to a nuisance. Land that is already industrial is not a new one.
  const rate = action.type === 'zone' ? nuisanceRate({ zone: action.zone }, nuisance)
             : action.type === 'building' ? nuisanceRate({ kind: action.kind }, nuisance)
             : 0;
  const alreadyIndustrial = action.type === 'zone' && layers.zone[i] === ZONE_I;
  if (rate > 0 && !alreadyIndustrial && nuisance.bands.length > 0) {
    const radius = nuisance.bands[nuisance.bands.length - 1].within;
    for (let dy = -radius; dy <= radius; dy++) {
      const span = radius - Math.abs(dy);
      for (let dx = -span; dx <= span; dx++) {
        if (dx === 0 && dy === 0) continue;
        const hx = tx + dx, hy = ty + dy;
        if (!grid.inBounds(hx, hy)) continue;
        const hi = grid.idx(hx, hy);
        if (layers.zone[hi] !== ZONE_R || layers.devLevel[hi] === 0 || layers.abandoned[hi] !== 0) continue;
        const dist = Math.abs(dx) + Math.abs(dy);
        let weight = 0;
        for (const b of nuisance.bands) if (dist <= b.within) { weight = b.weight; break; }
        const pop = BALANCE.growth.popPerLevel[layers.devLevel[hi]] ?? 0;
        addPart(q, 'nuisance', hx, hy, -(pop * rate * weight), weight);
      }
    }
  }

  q.affordable = canAfford(world, q.cost);
  return q;
}

/**
 * One quote for several actions done together (a zone drag, a zone fill, an
 * auto road). Parts for the same tile and reason are merged:
 *   - a home can only be displaced, and a ruin only cleared, once, so those
 *     count once however many of the actions touch it;
 *   - nuisance adds up (each industrial tile is charged), keeping the
 *     strongest `strength`.
 * It prices each action against the world as it is now, so it is an estimate
 * where one action changes what the next would cost.
 */
export function pcQuoteMany(
  world: World,
  actions: readonly PcQuoteAction[],
  nuisance: NuisanceConfig = BALANCE.politicalCapital.nuisance,
): PcQuote {
  const total = emptyQuote();
  const byKey = new Map<string, PcPart>();
  const width = world.grid.width;
  for (const action of actions) {
    const q = pcQuote(world, action, nuisance);
    for (const p of q.parts) {
      const key = `${p.reason}:${p.ty * width + p.tx}`;
      const have = byKey.get(key);
      if (!have) {
        const copy = { ...p };
        byKey.set(key, copy);
        total.parts.push(copy);
        if (p.reason === 'displacement' && p.tx === action.tx && p.ty === action.ty) {
          total.displacedPopulation += q.displacedPopulation;
        }
      } else if (p.reason === 'nuisance') {
        have.amount += p.amount;
        have.strength = Math.max(have.strength, p.strength);
      }
    }
  }
  for (const p of total.parts) {
    if (p.amount < 0) total.cost += -p.amount; else total.reward += p.amount;
  }
  total.affordable = canAfford(world, total.cost);
  return total;
}

/** What a command charged, by reason, so undo can give back exactly that. */
export type PcCharges = [reason: PcReason, delta: number][];

/**
 * Apply a quote's costs and rewards to the world: one `changePc` per reason,
 * at tile (tx, ty). Returns what was applied, for `refundCharges`.
 */
export function chargeQuote(world: World, q: PcQuote, tx: number, ty: number): PcCharges {
  const charges: PcCharges = [];
  for (const p of q.parts) {
    const have = charges.find(c => c[0] === p.reason);
    if (have) have[1] += p.amount; else charges.push([p.reason, p.amount]);
  }
  for (const [reason, delta] of charges) changePc(world, delta, reason, { tx, ty });
  return charges;
}

/** Undo `chargeQuote`: reverse each change, last first. */
export function refundCharges(world: World, charges: PcCharges, tx: number, ty: number): void {
  for (let k = charges.length - 1; k >= 0; k--) {
    changePc(world, -charges[k][1], charges[k][0], { tx, ty, undo: true });
  }
}
