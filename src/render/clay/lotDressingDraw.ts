/**
 * Paints a lot-dressing plan (lotDressing.ts) with canvas 2D calls, in plan
 * units: the caller scales the context so PLAN_SPACE units span the sprite.
 *
 * Everything is flat two-tone "pressed clay": a darker shape with a lighter
 * one on top, the same look as the smoke puffs. Trees are the only images.
 *
 * drawDressingGround paints the flat things; the caller clips the result to
 * the lot's ground and darkens it with the building's shadow. drawDressingProps
 * paints the things that stand up, already sorted back to front.
 */
import type { LotField } from './lotGround';
import type { GroundItem, PropItem, TreeName, EdgeSide } from './lotDressing';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

const circle = (c: Ctx, x: number, y: number, r: number): void => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
const ell = (c: Ctx, x: number, y: number, rx: number, ry: number): void => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); };
function rrect(c: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + k, y);
  c.arcTo(x + w, y, x + w, y + h, k); c.arcTo(x + w, y + h, x, y + h, k);
  c.arcTo(x, y + h, x, y, k); c.arcTo(x, y, x + w, y, k);
  c.closePath(); c.fill();
}
const blob = (c: Ctx, x: number, y: number, r: number, dark: string, light: string): void => {
  c.fillStyle = dark; circle(c, x, y, r);
  c.fillStyle = light; circle(c, x - r * 0.2, y - r * 0.24, r * 0.68);
};

const GREENS: [string, string][] = [['#2f7d3a', '#4b9d47'], ['#2a7046', '#45935a'], ['#3d8532', '#62a744']];
const FLOWERS = ['#e9483f', '#f5c93a', '#f7f3ea', '#e87fb0', '#8f6fd6'];
const WALLS: [string, string][] = [['#8d5140', '#bd7a62'], ['#84888f', '#b4b8be'], ['#7b7f86', '#a9adb3']];
const CARS: [string, string][] = [['#b23c33', '#d9584c'], ['#c99a22', '#ecc24a'], ['#2f66a8', '#4f8ad0'], ['#b9b6ab', '#ebe8de'], ['#3a8257', '#58a877']];

// ── Edges: flat bands just inside the plot rim ───────────────────────────────
interface EdgePainter { th: number; side: number; h(c: Ctx, x: number, len: number, y: number): void; v(c: Ctx, x: number, y: number, len: number): void }

