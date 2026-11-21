// Capstones (CAPSTONE_DESIGN.md): the owner's picks from the capstone review
// (2026-11-21), painted from true-scale massing guides (docs/SCALE.md) and cut
// by art/clay-set/cutout.mjs to `capstones/<name>`. What the paintings leave out
// is drawn here, so it matches the rest of the city:
//
//   TREES      The game's own clay trees (props/tree, tree-autumn), at the
//              massing guides' places, at full size (lotDressing TREE_SPECS).
//   FIRE HQ    8×5: row 0 is the runway; the painted 4×4 block (hangar and
//              station) stands at the right end; to its left, tarmac joins the
//              hangar's apron and a taxiway runs up to the strip. All code, so
//              the runway's length is just the lot's width.
//   WATERWORKS Three intake pipes from the lot's edge into the water beside it
//              (the renderer finds the water, as for the large pump).
//   AIRCRAFT   Parked at home: the police and air-ambulance helicopters on their
//              roof pads, the water bomber on the hangar apron. Their flights are
//              clay/capstoneAnim.ts; while one is out it is not drawn here.
//   EFFECTS    Steam over the cooling towers and their red rim lights, the sewage
//              works' fountain, the fire HQ's windsock and hose-tower beacon, and
//              the roof pads' lights.
//
// Places are lot metres from the footprint's top-left (17 m a tile), as in the
// guides. The anchors' plots are painted 0.849 of the width deep and the game
// stretches them to 0.905 (PLOT_ASPECT), so the painting's ground lands a
// little forward of the guide: `ground()` makes the same shift.

import {
  BUILDING_SEWAGE_WORKS, BUILDING_WATERWORKS, BUILDING_FIRE_HQ, BUILDING_POLICE_HQ, BUILDING_GENERAL_HOSPITAL, BUILDING_NUCLEAR_PLANT, BUILDING_UNIVERSITY,
} from '../../sim/constants';
import { capstoneClaySprite, clayTreeImage, drawClaySprite } from './ClaySprites';
import { TREE_SPECS, type TreeName } from './lotDressing';
import { aircraftHome, drawRotor } from './capstoneAnim';

type Ctx = CanvasRenderingContext2D;
type Pt = readonly [number, number];
interface Pad { x: number; y: number; z: number; heli: 'heli-police' | 'heli-medevac' }
interface Art {
  name: string;
  /** The painted block within the footprint, in tiles: offset and size (the whole footprint but for the fire HQ). */
  bx: number; by: number; bw: number; bd: number;
  trees: readonly Pt[];
  pad?: Pad;
}

const row = (xs: readonly number[], y: number): Pt[] => xs.map((x) => [x, y] as const);
const ART: Record<number, Art> = {
  [BUILDING_SEWAGE_WORKS]: { name: 'sewage-d', bx: 0, by: 0, bw: 4, bd: 4, trees: [...row([6, 13, 20, 48, 55, 62], 51), ...row([6, 13, 20, 48, 55, 62], 63)] },
  [BUILDING_WATERWORKS]: { name: 'water-b', bx: 0, by: 0, bw: 4, bd: 4, trees: row([5, 14.7, 24.3, 43.7, 53.3, 63], 64.5) },
  [BUILDING_FIRE_HQ]: { name: 'fire-c', bx: 4, by: 1, bw: 4, bd: 4, trees: row([5, 13, 21, 29], 62) },
  [BUILDING_POLICE_HQ]: { name: 'police-b', bx: 0, by: 0, bw: 4, bd: 4, trees: row([10, 20, 48, 58], 53.5), pad: { x: 34, y: 24, z: 30, heli: 'heli-police' } },
  [BUILDING_GENERAL_HOSPITAL]: { name: 'hospital-6x4', bx: 0, by: 0, bw: 6, bd: 4, trees: [[33, 47], [70, 47], [33, 58], [70, 58]], pad: { x: 53, y: 15, z: 42, heli: 'heli-medevac' } },
  [BUILDING_NUCLEAR_PLANT]: { name: 'nuclear-a', bx: 0, by: 0, bw: 4, bd: 4, trees: row([5, 13, 21, 47, 55, 63], 63) },
  [BUILDING_UNIVERSITY]: { name: 'uni-b', bx: 0, by: 0, bw: 8, bd: 8, trees: [[107, 25], ...[119, 126, 133].flatMap((y) => row([48, 68], y)), ...row([6, 16, 26, 36, 80, 92, 104, 116, 128], 128)] },
};

