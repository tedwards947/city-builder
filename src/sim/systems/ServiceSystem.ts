// Service coverage system.
// Police stations, fire stations, schools, hospitals, and parks each radiate
// direct radius coverage (no road network required — different from power/water).
// Any covered developed tile has services[i] = 1.
// ServiceSystem runs before ZoneGrowthSystem so it can gate level 2→3 growth.

import { World } from '../World';
import { ZONE_NONE } from '../constants';
import { BALANCE } from '../../data/balance';

export class ServiceSystem {
  update(world: World): void {
    const { width, height } = world.grid;
    const services = world.layers.services;
    services.fill(0);

    for (const b of world.serviceBuildings) {
      const range = BALANCE.service.coverageRange[b.kind] ?? 4;
      for (let dy = -range; dy <= range; dy++) {
        for (let dx = -range; dx <= range; dx++) {
          // Manhattan distance coverage
          if (Math.abs(dx) + Math.abs(dy) > range) continue;
          const nx = b.tx + dx, ny = b.ty + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          services[ny * width + nx] = 1;
        }
      }
    }

    // Count covered developed zones for HUD stat.
    const zone = world.layers.zone;
    const dev = world.layers.devLevel;
    let covered = 0;
    for (let i = 0; i < width * height; i++) {
      if (zone[i] !== ZONE_NONE && dev[i] > 0 && services[i] === 1) covered++;
    }
    world.stats.servicesCoveredZones = covered;
  }
}