function edgePainter(style: string, tint: number): EdgePainter {
  if (style === 'hedge') return {
    th: 8, side: 7,
    h(c, x, len, y) { c.fillStyle = '#2b7436'; rrect(c, x, y, len, 8, 3); c.fillStyle = '#4c9c47'; rrect(c, x + 0.8, y, len - 1.6, 5, 2.5); },
    v(c, x, y, len) { c.fillStyle = '#2b7436'; rrect(c, x, y, 7, len, 3); c.fillStyle = '#4c9c47'; rrect(c, x + 0.8, y, 5, len - 3, 2.5); },
  };
  if (style === 'wall') {
    const col = WALLS[tint % WALLS.length];
    return {
      th: 7, side: 5,
      h(c, x, len, y) { c.fillStyle = col[0]; rrect(c, x, y, len, 7, 1.5); c.fillStyle = col[1]; rrect(c, x, y, len, 3.6, 1.5); c.fillStyle = col[0]; for (let px = x + 7; px < x + len - 2; px += 8) c.fillRect(px, y, 0.8, 3.6); },
      v(c, x, y, len) { c.fillStyle = col[0]; rrect(c, x, y, 5, len, 1.5); c.fillStyle = col[1]; rrect(c, x, y, 5, len - 3.2, 1.5); c.fillStyle = col[0]; for (let py = y + 7; py < y + len - 5; py += 8) c.fillRect(x, py, 5, 0.8); },
    };
  }
  if (style === 'verge') return {
    th: 9, side: 9,
    h(c, x, len, y) { c.fillStyle = '#9aa0a8'; rrect(c, x - 0.5, y - 0.5, len + 1, 9.5, 2.5); c.fillStyle = '#5c9f4c'; rrect(c, x + 0.8, y + 0.8, len - 1.6, 7, 2); c.fillStyle = '#74b85e'; rrect(c, x + 1.6, y + 1.2, len - 3.2, 3.4, 1.6); },
    v(c, x, y, len) { c.fillStyle = '#9aa0a8'; rrect(c, x - 0.5, y - 0.5, 9.5, len + 1, 2.5); c.fillStyle = '#5c9f4c'; rrect(c, x + 0.8, y + 0.8, 7, len - 1.6, 2); c.fillStyle = '#74b85e'; rrect(c, x + 1.4, y + 1.4, 3.4, len - 3.2, 1.6); },
  };
  if (style === 'brick') return {
    th: 11, side: 9,
    h(c, x, len, y) { c.fillStyle = '#b06e58'; c.fillRect(x - 2, y - 2, len + 4, 11); c.fillStyle = 'rgba(90,40,30,0.35)'; for (let px = x - 2; px < x + len + 2; px += 5.5) c.fillRect(px, y - 2, 0.8, 11); c.fillRect(x - 2, y + 3.2, len + 4, 0.8); },
    v(c, x, y, len) { c.fillStyle = '#b06e58'; c.fillRect(x - 2, y - 2, 11, len + 4); c.fillStyle = 'rgba(90,40,30,0.35)'; for (let py = y - 2; py < y + len + 2; py += 5.5) c.fillRect(x - 2, py, 11, 0.8); c.fillRect(x + 3.2, y - 2, 0.8, len + 4); },
  };
  if (style === 'chainlink') return {
    th: 9, side: 5,
    h(c, x, len, y) {
      c.fillStyle = 'rgba(30,40,50,0.2)'; c.fillRect(x + 1.5, y + 8.2, len, 1.4);
      c.fillStyle = 'rgba(120,128,138,0.38)'; c.fillRect(x, y + 1, len, 6.4);
      c.fillStyle = '#8b929c'; c.fillRect(x, y + 0.6, len, 1.1); c.fillRect(x, y + 6.8, len, 0.9);
      c.fillStyle = '#5e646d';
      for (let px = x; px < x + len; px += 13) rrect(c, px, y - 0.4, 2.2, 9, 1);
      rrect(c, x + len - 2.2, y - 0.4, 2.2, 9, 1);
    },
    v(c, x, y, len) {
      c.fillStyle = 'rgba(30,40,50,0.2)'; c.fillRect(x + 2.4, y + 2, 1.6, len - 2);
      c.fillStyle = '#8b929c'; c.fillRect(x + 0.5, y, 1.1, len);
      c.fillStyle = '#5e646d';
      for (let py = y; py < y + len - 4; py += 13) rrect(c, x, py, 2.2, 6, 1);
    },
  };
  // hazard kerb
  return {
    th: 5, side: 5,
    h(c, x, len, y) {
      c.fillStyle = '#2b2d31'; rrect(c, x, y + 0.8, len, 5, 1.2);
      c.save(); c.beginPath(); c.rect(x, y, len, 4.4); c.clip();
      c.fillStyle = '#f0c232'; c.fillRect(x, y, len, 4.4);
      c.fillStyle = '#2b2d31';
      for (let px = x - 4; px < x + len; px += 8) { c.beginPath(); c.moveTo(px, y + 4.4); c.lineTo(px + 4, y); c.lineTo(px + 8, y); c.lineTo(px + 4, y + 4.4); c.fill(); }
      c.restore();
    },
    v(c, x, y, len) {
      c.save(); c.beginPath(); c.rect(x, y, 4.4, len); c.clip();
      c.fillStyle = '#f0c232'; c.fillRect(x, y, 4.4, len);
      c.fillStyle = '#2b2d31';
      for (let py = y - 4; py < y + len; py += 8) { c.beginPath(); c.moveTo(x, py); c.lineTo(x + 4.4, py + 4); c.lineTo(x + 4.4, py + 8); c.lineTo(x, py + 4); c.fill(); }
      c.restore();
    },
  };
}

