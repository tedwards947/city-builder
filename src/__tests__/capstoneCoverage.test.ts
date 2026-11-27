// Capstones, phase 2 (CAPSTONE_DESIGN.md, sim/capstones.ts): the four service
// capstones cover every home on the road network their street belongs to,
// highways included, with no limit to their room. Each is one more building
// of its small kind to coverage, seats, the PC rule and the running cost.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import {
  BUILDING_FIRE, BUILDING_FIRE_HQ, BUILDING_GENERAL_HOSPITAL, BUILDING_HOSPITAL, BUILDING_POLICE, BUILDING_POLICE_HQ,
  BUILDING_SCHOOL, BUILDING_UNIVERSITY, ROAD_HIGHWAY, ROAD_NONE, ROAD_STREET,
} from '../sim/constants';
import { WHOLE_CITY, isServiceCapstone, serviceBaseKind, serviceRange } from '../sim/capstones';
import { ServiceSystem } from '../sim/systems/ServiceSystem';
import { buildingSeats, homeSeat } from '../sim/serviceCapacity';
import { coveredBy, isServiceKind, serviceClosureValue, serviceOpeningValue } from '../sim/serviceValue';
import { pcCap, pcQuote } from '../sim/politics';
import { headcountCost } from '../sim/runningCost';
import { landWorld, homes, withoutActionCap } from './pcTestWorld';

// These tests check the PC formulas' own prices: the one-action limit is tested in pcActionCap.test.ts.
withoutActionCap();

const ROW = 20;
const POP = BALANCE.growth.popPerLevel[3];
const CAP = BALANCE.service.capacity as Record<number, number>;
const shippedCap = { ...CAP };

let w: World;
let sys: ServiceSystem;
const idx = (x: number, y: number) => w.grid.idx(x, y);
const cover = () => { sys.update(w); return w.layers; };

// A street along y = 20 from x = 2 to 90, with level-3 homes all along its north side (x 4–88: 85 homes).
// A second street (y = 60, x 10–40) joined to nothing, with five homes.
beforeEach(() => {
  w = landWorld(96);
  for (let x = 2; x <= 90; x++) w.setRoad(x, ROW, ROAD_STREET);
  homes(w, 4, ROW - 1, 88, ROW - 1, 3);
  for (let x = 10; x <= 40; x++) w.setRoad(x, 60, ROAD_STREET);
  homes(w, 20, 59, 24, 59, 3);
  sys = new ServiceSystem();
});
afterEach(() => { Object.assign(CAP, shippedCap); });

const school = () => expect(w.placeBuilding(10, ROW + 1, BUILDING_SCHOOL)).toBe(true);
const university = () => expect(w.placeBuilding(40, ROW + 1, BUILDING_UNIVERSITY)).toBe(true);   // x 40–47, y 21–28

