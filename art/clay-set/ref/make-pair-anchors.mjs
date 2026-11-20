// Builds the shop-pair anchors from the 2×2 anchor by cutting out its middle,
// so the camera, plot edge and house scale stay identical:
// - anchor-2x1-wide.png: the front row (two tiles side by side), 3:4 canvas.
// - anchor-2x1-tall.png: the right column (two tiles front to back), 9:16 canvas.
// The plot sits at the bottom, with magenta above it for the building to rise into.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));

function readBmp(path) {
  const b = readFileSync(path);
  const off = b.readUInt32LE(10), w = b.readInt32LE(18), hRaw = b.readInt32LE(22), bpp = b.readUInt16LE(28);
  const h = Math.abs(hRaw), bytes = bpp / 8, stride = Math.ceil((w * bytes) / 4) * 4;
  const rgb = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    const src = off + (hRaw > 0 ? h - 1 - y : y) * stride;
    for (let x = 0; x < w; x++) { const s = src + x * bytes, d = (y * w + x) * 3; rgb[d] = b[s + 2]; rgb[d + 1] = b[s + 1]; rgb[d + 2] = b[s]; }
  }
  return { w, h, rgb };
}
function writePng(path, { w, h, rgb }) {
  const stride = Math.ceil((w * 3) / 4) * 4, size = 54 + stride * h, b = Buffer.alloc(size);
  b.write('BM', 0); b.writeUInt32LE(size, 2); b.writeUInt32LE(54, 10); b.writeUInt32LE(40, 14);
  b.writeInt32LE(w, 18); b.writeInt32LE(h, 22); b.writeUInt16LE(1, 26); b.writeUInt16LE(24, 28); b.writeUInt32LE(stride * h, 34);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = (y * w + x) * 3, d = 54 + (h - 1 - y) * stride + x * 3;
    b[d] = rgb[s + 2]; b[d + 1] = rgb[s + 1]; b[d + 2] = rgb[s];
  }
  const t = join(tmpdir(), 'pair-anchor.bmp');
  writeFileSync(t, b);
  execFileSync('sips', ['-s', 'format', 'png', t, '--out', path], { stdio: 'ignore' });
}

const t = join(tmpdir(), 'anchor-2x2.bmp');
execFileSync('sips', ['-s', 'format', 'bmp', join(here, 'anchor-2x2.png'), '--out', t], { stdio: 'ignore' });
const src = readBmp(t);
const px = (x, y) => src.rgb.subarray((y * src.w + x) * 3, (y * src.w + x) * 3 + 3);

/** Copies source rows/columns (lists of index ranges) into a W×H magenta canvas, bottom-centred. */
function compose(rows, cols, W, H) {
  const ys = rows.flatMap(([a, b]) => Array.from({ length: b - a }, (_, k) => a + k));
  const xs = cols.flatMap(([a, b]) => Array.from({ length: b - a }, (_, k) => a + k));
  const rgb = new Uint8Array(W * H * 3);
  for (let i = 0; i < W * H; i++) { rgb[i * 3] = 255; rgb[i * 3 + 1] = 0; rgb[i * 3 + 2] = 255; }
  const ox = Math.round((W - xs.length) / 2), oy = H - ys.length;
  ys.forEach((sy, j) => xs.forEach((sx, k) => rgb.set(px(sx, sy), ((oy + j) * W + ox + k) * 3)));
  return { w: W, h: H, rgb };
}

// The 2×2 plot: x 103–912, back edge y 148, the tile seams at x ≈ 507 and y ≈ 515.
const all = [[0, src.w]];
writePng(join(here, 'anchor-2x1-wide.png'), compose([[0, 165], [522, src.h]], all, 1024, 1365));
writePng(join(here, 'anchor-2x1-tall.png'), compose(all, [[0, 112], [514, src.w]], 1024, 1820));
console.log('wrote anchor-2x1-wide.png and anchor-2x1-tall.png');
