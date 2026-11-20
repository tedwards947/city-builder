// Abandonment system.
// Tracks distress per developed zone tile. When a tile's distress accumulates
// past the threshold, it becomes permanently abandoned: no income, no population,
// no resource consumption, no growth. Abandonment can only be cleared by bulldozing.
//
// Conditions checked here are placeholder scaffolding — future phases will add
// additional contributors (crime, fire damage, etc.) by incrementing distress[i]
// from their own systems before this system reads it.
//
// A merged 2×2 lot (sim/lots.ts) is one building and declines as one: it is
// judged once, at its anchor, on the worst of its four tiles (but a road
// beside any of them is a road to the building); all four carry the same
// distress and are abandoned together.

import { World } from '../World';
import { ZONE_NONE, ROAD_NONE, ROAD_HIGHWAY } from '../constants';
import { BALANCE } from '../../data/balance';

// What tileState reports about one tile.
const RESOURCES = 1;   // has power and water
const ROAD = 2;        // a street or avenue beside it (a highway gives no access)
const SEVERE = 4;      // severe crime, on fire, or severe fire risk
const ELEVATED = 8;    // crime above the distress threshold

const N4 = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;

function tileState(world: World, i: number): number {
  const { width } = world.grid;
  const { power, water, crime, fire, fireRisk, roadClass } = world.layers;
  let s = power[i] !== 0 && water[i] !== 0 ? RESOURCES : 0;
  // Road access check: direct adjacency required.
  const x = i % width, y = (i - x) / width;
  for (const [dx, dy] of N4) {
    const nx = x + dx, ny = y + dy;
    if (!world.grid.inBounds(nx, ny)) continue;
    const rc = roadClass[ny * width + nx];
    if (rc !== ROAD_NONE && rc !== ROAD_HIGHWAY) { s |= ROAD; break; }
  }
  if (crime[i] >= BALANCE.crime.abandonThreshold || fire[i] > 0 || fireRisk[i] >= BALANCE.fire.abandonThreshold) s |= SEVERE;
  if (crime[i] > BALANCE.crime.distressThreshold) s |= ELEVATED;
  return s;
}

export class AbandonmentSystem {
  update(world: World): void {
    if (world.tick % BALANCE.abandonment.distressInterval !== 0) return;

    const { width } = world.grid;
    const { zone, devLevel, abandoned, distress, lot } = world.layers;

    const area = world.index.area(world);
    for (let y = area.y0; y <= area.y1; y++) {
    for (let i = y * width + area.x0, rowEnd = y * width + area.x1; i <= rowEnd; i++) {
      // Skip already-abandoned tiles — abandonment is permanent until bulldozed.
      if (abandoned[i] !== 0) continue;

      // Only track developed zone tiles.
      if (zone[i] === ZONE_NONE || devLevel[i] === 0) {
        // Reset stale distress if zone was cleared externally.
        if (distress[i] !== 0) distress[i] = 0;
        continue;
      }

      // A merged lot is judged once, at its anchor (its NW tile, met first).
      if (lot[i] > 1) continue;
      const whole = lot[i] === 1 ? world.lotTilesAt(i) : null;
      let s: number;
      if (whole) {
        s = RESOURCES;
        for (const t of whole) {
          const ts = tileState(world, t);
          if ((ts & RESOURCES) === 0) s &= ~RESOURCES;
          s |= ts & (ROAD | SEVERE | ELEVATED);
        }
      } else {
        s = tileState(world, i);
      }

      const hasRoad = (s & ROAD) !== 0;
      const severe = (s & SEVERE) !== 0;
      const conditionsMet = (s & RESOURCES) !== 0 && hasRoad && !severe;

      let d = distress[i];
      if (!conditionsMet) {
        // Severe crime, fire, or no road adds 2 distress; missing resources 1.
        d = Math.min(255, d + (severe || !hasRoad ? 2 : 1));
      } else if ((s & ELEVATED) !== 0) {
        // Elevated crime (above distressThreshold but below abandonment)
        // adds distress slowly (only every 2nd system tick on avg).
        if (world.tick % (BALANCE.abandonment.distressInterval * 2) === 0) d = Math.min(255, d + 1);
      } else {
        // Conditions good — drain distress (building recovers before abandoning).
        if (d > 0) d--;
      }
      const gone = d >= BALANCE.abandonment.abandonThreshold;

      if (whole) {
        for (const t of whole) {
          distress[t] = d;
          if (gone) { abandoned[t] = 1; world.grid.markDirty(t % width, (t - (t % width)) / width); }
        }
      } else {
        distress[i] = d;
        if (gone) { abandoned[i] = 1; world.grid.markDirty(i % width, y); }
      }
      // One building, one event (at the anchor for a merged lot).
      if (gone) world.events.emit('tileAbandoned', { tx: i % width, ty: y, zone: zone[i], level: devLevel[i] });
    }
    }
  }
}
