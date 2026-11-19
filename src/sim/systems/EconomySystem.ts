import { trackMaintenance } from '../rail';
import { World } from '../World';
import { ZONE_NONE, ZONE_R, ZONE_C, ZONE_I, ROAD_NONE } from '../constants';
import { BALANCE } from '../../data/balance';
import { isServiceKind } from '../serviceValue';
import { ordinanceModifier } from '../ordinances';
import { updateDebt, type DebtWarnings } from '../debt';
import { taxIncomeMult, noteIncomeBeforeTaxLevel } from '../tax';
import { goodsIncomeMult } from '../goods';
import { exportIncome } from '../seaport';
import { buildingTripIncome } from '../buildingTraffic';

export class EconomySystem {
  private _inDebt = false;
  private _lastWarnTick = -Infinity;
  private _debtWarned: DebtWarnings = { half: false, limit: false };

  update(world: World): void {
    const zone = world.layers.zone;
    const dev = world.layers.devLevel;
    const lv = world.layers.landValue;
    const roadClass = world.layers.roadClass;
    const abandoned = world.layers.abandoned;
    const { taxRates } = world.budget;
    // Ordinances (Curfew, Business Incentives) scale tax income from shops and industry.
    // Shops short of goods earn less (sim/goods.ts; no effect while its penalty is 0).
    const shopIncome = ordinanceModifier(world, 'commercialIncome') * goodsIncomeMult(world);
    const industryIncome = ordinanceModifier(world, 'industrialIncome');
    // Homes and shops: lvMult = floor + (1 − floor) × lv/128 (floor 0 = plain lv/128, shipped).
    const lvFloor = BALANCE.tax.landValueFloor;
    const serviceMult = BALANCE.maintenance.serviceMult;
    let income = 0;
    let population = 0;
    let roadMaintenance = 0;
    const { zoned, zonedCount, roads, roadCount } = world.index;
    for (let k = 0; k < zonedCount; k++) {
      const i = zoned[k];
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
        // Industry uses a fixed multiplier (see BALANCE.tax.industryLandValueMult).
        const lvMult = zone[i] === ZONE_I ? BALANCE.tax.industryLandValueMult : lvFloor + (1 - lvFloor) * (lv[i] / 128);
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
        const ordinance = zone[i] === ZONE_C ? shopIncome : zone[i] === ZONE_I ? industryIncome : 1;
        income += dev[i] * baseRate * lvMult * eduMult * sickMult * ordinance;
      }
    }
    // The city's tax level scales all tax income (exactly 1 at the neutral level).
    noteIncomeBeforeTaxLevel(world, income);
    income *= taxIncomeMult(world.budget.taxLevel);
    // What the seaports earn from exports is trade, not tax: the tax level does not scale it.
    income += exportIncome(world);
    // Nor what buildings earn per trip they take (an airport's passengers).
    income += buildingTripIncome(world);
    for (let k = 0; k < roadCount; k++) {
      const i = roads[k];
      if (roadClass[i] !== ROAD_NONE) {
        roadMaintenance += BALANCE.roadClasses[roadClass[i]]?.maintenance ?? 0;
      }
    }
    roadMaintenance += trackMaintenance(world);   // rail track is kept up with the roads
    // Service buildings (police, fire, school, hospital, park) scale by maintenance.serviceMult.
    const buildingMaintenance = world.buildings.reduce(
      (sum, b) => sum + (BALANCE.buildings[b.kind]?.maintenance ?? 0) * (isServiceKind(b.kind) ? serviceMult : 1), 0);
    const expenses = roadMaintenance + buildingMaintenance;
    world.budget.money += income - expenses;
    world.budget.income = income;
    world.budget.expenses = expenses;
    world.stats.population = population;

    // The debt limit, its warnings and countdown, and game over.
    updateDebt(world, this._debtWarned);

    // Budget alerts: once on entering / leaving debt, throttled while heading there.
    const money = world.budget.money;
    if (money < 0) {
      if (!this._inDebt) {
        this._inDebt = true;
        world.events.emit('debtEntered', { money });
      }
      return;
    }
    if (this._inDebt) {
      this._inDebt = false;
      world.events.emit('debtCleared', { money });
    }
    const net = income - expenses;
    if (net < 0) {
      const daysLeft = money / -net / BALANCE.ticksPerDay;
      if (daysLeft < BALANCE.budget.lowFundsWarningDays &&
          world.tick - this._lastWarnTick >= BALANCE.budget.warningCooldownTicks) {
        this._lastWarnTick = world.tick;
        world.events.emit('budgetWarning', { money, daysLeft });
      }
    }
  }
}
