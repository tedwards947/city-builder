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

import { trackBlocker } from './rail';
import type { World } from './World';
import { ROAD_NONE, ROAD_HIGHWAY, ZONE_NONE, ZONE_R, ZONE_I, RAIL_ELEVATED } from './constants';
import { BALANCE } from '../data/balance';
import { isServiceCapstone } from './capstones';
import { serviceOpeningValue, serviceClosureValue, isServiceKind, touchesAccessRoad, shapeTouchesAccessRoad } from './serviceValue';
import { footprintTiles, shapeRoles, hasDocks, overheadPlatform } from './buildingShapes';
import type { ServiceValueConfig } from './serviceValue';
import { ordinanceModifier } from './ordinances';
import { bigProjectPc } from './leisure';
import { isEstablished } from './established';

/** Why political capital changed. */
export type PcReason =
  | 'displacement'    // residents lost their homes (bulldoze, rezone, road or building over homes)
  | 'blightCleared'   // an abandoned building was cleared
  | 'nuisance'        // something unpopular (industry, a power or sewage plant) was put near homes
  | 'serviceOpened'   // a service building opened: the residents it covers are pleased
  | 'serviceClosed'   // a service building closed: the residents it covered object
  | 'milestone'       // the population reached a milestone for the first time
  | 'ordinanceEnacted' // the player enacted an ordinance (src/sim/ordinances.ts)
  | 'ordinanceUpkeep'  // a day's upkeep for the active ordinances
  | 'requestMet'       // a resident request was met (src/sim/requests.ts)
  | 'requestFailed'    // a resident request ran past its deadline
  | 'bigProject'       // a big project was built: a unique building costs political capital (sim/leisure.ts)
  | 'eventJam'         // residents were stuck in an event day's jam (sim/eventDays.ts)
  | 'eventSmooth'      // an event went smoothly: most fans got in, few residents were stuck (sim/eventDays.ts)
  | 'debt';            // a day with the city's money below zero (src/sim/debt.ts)

/**
 * Changes the simulation makes on its own, not part of the player's current
 * action, even when they land in the middle of a drag: CommandHistory leaves
 * them out of pcAction. (Enacting an ordinance is a player action, but it is
 * not a command, so it is left out too.)
 */
export const NOT_PLAYER_ACTION: readonly PcReason[] = ['milestone', 'ordinanceEnacted', 'ordinanceUpkeep', 'requestMet', 'requestFailed', 'debt', 'eventJam', 'eventSmooth'];

export interface PcChangeInfo {
  /** The tile the change came from, if it has one. */
  tx?: number;
  ty?: number;
  /** True when a command is being undone: the change reverses an earlier one. */
  undo?: boolean;
}

/**
 * The cap on political capital: a base plus an amount per resident. Passive
 * regeneration and the rewards in STOPS_AT_CAP stop here; other one-off
 * rewards may take PC over it, and PC already over it is never taken away
 * (not even when the population, and so the cap, falls).
 */
export function pcCap(
  world: World,
  cfg: { max: number; capPerResident: number } = BALANCE.politicalCapital,
): number {
  return cfg.max + world.stats.population * cfg.capPerResident;
}

/**
 * The cap ÷ the base cap: how much bigger this city's PC scale is than a city
 * at the base cap. Regeneration, ordinance upkeep and displacement costs are
 * all multiplied by it, so each stays the same share of the cap at any size.
 * Exactly 1 while the cap is the base cap (capPerResident 0, as shipped).
 */
export function capScale(world: World): number {
  return pcCap(world) / BALANCE.politicalCapital.max;
}

/**
 * One game day of fade for PC banked above the cap: `overCapFadePerDay` of
 * the excess is lost, so a hoard shrinks toward the cap and never below it.
 * Rewards may still take PC over the cap; they just do not stay there for
 * ever. No event (it is a passive change, like regeneration); it is counted
 * in world.pcRegenTotal. Returns the amount lost. Does nothing while the
 * rate is 0.
 */
