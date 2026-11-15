import { describe, it, expect } from 'vitest';
import { GROUND_TONES, findGroundMask, applyGroundTone } from '../render/clay/groundTones';

// A 40x40 sprite: green plot from (4,6) to (35,35), a darker green shadow
// patch, a red building in the middle and a green "wall" enclosed by it.
function makeSprite() {
  const w = 40, h = 40, px = new Uint8ClampedArray(w * h * 4);
  const set = (x: number, y: number, r: number, g: number, b: number) => {
    const i = (y * w + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
  };
  for (let y = 6; y <= 35; y++) for (let x = 4; x <= 35; x++) set(x, y, 100, 170, 80);
  for (let y = 20; y <= 26; y++) for (let x = 26; x <= 32; x++) set(x, y, 60, 102, 48); // shadow
  for (let y = 12; y <= 26; y++) for (let x = 12; x <= 25; x++) set(x, y, 200, 60, 50); // building
  const plot = { left: 4, right: 35, bottom: 35, top: 6 };
  return { w, h, px, plot };
}

describe('ground tones', () => {
  it('masks lawn and its shadow but not the building', () => {
    const { w, h, px, plot } = makeSprite();
    const mask = findGroundMask(px, w, h, plot);
    expect(mask[10 * w + 8]).toBe(1);   // lawn
    expect(mask[22 * w + 28]).toBe(1);  // shadow on lawn
    expect(mask[18 * w + 18]).toBe(0);  // building
    expect(mask[2 * w + 2]).toBe(0);    // outside the plot
  });

  it('leaves the front lip of the plot alone', () => {
    const { w, h, px, plot } = makeSprite();
    const mask = findGroundMask(px, w, h, plot);
    expect(mask[35 * w + 20]).toBe(0);
  });

  it('recolours only masked pixels', () => {
    const { w, h, px, plot } = makeSprite();
    const mask = findGroundMask(px, w, h, plot);
    const out = applyGroundTone(px, mask, [0.5, 1, 1]);
    const lawn = (10 * w + 8) * 4, building = (18 * w + 18) * 4;
    expect(out[lawn]).toBe(50);
    expect(out[lawn + 1]).toBe(170);
    expect(out[building]).toBe(200);
    expect(px[lawn]).toBe(100); // input untouched
  });

  it('gives every zone the same number of tones, starting with the painted one', () => {
    const n = GROUND_TONES.res.length;
    for (const tones of Object.values(GROUND_TONES)) {
      expect(tones.length).toBe(n);
      expect(tones[0]).toEqual([1, 1, 1]);
    }
  });
});
