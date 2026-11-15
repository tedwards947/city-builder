import { describe, it, expect } from 'vitest';
import { World } from '../sim/World';
import { CommandHistory } from '../commands/CommandHistory';
import { BatchCommand } from '../commands/BatchCommand';
import { PaintZoneCommand } from '../commands/PaintZoneCommand';
import { BuildRoadCommand } from '../commands/BuildRoadCommand';
import { ZONE_NONE, ZONE_R, ZONE_C, ROAD_NONE, ROAD_STREET, TERRAIN_WATER } from '../sim/constants';

/** First horizontal run of `len` dry, empty tiles. */
function dryRun(w: World, len: number): { tx: number; ty: number }[] {
  for (let ty = 0; ty < w.grid.height; ty++) {
    for (let tx = 0; tx + len <= w.grid.width; tx++) {
      let ok = true;
      for (let d = 0; d < len && ok; d++) {
        if (w.getTerrain(tx + d, ty) === TERRAIN_WATER) ok = false;
      }
      if (ok) return Array.from({ length: len }, (_, d) => ({ tx: tx + d, ty }));
    }
  }
  throw new Error('no dry run found');
}

describe('CommandHistory batching', () => {
  it('undoes a whole batch as one step and refunds it', () => {
    const w = new World(64, 64, 1);
    const tiles = dryRun(w, 5);
    const h = new CommandHistory(w);
    const before = w.budget.money;

    h.beginBatch();
    for (const t of tiles) h.run(new BuildRoadCommand(t.tx, t.ty, ROAD_STREET));
    h.endBatch();
    for (const t of tiles) expect(w.getRoad(t.tx, t.ty)).toBe(ROAD_STREET);
    expect(w.budget.money).toBeLessThan(before);

    h.undo();
    for (const t of tiles) expect(w.getRoad(t.tx, t.ty)).toBe(ROAD_NONE);
    expect(w.budget.money).toBe(before);
    expect(h.canUndo).toBe(false);
  });

  it('leaves earlier steps intact when a batch is undone', () => {
    const w = new World(64, 64, 1);
    const tiles = dryRun(w, 4);
    const h = new CommandHistory(w);
    h.run(new PaintZoneCommand(tiles[0].tx, tiles[0].ty, ZONE_R));
    h.beginBatch();
    for (const t of tiles.slice(1)) h.run(new PaintZoneCommand(t.tx, t.ty, ZONE_C));
    h.endBatch();

    h.undo();
    expect(w.getZone(tiles[0].tx, tiles[0].ty)).toBe(ZONE_R);
    for (const t of tiles.slice(1)) expect(w.getZone(t.tx, t.ty)).toBe(ZONE_NONE);
    h.undo();
    expect(w.getZone(tiles[0].tx, tiles[0].ty)).toBe(ZONE_NONE);
  });

  it('pushes nothing for an empty batch or a batch of only failed commands', () => {
    const w = new World(64, 64, 1);
    const [t] = dryRun(w, 1);
    const h = new CommandHistory(w);
    h.beginBatch();
    h.endBatch();
    expect(h.canUndo).toBe(false);

    w.budget.money = 0;
    h.beginBatch();
    expect(h.run(new PaintZoneCommand(t.tx, t.ty, ZONE_R))).toBe(false);
    h.endBatch();
    expect(h.canUndo).toBe(false);
  });

  it('cancelBatch reverts the batch and leaves no undo step', () => {
    const w = new World(64, 64, 1);
    const tiles = dryRun(w, 3);
    const h = new CommandHistory(w);
    const before = w.budget.money;
    h.beginBatch();
    for (const t of tiles) h.run(new BuildRoadCommand(t.tx, t.ty, ROAD_STREET));
    h.cancelBatch();
    for (const t of tiles) expect(w.getRoad(t.tx, t.ty)).toBe(ROAD_NONE);
    expect(w.budget.money).toBe(before);
    expect(h.canUndo).toBe(false);
    expect(h.isBatching).toBe(false);
  });

  it('undo during an open batch closes it first and undoes it whole', () => {
    const w = new World(64, 64, 1);
    const tiles = dryRun(w, 3);
    const h = new CommandHistory(w);
    h.beginBatch();
    for (const t of tiles) h.run(new BuildRoadCommand(t.tx, t.ty, ROAD_STREET));
    h.undo();
    for (const t of tiles) expect(w.getRoad(t.tx, t.ty)).toBe(ROAD_NONE);
    expect(h.isBatching).toBe(false);
  });

  it('BatchCommand undoes members in reverse order', () => {
    const w = new World(64, 64, 1);
    const [t] = dryRun(w, 1);
    // Two commands on the same tile: only reverse-order undo restores the original.
    const a = new PaintZoneCommand(t.tx, t.ty, ZONE_R);
    const b = new PaintZoneCommand(t.tx, t.ty, ZONE_C);
    const batch = new BatchCommand([a, b]);
    expect(batch.execute(w)).toBe(true);
    expect(w.getZone(t.tx, t.ty)).toBe(ZONE_C);
    batch.undo(w);
    expect(w.getZone(t.tx, t.ty)).toBe(ZONE_NONE);
  });
});

describe('CommandHistory redo', () => {
  it('redo re-applies an undone command, and undo reverts it again', () => {
    const w = new World(64, 64, 1);
    const [t] = dryRun(w, 1);
    const h = new CommandHistory(w);
    const before = w.budget.money;
    h.run(new PaintZoneCommand(t.tx, t.ty, ZONE_R));
    const after = w.budget.money;
    h.undo();
    expect(h.canRedo).toBe(true);
    h.redo();
    expect(w.getZone(t.tx, t.ty)).toBe(ZONE_R);
    expect(w.budget.money).toBe(after);
    expect(h.canRedo).toBe(false);
    h.undo();
    expect(w.getZone(t.tx, t.ty)).toBe(ZONE_NONE);
    expect(w.budget.money).toBe(before);
  });

  it('redo re-applies a whole batch', () => {
    const w = new World(64, 64, 1);
    const tiles = dryRun(w, 4);
    const h = new CommandHistory(w);
    h.beginBatch();
    for (const t of tiles) h.run(new BuildRoadCommand(t.tx, t.ty, ROAD_STREET));
    h.endBatch();
    h.undo();
    h.redo();
    for (const t of tiles) expect(w.getRoad(t.tx, t.ty)).toBe(ROAD_STREET);
    h.undo();
    for (const t of tiles) expect(w.getRoad(t.tx, t.ty)).toBe(ROAD_NONE);
  });

  it('a new command clears the redo stack', () => {
    const w = new World(64, 64, 1);
    const tiles = dryRun(w, 2);
    const h = new CommandHistory(w);
    h.run(new PaintZoneCommand(tiles[0].tx, tiles[0].ty, ZONE_R));
    h.undo();
    h.run(new PaintZoneCommand(tiles[1].tx, tiles[1].ty, ZONE_C));
    expect(h.canRedo).toBe(false);
    h.redo();
    expect(w.getZone(tiles[0].tx, tiles[0].ty)).toBe(ZONE_NONE);
  });

  it('redo is a no-op with nothing undone, and drops a step that no longer applies', () => {
    const w = new World(64, 64, 1);
    const [t] = dryRun(w, 1);
    const h = new CommandHistory(w);
    expect(() => h.redo()).not.toThrow();

    h.run(new PaintZoneCommand(t.tx, t.ty, ZONE_R));
    h.undo();
    w.budget.money = 0; // can no longer afford it
    h.redo();
    expect(w.getZone(t.tx, t.ty)).toBe(ZONE_NONE);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
  });
});
