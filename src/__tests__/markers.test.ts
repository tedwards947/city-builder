// Focus markers (sim/markers.ts): saved with the city, edited only with
// ?debug=true, never seen by the sim, and toured in order by the title screen.

import { describe, it, expect } from 'vitest';
import { CommandHistory } from '../commands/CommandHistory';
import { SetMarkersCommand } from '../commands/MarkerCommands';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { commandForTool } from '../input/InputController';
import { decodeSaveFile, encodeSaveFile } from '../persistence/SaveFile';
import { deserialize, serialize } from '../persistence/Serializer';
import { ROAD_NONE, ROAD_STREET } from '../sim/constants';
import { cleanMarkers, type Marker } from '../sim/markers';
import { SPOT_ZOOM, findTourSpots, nextTourSpot, type TourSpot } from '../title/tourSpots';
import { landWorld } from './pcTestWorld';

const focus = (x: number, y: number, zoom?: number): Marker => (zoom === undefined ? { x, y, kind: 'focus' } : { x, y, kind: 'focus', zoom });

describe('saving markers', () => {
  it('a city with none saves exactly as before, and an old save loads with none', () => {
    const w = landWorld(32);
    const snap = serialize(w);
    expect('markers' in snap).toBe(false);
    expect(deserialize(snap).markers).toEqual([]);
  });

  it('markers survive a save to file and back, in order', () => {
    const w = landWorld(32);
    w.markers = [{ x: 20, y: 5, kind: 'focus', zoom: 2.4, label: 'the bridge' }, focus(3, 9)];
    const text = encodeSaveFile({ name: 'test', savedAt: 0, tick: 0, population: 0 } as never, serialize(w));
    const back = deserialize(decodeSaveFile(text).snapshot);
    expect(back.markers).toEqual(w.markers);
    expect(back.markers).not.toBe(w.markers);
  });

  it('a damaged list is cleaned: off the map, not a marker, or a second one on a tile', () => {
    const raw = [focus(1, 1, 2), { x: 99, y: 1, kind: 'focus' }, null, { x: 2, y: 2 }, { x: 1.5, y: 2, kind: 'focus' }, focus(1, 1), { x: 4, y: 4, kind: 'focus', zoom: -1, label: 7 }];
    expect(cleanMarkers(raw, 32, 32)).toEqual([focus(1, 1, 2), focus(4, 4)]);
    expect(cleanMarkers(undefined, 32, 32)).toEqual([]);
    expect(cleanMarkers('x', 32, 32)).toEqual([]);
  });
});

describe('editing markers', () => {
  it('every change is one undo step', () => {
    const w = landWorld(32), h = new CommandHistory(w);
    h.run(new SetMarkersCommand([focus(1, 1)]));
    h.run(new SetMarkersCommand([focus(1, 1), focus(5, 5)]));
    expect(w.markers).toHaveLength(2);
    h.undo();
    expect(w.markers).toEqual([focus(1, 1)]);
    h.undo();
    expect(w.markers).toEqual([]);
    h.redo();
    expect(w.markers).toEqual([focus(1, 1)]);
  });

  it('the Focus tool puts a marker down with the view\'s zoom, and takes it up again', () => {
    const w = landWorld(32), h = new CommandHistory(w);
    h.run(commandForTool('focus', 7, 8, w, false, 2.1)!);
    expect(w.markers).toEqual([focus(7, 8, 2.1)]);
    h.run(commandForTool('focus', 7, 8, w, false, 1)!);
    expect(w.markers).toEqual([]);
  });

  it('the bulldozer takes up a marker and leaves the tile; a second pass clears the tile', () => {
    const w = landWorld(32), h = new CommandHistory(w);
    w.setRoad(7, 8, ROAD_STREET);
    w.markers = [focus(7, 8)];
    h.run(commandForTool('bulldoze', 7, 8, w, false, 2)!);
    expect(w.markers).toEqual([]);
    expect(w.layers.roadClass[w.grid.idx(7, 8)]).toBe(ROAD_STREET);
    h.undo();
    expect(w.markers).toEqual([focus(7, 8)]);
    h.run(commandForTool('bulldoze', 7, 8, w, false, 2)!);
    h.run(commandForTool('bulldoze', 7, 8, w, false, 2)!);
    expect(w.layers.roadClass[w.grid.idx(7, 8)]).toBe(ROAD_NONE);
  });

  it('without debug nothing edits a marker: the Focus tool does nothing and the bulldozer clears the tile as usual', () => {
    const w = landWorld(32);
    w.markers = [focus(7, 8)];
    expect(commandForTool('focus', 7, 8, w)).toBeNull();
    expect(commandForTool('focus', 9, 9, w)).toBeNull();
    expect(commandForTool('bulldoze', 7, 8, w)).toBeInstanceOf(BulldozeCommand);
  });
});

describe('the tour with markers', () => {
  const visit = (spots: TourSpot[], n: number): TourSpot[] => {
    const recent: TourSpot[] = [];
    for (let k = 0; k < n; k++) recent.push(nextTourSpot(spots, recent, () => 0.5)!);
    return recent;
  };

  it('two or more markers are the whole tour, in the order placed, round and round', () => {
    const w = landWorld(64);
    for (let x = 4; x < 40; x++) w.setRoad(x, 30, ROAD_STREET);
    w.markers = [focus(50, 50, 3), focus(10, 10), focus(30, 12, 1.2)];
    const spots = findTourSpots(w);
    expect(spots.map(s => [s.kind, s.tx, s.ty, s.zoom])).toEqual([['focus', 50, 50, 3], ['focus', 10, 10, SPOT_ZOOM.focus], ['focus', 30, 12, 1.2]]);
    expect(visit(spots, 7).map(s => s.tx)).toEqual([50, 10, 30, 50, 10, 30, 50]);
  });

  it('the order holds when the spots are found afresh between visits', () => {
    const w = landWorld(64);
    w.markers = [focus(50, 50), focus(10, 10), focus(30, 12)];
    const recent: TourSpot[] = [];
    for (let k = 0; k < 5; k++) recent.push(nextTourSpot(findTourSpots(w), recent, () => 0.5)!);
    expect(recent.map(s => s.tx)).toEqual([50, 10, 30, 50, 10]);
  });

  it('a single marker takes turns with the spots found from the city', () => {
    const w = landWorld(64);
    w.markers = [focus(50, 50)];
    const spots = findTourSpots(w);
    expect(spots.some(s => s.kind === 'overview')).toBe(true);
    expect(visit(spots, 4).map(s => s.kind)).toEqual(['focus', 'overview', 'focus', 'overview']);
  });

  it('with no markers the tour finds its own spots, as before', () => {
    expect(findTourSpots(landWorld(64)).map(s => s.kind)).toEqual(['overview']);
  });
});
