// Stadium events (LEISURE_DESIGN.md Q6; owner 2026-11-20: timed, not tied to
// the calendar, long enough to fix the jam while it lasts).
//
//   WHEN     Events run on a clock of their own, in sim ticks (world.eventClock).
//            The first starts `firstGap` ticks after the city gets a stadium.
//            Each lasts `duration` ticks; the gap to the next is drawn between
//            `gapMin` and `gapMax` from the city's seed (eventGap: short gaps
//            are likelier, and the same city always gets the same gaps). The
//            weekday plays no part.
//   THE CROWD  While an event is on, the `event` traffic market runs: every
//            home sends fans (fansPerLevel per level) and tourist fans arrive
//            at the gateways (touristFans, capped by what the gateways bring),
//            all bound for the stadium, whose doors take `seats` in all. The
//            crowd is scaled by eventIntensity: it grows from nothing over the
//            first `ramp` ticks, holds, and drains over the last `drain`. Each
//            traffic pass carries the crowd of that moment on top of everything
//            else. Between events the market has no doors and costs nothing.
//   TURNOUT  Fans further than `reach` of travel time send nobody, and a jam
//            makes every road tile longer, so a city that seizes up strands
//            its own fans. Tickets are paid only by the fans who arrive, up
//            to the seats (eventTicketIncome, every tick of the event).
//   THE JAM  A home is STUCK while a street or avenue beside it is at or over
//            `jam.load` of its capacity AND the crowd is at least
//            `jam.eventShare` of that capacity on it, so the jam is the
//            crowd's and not an everyday one.
//   DAMAGE BUILDS  After every traffic pass of the event (judgeEventPass) the
//            stuck residents cost political capital: `pcPerStuckResident` each
//            for a whole event stuck, charged a share at a time in whole
//            points (reason 'eventJam'), and each stuck home's count for this
//            event (world.eventStuck) goes up. Fix the jam mid-event and both
//            stop.
//   THE END  When the event ends (endEvent): a home stuck for `stuckShare` or
//            more of the event had a BAD EVENT and its STRAIN
//            (world.eventStrain) goes up by one; any other home loses one. A
//            home whose strain reaches `dropAfter` loses a level and starts
//            again from 0: a few bad events in a row empty the streets round
//            the stadium (dropAfter 0, as shipped since 2026-11-20: never). (A
//            merged lot is one building and never drops a level; its residents
//            still count.) A SMOOTH event (most seatable fans in, few residents
//            stuck: `smooth`) earns `smooth.pcShare` of the PC cap, reason
//            'eventSmooth', up to the cap. The result is kept in
//            world.lastEvent and announced (`eventDayEnded`).
//
// The clock, this event's counts, strain and the last result are saved.
// world.rng is not drawn from. Nothing happens in the tutorial city.

import type { World, BuildingEntity } from './World';
import { BALANCE } from '../data/balance';
import { ROAD_NONE, ROAD_HIGHWAY, ZONE_R } from './constants';
import { addDoorProvider, addTripProvider, setMarketScale, servedAtDoors, roadCapacity, trafficVolume } from './TrafficData';
import { gatewayRoads } from './leisureTraffic';
import { doorTile } from './lots';
import { changePc, pcCap } from './politics';
import { mulberry32 } from './rng';

const cfg = () => BALANCE.leisure.event;

/** What happened at an event. Trips are per tick. */
export interface EventResult {
  /** The tick it ended on. */
  tick: number;
  /** The venue's anchor tile. */
  tx: number;
  ty: number;
  /** Fans who wanted to come at the height of the event (those with no way there in time included). */
  wanted: number;
  /** Fans in the seats at the best moment: those who arrived, up to the seats. */
  arrived: number;
  seats: number;
  /** Residents of homes that had a bad event (stuck in its jam for `stuckShare` of it or more). */
  stuckResidents: number;
  /** Political capital the jam cost over the event (0 or more). */
  pc: number;
  /** Homes that lost a level for one bad event too many. */
  declined: number;
  /** Whether it went smoothly (see `smooth` in BALANCE.leisure.event), and the political capital that earned. */
  smooth: boolean;
  reward: number;
}

