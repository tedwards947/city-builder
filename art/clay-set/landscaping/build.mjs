// Precomputes everything pixel-derived that landscaping.html needs, so the page
// works from file:// without reading canvas pixels.
//   node art/clay-set/landscaping/bundle.mjs && node art/clay-set/landscaping/build.mjs
// ../sprites/{res,com,ind}-N[-b|c|d].png
//   → masks/<id>.png   white, alpha = "this pixel is bare plot ground" (lit or in shadow)
//   → shade/<id>.png   black, alpha = how much the building's shadow darkens that ground
//   → data.js          window.LOTS (free-ground grid, door, colours) + window.PROPS
// raw/props-*.png (generated clay prop sheets on magenta, 4 x 4 grid)
//   → props/<name>.png cut-out props, half size
//   → ../../../public/sprites/clay/props/<tree>.png the four trees the game uses, quarter size
// No dependencies; the cut-out helpers are copied from ../cutout.mjs.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const SPRITES = join(here, '../sprites');
const PLOT_ASPECT = 0.905;
const CELL = 4; // free-ground grid cell, in sprite pixels
for (const d of ['masks', 'shade', 'props']) mkdirSync(join(here, d), { recursive: true });

// ── PNG in/out ───────────────────────────────────────────────────────────────
function readPng(path) {
  const b = readFileSync(path);
  let p = 8, w = 0, h = 0, ct = 6; const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), type = b.toString('latin1', p + 4, p + 8), data = b.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; if (data[8] !== 8 || data[12]) throw new Error('unsupported png ' + path); }
    if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 0; if (!bpp) throw new Error('unsupported colour type ' + path);
  const raw = inflateSync(Buffer.concat(idat)), stride = w * bpp, rgba = new Uint8Array(w * h * 4);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = Uint8Array.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0, u = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let add = 0;
      if (f === 1) add = a; else if (f === 2) add = u; else if (f === 3) add = (a + u) >> 1;
      else if (f === 4) { const pp = a + u - c, pa = Math.abs(pp - a), pb = Math.abs(pp - u), pc = Math.abs(pp - c); add = pa <= pb && pa <= pc ? a : pb <= pc ? u : c; }
      line[i] = (line[i] + add) & 255;
    }
    for (let x = 0; x < w; x++) { const d = (y * w + x) * 4; rgba[d] = line[x * bpp]; rgba[d + 1] = line[x * bpp + 1]; rgba[d + 2] = line[x * bpp + 2]; rgba[d + 3] = bpp === 4 ? line[x * bpp + 3] : 255; }
    prev = line;
  }
  return { w, h, rgba };
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
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  writeFileSync(path, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}

// ── Lots: which pixels are bare ground ──────────────────────────────────────
const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
const median = (a) => { a.sort((x, y) => x - y); return a[a.length >> 1] || 0; };
function blur(src, w, h, r) { // box blur on a Float32Array
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let d = -r; d <= r; d++) { const xx = x + d; if (xx >= 0 && xx < w) { s += src[y * w + xx]; n++; } } tmp[y * w + x] = s / n; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let d = -r; d <= r; d++) { const yy = y + d; if (yy >= 0 && yy < h) { s += tmp[yy * w + x]; n++; } } out[y * w + x] = s / n; }
  return out;
}

// Ground colour of one sprite: median of the plot's top-left corner, which buildings rarely reach.
function cornerColour(id, m) {
  const { w, rgba } = readPng(join(SPRITES, id + '.png'));
  const plotW = m.right - m.left + 1, top = Math.round(m.bottom + 1 - plotW * PLOT_ASPECT);
  const rs = [], gs = [], bs = [];
  for (let y = top + 5; y < top + 16; y++) for (let x = m.left + 5; x < m.left + 24; x++) { const i = (y * w + x) * 4; rs.push(rgba[i]); gs.push(rgba[i + 1]); bs.push(rgba[i + 2]); }
  return [median(rs), median(gs), median(bs)];
}

