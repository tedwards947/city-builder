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
import { LINK_N, LINK_E, LINK_S, LINK_W } from '../../sim/rail';
import { BUILDING_STATION, BUILDING_STATION_L } from '../../sim/constants';
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

// Where the empty track strip lies in each raw picture (measured on the cut sprites).
// Straight, east–west: the strip's centre row; north–south: its centre column; L: the west arm's centre row.
// The soil band's height at the front of each baked picture (measured: public/sprites/clay/rail, image px).
const SOIL: Record<string, number> = { 'station-h': 26, 'station-v': 21, 'station-l-up': 26, 'station-l-down': 28, 'subway-entrance': 13 };
const STRIP_RAW: Record<string, number> = { 'station-h': 349, 'station-v': 217, 'station-l-up': 164, 'station-l-down': 187 };

/** The station picture for a kind and rotation, and whether it is mirrored (sim/buildingShapes.ts: quarter turns clockwise). */
export function stationArt(kind: number, rot: number): { name: string; flip: boolean } | null {
  const r = rot & 3;
  if (kind === BUILDING_STATION) return r % 2 === 0 ? { name: 'station-h', flip: false } : { name: 'station-v', flip: r === 3 };
  // The elbow at rotation 0 joins west and north; 1: north and east; 2: east and south; 3: south and west.
  if (kind === BUILDING_STATION_L) return r === 0 ? { name: 'station-l-up', flip: false } : r === 1 ? { name: 'station-l-up', flip: true } : r === 2 ? { name: 'station-l-down', flip: true } : { name: 'station-l-down', flip: false };
  return null;
}

/**
 * A station picture over its footprint, whose top-left corner is at screen (L, Tp) and which is
 * `w` × `h` tiles, T pixels a tile. The caller then draws the platform track over it.
 */
export function drawStation(ctx: Ctx, kind: number, rot: number, L: number, Tp: number, w: number, h: number, T: number): void {
  const art = stationArt(kind, rot); if (!art) return;
  const s = load()[art.name], m = RAIL_SPRITES[art.name];
  if (!s || !m || !s.img.complete || !s.img.naturalWidth) return;
  const solid = m.right - m.left, strip = STRIP_RAW[art.name] * m.k;
  // The pictures stand on a clay slab with a soil edge in front and a shadow round it, which looked raised in the game
  // (owner). Fit the platform's front edge (the top of the soil band) to the footprint's, and clip away the soil band
  // and the shadow: only what stands on the footprint, and anything rising above it, is drawn.
  const front = m.footY - (SOIL[art.name] ?? 0);
  // Screen px per image px across (qx) and down (qy), and where the image's top-left goes. The straight pictures came out
  // deeper than their footprints, so they are fitted down the page: east–west with the strip on the middle row and the
  // front edge on the footprint's; north–south from the footprint's top to its front edge, with the strip on the middle column.
  const qx = w * T / solid;
  let qy = qx, x = L - m.left * qx, y = Tp + 1.5 * T - strip * qy;
  if (art.name === 'station-h') { qy = 1.5 * T / (front - strip); y = Tp + h * T - front * qy; }
  else if (art.name === 'station-v') { qy = h * T / (front - m.top); x = L + 1.5 * T - strip * qx; y = Tp - m.top * qy; }
  ctx.save();
  ctx.beginPath(); ctx.rect(L, Tp - 4 * T, w * T, (h + 4) * T); ctx.clip();
  if (art.flip) {   // mirror about the footprint's centre (for the north–south straight: about the track)
    const axis = art.name === 'station-v' ? L + 1.5 * T : L + w * T / 2;
    ctx.translate(2 * axis, 0); ctx.scale(-1, 1);
  }
  ctx.drawImage(s.img, x, y, m.w * qx, m.h * qy);
  ctx.restore();
}
