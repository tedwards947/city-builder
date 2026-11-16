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
  fireIgnition:     { tx: number; ty: number; zone: number; devLevel: number };
  fireSpreading:    { tx: number; ty: number };
  // A fire burned out without fire station coverage; `level` is the new dev level.
  fireDamage:       { tx: number; ty: number; zone: number; level: number };
  // Budget (emitted by EconomySystem)
  budgetWarning:    { money: number; daysLeft: number }; // cooldown-throttled
  debtEntered:      { money: number };                   // once, when money drops below 0
  debtCleared:      { money: number };                   // once, when money is back to >= 0
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
  // The net political-capital change of one finished player action (emitted
  // by CommandHistory): a single click, a whole drag / auto road / zone fill,
  // or one undo or redo step. Nothing is emitted for a net change of zero or
  // for a batch that was refused and taken back. (tx, ty) is the tile of the
  // action's last change. `undo` is true for an undo step.
  pcAction:         { delta: number; tx?: number; ty?: number; undo: boolean };
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