function analyse(id, m, G) {
  const { w, h, rgba } = readPng(join(SPRITES, id + '.png'));
  const zone = id.slice(0, 3);
  const plotW = m.right - m.left + 1, top = Math.round(m.bottom + 1 - plotW * PLOT_ASPECT);
  const px = (x, y) => { const i = (y * w + x) * 4; return [rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]]; };
  const GL = lum(...G);
  const gn = G.map((c) => c / GL);
  // Front lip: walk up the left edge from the bottom until the colour is ground again.
  let front = m.bottom;
  const like = (x, y, tol, lo, hi) => {
    const [r, g, b, a] = px(x, y); if (a < 250) return 0;
    const L = lum(r, g, b), k = L / GL; if (k < lo || k > hi) return 0;
    // Shadows on the grey paving turn blue; grey roofs and walls do not. So for commercial lots,
    // darker-than-lit pixels only count as ground when they are bluish.
    if (zone === 'com' && k < 0.93 && lo < 0.8) { if (k >= 0.5 && b - r >= (k < 0.8 ? 7 : 3) && b - r <= 28 && Math.abs(r - g) <= 7) return k; if (k < 0.86) return 0; }
    const d = Math.abs(r / L - gn[0]) + Math.abs(g / L - gn[1]) + Math.abs(b / L - gn[2]);
    return d < tol ? k : 0;
  };
  const TOL = zone === 'com' ? 0.07 : zone === 'ind' ? 0.16 : 0.22;
  while (front > top && !like(m.left + 8, front, TOL, 0.86, 1.12)) front--;
  front -= 1;
  // Candidate ground = same hue as the ground, anywhere from half as bright (shadow) to lit.
  const cand = new Uint8Array(w * h), ratio = new Float32Array(w * h).fill(1);
  for (let y = top + 1; y <= front; y++) for (let x = m.left + 1; x < m.right; x++) {
    const k = like(x, y, TOL, 0.42, 1.14); if (k) { cand[y * w + x] = 1; ratio[y * w + x] = Math.min(1, k); }
  }
  // Keep only ground connected to the plot's outer edge (drops roof patches of a similar colour).
  const keep = new Uint8Array(w * h), stack = [];
  const push = (i) => { if (cand[i] && !keep[i]) { keep[i] = 1; stack.push(i); } };
  for (let x = m.left + 1; x < m.right; x++) { push((top + 1) * w + x); push(front * w + x); }
  for (let y = top + 1; y <= front; y++) { push(y * w + m.left + 1); push(y * w + m.right - 1); }
  while (stack.length) { const i = stack.pop(); push(i - 1); push(i + 1); push(i - w); push(i + w); }
  // Open (remove specks and thin slivers), then close pin-holes such as paving joints.
  const morph = (src, r, need) => { const out = new Uint8Array(w * h); for (let y = top; y <= front + 1; y++) for (let x = m.left; x <= m.right; x++) { let n = 0, t = 0; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { t++; n += src[(y + dy) * w + x + dx]; } out[y * w + x] = n >= need(t) ? 1 : 0; } return out; };
  const g0 = morph(keep, 2, (t) => t * 0.62); // majority filter fills joints and drops specks: this is the mask
  const g = morph(g0, 1, (t) => t);           // eroded 1px: what props may stand on, clear of the building's outline
  // Shadow strength, smoothed, only where it is ground.
  const sh = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) sh[i] = g[i] ? 1 - ratio[i] : 0;
  // fill non-ground with neighbours' average so the blur does not fade shadows at the building edge
  const shB = blur(sh, w, h, 2), gB = blur(Float32Array.from(g), w, h, 2), aB = blur(Float32Array.from(g0), w, h, 1);
  const mask = new Uint8Array(w * h * 4), shade = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    mask[i * 4] = mask[i * 4 + 1] = mask[i * 4 + 2] = 255; mask[i * 4 + 3] = g0[i] ? Math.round(255 * Math.min(1, aB[i] * 1.4)) : 0;
    const s = gB[i] > 0.05 ? shB[i] / gB[i] : 0;
    shade[i * 4 + 3] = s > 0.035 ? Math.round(255 * Math.min(0.6, s)) : 0;
  }
  writePng(join(here, 'masks', id + '.png'), { w, h, rgba: mask });
  writePng(join(here, 'shade', id + '.png'), { w, h, rgba: shade });

  // Rim continuity: for each plot edge, one char per ${CELL}px step along it: '1' when the 9px band just
  // inside the rim is bare ground there. An edge treatment is only "solid" if its whole run is '1'.
  const rim = { back: '', front: '', left: '', right: '' };
  {
    const x0 = m.left + 2, x1 = m.right - 1, y0 = top + 2, y1 = front - 1, BAND = 9;
    const seg = (ax, ay, bx, by) => { let n = 0, t = 0; for (let y = ay; y < by; y++) for (let x = ax; x < bx; x++) { t++; n += g0[y * w + x]; } return n / t >= 0.97 ? '1' : '0'; };
    for (let x = x0; x < x1; x += CELL) { rim.back += seg(x, y0, Math.min(x + CELL, x1), y0 + BAND); rim.front += seg(x, y1 - BAND, Math.min(x + CELL, x1), y1); }
    for (let y = y0; y < y1; y += CELL) { rim.left += seg(x0, y, x0 + BAND, Math.min(y + CELL, y1)); rim.right += seg(x1 - BAND, y, x1, Math.min(y + CELL, y1)); }
  }
  // Coarse grid over the plot surface: '0' blocked, '1' lit free ground, '2' shadowed free ground.
  const cols = Math.floor((m.right - m.left + 1) / CELL), rows = Math.floor((front - top + 1) / CELL);
  let grid = '';
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    let n = 0, s = 0;
    for (let dy = 0; dy < CELL; dy++) for (let dx = 0; dx < CELL; dx++) { const i = (top + cy * CELL + dy) * w + m.left + cx * CELL + dx; n += g[i]; s += g[i] ? 1 - ratio[i] : 0; }
    grid += n < CELL * CELL ? '0' : s / n > 0.1 ? '2' : '1';
  }
  // The building = the largest blocked blob on the grid (ignores painted parking lines etc).
  // "Door": the widest run on the building's lowest row is the front step / dock; a path would start there.
  // (the outermost ring of cells is the plot's own rim, not building)
  const blocked = (i) => { const x = i % cols, y = (i / cols) | 0; return grid[i] === '0' && x > 0 && x < cols - 1 && y > 0 && y < rows - 1; };
  const comp = new Int32Array(cols * rows); let nComp = 0, bestComp = 0, bestN = 0;
  for (let s0 = 0; s0 < cols * rows; s0++) {
    if (!blocked(s0) || comp[s0]) continue;
    const st = [s0]; comp[s0] = ++nComp; let n = 0;
    while (st.length) {
      const i = st.pop(), x = i % cols; n++;
      for (const j of [x > 0 ? i - 1 : -1, x < cols - 1 ? i + 1 : -1, i - cols, i + cols]) if (j >= 0 && j < cols * rows && blocked(j) && !comp[j]) { comp[j] = nComp; st.push(j); }
    }
    if (n > bestN) { bestN = n; bestComp = nComp; }
  }
  let bx0 = cols, bx1 = -1, by0 = rows, by1 = -1;
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) if (comp[cy * cols + cx] === bestComp) { bx0 = Math.min(bx0, cx); bx1 = Math.max(bx1, cx); by0 = Math.min(by0, cy); by1 = Math.max(by1, cy); }
  let door = null;
  for (let cy = by1; cy >= by0 && !door; cy--) {
    let best = null, run = null;
    for (let cx = 0; cx <= cols; cx++) {
      const blk = cx < cols && comp[cy * cols + cx] === bestComp;
      if (blk) { run = run || { a: cx, b: cx }; run.b = cx; }
      else if (run) { if (!best || run.b - run.a > best.b - best.a) best = run; run = null; }
    }
    if (best && best.b - best.a >= 1) door = { a: best.a, b: best.b, y: cy };
  }
  return {
    zone, level: +id[4], w, h, left: m.left, right: m.right, bottom: m.bottom, top, front,
    cols, rows, cell: CELL, grid, rim, ground: G, bld: [bx0, by0, bx1, by1], door,
    free: +((grid.split('').filter((c) => c !== '0').length) / grid.length).toFixed(2),
  };
}

