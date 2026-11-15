// Save files: export a city to text and load it back.

import { describe, it, expect } from 'vitest';
import { World } from '../sim/World';
import { SaveManager } from '../persistence/SaveManager';
import { SAVE_VERSION, type IStore } from '../persistence/SaveFormat';
import { SAVE_FILE_FORMAT, decodeSaveFile, saveFileName } from '../persistence/SaveFile';
import { ZONE_R, ROAD_AVENUE, BUILDING_POWER_PLANT } from '../sim/constants';

// Export / import never touch a slot, so the store is never called.
const noStore = {} as IStore;

function sampleWorld(): World {
  const w = new World(24, 16, 7);
  w.tick = 1234;
  w.budget.money = 4321.5;
  w.budget.taxRates.C = 1.7;
  w.character.green = 0.4;
  w.layers.zone[w.grid.idx(3, 4)] = ZONE_R;
  w.layers.devLevel[w.grid.idx(3, 4)] = 2;
  w.layers.roadClass[w.grid.idx(4, 4)] = ROAD_AVENUE;
  w.layers.roadNet[w.grid.idx(4, 4)] = 40000;        // needs 16 bits
  w.layers.visualVariant[w.grid.idx(3, 4)] = 201;
  w.layers.building[w.grid.idx(10, 10)] = BUILDING_POWER_PLANT;
  w.buildings.push({ tx: 10, ty: 10, kind: BUILDING_POWER_PLANT });
  return w;
}

describe('save files', () => {
  it('round-trips a city through text', () => {
    const manager = new SaveManager(noStore);
    const w = sampleWorld();
    const text = manager.exportGame(w, 'Test Town');
    expect(typeof text).toBe('string');

    const back = manager.importGame(text);
    expect(back.grid.width).toBe(24);
    expect(back.grid.height).toBe(16);
    expect(back.tick).toBe(1234);
    expect(back.budget.money).toBe(4321.5);
    expect(back.budget.taxRates.C).toBe(1.7);
    expect(back.character.green).toBeCloseTo(0.4);
    expect(back.buildings).toEqual([{ tx: 10, ty: 10, kind: BUILDING_POWER_PLANT }]);
    for (const name of Object.keys(w.layers) as (keyof typeof w.layers)[]) {
      expect(Array.from(back.layers[name]), `layer ${name}`).toEqual(Array.from(w.layers[name]));
    }
    expect(back.layers.roadNet).toBeInstanceOf(Uint16Array);
    expect(back.layers.zone).toBeInstanceOf(Uint8Array);
  });

  it('the file is JSON carrying its format, version and name', () => {
    const text = new SaveManager(noStore).exportGame(sampleWorld(), 'Test Town');
    const json = JSON.parse(text);
    expect(json.format).toBe(SAVE_FILE_FORMAT);
    expect(json.version).toBe(SAVE_VERSION);
    expect(json.meta.name).toBe('Test Town');
    expect(json.snapshot.layers.zone.type).toBe('u8');
    expect(json.snapshot.layers.roadNet.type).toBe('u16');
    expect(decodeSaveFile(text).meta.name).toBe('Test Town');
  });

  it('rejects things that are not save files, with a readable reason', () => {
    const manager = new SaveManager(noStore);
    expect(() => manager.importGame('hello')).toThrow(/not valid JSON/);
    expect(() => manager.importGame('{"some":"json"}')).toThrow(/Not a city-builder save file/);
    expect(() => manager.importGame(JSON.stringify({ format: SAVE_FILE_FORMAT, version: SAVE_VERSION }))).toThrow(/incomplete/);
  });

  it('rejects a file from a newer game version and a damaged layer', () => {
    const manager = new SaveManager(noStore);
    const good = JSON.parse(manager.exportGame(sampleWorld(), 'Test Town'));

    expect(() => manager.importGame(JSON.stringify({ ...good, version: SAVE_VERSION + 1 }))).toThrow(/newer version/);

    const short = structuredClone(good);
    short.snapshot.layers.zone.base64 = short.snapshot.layers.zone.base64.slice(0, 40);
    expect(() => manager.importGame(JSON.stringify(short))).toThrow(/layer "zone"/);

    const mangled = structuredClone(good);
    mangled.snapshot.layers.zone = [1, 2, 3];
    expect(() => manager.importGame(JSON.stringify(mangled))).toThrow(/layer "zone"/);
  });

  it('makes safe file names', () => {
    expect(saveFileName('My City')).toBe('My-City.citysave.json');
    expect(saveFileName('  ../../etc/passwd  ')).toBe('etcpasswd.citysave.json');
    expect(saveFileName('!!!')).toBe('city.citysave.json');
  });
});
