/**
 * Rail (RAIL_DESIGN.md), drawn as the owner picked in art/clay-set/rail.html and rail2.html:
 * T1 classic track (brown ballast, wooden sleepers, steel rails), two tracks on every rail
 * tile under one shared bed (D1; the engine keeps one track per tile, the second is drawn
 * only), and the S1 Victorian stations. A station picture has an empty strip where its
 * platform track runs; the station draws the game's own track over it, so a station's
 * track is exactly the track everywhere else.
 *
 * Track pieces come from a tile's links (sim/rail.ts `railLinks`): a straight for opposite
 * sides, a quarter turn round the shared corner for a bend, both at a junction.
 */
import { LINK_N, LINK_E, LINK_S, LINK_W, railLinks } from '../../sim/rail';
import type { World } from '../../sim/World';
import { subwayPlatform } from '../../sim/buildingShapes';
import { BUILDING_STATION, BUILDING_STATION_L, BUILDING_SUBWAY_STATION, BUILDING_RAMP_ELEVATED, BUILDING_RAMP_SUBWAY, RAIL_ELEVATED, RAIL_SUBWAY } from '../../sim/constants';
import { RAIL_SPRITES } from './railSpriteData';

type Ctx = CanvasRenderingContext2D;
/** A piece of track as a sampler: s in [0, 1] → point and unit heading, in tile units from the tile's corner. */
interface Piece { L: number; p: (s: number) => [number, number, number, number]; stub?: boolean }

const DIR: Record<number, [number, number]> = { [LINK_N]: [0, -1], [LINK_E]: [1, 0], [LINK_S]: [0, 1], [LINK_W]: [-1, 0] };
const SIDES = [LINK_N, LINK_E, LINK_S, LINK_W];

const piecesCache = new Map<number, Piece[]>();
/** The track pieces for a tile joined on `links` (LINK_ bits). */
export function railPieces(links: number): Piece[] {
  const hit = piecesCache.get(links);
  if (hit) return hit;
  const out: Piece[] = [], has = (b: number): boolean => (links & b) !== 0, n = SIDES.filter(has).length;
  const H = (): void => { out.push({ L: 1, p: s => [s, 0.5, 1, 0] }); };
  const V = (): void => { out.push({ L: 1, p: s => [0.5, s, 0, 1] }); };
  const arc = (a: number, b: number): void => {   // a quarter circle round the corner the two sides share
    const cx = (a | b) & LINK_E ? 1 : 0, cy = (a | b) & LINK_S ? 1 : 0;
    const A1 = Math.atan2(0.5 + DIR[a][1] / 2 - cy, 0.5 + DIR[a][0] / 2 - cx);
    let A2 = Math.atan2(0.5 + DIR[b][1] / 2 - cy, 0.5 + DIR[b][0] / 2 - cx);
    if (A2 - A1 > Math.PI) A2 -= 2 * Math.PI; if (A1 - A2 > Math.PI) A2 += 2 * Math.PI;
    const sg = Math.sign(A2 - A1);
    out.push({ L: Math.PI / 4, p: s => { const A = A1 + (A2 - A1) * s; return [cx + 0.5 * Math.cos(A), cy + 0.5 * Math.sin(A), -Math.sin(A) * sg, Math.cos(A) * sg]; } });
  };
  if (n === 4) { H(); V(); }
  else {
    if (has(LINK_E) && has(LINK_W)) H();
    if (has(LINK_N) && has(LINK_S)) V();
    // At a 3-way junction this joins the branch to each end of the straight.
    for (const a of [LINK_N, LINK_S]) for (const b of [LINK_E, LINK_W]) if (has(a) && has(b)) arc(a, b);
    if (n === 1) { const b = SIDES.find(has)!, [dx, dy] = DIR[b]; out.push({ L: 0.5, stub: true, p: s => [0.5 + dx * s / 2, 0.5 + dy * s / 2, dx, dy] }); }
    if (n === 0) H();   // lone track with no neighbour yet: lie east–west
  }
  piecesCache.set(links, out);
  return out;
}

