// Base class and tile snapshot utilities for the command pattern.
// Every player action is a Command with execute(world) / undo(world).
// Commands snapshot tile state to reverse themselves.
// This gives us undo for free and will give us replays later.

import type { World } from '../sim/World';
import { BUILDING_NONE } from '../sim/constants';

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
  // Keep unified buildings list consistent on undo.
  if (prevBuilding !== BUILDING_NONE) {
    world.buildings = world.buildings.filter(b => !(b.tx === tx && b.ty === ty));
  }
  if (snap.building !== BUILDING_NONE) {
    world.buildings.push({ tx, ty, kind: snap.building });
  }
  world.roadNetDirty = true;
  world.grid.markDirty(tx, ty);
}
