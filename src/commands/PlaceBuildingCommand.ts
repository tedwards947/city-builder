import { Command } from './Command';
import type { TileSnapshot } from './Command';
import { snapshotTiles, restoreTiles, withLots, tileDisruption } from './Command';
import { footprintTiles, subwayPlatform } from '../sim/buildingShapes';
import { RAIL_SUBWAY } from '../sim/constants';
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
  private readonly rot: number;
  // Every tile of the building's shape, as it was before.
  private snaps: { i: number; snap: TileSnapshot }[] | null = null;
  // Tiles outside the footprint where placing dug new subway track (a subway station's platform).
  private dug: number[] = [];
  private cost = 0;
  // Political capital changes applied at execute.
  private pcCharges: PcCharges = NO_PC_CHARGES;

  /** `rot`: quarter turns clockwise about the anchor (0–3), for kinds that can be turned (the seaport). */
  constructor(tx: number, ty: number, kind: number, rot = 0) {
    super();
    this.tx = tx;
    this.ty = ty;
    this.kind = kind;
    this.rot = rot & 3;
  }

  execute(world: World): boolean {
    const where = world.checkPlacement(this.tx, this.ty, this.kind, this.rot);
    if (!where.ok) {
      // Free land, but this kind needs water beside it, or open water under its docks: worth saying so.
      const why = world.placeBlocker(this.tx, this.ty, this.kind, this.rot);
      if (why === 'noWater' || why === 'notOpenWater' || why === 'alreadyBuilt') this.failReason = why;
      return false;
    }
    const cost = BALANCE.buildings[this.kind]?.cost ?? 0;
    if (world.budget.money < cost) { this.failReason = 'funds'; return false; }

    // Residents displaced and what that costs, over every tile of the building's shape.
    let displacedPopulation = 0, pcCost = 0;
    const { width, height } = world.grid;
    const footprint = footprintTiles(width, height, this.tx, this.ty, this.kind, this.rot)!;
    for (const i of footprint) {
      const d = tileDisruption(world, i % width, (i - (i % width)) / width);
      displacedPopulation += d.displacedPopulation;
      pcCost += d.pcCost;
    }
    const quote = pcQuote(world, { type: 'building', tx: this.tx, ty: this.ty, kind: this.kind, rot: this.rot });
    if (!quote.affordable) { this.failReason = 'politicalCapital'; return false; }

    this.snaps = snapshotTiles(world, withLots(world, footprint));
    // The platform of a subway station lies under other tiles: note which of them have no tunnel yet,
    // so undo fills in only what this dug (and never touches what stands on those tiles).
    this.dug = [];
    for (const [dx, dy] of subwayPlatform(this.kind, this.rot)) {
      const i = world.grid.idx(this.tx + dx, this.ty + dy);
      if (!footprint.includes(i) && !(world.layers.rail[i] & RAIL_SUBWAY)) this.dug.push(i);
    }
    this.cost = cost;
    world.budget.money -= this.cost;
    this.pcCharges = chargeQuote(world, quote, this.tx, this.ty);
    const ok = world.placeBuilding(this.tx, this.ty, this.kind, this.rot);
    if (ok) world.events.emit('buildingPlaced', {
      tx: this.tx, ty: this.ty, kind: this.kind, cost: this.cost,
      displacedPopulation, pcCost,
    });
    return ok;
  }

  undo(world: World): void {
    if (this.snaps) restoreTiles(world, this.snaps);
    for (const i of this.dug) {
      world.layers.rail[i] &= ~RAIL_SUBWAY;
      world.railVersion++;
      world.grid.markDirty(i % world.grid.width, (i - (i % world.grid.width)) / world.grid.width);
    }
    this.dug = [];
    world.budget.money += this.cost;
    refundCharges(world, this.pcCharges, this.tx, this.ty);
  }
}
