// The airport (art/clay-set/airport3.html and the owner's picks from three
// workshop rounds): a straight-on steel-and-glass terminal with a tower and a
// hangar along the north of its footprint (a 12×4 block over an 18-tile runway row), an apron with three gates and
// jet bridges (J2: down onto the nose from the right, telescoping), and runway 9
// along the south, running 3 tiles past the block at each end, with edge lights and approach lights whose flash races
// towards the runway. Planes are side-on pictures that never turn (P2, 2 tiles
// long; red, navy and sky blue, now and then orca or kawaii; no panda), so they
// slide sideways between the runway and the gates (M1).
//
// Like the ships, nothing is simulated: one arrival-and-departure cycle a minute
// is worked out from the clock while the airport has a road, so it costs nothing
// off screen and needs no saving. The airport never turns, so everything is laid
// out in tiles from its block's top-left corner (the runway row reaches x −3 to 15).

import { AIRPORT_SPRITES, type AirportSpriteMeta } from './airportSpriteData';
import { t as tr } from '../../i18n';

interface Loaded { img: HTMLImageElement; m: AirportSpriteMeta }
let sprites: Record<string, Loaded> | null = null;

function load(): Record<string, Loaded> | null {
  if (sprites) return sprites;
  if (typeof Image === 'undefined') return null;
  const base = import.meta.env.BASE_URL;
  sprites = {};
  for (const [name, m] of Object.entries(AIRPORT_SPRITES)) {
    const img = new Image();
    img.src = `${base}sprites/clay/airport/${name}.png`;
    sprites[name] = { img, m };
  }
  return sprites;
}

/** True once every airport image has loaded (until then the code-drawn stand-in shows). */
export function airportArtReady(): boolean {
  const s = load();
  return !!s && Object.values(s).every(l => l.img.complete && l.img.naturalWidth > 0);
}

// ── Layout, in tiles from the footprint's top-left corner ──
/** Runway: centre line (the middle of the runway row), width, ends (approach lights fill the grass west of it, in the overrun). */
export const RUNWAY = { y: 4.5, w: 0.8, x0: -1.4, x1: 13.9 };
/** Gate row (planes' wheels), taxilane, the three gates' plane centres, where arrivals leave the runway and departures join it. */
export const GATE_Y = 2.3, TAXI_Y = 3.0, GATES = [2.9, 5.6, 8.3] as const, EXIT_X = 7.4, DEPART_X = 2.6;
/** Where an arriving plane touches down. A plane is this many tiles long. */
const TOUCH_X = 0.8, PLANE = 2;
/** The terminal's front (the line it stands on) and middle; the tower's and hangar's feet. */
const TERM_Y = 1.1, TERM_X = 6.2, TOWER = [0.9, 1.0] as const, HANGAR = [11.3, 1.1] as const;
const APRON = { x0: 0, y0: 0.95, x1: 12, y1: 3.4 };
/** Seconds in one cycle: land, park, turn round, take off, a little quiet. Planes stay in sight a long way out (owner: they should last longer before fading). */
export const CYCLE_S = 70;
/** The approach takes LAND_S seconds; everything on the ground runs SHIFT seconds later than the first cut's 5 s approach did. */
const LAND_S = 12, SHIFT = LAND_S - 5;

const E = (f: number) => f * f * (3 - 2 * f), clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, f: number) => a + (b - a) * f, seg = (c: number, t0: number, t1: number) => clamp((c - t0) / (t1 - t0), 0, 1);
const hash = (n: number) => { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };

/** A plane: wheels at (x, y) tiles, `alt` tiles up in the air, opacity `a`. */
export interface PlaneState { x: number; y: number; alt: number; a: number }