function drawEdge(c: Ctx, f: LotField, style: string, sides: EdgeSide[], gap: [number, number] | null, tint: number): void {
  const P = edgePainter(style, tint);
  const x0 = f.left + 2, x1 = f.right - 1, y0 = f.top + 2, y1 = f.front - 1;
  if (sides.includes('back')) P.h(c, x0, x1 - x0, y0);
  if (sides.includes('left')) P.v(c, x0, y0, y1 - y0);
  if (sides.includes('right')) P.v(c, x1 - P.side, y0, y1 - y0);
  if (sides.includes('front')) {
    const y = y1 - P.th;
    if (!gap) P.h(c, x0, x1 - x0, y);
    else {
      if (gap[0] - x0 > 6) P.h(c, x0, gap[0] - x0, y);
      if (x1 - gap[1] > 6) P.h(c, gap[1], x1 - gap[1], y);
    }
  }
}

// ── Ground layer ─────────────────────────────────────────────────────────────
function softShadow(c: Ctx, x: number, y: number, R: number, h: number): void {
  const sx = x + R * (0.55 + 0.35 * h), sy = y + R * 0.05, rx = R * (1.05 + 0.3 * h), ry = R * 0.62;
  const g = c.createRadialGradient(sx, sy, 0, sx, sy, rx);
  g.addColorStop(0, 'rgba(25,35,45,0.34)'); g.addColorStop(0.6, 'rgba(25,35,45,0.26)'); g.addColorStop(1, 'rgba(25,35,45,0)');
  c.save();
  c.translate(0, sy); c.scale(1, ry / rx); c.translate(0, -sy);
  c.fillStyle = g; circle(c, sx, sy, rx);
  c.restore();
}

