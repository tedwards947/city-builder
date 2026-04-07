// Typed-array tile layers + entity store.
// Each named layer is a flat Uint8Array of length width*height.
// Adding a new simulation concern = adding a new layer, not restructuring.

import { Grid } from './Grid';
import { EventBus } from './EventBus';
import { mulberry32 } from './rng';
import {
  TERRAIN_GRASS, TERRAIN_WATER, TERRAIN_SAND,
  ZONE_NONE,
  ROAD_NONE,
  BUILDING_NONE, BUILDING_POWER_PLANT, BUILDING_WATER_TOWER, BUILDING_SEWAGE_PLANT,
  SERVICE_BUILDING_KINDS,
} from './constants';
import { BALANCE } from '../data/balance';

export interface Layers {
  terrain:   Uint8Array;
  zone:      Uint8Array;
  roadClass: Uint8Array; // 0=none, 1=street, reserved: avenue/highway
  building:  Uint8Array; // 0=none, 1=power plant, 2=water tower, 3=sewage plant, 4–8=service
  devLevel:  Uint8Array; // 0-3: development level
  power:     Uint8Array; // 0=no power, 1=powered this tick
  water:     Uint8Array; // 0=no water, 1=water coverage this tick
  sewage:    Uint8Array; // 0=no sewage, 1=sewage coverage this tick
  services:  Uint8Array; // 0=no coverage, 1=covered by a service building this tick
  landValue:  Uint8Array; // 0–255 desirability/value (affects tax, updated each interval)
  roadNet:    Uint16Array; // connected-component ID for road network
  pollution:  Uint8Array; // 0–255 pollution level
  congestion: Uint8Array; // 0–255 road traffic congestion (computed by TransitSystem)
}

export interface Budget {
  money: number;
  politicalCapital: number; // unused until Phase 7
  income: number;
  expenses: number;
  taxRates: { R: number; C: number; I: number };
}

export interface Stats {
  population: number;
  powerSupply: number;
  powerDemand: number;
  waterSupply: number;
  waterDemand: number;
  sewageSupply: number;
  sewageDemand: number;
  servicesCoveredZones: number;
  rDemand: number;        // 0.25–2.0 growth probability multiplier for R zones
  cDemand: number;
  iDemand: number;
  avgLandValue: number;   // 0–255 average across all tiles
  avgCongestion: number;  // 0–255 average road congestion (updated by TransitSystem)
}

export interface PowerPlant {
  tx: number;
  ty: number;
}

export interface WaterTower {
  tx: number;
  ty: number;
}

export interface SewagePlant {
  tx: number;
  ty: number;
}

export interface ServiceBuilding {
  tx: number;
  ty: number;
  kind: number; // BUILDING_POLICE | BUILDING_FIRE | BUILDING_SCHOOL | BUILDING_HOSPITAL | BUILDING_PARK
}

export type WaterAmount = 'low' | 'medium' | 'high';

export interface TerrainOptions {
  waterAmount?: WaterAmount;
}

const WATER_PARAMS: Record<WaterAmount, { riverHalfWidth: number; lakeRadius: number }> = {
  low:    { riverHalfWidth: 1, lakeRadius: 5  },
  medium: { riverHalfWidth: 2, lakeRadius: 8  },
  high:   { riverHalfWidth: 3, lakeRadius: 12 },
};

export class World {
  readonly grid: Grid;
  readonly seed: number;
  readonly terrainOptions: TerrainOptions;
  tick: number;
  rng: () => number;
  readonly layers: Layers;
  readonly budget: Budget;
  readonly stats: Stats;
  // City character — unused until Phase 7, present so events can update it.
  readonly character: { egalitarian: number; green: number; planned: number };
  powerPlants: PowerPlant[];
  waterTowers: WaterTower[];
  sewagePlants: SewagePlant[];
  serviceBuildings: ServiceBuilding[];
  readonly events: EventBus;
  roadNetDirty: boolean;

