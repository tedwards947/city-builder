// Leisure buildings (LEISURE_DESIGN.md), the owner's picks from the leisure
// review page (2026-11-20): museum 1b, stadium #4, big parks #9/#10, 2×2 parks
// #7/#8, plazas #13/#14. Sprites are `leisure/<name>` (art/clay-set/cutout.mjs).
//
// The stadium also draws its 2-tile entrance plaza, its countdown pin, and its
// event days from sim/eventDays.ts eventStatus: the day before, set-up S3 (a
// TV truck and an articulated truck park on the plaza, a forklift unloads flight
// cases, the pitch is mown into fresh stripes, and at dusk the floodlights are
// tested); on game day the floodlights, a glow over the pitch, two sweeping
// spotlights and camera flashes in the stands, more as the seats fill. No fans
// walk the streets (owner: it would clash with the traffic).

import {
  BUILDING_BIG_PARK, BUILDING_MID_PARK, BUILDING_MUSEUM, BUILDING_PLAZA, BUILDING_STADIUM, BUILDING_BEACH_PARK, BUILDING_LIDO,
} from '../../sim/constants';
import type { EventStatus } from '../../sim/eventDays';
import { BALANCE } from '../../data/balance';
import { t as tr } from '../../i18n';
import { leisureClaySprite, drawClaySprite } from './ClaySprites';
import { LEISURE_SPRITES } from './leisureSpriteData';

const DESIGNS: Record<number, readonly string[]> = {
  [BUILDING_MUSEUM]: ['museum'],
  [BUILDING_STADIUM]: ['stadium'],
  [BUILDING_BIG_PARK]: ['bigpark-a', 'bigpark-b'],
  [BUILDING_MID_PARK]: ['midpark-a', 'midpark-b'],
  [BUILDING_PLAZA]: ['plaza-a', 'plaza-b'],
};
/** Kinds drawn wide (3×2) or tall (2×3) by how they are turned: `<name>-wide` / `<name>-tall`. */
const TURNED: Record<number, string> = {
  [BUILDING_BEACH_PARK]: 'beach-a',
  [BUILDING_LIDO]: 'beach-b',
};

/** Whether `kind` has leisure art, and its sprite has loaded (`variant`: the anchor tile's visualVariant picks the design). */
export function leisureSprite(kind: number, variant: number, wide = true) {
  if (TURNED[kind]) return leisureClaySprite(`${TURNED[kind]}-${wide ? 'wide' : 'tall'}`);
  const list = DESIGNS[kind];
  return list ? leisureClaySprite(list[variant % list.length]) : undefined;
}

// ── Props (the beach and event sheet, clay/beachProps.ts loads the same images) ──
const imgs: Record<string, HTMLImageElement> = {};
function prop(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, tile: number, pop = 1): void {
  let img = imgs[name];
  if (!img) {
    if (typeof Image === 'undefined') return;
    img = imgs[name] = new Image();
    img.src = `${import.meta.env.BASE_URL}sprites/clay/leisure/${name}.png`;
  }
  if (!img.complete || img.naturalWidth === 0) return;
  const m = LEISURE_SPRITES[name], k = tile / 128 * pop;
  ctx.drawImage(img, x - m.footX * k, y - m.footY * k, m.w * k, m.h * k);
}

// ── The stadium's own points, as shares of its 4×4 plot ───────────────────────
// u: 0 at the plot's left edge → 1 at its right; v: 0 at its front edge → 1 at its back (higher for things that rise).
const FIELD = { u: 0.505, v: 0.497, hu: 0.181, hv: 0.084 };
const MASTS: readonly [number, number][] = [[0.146, 0.975], [0.865, 0.975], [0.129, 0.435], [0.883, 0.435]];
const STANDS = { u: 0.5, v: 0.588, inU: 0.21, inV: 0.14, outU: 0.39, outV: 0.32 };

/** Today's phase, smoothed between ticks: the tick's own fraction is estimated from how long the last tick took. */
const smooth = { tick: -1, at: 0, dur: 1000 };
function smoothPhase(status: EventStatus, tick: number, now: number): number {
  if (tick !== smooth.tick) {
    if (smooth.tick >= 0 && tick === smooth.tick + 1) smooth.dur = Math.min(8000, Math.max(100, now - smooth.at));
    smooth.tick = tick; smooth.at = now;
  }
  return Math.min(0.9999, status.phase + Math.min(1, (now - smooth.at) / smooth.dur) / BALANCE.ticksPerDay);
}

