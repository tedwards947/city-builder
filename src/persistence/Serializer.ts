// Converts a live World to a point-in-time WorldSnapshot and back.
// All typed arrays are copied (not referenced) so the snapshot is immutable.

import { cleanLots } from '../sim/lots';
import { World } from '../sim/World';
import { upgradeLoadedRequests } from '../sim/requests';
import { startCountingFromNow } from '../sim/established';
import { cleanMarkers } from '../sim/markers';
import { cleanConnections, generateConnections } from '../sim/connections';
import { DERIVED_LAYERS, type WorldSnapshot } from './SaveFormat';
import { NetworkSystem } from '../sim/systems/NetworkSystem';
import { PowerSystem } from '../sim/systems/PowerSystem';
import { WaterSystem } from '../sim/systems/WaterSystem';
import { SewageSystem } from '../sim/systems/SewageSystem';
import { ServiceSystem } from '../sim/systems/ServiceSystem';

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
    // The derived layers (SaveFormat.DERIVED_LAYERS: coverage, road networks, congestion, accessibility) are
    // not saved: deserialize works them out again.
    layers: {
      terrain:   new Uint8Array(l.terrain),
      zone:      new Uint8Array(l.zone),
      roadClass: new Uint8Array(l.roadClass),
      rail:      new Uint8Array(l.rail),
      building:  new Uint8Array(l.building),
      vegetation: new Uint8Array(l.vegetation),
      devLevel:  new Uint8Array(l.devLevel),
      lot:       new Uint8Array(l.lot),
      landValue: new Uint8Array(l.landValue),
      pollution: new Uint8Array(l.pollution),
      crime:      new Uint8Array(l.crime),
      abandoned:  new Uint8Array(l.abandoned),
      distress:   new Uint8Array(l.distress),
      fireRisk:   new Uint8Array(l.fireRisk),
      fire:       new Uint8Array(l.fire),
      education:  new Uint8Array(l.education),
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
  if (snapshot.layers.power) l.power.set(snapshot.layers.power);
  if (snapshot.layers.water) l.water.set(snapshot.layers.water);
  if (snapshot.layers.sewage) l.sewage.set(snapshot.layers.sewage);
  if (snapshot.layers.services) l.services.set(snapshot.layers.services);
  l.landValue.set(snapshot.layers.landValue);
  if (snapshot.layers.roadNet) l.roadNet.set(snapshot.layers.roadNet);
  l.pollution.set(snapshot.layers.pollution);
  l.crime.set(snapshot.layers.crime);
  if (snapshot.layers.police) l.police.set(snapshot.layers.police);
  if (snapshot.layers.congestion) l.congestion.set(snapshot.layers.congestion);
  if (snapshot.layers.accessibility) l.accessibility.set(snapshot.layers.accessibility);
  l.abandoned.set(snapshot.layers.abandoned);
  l.distress.set(snapshot.layers.distress);
  l.fireRisk.set(snapshot.layers.fireRisk);
  l.fire.set(snapshot.layers.fire);
  if (snapshot.layers.fireStation) l.fireStation.set(snapshot.layers.fireStation);
  if (snapshot.layers.school) l.school.set(snapshot.layers.school);
  l.education.set(snapshot.layers.education);
  if (snapshot.layers.hospital) l.hospital.set(snapshot.layers.hospital);
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
  // A save from version 12 on has no derived layers: work them out before anything reads them.
  if (DERIVED_LAYERS.some((name) => !snapshot.layers[name])) rebuildDerivedLayers(world);
  upgradeLoadedRequests(world);
  return world;
}

/**
 * Work out the layers a save no longer holds (SaveFormat.DERIVED_LAYERS) from the loaded roads and
 * buildings: the road networks, then power, water, sewage and service coverage, each by the system
 * that keeps it up to date in play. Congestion and accessibility are left at 0: they come from
 * traffic, and the game runs a traffic pass before the first frame of a loaded city (main.ts).
 */
export function rebuildDerivedLayers(world: World): void {
  new NetworkSystem().update(world);
  new PowerSystem().update(world);
  new WaterSystem().update(world);
  new SewageSystem().update(world);
  new ServiceSystem().update(world);
}
