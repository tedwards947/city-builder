// Event days (sim/eventDays.ts, LEISURE_DESIGN.md part 4): on Saturdays the
// stadium fills. The crowd rides that day's traffic pass; tickets come from
// the fans who arrive; residents stuck in its jam cost political capital and
// take strain that, over a few bad event days, drops their homes a level.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { TransitSystem } from '../sim/systems/TransitSystem';
import { BUILDING_STADIUM, BUILDING_POLICE, ROAD_STREET, ROAD_AVENUE, ZONE_R } from '../sim/constants';
import { BALANCE } from '../data/balance';
import { SATURDAY, weekday } from '../sim/calendar';
import { eventToday, eventStatus, eventTicketIncome, judgeEventDay, stuckInEventJam, eventVenue } from '../sim/eventDays';
import { serialize, deserialize } from '../persistence/Serializer';
import { createSystems } from '../sim/createSystems';
import { Scheduler } from '../sim/Scheduler';
import { landWorld } from './pcTestWorld';

const EV = BALANCE.leisure.event;
const LE = BALANCE.leisure as unknown as { gateways: Record<number, number> };
const shipped = { event: JSON.parse(JSON.stringify(EV)), gateways: { ...LE.gateways } };
const TPD = BALANCE.ticksPerDay;
const SIZE = 96, ROW = 30;
/** The first tick of the Saturday of week `week` (day 0 is a Monday). */
const saturday = (week = 0) => (week * 7 + SATURDAY) * TPD;

let w: World;
let transit: TransitSystem;
const idx = (x: number, y: number) => w.grid.idx(x, y);
const zone = (x: number, y: number, level: number) => { w.layers.zone[idx(x, y)] = ZONE_R; w.layers.devLevel[idx(x, y)] = level; };
/** One traffic pass at `tick`. */
const at = (tick: number) => { w.tick = tick; transit.update(w); return w.traffic!; };
const sum = (a: Float32Array) => a.reduce((s, v) => s + v, 0);

// A street along y = 30 from x = 2 to 93. The stadium (bowl x 60–63, y 25–28; entrance plaza
// (61, 29), (62, 29)) stands north of it: only its plaza touches the street, at (61, 30), (62, 30).
// Homes: `n` level-3 lots along the south side from x = 10.
function town(n: number, road = ROAD_STREET): void {
  w = landWorld(SIZE);
  for (let x = 2; x <= 93; x++) w.setRoad(x, ROW, road);
  for (let k = 0; k < n; k++) zone(10 + k, ROW + 1, 3);
  expect(w.placeBuilding(60, 25, BUILDING_STADIUM)).toBe(true);
  w.budget.politicalCapital = 100;
  transit = new TransitSystem();
}

beforeEach(() => { LE.gateways = {}; });
afterEach(() => { Object.assign(EV, JSON.parse(JSON.stringify(shipped.event))); LE.gateways = { ...shipped.gateways }; });

