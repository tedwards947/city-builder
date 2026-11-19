// Cuts a seaport prop sheet (raw-port/sheet-N.png: separate clay props on magenta)
// into one PNG per prop in sprites/port/, KEEPING each prop's painted shadow:
// shadowed magenta becomes translucent black instead of being cut away.
// Props are found as connected blobs of non-magenta pixels, left to right, top row first.
// Usage: node art/clay-set/port-sheet.mjs sheet-1   (or: steel airport, for raw-airport/steel.png into sprites/airport/)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const name = process.argv[2] || 'sheet-1';
const set = process.argv[3] || 'port';
const OUT = join(here, 'sprites', set);
mkdirSync(OUT, { recursive: true });

const tmp = join(tmpdir(), `port-${process.pid}.bmp`);
execFileSync('sips', ['-s', 'format', 'bmp', join(here, 'raw-' + set, name + '.png'), '--out', tmp], { stdio: 'ignore' });
const b = readFileSync(tmp); rmSync(tmp);
const off = b.readUInt32LE(10), w = b.readInt32LE(18), hRaw = b.readInt32LE(22), bytes = b.readUInt16LE(28) / 8;
const h = Math.abs(hRaw), stride = Math.ceil((w * bytes) / 4) * 4, n = w * h;
const rgb = new Uint8Array(n * 3);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const s = off + (hRaw > 0 ? h - 1 - y : y) * stride + x * bytes, d = (y * w + x) * 3;
  rgb[d] = b[s + 2]; rgb[d + 1] = b[s + 1]; rgb[d + 2] = b[s];
}

// Magenta-ness, and the background's own brightness (median of the border).
const mag = i => Math.max(0, Math.min(rgb[i * 3], rgb[i * 3 + 2]) - rgb[i * 3 + 1]);
const border = [];
for (let x = 0; x < w; x++) border.push(Math.min(rgb[x * 3], rgb[x * 3 + 2]));
border.sort((p, q) => p - q);
const B0 = border[border.length >> 1];

// Background (incl. shadow) = magenta-hued pixels connected to the border, plus near-pure pockets.
const BG = 70, bg = new Uint8Array(n), stack = [];
const push = i => { if (!bg[i] && mag(i) >= BG) { bg[i] = 1; stack.push(i); } };
for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
const flood = () => { while (stack.length) { const i = stack.pop(), x = i % w; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (i >= w) push(i - w); if (i < n - w) push(i + w); } };
flood();
for (let i = 0; i < n; i++) if (!bg[i] && mag(i) >= 170) { bg[i] = 1; stack.push(i); }
flood();
// 'split' (4th argument): cut the sheet across the middle, for sheets whose two rows touch through a dark shadow (raw-rail).
if (process.argv[4] === 'split') for (let y = (h >> 1) - 3; y <= (h >> 1) + 3; y++) for (let x = 0; x < w; x++) bg[y * w + x] = 1;

const rgba = new Uint8Array(n * 4);
for (let i = 0; i < n; i++) {
  const r = rgb[i * 3], g = rgb[i * 3 + 1], bl = rgb[i * 3 + 2];
  if (bg[i]) {
    // Shadow: how much darker than the plain background, as black at up to 55%.
    const dark = Math.max(0, 1 - Math.min(r, bl) / B0);
    const a = Math.min(0.55, dark * 1.25);
    rgba[i * 4 + 3] = a < 0.04 ? 0 : Math.round(a * 255);
  } else {
    const m = mag(i);
    let a = 255, rr = r, bb = bl;
    if (m > 12) { a = Math.round(255 * (1 - Math.min(1, m / 140))); rr -= m; bb -= m; }
    rgba[i * 4] = Math.max(0, rr); rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = Math.max(0, bb); rgba[i * 4 + 3] = Math.max(a, 0);
  }
}

