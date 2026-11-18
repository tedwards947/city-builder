/**
 * The trip behind a lot's commute: where its residents go for work and shops
 * (or, for a business, where its customers and workers come from), drawn along
 * the roads when the lot is inspected.
 *
 * `lotTrips` is pure and tested; `drawCommuteRoutes` needs a canvas.
 */
import type { World } from '../../sim/World';
import { ZONE_NONE, ZONE_R, ZONE_C } from '../../sim/constants';
import { BALANCE } from '../../data/balance';
import { type TrafficField, bestAccessRoad, travelTime } from '../../sim/TrafficData';
import { t } from '../../i18n';
import { routeFrom } from '../TrafficOverlay';

export type TripKey = 'jobs' | 'shops' | 'customers' | 'workers';

export interface LotTrip {
  key: TripKey;
  /** Travel time, in the units of BALANCE.transit.commuteMax; Infinity if nothing is in reach. */
  time: number;
  /** The road tile the trip starts on, or -1. */
  road: number;
  field: TrafficField;
}

/** The trips of the zoned lot at `i`: homes go to jobs and shops, businesses to homes. Empty before the first traffic pass. */
export function lotTrips(world: World, i: number): LotTrip[] {
  const d = world.traffic, zone = world.layers.zone[i];
  if (!d || zone === ZONE_NONE) return [];
  const trip = (key: TripKey, field: TrafficField): LotTrip => {
    const road = bestAccessRoad(world, i, field);
    return { key, road, field, time: road >= 0 ? travelTime(field, road) : Infinity };
  };
  // The same maps accessibility is measured on (TransitSystem): zones only for homes; for shops and industry, homes or a building that sends them trips.
  return zone === ZONE_R ? [trip('jobs', d.toJobs), trip('shops', d.toShops)] : [zone === ZONE_C ? trip('customers', d.toCustomers) : trip('workers', d.toWorkers)];
}

/** How a trip of `time` compares with the limit: 0 short, 1 middling, 2 long (60% of the limit or more, which is when the lot gets a commute badge). */
export function tripGrade(time: number): 0 | 1 | 2 {
  const share = time / BALANCE.transit.commuteMax;
  return share < 0.4 ? 0 : share < 0.6 ? 1 : 2;
}
export const TRIP_COLOUR = ['#7fd48a', '#f0b04c', '#ff6b5e'] as const;

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, colour: string, size: number): void {
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + size;
  ctx.fillStyle = '#1b1e24';
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - size * 0.8, w, size * 1.6, size * 0.8); ctx.fill();
  ctx.fillStyle = colour;
  ctx.fillText(text, x, y + 1);
}

/**
 * Draws the trips of the lot at `i`. Tile (tx, ty) has its top-left corner at
 * (ox + tx * ts, oy + ty * ts). Each route runs green near the lot to red as it
 * nears the commute limit; a lot with nothing in reach gets a cross.
 */
export function drawCommuteRoutes(ctx: CanvasRenderingContext2D, world: World, i: number, ts: number, ox: number, oy: number): void {
  const trips = lotTrips(world, i);
  if (!trips.length) return;
  const { width } = world.grid;
  const limit = BALANCE.transit.commuteMax;
  const X = (k: number): number => ox + (k % width + 0.5) * ts;
  const Y = (k: number): number => oy + (Math.floor(k / width) + 0.5) * ts;
  const lx = X(i), ly = Y(i);
  const text = Math.max(11, Math.min(15, ts * 0.32));
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  let reached = 0;
  for (const trip of trips) {
    if (!(trip.time < Infinity)) continue;
    const path = routeFrom(trip.field, trip.road), n = path.length;
    if (!n) continue;
    reached++;
    ctx.strokeStyle = 'rgba(15,17,22,0.75)'; ctx.lineWidth = Math.max(4, ts * 0.2);
    ctx.beginPath(); ctx.moveTo(lx, ly);
    for (let j = 0; j < n; j++) ctx.lineTo(X(path[j]), Y(path[j]));
    ctx.stroke();
    // Each stretch is coloured by how much of the limit has been used by its end.
    const total = trip.field.dist[trip.road];
    ctx.lineWidth = Math.max(2, ts * 0.11);
    for (let grade = 0; grade < 3; grade++) {
      ctx.beginPath();
      let any = false;
      for (let j = 0; j < n; j++) {
        if (tripGrade(total - trip.field.dist[path[j]]) !== grade) continue;
        const from = j ? path[j - 1] : -1;
        ctx.moveTo(from < 0 ? lx : X(from), from < 0 ? ly : Y(from));
        ctx.lineTo(X(path[j]), Y(path[j]));
        any = true;
      }
      if (any) { ctx.strokeStyle = TRIP_COLOUR[grade]; ctx.stroke(); }
    }
    const colour = TRIP_COLOUR[tripGrade(trip.time)], end = path[n - 1];
    ctx.fillStyle = '#1b1e24'; ctx.beginPath(); ctx.arc(X(end), Y(end), Math.max(4, ts * 0.2), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(X(end), Y(end), Math.max(2.5, ts * 0.13), 0, Math.PI * 2); ctx.fill();
    // Work and shops often share a road: put their labels at different points.
    const at = path[Math.min(n - 1, Math.floor(n * (trip.key === 'shops' ? 0.35 : 0.65)))];
    pill(ctx, X(at), Y(at), t(`ui.route.${trip.key}`, { time: Math.round(trip.time), limit }), colour, text);
  }
  if (!reached) {
    const s = Math.max(4, ts * 0.22);
    ctx.strokeStyle = '#1b1e24'; ctx.lineWidth = Math.max(4, ts * 0.2);
    ctx.beginPath(); ctx.moveTo(lx - s, ly - s); ctx.lineTo(lx + s, ly + s); ctx.moveTo(lx + s, ly - s); ctx.lineTo(lx - s, ly + s); ctx.stroke();
    ctx.strokeStyle = TRIP_COLOUR[2]; ctx.lineWidth = Math.max(2, ts * 0.11); ctx.stroke();
    pill(ctx, lx, ly - Math.max(16, ts * 0.85), t(trips[0].key === 'customers' ? 'ui.route.noCustomers' : trips[0].key === 'workers' ? 'ui.route.noWorkers' : 'ui.route.none'), '#ff8b7e', text);
  } else {
    ctx.fillStyle = '#1b1e24'; ctx.beginPath(); ctx.arc(lx, ly, Math.max(4, ts * 0.2), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(lx, ly, Math.max(2.5, ts * 0.13), 0, Math.PI * 2); ctx.fill();
  }
}
