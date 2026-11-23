// Auto-pause when the city goes into debt (owner, 2026-11-22), so a game left running can't be lost by
// accident. The decision only (main.ts pauses and shows the toast; the lab and headless runs never call it):
//   - pause once, on the step from money ≥ 0 to money < 0;
//   - after that, not again until money has been back at 0 or above and dips again;
//   - a city that starts in debt (loaded or new) does not pause until it has been out of debt first.

export interface DebtWatch {
  /** The city being watched: a different one starts the watch afresh. */
  world: object | null;
  /** True once money has been at 0 or above since the last pause (or the watch began). */
  armed: boolean;
}

export function newDebtWatch(): DebtWatch {
  return { world: null, armed: false };
}

/** Whether to pause now, given the city and its money this frame. Updates the watch. */
export function debtPauseDue(watch: DebtWatch, world: object, money: number): boolean {
  if (watch.world !== world) {
    watch.world = world;
    watch.armed = money >= 0;
    return false;
  }
  if (money >= 0) { watch.armed = true; return false; }
  if (!watch.armed) return false;
  watch.armed = false;
  return true;
}
