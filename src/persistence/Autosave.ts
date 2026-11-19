// Periodic autosave to a dedicated slot.
// Driven from the frame loop via tick(now); never throws into the caller.

import type { World } from '../sim/World';

export const AUTOSAVE_SLOT = 0;
/**
 * Where the autosave is copied, as it was, when it is loaded from an older
 * save version (or cannot be read), before the next autosave overwrites it.
 * Shown in the Load panel.
 */
export const AUTOSAVE_BACKUP_SLOT = -1;
export const AUTOSAVE_NAME = 'Autosave';
export const AUTOSAVE_INTERVAL_MS = 60_000;
// Longest gap between frames that counts as play time. Frames stop while the
// tab is hidden (and the game is saved as it hides), so without this the
// first frame back would count the whole absence and save again at once.
export const AUTOSAVE_MAX_FRAME_GAP_MS = 2_000;

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
  private readonly onFailure?: (err: unknown) => void;
  private failing = false;

  /**
   * `onFailure` is called when a save fails, once per run of failures (not on
   * every retry), so the player can be told instead of losing the city silently.
   */
  constructor(target: AutosaveTarget, getWorld: () => World | null, intervalMs = AUTOSAVE_INTERVAL_MS, onFailure?: (err: unknown) => void) {
    this.target = target;
    this.getWorld = getWorld;
    this.intervalMs = intervalMs;
    this.onFailure = onFailure;
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
    const dt = this.lastTickAt === null ? 0 : Math.min(AUTOSAVE_MAX_FRAME_GAP_MS, Math.max(0, now - this.lastTickAt));
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
      this.failing = false;
      return true;
    } catch (err) {
      console.warn('Autosave failed:', err);
      if (!this.failing) {
        this.failing = true;
        try { this.onFailure?.(err); } catch { /* the notice must not break saving */ }
      }
      return false;
    } finally {
      this.inFlight = false;
    }
  }
}
