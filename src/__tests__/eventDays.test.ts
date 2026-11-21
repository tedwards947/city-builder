// Stadium events (sim/eventDays.ts, LEISURE_DESIGN.md part 4; timed since
// 2026-11-20): on a clock of its own the stadium fills for `duration` ticks.
// The crowd grows, holds and drains on the traffic passes; tickets come from
// the fans who arrive; residents stuck in its jam cost political capital while
// the jam lasts, and a few bad events in a row drop their homes a level.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { TransitSystem } from '../sim/systems/TransitSystem';
import { BUILDING_STADIUM, BUILDING_POLICE, ROAD_STREET, ROAD_AVENUE, ZONE_R } from '../sim/constants';
import { BALANCE } from '../data/balance';
import {
  eventOn, eventIntensity, intensityAt, eventStatus, eventTicketIncome, stuckInEventJam, eventVenue,
  eventGap, newEventClock, tickEvents, type EventResult,
} from '../sim/eventDays';
import { serialize, deserialize } from '../persistence/Serializer';
import { createSystems } from '../sim/createSystems';
import { Scheduler } from '../sim/Scheduler';
import { landWorld } from './pcTestWorld';

const EV = BALANCE.leisure.event;
const LE = BALANCE.leisure as unknown as { gateways: Record<number, number> };
const shipped = { event: JSON.parse(JSON.stringify(EV)), gateways: { ...LE.gateways } };
const FLOW = BALANCE.transit.flowInterval;
const SIZE = 96, ROW = 30;
const START = 800;                       // the tick the test event starts (a traffic-pass tick)

let w: World;
let transit: TransitSystem;
const idx = (x: number, y: number) => w.grid.idx(x, y);
const zone = (x: number, y: number, level: number) => { w.layers.zone[idx(x, y)] = ZONE_R; w.layers.devLevel[idx(x, y)] = level; };
/** One traffic pass at `tick` (no judging). */
const at = (tick: number) => { w.tick = tick; transit.update(w); return w.traffic!; };
/** A pass at the peak of the test event. */
const peak = () => at(START + EV.ramp + FLOW);
const sum = (a: Float32Array) => a.reduce((s, v) => s + v, 0);
/** Run the game's traffic and events clock, tick by tick, from the tick after this one up to and including `until`. */
function run(until: number, each?: (tick: number) => void): void {
  for (let tick = w.tick + 1; tick <= until; tick++) {
    w.tick = tick;
    transit.update(w);
    tickEvents(w);
    each?.(tick);
  }
}
/** Hold the event that starts at `start` from just before it to its end; returns its result. */
function hold(start = START, each?: (tick: number) => void): EventResult | null {
  w.eventClock = newEventClock(start, w.eventClock?.n ?? 0);
  w.tick = start - FLOW - 1;
  const before = w.lastEvent;
  run(start + EV.duration, each);
  return w.lastEvent !== before ? w.lastEvent : null;
}

// A street along y = 30 from x = 2 to 93. The stadium (bowl x 60–63, y 25–28; entrance plaza
// (61, 29), (62, 29)) stands north of it: only its plaza touches the street, at (61, 30), (62, 30).
// Homes: `n` level-3 lots along the south side from x = 10. The test event starts at START.
function town(n: number, road = ROAD_STREET): void {
  w = landWorld(SIZE);
  for (let x = 2; x <= 93; x++) w.setRoad(x, ROW, road);
  for (let k = 0; k < n; k++) zone(10 + k, ROW + 1, 3);
  expect(w.placeBuilding(60, 25, BUILDING_STADIUM)).toBe(true);
  w.budget.politicalCapital = 100;
  w.eventClock = newEventClock(START);
  transit = new TransitSystem();
}

beforeEach(() => { LE.gateways = {}; });
afterEach(() => { Object.assign(EV, JSON.parse(JSON.stringify(shipped.event))); LE.gateways = { ...shipped.gateways }; });