function drawGroundItem(c: Ctx, f: LotField, it: GroundItem): void {
  const x0 = f.left, y0 = f.top, W = f.right + 1 - f.left, H = f.front + 1 - f.top;
  switch (it.k) {
    case 'stripes': {
      const w = 11;
      for (let k = 0; k * w * 2 < Math.max(W, H); k++) {
        c.fillStyle = 'rgba(255,255,220,0.13)';
        if (it.vertical) c.fillRect(x0 + k * w * 2, y0, w, H); else c.fillRect(x0, y0 + k * w * 2, W, w);
        c.fillStyle = 'rgba(0,60,20,0.08)';
        if (it.vertical) c.fillRect(x0 + k * w * 2 + w, y0, w, H); else c.fillRect(x0, y0 + k * w * 2 + w, W, w);
      }
      break;
    }
    case 'fill': c.fillStyle = it.colour; c.fillRect(x0, y0, W, H); break;
    case 'dots':
      for (let i = 0; i < it.pts.length; i += 4) {
        c.fillStyle = it.palette === 'flowers' ? FLOWERS[it.pts[i + 3] % 4] : it.pts[i + 3] ? 'rgba(225,225,225,0.6)' : 'rgba(90,90,95,0.55)';
        circle(c, it.pts[i], it.pts[i + 1], it.pts[i + 2]);
      }
      break;
    case 'patches':
      for (let i = 0; i < it.pts.length; i += 4) { c.fillStyle = it.colours[it.pts[i + 3] % 2]; ell(c, it.pts[i], it.pts[i + 1], it.pts[i + 2], it.pts[i + 2] * 0.62); }
      break;
    case 'tracks':
      c.strokeStyle = 'rgba(110,70,40,0.42)'; c.lineWidth = 3.2; c.lineCap = 'round';
      for (const o of [-7, 7]) {
        const y1 = f.front + 1;
        c.beginPath(); c.moveTo(it.x + o, it.y);
        c.bezierCurveTo(it.x + o, y1 - 14, it.x + o + it.bend * 0.4, y1 - 6, it.x + o + it.bend, y1 + 2);
        c.stroke();
      }
      break;
    case 'slabs':
      c.fillStyle = 'rgba(186,186,182,0.45)'; c.fillRect(x0, y0, W, H);
      c.fillStyle = 'rgba(110,110,110,0.2)';
      for (let i = 1; i < 4; i++) { c.fillRect(x0 + i * W / 4, y0, 1, H); c.fillRect(x0, y0 + i * H / 4, W, 1); }
      break;
    case 'edge': drawEdge(c, f, it.style, it.sides, it.gap, it.tint); break;
    case 'stones':
      for (let i = 0; i < it.pts.length; i += 3) {
        const x = it.pts[i], y = it.pts[i + 1], w = it.pts[i + 2];
        c.fillStyle = '#9a9a94'; ell(c, x + 0.4, y + 0.5, w, w * 0.62);
        c.fillStyle = '#c9c7bd'; ell(c, x, y, w * 0.9, w * 0.52);
      }
      break;
    case 'shadow': softShadow(c, it.x, it.y, it.R, it.h); break;
    case 'pit':
      c.fillStyle = '#8b9098'; rrect(c, it.x - 9, it.y - 4.5, 18, 11, 3);
      c.fillStyle = '#6a4a33'; rrect(c, it.x - 7.4, it.y - 3.2, 14.8, 8.2, 2.2);
      break;
    case 'parking': {
      c.fillStyle = '#585d66'; rrect(c, it.x, it.y, it.w, it.h, 4);
      c.fillStyle = '#6d727b'; rrect(c, it.x + 1, it.y + 1, it.w - 2, it.h - 3, 3.4);
      c.fillStyle = 'rgba(245,245,240,0.85)';
      if (it.nose) { // nose-in bays: lines run front to back
        const bw = (it.w - 4) / it.bays;
        for (let i = 1; i < it.bays; i++) c.fillRect(it.x + 2 + i * bw - 0.7, it.y + 4, 1.4, it.h - 8);
      } else {
        const bh = (it.h - 4) / it.bays;
        for (let i = 1; i < it.bays; i++) c.fillRect(it.x + 4, it.y + 2 + i * bh - 0.7, it.w - 8, 1.4);
      }
      break;
    }
    case 'court':
      if (it.kind === 'lawn') {
        c.fillStyle = '#9aa0a8'; rrect(c, it.x, it.y, it.w, it.h, 4);
        c.fillStyle = '#5c9f4c'; rrect(c, it.x + 1.6, it.y + 1.6, it.w - 3.2, it.h - 3.2, 3);
        c.fillStyle = '#74b85e'; rrect(c, it.x + 2.6, it.y + 2.4, it.w - 6.4, it.h * 0.5, 2.6);
      } else {
        const cx = it.x + it.w / 2, cy = it.y + it.h / 2, R = it.w / 2;
        c.fillStyle = '#9da3ab'; ell(c, cx, cy, R, R * 0.9);
        c.fillStyle = '#d5d8dc'; ell(c, cx, cy - 0.6, R - 1.6, (R - 1.6) * 0.9);
        c.fillStyle = '#8a929c'; ell(c, cx, cy, R * 0.52, R * 0.47);
        c.fillStyle = '#5fa6d2'; ell(c, cx, cy - 0.4, R * 0.42, R * 0.37);
        c.fillStyle = '#a5d4ee'; ell(c, cx - R * 0.1, cy - R * 0.1, R * 0.22, R * 0.17);
      }
      break;
  }
}

/** Paints the flat ground things of a plan. */
export function drawDressingGround(c: Ctx, f: LotField, items: readonly GroundItem[]): void {
  for (const it of items) { c.save(); drawGroundItem(c, f, it); c.restore(); }
}

