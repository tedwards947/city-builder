// "Residents want an airport": a city-wide request asked once the city can
// pay for an airport and has none, met by an airport with a road along its
// terminal. No penalty when it expires; asked once per city.

import './pcOffBaseline';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { RequestSystem } from '../sim/systems/RequestSystem';
import { requestConfig, pickRequest, requestProgress, requestKind, openSlotsUsed } from '../sim/requests';
import { BUILDING_AIRPORT, ROAD_STREET } from '../sim/constants';
import { serialize, deserialize } from '../persistence/Serializer';
import { BALANCE } from '../data/balance';
import { landWorld, homes } from './pcTestWorld';

const cfg = requestConfig();
const shipped = structuredClone(cfg);
const COST = BALANCE.buildings[BUILDING_AIRPORT].cost;
const DAY = BALANCE.ticksPerDay;

let w: World;
let system: RequestSystem;
let day = 0;
/** Run the request system for `n` game days. */
const days = (n: number) => { for (let k = 0; k < n; k++) { w.tick = ++day * DAY; system.update(w); } };
const open = (kind = 'airport') => w.politics.requests.filter((r) => r.kind === kind);
/** An airport at x 20–31, y 20–24, with or without a street along its terminal. */
const buildAirport = (connected: boolean) => {
  expect(w.placeBuilding(20, 20, BUILDING_AIRPORT)).toBe(true);
  if (connected) connect();
};
const connect = () => { for (let x = 20; x <= 31; x++) w.setRoad(x, 19, ROAD_STREET); };

beforeEach(() => {
  // Only the airport request is switched on (the other kinds stay at days 0), one chance to ask a day.
  cfg.spawnEveryDays = 1;
  cfg.maxOpen = 3;
  cfg.kinds.airport = { days: 30, reward: 150, penalty: 0, askAt: 0.5, metAt: 0, once: true, cooldownDays: 100 };
  w = landWorld(48);
  homes(w, 2, 2, 5, 3);                       // one neighbourhood of eight homes
  w.budget.money = COST;
  w.budget.politicalCapital = 40;
  system = new RequestSystem();
  day = 0;
});
afterEach(() => { Object.assign(cfg, structuredClone(shipped)); });

describe('the airport request', () => {
  it('is a city-wide, standing kind with shipped numbers: a long deadline, a reward and no penalty', () => {
    expect(requestKind('airport')).toMatchObject({ cityWide: true, standing: true });
    // pcOffBaseline switched the kind off for this file; the shipped tree has it on.
    expect(shipped.kinds.airport).toMatchObject({ days: 0, reward: 0, penalty: 0, once: true });
    expect(shipped.kinds.airport.cooldownDays).toBeGreaterThan(0);
  });

  it('is asked once the city can pay for an airport, not before', () => {
    w.budget.money = COST - 1;
    days(3);
    expect(open()).toEqual([]);
    w.budget.money = COST;
    days(1);
    expect(open().length).toBe(1);
    expect(open()[0].deadlineTick - open()[0].openedTick).toBe(30 * DAY);
    days(3);
    expect(open().length).toBe(1);             // one for the whole city
    expect(requestProgress(w, open()[0])).toMatchObject({ unit: 'city', covered: 0, met: false, reward: 150, penalty: 0 });
  });

  it('is not asked while an airport stands, connected or not', () => {
    buildAirport(false);
    w.budget.money = COST * 2;
    days(3);
    expect(open()).toEqual([]);
    connect();
    days(3);
    expect(open()).toEqual([]);
  });

  it('is met by an airport with a road along its terminal, and pays even over the cap', () => {
    days(1);
    w.budget.money = 0;                         // the money has gone on the airport
    buildAirport(false);
    days(2);
    expect(open().length).toBe(1);             // standing, but no road to the terminal yet
    expect(w.budget.politicalCapital).toBe(40);
    connect();
    const met: unknown[] = [];
    w.events.on('requestMet', (e) => { met.push(e); });
    days(1);
    expect(open()).toEqual([]);
    expect(met.length).toBe(1);
    expect(w.budget.politicalCapital).toBe(190);
  });

  it('is asked once per city: never again after it was met', () => {
    days(1);
    buildAirport(true);
    days(1);
    expect(open()).toEqual([]);
    expect(w.clearTile(22, 22)).toBe(true);    // the airport is bulldozed and the city is rich again
    w.budget.money = COST * 3;
    days(400);
    expect(open()).toEqual([]);
    expect(w.budget.politicalCapital).toBe(190);
  });

  it('expires with no penalty, and is asked again only after the cooldown', () => {
    days(1);
    const failed: unknown[] = [];
    w.events.on('requestFailed', (e) => { failed.push(e); });
    days(30);
    expect(open()).toEqual([]);
    expect(failed.length).toBe(1);
    expect(w.budget.politicalCapital).toBe(40);
    days(99);
    expect(open()).toEqual([]);
    days(2);
    expect(open().length).toBe(1);
  });

  it('does not hold up its neighbourhood or take one of the open slots', () => {
    cfg.maxOpen = 1;
    days(1);
    expect(open().length).toBe(1);
    expect(openSlotsUsed(w)).toBe(0);
    // With the airport request open, a park request still opens: for the same neighbourhood, with maxOpen at 1.
    cfg.kinds.park = { ...cfg.kinds.park, days: 20, askAt: 0.5, metAt: 0.25 };
    days(2);
    expect(open().length).toBe(1);
    expect(open('park').length).toBe(1);
    expect(openSlotsUsed(w)).toBe(1);
    const a = open()[0], p = open('park')[0];
    expect(a.x0 <= p.x1 && p.x0 <= a.x1 && a.y0 <= p.y1 && p.y0 <= a.y1).toBe(true);
  });

  it('remembers across a save that it was met', () => {
    days(1);
    buildAirport(true);
    days(1);
    const loaded = deserialize(serialize(w));
    expect(loaded.politics.requestNotBefore).toEqual(w.politics.requestNotBefore);
    expect(loaded.politics.requestNotBefore).not.toBe(w.politics.requestNotBefore);
    loaded.clearTile(22, 22);
    loaded.budget.money = COST * 3;
    expect(pickRequest(loaded, () => 0.5)).toBeNull();
    // A save from before the field existed loads with every kind free to ask.
    const old = serialize(w);
    delete (old.politics as { requestNotBefore?: unknown }).requestNotBefore;
    expect(deserialize(old).politics.requestNotBefore).toEqual({});
  });
});
