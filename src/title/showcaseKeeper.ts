// The showcase city behind the title screen must never fail: nobody is
// playing it, and it only has to keep looking alive however long the title
// sits there. Two guards:
//   - `hold`, every frame: the treasury and political capital are frozen at a
//     healthy level, so the city cannot run out of money, go into debt, be
//     drained by debt or lose its mayor;
//   - `declined`: if the city still shrinks (a long idle can do that by other
//     roads: fires, crime, a jam that empties a district), main.ts starts it
//     again from its save file.

import type { World } from '../sim/World';
import { pcCap } from '../sim/politics';

export const KEEP = {
  /** The treasury is held at what the showcase was saved with, or this if that is less. */
  minMoney: 250_000,
  /** The city has declined once its population is below this share of what it started with. */
  restartBelow: 0.9,
};

export class ShowcaseKeeper {
  private readonly money: number;
  private readonly population: number;

  /** `world`: the showcase as just loaded. */
  constructor(world: World) {
    this.money = Math.max(world.budget.money, KEEP.minMoney);
    this.population = world.stats.population;
  }

  /** Freeze the funds and clear every trace of debt. Call every frame while the title is up. */
  hold(world: World): void {
    const b = world.budget;
    b.money = this.money;
    b.politicalCapital = Math.max(b.politicalCapital, pcCap(world));
    b.debtOverTicks = 0;
    b.gameOver = false;
  }

  /** The city has shrunk too far: time to start it again from its save. */
  declined(world: World): boolean {
    return world.stats.population < this.population * KEEP.restartBelow;
  }
}
