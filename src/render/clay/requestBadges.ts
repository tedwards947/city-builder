// Resident requests on the map: a round teal badge over the area that is
// asking, with a glyph for what it wants and a white ring that empties as the
// deadline nears. Badges that would overlap merge into one with a count,
// showing the request that runs out first. When a request is met or missed a
// tick or a cross stands in its place for a moment.

import type { OpenRequest } from '../../sim/requests';
import { seedTile } from './tileOutline';

export const REQUEST_COLOUR = '#2f9c86';
const MET_COLOUR = '#3a9a4a', MISSED_COLOUR = '#7a7f87';
export const REQUEST_BADGE_R = 13;

export interface RequestBadge {
  x: number;
  y: number;
  r: number;
  /** The request shown: of those merged here, the one nearest its deadline. */
  request: OpenRequest;
  /** Share of its time still left, 0–1. */
  left: number;
  /** How many requests this badge stands for. */
  count: number;
}

/** A request that has just ended: where (tile coordinates), how, and how far through its moment (0–1). */
export interface RequestOutcome { tx: number; ty: number; met: boolean; age: number }

/** Share of a request's time still left at `tick`, 0–1. */
export function timeLeft(req: OpenRequest, tick: number): number {
  const span = req.deadlineTick - req.openedTick;
  return span <= 0 ? 0 : Math.max(0, Math.min(1, (req.deadlineTick - tick) / span));
}

/**
 * Where to draw the badges: one on the home that asked (given `gridWidth`, for
 * a request that names one), otherwise at the centre of the request's area, merging
 * any that would overlap on screen. `toScreen` maps tile coordinates to pixels.
 */
export function layoutRequestBadges(
  requests: readonly OpenRequest[],
  tick: number,
  toScreen: (tx: number, ty: number) => { x: number; y: number },
  r = REQUEST_BADGE_R,
  gridWidth = 0,
): RequestBadge[] {
  const out: RequestBadge[] = [];
  // Soonest deadline first, so a merged badge shows the most urgent request.
  const sorted = [...requests].sort((a, b) => a.deadlineTick - b.deadlineTick);
  for (const request of sorted) {
    const seed = seedTile(request, gridWidth);
    const { x, y } = seed ? toScreen(seed.x + 0.5, seed.y + 0.5) : toScreen((request.x0 + request.x1 + 1) / 2, (request.y0 + request.y1 + 1) / 2);
    const near = out.find(b => Math.hypot(b.x - x, b.y - y) < (b.r + r) * 0.9);
    if (near) { near.count++; near.r = r + 2; continue; }
    out.push({ x, y, r, request, left: timeLeft(request, tick), count: 1 });
  }
  return out;
}

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, colour: string): void {
  ctx.fillStyle = 'rgba(10,12,16,0.35)';
  ctx.beginPath(); ctx.arc(x + r * 0.08, y + r * 0.14, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f4f0e6';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = colour;
  ctx.beginPath(); ctx.arc(x, y, r * 0.82, 0, Math.PI * 2); ctx.fill();
}

/** The white glyph for what a request wants. Unknown kinds get a plain dot. */
function glyph(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, kind: string, colour: string): void {
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = Math.max(1.3, r * 0.15);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (kind === 'park') {                       // a tree
    ctx.beginPath(); ctx.arc(x, y - r * 0.14, r * 0.36, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(x - r * 0.07, y + r * 0.1, r * 0.14, r * 0.42);
  } else if (kind === 'schoolOrHospital' || kind === 'school') {    // a mortarboard (a plain cross would read as the sickness pin)
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.42); ctx.lineTo(x + r * 0.58, y - r * 0.12); ctx.lineTo(x, y + r * 0.18); ctx.lineTo(x - r * 0.58, y - r * 0.12);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - r * 0.3, y + r * 0.12); ctx.lineTo(x - r * 0.3, y + r * 0.36);
    ctx.quadraticCurveTo(x, y + r * 0.56, x + r * 0.3, y + r * 0.36); ctx.lineTo(x + r * 0.3, y + r * 0.12);
    ctx.lineTo(x, y + r * 0.3); ctx.closePath(); ctx.fill();
  } else if (kind === 'hospital') {            // a cross, heavier than the sickness pin's and inside the request ring
    const a = r * 0.17, l = r * 0.5;
    ctx.fillRect(x - a, y - l, a * 2, l * 2);
    ctx.fillRect(x - l, y - a, l * 2, a * 2);
  } else if (kind === 'fire') {                // a flame
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.6);
    ctx.quadraticCurveTo(x + r * 0.5, y - r * 0.1, x + r * 0.36, y + r * 0.26);
    ctx.quadraticCurveTo(x + r * 0.22, y + r * 0.58, x, y + r * 0.58);
    ctx.quadraticCurveTo(x - r * 0.4, y + r * 0.56, x - r * 0.38, y + r * 0.14);
    ctx.quadraticCurveTo(x - r * 0.34, y - r * 0.1, x - r * 0.14, y - r * 0.16);
    ctx.quadraticCurveTo(x - r * 0.12, y - r * 0.4, x, y - r * 0.6);
    ctx.closePath(); ctx.fill();
  } else if (kind === 'policeOrFire' || kind === 'police') {        // a shield
    ctx.beginPath();
    ctx.moveTo(x - r * 0.4, y - r * 0.42); ctx.lineTo(x + r * 0.4, y - r * 0.42); ctx.lineTo(x + r * 0.4, y + r * 0.05);
    ctx.quadraticCurveTo(x + r * 0.33, y + r * 0.44, x, y + r * 0.56);
    ctx.quadraticCurveTo(x - r * 0.33, y + r * 0.44, x - r * 0.4, y + r * 0.05);
    ctx.closePath(); ctx.fill();
  } else if (kind === 'utilities') {           // a bolt
    ctx.beginPath();
    ctx.moveTo(x + r * 0.12, y - r * 0.58); ctx.lineTo(x - r * 0.34, y + r * 0.08); ctx.lineTo(x - r * 0.02, y + r * 0.08);
    ctx.lineTo(x - r * 0.12, y + r * 0.58); ctx.lineTo(x + r * 0.34, y - r * 0.1); ctx.lineTo(x + r * 0.02, y - r * 0.1);
    ctx.closePath(); ctx.fill();
  } else if (kind === 'airport') {             // a plane seen from above, climbing to the upper right
    const P: [number, number][] = [[0, -0.6], [0.09, -0.46], [0.09, -0.12], [0.56, 0.12], [0.56, 0.23], [0.09, 0.08], [0.08, 0.38], [0.24, 0.5], [0.24, 0.59], [0, 0.51]];
    const pts = [...P, ...P.slice(1, -1).reverse().map(([px, py]): [number, number] => [-px, py])];
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
    ctx.beginPath(); pts.forEach(([px, py], k) => (k ? ctx.lineTo(px * r, py * r) : ctx.moveTo(px * r, py * r))); ctx.closePath(); ctx.fill();
    ctx.restore();
  } else if (kind === 'trafficJam') {          // a car, side on
    ctx.beginPath(); ctx.roundRect(x - r * 0.52, y - r * 0.05, r * 1.04, r * 0.3, r * 0.08); ctx.fill();
    ctx.beginPath(); ctx.roundRect(x - r * 0.28, y - r * 0.32, r * 0.56, r * 0.32, r * 0.08); ctx.fill();
    ctx.fillStyle = colour;
    ctx.beginPath(); ctx.arc(x - r * 0.28, y + r * 0.27, r * 0.1, 0, Math.PI * 2); ctx.arc(x + r * 0.28, y + r * 0.27, r * 0.1, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'blight') {              // a house with a crack
    ctx.beginPath();
    ctx.moveTo(x - r * 0.46, y - r * 0.02); ctx.lineTo(x, y - r * 0.5); ctx.lineTo(x + r * 0.46, y - r * 0.02);
    ctx.lineTo(x + r * 0.34, y - r * 0.02); ctx.lineTo(x + r * 0.34, y + r * 0.46); ctx.lineTo(x - r * 0.34, y + r * 0.46); ctx.lineTo(x - r * 0.34, y - r * 0.02);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = colour; ctx.lineWidth = Math.max(1.1, r * 0.11);
    ctx.beginPath(); ctx.moveTo(x + r * 0.06, y - r * 0.3); ctx.lineTo(x - r * 0.08, y); ctx.lineTo(x + r * 0.1, y + r * 0.16); ctx.lineTo(x - r * 0.02, y + r * 0.46); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(x, y, r * 0.22, 0, Math.PI * 2); ctx.fill();
  }
}

