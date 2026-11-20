import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../sim/World';
import { CommandHistory } from '../commands/CommandHistory';
import { BuildRoadCommand } from '../commands/BuildRoadCommand';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { ROAD_STREET, ROAD_HIGHWAY, TERRAIN_WATER, BUILDING_FIRE, BUILDING_PARK } from '../sim/constants';
import type { CutOffBuilding } from '../sim/roadCutoff';

/** Top-left of the first dry 3×2 block. */
function dryBlock(w: World): { x: number; y: number } {
  for (let y = 1; y + 2 < w.grid.height; y++) for (let x = 1; x + 3 < w.grid.width; x++) {
    let ok = true;
    for (let dy = 0; dy < 2 && ok; dy++) for (let dx = 0; dx < 3 && ok; dx++) if (w.getTerrain(x + dx, y + dy) === TERRAIN_WATER) ok = false;
    if (ok) return { x, y };
  }
  throw new Error('no dry block');
}

describe('road cut-off warning', () => {
  let w: World, h: CommandHistory, at: { x: number; y: number }, lost: CutOffBuilding[][];

  // A street of three tiles with a fire station below its middle tile, its only road.
  beforeEach(() => {
    w = new World(32, 32, 3, { vegAmount: 'low' });
    w.budget.money = 1e9;
    h = new CommandHistory(w);
    at = dryBlock(w);
    for (let dx = 0; dx < 3; dx++) expect(h.run(new BuildRoadCommand(at.x + dx, at.y, ROAD_STREET))).toBe(true);
    expect(h.run(new PlaceBuildingCommand(at.x + 1, at.y + 1, BUILDING_FIRE))).toBe(true);
    lost = [];
    w.events.on('roadLost', (p) => lost.push(p.buildings as CutOffBuilding[]));
  });

  it('warns when a bulldoze stroke takes the last road, and shows it during the stroke', () => {
    h.beginBatch();
    h.run(new BulldozeCommand(at.x, at.y));
    expect(h.cuttingOff).toHaveLength(0);          // the middle tile still reaches it
    h.run(new BulldozeCommand(at.x + 1, at.y));
    expect(h.cuttingOff.map((b) => b.kind)).toEqual([BUILDING_FIRE]);
    expect(lost).toHaveLength(0);                   // no toast until the stroke ends
    h.endBatch();
    expect(lost).toHaveLength(1);
    expect(lost[0][0]).toMatchObject({ kind: BUILDING_FIRE, x0: at.x + 1, y0: at.y + 1 });
    expect(h.cuttingOff).toHaveLength(0);
  });

  it('warns when the road becomes a highway, and undo brings it back without another warning', () => {
    expect(h.run(new BuildRoadCommand(at.x + 1, at.y, ROAD_HIGHWAY))).toBe(true);
    expect(lost).toHaveLength(1);
    h.undo();
    expect(w.buildingAccessRoads(at.x + 1, at.y + 1).length).toBeGreaterThan(0);
    expect(lost).toHaveLength(1);
  });

  it('says nothing when the building itself is bulldozed, or a cancelled stroke', () => {
    h.run(new BulldozeCommand(at.x + 1, at.y + 1));
    h.beginBatch();
    h.run(new BulldozeCommand(at.x + 1, at.y));
    h.cancelBatch();
    expect(lost).toHaveLength(0);
  });

  it('leaves parks out', () => {
    h.run(new BulldozeCommand(at.x + 1, at.y + 1));
    expect(h.run(new PlaceBuildingCommand(at.x + 1, at.y + 1, BUILDING_PARK))).toBe(true);
    h.run(new BulldozeCommand(at.x + 1, at.y));
    expect(lost).toHaveLength(0);
  });
});