export function fadeOverCap(
  world: World,
  ratePerDay: number = BALANCE.politicalCapital.overCapFadePerDay,
): number {
  if (!(ratePerDay > 0)) return 0;
  const excess = world.budget.politicalCapital - pcCap(world);
  if (excess <= 0) return 0;
  const lost = excess * Math.min(1, ratePerDay);
  world.budget.politicalCapital -= lost;
  world.pcRegenTotal -= lost;
  return lost;
}

/** What `fadeOverCap` would take on the next game day, for a HUD read-out. 0 at or below the cap. */
export function overCapFadePerDay(world: World): number {
  const rate = BALANCE.politicalCapital.overCapFadePerDay;
  if (!(rate > 0)) return 0;
  return Math.max(0, world.budget.politicalCapital - pcCap(world)) * Math.min(1, rate);
}

/** Rewards that fill PC up to the cap but never past it. */
// Met-request rewards may go over the cap, like ribbon cuttings and milestones (owner, 2026-11-16).
const STOPS_AT_CAP: readonly PcReason[] = ['blightCleared', 'eventSmooth'];

/**
 * Costs that are never refused: they are charged in full even when the city
 * cannot cover them, which takes PC below 0 ("political debt"). Closing a
 * service is how a broke city cuts costs, so it must always be possible; the
 * debt is what stops opening and closing services from being a way to farm PC.
 * While PC is below 0 every other action that costs PC is refused, until
 * regeneration (or a reward) brings it back up.
 */
const NEVER_REFUSED: readonly PcReason[] = ['serviceClosed'];

/** How much of a reward that stops at the cap there is room for right now. */
function roomBelowCap(world: World): number {
  return Math.max(0, pcCap(world) - world.budget.politicalCapital);
}

/**
 * Add `delta` to political capital (negative for a cost) and tell listeners.
 * A reward whose reason is in STOPS_AT_CAP is cut down to the room below the
 * cap. Costs are applied in full: one whose reason is in NEVER_REFUSED may
 * take PC below 0. Returns the change actually made, which is what undo must
 * reverse.
 * Emits `pcChanged` (see CityEvents) unless nothing changed. CommandHistory
 * adds these up into one `pcAction` per finished player action.
 */
export function changePc(world: World, delta: number, reason: PcReason, info: PcChangeInfo = {}): number {
  const before = world.budget.politicalCapital;
  let after = before + delta;
  if (delta > 0 && info.undo !== true && STOPS_AT_CAP.includes(reason)) {
    const cap = pcCap(world);
    if (after > cap) after = Math.max(before, cap);
  }
  const applied = after === before + delta ? delta : after - before;
  if (applied === 0) return 0;
  world.budget.politicalCapital = after;
  world.events.emit('pcChanged', {
    delta: applied,
    reason,
    tx: info.tx,
    ty: info.ty,
    undo: info.undo === true,
  });
  return applied;
}

/**
 * The passive change to PC per tick at a given satisfaction (0–1), for a
 * city whose cap is the base cap: positive above the neutral point, negative
 * below it (if the numbers allow). See regenPerTick for a city of any size.
 */
export function regenRate(
  satisfaction: number,
  cfg: { baseRegen: number; satisfactionRegenBonus: number; neutralSatisfaction: number } = BALANCE.politicalCapital,
): number {
  return cfg.baseRegen + (satisfaction - cfg.neutralSatisfaction) * cfg.satisfactionRegenBonus;
}

/**
 * The passive change to PC this tick for a city at `satisfaction`: the rate
 * above, scaled by how big the cap has grown (cap ÷ base cap). A bigger city
 * holds more PC and fills, or drains, proportionally faster, so going from
 * empty to full takes the same time at every size.
 */
export function regenPerTick(world: World, satisfaction: number): number {
  return regenRate(satisfaction) * (pcCap(world) / BALANCE.politicalCapital.max);
}

/**
 * Apply one tick of passive regeneration. A gain stops at the cap, and does
 * nothing to PC that is already over it. A loss drains PC (over the cap too)
 * but never below 0, and never deepens a debt. A gain pays a debt off. No event: it happens every tick, and the HUD reads the
 * value directly.
 */
