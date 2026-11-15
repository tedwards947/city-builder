// Cuts the magenta background out of the raw generated sprites.
//   node art/clay-set/cutout.mjs
// raw/*.png (JPEG or PNG data, 1024px, magenta background)
//   → sprites/*.png (256px RGBA) + sprites/manifest.json (plot rectangle per sprite)
//   → public/sprites/clay/*.png (128px, 256-colour palette PNG with alpha: what the game loads)
//     + src/render/clay/claySpriteData.ts (plot rectangle per game sprite)
// No dependencies: macOS `sips` converts to BMP, which is trivial to read.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const RAW = join(here, 'raw');
const OUT = join(here, 'sprites');
const SCALE = 4; // 1024 → 256
const GAME_OUT = join(here, "../../public/sprites/clay");
const GAME_DATA = join(here, "../../src/render/clay/claySpriteData.ts");
const GAME_SCALE = 8; // 1024 → 128
mkdirSync(OUT, { recursive: true });
mkdirSync(GAME_OUT, { recursive: true });
mkdirSync(dirname(GAME_DATA), { recursive: true });

function readBmp(path) {
  const b = readFileSync(path);
  const off = b.readUInt32LE(10), w = b.readInt32LE(18), hRaw = b.readInt32LE(22), bpp = b.readUInt16LE(28);
  const h = Math.abs(hRaw), bytes = bpp / 8, stride = Math.ceil((w * bytes) / 4) * 4;
  const rgb = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    const src = off + (hRaw > 0 ? h - 1 - y : y) * stride;
    for (let x = 0; x < w; x++) {
      const s = src + x * bytes, d = (y * w + x) * 3;
      rgb[d] = b[s + 2]; rgb[d + 1] = b[s + 1]; rgb[d + 2] = b[s];
    }
  }
  return { w, h, rgb };
}

// How magenta a pixel is: 0 for anything with as much green as red/blue, 255 for pure magenta.
const mag = (r, g, b) => Math.max(0, Math.min(r, b) - g);

function cutout({ w, h, rgb }) {
  const n = w * h;
  const m = new Uint8Array(n);
  for (let i = 0; i < n; i++) m[i] = mag(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);

  // Background = magenta pixels connected to the image border. Flood fill, so
  // pink or purple details inside a building are never touched.
  const BG = 110;
  const bg = new Uint8Array(n);
  const stack = [];
  const push = (i) => { if (!bg[i] && m[i] >= BG) { bg[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  const flood = () => {
    while (stack.length) {
      const i = stack.pop(), x = i % w;
      if (x > 0) push(i - 1);
      if (x < w - 1) push(i + 1);
      if (i >= w) push(i - w);
      if (i < n - w) push(i + w);
    }
  };
  flood();
  // Pockets of background enclosed by the building (e.g. between pipes) are not
  // connected to the border: seed them from near-pure magenta pixels.
  const PURE = 185;
  for (let i = 0; i < n; i++) if (!bg[i] && m[i] >= PURE) { bg[i] = 1; stack.push(i); }
  flood();

  const rgba = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    let r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2], a = 255;
    if (bg[i]) a = 0;
    else {
      // Edge pixels next to the background: fade by how magenta they are and
      // pull the magenta spill out of the colour.
      const x = i % w;
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx, j = i + dy * w + dx;
        if (xx >= 0 && xx < w && j >= 0 && j < n && bg[j]) { near = true; break; }
      }
      if (near && m[i] > 12) {
        a = Math.round(255 * (1 - Math.min(1, m[i] / BG)));
        r -= m[i]; b -= m[i];
      }
    }
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = a;
  }
  return { w, h, rgba };
}

// Box downscale with premultiplied alpha, so edges stay clean.
function downscale({ w, h, rgba }, k) {
  const W = Math.floor(w / k), H = Math.floor(h / k), out = new Uint8Array(W * H * 4);
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) {
      const s = ((Y * k + dy) * w + X * k + dx) * 4, al = rgba[s + 3];
      r += rgba[s] * al; g += rgba[s + 1] * al; b += rgba[s + 2] * al; a += al;
    }
    const d = (Y * W + X) * 4;
    if (a > 0) { out[d] = r / a; out[d + 1] = g / a; out[d + 2] = b / a; }
    out[d + 3] = a / (k * k);
  }
  return { w: W, h: H, rgba: out };
}

// The plot is the widest thing at the bottom of the sprite: find its bottom
// edge and its left/right extent a little above that.
function findPlot({ w, h, rgba }) {
  const rowSpan = (y) => {
    let l = -1, r = -1;
    for (let x = 0; x < w; x++) if (rgba[(y * w + x) * 4 + 3] > 128) { if (l < 0) l = x; r = x; }
    return [l, r];
  };
  let bottom = h - 1;
  while (bottom > 0 && rowSpan(bottom)[0] < 0) bottom--;
  const [l, r] = rowSpan(Math.max(0, bottom - Math.round(h * 0.06)));
  // Opaque pixels as a share of the frame, and whether anything touches the top edge.
  let opaque = 0;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] > 128) opaque++;
  return { left: l, right: r, bottom, coverage: +(opaque / (w * h)).toFixed(3), touchesTop: rowSpan(0)[0] >= 0 };
}

