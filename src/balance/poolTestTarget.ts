// A stand-in for the lab's real scoring function, used only by pool.test.ts:
// cheap, but it does what a real evaluation does to the process — it changes
// BALANCE, runs the sim, and puts BALANCE back.

import { BALANCE } from '../data/balance';
import { freshWorld, startSim } from './world';
import type { CitySpec } from './world';

export interface TestEval { regen: number; pcAfter: number; cities: string[]; days: number; pid: number }

export function evaluate(values: Record<string, unknown>, cities: CitySpec[], days: number): TestEval {
  if (values.fail) throw new Error(`asked to fail: ${String(values.fail)}`);
  const pc = BALANCE.politicalCapital as { baseRegen: number };
  const shipped = pc.baseRegen;
  pc.baseRegen = values.regen as number;
  try {
    const sim = startSim(freshWorld(32, 7));
    sim.world.budget.politicalCapital = 0;
    sim.tick(days * BALANCE.ticksPerDay);
    return { regen: pc.baseRegen, pcAfter: sim.world.budget.politicalCapital, cities: cities.map(c => c.id), days, pid: (globalThis as unknown as { process: { pid: number } }).process.pid };
  } finally {
    pc.baseRegen = shipped;
  }
}