// ── Props ────────────────────────────────────────────────────────────────────
function drawProp(c: Ctx, p: PropItem, trees: Partial<Record<TreeName, CanvasImageSource>>): void {
  switch (p.k) {
    case 'tree': {
      const im = trees[p.name];
      if (im) c.drawImage(im, p.x - p.w / 2, p.y + p.R * 0.35 - p.h * p.base, p.w, p.h);
      break;
    }
    case 'bush': { const col = GREENS[p.tint % GREENS.length]; blob(c, p.x, p.y - p.R * 0.45, p.R, col[0], col[1]); break; }
    case 'planter': {
      const col = GREENS[p.tint % GREENS.length], R = p.R;
      c.fillStyle = '#8a4f33'; ell(c, p.x, p.y - R * 0.25, R, R * 0.72);
      c.fillStyle = '#b86d45'; ell(c, p.x, p.y - R * 0.5, R, R * 0.66);
      blob(c, p.x, p.y - R * 0.95, R * 0.82, col[0], col[1]);
      break;
    }
    case 'bed': {
      const x = p.x - p.w / 2, y = p.y - p.h;
      c.fillStyle = '#5d3d28'; rrect(c, x, y, p.w, p.h, 3);
      c.fillStyle = '#7d5638'; rrect(c, x + 1.2, y + 1, p.w - 2.4, p.h - 3.4, 2.2);
      for (let i = 0; i < p.dots.length; i += 3) {
        c.fillStyle = '#3d8532'; circle(c, p.dots[i] + 0.6, p.dots[i + 1] + 0.8, 1.9);
        c.fillStyle = FLOWERS[p.dots[i + 2] % FLOWERS.length]; circle(c, p.dots[i], p.dots[i + 1], 1.7);
      }
      break;
    }
    case 'scrub':
      for (let i = 0; i < p.blobs.length; i += 3) blob(c, p.blobs[i], p.blobs[i + 1] - p.blobs[i + 2] * 0.6, p.blobs[i + 2], '#7f8a3a', '#a3aa55');
      break;
    case 'car': {
      const col = CARS[p.colour % CARS.length], x = p.x - p.w / 2, y = p.y - p.h;
      c.fillStyle = 'rgba(25,35,45,0.28)'; rrect(c, x + 1.5, y + 2, p.w, p.h, 4);
      c.fillStyle = col[0]; rrect(c, x, y, p.w, p.h, 4);
      c.fillStyle = col[1]; rrect(c, x + 1, y + 0.6, p.w - 2, p.h - 3, 3.4);
      if (p.h > p.w) { // parked nose-in: the cabin runs across, set towards the back
        const cy = p.flip ? y + p.h * 0.2 : y + p.h * 0.28, ch = p.h * 0.52;
        c.fillStyle = '#2f3a46'; rrect(c, x + 2.4, cy, p.w - 4.8, ch, 2.4);
        c.fillStyle = col[1]; rrect(c, x + 3.2, cy + ch * 0.22, p.w - 6.4, ch * 0.56, 1.6);
        break;
      }
      // cabin: glass with a roof panel, set towards the back of the car
      const cx = p.flip ? x + p.w * 0.2 : x + p.w * 0.28, cw = p.w * 0.52;
      c.fillStyle = '#2f3a46'; rrect(c, cx, y + 1.8, cw, p.h - 5.2, 2.4);
      c.fillStyle = col[1]; rrect(c, cx + cw * 0.22, y + 2.6, cw * 0.56, p.h - 6.8, 1.6);
      break;
    }
  }
}

/** Paints the standing things of a plan; `props` must already be sorted by y. */
export function drawDressingProps(c: Ctx, props: readonly PropItem[], trees: Partial<Record<TreeName, CanvasImageSource>>): void {
  for (const p of props) { c.save(); drawProp(c, p, trees); c.restore(); }
}
