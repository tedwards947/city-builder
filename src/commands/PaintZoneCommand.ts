import { Command } from './Command';
import type { TileSnapshot } from './Command';
import { snapshotTile, restoreTile, tileDisruption } from './Command';
import type { PcCharges } from '../sim/politics';
import type { World } from '../sim/World';
import { ZONE_NONE, ZONE_R, ZONE_C, ROAD_NONE } from '../sim/constants';
import { BALANCE } from '../data/balance';
import { NO_PC_CHARGES, pcQuote, chargeQuote, refundCharges } from '../sim/politics';

// Paints a zone onto a tile.
//
// Rules:
//   - Cannot paint on water, building or road tiles (bulldoze the road first).
//   - Painting the zone a healthy tile already has is a no-op (no charge).
//   - Painting the same zone over an ABANDONED tile clears the ruin: the tile
//     resets to an empty lot of that zone and the blight reward is paid once.
//   - Painting a different zone over populated residential displaces residents
//     and costs political capital.

export class PaintZoneCommand extends Command {
  private readonly tx: number;
  private readonly ty: number;
  private readonly newZone: number;
  private snap: TileSnapshot | null = null;
  private cost = 0;
  // Political capital changes applied at execute.
  private pcCharges: PcCharges = NO_PC_CHARGES;

  constructor(tx: number, ty: number, newZone: number) {
    super();
    this.tx = tx;
    this.ty = ty;
    this.newZone = newZone;
  }

  execute(world: World): boolean {
    if (!world.isBuildable(this.tx, this.ty)) return false;
    const i = world.grid.idx(this.tx, this.ty);
    if (world.layers.roadClass[i] !== ROAD_NONE) return false;

    const sameZone = world.layers.zone[i] === this.newZone;
    const isAbandoned = world.layers.abandoned[i] !== 0;
    if (sameZone && !isAbandoned) return false; // nothing to do

    const cost = this.newZone === ZONE_R ? BALANCE.costs.zoneR
               : this.newZone === ZONE_C ? BALANCE.costs.zoneC
               : BALANCE.costs.zoneI;
    if (world.budget.money < cost) { this.failReason = 'funds'; return false; }

    const { displacedPopulation, pcCost, pcReward } = tileDisruption(world, this.tx, this.ty);
    const quote = pcQuote(world, { type: 'zone', tx: this.tx, ty: this.ty, zone: this.newZone });
    if (!quote.affordable) { this.failReason = 'politicalCapital'; return false; }

    this.snap = snapshotTile(world, this.tx, this.ty);
    this.cost = cost;

    world.budget.money -= cost;
    this.pcCharges = chargeQuote(world, quote, this.tx, this.ty);

    // setZone only resets dev/abandoned/distress when the zone changes, so a
    // same-zone repaint of a ruin is cleared to an empty lot first.
    if (sameZone) world.setZone(this.tx, this.ty, ZONE_NONE);
    const ok = world.setZone(this.tx, this.ty, this.newZone);
    if (ok) world.events.emit('zonePainted', {
      tx: this.tx, ty: this.ty,
      zone: this.newZone,
      cost,
      displacedPopulation,
      pcCost,
      pcReward,
    });
    return ok;
  }

  undo(world: World): void {
    if (this.snap) restoreTile(world, this.tx, this.ty, this.snap);
    world.budget.money += this.cost;
    // Reverses both costs and rewards.
    refundCharges(world, this.pcCharges, this.tx, this.ty);
  }
}
