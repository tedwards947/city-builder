import { describe, it, expect } from 'vitest';
import { planLot, dressingSeed, DRESSING_TONES, type DressingPlan } from '../render/clay/lotDressing';
import { analyseLot, PLAN_SPACE, type LotField, type LotZone } from '../render/clay/lotGround';

/**
 * A lot field like the real sprites': a 50 x 43 grid of 4-unit cells with a
 * building block, a front step and some shadow to its right.
 */
function makeField(zone: LotZone, level: number, bld: [number, number, number, number] = [12, 3, 37, 35]): LotField {
  const cols = 50, rows = 43, cell = 4;
  const grid = new Uint8Array(cols * rows).fill(1);
  for (let y = 0; y < rows; y++) { grid[y * cols] = 0; grid[y * cols + cols - 1] = 0; }
  for (let x = 0; x < cols; x++) grid[x] = 0;
  const [x0, y0, x1, y1] = bld;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) grid[y * cols + x] = 0;
  for (let y = y1 + 1; y <= y1 + 2; y++) for (let x = 21; x <= 28; x++) grid[y * cols + x] = 0; // front step
  for (let y = 20; y <= y1; y++) for (let x = x1 + 1; x <= Math.min(cols - 2, x1 + 6); x++) grid[y * cols + x] = 2; // shadow
  const run = (n: number, hidden?: [number, number]): string => Array.from({ length: n }, (_, i) => (hidden && i >= hidden[0] && i <= hidden[1] ? '0' : '1')).join('');
  return {
    zone, level, left: 26, right: 226, top: 38, front: 210, cols, rows, cell, grid,
    rim: { back: run(50, y0 <= 2 ? [x0, x1] : undefined), front: run(50), left: run(43), right: run(43) },
    bld: [x0, y0, x1, y1 + 2], door: { a: 21, b: 28, y: y1 + 2 },
  };
}

const cellAt = (f: LotField, x: number, y: number): number => {
  const cx = Math.floor((x - f.left) / f.cell), cy = Math.floor((y - f.top) / f.cell);
  return cx < 0 || cy < 0 || cx >= f.cols || cy >= f.rows ? 0 : f.grid[cy * f.cols + cx];
};
const count = (p: DressingPlan, k: string): number => p.props.filter((q) => q.k === k).length;
const edges = (p: DressingPlan): number => p.ground.filter((g) => g.k === 'edge').length;

const FIELDS: LotField[] = [
  makeField('res', 1), makeField('res', 2, [2, 2, 47, 36]), makeField('res', 3, [16, 1, 34, 39]),
  makeField('com', 1), makeField('com', 3, [16, 1, 34, 39]), makeField('ind', 1), makeField('ind', 3, [3, 2, 46, 38]),
];

