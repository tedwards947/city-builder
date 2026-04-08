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
  // Abandonment (emitted by AbandonmentSystem)
  tileAbandoned:    { tx: number; ty: number; zone: number; level: number };
  // Zone growth (emitted by ZoneGrowthSystem)
  tileDeveloped:    { tx: number; ty: number; zone: number; level: number };
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
