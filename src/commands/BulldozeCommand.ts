import { Command } from './Command';
import type { TileSnapshot } from './Command';
import { snapshotTile, restoreTile } from './Command';
import type { World } from '../sim/World';
import { ZONE_NONE, ZONE_R, ROAD_NONE, BUILDING_NONE } from '../sim/constants';
import { BALANCE } from '../data/balance';

export class BulldozeCommand extends Command {
  private readonly tx: number;
  private readonly ty: number;
  private snap: TileSnapshot | null = null;
  private cost = 0;
  private pcCost = 0;

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
    if (world.budget.money < BALANCE.costs.bulldoze) return false;

    const isAbandoned = world.layers.abandoned[i] !== 0;
    const devLevel = world.layers.devLevel[i];

    // Displacing residents from an active zone costs PC.
    // However, if the building is abandoned, there is no displacement cost.
    const displacedPopulation =
      !isAbandoned && world.layers.zone[i] === ZONE_R
        ? (BALANCE.growth.popPerLevel[devLevel] ?? 0)
        : 0;

    const pcCost = displacedPopulation > 0
      ? displacedPopulation * BALANCE.politicalCapital.disruptionCosts.bulldozePerPop
      : 0;

    // Clearing an abandoned building rewards PC (clearing blight).
    const pcReward = (isAbandoned && devLevel > 0)
      ? devLevel * BALANCE.politicalCapital.disruptionCosts.abandonedBuildingReward
      : 0;

    // Check if we can afford the PC cost (if any).
    if (pcCost > 0 && world.budget.politicalCapital < pcCost) return false;

    this.snap = snapshotTile(world, this.tx, this.ty);
    this.cost = BALANCE.costs.bulldoze;
    this.pcCost = pcCost - pcReward; // Net change (positive = cost, negative = reward)

    world.budget.money -= this.cost;
    // Apply net political capital change (capped by PoliticsSystem max in its tick, but here we just mutate).
    world.budget.politicalCapital -= this.pcCost;

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
    if (this.pcCost > 0) world.budget.politicalCapital += this.pcCost;
  }
}