describe('lot dressing', () => {
  it('is deterministic for a seed and varies between seeds', () => {
    const f = makeField('res', 1);
    expect(planLot(f, 1234)).toEqual(planLot(f, 1234));
    const kinds = new Set<string>();
    for (let s = 0; s < 60; s++) kinds.add(JSON.stringify(planLot(f, s)));
    expect(kinds.size).toBeGreaterThan(20);
    expect(dressingSeed('res-1', 2)).toBe(dressingSeed('res-1', 2));
    expect(dressingSeed('res-1', 2)).not.toBe(dressingSeed('res-1', 3));
    expect(dressingSeed('res-1', 2)).not.toBe(dressingSeed('res-2', 2));
  });

  it('never stands a prop on the building or outside the plot', () => {
    for (const f of FIELDS) for (let s = 0; s < 200; s++) {
      for (const p of planLot(f, s).props) {
        if (p.k === 'scrub') { for (let i = 0; i < p.blobs.length; i += 3) expect(cellAt(f, p.blobs[i], p.blobs[i + 1])).not.toBe(0); continue; }
        // a bed's and a car's y is its front edge; everything else stands on its base point
        const y = p.k === 'bed' || p.k === 'car' ? p.y - p.h / 2 : p.y;
        expect(cellAt(f, p.x, y), `${f.zone}-${f.level} seed ${s} ${p.k}`).not.toBe(0);
        if (p.k === 'bed' || p.k === 'car') { expect(cellAt(f, p.x - p.w / 2 + 1, y)).not.toBe(0); expect(cellAt(f, p.x + p.w / 2 - 1, y)).not.toBe(0); }
      }
    }
  });

  it('keeps to the restraint budget', () => {
    for (const f of FIELDS) {
      let bare = 0;
      for (let s = 0; s < 300; s++) {
        const p = planLot(f, s);
        expect(p.tone).toBeGreaterThanOrEqual(0);
        expect(p.tone).toBeLessThan(DRESSING_TONES);
        expect(edges(p)).toBeLessThanOrEqual(1);
        expect(count(p, 'tree')).toBeLessThanOrEqual(3);
        expect(count(p, 'car')).toBeLessThanOrEqual(2);
        // at most one small group of code-drawn props
        const groups = p.tags.filter((t) => ['flank', 'bed', 'corner', 'scrub'].includes(t)).length;
        expect(groups).toBeLessThanOrEqual(1);
        expect(count(p, 'bush') + count(p, 'planter')).toBeLessThanOrEqual(3);
        if (f.zone !== 'ind') expect(p.props.every((q) => q.k !== 'scrub')).toBe(true);
        if (f.zone === 'ind') expect(count(p, 'tree')).toBeLessThanOrEqual(1);
        if (f.zone === 'com' && f.level < 3) expect(count(p, 'tree')).toBeLessThanOrEqual(2);
        if (!p.tags.length) bare++;
      }
      // Towers always get a feature; other lots are left bare some of the time.
      if (f.level === 3 && f.zone !== 'ind') expect(bare).toBe(0);
      else { expect(bare).toBeGreaterThan(30); expect(bare).toBeLessThan(270); }
    }
  });

  it('only draws solid home and shop edges', () => {
    // A terrace hiding the middle of the back rim twice over (two gaps) must not get a back edge.
    const f = makeField('res', 1);
    f.rim.back = '1111111100001111110000111111111111111111111111111';
    f.rim.left = f.rim.left.slice(0, 10) + '000' + f.rim.left.slice(13);
    for (let s = 0; s < 300; s++) {
      for (const g of planLot(f, s).ground) {
        if (g.k !== 'edge') continue;
        expect(g.sides).not.toContain('back');
        expect(g.sides).not.toContain('left');
        expect(g.sides.includes('front')).toBe(g.gap !== null); // the front always has its gate
      }
    }
    // One clean stretch hidden behind a tower is fine.
    const tower = makeField('res', 3, [16, 1, 34, 39]);
    let back = 0;
    for (let s = 0; s < 300; s++) for (const g of planLot(tower, s).ground) if (g.k === 'edge' && g.sides.includes('back')) back++;
    expect(back).toBeGreaterThan(0);
  });

  it('gives run-down lots a tone and nothing else', () => {
    const p = planLot(makeField('res', 1), 7, true);
    expect(p.ground).toEqual([]);
    expect(p.props).toEqual([]);
  });
});

describe('lot ground analysis', () => {
  it('finds the free ground, the building and the rim of a sprite', () => {
    // 64px sprite: green plot from (6,10) to (57,56) plus a brown front lip, a red building in the middle.
    const w = 64, h = 64, px = new Uint8ClampedArray(w * h * 4);
    const set = (x: number, y: number, r: number, g: number, b: number): void => { const i = (y * w + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255; };
    for (let y = 10; y <= 53; y++) for (let x = 6; x <= 57; x++) set(x, y, 100, 170, 80);
    for (let y = 54; y <= 56; y++) for (let x = 6; x <= 57; x++) set(x, y, 110, 70, 40);
    for (let y = 4; y <= 40; y++) for (let x = 24; x <= 40; x++) set(x, y, 200, 60, 50);
    for (let y = 30; y <= 40; y++) for (let x = 41; x <= 48; x++) set(x, y, 60, 102, 48); // shadow
    const lot = analyseLot(px, w, h, { left: 6, right: 57, bottom: 56 }, 'res', 3);
    expect(lot).not.toBeNull();
    const f = lot!.field, S = PLAN_SPACE / w;
    expect(f.left).toBe(6 * S);
    expect(f.front).toBe(53 * S);
    expect(cellAt(f, 12 * S, 30 * S)).toBe(1);   // lawn
    expect(cellAt(f, 32 * S, 30 * S)).toBe(0);   // building
    expect(cellAt(f, 45 * S, 35 * S)).toBe(2);   // shadowed lawn
    expect(f.rim.left).not.toContain('0');
    expect(f.rim.back.slice(1, -1)).toMatch(/^1+0+1+$/); // hidden once, behind the building
    expect(f.door).not.toBeNull();
    expect(lot!.shade[35 * w + 45]).toBeGreaterThan(50);
    expect(lot!.alpha[30 * w + 32]).toBe(0);
    // and a plan made from it places things only on free cells
    for (let s = 0; s < 50; s++) for (const p of planLot(f, s).props) if (p.k === 'tree') expect(cellAt(f, p.x, p.y)).not.toBe(0);
  });
});
