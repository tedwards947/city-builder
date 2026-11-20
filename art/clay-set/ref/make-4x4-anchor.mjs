// Builds the 4×4 anchor (stadium) from the 3×3 anchor by repeating its middle
// row and column, then scaling to 1024 so the plot keeps the same width and the
// houses shrink to 4×4 tile scale. Camera and plot edge stay identical.
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

const t = join(tmpdir(), 'anchor-3x3.bmp');
execFileSync('sips', ['-s', 'format', 'bmp', join(here, 'anchor-3x3.png'), '--out', t], { stdio: 'ignore' });
const src = readBmp(t);
const px = (x, y) => src.rgb.subarray((y * src.w + x) * 3, (y * src.w + x) * 3 + 3);

function compose(rows, cols, W, H) {
  const ys = rows.flatMap(([a, b]) => Array.from({ length: b - a }, (_, k) => a + k));
  const xs = cols.flatMap(([a, b]) => Array.from({ length: b - a }, (_, k) => a + k));
  const rgb = new Uint8Array(W * H * 3);
  for (let i = 0; i < W * H; i++) { rgb[i * 3] = 255; rgb[i * 3 + 1] = 0; rgb[i * 3 + 2] = 255; }
  const ox = Math.round((W - xs.length) / 2), oy = H - ys.length;
  ys.forEach((sy, j) => xs.forEach((sx, k) => rgb.set(px(sx, sy), ((oy + j) * W + ox + k) * 3)));
  return { w: W, h: H, rgb };
}

// The 3×3 plot: x 100–911, back edge y 146; tile seams at x ≈ 371, 642 and y ≈ 415, 630.
const big = compose([[0, 415], [415, 630], [415, 630], [630, src.h]], [[0, 371], [371, 642], [371, 642], [642, src.w]], 1295, 1295);
const out = join(here, 'anchor-4x4.png');
writePng(out, big);
execFileSync('sips', ['-z', '1024', '1024', out], { stdio: 'ignore' });
console.log('wrote anchor-4x4.png');