  constructor(width: number, height: number, seed = 1, terrainOptions: TerrainOptions = {}) {
    this.grid = new Grid(width, height);
    this.seed = seed;
    this.terrainOptions = terrainOptions;
    this.tick = 0;
    this.rng = mulberry32(seed ^ 0xC0FFEE);
    const n = width * height;
    this.layers = {
      terrain:   new Uint8Array(n),
      zone:      new Uint8Array(n),
      roadClass: new Uint8Array(n),
      building:  new Uint8Array(n),
      devLevel:  new Uint8Array(n),
      power:     new Uint8Array(n),
      water:     new Uint8Array(n),
      sewage:    new Uint8Array(n),
      services:  new Uint8Array(n),
      landValue:  new Uint8Array(n),
      roadNet:    new Uint16Array(n),
      pollution:  new Uint8Array(n),
      congestion: new Uint8Array(n),
    };
    this.budget = {
      money: BALANCE.startingMoney,
      politicalCapital: BALANCE.startingPoliticalCapital,
      income: 0,
      expenses: 0,
      taxRates: { R: BALANCE.tax.zoneR, C: BALANCE.tax.zoneC, I: BALANCE.tax.zoneI },
    };
    this.stats = { population: 0, powerSupply: 0, powerDemand: 0, waterSupply: 0, waterDemand: 0, sewageSupply: 0, sewageDemand: 0, servicesCoveredZones: 0, rDemand: 1, cDemand: 1, iDemand: 1, avgLandValue: BALANCE.landValue.base, avgCongestion: 0 };
    this.character = { egalitarian: 0, green: 0, planned: 0 };
    this.powerPlants = [];
    this.waterTowers = [];
    this.sewagePlants = [];
    this.serviceBuildings = [];
    this.events = new EventBus();
    this.roadNetDirty = true;
    this.layers.landValue.fill(BALANCE.landValue.base);
    this._generateTerrain();
  }

