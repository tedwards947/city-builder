// Contextual event bus. Systems publish events with rich payloads.
// Future systems (political capital, city character, achievements) subscribe
// without knowing about the publisher.

export type EventPayload = Record<string, unknown>;
export type EventListener = (payload: EventPayload) => void;

// ── Alert-worthy event catalog ───────────────────────────────────────────────
// Every event type that the toast/alert UI should respond to is declared here.
// Systems must emit with at least these fields — extra fields are fine.
export type CityEvents = {
  // Resource shortages — emitted once on onset, once on recovery.
  powerShortage:    { supply: number; demand: number; deficit: number };
  powerRestored:    { supply: number; demand: number };
  waterShortage:    { supply: number; demand: number; deficit: number };
  waterRestored:    { supply: number; demand: number };
  sewageShortage:   { supply: number; demand: number; deficit: number };
  sewageRestored:   { supply: number; demand: number };
  // Crime
  crimeSpike:       { avgCrime: number; threshold: number; affectedTiles: number };
  // Fire
  // `covered`: a fire station reaches the tile, so the fire will be out in a
  // few ticks and do no damage. (Optional so older emitters still type-check.)
  fireIgnition:     { tx: number; ty: number; zone: number; devLevel: number; covered?: boolean };
  fireSpreading:    { tx: number; ty: number };
  // A fire burned out without fire station coverage; `level` is the new dev level.
  fireDamage:       { tx: number; ty: number; zone: number; level: number };
  // The fires with no fire station in reach, summed up: at most one per
  // BALANCE.fire.reportCooldownTicks, and only when burning > 0 or damaged > 0.
  // `burning` = burning right now; `started` = began since the last report
  // (ignitions and spreads); `damaged` = buildings that lost a level since the
  // last report; (tx, ty) = the latest such fire, or the latest damage if none
  // started. Covered fires are never counted.
  fireReport:       { burning: number; started: number; damaged: number; tx: number; ty: number };
  // Budget (emitted by EconomySystem)
  budgetWarning:    { money: number; daysLeft: number }; // cooldown-throttled
  debtEntered:      { money: number };                   // once, when money drops below 0
  debtCleared:      { money: number };                   // once, when money is back to >= 0
  // Debt as a failure condition (sim/debt.ts). `limit` is how far below zero money may go (positive).
  debtWarning:      { level: 'half' | 'limit'; money: number; limit: number }; // once each time money falls past the mark
  debtCountdown:    { daysLeft: number; money: number; limit: number };        // once a game day while past the limit
  gameOver:         { reason: 'debt'; money: number; limit: number };          // once: the mayor is removed
  debtRevived:      { money: number };                                         // the debug cheat cleared a game over
  // Abandonment (emitted by AbandonmentSystem)
  tileAbandoned:    { tx: number; ty: number; zone: number; level: number };
  // Zone growth (emitted by ZoneGrowthSystem)
  tileDeveloped:    { tx: number; ty: number; zone: number; level: number };
  // Political capital changed by one command (emitted by changePc in
  // sim/politics.ts; passive regeneration does not emit). `delta` is signed.
  // `undo` is true when the command is being undone. A drag emits one per
  // tile, and a refused auto road / zone fill emits changes and then their
  // reversals: for one message per player action, use pcAction instead.
  pcChanged:        { delta: number; reason: string; tx?: number; ty?: number; undo: boolean };
  // The city's population reached a milestone for the first time and was
  // paid `reward` political capital (emitted by PoliticsSystem; also a
  // pcChanged with reason 'milestone', which pcAction does not include).
  populationMilestone: { population: number; reward: number };
  // The net political-capital change of one finished player action (emitted
  // by CommandHistory): a single click, a whole drag / auto road / zone fill,
  // or one undo or redo step. Nothing is emitted for a net change of zero or
  // for a batch that was refused and taken back. (tx, ty) is the tile of the
  // action's last change. `undo` is true for an undo step.
  pcAction:         { delta: number; tx?: number; ty?: number; undo: boolean };
  // Ordinances (src/sim/ordinances.ts). Enact and repeal come from the
  // player; suspend and resume from OrdinanceSystem when PC falls to 0 or
  // below and when it climbs above 0 again.
  ordinanceEnacted:  { id: string; cost: number };
  ordinanceRepealed: { id: string };
  ordinanceSuspended: { id: string };
  ordinanceResumed:  { id: string };
  // Resident requests (emitted by RequestSystem). The area is a tile rect;
  // `deadlineTick` is when it fails if not met.
  requestOpened: { id: number; kind: string; x0: number; y0: number; x1: number; y1: number; deadlineTick: number };
  requestMet:    { id: number; kind: string; x0: number; y0: number; x1: number; y1: number; deadlineTick: number };
  requestFailed: { id: number; kind: string; x0: number; y0: number; x1: number; y1: number; deadlineTick: number };
  // Healthcare
  deathEvent:       { tx: number; ty: number };
  healthcareCrisis: { avgSickness: number; threshold: number; affectedTiles: number };
};

export class EventBus {
  private readonly listeners: Map<string, EventListener[]> = new Map();

  on(type: string, fn: EventListener): void {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type)!.push(fn);
  }

  off(type: string, fn: EventListener): void {
    const ls = this.listeners.get(type);
    if (!ls) return;
    const idx = ls.indexOf(fn);
    if (idx !== -1) ls.splice(idx, 1);
  }

  emit(type: string, payload: EventPayload): void {
    const ls = this.listeners.get(type);
    if (ls) for (const fn of ls) fn(payload);
  }
}