export function regenPc(world: World, amount: number): void {
  const pc = world.budget.politicalCapital;
  let next = pc;
  if (amount < 0) {
    // Low satisfaction drains PC to 0 and no further: only closures make debt.
    if (pc > 0) next = Math.max(0, pc + amount);
  } else {
    const cap = pcCap(world);
    if (pc < cap) next = Math.min(cap, pc + amount);
  }
  world.budget.politicalCapital = next;
  world.pcRegenTotal += next - pc;
}

// ── Population milestones ────────────────────────────────────────────────────

export interface Milestone {
  population: number;
  reward: number;
}

/**
 * The milestones a city is due: those above the population it has already
 * been credited for (`peak`) and at or below its population now, smallest
 * first.
 */
export function dueMilestones(
  peak: number,
  population: number,
  ladder: readonly Milestone[] = BALANCE.politicalCapital.milestones,
): Milestone[] {
  return ladder
    .filter(m => m.population > peak && m.population <= population)
    .sort((a, b) => a.population - b.population);
}

/**
 * Pay any population milestones the city has newly reached and credit it for
 * its population, so none can pay again. Emits `populationMilestone` for each.
 */
export function payMilestones(
  world: World,
  ladder: readonly Milestone[] = BALANCE.politicalCapital.milestones,
): void {
  const population = world.stats.population;
  if (population <= world.politics.peakPopulation) return;
  for (const m of dueMilestones(world.politics.peakPopulation, population, ladder)) {
    changePc(world, m.reward, 'milestone');
    world.events.emit('populationMilestone', { population: m.population, reward: m.reward });
  }
  world.politics.peakPopulation = population;
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
 * PC charged per resident displaced from tile `i`: `bulldozePerPop` × the
 * city's capScale (so a tower costs the same share of the cap at any size),
 * then any ordinance: Eminent Domain scales it everywhere, Heritage
 * Protection scales it for established lots.
 */
function displacementPerResident(world: World, i: number): number {
  let rate = BALANCE.politicalCapital.disruptionCosts.bulldozePerPop * capScale(world) * ordinanceModifier(world, 'displacementCost');
  const heritage = ordinanceModifier(world, 'establishedDemolitionCost');
  if (heritage !== 1 && isEstablished(world, i)) rate *= heritage;
  return rate;
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
    pcCost: displacedPopulation * displacementPerResident(world, i),
    pcReward: isAbandoned && dev > 0 ? dev * costs.abandonedBuildingReward : 0,
  };
}

const N4 = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;

/**
 * The developed, non-abandoned zone tiles beside (tx, ty) that would lose
 * their last street or avenue if (tx, ty) became a highway. Only a street or
 * avenue there gives access now, so a highway on empty land (or over a
 * highway) cuts nobody off: a home that never had a road is left alone
 * (owner's rule). Reads the world, changes nothing.
 */
