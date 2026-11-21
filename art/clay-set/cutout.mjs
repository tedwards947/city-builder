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

// ── Big buildings (several tiles) ───────────────────────────────────────────
// The owner's picks from raw-big/ (see bigplants.html). The plot covers n×n
// tiles, so the game sprite is n×128px. Game output only.
const BIG = [
  { src: 'power-brutalist', id: 'power-large', n: 3 },
  { src: 'pump-modern', id: 'pump-large', n: 2 },
  { src: 'sewage-brutalist', id: 'sewage-large', n: 2 },
];
/** The game draws a plot this tall for its width (PLOT_ASPECT in ClaySprites.ts). */
const PLOT_ASPECT = 0.905;

// Tall buildings came back on a slab that is too short front to back. Grow the
// slab backwards to the standard shape, behind whatever stands on it, with
// slab texture taken from the clear strip along its front.
function extendSlab(img, aspect = PLOT_ASPECT) {
  const { w, h, rgba } = img;
  const p = findPlot(img), plotW = p.right - p.left + 1;
  const wantTop = Math.round(p.bottom + 1 - plotW * aspect);
  const colTop = (x) => { for (let y = 0; y < h; y++) if (rgba[(y * w + x) * 4 + 3] > 128) return y; return h; };
  const median = (from, to) => { const v = []; for (let x = from; x <= to; x++) v.push(colTop(x)); v.sort((a, b) => a - b); return v[v.length >> 1]; };
  const inset = Math.round(plotW * 0.03), span = Math.round(plotW * 0.03);
  // Something may overhang one side; the slab's own edge is the lower reading.
  const top = Math.max(median(p.left + inset, p.left + inset + span), median(p.right - inset - span, p.right - inset));
  if (top - wantTop < plotW * 0.015) return { grown: 0 };
  // Texture: plain rows of ground (no path, hedge or prop across them) from the
  // front of the plot, mirrored back and forth. A strip with a path in it,
  // repeated, made stripes behind a tower (owner, 2026-11-20). With too few
  // plain rows, flat ground colour instead.
  const x0 = p.left + Math.round(plotW * 0.04), x1 = p.right - Math.round(plotW * 0.04);
  const lumAt = (x, y) => { const d = (y * w + x) * 4; return rgba[d + 3] < 250 ? -1 : rgba[d] + rgba[d + 1] + rgba[d + 2]; };
  const plain = (y) => {
    const lum = []; for (let x = x0; x <= x1; x++) { const v = lumAt(x, y); if (v < 0) return false; lum.push(v); }
    const sorted = [...lum].sort((a, b) => a - b), med = sorted[sorted.length >> 1];
    return lum.filter((v) => Math.abs(v - med) > 36).length < lum.length * 0.06;
  };
  const rows = [];
  for (let y = Math.round(p.bottom - plotW * 0.06); y > p.bottom - plotW * 0.45 && rows.length < 48; y--) if (plain(y)) rows.push(y);
  let flat = null;
  if (rows.length < 6) {
    // The median colour of the ground along the front strip.
    const ch = [[], [], []];
    for (let y = Math.round(p.bottom - plotW * 0.095); y <= p.bottom - plotW * 0.06; y++) for (let x = x0; x <= x1; x++) { const d = (y * w + x) * 4; if (rgba[d + 3] > 250) for (let c = 0; c < 3; c++) ch[c].push(rgba[d + c]); }
    flat = ch.map((v) => { v.sort((a, b) => a - b); return v[v.length >> 1] ?? 128; });
    rows.length = 0; rows.push(Math.round(p.bottom - plotW * 0.08));
  }
  rows.sort((a, b) => a - b);
  const sn = rows.length;
  const corner = Math.round(plotW * 0.03);
  for (let y = wantTop; y < top + corner; y++) {
    const k = sn > 1 ? (y - wantTop) % (2 * sn - 2) : 0, sy = rows[k < sn ? k : 2 * sn - 2 - k];
    for (let x = p.left; x <= p.right; x++) {
      const s = (sy * w + x) * 4, d = (y * w + x) * 4;
      // Round the new back corners.
      const cx = x < p.left + corner ? p.left + corner : x > p.right - corner ? p.right - corner : x;
      const cy = y < wantTop + corner ? wantTop + corner : y;
      const dist = Math.hypot(x - cx, y - cy);
      const fa = (rgba[s + 3] / 255) * Math.max(0, Math.min(1, corner - dist + 0.5));
      const ea = rgba[d + 3] / 255, a = ea + fa * (1 - ea);
      if (a <= 0) continue;
      for (let c = 0; c < 3; c++) rgba[d + c] = Math.round((rgba[d + c] * ea + (flat ? flat[c] : rgba[s + c]) * fa * (1 - ea)) / a);
      rgba[d + 3] = Math.round(a * 255);
    }
  }
  return { grown: top - wantTop };
}

