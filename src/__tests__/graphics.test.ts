import { describe, it, expect, beforeEach } from 'vitest';
import { SpriteRegistry } from '../render/SpriteRegistry';
import type { VectorEntity, VibeState } from '../render/SpriteTypes';
import type { ColorPalette } from '../render/CharacterPalette';

describe('SpriteRegistry', () => {
  let registry: SpriteRegistry;
  const mockPalette: ColorPalette = {} as any;

  const greenSprite: VectorEntity = {
    id: 'green-sprite',
    type: 'TEST_TYPE',
    tags: ['green'],
    draw: () => {}
  };

  const industrialSprite: VectorEntity = {
    id: 'industrial-sprite',
    type: 'TEST_TYPE',
    tags: ['industrial'],
    draw: () => {}
  };

  const neutralSprite: VectorEntity = {
    id: 'neutral-sprite',
    type: 'TEST_TYPE',
    tags: ['neutral'],
    draw: () => {}
  };

  beforeEach(() => {
    // Reset singleton-like behavior for testing if needed, 
    // but here we can just clear and re-register
    registry = new SpriteRegistry();
    registry.register(greenSprite);
    registry.register(industrialSprite);
    registry.register(neutralSprite);
  });

  it('picks the green sprite when vibe is green', () => {
    const vibe: VibeState = { green: 1.0, egalitarian: 0, planned: 0, isNight: false };
    const best = registry.findBest('TEST_TYPE', vibe, 0);
    expect(best?.id).toBe('green-sprite');
  });

  it('picks the industrial sprite when vibe is industrial', () => {
    const vibe: VibeState = { green: -1.0, egalitarian: 0, planned: 0, isNight: false };
    const best = registry.findBest('TEST_TYPE', vibe, 0);
    expect(best?.id).toBe('industrial-sprite');
  });

  it('uses Lot ID as tie-breaker when vibe is neutral', () => {
    const vibe: VibeState = { green: 0, egalitarian: 0, planned: 0, isNight: false };
    // With neutral vibe, all three have similar-ish scores (neutral=1, others=0)
    // Actually neutral has score 1, others 0.
    const best = registry.findBest('TEST_TYPE', vibe, 0);
    expect(best?.id).toBe('neutral-sprite');
  });

  it('uses Lot ID to pick between multiple equally scored options', () => {
    const spriteA: VectorEntity = { id: 'a', type: 'MULTI', tags: ['green'], draw: () => {} };
    const spriteB: VectorEntity = { id: 'b', type: 'MULTI', tags: ['green'], draw: () => {} };
    registry.register(spriteA);
    registry.register(spriteB);

    const vibe: VibeState = { green: 1.0, egalitarian: 0, planned: 0, isNight: false };
    
    expect(registry.findBest('MULTI', vibe, 0)?.id).toBe('a');
    expect(registry.findBest('MULTI', vibe, 1)?.id).toBe('b');
    expect(registry.findBest('MULTI', vibe, 2)?.id).toBe('a');
  });

  it('returns undefined if no sprites match the type', () => {
    const vibe: VibeState = { green: 0, egalitarian: 0, planned: 0, isNight: false };
    expect(registry.findBest('NON_EXISTENT', vibe, 0)).toBeUndefined();
  });
});
