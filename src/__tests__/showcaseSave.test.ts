// The title screen's showcase city (public/showcase/showcase.citysave.json,
// built by `npm run gen-showcase`, src/gen/showcase.ts) loads as an ordinary
// save and still has what the camera tour is there to show. If the game
// changes so that this fails, rebuild the file with `npm run gen-showcase`.

import { describe, it, expect } from 'vitest';
import text from '../../public/showcase/showcase.citysave.json?raw';
import { decodeSaveFile } from '../persistence/SaveFile';
import { deserialize } from '../persistence/Serializer';
import { VibeSystem } from '../sim/systems/VibeSystem';
import {
  BUILDING_AIRPORT, BUILDING_PARK, BUILDING_SEAPORT, BUILDING_STATION, BUILDING_SUBWAY_STATION,
  RAIL_ELEVATED, RAIL_SUBWAY, ZONE_C,
} from '../sim/constants';

describe('the showcase city', () => {
  const file = decodeSaveFile(text);
  const w = deserialize(file.snapshot, { bootstrapVibes: (x) => new VibeSystem().bootstrapVibes(x) });
  const count = (kind: number) => w.buildings.filter(b => b.kind === kind).length;

  it('is a big, healthy city', () => {
    expect(w.stats.population).toBeGreaterThanOrEqual(15000);
    expect(w.stats.population).toBeLessThanOrEqual(25000);
    expect(w.budget.money).toBeGreaterThan(0);
    expect(w.budget.politicalCapital).toBeGreaterThan(0);
    expect(w.layers.abandoned.reduce((a, b) => a + b, 0)).toBeLessThan(20);
  });

  it('has the sights: airport, seaport, train, elevated and subway lines, towers downtown, parks and trees', () => {
    expect(count(BUILDING_AIRPORT)).toBe(1);
    expect(count(BUILDING_SEAPORT)).toBe(1);
    expect(count(BUILDING_STATION)).toBeGreaterThanOrEqual(4);
    expect(count(BUILDING_SUBWAY_STATION)).toBeGreaterThanOrEqual(2);
    expect(count(BUILDING_PARK)).toBeGreaterThan(5);
    expect(w.layers.rail.some(r => (r & RAIL_ELEVATED) !== 0)).toBe(true);
    expect(w.layers.rail.some(r => (r & RAIL_SUBWAY) !== 0)).toBe(true);
    let towers = 0;
    for (let i = 0; i < w.layers.zone.length; i++) if (w.layers.zone[i] === ZONE_C && w.layers.devLevel[i] === 3) towers++;
    expect(towers).toBeGreaterThan(200);
    expect(w.layers.vegetation.some(v => v !== 0)).toBe(true);
  });

  it('stays a reasonable size to ship', () => {
    expect(text.length).toBeLessThan(4_000_000);
  });
});