/** The plane of the cycle at second `c` (0 ≤ c < CYCLE_S), or null in the quiet at the end. */
export function airportPlaneAt(t: number): PlaneState | null {
  const at = (x: number, y: number, alt = 0, a = 1): PlaneState => ({ x, y, alt, a });
  const R = RUNWAY.y, G = GATES[2];
  if (t < LAND_S) { const f = t / LAND_S; return at(TOUCH_X - 18 * (1 - f), R, 4 * Math.pow(1 - f, 1.3), seg(t, 0, 1.5)); }   // a long approach, in sight from 18 tiles out
  const c = t - SHIFT;
  if (c < 10) { const f = (c - 5) / 5; return at(lerp(TOUCH_X, EXIT_X, 1 - (1 - f) * (1 - f)), R); }                 // roll-out
  if (c < 13.5) return at(EXIT_X, lerp(R, GATE_Y, E((c - 10) / 3.5)));                                                // slide off the runway
  if (c < 16) { const f = (c - 13.5) / 2.5; return at(lerp(EXIT_X, G, 1 - (1 - f) * (1 - f)), GATE_Y); }             // pull up to the bridge
  if (c < 34) return at(G, GATE_Y);
  if (c < 36) { const f = E((c - 34) / 2); return at(G - 0.5 * f, lerp(GATE_Y, TAXI_Y, f)); }                         // pushback off the gate
  if (c < 44) return at(lerp(G - 0.5, DEPART_X, E((c - 36) / 8)), TAXI_Y);                                            // pushed along the taxilane
  if (c < 45.5) return at(DEPART_X, TAXI_Y);
  if (c < 49) return at(DEPART_X, lerp(TAXI_Y, R, E((c - 45.5) / 3.5)));                                              // slide onto the runway
  if (c < 59) { const f = (c - 49) / 10, x = DEPART_X + 34 * f * f; return at(x, R, Math.max(0, x - DEPART_X - 6.5) * 0.35, 1 - seg(x, 25, 34)); }   // take-off, climbing out of sight
  return null;
}

/** How far the active gate's bridge is out at second `c`: 0 pulled back … 1 at the door. */
export function bridgeOut(t: number): number {
  const c = t - SHIFT;
  return c < 16 ? 0 : c < 17.5 ? E((c - 16) / 1.5) : c < 31.5 ? 1 : c < 33 ? 1 - E((c - 31.5) / 1.5) : 0;
}

const COMMON = ['plane-red', 'plane-navy', 'plane-blue'], NOVELTY = ['plane-orca', 'plane-kawaii'];
/** The livery of plane `n` (a cycle, or a parked plane): mostly the three plain ones, one in ten each the orca or the kawaii. */
export function airportLivery(n: number): string {
  const r = hash(n * 7 + 1);
  return r < 0.1 ? NOVELTY[0] : r < 0.2 ? NOVELTY[1] : COMMON[Math.floor(hash(n * 13 + 5) * 3)];
}

interface Vehicle { n: string; x: number; y: number; flip?: boolean; a?: number }
function vehicles(t: number, p: PlaneState | null): Vehicle[] {
  const c = t - SHIFT, V: Vehicle[] = [], G = GATES[2], OUT = 12.5;
  const visit = (n: string, t0: number, t1: number, t2: number, t3: number, x: number, y: number) => {
    if (c < t0 || c >= t3) return;
    const out = c >= t2;
    V.push({ n, x: out ? lerp(x, OUT, E(seg(c, t2, t3))) : lerp(OUT, x, E(seg(c, t0, t1))), y, flip: !out, a: Math.min(seg(c, t0, t0 + 0.6), 1 - seg(c, t3 - 0.6, t3)) });
  };
  visit('bags', 17, 20, 27, 30.5, G - 0.6, GATE_Y + 0.5);
  visit('fuel', 18, 21, 25, 28, G + 1.6, GATE_Y + 0.3);
  const nose = (x: number) => x + PLANE / 2 + 0.25;
  if (c >= 31 && c < 34) V.push({ n: 'tug', x: lerp(OUT, nose(G), E(seg(c, 31, 34))), y: GATE_Y + 0.03, flip: true, a: seg(c, 31, 31.6) });
  else if (c >= 34 && c < 44.5 && p) V.push({ n: 'tug', x: nose(p.x), y: p.y + 0.03, flip: true });
  else if (c >= 44.5 && c < 48) V.push({ n: 'tug', x: lerp(nose(DEPART_X), OUT, E(seg(c, 44.5, 48))), y: TAXI_Y + 0.03, a: 1 - seg(c, 47.4, 48) });
  V.push({ n: 'catering', x: GATES[0] + 0.95, y: GATE_Y + 0.35 }, { n: 'stairs', x: 0.7, y: 2.2 }, { n: 'fire', x: 11.5, y: 2.85, flip: true });
  return V;
}

