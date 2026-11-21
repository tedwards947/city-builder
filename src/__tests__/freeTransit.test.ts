// Free Transit makes rail fares 0; repealing brings them back. Riding is unchanged.

import { describe, it, expect } from 'vitest';
import { World } from '../sim/World';
import { railFareIncome } from '../sim/rail';
import { enactOrdinance, repealOrdinance, transitIsFree } from '../sim/ordinances';
import { makeTrafficData } from '../sim/TrafficData';
import { BALANCE } from '../data/balance';

describe('Free Transit', () => {
  it('rail fares are 0 while enacted and come back when repealed', () => {
    const w = new World(10, 10, 1);
    w.traffic = makeTrafficData(100);
    w.traffic.rail.boardings = 40;
    w.budget.politicalCapital = 500;
    expect(railFareIncome(w)).toBe(40 * BALANCE.rail.fare);
    expect(enactOrdinance(w, 'freeTransit')).toBe(true);
    expect(transitIsFree(w)).toBe(true);
    expect(railFareIncome(w)).toBe(0);
    expect(w.traffic.rail.boardings).toBe(40);
    repealOrdinance(w, 'freeTransit');
    expect(railFareIncome(w)).toBe(40 * BALANCE.rail.fare);
  });

  it('a suspended ordinance charges fares again', () => {
    const w = new World(10, 10, 1);
    w.traffic = makeTrafficData(100);
    w.traffic.rail.boardings = 10;
    w.budget.politicalCapital = 500;
    enactOrdinance(w, 'freeTransit');
    w.politics.ordinances.suspended.push('freeTransit');
    expect(railFareIncome(w)).toBe(10 * BALANCE.rail.fare);
  });
});
