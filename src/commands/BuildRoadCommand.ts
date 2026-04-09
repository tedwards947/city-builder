import { Command } from './Command';
import type { TileSnapshot } from './Command';
import { snapshotTile, restoreTile } from './Command';
import type { World } from '../sim/World';
import { ROAD_NONE, ROAD_STREET, ROAD_AVENUE, ROAD_HIGHWAY, ZONE_NONE, ZONE_R, ZONE_C, ZONE_I } from '../sim/constants';
import { BALANCE } from '../data/balance';

// Builds a new road OR upgrades an existing road to a higher class.
//
// Rules:
//   - Cannot build on water or building tiles.
//   - Cannot downgrade (current >= target → no-op).
//   - New road: costs roadClasses[target].cost in full.
//   - Upgrade: costs roadClasses[target].cost − roadClasses[current].cost (delta only).
//   - Upgrading to HIGHWAY: if it causes a residential zone to lose all street/avenue access,
//     the zone abandons immediately and the player takes a political capital hit.
//
// targetClass defaults to ROAD_STREET for backward compatibility.

export class BuildRoadCommand extends Command {
  private readonly tx: number;
  private readonly ty: number;
  private readonly targetClass: number;
  private snap: TileSnapshot | null = null;
  private cost = 0;
  private pcCost = 0;
  private affectedZones: Array<{ tx: number; ty: number; snap: TileSnapshot }> = [];

  constructor(tx: number, ty: number, targetClass = ROAD_STREET) {
    super();
    this.tx = tx;
    this.ty = ty;
    this.targetClass = targetClass;
  }

  execute(world: World): boolean {
    if (!world.isBuildable(this.tx, this.ty)) return false;

    const i = world.grid.idx(this.tx, this.ty);
    const current = world.layers.roadClass[i];
    if (current >= this.targetClass) return false; // already same or better class

    const targetCost  = BALANCE.roadClasses[this.targetClass].cost;
    const currentCost = current !== ROAD_NONE ? BALANCE.roadClasses[current].cost : 0;
    const cost = targetCost - currentCost;

    if (world.budget.money < cost) return false;

    // Snapshot for undo
    this.snap = snapshotTile(world, this.tx, this.ty);
    this.cost = cost;
    this.affectedZones = [];
    this.pcCost = 0;

    // 1. Temporarily apply the road change to check for abandonment impact
    const oldClass = world.layers.roadClass[i];
    world.layers.roadClass[i] = this.targetClass;

    // 2. If upgrading to HIGHWAY, check nearby zones (direct adjacency only)
    if (this.targetClass === ROAD_HIGHWAY) {
      const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;
      for (const [dx, dy] of neighbors) {
        const nx = this.tx + dx, ny = this.ty + dy;
        if (!world.grid.inBounds(nx, ny)) continue;
        
        const ni = world.grid.idx(nx, ny);
        const zone = world.layers.zone[ni];
        const dev = world.layers.devLevel[ni];
        const isAbandoned = world.layers.abandoned[ni] !== 0;

        if (zone !== ZONE_NONE && dev > 0 && !isAbandoned) {
          // Check if it still has valid road access
          let hasValidRoad = false;
          for (const [adx, ady] of neighbors) {
            const anx = nx + adx, any = ny + ady;
            if (!world.grid.inBounds(anx, any)) continue;
            const rc = world.layers.roadClass[world.grid.idx(anx, any)];
            if (rc !== ROAD_NONE && rc !== ROAD_HIGHWAY) {
              hasValidRoad = true;
              break;
            }
          }

          if (!hasValidRoad) {
            // Mark for abandonment
            this.affectedZones.push({ tx: nx, ty: ny, snap: snapshotTile(world, nx, ny) });
            if (zone === ZONE_R) {
              const pop = BALANCE.growth.popPerLevel[dev] ?? 0;
              this.pcCost += pop * BALANCE.politicalCapital.disruptionCosts.bulldozePerPop;
            }
          }
        }
      }
    }

    // 3. Verify we can afford the PC cost
    if (this.pcCost > 0 && world.budget.politicalCapital < this.pcCost) {
      world.layers.roadClass[i] = oldClass; // Revert temp change
      return false;
    }

    // 4. Finalize
    world.budget.money -= cost;
    world.budget.politicalCapital -= this.pcCost;

    // Re-apply road via world method for dirty tracking etc.
    world.layers.roadClass[i] = oldClass; 
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
      world.events.emit('roadBuilt', { tx: this.tx, ty: this.ty, cost });
    }
    
    return ok;
  }

  undo(world: World): void {
    if (this.snap) restoreTile(world, this.tx, this.ty, this.snap);
    for (const az of this.affectedZones) {
      restoreTile(world, az.tx, az.ty, az.snap);
    }
    world.budget.money += this.cost;
    world.budget.politicalCapital += this.pcCost;
  }
}
