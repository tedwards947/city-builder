// Converts a live World to a point-in-time WorldSnapshot and back.
// All typed arrays are copied (not referenced) so the snapshot is immutable.

import { World } from '../sim/World';
import type { WorldSnapshot } from './SaveFormat';

/**
 * Interface for a system that can bootstrap vibes during deserialization.
 * Used to avoid a circular dependency on main.ts.
 */
export interface VibeBootstrapper {
  bootstrapVibes(world: World): void;
}

export function serialize(world: World): WorldSnapshot {
  const l = world.layers;
  return {
    width:  world.grid.width,
    height: world.grid.height,
    seed:   world.seed,
    tick:   world.tick,
    budget: { ...world.budget },
    stats:  { ...world.stats },
    character: { ...world.character },
    buildings: world.buildings.map(b => ({ ...b })),
    layers: {
      terrain:   new Uint8Array(l.terrain),
      zone:      new Uint8Array(l.zone),
      roadClass: new Uint8Array(l.roadClass),
      building:  new Uint8Array(l.building),
      vegetation: new Uint8Array(l.vegetation),
      devLevel:  new Uint8Array(l.devLevel),
      power:     new Uint8Array(l.power),
      water:     new Uint8Array(l.water),
      sewage:    new Uint8Array(l.sewage),
      services:  new Uint8Array(l.services),
      landValue: new Uint8Array(l.landValue),
      roadNet:   new Uint16Array(l.roadNet),
      pollution: new Uint8Array(l.pollution),
      crime:      new Uint8Array(l.crime),
      police:     new Uint8Array(l.police),
      congestion:    new Uint8Array(l.congestion),
      accessibility: new Uint8Array(l.accessibility),
      abandoned:  new Uint8Array(l.abandoned),
      distress:   new Uint8Array(l.distress),
      fireRisk:   new Uint8Array(l.fireRisk),
      fire:       new Uint8Array(l.fire),
      fireStation: new Uint8Array(l.fireStation),
      school:     new Uint8Array(l.school),
      education:  new Uint8Array(l.education),
      hospital:   new Uint8Array(l.hospital),
      sickness:   new Uint8Array(l.sickness),
      recentDeath: new Uint8Array(l.recentDeath),
      visualVariant: new Uint8Array(l.visualVariant),
      vibeEgalitarian: new Uint8Array(l.vibeEgalitarian),
      vibeGreen:       new Uint8Array(l.vibeGreen),
      vibePlanned:     new Uint8Array(l.vibePlanned),
    },
  };
}

export function deserialize(snapshot: WorldSnapshot, bootstrapper?: VibeBootstrapper): World {
  // Construct the world with the original seed — terrain is regenerated
  // deterministically, then overwritten by the snapshot (same bytes).
  const world = new World(snapshot.width, snapshot.height, snapshot.seed);

  world.tick = snapshot.tick;

  Object.assign(world.budget, snapshot.budget);
  Object.assign(world.stats,  snapshot.stats);
  Object.assign(world.character, snapshot.character);

  world.buildings = snapshot.buildings.map(b => ({ ...b }));

  // Overwrite every layer in-place so array references inside world stay valid.
  const l = world.layers;
  l.terrain.set(snapshot.layers.terrain);
  l.zone.set(snapshot.layers.zone);
  l.roadClass.set(snapshot.layers.roadClass);
  l.building.set(snapshot.layers.building);
  l.vegetation.set(snapshot.layers.vegetation);
  l.devLevel.set(snapshot.layers.devLevel);
  l.power.set(snapshot.layers.power);
  l.water.set(snapshot.layers.water);
  l.sewage.set(snapshot.layers.sewage);
  l.services.set(snapshot.layers.services);
  l.landValue.set(snapshot.layers.landValue);
  l.roadNet.set(snapshot.layers.roadNet);
  l.pollution.set(snapshot.layers.pollution);
  l.crime.set(snapshot.layers.crime);
  l.police.set(snapshot.layers.police);
  l.congestion.set(snapshot.layers.congestion);
  l.accessibility.set(snapshot.layers.accessibility);
  l.abandoned.set(snapshot.layers.abandoned);
  l.distress.set(snapshot.layers.distress);
  l.fireRisk.set(snapshot.layers.fireRisk);
  l.fire.set(snapshot.layers.fire);
  l.fireStation.set(snapshot.layers.fireStation);
  l.school.set(snapshot.layers.school);
  l.education.set(snapshot.layers.education);
  l.hospital.set(snapshot.layers.hospital);
  l.sickness.set(snapshot.layers.sickness);
  l.recentDeath.set(snapshot.layers.recentDeath);
  l.visualVariant.set(snapshot.layers.visualVariant);
  
  // Defensive checks for vibe layers (older saves won't have them)
  let needsBootstrap = false;
  if (snapshot.layers.vibeEgalitarian) {
    l.vibeEgalitarian.set(snapshot.layers.vibeEgalitarian);
  } else {
    needsBootstrap = true;
  }
  
  if (snapshot.layers.vibeGreen) l.vibeGreen.set(snapshot.layers.vibeGreen);
  if (snapshot.layers.vibePlanned) l.vibePlanned.set(snapshot.layers.vibePlanned);

  if (needsBootstrap && bootstrapper) {
    bootstrapper.bootstrapVibes(world);
  }

  // Sync fire counter after bulk load
  world.recomputeFireCount();

  // Force a full network + render rebuild on next tick.
  world.roadNetDirty = true;
  world.grid.markAllDirty();

  return world;
}
