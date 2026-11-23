import { describe, it, expect, afterEach } from 'vitest';
import { BALANCE } from '../data/balance';
import { vibeTargets } from './vibeTargets';
import { VibeSystem } from './systems/VibeSystem';
import { landWorld, homes } from '../__tests__/pcTestWorld';
import { ZONE_I, ROAD_STREET } from './constants';

const V = BALANCE.vibe as { mode: string };
afterEach(() => { V.mode = 'legacy'; });

/** A small town: a street, homes along it, and either trees or industry beside them. */
function town(withTrees: boolean, withIndustry: boolean) {
  const w = landWorld(40);
  for (let x = 2; x < 38; x++) w.setRoad(x, 20, ROAD_STREET);
  homes(w, 4, 18, 30, 19);
  if (withTrees) for (let y = 21; y < 26; y++) for (let x = 4; x < 30; x++) w.layers.vegetation[y * 40 + x] = 1;
  if (withIndustry) for (let y = 21; y < 26; y++) for (let x = 4; x < 30; x++) { w.setZone(x, y, ZONE_I); w.layers.devLevel[y * 40 + x] = 2; }
  return w;
}

describe('vibe targets (target mode, off as shipped)', () => {
  it('green follows trees and industry; land with no city around it is neutral', () => {
    const leafy = vibeTargets(town(true, false)).green, grey = vibeTargets(town(false, true)).green;
    const i = 19 * 40 + 15;
    expect(leafy[i]).toBeGreaterThan(160);
    expect(grey[i]).toBeLessThan(100);
    expect(leafy[2 * 40 + 2]).toBe(128);
  });

  it('is off as shipped: the legacy mode is the default', () => {
    expect(BALANCE.vibe.mode).toBe('legacy');
  });

  it('starts a neutral city at its targets, holds them with nothing changing, and eases a year to halfway after a change', () => {
    V.mode = 'target';
    const w = town(true, false), sys = new VibeSystem(), i = 19 * 40 + 15, D = BALANCE.ticksPerDay;
    const step = (days: number) => { for (let k = 0; k < days * D; k++) { w.tick++; sys.update(w); } };
    step(1);
    const start = w.layers.vibeGreen[i];
    expect(start).toBe(vibeTargets(w).green[i]);           // snapped to its target
    step(360);
    expect(w.layers.vibeGreen[i]).toBe(start);              // nothing changed: no decay
    w.layers.vegetation.fill(0);                            // the trees go
    const after = vibeTargets(w).green[i];
    step(360 + BALANCE.vibe.targetEveryDays);
    const half = (start + after) / 2;
    expect(Math.abs(w.layers.vibeGreen[i] - half)).toBeLessThan(0.1 * Math.abs(start - after) + 2);
  });
});