describe('event days', () => {
  it('ship on Saturdays at the stadium', () => {
    expect(shipped.event.kind).toBe(BUILDING_STADIUM);
    expect(shipped.event.weekday).toBe(SATURDAY);
    expect(shipped.event.seats).toBeGreaterThan(0);
    expect(shipped.event.dropAfter).toBeGreaterThan(1);       // one bad day is not a disaster
  });

  it('the crowd is on the roads on Saturday only', () => {
    town(20);                                                  // 60 levels
    const fans = 60 * EV.fansPerLevel;
    for (let day = 0; day < 7; day++) {
      const t = at(day * TPD);
      expect(eventToday(w)).toBe(day === SATURDAY);
      if (day === SATURDAY) {
        expect(t.event.field.demand).toBeCloseTo(fans);
        expect(t.event.volume[idx(50, ROW)]).toBeCloseTo(fans);     // every fan passes here
        expect(t.event.field.doorLoad[idx(61, ROW)] + t.event.field.doorLoad[idx(62, ROW)]).toBeCloseTo(fans);
      } else {
        expect(sum(t.event.volume)).toBe(0);
        expect(t.event.field.count).toBe(0);
      }
    }
    // And again the next Saturday.
    expect(at(saturday(1)).event.field.demand).toBeCloseTo(fans);
  });

  it('no event without a road to the stadium, without seats, or in the tutorial city', () => {
    town(20);
    w.tick = saturday();
    expect(eventToday(w)).toBe(true);
    EV.seats = 0;
    expect(eventToday(w)).toBe(false);
    EV.seats = shipped.event.seats;
    (w as unknown as { tutorial: unknown }).tutorial = { step: 0 };
    expect(eventToday(w)).toBe(false);
    (w as unknown as { tutorial: unknown }).tutorial = undefined;
    for (const x of [61, 62]) w.setRoad(x, ROW, 0);                  // cut the street at its entrance
    for (const x of [60, 63]) w.setRoad(x, ROW, 0);
    expect(eventVenue(w).roads).toEqual([]);
    expect(eventToday(w)).toBe(false);
    expect(eventStatus(w)!.connected).toBe(false);
  });

  it('tourist fans arrive at the gateways, capped by what they bring', () => {
    town(0);
    LE.gateways = { [BUILDING_POLICE]: 15 };
    expect(w.placeBuilding(10, ROW - 1, BUILDING_POLICE)).toBe(true);
    expect(EV.touristFans).toBeGreaterThan(15);
    const t = at(saturday());
    expect(t.event.field.demand).toBeCloseTo(15);
    expect(t.event.volume[idx(40, ROW)]).toBeCloseTo(15);
  });

  it('tickets are paid by the fans in the seats: only those who arrive, and no more than the seats', () => {
    town(20);
    const fans = 60 * EV.fansPerLevel;
    at(saturday() - TPD);
    expect(eventTicketIncome(w)).toBe(0);                            // Friday
    at(saturday());
    expect(eventTicketIncome(w)).toBeCloseTo(fans * EV.ticket);
    EV.seats = 2;
    at(saturday());
    expect(eventTicketIncome(w)).toBeCloseTo(2 * EV.ticket);
    // Fans beyond reach do not come: empty seats.
    EV.seats = shipped.event.seats;
    EV.reach = 35;                                                   // the homes are 32–51 tiles from the entrance
    const t = at(saturday());
    expect(t.event.field.stranded).toBeGreaterThan(0);
    expect(eventTicketIncome(w)).toBeLessThan(fans * EV.ticket);
    expect(eventTicketIncome(w)).toBeCloseTo(t.event.field.demand * EV.ticket);
  });

  it('gives the pin its countdown, the phase of the day and the last result', () => {
    town(20);
    w.tick = 0;
    expect(eventStatus(w)).toMatchObject({ daysToEvent: 5, eventToday: false, phase: 0, fans: 0, connected: true, last: null });
    w.tick = saturday() - 3;
    expect(eventStatus(w)).toMatchObject({ daysToEvent: 1, eventToday: false, phase: (TPD - 3) / TPD });
    at(saturday());
    w.tick = saturday() + 2;
    expect(eventStatus(w)).toMatchObject({ daysToEvent: 0, eventToday: true, phase: 2 / TPD, seats: EV.seats });
    expect(eventStatus(w)!.fans).toBeGreaterThan(0);
    const none = landWorld(32);
    expect(eventStatus(none)).toBeNull();
  });
});

