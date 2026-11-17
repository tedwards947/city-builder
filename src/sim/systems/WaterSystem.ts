// Water distribution.
// Towers energize adjacent road tiles. Water flows along connected roads
// (same road network component). Water then radiates one tile off any
// serviced road — so zones adjacent to a serviced road receive water.
// The work is in utilityCoverage.ts, shared with power and sewage.

import { World } from '../World';
import { BUILDING_WATER_TOWER, BUILDING_LARGE_WATER_PLANT } from '../constants';
import { BALANCE } from '../../data/balance';
import { spreadUtility, utilityDemand } from './utilityCoverage';

export class WaterSystem {
  private _inShortage = false;

  update(world: World): void {
    const totalSupply = spreadUtility(
      world, world.layers.water,
      { [BUILDING_WATER_TOWER]: BALANCE.water.towerOutput, [BUILDING_LARGE_WATER_PLANT]: BALANCE.water.largePlantOutput },
      0, BALANCE.water.propagationRange,
    );
    // Demand from developed zones (abandoned tiles consume nothing).
    const totalDemand = utilityDemand(world, 1, BALANCE.water.perDevLevel);
    world.stats.waterSupply = totalSupply;
    world.stats.waterDemand = totalDemand;

    const shortage = totalDemand > totalSupply;
    if (shortage && !this._inShortage) {
      world.events.emit('waterShortage', { supply: totalSupply, demand: totalDemand, deficit: totalDemand - totalSupply });
    } else if (!shortage && this._inShortage) {
      world.events.emit('waterRestored', { supply: totalSupply, demand: totalDemand });
    }
    this._inShortage = shortage;

    world.grid.markAllDirty();
  }
}