describe('a service capstone', () => {
  it('stands in for its small kind, with the whole city for a range', () => {
    expect([BUILDING_FIRE_HQ, BUILDING_POLICE_HQ, BUILDING_GENERAL_HOSPITAL, BUILDING_UNIVERSITY].map(serviceBaseKind))
      .toEqual([BUILDING_FIRE, BUILDING_POLICE, BUILDING_HOSPITAL, BUILDING_SCHOOL]);
    for (const k of [BUILDING_FIRE_HQ, BUILDING_POLICE_HQ, BUILDING_GENERAL_HOSPITAL, BUILDING_UNIVERSITY]) {
      expect(isServiceCapstone(k)).toBe(true);
      expect(isServiceKind(k)).toBe(true);
      expect(serviceRange(k)).toBe(WHOLE_CITY);
    }
    expect(isServiceCapstone(BUILDING_SCHOOL)).toBe(false);
    expect(serviceBaseKind(BUILDING_SCHOOL)).toBe(BUILDING_SCHOOL);
    expect(serviceRange(BUILDING_SCHOOL)).toBe(BALANCE.service.coverageRange[BUILDING_SCHOOL]);
  });

  it('covers every home on its road network, at any distance; a small school only its range', () => {
    school();
    let L = cover();
    expect(L.school[idx(12, ROW - 1)]).toBe(1);
    expect(L.school[idx(80, ROW - 1)]).toBe(0);                 // far beyond the school's 20 road steps
    university();
    L = cover();
    for (let x = 4; x <= 88; x++) expect(L.school[idx(x, ROW - 1)], `home at ${x}`).toBe(1);
    expect(L.services[idx(80, ROW - 1)]).toBe(1);
    // The other layers are untouched: it is a school, not a police station.
    expect(L.police[idx(80, ROW - 1)]).toBe(0);
    // A district on a road network of its own is not joined to it.
    expect(L.school[idx(22, 59)]).toBe(0);
  });

  it('each of the four fills its own layer', () => {
    const layers: [number, keyof World['layers']][] = [[BUILDING_POLICE_HQ, 'police'], [BUILDING_FIRE_HQ, 'fireStation'], [BUILDING_GENERAL_HOSPITAL, 'hospital'], [BUILDING_UNIVERSITY, 'school']];
    for (const [kind, layer] of layers) {
      w.buildings.slice().forEach((b) => w.clearTile(b.tx, b.ty));
      expect(w.placeBuilding(40, ROW + 1, kind), String(kind)).toBe(true);
      const L = cover();
      expect((L[layer] as Uint8Array)[idx(4, ROW - 1)], String(kind)).toBe(1);
      expect((L[layer] as Uint8Array)[idx(88, ROW - 1)], String(kind)).toBe(1);
    }
  });

  it('a suburb reached only by highway counts as joined', () => {
    for (let x = 60; x <= 70; x++) { w.clearTile(x, ROW - 1); w.setRoad(x, ROW, ROAD_HIGHWAY); }
    university();
    const L = cover();
    expect(L.school[idx(80, ROW - 1)]).toBe(1);
    expect(L.school[idx(50, ROW - 1)]).toBe(1);
  });

  it('is switched on by a street or avenue beside it, not by a highway: cut its street and the city is back to its small buildings', () => {
    school(); university();
    expect(cover().school[idx(80, ROW - 1)]).toBe(1);
    for (let x = 39; x <= 48; x++) w.setRoad(x, ROW, ROAD_NONE);        // the street along its north side
    let L = cover();
    expect(L.school[idx(80, ROW - 1)]).toBe(0);
    expect(L.school[idx(12, ROW - 1)]).toBe(1);                         // the small school carries on
    for (let x = 39; x <= 48; x++) w.setRoad(x, ROW, ROAD_HIGHWAY);     // a highway is no way in
    L = cover();
    expect(L.school[idx(80, ROW - 1)]).toBe(0);
  });
});

describe('seats', () => {
  it('a capstone never runs out of room: the homes a full school turns away are seated at it', () => {
    CAP[BUILDING_SCHOOL] = 5 * POP;                                      // room for five homes
    school();
    let L = cover();
    const near = [8, 9, 10, 11, 12, 13, 14, 15, 16].filter((x) => L.school[idx(x, ROW - 1)] === 1);
    expect(near.length).toBe(5);
    expect(homeSeat(w, 30, ROW - 1, BUILDING_SCHOOL)).toMatchObject({ seatedAt: null });
    university();
    L = cover();
    for (let x = 4; x <= 88; x++) expect(L.school[idx(x, ROW - 1)], `home at ${x}`).toBe(1);
    // The school still seats its five; everyone else sits at the university.
    expect(buildingSeats(w, 10, ROW + 1)).toMatchObject({ capacity: 5 * POP, seated: 5 * POP });
    expect(buildingSeats(w, 40, ROW + 1)).toMatchObject({ capacity: 0, seated: 80 * POP, inReachUnseated: 0 });
    expect(homeSeat(w, 80, ROW - 1, BUILDING_SCHOOL)).toEqual({ seatedAt: { tx: 40, ty: ROW + 1 }, reason: null });
    expect(homeSeat(w, 22, 59, BUILDING_SCHOOL)).toEqual({ seatedAt: null, reason: 'outOfReach' });
  });

  it('alone, it seats the whole city however big', () => {
    CAP[BUILDING_SCHOOL] = 5 * POP;
    university();
    cover();
    expect(buildingSeats(w, 44, ROW + 3)).toMatchObject({ capacity: 0, seated: 85 * POP, inReachUnseated: 0 });
    expect(coveredBy(w, BUILDING_SCHOOL).get(idx(80, ROW - 1))).toBe(1);
  });
});

