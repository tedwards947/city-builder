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
    let roadMaintenance = 0;
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
        // Education multiplies income for R zones: 0 = 1x, 255 = taxMultiplier
        let eduMult = 1.0;
        if (zone[i] === ZONE_R) {
          const edu = world.layers.education[i];
          eduMult = 1.0 + (edu / 255) * (BALANCE.education.taxMultiplier - 1.0);
        }
        // Sickness reduces income for R zones: 0 = no penalty, 255 = taxPenalty reduction
        let sickMult = 1.0;
        if (zone[i] === ZONE_R) {
          const sick = world.layers.sickness[i];
          sickMult = 1.0 - (sick / 255) * BALANCE.healthcare.taxPenalty;
        }
        income += dev[i] * baseRate * lvMult * eduMult * sickMult;
      }
      if (roadClass[i] !== ROAD_NONE) {
        roadMaintenance += BALANCE.roadClasses[roadClass[i]]?.maintenance ?? 0;
      }
    }
    const buildingMaintenance = world.buildings.reduce(
      (sum, b) => sum + (BALANCE.buildings[b.kind]?.maintenance ?? 0), 0);
    const expenses = roadMaintenance + buildingMaintenance;
    world.budget.money += income - expenses;
    world.budget.income = income;
    world.budget.expenses = expenses;
    world.stats.population = population;
  }
}
