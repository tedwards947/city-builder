// Every change to world.markers (place, move, delete, reorder, relabel) is one
// command that swaps the whole list, so each is one undo step. Markers cost
// nothing and touch no tile.

import { Command } from './Command';
import type { World } from '../sim/World';
import { markerIndexAt, type Marker } from '../sim/markers';

export class SetMarkersCommand extends Command {
  private readonly after: Marker[];
  private before: Marker[] = [];

  constructor(after: readonly Marker[]) {
    super();
    this.after = after.map(m => ({ ...m }));
  }

  execute(world: World): boolean {
    this.before = world.markers;
    world.markers = this.after.map(m => ({ ...m }));
    return true;
  }

  undo(world: World): void {
    world.markers = this.before;
  }
}

/** Put a marker on a tile (replacing one already there, which keeps its place in the order). */
export function placeMarkerCommand(world: World, marker: Marker): SetMarkersCommand {
  const list = world.markers.slice();
  const at = markerIndexAt(world, marker.x, marker.y);
  if (at >= 0) list[at] = marker; else list.push(marker);
  return new SetMarkersCommand(list);
}

/** Take away the marker on a tile; null when there is none. */
export function removeMarkerCommand(world: World, tx: number, ty: number): SetMarkersCommand | null {
  const at = markerIndexAt(world, tx, ty);
  return at < 0 ? null : new SetMarkersCommand(world.markers.filter((_, k) => k !== at));
}