export function zonesCutOffByHighway(world: World, tx: number, ty: number): { tx: number; ty: number }[] {
  const { grid, layers } = world;
  const out: { tx: number; ty: number }[] = [];
  const here = grid.inBounds(tx, ty) ? layers.roadClass[grid.idx(tx, ty)] : ROAD_NONE;
  if (here === ROAD_NONE || here === ROAD_HIGHWAY) return out;
  for (const [dx, dy] of N4) {
    const nx = tx + dx, ny = ty + dy;
    if (!grid.inBounds(nx, ny)) continue;
    const ni = grid.idx(nx, ny);
    if (layers.zone[ni] === ZONE_NONE || layers.devLevel[ni] === 0 || layers.abandoned[ni] !== 0) continue;
    // A merged 2×2 lot (sim/lots.ts) is one building: a road beside any of its
    // tiles serves it, and if none is left the whole of it is cut off.
    const lot = world.lotTilesAt(ni);
    const tiles = lot.length > 0 ? lot : [ni];
    let hasAccess = false;
    for (const li of tiles) {
      const lx = li % grid.width, ly = (li - lx) / grid.width;
      for (const [adx, ady] of N4) {
        const ax = lx + adx, ay = ly + ady;
        if (ax === tx && ay === ty) continue;            // the tile that becomes a highway
        if (!grid.inBounds(ax, ay)) continue;
        const rc = layers.roadClass[grid.idx(ax, ay)];
        if (rc !== ROAD_NONE && rc !== ROAD_HIGHWAY) { hasAccess = true; break; }
      }
      if (hasAccess) break;
    }
    if (!hasAccess) for (const li of tiles) out.push({ tx: li % grid.width, ty: (li - (li % grid.width)) / grid.width });
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
  /** PC per resident at weight 1 for each tile of rail track laid, by level (a RAIL_ bit). Missing or 0 = off. */
  trackPerResident?: Readonly<Record<number, number>>;
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
  | { type: 'building'; tx: number; ty: number; kind: number; rot?: number }
  | { type: 'road'; tx: number; ty: number; roadClass: number }
  | { type: 'track'; tx: number; ty: number; level: number };

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
  /**
   * False if the action would be refused for lack of PC right now: it has a
   * cost the city cannot cover, which is any cost at all while PC is below 0.
   * A service closure is never refused, so its cost never makes this false.
   */
  affordable: boolean;
  /**
   * The political debt the action would add, set only when it includes a
   * service closure (charged in full whatever the city has): the part of
   * `cost` that PC above 0 does not cover. With PC already below 0 that is
   * the whole cost, so it is the debt added, not the balance afterwards.
   * 0 when the city can cover it. `cost` is the full amount either way.
   */
  shortfall: number;
  /** Residents who lose their homes. */
  displacedPopulation: number;
  /** Every contribution, in the order it is charged. */
  parts: PcPart[];
  /**
   * Set (to true) only for a service building whose spot touches no street
   * or avenue: it may still be built, but it would serve nobody. For a
   * warning beside the price.
   */
  notConnected?: true;
}

function emptyQuote(): PcQuote {
  return { cost: 0, reward: 0, affordable: true, shortfall: 0, displacedPopulation: 0, parts: [] };
}

function addPart(q: PcQuote, reason: PcReason, tx: number, ty: number, amount: number, strength = 1): void {
  if (amount === 0) return;
  q.parts.push({ reason, tx, ty, amount, strength });
}

/**
 * Work out a quote's cost, reward and affordability from its parts. Rewards
 * that stop at the cap count only up to the room there is now (the parts
 * keep their full amounts: they say who is pleased, not what is banked).
 */
function totalUp(world: World, q: PcQuote): void {
  let cost = 0, unrefusable = 0, free = 0, capped = 0;
  for (const p of q.parts) {
    if (p.amount < 0) {
      if (NEVER_REFUSED.includes(p.reason)) unrefusable += -p.amount; else cost += -p.amount;
    }
    else if (STOPS_AT_CAP.includes(p.reason)) capped += p.amount;
    else free += p.amount;
  }
  q.affordable = canAfford(world, cost);
  cost += unrefusable;
  q.cost = cost;
  // The debt added: what PC above zero does not cover.
  q.shortfall = unrefusable > 0 ? Math.max(0, cost - Math.max(0, world.budget.politicalCapital)) : 0;
  q.reward = capped > 0 ? free + Math.min(capped, roomBelowCap(world)) : free;
}

/** An action is refused when it has a cost the city cannot cover. Rewards do not offset it. */
function canAfford(world: World, cost: number): boolean {
  return !(cost > 0 && world.budget.politicalCapital < cost);
}

/**
 * What `action` would cost or earn in political capital right now, and why.
 * Reads the world, changes nothing. An action that would do nothing (painting
 * a zone a tile already has, a road where one cannot go) quotes as empty.
 * A building is priced over its whole shape, anchored at (tx, ty): every home
 * under it is displaced, and a nuisance is felt from its nearest tile.
 * It scans at most the nuisance radius round the tile, so it is cheap enough
 * to call every frame for a hover preview. (A service building also walks
 * the roads its coverage would follow, as the coverage preview already does.)
 */
export function pcQuote(
  world: World,
  action: PcQuoteAction,
  nuisance: NuisanceConfig = BALANCE.politicalCapital.nuisance,
  service: ServiceValueConfig = BALANCE.politicalCapital.service,
): PcQuote {
  const q = emptyQuote();
  const { grid, layers } = world;
  const { tx, ty } = action;
  if (!grid.inBounds(tx, ty)) return q;
  const i = grid.idx(tx, ty);
  const d = tileDisruption(world, tx, ty);
  // The tiles the action stands on: a building's whole shape, otherwise the tile.
  let footprint: readonly number[] = [i];
  // Residents displaced from tiles other than (tx, ty) itself.
  let displacedElsewhere = 0;
  // Whatever stood on tile `ti` goes: its residents are displaced and, with
  // `blight`, its ruin cleared. A merged 2×2 lot (sim/lots.ts) is one building
  // and comes down whole, so all four of its tiles count, each once.
  const gone = new Set<number>();
  const displace = (ti: number, blight: boolean): void => {
    const lot = world.lotTilesAt(ti);
    for (const li of lot.length > 0 ? lot : [ti]) {
      if (gone.has(li)) continue;
      gone.add(li);
      const lx = li % grid.width, ly = (li - lx) / grid.width;
      const ld = li === i ? d : tileDisruption(world, lx, ly);
      addPart(q, 'displacement', lx, ly, -ld.pcCost);
      if (blight) addPart(q, 'blightCleared', lx, ly, ld.pcReward);
      if (li !== i) displacedElsewhere += ld.displacedPopulation;
    }
  };

  switch (action.type) {
    case 'bulldoze':
      displace(i, true);
      // Closing a service: the residents it covered object.
      {
        const parts = serviceClosureValue(world, tx, ty, service);
        // A service capstone covers the whole city: what closing it costs is capped at a share of the PC cap.
        let scale = 1;
        const at = world.buildingAnchorAt(i);
        if (parts.length > 0 && at >= 0 && isServiceCapstone(layers.building[at])) {
          let cost = 0;
          for (const p of parts) cost -= p.amount;
          const most = BALANCE.capstones.closurePcShare * pcCap(world);
          if (cost > most && cost > 0) scale = most / cost;
        }
        for (const p of parts) addPart(q, 'serviceClosed', p.tx, p.ty, p.amount * scale, p.strength);
      }
      break;
    case 'zone': {
      if (!world.isBuildable(tx, ty) || layers.roadClass[i] !== ROAD_NONE) return q;
      if (layers.zone[i] === action.zone && layers.abandoned[i] === 0) return q;
      displace(i, true);
      break;
    }
    case 'building':
      // Building over a ruin earns nothing: only bulldozing or rezoning clears blight.
      if (!world.canPlaceBuilding(tx, ty, action.kind, action.rot ?? 0)) return q;
      footprint = footprintTiles(grid.width, grid.height, tx, ty, action.kind, action.rot ?? 0)!;
      // Every home under the building's shape is displaced.
      for (const fi of footprint) displace(fi, false);
      if (isServiceKind(action.kind) && !(footprint.length === 1 ? touchesAccessRoad(world, tx, ty) : shapeTouchesAccessRoad(world, footprint))) q.notConnected = true;
      // A big project (a unique building) costs political capital outright.
      addPart(q, 'bigProject', tx, ty, -bigProjectPc(action.kind));
      // Opening a service: the residents it will cover are pleased.
      for (const p of serviceOpeningValue(world, tx, ty, action.kind, service)) {
        addPart(q, 'serviceOpened', p.tx, p.ty, p.amount, p.strength);
      }
      break;
    case 'track':
      // Track goes on no zone, so it displaces nobody; the homes nearby object (below).
      if (trackBlocker(world, tx, ty, action.level) !== null) return q;
      break;
    case 'road': {
      if (!world.isBuildable(tx, ty, true) || layers.roadClass[i] >= action.roadClass) return q;
      displace(i, false);
      // A highway gives no access: homes left with no other road abandon.
      if (action.roadClass === ROAD_HIGHWAY) {
        for (const z of zonesCutOffByHighway(world, tx, ty)) {
          const zi = grid.idx(z.tx, z.ty);
          if (layers.zone[zi] !== ZONE_R) continue;
          const pop = BALANCE.growth.popPerLevel[layers.devLevel[zi]] ?? 0;
          addPart(q, 'displacement', z.tx, z.ty, -(pop * displacementPerResident(world, zi)));
        }
      }
      break;
    }
  }
  if (q.parts.some(p => p.reason === 'displacement' && p.tx === tx && p.ty === ty)) {
    q.displacedPopulation = d.displacedPopulation;
  }
  q.displacedPopulation += displacedElsewhere;

  // Homes nearby object to a nuisance. Land that is already industrial is not a new one.
  const rate = action.type === 'zone' ? nuisanceRate({ zone: action.zone }, nuisance)
             : action.type === 'building' ? nuisanceRate({ kind: action.kind }, nuisance)
             : action.type === 'track' ? (nuisance.trackPerResident?.[action.level] ?? 0)
             : 0;
  const alreadyIndustrial = action.type === 'zone' && layers.zone[i] === ZONE_I;
  // Homes within the bands of `from` (the tiles of what is placed) object at `perResident`.
  const object = (from: readonly number[], perResident: number): void => {
    if (!(perResident > 0) || nuisance.bands.length === 0 || from.length === 0) return;
    const radius = nuisance.bands[nuisance.bands.length - 1].within;
    // A home's distance is to the nearest tile of what is being placed, so a
    // large building is a nuisance from its edge, not from its anchor.
    const width = grid.width;
    let fx0 = Infinity, fx1 = -Infinity, fy0 = Infinity, fy1 = -Infinity;
    for (const fi of from) {
      const fx = fi % width, fy = (fi - fx) / width;
      if (fx < fx0) fx0 = fx; if (fx > fx1) fx1 = fx;
      if (fy < fy0) fy0 = fy; if (fy > fy1) fy1 = fy;
    }
    for (let hy = fy0 - radius; hy <= fy1 + radius; hy++) {
      for (let hx = fx0 - radius; hx <= fx1 + radius; hx++) {
        if (!grid.inBounds(hx, hy)) continue;
        let dist = Infinity;
        for (const fi of from) {
          const fx = fi % width, fy = (fi - fx) / width;
          const m = Math.abs(hx - fx) + Math.abs(hy - fy);
          if (m < dist) dist = m;
        }
        if (dist === 0 || dist > radius) continue;
        const hi = grid.idx(hx, hy);
        if (layers.zone[hi] !== ZONE_R || layers.devLevel[hi] === 0 || layers.abandoned[hi] !== 0) continue;
        let weight = 0;
        for (const band of nuisance.bands) if (dist <= band.within) { weight = band.weight; break; }
        const pop = BALANCE.growth.popPerLevel[layers.devLevel[hi]] ?? 0;
        addPart(q, 'nuisance', hx, hy, -(pop * perResident * weight), weight);
      }
    }
  };
  if (!alreadyIndustrial) {
    // Docks stand out over the water: homes object to the yard, not to them.
    if (action.type === 'building' && hasDocks(action.kind)) {
      const roles = shapeRoles(action.kind);
      footprint = footprint.filter((_, k) => roles[k] !== 'dock');
    }
    object(footprint, rate);
    // An elevated station lays elevated track for its platform: each platform tile that has none yet is charged
    // as that tile of elevated track would be (the 'track' action), tile by tile. Over track already there it costs nothing.
    if (action.type === 'building') {
      const perTile = nuisance.trackPerResident?.[RAIL_ELEVATED] ?? 0;
      for (const [dx, dy] of overheadPlatform(action.kind, action.rot ?? 0)) {
        const fi = grid.idx(tx + dx, ty + dy);
        if (!(layers.rail[fi] & RAIL_ELEVATED)) object([fi], perTile);
      }
    }
  }

  totalUp(world, q);
  return q;
}

/**
 * One quote for several actions done together (a zone drag, a zone fill, an
 * auto road). Parts for the same tile and reason are merged:
 *   - a home can only be displaced, and a ruin only cleared, once, so those
 *     count once however many of the actions touch it;
 *   - everything else adds up (each industrial tile is charged, each service
 *     building counted), keeping the strongest `strength`.
 * It prices each action against the world as it is now, so it is an estimate
 * where one action changes what the next would cost.
 */
export function pcQuoteMany(
  world: World,
  actions: readonly PcQuoteAction[],
  nuisance: NuisanceConfig = BALANCE.politicalCapital.nuisance,
  service: ServiceValueConfig = BALANCE.politicalCapital.service,
): PcQuote {
  const total = emptyQuote();
  const byKey = new Map<string, PcPart>();
  const width = world.grid.width;
  for (const action of actions) {
    const q = pcQuote(world, action, nuisance, service);
    if (q.notConnected) total.notConnected = true;
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
      } else if (p.reason !== 'displacement' && p.reason !== 'blightCleared') {
        have.amount += p.amount;
        have.strength = Math.max(have.strength, p.strength);
      }
    }
  }
  totalUp(world, total);
  return total;
}

