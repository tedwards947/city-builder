import { Command } from './Command';
import type { TileSnapshot } from './Command';
import { snapshotTiles, restoreTiles, tilesClearedWith, tileDisruption } from './Command';
import type { PcCharges } from '../sim/politics';
import type { World } from '../sim/World';
import { ZONE_NONE, ROAD_NONE, RAIL_SURFACE, BUILDING_NONE } from '../sim/constants';
import { BALANCE } from '../data/balance';
import { NO_PC_CHARGES, pcQuote, chargeQuote, refundCharges } from '../sim/politics';

export class BulldozeCommand extends Command {
  private readonly tx: number;
  private readonly ty: number;
  // Every tile this clears: the tile, or the whole building it is part of.
  private snaps: { i: number; snap: TileSnapshot }[] | null = null;
  private cost = 0;
  // Political capital changes applied at execute.
  private pcCharges: PcCharges = NO_PC_CHARGES;

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
        (world.layers.rail[i] & RAIL_SURFACE) === 0 &&      // a subway underneath is not the bulldozer's (RemoveSubwayCommand)
        world.layers.building[i] === BUILDING_NONE) return false;
    // No funds check: demolition is allowed in debt (it is how a broke city
    // cuts upkeep). It still charges BALANCE.costs.bulldoze.

    // Displacing residents from an active zone costs PC; clearing an abandoned
    // building rewards it (clearing blight is popular).
    const { displacedPopulation, pcCost, pcReward } = tileDisruption(world, this.tx, this.ty);

    // Check if we can afford the PC cost (if any).
    const quote = pcQuote(world, { type: 'bulldoze', tx: this.tx, ty: this.ty });
    if (!quote.affordable) { this.failReason = 'politicalCapital'; return false; }

    this.snaps = snapshotTiles(world, tilesClearedWith(world, this.tx, this.ty));
    const here = this.snaps.find(s => s.i === i)!.snap;
    this.cost = BALANCE.costs.bulldoze;

    world.budget.money -= this.cost;
    // The cap is enforced by PoliticsSystem on its next tick.
    this.pcCharges = chargeQuote(world, quote, this.tx, this.ty);

    const ok = world.clearTile(this.tx, this.ty);
    if (ok) world.events.emit('tileCleared', {
      tx: this.tx, ty: this.ty,
      displacedPopulation,
      pcCost,
      pcReward,
      hadBuilding: here.building,
      hadZone: here.zone,
      devLevel: here.dev,
    });
    return ok;
  }

  undo(world: World): void {
    if (this.snaps) restoreTiles(world, this.snaps);
    world.budget.money += this.cost;
    // Reverses both costs and rewards.
    refundCharges(world, this.pcCharges, this.tx, this.ty);
  }
}