/**
 * Where a capstone's aircraft live, in tiles from the footprint's top-left: the roof pad (and its
 * height, metres) for the helicopters; for the bomber, its spot on the hangar apron and the tarmac's taxi line.
 */
export function capstoneSpots(kind: number): { pad?: { x: number; y: number; z: number }; apron?: { x: number; y: number; taxiY: number } } | null {
  const a = ART[kind];
  if (!a) return null;
  const gy = (y: number) => a.by + (a.bd * 17 - (a.bd * 17 - y) * SHIFT) / 17;
  if (a.pad) return { pad: { x: a.bx + a.pad.x / 17, y: gy(a.pad.y), z: a.pad.z } };
  if (kind === BUILDING_FIRE_HQ) return { apron: { x: a.bx + 20 / 17, y: gy(43), taxiY: gy(41) } };
  return {};
}

/** Whether `kind` is a capstone with art. */
export function isCapstoneArt(kind: number): boolean { return ART[kind] !== undefined; }

/** Screen height of a metre (docs/SCALE.md: 0.12 tile a 3 m floor). */
const HM = 0.04;
const SHIFT = 0.849 / 0.905;
/** A guide's ground point (block metres) on screen, given the block's top-left and depth in tiles. */
function ground(x: number, y: number, L: number, Tp: number, bd: number, T: number): [number, number] {
  const D = bd * 17;
  return [L + x / 17 * T, Tp + (D - (D - y) * SHIFT) / 17 * T];
}

