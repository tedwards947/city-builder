// Cuts the generated tree sheets into single trees for the review page.
//   node art/clay-set/landscaping/trees.mjs
// raw/trees-*.png (clay trees on magenta, 4 x 4 grid, one species per row)
//   → trees/<species>-<1..4>.png  cut-out trees, half size
//   → trees/manifest.js           window.TREES = { name: { w, h } }
//   → ../../../public/sprites/clay/trees.png + src/render/clay/wildTreeData.ts
//     the trees the owner kept (GAME_TREES), quarter size, packed into one image
// No dependencies; the cut-out helpers are copied from build.mjs.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, 'trees');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

/** Species per sheet row, top to bottom (null = row not used). */
export const SHEETS = {
  'trees-1': [null, null, 'pine', 'spruce'], // its oak and birch rows were rejected (too cartoonish)
  'trees-3': ['oak', 'birch', 'maple', 'willow'],
  'trees-4': ['poplar', 'cypress', 'beech', 'larch'],
};

const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf) { let c = -1; for (const x of buf) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function writePng(path, { w, h, rgba }) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  writeFileSync(path, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}
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
const mag = (r, g, b) => Math.max(0, Math.min(r, b) - g);
function cutout({ w, h, rgb }) {
  const n = w * h, m = new Uint8Array(n);
  for (let i = 0; i < n; i++) m[i] = mag(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
  const BG = 110, bg = new Uint8Array(n), stack = [];
  const push = (i) => { if (!bg[i] && m[i] >= BG) { bg[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  const flood = () => { while (stack.length) { const i = stack.pop(), x = i % w; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (i >= w) push(i - w); if (i < n - w) push(i + w); } };
  flood();
  for (let i = 0; i < n; i++) if (!bg[i] && m[i] >= 185) { bg[i] = 1; stack.push(i); }
  flood();
  const rgba = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    let r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2], a = 255;
    if (bg[i]) a = 0;
    else {
      const x = i % w; let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, j = i + dy * w + dx; if (xx >= 0 && xx < w && j >= 0 && j < n && bg[j]) { near = true; break; } }
      if (near && m[i] > 12) { a = Math.round(255 * (1 - Math.min(1, m[i] / BG))); r -= m[i]; b -= m[i]; }
    }
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = a;
  }
  return { w, h, rgba };
}
function cropDown({ w, rgba }, x0, y0, x1, y1, k) {
  const W = Math.ceil((x1 - x0 + 1) / k), H = Math.ceil((y1 - y0 + 1) / k), out = new Uint8Array(W * H * 4);
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) {
      const sx = x0 + X * k + dx, sy = y0 + Y * k + dy; if (sx > x1 || sy > y1) continue;
      const s = (sy * w + sx) * 4, al = rgba[s + 3]; r += rgba[s] * al; g += rgba[s + 1] * al; b += rgba[s + 2] * al; a += al;
    }
    const d = (Y * W + X) * 4;
    if (a > 0) { out[d] = r / a; out[d + 1] = g / a; out[d + 2] = b / a; }
    out[d + 3] = a / (k * k);
  }
  return { w: W, h: H, rgba: out };
}

/**
 * The trees the game uses, per species. The owner reviewed all 40: these were
 * kept (beech-4 and larch-1/3/4 were left unmarked and are included to give
 * those species more than a couple of shapes); oak, birch, maple, willow and
 * poplar-2/4 were rejected.
 */
const GAME_TREES = {
  beech: [1, 2, 3, 4], larch: [1, 2, 3, 4], pine: [1, 2, 3, 4], spruce: [1, 2, 3, 4], poplar: [1, 3], cypress: [1, 2, 3, 4],
};
const game = {}; // name → { w, h, rgba }
/**
 * Game-only colour correction, per species: [saturation, red, green, blue].
 * The larch came out a loud yellow-green next to the darker trees.
 */
const MUTE = { larch: [0.6, 0.8, 0.92, 0.95] };
function mute(rgba, [sat, kr, kg, kb]) {
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2], l = 0.3 * r + 0.59 * g + 0.11 * b;
    rgba[i] = (l + (r - l) * sat) * kr; rgba[i + 1] = (l + (g - l) * sat) * kg; rgba[i + 2] = (l + (b - l) * sat) * kb;
  }
}