  private _generateTerrain(): void {
    const rng = mulberry32(this.seed);
    const { width, height } = this.grid;
    const t = this.layers.terrain;
    const amount = this.terrainOptions.waterAmount ?? 'medium';
    const { riverHalfWidth, lakeRadius } = WATER_PARAMS[amount];

    t.fill(TERRAIN_GRASS);

    // A river meandering top-to-bottom.
    let rx = Math.floor(rng() * width);
    for (let ry = 0; ry < height; ry++) {
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = -riverHalfWidth; dx <= riverHalfWidth; dx++) {
          const nx = rx + dx, ny = ry + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            t[ny * width + nx] = TERRAIN_WATER;
          }
        }
      }
      rx += Math.floor((rng() - 0.5) * 4);
      rx = Math.max(riverHalfWidth, Math.min(width - riverHalfWidth - 1, rx));
    }

    // A lake.
    const lakeX = Math.floor(width * 0.7);
    const lakeY = Math.floor(height * 0.3);
    for (let dy = -lakeRadius; dy <= lakeRadius; dy++) {
      for (let dx = -lakeRadius; dx <= lakeRadius; dx++) {
        if (dx * dx + dy * dy <= lakeRadius * lakeRadius) {
          const nx = lakeX + dx, ny = lakeY + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            t[ny * width + nx] = TERRAIN_WATER;
          }
        }
      }
    }

    // Sand — tiles adjacent to water.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (t[y * width + x] !== TERRAIN_GRASS) continue;
        let nearWater = false;
        outer: for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              if (t[ny * width + nx] === TERRAIN_WATER) { nearWater = true; break outer; }
            }
          }
        }
        if (nearWater) t[y * width + x] = TERRAIN_SAND;
      }
    }

    this.grid.markAllDirty();
  }

  // Tile accessors — the only way game code should read/write layers.
  getTerrain(tx: number, ty: number):  number { return this.layers.terrain[this.grid.idx(tx, ty)]; }
  getZone(tx: number, ty: number):     number { return this.layers.zone[this.grid.idx(tx, ty)]; }
  getRoad(tx: number, ty: number):     number { return this.layers.roadClass[this.grid.idx(tx, ty)]; }
  getBuilding(tx: number, ty: number): number { return this.layers.building[this.grid.idx(tx, ty)]; }
  getDevLevel(tx: number, ty: number): number { return this.layers.devLevel[this.grid.idx(tx, ty)]; }
  isPowered(tx: number, ty: number):   boolean { return this.layers.power[this.grid.idx(tx, ty)] !== 0; }

  isBuildable(tx: number, ty: number): boolean {
    if (!this.grid.inBounds(tx, ty)) return false;
    if (this.getTerrain(tx, ty) === TERRAIN_WATER) return false;
    if (this.layers.building[this.grid.idx(tx, ty)] !== BUILDING_NONE) return false;
    return true;
  }

  setZone(tx: number, ty: number, z: number): boolean {
    if (!this.grid.inBounds(tx, ty)) return false;
    if (this.getTerrain(tx, ty) === TERRAIN_WATER) return false;
    const i = this.grid.idx(tx, ty);
    if (this.layers.building[i] !== BUILDING_NONE) return false;
    if (this.layers.zone[i] !== z) this.layers.devLevel[i] = 0;
    this.layers.zone[i] = z;
    this.grid.markDirty(tx, ty);
    return true;
  }

  setRoad(tx: number, ty: number, r: number): boolean {
    if (!this.grid.inBounds(tx, ty)) return false;
    if (this.getTerrain(tx, ty) === TERRAIN_WATER) return false;
    const i = this.grid.idx(tx, ty);
    if (this.layers.building[i] !== BUILDING_NONE) return false;
    const prev = this.layers.roadClass[i];
    this.layers.roadClass[i] = r;
    if (r !== ROAD_NONE) {
      this.layers.zone[i] = ZONE_NONE;
      this.layers.devLevel[i] = 0;
    }
    if (prev !== r) this.roadNetDirty = true;
    this.grid.markDirty(tx, ty);
    return true;
  }

  placeBuilding(tx: number, ty: number, b: number): boolean {
    if (!this.isBuildable(tx, ty)) return false;
    const i = this.grid.idx(tx, ty);
    this.layers.building[i] = b;
    this.layers.zone[i] = ZONE_NONE;
    this.layers.roadClass[i] = ROAD_NONE;
    this.layers.devLevel[i] = 0;
    if (b === BUILDING_POWER_PLANT) {
      this.powerPlants.push({ tx, ty });
    } else if (b === BUILDING_WATER_TOWER) {
      this.waterTowers.push({ tx, ty });
    } else if (b === BUILDING_SEWAGE_PLANT) {
      this.sewagePlants.push({ tx, ty });
    } else if ((SERVICE_BUILDING_KINDS as readonly number[]).includes(b)) {
      this.serviceBuildings.push({ tx, ty, kind: b });
    }
    this.grid.markDirty(tx, ty);
    return true;
  }

  clearTile(tx: number, ty: number): boolean {
    if (!this.grid.inBounds(tx, ty)) return false;
    const i = this.grid.idx(tx, ty);
    const hadRoad = this.layers.roadClass[i] !== ROAD_NONE;
    const hadBuilding = this.layers.building[i];
    this.layers.zone[i] = ZONE_NONE;
    this.layers.roadClass[i] = ROAD_NONE;
    this.layers.building[i] = BUILDING_NONE;
    this.layers.devLevel[i] = 0;
    if (hadBuilding === BUILDING_POWER_PLANT) {
      this.powerPlants = this.powerPlants.filter(p => !(p.tx === tx && p.ty === ty));
    } else if (hadBuilding === BUILDING_WATER_TOWER) {
      this.waterTowers = this.waterTowers.filter(w => !(w.tx === tx && w.ty === ty));
    } else if (hadBuilding === BUILDING_SEWAGE_PLANT) {
      this.sewagePlants = this.sewagePlants.filter(s => !(s.tx === tx && s.ty === ty));
    } else if ((SERVICE_BUILDING_KINDS as readonly number[]).includes(hadBuilding)) {
      this.serviceBuildings = this.serviceBuildings.filter(s => !(s.tx === tx && s.ty === ty));
    }
    if (hadRoad) this.roadNetDirty = true;
    this.grid.markDirty(tx, ty);
    return true;
  }
}