const APRON_C = '#bdb8ac', ASPHALT = '#4a4d52', TAXI_C = '#55585d', LINE = '#e2b737', PAINT = '#f2f2ee';

/**
 * Draws the airport with its footprint's top-left corner at screen (ox, oy) and
 * `tile` pixels a tile, at `t` seconds. `active`: planes come and go (the
 * airport has a road); otherwise only the parked planes show. `seed` (0–1)
 * staggers airports. `grass`: the map's grass colour there, for the open ground.
 */
export function drawAirport(ctx: CanvasRenderingContext2D, ox: number, oy: number, tile: number, t: number, active: boolean, seed: number, grass: string): void {
  const s = load(); if (!s) return;
  const X = (x: number) => ox + x * tile, Y = (y: number) => oy + y * tile, q = tile / 128;
  const sprite = (name: string, x: number, y: number, o: { flip?: boolean; a?: number } = {}) => {
    const l = s[name]; if (!l || !l.img.complete || !l.img.naturalWidth) return;
    const { img, m } = l;
    ctx.save(); ctx.globalAlpha = o.a ?? 1; ctx.translate(X(x), Y(y)); if (o.flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -m.footX * q, -m.footY * q, m.w * q, m.h * q); ctx.restore();
  };

  const clock = t + seed * CYCLE_S, n = Math.floor(clock / CYCLE_S), c = active ? clock - n * CYCLE_S : 20 + SHIFT;
  const p = active ? airportPlaneAt(c) : null;

  // Ground: grass, the apron with its markings, taxiways, the runway.
  ctx.save();
  ctx.fillStyle = grass; ctx.fillRect(X(0), Y(0), 12 * tile, 4 * tile); ctx.fillRect(X(-3), Y(4), 18 * tile, tile);
  ctx.fillStyle = APRON_C; ctx.fillRect(X(APRON.x0), Y(APRON.y0), (APRON.x1 - APRON.x0) * tile, (APRON.y1 - APRON.y0) * tile);
  const lw = Math.max(1, tile / 30);
  if (tile >= 12) {
    ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 1; x < 12; x++) { ctx.moveTo(X(x), Y(APRON.y0)); ctx.lineTo(X(x), Y(APRON.y1)); }
    ctx.stroke();
  }
  ctx.strokeStyle = LINE; ctx.lineWidth = lw; ctx.beginPath();
  ctx.moveTo(X(0.3), Y(TAXI_Y)); ctx.lineTo(X(11.7), Y(TAXI_Y));
  for (const g of GATES) { ctx.moveTo(X(g - 1.1), Y(GATE_Y)); ctx.lineTo(X(g + 1.1), Y(GATE_Y)); ctx.moveTo(X(g + 1.1), Y(GATE_Y - 0.15)); ctx.lineTo(X(g + 1.1), Y(GATE_Y + 0.15)); }
  ctx.stroke();
  const R = RUNWAY, ry0 = R.y - R.w / 2;
  for (const x of [DEPART_X, EXIT_X]) {
    ctx.fillStyle = TAXI_C; ctx.fillRect(X(x - 0.32), Y(APRON.y1), 0.64 * tile, (ry0 - APRON.y1) * tile + 1);
    ctx.beginPath(); ctx.moveTo(X(x), Y(TAXI_Y)); ctx.lineTo(X(x), Y(R.y)); ctx.stroke();
  }
  ctx.fillStyle = ASPHALT; ctx.fillRect(X(R.x0), Y(ry0), (R.x1 - R.x0) * tile, R.w * tile);
  ctx.fillStyle = PAINT;
  const pw = Math.max(1, tile / 40), rh = R.w * tile;
  ctx.fillRect(X(R.x0), Y(ry0) + pw, (R.x1 - R.x0) * tile, pw); ctx.fillRect(X(R.x0), Y(ry0) + rh - 2 * pw, (R.x1 - R.x0) * tile, pw);
  for (let x = R.x0 + 1.5; x < R.x1 - 1.6; x += 0.6) ctx.fillRect(X(x), Y(R.y) - pw, 0.3 * tile, 2 * pw);
  for (const [a, b] of [[R.x0 + 0.08, R.x0 + 0.45], [R.x1 - 0.45, R.x1 - 0.08]]) for (let k = 0; k < 6; k++) ctx.fillRect(X(a), Y(ry0) + rh * (0.1 + k * 0.14), (b - a) * tile, rh * 0.08);
  for (const x of [R.x0 + 2.3, R.x1 - 2.9]) for (const sg of [-1, 1]) ctx.fillRect(X(x), Y(R.y) + sg * rh * 0.22 - rh * 0.06, 0.6 * tile, rh * 0.12);
  if (tile >= 14) {
    ctx.font = `bold ${Math.round(0.42 * tile)}px -apple-system, "Helvetica Neue", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [txt, x, rot] of [['9', R.x0 + 0.85, Math.PI / 2], ['27', R.x1 - 0.85, -Math.PI / 2]] as const) { ctx.save(); ctx.translate(X(x), Y(R.y)); ctx.rotate(rot); ctx.fillText(txt, 0, 0); ctx.restore(); }
  }
  // Lights: white along the edges, green at the landing end, red at the far end, blue by the taxiways,
  // and the approach lights on the grass with the "rabbit" flash racing towards the runway twice a second.
  if (tile >= 8) {
    const r = Math.max(1, tile / 40);
    const dot = (x: number, y: number, col: string, rr = r) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(x), Y(y), rr, 0, 7); ctx.fill(); };
    for (let x = R.x0 + 0.25; x < R.x1; x += 0.5) { dot(x, ry0 + 0.04, '#fff3c4'); dot(x, R.y + R.w / 2 - 0.04, '#fff3c4'); }
    for (let k = 0; k < 5; k++) { const y = ry0 + 0.1 + k * (R.w - 0.2) / 4; dot(R.x0 + 0.03, y, '#5dff7a'); dot(R.x1 - 0.03, y, '#ff4b3e'); }
    for (const x of [DEPART_X, EXIT_X]) for (const y of [APRON.y1 + 0.08, ry0 - 0.08]) { dot(x - 0.36, y, '#4f8cff', r * 0.9); dot(x + 0.36, y, '#4f8cff', r * 0.9); }
    const N = 5, step = 0.27, lit = Math.floor(((t * 2) % 1) * (N + 2));
    for (let i = 0; i < N; i++) {
      const x = R.x0 - 0.2 - (N - 1 - i) * step;
      dot(x, R.y, '#fff3c4', r * 0.9);
      if (i === 1) { dot(x, R.y - 0.17, '#fff3c4', r * 0.9); dot(x, R.y + 0.17, '#fff3c4', r * 0.9); }
      if (i === lit) { ctx.shadowColor = '#fff'; ctx.shadowBlur = r * 7; dot(x, R.y, '#ffffff', r * 2.1); ctx.shadowBlur = 0; }
    }
  }
  ctx.restore();

  // The buildings along the north, then the jet bridges coming down from the terminal's front.
  sprite('tower', TOWER[0], TOWER[1]);
  sprite('terminal', TERM_X, TERM_Y);
  sprite('hangar', HANGAR[0], HANGAR[1]);
  const e = active ? bridgeOut(c) : 1;
  GATES.forEach((g, i) => drawBridge(ctx, s, X, Y, q, g, i === 2 ? e : 1));

  // Everything on the apron, back to front.
  type Item = { y: number; draw: () => void };
  const items: Item[] = [];
  const plane = (name: string, st: PlaneState) => () => {
    ctx.save(); ctx.globalAlpha = 0.25 * st.a * Math.max(0, 1 - st.alt / 3); ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(X(st.x + st.alt * 0.35), Y(st.y - 0.03), PLANE * 0.42 * tile, 0.1 * tile, 0, 0, 7); ctx.fill(); ctx.restore();
    sprite(name, st.x, st.y - st.alt, { a: st.a });
  };
  items.push({ y: GATE_Y, draw: plane(airportLivery(n * 3 + 1 + Math.floor(seed * 1e6)), { x: GATES[0], y: GATE_Y, alt: 0, a: 1 }) });
  items.push({ y: GATE_Y, draw: plane(airportLivery(n * 3 + 2 + Math.floor(seed * 1e6)), { x: GATES[1], y: GATE_Y, alt: 0, a: 1 }) });
  const mine = airportLivery(n * 3 + Math.floor(seed * 1e6));
  if (p && p.alt <= 0) items.push({ y: p.y + 0.001, draw: plane(mine, p) });
  if (!active) items.push({ y: GATE_Y, draw: plane(mine, { x: GATES[2], y: GATE_Y, alt: 0, a: 1 }) });
  if (tile >= 6) for (const v of vehicles(c, active ? p : null)) items.push({ y: v.y, draw: () => sprite(v.n, v.x, v.y, { flip: v.flip, a: v.a }) });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();
  // In the air last, over everything behind it.
  if (p && p.alt > 0) plane(mine, p)();
}

/**
 * One jet bridge, its rotunda against the terminal's front and its cab at the
 * door by the nose of a plane at gate `g`: the long picture when out (e = 1),
 * the short one pulled back (e = 0), swapping as it moves. Painted cab-right,
 * so mirrored to come down onto the nose from the right.
 */
function drawBridge(ctx: CanvasRenderingContext2D, s: Record<string, Loaded>, X: (x: number) => number, Y: (y: number) => number, q: number, g: number, e: number): void {
  const long = s['bridge-long'], short = s['bridge-short'];
  if (!long?.img.naturalWidth || !short?.img.naturalWidth) return;
  const L = long.m, doorX = X(g + 0.3 * PLANE), doorY = Y(GATE_Y - 0.4);
  const ax = doorX + (L.right - L.left) * q, ay = doorY - (L.footY - L.top) * q;
  for (const [l, a] of [[short, 1 - e], [long, e]] as const) {
    if (a <= 0.01 || !l.img.complete) continue;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(ax, ay); ctx.scale(-1, 1);
    ctx.drawImage(l.img, -l.m.left * q, -l.m.top * q, l.m.w * q, l.m.h * q); ctx.restore();
  }
}

/** The terminal's entrances: the road tiles a street must run along (north of the frontage, dx 2–9), as x from the block's corner, on row −1. */
export const ENTRANCE_X0 = 2, ENTRANCE_X1 = 9;

/**
 * An airport with no road to its terminal: the eight tiles where the street
 * must go, outlined and pulsing amber, and a note above them. Drawn over the
 * airport; (ox, oy) and `tile` as for drawAirport.
 */
export function drawAirportNoRoad(ctx: CanvasRenderingContext2D, ox: number, oy: number, tile: number, t: number): void {
  const x0 = ox + ENTRANCE_X0 * tile, y0 = oy - tile, w = (ENTRANCE_X1 - ENTRANCE_X0 + 1) * tile, pulse = 0.5 + 0.5 * Math.sin(t * 4);
  ctx.save();
  ctx.fillStyle = `rgba(255,209,102,${0.12 + 0.18 * pulse})`; ctx.fillRect(x0, y0, w, tile);
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = Math.max(1.5, tile * 0.06); ctx.setLineDash([Math.max(3, tile * 0.18), Math.max(2, tile * 0.12)]);
  ctx.strokeRect(x0, y0, w, tile); ctx.setLineDash([]);
  const text = tr('ui.airport.noRoad'), fs = Math.round(Math.max(11, Math.min(15, tile * 0.32)));
  ctx.font = `600 ${fs}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tw = ctx.measureText(text).width + fs * 1.2, th = fs * 1.9, cx = x0 + w / 2, cy = y0 - th * 0.75;
  ctx.fillStyle = 'rgba(16,22,29,0.88)'; ctx.beginPath(); ctx.roundRect(cx - tw / 2, cy - th / 2, tw, th, th / 2); ctx.fill();
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#ffd166'; ctx.fillText(text, cx, cy + 1);
  ctx.restore();
}
