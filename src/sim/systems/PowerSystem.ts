// Power propagation.
// Plants energize adjacent road tiles. Power flows along connected roads
// (same road network component). Power then radiates one tile off any
// powered road — so zones adjacent to a powered road receive power.
// The work is in utilityCoverage.ts, shared with water and sewage.

import { World } from '../World';
import { BUILDING_POWER_PLANT } from '../constants';
import { BALANCE } from '../../data/balance';
import { spreadUtility, utilityDemand } from './utilityCoverage';

export class PowerSystem {
  private _inShortage = false;

  update(world: World): void {
    const totalSupply = spreadUtility(
      world, world.layers.power, BUILDING_POWER_PLANT, BALANCE.power.plantOutput, BALANCE.power.propagationRange,
    );
    // Demand from developed zones (abandoned tiles consume nothing).
    const totalDemand = utilityDemand(world, 1, BALANCE.power.perDevLevel);
    world.stats.powerSupply = totalSupply;
    world.stats.powerDemand = totalDemand;

    const shortage = totalDemand > totalSupply;
    if (shortage && !this._inShortage) {
      world.events.emit('powerShortage', { supply: totalSupply, demand: totalDemand, deficit: totalDemand - totalSupply });
    } else if (!shortage && this._inShortage) {
      world.events.emit('powerRestored', { supply: totalSupply, demand: totalDemand });
    }
    this._inShortage = shortage;

    // Mark all chunks dirty — power state may have changed across many tiles.
    // (Cheap: the renderer only redraws chunks whose content really changed.)
    world.grid.markAllDirty();
  }
}
