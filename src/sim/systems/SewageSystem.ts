// Sewage treatment coverage.
// Plants energize adjacent road tiles. Sewage coverage flows along connected
// roads (same road network component) and radiates one tile off serviced roads.
// The work is in utilityCoverage.ts, shared with power and water.

import { World } from '../World';
import { BUILDING_SEWAGE_PLANT, BUILDING_LARGE_SEWAGE_PLANT } from '../constants';
import { BALANCE } from '../../data/balance';
import { spreadUtility, utilityDemand } from './utilityCoverage';

export class SewageSystem {
  private _inShortage = false;

  update(world: World): void {
    const totalSupply = spreadUtility(
      world, world.layers.sewage,
      { [BUILDING_SEWAGE_PLANT]: BALANCE.sewage.plantOutput, [BUILDING_LARGE_SEWAGE_PLANT]: BALANCE.sewage.largePlantOutput },
      0, BALANCE.sewage.propagationRange,
    );
    // Demand from high-density developed zones (abandoned tiles consume nothing).
    const totalDemand = utilityDemand(world, 2, BALANCE.sewage.perDevLevel);
    world.stats.sewageSupply = totalSupply;
    world.stats.sewageDemand = totalDemand;

    const shortage = totalDemand > totalSupply;
    if (shortage && !this._inShortage) {
      world.events.emit('sewageShortage', { supply: totalSupply, demand: totalDemand, deficit: totalDemand - totalSupply });
    } else if (!shortage && this._inShortage) {
      world.events.emit('sewageRestored', { supply: totalSupply, demand: totalDemand });
    }
    this._inShortage = shortage;

    world.grid.markAllDirty();
  }
}