/** What a command charged, so undo can give back exactly that and no more. */
export interface PcCharges {
  /** Political capital just before the command charged anything. */
  before: number;
  /** `world.pcRegenTotal` at that moment. */
  regenTotal: number;
  /** The change applied for each reason, in order. */
  changes: [reason: PcReason, delta: number][];
}

/** The charges of a command that has not run. */
export const NO_PC_CHARGES: PcCharges = { before: 0, regenTotal: 0, changes: [] };

/**
 * Apply a quote's costs and rewards to the world: one `changePc` per reason,
 * at tile (tx, ty). Returns what was applied, for `refundCharges`.
 */
export function chargeQuote(world: World, q: PcQuote, tx: number, ty: number): PcCharges {
  const wanted: [PcReason, number][] = [];
  for (const p of q.parts) {
    const have = wanted.find(c => c[0] === p.reason);
    if (have) have[1] += p.amount; else wanted.push([p.reason, p.amount]);
  }
  // Keep what was actually applied: a reward may have been cut at the cap.
  const applied: PcCharges = { before: world.budget.politicalCapital, regenTotal: world.pcRegenTotal, changes: [] };
  for (const [reason, delta] of wanted) {
    const got = changePc(world, delta, reason, { tx, ty });
    if (got !== 0) applied.changes.push([reason, got]);
  }
  return applied;
}