const hash = (n: number): number => { let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const ease = (f: number): number => f * f * (3 - 2 * f);

/**
 * Draws a leisure building whose footprint's top-left tile is at (L, T), w × d
 * tiles, `tile` pixels a tile. Returns false (draw the stand-in) until its art has loaded.
 * `status` is the city's event status (stadium only), `tick` the world tick.
 */
export function drawLeisureBuilding(ctx: CanvasRenderingContext2D, kind: number, variant: number, L: number, T: number, w: number, d: number, tile: number,
  now: number, status: EventStatus | null, tick: number): boolean {
  const sprite = leisureSprite(kind, variant, w >= d);
  if (!sprite) return false;
  if (TURNED[kind]) {
    // Like a shop pair: the sprite's plot is w tiles wide and d deep, drawn as if square and w wide.
    drawClaySprite(ctx, sprite, L, T + (d - w) * tile, w * tile);
    return true;
  }
  if (kind !== BUILDING_STADIUM) {
    const n = kind === BUILDING_BIG_PARK ? 3 : 2;
    drawClaySprite(ctx, sprite, L, T, n * tile);
    return true;
  }
  const side = 4 * tile, X = (u: number) => L + u * side, Y = (v: number) => T + side - v * side;
  drawEntrance(ctx, L + tile, T + side, tile);
  drawClaySprite(ctx, sprite, L, T, side);
  if (!status) return true;
  const phase = smoothPhase(status, tick, now), sec = now / 1000;
  const setUp = status.daysToEvent === 1, gameDay = status.eventToday;
  if (setUp) {
    drawMowing(ctx, X, Y, side, phase);
    // Parked on the entrance plaza: the articulated truck on its left tile, the TV truck on its right.
    const fork = ease(Math.abs(((sec / 5) % 2) - 1));   // there and back every 10 s
    const cases = (phase - 0.15) / 0.5;
    if (cases > 0) prop(ctx, 'cases', L + tile * 1.95, T + side + tile * 0.05, tile);
    if (cases > 0.5) prop(ctx, 'cases', L + tile * 2.3, T + side + tile * 0.05, tile);
    prop(ctx, 'truck-artic', L + tile * 1.5, T + side + tile * 0.92, tile);
    prop(ctx, 'forklift', L + tile * (1.45 + 0.4 * fork), T + side + tile * (0.55 - 0.35 * fork), tile);
    prop(ctx, 'truck-tv', L + tile * 2.62, T + side + tile * 0.62, tile);
    // At dusk the floodlights are tested: a flicker.
    if (phase > 0.85 && Math.sin(sec * 23) > -0.2 && Math.sin(sec * 7) > -0.6) drawLights(ctx, X, Y, tile, sec, 0, false);
  } else if (gameDay) {
    prop(ctx, 'truck-tv', L + tile * 2.62, T + side + tile * 0.62, tile);
    drawLights(ctx, X, Y, tile, sec, status.seats > 0 ? status.fans / status.seats : 0, true);
  }
  if (status.connected && status.daysToEvent <= 6) {
    const label = status.daysToEvent === 0 ? (gameDay ? tr('ui.stadiumPin.today') : '') : status.daysToEvent === 1 ? tr('ui.stadiumPin.tomorrow') : tr('ui.stadiumPin.inDays', { n: status.daysToEvent });
    if (label) drawPin(ctx, X(0.5), Y(1.08), tile, label, gameDay, sec);
  }
  return true;
}

/** The 2-tile entrance plaza below the bowl (offsets (1,4) and (2,4)): concrete paving like the bowl's own forecourt. */
function drawEntrance(ctx: CanvasRenderingContext2D, x: number, y: number, tile: number): void {
  const w = 2 * tile, lip = Math.max(1, Math.round(tile * 0.041));
  ctx.fillStyle = '#c8c3b9';
  ctx.fillRect(x, y, w, tile - lip);
  ctx.fillStyle = '#7a5a3c';
  ctx.fillRect(x, y + tile - lip, w, lip);
  if (tile < 12) return;
  ctx.strokeStyle = 'rgba(120,112,100,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 1; k < 6; k++) { const yy = Math.round(y + k * (tile - lip) / 6) + 0.5; ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); }
  for (let k = 1; k < 8; k++) { const xx = Math.round(x + k * w / 8) + 0.5; ctx.moveTo(xx, y); ctx.lineTo(xx, y + tile - lip); }
  ctx.stroke();
  // Planters with clipped bushes along both sides.
  for (const side of [0.08, 1.92]) for (let k = 0; k < 3; k++) {
    const cx = x + side * tile, cy = y + tile * (0.2 + k * 0.28), r = tile * 0.075;
    ctx.fillStyle = 'rgba(40,36,28,0.25)'; ctx.beginPath(); ctx.ellipse(cx + r * 0.5, cy + r * 0.7, r, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4f8a3c'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6fae55'; ctx.beginPath(); ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.5, 0, Math.PI * 2); ctx.fill();
  }
}

/** The day before: fresh stripes mown across the pitch through the day, with the mower on the stripe it is cutting. */
function drawMowing(ctx: CanvasRenderingContext2D, X: (u: number) => number, Y: (v: number) => number, side: number, phase: number): void {
  const f = Math.max(0, Math.min(1, (phase - 0.1) / 0.65)), n = 10;
  if (f <= 0) return;
  const x0 = X(FIELD.u - FIELD.hu), x1 = X(FIELD.u + FIELD.hu), y0 = Y(FIELD.v + FIELD.hv), y1 = Y(FIELD.v - FIELD.hv), w = (x1 - x0) / n;
  for (let j = 0; j < n * f; j++) {
    ctx.fillStyle = j % 2 ? 'rgba(255,255,255,0.13)' : 'rgba(0,60,0,0.1)';
    ctx.fillRect(x0 + j * w, y0, Math.min(w, (n * f - j) * w), y1 - y0);
  }
  if (f < 1) {
    const j = Math.floor(n * f), u = n * f - j, s = Math.max(2, side * 0.012);
    ctx.fillStyle = '#d9472b';
    ctx.fillRect(x0 + (j + 0.5) * w - s, y0 + (j % 2 ? 1 - u : u) * (y1 - y0) - s, 2 * s, 2 * s);
  }
}

/** Floodlights on the masts with their beams on the pitch; on game day also the pitch glow, two sweeping spotlights and flashes (`full`: share of seats filled). */
function drawLights(ctx: CanvasRenderingContext2D, X: (u: number) => number, Y: (v: number) => number, tile: number, sec: number, full: number, game: boolean): void {
  const fx = X(FIELD.u), fy = Y(FIELD.v);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (game) {
    const r = ctx.createRadialGradient(fx, fy, tile * 0.1, fx, fy, tile * 1.5);
    r.addColorStop(0, 'rgba(255,248,215,0.4)'); r.addColorStop(1, 'rgba(255,248,215,0)');
    ctx.fillStyle = r;
    ctx.beginPath(); ctx.ellipse(fx, fy, tile * 1.6, tile * 1.2, 0, 0, Math.PI * 2); ctx.fill();
  }
  for (const [u, v] of MASTS) {
    const mx = X(u), my = Y(v);
    const beam = ctx.createLinearGradient(mx, my, fx, fy);
    beam.addColorStop(0, 'rgba(255,250,220,0.2)'); beam.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = beam;
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(fx - tile * 0.55, fy); ctx.lineTo(fx + tile * 0.55, fy); ctx.closePath(); ctx.fill();
    const h = ctx.createRadialGradient(mx, my, 0, mx, my, tile * 0.32);
    h.addColorStop(0, 'rgba(255,255,235,0.95)'); h.addColorStop(0.3, 'rgba(255,245,200,0.35)'); h.addColorStop(1, 'rgba(255,245,200,0)');
    ctx.fillStyle = h;
    ctx.beginPath(); ctx.arc(mx, my, tile * 0.32, 0, Math.PI * 2); ctx.fill();
  }
  if (game) {
    // Two spotlights from the front corners of the bowl, sweeping the sky.
    for (const [u, ph] of [[0.22, 0], [0.78, 2]] as const) {
      const bx = X(u), by = Y(0.12), a = -Math.PI / 2 + Math.sin(sec * 0.7 + ph) * 0.55, len = tile * 5;
      const g = ctx.createLinearGradient(bx, by, bx + Math.cos(a) * len, by + Math.sin(a) * len);
      g.addColorStop(0, 'rgba(200,225,255,0.32)'); g.addColorStop(1, 'rgba(200,225,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(a - 0.06) * len, by + Math.sin(a - 0.06) * len);
      ctx.lineTo(bx + Math.cos(a + 0.06) * len, by + Math.sin(a + 0.06) * len);
      ctx.closePath(); ctx.fill();
    }
    // Camera flashes in the stands: a few a frame at a full house, a stable spread from the frame's time.
    const n = Math.round(6 * Math.max(0.15, full)), frame = Math.floor(sec * 20), s = Math.max(1, tile * 0.025);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    for (let k = 0; k < n; k++) {
      if (hash(frame * 31 + k) < 0.5) continue;
      const a = hash(frame * 17 + k * 7) * Math.PI * 2, f = hash(frame * 13 + k * 3);
      const ru = STANDS.inU + (STANDS.outU - STANDS.inU) * f, rv = STANDS.inV + (STANDS.outV - STANDS.inV) * f;
      ctx.fillRect(X(STANDS.u + Math.cos(a) * ru) - s, Y(STANDS.v + Math.sin(a) * rv) - s, 2 * s, 2 * s);
    }
  }
  ctx.restore();
}

/** The countdown pin over the venue: a rounded tag with a little football; gold, and bobbing, on game day. */
function drawPin(ctx: CanvasRenderingContext2D, x: number, y: number, tile: number, label: string, today: boolean, sec: number): void {
  const fs = Math.round(Math.max(11, Math.min(16, tile * 0.24)));
  ctx.save();
  ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`;
  const h = fs * 2, w = ctx.measureText(label).width + fs * 2.3, by = y - h - fs * 0.6 + (today ? Math.sin(sec * 3) * 2 : 0), bx = x - w / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.roundRect(bx + 2, by + 3, w, h, h / 2); ctx.fill();
  ctx.fillStyle = today ? '#ffd34d' : '#fffaf0';
  ctx.beginPath(); ctx.roundRect(bx, by, w, h, h / 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - fs * 0.4, by + h - 1); ctx.lineTo(x + fs * 0.4, by + h - 1); ctx.lineTo(x, by + h + fs * 0.55); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#8a4b24';
  ctx.beginPath(); ctx.ellipse(bx + fs * 1.05, by + h / 2, fs * 0.45, fs * 0.29, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#24211d';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, bx + fs * 1.75, by + h / 2 + 1);
  ctx.restore();
}
