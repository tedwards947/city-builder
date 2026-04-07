import { describe, it, expect } from 'vitest';
import { Grid, CHUNK_SIZE } from '../sim/Grid';

describe('Grid', () => {
  it('idx returns ty*width+tx', () => {
    const g = new Grid(10, 10);
    expect(g.idx(0, 0)).toBe(0);
    expect(g.idx(1, 0)).toBe(1);
    expect(g.idx(0, 1)).toBe(10);
    expect(g.idx(3, 4)).toBe(43);
  });

  it('inBounds rejects negative and out-of-range coords', () => {
    const g = new Grid(5, 5);
    expect(g.inBounds(0, 0)).toBe(true);
    expect(g.inBounds(4, 4)).toBe(true);
    expect(g.inBounds(5, 0)).toBe(false);
    expect(g.inBounds(0, 5)).toBe(false);
    expect(g.inBounds(-1, 0)).toBe(false);
    expect(g.inBounds(0, -1)).toBe(false);
  });

  it('chunkIdOf groups tiles into CHUNK_SIZE×CHUNK_SIZE chunks', () => {
    const g = new Grid(32, 32);
    // All tiles in the top-left chunk share chunk id 0.
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        expect(g.chunkIdOf(x, y)).toBe(0);
      }
    }
    // First tile of second horizontal chunk.
    expect(g.chunkIdOf(CHUNK_SIZE, 0)).toBe(1);
    // First tile of second vertical chunk.
    expect(g.chunkIdOf(0, CHUNK_SIZE)).toBe(g.chunkCols);
  });

  it('markDirty / clearDirty round-trip', () => {
    const g = new Grid(32, 32);
    expect(g.dirtyChunks.size).toBe(0);
    g.markDirty(0, 0);
    expect(g.dirtyChunks.size).toBe(1);
    g.clearDirty();
    expect(g.dirtyChunks.size).toBe(0);
  });

  it('markAllDirty marks every chunk', () => {
    const g = new Grid(32, 32);
    g.markAllDirty();
    expect(g.dirtyChunks.size).toBe(g.chunkCols * g.chunkRows);
  });
});