// The slab's front edge (the lip under the plot) came back as many pixels thick
// on a merged lot as on a 1×1, so in the game it was twice as thick and the lot
// looked raised (owner, 2026-11-20). Thin it to a 1×1's: 4.1% of a tile.
const LIP_PER_TILE = 0.041;
function thinLip(img, tilesWide) {
  const { w, h, rgba } = img, p = findPlot(img), plotW = p.right - p.left + 1;
  const lum = (x, y) => { const d = (y * w + x) * 4; return rgba[d + 3] < 200 ? -1 : (rgba[d] + rgba[d + 1] + rgba[d + 2]) / 3; };
  const heights = [];
  // Every column across the plot: the ground a little way in, then how far up from the bottom the lip runs.
  for (let f = 0.04; f <= 0.96; f += 0.02) {
    const x = Math.round(p.left + plotW * f);
    const ground = [];
    for (let k = Math.round(plotW * 0.08); k <= plotW * 0.14; k++) ground.push(lum(x, p.bottom - k));
    ground.sort((a, b) => a - b);
    const surf = ground[ground.length >> 1];
    if (surf < 0) continue;
    let k = 0;
    while (k < plotW * 0.08 && Math.abs(lum(x, p.bottom - k) - surf) > surf * 0.06) k++;
    if (k < plotW * 0.08) heights.push(k);
  }
  if (!heights.length) return 0;
  heights.sort((a, b) => a - b);
  const face = heights[heights.length >> 1], want = Math.round(LIP_PER_TILE * plotW / tilesWide);
  const drop = face - want;
  if (drop <= 0) return 0;
  // Drop rows spread evenly through the lip, so its shading keeps its order.
  const gone = new Set();
  for (let j = 0; j < drop; j++) gone.add(p.bottom - face + 1 + Math.floor((j + 0.5) * face / drop));
  const out = new Uint8Array(w * h * 4);
  let dy = h - 1;
  for (let y = h - 1; y >= 0; y--) { if (gone.has(y)) continue; out.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), dy * w * 4); dy--; }
  rgba.set(out);
  return drop;
}

// Area resample to any size (premultiplied alpha), for scales that are not whole numbers.
function resample({ w, h, rgba }, W, H) {
  const out = new Uint8Array(W * H * 4), kx = w / W, ky = h / H;
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    const x0 = X * kx, x1 = x0 + kx, y0 = Y * ky, y1 = y0 + ky;
    let r = 0, g = 0, b = 0, a = 0, area = 0;
    for (let sy = Math.floor(y0); sy < Math.min(h, Math.ceil(y1)); sy++) {
      const wy = Math.min(sy + 1, y1) - Math.max(sy, y0);
      for (let sx = Math.floor(x0); sx < Math.min(w, Math.ceil(x1)); sx++) {
        const wt = wy * (Math.min(sx + 1, x1) - Math.max(sx, x0)), s = (sy * w + sx) * 4, al = rgba[s + 3] * wt;
        r += rgba[s] * al; g += rgba[s + 1] * al; b += rgba[s + 2] * al; a += al; area += wt;
      }
    }
    const d = (Y * W + X) * 4;
    if (a > 0) { out[d] = r / a; out[d + 1] = g / a; out[d + 2] = b / a; }
    out[d + 3] = a / area;
  }
  return { w: W, h: H, rgba: out };
}

