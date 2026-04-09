// Water distribution.
// Towers energize adjacent road tiles. Water flows along connected roads
// (same road network component). Water then radiates one tile off any
// serviced road — so zones adjacent to a serviced road receive water.
// Mirrors PowerSystem exactly, using waterTowers instead of powerPlants.

import { World } from '../World';
import { ROAD_NONE, ROAD_HIGHWAY, ZONE_NONE, BUILDING_WATER_TOWER } from '../constants';
import { BALANCE } from '../../data/balance';

export class WaterSystem {
  private _inShortage = false;

  update(world: World): void {
    const { width, height } = world.grid;
    const water = world.layers.water;
    const roadClass = world.layers.roadClass;
    const roadNet = world.layers.roadNet;
    water.fill(0);

    // 1. Determine which road networks have at least one water tower.
    // Towers must be adjacent to a STREET or AVENUE to connect.
    const servicedNetworks = new Set<number>();
    let totalSupply = 0;
    for (const b of world.buildings) {
      if (b.kind !== BUILDING_WATER_TOWER) continue;
      
      let connected = false;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
        const nx = b.tx + dx, ny = b.ty + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        const rc = roadClass[ni];
        if (rc !== ROAD_NONE && rc !== ROAD_HIGHWAY) {
          servicedNetworks.add(roadNet[ni]);
          connected = true;
        }
      }

      if (connected) {
        totalSupply += BALANCE.water.towerOutput;
        water[b.ty * width + b.tx] = 1;
      }
    }

    // 2. Mark all tiles on serviced road networks as having water.
    if (servicedNetworks.size > 0) {
      for (let i = 0; i < width * height; i++) {
        if (roadClass[i] !== ROAD_NONE && servicedNetworks.has(roadNet[i])) {
          water[i] = 1;
        }
      }
    }

    // 3. Radiate one tile off serviced roads to adjacent zone tiles.
    const range = BALANCE.water.propagationRange;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (water[i]) continue;
        let found = false;
        outer: for (let dy = -range; dy <= range; dy++) {
          for (let dx = -range; dx <= range; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const ni = ny * width + nx;
            if (roadClass[ni] !== ROAD_NONE && water[ni] === 1) { found = true; break outer; }
          }
        }
        if (found) water[i] = 1;
      }
    }

    // Compute demand from developed zones (abandoned tiles consume nothing).
    let totalDemand = 0;
    const devLevel = world.layers.devLevel;
    const zone = world.layers.zone;
    const abandoned = world.layers.abandoned;
    for (let i = 0; i < width * height; i++) {
      if (zone[i] !== ZONE_NONE && devLevel[i] > 0 && abandoned[i] === 0) {
        totalDemand += devLevel[i] * BALANCE.water.perDevLevel;
      }
    }
    world.stats.waterSupply = totalSupply;
    world.stats.waterDemand = totalDemand;

    const shortage = totalDemand > totalSupply;
    if (shortage && !this._inShortage) {
      world.events.emit('waterShortage', { supply: totalSupply, demand: totalDemand, deficit: totalDemand - totalSupply });
    } else if (!shortage && this._inShortage) {
      world.events.emit('waterRestored', { supply: totalSupply, demand: totalDemand });
    }
    this._inShortage = shortage;

    world.grid.markAllDirty();
  }
}
