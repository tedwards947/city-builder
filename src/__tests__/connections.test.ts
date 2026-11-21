// Outside connections, phase 1 (CONNECTIONS_DESIGN.md, sim/connections.ts):
// the fixed points on the map's edges. Where they go, that their tiles are
// reserved, and how they are saved and worked out for an old save.

import { describe, it, expect } from 'vitest';
import tutorialText from '../../public/tutorial/tutorial.citysave.json?raw';
import { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import {
  BUILDING_PARK, RAIL_ELEVATED, RAIL_GROUND, RAIL_SUBWAY, ROAD_AVENUE, ROAD_HIGHWAY, ROAD_NONE, ROAD_STREET, TERRAIN_SAND, TERRAIN_WATER, ZONE_NONE, ZONE_R,
} from '../sim/constants';
import {
  cleanConnections, connectionCounts, connectionOn, connectionStatus, edgeOf, generateConnections, resetConnections,
  EDGE_N, EDGE_E, EDGE_S, EDGE_W, type Connection,
} from '../sim/connections';
import { waterQuote } from '../sim/landscaping';
import { deserialize, serialize } from '../persistence/Serializer';
import { decodeSaveFile, encodeSaveFile } from '../persistence/SaveFile';
import { buildTutorialMap } from '../gen/tutorialMap';
import { BuildRoadCommand, roadBuildCost } from '../commands/BuildRoadCommand';
import { PaintZoneCommand } from '../commands/PaintZoneCommand';
import type { MapType } from '../sim/terrainGen';
import { landWorld } from './pcTestWorld';

const of = (w: World, kind: string): Connection[] => w.connections.filter((c) => c.kind === kind);
const xy = (w: World, c: Connection): [number, number] => [c.tile % w.grid.width, Math.floor(c.tile / w.grid.width)];

describe('how many points a map has', () => {
  it('goes by the shorter side: the owner\'s table, and none on a map too small', () => {
    expect(connectionCounts(32, 32)).toEqual({ highway: 0, rail: 0 });
    expect(connectionCounts(48, 48)).toEqual({ highway: 1, rail: 0 });
    expect(connectionCounts(64, 64)).toEqual({ highway: 1, rail: 0 });
    expect(connectionCounts(128, 128)).toEqual({ highway: 2, rail: 2 });
    expect(connectionCounts(200, 256)).toEqual({ highway: 3, rail: 3 });
    expect(connectionCounts(256, 256)).toEqual({ highway: 3, rail: 3 });
    expect(connectionCounts(512, 512)).toEqual({ highway: 4, rail: 4 });
    expect(connectionCounts(1024, 1024)).toEqual({ highway: 4, rail: 4 });   // bigger than the table: its last row
  });

  it('a new map gets them when it is made', () => {
    expect(new World(32, 32, 3).connections).toEqual([]);
    const w = new World(128, 128, 5);
    expect(of(w, 'highway')).toHaveLength(2);
    expect(of(w, 'rail')).toHaveLength(2);
  });
});

describe('where the points go', () => {
  const maps: [number, number, MapType][] = [];
  for (const mapType of ['classic', 'river', 'coastal', 'lakes', 'bay'] as const) {
    for (const seed of [1, 2, 3, 4, 5, 6]) maps.push([128, seed, mapType], [256, seed + 40, mapType]);
  }

  it('on the edge but never a corner, on dry land with dry land behind, apart from each other and from the corners', () => {
    const C = BALANCE.connections;
    for (const [size, seed, mapType] of maps) {
      const w = new World(size, size, seed, { mapType });
      const want = connectionCounts(size, size);
      const where = `${mapType} ${size} seed ${seed}`;
      expect(of(w, 'highway').length, where).toBeLessThanOrEqual(want.highway);
      expect(of(w, 'rail').length, where).toBeLessThanOrEqual(want.rail);
      expect(w.connections.length, where).toBeGreaterThanOrEqual(2);   // even a watery map keeps some
      for (const c of w.connections) {
        const [x, y] = xy(w, c);
        expect(edgeOf(size, size, c.tile), where).toBe(c.edge);
        expect(c.edge, where).toBeGreaterThanOrEqual(0);
        const step = c.edge === EDGE_N ? size : c.edge === EDGE_E ? -1 : c.edge === EDGE_S ? -size : 1;
        for (let k = 0; k < C.inland; k++) expect(w.layers.terrain[c.tile + k * step], where).not.toBe(TERRAIN_WATER);
        const along = c.edge === EDGE_N || c.edge === EDGE_S ? Math.min(x, size - 1 - x) : Math.min(y, size - 1 - y);
        expect(along, where).toBeGreaterThanOrEqual(C.cornerGap * size);
        for (const o of w.connections) {
          if (o === c) continue;
          const [ox, oy] = xy(w, o);
          expect(Math.hypot(x - ox, y - oy), where).toBeGreaterThanOrEqual(C.minGap * size);
        }
      }
    }
  }, 60_000);   // 60 maps: quick, but give it room on a busy machine

  it('a map of open land gets every point, with each kind on more than one edge', () => {
    for (const size of [128, 256, 512]) {
      const w = landWorld(size);
      resetConnections(w);
      const want = connectionCounts(size, size);
      expect(of(w, 'highway')).toHaveLength(want.highway);
      expect(of(w, 'rail')).toHaveLength(want.rail);
      expect(new Set(of(w, 'highway').map((c) => c.edge)).size).toBeGreaterThanOrEqual(2);
      expect(new Set(of(w, 'rail').map((c) => c.edge)).size).toBeGreaterThanOrEqual(2);
    }
  });

  it('the same map and seed always give the same points, and the city\'s own random numbers are not used', () => {
    const a = new World(256, 256, 77, { mapType: 'river' }), b = new World(256, 256, 77, { mapType: 'river' });
    expect(a.connections).toEqual(b.connections);
    expect(generateConnections(a)).toEqual(a.connections);
    expect(new World(256, 256, 78, { mapType: 'river' }).connections).not.toEqual(a.connections);
    const untouched = b.rng();
    generateConnections(a);
    expect(a.rng()).toBe(untouched);
  });

  it('a point is not put in the sea: no water tile is ever chosen', () => {
    const w = landWorld(128);
    // The whole west third is sea.
    for (let y = 0; y < 128; y++) for (let x = 0; x < 40; x++) w.layers.terrain[y * 128 + x] = TERRAIN_WATER;
    resetConnections(w);
    expect(w.connections).toHaveLength(4);
    for (const c of w.connections) {
      expect(c.edge).not.toBe(EDGE_W);
      expect(xy(w, c)[0]).toBeGreaterThanOrEqual(40);
    }
  });

  it('a point is never put on a beach: sand tiles on an edge are skipped', () => {
    const w = landWorld(128);
    // A beach all along the west edge and half the south edge.
    for (let y = 0; y < 128; y++) w.layers.terrain[y * 128] = TERRAIN_SAND;
    for (let x = 0; x < 64; x++) w.layers.terrain[127 * 128 + x] = TERRAIN_SAND;
    resetConnections(w);
    expect(w.connections).toHaveLength(4);
    for (const c of w.connections) expect(w.layers.terrain[c.tile]).not.toBe(TERRAIN_SAND);
  });

  it('on generated coasts no point sits on a beach', () => {
    for (const mapType of ['coastal', 'bay', 'lakes'] as const) {
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const w = new World(128, 128, seed, { mapType });
        for (const c of w.connections) {
          if (w.layers.roadClass[c.tile] === ROAD_NONE) expect(w.layers.terrain[c.tile], `${mapType} ${seed}`).not.toBe(TERRAIN_SAND);
        }
      }
    }
  });

  it('the land the middle of the map is on comes first', () => {
    const w = landWorld(128);
    // A channel cuts the east quarter off as an island.
    for (let y = 0; y < 128; y++) for (let x = 90; x < 96; x++) w.layers.terrain[y * 128 + x] = TERRAIN_WATER;
    resetConnections(w);
    expect(w.connections).toHaveLength(4);
    for (const c of w.connections) expect(xy(w, c)[0]).toBeLessThan(90);
  });
});

