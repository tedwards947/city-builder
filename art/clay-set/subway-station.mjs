// Bakes the subway station's surface picture (owner's A1: the brick station house) from raw-rail/subway-stations.png
// into public/sprites/clay/rail/subway-station.png at 128 px a tile: the house cut from its painted lot, shrunk to
// SCALE and set at the back of a tile of the same painted paving, leaving the front for props (drawn in code, rail.ts).
// Usage: node art/clay-set/subway-station.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const SCALE = 0.68;                         // the house's size against the sheet's lot (owner: "reduce the scale a bit")
const HOUSE = [136, 34, 418, 290];          // the house and its shadow on the sheet: x0, y0, x1, y1
const STRIP = [126, 292, 416, 328];         // a band of plain paving below it
const T = 300, HEAD = 60, OUT_T = 128;      // work at 300 px a tile with headroom above, then shrink to the game's 128
const AT = [26, 228];                       // where the house's crop sits on the tile: left, and its bottom (from the tile's top)

const tmp = join(tmpdir(), `subway-${process.pid}.bmp`);
execFileSync('sips', ['-s', 'format', 'bmp', join(here, 'raw-rail/subway-stations.png'), '--out', tmp], { stdio: 'ignore' });
const b = readFileSync(tmp); rmSync(tmp);
const off = b.readUInt32LE(10), sw = b.readInt32LE(18), hr = b.readInt32LE(22), by = b.readUInt16LE(28) / 8, sh = Math.abs(hr), st = Math.ceil(sw * by / 4) * 4;
const src = (x, y) => { const s = off + (hr > 0 ? sh - 1 - y : y) * st + x * by; return [b[s + 2], b[s + 1], b[s]]; };

// Area-average a region of the sheet to w × h, with an alpha ramp of `feather` output px round its edges.
function region([x0, y0, x1, y1], w, h, feather) {
  const out = new Float32Array(w * h * 4), kx = (x1 - x0) / w, ky = (y1 - y0) / h;
  for (let Y = 0; Y < h; Y++) for (let X = 0; X < w; X++) {
    let r = 0, g = 0, bl = 0, al = 0, n = 0;
    for (let y = Math.floor(y0 + Y * ky); y < Math.ceil(y0 + (Y + 1) * ky); y++) for (let x = Math.floor(x0 + X * kx); x < Math.ceil(x0 + (X + 1) * kx); x++) {
      // The sheet's magenta background (and its fringe) keyed out, as port-sheet.mjs does.
      const p = src(x, y), m = Math.max(0, Math.min(p[0], p[2]) - p[1]), a = m > 12 ? Math.max(0, 1 - m / 140) : 1;
      r += Math.max(0, p[0] - (m > 12 ? m : 0)) * a; g += p[1] * a; bl += Math.max(0, p[2] - (m > 12 ? m : 0)) * a; al += a; n++;
    }
    const e = Math.min(X + 0.5, Y + 0.5, w - X - 0.5, h - Y - 0.5), f = feather ? Math.min(1, e / feather) : 1;
    out.set(al ? [r / al, g / al, bl / al, f * al / n] : [0, 0, 0, 0], (Y * w + X) * 4);
  }
  return out;
}
const W = T, H = HEAD + T, img = new Float32Array(W * H * 4);
// Paving: the strip repeated down the tile.
const sH = STRIP[3] - STRIP[1], strip = region(STRIP, T, sH, 0);
for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) img.set(strip.subarray(((y % sH) * T + x) * 4, ((y % sH) * T + x) * 4 + 4), ((HEAD + y) * W + x) * 4);
// The house, shrunk and feathered into the paving.
const hw = Math.round((HOUSE[2] - HOUSE[0]) * SCALE), hh = Math.round((HOUSE[3] - HOUSE[1]) * SCALE), house = region(HOUSE, hw, hh, 6);
const hx = AT[0], hy = HEAD + AT[1] - hh;
for (let y = 0; y < hh; y++) for (let x = 0; x < hw; x++) {
  const s = (y * hw + x) * 4, d = ((hy + y) * W + hx + x) * 4, a = house[s + 3], under = img[d + 3];
  for (let c = 0; c < 3; c++) img[d + c] = house[s + c] * a + img[d + c] * (1 - a) * (under ? 1 : 0) + (under ? 0 : house[s + c] * (1 - a));
  img[d + 3] = under ? 1 : a;
}
// Shrink to the game's scale.
const k = OUT_T / T, OW = Math.round(W * k), OH = Math.round(H * k), px = new Uint8Array(OW * OH * 4);
for (let Y = 0; Y < OH; Y++) for (let X = 0; X < OW; X++) {
  let r = 0, g = 0, bl = 0, a = 0, n = 0;
  for (let y = Math.floor(Y / k); y < Math.min(H, Math.ceil((Y + 1) / k)); y++) for (let x = Math.floor(X / k); x < Math.min(W, Math.ceil((X + 1) / k)); x++) {
    const s = (y * W + x) * 4, al = img[s + 3]; r += img[s] * al; g += img[s + 1] * al; bl += img[s + 2] * al; a += al; n++;
  }
  px.set(a ? [r / a, g / a, bl / a, 255 * a / n] : [0, 0, 0, 0], (Y * OW + X) * 4);
}
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = buf => { let c = -1; for (const x of buf) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
const raw = Buffer.alloc((OW * 4 + 1) * OH);
for (let y = 0; y < OH; y++) Buffer.from(px.buffer, y * OW * 4, OW * 4).copy(raw, y * (OW * 4 + 1) + 1);
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(OW); ihdr.writeUInt32BE(OH, 4); ihdr[8] = 8; ihdr[9] = 6;
writeFileSync(join(here, '../../public/sprites/clay/rail/subway-station.png'), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(`subway-station.png ${OW}×${OH}, tile from y ${Math.round(HEAD * k)}`);
