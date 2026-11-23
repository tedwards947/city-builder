// Established lots (developed for many years) and Heritage Protection's two
// effects on them. The threshold ships at 0 (off) and the modifiers at 1.

import './pcOffBaseline';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { World } from '../sim/World';
import { ZoneGrowthSystem } from '../sim/systems/ZoneGrowthSystem';
import { LandValueSystem } from '../sim/systems/LandValueSystem';
import { CommandHistory } from '../commands/CommandHistory';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import {
  DAYS_PER_YEAR, gameDay, markDeveloped, developedYears, isEstablished, establishedAfterYears, startCountingFromNow,
} from '../sim/established';
import { enactOrdinance } from '../sim/ordinances';
import { pcQuote } from '../sim/politics';
import { serialize, deserialize } from '../persistence/Serializer';
import { encodeSaveFile, decodeSaveFile } from '../persistence/SaveFile';
import { ZONE_R, ROAD_STREET } from '../sim/constants';
import { BALANCE } from '../data/balance';
import { landWorld, home, displacementCost, withoutActionCap } from './pcTestWorld';

// These tests check the PC formulas' own prices: the one-action limit is tested in pcActionCap.test.ts.
withoutActionCap();

const pc = BALANCE.politicalCapital as { establishedYears?: number };
const heritage = (BALANCE.politicalCapital.ordinances as Record<string, { modifiers: Record<string, number> }>).heritageProtection;
const savedYears = pc.establishedYears;
const savedModifiers = { ...heritage.modifiers };

const TICKS_PER_YEAR = DAYS_PER_YEAR * BALANCE.ticksPerDay;
let w: World;
beforeEach(() => { w = landWorld(); });
afterEach(() => {
  if (savedYears === undefined) delete pc.establishedYears; else pc.establishedYears = savedYears;
  Object.assign(heritage.modifiers, savedModifiers);
});

describe('how long a lot has been developed', () => {
  it('with PC off, nothing is ever established', () => {
    expect(establishedAfterYears()).toBe(0);
    home(w, 5, 5);
    markDeveloped(w, w.grid.idx(5, 5));
    w.tick = 50 * TICKS_PER_YEAR;
    expect(isEstablished(w, w.grid.idx(5, 5))).toBe(false);
  });

  it('counts years from when the lot was built up; a lot with no record counts none', () => {
    const i = w.grid.idx(5, 5);
    home(w, 5, 5);
    expect(developedYears(w, i)).toBe(0);            // placed by hand: no record
    w.tick = 3 * TICKS_PER_YEAR;
    markDeveloped(w, i);
    expect(developedYears(w, i)).toBe(0);
    w.tick = 15 * TICKS_PER_YEAR;
    expect(developedYears(w, i)).toBeCloseTo(12);
    expect(gameDay(w)).toBe(15 * DAYS_PER_YEAR);
  });

  it('is established once it reaches the threshold', () => {
    pc.establishedYears = 10;
    const i = w.grid.idx(5, 5);
    home(w, 5, 5);
    markDeveloped(w, i);
    w.tick = 10 * TICKS_PER_YEAR - 1;
    expect(isEstablished(w, i)).toBe(false);
    w.tick = 10 * TICKS_PER_YEAR;
    expect(isEstablished(w, i)).toBe(true);
  });

  it('growth from empty starts the clock; levelling up does not restart it', () => {
    // A zoned lot with everything it needs to grow.
    const i = w.grid.idx(5, 5);
    w.setRoad(5, 6, ROAD_STREET);
    w.setZone(5, 5, ZONE_R);
    w.layers.power[i] = 1; w.layers.water[i] = 1; w.layers.sewage[i] = 1; w.layers.services[i] = 1;
    w.layers.education[i] = 255;
    w.stats.powerSupply = 10; w.stats.waterSupply = 10; w.stats.sewageSupply = 10;
    const growth = new ZoneGrowthSystem();
    w.tick = 2 * TICKS_PER_YEAR;
    while (w.layers.devLevel[i] === 0) { growth.update(w); w.tick += BALANCE.growth.tickInterval; }
    const since = w.developedSince[i];
    expect(since).toBeGreaterThan(2 * DAYS_PER_YEAR);
    w.tick = 6 * TICKS_PER_YEAR;
    while (w.layers.devLevel[i] === 1) { growth.update(w); w.tick += BALANCE.growth.tickInterval; }
    expect(w.developedSince[i]).toBe(since);
  });

  it('a break ends it: empty, abandoned or bulldozed lots count nothing, and undo brings the years back', () => {
    pc.establishedYears = 10;
    const i = w.grid.idx(5, 5);
    home(w, 5, 5);
    markDeveloped(w, i);
    w.tick = 12 * TICKS_PER_YEAR;
    expect(isEstablished(w, i)).toBe(true);

    w.layers.abandoned[i] = 1;
    expect(isEstablished(w, i)).toBe(false);
    w.layers.abandoned[i] = 0;

    const h = new CommandHistory(w);
    w.budget.politicalCapital = 1000;
    h.run(new BulldozeCommand(5, 5));
    expect(developedYears(w, i)).toBe(0);
    h.undo();
    expect(isEstablished(w, i)).toBe(true);
    // Rebuilt from empty later: the clock starts again.
    h.redo();
    w.setZone(5, 5, ZONE_R);
    w.layers.devLevel[i] = 1;
    markDeveloped(w, i);                               // what growth does
    expect(developedYears(w, i)).toBe(0);
  });
});