/** Track centres either side of the tile's middle, and half the gauge (rail to track centre), in tiles. */
export const TRACK_OFFSET = 0.22;
const HALF_GAUGE = 0.07;
const BED = '#857a6c', SLEEPER = '#6b4a32', RAIL = '#d6dade', RAIL_UNDER = '#3f3a35', BRIDGE = '#8a7d70', BRIDGE_EDGE = '#5d554c';

function strokePiece(ctx: Ctx, pc: Piece, px: number, py: number, T: number, d: number): void {
  const n = pc.L === 1 || pc.stub ? 1 : 12;
  ctx.beginPath();
  for (let k = 0; k <= n; k++) {
    const [x, y, tx, ty] = pc.p(k / n), X = px + (x - ty * d) * T, Y = py + (y + tx * d) * T;
    if (k) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
  }
  ctx.stroke();
}

/**
 * Ground track on one tile at screen (px, py), T pixels a tile. `crossing`: a level crossing, where the
 * road is already drawn and only the rails show, set into it. `bridge`: track over water, on a deck.
 */
export function drawRailTile(ctx: Ctx, links: number, px: number, py: number, T: number, crossing = false, bridge = false): void {
  const pcs = railPieces(links);
  ctx.save(); ctx.lineCap = 'butt';
  if (crossing) {
    ctx.strokeStyle = '#3a3836'; ctx.lineWidth = Math.max(1, T * 0.035);
    for (const pc of pcs) for (const o of [-TRACK_OFFSET, TRACK_OFFSET]) for (const g of [-HALF_GAUGE, HALF_GAUGE]) strokePiece(ctx, pc, px, py, T, o + g);
    ctx.restore(); return;
  }
  if (bridge) {
    ctx.strokeStyle = BRIDGE_EDGE; ctx.lineWidth = T * 1.0; for (const pc of pcs) strokePiece(ctx, pc, px, py, T, 0);
    ctx.strokeStyle = BRIDGE; ctx.lineWidth = T * 0.9; for (const pc of pcs) strokePiece(ctx, pc, px, py, T, 0);
  }
  ctx.strokeStyle = BED; ctx.lineWidth = T * 0.82;
  for (const pc of pcs) strokePiece(ctx, pc, px, py, T, 0);
  if (T >= 12) {   // sleepers only where they can be seen
    ctx.strokeStyle = SLEEPER; ctx.lineWidth = Math.max(1, T * 0.055);
    ctx.beginPath();
    for (const pc of pcs) {
      const n = Math.max(1, Math.round(pc.L / 0.12));
      for (let k = 0; k < n; k++) {
        const [x, y, tx, ty] = pc.p((k + 0.5) / n);
        for (const o of [-TRACK_OFFSET, TRACK_OFFSET]) {
          const a = o - 0.13, b = o + 0.13;
          ctx.moveTo(px + (x - ty * a) * T, py + (y + tx * a) * T); ctx.lineTo(px + (x - ty * b) * T, py + (y + tx * b) * T);
        }
      }
    }
    ctx.stroke();
  }
  const rw = Math.max(1, T * 0.033);
  for (const [col, w, dy] of [[RAIL_UNDER, rw + Math.max(1, T * 0.02), Math.max(0.5, T * 0.012)], [RAIL, rw, 0]] as const) {
    ctx.strokeStyle = col; ctx.lineWidth = w;
    for (const pc of pcs) for (const o of [-TRACK_OFFSET, TRACK_OFFSET]) for (const g of [-HALF_GAUGE, HALF_GAUGE]) strokePiece(ctx, pc, px, py + dy, T, o + g);
  }
  // A dead end: a red buffer stop across both tracks.
  for (const pc of pcs) if (pc.stub) {
    const [x, y, tx, ty] = pc.p(0.9);
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = Math.max(1.5, T * 0.07);
    ctx.beginPath(); ctx.moveTo(px + (x + ty * 0.38) * T, py + (y - tx * 0.38) * T); ctx.lineTo(px + (x - ty * 0.38) * T, py + (y + tx * 0.38) * T); ctx.stroke();
  }
  ctx.restore();
}