/**
 * Undo `chargeQuote`: reverse each change, last first.
 *
 * A cost is given back only as far as regeneration has not already made it
 * up. Without that a player could spend PC at a full bar, wait for it to
 * refill, undo, and hold the refund on top of the full bar with the homes
 * back as well. The refund leaves PC where it would have been had the
 * command never run: regeneration that would have happened anyway (the bar
 * was not full) is kept, regeneration that only happened because the command
 * made room is not paid twice.
 */
export function refundCharges(world: World, charges: PcCharges, tx: number, ty: number): void {
  let cost = 0;
  for (const [, delta] of charges.changes) if (delta < 0) cost += -delta;
  let allowed = cost;
  const regenSince = world.pcRegenTotal - charges.regenTotal;
  if (cost > 0 && regenSince !== 0) {
    const { before } = charges;
    // Where regeneration alone would have taken PC without the command…
    const without = regenSince < 0 ? Math.max(0, before + regenSince)
                  : before >= pcCap(world) ? before
                  : Math.min(pcCap(world), before + regenSince);
    // …and where it took it with the command.
    const withIt = before - cost + regenSince;
    allowed = Math.min(cost, Math.max(0, without - withIt));
  }
  for (let k = charges.changes.length - 1; k >= 0; k--) {
    const [reason, delta] = charges.changes[k];
    let back = -delta;
    if (back > 0) {
      back = Math.min(back, allowed);
      allowed -= back;
    }
    changePc(world, back, reason, { tx, ty, undo: true });
  }
}
