import type { World } from '../World';
import {
  ZONE_R, ZONE_C, ZONE_I,
  BUILDING_POWER_PLANT, BUILDING_LARGE_POWER_PLANT,
  BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL, BUILDING_PARK,
} from '../constants';
import { BALANCE } from '../../data/balance';
import { FieldBounds, growRect } from '../FieldBounds';
import { vibeTargets, type VibeTargets } from '../vibeTargets';

type VibeLayer = 'vibeEgalitarian' | 'vibeGreen' | 'vibePlanned';
const VIBE_LAYERS: readonly VibeLayer[] = ['vibeEgalitarian', 'vibeGreen', 'vibePlanned'];
const NEUTRAL = 128;

/**
 * VibeSystem — manages localized neighborhood vibes.
 * Transitions from global city-wide character to spatial layers.
 *
 * Nudges: player actions push the acted-on tile along an axis. Nudge sizes are
 * the "points" in BALANCE.character.nudges, converted to byte units by
 * BALANCE.vibe.nudgeByteScale and capped at ±BALANCE.vibe.nudgeMaxBytes, so a
 * single action moves a tile by a few to a few dozen units and never saturates it.
 * Diffusion then spreads the value to neighbours and decay pulls it back to 128.
 */
/** Even without a diffusion pass or a nudge, the city-wide averages are re-read this often. */
const AXES_REFRESH_TICKS = 64;

export class VibeSystem {
  private registeredWorld: World | null = null;
  // Scratch buffer reused across layers and runs (avoids per-run allocation).
  private _buf: Uint8Array = new Uint8Array(0);
  // Where each vibe layer is away from neutral (128). Diffusion and the
  // city-wide averages work on these rectangles instead of the whole map;
  // everything outside is exactly neutral, so the results are the same.
  private readonly _live: Record<VibeLayer, FieldBounds> = {
    vibeEgalitarian: new FieldBounds(), vibeGreen: new FieldBounds(), vibePlanned: new FieldBounds(),
  };

  // Target mode (BALANCE.vibe.mode 'target'): each layer at full precision, the targets, and the day they were
  // worked out. Null until the first pass on a world (and again for a new one).
  private _t: { shadow: Record<VibeLayer, Float32Array>; targets: VibeTargets | null; day: number } | null = null;

  // The city-wide averages only change when a layer does: on a diffusion tick, or after a nudge.
  // True to start with (and for a new world), so the first update always works them out.
  private _axesStale = true;

  /** Call after writing a vibe layer directly (not through a nudge), so the city-wide averages follow at once. */
  invalidateAxes(): void { this._axesStale = true; }

  update(world: World): void {
    if (world !== this.registeredWorld) {
      this._register(world);
      this._axesStale = true;
    }
    
    // Slow spatial diffusion and decay; or, in target mode, each tile easing toward what stands around it.
    const diffused = BALANCE.vibe.mode === 'target' ? this._targetPass(world) : this._simulateSpatialVibes(world);
    
    // Legacy global axes (averaged from layers for global logic)
    // The periodic refresh bounds how long a write that bypassed this system can go unseen.
    if (diffused || this._axesStale || world.tick % AXES_REFRESH_TICKS === 0) {
      this._updateGlobalAxes(world);
      this._axesStale = false;
    }
  }