const manifest = JSON.parse(readFileSync(join(SPRITES, 'manifest.json'), 'utf8'));
const LOTS = {};
const ids = Object.keys(manifest).sort().filter((id) => /^(res|com|ind)-\d(-[b-d])?$/.test(id));
// One ground colour per zone (median over its sprites), so a lot whose corner is built on still works.
const zoneGround = {};
for (const z of ['res', 'com', 'ind']) {
  const cs = ids.filter((id) => id.startsWith(z)).map((id) => cornerColour(id, manifest[id]));
  zoneGround[z] = [0, 1, 2].map((k) => median(cs.map((c) => c[k])));
}
for (const id of ids) LOTS[id] = analyse(id, manifest[id], zoneGround[id.slice(0, 3)]);

// Blend F is planned by the game's own code (bundled by bundle.mjs) from the game's own 128px
// sprites, so the mock shows what the game will do. `game` is that analysis, in 256-space units.
await import('./lot-dressing.js');
const LD = globalThis.LotDressing;
const GAME = join(here, '../../../public/sprites/clay');
const gameMeta = JSON.parse(readFileSync(join(here, '../../../src/render/clay/claySpriteData.ts'), 'utf8').match(/= (\{[\s\S]*\});/)[1]);
for (const id of ids) {
  const im = readPng(join(GAME, id + '.png'));
  const a = LD.analyseLot(new Uint8ClampedArray(im.rgba.buffer), im.w, im.h, gameMeta[id], id.slice(0, 3), +id[4]);
  if (!a) continue;
  LOTS[id].game = { ...a.field, grid: Array.from(a.field.grid).join('') };
  // The game's own ground mask and shadow, so the mock clips F exactly as the game will.
  const mask = new Uint8Array(im.w * im.h * 4), shade = new Uint8Array(im.w * im.h * 4);
  for (let i = 0; i < im.w * im.h; i++) { mask[i * 4] = mask[i * 4 + 1] = mask[i * 4 + 2] = 255; mask[i * 4 + 3] = a.alpha[i]; shade[i * 4 + 3] = a.shade[i]; }
  writePng(join(here, 'masks', id + '.game.png'), { w: im.w, h: im.h, rgba: mask });
  writePng(join(here, 'shade', id + '.game.png'), { w: im.w, h: im.h, rgba: shade });
}

