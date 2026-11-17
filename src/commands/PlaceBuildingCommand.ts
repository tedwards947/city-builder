import { Command } from './Command';
import type { TileSnapshot } from './Command';
import { snapshotTiles, restoreTiles, tileDisruption } from './Command';
import { footprintTiles } from '../sim/buildingShapes';
import type { PcCharges } from '../sim/politics';
import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { NO_PC_CHARGES, pcQuote, chargeQuote, refundCharges } from '../sim/politics';

// Places a utility or service building.
// Building over populated residential displaces residents and costs political
// capital, exactly like bulldozing it would.

export class PlaceBuildingCommand extends Command {
  private readonly tx: number;
  private readonly ty: number;
  private readonly kind: number;
  // Every tile of the building's shape, as it was before.
  private snaps: { i: number; snap: TileSnapshot }[] | null = null;
  private cost = 0;
  // Political capital changes applied at execute.
  private pcCharges: PcCharges = NO_PC_CHARGES;

  constructor(tx: number, ty: number, kind: number) {
    super();
    this.tx = tx;
    this.ty = ty;
    this.kind = kind;
  }

  execute(world: World): boolean {
    const where = world.checkPlacement(this.tx, this.ty, this.kind);
    if (!where.ok) {
      // Free land, but this kind needs water beside it: worth saying so.
      if (world.placeBlocker(this.tx, this.ty, this.kind) === 'noWater') this.failReason = 'noWater';
      return false;
    }
    const cost = BALANCE.buildings[this.kind]?.cost ?? 0;
    if (world.budget.money < cost) { this.failReason = 'funds'; return false; }

    // Residents displaced and what that costs, over every tile of the building's shape.
    let displacedPopulation = 0, pcCost = 0;
    const { width, height } = world.grid;
    for (const i of footprintTiles(width, height, this.tx, this.ty, this.kind)!) {
      const d = tileDisruption(world, i % width, (i - (i % width)) / width);
      displacedPopulation += d.displacedPopulation;
      pcCost += d.pcCost;
    }
    const quote = pcQuote(world, { type: 'building', tx: this.tx, ty: this.ty, kind: this.kind });
    if (!quote.affordable) { this.failReason = 'politicalCapital'; return false; }

    this.snaps = snapshotTiles(world, footprintTiles(world.grid.width, world.grid.height, this.tx, this.ty, this.kind)!);
    this.cost = cost;
    world.budget.money -= this.cost;
    this.pcCharges = chargeQuote(world, quote, this.tx, this.ty);
    const ok = world.placeBuilding(this.tx, this.ty, this.kind);
    if (ok) world.events.emit('buildingPlaced', {
      tx: this.tx, ty: this.ty, kind: this.kind, cost: this.cost,
      displacedPopulation, pcCost,
    });
    return ok;
  }

  undo(world: World): void {
    if (this.snaps) restoreTiles(world, this.snaps);
    world.budget.money += this.cost;
    refundCharges(world, this.pcCharges, this.tx, this.ty);
  }
}