for (const { src, id, n } of BIG) {
  execFileSync('sips', ['-s', 'format', 'bmp', join(here, 'raw-big', src + '.png'), '--out', tmp], { stdio: 'ignore' });
  const cut = cutout(readBmp(tmp));
  const { grown } = extendSlab(cut);
  const game = resample(cut, n * 128, n * 128);
  writePalettePng(join(GAME_OUT, id + '.png'), game);
  const gp = findPlot(game);
  gameManifest[id] = { w: game.w, h: game.h, left: gp.left, right: gp.right, bottom: gp.bottom };
  console.log(`${id}: ${n}×${n} tiles, slab grown by ${grown}px of 1024`, gp);
}
// ── Merged 2×2 lots ─────────────────────────────────────────────────────────
// raw-lots/*.png: towers on a tall 9:16 canvas (ref/anchor-2x2-tall.png), low
// buildings on the square 2×2 anchor. Scaled so the plot is two 1×1 plots wide
// (2 × 101 px); the game draws them over the four tiles (clay/bigLots.ts).
// Game ids are `lots/<name>`. Game output only.
const LOT_PLOT = 202;
const PURPLE_BG = new Set(['i-works-c.png', 'i-works-g.png']);
// Magenta reflected in steel and glass: pulled back towards grey-blue.
const LOT_UNTINT = new Set(['i-works-e.png', 'i-works-f.png', 'i-works-g.png', 'c-tower-i.png', 'c-mall-c.png']);
// Low lots whose building came back behind the plot with a big plaza in front (owner, 2026-11-21):
// pulled forward like the pairs below (pullForward), in tiles.
const LOT_PULL = { 'c-mall-b.png': 1.4 };
// With `force`, the rows nearest the front lip go whatever is on them (planters, benches), for a plaza with too few plain rows.
const PULL_FORCE = new Set(['c-wide-c.png', 'c-mall-b.png']);
mkdirSync(join(GAME_OUT, 'lots'), { recursive: true });
for (const f of readdirSync(join(here, 'raw-lots')).filter((f) => f.endsWith('.png')).sort()) {
  execFileSync('sips', ['-s', 'format', 'bmp', join(here, 'raw-lots', f), '--out', tmp], { stdio: 'ignore' });
  const bmp = readBmp(tmp);
  // A background that came back purple rather than magenta: snap it (and its shadow) to magenta first.
  if (PURPLE_BG.has(f)) for (let i = 0; i < bmp.w * bmp.h; i++) {
    const r = bmp.rgb[i * 3], g = bmp.rgb[i * 3 + 1], b = bmp.rgb[i * 3 + 2];
    if (Math.min(r, b) > 70 && g < Math.min(r, b) * 0.5 && Math.abs(r - b) < 70) { bmp.rgb[i * 3] = 255; bmp.rgb[i * 3 + 1] = 0; bmp.rgb[i * 3 + 2] = 255; }
  }
  const cut = cutout(bmp);
  if (LOT_UNTINT.has(f)) for (let i = 0; i < cut.w * cut.h; i++) {
    const d = i * 4, m = Math.min(cut.rgba[d], cut.rgba[d + 2]) - cut.rgba[d + 1];
    if (cut.rgba[d + 3] === 0 || m < 20) continue;
    cut.rgba[d] = Math.max(0, cut.rgba[d] - m * 0.95); cut.rgba[d + 2] = Math.max(0, cut.rgba[d + 2] - m * 0.55);
  }
  const thinned = thinLip(cut, 2);
  const pulled = LOT_PULL[f] ? pullForward(cut, Math.round(LOT_PULL[f] * (findPlot(cut).right - findPlot(cut).left + 1) * PLOT_ASPECT / 2), PULL_FORCE.has(f)) : 0;
  const { grown } = extendSlab(cut);   // generated plots come back short front to back
  const p = findPlot(cut), k = LOT_PLOT / (p.right - p.left + 1);
  const game = resample(cut, Math.round(cut.w * k), Math.round(cut.h * k));
  const id = 'lots/' + f.replace(/\.png$/, '');
  writePalettePng(join(GAME_OUT, id + '.png'), game);
  const gp = findPlot(game);
  gameManifest[id] = { w: game.w, h: game.h, left: gp.left, right: gp.right, bottom: gp.bottom };
  console.log(`${id}: ${game.w}×${game.h}, slab grown by ${grown}px, lip thinned ${thinned}px${pulled ? `, pulled forward ${pulled}px` : ''}`);
}
// ── Merged shop pairs ───────────────────────────────────────────────────────
// raw-pairs/c-wide-*.png: two tiles side by side (ref/anchor-2x1-wide.png);
// c-tall-*.png: two tiles front to back (ref/anchor-2x1-tall.png). Scaled so
// the plot is 2 or 1 plots wide; the plot is grown back to 2×1 or 1×2 depth.
// Game ids are `pairs/<name>`. Game output only.
const PAIR_PURPLE_BG = new Set(['c-tall-d.png']);
// Magenta that tinted dark windows and glass: pulled back towards grey-blue.
const PAIR_UNTINT = new Set(['c-wide-a.png', 'c-wide-b.png', 'c-wide-d.png', 'c-tall-b.png', 'c-tall-d.png']);
// Pairs whose building came back at the very back of the plot, behind a big
// plaza (owner, 2026-11-20; b, d and more of c 2026-11-21): pull the building forward by this many tiles by
// taking out plain plaza rows in front of it; extendSlab regrows the back.
const PAIR_PULL = { 'c-wide-a.png': 0.5, 'c-wide-b.png': 0.5, 'c-wide-c.png': 0.5, 'c-wide-d.png': 0.6 };
/** Removes up to `n` plain rows (no props: nearly one colour across the plot) between the building and the plot's front lip. */
function pullForward(img, n, force = false) {
  const { w, h, rgba } = img, p = findPlot(img), plotW = p.right - p.left + 1;
  const lip = Math.round(plotW * 0.07);
  const plain = (y) => {
    const x0 = p.left + Math.round(plotW * 0.04), x1 = p.right - Math.round(plotW * 0.04);
    const lum = []; for (let x = x0; x <= x1; x++) { const d = (y * w + x) * 4; if (rgba[d + 3] < 250) return false; lum.push(rgba[d] + rgba[d + 1] + rgba[d + 2]); }
    const sorted = [...lum].sort((a, b) => a - b), med = sorted[sorted.length >> 1];
    return lum.filter((v) => Math.abs(v - med) > 36).length < lum.length * 0.06;
  };
  const drop = new Set();
  for (let y = p.bottom - lip; y > 0 && drop.size < n; y--) {
    if (force || plain(y)) drop.add(y);
    else if (y < p.bottom - plotW * 0.5) break;   // into the building
  }
  const out = new Uint8Array(w * h * 4);
  let dy = h - 1;
  for (let y = h - 1; y >= 0; y--) { if (drop.has(y)) continue; out.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), dy * w * 4); dy--; }
  img.rgba.set(out);
  return drop.size;
}
mkdirSync(join(GAME_OUT, 'pairs'), { recursive: true });
for (const f of readdirSync(join(here, 'raw-pairs')).filter((f) => f.endsWith('.png')).sort()) {
  const wide = f.startsWith('c-wide');
  execFileSync('sips', ['-s', 'format', 'bmp', join(here, 'raw-pairs', f), '--out', tmp], { stdio: 'ignore' });
  const bmp = readBmp(tmp);
  if (PAIR_PURPLE_BG.has(f)) for (let i = 0; i < bmp.w * bmp.h; i++) {
    const r = bmp.rgb[i * 3], g = bmp.rgb[i * 3 + 1], b = bmp.rgb[i * 3 + 2];
    if (Math.min(r, b) > 70 && g < Math.min(r, b) * 0.5 && Math.abs(r - b) < 70) { bmp.rgb[i * 3] = 255; bmp.rgb[i * 3 + 1] = 0; bmp.rgb[i * 3 + 2] = 255; }
  }
  const cut = cutout(bmp);
  if (PAIR_UNTINT.has(f)) for (let i = 0; i < cut.w * cut.h; i++) {
    const d = i * 4, m = Math.min(cut.rgba[d], cut.rgba[d + 2]) - cut.rgba[d + 1];
    if (cut.rgba[d + 3] === 0 || m < 20) continue;
    cut.rgba[d] = Math.max(0, cut.rgba[d] - m * 0.95); cut.rgba[d + 2] = Math.max(0, cut.rgba[d + 2] - m * 0.55);
  }
  const thinned = thinLip(cut, wide ? 2 : 1);
  const pulled = PAIR_PULL[f] ? pullForward(cut, Math.round(PAIR_PULL[f] * (findPlot(cut).right - findPlot(cut).left + 1) * PLOT_ASPECT / (wide ? 2 : 1)), PULL_FORCE.has(f)) : 0;
  const { grown } = extendSlab(cut, wide ? PLOT_ASPECT / 2 : PLOT_ASPECT * 2);
  const p = findPlot(cut), k = (wide ? 202 : 101) / (p.right - p.left + 1);
  const game = resample(cut, Math.round(cut.w * k), Math.round(cut.h * k));
  const id = 'pairs/' + f.replace(/\.png$/, '');
  writePalettePng(join(GAME_OUT, id + '.png'), game);
  const gp = findPlot(game);
  gameManifest[id] = { w: game.w, h: game.h, left: gp.left, right: gp.right, bottom: gp.bottom };
  console.log(`${id}: ${game.w}×${game.h}, slab grown by ${grown}px, lip thinned ${thinned}px${pulled ? `, pulled forward ${pulled}px` : ''}`);
}
// ── Leisure buildings ───────────────────────────────────────────────────────
// The owner's picks from raw-leisure/ (leisure review page, 2026-11-20): museum
// 1b, stadium #4, big parks #9 and #10, 2×2 parks #7 and #8, plazas #13 and #14.
// Drawn on the n×n anchors (ref/anchor-2x2, -3x3, -4x4); scaled so the plot is
// n 1×1 plots wide (n × 101 px). Game ids are `leisure/<id>`. Game output only.
const LEISURE = [
  { src: 'museum-a3', id: 'museum', n: 2, untint: true },
  { src: 'stadium-a', id: 'stadium', n: 4 },
  { src: 'bigpark-a', id: 'bigpark-a', n: 3 }, { src: 'bigpark-b', id: 'bigpark-b', n: 3 },
  { src: 'park2-a', id: 'midpark-a', n: 2 }, { src: 'park2-b', id: 'midpark-b', n: 2 },
  { src: 'monument-a', id: 'plaza-a', n: 2, untint: true }, { src: 'monument-b', id: 'plaza-b', n: 2 },
  // Park variety round (2026-11-21, owner took all twelve): seven 1×1 park looks on ref/anchor.png, five 2×2 parks.
  ...['playground', 'garden', 'dogpark', 'court', 'skate', 'meadow', 'duckpond'].map(k => ({ src: 'p1-' + k, id: 'park1-' + k, n: 1 })),
  ...['japanese', 'adventure', 'sunken', 'orchard', 'wetland'].map(k => ({ src: 'p2-' + k, id: 'midpark-' + k, n: 2 })),
];
mkdirSync(join(GAME_OUT, 'leisure'), { recursive: true });
for (const { src, id: name, n, untint } of LEISURE) {
  execFileSync('sips', ['-s', 'format', 'bmp', join(here, 'raw-leisure', src + '.png'), '--out', tmp], { stdio: 'ignore' });
  const cut = cutout(readBmp(tmp));
  // Magenta tint in glass and pale paving: pulled back towards grey.
  if (untint) for (let i = 0; i < cut.w * cut.h; i++) {
    const d = i * 4, m = Math.min(cut.rgba[d], cut.rgba[d + 2]) - cut.rgba[d + 1];
    if (cut.rgba[d + 3] === 0 || m < 12) continue;
    cut.rgba[d] = Math.max(0, cut.rgba[d] - m * 0.95); cut.rgba[d + 2] = Math.max(0, cut.rgba[d + 2] - m * 0.55);
  }
  const thinned = thinLip(cut, n);
  const { grown } = extendSlab(cut);
  const p = findPlot(cut), k = n * 101 / (p.right - p.left + 1);
  const game = resample(cut, Math.round(cut.w * k), Math.round(cut.h * k));
  const id = 'leisure/' + name;
  writePalettePng(join(GAME_OUT, id + '.png'), game);
  const gp = findPlot(game);
  gameManifest[id] = { w: game.w, h: game.h, left: gp.left, right: gp.right, bottom: gp.bottom };
  console.log(`${id}: ${game.w}×${game.h}, slab grown by ${grown}px, lip thinned ${thinned}px`);
}
// ── Capstones ───────────────────────────────────────────────────────────────
// raw-capstones/: the owner's picks (capstone review, 2026-11-21), painted from
// true-scale massing guides on the 4×4 anchor's camera. w × d: the plot in tiles
// (the fire HQ's is its 4×4 block; its runway and tarmac are drawn in code).
// A 2:3 canvas can come back with the plot too deep: squashed back like the
// beach parks. Trees are left out of the art and placed in code
// (clay/capstoneArt.ts). Game ids are `capstones/<id>`.
const CAPSTONES = [
  { src: 'sewage-c', w: 4, d: 4 }, { src: 'water-b', w: 4, d: 4 }, { src: 'fire-c', w: 4, d: 4 }, { src: 'police-b', w: 4, d: 4 },
  { src: 'hospital-6x4', w: 6, d: 4 }, { src: 'nuclear-a', w: 4, d: 4 }, { src: 'uni-b', w: 8, d: 8 },
];
/** The anchors' plots are drawn this deep (front to back, per unit of width) for a square lot. */
const ANCHOR_DEPTH = 723 / 852;
mkdirSync(join(GAME_OUT, 'capstones'), { recursive: true });
for (const { src, w, d } of CAPSTONES) {
  execFileSync('sips', ['-s', 'format', 'bmp', join(here, 'raw-capstones', src + '.png'), '--out', tmp], { stdio: 'ignore' });
  let cut = cutout(readBmp(tmp));
  const thinned = thinLip(cut, w);
  const p0 = findPlot(cut), want = (p0.right - p0.left + 1) * ANCHOR_DEPTH * d / w, depth = p0.bottom - plotTop(cut);
  let squash = 1;
  if (depth > want * 1.02) { squash = want / depth; cut = resample(cut, cut.w, Math.round(cut.h * squash)); }
  const { grown } = extendSlab(cut, PLOT_ASPECT * d / w);
  const p = findPlot(cut), k = w * 101 / (p.right - p.left + 1);
  const game = resample(cut, Math.round(cut.w * k), Math.round(cut.h * k));
  const id = 'capstones/' + src;
  writePalettePng(join(GAME_OUT, id + '.png'), game);
  const gp = findPlot(game);
  gameManifest[id] = { w: game.w, h: game.h, left: gp.left, right: gp.right, bottom: gp.bottom };
  console.log(`${id}: ${game.w}×${game.h}, squash ${squash.toFixed(2)}, slab grown by ${grown}px, lip thinned ${thinned}px`);
}
// The capstones' aircraft, side on, nose right: trimmed and scaled to their real
// length at 256 px a tile (twice the clay sprites', so they stay crisp in flight).
const AIRCRAFT = [{ src: 'heli-police', m: 13 }, { src: 'heli-medevac', m: 13 }, { src: 'plane-bomber', m: 20 }];
for (const { src, m } of AIRCRAFT) {
  execFileSync('sips', ['-s', 'format', 'bmp', join(here, 'raw-capstones', src + '.png'), '--out', tmp], { stdio: 'ignore' });
  const cut = cutout(readBmp(tmp));
  let x0 = cut.w, x1 = 0, y0 = cut.h, y1 = 0;
  for (let y = 0; y < cut.h; y++) for (let x = 0; x < cut.w; x++) if (cut.rgba[(y * cut.w + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const tw = x1 - x0 + 1, th = y1 - y0 + 1, trim = { w: tw, h: th, rgba: new Uint8Array(tw * th * 4) };
  for (let y = 0; y < th; y++) trim.rgba.set(cut.rgba.subarray(((y0 + y) * cut.w + x0) * 4, ((y0 + y) * cut.w + x1 + 1) * 4), y * tw * 4);
  const W = Math.round(m / 17 * 256), game = resample(trim, W, Math.round(th * W / tw));
  writePalettePng(join(GAME_OUT, 'capstones', src + '.png'), game);
  console.log(`capstones/${src}: ${game.w}×${game.h}`);
}
// Beach parks (3×2, turned to face the water): the owner's A (boardwalk beach,
// kind 20) and B (seaside lido, its own kind), each wide (rot 0/2, on
// ref/anchor-3x2-wide.png) and tall (rot 1/3, ref/anchor-2x3-tall.png).
// Drawn like the shop pairs: plot w plots wide, w × d tiles deep.
const BEACH = [
  { src: 'beach-a-wide', w: 3, d: 2 }, { src: 'beach-a-tall', w: 2, d: 3 },
  { src: 'beach-b-wide', w: 3, d: 2 }, { src: 'beach-b-tall', w: 2, d: 3 },
];
/** The plot's back edge: the first row from the top that is solid across nearly the whole plot. */
function plotTop(img) {
  const p = findPlot(img), x0 = p.left + Math.round((p.right - p.left) * 0.03), x1 = p.right - Math.round((p.right - p.left) * 0.03);
  for (let y = 0; y < p.bottom; y++) {
    let solid = 0;
    for (let x = x0; x <= x1; x++) if (img.rgba[(y * img.w + x) * 4 + 3] > 200) solid++;
    if (solid >= (x1 - x0 + 1) * 0.97) return y;
  }
  return 0;
}
for (const { src, w, d } of BEACH) {
  execFileSync('sips', ['-s', 'format', 'bmp', join(here, 'raw-leisure', src + '.png'), '--out', tmp], { stdio: 'ignore' });
  let cut = cutout(readBmp(tmp));
  const thinned = thinLip(cut, w);
  // A plot that came back too deep for its shape is squashed to fit (the whole picture, so nothing tears).
  const p0 = findPlot(cut), want = (p0.right - p0.left + 1) * PLOT_ASPECT * d / w, depth = p0.bottom - plotTop(cut);
  let squash = 1;
  if (depth > want * 1.02) { squash = want / depth; cut = resample(cut, cut.w, Math.round(cut.h * squash)); }
  const { grown } = extendSlab(cut, PLOT_ASPECT * d / w);
  const p = findPlot(cut), k = w * 101 / (p.right - p.left + 1);
  const game = resample(cut, Math.round(cut.w * k), Math.round(cut.h * k));
  const id = 'leisure/' + src;
  writePalettePng(join(GAME_OUT, id + '.png'), game);
  const gp = findPlot(game);
  gameManifest[id] = { w: game.w, h: game.h, left: gp.left, right: gp.right, bottom: gp.bottom };
  console.log(`${id}: ${game.w}×${game.h}, ${w}×${d}, squashed to ${squash.toFixed(2)}, slab grown by ${grown}px, lip thinned ${thinned}px`);
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
