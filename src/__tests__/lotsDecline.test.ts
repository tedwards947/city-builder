// Merged 2×2 lots, phase 2 (sim/lots.ts, BIG_LOTS_DESIGN.md): it declines as
// one building. Abandonment judges the whole of it and takes all four tiles
// together; a fire takes the whole building; a highway cuts it off only when
// no tile of it has a road left.

import { describe, it, expect } from 'vitest';
import { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { ROAD_HIGHWAY, ROAD_STREET, ZONE_C, ZONE_R } from '../sim/constants';
import { mergeLot } from '../sim/lots';
import { AbandonmentSystem } from '../sim/systems/AbandonmentSystem';
import { FireSystem } from '../sim/systems/FireSystem';
import { BuildRoadCommand } from '../commands/BuildRoadCommand';
import { pcQuote, zonesCutOffByHighway } from '../sim/politics';
import { landWorld } from './pcTestWorld';

const TOP = BALANCE.growth.maxLevel;
const CHECKS = BALANCE.abandonment.abandonThreshold;

/** Top-level lots of `zone` on the 2×2 at (x, y), with power and water; merged if asked. */
function block(w: World, x: number, y: number, merge: boolean, zone = ZONE_R): number[] {
  const tiles: number[] = [];
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const i = w.grid.idx(x + dx, y + dy);
    w.setZone(x + dx, y + dy, zone);
    w.layers.devLevel[i] = TOP;
    w.layers.power[i] = 1;
    w.layers.water[i] = 1;
    tiles.push(i);
  }
  if (merge) expect(mergeLot(w, x, y)).toBe(true);
  return tiles;
}

/** Run the abandonment check `n` times. */
function checks(w: World, n: number): void {
  const sys = new AbandonmentSystem();
  for (let k = 0; k < n; k++) { w.tick += BALANCE.abandonment.distressInterval; sys.update(w); }
}

describe('abandonment', () => {
  it('a road beside any tile is a road to the whole building', () => {
    const w = landWorld();
    const lot = block(w, 10, 10, true);
    const plain = block(w, 10, 20, false);
    for (const y of [10, 11, 20, 21]) w.setRoad(9, y, ROAD_STREET);      // a street down the west side only
    checks(w, 5);
    expect(lot.map((i) => w.layers.distress[i])).toEqual([0, 0, 0, 0]);
    // Four ordinary lots: the two away from the street have no road.
    expect(plain.map((i) => w.layers.distress[i])).toEqual([0, 10, 0, 10]);
  });

  it('trouble on one tile is trouble for the whole building: one distress, one fate, one event', () => {
    const w = landWorld();
    const lot = block(w, 10, 10, true);
    for (const y of [10, 11]) { w.setRoad(9, y, ROAD_STREET); w.setRoad(12, y, ROAD_STREET); }
    w.layers.water[lot[3]] = 0;                                         // the SE tile has no water
    const gone: { tx: number; ty: number }[] = [];
    w.events.on('tileAbandoned', (e) => { const at = e as { tx: number; ty: number }; gone.push({ tx: at.tx, ty: at.ty }); });
    checks(w, CHECKS - 1);
    expect(lot.map((i) => w.layers.distress[i])).toEqual(Array(4).fill(CHECKS - 1));
    expect(lot.map((i) => w.layers.abandoned[i])).toEqual([0, 0, 0, 0]);
    checks(w, 1);
    expect(lot.map((i) => w.layers.abandoned[i])).toEqual([1, 1, 1, 1]);
    expect(gone).toEqual([{ tx: 10, ty: 10 }]);
    checks(w, 3);                                                       // and it stays as it is
    expect(gone.length).toBe(1);
  });

  it('it recovers as one while it is only distressed', () => {
    const w = landWorld();
    const lot = block(w, 10, 10, true);
    for (const y of [10, 11]) w.setRoad(9, y, ROAD_STREET);
    w.layers.power[lot[1]] = 0;
    checks(w, 6);
    expect(lot.map((i) => w.layers.distress[i])).toEqual([6, 6, 6, 6]);
    w.layers.power[lot[1]] = 1;
    checks(w, 4);
    expect(lot.map((i) => w.layers.distress[i])).toEqual([2, 2, 2, 2]);
  });

  it('ordinary lots are judged one by one, as before', () => {
    const w = landWorld();
    const plain = block(w, 10, 10, false);
    for (const y of [10, 11]) { w.setRoad(9, y, ROAD_STREET); w.setRoad(12, y, ROAD_STREET); }
    w.layers.water[plain[3]] = 0;
    checks(w, CHECKS);
    expect(plain.map((i) => w.layers.abandoned[i])).toEqual([0, 0, 0, 1]);
    expect(plain.map((i) => w.layers.distress[i])).toEqual([0, 0, 0, CHECKS]);
  });
});

