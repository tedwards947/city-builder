// Leisure buildings, part 1 (LEISURE_DESIGN.md): the kinds and their shapes,
// where they may stand, one per city, the population lock, what they cost in
// money and political capital, the land value they lift, and the prime-spot
// link for merged lots. Traffic and visitors come in a later part.

import { describe, it, expect, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import {
  BUILDING_PARK, BUILDING_BIG_PARK, BUILDING_BEACH_PARK, BUILDING_PLAZA, BUILDING_MUSEUM, BUILDING_STADIUM,
  BUILDING_POLICE, ROAD_STREET, TERRAIN_WATER, ZONE_R,
} from '../sim/constants';
import { buildingShape, footprintTiles, placementRules } from '../sim/buildingShapes';
import {
  isLeisureKind, leisureKinds, countsAsPark, unlockPopulation, buildingUnlocked, bigProjectPc,
  leisureLandValueReach, addLeisureLandValue, beachTilesNear,
} from '../sim/leisure';
import { pcQuote } from '../sim/politics';
import { LandValueSystem } from '../sim/systems/LandValueSystem';
import { CommandHistory } from '../commands/CommandHistory';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { serialize, deserialize } from '../persistence/Serializer';
import { landWorld, home } from './pcTestWorld';

const rows = BALANCE.leisure.kinds;
const shipped = JSON.parse(JSON.stringify(rows));
afterEach(() => { for (const k in shipped) Object.assign(rows[Number(k)], JSON.parse(JSON.stringify(shipped[k]))); });

/** A rich city with plenty of political capital and (if asked) enough residents on the books. */
function rich(size = 40, population = 0): World {
  const w = landWorld(size);
  w.budget.money = 1e7;
  w.budget.politicalCapital = 1e4;
  w.stats.population = population;
  return w;
}

describe('leisure kinds', () => {
  it('are in two groups: parks (repeatable) and unique (one per city)', () => {
    expect(leisureKinds('parks')).toEqual([BUILDING_PARK, BUILDING_BIG_PARK, BUILDING_BEACH_PARK, BUILDING_PLAZA, 24, 25]);   // 24: the 2×2 park, 25: the lido
    expect(leisureKinds('unique')).toEqual([BUILDING_MUSEUM, BUILDING_STADIUM]);
    for (const k of leisureKinds('unique')) expect(placementRules(k).onePerCity).toBe(true);
    for (const k of leisureKinds('parks')) expect(placementRules(k).onePerCity).toBeFalsy();
    expect(isLeisureKind(BUILDING_POLICE)).toBe(false);
  });

  it('have the shapes agreed with graphics', () => {
    expect(buildingShape(BUILDING_BIG_PARK).length).toBe(9);
    expect(buildingShape(BUILDING_BEACH_PARK).length).toBe(6);
    expect(buildingShape(BUILDING_PLAZA).length).toBe(4);
    expect(buildingShape(BUILDING_MUSEUM).length).toBe(4);
    const stadium = buildingShape(BUILDING_STADIUM).map(([x, y]) => `${x},${y}`);
    expect(stadium.length).toBe(18);
    expect(stadium).toContain('1,4');
    expect(stadium).toContain('2,4');
    expect(stadium).not.toContain('0,4');
    // Only the beach park turns.
    expect(buildingShape(BUILDING_BEACH_PARK, 1)).not.toEqual(buildingShape(BUILDING_BEACH_PARK, 0));
    expect(buildingShape(BUILDING_STADIUM, 1)).toEqual(buildingShape(BUILDING_STADIUM, 0));
  });

  it('every kind has a price and an upkeep', () => {
    for (const k of [...leisureKinds('parks'), ...leisureKinds('unique')]) {
      expect(BALANCE.buildings[k].cost).toBeGreaterThan(0);
      expect(BALANCE.buildings[k].maintenance).toBeGreaterThan(0);
    }
  });
});

describe('placing leisure buildings', () => {
  it('a beach park must touch water, on any side', () => {
    const w = rich();
    expect(w.placeBlocker(10, 10, 25)).toBe('noWater');                                   // the lido follows the same rule
    expect(buildingShape(25, 1)).toEqual(buildingShape(BUILDING_BEACH_PARK, 1));
    expect(countsAsPark(25)).toBe(true);
    expect(w.placeBlocker(10, 10, BUILDING_BEACH_PARK)).toBe('noWater');
    const cmd = new PlaceBuildingCommand(10, 10, BUILDING_BEACH_PARK);
    expect(new CommandHistory(w).run(cmd)).toBe(false);
    expect(cmd.failReason).toBe('noWater');
    w.layers.terrain[w.grid.idx(11, 12)] = TERRAIN_WATER;   // below its south side
    expect(w.canPlaceBuilding(10, 10, BUILDING_BEACH_PARK)).toBe(true);
    // Turned a quarter, it stands 2 wide and 3 deep: x 19–20, y 20–22.
    expect(w.canPlaceBuilding(20, 20, BUILDING_BEACH_PARK, 1)).toBe(false);
    w.layers.terrain[w.grid.idx(21, 21)] = TERRAIN_WATER;
    expect(w.canPlaceBuilding(20, 20, BUILDING_BEACH_PARK, 1)).toBe(true);
  });

  it('parks repeat; the museum and the stadium are one per city', () => {
    const w = rich(60, 1e6);
    const h = new CommandHistory(w);
    expect(h.run(new PlaceBuildingCommand(2, 2, BUILDING_BIG_PARK))).toBe(true);
    expect(h.run(new PlaceBuildingCommand(8, 2, BUILDING_BIG_PARK))).toBe(true);
    expect(h.run(new PlaceBuildingCommand(14, 2, BUILDING_PLAZA))).toBe(true);
    expect(h.run(new PlaceBuildingCommand(18, 2, BUILDING_PLAZA))).toBe(true);
    for (const kind of [BUILDING_MUSEUM, BUILDING_STADIUM]) {
      expect(h.run(new PlaceBuildingCommand(2, kind === BUILDING_MUSEUM ? 20 : 30, kind))).toBe(true);
      const again = new PlaceBuildingCommand(40, 40, kind);
      expect(h.run(again)).toBe(false);
      expect(again.failReason).toBe('alreadyBuilt');
    }
  });

  it('a multi-tile leisure building does not stand on a road', () => {
    const w = rich();
    w.setRoad(11, 11, ROAD_STREET);
    expect(w.canPlaceBuilding(10, 10, BUILDING_PLAZA)).toBe(false);
    expect(w.canPlaceBuilding(12, 10, BUILDING_PLAZA)).toBe(true);
  });

  it('a locked kind is refused until the city has had enough residents, and stays unlocked after', () => {
    const w = rich();
    const need = unlockPopulation(BUILDING_MUSEUM);
    expect(need).toBeGreaterThan(0);
    expect(unlockPopulation(BUILDING_BIG_PARK)).toBe(0);
    expect(buildingUnlocked(w, BUILDING_BIG_PARK)).toBe(true);
    expect(buildingUnlocked(w, BUILDING_MUSEUM)).toBe(false);
    const h = new CommandHistory(w);
    const early = new PlaceBuildingCommand(10, 10, BUILDING_MUSEUM);
    const money = w.budget.money;
    expect(h.run(early)).toBe(false);
    expect(early.failReason).toBe('locked');
    expect(w.budget.money).toBe(money);
    w.stats.population = need;
    expect(buildingUnlocked(w, BUILDING_MUSEUM)).toBe(true);
    // The population falls again, but the city was credited for it once.
    w.stats.population = 0;
    w.politics.peakPopulation = need;
    expect(buildingUnlocked(w, BUILDING_MUSEUM)).toBe(true);
    expect(h.run(new PlaceBuildingCommand(10, 10, BUILDING_MUSEUM))).toBe(true);
  });
});

describe('what a big project costs', () => {
  it('unique buildings cost political capital as well as money; parks cost none', () => {
    expect(bigProjectPc(BUILDING_MUSEUM)).toBeGreaterThan(0);
    expect(bigProjectPc(BUILDING_STADIUM)).toBeGreaterThan(bigProjectPc(BUILDING_MUSEUM));
    for (const k of leisureKinds('parks')) expect(bigProjectPc(k)).toBe(0);
    const w = rich(40, 1e6);
    const q = pcQuote(w, { type: 'building', tx: 10, ty: 10, kind: BUILDING_MUSEUM });
    expect(q.cost).toBe(bigProjectPc(BUILDING_MUSEUM));
    expect(q.parts.map(p => p.reason)).toEqual(['bigProject']);
    expect(pcQuote(w, { type: 'building', tx: 10, ty: 10, kind: BUILDING_BIG_PARK }).cost).toBe(0);
  });

  it('the stadium is affordable in political capital by a city just big enough to unlock it', () => {
    const pc = BALANCE.politicalCapital;
    expect(bigProjectPc(BUILDING_STADIUM)).toBeLessThanOrEqual(pc.max + pc.capPerResident * unlockPopulation(BUILDING_STADIUM));
    expect(bigProjectPc(BUILDING_MUSEUM)).toBeLessThanOrEqual(pc.max + pc.capPerResident * unlockPopulation(BUILDING_MUSEUM));
  });

  it('building charges the money and the PC; undo gives both back; too little PC refuses', () => {
    const w = rich(40, 1e6);
    const h = new CommandHistory(w);
    const money = w.budget.money, pc = w.budget.politicalCapital;
    expect(h.run(new PlaceBuildingCommand(10, 10, BUILDING_MUSEUM))).toBe(true);
    expect(w.budget.money).toBe(money - BALANCE.buildings[BUILDING_MUSEUM].cost);
    expect(w.budget.politicalCapital).toBeCloseTo(pc - bigProjectPc(BUILDING_MUSEUM));
    h.undo();
    expect(w.budget.money).toBe(money);
    expect(w.budget.politicalCapital).toBeCloseTo(pc);
    expect(w.buildings.length).toBe(0);

    w.budget.politicalCapital = bigProjectPc(BUILDING_MUSEUM) - 1;
    const poor = new PlaceBuildingCommand(10, 10, BUILDING_MUSEUM);
    expect(h.run(poor)).toBe(false);
    expect(poor.failReason).toBe('politicalCapital');
    expect(w.budget.money).toBe(money);
  });

  it('bulldozing a unique building does not give the PC back, and it can then be built again', () => {
    const w = rich(40, 1e6);
    const h = new CommandHistory(w);
    h.run(new PlaceBuildingCommand(10, 10, BUILDING_MUSEUM));
    const pc = w.budget.politicalCapital;
    expect(h.run(new BulldozeCommand(11, 11))).toBe(true);
    expect(w.buildings.length).toBe(0);
    expect(w.budget.politicalCapital).toBeLessThanOrEqual(pc);
    expect(w.canPlaceBuilding(20, 20, BUILDING_MUSEUM)).toBe(true);
  });
});

describe('leisure and land value', () => {
  const at = (w: World, x: number, y: number) => w.layers.landValue[w.grid.idx(x, y)];
  // Land value eases toward its target in whole steps and stops within 2 of it.
  const about = (got: number, want: number) => expect(Math.abs(got - want)).toBeLessThanOrEqual(2);
  /** A street with a home, and (if given) a leisure building at (20, 20); land value run until it settles. */
  function settled(kind?: number): World {
    const w = landWorld(48);
    for (let x = 8; x <= 14; x++) w.setRoad(x, 11, ROAD_STREET);
    home(w, 10, 10);
    if (kind !== undefined) expect(w.placeBuilding(20, 20, kind)).toBe(true);
    const sys = new LandValueSystem();
    for (let k = 1; k <= 60; k++) { w.tick = k * BALANCE.growth.tickInterval; sys.update(w); }
    return w;
  }

  it('a plaza lifts the land round it: most beside it, less further off, nothing past its radius', () => {
    const { bonus, radius } = rows[BUILDING_PLAZA].landValue;
    const bare = settled(), plaza = settled(BUILDING_PLAZA);   // the plaza covers 20–21, 20–21
    const lift = (x: number, y: number) => at(plaza, x, y) - at(bare, x, y);
    about(lift(22, 20), bonus);                                  // touching it
    about(lift(19, 19), bonus);                                  // touching its corner
    expect(lift(23, 20)).toBeLessThan(lift(22, 20));
    expect(lift(23, 20)).toBeGreaterThan(lift(24, 20));
    expect(lift(21 + radius, 20)).toBeGreaterThan(0);
    expect(lift(21 + radius + 1, 20)).toBe(0);
    expect(lift(20, 20 - radius - 1)).toBe(0);
  });

  it('the plaza lifts most, the stadium only a little, and the small park not at all this way', () => {
    expect(rows[BUILDING_PLAZA].landValue.bonus).toBeGreaterThan(rows[BUILDING_BIG_PARK].landValue.bonus);
    expect(rows[BUILDING_STADIUM].landValue.bonus).toBeLessThan(rows[BUILDING_MUSEUM].landValue.bonus);
    expect(rows[BUILDING_PARK].landValue.bonus).toBe(0);
    const bare = settled(), stadium = settled(BUILDING_STADIUM);   // bowl 20–23, 20–23; plaza tiles (21, 24), (22, 24)
    about(at(stadium, 24, 21) - at(bare, 24, 21), rows[BUILDING_STADIUM].landValue.bonus);
    // Distance is to the nearest tile of an odd shape: (20, 25) touches the entrance plaza's corner, (19, 25) does not.
    const acc = new Float64Array(48 * 48);
    addLeisureLandValue(stadium, acc, 0, 0, 47, 47);
    expect(acc[25 * 48 + 20]).toBe(rows[BUILDING_STADIUM].landValue.bonus);
    expect(acc[25 * 48 + 19]).toBeLessThan(rows[BUILDING_STADIUM].landValue.bonus);
    expect(acc[24 * 48 + 21]).toBe(0);                             // its own tile
  });

  it('with every bonus at 0, leisure buildings change no land value', () => {
    for (const k in rows) rows[k].landValue.bonus = 0;
    expect(leisureLandValueReach()).toBe(0);
    // Compare away from the building's own tiles and the ring a developed building would touch: nothing differs anywhere.
    const bare = settled(), plaza = settled(BUILDING_PLAZA);
    expect(Array.from(plaza.layers.landValue)).toEqual(Array.from(bare.layers.landValue));
  });
});

describe('leisure and merged lots', () => {
  it('big parks and beach parks count as a park for the prime spot; the plaza, museum and stadium do not', () => {
    expect([BUILDING_PARK, BUILDING_BIG_PARK, BUILDING_BEACH_PARK].every(countsAsPark)).toBe(true);
    expect([BUILDING_PLAZA, BUILDING_MUSEUM, BUILDING_STADIUM, BUILDING_POLICE, 0].some(countsAsPark)).toBe(false);
  });
});

describe('leisure buildings and saving', () => {
  it('a city with leisure buildings saves and loads as it was', () => {
    const w = rich(48, 1e6);
    w.layers.terrain[w.grid.idx(31, 11)] = TERRAIN_WATER;
    const h = new CommandHistory(w);
    expect(h.run(new PlaceBuildingCommand(4, 4, BUILDING_BIG_PARK))).toBe(true);
    expect(h.run(new PlaceBuildingCommand(30, 10, BUILDING_BEACH_PARK, 1))).toBe(true);
    expect(h.run(new PlaceBuildingCommand(10, 20, BUILDING_STADIUM))).toBe(true);
    w.setZone(2, 2, ZONE_R);
    const back = deserialize(serialize(w));
    expect(back.buildings).toEqual(w.buildings);
    expect(Array.from(back.layers.building)).toEqual(Array.from(w.layers.building));
    const stadium = footprintTiles(48, 48, 10, 20, BUILDING_STADIUM)!;
    for (const i of stadium) expect(back.buildingAt(i % 48, Math.floor(i / 48))?.kind).toBe(BUILDING_STADIUM);
    expect(back.canPlaceBuilding(30, 30, BUILDING_STADIUM)).toBe(false);   // still one per city
  });
});

describe('the beach of a beach park (for drawing)', () => {
  it('is the free sand and shore tiles near it', () => {
    const w = rich();
    for (let x = 8; x <= 14; x++) for (const y of [12, 13]) w.layers.terrain[w.grid.idx(x, y)] = TERRAIN_WATER;   // water south of it
    w.layers.terrain[w.grid.idx(8, 10)] = 2;                                             // a sand tile to the west
    w.setRoad(14, 11, ROAD_STREET);                                                      // a road on the shore: not beach
    expect(w.placeBuilding(10, 10, BUILDING_BEACH_PARK)).toBe(true);                     // x 10–12, y 10–11
    const beach = beachTilesNear(w, w.buildings[0]).map(i => `${i % 40},${Math.floor(i / 40)}`);
    expect(beach.sort()).toEqual(['13,11', '8,10', '8,11', '9,11'].sort());
  });
});
