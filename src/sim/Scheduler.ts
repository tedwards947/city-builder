// Fixed-rate sim tick loop, decoupled from rendering.
// Rendering runs at display refresh. Sim runs at a fixed tick rate scaled by
// the speed multiplier (0=paused, 1/2/3 = 1×/2×/3×).

import type { World } from './World';

export interface System {
  update(world: World): void;
}

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
    const dt = now - this.lastTime;
    this.lastTime = now;
    if (this.speed === 0) return;
    this.accumulator += dt * this.speed;
    let ticks = 0;
    while (this.accumulator >= this.baseTickMs && ticks < 10) {
      this.accumulator -= this.baseTickMs;
      this._tick();
      ticks++;
    }
  }

  private _tick(): void {
    this.world.tick++;
    for (const sys of this.systems) sys.update(this.world);
  }
}
