import { Command } from './Command';
import type { TileSnapshot } from './Command';
import { snapshotTile, restoreTile, tileDisruption } from './Command';
import type { World } from '../sim/World';
import { ZONE_NONE, ROAD_NONE, BUILDING_NONE } from '../sim/constants';
import { BALANCE } from '../data/balance';
import { changePc } from '../sim/politics';

export class BulldozeCommand extends Command {
  private readonly tx: number;
  private readonly ty: number;
  private snap: TileSnapshot | null = null;
  private cost = 0;
  // Change to political capital applied at execute (negative = cost, positive = reward).
  private pcDelta = 0;

  constructor(tx: number, ty: number) {
    super();
    this.tx = tx;
    this.ty = ty;
  }

  execute(world: World): boolean {
    if (!world.grid.inBounds(this.tx, this.ty)) return false;
    const i = world.grid.idx(this.tx, this.ty);
    if (world.layers.zone[i] === ZONE_NONE &&
        world.layers.roadClass[i] === ROAD_NONE &&
        world.layers.building[i] === BUILDING_NONE) return false;
    // No funds check: demolition is allowed in debt (it is how a broke city
    // cuts upkeep). It still charges BALANCE.costs.bulldoze.

    // Displacing residents from an active zone costs PC; clearing an abandoned
    // building rewards it (clearing blight is popular).
    const { displacedPopulation, pcCost, pcReward } = tileDisruption(world, this.tx, this.ty);

    // Check if we can afford the PC cost (if any).
    if (pcCost > 0 && world.budget.politicalCapital < pcCost) { this.failReason = 'politicalCapital'; return false; }

    this.snap = snapshotTile(world, this.tx, this.ty);
    this.cost = BALANCE.costs.bulldoze;
    this.pcDelta = pcReward - pcCost;

    world.budget.money -= this.cost;
    // The cap is enforced by PoliticsSystem on its next tick.
    changePc(world, this.pcDelta, pcCost > 0 ? 'displacement' : 'blightCleared', { tx: this.tx, ty: this.ty });

    const ok = world.clearTile(this.tx, this.ty);
    if (ok) world.events.emit('tileCleared', {
      tx: this.tx, ty: this.ty,
      displacedPopulation,
      pcCost,
      pcReward,
      hadBuilding: this.snap.building,
      hadZone: this.snap.zone,
      devLevel: this.snap.dev,
    });
    return ok;
  }

  undo(world: World): void {
    if (this.snap) restoreTile(world, this.tx, this.ty, this.snap);
    world.budget.money += this.cost;
    // Reverses both costs and rewards.
    changePc(world, -this.pcDelta, this.pcDelta < 0 ? 'displacement' : 'blightCleared', { tx: this.tx, ty: this.ty, undo: true });
  }
}
