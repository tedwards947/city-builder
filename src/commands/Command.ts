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
  /**
   * world.buildingId of the tile: its building's anchor index + 1. Missing or
   * 0 with a building = a one-tile building anchored here.
   */
  buildingId?: number;
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
    buildingId:    world.buildingId[i],
  };
}

/**
 * The tiles a command must snapshot to be able to undo clearing (tx, ty):
 * every tile of the building there, or just the tile if there is none.
 */
export function tilesClearedWith(world: World, tx: number, ty: number): number[] {
  const whole = world.buildingTilesAt(tx, ty);
  return whole.length > 0 ? whole : [world.grid.idx(tx, ty)];
}

/** Snapshots of several tiles, to hand back to restoreTiles. */
export function snapshotTiles(world: World, tiles: readonly number[]): { i: number; snap: TileSnapshot }[] {
  const { width } = world.grid;
  return tiles.map(i => ({ i, snap: snapshotTile(world, i % width, (i - (i % width)) / width) }));
}

/** Put several tiles back as they were. A building of several tiles comes back whole, as one entity. */
export function restoreTiles(world: World, snaps: readonly { i: number; snap: TileSnapshot }[]): void {
  const { width } = world.grid;
  for (const { i, snap } of snaps) restoreTile(world, i % width, (i - (i % width)) / width, snap);
}

/**
 * Put one tile back as it was. The building list follows the ANCHOR tile: a
 * building's entity is removed when its anchor tile is restored to something
 * else, and added when a tile is restored to being an anchor. So restoring
 * every tile of a large building (restoreTiles) brings it back as one entity,
 * and takes it away as one.
 */
export function restoreTile(world: World, tx: number, ty: number, snap: TileSnapshot): void {
  const i = world.grid.idx(tx, ty);
  const prevBuilding = world.buildingAnchorAt(i) === i ? world.layers.building[i] : BUILDING_NONE;
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
  const id = snap.building !== BUILDING_NONE ? (snap.buildingId || i + 1) : 0;
  world.buildingId[i] = id;
  if (id === i + 1) {
    world.buildings.push({ tx, ty, kind: snap.building });
  }
  world.roadNetDirty = true;
  world.grid.markDirty(tx, ty);
}

// The political cost of wiping a tile lives with the rest of the political
// capital rules; re-exported here for the commands and tests that import it.
export { tileDisruption } from '../sim/politics';
export type { Disruption } from '../sim/politics';