describe('stadium events', () => {
  it('ship about five minutes long with a ramp, a peak and a drain, 12 to 30 minutes apart', () => {
    const s = shipped.event;
    expect(s.kind).toBe(BUILDING_STADIUM);
    expect(s.duration).toBe(600);                              // 5 min at 500 ms a tick
    expect(s.ramp + s.drain).toBeLessThan(s.duration);
    expect([s.gapMin, s.gapMax]).toEqual([1440, 3600]);          // owner 2026-11-20: a bit more infrequent
    expect(s.firstGap).toBeGreaterThan(0);
    expect(s.seats).toBeGreaterThan(0);
    expect(s.dropAfter).toBeGreaterThan(1);                    // one bad event is not a disaster
  });

  it('the crowd grows smoothly, holds, and drains', () => {
    expect(intensityAt(-1)).toBe(0);
    expect(intensityAt(0)).toBeCloseTo(1 / EV.ramp);
    expect(intensityAt(EV.ramp / 2 - 1)).toBeCloseTo(0.5);
    expect(intensityAt(EV.ramp)).toBe(1);
    expect(intensityAt(EV.duration - EV.drain)).toBe(1);
    expect(intensityAt(EV.duration - EV.drain / 2)).toBeCloseTo(0.5);
    expect(intensityAt(EV.duration - 1)).toBeCloseTo(1 / EV.drain);
    expect(intensityAt(EV.duration)).toBe(0);
    for (let t = 1; t < EV.duration; t++) expect(Math.abs(intensityAt(t) - intensityAt(t - 1))).toBeLessThanOrEqual(1 / Math.min(EV.ramp, EV.drain) + 1e-9);
  });

  it('the crowd is on the roads during the event only, at the size of the moment', () => {
    town(20);                                                  // 60 levels
    const fans = 60 * EV.fansPerLevel;
    let t = at(START - FLOW);
    expect(eventOn(w)).toBe(false);
    expect(sum(t.event.volume)).toBe(0);
    expect(t.event.field.count).toBe(0);
    // Part of the way up the ramp: that share of the crowd.
    t = at(START + 56);
    expect(eventOn(w)).toBe(true);
    expect(eventIntensity(w)).toBeCloseTo(57 / EV.ramp);
    expect(t.event.field.demand).toBeCloseTo(fans * 57 / EV.ramp);
    // The peak: all of it.
    t = peak();
    expect(t.event.field.demand).toBeCloseTo(fans);
    expect(t.event.volume[idx(50, ROW)]).toBeCloseTo(fans);     // every fan passes here
    expect(t.event.field.doorLoad[idx(61, ROW)] + t.event.field.doorLoad[idx(62, ROW)]).toBeCloseTo(fans);
    // Draining.
    t = at(START + EV.duration - 64);
    expect(t.event.field.demand).toBeCloseTo(fans * 64 / EV.drain);
    // Over.
    for (let k = 0; k < FLOW; k++) t = at(START + EV.duration + k);
    expect(eventOn(w)).toBe(false);
    expect(sum(t.event.volume)).toBe(0);
  });

  it('the weekday plays no part', () => {
    town(20);
    for (const start of [800, 808, 856, 1000]) {               // different days of the week
      w.eventClock = newEventClock(start);
      transit = new TransitSystem();
      expect(at(start + EV.ramp + FLOW).event.field.demand).toBeCloseTo(60 * EV.fansPerLevel);
    }
  });

  it('no event without a road to the stadium, without seats, or in the tutorial city', () => {
    town(20);
    w.tick = START + 10;
    expect(eventOn(w)).toBe(true);
    EV.seats = 0;
    expect(eventOn(w)).toBe(false);
    EV.seats = shipped.event.seats;
    (w as unknown as { tutorial: unknown }).tutorial = { step: 0 };
    expect(eventOn(w)).toBe(false);
    (w as unknown as { tutorial: unknown }).tutorial = undefined;
    for (const x of [61, 62]) w.setRoad(x, ROW, 0);                  // cut the street at its entrance
    for (const x of [60, 63]) w.setRoad(x, ROW, 0);
    expect(eventVenue(w).roads).toEqual([]);
    expect(eventOn(w)).toBe(false);
    expect(eventStatus(w)!.connected).toBe(false);
  });

  it('tourist fans arrive at the gateways, capped by what they bring', () => {
    town(0);
    LE.gateways = { [BUILDING_POLICE]: 15 };
    expect(w.placeBuilding(10, ROW - 1, BUILDING_POLICE)).toBe(true);
    expect(EV.touristFans).toBeGreaterThan(15);
    const t = peak();
    expect(t.event.field.demand).toBeCloseTo(15);
    expect(t.event.volume[idx(40, ROW)]).toBeCloseTo(15);
  });

  it('tickets are paid by the fans in the seats: only those who arrive, and no more than the seats', () => {
    town(20);
    const fans = 60 * EV.fansPerLevel;
    at(START - FLOW);
    expect(eventTicketIncome(w)).toBe(0);                            // before the event
    peak();
    expect(eventTicketIncome(w)).toBeCloseTo(fans * EV.ticket);
    EV.seats = 2;
    peak();
    expect(eventTicketIncome(w)).toBeCloseTo(2 * EV.ticket);
    // Fans beyond reach do not come: empty seats.
    EV.seats = shipped.event.seats;
    EV.reach = 35;                                                   // the homes are 32–51 tiles from the entrance
    const t = peak();
    expect(t.event.field.stranded).toBeGreaterThan(0);
    expect(eventTicketIncome(w)).toBeLessThan(fans * EV.ticket);
    expect(eventTicketIncome(w)).toBeCloseTo(t.event.field.demand * EV.ticket);
  });

  it('gives the pin the time to kick-off, the progress of the event and the last result', () => {
    town(20);
    w.tick = START - 100;
    expect(eventStatus(w)).toMatchObject({ ticksToEvent: 100, ticksLeft: 0, eventToday: false, stage: 'waiting', phase: 0, intensity: 0, fans: 0, connected: true, last: null });
    expect(eventStatus(w)!.daysToEvent).toBe(Math.ceil(100 / BALANCE.ticksPerDay));
    w.tick = START + 30;
    expect(eventStatus(w)).toMatchObject({ ticksToEvent: 0, ticksLeft: EV.duration - 30, eventToday: true, stage: 'ramp', phase: 30 / EV.duration, daysToEvent: 0 });
    peak();
    expect(eventStatus(w)).toMatchObject({ stage: 'peak', intensity: 1, seats: EV.seats });
    expect(eventStatus(w)!.fans).toBeGreaterThan(0);
    w.tick = START + EV.duration - 10;
    expect(eventStatus(w)).toMatchObject({ stage: 'drain', ticksLeft: 10 });
    w.tick = START + EV.duration;
    expect(eventStatus(w)).toMatchObject({ stage: 'waiting', eventToday: false });
    const none = landWorld(32);
    expect(eventStatus(none)).toBeNull();
  });
});