/** When the next event is, and the running counts of the one that is on. Saved. */
export interface EventClock {
  /** The tick the next event starts, or the one that is on started. */
  start: number;
  /** How many events the venue has held before this one (picks the gap, eventGap). */
  n: number;
  /** Traffic passes judged so far in this event. */
  judged: number;
  /** The most fans who wanted to come, and who were in the seats, on any pass so far. */
  wanted: number;
  arrived: number;
  /** Residents stuck on the last pass judged. */
  stuckNow: number;
  /** Political capital charged so far in this event, and the part of a point not yet charged. */
  pc: number;
  pcOwed: number;
}

export function newEventClock(start: number, n = 0): EventClock {
  return { start, n, judged: 0, wanted: 0, arrived: 0, stuckNow: 0, pc: 0, pcOwed: 0 };
}

/**
 * Ticks between the end of event `n − 1` and the start of event `n` (n ≥ 1):
 * between gapMin and gapMax, short gaps likelier (the middle draw is a quarter
 * of the way up). From the city's seed and `n` only, so it never changes for a
 * city and does not disturb world.rng.
 */
export function eventGap(world: World, n: number): number {
  const c = cfg();
  const u = mulberry32((world.seed ^ 0x57AD10) + Math.imul(n, 0x9e3779b1))();
  return Math.round(c.gapMin + Math.max(0, c.gapMax - c.gapMin) * u * u);
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

/** Ticks into the event that is on by the clock, or −1 between events. */
function elapsed(world: World): number {
  const clock = world.eventClock;
  if (!clock) return -1;
  const t = world.tick - clock.start;
  return t >= 0 && t < cfg().duration ? t : -1;
}

/** Whether an event is on right now: inside its time, a venue with a road, seats to fill, not the tutorial. */
export function eventOn(world: World): boolean {
  if (world.tutorial || !(cfg().seats > 0) || elapsed(world) < 0) return false;
  return eventVenue(world).roads.length > 0;
}

/** The crowd's size at `t` ticks into an event, 0–1: up over `ramp`, level, down over `drain`. */
export function intensityAt(t: number): number {
  const c = cfg();
  if (t < 0 || t >= c.duration) return 0;
  const up = c.ramp > 0 ? (t + 1) / c.ramp : 1;
  const down = c.drain > 0 ? (c.duration - t) / c.drain : 1;
  return Math.min(1, up, down);
}

/** The crowd's size right now, 0–1 (0 between events). */
export function eventIntensity(world: World): number {
  return eventOn(world) ? intensityAt(elapsed(world)) : 0;
}

// The venue's doors exist during events only.
addDoorProvider((world, market, add) => {
  if (market !== 'event' || !eventOn(world)) return;
  const { roads } = eventVenue(world);
  for (const ri of roads) add(ri, cfg().seats / roads.length);
});

// The fans homes send grow and drain with the event.
setMarketScale('event', eventIntensity);

// Tourist fans arrive at the gateways, likewise.
addTripProvider((world, market, add) => {
  if (market !== 'event' || !(cfg().touristFans > 0)) return;
  const scale = eventIntensity(world);
  if (!(scale > 0)) return;
  const gates = gatewayRoads(world);
  let total = 0;
  for (const g of gates) total += g.capacity;
  if (!(total > 0)) return;
  const fans = Math.min(total, cfg().touristFans) * scale;
  for (const g of gates) for (const ri of g.roads) add(ri, fans * g.capacity / total / g.roads.length, g.level);
});

/** Fans in the seats on the last traffic pass (0 between events). */
function fansArrived(world: World): number {
  if (!world.traffic || !eventOn(world)) return 0;
  return servedAtDoors(eventVenue(world).roads, world.traffic.event.field, cfg().seats);
}

/** Money per tick from event tickets: `ticket` for every fan in the seats. 0 between events. */
export function eventTicketIncome(world: World): number {
  const ticket = cfg().ticket;
  return ticket > 0 ? fansArrived(world) * ticket : 0;
}

/** For the venue's pin, its animation and Inspect. */
export interface EventStatus {
  /** Sim ticks until the next event starts; 0 while one is on. */
  ticksToEvent: number;
  /** While one is on: ticks until it ends. 0 between events. */
  ticksLeft: number;
  /** An event is on now (false inside its time if no road reaches the venue). */
  eventToday: boolean;
  /** Where in the event we are: 'ramp' (crowd arriving), 'peak', 'drain' (leaving); 'waiting' between events. */
  stage: 'waiting' | 'ramp' | 'peak' | 'drain';
  /** How far through the event we are, 0–1 (by tick; add the fraction of the current tick for smooth motion). 0 between events. */
  phase: number;
  /** The crowd's size now, 0–1. */
  intensity: number;
  /** Whole game days until the next event (ticksToEvent in days, rounded up); 0 while one is on. */
  daysToEvent: number;
  /** Fans in the seats right now, and the seats (0 fans between events). */
  fans: number;
  seats: number;
  /** While one is on: residents stuck in its jam on the last traffic pass, and the political capital it has cost so far. */
  stuckResidents: number;
  pc: number;
  /** Whether a street or avenue reaches the venue. */
  connected: boolean;
  /** The last event's result, if there has been one. */
  last: EventResult | null;
}

/** The event status of the city's venue, or null if it has none. */
export function eventStatus(world: World): EventStatus | null {
  const { venue, roads } = eventVenue(world);
  if (!venue) return null;
  const c = cfg(), clock = world.eventClock;
  const t = elapsed(world);
  const ticksToEvent = t >= 0 ? 0 : clock ? Math.max(0, clock.start - world.tick) : c.firstGap;
  const on = eventOn(world);
  return {
    ticksToEvent,
    ticksLeft: t >= 0 ? c.duration - t : 0,
    eventToday: on,
    stage: t < 0 ? 'waiting' : t < c.ramp ? 'ramp' : t >= c.duration - c.drain ? 'drain' : 'peak',
    phase: t >= 0 ? t / c.duration : 0,
    intensity: on ? intensityAt(t) : 0,
    daysToEvent: Math.ceil(ticksToEvent / BALANCE.ticksPerDay),
    fans: fansArrived(world), seats: c.seats,
    stuckResidents: on && clock ? clock.stuckNow : 0,
    pc: t >= 0 && clock ? clock.pc : 0,
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

/** Traffic passes in a whole event (the times it is judged). */
function passesPerEvent(): number {
  return Math.max(1, cfg().duration / BALANCE.transit.flowInterval);
}

/**
 * Judge the event as it stands after a traffic pass: note the turnout, count
 * every stuck home once more for this event, and charge political capital for
 * the stuck residents (a pass's share of pcPerStuckResident each, in whole
 * points as they add up). Returns the residents stuck now. Does nothing
 * between events.
 */
export function judgeEventPass(world: World): number {
  const clock = world.eventClock;
  if (!clock || !world.traffic || !eventOn(world)) return 0;
  const { venue } = eventVenue(world);
  const field = world.traffic.event.field;
  const c = cfg();
  const zone = world.layers.zone, dev = world.layers.devLevel, abandoned = world.layers.abandoned;
  const stuckCount = world.eventStuck;
  const pop = BALANCE.growth.popPerLevel;
  let stuck = 0;
  const { zoned, zonedCount } = world.index;
  for (let q = 0; q < zonedCount; q++) {
    const i = zoned[q];
    if (zone[i] !== ZONE_R || dev[i] === 0 || abandoned[i] !== 0) continue;
    if (!stuckInEventJam(world, i)) continue;
    stuck += pop[dev[i]] ?? 0;
    if (stuckCount[i] < 255) stuckCount[i]++;
  }
  clock.judged++;
  clock.stuckNow = stuck;
  clock.wanted = Math.max(clock.wanted, field.demand + field.stranded);
  clock.arrived = Math.max(clock.arrived, fansArrived(world));
  clock.pcOwed += stuck * c.pcPerStuckResident / passesPerEvent();
  const whole = Math.floor(clock.pcOwed);
  if (whole >= 1) {
    clock.pcOwed -= whole;
    clock.pc -= changePc(world, -whole, 'eventJam', { tx: venue!.tx, ty: venue!.ty });
  }
  return stuck;
}

/**
 * End the event that is on the clock: charge what is left of the jam's cost,
 * move every home's strain (see the top of this file), record and announce
 * the result (`eventDayEnded`), and set the clock for the next event. Returns
 * the result, or null if the event never ran (no road to the venue all through).
 */
export function endEvent(world: World): EventResult | null {
  const clock = world.eventClock;
  if (!clock) return null;
  const { venue } = eventVenue(world);
  let result: EventResult | null = null;
  if (clock.judged > 0 && venue) {
    const c = cfg();
    if (clock.pcOwed > 0) clock.pc -= changePc(world, -clock.pcOwed, 'eventJam', { tx: venue.tx, ty: venue.ty });
    const zone = world.layers.zone, dev = world.layers.devLevel, abandoned = world.layers.abandoned, lot = world.layers.lot;
    const strain = world.eventStrain, stuckCount = world.eventStuck;
    const pop = BALANCE.growth.popPerLevel;
    const { width } = world.grid;
    // Stuck for this many passes or more is a bad event (the count stops at 255).
    const bad = Math.min(255, Math.max(1, c.stuckShare * clock.judged));
    let stuckResidents = 0, declined = 0;
    const { zoned, zonedCount } = world.index;
    for (let q = 0; q < zonedCount; q++) {
      const i = zoned[q];
      if (zone[i] !== ZONE_R || dev[i] === 0 || abandoned[i] !== 0) { strain[i] = 0; continue; }
      if (stuckCount[i] < bad) { if (strain[i] > 0) strain[i]--; continue; }
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
    // A smooth event (owner 2026-11-20): most of the fans who could be seated got in, and few
    // residents were stuck. It earns a share of the PC cap (up to the cap).
    const s = c.smooth;
    const seatable = Math.min(clock.wanted, c.seats);
    const smooth = s.pcShare > 0 && seatable > 0 && clock.arrived >= s.minFill * seatable
      && stuckResidents <= s.maxStuckShare * world.stats.population;
    const reward = smooth ? changePc(world, s.pcShare * pcCap(world), 'eventSmooth', { tx: venue.tx, ty: venue.ty }) : 0;
    result = {
      tick: world.tick, tx: venue.tx, ty: venue.ty,
      wanted: clock.wanted, arrived: clock.arrived, seats: c.seats,
      stuckResidents, pc: clock.pc, declined, smooth, reward,
    };
    world.lastEvent = result;
    world.events.emit('eventDayEnded', { ...result });
  }
  world.eventStuck.fill(0);
  world.eventClock = newEventClock(world.tick + eventGap(world, clock.n + 1), clock.n + 1);
  return result;
}

/**
 * One tick of the events clock (EventDaySystem): starts the clock when the
 * city gets a venue and drops it when the venue goes, announces a start
 * (`eventStarted`), judges the event after each traffic pass and ends it.
 */
export function tickEvents(world: World): void {
  if (world.tutorial) return;
  const c = cfg();
  const { venue } = eventVenue(world);
  if (!venue || !(c.seats > 0)) {
    if (world.eventClock) { world.eventClock = null; world.eventStuck.fill(0); }
    return;
  }
  const clock = world.eventClock;
  if (!clock) { world.eventClock = newEventClock(world.tick + c.firstGap); return; }
  const t = world.tick - clock.start;
  if (t < 0) return;
  if (t >= c.duration) { endEvent(world); return; }
  if (t === 0 && eventOn(world)) world.events.emit('eventStarted', { tick: world.tick, tx: venue.tx, ty: venue.ty, duration: c.duration });
  if (world.tick % BALANCE.transit.flowInterval === 0) judgeEventPass(world);
}
