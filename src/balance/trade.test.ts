import { describe, it, expect } from 'vitest';
import { BALANCE } from '../data/balance';
import { applyTradeValues, tradeResult } from './trade';
import { freshWorld } from './world';
import { BUILDING_SEAPORT, ROAD_STREET, TERRAIN_WATER, ZONE_C, ZONE_I } from '../sim/constants';

// A 64×64 map: open sea along the north edge, a street along row 12, shops and
// industry developed on both sides of it.
function coastTown() {
  const w = freshWorld(64, 3);
  for (let y = 0; y < 6; y++) for (let x = 0; x < 64; x++) w.layers.terrain[y * 64 + x] = TERRAIN_WATER;
  for (let x = 0; x < 64; x++) w.setRoad(x, 12, ROAD_STREET);
  for (let x = 4; x < 60; x++) {
    w.setZone(x, 13, x < 40 ? ZONE_C : ZONE_I); w.layers.devLevel[13 * 64 + x] = 2;
    w.setZone(x, 11, x < 20 ? ZONE_C : ZONE_I); w.layers.devLevel[11 * 64 + x] = 1;
  }
  w.grid.markAllDirty();
  return w;
}

describe('trade probes', () => {
  it('place a port, read its trade and leave BALANCE and the city as they were', () => {
    const before = JSON.stringify(BALANCE);
    const restore = applyTradeValues({ goodsCapacity: 0.5, goods: { shortageIncomePenalty: 0.3 }, port: { exportTripsPerLevel: 0.2, exportCapacity: 5, exportIncomePerTrip: 50, importCapacity: 10 } });
    const w = coastTown();
    let r;
    try { r = tradeResult(w); } finally { restore(); }
    expect(JSON.stringify(BALANCE)).toBe(before);
    expect(w.buildings.some(b => b.kind === BUILDING_SEAPORT)).toBe(false);
    expect(r.port).not.toBeNull();
    expect(r.port!.income).toBeGreaterThan(0);
    expect(r.port!.paybackDays).toBeGreaterThan(0);
    expect(r.heavy!.ratio).toBeGreaterThanOrEqual(3);
    expect(r.heavy!.shortage).toBeGreaterThan(r.shortage);
  }, 60_000);
});
