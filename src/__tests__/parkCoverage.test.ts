// Every park kind counts as park coverage, and a bigger park reaches further.

import './pcOffBaseline';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { CommandHistory } from '../commands/CommandHistory';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { coveredBy, serviceOpeningValue, serviceClosureValue, coverageGroup } from '../sim/serviceValue';
import { ROAD_STREET, BUILDING_PARK, BUILDING_MID_PARK, BUILDING_BIG_PARK, BUILDING_PLAZA, BUILDING_MUSEUM } from '../sim/constants';
import { BALANCE } from '../data/balance';
import { isMet, requestProgress, type OpenRequest } from '../sim/requests';
import { progressView } from '../ui/requestInfo';
import { landWorld, home } from './pcTestWorld';

const cfg = BALANCE.politicalCapital.service as { perResident: Record<number, number> };
const shipped = { ...cfg.perResident };
let w: World;
let h: CommandHistory;

beforeEach(() => {
  cfg.perResident = { ...shipped, 8: 1 };
  w = landWorld();
  h = new CommandHistory(w);
  for (let tx = 2; tx <= 50; tx++) w.setRoad(tx, 10, ROAD_STREET);
  for (let tx = 2; tx <= 50; tx++) home(w, tx, 11, 2);
});
afterEach(() => { cfg.perResident = { ...shipped }; });

/** Furthest home (by x) a park at `tx` covers, east of it. */
function eastReach(tx: number): number {
  const c = coveredBy(w, BUILDING_PARK);
  let max = -1;
  for (let x = 2; x <= 50; x++) if (c.has(w.grid.idx(x, 11))) max = x;
  return max - tx;
}

describe('park coverage by kind', () => {
  it('ranges are 6 / 9 / 12 by size and kinds group as parks', () => {
    const r = BALANCE.service.coverageRange;
    expect([r[BUILDING_PARK], r[BUILDING_MID_PARK], r[BUILDING_BIG_PARK], r[20], r[25]]).toEqual([6, 9, 12, 12, 12]);
    expect(coverageGroup(BUILDING_BIG_PARK)).toBe(BUILDING_PARK);
    expect(coverageGroup(BUILDING_PLAZA)).toBe(BUILDING_PLAZA);
    expect(coverageGroup(BUILDING_MUSEUM)).toBe(BUILDING_MUSEUM);
  });

  it('a 2×2 park and a big park cover homes, further than the small one', () => {
    for (const [kind, ty] of [[BUILDING_PARK, 9], [BUILDING_MID_PARK, 8], [BUILDING_BIG_PARK, 7]] as const) {
      w = landWorld(); h = new CommandHistory(w);
      for (let tx = 2; tx <= 50; tx++) { w.setRoad(tx, 10, ROAD_STREET); home(w, tx, 11, 2); }
      expect(h.run(new PlaceBuildingCommand(10, ty, kind))).toBe(true);
      const reach = eastReach(10);
      if (kind === BUILDING_PARK) expect(reach).toBeGreaterThanOrEqual(6);
      if (kind === BUILDING_MID_PARK) expect(reach).toBeGreaterThanOrEqual(9);
      if (kind === BUILDING_BIG_PARK) expect(reach).toBeGreaterThanOrEqual(12);
      expect(coveredBy(w, BUILDING_PARK).has(w.grid.idx(10, 11))).toBe(true);
    }
  });

  it('a plaza and a museum give no park coverage', () => {
    expect(h.run(new PlaceBuildingCommand(10, 8, BUILDING_PLAZA))).toBe(true);
    expect(coveredBy(w, BUILDING_PARK).size).toBe(0);
  });

  it('the service rule prices a 2×2 park like a park, and a closure costs the same back', () => {
    const open = serviceOpeningValue(w, 10, 8, BUILDING_MID_PARK);
    expect(open.length).toBeGreaterThan(0);
    expect(open.every(p => p.amount > 0)).toBe(true);
    h.run(new PlaceBuildingCommand(10, 8, BUILDING_MID_PARK));
    const close = serviceClosureValue(w, 10, 8);
    expect(close.length).toBe(open.length);
    expect(close.every(p => p.amount < 0)).toBe(true);
  });
});

describe('park request: any park nearby', () => {
  it('stays open with no park reaching its homes, and is met once one reaches any of them', () => {
    const homes = [2, 20, 40].map(x => w.grid.idx(x, 11));
    const req: OpenRequest = { id: 1, kind: 'park', openedTick: 0, deadlineTick: 9999, needAtOpen: 1, seed: homes[0], homes, x0: 2, y0: 11, x1: 40, y1: 11 };
    expect(isMet(w, req)).toBe(false);
    expect(progressView(w, req)).toMatchObject({ text: 'no park reaches this area yet', bar: null });
    expect(h.run(new PlaceBuildingCommand(30, 8, BUILDING_MID_PARK))).toBe(true);   // reaches the home at x = 40 only
    expect(requestProgress(w, req).met).toBe(true);
    expect(isMet(w, req)).toBe(true);
    expect(progressView(w, req).text).toBe('a park reaches this area');
  });
});
