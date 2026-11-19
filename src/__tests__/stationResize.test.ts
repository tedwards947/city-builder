// Save version 9 → 10 (persistence/stationResize.ts): train stations of an
// old city are rebuilt at the new, smaller size, on the same track, keeping
// their road; nothing is removed.

import { describe, it, expect } from 'vitest';
import { World } from '../sim/World';
import { migrate, SAVE_VERSION, type SaveRecord } from '../persistence/SaveFormat';
import { serialize, deserialize } from '../persistence/Serializer';
import { railLinks, trackBlocker, LINK_E, LINK_W, LINK_N, LINK_S } from '../sim/rail';
import { BUILDING_NONE, BUILDING_STATION, BUILDING_STATION_L, BUILDING_SUBWAY_STATION, RAIL_GROUND, RAIL_SUBWAY, ROAD_NONE, ROAD_STREET } from '../sim/constants';
import { landWorld } from './pcTestWorld';

type Offset = [number, number];
const turn = ([dx, dy]: Offset, rot: number): Offset => (rot === 1 ? [-dy, dx] : rot === 2 ? [-dx, -dy] : rot === 3 ? [dy, -dx] : [dx, dy]);
const block = (w: number, h: number): Offset[] => Array.from({ length: w * h }, (_, k): Offset => [k % w, Math.floor(k / w)]);

/** Write a station into `w` as a version-9 city held it: the old shape, its platform track, its entry in the list. */
function oldStation(w: World, tx: number, ty: number, kind: number, rot = 0): void {
  const straight = kind === BUILDING_STATION;
  const platform = (dx: number, dy: number) => (straight ? dy === 1 : (dy === 1 && dx <= 1) || (dx === 1 && dy === 0));
  for (const [dx, dy] of straight ? block(4, 3) : block(3, 3)) {
    const [x, y] = turn([dx, dy], rot), i = w.grid.idx(tx + x, ty + y);
    w.layers.building[i] = kind;
    if (platform(dx, dy)) w.layers.rail[i] |= RAIL_GROUND;
  }
  w.buildings.push(rot ? { tx, ty, kind, rot } : { tx, ty, kind });
}

const v9 = (w: World): SaveRecord => ({ version: 9, userId: 'test', slot: 1, meta: { name: 'Old', savedAt: 0, tick: 0, population: 0, money: 0 }, snapshot: serialize(w) } as SaveRecord);
const upgrade = (w: World): World => deserialize(migrate(v9(w)).snapshot);