describe('the events clock', () => {
  it('gaps are between the two ends, differ from event to event, and are the same every time for a city', () => {
    town(0);
    const gaps = Array.from({ length: 200 }, (_, k) => eventGap(w, k + 1));
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(EV.gapMin);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(EV.gapMax);
    expect(new Set(gaps).size).toBeGreaterThan(100);
    const sorted = [...gaps].sort((a, b) => a - b);
    const median = sorted[100];
    expect(median).toBeGreaterThan(1700);                            // about 16 minutes (1980 ticks) is typical
    expect(median).toBeLessThan(2300);
    expect(Array.from({ length: 200 }, (_, k) => eventGap(w, k + 1))).toEqual(gaps);
    const untouched = landWorld(SIZE).rng();
    const again = landWorld(SIZE);
    expect(eventGap(again, 3)).toBe(gaps[2]);                         // same seed, same gaps
    expect(again.rng()).toBe(untouched);                              // and the city's own random numbers are not used up
  });

  it('the first event comes firstGap after the stadium is built, the next a gap after it ends; no stadium, no clock', () => {
    EV.fansPerLevel = 0.15;   // a crowd this small town's street can carry, so every fan arrives
    w = landWorld(SIZE);
    for (let x = 2; x <= 93; x++) w.setRoad(x, ROW, ROAD_STREET);
    for (let k = 0; k < 20; k++) zone(10 + k, ROW + 1, 3);
    transit = new TransitSystem();
    w.tick = 0;
    run(40);
    expect(w.eventClock).toBeNull();
    expect(w.placeBuilding(60, 25, BUILDING_STADIUM)).toBe(true);
    const started: number[] = [], ended: number[] = [];
    w.events.on('eventStarted', (e) => started.push((e as { tick: number }).tick));
    w.events.on('eventDayEnded', (e) => ended.push((e as { tick: number }).tick));
    run(41);
    const first = 41 + EV.firstGap;
    expect(w.eventClock).toMatchObject({ start: first, n: 0 });
    run(first + EV.duration);
    expect(started).toEqual([first]);
    expect(ended).toEqual([first + EV.duration]);
    expect(w.lastEvent!.arrived).toBeCloseTo(60 * EV.fansPerLevel);
    const second = first + EV.duration + eventGap(w, 1);
    expect(w.eventClock).toMatchObject({ start: second, n: 1, judged: 0, pc: 0 });
    // The stadium goes: so does the clock.
    expect(w.clearTile(60, 25)).toBe(true);
    run(w.tick + 1);
    expect(w.eventClock).toBeNull();
  });
});