describe('a point\'s tile is reserved', () => {
  function world(): { w: World; h: Connection; r: Connection } {
    const w = landWorld(128);
    resetConnections(w);
    return { w, h: of(w, 'highway')[0], r: of(w, 'rail')[0] };
  }

  it('a highway point takes a highway and no other road; building one joins it', () => {
    const { w, h } = world();
    const [x, y] = xy(w, h);
    expect(connectionStatus(w).find((c) => c.tile === h.tile)).toMatchObject({ kind: 'highway', tx: x, ty: y, joined: false });
    expect(w.setRoad(x, y, ROAD_STREET)).toBe(false);
    expect(w.setRoad(x, y, ROAD_AVENUE)).toBe(false);
    expect(w.layers.roadClass[h.tile]).toBe(ROAD_NONE);
    expect(w.setRoad(x, y, ROAD_HIGHWAY)).toBe(true);
    expect(connectionStatus(w).find((c) => c.tile === h.tile)!.joined).toBe(true);
    // Bulldozed, it is a point still, and can be joined again.
    expect(w.setRoad(x, y, ROAD_NONE)).toBe(true);
    expect(connectionOn(w, h.tile)).toBe(h);
    expect(connectionStatus(w).find((c) => c.tile === h.tile)!.joined).toBe(false);
  });

  it('a rail point takes ground track and no road; laying track joins it', () => {
    const { w, r } = world();
    const [x, y] = xy(w, r);
    for (const road of [ROAD_STREET, ROAD_AVENUE, ROAD_HIGHWAY]) expect(w.setRoad(x, y, road)).toBe(false);
    expect(w.layTrack(x, y, RAIL_ELEVATED)).toBe(false);
    expect(w.layTrack(x, y, RAIL_GROUND)).toBe(true);
    expect(connectionStatus(w).find((c) => c.tile === r.tile)!.joined).toBe(true);
  });

  it('no track on the surface of a highway point; a subway may pass under either', () => {
    const { w, h, r } = world();
    expect(w.layTrack(...xy(w, h), RAIL_GROUND)).toBe(false);
    expect(w.layTrack(...xy(w, h), RAIL_ELEVATED)).toBe(false);
    expect(w.layTrack(...xy(w, h), RAIL_SUBWAY)).toBe(true);
    expect(w.layTrack(...xy(w, r), RAIL_SUBWAY)).toBe(true);
    expect(connectionStatus(w).find((c) => c.tile === r.tile)!.joined).toBe(false);   // a subway is not the line to the region
  });

  it('no zone, no building and no water on either', () => {
    const { w, h, r } = world();
    for (const c of [h, r]) {
      const [x, y] = xy(w, c);
      expect(w.setZone(x, y, ZONE_R)).toBe(false);
      expect(w.layers.zone[c.tile]).toBe(ZONE_NONE);
      expect(w.canPlaceBuilding(x, y, BUILDING_PARK)).toBe(false);
      const q = waterQuote(w, [c.tile], true);
      expect(q.blocked).toContain(c.tile);
    }
    // The tools refuse too, and nothing is paid.
    w.budget.money = 1_000_000;
    expect(roadBuildCost(w, ...xy(w, h), ROAD_STREET)).toBeNull();
    expect(roadBuildCost(w, ...xy(w, h), ROAD_HIGHWAY)).toBeGreaterThan(0);
    expect(roadBuildCost(w, ...xy(w, r), ROAD_HIGHWAY)).toBeNull();
    expect(new BuildRoadCommand(...xy(w, h), ROAD_STREET).execute(w)).toBe(false);
    expect(new PaintZoneCommand(...xy(w, h), ZONE_R).execute(w)).toBe(false);
    expect(w.budget.money).toBe(1_000_000);
    // The tile beside a point is ordinary land.
    const [x, y] = xy(w, h);
    const beside: [number, number] = h.edge === EDGE_N || h.edge === EDGE_S ? [x + 1, y] : [x, y + 1];
    expect(w.setZone(...beside, ZONE_R)).toBe(true);
  });
});