// Aircraft cut-outs (cutout.mjs: side on, nose right, at 256 px a tile).
const planes: Record<string, HTMLImageElement> = {};
function plane(name: string): HTMLImageElement | null {
  let img = planes[name];
  if (!img) {
    if (typeof Image === 'undefined') return null;
    img = planes[name] = new Image();
    img.src = `${import.meta.env.BASE_URL}sprites/clay/capstones/${name}.png`;
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}
/** Draws an aircraft `len` metres long with its wheels or skids at (x, y), facing right unless `left`. */
export function drawAircraft(ctx: Ctx, name: string, x: number, y: number, len: number, T: number, left = false): void {
  const img = plane(name);
  if (!img) return;
  const w = len / 17 * T, h = w * img.naturalHeight / img.naturalWidth;
  ctx.save(); ctx.translate(x, y); if (left) ctx.scale(-1, 1);
  ctx.drawImage(img, -w / 2, -h, w, h);
  ctx.restore();
}
/** A still main rotor over a parked helicopter: a thin blade across its hub. */
function rotor(ctx: Ctx, x: number, y: number, T: number): void {
  const r = 10.7 / 2 / 17 * T;
  ctx.strokeStyle = 'rgba(40,44,48,0.85)'; ctx.lineWidth = Math.max(1, T * 0.012);
  ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.stroke();
}

function tree(ctx: Ctx, name: TreeName, x: number, y: number, T: number): void {
  const img = clayTreeImage(name);
  if (!img) return;
  const s = TREE_SPECS[name], k = T / 202, w = s.w * k, h = w * s.aspect;   // plan units: 202 a tile
  ctx.drawImage(img, x - w / 2, y + s.R * k * 0.35 - h * s.base, w, h);
}

// ── The fire HQ's strip, tarmac and taxiway ─────────────────────────────────
function fireGround(ctx: Ctx, sx: number, sy: number, w: number, T: number, a: Art): void {
  // Runway row: grass shoulders, asphalt, threshold stripes, centre dashes, edge lights.
  ctx.fillStyle = '#7fb262'; ctx.fillRect(sx, sy, w * T, T);
  const ax = sx + T * 0.15, aw = w * T - T * 0.3, ay = sy + T * 0.2, ah = T * 0.6;
  ctx.fillStyle = '#55595f'; ctx.fillRect(ax, ay, aw, ah);
  ctx.fillStyle = '#f2f2ee';
  for (let k = 0; k < 6; k++) { const yy = ay + ah * 0.1 + k * ah * 0.8 / 6, sh = Math.max(1, ah * 0.08); ctx.fillRect(ax + T * 0.15, yy, T * 0.45, sh); ctx.fillRect(ax + aw - T * 0.6, yy, T * 0.45, sh); }
  for (let x = ax + T; x < ax + aw - T; x += T * 0.7) ctx.fillRect(x, ay + ah / 2 - Math.max(0.5, T * 0.01), T * 0.35, Math.max(1, T * 0.02));
  if (T >= 10) { ctx.fillStyle = '#ffd34d'; const d = Math.max(1, T * 0.03); for (let x = ax + T * 0.2; x < ax + aw; x += T * 0.8) { ctx.fillRect(x, ay - d * 1.5, d, d); ctx.fillRect(x, ay + ah + d * 0.5, d, d); } }
  // Tarmac left of the block, level with the hangar's apron, and a taxiway up to the strip near its left end.
  const L = sx + a.bx * T, Tp = sy + a.by * T;
  const [, y0] = ground(0, 32, L, Tp, a.bd, T), [, y1] = ground(0, 50, L, Tp, a.bd, T), tx = sx + 0.9 * T;
  ctx.fillStyle = '#7fb262'; ctx.fillRect(sx, sy + T, a.bx * T, a.bd * T);
  ctx.fillStyle = '#bdb8ad'; ctx.fillRect(sx + 0.3 * T, y0, L - sx - 0.3 * T + 4 / 17 * T, y1 - y0);
  ctx.fillStyle = '#55595f'; ctx.fillRect(tx - T * 0.45, sy + 0.8 * T, T * 0.9, y0 - sy - 0.8 * T + 1);
  const mid = (y0 + y1) / 2, lw = Math.max(1, T * 0.02);
  ctx.fillStyle = '#f2c230'; ctx.fillRect(tx - lw / 2, sy + 0.82 * T, lw, mid - sy - 0.82 * T); ctx.fillRect(tx, mid - lw / 2, L + 20 / 17 * T - tx, lw);
}

// ── The waterworks' intake pipes ────────────────────────────────────────────
function intakePipes(ctx: Ctx, sx: number, sy: number, w: number, d: number, T: number, wx: number, wy: number): void {
  // Which side faces the water: the one the water tile's centre lies beyond.
  const side = wx < sx ? 3 : wx > sx + w * T ? 1 : wy < sy ? 0 : 2;
  const r = 1.3 / 17 * T, up = HM * 1.4 * T;
  for (let k = 0; k < 3; k++) {
    const f = 0.35 + k * 0.15;
    if (side === 1 || side === 3) {   // a horizontal run out of the left or right edge
      const y = sy + d * T * f, xa = side === 1 ? sx + w * T - 0.2 * T : sx + 0.2 * T, xb = side === 1 ? sx + w * T + 0.8 * T : sx - 0.8 * T;
      const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb);
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(x0, y - r * 0.2, x1 - x0, r * 1.4);
      ctx.fillStyle = '#2f6fa0'; ctx.fillRect(x0, y - up - r, x1 - x0, 2 * r);
      ctx.fillStyle = '#5b9bd0'; ctx.fillRect(x0, y - up - r, x1 - x0, r * 0.7);
      ctx.fillStyle = '#245a85'; for (const q of [0.3, 0.6]) ctx.fillRect(x0 + (x1 - x0) * q, y - up - r * 1.25, Math.max(1, r * 0.6), r * 2.5);
      mouth(ctx, xb, y, r, up);
    } else {   // a vertical run out of the back or front edge
      const x = sx + w * T * f, ya = side === 2 ? sy + d * T - 0.2 * T : sy + 0.2 * T, yb = side === 2 ? sy + d * T + 0.8 * T : sy - 0.8 * T;
      const y0 = Math.min(ya, yb), y1 = Math.max(ya, yb);
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(x + r * 0.4, y0, r * 1.6, y1 - y0);
      ctx.fillStyle = '#2f6fa0'; ctx.fillRect(x - r, y0 - up, 2 * r, y1 - y0);
      ctx.fillStyle = '#5b9bd0'; ctx.fillRect(x - r, y0 - up, r * 0.7, y1 - y0);
      ctx.fillStyle = '#245a85'; for (const q of [0.3, 0.6]) ctx.fillRect(x - r * 1.25, y0 - up + (y1 - y0) * q, r * 2.5, Math.max(1, r * 0.6));
      mouth(ctx, x, yb, r, up);
    }
  }
}
function mouth(ctx: Ctx, x: number, y: number, r: number, up: number): void {
  ctx.fillStyle = '#2f6fa0'; ctx.beginPath(); ctx.ellipse(x, y - up * 0.4, r * 1.6, r * 1.3, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y + r * 0.6, r * 2.6, r * 1.1, 0, 0, 7); ctx.stroke();
}

