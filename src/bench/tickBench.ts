// How long a sim tick takes. Run by `npm run bench` (scripts/bench.mjs), in
// Node and again in Chrome; no DOM needed.

import { createSystems } from '../sim/createSystems';
import { loadBenchCity, summary } from './city';

export interface TickBenchResult {
  city: string;
  ticks: number;
  /** Settling traffic when a city is loaded, as the game does before its first frame. */
  loadWarmupMs: number;
  /**
   * Worst of the first 8 ticks after loading. Land value and traffic run only
   * every few ticks, so their cold first runs need not fall on the very first.
   */
  firstTicksWorstMs: number;
  median: number;
  p95: number;
  worst: number;
  /** Average ms per tick spent in each system, biggest first. */
  systems: { name: string; ms: number }[];
}

export function runTickBench(saveText: string | null, ticks = 300, now: () => number = () => performance.now()): TickBenchResult {
  const { world, label } = loadBenchCity(saveText);
  const { systems, transit } = createSystems();
  const spent = new Float64Array(systems.length);

  // What Scheduler.tick() does, with a stopwatch around each system.
  const tick = (record: boolean): number => {
    const t0 = now();
    world.tick++;
    world.pinIndex();
    try {
      let t = t0;
      for (let k = 0; k < systems.length; k++) {
        systems[k].update(world);
        const t1 = now();
        if (record) spent[k] += t1 - t;
        t = t1;
      }
    } finally {
      world.unpinIndex();
    }
    return now() - t0;
  };

  const w0 = now();
  transit.recompute(world);                           // what startGame() does in main.ts
  const loadWarmupMs = now() - w0;
  let firstTicksWorstMs = 0;
  for (let k = 0; k < 8; k++) firstTicksWorstMs = Math.max(firstTicksWorstMs, tick(false));
  for (let k = 0; k < 30; k++) tick(false);            // let the engine warm up
  const times: number[] = [];
  for (let k = 0; k < ticks; k++) times.push(tick(true));

  return {
    city: label,
    ticks,
    loadWarmupMs,
    firstTicksWorstMs,
    ...summary(times),
    systems: systems
      .map((s, k) => ({ name: s.constructor.name, ms: spent[k] / ticks }))
      .sort((a, b) => b.ms - a.ms),
  };
}
