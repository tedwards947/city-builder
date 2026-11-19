// The title screen: the showcase behind it never fails (title/showcaseKeeper.ts),
// and the tour's zoom is drawn at whole tile sizes (render/SmoothZoom.ts).

import { describe, it, expect } from 'vitest';
import text from '../../public/showcase/showcase.citysave.json?raw';
import { decodeSaveFile } from '../persistence/SaveFile';
import { deserialize } from '../persistence/Serializer';
import { VibeSystem } from '../sim/systems/VibeSystem';
import { Scheduler } from '../sim/Scheduler';
import { createSystems } from '../sim/createSystems';
import { pcCap } from '../sim/politics';
import { KEEP, ShowcaseKeeper } from '../title/showcaseKeeper';
import { SMOOTH_MAX_SCALE, SMOOTH_MIN_SCALE, SMOOTH_TILES, pickTile } from '../render/SmoothZoom';

const loadShowcase = () => deserialize(decodeSaveFile(text).snapshot, { bootstrapVibes: (x) => new VibeSystem().bootstrapVibes(x) });

describe('the showcase behind the title never fails', () => {
  it('a showcase that is broke and past its debt limit is put right, and stays so while it runs', () => {
    const w = loadShowcase();
    // The worst case: deep in debt, political capital gone, the countdown nearly out.
    w.budget.money = -5_000_000;
    w.budget.politicalCapital = -50;
    w.budget.debtOverTicks = 100_000;
    const keeper = new ShowcaseKeeper(w);
    const scheduler = new Scheduler(w, createSystems().systems);
    for (let k = 0; k < 200; k++) {
      keeper.hold(w);
      scheduler.tick();
      expect(w.budget.gameOver).toBe(false);
    }
    keeper.hold(w);
    expect(w.budget.money).toBeGreaterThanOrEqual(KEEP.minMoney);
    expect(w.budget.politicalCapital).toBeGreaterThanOrEqual(pcCap(w));
    expect(w.budget.debtOverTicks).toBe(0);
  }, 30000);

  it('the treasury is frozen at what the showcase was saved with (or the floor, if that is more)', () => {
    const w = loadShowcase();
    const money = Math.max(w.budget.money, KEEP.minMoney);    // whatever city the showcase is
    const keeper = new ShowcaseKeeper(w);
    w.budget.money = 12;
    keeper.hold(w);
    expect(w.budget.money).toBe(money);
  });

  it('says when the city has shrunk enough to start again', () => {
    const w = loadShowcase();
    const keeper = new ShowcaseKeeper(w), start = w.stats.population;
    expect(keeper.declined(w)).toBe(false);
    w.stats.population = Math.ceil(start * KEEP.restartBelow);
    expect(keeper.declined(w)).toBe(false);
    w.stats.population = Math.floor(start * KEEP.restartBelow) - 1;
    expect(keeper.declined(w)).toBe(true);
  });
});

describe('smooth zoom: the tile size a gliding camera is drawn at', () => {
  it('is always a whole number, and the picture is never scaled outside the band', () => {
    let tile = 0;
    // A zoom gliding in, then out, across the whole range.
    const sizes: number[] = [];
    for (let ts = 4; ts <= 80; ts *= 1.003) sizes.push(ts);
    for (const ts of [...sizes, ...sizes.slice().reverse()]) {
      tile = pickTile(ts, tile);
      expect(Number.isInteger(tile)).toBe(true);
      expect(ts / tile).toBeGreaterThanOrEqual(SMOOTH_MIN_SCALE - 1e-9);
      expect(ts / tile).toBeLessThanOrEqual(SMOOTH_MAX_SCALE + 1e-9);
    }
  });

  it('changes rarely: a zoom gliding across the whole range re-draws the caches a few dozen times, not every frame', () => {
    let tile = 0, changes = 0, steps = 0;
    for (let ts = 4; ts <= 80; ts *= 1.003) {
      const next = pickTile(ts, tile);
      if (next !== tile) changes++;
      tile = next;
      steps++;
    }
    expect(steps).toBeGreaterThan(900);
    expect(changes).toBeLessThanOrEqual(SMOOTH_TILES.length);
  });

  it('holds its size while the zoom hovers around one value (a rest, or a flight between two like zooms)', () => {
    const tile = pickTile(47.5, 0);
    expect(tile).toBe(48);
    // A 5 % push in, across 48, and back.
    for (const ts of [47.5, 48.2, 49.9, 48.0, 47.4]) expect(pickTile(ts, tile)).toBe(48);
  });
});