// ── Props: cut the generated sheets into individual pieces ──────────────────
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
const SHEETS = {
  'props-1': ['tree', 'pine', 'tree-autumn', 'tree-blossom', 'bush', 'berry-bush', 'flowerbed', 'vegpatch', 'fence-diag', 'hedge-diag', 'planter', 'bench', 'crates', 'barrels', 'tyres', 'bikerack'],
  'props-2': ['fence-diag2', 'hedge-diag2', 'wall-diag', 'chainlink-diag', 'flowerbed2', 'vegpatch2', 'planterbox', 'bench2', 'pond', 'boulders', 'scrub', 'parasol', 'bin', 'cone', 'pallets', 'barrier'],
};
const PROPS = {};
const tmp = join(tmpdir(), `landscaping-${process.pid}.bmp`);
for (const [sheet, names] of Object.entries(SHEETS)) {
  execFileSync('sips', ['-s', 'format', 'bmp', join(here, 'raw', sheet + '.png'), '--out', tmp], { stdio: 'ignore' });
  const cut = cutout(readBmp(tmp));
  const { w, h, rgba } = cut, cw = w / 4, chh = h / 4;
  // Bounding box of opaque pixels per connected component, merged into its grid cell.
  const seen = new Uint8Array(w * h), boxes = names.map(() => null);
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
  names.forEach((name, i) => {
    const b = boxes[i]; if (!b) return;
    const img = cropDown(cut, Math.max(0, b[0] - 2), Math.max(0, b[1] - 2), Math.min(w - 1, b[2] + 2), Math.min(h - 1, b[3] + 2), 2);
    writePng(join(here, 'props', name + '.png'), img);
    PROPS[name] = { w: img.w, h: img.h };
    // The game uses only the trees, at a size that suits its 128px sprites.
    if (LD.TREE_NAMES.includes(name)) {
      mkdirSync(join(GAME, 'props'), { recursive: true });
      writePng(join(GAME, 'props', name + '.png'), cropDown(cut, Math.max(0, b[0] - 2), Math.max(0, b[1] - 2), Math.min(w - 1, b[2] + 2), Math.min(h - 1, b[3] + 2), 4));
    }
  });
}
rmSync(tmp, { force: true });

writeFileSync(join(here, 'data.js'), '// Generated by art/clay-set/landscaping/build.mjs. Do not edit by hand.\nwindow.LOTS = ' + JSON.stringify(LOTS) + ';\nwindow.PROPS = ' + JSON.stringify(PROPS) + ';\n');
for (const [id, l] of Object.entries(LOTS)) console.log(id.padEnd(8), 'free', l.free, 'front', l.front, 'door', JSON.stringify(l.door), 'bld', l.bld.join(','), 'ground', l.ground.join(','));
console.log(Object.keys(PROPS).length, 'props');
