// Inspect's leisure warning: "none" only when nothing reaches the home, "crowded" with the bar's percentage when partly served.

import { describe, it, expect } from 'vitest';
import { leisureNote } from '../ui/TileInfoPanel';
import { leisureGrowthMult, lacksLeisure, leisureReachAt } from '../sim/leisureTraffic';
import { makeTrafficData } from '../sim/TrafficData';
import { ROAD_STREET } from '../sim/constants';
import { BALANCE } from '../data/balance';
import { landWorld, home } from './pcTestWorld';

function setup(dist: number) {
  const w = landWorld(32);
  w.setRoad(5, 6, ROAD_STREET);
  home(w, 5, 5, Math.max(2, BALANCE.leisure.need.fromLevel - 1));
  w.traffic = makeTrafficData(32 * 32);
  const f = w.traffic.leisure.field;
  f.count = 1;
  f.dist.fill(Infinity);
  f.dist[w.grid.idx(5, 6)] = dist;
  return { w, i: w.grid.idx(5, 5) };
}

describe('leisure note', () => {
  it('says none when nothing reaches the home', () => {
    const { w, i } = setup(Infinity);
    expect(lacksLeisure(w, i)).toBe(true);
    expect(leisureNote(w, i)).toContain('No leisure in reach');
  });

  it('says crowded, with the bar\'s percentage, when partly served', () => {
    const { w, i } = setup(BALANCE.leisure.reach / 2);
    const pct = Math.round(leisureReachAt(w, i) * 100);
    expect(pct).toBe(50);
    expect(lacksLeisure(w, i)).toBe(true);
    const note = leisureNote(w, i);
    expect(note).toContain('Leisure crowded (50% served)');
    expect(note).not.toContain('No leisure in reach');
  });

  it('leaves the growth rule alone', () => {
    const { w, i } = setup(BALANCE.leisure.reach / 2);
    expect(leisureGrowthMult(w, i, BALANCE.leisure.need.fromLevel)).toBe(BALANCE.leisure.need.growthMult);
  });
});
