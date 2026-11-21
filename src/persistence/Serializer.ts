// Converts a live World to a point-in-time WorldSnapshot and back.
// All typed arrays are copied (not referenced) so the snapshot is immutable.

import { cleanLots } from '../sim/lots';
import { World } from '../sim/World';
import { upgradeLoadedRequests } from '../sim/requests';
import { startCountingFromNow } from '../sim/established';
import { cleanMarkers } from '../sim/markers';
import { cleanConnections, generateConnections } from '../sim/connections';
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
    politics: {
      ...world.politics,
      ordinances: {
        active: [...world.politics.ordinances.active],
        suspended: [...world.politics.ordinances.suspended],
      },
      requestNotBefore: { ...world.politics.requestNotBefore },
      requests: world.politics.requests.map(r => ({ ...r, ...(r.homes ? { homes: [...r.homes] } : {}), ...(r.samples ? { samples: [...r.samples] } : {}) })),
    },
    buildings: world.buildings.map(b => ({ ...b })),
    ...(world.markers.length > 0 ? { markers: world.markers.map(m => ({ ...m })) } : {}),
    ...(world.tutorial ? { tutorial: { ...world.tutorial } } : {}),
    connections: world.connections.map((c) => ({ kind: c.kind, tile: c.tile })),
    ...(world.eventClock ? { eventClock: { ...world.eventClock } } : {}),
    ...(world.lastEvent ? { lastEvent: { ...world.lastEvent } } : {}),
    layers: {
      terrain:   new Uint8Array(l.terrain),
      zone:      new Uint8Array(l.zone),
      roadClass: new Uint8Array(l.roadClass),
      rail:      new Uint8Array(l.rail),
      building:  new Uint8Array(l.building),
      vegetation: new Uint8Array(l.vegetation),
      devLevel:  new Uint8Array(l.devLevel),
      lot:       new Uint8Array(l.lot),
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
      developedSince:  new Uint16Array(world.developedSince),
      lotStreak:       new Uint8Array(world.lotStreak),
      eventStrain:     new Uint8Array(world.eventStrain),
      eventStuck:      new Uint8Array(world.eventStuck),
    },
  };
}

export function deserialize(snapshot: WorldSnapshot, bootstrapper?: VibeBootstrapper): World {
  // A world with no map: every layer, and the outside connection points, come from the snapshot below.
  // (It used to generate the seed's map first, only to overwrite it.)
  const world = new World(snapshot.width, snapshot.height, snapshot.seed, {}, false);

  world.tick = snapshot.tick;

  Object.assign(world.budget, snapshot.budget);
  Object.assign(world.stats,  snapshot.stats);
  Object.assign(world.character, snapshot.character);
  const { ordinances, requests, nextRequestId, ...politics } = snapshot.politics;
  Object.assign(world.politics, politics);
  world.politics.ordinances = {
    active: [...(ordinances?.active ?? [])],
    suspended: [...(ordinances?.suspended ?? [])],
  };
  // needAtOpen and the split kinds are filled in by upgradeLoadedRequests once the layers are loaded.
  world.politics.requests = (requests ?? []).map(r => ({ ...r, needAtOpen: r.needAtOpen ?? NaN, ...(r.homes ? { homes: [...r.homes] } : {}), ...(r.samples ? { samples: [...r.samples] } : {}) }));
  world.politics.nextRequestId = nextRequestId ?? 1;
  world.politics.requestNotBefore = { ...(snapshot.politics.requestNotBefore ?? {}) };

  world.buildings = snapshot.buildings.map(b => ({ ...b }));
  world.markers = cleanMarkers(snapshot.markers, snapshot.width, snapshot.height);
  const tut = snapshot.tutorial;
  if (tut && Number.isInteger(tut.step) && tut.step >= 0) {
    world.tutorial = { step: tut.step, ...(typeof tut.service === 'string' ? { service: tut.service } : {}), ...(tut.forHome === true ? { forHome: true } : {}) };
  }
  world.loadNotes = { ...snapshot.upgradeNotes };

  // Overwrite every layer in-place so array references inside world stay valid.
  const l = world.layers;
  l.terrain.set(snapshot.layers.terrain);
  l.zone.set(snapshot.layers.zone);
  l.roadClass.set(snapshot.layers.roadClass);
  if (snapshot.layers.rail) l.rail.set(snapshot.layers.rail);
  world.railVersion++;
  l.building.set(snapshot.layers.building);
  world.rebuildBuildingIds();
  l.vegetation.set(snapshot.layers.vegetation);
  l.devLevel.set(snapshot.layers.devLevel);
  if (snapshot.layers.lot) l.lot.set(snapshot.layers.lot);
  if (snapshot.layers.lotStreak) world.lotStreak.set(snapshot.layers.lotStreak);
  if (snapshot.layers.eventStrain) world.eventStrain.set(snapshot.layers.eventStrain);
  if (snapshot.layers.eventStuck) world.eventStuck.set(snapshot.layers.eventStuck);
  // Outside connections: as saved, or (a save from before them) worked out from the loaded map.
  world.connections = snapshot.connections ? cleanConnections(snapshot.connections, snapshot.width, snapshot.height) : generateConnections(world);
  world.eventClock = snapshot.eventClock ? { ...snapshot.eventClock } : null;
  world.lastEvent = snapshot.lastEvent ? { smooth: false, reward: 0, ...snapshot.lastEvent } : null;   // saves before 2026-11-20 have no smooth / reward
  cleanLots(world);
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

  // How long each lot has been developed; a save from before that was kept
  // starts every developed lot's clock now.
  if (snapshot.layers.developedSince) world.developedSince.set(snapshot.layers.developedSince);
  else startCountingFromNow(world);

  // Sync fire counter after bulk load
  world.recomputeFireCount();

  // Force a full network + render rebuild on next tick.
  world.roadNetDirty = true;
  world.grid.markAllDirty();

  // A building kind's shape may have changed since the city was saved (the airport's runway grew).
  world.fitBuildingsToShapes();
  upgradeLoadedRequests(world);
  return world;
}