describe('what is already built to the edge', () => {
  it('a highway running in from the edge becomes a point, and the rest are chosen round it', () => {
    const w = landWorld(128);
    for (let x = 0; x <= 10; x++) w.setRoad(x, 70, ROAD_HIGHWAY);
    resetConnections(w);
    const highways = of(w, 'highway');
    expect(highways).toHaveLength(2);
    expect(highways[0]).toEqual({ kind: 'highway', tile: 70 * 128, edge: EDGE_W });
    expect(connectionStatus(w)[0].joined).toBe(true);
    expect(of(w, 'rail')).toHaveLength(2);
  });

  it('ground track running in from the edge becomes a rail point', () => {
    const w = landWorld(128);
    for (let y = 127; y >= 110; y--) w.layTrack(50, y);
    resetConnections(w);
    expect(of(w, 'rail')[0]).toEqual({ kind: 'rail', tile: 127 * 128 + 50, edge: EDGE_S });
    expect(of(w, 'rail')).toHaveLength(2);
  });

  it('no more than the map\'s count: five highways to the edge of a small map make two points', () => {
    const w = landWorld(128);
    for (const y of [15, 40, 64, 90, 115]) for (let x = 0; x <= 6; x++) w.setRoad(x, y, ROAD_HIGHWAY);
    resetConnections(w);
    const highways = of(w, 'highway');
    expect(highways).toHaveLength(2);
    for (const c of highways) expect(w.layers.roadClass[c.tile]).toBe(ROAD_HIGHWAY);
  });

  it('a highway that runs along the edge is one point, and one running straight in is taken first', () => {
    const w = landWorld(128);
    for (let x = 20; x <= 100; x++) w.setRoad(x, 0, ROAD_HIGHWAY);          // along the north edge
    for (let y = 127; y >= 120; y--) w.setRoad(64, y, ROAD_HIGHWAY);        // straight in from the south
    resetConnections(w);
    const highways = of(w, 'highway');
    expect(highways).toHaveLength(2);
    expect(highways[0]).toEqual({ kind: 'highway', tile: 127 * 128 + 64, edge: EDGE_S });
    expect(highways[1].edge).toBe(EDGE_N);
  });

  it('a street at the edge is not a point', () => {
    const w = landWorld(128);
    for (let x = 0; x <= 10; x++) w.setRoad(x, 70, ROAD_STREET);
    resetConnections(w);
    expect(connectionOn(w, 70 * 128)).toBeNull();
  });
});