// Props: blobs of solid pixels; each crop grows right and down to take in its shadow.
const seen = new Uint8Array(n), comp = new Int32Array(n).fill(-1), blobs = [];
for (let i = 0; i < n; i++) {
  if (seen[i] || bg[i]) continue;
  const id = i; let x0 = w, y0 = h, x1 = 0, y1 = 0, count = 0; stack.push(i); seen[i] = 1;
  while (stack.length) {
    const j = stack.pop(), x = j % w, y = (j / w) | 0; count++; comp[j] = id;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    for (const k of [j - 1, j + 1, j - w, j + w]) if (k >= 0 && k < n && !seen[k] && !bg[k] && Math.abs((k % w) - x) <= 1) { seen[k] = 1; stack.push(k); }
  }
  if (count > 1500) blobs.push({ x0, y0, x1, y1, count, ids: [id] });
}
// Merge blobs whose boxes overlap (a crane's legs can come apart).
for (let again = true; again;) {
  again = false;
  for (let p = 0; p < blobs.length && !again; p++) for (let q = p + 1; q < blobs.length; q++) {
    const A = blobs[p], B = blobs[q];
    const ox = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0), oy = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
    const small = Math.min((A.x1 - A.x0) * (A.y1 - A.y0), (B.x1 - B.x0) * (B.y1 - B.y0));
    if (ox > 0 && oy > 0 && ox * oy > 0.5 * small) {
      blobs[p] = { x0: Math.min(A.x0, B.x0), y0: Math.min(A.y0, B.y0), x1: Math.max(A.x1, B.x1), y1: Math.max(A.y1, B.y1), count: A.count + B.count, ids: [...A.ids, ...B.ids] };
      blobs.splice(q, 1); again = true; break;
    }
  }
}
const rowOf = bl => (bl.y0 + bl.y1) / 2 < h / 2 ? 0 : 1;
blobs.sort((p, q) => rowOf(p) - rowOf(q) || p.x0 - q.x0);

