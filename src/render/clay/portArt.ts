// The seaport's painted props (art/clay-set/seaport.html, picks A1 + B3 + E1):
// two quay cranes, two container blocks, an office and a gate, cut from two
// sprite sheets by art/clay-set/port-sheet.mjs. The camera never turns, so the
// port turns by laying the props out differently: cranes seen side-on when the
// docks face east or west (flipped for west), end-on with a code-drawn boom
// when they face north or south; container blocks long side or end on to match.
// Trolleys run along the booms carrying boxes onto the ship while one is in.

import { PORT_SPRITES, type PortSpriteMeta } from './portSpriteData';

interface Loaded { img: HTMLImageElement; m: PortSpriteMeta }
let sprites: Record<string, Loaded> | null = null;

function load(): Record<string, Loaded> | null {
  if (sprites) return sprites;
  if (typeof Image === 'undefined') return null;
  const base = import.meta.env.BASE_URL;
  sprites = {};
  for (const [name, m] of Object.entries(PORT_SPRITES)) {
    const img = new Image();
    img.src = `${base}sprites/clay/port/${name}.png`;
    sprites[name] = { img, m };
  }
  return sprites;
}

/** True once every prop image has loaded (until then the code-drawn stand-in shows). */
export function portArtReady(): boolean {
  const s = load();
  return !!s && Object.values(s).every(l => l.img.complete && l.img.naturalWidth > 0);
}

/** The painted crane's own points, in pixels of its raw sheet crop (seaport.html): legs, boom height, trolley run. */
const SIDE = { legsX: 157, footY: 345, boomY: 122, runFrom: 110, runTo: 360 };
/** The end-on crane's code boom: height and reach in tiles, measured from the quay edge. */
const BOOM = { h: 1.375, thick: 0.125, from: 0.4, to: 2.4, half: 0.09 };
/** The container yard: a grid of third-size stacks; w, row: column and row spacing as shares of the sprite's size; cells left empty (mod 11). */
const BOXES = { cols: 3, rows: 4, w: 0.8, row: 0.5, gaps: [4, 9] };
const BOX = ['#c75b3c', '#3f74a8', '#d8a640', '#5a8f5a', '#8a8f96', '#e08a3c'];

/**
 * One crane move, 10 s: lift a box from the quay, run out over the ship, lower
 * it, come back empty. x: 0 over the quay → 1 over the ship; d: 0 up → 1 down.
 */
export function craneMove(t: number): { x: number; d: number; carry: boolean } {
  const c = ((t % 10) + 10) % 10, e = (f: number) => f * f * (3 - 2 * f), cl = (f: number) => Math.max(0, Math.min(1, f));
  if (c < 1.5) return { x: 0, d: 1 - e(cl(c / 1.5)), carry: true };
  if (c < 4) return { x: e(cl((c - 1.5) / 2.5)), d: 0, carry: true };
  if (c < 5.5) return { x: 1, d: e(cl((c - 4) / 1.5)), carry: true };
  if (c < 7) return { x: 1, d: 1 - e(cl((c - 5.5) / 1.5)), carry: false };
  if (c < 9.5) return { x: 1 - e(cl((c - 7) / 2.5)), d: 0, carry: false };
  return { x: 0, d: e(cl((c - 9.5) / 0.5)), carry: false };
}

type At = (u: number, v: number) => [number, number];

/**
 * Draws the props. `at(u, v)` maps yard coordinates (u 0–1 along the quay, v 0
 * at the quay to 1 at the back) to the screen; (dx, dy) is the unit step from
 * the yard towards the docks; `tile` is the tile size in pixels. `work` is
 * seconds since a ship tied up, or -1 when none is in (the cranes rest).
 */
