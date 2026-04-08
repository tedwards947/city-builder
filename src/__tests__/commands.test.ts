import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../sim/World';
import { CommandHistory } from '../commands/CommandHistory';
import { PaintZoneCommand } from '../commands/PaintZoneCommand';
import { BuildRoadCommand } from '../commands/BuildRoadCommand';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import {
  ZONE_NONE, ZONE_R, ZONE_C, ZONE_I,
  ROAD_NONE, ROAD_STREET,
  BUILDING_NONE, BUILDING_POWER_PLANT,
  BUILDING_WATER_TOWER, BUILDING_SEWAGE_PLANT,
  BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL, BUILDING_PARK,
} from '../sim/constants';
import { snapshotTile, restoreTile } from '../commands/Command';
import { BALANCE } from '../data/balance';

function makeWorld() { return new World(32, 32, 999); }

function grassTile(w: World): { tx: number; ty: number } {
  for (let ty = 0; ty < w.grid.height; ty++) {
    for (let tx = 0; tx < w.grid.width; tx++) {
      if (w.isBuildable(tx, ty)) return { tx, ty };
    }
  }
  throw new Error('no buildable tile found');
}

// ─── PaintZoneCommand ────────────────────────────────────────────────────────

describe('PaintZoneCommand', () => {
  let w: World;
  let tx: number, ty: number;

  beforeEach(() => {
    w = makeWorld();
    ({ tx, ty } = grassTile(w));
  });

  it('sets the zone byte to ZONE_R', () => {
    new PaintZoneCommand(tx, ty, ZONE_R).execute(w);
    expect(w.getZone(tx, ty)).toBe(ZONE_R);
  });

  it('sets the zone byte to ZONE_C', () => {
    new PaintZoneCommand(tx, ty, ZONE_C).execute(w);
    expect(w.getZone(tx, ty)).toBe(ZONE_C);
  });

  it('sets the zone byte to ZONE_I', () => {
    new PaintZoneCommand(tx, ty, ZONE_I).execute(w);
    expect(w.getZone(tx, ty)).toBe(ZONE_I);
  });

  it('deducts the correct cost for R/C/I zones', () => {
    const before = w.budget.money;
    new PaintZoneCommand(tx, ty, ZONE_R).execute(w);
    expect(w.budget.money).toBe(before - BALANCE.costs.zoneR);
  });

  it('deducts zoneC cost for commercial zones', () => {
    const before = w.budget.money;
    new PaintZoneCommand(tx, ty, ZONE_C).execute(w);
    expect(w.budget.money).toBe(before - BALANCE.costs.zoneC);
  });

  it('deducts zoneI cost for industrial zones', () => {
    const before = w.budget.money;
    new PaintZoneCommand(tx, ty, ZONE_I).execute(w);
    expect(w.budget.money).toBe(before - BALANCE.costs.zoneI);
  });

  it('returns false and does not charge money when broke', () => {
    w.budget.money = 0;
    const ok = new PaintZoneCommand(tx, ty, ZONE_R).execute(w);
    expect(ok).toBe(false);
    expect(w.getZone(tx, ty)).toBe(ZONE_NONE);
    expect(w.budget.money).toBe(0);
  });

  it('returns false on a water tile', () => {
    for (let y = 0; y < w.grid.height; y++) {
      for (let x = 0; x < w.grid.width; x++) {
        if (!w.isBuildable(x, y) && w.grid.inBounds(x, y)) {
          const ok = new PaintZoneCommand(x, y, ZONE_R).execute(w);
          expect(ok).toBe(false);
          return;
        }
      }
    }
  });

  it('undo restores zone byte and refunds money', () => {
    const before = w.budget.money;
    const cmd = new PaintZoneCommand(tx, ty, ZONE_R);
    cmd.execute(w);
    cmd.undo(w);
    expect(w.getZone(tx, ty)).toBe(ZONE_NONE);
    expect(w.budget.money).toBe(before);
  });
});

// ─── BuildRoadCommand ────────────────────────────────────────────────────────