// ── Station pictures ──
interface Loaded { img: HTMLImageElement }
let sprites: Record<string, Loaded> | null = null;
function load(): Record<string, Loaded> {
  if (sprites) return sprites;
  const base = import.meta.env.BASE_URL;
  sprites = {};
  for (const name of Object.keys(RAIL_SPRITES)) {
    const img = new Image();
    img.src = `${base}sprites/clay/rail/${name}.png`;
    sprites[name] = { img };
  }
  return sprites;
}
/** True once the station pictures have loaded (until then the stand-in slab shows). */
export function railArtReady(): boolean {
  if (typeof Image === 'undefined') return false;
  const s = load();
  return Object.values(s).every(l => l.img.complete && l.img.naturalWidth > 0);
}

// The soil band's height at the front of the subway entrance's baked picture (measured: public/sprites/clay/rail, image px).
const SOIL: Record<string, number> = { 'subway-entrance': 13 };

// ── Stations (owner's picks S2 and C1 in art/clay-set/station.html) ──
// A straight station is three tiles in a row, all platform: the two tracks spread apart inside it round an island
// platform with the station house in the middle (painted: island-h, island-v). A curved one is 2×2: the house fills
// the corner tile inside the curve (painted: corner-se, corner-ne, mirrored for the other two corners), and the track
// round the curve is the plain track, drawn by the caller.

/** How far each track's centre sits from the row's middle along a straight station, in tiles. */
export const ISLAND_OFFSET = 0.4;
/** Track offset at distance u along a straight station (0..3 from one end): eased out from TRACK_OFFSET over each end tile. */
export function islandOffset(u: number): number {
  const e = (f: number): number => f * f * (3 - 2 * f);
  const f = u <= 0 || u >= 3 ? 0 : u < 0.7 ? e(u / 0.7) : u > 2.3 ? e((3 - u) / 0.7) : 1;
  return TRACK_OFFSET + (ISLAND_OFFSET - TRACK_OFFSET) * f;
}
// Where the painted island lies across the row (from its top or left edge), in tiles: the pictures came out at
// different depths, so each is fitted to its own band, clear of the rails.
const ISLAND_ACROSS: Record<string, [number, number]> = { 'island-h': [0.2, 0.8], 'island-v': [0.26, 0.74] };

/** The station picture for a kind and rotation, and whether it is mirrored (sim/buildingShapes.ts: quarter turns clockwise). */
export function stationArt(kind: number, rot: number): { name: string; flip: boolean } | null {
  const r = rot & 3;
  if (kind === BUILDING_STATION) return { name: r % 2 === 0 ? 'island-h' : 'island-v', flip: false };
  // The house sits at the curve's inside corner. Rotation 0: the track passes south and east of it; 1: south and west;
  // 2: north and west; 3: north and east.
  if (kind === BUILDING_STATION_L) return r === 0 ? { name: 'corner-se', flip: false } : r === 1 ? { name: 'corner-se', flip: true } : r === 2 ? { name: 'corner-ne', flip: true } : { name: 'corner-ne', flip: false };
  return null;
}

