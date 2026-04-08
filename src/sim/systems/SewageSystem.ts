// Sewage treatment coverage.
// Plants energize adjacent road tiles. Sewage coverage flows along connected
// roads (same road network component) and radiates one tile off serviced roads.
// Mirrors WaterSystem / PowerSystem exactly, using sewagePlants.

import { World } from '../World';
import { ROAD_NONE, ZONE_NONE, BUILDING_SEWAGE_PLANT } from '../constants';
import { BALANCE } from '../../data/balance';

export class SewageSystem {
  private _inShortage = false;

  update(world: World): void {
    const { width, height } = world.grid;
    const sewage = world.layers.sewage;
    const roadClass = world.layers.roadClass;
    const roadNet = world.layers.roadNet;
    sewage.fill(0);

    // 1. Determine which road networks have at least one sewage plant.
    const servicedNetworks = new Set<number>();
    let totalSupply = 0;
    for (const b of world.buildings) {
      if (b.kind !== BUILDING_SEWAGE_PLANT) continue;
      
      let connected = false;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
        const nx = b.tx + dx, ny = b.ty + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (roadClass[ni] !== ROAD_NONE) {
          servicedNetworks.add(roadNet[ni]);
          connected = true;
        }
      }

      if (connected) {
        totalSupply += BALANCE.sewage.plantOutput;
        sewage[b.ty * width + b.tx] = 1;
      }
    }

    // 2. Mark all tiles on serviced road networks as having sewage coverage.
    if (servicedNetworks.size > 0) {
      for (let i = 0; i < width * height; i++) {
        if (roadClass[i] !== ROAD_NONE && servicedNetworks.has(roadNet[i])) {
          sewage[i] = 1;
        }
      }
    }

    // 3. Radiate one tile off serviced roads to adjacent zone tiles.
    const range = BALANCE.sewage.propagationRange;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (sewage[i]) continue;
        let found = false;
        outer: for (let dy = -range; dy <= range; dy++) {
          for (let dx = -range; dx <= range; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const ni = ny * width + nx;
            if (roadClass[ni] !== ROAD_NONE && sewage[ni] === 1) { found = true; break outer; }
          }
        }
        if (found) sewage[i] = 1;
      }
    }

    // Compute demand from high-density developed zones (abandoned tiles consume nothing).
    let totalDemand = 0;
    const devLevel = world.layers.devLevel;
    const zone = world.layers.zone;
    const abandoned = world.layers.abandoned;
    for (let i = 0; i < width * height; i++) {
      if (zone[i] !== ZONE_NONE && devLevel[i] >= 2 && abandoned[i] === 0) {
        totalDemand += devLevel[i] * BALANCE.sewage.perDevLevel;
      }
    }
    world.stats.sewageSupply = totalSupply;
    world.stats.sewageDemand = totalDemand;

    const shortage = totalDemand > totalSupply;
    if (shortage && !this._inShortage) {
      world.events.emit('sewageShortage', { supply: totalSupply, demand: totalDemand, deficit: totalDemand - totalSupply });
    } else if (!shortage && this._inShortage) {
      world.events.emit('sewageRestored', { supply: totalSupply, demand: totalDemand });
    }
    this._inShortage = shortage;

    world.grid.markAllDirty();
  }
}
