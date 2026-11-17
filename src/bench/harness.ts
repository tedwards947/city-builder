// Load a city and run it with no browser: the entry point the benchmarks, the
// city generator (src/gen/cityGen.ts) and the balance lab share, so they all
// load and tick a city exactly as the game does.
//
//   const city = startCity(loadCityText(readFileSync(path, 'utf8')));
//   city.tick(100);
//   writeFileSync(out, saveCityText(city.world, 'My city'));

import type { World } from '../sim/World';
import type { System } from '../sim/Scheduler';
import { Scheduler } from '../sim/Scheduler';
import type { TransitSystem } from '../sim/systems/TransitSystem';
import { createSystems } from '../sim/createSystems';
import { VibeSystem } from '../sim/systems/VibeSystem';
import { decodeSaveFile, encodeSaveFile } from '../persistence/SaveFile';
import { deserialize, serialize } from '../persistence/Serializer';
import { BALANCE } from '../data/balance';

/** A city from the text of a .citysave.json file, as the Load panel reads it. Throws a readable Error if the text is no good. */
export function loadCityText(text: string): World {
  return deserialize(decodeSaveFile(text).snapshot, { bootstrapVibes: (w) => new VibeSystem().bootstrapVibes(w) });
}

export interface RunningCity {
  world: World;
  systems: System[];
  transit: TransitSystem;
  scheduler: Scheduler;
  /** Run `n` sim ticks now. */
  tick(n?: number): void;
}

/** A fresh set of systems for `world`, with traffic settled as the game does when it starts a city. */
export function startCity(world: World): RunningCity {
  const { systems, transit } = createSystems();
  transit.recompute(world);
  const scheduler = new Scheduler(world, systems);
  return {
    world, systems, transit, scheduler,
    tick(n = 1) { for (let k = 0; k < n; k++) scheduler.tick(); },
  };
}

/** The city as the text of a .citysave.json file the game's Load panel and `npm run bench` can read. */
export function saveCityText(world: World, name: string, savedAt = Date.now()): string {
  return encodeSaveFile({
    name,
    savedAt,
    tick: world.tick,
    population: world.stats.population,
    money: world.budget.money,
    mapSettings: {
      width: world.grid.width,
      height: world.grid.height,
      waterAmount: world.terrainOptions.waterAmount ?? 'medium',
    },
  }, serialize(world));
}

export interface CityStats {
  map: string;
  tick: number;
  population: number;
  /** Zoned tiles by zone, and how many of them are at each level (0–3) or abandoned. */
  zones: Record<'R' | 'C' | 'I', { tiles: number; levels: number[]; abandoned: number }>;
  roadTiles: { street: number; avenue: number; highway: number };
  buildings: Record<string, number>;
  demand: { R: number; C: number; I: number };
  /** Money per game day, from the last tick's income and expenses. */
  perDay: { income: number; expenses: number; net: number };
  satisfaction: number;
  politicalCapital: number;
}

const BUILDING_NAMES: Record<number, string> = {
  1: 'power', 2: 'water', 3: 'sewage', 4: 'police', 5: 'fire', 6: 'school', 7: 'hospital', 8: 'park',
};

/** A one-glance summary of a city, for logs and tests. Reads the layers; changes nothing. */
export function cityStats(world: World): CityStats {
  const L = world.layers;
  const zones: CityStats['zones'] = {
    R: { tiles: 0, levels: [0, 0, 0, 0], abandoned: 0 },
    C: { tiles: 0, levels: [0, 0, 0, 0], abandoned: 0 },
    I: { tiles: 0, levels: [0, 0, 0, 0], abandoned: 0 },
  };
  const roadTiles = { street: 0, avenue: 0, highway: 0 };
  for (let i = 0; i < L.zone.length; i++) {
    const z = L.zone[i];
    if (z >= 1 && z <= 3) {
      const e = zones[(['R', 'C', 'I'] as const)[z - 1]];
      e.tiles++;
      if (L.abandoned[i]) e.abandoned++; else e.levels[L.devLevel[i]]++;
    }
    const r = L.roadClass[i];
    if (r === 1) roadTiles.street++; else if (r === 2) roadTiles.avenue++; else if (r === 3) roadTiles.highway++;
  }
  const buildings: Record<string, number> = {};
  for (const b of world.buildings) { const n = BUILDING_NAMES[b.kind] ?? `kind${b.kind}`; buildings[n] = (buildings[n] ?? 0) + 1; }
  const day = BALANCE.ticksPerDay;
  const { income, expenses } = world.budget;
  return {
    map: `${world.grid.width}×${world.grid.height}`,
    tick: world.tick,
    population: world.stats.population,
    zones, roadTiles, buildings,
    demand: { R: world.stats.rDemand, C: world.stats.cDemand, I: world.stats.iDemand },
    perDay: { income: income * day, expenses: expenses * day, net: (income - expenses) * day },
    satisfaction: world.stats.satisfaction,
    politicalCapital: world.budget.politicalCapital,
  };
}