/** The two tracks along a straight station, spread round its island (islandOffset); the row's top-left at (L, Tp). */
function drawIslandTrack(ctx: Ctx, horizontal: boolean, L: number, Tp: number, T: number): void {
  const N = 30, pt = (u: number, d: number): [number, number] => horizontal ? [L + u * T, Tp + (0.5 + d) * T] : [L + (0.5 - d) * T, Tp + u * T];
  const line = (d: (u: number) => number, dy = 0): void => {
    ctx.beginPath();
    for (let k = 0; k <= N; k++) { const u = 3 * k / N, [x, y] = pt(u, d(u)); if (k) ctx.lineTo(x, y + dy); else ctx.moveTo(x, y + dy); }
    ctx.stroke();
  };
  ctx.save(); ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.rect(L, Tp, (horizontal ? 3 : 1) * T, (horizontal ? 1 : 3) * T); ctx.clip();
  ctx.fillStyle = BED;
  if (horizontal) ctx.fillRect(L, Tp + 0.09 * T, 3 * T, 0.82 * T); else ctx.fillRect(L + 0.09 * T, Tp, 0.82 * T, 3 * T);
  ctx.strokeStyle = BED; ctx.lineWidth = T * 0.3;
  for (const sg of [-1, 1]) line(u => sg * islandOffset(u));
  if (T >= 12) {
    ctx.strokeStyle = SLEEPER; ctx.lineWidth = Math.max(1, T * 0.055); ctx.beginPath();
    for (let k = 0; k < 25; k++) {
      const u = (k + 0.5) * 3 / 25, o = islandOffset(u);
      for (const sg of [-1, 1]) { const [x0, y0] = pt(u, sg * o - 0.13), [x1, y1] = pt(u, sg * o + 0.13); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
    }
    ctx.stroke();
  }
  const rw = Math.max(1, T * 0.033);
  for (const [col, w, dy] of [[RAIL_UNDER, rw + Math.max(1, T * 0.02), Math.max(0.5, T * 0.012)], [RAIL, rw, 0]] as const) {
    ctx.strokeStyle = col; ctx.lineWidth = w;
    for (const sg of [-1, 1]) for (const g of [-HALF_GAUGE, HALF_GAUGE]) line(u => sg * islandOffset(u) + g, dy);
  }
  ctx.restore();
}

/**
 * A station over its footprint, whose top-left corner is at screen (L, Tp) and which is `w` × `h` tiles, T pixels a
 * tile. A straight station draws its own track (spread round the island); for a curved one the caller draws the
 * platform track after this. Everything stays inside the footprint: the tiles beside it may hold roads or buildings.
 */
export function drawStation(ctx: Ctx, kind: number, rot: number, L: number, Tp: number, w: number, h: number, T: number): void {
  const art = stationArt(kind, rot); if (!art) return;
  const s = load()[art.name], m = RAIL_SPRITES[art.name];
  const ready = !!s && !!m && s.img.complete && s.img.naturalWidth > 0;
  if (kind === BUILDING_STATION) {
    const horizontal = w >= h;
    drawIslandTrack(ctx, horizontal, L, Tp, T);
    if (!ready) return;
    // The painted island's solid box (slab and its front edge) fitted to 0.35..2.65 along the row and its band across.
    const [a0, a1] = ISLAND_ACROSS[art.name], solidW = m.right - m.left, solidH = m.footY - m.top;
    const bx = horizontal ? L + 0.35 * T : L + a0 * T, by = horizontal ? Tp + a0 * T : Tp + 0.35 * T;
    const bw = (horizontal ? 2.3 : a1 - a0) * T, bh = (horizontal ? a1 - a0 : 2.3) * T, qx = bw / solidW, qy = bh / solidH;
    ctx.drawImage(s.img, bx - m.left * qx, by - m.top * qy, m.w * qx, m.h * qy);
    return;
  }
  if (!ready) return;
  // Curved: the house tile is the footprint corner on the inside of the curve (the anchor). Thin paving along the two
  // platform tiles' edges next to it, then the house picture fitted to its tile (its slab's front edge clipped off).
  const r = rot & 3, hx = r === 1 || r === 2 ? L + T : L, hy = r >= 2 ? Tp + T : Tp;
  const east = r === 0 || r === 3, south = r <= 1;   // which sides of the house face the track
  ctx.save();
  ctx.fillStyle = '#d9d4c8';
  const e = 0.09 * T;
  if (south) ctx.fillRect(hx, hy + T, T, e); else ctx.fillRect(hx, hy - e, T, e);
  if (east) ctx.fillRect(hx + T, hy, e, T); else ctx.fillRect(hx - e, hy, e, T);
  ctx.fillStyle = '#f2e7c9';
  const lw = Math.max(1, T * 0.025);
  if (south) ctx.fillRect(hx, hy + T + e - lw, T, lw); else ctx.fillRect(hx, hy - e, T, lw);
  if (east) ctx.fillRect(hx + T + e - lw, hy, lw, T); else ctx.fillRect(hx - e, hy, lw, T);
  ctx.beginPath(); ctx.rect(hx, hy, T, T); ctx.clip();
  const solid = m.right - m.left, front = m.footY - m.top, edge = front * (16 / 316);   // the template's slab edge: 16 of 316 px
  const qx = T / solid, qy = T / (front - edge);
  if (art.flip) { ctx.translate(2 * hx + T, 0); ctx.scale(-1, 1); }
  ctx.drawImage(s.img, hx - m.left * qx, hy - m.top * qy, m.w * qx, m.h * qy);
  ctx.restore();
}

// ── Phase 2: elevated track, ramps and portals, the underground view ──

/** The elevated deck's height in tiles (owner's R5 in art/clay-set/rail2.html: low, so the climb is a small step). */
export const DECK_HEIGHT = 0.25;
const STEEL = { deck: '#6f7781', face: '#4d545d', pillar: '#5f6670', pillarDark: '#40464e', lattice: 'rgba(30,34,40,0.7)' };   // E2

/** Shadow of elevated track on tile (px, py): drawn first, on the ground, pushed right by the deck's height. */
export function drawElevatedShadow(ctx: Ctx, links: number, px: number, py: number, T: number): void {
  ctx.save(); ctx.lineCap = 'butt'; ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = T * 0.95;
  for (const pc of railPieces(links)) strokePiece(ctx, pc, px + DECK_HEIGHT * 0.3 * T, py, T, 0);
  ctx.restore();
}

/**
 * Elevated track on one tile (E2 steel deck, two tracks): paired steel legs on every other tile
 * (`legs`), the deck's front face, its top, then the track, all raised DECK_HEIGHT up the page.
 */
export function drawElevatedTile(ctx: Ctx, links: number, px: number, py: number, T: number, legs: boolean): void {
  const pcs = railPieces(links), lift = DECK_HEIGHT * T, top = py - lift;
  ctx.save(); ctx.lineCap = 'butt';
  if (legs) {
    const cx = px + T / 2, cy = py + T / 2, w = Math.max(2, T * 0.08);
    for (const dx of [-0.3, 0.3]) {
      const x = cx + dx * T, g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
      g.addColorStop(0, STEEL.pillar); g.addColorStop(1, STEEL.pillarDark); ctx.fillStyle = g;
      ctx.fillRect(x - w / 2, cy - lift, w, lift);
    }
  }
  ctx.strokeStyle = STEEL.face; ctx.lineWidth = T * 0.98;
  for (const pc of pcs) strokePiece(ctx, pc, px, top + T * 0.08, T, 0);
  if (T >= 12 && (links & (LINK_E | LINK_W)) && !(links & (LINK_N | LINK_S))) {   // a zigzag down the face of east–west deck
    ctx.strokeStyle = STEEL.lattice; ctx.lineWidth = 1; ctx.beginPath();
    const y0 = top + T * 0.99, y1 = y0 + T * 0.07;
    for (let k = 0; k <= 6; k++) { const x = px + T * k / 6; if (k === 0) ctx.moveTo(x, y0); else ctx.lineTo(x, k % 2 ? y1 : y0); }
    ctx.stroke();
  }
  ctx.strokeStyle = STEEL.deck; ctx.lineWidth = T * 0.98;
  for (const pc of pcs) strokePiece(ctx, pc, px, top, T, 0);
  ctx.restore();
  drawRailTile(ctx, links, px, top, T);
}

// Ramps and portals: drawn from colour-blocked templates (art/clay-set/raw-rail/tpl-*-r5.png, 160 px a tile).
// Each picture's footprint (its ground rectangle) on the raw sheet, top-left, in raw px.
const RAMP_FOOT: Record<string, [number, number]> = {
  'ramp-ew': [70, 180], 'ramp-ns-away': [560, 90], 'ramp-ns-toward': [980, 90],
  'portal-ew': [70, 200], 'portal-ns-away': [560, 90], 'portal-ns-toward': [980, 90],
};
/**
 * The picture for a ramp at a rotation: at rot 0 the ground end is west and the high (or deep) end east;
 * each turn is a quarter clockwise (sim/buildingShapes.ts), so rot 1 runs north → south (toward us),
 * rot 2 east → west (the east–west picture mirrored), rot 3 south → north (away from us).
 */
export function rampArt(subway: boolean, rot: number): { name: string; flip: boolean } {
  const p = subway ? 'portal' : 'ramp', r = rot & 3;
  return r === 0 ? { name: `${p}-ew`, flip: false } : r === 1 ? { name: `${p}-ns-toward`, flip: false } : r === 2 ? { name: `${p}-ew`, flip: true } : { name: `${p}-ns-away`, flip: false };
}
/** A ramp or portal whose footprint's top-left corner is at screen (L, Tp), T pixels a tile. */
export function drawRamp(ctx: Ctx, subway: boolean, rot: number, L: number, Tp: number, T: number): void {
  const art = rampArt(subway, rot), s = load()[art.name], m = RAIL_SPRITES[art.name], foot = RAMP_FOOT[art.name];
  if (!s || !m || !foot || !s.img.complete || !s.img.naturalWidth) return;
  const q = T / 128, fx = foot[0] * m.k - (m.sheetX ?? 0), fy = foot[1] * m.k - (m.sheetY ?? 0);   // the footprint's corner in the image
  const ew = art.name.endsWith('-ew'), w = ew ? 2 : 1;
  ctx.save();
  if (art.flip) { ctx.translate(2 * (L + w * T / 2), 0); ctx.scale(-1, 1); }
  ctx.drawImage(s.img, L - fx * q, Tp - fy * q, m.w * q, m.h * q);
  ctx.restore();
}

/** The underground view (U1 blueprint): the surface dims to dark blue; `a` fades it in. */
export function drawUndergroundShade(ctx: Ctx, w: number, h: number, a: number): void {
  if (a <= 0) return;
  ctx.save(); ctx.fillStyle = `rgba(10,22,40,${0.82 * a})`; ctx.fillRect(0, 0, w, h); ctx.restore();
}
/** Subway track on one tile in the underground view: a pale tunnel glow, rails in light cyan. `platform`: a station's platform edges. */
export function drawSubwayTile(ctx: Ctx, links: number, px: number, py: number, T: number, platform = false): void {
  const pcs = railPieces(links);
  ctx.save(); ctx.lineCap = 'butt';
  ctx.strokeStyle = 'rgba(120,220,255,0.18)'; ctx.lineWidth = T * 0.95;
  for (const pc of pcs) strokePiece(ctx, pc, px, py, T, 0);
  if (T >= 12) {
    ctx.strokeStyle = 'rgba(120,220,255,0.35)'; ctx.lineWidth = Math.max(1, T * 0.04); ctx.beginPath();
    for (const pc of pcs) {
      const n = Math.max(1, Math.round(pc.L / 0.14));
      for (let k = 0; k < n; k++) {
        const [x, y, tx, ty] = pc.p((k + 0.5) / n);
        for (const o of [-TRACK_OFFSET, TRACK_OFFSET]) { const a = o - 0.12, b = o + 0.12; ctx.moveTo(px + (x - ty * a) * T, py + (y + tx * a) * T); ctx.lineTo(px + (x - ty * b) * T, py + (y + tx * b) * T); }
      }
    }
    ctx.stroke();
  }
  ctx.strokeStyle = '#9fe8ff'; ctx.lineWidth = Math.max(1, T * 0.03);
  for (const pc of pcs) for (const o of [-TRACK_OFFSET, TRACK_OFFSET]) for (const g of [-HALF_GAUGE, HALF_GAUGE]) strokePiece(ctx, pc, px, py, T, o + g);
  if (platform) {   // pale platforms along both outer edges
    ctx.strokeStyle = 'rgba(160,230,255,0.45)'; ctx.lineWidth = Math.max(1, T * 0.1);
    for (const pc of pcs) for (const o of [-0.44, 0.44]) strokePiece(ctx, pc, px, py, T, o);
  }
  ctx.restore();
}

/** Every elevated tile in view: shadows first, then legs and deck row by row from the back. (sx, sy): screen position of tile (0, 0). */
export function drawElevatedLayer(ctx: Ctx, world: World, sx: number, sy: number, T: number, x0: number, y0: number, x1: number, y1: number): void {
  // A ramp's own tiles carry the levels too, but its picture draws them.
  const rail = world.layers.rail, w = world.grid.width, bld = world.layers.building;
  const X = (tx: number): number => Math.floor(sx + tx * T), Y = (ty: number): number => Math.floor(sy + ty * T), tile = Math.ceil(T);
  // A deck's shadow and legs reach a little past its own tile: take in one more row and column.
  const ya = Math.max(0, y0 - 1), xa = Math.max(0, x0 - 1);
  for (let ty = ya; ty <= y1; ty++) for (let tx = xa; tx <= x1; tx++) { const i = ty * w + tx; if (rail[i] & RAIL_ELEVATED && !bld[i]) drawElevatedShadow(ctx, railLinks(world, i, RAIL_ELEVATED), X(tx), Y(ty), tile); }
  for (let ty = ya; ty <= Math.min(world.grid.height - 1, y1 + 1); ty++) for (let tx = xa; tx <= x1; tx++) {
    const i = ty * w + tx; if (rail[i] & RAIL_ELEVATED && !bld[i]) drawElevatedTile(ctx, railLinks(world, i, RAIL_ELEVATED), X(tx), Y(ty), tile, (tx + ty) % 2 === 0);
  }
}

const isRamp = (b: number): boolean => b === BUILDING_RAMP_ELEVATED || b === BUILDING_RAMP_SUBWAY;

/** The underground view: the surface dims, and subway track and platforms show. */
export function drawSubwayLayer(ctx: Ctx, world: World, sx: number, sy: number, T: number, x0: number, y0: number, x1: number, y1: number): void {
  drawUndergroundShade(ctx, ctx.canvas.width, ctx.canvas.height, 1);
  const rail = world.layers.rail, w = world.grid.width, tile = Math.ceil(T), platforms = new Set<number>();
  for (const b of world.buildings) if (b.kind === BUILDING_SUBWAY_STATION) for (const [dx, dy] of subwayPlatform(b.kind, b.rot ?? 0)) platforms.add((b.ty + dy) * w + b.tx + dx);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const i = ty * w + tx; if (!(rail[i] & RAIL_SUBWAY) || isRamp(world.layers.building[i])) continue;
    drawSubwayTile(ctx, railLinks(world, i, RAIL_SUBWAY), Math.floor(sx + tx * T), Math.floor(sy + ty * T), tile, platforms.has(i));
  }
}