// ── Effects ─────────────────────────────────────────────────────────────────
const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** A soft glow that blinks once every `period` seconds (steady with reduced motion). */
function blink(ctx: Ctx, x: number, y: number, T: number, sec: number, rgb: string, period: number): void {
  const on = still ? 0.8 : Math.max(0, Math.sin(sec * Math.PI * 2 / period)) ** 3;
  if (on < 0.05) return;
  const r = Math.max(1.5, T * 0.06);
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.5); g.addColorStop(0, `rgba(${rgb},${0.9 * on})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.5, 0, Math.PI * 2); ctx.fill();
}
/** Light steam drifting up and away from a cooling tower's mouth at (x, y): water vapour, not smoke. */
function steam(ctx: Ctx, x: number, y: number, T: number, sec: number): void {
  const n = 7;
  for (let k = 0; k < n; k++) {
    const p = still ? k / n : ((sec / 7 + k / n) % 1);
    const px = x + p * 0.7 * T + Math.sin(sec * 0.7 + k) * 0.05 * T, py = y - p * 1.5 * T, r = (0.28 + p * 0.45) * T;
    const a = 0.24 * (1 - p) * Math.min(1, p * 6);
    const g = ctx.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(250,252,255,${a})`); g.addColorStop(1, 'rgba(250,252,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
  }
}
function rimLights(ctx: Ctx, x: number, y: number, T: number, sec: number): void {
  const rx = 0.5 * T, ry = 0.13 * T;
  for (const a of [Math.PI, 0, Math.PI / 2]) blink(ctx, x + Math.cos(a) * rx, y + Math.sin(a) * ry, T * 0.6, sec, '255,60,40', 1.8);
}
/** The sewage works' garden fountain: a few drops thrown up and falling back into the basin. */
function fountain(ctx: Ctx, x: number, y: number, T: number, sec: number): void {
  ctx.fillStyle = 'rgba(235,245,255,0.85)';
  for (let k = 0; k < 10; k++) {
    const p = still ? 0.5 : (sec * 0.9 + k / 10) % 1, a = (k / 10) * Math.PI * 2, d = p * 0.16 * T, h = Math.sin(p * Math.PI) * 0.22 * T;
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.5 - h, Math.max(0.8, T * 0.012), 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(235,245,255,0.6)'; ctx.fillRect(x - Math.max(0.6, T * 0.006), y - 0.24 * T, Math.max(1.2, T * 0.012), 0.24 * T);
}
/** An orange windsock on a short mast, swaying. */
function windsock(ctx: Ctx, x: number, y: number, T: number, sec: number): void {
  const h = 8 * HM * T, sway = still ? 0.2 : Math.sin(sec * 0.9) * 0.25 + Math.sin(sec * 2.3) * 0.08, l = 0.35 * T;
  ctx.fillStyle = '#d8d8d8'; ctx.fillRect(x - 0.5, y - h, Math.max(1, T * 0.012), h);
  ctx.fillStyle = '#f07a2a'; ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + l * Math.cos(sway), y - h + l * Math.sin(sway) + 1); ctx.lineTo(x, y - h + Math.max(3, T * 0.06)); ctx.fill();
}
// Moving parts painted over the art, placed in the sprite's own pixels (cut sprite, capstones/<name>.png).
/** The sewage works' four settling tanks: rim centres in sprite pixels, and the outer rim radius (sprite px, covers the painted rim). */
const TANKS: readonly [number, number][] = [[99, 120], [199, 120], [299, 120], [391, 120]];
const TANK_R = 41;
/** How far the tanks' round tops lean back: their depth on screen as a share of their width (owner, 2026-11-21: "tilted backward"). */
const TANK_TILT = 0.72;
/** Clock faces: sprite name → centre, then half-width and half-height of the face, in its pixels. */
const CLOCKS: Record<string, readonly [number, number, number, number]> = { 'sewage-d': [241.5, 246.5, 10.5, 8.8], 'uni-b': [422, 672, 9, 9] };
/** A sprite pixel on screen, for a sprite drawn by drawClaySprite at (L, top) with a plot `side` wide. */
function spritePx(m: { left: number; right: number; bottom: number }, L: number, top: number, side: number, px: number, py: number): [number, number, number] {
  const plotW = m.right - m.left + 1, kx = side / plotW, ky = side / (plotW * 0.905);
  return [L - m.left * kx + px * kx, top - (m.bottom + 1 - plotW * 0.905) * ky + py * ky, kx];
}
/**
 * A settling tank, drawn whole on the paving: its round top leans back (TANK_TILT) like the painted
 * fountain, and heights rise straight up at 0.12 tile per 3 m. So the rim is an ellipse lifted 2 m
 * above the ground one, the front of the wall shows below it, a sliver of the inside wall
 * shows at the back above the water, and the bridge turns at rim height with its shadow on the water.
 * (x, y): the rim's centre on screen; r: the outer rim radius; T: px a tile.
 */
