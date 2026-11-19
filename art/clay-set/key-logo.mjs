// Cut a logo off its plain white background: node art/clay-set/key-logo.mjs logo-1 [reach]
// raw-logo/<name>.png → sprites/logo/<name>.png (gitignored, like the other sprites).
// Background = near-white pixels joined to the border. Where the white darkens into a soft
// shadow it is kept as a translucent black, so the shadow still falls on whatever is behind.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const name = process.argv[2] || 'logo-1';
const REACH = +(process.argv[3] || 60);   // how far from white the flood may go (colour distance)
const OUT = join(here, 'sprites', 'logo');
mkdirSync(OUT, { recursive: true });

const tmp = join(tmpdir(), `logo-${process.pid}.bmp`);
execFileSync('sips', ['-s', 'format', 'bmp', join(here, 'raw-logo', name + '.png'), '--out', tmp], { stdio: 'ignore' });
const b = readFileSync(tmp); rmSync(tmp);
const off = b.readUInt32LE(10), w = b.readInt32LE(18), hRaw = b.readInt32LE(22), bytes = b.readUInt16LE(28) / 8;
const h = Math.abs(hRaw), stride = Math.ceil((w * bytes) / 4) * 4, n = w * h;
const rgb = new Uint8Array(n * 3);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const s = off + (hRaw > 0 ? h - 1 - y : y) * stride + x * bytes, d = (y * w + x) * 3;
  rgb[d] = b[s + 2]; rgb[d + 1] = b[s + 1]; rgb[d + 2] = b[s];
}

// The background's own colour: the median of the border.
const med = c => { const v = []; for (let x = 0; x < w; x++) v.push(rgb[x * 3 + c], rgb[((h - 1) * w + x) * 3 + c]); v.sort((p, q) => p - q); return v[v.length >> 1]; };
const W0 = [med(0), med(1), med(2)];
const dist = i => Math.hypot(rgb[i * 3] - W0[0], rgb[i * 3 + 1] - W0[1], rgb[i * 3 + 2] - W0[2]);

const bg = new Uint8Array(n), stack = [];
const push = i => { if (!bg[i] && dist(i) < REACH) { bg[i] = 1; stack.push(i); } };
for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
while (stack.length) {
  const i = stack.pop(), x = i % w, y = (i / w) | 0;
  if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w);
}

// Crop to what is left (plus a margin for the shadow) and write RGBA.
let x0 = w, y0 = h, x1 = 0, y1 = 0;
for (let i = 0; i < n; i++) if (!bg[i] || dist(i) > REACH * 0.5) { const x = i % w, y = (i / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
const M = 8; x0 = Math.max(0, x0 - M); y0 = Math.max(0, y0 - M); x1 = Math.min(w - 1, x1 + M); y1 = Math.min(h - 1, y1 + M);
const W = x1 - x0 + 1, H = y1 - y0 + 1, px = new Uint8Array(W * H * 4);
for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
  const i = y * w + x, d = ((y - y0) * W + (x - x0)) * 4;
  if (bg[i]) {
    // Shadow: black at the darkness the white had been pulled down to.
    const lum = (rgb[i * 3] + rgb[i * 3 + 1] + rgb[i * 3 + 2]) / 3, w0 = (W0[0] + W0[1] + W0[2]) / 3;
    px[d + 3] = Math.max(0, Math.min(255, (w0 - lum) * 3.2));
  } else {
    px[d] = rgb[i * 3]; px[d + 1] = rgb[i * 3 + 1]; px[d + 2] = rgb[i * 3 + 2]; px[d + 3] = 255;
  }
}

function chunk(type, data) {
  const t = Buffer.from(type), len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  let c = ~0; for (const v of Buffer.concat([t, data])) { c ^= v; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
  const crc = Buffer.alloc(4); crc.writeUInt32BE(~c >>> 0);
  return Buffer.concat([len, t, data, crc]);
}
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) Buffer.from(px.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1);
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
writeFileSync(join(OUT, name + '.png'), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(`${name}: ${W}×${H}, background ${W0.join(',')}`);