const TREES = {};
const tmp = join(tmpdir(), `trees-${process.pid}.bmp`);
for (const [sheet, rows] of Object.entries(SHEETS)) {
  const src = join(here, 'raw', sheet + '.png');
  if (!existsSync(src)) { console.log('missing', sheet); continue; }
  execFileSync('sips', ['-s', 'format', 'bmp', src, '--out', tmp], { stdio: 'ignore' });
  const cut = cutout(readBmp(tmp));
  const { w, h, rgba } = cut, cw = w / 4, chh = h / 4;
  // Bounding box of each connected blob, merged into the grid cell its centre falls in.
  const seen = new Uint8Array(w * h), boxes = new Array(16).fill(null);
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || rgba[s * 4 + 3] < 128) continue;
    const st = [s]; seen[s] = 1; let x0 = w, y0 = h, x1 = 0, y1 = 0, n = 0, sx = 0, sy = 0;
    while (st.length) {
      const i = st.pop(), x = i % w, y = (i / w) | 0; n++; sx += x; sy += y;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const j of [i - 1, i + 1, i - w, i + w]) if (j >= 0 && j < w * h && !seen[j] && rgba[j * 4 + 3] >= 128) { seen[j] = 1; st.push(j); }
    }
    if (n < 40) continue;
    const c = Math.min(3, Math.floor(sy / n / chh)) * 4 + Math.min(3, Math.floor(sx / n / cw)), b = boxes[c];
    boxes[c] = b ? [Math.min(b[0], x0), Math.min(b[1], y0), Math.max(b[2], x1), Math.max(b[3], y1)] : [x0, y0, x1, y1];
  }
  rows.forEach((species, row) => {
    if (!species) return;
    for (let col = 0; col < 4; col++) {
      const b = boxes[row * 4 + col], name = `${species}-${col + 1}`;
      if (!b) { console.log('empty cell', name); continue; }
      const img = cropDown(cut, Math.max(0, b[0] - 2), Math.max(0, b[1] - 2), Math.min(w - 1, b[2] + 2), Math.min(h - 1, b[3] + 2), 2);
      writePng(join(OUT, name + '.png'), img);
      TREES[name] = { w: img.w, h: img.h };
      if (GAME_TREES[species]?.includes(col + 1)) game[name] = cropDown(cut, Math.max(0, b[0] - 2), Math.max(0, b[1] - 2), Math.min(w - 1, b[2] + 2), Math.min(h - 1, b[3] + 2), 4);
      if (game[name] && MUTE[species]) mute(game[name].rgba, MUTE[species]);
    }
  });
}
rmSync(tmp, { force: true });
writeFileSync(join(OUT, 'manifest.js'), '// Generated by art/clay-set/landscaping/trees.mjs. Do not edit by hand.\nwindow.TREES = ' + JSON.stringify(TREES) + ';\n');
console.log(Object.keys(TREES).length, 'trees');

// ── Game atlas: the kept trees side by side, bottoms aligned ────────────────
const names = Object.entries(GAME_TREES).flatMap(([sp, ks]) => ks.map((k) => `${sp}-${k}`)).filter((n) => game[n]);
const atlasH = Math.max(...names.map((n) => game[n].h)), atlasW = names.reduce((a, n) => a + game[n].w + 1, 1);
const atlas = new Uint8Array(atlasW * atlasH * 4), rects = {};
let ax = 1;
for (const n of names) {
  const g = game[n], ay = atlasH - g.h, sp = n.split('-')[0];
  for (let y = 0; y < g.h; y++) atlas.set(g.rgba.subarray(y * g.w * 4, (y + 1) * g.w * 4), ((ay + y) * atlasW + ax) * 4);
  (rects[sp] ??= []).push([ax, ay, g.w, g.h]);
  ax += g.w + 1;
}
writePng(join(here, '../../../public/sprites/clay/trees.png'), { w: atlasW, h: atlasH, rgba: atlas });
writeFileSync(join(here, '../../../src/render/clay/wildTreeData.ts'),
  '// Generated by art/clay-set/landscaping/trees.mjs. Do not edit by hand.\n' +
  '/** Where each wild tree sits in public/sprites/clay/trees.png: [x, y, w, h]. */\n' +
  'export const WILD_TREE_RECTS: Record<string, readonly (readonly [number, number, number, number])[]> = {\n' +
  Object.entries(rects).map(([sp, rs]) => `  ${sp}: ${JSON.stringify(rs)},\n`).join('') + '};\n' +
  `/** Height of the tallest tree in the image. */\nexport const WILD_TREE_MAX_HEIGHT = ${atlasH};\n`);
console.log(names.length, 'game trees →', atlasW + 'x' + atlasH, 'atlas');
