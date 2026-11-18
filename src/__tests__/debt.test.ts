// Debt as a failure condition: the limit, its warnings, the countdown, game
// over, the daily PC drain and the debug revive.

import './pcOffBaseline';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { World } from '../sim/World';
import { Scheduler } from '../sim/Scheduler';
import { EconomySystem } from '../sim/systems/EconomySystem';
import { debtLimit, debtStatus, reviveFromDebt } from '../sim/debt';
import { serialize, deserialize } from '../persistence/Serializer';
import { BUILDING_POWER_PLANT, TERRAIN_GRASS } from '../sim/constants';
import { BALANCE } from '../data/balance';

const B = BALANCE.budget as { debtLimitDays: number; debtLimitMin: number; debtGraceDays: number; debtPcDrainPerDay: number };
const shipped = { ...B };
const DAY = BALANCE.ticksPerDay;

let w: World;
let sys: EconomySystem;
let seen: { name: string; p: Record<string, unknown> }[];

/** A city whose only running cost is `plants` power plants (15 a tick each). */
function city(plants: number): World {
  const world = new World(16, 16, 1);
  world.layers.terrain.fill(TERRAIN_GRASS);
  for (let k = 0; k < plants; k++) world.placeBuilding(1 + k, 1, BUILDING_POWER_PLANT);
  return world;
}
function listen(world: World) {
  seen = [];
  for (const name of ['debtWarning', 'debtCountdown', 'gameOver', 'debtRevived', 'pcChanged'] as const) {
    world.events.on(name, (p) => seen.push({ name, p: p as unknown as Record<string, unknown> }));
  }
}
const tick = (n = 1) => { for (let k = 0; k < n; k++) { w.tick++; sys.update(w); } };
const names = () => seen.map((e) => e.name + (e.p.level ? ':' + e.p.level : ''));

// The drain is off for these tests unless one sets it; the shipped 0.75 is checked below.
beforeEach(() => { B.debtPcDrainPerDay = 0; w = city(2); sys = new EconomySystem(); listen(w); });
afterEach(() => { Object.assign(B, shipped); });