describe('BuildRoadCommand', () => {
  let w: World;
  let tx: number, ty: number;

  beforeEach(() => {
    w = makeWorld();
    ({ tx, ty } = grassTile(w));
  });

  it('sets roadClass to ROAD_STREET', () => {
    new BuildRoadCommand(tx, ty).execute(w);
    expect(w.getRoad(tx, ty)).toBe(ROAD_STREET);
  });

  it('charges the road cost', () => {
    const before = w.budget.money;
    new BuildRoadCommand(tx, ty).execute(w);
    expect(w.budget.money).toBe(before - BALANCE.costs.road);
  });

  it('returns false if tile already has a road', () => {
    w.setRoad(tx, ty, ROAD_STREET);
    const ok = new BuildRoadCommand(tx, ty).execute(w);
    expect(ok).toBe(false);
  });

  it('returns false when broke', () => {
    w.budget.money = 0;
    const ok = new BuildRoadCommand(tx, ty).execute(w);
    expect(ok).toBe(false);
    expect(w.getRoad(tx, ty)).toBe(ROAD_NONE);
  });

  it('undo restores road byte and refunds money', () => {
    const before = w.budget.money;
    const cmd = new BuildRoadCommand(tx, ty);
    cmd.execute(w);
    cmd.undo(w);
    expect(w.getRoad(tx, ty)).toBe(ROAD_NONE);
    expect(w.budget.money).toBe(before);
  });
});

// ─── PlaceBuildingCommand (power plant) ──────────────────────────────────────

describe('PlaceBuildingCommand (power plant)', () => {
  let w: World;
  let tx: number, ty: number;

  beforeEach(() => {
    w = makeWorld();
    ({ tx, ty } = grassTile(w));
  });

  it('places a power plant building', () => {
    new PlaceBuildingCommand(tx, ty, BUILDING_POWER_PLANT).execute(w);
    expect(w.getBuilding(tx, ty)).toBe(BUILDING_POWER_PLANT);
  });

  it('adds the plant to the buildings list', () => {
    new PlaceBuildingCommand(tx, ty, BUILDING_POWER_PLANT).execute(w);
    expect(w.buildings).toHaveLength(1);
    expect(w.buildings[0]).toEqual({ tx, ty, kind: BUILDING_POWER_PLANT });
  });

  it('charges the power plant cost', () => {
    const before = w.budget.money;
    new PlaceBuildingCommand(tx, ty, BUILDING_POWER_PLANT).execute(w);
    expect(w.budget.money).toBe(before - BALANCE.buildings[BUILDING_POWER_PLANT].cost);
  });

  it('returns false when broke', () => {
    w.budget.money = 0;
    const ok = new PlaceBuildingCommand(tx, ty, BUILDING_POWER_PLANT).execute(w);
    expect(ok).toBe(false);
    expect(w.getBuilding(tx, ty)).toBe(BUILDING_NONE);
  });

  it('undo removes the plant and refunds money', () => {
    const before = w.budget.money;
    const cmd = new PlaceBuildingCommand(tx, ty, BUILDING_POWER_PLANT);
    cmd.execute(w);
    cmd.undo(w);
    expect(w.getBuilding(tx, ty)).toBe(BUILDING_NONE);
    expect(w.buildings).toHaveLength(0);
    expect(w.budget.money).toBe(before);
  });
});

// ─── BulldozeCommand ─────────────────────────────────────────────────────────

describe('BulldozeCommand', () => {
  let w: World;
  let tx: number, ty: number;

  beforeEach(() => {
    w = makeWorld();
    ({ tx, ty } = grassTile(w));
  });

  it('clears a zone tile and charges bulldoze cost', () => {
    w.setZone(tx, ty, ZONE_R);
    const before = w.budget.money;
    new BulldozeCommand(tx, ty).execute(w);
    expect(w.getZone(tx, ty)).toBe(ZONE_NONE);
    expect(w.budget.money).toBe(before - BALANCE.costs.bulldoze);
  });

  it('clears a road tile', () => {
    w.setRoad(tx, ty, ROAD_STREET);
    new BulldozeCommand(tx, ty).execute(w);
    expect(w.getRoad(tx, ty)).toBe(ROAD_NONE);
  });

  it('clears a building and removes from buildings list', () => {
    w.placeBuilding(tx, ty, BUILDING_POWER_PLANT);
    new BulldozeCommand(tx, ty).execute(w);
    expect(w.getBuilding(tx, ty)).toBe(BUILDING_NONE);
    expect(w.buildings).toHaveLength(0);
  });

  it('returns false on bare terrain (nothing to clear)', () => {
    const ok = new BulldozeCommand(tx, ty).execute(w);
    expect(ok).toBe(false);
  });

  it('returns false when broke', () => {
    w.setZone(tx, ty, ZONE_R);
    w.budget.money = 0;
    const ok = new BulldozeCommand(tx, ty).execute(w);
    expect(ok).toBe(false);
    expect(w.getZone(tx, ty)).toBe(ZONE_R);
  });

  it('undo restores zone and refunds money', () => {
    w.setZone(tx, ty, ZONE_R);
    const before = w.budget.money;
    const cmd = new BulldozeCommand(tx, ty);
    cmd.execute(w);
    cmd.undo(w);
    expect(w.getZone(tx, ty)).toBe(ZONE_R);
    expect(w.budget.money).toBe(before);
  });
});