const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc32(buf) { let c = -1; for (const x of buf) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function writePng(path, { w, h, rgba }) {
  // Per row, try the five PNG filters and keep the one with the smallest
  // residuals: same pixels, noticeably smaller files than unfiltered rows.
  const s = w * 4, raw = Buffer.alloc((s + 1) * h), cand = Buffer.alloc(s);
  let prev = new Uint8Array(s);
  for (let y = 0; y < h; y++) {
    const row = rgba.subarray(y * s, (y + 1) * s);
    let bestSum = Infinity;
    for (let t = 0; t < 5; t++) {
      let sum = 0;
      for (let i = 0; i < s; i++) {
        const a = i >= 4 ? row[i - 4] : 0, b = prev[i], c = i >= 4 ? prev[i - 4] : 0;
        let p = 0;
        if (t === 1) p = a; else if (t === 2) p = b; else if (t === 3) p = (a + b) >> 1;
        else if (t === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
        const v = (row[i] - p) & 255;
        cand[i] = v; sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) { bestSum = sum; raw[y * (s + 1)] = t; cand.copy(raw, y * (s + 1) + 1); }
    }
    prev = row;
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  writeFileSync(path, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}

// ── Palette PNG (game sprites) ──────────────────────────────────────────────
// 256 RGBA colours per sprite: about half the bytes of truecolour, and at
// 128px the difference is not visible. Median cut, then a few k-means passes.
function quantize({ w, h, rgba }, maxColours = 255) {
  const n = w * h;
  const idx = [];
  for (let i = 0; i < n; i++) if (rgba[i * 4 + 3] > 0) idx.push(i);
  // Median cut over the opaque-ish pixels (index 0 is reserved for transparent).
  let boxes = [idx];
  const range = (box) => {
    let best = 0, bestC = 0;
    for (let c = 0; c < 4; c++) {
      let lo = 255, hi = 0;
      for (const i of box) { const v = rgba[i * 4 + c]; if (v < lo) lo = v; if (v > hi) hi = v; }
      // Alpha differences matter more at the edges than a colour step does.
      const r = (hi - lo) * (c === 3 ? 1.5 : 1);
      if (r > best) { best = r; bestC = c; }
    }
    return [best * Math.sqrt(box.length), bestC];
  };
  while (boxes.length < maxColours) {
    let pick = -1, score = 0, ch = 0;
    boxes.forEach((b, k) => { if (b.length < 2) return; const [s, c] = range(b); if (s > score) { score = s; pick = k; ch = c; } });
    if (pick < 0) break;
    const box = boxes[pick].sort((a, b) => rgba[a * 4 + ch] - rgba[b * 4 + ch]);
    const mid = box.length >> 1;
    boxes.splice(pick, 1, box.slice(0, mid), box.slice(mid));
  }
  let pal = boxes.map((box) => {
    const s = [0, 0, 0, 0];
    for (const i of box) for (let c = 0; c < 4; c++) s[c] += rgba[i * 4 + c];
    return s.map((v) => v / Math.max(1, box.length));
  });
  const out = new Uint8Array(n); // 0 = transparent
  const nearest = (i) => {
    let best = 0, bd = Infinity;
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2], a = rgba[i * 4 + 3];
    for (let k = 0; k < pal.length; k++) {
      const p = pal[k], d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2 + 2 * (p[3] - a) ** 2;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  };
  for (let pass = 0; pass < 4; pass++) {
    const sum = pal.map(() => [0, 0, 0, 0, 0]);
    for (const i of idx) { const k = nearest(i); out[i] = k + 1; const s = sum[k]; for (let c = 0; c < 4; c++) s[c] += rgba[i * 4 + c]; s[4]++; }
    if (pass < 3) pal = pal.map((p, k) => (sum[k][4] ? sum[k].slice(0, 4).map((v) => v / sum[k][4]) : p));
  }
  return { w, h, indices: out, palette: [[0, 0, 0, 0], ...pal.map((p) => p.map(Math.round))] };
}
function writePalettePng(path, img) {
  const { w, h, indices, palette } = quantize(img);
  const raw = Buffer.alloc((w + 1) * h); // filter 0: indexed rows compress best unfiltered
  for (let y = 0; y < h; y++) Buffer.from(indices.buffer, y * w, w).copy(raw, y * (w + 1) + 1);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 3;
  writeFileSync(path, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('PLTE', Buffer.from(palette.flatMap((p) => [p[0], p[1], p[2]]))),
    chunk('tRNS', Buffer.from(palette.map((p) => p[3]))),
    chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}

const manifest = {};
const gameManifest = {};
const tmp = join(tmpdir(), `clay-cutout-${process.pid}.bmp`);
for (const f of readdirSync(RAW).filter((f) => f.endsWith('.png')).sort()) {
  execFileSync('sips', ['-s', 'format', 'bmp', join(RAW, f), '--out', tmp], { stdio: 'ignore' });
  const cut = cutout(readBmp(tmp));
  const small = downscale(cut, SCALE);
  const game = downscale(cut, GAME_SCALE);
  writePalettePng(join(GAME_OUT, f), game);
  const gp = findPlot(game);
  gameManifest[f.replace(/\.png$/, "")] = { w: game.w, h: game.h, left: gp.left, right: gp.right, bottom: gp.bottom };
  writePng(join(OUT, f), small);
  manifest[f.replace(/\.png$/, '')] = { w: small.w, h: small.h, ...findPlot(small) };
}
rmSync(tmp, { force: true });
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
// Also as a script, so the review page works when opened straight from disk.
writeFileSync(join(OUT, 'manifest.js'), 'window.SPRITES = ' + JSON.stringify(manifest) + ';\n');
writeFileSync(GAME_DATA, `// Generated by art/clay-set/cutout.mjs. Do not edit by hand.
// Plot rectangle (in sprite pixels) for each clay sprite in public/sprites/clay.
export interface ClaySpriteMeta { w: number; h: number; left: number; right: number; bottom: number }
export const CLAY_SPRITE_DATA: Record<string, ClaySpriteMeta> = ${JSON.stringify(gameManifest, null, 2)};
`);
console.log(`${Object.keys(manifest).length} sprites → ${OUT} and ${GAME_OUT}`);
