import { World } from '../World';
import { ZONE_NONE, ZONE_R, ZONE_C, ROAD_NONE } from '../constants';
import { BALANCE } from '../../data/balance';

export class EconomySystem {
  update(world: World): void {
    const { width, height } = world.grid;
    const zone = world.layers.zone;
    const dev = world.layers.devLevel;
    const lv = world.layers.landValue;
    const roadClass = world.layers.roadClass;
    const abandoned = world.layers.abandoned;
    const { taxRates } = world.budget;
    let income = 0;
    let population = 0;
    let roadCount = 0;
    for (let i = 0; i < width * height; i++) {
      if (zone[i] !== ZONE_NONE && dev[i] > 0) {
        // Abandoned tiles have no residents and generate no income.
        if (abandoned[i] !== 0) continue;
        if (zone[i] === ZONE_R) {
          population += BALANCE.growth.popPerLevel[dev[i]] ?? 0;
        }
        const baseRate = zone[i] === ZONE_R ? taxRates.R
                       : zone[i] === ZONE_C ? taxRates.C
                       : taxRates.I;
        // Land value multiplies income: lv 128 = neutral, 0 = half, 255 = ~2×
        const lvMult = lv[i] / 128;
        income += dev[i] * baseRate * lvMult;
      }
      if (roadClass[i] !== ROAD_NONE) roadCount++;
    }
    const serviceMaintenance = world.serviceBuildings.reduce(
      (sum, b) => sum + (BALANCE.maintenance.service[b.kind] ?? 0), 0);
    const expenses =
      roadCount * BALANCE.maintenance.road +
      world.powerPlants.length * BALANCE.maintenance.powerPlant +
      world.waterTowers.length * BALANCE.maintenance.waterTower +
      world.sewagePlants.length * BALANCE.maintenance.sewagePlant +
      serviceMaintenance;
    world.budget.money += income - expenses;
    world.budget.income = income;
    world.budget.expenses = expenses;
    world.stats.population = population;
  }
}
