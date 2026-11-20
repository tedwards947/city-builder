// Event days (LEISURE_DESIGN.md Q6): once a week the stadium fills.
//
//   WHEN     On BALANCE.leisure.event.weekday (Saturday; sim/calendar.ts),
//            for the whole game day, if the city has a stadium that a street
//            or avenue reaches.
//   THE CROWD  The `event` traffic market runs for that day only: every home
//            sends fans (fansPerLevel per level), and tourist fans arrive at
//            the gateways (touristFans, capped by what the gateways bring).
//            They all drive to the stadium, whose doors take `seats` in all.
//            That day's traffic pass carries them on top of everything else.
//            On other days the market has no doors, holds nothing and costs
//            nothing.
//   TURNOUT  Fans further than `reach` of travel time send nobody, and a jam
//            makes every road tile longer, so a city that seizes up strands
//            its own fans. Tickets are paid only by the fans who arrive, up
//            to the seats (eventTicketIncome, every tick of the event day).
//   THE JAM  At the end of the event day (judgeEventDay): a home is STUCK if
//            a street or avenue beside it is at or over `jam.load` of its
//            capacity AND the crowd is at least `jam.eventShare` of that
//            capacity on it, so the jam is the crowd's and not an everyday
//            one. Stuck residents cost political capital
//            (pcPerStuckResident each, reason 'eventJam'). A stuck home's
//            STRAIN (world.eventStrain) goes up by one; a home that was not
//            stuck loses one. A home whose strain reaches `dropAfter` loses a
//            level and starts again from 0: a few bad event days in a row
//            empty the streets round the stadium. (A merged lot is one
//            building and never drops a level; its residents still count.)
//
// world.lastEvent keeps the last event day's result, for the venue's pin and
// the toast. Strain and the last result are saved. No random numbers are
// drawn. Nothing happens in the tutorial city.

import type { World, BuildingEntity } from './World';
import { BALANCE } from '../data/balance';
import { ROAD_NONE, ROAD_HIGHWAY, ZONE_R } from './constants';
import { addDoorProvider, addTripProvider, servedAtDoors, roadCapacity, trafficVolume } from './TrafficData';
import { weekday, daysUntil } from './calendar';
import { gatewayRoads } from './leisureTraffic';
import { doorTile } from './lots';
import { changePc } from './politics';

const cfg = () => BALANCE.leisure.event;

/** What happened on an event day. Trips are per tick. */
export interface EventResult {
  /** The tick it was judged on (the last tick of the event day). */
  tick: number;
  /** The venue's anchor tile. */
  tx: number;
  ty: number;
  /** Fans who wanted to come (those with no way there in time included). */
  wanted: number;
  /** Fans who got in: those who arrived, up to the seats. */
  arrived: number;
  seats: number;
  /** Residents of homes stuck in the event's jam. */
  stuckResidents: number;
  /** Political capital the jam cost (0 or more). */
  pc: number;
  /** Homes that lost a level for being stuck once too often. */
  declined: number;
}

const roadCache = new WeakMap<World, { edits: number; venue: BuildingEntity | null; roads: number[] }>();

/** The city's venue (its stadium) and the streets and avenues that reach it; `venue` null if it has none. */
export function eventVenue(world: World): { venue: BuildingEntity | null; roads: number[] } {
  let c = roadCache.get(world);
  if (!c || c.edits !== world.grid.edits) {
    const venue = world.buildings.find((b) => b.kind === cfg().kind) ?? null;
    c = { edits: world.grid.edits, venue, roads: venue ? world.buildingAccessRoads(venue.tx, venue.ty) : [] };
    roadCache.set(world, c);
  }
  return c;
}

/** Whether today is an event day in this city: the right weekday, a venue with a road, seats to fill, not the tutorial. */
export function eventToday(world: World): boolean {
  if (world.tutorial || !(cfg().seats > 0) || weekday(world.tick) !== cfg().weekday) return false;
  return eventVenue(world).roads.length > 0;
}

// The venue's doors exist on event days only.
addDoorProvider((world, market, add) => {
  if (market !== 'event' || !eventToday(world)) return;
  const { roads } = eventVenue(world);
  for (const ri of roads) add(ri, cfg().seats / roads.length);
});

// Tourist fans arrive at the gateways.
addTripProvider((world, market, add) => {
  if (market !== 'event' || !(cfg().touristFans > 0) || !eventToday(world)) return;
  const gates = gatewayRoads(world);
  let total = 0;
  for (const g of gates) total += g.capacity;
  if (!(total > 0)) return;
  const fans = Math.min(total, cfg().touristFans);
  for (const g of gates) for (const ri of g.roads) add(ri, fans * g.capacity / total / g.roads.length);
});