describe('the event jam', () => {
  // 40 level-3 homes would send 18 fans a tick down one street (capacity 20); raise the crowd
  // to 0.5 a level = 60 fans at the peak, three times the street.
  const jammed = () => { town(40); EV.fansPerLevel = 0.5; };
  const quick = () => { EV.duration = 96; EV.ramp = 16; EV.drain = 16; };     // a short event: 12 passes

  it('homes on a road the crowd has filled are stuck; homes off the crowd\'s way are not', () => {
    jammed();
    for (let x = 70; x <= 73; x++) zone(x, ROW + 1, 3);              // east of the stadium, beyond the homes' route
    peak();
    expect(stuckInEventJam(w, idx(45, ROW + 1))).toBe(true);         // the whole crowd passes its door
    expect(stuckInEventJam(w, idx(10, ROW + 1))).toBe(false);        // the far end: only its own few fans
    expect(stuckInEventJam(w, idx(80, ROW + 1))).toBe(false);        // not a home
    expect(stuckInEventJam(w, idx(73, ROW + 1))).toBe(false);        // the east side sends few
  });

  it('an avenue carries the same crowd without a jam', () => {
    town(40, ROAD_AVENUE);
    EV.fansPerLevel = 0.5;
    const r = hold()!;
    expect(r.stuckResidents).toBe(0);
    expect(r.pc).toBe(0);
    expect(w.budget.politicalCapital).toBe(100);
    expect(r.arrived).toBeCloseTo(60);
    expect(r.wanted).toBeCloseTo(60);
    expect(r.tick).toBe(START + EV.duration);
  });

  it('the damage builds while the jam lasts: capital goes point by point, and the result is kept and announced', () => {
    jammed();
    EV.pcPerStuckResident = 0.05;
    const heard: unknown[] = [];
    w.events.on('eventDayEnded', (e) => heard.push(e));
    const pcAt: number[] = [];
    const r = hold(START, (tick) => { if (tick % 100 === 0) pcAt.push(w.budget.politicalCapital); })!;
    // Nothing yet early in the ramp, then lower at every look until the crowd drains.
    expect(pcAt[0]).toBe(100);
    for (let k = 2; k <= 5; k++) expect(pcAt[k]).toBeLessThan(pcAt[k - 1]);
    expect(pcAt.slice(0, -1).every((v) => Number.isInteger(v))).toBe(true);   // whole points while it runs
    expect(r.stuckResidents).toBeGreaterThan(0);
    expect(r.stuckResidents % BALANCE.growth.popPerLevel[3]).toBe(0);
    expect(r.pc).toBeGreaterThan(0);
    expect(r.pc).toBeLessThan(r.stuckResidents * EV.pcPerStuckResident);        // nobody was stuck for the whole of it
    expect(r.pc).toBeGreaterThan(r.stuckResidents * EV.pcPerStuckResident * 0.5);
    expect(w.budget.politicalCapital).toBeCloseTo(100 - r.pc);
    expect(r.seats).toBe(EV.seats);
    expect(w.lastEvent).toEqual(r);
    expect(heard).toEqual([r]);
    expect(w.eventStuck.every((v) => v === 0)).toBe(true);                     // cleared for the next event
  });

  it('fixing the jam mid-event pays: the capital stops going and no home has a bad event', () => {
    jammed();
    EV.pcPerStuckResident = 0.05;
    const bad = hold()!;
    const cost = bad.pc;
    expect(w.eventStrain[idx(45, ROW + 1)]).toBe(1);
    // The same again, but a minute and a half in the street becomes an avenue.
    jammed();
    EV.pcPerStuckResident = 0.05;
    let after = -1;
    const fixAt = START + 180;
    const r = hold(START, (tick) => {
      if (tick === fixAt) for (let x = 2; x <= 93; x++) w.setRoad(x, ROW, ROAD_AVENUE);
      if (tick === fixAt + 2 * FLOW) after = w.budget.politicalCapital;
    })!;
    expect(eventStatus(w)!.stuckResidents).toBe(0);
    expect(after).toBeLessThan(100);                                  // it had cost something by then
    expect(100 - w.budget.politicalCapital - (100 - after)).toBeLessThan(1);   // and next to nothing after the fix
    expect(r.pc).toBeLessThan(cost / 2);
    expect(r.stuckResidents).toBe(0);                                 // stuck for too little of it to count
    expect(w.eventStrain[idx(45, ROW + 1)]).toBe(0);
  });

  it('strain counts bad events until the home drops a level, and a good event takes one off', () => {
    jammed();
    quick();
    const stuck = idx(45, ROW + 1), fine = idx(10, ROW + 1);
    const declines: number[] = [];
    w.events.on('tileDeclined', (e) => { if ((e as { reason: string }).reason === 'event') declines.push((e as { level: number }).level); });
    let next = START;
    const event = () => { const r = hold(next)!; next += 400; return r; };
    EV.dropAfter = 3;   // the walk-through below counts to three (shipped: 2, ENGINEER 3)
    expect(event().declined).toBe(0);
    expect(w.eventStrain[stuck]).toBe(1);
    expect(w.eventStrain[fine]).toBe(0);
    expect(event().declined).toBe(0);
    expect(w.eventStrain[stuck]).toBe(2);
    expect(w.layers.devLevel[stuck]).toBe(3);
    // A good event (the street is now an avenue) takes one off …
    for (let x = 2; x <= 93; x++) w.setRoad(x, ROW, ROAD_AVENUE);
    expect(event().stuckResidents).toBe(0);
    expect(w.eventStrain[stuck]).toBe(1);
    // … and two more bad ones bring it to three: the home drops a level and starts again.
    for (let x = 2; x <= 93; x++) { w.layers.roadClass[idx(x, ROW)] = ROAD_STREET; }
    w.grid.edits++;
    transit = new TransitSystem();
    event();
    expect(w.eventStrain[stuck]).toBe(2);
    const third = event();
    expect(third.declined).toBeGreaterThan(0);
    expect(w.layers.devLevel[stuck]).toBe(2);
    expect(w.eventStrain[stuck]).toBe(0);
    expect(w.layers.devLevel[fine]).toBe(3);
    expect(declines.every((l) => l === 2)).toBe(true);
    expect(declines.length).toBe(third.declined);
    expect(w.eventClock!.n).toBe(5);
  });

  it('a merged lot never drops a level, but its residents count', () => {
    jammed();
    quick();
    const i = idx(45, ROW + 1);
    w.layers.lot[i] = 1;                                             // stands in for a tower's tile
    EV.dropAfter = 1;
    const r = hold()!;
    expect(r.declined).toBeGreaterThan(0);                           // its neighbours dropped
    expect(w.layers.devLevel[i]).toBe(3);
    expect(w.eventStrain[i]).toBe(1);
  });

  it('with dropAfter 0 homes never drop, only the capital is charged', () => {
    jammed();
    quick();
    EV.dropAfter = 0;
    EV.pcPerStuckResident = 0.05;
    for (let k = 0; k < 5; k++) expect(hold(START + k * 400)!.declined).toBe(0);
    expect(w.budget.politicalCapital).toBeLessThan(100);
  });

  it('an event with no road to the stadium all through is not judged, and the next is still set', () => {
    jammed();
    quick();
    for (const x of [60, 61, 62, 63]) w.setRoad(x, ROW, 0);
    expect(hold()).toBeNull();
    expect(w.budget.politicalCapital).toBe(100);
    expect(w.eventClock).toMatchObject({ n: 1, start: START + EV.duration + eventGap(w, 1) });
  });
});

