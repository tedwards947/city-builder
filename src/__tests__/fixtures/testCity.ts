// A hand-built test city of about 6,500 people, for traffic tests: a dense
// downtown with a commercial core, an industrial district to the east joined
// by one avenue, and two low-rise suburbs joined to downtown by highways.
// Only the layers traffic reads are filled in (roads, zones, levels).

import { World } from '../../sim/World';
import {
  ZONE_R, ZONE_C, ZONE_I, ROAD_STREET, ROAD_AVENUE, ROAD_HIGHWAY,
  BUILDING_POWER_PLANT, BUILDING_WATER_TOWER, BUILDING_SEWAGE_PLANT,
  BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL,
} from '../../sim/constants';
import { BALANCE } from '../../data/balance';

export interface TestCity {
  world: World;
  districts: Record<string, { x0: number; y0: number; x1: number; y1: number }>;
}

export function buildCity(): TestCity {
  const w = new World(128, 128, 5, { vegAmount: 'low' });
  const L = w.layers, g = w.grid;
  for (let i = 0; i < L.terrain.length; i++) { L.terrain[i] = 0; L.vegetation[i] = 0; }
  const road = (x: number, y: number, c: number) => { const i = g.idx(x, y); if (c > L.roadClass[i]) L.roadClass[i] = c; L.zone[i] = 0; L.devLevel[i] = 0; };
  const hline = (x0: number, x1: number, y: number, c: number) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) road(x, y, c); };
  const vline = (x: number, y0: number, y1: number, c: number) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) road(x, y, c); };
  const zone = (x: number, y: number, z: number, d: number) => {
    const i = g.idx(x, y);
    if (L.roadClass[i] !== 0) return;
    L.zone[i] = z; L.devLevel[i] = d; L.visualVariant[i] = (x * 31 + y * 17) & 255;
  };

  // ── Downtown: 30×30, streets every 3 tiles, avenues on the cross and the ring ──
  const D = { x0: 50, y0: 50, x1: 80, y1: 80 };
  for (let k = D.x0; k <= D.x1; k += 3) {
    const cls = k === D.x0 || k === D.x1 || k === 65 ? ROAD_AVENUE : ROAD_STREET;
    vline(k, D.y0, D.y1, cls);
    hline(D.x0, D.x1, k, cls);
  }
  for (let y = D.y0; y <= D.y1; y++) for (let x = D.x0; x <= D.x1; x++) {
    // Commercial core in the middle, dense homes around it.
    const core = Math.abs(x - 65) <= 8 && Math.abs(y - 65) <= 8;
    const mid = Math.abs(x - 65) <= 11 && Math.abs(y - 65) <= 11;
    if (core) zone(x, y, ZONE_C, (x + y) % 4 === 0 ? 2 : 3);
    else zone(x, y, ZONE_R, mid ? 3 : (x + y) % 3 === 0 ? 3 : 2);
  }

  // ── Industry: east of downtown, joined by an avenue ──
  const I = { x0: 96, y0: 56, x1: 110, y1: 74 };
  for (let x = I.x0; x <= I.x1; x += 4) vline(x, I.y0, I.y1, ROAD_STREET);
  hline(I.x0, I.x1, I.y0, ROAD_STREET); hline(I.x0, I.x1, I.y1, ROAD_STREET); hline(I.x0, I.x1, 65, ROAD_AVENUE);
  hline(D.x1, I.x0, 65, ROAD_AVENUE);
  for (let y = I.y0; y <= I.y1; y++) for (let x = I.x0; x <= I.x1; x++) if ((x - I.x0) % 4 === 1 || (x - I.x0) % 4 === 3) zone(x, y, ZONE_I, 3);

  // ── Two suburbs: streets every 4 tiles, low-rise homes, a small shop strip ──
  const suburb = (x0: number, y0: number, shopsY: number) => {
    const S = { x0, y0, x1: x0 + 24, y1: y0 + 20 };
    for (let x = S.x0; x <= S.x1; x += 4) vline(x, S.y0, S.y1, ROAD_STREET);
    for (let y = S.y0; y <= S.y1; y += 4) hline(S.x0, S.x1, y, ROAD_STREET);
    for (let y = S.y0; y <= S.y1; y++) for (let x = S.x0; x <= S.x1; x++) {
      const nextToRoad = (x - S.x0) % 4 === 1 || (x - S.x0) % 4 === 3 || (y - S.y0) % 4 === 1 || (y - S.y0) % 4 === 3;
      if (!nextToRoad) continue;
      if (y === shopsY && x >= S.x0 + 9 && x <= S.x0 + 15) zone(x, y, ZONE_C, 1);
      else zone(x, y, ZONE_R, (x * 3 + y) % 5 === 0 ? 2 : 1);
    }
    return S;
  };
  const A = suburb(6, 8, 17);     // north-west
  const B = suburb(52, 104, 105); // south

  // ── Highways: downtown ↔ each suburb, with short street ramps at both ends ──
  // North-west: from the suburb's east edge across and down to downtown's north-west corner.
  hline(A.x1, 46, 18, ROAD_HIGHWAY); vline(46, 18, 50, ROAD_HIGHWAY);
  road(A.x1, 18, ROAD_STREET); road(A.x1 + 1, 18, ROAD_STREET);
  hline(46, D.x0, 50, ROAD_STREET);
  // South: straight down from downtown's south edge.
  vline(65, D.y1, B.y0, ROAD_HIGHWAY);
  road(65, D.y1, ROAD_AVENUE); road(65, D.y1 + 1, ROAD_STREET); road(65, B.y0, ROAD_STREET); road(65, B.y0 - 1, ROAD_STREET);
  hline(64, 68, B.y0, ROAD_STREET);

  g.markAllDirty();
  return { world: w, districts: { downtown: D, industry: I, suburbNW: A, suburbS: B } };
}

