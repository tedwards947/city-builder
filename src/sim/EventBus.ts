// Contextual event bus. Systems publish events with rich payloads.
// Future systems (political capital, city character, achievements) subscribe
// without knowing about the publisher.

export type EventPayload = Record<string, unknown>;
export type EventListener = (payload: EventPayload) => void;

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
