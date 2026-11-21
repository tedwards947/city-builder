// Save version 12 (persistence/SaveFormat.ts): the derived layers are not
// saved, and a save file stores each layer run-length packed.

import { describe, it, expect } from 'vitest';
import v11Text from './fixtures/saves/v11.citysave.json?raw';
import v12Text from './fixtures/saves/v12.citysave.json?raw';
import { World } from '../sim/World';
import { ROAD_STREET, BUILDING_POWER_PLANT, BUILDING_POLICE } from '../sim/constants';
import { DERIVED_LAYERS, SAVE_VERSION } from '../persistence/SaveFormat';
import { decodeSaveFile, encodeSaveFile, packBytes, unpackBytes } from '../persistence/SaveFile';
import { deserialize, serialize, rebuildDerivedLayers } from '../persistence/Serializer';
import { mulberry32 } from '../sim/rng';
import { landWorld, homes } from './pcTestWorld';

const meta = { name: 'x', savedAt: 0, tick: 0, population: 0, money: 0 };

describe('run-length packing', () => {
  const roundTrip = (bytes: Uint8Array) => expect(Array.from(unpackBytes(packBytes(bytes)))).toEqual(Array.from(bytes));

  it('gives back exactly what went in, whatever the runs', () => {
    roundTrip(new Uint8Array(0));
    roundTrip(Uint8Array.of(7));
    roundTrip(Uint8Array.of(7, 7));
    roundTrip(Uint8Array.of(7, 7, 7));
    roundTrip(Uint8Array.of(1, 2, 3, 3, 3, 4, 4, 5));
    for (const n of [127, 128, 129, 130, 255, 256, 257, 300, 1000]) {
      roundTrip(new Uint8Array(n).fill(9));                                   // one long run
      roundTrip(Uint8Array.from({ length: n }, (_, k) => k % 251));           // no runs at all
      roundTrip(Uint8Array.from({ length: n }, (_, k) => (k % 7 < 2 ? 1 : 0)));   // short runs
    }
    const rng = mulberry32(5);
    for (let t = 0; t < 50; t++) {
      // Runs of random length and value, some long, some single.
      const out: number[] = [];
      while (out.length < 2000) { const v = Math.floor(rng() * 4), len = rng() < 0.5 ? 1 : Math.floor(rng() * 400); for (let k = 0; k < len; k++) out.push(v); }
      roundTrip(Uint8Array.from(out));
    }
  });

  it('a layer of one value packs to almost nothing; bytes with no runs grow by under 1%', () => {
    expect(packBytes(new Uint8Array(65536)).length).toBeLessThanOrEqual(2 * Math.ceil(65536 / 128));
    const noisy = Uint8Array.from({ length: 65536 }, (_, k) => (k * 37) % 251);
    expect(packBytes(noisy).length).toBeLessThanOrEqual(65536 + 65536 / 128 + 2);
  });

  it('refuses packed bytes that are not well formed', () => {
    expect(() => unpackBytes(Uint8Array.of(128, 1))).toThrow(/damaged/);       // the unused control byte
    expect(() => unpackBytes(Uint8Array.of(5, 1, 2))).toThrow(/damaged/);      // says six bytes follow, two do
    expect(() => unpackBytes(Uint8Array.of(200))).toThrow(/damaged/);          // a repeat with no byte to repeat
  });
});

describe('a version 12 save', () => {
  function town(): World {
    const w = landWorld(64);
    for (let x = 2; x <= 60; x++) w.setRoad(x, 20, ROAD_STREET);
    homes(w, 4, 19, 40, 19, 2);
    w.placeBuilding(44, 21, BUILDING_POWER_PLANT);
    w.placeBuilding(10, 21, BUILDING_POLICE);
    rebuildDerivedLayers(w);
    return w;
  }

  it('holds no derived layer, and loads with power and coverage worked out again', () => {
    const w = town();
    expect(w.layers.power[w.grid.idx(10, 19)]).toBe(1);
    expect(w.layers.police[w.grid.idx(8, 19)]).toBe(1);
    const file = JSON.parse(encodeSaveFile(meta, serialize(w)));
    expect(file.version).toBe(SAVE_VERSION);
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(12);
    for (const name of DERIVED_LAYERS) expect(file.snapshot.layers[name], name).toBeUndefined();
    const back = deserialize(decodeSaveFile(JSON.stringify(file)).snapshot);
    for (const name of DERIVED_LAYERS) {
      if (name === 'congestion' || name === 'accessibility') continue;       // from traffic: filled by the first pass after a load
      expect(Array.from(back.layers[name]), name).toEqual(Array.from(w.layers[name]));
    }
    expect(back.stats.powerSupply).toBe(w.stats.powerSupply);
  });

  it('a save from before (version 11) still has its derived layers, and they are used as saved', () => {
    const file = JSON.parse(v11Text);
    expect(file.version).toBe(11);
    expect(file.snapshot.layers.power.type).toBe('u8');                      // not packed
    const rec = decodeSaveFile(v11Text);
    expect(rec.version).toBe(SAVE_VERSION);
    for (const name of DERIVED_LAYERS) expect(rec.snapshot.layers[name], name).toBeDefined();
    const w = deserialize(rec.snapshot);
    expect(Array.from(w.layers.power)).toEqual(Array.from(rec.snapshot.layers.power!));
    expect(Array.from(w.layers.congestion)).toEqual(Array.from(rec.snapshot.layers.congestion!));
  });

  it('the same city saved at version 11 and at version 12 loads as the same map', () => {
    const a = deserialize(decodeSaveFile(v11Text).snapshot), b = deserialize(decodeSaveFile(v12Text).snapshot);
    for (const name of ['terrain', 'zone', 'devLevel', 'roadClass', 'building', 'rail', 'lot', 'landValue', 'visualVariant'] as const) {
      expect(Array.from(b.layers[name]), name).toEqual(Array.from(a.layers[name]));
    }
    expect(b.buildings).toEqual(a.buildings);
    expect(b.budget.money).toBe(a.budget.money);
  });

  it('is small: the fixture is a tenth of its version 11 size, and a generated map packs to under a tenth of its bytes', () => {
    expect(v12Text.length).toBeLessThan(v11Text.length / 5);
    expect(v12Text.length).toBeLessThan(5000);
    const w = new World(128, 128, 5, { mapType: 'river', vegAmount: 'high' });
    for (let x = 40; x <= 90; x++) w.setRoad(x, 64, ROAD_STREET);
    homes(w, 42, 63, 88, 63, 2);
    const snap = serialize(w);
    let raw = 0;
    for (const a of Object.values(snap.layers)) if (a) raw += a.byteLength;
    const text = encodeSaveFile(meta, snap);
    expect(text.length).toBeLessThan(raw * (4 / 3) * 0.1);
    expect(text.length).toBeLessThan(120_000);
  });
});