/**
 * The same city with everything else a running city needs: enough power,
 * water and sewage for its size, and police, fire, school and hospital in each
 * district. For tests and benchmarks that run the whole simulation.
 */
export function buildLivingCity(): TestCity {
  const city = buildCity();
  const w = city.world;
  const L = w.layers, g = w.grid;

  // A utility yard on a street north of the downtown–industry avenue.
  for (let y = 40; y <= 64; y++) L.roadClass[g.idx(88, y)] = ROAD_STREET;
  const slots: [number, number][] = [];
  for (let y = 40; y <= 62; y++) slots.push([87, y], [89, y]);
  for (let x = 82; x <= 94; x++) { if (Math.abs(x - 88) > 1) slots.push([x, 64]); slots.push([x, 66]); }

  let levels = 0;
  for (let i = 0; i < L.devLevel.length; i++) levels += L.devLevel[i];
  // Half as much again as the city needs now: it grows over a run (more since schools and hospitals reach further).
  const need = (perLevel: number, output: number) => Math.ceil(levels * perLevel * 1.5 / output);
  const utilities: [number, number][] = [
    [BUILDING_POWER_PLANT, need(BALANCE.power.perDevLevel, BALANCE.power.plantOutput)],
    [BUILDING_WATER_TOWER, need(BALANCE.water.perDevLevel, BALANCE.water.towerOutput)],
    [BUILDING_SEWAGE_PLANT, need(BALANCE.sewage.perDevLevel, BALANCE.sewage.plantOutput)],
  ];
  let slot = 0;
  for (const [kind, count] of utilities) {
    for (let k = 0; k < count; k++) {
      if (slot >= slots.length) throw new Error('testCity: the utility yard is too small for this city');
      const [x, y] = slots[slot++];
      w.placeBuilding(x, y, kind);
    }
  }

  // Services: one of each at the middle of every district, on the nearest lots.
  for (const d of Object.values(city.districts)) {
    const cx = (d.x0 + d.x1) >> 1, cy = (d.y0 + d.y1) >> 1;
    const lots: [number, number][] = [];
    for (let r = 0; r <= 4; r++) {
      for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r) continue;
        const i = g.idx(x, y);
        if (L.roadClass[i] === 0 && L.building[i] === 0) lots.push([x, y]);
      }
    }
    [BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL].forEach((kind, k) => {
      if (lots[k]) w.placeBuilding(lots[k][0], lots[k][1], kind);
    });
  }

  w.budget.money = 50_000;
  w.roadNetDirty = true;
  g.markAllDirty();
  return city;
}

export function population(w: World): number {
  let pop = 0;
  for (let i = 0; i < w.layers.zone.length; i++) {
    if (w.layers.zone[i] === ZONE_R) pop += BALANCE.growth.popPerLevel[w.layers.devLevel[i]] ?? 0;
  }
  return pop;
}