describe('saving', () => {
  it('the points are saved and come back as they were, through a save file too', () => {
    const w = new World(128, 128, 21, { mapType: 'lakes' });
    expect(w.connections.length).toBeGreaterThan(0);
    const back = deserialize(serialize(w));
    expect(back.connections).toEqual(w.connections);
    const file = decodeSaveFile(encodeSaveFile({ id: 'x', name: 'x', savedAt: 0 } as never, serialize(w)));
    expect(deserialize(file.snapshot).connections).toEqual(w.connections);
  });

  it('a save from before connections gets its points on load: what it built to the edge first, the same every time', () => {
    const w = landWorld(128);
    for (let x = 0; x <= 10; x++) w.setRoad(x, 70, ROAD_HIGHWAY);
    w.setZone(30, 0, ZONE_R);
    const old = serialize(w);
    delete old.connections;
    const a = deserialize(old), b = deserialize(old);
    expect(a.connections).toEqual(b.connections);
    expect(a.connections.filter((c) => c.kind === 'highway')).toHaveLength(2);
    expect(a.connections[0]).toEqual({ kind: 'highway', tile: 70 * 128, edge: EDGE_W });
    // What stands on the edge is left alone: no point lands on a zone, a road or a building.
    for (const c of a.connections.slice(1)) {
      expect(a.layers.zone[c.tile]).toBe(ZONE_NONE);
      expect(a.layers.roadClass[c.tile]).toBe(ROAD_NONE);
    }
    // Saved again, the points are in the save and no longer worked out.
    const again = serialize(a);
    expect(again.connections).toHaveLength(a.connections.length);
    expect(deserialize(again).connections).toEqual(a.connections);
  });

  it('the tutorial map\'s one point is its highway stub, in the shipped file and in the generator', () => {
    const shipped = deserialize(decodeSaveFile(tutorialText).snapshot);
    for (const w of [shipped, buildTutorialMap()]) {
      expect(w.connections).toHaveLength(1);
      const s = connectionStatus(w)[0];
      expect(s).toMatchObject({ kind: 'highway', edge: EDGE_W, tx: 0, joined: true });
      expect(w.layers.roadClass[s.tile]).toBe(ROAD_HIGHWAY);
    }
  });

  it('junk in a save is dropped: unknown kinds, tiles off the edge, corners, doubles', () => {
    const clean = cleanConnections([
      { kind: 'highway', tile: 5 }, { kind: 'rail', tile: 5 }, { kind: 'canal', tile: 6 }, { kind: 'rail', tile: 0 },
      { kind: 'rail', tile: 64 * 10 + 10 }, { kind: 'rail', tile: -1 }, { kind: 'rail', tile: 1.5 }, null, { kind: 'rail', tile: 64 * 9 },
    ], 64, 64);
    expect(clean).toEqual([{ kind: 'highway', tile: 5, edge: EDGE_N }, { kind: 'rail', tile: 64 * 9, edge: EDGE_W }]);
    expect(cleanConnections(undefined, 64, 64)).toEqual([]);
  });
});
