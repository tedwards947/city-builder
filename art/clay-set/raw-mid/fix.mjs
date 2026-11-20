// Copies the mid-rise raws (raw-mid/*.png) into raw/, repairing two faults of
// the generated images first:
// - SHORT: the plot came back shorter, its back corners missing. They are filled
//   from the anchor the image was edited from (plain lawn or paving there).
// - GLASS: background magenta tinting the inside of a glass roof; it is pulled
//   towards a pale blue-grey.
// Then run `node art/clay-set/cutout.mjs`.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const RAW = join(here, '../raw');
const SHORT = new Set(['res-3-communal', 'res-3-wealthy', 'com-3', 'com-3-gritty']);
const GLASS = new Set(['com-3-j']);
const ANCHOR = { res: join(here, '../ref/anchor.png'), com: join(here, '../raw/com-1.png') };

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
function writeBmp(path, { w, h, rgb }) {
  const stride = Math.ceil((w * 3) / 4) * 4, size = 54 + stride * h, b = Buffer.alloc(size);
  b.write('BM', 0); b.writeUInt32LE(size, 2); b.writeUInt32LE(54, 10); b.writeUInt32LE(40, 14);
  b.writeInt32LE(w, 18); b.writeInt32LE(h, 22); b.writeUInt16LE(1, 26); b.writeUInt16LE(24, 28); b.writeUInt32LE(stride * h, 34);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = (y * w + x) * 3, d = 54 + (h - 1 - y) * stride + x * 3;
    b[d] = rgb[s + 2]; b[d + 1] = rgb[s + 1]; b[d + 2] = rgb[s];
  }
  writeFileSync(path, b);
}
const load = (png) => { const t = join(tmpdir(), 'fix-' + Math.random().toString(36).slice(2) + '.bmp'); execFileSync('sips', ['-s', 'format', 'bmp', png, '--out', t], { stdio: 'ignore' }); return readBmp(t); };
const mag = (rgb, i) => Math.max(0, Math.min(rgb[i * 3], rgb[i * 3 + 2]) - rgb[i * 3 + 1]);

/** Background: magenta connected to the border (as cutout.mjs finds it). */
function background({ w, h, rgb }) {
  const n = w * h, bg = new Uint8Array(n), stack = [];
  const push = (i) => { if (!bg[i] && mag(rgb, i) >= 110) { bg[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) { const i = stack.pop(), x = i % w; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (i >= w) push(i - w); if (i < n - w) push(i + w); }
  return bg;
}

for (const file of readdirSync(here).filter((f) => f.endsWith('.png'))) {
  const name = file.slice(0, -4), src = join(here, file), dst = join(RAW, file);
  if (!SHORT.has(name) && !GLASS.has(name)) { copyFileSync(src, dst); continue; }
  const img = load(src), { w, h, rgb } = img, bg = background(img);
  if (SHORT.has(name)) {
    const a = load(ANCHOR[name.startsWith('res') ? 'res' : 'com']);
    let filled = 0;
    for (let i = 0; i < w * h; i++) if (bg[i] && mag(a.rgb, i) < 60) { rgb[i * 3] = a.rgb[i * 3]; rgb[i * 3 + 1] = a.rgb[i * 3 + 1]; rgb[i * 3 + 2] = a.rgb[i * 3 + 2]; filled++; }
    console.log(name, 'plot filled', filled, 'px');
  }
  if (GLASS.has(name)) {
    let tinted = 0;
    for (let i = 0; i < w * h; i++) {
      const m = mag(rgb, i);
      if (bg[i] || m < 25) continue;
      rgb[i * 3] = Math.max(0, rgb[i * 3] - m * 0.95); rgb[i * 3 + 2] = Math.max(0, rgb[i * 3 + 2] - m * 0.55); tinted++;
    }
    console.log(name, 'glass untinted', tinted, 'px');
  }
  const t = join(tmpdir(), 'fix-out.bmp');
  writeBmp(t, img);
  execFileSync('sips', ['-s', 'format', 'png', t, '--out', dst], { stdio: 'ignore' });
}
console.log('copied to', RAW);
