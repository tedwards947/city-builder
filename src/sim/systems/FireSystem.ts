import type { World } from '../World';
import { ZONE_R, ZONE_C, ZONE_I, ZONE_NONE, BUILDING_NONE } from '../constants';
import { BALANCE } from '../../data/balance';

/**
 * FireSystem manages fire risk, ignition, and spreading.
 * Fire risk is higher in industrial areas and polluted areas.
 * Fire stations reduce risk and prevent spreading.
 *
 * It also emits `fireReport`: the fires that matter to the player (those with
 * no fire station in reach) summed up, at most once per
 * BALANCE.fire.reportCooldownTicks, so the UI can show one grouped message
 * instead of one per fire. Nothing is emitted while there is no such fire and
 * no damage. The counting changes nothing in the simulation.
 */
export class FireSystem {
  // Since the last fireReport: uncovered fires that started (ignitions and
  // spreads) and buildings that lost a level. Not saved: a loaded game simply
  // starts a new count.
  private _started = 0;
  private _damaged = 0;
  private _reportTile = -1;   // the latest uncovered fire, or failing that the latest damage
  private _lastReport = -Infinity; // tick of the last fireReport

  update(world: World): void {
    const { width } = world.grid;
    const zone = world.layers.zone;
    const dev = world.layers.devLevel;
    const pollution = world.layers.pollution;
    const fireRisk = world.layers.fireRisk;
    const fire = world.layers.fire;
    const fireStation = world.layers.fireStation;
    const b = BALANCE.fire;

    const building = world.layers.building;

    let burningUncovered = 0;
    const area = world.index.area(world);
    for (let y = area.y0; y <= area.y1; y++) {
    for (let i = y * width + area.x0, rowEnd = y * width + area.x1; i <= rowEnd; i++) {
      const z = zone[i];

      // Skip tiles that are empty and have no active fire / residual risk.
      if (z === ZONE_NONE && building[i] === BUILDING_NONE && fire[i] === 0 && fireRisk[i] === 0) continue;

      // 1. Calculate Risk
      let targetRisk = 0;
      const level = dev[i];

      if (z !== ZONE_NONE && level > 0) {
        let riskMult = 1.0;
        if (z === ZONE_R) riskMult = b.riskR;
        else if (z === ZONE_C) riskMult = b.riskC;
        else if (z === ZONE_I) riskMult = b.riskI;

        targetRisk = 20 * level * riskMult;
        targetRisk += pollution[i] * b.pollutionRiskMult;
      }

      // Fire station protection reduces risk
      if (fireStation[i] === 1) {
        targetRisk *= b.fireStationEffectiveness;
      }

      targetRisk = Math.min(255, Math.max(0, targetRisk));
      const nextRisk = fireRisk[i] + (targetRisk - fireRisk[i]) * b.riskSmoothing;
      let roundedRisk = Math.round(nextRisk);
      if (roundedRisk === fireRisk[i] && Math.abs(targetRisk - fireRisk[i]) >= 0.5) {
        roundedRisk += Math.sign(targetRisk - fireRisk[i]);
      }
      fireRisk[i] = Math.min(255, Math.max(0, roundedRisk));

      // 2. Handle Existing Fires
      if (fire[i] > 0) {
        const tx = i % width;
        const ty = (i / width) | 0;

        // Fire station protection puts out fires faster
        if (fireStation[i] === 1) {
          world.setFire(tx, ty, Math.max(0, fire[i] - 5));
        } else {
          world.setFire(tx, ty, fire[i] - 1);
        }

        if (fire[i] === 0) {
          world.grid.markDirty(tx, ty);
          // Burned out with no fire station in range: the building is damaged.
          if (fireStation[i] === 0 && z !== ZONE_NONE && level > 0) {
            const newLevel = Math.max(0, level - b.damageLevels);
            dev[i] = newLevel;
            if (newLevel === 0) {
              // Burned to the ground: the lot is empty again (ruins included).
              world.layers.abandoned[i] = 0;
              world.layers.distress[i] = 0;
            }
            world.events.emit('fireDamage', { tx, ty, zone: z, level: newLevel });
            this._damaged++;
            if (this._started === 0) this._reportTile = i;
          }
        }

        if (fire[i] > 0 && fireStation[i] === 0) {
          burningUncovered++;
          // A fire nobody saw start (burning when the game was loaded).
          if (this._reportTile < 0) this._reportTile = i;
        }

        // 3. Fire Spreading
        if (fire[i] > 0 && world.rng() < b.spreadProbability) {
          // Spread to a random neighbor (no array allocation).
          const dir = Math.floor(world.rng() * 4);
          const ntx = dir === 0 ? tx - 1 : dir === 1 ? tx + 1 : tx;
          const nty = dir === 2 ? ty - 1 : dir === 3 ? ty + 1 : ty;
          if (world.grid.inBounds(ntx, nty)) {
            const ni = world.grid.idx(ntx, nty);
            // Can only spread to developed zones or buildings
            if (fire[ni] === 0 && (zone[ni] !== ZONE_NONE || building[ni] !== BUILDING_NONE)) {
              // If fire station covers it, spread is much less likely
              if (fireStation[ni] === 0 || world.rng() < b.fireStationEffectiveness) {
                world.setFire(ntx, nty, b.burnDuration);
                world.grid.markDirty(ntx, nty);
                world.events.emit('fireSpreading', { tx: ntx, ty: nty });
                if (fireStation[ni] === 0) { this._started++; this._reportTile = ni; }
              }
            }
          }
        }
        continue;
      }

      // 4. Ignition
      if (z !== ZONE_NONE && level > 0) {
        const ignitionProb = b.baseProbability * (fireRisk[i] / 20);
        if (world.rng() < ignitionProb) {
          const itx = i % width;
          const ity = (i / width) | 0;
          world.setFire(itx, ity, b.burnDuration);
          world.grid.markDirty(itx, ity);
          const covered = fireStation[i] === 1;
          world.events.emit('fireIgnition', { tx: itx, ty: ity, zone: z, devLevel: level, covered });
          if (!covered) { this._started++; this._reportTile = i; burningUncovered++; }
        }
      }
    }
    }

    // At most one report per cooldown, and only when there is something to
    // say. The first uncovered fire after a quiet spell is reported at once.
    if ((burningUncovered > 0 || this._damaged > 0) && this._reportTile >= 0
        && world.tick - this._lastReport >= b.reportCooldownTicks) {
      const t = this._reportTile;
      world.events.emit('fireReport', {
        burning: burningUncovered, started: this._started, damaged: this._damaged,
        tx: t % width, ty: (t / width) | 0,
      });
      this._lastReport = world.tick;
      this._started = 0;
      this._damaged = 0;
    }
  }
}
