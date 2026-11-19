// "Nothing changed" check for the whole simulation.
//
// Runs the test city (fixtures/testCity.ts) through every system for a few
// hundred ticks and compares a fingerprint of the result — every tile layer,
// the traffic volumes, the stats and the budget — against the stored one in
// __snapshots__/goldenCity.test.ts.snap.
//
// A speed-up or refactor must leave this passing untouched. If you changed how
// the simulation behaves ON PURPOSE (balance, a new rule, a new layer), the
// failure shows which layers moved; check that is what you expected, then
// accept the new fingerprint and commit it with your change:
//
//   npx vitest run goldenCity -u

import { describe, it, expect } from 'vitest';
import type { World } from '../sim/World';
import { Scheduler } from '../sim/Scheduler';
import { createSystems } from '../sim/createSystems';
import { buildLivingCity, population } from './fixtures/testCity';

function hash(a: ArrayBufferView): string {
  const bytes = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Numbers to 9 significant digits, so the fingerprint does not hang on the last bit of a float. */
function rounded(o: object): Record<string, unknown> {
  return JSON.parse(JSON.stringify(o, (_k, v) => (typeof v === 'number' ? Number(v.toPrecision(9)) : v)));
}

function fingerprint(w: World): Record<string, unknown> {
  const layers: Record<string, string> = {};
  for (const [name, layer] of Object.entries(w.layers)) layers[name] = hash(layer as ArrayBufferView);
  const traffic: Record<string, string> = {};
  // The road half of each market's volumes (the second half is rail track, and the test city has none),
  // so the stored hashes are the ones from before the arrays grew to hold track.
  for (const m of w.traffic?.markets ?? []) traffic[m.def.key] = hash(m.volume.subarray(0, w.traffic!.tiles));
  return {
    tick: w.tick,
    population: population(w),
    buildings: w.buildings.length,
    stats: rounded(w.stats),
    budget: rounded(w.budget),
    layers,
    traffic,
  };
}

function run() {
  const { world } = buildLivingCity();
  const scheduler = new Scheduler(world, createSystems().systems);
  return { world, scheduler };
}

// Each test runs the test city for hundreds of ticks (about a second here).
// A busy machine can be twenty times slower (19 s was seen with several
// sessions running), and a timeout
// would read as "the simulation changed", so the limit is generous.
describe('the whole simulation on the test city', { timeout: 120_000 }, () => {
  it('gives the stored result, tick for tick', () => {
    const { world, scheduler } = run();
    for (const until of [1, 50, 200, 400]) {
      while (world.tick < until) scheduler.tick();
      expect(fingerprint(world)).toMatchSnapshot(`after ${until} ticks`);
    }
  });

  it('gives the same result every time it is run', () => {
    const a = run(), b = run();
    for (let k = 0; k < 120; k++) { a.scheduler.tick(); b.scheduler.tick(); }
    expect(fingerprint(a.world)).toEqual(fingerprint(b.world));
  });

  it('is a city that is alive, so the fingerprint covers real behaviour', () => {
    const { world, scheduler } = run();
    const before = population(world);
    for (let k = 0; k < 400; k++) scheduler.tick();
    expect(population(world)).toBeGreaterThan(before * 0.8);
    expect(world.stats.powerSupply).toBeGreaterThanOrEqual(world.stats.powerDemand);
    expect(world.stats.waterSupply).toBeGreaterThanOrEqual(world.stats.waterDemand);
    expect(world.stats.sewageSupply).toBeGreaterThanOrEqual(world.stats.sewageDemand);
  });
});
