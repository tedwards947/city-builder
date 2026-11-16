import { describe, it, expect } from 'vitest';
import { tileSetEdges, tileSetBounds } from '../render/clay/tileOutline';

const len = (e: { x0: number; y0: number; x1: number; y1: number }) => Math.abs(e.x1 - e.x0) + Math.abs(e.y1 - e.y0);

describe('tileSetEdges', () => {
  it('outlines one tile with four sides', () => {
    const e = tileSetEdges([{ x: 2, y: 3 }]);
    expect(e).toHaveLength(4);
    expect(e.reduce((s, x) => s + len(x), 0)).toBe(4);
  });
  it('joins a row into long sides and drops the shared ones', () => {
    const e = tileSetEdges([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]);
    expect(e).toHaveLength(4);
    expect(e).toContainEqual({ x0: 0, y0: 0, x1: 3, y1: 0 });
    expect(e).toContainEqual({ x0: 0, y0: 1, x1: 3, y1: 1 });
  });
  it('traces an L shape by its perimeter', () => {
    const e = tileSetEdges([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]);
    expect(e.reduce((s, x) => s + len(x), 0)).toBe(8);
    expect(e).toHaveLength(6);
  });
  it('outlines separate groups separately', () => {
    const e = tileSetEdges([{ x: 0, y: 0 }, { x: 2, y: 0 }]);
    expect(e).toHaveLength(8);
  });
  it('does not join the bottom of one tile to the top of its diagonal neighbour', () => {
    const e = tileSetEdges([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    expect(e).toHaveLength(8);
  });
  it('ignores a repeated tile and an empty set', () => {
    expect(tileSetEdges([{ x: 1, y: 1 }, { x: 1, y: 1 }])).toHaveLength(4);
    expect(tileSetEdges([])).toEqual([]);
  });
});

describe('tileSetBounds', () => {
  it('gives the inclusive rectangle', () => {
    expect(tileSetBounds([{ x: 4, y: 9 }, { x: 7, y: 2 }])).toEqual({ x0: 4, y0: 2, x1: 7, y1: 9 });
    expect(tileSetBounds([])).toBeNull();
  });
});

import { clusterTiles, seedTile } from '../render/clay/tileOutline';
import { layoutRequestBadges } from '../render/clay/requestBadges';

describe('cluster requests', () => {
  it('turns tile indices into tiles', () => {
    expect(clusterTiles({ homes: [0, 5, 12] }, 10)).toEqual([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 2, y: 1 }]);
    expect(seedTile({ seed: 23 }, 10)).toEqual({ x: 3, y: 2 });
  });
  it('gives null for a plain-area request', () => {
    expect(clusterTiles({}, 10)).toBeNull();
    expect(clusterTiles({ homes: [] }, 10)).toBeNull();
    expect(seedTile({}, 10)).toBeNull();
  });
  it('puts the badge on the asking home, not the middle of the box', () => {
    const base = { id: 1, kind: 'park', x0: 0, y0: 0, x1: 9, y1: 9, openedTick: 0, deadlineTick: 100 };
    const at = (tx: number, ty: number) => ({ x: tx * 10, y: ty * 10 });
    const plain = layoutRequestBadges([base as never], 0, at, 13, 10)[0];
    expect([plain.x, plain.y]).toEqual([50, 50]);
    const seeded = layoutRequestBadges([{ ...base, seed: 23 } as never], 0, at, 13, 10)[0];
    expect([seeded.x, seeded.y]).toEqual([35, 25]);
  });
});
