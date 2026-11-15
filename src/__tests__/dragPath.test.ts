import { describe, it, expect } from 'vitest';
import { tilesBetween, dominantAxis, axisLockedLine } from '../input/dragPath';
import type { TilePos } from '../input/dragPath';

function isFourConnected(path: TilePos[]): boolean {
  for (let i = 1; i < path.length; i++) {
    const d = Math.abs(path[i].tx - path[i - 1].tx) + Math.abs(path[i].ty - path[i - 1].ty);
    if (d !== 1) return false;
  }
  return true;
}

describe('tilesBetween', () => {
  it('returns just the tile when start and end are the same', () => {
    expect(tilesBetween({ tx: 3, ty: 4 }, { tx: 3, ty: 4 })).toEqual([{ tx: 3, ty: 4 }]);
  });

  it('fills a horizontal and a vertical run inclusively', () => {
    expect(tilesBetween({ tx: 1, ty: 2 }, { tx: 4, ty: 2 }).map(t => t.tx)).toEqual([1, 2, 3, 4]);
    expect(tilesBetween({ tx: 5, ty: 6 }, { tx: 5, ty: 3 }).map(t => t.ty)).toEqual([6, 5, 4, 3]);
  });

  it('leaves no gaps and no diagonal jumps for any direction', () => {
    const origin = { tx: 10, ty: 10 };
    for (let dy = -9; dy <= 9; dy++) {
      for (let dx = -9; dx <= 9; dx++) {
        const end = { tx: origin.tx + dx, ty: origin.ty + dy };
        const path = tilesBetween(origin, end);
        expect(path[0]).toEqual(origin);
        expect(path[path.length - 1]).toEqual(end);
        expect(path.length).toBe(Math.abs(dx) + Math.abs(dy) + 1);
        expect(isFourConnected(path)).toBe(true);
      }
    }
  });

  it('stays close to the ideal line', () => {
    const a = { tx: 0, ty: 0 }, b = { tx: 20, ty: 7 };
    for (const t of tilesBetween(a, b)) {
      // Perpendicular distance from the a→b line, in tiles.
      const dist = Math.abs(b.ty * t.tx - b.tx * t.ty) / Math.hypot(b.tx, b.ty);
      expect(dist).toBeLessThanOrEqual(1);
    }
  });

  it('never repeats a tile', () => {
    const path = tilesBetween({ tx: 2, ty: 9 }, { tx: 13, ty: 1 });
    expect(new Set(path.map(t => `${t.tx},${t.ty}`)).size).toBe(path.length);
  });
});

describe('dominantAxis', () => {
  it('is null on the start tile', () => {
    expect(dominantAxis({ tx: 1, ty: 1 }, { tx: 1, ty: 1 })).toBeNull();
  });
  it('picks the axis with the larger movement, x on ties', () => {
    expect(dominantAxis({ tx: 0, ty: 0 }, { tx: 3, ty: 1 })).toBe('x');
    expect(dominantAxis({ tx: 0, ty: 0 }, { tx: -1, ty: 4 })).toBe('y');
    expect(dominantAxis({ tx: 0, ty: 0 }, { tx: 2, ty: -2 })).toBe('x');
  });
});

describe('axisLockedLine', () => {
  it('ignores off-axis movement', () => {
    const line = axisLockedLine({ tx: 5, ty: 5 }, { tx: 9, ty: 7 }, 'x');
    expect(line).toEqual([5, 6, 7, 8, 9].map(tx => ({ tx, ty: 5 })));
  });
  it('runs backwards from the start', () => {
    const line = axisLockedLine({ tx: 5, ty: 5 }, { tx: 2, ty: 3 }, 'y');
    expect(line).toEqual([{ tx: 5, ty: 5 }, { tx: 5, ty: 4 }, { tx: 5, ty: 3 }]);
  });
  it('is just the start tile when the pointer is level with it on the locked axis', () => {
    expect(axisLockedLine({ tx: 5, ty: 5 }, { tx: 5, ty: 9 }, 'x')).toEqual([{ tx: 5, ty: 5 }]);
  });
});
