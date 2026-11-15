import { describe, it, expect } from 'vitest';
import { Scheduler, MAX_FRAME_GAP_MS } from '../sim/Scheduler';
import type { World } from '../sim/World';

function makeScheduler(speed = 1) {
  const world = { tick: 0 } as World;
  const scheduler = new Scheduler(world, [], 500);
  scheduler.setSpeed(speed);
  return { world, scheduler, start: performance.now() };
}

describe('Scheduler', () => {
  it('ticks at the base rate during steady frames', () => {
    const { world, scheduler, start } = makeScheduler();
    for (let t = 16; t <= 2100; t += 16) scheduler.update(start + t);
    expect(world.tick).toBe(4);
  });

  it('does not queue a backlog after a long gap (tab hidden)', () => {
    const { world, scheduler, start } = makeScheduler(3);
    // Ten minutes away, then one frame back.
    const back = start + 10 * 60 * 1000;
    scheduler.update(back);
    expect(world.tick).toBeLessThanOrEqual(Math.ceil((MAX_FRAME_GAP_MS * 3) / 500));

    // The following second of normal frames runs a normal second of sim.
    const before = world.tick;
    for (let t = 16; t <= 1000; t += 16) scheduler.update(back + t);
    expect(world.tick - before).toBeLessThanOrEqual(6);
  });
});