describe('a version-9 city with train stations', () => {
  it('a straight station keeps three of its four platform tiles; the fourth stays as track and the rest is empty land', () => {
    const old = landWorld(32);
    for (let x = 4; x <= 9; x++) old.layTrack(x, 11);
    for (let x = 14; x <= 20; x++) old.layTrack(x, 11);
    oldStation(old, 10, 10, BUILDING_STATION);                            // 4×3 at x 10–13, y 10–12; platform y 11
    const money = old.budget.money;
    const rec = migrate(v9(old));
    expect(rec.version).toBe(SAVE_VERSION);
    const w = deserialize(rec.snapshot);
    expect(w.buildings).toEqual([{ tx: 10, ty: 11, kind: BUILDING_STATION }]);
    for (let x = 10; x <= 12; x++) expect(w.getBuilding(x, 11)).toBe(BUILDING_STATION);
    expect(w.buildingTilesAt(11, 11)).toEqual([w.grid.idx(10, 11), w.grid.idx(11, 11), w.grid.idx(12, 11)]);
    for (let x = 10; x <= 13; x++) { expect(w.getBuilding(x, 10)).toBe(BUILDING_NONE); expect(w.getBuilding(x, 12)).toBe(BUILDING_NONE); }
    expect(w.getBuilding(13, 11)).toBe(BUILDING_NONE);
    // The line is whole, from one side of the old station to the other.
    for (let x = 5; x <= 19; x++) expect(railLinks(w, w.grid.idx(x, 11))).toBe(LINK_E | LINK_W);
    // Nothing was removed or refunded, and the freed land beside the platform takes no track.
    expect(w.budget.money).toBe(money);
    expect(trackBlocker(w, 11, 10)).toBe('blocked');
    expect(w.loadNotes).toEqual({ stationsRebuilt: 1 });
    // The old save itself is untouched.
    expect(old.getBuilding(10, 10)).toBe(BUILDING_STATION);
  });

  it('a street that ran along the old wall is carried one tile on, so the station keeps its road', () => {
    const old = landWorld(32);
    for (let x = 6; x <= 18; x++) old.setRoad(x, 9, ROAD_STREET);         // along the north wall
    for (let y = 13; y <= 18; y++) old.setRoad(12, y, ROAD_STREET);       // ending against the south wall
    oldStation(old, 10, 10, BUILDING_STATION);
    const w = upgrade(old);
    expect(w.getRoad(10, 10)).toBe(ROAD_STREET);                          // one stub north …
    expect(w.getRoad(11, 10)).toBe(ROAD_NONE);
    expect(w.getRoad(12, 12)).toBe(ROAD_STREET);                          // … and one south, where the street ended
    expect(w.getRoad(10, 12)).toBe(ROAD_NONE);
    expect(w.buildingAccessRoads(10, 11).sort((a, b) => a - b)).toEqual([w.grid.idx(10, 10), w.grid.idx(12, 12)]);
  });

  it('with no road at the old wall nothing is paved', () => {
    const old = landWorld(32);
    oldStation(old, 10, 10, BUILDING_STATION);
    const w = upgrade(old);
    expect(Array.from(w.layers.roadClass).every(r => r === ROAD_NONE)).toBe(true);
  });

  it('a turned station is rebuilt along its own track', () => {
    const old = landWorld(32);
    for (let y = 14; y <= 20; y++) old.layTrack(11, y);
    oldStation(old, 12, 10, BUILDING_STATION, 1);                         // x 10–12, y 10–13; platform down the column x 11
    for (let x = 4; x <= 9; x++) old.setRoad(x, 11, ROAD_STREET);         // a street ending against its west wall
    const w = upgrade(old);
    expect(w.buildings).toEqual([{ tx: 11, ty: 10, kind: BUILDING_STATION, rot: 1 }]);
    for (let y = 10; y <= 12; y++) expect(w.getBuilding(11, y)).toBe(BUILDING_STATION);
    expect(w.getBuilding(11, 13)).toBe(BUILDING_NONE);
    for (let y = 11; y <= 19; y++) expect(railLinks(w, w.grid.idx(11, y))).toBe(LINK_N | LINK_S);
    expect(w.getRoad(9, 11)).toBe(ROAD_STREET);
    expect(w.getRoad(10, 11)).toBe(ROAD_STREET);
    expect(w.buildingAccessRoads(11, 10)).toEqual([w.grid.idx(10, 11)]);
  });

  it('a curved station keeps its corner: the same anchor and platform, the outer ring freed', () => {
    const old = landWorld(32);
    for (let y = 4; y <= 9; y++) old.layTrack(11, y);
    for (let x = 4; x <= 9; x++) old.layTrack(x, 11);
    oldStation(old, 10, 10, BUILDING_STATION_L);                          // 3×3; platform (10,11) (11,11) (11,10)
    for (let y = 8; y <= 14; y++) old.setRoad(13, y, ROAD_STREET);        // along the east wall
    const w = upgrade(old);
    expect(w.buildings).toEqual([{ tx: 10, ty: 10, kind: BUILDING_STATION_L }]);
    expect(w.buildingTilesAt(10, 10).length).toBe(4);
    for (const [x, y] of [[12, 10], [12, 11], [12, 12], [10, 12], [11, 12]]) expect(w.getBuilding(x, y)).toBe(BUILDING_NONE);
    expect(railLinks(w, w.grid.idx(11, 11))).toBe(LINK_N | LINK_W);
    expect(railLinks(w, w.grid.idx(11, 9))).toBe(LINK_N | LINK_S);
    expect(railLinks(w, w.grid.idx(9, 11))).toBe(LINK_E | LINK_W);
    expect(w.getRoad(12, 10)).toBe(ROAD_STREET);                          // the stub from the east street
    expect(w.buildingAccessRoads(10, 10)).toEqual([w.grid.idx(12, 10)]);
  });

  it('a subway station keeps its entrance; the platform tile it gives up stays as tunnel', () => {
    const old = landWorld(32);
    old.placeBuilding(10, 10, BUILDING_SUBWAY_STATION);
    old.layTrack(12, 10, RAIL_SUBWAY);                                    // the fourth tile of the old platform
    const w = upgrade(old);
    expect(w.buildings).toEqual([{ tx: 10, ty: 10, kind: BUILDING_SUBWAY_STATION }]);
    for (let x = 9; x <= 12; x++) expect(w.getRail(x, 10)).toBe(RAIL_SUBWAY);
    expect(w.removeSubway(12, 10)).toBe(true);                            // no longer the station's
    expect(w.removeSubway(11, 10)).toBe(false);
    expect(w.loadNotes).toEqual({ stationsRebuilt: 1 });
  });

  it('a city with no station is not touched and gets no note; a city already at this version is not rebuilt', () => {
    const plain = landWorld(16);
    plain.setRoad(3, 3, ROAD_STREET);
    expect(upgrade(plain).loadNotes).toEqual({});
    const now = landWorld(32);
    now.placeBuilding(10, 11, BUILDING_STATION);
    const rec = migrate({ ...v9(now), version: SAVE_VERSION } as SaveRecord);
    const w = deserialize(rec.snapshot);
    expect(w.buildings).toEqual(now.buildings);
    expect(w.loadNotes).toEqual({});
  });
});
