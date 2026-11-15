// Periodic autosave to a dedicated slot.
// Driven from the frame loop via tick(now); never throws into the caller.

import type { World } from '../sim/World';

export const AUTOSAVE_SLOT = 0;
export const AUTOSAVE_NAME = 'Autosave';
export const AUTOSAVE_INTERVAL_MS = 60_000;

/** The slice of SaveManager that Autosave needs. */
export interface AutosaveTarget {
  saveGame(world: World, slot: number, name?: string): Promise<void>;
}

export class Autosave {
  private readonly target: AutosaveTarget;
  private readonly getWorld: () => World | null;
  private readonly intervalMs: number;
  // Unpaused real time accumulated since the last save.
  private elapsedMs = 0;
  private lastTickAt: number | null = null;
  private inFlight = false;

  constructor(target: AutosaveTarget, getWorld: () => World | null, intervalMs = AUTOSAVE_INTERVAL_MS) {
    this.target = target;
    this.getWorld = getWorld;
    this.intervalMs = intervalMs;
  }

  get isSaving(): boolean { return this.inFlight; }

  /** Restart the interval (call when a game starts or is loaded). */
  reset(): void {
    this.elapsedMs = 0;
  }

  /**
   * Call every frame. Saves once `intervalMs` of unpaused real time has
   * accumulated since the last save. Time spent paused does not count.
   */
  tick(now: number, paused: boolean): void {
    const dt = this.lastTickAt === null ? 0 : Math.max(0, now - this.lastTickAt);
    this.lastTickAt = now;
    if (paused) return;
    this.elapsedMs += dt;
    if (this.elapsedMs < this.intervalMs) return;
    void this.saveNow();
  }

  /**
   * Save immediately. Resolves true if a save was written, false if it was
   * skipped (one already in flight, no world) or failed. Never rejects.
   */
  async saveNow(): Promise<boolean> {
    if (this.inFlight) return false;
    let world: World | null;
    try {
      world = this.getWorld();
    } catch {
      return false;
    }
    if (!world) return false;
    this.inFlight = true;
    this.elapsedMs = 0;
    try {
      await this.target.saveGame(world, AUTOSAVE_SLOT, AUTOSAVE_NAME);
      return true;
    } catch (err) {
      console.warn('Autosave failed:', err);
      return false;
    } finally {
      this.inFlight = false;
    }
  }
}