describe('events in the running game', () => {
  it('the whole simulation holds the event once, and the clock, counts, strain and last result survive a save', () => {
    town(40);
    EV.fansPerLevel = 0.5;
    const sim = createSystems();
    const scheduler = new Scheduler(w, sim.systems);
    const started: number[] = [], ended: number[] = [];
    w.events.on('eventStarted', (e) => started.push((e as { tick: number }).tick));
    w.events.on('eventDayEnded', (e) => ended.push((e as { tick: number }).tick));
    w.tick = START - 40;
    while (w.tick < START + 300) scheduler.tick();
    // Mid-event: saved and loaded, it carries on from where it was.
    expect(started).toEqual([START]);
    expect(w.eventClock!.judged).toBeGreaterThan(20);
    w.eventStuck[idx(45, ROW + 1)] = 7;
    const mid = deserialize(serialize(w));
    expect(mid.eventClock).toEqual(w.eventClock);
    expect(Array.from(mid.eventStuck)).toEqual(Array.from(w.eventStuck));
    while (w.tick < START + EV.duration + 60) scheduler.tick();
    expect(ended).toEqual([START + EV.duration]);
    expect(w.lastEvent!.tick).toBe(START + EV.duration);
    const back = deserialize(serialize(w));
    expect(back.lastEvent).toEqual(w.lastEvent);
    expect(back.eventClock).toEqual(w.eventClock);
    expect(Array.from(back.eventStrain)).toEqual(Array.from(w.eventStrain));
    // A city saved before timed events has no clock: its first event is set from the load.
    const old = serialize(w) as unknown as { lastEvent?: unknown; eventClock?: unknown; layers: { eventStrain?: unknown; eventStuck?: unknown } };
    delete old.lastEvent; delete old.eventClock; delete old.layers.eventStrain; delete old.layers.eventStuck;
    const fresh = deserialize(old as never);
    expect(fresh.lastEvent).toBeNull();
    expect(fresh.eventClock).toBeNull();
    expect(fresh.eventStrain.every((v) => v === 0)).toBe(true);
    tickEvents(fresh);
    expect(fresh.eventClock).toMatchObject({ start: fresh.tick + EV.firstGap, n: 0 });
  });
});
