// VehicleLayer — purely cosmetic moving vehicles on road tiles.
//
// The simulation is correct with zero vehicles. This layer reads world state
// (roadClass, congestion) but never writes to it. Vehicles are capped at
// BALANCE.agents.maxVehicles; the cap can be raised or lowered without any
// effect on gameplay.
//
// Movement:
//   Each vehicle holds a current tile, a next tile, and a progress value
//   [0,1]. Each frame it advances progress by speed*dt. On arrival it picks
//   a random adjacent road tile, avoiding immediate u-turns unless forced.
//   Speed is reduced proportionally to local congestion.
//
// Spawning:
//   A spawn timer fires every spawnInterval seconds. On each attempt we
//   sample up to 40 random tiles looking for a road tile with at least one
//   road neighbour (so vehicles can actually move). If one is found we
//   spawn a vehicle with a random TTL and a random colour from a small palette.

import type { World } from '../sim/World';
import type { Camera } from './Camera';
import { TILE_SIZE } from './Projection';
import { ROAD_NONE } from '../sim/constants';
import { BALANCE } from '../data/balance';
import type { Grid } from '../sim/Grid';

const CAR_COLORS = [
  '#e8e8e0', // white
  '#c8c8b0', // cream
  '#5080c8', // blue
  '#c84030', // red
  '#44aa44', // green
  '#909090', // silver
  '#e0c040', // yellow
  '#303030', // dark
];

interface Vehicle {
  tx: number; ty: number;    // current tile (integers)
  ntx: number; nty: number;  // next tile
  ptx: number; pty: number;  // previous tile (prevents immediate u-turn)
  progress: number;          // 0..1 — fraction of way from current to next
  speed: number;             // tiles per second
  ttl: number;               // seconds remaining
  colorIdx: number;
}

export class VehicleLayer {
  private vehicles: Vehicle[] = [];
  private spawnTimer = 0;

  /** Call when a new game is loaded — clears all vehicles. */
  reset(): void {
    this.vehicles = [];
    this.spawnTimer = 0;
  }

  /** Call every animation frame with elapsed seconds. */
  update(dt: number, world: World): void {
    // Guard against stalls (tab hidden, etc.)
    if (dt > 0.25) return;

    const { roadClass, congestion } = world.layers;
    const { width, height } = world.grid;
    const cfg = BALANCE.agents;

    // ── Move existing vehicles ───────────────────────────────────────────
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      v.ttl -= dt;
      if (v.ttl <= 0) { this.vehicles.splice(i, 1); continue; }

      v.progress += v.speed * dt;

      if (v.progress >= 1) {
        v.progress -= 1;

        // Arrive at next tile
        v.ptx = v.tx;  v.pty = v.ty;
        v.tx  = v.ntx; v.ty  = v.nty;

        // Recompute speed from local congestion and road class
        const idx        = v.ty * width + v.tx;
        const cong       = congestion[idx] / 255;
        const classMult  = BALANCE.roadClasses[roadClass[idx]]?.speedMult ?? 1.0;
        v.speed = cfg.baseSpeed * classMult * (1 - cong * 0.65);

        // Pick next tile (no u-turn unless forced)
        const next = pickNext(roadClass, width, height, v.tx, v.ty, v.ptx, v.pty);
        v.ntx = next.tx;
        v.nty = next.ty;
      }
    }

    // ── Spawn ────────────────────────────────────────────────────────────
    if (this.vehicles.length < cfg.maxVehicles) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = cfg.spawnInterval;
        trySpawn(world, this.vehicles, cfg);
      }
    }
  }

  /** Call after the main CanvasRenderer.render() so vehicles appear on top. */
  render(ctx: CanvasRenderingContext2D, camera: Camera, grid: Grid): void {
    const ts = TILE_SIZE * camera.zoom;
    if (ts < 3) return; // invisible at low zoom — skip

    const bounds = camera.visibleTileBounds(grid);
    const size   = Math.max(2, Math.floor(ts * 0.25));

    for (const v of this.vehicles) {
      // Quick cull: if both tiles are outside the visible bounds, skip.
      const minX = v.tx < v.ntx ? v.tx : v.ntx;
      const maxX = v.tx > v.ntx ? v.tx : v.ntx;
      const minY = v.ty < v.nty ? v.ty : v.nty;
      const maxY = v.ty > v.nty ? v.ty : v.nty;
      if (maxX < bounds.x0 || minX > bounds.x1 || maxY < bounds.y0 || minY > bounds.y1) continue;

      // Interpolate world-space tile centre between current and next tile.
      const wx = (v.tx + 0.5 + (v.ntx - v.tx) * v.progress) * TILE_SIZE;
      const wy = (v.ty + 0.5 + (v.nty - v.ty) * v.progress) * TILE_SIZE;
      const { sx, sy } = camera.worldToScreen(wx, wy);

      ctx.fillStyle = CAR_COLORS[v.colorIdx];
      ctx.fillRect(Math.floor(sx - size / 2), Math.floor(sy - size / 2), size, size);
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pickNext(
  roadClass: Uint8Array, width: number, height: number,
  tx: number, ty: number, ptx: number, pty: number,
): { tx: number; ty: number } {
  const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
  const options: { tx: number; ty: number }[] = [];

  for (const { dx, dy } of dirs) {
    const nx = tx + dx, ny = ty + dy;
    if (nx === ptx && ny === pty) continue;           // avoid immediate u-turn
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
    if (roadClass[ny * width + nx] !== ROAD_NONE) options.push({ tx: nx, ty: ny });
  }

  if (options.length === 0) {
    // Dead end — u-turn back (ptx/pty may equal tx/ty on first move; handle gracefully)
    return ptx !== tx || pty !== ty ? { tx: ptx, ty: pty } : { tx, ty };
  }

  return options[Math.floor(Math.random() * options.length)];
}

function trySpawn(
  world: World,
  vehicles: Vehicle[],
  cfg: typeof BALANCE.agents,
): void {
  const { roadClass, congestion } = world.layers;
  const { width, height } = world.grid;
  const n = width * height;

  for (let attempt = 0; attempt < 40; attempt++) {
    const idx = Math.floor(Math.random() * n);
    if (roadClass[idx] === ROAD_NONE) continue;

    const tx = idx % width;
    const ty = Math.floor(idx / width);

    // Require at least one adjacent road so the vehicle can actually move.
    const next = pickNext(roadClass, width, height, tx, ty, tx, ty);
    if (next.tx === tx && next.ty === ty) continue; // isolated tile

    const cong       = congestion[idx] / 255;
    const classMult  = BALANCE.roadClasses[roadClass[idx]]?.speedMult ?? 1.0;
    const speed = cfg.baseSpeed * classMult * (1 - cong * 0.65);
    const ttl   = cfg.minTtl + Math.random() * (cfg.maxTtl - cfg.minTtl);

    vehicles.push({
      tx, ty,
      ntx: next.tx, nty: next.ty,
      ptx: tx, pty: ty,
      progress: Math.random(), // start partway through segment for visual variety
      speed,
      ttl,
      colorIdx: Math.floor(Math.random() * CAR_COLORS.length),
    });
    return;
  }
}
