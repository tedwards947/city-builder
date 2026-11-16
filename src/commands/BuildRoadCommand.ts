import { Command } from './Command';
import type { TileSnapshot } from './Command';
import { snapshotTile, restoreTile, tileDisruption } from './Command';
import type { PcCharges } from '../sim/politics';
import type { World } from '../sim/World';
import { ROAD_NONE, ROAD_STREET, ROAD_HIGHWAY, TERRAIN_WATER } from '../sim/constants';
import { BALANCE } from '../data/balance';
import { pcQuote, chargeQuote, refundCharges, zonesCutOffByHighway } from '../sim/politics';

// Builds a new road OR upgrades an existing road to a higher class.
//
// Rules:
//   - Cannot build on building tiles. Building on water makes a bridge (cost × bridgeMultiplier).
//   - Paving over populated residential displaces residents and costs political
//     capital, exactly like bulldozing it would.
//   - Cannot downgrade (current >= target → no-op).
//   - New road: costs roadClasses[target].cost in full.
//   - Upgrade: costs roadClasses[target].cost − roadClasses[current].cost (delta only).
//   - Upgrading to HIGHWAY: if it causes a residential zone to lose all street/avenue access,
//     the zone abandons immediately and the player takes a political capital hit.
//
// targetClass defaults to ROAD_STREET for backward compatibility.

/**
 * Money needed to make this tile a road of `targetClass`: the full price for a
 * new road, the difference for an upgrade, times the bridge multiplier on
 * water. 0 if the tile already has that class or better; null if a road cannot
 * go here at all (a building, or off the map).
 */
export function roadBuildCost(world: World, tx: number, ty: number, targetClass: number): number | null {
  if (!world.isBuildable(tx, ty, true)) return null;
  const current = world.layers.roadClass[world.grid.idx(tx, ty)];
  if (current >= targetClass) return 0;
  const mult = world.getTerrain(tx, ty) === TERRAIN_WATER ? BALANCE.costs.bridgeMultiplier : 1;
  const currentCost = current !== ROAD_NONE ? BALANCE.roadClasses[current].cost : 0;
  return (BALANCE.roadClasses[targetClass].cost - currentCost) * mult;
}

export class BuildRoadCommand extends Command {
  private readonly tx: number;
  private readonly ty: number;
  private readonly targetClass: number;
  private snap: TileSnapshot | null = null;
  private cost = 0;
  // Political capital changes applied at execute.
  private pcCharges: PcCharges = [];
  private affectedZones: Array<{ tx: number; ty: number; snap: TileSnapshot }> = [];

  constructor(tx: number, ty: number, targetClass = ROAD_STREET) {
    super();
    this.tx = tx;
    this.ty = ty;
    this.targetClass = targetClass;
  }

  execute(world: World): boolean {
    if (!world.isBuildable(this.tx, this.ty, true)) return false;

    const i = world.grid.idx(this.tx, this.ty);
    const current = world.layers.roadClass[i];
    if (current >= this.targetClass) return false; // already same or better class

    const cost = roadBuildCost(world, this.tx, this.ty, this.targetClass)!;

    if (world.budget.money < cost) { this.failReason = 'funds'; return false; }

    // Paving over a populated residential tile displaces its residents, and a
    // highway cuts off the zones beside it that have no other road: both are
    // priced by the quote.
    const quote = pcQuote(world, { type: 'road', tx: this.tx, ty: this.ty, roadClass: this.targetClass });
    if (!quote.affordable) { this.failReason = 'politicalCapital'; return false; }
    const { displacedPopulation, pcCost: displacementCost } = tileDisruption(world, this.tx, this.ty);

    // Snapshot for undo
    this.snap = snapshotTile(world, this.tx, this.ty);
    this.cost = cost;
    // Zones a highway leaves with no street or avenue abandon at once.
    this.affectedZones = this.targetClass === ROAD_HIGHWAY
      ? zonesCutOffByHighway(world, this.tx, this.ty).map(z => ({ ...z, snap: snapshotTile(world, z.tx, z.ty) }))
      : [];

    world.budget.money -= cost;
    this.pcCharges = chargeQuote(world, quote, this.tx, this.ty);

    const ok = world.setRoad(this.tx, this.ty, this.targetClass);

    if (ok) {
      // Apply abandonment to affected zones
      for (const az of this.affectedZones) {
        const azi = world.grid.idx(az.tx, az.ty);
        world.layers.abandoned[azi] = 1;
        world.grid.markDirty(az.tx, az.ty);
        world.events.emit('tileAbandoned', {
          tx: az.tx, ty: az.ty,
          zone: world.layers.zone[azi],
          level: world.layers.devLevel[azi]
        });
      }
      world.events.emit('roadBuilt', { tx: this.tx, ty: this.ty, cost, displacedPopulation, pcCost: displacementCost });
    }
    
    return ok;
  }

  undo(world: World): void {
    if (this.snap) restoreTile(world, this.tx, this.ty, this.snap);
    for (const az of this.affectedZones) {
      restoreTile(world, az.tx, az.ty, az.snap);
    }
    world.budget.money += this.cost;
    refundCharges(world, this.pcCharges, this.tx, this.ty);
  }
}
