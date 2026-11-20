import { describe, it, expect } from 'vitest';
import { stadiumPinLabel } from '../render/clay/leisureArt';
import type { EventStatus } from '../sim/eventDays';

const status = (o: Partial<EventStatus>): EventStatus => ({
  ticksToEvent: 0, ticksLeft: 0, eventToday: false, stage: 'waiting', phase: 0, intensity: 0, daysToEvent: 0,
  fans: 0, seats: 400, stuckResidents: 0, pc: 0, connected: true, last: null, ...o,
});

describe('stadium pin', () => {
  it('counts down in real minutes at 1× (2 ticks a second), then seconds', () => {
    expect(stadiumPinLabel(status({ ticksToEvent: 1440 }))).toBe('Kick-off in 12 min');
    expect(stadiumPinLabel(status({ ticksToEvent: 121 }))).toBe('Kick-off in 2 min');
    expect(stadiumPinLabel(status({ ticksToEvent: 80 }))).toBe('Kick-off in 40 s');
    expect(stadiumPinLabel(status({ ticksToEvent: 1 }))).toBe('Kick-off in 1 s');
  });
  it('says the game is on while an event runs', () => {
    expect(stadiumPinLabel(status({ eventToday: true, stage: 'peak', ticksLeft: 300, phase: 0.5 }))).toBe('Game on!');
  });
});