export function drawPortArt(ctx: CanvasRenderingContext2D, at: At, dx: number, dy: number, tile: number, work: number): void {
  const s = load();
  if (!s) return;
  const k = tile / 128, side = dx !== 0;
  type Item = { y: number; draw: () => void };
  const items: Item[] = [];
  const sprite = (name: string, x: number, y: number, flip = false, ax?: number, scale = 1) => {
    const { img, m } = s[name];
    const q = k * scale, fx = (ax ?? m.footX) * q;
    items.push({ y, draw: () => {
      if (flip) { ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); ctx.drawImage(img, -fx, -m.footY * q, m.w * q, m.h * q); ctx.restore(); }
      else ctx.drawImage(img, x - fx, y - m.footY * q, m.w * q, m.h * q);
    } });
  };

  // Containers: each block is a yard of small stacks, the painted stack at a third of its size
  // (the owner found full-size boxes too big for the game), rows overlapping back to front, a few gaps.
  for (const [bi, u] of [0.275, 0.725].entries()) {
    const name = side ? 'boxes-end' : 'boxes-long', m = PORT_SPRITES[name];
    const [x, y] = at(u, 0.583), cw = m.w * BOXES.w * k / 3, rh = m.h * BOXES.row * k / 3;
    for (let r = 0; r < BOXES.rows; r++) for (let c = 0; c < BOXES.cols; c++) {
      if (BOXES.gaps.includes((bi * 7 + r * BOXES.cols + c) % 11)) continue;
      const sx = x + (c - (BOXES.cols - 1) / 2) * cw, sy = y + (r - (BOXES.rows - 1) / 2) * rh;
      sprite(name, sx, sy, false, undefined, 1 / 3);
    }
  }
  { const [x, y] = at(0.875, 0.867); sprite('office', x, y); }
  { const [x, y] = at(0.15, 0.9); sprite('gate', x, y); }

  // The cranes, each a little out of step with the other.
  [0.25, 0.65].forEach((u, ci) => {
    const [x, y] = at(u, -0.083);
    const mv = work < 0 ? { x: 0.15, d: 0, carry: false } : craneMove(work + ci * 3.3);
    const col = BOX[(ci * 3 + Math.floor((work + ci * 3.3) / 10)) % BOX.length];
    if (side) {
      const m = PORT_SPRITES['crane-side'], dir = dx > 0 ? 1 : -1;
      sprite('crane-side', x, y, dir < 0, SIDE.legsX * m.k);
      items.push({ y: y + 0.01, draw: () => {
        const boomY = y - (SIDE.footY - SIDE.boomY) * m.k * k;
        const tx = x + dir * ((SIDE.runFrom + mv.x * (SIDE.runTo - SIDE.runFrom)) - SIDE.legsX) * m.k * k;
        const low = mv.x > 0.5 ? y - 0.31 * tile : y - 0.03 * tile;
        trolley(ctx, tx, boomY, boomY + 0.2 * tile + (low - boomY - 0.4 * tile) * mv.d, tile, mv.carry, col);
      } });
    } else {
      // Seaward is up the screen (docks north) or down it (south). The boom goes behind the crane or in front.
      const yAt = (sea: number, h: number) => y + dy * (sea - 0.25) * tile - h * tile;
      const boom = () => {
        const a = yAt(BOOM.from, BOOM.h + BOOM.thick), b = yAt(BOOM.to, BOOM.h + BOOM.thick);
        const top = Math.min(a, b), bottom = Math.max(a, b) + BOOM.thick * tile, w = BOOM.half * tile;
        ctx.fillStyle = '#c75b3c'; ctx.fillRect(x - w, top, 2 * w, bottom - top);
        ctx.fillStyle = '#f0ebe2';
        const n = 6, step = (bottom - top - BOOM.thick * tile) / n;
        for (let q = 0; q < n; q += 2) ctx.fillRect(x - w, top + q * step, 2 * w, step);
      };
      const run = () => {
        const sea = 0.5 + 1.4 * mv.x, ty = yAt(sea, BOOM.h - 0.03);
        const low = mv.x > 0.5 ? 0.3 : 0.06, hs = BOOM.h - 0.2 - (BOOM.h - 0.2 - low - 0.19) * mv.d;
        trolley(ctx, x, ty, yAt(sea, hs), tile, mv.carry, col);
      };
      if (dy < 0) { items.push({ y: y - 0.02, draw: boom }); items.push({ y: y - 0.01, draw: run }); sprite('crane-end', x, y); }
      else { sprite('crane-end', x, y); items.push({ y: y + 0.01, draw: boom }); items.push({ y: y + 0.02, draw: run }); }
    }
  });

  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();
}

/** A trolley at (x, y) on the boom, cables down to the spreader at `sy`, and a box under it when `carry`. */
function trolley(ctx: CanvasRenderingContext2D, x: number, y: number, sy: number, tile: number, carry: boolean, col: string): void {
  const w = Math.max(3, tile * 0.12), bw = Math.max(3, tile * 0.13), bh = Math.max(2, tile * 0.06);
  ctx.fillStyle = '#3b3b3b'; ctx.fillRect(x - w, y, 2 * w, Math.max(2, tile * 0.05));
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - w * 0.6, y); ctx.lineTo(x - w * 0.6, sy); ctx.moveTo(x + w * 0.6, y); ctx.lineTo(x + w * 0.6, sy); ctx.stroke();
  ctx.fillStyle = '#e0b030'; ctx.fillRect(x - bw, sy - 1, 2 * bw, Math.max(1.5, tile * 0.03));
  if (carry) { ctx.fillStyle = col; ctx.fillRect(x - bw, sy + 1, 2 * bw, bh); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x - bw, sy + 1, 2 * bw, Math.max(1, bh * 0.3)); }
}

/**
 * One painted port sprite (a ship) with its foot at screen (x, y), mirrored when
 * `flip`; `mid` puts the middle of its height there instead (a ship seen bow- or
 * stern-on, whose middle is where it floats). Nothing until the images load.
 */
export function drawPortSprite(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, tile: number, flip = false, mid = false): void {
  const l = load()?.[name];
  if (!l || !l.img.complete || l.img.naturalWidth === 0) return;
  const { img, m } = l, q = tile / 128, fx = m.footX * q, fy = (mid ? m.footY * 0.5 : m.footY) * q;
  if (flip) { ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); ctx.drawImage(img, -fx, -fy, m.w * q, m.h * q); ctx.restore(); }
  else ctx.drawImage(img, x - fx, y - fy, m.w * q, m.h * q);
}