/** The N2 globe-lamp subway entrance on its tile at screen (px, py). */
export function drawSubwayEntrance(ctx: Ctx, px: number, py: number, T: number): void {
  const s = load()['subway-entrance'], m = RAIL_SPRITES['subway-entrance'];
  if (!s || !m || !s.img.complete || !s.img.naturalWidth) return;
  // Drawn at 0.6 of the tile on paving that fills it (owner: the full-tile entrance was far too big).
  const S = 0.6, q = S * T / (m.right - m.left), front = m.footY - (SOIL['subway-entrance'] ?? 0);
  ctx.save(); ctx.fillStyle = '#d9d6cf'; ctx.fillRect(px, py, T, T);
  ctx.beginPath(); ctx.rect(px, py - T, T, 2 * T); ctx.clip();   // flush with the ground, as the stations
  ctx.drawImage(s.img, px + (1 - S) / 2 * T - m.left * q, py + (1 - (1 - S) / 2) * T - front * q, m.w * q, m.h * q);
  ctx.restore();
}

/**
 * The game's track over a ramp's empty strip: straight along it, from the ground end to the high end
 * (lifted DECK_HEIGHT) for a ramp up, or to the tunnel mouth for a ramp down. (L, Tp): the footprint's top-left.
 */
export function drawRampTrack(ctx: Ctx, subway: boolean, rot: number, L: number, Tp: number, T: number): void {
  const r = rot & 3, ew = r % 2 === 0;
  // In tile units from the footprint's corner: the ground end's centre and the far end's, and how high the far end draws.
  // `mouth`: how far short of the far end the bed meets the tunnel mouth, measured on each portal picture (the art sits a
  // little off its template; the owner saw the rails run on into the arch).
  const len = 2, mouth = subway ? (ew ? 0.25 : r === 3 ? 0.63 : 0.65) : 0, rise = subway ? 0 : DECK_HEIGHT;
  const a: [number, number] = r === 0 ? [0, 0.5] : r === 1 ? [0.5, 0] : r === 2 ? [len, 0.5] : [0.5, len];
  const b: [number, number] = r === 0 ? [len - mouth, 0.5 - rise] : r === 1 ? [0.5, len - mouth - rise] : r === 2 ? [mouth, 0.5 - rise] : [0.5, mouth - rise];
  const dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy), ux = dx / m, uy = dy / m, nx = -uy, ny = ux;
  ctx.save(); ctx.lineCap = 'butt';
  if (T >= 12) {
    ctx.strokeStyle = SLEEPER; ctx.lineWidth = Math.max(1, T * 0.055); ctx.beginPath();
    const n = Math.round(m / 0.12);
    for (let k = 0; k < n; k++) {
      const f = (k + 0.5) / n, x = a[0] + dx * f, y = a[1] + dy * f;
      for (const o of [-TRACK_OFFSET, TRACK_OFFSET]) { const p = o - 0.13, q = o + 0.13; ctx.moveTo(L + (x + nx * p) * T, Tp + (y + ny * p) * T); ctx.lineTo(L + (x + nx * q) * T, Tp + (y + ny * q) * T); }
    }
    ctx.stroke();
  }
  ctx.strokeStyle = RAIL; ctx.lineWidth = Math.max(1, T * 0.033); ctx.beginPath();
  for (const o of [-TRACK_OFFSET, TRACK_OFFSET]) for (const g of [-HALF_GAUGE, HALF_GAUGE]) {
    ctx.moveTo(L + (a[0] + nx * (o + g)) * T, Tp + (a[1] + ny * (o + g)) * T); ctx.lineTo(L + (b[0] + nx * (o + g)) * T, Tp + (b[1] + ny * (o + g)) * T);
  }
  ctx.stroke();
  if (subway) {   // the track darkens into the tunnel
    const g = ctx.createLinearGradient(L + a[0] * T, Tp + a[1] * T, L + b[0] * T, Tp + b[1] * T);
    // Dark over the last stretch, so the track fades into the tunnel rather than stopping at a line.
    g.addColorStop(0, 'rgba(20,18,18,0)'); g.addColorStop(Math.max(0, 1 - 0.7 / m), 'rgba(20,18,18,0.08)'); g.addColorStop(1, 'rgba(20,18,18,0.85)');
    ctx.strokeStyle = g; ctx.lineWidth = T * 0.86; ctx.beginPath(); ctx.moveTo(L + a[0] * T, Tp + a[1] * T); ctx.lineTo(L + b[0] * T, Tp + b[1] * T); ctx.stroke();
  }
  ctx.restore();
}
