// Base class and tile snapshot utilities for the command pattern.
// Every player action is a Command with execute(world) / undo(world).
// Commands snapshot tile state to reverse themselves.
// This gives us undo for free and will give us replays later.

import type { World } from '../sim/World';
import { BUILDING_NONE } from '../sim/constants';

/** Why execute() refused, when the reason is worth telling the player. */
export type FailReason = 'funds' | 'politicalCapital';

export abstract class Command {
  /** Set by execute() when it returns false for lack of money or political capital. */
  failReason: FailReason | null = null;
  abstract execute(world: World): boolean;
  abstract undo(world: World): void;
}

export interface TileSnapshot {
  zone: number;
  road: number;
  building: number;
  dev: number;
  // Optional so hand-built snapshots can omit them; restoreTile treats a
  // missing value as 0. snapshotTile always fills them in.
  abandoned?: number;
  distress?: number;
  vegetation?: number;
  visualVariant?: number;
}

export function snapshotTile(world: World, tx: number, ty: number): TileSnapshot {
  const i = world.grid.idx(tx, ty);
  return {
    zone:     world.layers.zone[i],
    road:     world.layers.roadClass[i],
    building: world.layers.building[i],
    dev:      world.layers.devLevel[i],
    abandoned:     world.layers.abandoned[i],
    distress:      world.layers.distress[i],
    vegetation:    world.layers.vegetation[i],
    visualVariant: world.layers.visualVariant[i],
  };
}

export function restoreTile(world: World, tx: number, ty: number, snap: TileSnapshot): void {
  const i = world.grid.idx(tx, ty);
  const prevBuilding = world.layers.building[i];
  world.layers.zone[i]      = snap.zone;
  world.layers.roadClass[i] = snap.road;
  world.layers.building[i]  = snap.building;
  world.layers.devLevel[i]  = snap.dev;
  world.layers.abandoned[i]     = snap.abandoned ?? 0;
  world.layers.distress[i]      = snap.distress ?? 0;
  world.layers.vegetation[i]    = snap.vegetation ?? 0;
  world.layers.visualVariant[i] = snap.visualVariant ?? 0;
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

// The political cost of wiping a tile lives with the rest of the political
// capital rules; re-exported here for the commands and tests that import it.
export { tileDisruption } from '../sim/politics';
export type { Disruption } from '../sim/politics';