const CRC = (() => { const t = new Int32Array(256); for (let k = 0; k < 256; k++) { let c = k; for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[k] = c; } return t; })();
const crc32 = buf => { let c = -1; for (const x of buf) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); };
function png(path, W, H, px) {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; Buffer.from(px.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
// Props the game uses: baked at the game's 128px a tile, one scale per sheet (each sheet's
// office is 0.8 of a tile wide; container blocks 10% larger), as seaport.html shows them.
const K1 = 0.8 * 128 / 132, K2 = 0.8 * 128 / 202, KS = 2.25 * 128 / 490;
const GAME = {
  'sheet-1-1': ['crane-end', K1], 'sheet-1-3': ['crane-side', K1],
  // The office: option 4 of sheet 3 (corrugated steel, the owner's pick), 0.9 of a tile wide.
  'sheet-3-4': ['office', 0.9 * 128 / 425],
  // Ships (sheet 4): the container ship 2.25 tiles long side-on (owner, ships workshop A3), its bow-on and stern-on views and the freighter at the same scale.
  'sheet-4-1': ['ship-side', KS], 'sheet-4-2': ['ship-south', KS], 'sheet-4-3': ['ship-north', KS], 'sheet-4-4': ['freighter-side', KS], 'sheet-2-2': ['gate', K2], 'sheet-2-3': ['boxes-long', K2 * 1.1], 'sheet-2-4': ['boxes-end', K2 * 1.1],
};
// The airport's props (art/clay-set/airport3.html, the owner's picks): straight-on steel terminal, tower and hangar,
// the J2 bridge pair, side-on planes 2 tiles long (no panda) and side-on vehicles. Scale: tiles wide (or tall) × 128 / raw size.
const BR_K = 1.25 * 128 / 308;   // the long bridge spans 1.25 tiles from top to cab foot; the short one shares its scale
const AIR_GAME = {
  'steel-straight-1': ['terminal', 8 * 128 / 1164], 'steel-straight-2': ['tower', 1.9 * 128 / 337], 'steel-straight-3': ['hangar', 1.3 * 128 / 226],
  'bridges-5': ['bridge-long', BR_K], 'bridges-6': ['bridge-short', BR_K],
  'planes-side-1': ['plane-red', 2 * 128 / 481], 'planes-side-3': ['plane-navy', 2 * 128 / 481], 'planes-side-2': ['plane-blue', 2 * 128 / 480],
  'planes-side-5': ['plane-orca', 2 * 128 / 478], 'planes-side-6': ['plane-kawaii', 2 * 128 / 477],
  'vehicles-side-1': ['fuel', 0.8 * 128 / 396], 'vehicles-side-2': ['bags', 128 / 447], 'vehicles-side-3': ['tug', 0.45 * 128 / 312],
  'vehicles-side-4': ['catering', 0.6 * 128 / 292], 'vehicles-side-5': ['stairs', 0.6 * 128 / 280], 'vehicles-side-6': ['fire', 0.7 * 128 / 331],
};
// The rail props (art/clay-set/rail.html, the owner's picks): the Victorian stations, scaled so the base spans its footprint's width.
// The straight ones and the subway entrance come from the template sheet (raw-rail/tpl-stations.png → victorian-straight.png).
const RAIL_GAME = {
  'victorian-straight-1': ['station-h', 4 * 128 / 444], 'victorian-straight-2': ['station-v', 3 * 128 / 387], 'victorian-straight-3': ['subway-entrance', 128 / 223],
  'l-stations-1': ['station-l-up', 3 * 128 / 305], 'l-stations-4': ['station-l-down', 3 * 128 / 304],
};
const RAIL = set === 'rail', AIR = set === 'airport' || RAIL;   // both write the same sprite data shape
const GAME_OUT = join(here, '../../public/sprites/clay/' + (RAIL ? 'rail' : AIR ? 'airport' : 'port'));
const GAME_DATA = join(here, '../../src/render/clay/' + (RAIL ? 'railSpriteData.ts' : AIR ? 'airportSpriteData.ts' : 'portSpriteData.ts'));
// Area-average resample with premultiplied alpha.
function resample(px, W, H, k) {
  const W2 = Math.round(W * k), H2 = Math.round(H * k), out = new Uint8Array(W2 * H2 * 4);
  for (let Y = 0; Y < H2; Y++) for (let X = 0; X < W2; X++) {
    const sx0 = X / k, sx1 = (X + 1) / k, sy0 = Y / k, sy1 = (Y + 1) / k;
    let r = 0, g = 0, b = 0, a = 0, wt = 0;
    for (let y = Math.floor(sy0); y < Math.min(H, Math.ceil(sy1)); y++) {
      const wy = Math.min(y + 1, sy1) - Math.max(y, sy0);
      for (let x = Math.floor(sx0); x < Math.min(W, Math.ceil(sx1)); x++) {
        const f = wy * (Math.min(x + 1, sx1) - Math.max(x, sx0)), s = (y * W + x) * 4, al = px[s + 3] * f;
        r += px[s] * al; g += px[s + 1] * al; b += px[s + 2] * al; a += al; wt += f;
      }
    }
    const d = (Y * W2 + X) * 4;
    if (a > 0) { out[d] = r / a; out[d + 1] = g / a; out[d + 2] = b / a; }
    out[d + 3] = wt > 0 ? a / wt : 0;
  }
  return { W: W2, H: H2, px: out };
}
const game = {};
const meta = [];
blobs.forEach((bl, k) => {
  const pad = 4, x0 = Math.max(0, bl.x0 - pad), y0 = Math.max(0, bl.y0 - pad);
  let x1 = Math.min(w - 1, bl.x1 + Math.round((bl.x1 - bl.x0) * 0.35) + 20), y1 = Math.min(h - 1, bl.y1 + 40);
  // ...but stop short of the next prop, so none of its edge pixels come along as "shadow".
  for (const o of blobs) {
    if (o === bl) continue;
    if (o.x0 > bl.x1 && o.y0 < y1 && o.y1 > y0) x1 = Math.min(x1, o.x0 - 8);
    if (o.y0 > bl.y1 && o.x0 < x1 && o.x1 > x0) y1 = Math.min(y1, o.y0 - 8);
  }
  const W = x1 - x0 + 1, H = y1 - y0 + 1, px = new Uint8Array(W * H * 4);
  const mine = new Set(bl.ids), fade = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y0 + y) * w + x0 + x;
    if (!bg[i] && !mine.has(comp[i])) continue;   // another prop's pixels
    // Shadow and edge pixels belong to the nearest prop: drop any nearer another one (its outline, its shadow).
    if (bg[i]) {
      const X = x0 + x, Y = y0 + y, dist = b => Math.hypot(Math.max(b.x0 - X, 0, X - b.x1), Math.max(b.y0 - Y, 0, Y - b.y1));
      const own = dist(bl);
      let keep = 1;
      for (const o of blobs) if (o !== bl) { const d = dist(o); keep = Math.min(keep, d < 6 ? 0 : Math.max(0, Math.min(1, (d - own + 20) / 40))); }
      if (keep === 0) continue;
      fade[y * W + x] = keep;
    }
    px.set(rgba.subarray(i * 4, i * 4 + 4), (y * W + x) * 4);
    if (bg[i]) px[(y * W + x) * 4 + 3] = Math.round(px[(y * W + x) * 4 + 3] * fade[y * W + x]);
    // Shadow fades out towards the crop's edges, so it never ends in a hard line.
    if (bg[i]) { const e = Math.min(x, y, W - 1 - x, H - 1 - y); if (e < 16) px[(y * W + x) * 4 + 3] = Math.round(px[(y * W + x) * 4 + 3] * e / 16); }
  }
  const file = `${name}-${k + 1}.png`;
  png(join(OUT, file), W, H, px);
  // foot: where the prop's base sits in the crop (bottom of its solid pixels).
  meta.push({ file, w: W, h: H, footY: bl.y1 - y0, left: bl.x0 - x0, right: bl.x1 - x0 });
  const g = (RAIL ? RAIL_GAME : AIR ? AIR_GAME : set === 'port' ? GAME : {})[`${name}-${k + 1}`];
  if (g) {
    mkdirSync(GAME_OUT, { recursive: true });
    const [id, kk] = g, r = resample(px, W, H, kk);
    png(join(GAME_OUT, id + '.png'), r.W, r.H, r.px);
    game[id] = { w: r.W, h: r.H, footX: Math.round(((bl.x0 + bl.x1) / 2 - x0) * kk), footY: Math.round((bl.y1 - y0) * kk), k: +kk.toFixed(4) };
    // The airport also needs the solid box's left, right and top (bridges are placed by their corners).
    if (AIR) Object.assign(game[id], { left: Math.round((bl.x0 - x0) * kk), right: Math.round((bl.x1 - x0) * kk), top: Math.round((bl.y0 - y0) * kk) });
  }
});
if (Object.keys(game).length) {
  // Merge with what other sheets wrote.
  let prev = {};
  try { prev = JSON.parse(/\/\* json \*\/([\s\S]*?)\/\* end \*\//.exec(readFileSync(GAME_DATA, 'utf8'))[1]); } catch {}
  const all = { ...prev, ...game };
  writeFileSync(GAME_DATA, RAIL ? `// Made by art/clay-set/port-sheet.mjs (… rail): the stations' painted props in public/sprites/clay/rail, at 128 px a tile.
// w, h: image size; (footX, footY): where the prop stands; left, right, top: its solid box; all in image pixels. k: image pixels per raw sheet pixel.
export interface RailSpriteMeta { w: number; h: number; footX: number; footY: number; left: number; right: number; top: number; k: number }
export const RAIL_SPRITES: Record<string, RailSpriteMeta> = /* json */${JSON.stringify(all)}/* end */;
` : AIR ? `// Made by art/clay-set/port-sheet.mjs (… airport): the airport's painted props in public/sprites/clay/airport, at 128 px a tile.
// w, h: image size; (footX, footY): where the prop stands; left, right, top: its solid box; all in image pixels. k: image pixels per raw sheet pixel.
export interface AirportSpriteMeta { w: number; h: number; footX: number; footY: number; left: number; right: number; top: number; k: number }
export const AIRPORT_SPRITES: Record<string, AirportSpriteMeta> = /* json */${JSON.stringify(all)}/* end */;
` : `// Made by art/clay-set/port-sheet.mjs: the seaport's painted props in public/sprites/clay/port.
// w, h: image size; (footX, footY): where the prop stands, in image pixels; k: image pixels per pixel of the raw sheet crop.
export interface PortSpriteMeta { w: number; h: number; footX: number; footY: number; k: number }
export const PORT_SPRITES: Record<string, PortSpriteMeta> = /* json */${JSON.stringify(all)}/* end */;
`);
}
writeFileSync(join(OUT, `${name}.json`), JSON.stringify(meta, null, 1));
// Other sets (airport.html): every cut prop's size and foot, for the workshop page.
if (set !== 'port') {
  const all = {};
  for (const f of readdirSync(OUT).filter(f => f.endsWith('.json'))) for (const m of JSON.parse(readFileSync(join(OUT, f), 'utf8'))) all[m.file.replace('.png', '')] = [m.w, m.h, m.left, m.right, m.footY];
  writeFileSync(join(OUT, 'meta.js'), `// Made by port-sheet.mjs: name: [w, h, left, right, footY] in raw pixels.\nwindow.AIR_META = ${JSON.stringify(all)};\n`);
}
console.log(`${blobs.length} props from ${name} (background ${B0}):`, meta.map(m => `${m.file} ${m.w}×${m.h}`).join(', '));