  /**
   * Performs an initial city-wide scan to seed localized vibes based on existing 
   * infrastructure. Useful for migrating older save files.
   */
  bootstrapVibes(world: World): void {
    const { width, height } = world.grid;
    const n = width * height;
    const l = world.layers;
    const nudges = BALANCE.character.nudges;
    
    for (let i = 0; i < n; i++) {
        const tx = i % width;
        const ty = Math.floor(i / width);
        const zone = l.zone[i];
        const kind = l.building[i];
        
        if (zone === ZONE_R) {
            this._spatialNudge(world, tx, ty, 'vibeGreen', nudges.green.residentialZone);
        } else if (zone === ZONE_I) {
            this._spatialNudge(world, tx, ty, 'vibeGreen', nudges.green.industrialZone);
        } else if (kind === BUILDING_PARK) {
            this._spatialNudge(world, tx, ty, 'vibeGreen', nudges.green.parkBuilt);
            this._spatialNudge(world, tx, ty, 'vibeEgalitarian', nudges.egalitarian.parkBuilt);
        }
    }
    
    // Run several diffusion passes to smooth out the initial seeding
    // (diffusion only — bootstrapping should not consume rng or decay the seeds).
    for (let i = 0; i < 5; i++) {
        this._diffuse(world, false);
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _register(world: World): void {
    this.registeredWorld = world;
    this._t = null;
    const ev = world.events;
    const n = BALANCE.character.nudges;

    ev.on('zonePainted', (p) => {
      const tx = p.tx as number;
      const ty = p.ty as number;
      const zone = p.zone as number;
      const displaced = (p.displacedPopulation as number) || 0;

      if (zone === ZONE_R) {
        this._spatialNudge(world, tx, ty, 'vibeEgalitarian', n.egalitarian.residentialZone);
        this._spatialNudge(world, tx, ty, 'vibeGreen',       n.green.residentialZone);
        this._spatialNudge(world, tx, ty, 'vibePlanned',     n.planned.residentialZone);
      } else if (zone === ZONE_C) {
        this._spatialNudge(world, tx, ty, 'vibeGreen',       n.green.commercialZone);
      } else if (zone === ZONE_I) {
        this._spatialNudge(world, tx, ty, 'vibeEgalitarian', n.egalitarian.industrialZone);
        this._spatialNudge(world, tx, ty, 'vibeGreen',       n.green.industrialZone);
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
      this._spatialNudge(world, tx, ty, 'vibePlanned', n.planned.roadBuilt);
    });

    // The tree brush and eraser: each tree nudges its own tile along the green axis.
    const trees = (points: () => number) => (p: Record<string, unknown>) => {
      const pts = points();
      if (pts === 0) return;
      const { width } = world.grid;
      for (const i of p.tiles as number[]) this._spatialNudge(world, i % width, (i - (i % width)) / width, 'vibeGreen', pts);
    };
    ev.on('treesPlanted', trees(() => n.green.treePlanted));
    ev.on('treesCleared', trees(() => n.green.treeCleared));

    ev.on('buildingPlaced', (p) => {
      const tx = p.tx as number;
      const ty = p.ty as number;
      const kind = p.kind as number;
      if (kind === BUILDING_PARK) {
        this._spatialNudge(world, tx, ty, 'vibeEgalitarian', n.egalitarian.parkBuilt);
        this._spatialNudge(world, tx, ty, 'vibeGreen',       n.green.parkBuilt);
        this._spatialNudge(world, tx, ty, 'vibePlanned',     n.planned.serviceBuilt);
      } else if ([BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL].includes(kind)) {
        this._spatialNudge(world, tx, ty, 'vibeEgalitarian', n.egalitarian.serviceBuilt);
        this._spatialNudge(world, tx, ty, 'vibePlanned',     n.planned.serviceBuilt);
      } else if (kind === BUILDING_POWER_PLANT || kind === BUILDING_LARGE_POWER_PLANT) {
        this._spatialNudge(world, tx, ty, 'vibeGreen', n.green.powerPlantBuilt);
      }
    });
  }

  /**
   * Moves one tile along a vibe axis.
   * `points` is in BALANCE.character.nudges units (positive = egalitarian /
   * green / planned). It is scaled to bytes, capped, and always moves at least
   * 1 unit so small nudges are not rounded away.
   */
  private _spatialNudge(world: World, tx: number, ty: number, layer: VibeLayer, points: number): void {
    if (points === 0) return;
    const { nudgeByteScale, nudgeMaxBytes } = BALANCE.vibe;
    const magnitude = Math.min(nudgeMaxBytes, Math.max(1, Math.round(Math.abs(points) * nudgeByteScale)));
    const byteDelta = Math.sign(points) * magnitude;
    const i = world.grid.idx(tx, ty);
    const current = world.layers[layer][i];
    world.layers[layer][i] = Math.max(0, Math.min(255, current + byteDelta));
    if (this._t) this._t.shadow[layer][i] = Math.max(0, Math.min(255, this._t.shadow[layer][i] + byteDelta));
    this._axesStale = true;
    world.grid.markDirty(tx, ty);
  }

  /**
   * Target mode, every simInterval ticks (owner 2026-11-23): no decay and no blur. Each tile eases toward its
   * target (sim/vibeTargets.ts, refreshed every targetEveryDays) with a half-life of targetHalfLifeDays, kept at
   * full precision so nothing rounds away. A nudge bumps a tile and then eases back to what its place is. A
   * city whose layers are as good as neutral (left by the legacy mode, or new) starts at its targets. Returns whether
   * a pass ran.
   */
  private _targetPass(world: World): boolean {
    const V = BALANCE.vibe;
    if (world.tick % V.simInterval !== 0) return false;
    const n = world.grid.width * world.grid.height, day = Math.floor(world.tick / BALANCE.ticksPerDay);
    let snap = false;
    if (!this._t || this._t.shadow.vibeGreen.length !== n) {
      const shadow = {} as Record<VibeLayer, Float32Array>;
      for (const name of VIBE_LAYERS) shadow[name] = Float32Array.from(world.layers[name]);
      this._t = { shadow, targets: null, day: -Infinity };
      // Layers left by the legacy mode (or a new city) are as good as neutral: start at the targets.
      let far = 0;
      for (const name of VIBE_LAYERS) for (const v of world.layers[name]) if (Math.abs(v - NEUTRAL) > 8) far++;
      snap = far < 0.02 * n * VIBE_LAYERS.length;
    }
    const t = this._t;
    if (!t.targets || day - t.day >= V.targetEveryDays) { t.targets = vibeTargets(world); t.day = day; }
    const rate = snap ? 1 : 1 - Math.pow(0.5, V.simInterval / (V.targetHalfLifeDays * BALANCE.ticksPerDay));
    const target: Record<VibeLayer, Uint8Array> = { vibeEgalitarian: t.targets.egalitarian, vibeGreen: t.targets.green, vibePlanned: t.targets.planned };
    let changed = false;
    for (const name of VIBE_LAYERS) {
      const s = t.shadow[name], goal = target[name], layer = world.layers[name];
      for (let i = 0; i < n; i++) {
        const v = s[i] + (goal[i] - s[i]) * rate;
        s[i] = v;
        const b = Math.round(v);
        if (b !== layer[i]) { layer[i] = b; changed = true; }
      }
    }
    if (changed) world.grid.markAllDirty();
    return changed;
  }

  /** Returns whether a diffusion pass ran. */
  private _simulateSpatialVibes(world: World): boolean {
    // Spatial simulation runs at a slow cadence to save CPU.
    if (world.tick % BALANCE.vibe.simInterval !== 0) return false;
    this._diffuse(world, true);
    return true;
  }

  /**
   * One diffusion pass over all three vibe layers; with `decay`, each
   * non-neutral tile then has a chance to step 1 unit toward 128.
   */
  private _diffuse(world: World, decay: boolean): void {
    const { width, height } = world.grid;
    const n = width * height;
    const decayProbability = BALANCE.vibe.decayProbability;
    if (this._buf.length !== n) this._buf = new Uint8Array(n);
    const next = this._buf;

    for (const name of VIBE_LAYERS) {
      const layer = world.layers[name];
      const live = this._live[name];
      live.scan(layer, width, NEUTRAL);
      // An all-neutral layer diffuses to itself and never rolls for decay.
      if (live.empty) continue;
      // One diffusion step can reach one tile beyond where the layer is live.
      const work = growRect(live.rect(), width, height, 1);

      for (let y = work.y0; y <= work.y1; y++) {
        for (let x = work.x0; x <= work.x1; x++) {
          const i = y * width + x;

          // 1. Diffusion (weighted average with cardinal neighbours)
          let sum = layer[i] * 4;
          let count = 4;
          if (x > 0) { sum += layer[i - 1]; count++; }
          if (x < width - 1) { sum += layer[i + 1]; count++; }
          if (y > 0) { sum += layer[i - width]; count++; }
          if (y < height - 1) { sum += layer[i + width]; count++; }

          let val = Math.round(sum / count);

          // 2. Decay toward 128 (neutral): integer step gated by a roll.
          if (decay && val !== NEUTRAL && world.rng() < decayProbability) {
            val += val > NEUTRAL ? -1 : 1;
          }

          next[i] = val;
        }
      }
      for (let y = work.y0; y <= work.y1; y++) {
        const a = y * width + work.x0, b = y * width + work.x1 + 1;
        layer.set(next.subarray(a, b), a);
      }
    }
    world.grid.markAllDirty();
  }

  private _updateGlobalAxes(world: World): void {
    // Averaging the entire map for global stats/legacy logic. Tiles outside a
    // layer's live rectangle are exactly neutral, so they are counted without
    // being visited.
    const { width } = world.grid;
    const n = width * world.grid.height;
    const sums = [0, 0, 0];
    for (let k = 0; k < VIBE_LAYERS.length; k++) {
      const layer = world.layers[VIBE_LAYERS[k]];
      const live = this._live[VIBE_LAYERS[k]];
      live.scan(layer, width, NEUTRAL);
      const inside = live.tileCount;
      let sum = 0;
      if (!live.empty) {
        for (let y = live.y0; y <= live.y1; y++) {
          for (let i = y * width + live.x0, rowEnd = y * width + live.x1; i <= rowEnd; i++) sum += layer[i];
        }
      }
      sums[k] = sum + (n - inside) * NEUTRAL;
    }
    const [sumE, sumG, sumP] = sums;

    const max = BALANCE.character.axisMax;
    world.character.egalitarian = ((sumE / n) - 128) / 128 * max;
    world.character.green       = ((sumG / n) - 128) / 128 * max;
    world.character.planned     = ((sumP / n) - 128) / 128 * max;
  }
}