describe('fire', () => {
  it('a merged lot rolls for fire once, not once a tile', () => {
    const rolls = (merge: boolean): number => {
      const w = landWorld();
      block(w, 10, 10, merge);
      let n = 0;
      w.rng = () => { n++; return 0.99; };
      new FireSystem().update(w);
      return n;
    };
    expect(rolls(false)).toBe(4);
    expect(rolls(true)).toBe(1);
  });

  it('when it catches fire, the whole building burns', () => {
    const w = landWorld();
    const lot = block(w, 10, 10, true, ZONE_C);
    for (const i of lot) w.layers.fireRisk[i] = 200;
    const started: unknown[] = [];
    w.events.on('fireIgnition', (e) => started.push(e));
    let n = 0;
    w.rng = () => (n++ === 0 ? 0 : 0.99);                               // the anchor's roll starts a fire; nothing else does
    new FireSystem().update(w);
    for (const i of lot) expect(w.layers.fire[i]).toBeGreaterThan(0);
    expect(started.length).toBe(1);
  });

  it('a fire spreading onto one tile takes the whole building', () => {
    const w = landWorld();
    const lot = block(w, 10, 10, true);
    w.setZone(9, 10, ZONE_R);
    w.layers.devLevel[w.grid.idx(9, 10)] = 1;
    w.setFire(9, 10, 10);
    let n = 0;
    w.rng = () => { n++; return n === 1 ? 0.02 : n === 2 ? 0.3 : 0.99; };   // spread, eastward; nothing else
    new FireSystem().update(w);
    for (const i of lot) expect(w.layers.fire[i]).toBeGreaterThan(0);
  });
});

describe('a highway', () => {
  const setup = (otherRoad: boolean) => {
    const w = landWorld();
    w.budget.politicalCapital = 1e6;
    w.budget.money = 1e6;
    const lot = block(w, 10, 10, true);
    w.setRoad(9, 10, ROAD_STREET);                                      // its only street, beside the NW tile
    if (otherRoad) w.setRoad(12, 11, ROAD_STREET);                      // another, beside the SE tile
    return { w, lot };
  };

  it('cuts the whole building off when it takes its last road', () => {
    const { w, lot } = setup(false);
    expect(zonesCutOffByHighway(w, 9, 10).map((z) => w.grid.idx(z.tx, z.ty)).sort()).toEqual([...lot].sort());
    const everyone = 4 * BALANCE.growth.popPerLevel[TOP + 1];
    const q = pcQuote(w, { type: 'road', tx: 9, ty: 10, roadClass: ROAD_HIGHWAY });
    expect(q.parts.filter((p) => p.reason === 'displacement').length).toBe(4);
    const before = { abandoned: [...w.layers.abandoned], lot: [...w.layers.lot], dev: [...w.layers.devLevel], pc: w.budget.politicalCapital };
    const cmd = new BuildRoadCommand(9, 10, ROAD_HIGHWAY);
    expect(cmd.execute(w)).toBe(true);
    expect(lot.map((i) => w.layers.abandoned[i])).toEqual([1, 1, 1, 1]);
    expect(before.pc - w.budget.politicalCapital).toBeCloseTo(q.cost, 6);
    expect(q.cost).toBeGreaterThan(0);
    expect(everyone).toBe(120);
    cmd.undo(w);
    expect({ abandoned: [...w.layers.abandoned], lot: [...w.layers.lot], dev: [...w.layers.devLevel], pc: w.budget.politicalCapital }).toEqual(before);
  });

  it('cuts nothing off while any tile of it still has a street', () => {
    const { w, lot } = setup(true);
    expect(zonesCutOffByHighway(w, 9, 10)).toEqual([]);
    expect(new BuildRoadCommand(9, 10, ROAD_HIGHWAY).execute(w)).toBe(true);
    expect(lot.map((i) => w.layers.abandoned[i])).toEqual([0, 0, 0, 0]);
  });
});