describe('political capital', () => {
  const total = (parts: { amount: number }[]) => parts.reduce((s, p) => s + p.amount, 0);

  it('opening one earns for the residents it gives a seat, and nothing for those who had one', () => {
    school();
    const gain = total(serviceOpeningValue(w, 40, ROW + 1, BUILDING_UNIVERSITY));
    expect(gain).toBeGreaterThan(0);
    const rate = BALANCE.politicalCapital.service.perResident[BUILDING_SCHOOL];
    const seatedAtSchool = buildingSeats(w, 10, ROW + 1)!.seated;
    expect(gain).toBeCloseTo((85 * POP - seatedAtSchool) * rate, 6);
  });

  it('with the capstone standing, closing a small building costs nothing: its homes move to the capstone', () => {
    school();
    expect(total(serviceClosureValue(w, 10, ROW + 1))).toBeLessThan(0);
    university();
    expect(serviceClosureValue(w, 10, ROW + 1)).toEqual([]);
  });

  it('closing the capstone charges for everyone it leaves with nothing, but never more than half the PC cap', () => {
    school(); university();
    const full = -total(serviceClosureValue(w, 44, ROW + 3));
    expect(full).toBeGreaterThan(0);
    w.stats.population = 90 * POP;
    const most = BALANCE.capstones.closurePcShare * pcCap(w);
    const service = { ...BALANCE.politicalCapital.service };
    const charge = (): number => -pcQuote(w, { type: 'bulldoze', tx: 44, ty: ROW + 3 }, undefined, service).parts
      .filter((p) => p.reason === 'serviceClosed').reduce((s, p) => s + p.amount, 0);
    // As shipped the charge is small against the cap: it is charged in full.
    expect(full).toBeLessThan(most);
    expect(charge()).toBeCloseTo(full, 6);
    // With a rate high enough to pass the cap, the charge stops at it.
    service.perResident = { ...service.perResident, [BUILDING_SCHOOL]: (most * 3) / (85 * POP) };
    expect(-total(serviceClosureValue(w, 44, ROW + 3, service))).toBeGreaterThan(most);
    expect(charge()).toBeCloseTo(most, 4);
    // A small school is never capped.
    w.clearTile(44, ROW + 3);
    const schoolCost = -total(serviceClosureValue(w, 10, ROW + 1, service));
    expect(-pcQuote(w, { type: 'bulldoze', tx: 10, ty: ROW + 1 }, undefined, service).parts
      .filter((p) => p.reason === 'serviceClosed').reduce((s, p) => s + p.amount, 0)).toBeCloseTo(schoolCost, 6);
  });
});

describe('running cost', () => {
  const R = BALANCE.runningCost as { freeResidents: number };
  const free = R.freeResidents;
  beforeEach(() => { R.freeResidents = 0; });
  afterEach(() => { R.freeResidents = free; });
  const perTick = 1 / BALANCE.ticksPerDay;

  it('a service capstone costs its rate for every resident it covers, seated at a small building or not, and the normal rate goes on for everyone covered', () => {
    CAP[BUILDING_SCHOOL] = 5 * POP;
    school(); university();
    cover();
    const cost = headcountCost(w);
    const rate = BALANCE.capstones.kinds[BUILDING_UNIVERSITY].perResident;
    // 85 homes covered, 5 of them seated at the school: keeping the school does not make the capstone cheaper.
    expect(cost.capstones[BUILDING_UNIVERSITY]).toBeCloseTo(85 * POP * rate * perTick, 6);
    expect(cost.residents[BUILDING_SCHOOL]).toBe(85 * POP);
    expect(cost.services[BUILDING_SCHOOL]).toBeCloseTo(85 * POP * BALANCE.runningCost.perResident[BUILDING_SCHOOL] * perTick, 6);
  });

  it('nothing while its street is cut', () => {
    university();
    for (let x = 39; x <= 48; x++) w.setRoad(x, ROW, ROAD_NONE);
    cover();
    expect(headcountCost(w).capstones[BUILDING_UNIVERSITY]).toBe(0);
  });
});
