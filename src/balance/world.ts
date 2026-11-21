// Balance Lab: cities and a headless sim around them. Not part of the game.
//
// Everything runs on the real World, systems and commands, exactly as the game
// does (startGame in main.ts), with no browser. A city comes from a save's text
// (the owner's testcity1, or a generated city cached as a file) or is built
// fresh by a persona.

import { World } from '../sim/World';
import { Scheduler } from '../sim/Scheduler';
import { createSystems } from '../sim/createSystems';
import { CommandHistory } from '../commands/CommandHistory';
import { decodeSaveFile } from '../persistence/SaveFile';
import { serialize, deserialize } from '../persistence/Serializer';
import { DERIVED_LAYERS } from '../persistence/SaveFormat';
import { VibeSystem } from '../sim/systems/VibeSystem';

/** Where a city comes from. File reading happens in the runner, so specs carry text. */
export type CitySpec =
  | { id: string; kind: 'fresh'; size?: number; seed?: number }
  | { id: string; kind: 'save'; text: string };

export interface Sim {
  world: World;
  history: CommandHistory;
  /** Run n ticks now (8 ticks = 1 game day). */
  tick(n?: number): void;
}

/** An empty, flat, tree-less map: personas build on it from nothing. */
export function freshWorld(size = 128, seed = 7): World {
  const w = new World(size, size, seed, { vegAmount: 'low' });
  w.layers.terrain.fill(0);
  w.layers.vegetation.fill(0);
  w.grid.markAllDirty();
  return w;
}

/** Decode a .citysave.json text as the Load panel does (old saves get vibe layers seeded). */
export function loadSaveText(text: string): World {
  return deserialize(decodeSaveFile(text).snapshot, { bootstrapVibes: (w) => new VibeSystem().bootstrapVibes(w) });
}

export function loadCity(spec: CitySpec): World {
  return spec.kind === 'save' ? loadSaveText(spec.text) : freshWorld(spec.size, spec.seed);
}

/**
 * An independent copy of a world, through the save format. Since save version 12 serialize leaves out
 * the derived layers (SaveFormat.DERIVED_LAYERS) and a load works them out again, with congestion and
 * accessibility at 0 until traffic runs. A copy must match its source exactly (the landscape probes
 * settle land value without traffic), so the derived layers are carried over as they are, and the
 * load has nothing to rebuild.
 */
export function cloneWorld(world: World): World {
  const snapshot = serialize(world);
  const layers = snapshot.layers as Record<string, Uint8Array | Uint16Array>;
  const from = world.layers as unknown as Record<string, Uint8Array | Uint16Array>;
  for (const name of DERIVED_LAYERS) layers[name] = from[name].slice();
  return deserialize(snapshot);
}

/** Fresh systems, settled traffic and a command history, as startGame does. */
export function startSim(world: World): Sim {
  const sim = createSystems();
  sim.transit.recompute(world);
  const scheduler = new Scheduler(world, sim.systems);
  const history = new CommandHistory(world);
  return { world, history, tick: (n = 1) => { for (let k = 0; k < n; k++) scheduler.tick(); } };
}
