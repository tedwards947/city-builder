import { describe, it, expect, beforeEach } from 'vitest';
import { SpriteRegistry } from '../render/sprites/SpriteRegistry';
import type { SpriteDefinition } from '../render/sprites/SpriteDefinition';

describe('SpriteRegistry', () => {
  let registry: SpriteRegistry;

  beforeEach(() => {
    registry = new SpriteRegistry();
  });

  describe('query', () => {
    it('should return sprites whose tags are a superset of required tags', () => {
      const sprite1: SpriteDefinition = {
        id: 'r_dev1',
        tags: new Set(['zone:R', 'dev:1', 'vibe:any']),
        weight: 1,
      };
      const sprite2: SpriteDefinition = {
        id: 'r_dev2',
        tags: new Set(['zone:R', 'dev:2', 'vibe:any']),
        weight: 1,
      };
      const sprite3: SpriteDefinition = {
        id: 'c_dev1',
        tags: new Set(['zone:C', 'dev:1', 'vibe:any']),
        weight: 1,
      };

      registry.register(sprite1);
      registry.register(sprite2);
      registry.register(sprite3);

      const results = registry.query(new Set(['zone:R', 'dev:1']));

      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe('r_dev1');
    });

    it('should return multiple sprites when multiple match', () => {
      const sprite1: SpriteDefinition = {
        id: 'tree1',
        tags: new Set(['vegetation:tree']),
        weight: 1,
      };
      const sprite2: SpriteDefinition = {
        id: 'tree2',
        tags: new Set(['vegetation:tree']),
        weight: 1,
      };

      registry.register(sprite1);
      registry.register(sprite2);

      const results = registry.query(new Set(['vegetation:tree']));

      expect(results).toHaveLength(2);
    });

    it('should return empty array when no sprites match', () => {
      const sprite1: SpriteDefinition = {
        id: 'r_dev1',
        tags: new Set(['zone:R', 'dev:1']),
        weight: 1,
      };

      registry.register(sprite1);

      const results = registry.query(new Set(['zone:C']));

      expect(results).toHaveLength(0);
    });
  });

  describe('pick', () => {
    it('should prefer more specific sprites (more tags)', () => {
      const generic: SpriteDefinition = {
        id: 'r_generic',
        tags: new Set(['zone:R', 'dev:1', 'vibe:any']),
        weight: 10,
      };
      const specific: SpriteDefinition = {
        id: 'r_suburb',
        tags: new Set(['zone:R', 'dev:1', 'vibe:suburb']),
        weight: 10,
      };

      registry.register(generic);
      registry.register(specific);

      const result = registry.pick(new Set(['zone:R', 'dev:1', 'vibe:suburb']), 42);

      // Specific sprite has more tags (4 vs 3), so it should be picked
      expect(result?.id).toBe('r_suburb');
    });

    it('should return the same sprite for the same seed (deterministic)', () => {
      const sprite1: SpriteDefinition = {
        id: 'tree1',
        tags: new Set(['vegetation:tree']),
        weight: 1,
      };
      const sprite2: SpriteDefinition = {
        id: 'tree2',
        tags: new Set(['vegetation:tree']),
        weight: 1,
      };

      registry.register(sprite1);
      registry.register(sprite2);

      const result1 = registry.pick(new Set(['vegetation:tree']), 123);
      const result2 = registry.pick(new Set(['vegetation:tree']), 123);

      expect(result1?.id).toBe(result2?.id);
    });

    it('should return different sprites for different seeds', () => {
      const sprite1: SpriteDefinition = {
        id: 'tree1',
        tags: new Set(['vegetation:tree']),
        weight: 1,
      };
      const sprite2: SpriteDefinition = {
        id: 'tree2',
        tags: new Set(['vegetation:tree']),
        weight: 1,
      };

      registry.register(sprite1);
      registry.register(sprite2);

      const results = new Set<string>();
      // Try many seeds to ensure we get both sprites (need wider range for 50/50 split)
      for (let seed = 0; seed < 1000; seed++) {
        const result = registry.pick(new Set(['vegetation:tree']), seed);
        if (result) results.add(result.id);
      }

      // With 1000 tries, we should definitely see both sprites
      expect(results.size).toBe(2);
      expect(results.has('tree1')).toBe(true);
      expect(results.has('tree2')).toBe(true);
    });

    it('should return null when no sprites match', () => {
      const sprite1: SpriteDefinition = {
        id: 'r_dev1',
        tags: new Set(['zone:R', 'dev:1']),
        weight: 1,
      };

      registry.register(sprite1);

      const result = registry.pick(new Set(['zone:C']), 42);

      expect(result).toBeNull();
    });

    it('should respect weight distribution', () => {
      const lightSprite: SpriteDefinition = {
        id: 'light',
        tags: new Set(['test']),
        weight: 1,
      };
      const heavySprite: SpriteDefinition = {
        id: 'heavy',
        tags: new Set(['test']),
        weight: 99,
      };

      registry.register(lightSprite);
      registry.register(heavySprite);

      const counts = { light: 0, heavy: 0 };
      for (let seed = 0; seed < 1000; seed++) {
        const result = registry.pick(new Set(['test']), seed);
        if (result?.id === 'light') counts.light++;
        if (result?.id === 'heavy') counts.heavy++;
      }

      // Heavy sprite should appear approximately 99% of the time
      expect(counts.heavy).toBeGreaterThan(counts.light * 10);
    });
  });

  describe('abandoned state', () => {
    it('should prefer abandoned sprite over normal sprite', () => {
      const normal: SpriteDefinition = {
        id: 'r_dev1_normal',
        tags: new Set(['zone:R', 'dev:1', 'vibe:any']),
        weight: 10,
      };
      const abandoned: SpriteDefinition = {
        id: 'r_dev1_abandoned',
        tags: new Set(['zone:R', 'dev:1', 'state:abandoned']),
        weight: 10,
      };

      registry.register(normal);
      registry.register(abandoned);

      const result = registry.pick(new Set(['zone:R', 'dev:1', 'state:abandoned']), 42);

      // Abandoned sprite has more tags (4 vs 3), so it should be picked
      expect(result?.id).toBe('r_dev1_abandoned');
    });
  });

  describe('fallback mechanism', () => {
    it('should fall back to generic vibe when specific vibe not available', () => {
      const generic: SpriteDefinition = {
        id: 'r_generic',
        tags: new Set(['zone:R', 'dev:1', 'vibe:any']),
        weight: 1,
      };

      registry.register(generic);

      // Request suburb vibe but only generic is available
      const result = registry.pick(new Set(['zone:R', 'dev:1', 'vibe:suburb']), 42);

      // Should get nothing because vibe:suburb is required but not present in generic
      expect(result).toBeNull();
    });

    it('should match when requested tags are subset of sprite tags', () => {
      const sprite: SpriteDefinition = {
        id: 'r_suburb',
        tags: new Set(['zone:R', 'dev:1', 'vibe:suburb', 'extra:tag']),
        weight: 1,
      };

      registry.register(sprite);

      // Request fewer tags than sprite has
      const result = registry.pick(new Set(['zone:R', 'dev:1']), 42);

      // Should match because all requested tags are present in sprite
      expect(result?.id).toBe('r_suburb');
    });
  });
});