function tank(ctx: Ctx, x: number, y: number, r: number, T: number, sec: number, k: number): void {
  const tl = TANK_TILT, wall = 2 * HM * T, lip = Math.max(1, 0.9 / 17 * T), drop = 0.9 * HM * T, ri = r - lip;
  // Shadow on the paving, falling right.
  ctx.fillStyle = 'rgba(30,25,20,0.22)'; ctx.beginPath(); ctx.ellipse(x + wall * 0.9, y + wall * 0.7, r, r * tl, 0, 0, Math.PI * 2); ctx.fill();
  // The outer wall: the ground circle and the band up to the rim, lit from the left.
  const side = ctx.createLinearGradient(x - r, 0, x + r, 0);
  side.addColorStop(0, '#7e523d'); side.addColorStop(0.55, '#674231'); side.addColorStop(1, '#4b2f22');
  ctx.fillStyle = side; ctx.beginPath(); ctx.ellipse(x, y + wall, r, r * tl, 0, 0, Math.PI); ctx.lineTo(x - r, y); ctx.ellipse(x, y, r, r * tl, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
  // Brick courses on the wall, and a darker course along its foot.
  if (wall >= 4) { ctx.strokeStyle = 'rgba(60,28,18,0.28)'; ctx.lineWidth = 1; for (const f of [0.35, 0.65]) { ctx.beginPath(); ctx.ellipse(x, y + wall * f, r, r * tl, 0, 0.08, Math.PI - 0.08); ctx.stroke(); } }
  ctx.strokeStyle = 'rgba(40,20,12,0.35)'; ctx.lineWidth = Math.max(1, wall * 0.18); ctx.beginPath(); ctx.ellipse(x, y + wall * 0.88, r, r * tl, 0, 0.15, Math.PI - 0.15); ctx.stroke();
  // The rim's top: brick coping, lit from the upper left, with a pale stone edge on the inside.
  const top = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  top.addColorStop(0, '#8c604a'); top.addColorStop(1, '#6a4534');
  ctx.fillStyle = top; ctx.beginPath(); ctx.ellipse(x, y, r, r * tl, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(232,218,192,0.75)'; ctx.lineWidth = Math.max(0.8, lip * 0.28); ctx.beginPath(); ctx.ellipse(x, y, ri + lip * 0.15, (ri + lip * 0.15) * tl, 0, 0, Math.PI * 2); ctx.stroke();
  // Inside: the far inner wall (seen above the water), then the water, lower than the rim.
  ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, ri, ri * tl, 0, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#4a3226'; ctx.fillRect(x - ri, y - ri * tl, ri * 2, ri * 2 * tl);
  const g = ctx.createRadialGradient(x - ri * 0.35, y + drop - ri * 0.35, 0, x, y + drop, ri);
  g.addColorStop(0, '#666a54'); g.addColorStop(1, '#3f4235');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y + drop, ri, ri * tl, 0, 0, Math.PI * 2); ctx.fill();
  // The sky caught on the far side of the water.
  ctx.strokeStyle = 'rgba(190,205,200,0.18)'; ctx.lineWidth = Math.max(1, ri * 0.08); ctx.beginPath(); ctx.ellipse(x, y + drop, ri * 0.88, ri * 0.88 * tl, 0, Math.PI * 1.15, Math.PI * 1.6); ctx.stroke();
  const a = still ? 0.6 : sec * Math.PI * 2 / 50 + k * 1.7, c = Math.cos(a), s = Math.sin(a);
  // A faint wake trailing the bridge, and the bridge's shadow on the water.
  ctx.strokeStyle = 'rgba(205,210,185,0.2)'; ctx.lineWidth = Math.max(1, ri * 0.1);
  for (const b of [a, a + Math.PI]) { ctx.beginPath(); ctx.ellipse(x, y + drop, ri * 0.75, ri * 0.75 * tl, 0, b - 0.55, b - 0.08); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(20,22,16,0.35)'; ctx.lineWidth = Math.max(1.5, ri * 0.1);
  ctx.beginPath(); ctx.moveTo(x - c * ri + drop * 0.6, y - s * ri * tl + drop * 1.6); ctx.lineTo(x + c * ri + drop * 0.6, y + s * ri * tl + drop * 1.6); ctx.stroke();
  ctx.restore();
  // The bridge at rim height: a grey walkway with a pale handrail, and the centre pier.
  ctx.strokeStyle = '#77736b'; ctx.lineWidth = Math.max(1.5, ri * 0.09);
  ctx.beginPath(); ctx.moveTo(x - c * ri, y - s * ri * tl); ctx.lineTo(x + c * ri, y + s * ri * tl); ctx.stroke();
  ctx.strokeStyle = 'rgba(225,220,205,0.85)'; ctx.lineWidth = Math.max(0.6, ri * 0.03);
  ctx.beginPath(); ctx.moveTo(x - c * ri, y - s * ri * tl - ri * 0.03); ctx.lineTo(x + c * ri, y + s * ri * tl - ri * 0.03); ctx.stroke();
  ctx.fillStyle = '#9b968b'; ctx.beginPath(); ctx.ellipse(x, y, ri * 0.11, ri * 0.11 * tl, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c4beb1'; ctx.beginPath(); ctx.ellipse(x - ri * 0.03, y - ri * 0.03, ri * 0.06, ri * 0.06 * tl, 0, 0, Math.PI * 2); ctx.fill();
}
/**
 * A clock face showing the player's own time of day, over the painted one: (x, y) its centre, rx and ry
 * its half-width and half-height (a face on an upright wall is a little shorter than wide here).
 */
function clock(ctx: Ctx, x: number, y: number, rx: number, ry: number): void {
  // Bronze bezel, then an aged ivory face lit from the upper left.
  ctx.fillStyle = '#5b4632'; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createRadialGradient(x - rx * 0.35, y - ry * 0.35, 0, x, y, rx);
  g.addColorStop(0, '#e4dac2'); g.addColorStop(1, '#bfb293');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx * 0.84, ry * 0.84, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
  const r = rx * 0.84;
  ctx.fillStyle = '#3a3226';
  if (r >= 5) for (let i = 0; i < 12; i++) { const t = i / 12 * Math.PI * 2; ctx.fillRect(Math.cos(t) * r * 0.8 - 0.5, Math.sin(t) * r * 0.8 - 0.5, 1, 1); }
  const d = new Date(), m = d.getMinutes() + d.getSeconds() / 60, h = (d.getHours() % 12) + m / 60;
  ctx.strokeStyle = '#2e271d';
  const hand = (turn: number, len: number, w: number): void => { const a = turn * Math.PI * 2 - Math.PI / 2; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len); ctx.stroke(); };
  ctx.lineCap = 'round'; hand(h / 12, r * 0.5, Math.max(1, r * 0.16)); hand(m / 60, r * 0.75, Math.max(0.8, r * 0.1)); ctx.lineCap = 'butt';
  ctx.restore();
}

/** Four lights round a roof pad, blinking in turn (green, or red for the hospital's). */
function padLights(ctx: Ctx, x: number, y: number, T: number, sec: number, red: boolean): void {
  const r = 6 / 17 * T;
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; blink(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.55, T * 0.45, sec + k * 0.25, red ? '255,70,60' : '90,255,140', 1); }
}

/**
 * Draws the capstone whose footprint's top-left is at (sx, sy), `w` × `d` tiles, `T` px a tile.
 * `water`: the centre of a water tile beside it (the waterworks), or null. Returns false (nothing
 * drawn) while its art has not loaded, so the stand-in shows.
 */
export function drawCapstone(ctx: Ctx, kind: number, sx: number, sy: number, w: number, d: number, T: number, water: { x: number; y: number } | null, now = 0, anchor = -1): boolean {
  const a = ART[kind], sprite = a && capstoneClaySprite(a.name);
  if (!a || !sprite) return false;
  if (kind === BUILDING_FIRE_HQ) fireGround(ctx, sx, sy, w, T, a);
  if (kind === BUILDING_WATERWORKS && water) intakePipes(ctx, sx, sy, w, d, T, water.x, water.y);
  const L = sx + a.bx * T, Tp = sy + a.by * T;
  // drawClaySprite fits a plot `tile` wide and as deep; a wider-than-deep plot shifts up so its front meets the lot's.
  const top = Tp + (a.bd - a.bw) * T;
  drawClaySprite(ctx, sprite, L, top, a.bw * T);
  if (kind === BUILDING_SEWAGE_WORKS && T >= 10) TANKS.forEach(([px, py], k) => { const [x, y, kx] = spritePx(sprite.meta, L, top, a.bw * T, px, py); tank(ctx, x, y, TANK_R * kx, T, now / 1000, k); });
  const face = CLOCKS[a.name];
  if (face && T >= 14) { const [x, y, kx] = spritePx(sprite.meta, L, top, a.bw * T, face[0], face[1]); clock(ctx, x, y, face[2] * kx, face[3] * kx / 0.905); }
  if (T >= 6) {
    a.trees.map((p, i) => [p[0], p[1], i % 4 === 2 ? 'tree-autumn' : 'tree'] as const).sort((p, q) => p[1] - q[1])
      .forEach(([x, y, n]) => { const [px, py] = ground(x, y, L, Tp, a.bd, T); tree(ctx, n, px, py, T); });
  }
  const home = aircraftHome(anchor), sec = now / 1000;
  if (a.pad) {
    const [px, py] = ground(a.pad.x, a.pad.y, L, Tp, a.bd, T), y = py - a.pad.z * HM * T;
    if (T >= 8) padLights(ctx, px, y, T, sec, kind === BUILDING_GENERAL_HOSPITAL);
    if (home) { drawAircraft(ctx, a.pad.heli, px, y, 13, T); rotor(ctx, px + 0.6 / 17 * T, y - 3.1 / 17 * T, T); }
  }
  if (kind === BUILDING_FIRE_HQ) {
    if (home) { const [px, py] = ground(20, 43, L, Tp, a.bd, T); drawAircraft(ctx, 'plane-bomber', px, py, 20, T, true); }
    if (T >= 8) { windsock(ctx, sx + (w - 0.35) * T, sy + 0.95 * T, T, sec); blink(ctx, L + 3.5 * T, Tp + 1.3 * T, T, sec, '255,170,40', 1.4); }
  }
  if (kind === BUILDING_NUCLEAR_PLANT && T >= 6) for (const u of [0.96, 3.02]) { steam(ctx, L + u * T, Tp - 1.3 * T, T, sec + u * 2.3); if (T >= 10) rimLights(ctx, L + u * T, Tp - 1.3 * T, T, sec); }
  if (kind === BUILDING_SEWAGE_WORKS && T >= 10) fountain(ctx, L + 2.01 * T, Tp + 3.26 * T, T, sec);
  void drawRotor;
  return true;
}