describe('developed-since in saves', () => {
  it('round-trips through a save and a save file', () => {
    const i = w.grid.idx(5, 5);
    home(w, 5, 5);
    w.tick = 4 * TICKS_PER_YEAR;
    markDeveloped(w, i);
    const snap = serialize(w);
    expect(deserialize(snap).developedSince[i]).toBe(w.developedSince[i]);
    const text = encodeSaveFile({ name: 't', savedAt: 0, tick: w.tick, population: 0, money: 0 }, snap);
    expect(deserialize(decodeSaveFile(text).snapshot).developedSince[i]).toBe(w.developedSince[i]);
  });

  it('a save from before the record starts every developed lot counting at load', () => {
    pc.establishedYears = 10;
    const i = w.grid.idx(5, 5), empty = w.grid.idx(8, 8);
    home(w, 5, 5);
    w.setZone(8, 8, ZONE_R);
    w.tick = 40 * TICKS_PER_YEAR;                     // an old city
    const snap = serialize(w);
    delete snap.layers.developedSince;
    const loaded = deserialize(snap);
    expect(loaded.developedSince[i]).toBe(gameDay(loaded) + 1);
    expect(loaded.developedSince[empty]).toBe(0);
    expect(isEstablished(loaded, i)).toBe(false);     // no instant heritage
    loaded.tick += 10 * TICKS_PER_YEAR;
    expect(isEstablished(loaded, i)).toBe(true);
  });

  it('startCountingFromNow leaves empty lots alone', () => {
    w.setZone(5, 5, ZONE_R);
    startCountingFromNow(w);
    expect(w.developedSince[w.grid.idx(5, 5)]).toBe(0);
  });
});

describe('Heritage Protection', () => {
  beforeEach(() => {
    pc.establishedYears = 10;
    heritage.modifiers.establishedDemolitionCost = 4;
    heritage.modifiers.establishedLandValue = 1.5;
  });

  it('makes displacing residents of an established home cost more, and only those', () => {
    const old = w.grid.idx(5, 5);
    home(w, 5, 5, 3); home(w, 9, 9, 3);
    markDeveloped(w, old);
    w.tick = 11 * TICKS_PER_YEAR;
    markDeveloped(w, w.grid.idx(9, 9));               // a new home
    const cost = (tx: number, ty: number) => pcQuote(w, { type: 'bulldoze', tx, ty }).cost;
    expect(cost(5, 5)).toBe(displacementCost(3));     // not enacted yet
    enactOrdinance(w, 'heritageProtection');
    expect(cost(5, 5)).toBe(displacementCost(3) * 4);
    expect(cost(9, 9)).toBe(displacementCost(3));
    // The command charges it.
    w.budget.politicalCapital = 1000;
    new CommandHistory(w).run(new BulldozeCommand(5, 5));
    expect(w.budget.politicalCapital).toBe(1000 - displacementCost(3) * 4);
  });

  it('raises the land value of established lots', () => {
    const old = w.grid.idx(5, 5), fresh = w.grid.idx(20, 20);
    home(w, 5, 5); home(w, 20, 20);
    markDeveloped(w, old);
    w.tick = 11 * TICKS_PER_YEAR;
    markDeveloped(w, fresh);
    const settle = (world: World) => {
      const lv = new LandValueSystem();
      for (let k = 0; k < 60; k++) { lv.update(world); world.tick += BALANCE.growth.tickInterval; }
    };
    w.tick = 11 * TICKS_PER_YEAR - (11 * TICKS_PER_YEAR) % BALANCE.growth.tickInterval;
    settle(w);
    const before = { old: w.layers.landValue[old], fresh: w.layers.landValue[fresh] };
    expect(before.old).toBe(before.fresh);
    enactOrdinance(w, 'heritageProtection');
    settle(w);
    expect(w.layers.landValue[old]).toBeGreaterThan(before.old * 1.3);
    expect(w.layers.landValue[fresh]).toBe(before.fresh);
  });
});