/** Fans in the seats on the last traffic pass (0 off event days). */
function fansArrived(world: World): number {
  if (!world.traffic || !eventToday(world)) return 0;
  return servedAtDoors(eventVenue(world).roads, world.traffic.event.field, cfg().seats);
}

/** Money per tick from event tickets: `ticket` for every fan in the seats. 0 off event days. */
export function eventTicketIncome(world: World): number {
  const ticket = cfg().ticket;
  return ticket > 0 ? fansArrived(world) * ticket : 0;
}

/** For the venue's pin and its animation. */
export interface EventStatus {
  /** Whole days until the next event day; 0 = today. */
  daysToEvent: number;
  /** An event is on now (false on the weekday if no road reaches the venue). */
  eventToday: boolean;
  /** How far through today we are, 0–1 (by tick; add the fraction of the current tick for smooth motion). */
  phase: number;
  /** Fans in the seats right now, and the seats (0 fans off event days). */
  fans: number;
  seats: number;
  /** Whether a street or avenue reaches the venue. */
  connected: boolean;
  /** The last event day's result, if there has been one. */
  last: EventResult | null;
}

/** The event status of the city's venue, or null if it has none. */
export function eventStatus(world: World): EventStatus | null {
  const { venue, roads } = eventVenue(world);
  if (!venue) return null;
  const tpd = BALANCE.ticksPerDay;
  return {
    daysToEvent: daysUntil(world.tick, cfg().weekday),
    eventToday: eventToday(world),
    phase: (((world.tick % tpd) + tpd) % tpd) / tpd,
    fans: fansArrived(world), seats: cfg().seats,
    connected: roads.length > 0,
    last: world.lastEvent,
  };
}

/** Whether the home on tile `i` is stuck in the event's jam, from the last traffic pass. */
export function stuckInEventJam(world: World, i: number): boolean {
  const t = world.traffic;
  if (!t) return false;
  const { width, height } = world.grid;
  const roadClass = world.layers.roadClass;
  const jam = cfg().jam;
  const door = world.layers.lot[i] !== 0 ? doorTile(world, i) : i;
  const x = door % width;
  const around = [x > 0 ? door - 1 : -1, x < width - 1 ? door + 1 : -1, door >= width ? door - width : -1, door < width * (height - 1) ? door + width : -1];
  for (const ri of around) {
    if (ri < 0) continue;
    const rc = roadClass[ri];
    if (rc === ROAD_NONE || rc === ROAD_HIGHWAY) continue;
    const cap = roadCapacity(rc);
    if (trafficVolume(t, ri) >= jam.load * cap && t.event.volume[ri] >= jam.eventShare * cap) return true;
  }
  return false;
}

/**
 * Judge the event day that is ending: count the turnout, charge political
 * capital for the residents stuck in its jam, and move every home's strain
 * (see the top of this file). Records and returns the result, and emits
 * `eventDayEnded`. Null, and nothing changes, if today is no event day.
 */
export function judgeEventDay(world: World): EventResult | null {
  if (!eventToday(world) || !world.traffic) return null;
  const { venue } = eventVenue(world);
  const field = world.traffic.event.field;
  const c = cfg();
  const zone = world.layers.zone, dev = world.layers.devLevel, abandoned = world.layers.abandoned, lot = world.layers.lot;
  const strain = world.eventStrain;
  const pop = BALANCE.growth.popPerLevel;
  const { width } = world.grid;
  let stuckResidents = 0, declined = 0;
  const { zoned, zonedCount } = world.index;
  for (let q = 0; q < zonedCount; q++) {
    const i = zoned[q];
    if (zone[i] !== ZONE_R || dev[i] === 0 || abandoned[i] !== 0) { strain[i] = 0; continue; }
    if (!stuckInEventJam(world, i)) { if (strain[i] > 0) strain[i]--; continue; }
    stuckResidents += pop[dev[i]] ?? 0;
    if (strain[i] < 255) strain[i]++;
    if (c.dropAfter > 0 && strain[i] >= c.dropAfter && lot[i] === 0) {
      dev[i]--;
      strain[i] = 0;
      declined++;
      const x = i % width, y = (i - x) / width;
      world.grid.markDirty(x, y);
      world.events.emit('tileDeclined', { tx: x, ty: y, zone: ZONE_R, level: dev[i], reason: 'event' });
    }
  }
  const cost = stuckResidents * c.pcPerStuckResident;
  const pc = cost > 0 ? -changePc(world, -cost, 'eventJam', { tx: venue!.tx, ty: venue!.ty }) : 0;
  const result: EventResult = {
    tick: world.tick, tx: venue!.tx, ty: venue!.ty,
    wanted: field.demand + field.stranded, arrived: fansArrived(world), seats: c.seats,
    stuckResidents, pc, declined,
  };
  world.lastEvent = result;
  world.events.emit('eventDayEnded', { ...result });
  return result;
}
