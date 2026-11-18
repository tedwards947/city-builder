import './pcOffBaseline';
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
  TERRAIN_WATER,
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

function waterTile(w: World): { tx: number; ty: number } {
  for (let ty = 0; ty < w.grid.height; ty++) {
    for (let tx = 0; tx < w.grid.width; tx++) {
      if (w.getTerrain(tx, ty) === TERRAIN_WATER) return { tx, ty };
    }
  }
  throw new Error('no water tile found');
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

  it('returns false and changes nothing when the city is in debt (zoning is free, but not in the red)', () => {
    w.budget.money = -1;
    const ok = new PaintZoneCommand(tx, ty, ZONE_R).execute(w);
    expect(ok).toBe(false);
    expect(w.getZone(tx, ty)).toBe(ZONE_NONE);
    expect(w.budget.money).toBe(-1);
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

  it('allows building on water (bridge) and charges 3x cost', () => {
    const { tx: wx, ty: wy } = waterTile(w);
    const before = w.budget.money;
    const ok = new BuildRoadCommand(wx, wy, ROAD_STREET).execute(w);
    expect(ok).toBe(true);
    expect(w.getRoad(wx, wy)).toBe(ROAD_STREET);
    expect(w.budget.money).toBe(before - (BALANCE.roadClasses[ROAD_STREET].cost * BALANCE.costs.bridgeMultiplier));
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

  it('is allowed when broke, and still charges (demolition cuts upkeep in debt)', () => {
    w.setZone(tx, ty, ZONE_R);
    w.budget.money = -100;
    const ok = new BulldozeCommand(tx, ty).execute(w);
    expect(ok).toBe(true);
    expect(w.getZone(tx, ty)).toBe(ZONE_NONE);
    expect(w.budget.money).toBe(-100 - BALANCE.costs.bulldoze);
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

  it('charges PC when displacing residents', () => {
    const level = 3;
    const pop = BALANCE.growth.popPerLevel[level];
    const expectedPcCost = pop * BALANCE.politicalCapital.disruptionCosts.bulldozePerPop;
    
    w.setZone(tx, ty, ZONE_R);
    w.layers.devLevel[w.grid.idx(tx, ty)] = level;
    
    const pcBefore = w.budget.politicalCapital;
    new BulldozeCommand(tx, ty).execute(w);
    
    expect(w.budget.politicalCapital).toBeCloseTo(pcBefore - expectedPcCost);
  });

  it('rewards PC when clearing an abandoned building', () => {
    const level = 2;
    const expectedPcReward = level * BALANCE.politicalCapital.disruptionCosts.abandonedBuildingReward;
    
    w.setZone(tx, ty, ZONE_R);
    w.layers.devLevel[w.grid.idx(tx, ty)] = level;
    w.layers.abandoned[w.grid.idx(tx, ty)] = 1;
    
    w.budget.politicalCapital = 50;   // below the cap: the reward stops at the cap
    const pcBefore = w.budget.politicalCapital;
    new BulldozeCommand(tx, ty).execute(w);
    
    // Reward should be added, net change is negative pcCost (which means positive addition to PC)
    expect(w.budget.politicalCapital).toBeCloseTo(pcBefore + expectedPcReward);
  });

  it('does NOT charge PC when bulldozing an abandoned residential building', () => {
    w.setZone(tx, ty, ZONE_R);
    w.layers.devLevel[w.grid.idx(tx, ty)] = 2;
    w.layers.abandoned[w.grid.idx(tx, ty)] = 1;
    
    w.budget.politicalCapital = 50;   // below the cap: the reward stops at the cap
    const pcBefore = w.budget.politicalCapital;
    new BulldozeCommand(tx, ty).execute(w);
    
    // Should be GREATER than pcBefore because of the reward, and definitely not LESS.
    expect(w.budget.politicalCapital).toBeGreaterThan(pcBefore);
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

      expect(snapshotTile(w, tx, ty).building).toBe(kind);
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

// ─── Undo fidelity: abandoned / distress / vegetation / visual variant ───────

describe('snapshotTile / restoreTile — full tile state', () => {
  it('round-trips abandoned, distress, vegetation and visualVariant', () => {
    const w = makeWorld();
    const { tx, ty } = grassTile(w);
    const i = w.grid.idx(tx, ty);
    w.setZone(tx, ty, ZONE_C);
    w.layers.devLevel[i] = 2;
    w.layers.abandoned[i] = 1;
    w.layers.distress[i] = 17;
    w.layers.vegetation[i] = 3;
    w.layers.visualVariant[i] = 99;
    const snap = snapshotTile(w, tx, ty);
    w.clearTile(tx, ty);
    restoreTile(w, tx, ty, snap);
    expect(w.layers.abandoned[i]).toBe(1);
    expect(w.layers.distress[i]).toBe(17);
    expect(w.layers.vegetation[i]).toBe(3);
    expect(w.layers.visualVariant[i]).toBe(99);
    expect(w.layers.devLevel[i]).toBe(2);
  });
});

describe('abandoned tiles — no free revival or PC farming', () => {
  let w: World;
  let tx: number, ty: number, i: number;

  beforeEach(() => {
    w = makeWorld();
    ({ tx, ty } = grassTile(w));
    i = w.grid.idx(tx, ty);
    w.setZone(tx, ty, ZONE_R);
    w.layers.devLevel[i] = 3;
    w.layers.abandoned[i] = 1;
    w.layers.distress[i] = 20;
    w.budget.politicalCapital = 10;
  });

  it('bulldoze + undo restores the tile abandoned and takes the reward back', () => {
    const money = w.budget.money;
    const h = new CommandHistory(w);
    h.run(new BulldozeCommand(tx, ty));
    expect(w.budget.politicalCapital).toBeGreaterThan(10);
    h.undo();
    expect(w.layers.zone[i]).toBe(ZONE_R);
    expect(w.layers.devLevel[i]).toBe(3);
    expect(w.layers.abandoned[i]).toBe(1);
    expect(w.layers.distress[i]).toBe(20);
    expect(w.budget.politicalCapital).toBeCloseTo(10);
    expect(w.budget.money).toBe(money);
  });

  it('same-zone repaint clears the ruin and pays the reward exactly once', () => {
    const reward = 3 * BALANCE.politicalCapital.disruptionCosts.abandonedBuildingReward;
    expect(new PaintZoneCommand(tx, ty, ZONE_R).execute(w)).toBe(true);
    expect(w.layers.zone[i]).toBe(ZONE_R);
    expect(w.layers.devLevel[i]).toBe(0);
    expect(w.layers.abandoned[i]).toBe(0);
    expect(w.layers.distress[i]).toBe(0);
    expect(w.budget.politicalCapital).toBeCloseTo(10 + reward);

    const money = w.budget.money;
    expect(new PaintZoneCommand(tx, ty, ZONE_R).execute(w)).toBe(false);
    expect(w.budget.politicalCapital).toBeCloseTo(10 + reward);
    expect(w.budget.money).toBe(money);
  });

  it('repaint + undo restores the ruin and takes the reward back', () => {
    const cmd = new PaintZoneCommand(tx, ty, ZONE_C);
    cmd.execute(w);
    cmd.undo(w);
    expect(w.layers.zone[i]).toBe(ZONE_R);
    expect(w.layers.devLevel[i]).toBe(3);
    expect(w.layers.abandoned[i]).toBe(1);
    expect(w.budget.politicalCapital).toBeCloseTo(10);
  });

  it('building a road over a ruin clears the abandoned flag; undo restores it', () => {
    const cmd = new BuildRoadCommand(tx, ty, ROAD_STREET);
    expect(cmd.execute(w)).toBe(true);
    expect(w.layers.abandoned[i]).toBe(0);
    expect(w.layers.distress[i]).toBe(0);
    cmd.undo(w);
    expect(w.layers.abandoned[i]).toBe(1);
    expect(w.layers.zone[i]).toBe(ZONE_R);
  });

  it('placing a building over a ruin clears the abandoned flag', () => {
    expect(new PlaceBuildingCommand(tx, ty, BUILDING_PARK).execute(w)).toBe(true);
    expect(w.layers.abandoned[i]).toBe(0);
    expect(w.layers.distress[i]).toBe(0);
  });
});

describe('PaintZoneCommand — no-ops and roads', () => {
  it('repainting the same zone on a healthy tile returns false and is free', () => {
    const w = makeWorld();
    const { tx, ty } = grassTile(w);
    new PaintZoneCommand(tx, ty, ZONE_R).execute(w);
    w.layers.devLevel[w.grid.idx(tx, ty)] = 2;
    const money = w.budget.money;
    expect(new PaintZoneCommand(tx, ty, ZONE_R).execute(w)).toBe(false);
    expect(w.budget.money).toBe(money);
    expect(w.getDevLevel(tx, ty)).toBe(2);
  });

  it('refuses to paint over a road and leaves the road intact', () => {
    const w = makeWorld();
    const { tx, ty } = grassTile(w);
    new BuildRoadCommand(tx, ty, ROAD_STREET).execute(w);
    const money = w.budget.money;
    expect(new PaintZoneCommand(tx, ty, ZONE_C).execute(w)).toBe(false);
    expect(w.getRoad(tx, ty)).toBe(ROAD_STREET);
    expect(w.getZone(tx, ty)).toBe(ZONE_NONE);
    expect(w.budget.money).toBe(money);
  });
});

describe('displacement political capital — roads and buildings', () => {
  let w: World;
  let tx: number, ty: number, i: number;
  const cost = BALANCE.growth.popPerLevel[2] * BALANCE.politicalCapital.disruptionCosts.bulldozePerPop;

  beforeEach(() => {
    w = makeWorld();
    ({ tx, ty } = grassTile(w));
    i = w.grid.idx(tx, ty);
    w.setZone(tx, ty, ZONE_R);
    w.layers.devLevel[i] = 2;
  });

  for (const [name, make] of [
    ['PlaceBuildingCommand', (x: number, y: number) => new PlaceBuildingCommand(x, y, BUILDING_PARK)],
    ['BuildRoadCommand',     (x: number, y: number) => new BuildRoadCommand(x, y, ROAD_STREET)],
  ] as const) {
    it(`${name} charges the bulldoze displacement cost over populated residential`, () => {
      const pc = w.budget.politicalCapital;
      expect(make(tx, ty).execute(w)).toBe(true);
      expect(w.budget.politicalCapital).toBeCloseTo(pc - cost);
    });

    it(`${name} is blocked when political capital is insufficient`, () => {
      w.budget.politicalCapital = cost - 1;
      const money = w.budget.money;
      expect(make(tx, ty).execute(w)).toBe(false);
      expect(w.layers.zone[i]).toBe(ZONE_R);
      expect(w.layers.devLevel[i]).toBe(2);
      expect(w.layers.roadClass[i]).toBe(ROAD_NONE);
      expect(w.layers.building[i]).toBe(BUILDING_NONE);
      expect(w.budget.money).toBe(money);
      expect(w.budget.politicalCapital).toBe(cost - 1);
    });

    it(`${name} undo refunds the political capital and restores the home`, () => {
      const pc = w.budget.politicalCapital;
      const cmd = make(tx, ty);
      cmd.execute(w);
      cmd.undo(w);
      expect(w.budget.politicalCapital).toBeCloseTo(pc);
      expect(w.layers.zone[i]).toBe(ZONE_R);
      expect(w.layers.devLevel[i]).toBe(2);
    });

    it(`${name} is free of political cost on non-residential or empty tiles`, () => {
      w.setZone(tx, ty, ZONE_I);
      w.layers.devLevel[i] = 3;
      const pc = w.budget.politicalCapital;
      expect(make(tx, ty).execute(w)).toBe(true);
      expect(w.budget.politicalCapital).toBe(pc);
    });
  }
});