/** One request badge: disc, glyph, the countdown ring round it, and a count if it stands for several. */
export function drawRequestBadge(ctx: CanvasRenderingContext2D, b: RequestBadge): void {
  const { x, y, r } = b;
  disc(ctx, x, y, r, REQUEST_COLOUR);
  glyph(ctx, x, y, r, b.request.kind, REQUEST_COLOUR);
  // Countdown: a track, and a white arc that shrinks clockwise from the top as time runs out.
  const rr = r + 3.5;
  ctx.lineWidth = 2.5; ctx.lineCap = 'butt';
  ctx.strokeStyle = 'rgba(10,18,28,0.55)';
  ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke();
  if (b.left > 0) {
    ctx.strokeStyle = b.left < 0.25 ? '#ffd166' : '#fff';
    ctx.beginPath(); ctx.arc(x, y, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * b.left); ctx.stroke();
  }
  if (b.count > 1) {
    const px = x + r * 0.95, py = y + r * 0.8;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#12303a';
    ctx.font = '700 10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(b.count), px, py + 0.5);
  }
}

/** A request just met (green tick) or missed (grey cross); `age` 0–1 fades it out at the end. */
export function drawRequestOutcome(ctx: CanvasRenderingContext2D, x: number, y: number, met: boolean, age: number): void {
  const r = REQUEST_BADGE_R + (met ? 3 * Math.sin(Math.min(1, age * 5) * Math.PI) : 0);   // a met request pops once
  ctx.save();
  ctx.globalAlpha = age > 0.7 ? Math.max(0, (1 - age) / 0.3) : 1;
  const colour = met ? MET_COLOUR : MISSED_COLOUR;
  disc(ctx, x, y, r, colour);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, r * 0.2); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  if (met) {
    ctx.moveTo(x - r * 0.38, y + r * 0.02); ctx.lineTo(x - r * 0.1, y + r * 0.3); ctx.lineTo(x + r * 0.4, y - r * 0.28);
  } else {
    ctx.moveTo(x - r * 0.3, y - r * 0.3); ctx.lineTo(x + r * 0.3, y + r * 0.3);
    ctx.moveTo(x + r * 0.3, y - r * 0.3); ctx.lineTo(x - r * 0.3, y + r * 0.3);
  }
  ctx.stroke();
  ctx.restore();
}
