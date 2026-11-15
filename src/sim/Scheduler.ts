// Fixed-rate sim tick loop, decoupled from rendering.
// Rendering runs at display refresh. Sim runs at a fixed tick rate scaled by
// the speed multiplier (0=paused, 1/2/3 = 1×/2×/3×).

import type { World } from './World';

export interface System {
  update(world: World): void;
}

/** Longest real-time gap between frames that is credited to the sim. */
export const MAX_FRAME_GAP_MS = 250;

export class Scheduler {
  private readonly world: World;
  private readonly systems: System[];
  readonly baseTickMs: number;
  private accumulator = 0;
  private lastTime = performance.now();
  speed = 1;

  constructor(world: World, systems: System[], baseTickMs = 500) {
    this.world = world;
    this.systems = systems;
    this.baseTickMs = baseTickMs;
  }

  setSpeed(s: number): void {
    this.speed = s;
    this.accumulator = 0;
    this.lastTime = performance.now();
  }

  update(now: number): void {
    // Clamp the frame gap. requestAnimationFrame stops while the tab is hidden,
    // so the first frame back sees the whole absence as one dt; unclamped, that
    // queues minutes of ticks which then drain at 10 per frame and stall
    // rendering. Time spent hidden (or in a long hitch) is simply not simulated.
    const dt = Math.min(now - this.lastTime, MAX_FRAME_GAP_MS);
    this.lastTime = now;
    if (this.speed === 0) return;
    this.accumulator += dt * this.speed;
    let ticks = 0;
    while (this.accumulator >= this.baseTickMs && ticks < 10) {
      this.accumulator -= this.baseTickMs;
      this.tick();
      ticks++;
    }
  }

  /** Run one sim tick now, whatever the clock or speed says (tests and benchmarks). */
  tick(): void {
    this.world.tick++;
    // One scan of the map for the whole tick; every system shares it.
    this.world.pinIndex();
    try {
      for (const sys of this.systems) sys.update(this.world);
    } finally {
      this.world.unpinIndex();
    }
  }
}