describe('the event jam', () => {
  // 40 level-3 homes send 18 fans a tick down one street (capacity 20) that already carries nothing
  // else, so raise the crowd: 0.5 a level = 60 fans, three times the street.
  const jammed = () => { town(40); EV.fansPerLevel = 0.5; };

  it('homes on a road the crowd has filled are stuck; homes off the crowd\'s way are not', () => {
    jammed();
    for (let x = 70; x <= 73; x++) zone(x, ROW + 1, 3);              // east of the stadium, beyond the homes' route
    at(saturday());
    expect(weekday(w.tick)).toBe(SATURDAY);
    expect(stuckInEventJam(w, idx(45, ROW + 1))).toBe(true);         // the whole crowd passes its door
    expect(stuckInEventJam(w, idx(10, ROW + 1))).toBe(false);        // the far end: only its own few fans
    expect(stuckInEventJam(w, idx(80, ROW + 1))).toBe(false);        // not a home
    expect(stuckInEventJam(w, idx(73, ROW + 1))).toBe(false);        // the east side sends few
  });

  it('an avenue carries the same crowd without a jam', () => {
    town(40, ROAD_AVENUE);
    EV.fansPerLevel = 0.5;
    at(saturday());
    w.tick = saturday() + TPD - 1;
    const r = judgeEventDay(w)!;
    expect(r.stuckResidents).toBe(0);
    expect(r.pc).toBe(0);
    expect(w.budget.politicalCapital).toBe(100);
    expect(r.arrived).toBeCloseTo(60);
    expect(r.wanted).toBeCloseTo(60);
  });

  it('stuck residents cost political capital, and the result is kept and announced', () => {
    jammed();
    at(saturday());
    const heard: unknown[] = [];
    w.events.on('eventDayEnded', (e) => heard.push(e));
    w.tick = saturday() + TPD - 1;
    const r = judgeEventDay(w)!;
    expect(r.stuckResidents).toBeGreaterThan(0);
    expect(r.stuckResidents % BALANCE.growth.popPerLevel[3]).toBe(0);
    expect(r.pc).toBeCloseTo(r.stuckResidents * EV.pcPerStuckResident);
    expect(w.budget.politicalCapital).toBeCloseTo(100 - r.pc);
    expect(r.seats).toBe(EV.seats);
    expect(w.lastEvent).toEqual(r);
    expect(heard).toEqual([r]);
    // Not an event day: nothing is judged.
    w.tick = saturday() + TPD;
    at(w.tick);
    expect(judgeEventDay(w)).toBeNull();
  });

  it('strain builds across bad event days until the home drops a level, and a good day takes one off', () => {
    jammed();
    const stuck = idx(45, ROW + 1), fine = idx(10, ROW + 1);
    const declines: number[] = [];
    w.events.on('tileDeclined', (e) => { if ((e as { reason: string }).reason === 'event') declines.push((e as { level: number }).level); });
    const eventDay = (week: number) => { at(saturday(week)); w.tick = saturday(week) + TPD - 1; return judgeEventDay(w)!; };
    expect(EV.dropAfter).toBe(3);
    expect(eventDay(0).declined).toBe(0);
    expect(w.eventStrain[stuck]).toBe(1);
    expect(w.eventStrain[fine]).toBe(0);
    expect(eventDay(1).declined).toBe(0);
    expect(w.eventStrain[stuck]).toBe(2);
    expect(w.layers.devLevel[stuck]).toBe(3);
    // A good Saturday (the street is now an avenue) takes one off …
    for (let x = 2; x <= 93; x++) w.setRoad(x, ROW, ROAD_AVENUE);
    expect(eventDay(2).stuckResidents).toBe(0);
    expect(w.eventStrain[stuck]).toBe(1);
    // … and two more bad ones bring it to three: the home drops a level and starts again.
    for (let x = 2; x <= 93; x++) { w.layers.roadClass[idx(x, ROW)] = ROAD_STREET; }
    w.grid.edits++;
    transit = new TransitSystem();
    eventDay(3);
    expect(w.eventStrain[stuck]).toBe(2);
    const third = eventDay(4);
    expect(third.declined).toBeGreaterThan(0);
    expect(w.layers.devLevel[stuck]).toBe(2);
    expect(w.eventStrain[stuck]).toBe(0);
    expect(w.layers.devLevel[fine]).toBe(3);
    expect(declines.every((l) => l === 2)).toBe(true);
    expect(declines.length).toBe(third.declined);
  });

  it('a merged lot never drops a level, but its residents count', () => {
    jammed();
    const i = idx(45, ROW + 1);
    w.layers.lot[i] = 1;                                             // stands in for a tower's tile
    EV.dropAfter = 1;
    at(saturday());
    w.tick = saturday() + TPD - 1;
    const r = judgeEventDay(w)!;
    expect(r.declined).toBeGreaterThan(0);                           // its neighbours dropped
    expect(w.layers.devLevel[i]).toBe(3);
    expect(w.eventStrain[i]).toBe(1);
  });

  it('with dropAfter 0 homes never drop, only the capital is charged', () => {
    jammed();
    EV.dropAfter = 0;
    for (let week = 0; week < 5; week++) { at(saturday(week)); w.tick = saturday(week) + TPD - 1; expect(judgeEventDay(w)!.declined).toBe(0); }
    expect(w.budget.politicalCapital).toBeLessThan(100);
  });
});

describe('event days in the running game', () => {
  it('the whole simulation judges each Saturday once, and strain and the last result survive a save', () => {
    town(40);
    EV.fansPerLevel = 0.5;
    const sim = createSystems();
    const scheduler = new Scheduler(w, sim.systems);
    const ended: number[] = [];
    w.events.on('eventDayEnded', (e) => ended.push((e as { tick: number }).tick));
    while (w.tick < 14 * TPD) scheduler.tick();
    expect(ended).toEqual([saturday(0) + TPD - 1, saturday(1) + TPD - 1]);
    expect(w.lastEvent!.tick).toBe(saturday(1) + TPD - 1);
    const back = deserialize(serialize(w));
    expect(back.lastEvent).toEqual(w.lastEvent);
    expect(Array.from(back.eventStrain)).toEqual(Array.from(w.eventStrain));
    // A city saved before event days existed has neither.
    const old = serialize(w) as unknown as { lastEvent?: unknown; layers: { eventStrain?: unknown } };
    delete old.lastEvent; delete old.layers.eventStrain;
    const fresh = deserialize(old as never);
    expect(fresh.lastEvent).toBeNull();
    expect(fresh.eventStrain.every((v) => v === 0)).toBe(true);
  });
});
