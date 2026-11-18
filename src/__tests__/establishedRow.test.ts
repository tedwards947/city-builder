import './pcOffBaseline';
import { describe, it, expect, afterEach } from 'vitest';
import { establishedRow } from '../ui/TileInfoPanel';
import { markDeveloped, DAYS_PER_YEAR } from '../sim/established';
import { BALANCE } from '../data/balance';
import { landWorld, home } from './pcTestWorld';

const TICKS_PER_YEAR = DAYS_PER_YEAR * BALANCE.ticksPerDay;
const pc = BALANCE.politicalCapital as { establishedYears?: number };
const saved = pc.establishedYears;
afterEach(() => { if (saved === undefined) delete pc.establishedYears; else pc.establishedYears = saved; });

describe('inspect pane: how long a lot has stood', () => {
  it('says nothing while the feature is off or the lot has no history', () => {
    const w = landWorld();
    const i = w.grid.idx(5, 5);
    home(w, 5, 5);
    markDeveloped(w, i);
    w.tick = 30 * TICKS_PER_YEAR;
    expect(establishedRow(w, i)).toBe('');            // shipped threshold is 0
    pc.establishedYears = 10;
    expect(establishedRow(w, w.grid.idx(6, 6))).toBe('');   // bare land
  });

  it('counts up to the threshold, then calls the lot established', () => {
    pc.establishedYears = 10;
    const w = landWorld();
    const i = w.grid.idx(5, 5);
    home(w, 5, 5);
    markDeveloped(w, i);
    w.tick = 4 * TICKS_PER_YEAR;
    expect(establishedRow(w, i)).toContain('Developed for 4 years (established at 10)');
    w.tick = 12 * TICKS_PER_YEAR;
    expect(establishedRow(w, i)).toContain('Established neighbourhood: 12 years');
  });
});
