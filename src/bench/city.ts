// The city the benchmarks run on: a save file if one is given, otherwise the
// hand-built test city the tests use.

import type { World } from '../sim/World';
import { decodeSaveFile } from '../persistence/SaveFile';
import { deserialize } from '../persistence/Serializer';
import { VibeSystem } from '../sim/systems/VibeSystem';
import { buildLivingCity, population } from '../__tests__/fixtures/testCity';

export interface BenchCity {
  world: World;
  /** One line saying what city this is. */
  label: string;
}

/** `saveText` is the text of a .citysave.json file, or null for the built-in test city. */
export function loadBenchCity(saveText: string | null): BenchCity {
  const world = saveText === null
    ? buildLivingCity().world
    : deserialize(decodeSaveFile(saveText).snapshot, { bootstrapVibes: (w) => new VibeSystem().bootstrapVibes(w) });
  const { width, height } = world.grid;
  let roads = 0;
  for (let i = 0; i < world.layers.roadClass.length; i++) if (world.layers.roadClass[i]) roads++;
  const what = saveText === null ? 'built-in test city' : 'save file';
  return { world, label: `${what}: ${width}×${height} map, population ${population(world)}, ${roads} road tiles` };
}

export function summary(ms: number[]): { median: number; p95: number; worst: number } {
  const s = [...ms].sort((a, b) => a - b);
  return { median: s[s.length >> 1], p95: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))], worst: s[s.length - 1] };
}
