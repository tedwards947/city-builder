// No sprite sits proud of the ground (owner, again and again: "sitting proud of the ground", "set proud of
// the ground", "need to be sunken down"). A lot's slab shows a front lip, the clay's thickness; next to the
// 1×1 lots, whose lip is thin, a thick one makes a building look raised on a plinth. art/clay-set/cutout.mjs
// thins every lip (thinLip, LIP_PER_TILE 0.041 of a tile), but generated art keeps finding ways past it
// (a brown soil lip as bright as the grass slipped by on the waterworks). So every clay sprite's lip is
// measured here, by colour, from the PNG the game loads, and a thick one fails the build.

import { describe, it, expect } from 'vitest';
import { CLAY_SPRITE_DATA } from '../render/clay/claySpriteData';

/** Every clay sprite is cut at this many pixels a tile (cutout.mjs). */
const PX_PER_TILE = 101;
/** The thickest lip allowed, in tiles: the 1×1s' 0.041 and a little room (the sewage works', which the owner passed, is 0.06). */
const MAX_LIP = 0.065;

// The game's PNGs, inlined by Vite as data URLs (no file system: the type check has no Node types).
const PNGS = import.meta.glob('../../public/sprites/clay/**/*.png', { query: '?inline', import: 'default', eager: true }) as Record<string, string>;

/** Decodes the PNGs cutout.mjs writes (8-bit palette with tRNS, or RGB/RGBA), non-interlaced. */
async function readPng(file: string, url: string): Promise<{ w: number; h: number; rgba: Uint8Array }> {
  const bin = atob(url.slice(url.indexOf(',') + 1)), buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const u32 = (o: number) => ((buf[o] << 24) | (buf[o + 1] << 16) | (buf[o + 2] << 8) | buf[o + 3]) >>> 0;
  let pos = 8, w = 0, h = 0, type = 0, depth = 0;
  const palette: number[][] = [], idat: Uint8Array[] = [];
  let alpha: number[] = [];
  while (pos < buf.length) {
    const len = u32(pos), kind = String.fromCharCode(...buf.subarray(pos + 4, pos + 8)), data = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') { w = u32(pos + 8); h = u32(pos + 12); depth = data[8]; type = data[9]; }
    else if (kind === 'PLTE') for (let i = 0; i < data.length; i += 3) palette.push([data[i], data[i + 1], data[i + 2]]);
    else if (kind === 'tRNS') alpha = [...data];
    else if (kind === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  if (depth !== 8) throw new Error(`${file}: bit depth ${depth}`);
  const bpp = type === 3 ? 1 : type === 2 ? 3 : type === 6 ? 4 : 0;
  if (!bpp) throw new Error(`${file}: colour type ${type}`);
  const zipped = new Blob(idat as BlobPart[]).stream().pipeThrough(new DecompressionStream('deflate'));
  const raw = new Uint8Array(await new Response(zipped).arrayBuffer()), stride = w * bpp, px = new Uint8Array(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, row = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[row + x - bpp] : 0, b = y > 0 ? px[row - stride + x] : 0, c = x >= bpp && y > 0 ? px[row - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[row + x] = v & 255;
    }
  }
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    if (type === 3) { const p = palette[px[i]] ?? [0, 0, 0]; rgba.set([p[0], p[1], p[2], alpha[px[i]] ?? 255], i * 4); }
    else if (type === 2) rgba.set([px[i * 3], px[i * 3 + 1], px[i * 3 + 2], 255], i * 4);
    else rgba.set(px.subarray(i * 4, i * 4 + 4), i * 4);
  }
  return { w, h, rgba };
}

/** The front lip in pixels: in columns across the plot, the rows up from its bottom edge whose colour is far from the ground just behind; the median. */
export function lipPx(img: { w: number; h: number; rgba: Uint8Array }, left: number, right: number, bottom: number): number {
  const { w, rgba } = img, plotW = right - left + 1;
  const at = (x: number, y: number): number[] | null => { const d = (y * w + x) * 4; return rgba[d + 3] < 200 ? null : [rgba[d], rgba[d + 1], rgba[d + 2]]; };
  const tile = Math.min(plotW, PX_PER_TILE), out: number[] = [];
  for (let f = 0.04; f <= 0.96; f += 0.02) {
    const x = Math.round(left + plotW * f), cols: number[][] = [];
    // Look a fixed share of a tile up from the bottom (not of the whole plot: a big lot's ground behind its lip is as near as a 1×1's).
    for (let k = Math.round(tile * 0.12); k <= tile * 0.2; k++) { const c = at(x, bottom - k); if (c) cols.push(c); }
    if (cols.length < 3) continue;
    const med = [0, 1, 2].map(i => cols.map(c => c[i]).sort((a, b) => a - b)[cols.length >> 1]);
    const lum = (c: number[]) => (c[0] + c[1] + c[2]) / 3, gl = lum(med), green = med[1] > med[0] + 10;
    // Lip: far from the ground's colour and either darker than it (the slab's shaded face) or, on grass, earth-coloured
    // (a soil face can be as bright as the grass). Light paving or a path along the front is ground, not lip.
    const isLip = (c: number[] | null) => !c || (Math.hypot(c[0] - med[0], c[1] - med[1], c[2] - med[2]) > 24
      && (lum(c) < gl * 0.92 || (green && c[0] > c[1] + 12 && lum(c) < 150)));
    let k = 0;
    while (k < tile * 0.12 && isLip(at(x, bottom - k))) k++;
    if (k < tile * 0.12) out.push(k);
  }
  out.sort((a, b) => a - b);
  return out.length ? out[out.length >> 1] : 0;
}

describe('clay sprites sit flush with the ground', () => {
  it('every lip is thin (no more than MAX_LIP of a tile)', async () => {
    // The 1×1s are the measure the rest are held to (their lip is the thin one); bigger sprites are checked.
    const rows: { id: string; lip: number }[] = [];
    for (const [id, m] of Object.entries(CLAY_SPRITE_DATA)) {
      if (m.right - m.left + 1 <= PX_PER_TILE + 2) continue;
      const key = `../../public/sprites/clay/${id}.png`, url = PNGS[key];
      expect(url, key).toBeTruthy();
      const img = await readPng(key, url);
      rows.push({ id, lip: lipPx(img, m.left, m.right, m.bottom) / PX_PER_TILE });
    }
    expect(rows.length).toBeGreaterThan(50);
    const thick = rows.filter(r => r.lip > MAX_LIP).map(r => `${r.id} ${r.lip.toFixed(3)}`);
    expect(thick).toEqual([]);
  });
});
