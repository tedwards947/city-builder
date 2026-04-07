// Base class and tile snapshot utilities for the command pattern.
// Every player action is a Command with execute(world) / undo(world).
// Commands snapshot tile state to reverse themselves.
// This gives us undo for free and will give us replays later.

import type { World } from '../sim/World';
import { BUILDING_POWER_PLANT, BUILDING_WATER_TOWER, BUILDING_SEWAGE_PLANT, SERVICE_BUILDING_KINDS } from '../sim/constants';

export abstract class Command {
  abstract execute(world: World): boolean;
  abstract undo(world: World): void;
}

export interface TileSnapshot {
  zone: number;
  road: number;
  building: number;
  dev: number;
}

export function snapshotTile(world: World, tx: number, ty: number): TileSnapshot {
  const i = world.grid.idx(tx, ty);
  return {
    zone:     world.layers.zone[i],
    road:     world.layers.roadClass[i],
    building: world.layers.building[i],
    dev:      world.layers.devLevel[i],
  };
}

export function restoreTile(world: World, tx: number, ty: number, snap: TileSnapshot): void {
  const i = world.grid.idx(tx, ty);
  const prevBuilding = world.layers.building[i];
  world.layers.zone[i]      = snap.zone;
  world.layers.roadClass[i] = snap.road;
  world.layers.building[i]  = snap.building;
  world.layers.devLevel[i]  = snap.dev;
  // Keep powerPlants / waterTowers lists consistent on undo.
  if (prevBuilding === BUILDING_POWER_PLANT && snap.building !== BUILDING_POWER_PLANT) {
    world.powerPlants = world.powerPlants.filter(p => !(p.tx === tx && p.ty === ty));
  } else if (prevBuilding !== BUILDING_POWER_PLANT && snap.building === BUILDING_POWER_PLANT) {
    world.powerPlants.push({ tx, ty });
  }
  if (prevBuilding === BUILDING_WATER_TOWER && snap.building !== BUILDING_WATER_TOWER) {
    world.waterTowers = world.waterTowers.filter(w => !(w.tx === tx && w.ty === ty));
  } else if (prevBuilding !== BUILDING_WATER_TOWER && snap.building === BUILDING_WATER_TOWER) {
    world.waterTowers.push({ tx, ty });
  }
  if (prevBuilding === BUILDING_SEWAGE_PLANT && snap.building !== BUILDING_SEWAGE_PLANT) {
    world.sewagePlants = world.sewagePlants.filter(s => !(s.tx === tx && s.ty === ty));
  } else if (prevBuilding !== BUILDING_SEWAGE_PLANT && snap.building === BUILDING_SEWAGE_PLANT) {
    world.sewagePlants.push({ tx, ty });
  }
  const prevIsService = (SERVICE_BUILDING_KINDS as readonly number[]).includes(prevBuilding);
  const snapIsService = (SERVICE_BUILDING_KINDS as readonly number[]).includes(snap.building);
  if (prevIsService && !snapIsService) {
    world.serviceBuildings = world.serviceBuildings.filter(s => !(s.tx === tx && s.ty === ty));
  } else if (!prevIsService && snapIsService) {
    world.serviceBuildings.push({ tx, ty, kind: snap.building });
  } else if (prevIsService && snapIsService && prevBuilding !== snap.building) {
    // kind changed (shouldn't normally happen, but handle defensively)
    world.serviceBuildings = world.serviceBuildings.filter(s => !(s.tx === tx && s.ty === ty));
    world.serviceBuildings.push({ tx, ty, kind: snap.building });
  }
  world.roadNetDirty = true;
  world.grid.markDirty(tx, ty);
}