describe('debt', () => {
  it('ships with a 30-day limit, a 30-day countdown and a PC drain of 0.75 a day', () => {
    expect(B.debtLimitDays).toBe(30);
    expect(B.debtGraceDays).toBe(30);
    expect(shipped.debtPcDrainPerDay).toBe(0.75);
  });

  it('with the countdown off, the limit warns but the game never ends', () => {
    B.debtGraceDays = 0;
    tick();
    w.budget.money = -8000;
    tick(40 * DAY);
    expect(names()).toEqual(['debtWarning:half', 'debtWarning:limit']);
    expect(w.budget.gameOver).toBe(false);
    expect(w.budget.debtOverTicks).toBe(0);
    expect(debtStatus(w)).toMatchObject({ overLimit: true, daysLeft: null, graceDays: 0, gameOver: false });
  });

  it('the limit is so many days of expenses, with a floor for a small city', () => {
    tick();                                           // expenses are now known: 30 a tick
    expect(w.budget.expenses).toBe(30);
    expect(debtLimit(w)).toBe(30 * DAY * 30);         // 7,200
    const small = city(0);
    new EconomySystem().update(small);
    expect(debtLimit(small)).toBe(B.debtLimitMin);
  });

  it('a city in the black, or in debt within half the limit, hears nothing', () => {
    tick(3);
    w.budget.money = -1000;                           // limit 7,200
    tick(3 * DAY);
    expect(names()).toEqual([]);
    expect(debtStatus(w)).toMatchObject({ inDebt: true, pastHalf: false, overLimit: false, daysLeft: null, gameOver: false });
    expect(w.budget.debtOverTicks).toBe(0);
  });

  it('warns once at half the limit and once at the limit, and again only after climbing back', () => {
    tick();
    w.budget.money = -3700;                           // just past half of 7,200
    tick(4);
    expect(names()).toEqual(['debtWarning:half']);
    expect(seen[0].p).toMatchObject({ level: 'half', limit: 7200 });
    w.budget.money = -7300;
    tick(2);
    expect(names().filter((n) => n.startsWith('debtWarning'))).toEqual(['debtWarning:half', 'debtWarning:limit']);
    w.budget.money = -100;                            // back within half
    tick();
    w.budget.money = -3700;
    tick();
    expect(names().filter((n) => n === 'debtWarning:half').length).toBe(2);
  });

  it('counts down once a day past the limit, and ends the game when the countdown runs out', () => {
    B.debtGraceDays = 3;
    tick();                                           // tick 1
    w.budget.money = -8000;
    tick();                                           // tick 2: crossed
    expect(names()).toEqual(['debtWarning:half', 'debtWarning:limit', 'debtCountdown']);
    expect(seen[2].p.daysLeft).toBe(3);
    expect(debtStatus(w)).toMatchObject({ overLimit: true, daysLeft: 3, graceDays: 3, gameOver: false });
    tick(3 * DAY - 2);                                // one tick short of three days past the limit
    expect(w.budget.gameOver).toBe(false);
    expect(names().filter((n) => n === 'debtCountdown').length).toBe(1 + 3);   // the crossing, then each day's turn
    expect(debtStatus(w).daysLeft).toBe(1);
    tick();
    expect(w.budget.gameOver).toBe(true);
    expect(names().at(-1)).toBe('gameOver');
    expect(seen.at(-1)!.p).toMatchObject({ reason: 'debt' });
    expect(debtStatus(w)).toMatchObject({ gameOver: true, daysLeft: null });
    // Final: nothing more is announced.
    const n = seen.length;
    tick(2 * DAY);
    expect(seen.length).toBe(n);
  });

  it('getting back within the limit resets the countdown in full', () => {
    B.debtGraceDays = 3;
    tick();
    w.budget.money = -8000;
    tick(2 * DAY);
    expect(w.budget.debtOverTicks).toBe(2 * DAY);
    w.budget.money = -7000;                           // within the limit of 7,200, still in debt
    tick();
    expect(w.budget.debtOverTicks).toBe(0);
    expect(debtStatus(w)).toMatchObject({ inDebt: true, overLimit: false, daysLeft: null });
    w.budget.money = -8000;
    tick(2 * DAY);
    expect(w.budget.gameOver).toBe(false);
    expect(debtStatus(w).daysLeft).toBe(1);
  });

  it('a growing city has a bigger limit', () => {
    tick();
    w.budget.money = -8000;
    tick();
    expect(debtStatus(w).overLimit).toBe(true);
    w.placeBuilding(5, 5, BUILDING_POWER_PLANT);      // expenses 45 a tick: limit 10,800
    tick();
    expect(debtStatus(w).overLimit).toBe(false);
  });

  it('the countdown and game over survive a save', () => {
    B.debtGraceDays = 3;
    tick();
    w.budget.money = -8000;
    tick(DAY);
    let loaded = deserialize(serialize(w));
    expect(loaded.budget.debtOverTicks).toBe(DAY);
    expect(debtStatus(loaded).gameOver).toBe(false);
    tick(2 * DAY);
    expect(w.budget.gameOver).toBe(true);
    loaded = deserialize(serialize(w));
    expect(debtStatus(loaded).gameOver).toBe(true);
    // A save from before the rule has neither field: it loads as a city in good standing.
    const old = serialize(city(1));
    delete (old.budget as Partial<World['budget']>).debtOverTicks;
    delete (old.budget as Partial<World['budget']>).gameOver;
    const fromOld = deserialize(old);
    expect(fromOld.budget.debtOverTicks).toBe(0);
    expect(fromOld.budget.gameOver).toBe(false);
  });

  it('at game over the real-time loop stops; the debug revive clears it and play goes on', () => {
    B.debtGraceDays = 1;
    tick();
    w.budget.money = -8000;
    tick(DAY);
    expect(w.budget.gameOver).toBe(true);
    const scheduler = new Scheduler(w, [sys]);
    const at = w.tick;
    const t0 = performance.now();
    // Each frame is credited at most 250 ms, and a tick is 500 ms: four frames would be two ticks.
    for (let f = 1; f <= 4; f++) scheduler.update(t0 + f * 1000);
    expect(w.tick).toBe(at);
    reviveFromDebt(w, 500_000);
    expect(w.budget.gameOver).toBe(false);
    expect(w.budget.debtOverTicks).toBe(0);
    expect(w.budget.money).toBeGreaterThan(400_000);
    expect(names().at(-1)).toBe('debtRevived');
    for (let f = 5; f <= 8; f++) scheduler.update(t0 + f * 1000);
    expect(w.tick).toBe(at + 2);
  });

  it('PC drains once a day while in debt, scaled with the cap, never below zero and not as a player action', () => {
    B.debtPcDrainPerDay = 4;
    w.budget.politicalCapital = 10;
    w.budget.money = -500;
    tick(DAY);                                        // one day's turn
    expect(w.budget.politicalCapital).toBe(6);
    const drains = seen.filter((e) => e.name === 'pcChanged');
    expect(drains.length).toBe(1);
    expect(drains[0].p).toMatchObject({ delta: -4, reason: 'debt' });
    tick(2 * DAY);
    expect(w.budget.politicalCapital).toBe(0);        // 6 → 2 → 0, not −2
    // Out of debt: no drain.
    w.budget.money = 1_000_000;
    w.budget.politicalCapital = 10;
    tick(DAY);
    expect(w.budget.politicalCapital).toBe(10);
  });
});
