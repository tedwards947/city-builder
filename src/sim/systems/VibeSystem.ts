import type { World } from '../World';
import {
  ZONE_R, ZONE_C, ZONE_I, ZONE_NONE,
  BUILDING_POWER_PLANT,
  BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL, BUILDING_PARK,
  ROAD_NONE,
} from '../constants';
import { BALANCE } from '../../data/balance';

/**
 * VibeSystem — manages localized neighborhood vibes.
 * Transitions from global city-wide character to spatial layers.
 */
export class VibeSystem {
  private registeredWorld: World | null = null;

  update(world: World): void {
    if (world !== this.registeredWorld) {
      this._register(world);
    }
    
    // Slow spatial diffusion and decay
    this._simulateSpatialVibes(world);
    
    // Legacy global axes (averaged from layers for global logic)
    this._updateGlobalAxes(world);
  }

  /**
   * Performs an initial city-wide scan to seed localized vibes based on existing 
   * infrastructure. Useful for migrating older save files.
   */
  bootstrapVibes(world: World): void {
    const { width, height } = world.grid;
    const n = width * height;
    const l = world.layers;
    
    for (let i = 0; i < n; i++) {
        const tx = i % width;
        const ty = Math.floor(i / width);
        const zone = l.zone[i];
        const kind = l.building[i];
        
        if (zone === ZONE_R) {
            this._spatialNudge(world, tx, ty, 'vibeGreen', 0.5);
        } else if (zone === ZONE_I) {
            this._spatialNudge(world, tx, ty, 'vibeGreen', -0.5);
        } else if (kind === BUILDING_PARK) {
            this._spatialNudge(world, tx, ty, 'vibeGreen', 1.0);
            this._spatialNudge(world, tx, ty, 'vibeEgalitarian', 0.5);
        }
    }
    
    // Run several diffusion passes to smooth out the initial seeding
    for (let i = 0; i < 5; i++) {
        this._simulateSpatialVibes(world);
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _register(world: World): void {
    this.registeredWorld = world;
    const ev = world.events;
    const n = BALANCE.character.nudges;

    ev.on('zonePainted', (p) => {
      const tx = p.tx as number;
      const ty = p.ty as number;
      const zone = p.zone as number;
      const displaced = (p.displacedPopulation as number) || 0;

      if (zone === ZONE_R) {
        this._spatialNudge(world, tx, ty, 'vibeEgalitarian', n.egalitarian.residentialZone * 10);
        this._spatialNudge(world, tx, ty, 'vibeGreen',       n.green.residentialZone * 10);
        this._spatialNudge(world, tx, ty, 'vibePlanned',     n.planned.residentialZone * 10);
      } else if (zone === ZONE_C) {
        this._spatialNudge(world, tx, ty, 'vibeGreen',       n.green.commercialZone * 10);
      } else if (zone === ZONE_I) {
        this._spatialNudge(world, tx, ty, 'vibeEgalitarian', n.egalitarian.industrialZone * 10);
        this._spatialNudge(world, tx, ty, 'vibeGreen',       n.green.industrialZone * 10);
      }

      if (displaced > 0) {
        this._spatialNudge(world, tx, ty, 'vibeEgalitarian', n.egalitarian.populationDisplaced * displaced);
        this._spatialNudge(world, tx, ty, 'vibePlanned',     n.planned.populationDisplaced * displaced);
      }
    });

    ev.on('tileCleared', (p) => {
      const tx = p.tx as number;
      const ty = p.ty as number;
      const displaced = (p.displacedPopulation as number) || 0;
      if (displaced > 0) {
        this._spatialNudge(world, tx, ty, 'vibeEgalitarian', n.egalitarian.populationDisplaced * displaced);
        this._spatialNudge(world, tx, ty, 'vibePlanned',     n.planned.populationDisplaced * displaced);
      }
    });

    ev.on('roadBuilt', (p) => {
      const tx = p.tx as number;
      const ty = p.ty as number;
      this._spatialNudge(world, tx, ty, 'vibePlanned', n.planned.roadBuilt * 5);
    });

    ev.on('buildingPlaced', (p) => {
      const tx = p.tx as number;
      const ty = p.ty as number;
      const kind = p.kind as number;
      if (kind === BUILDING_PARK) {
        this._spatialNudge(world, tx, ty, 'vibeEgalitarian', n.egalitarian.parkBuilt * 20);
        this._spatialNudge(world, tx, ty, 'vibeGreen',       n.green.parkBuilt * 20);
        this._spatialNudge(world, tx, ty, 'vibePlanned',     n.planned.serviceBuilt * 20);
      } else if ([BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL].includes(kind)) {
        this._spatialNudge(world, tx, ty, 'vibeEgalitarian', n.egalitarian.serviceBuilt * 15);
        this._spatialNudge(world, tx, ty, 'vibePlanned',     n.planned.serviceBuilt * 15);
      } else if (kind === BUILDING_POWER_PLANT) {
        this._spatialNudge(world, tx, ty, 'vibeGreen', n.green.powerPlantBuilt * 20);
      }
    });
  }

  private _spatialNudge(world: World, tx: number, ty: number, layer: 'vibeEgalitarian' | 'vibeGreen' | 'vibePlanned', delta: number): void {
    const i = world.grid.idx(tx, ty);
    // Values are 0-255, neutral is 128. delta is normalized -1 to 1 scale.
    // Scale delta up to byte space.
    const byteDelta = Math.round(delta * 128);
    const current = world.layers[layer][i];
    world.layers[layer][i] = Math.max(0, Math.min(255, current + byteDelta));
    world.grid.markDirty(tx, ty);
  }

  private _simulateSpatialVibes(world: World): void {
    const { width, height } = world.grid;
    const n = width * height;
    const layers = [world.layers.vibeEgalitarian, world.layers.vibeGreen, world.layers.vibePlanned];
    
    // Spatial simulation every 4 ticks to save CPU
    if (world.tick % 4 !== 0) return;

    for (const layer of layers) {
      const next = new Uint8Array(layer);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = y * width + x;
          
          // 1. Diffusion (Average with neighbors)
          let sum = layer[i] * 4;
          let count = 4;
          if (x > 0) { sum += layer[i - 1]; count++; }
          if (x < width - 1) { sum += layer[i + 1]; count++; }
          if (y > 0) { sum += layer[i - width]; count++; }
          if (y < height - 1) { sum += layer[i + width]; count++; }
          
          let val = sum / count;

          // 2. Decay toward 128 (Neutral)
          if (val > 128.5) val -= 0.1;
          else if (val < 127.5) val += 0.1;
          else val = 128;

          next[i] = Math.round(val);
        }
      }
      layer.set(next);
    }
    world.grid.markAllDirty();
  }

  private _updateGlobalAxes(world: World): void {
    // Averaging the entire map for global stats/legacy logic
    const { width, height } = world.grid;
    const n = width * height;
    let sumE = 0, sumG = 0, sumP = 0;
    
    for (let i = 0; i < n; i++) {
      sumE += world.layers.vibeEgalitarian[i];
      sumG += world.layers.vibeGreen[i];
      sumP += world.layers.vibePlanned[i];
    }
    
    const max = BALANCE.character.axisMax;
    world.character.egalitarian = ((sumE / n) - 128) / 128 * max;
    world.character.green       = ((sumG / n) - 128) / 128 * max;
    world.character.planned     = ((sumP / n) - 128) / 128 * max;
  }
}