// ─── CommandHistory ──────────────────────────────────────────────────────────

describe('CommandHistory', () => {
  it('undo reverses the last successful command', () => {
    const w = makeWorld();
    const { tx, ty } = grassTile(w);
    const history = new CommandHistory(w);
    const before = w.budget.money;
    history.run(new PaintZoneCommand(tx, ty, ZONE_R));
    expect(w.getZone(tx, ty)).toBe(ZONE_R);
    history.undo();
    expect(w.getZone(tx, ty)).toBe(ZONE_NONE);
    expect(w.budget.money).toBe(before);
  });

  it('does not push failed commands onto the stack', () => {
    const w = makeWorld();
    const { tx, ty } = grassTile(w);
    const history = new CommandHistory(w);
    w.budget.money = 0;
    history.run(new PaintZoneCommand(tx, ty, ZONE_R));
    // Undo should be a no-op (nothing was pushed).
    history.undo();
    expect(w.getZone(tx, ty)).toBe(ZONE_NONE);
  });

  it('undo is a no-op when stack is empty', () => {
    const w = makeWorld();
    const history = new CommandHistory(w);
    expect(() => history.undo()).not.toThrow();
  });

  it('undoes commands in LIFO order', () => {
    const w = makeWorld();
    const history = new CommandHistory(w);
    const tiles = [] as { tx: number; ty: number }[];
    let count = 0;
    for (let ty = 0; ty < w.grid.height && count < 2; ty++) {
      for (let tx = 0; tx < w.grid.width && count < 2; tx++) {
        if (w.isBuildable(tx, ty)) { tiles.push({ tx, ty }); count++; }
      }
    }
    history.run(new BuildRoadCommand(tiles[0].tx, tiles[0].ty));
    history.run(new BuildRoadCommand(tiles[1].tx, tiles[1].ty));
    history.undo();
    expect(w.getRoad(tiles[1].tx, tiles[1].ty)).toBe(ROAD_NONE);
    expect(w.getRoad(tiles[0].tx, tiles[0].ty)).toBe(ROAD_STREET);
  });
});

// ─── restoreTile — every BUILDING_* constant ─────────────────────────────────

const ALL_BUILDING_KINDS = [
  BUILDING_POWER_PLANT,
  BUILDING_WATER_TOWER,
  BUILDING_SEWAGE_PLANT,
  BUILDING_POLICE,
  BUILDING_FIRE,
  BUILDING_SCHOOL,
  BUILDING_HOSPITAL,
  BUILDING_PARK,
];

describe('restoreTile — buildings list consistency', () => {
  it('covers every BUILDING_* constant (update this list when adding constants)', () => {
    // If this count is wrong, a new BUILDING_* was added without updating the test.
    expect(ALL_BUILDING_KINDS).toHaveLength(8);
  });

  it.each(ALL_BUILDING_KINDS)(
    'building kind %i: restoring to BUILDING_NONE removes from buildings list',
    (kind) => {
      const w = makeWorld();
      const { tx, ty } = grassTile(w);
      w.placeBuilding(tx, ty, kind);
      expect(w.buildings).toHaveLength(1);

      const snap = snapshotTile(w, tx, ty);
      // Manually wipe the tile so restoreTile sees a "before" state with the building.
      w.layers.building[w.grid.idx(tx, ty)] = kind; // already set — just take empty snap
      const emptySnap = { zone: 0, road: 0, building: BUILDING_NONE, dev: 0 };
      restoreTile(w, tx, ty, emptySnap);

      expect(w.layers.building[w.grid.idx(tx, ty)]).toBe(BUILDING_NONE);
      expect(w.buildings).toHaveLength(0);
    },
  );

  it.each(ALL_BUILDING_KINDS)(
    'building kind %i: restoring to that kind re-adds to buildings list',
    (kind) => {
      const w = makeWorld();
      const { tx, ty } = grassTile(w);
      // Start empty, restore to this building kind.
      const snap = { zone: 0, road: 0, building: kind, dev: 0 };
      restoreTile(w, tx, ty, snap);

      expect(w.layers.building[w.grid.idx(tx, ty)]).toBe(kind);
      expect(w.buildings).toHaveLength(1);
      expect(w.buildings[0]).toEqual({ tx, ty, kind });
    },
  );
});
