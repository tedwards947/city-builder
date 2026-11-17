// Review cut-outs of the big-building candidates.
//   node art/clay-set/big-review.mjs
// raw-big/*.png (1024px, magenta background) → big-review/*.png (512px RGBA).
// For the review page only (bigplants.html); the game pipeline is cutout.mjs.
// No dependencies: macOS `sips` converts to BMP, which is trivial to read.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const RAW = join(here, 'raw-big'), OUT = join(here, 'big-review');
mkdirSync(OUT, { recursive: true });

function readBmp(path) {
  const b = readFileSync(path);
  const off = b.readUInt32LE(10), w = b.readInt32LE(18), hRaw = b.readInt32LE(22), bytes = b.readUInt16LE(28) / 8;
  const h = Math.abs(hRaw), stride = Math.ceil((w * bytes) / 4) * 4, rgb = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    const src = off + (hRaw > 0 ? h - 1 - y : y) * stride;
    for (let x = 0; x < w; x++) { const s = src + x * bytes, d = (y * w + x) * 3; rgb[d] = b[s + 2]; rgb[d + 1] = b[s + 1]; rgb[d + 2] = b[s]; }
  }
  return { w, h, rgb };
}

function png(w, h, rgba) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]), out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const head = Buffer.alloc(13); head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head[8] = 8; head[9] = 6;
  const rows = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(rows, y * (w * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// How much of a pixel is background: magenta, including the darker magenta of a cast shadow.
const magenta = (r, g, b) => (r > 105 && b > 105 && g < Math.min(r, b) * 0.55 && Math.abs(r - b) < 110 ? 1 : 0);

for (const f of readdirSync(RAW).filter(n => n.endsWith('.png'))) {
  const bmp = join(tmpdir(), 'big-review.bmp');
  execFileSync('sips', ['-s', 'format', 'bmp', join(RAW, f), '--out', bmp], { stdio: 'ignore' });
  const { w, h, rgb } = readBmp(bmp);
  rmSync(bmp);
  const W = w >> 1, H = h >> 1, out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const s = ((y * 2 + dy) * w + x * 2 + dx) * 3, keep = 1 - magenta(rgb[s], rgb[s + 1], rgb[s + 2]);
      r += rgb[s] * keep; g += rgb[s + 1] * keep; b += rgb[s + 2] * keep; a += keep;
    }
    const d = (y * W + x) * 4;
    if (a > 0) { out[d] = r / a; out[d + 1] = g / a; out[d + 2] = b / a; out[d + 3] = a * 63.75; }
  }
  writeFileSync(join(OUT, f), png(W, H, out));
  console.log(f);
}
