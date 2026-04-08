// Power propagation.
// Plants energize adjacent road tiles. Power flows along connected roads
// (same road network component). Power then radiates one tile off any
// powered road — so zones adjacent to a powered road receive power.

import { World } from '../World';
import { ROAD_NONE, ZONE_NONE, BUILDING_POWER_PLANT } from '../constants';
import { BALANCE } from '../../data/balance';

export class PowerSystem {
  private _inShortage = false;

  update(world: World): void {
    const { width, height } = world.grid;
    const power = world.layers.power;
    const roadClass = world.layers.roadClass;
    const roadNet = world.layers.roadNet;
    power.fill(0);

    // 1. Determine which road networks have at least one power plant.
    const poweredNetworks = new Set<number>();
    let totalSupply = 0;
    for (const b of world.buildings) {
      if (b.kind !== BUILDING_POWER_PLANT) continue;
      totalSupply += BALANCE.power.plantOutput;
      power[b.ty * width + b.tx] = 1;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
        const nx = b.tx + dx, ny = b.ty + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (roadClass[ni] !== ROAD_NONE) poweredNetworks.add(roadNet[ni]);
      }
    }

    // 2. Mark all tiles on powered road networks as powered.
    if (poweredNetworks.size > 0) {
      for (let i = 0; i < width * height; i++) {
        if (roadClass[i] !== ROAD_NONE && poweredNetworks.has(roadNet[i])) {
          power[i] = 1;
        }
      }
    }

    // 3. Radiate one tile off powered roads to adjacent zone tiles.
    const range = BALANCE.power.propagationRange;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (power[i]) continue;
        let found = false;
        outer: for (let dy = -range; dy <= range; dy++) {
          for (let dx = -range; dx <= range; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const ni = ny * width + nx;
            if (roadClass[ni] !== ROAD_NONE && power[ni] === 1) { found = true; break outer; }
          }
        }
        if (found) power[i] = 1;
      }
    }

    // Compute demand from developed zones (abandoned tiles consume nothing).
    let totalDemand = 0;
    const devLevel = world.layers.devLevel;
    const zone = world.layers.zone;
    const abandoned = world.layers.abandoned;
    for (let i = 0; i < width * height; i++) {
      if (zone[i] !== ZONE_NONE && devLevel[i] > 0 && abandoned[i] === 0) {
        totalDemand += devLevel[i] * BALANCE.power.perDevLevel;
      }
    }
    world.stats.powerSupply = totalSupply;
    world.stats.powerDemand = totalDemand;

    const shortage = totalDemand > totalSupply;
    if (shortage && !this._inShortage) {
      world.events.emit('powerShortage', { supply: totalSupply, demand: totalDemand, deficit: totalDemand - totalSupply });
    } else if (!shortage && this._inShortage) {
      world.events.emit('powerRestored', { supply: totalSupply, demand: totalDemand });
    }
    this._inShortage = shortage;

    // Mark all chunks dirty — power state changed across many tiles.
    world.grid.markAllDirty();
  }
}
