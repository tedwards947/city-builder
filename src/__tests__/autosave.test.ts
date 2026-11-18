import { describe, it, expect, vi } from 'vitest';
import { Autosave, AUTOSAVE_SLOT, AUTOSAVE_NAME } from '../persistence/Autosave';
import { World } from '../sim/World';

function setup(intervalMs = 1000) {
  const world = new World(16, 16, 1);
  const saves: Array<{ slot: number; name?: string }> = [];
  let release: (() => void) | null = null;
  const target = {
    hold: false,
    fail: false,
    saveGame(_w: World, slot: number, name?: string): Promise<void> {
      if (this.fail) return Promise.reject(new Error('disk full'));
      saves.push({ slot, name });
      if (!this.hold) return Promise.resolve();
      return new Promise<void>(res => { release = res; });
    },
  };
  const auto = new Autosave(target, () => world, intervalMs);
  return { auto, target, saves, releaseSave: () => release?.() };
}

const flush = () => new Promise<void>(res => setTimeout(res, 0));

describe('Autosave', () => {
  it('saves to the autosave slot once the interval has elapsed', async () => {
    const { auto, saves } = setup(1000);
    auto.tick(0, false);
    auto.tick(999, false);
    expect(saves.length).toBe(0);
    auto.tick(1000, false);
    await flush();
    expect(saves).toEqual([{ slot: AUTOSAVE_SLOT, name: AUTOSAVE_NAME }]);
    // Interval restarts after a save.
    auto.tick(1500, false);
    await flush();
    expect(saves.length).toBe(1);
    auto.tick(2000, false);
    await flush();
    expect(saves.length).toBe(2);
  });

  it('does not count paused time', async () => {
    const { auto, saves } = setup(1000);
    auto.tick(0, false);
    auto.tick(600, false);
    auto.tick(5000, true);   // paused for a long while
    auto.tick(5300, false);  // 600 + 300 unpaused
    await flush();
    expect(saves.length).toBe(0);
    auto.tick(5400, false);
    await flush();
    expect(saves.length).toBe(1);
  });

it('does not count time away in a hidden tab (no second save on coming back)', async () => {
    // The game saves as the tab hides; frames then stop until it is shown again.
    const { auto, saves } = setup(60_000);
    auto.tick(0, false);
    auto.tick(16, false);
    await auto.saveNow();                     // tab hidden
    expect(saves.length).toBe(1);
    auto.tick(10 * 60_000, false);            // first frame back, ten minutes later
    await flush();
    expect(saves.length).toBe(1);
    // Ordinary play still reaches the interval.
    for (let t = 10 * 60_000 + 1000; t <= 11 * 60_000 + 1000; t += 1000) auto.tick(t, false);
    await flush();
    expect(saves.length).toBe(2);
  });

  it('skips while a save is already in flight', async () => {
    const { auto, target, saves, releaseSave } = setup(1000);
    target.hold = true;
    const first = auto.saveNow();
    expect(auto.isSaving).toBe(true);
    expect(await auto.saveNow()).toBe(false);
    expect(saves.length).toBe(1);
    releaseSave();
    expect(await first).toBe(true);
    expect(auto.isSaving).toBe(false);
  });

  it('never throws or rejects when the save fails', async () => {
    const { auto, target } = setup(1000);
    target.fail = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(auto.saveNow()).resolves.toBe(false);
    auto.tick(0, false);
    expect(() => auto.tick(5000, false)).not.toThrow();
    await flush();
    expect(auto.isSaving).toBe(false);
    warn.mockRestore();
  });

  it('reset restarts the interval', async () => {
    const { auto, saves } = setup(1000);
    auto.tick(0, false);
    auto.tick(900, false);
    auto.reset();
    auto.tick(1100, false);
    await flush();
    expect(saves.length).toBe(0);
  });

  it('reports a failed save once per run of failures, and again after a success', async () => {
    const world = new World(16, 16, 1);
    let fail = true;
    const target = { saveGame: () => (fail ? Promise.reject(new Error('quota')) : Promise.resolve()) };
    const onFailure = vi.fn();
    const auto = new Autosave(target, () => world, 1000, onFailure);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await auto.saveNow()).toBe(false);
    expect(await auto.saveNow()).toBe(false);
    expect(onFailure).toHaveBeenCalledTimes(1);
    fail = false;
    expect(await auto.saveNow()).toBe(true);
    fail = true;
    await auto.saveNow();
    expect(onFailure).toHaveBeenCalledTimes(2);
  });
});
