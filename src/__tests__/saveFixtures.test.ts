// Save compatibility (AGENT.md): one saved city from EVERY save version lives
// in fixtures/saves, and every one must still load, upgraded to the current
// version, and play. When SAVE_VERSION goes up, add the new version's file
// (see fixtures/saves/README.md); this test fails until you do.

import { describe, it, expect } from 'vitest';
import { SAVE_VERSION } from '../persistence/SaveFormat';
import { decodeSaveFile } from '../persistence/SaveFile';
import { deserialize, serialize } from '../persistence/Serializer';
import { Scheduler } from '../sim/Scheduler';
import { createSystems } from '../sim/createSystems';
import { VibeSystem } from '../sim/systems/VibeSystem';
import { BUILDING_POWER_PLANT, ROAD_STREET, ZONE_C, ZONE_I, ZONE_R } from '../sim/constants';

const files = import.meta.glob('./fixtures/saves/v*.citysave.json', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const fixtures = Object.entries(files)
  .map(([path, text]) => ({ version: Number(/v(\d+)\.citysave\.json$/.exec(path)![1]), text }))
  .sort((a, b) => a.version - b.version);
const load = (text: string) => deserialize(decodeSaveFile(text).snapshot, { bootstrapVibes: (w) => new VibeSystem().bootstrapVibes(w) });

describe('a saved city from every save version', () => {
  it('there is one fixture for each version, 1 to the current one', () => {
    expect(fixtures.map(f => f.version)).toEqual(Array.from({ length: SAVE_VERSION }, (_, k) => k + 1));
    for (const f of fixtures) expect((JSON.parse(f.text) as { version: number }).version).toBe(f.version);
  });

  for (const f of fixtures) {
    it(`v${f.version} loads as the same city, and plays`, () => {
      expect(decodeSaveFile(f.text).version).toBe(SAVE_VERSION);
      const w = load(f.text);
      const at = (x: number, y: number) => w.grid.idx(x, y);
      // The city every fixture holds: a street, homes, shops, industry, a power plant, the treasury.
      expect(w.grid.width).toBe(24);
      expect(w.tick).toBe(500);
      expect(w.budget.money).toBe(12345);
      for (let x = 2; x <= 21; x++) expect(w.layers.roadClass[at(x, 8)]).toBe(ROAD_STREET);
      for (let x = 3; x <= 10; x++) { expect(w.layers.zone[at(x, 7)]).toBe(ZONE_R); expect(w.layers.devLevel[at(x, 7)]).toBe(2); }
      expect(w.layers.zone[at(4, 9)]).toBe(ZONE_C);
      expect(w.layers.zone[at(15, 9)]).toBe(ZONE_I);
      expect(w.buildings.filter(b => b.kind === BUILDING_POWER_PLANT)).toEqual([{ tx: 19, ty: 7, kind: BUILDING_POWER_PLANT }]);
      // v1 had no service buildings; v9 and later add the three stations.
      expect(w.buildings.length).toBe(f.version >= 9 ? 8 : f.version === 1 ? 3 : 5);
      expect(w.layers.building[at(19, 7)]).toBe(BUILDING_POWER_PLANT);
      // Every building in the list stands on the map, and every building tile belongs to one in the list.
      const owned = new Set(w.buildings.flatMap(b => w.buildingTilesAt(b.tx, b.ty)));
      for (const b of w.buildings) expect(w.layers.building[at(b.tx, b.ty)]).toBe(b.kind);
      for (let i = 0; i < w.layers.building.length; i++) if (w.layers.building[i] !== 0) expect(owned.has(i)).toBe(true);
      // It saves and loads again as itself …
      expect(serialize(deserialize(serialize(w))).buildings).toEqual(serialize(w).buildings);
      // … and plays: a year of ticks without an error, the power plant still supplying.
      const sim = createSystems();
      const scheduler = new Scheduler(w, sim.systems);
      for (let k = 0; k < 400; k++) scheduler.tick();
      expect(w.tick).toBe(900);
      expect(w.stats.powerSupply).toBeGreaterThan(0);
      expect(Number.isFinite(w.budget.money)).toBe(true);
    });
  }
});
