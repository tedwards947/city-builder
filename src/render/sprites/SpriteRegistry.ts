import type { SpriteDefinition } from './SpriteDefinition';

export class SpriteRegistry {
  private _sprites: SpriteDefinition[];

  constructor() {
    this._sprites = [];
  }

  register(sprite: SpriteDefinition): void {
    this._sprites.push(sprite);
  }

  // Returns all sprites whose tag set is a superset of `required`.
  query(required: ReadonlySet<string>): SpriteDefinition[] {
    return this._sprites.filter(s =>
      [...required].every(t => s.tags.has(t))
    );
  }

  // Pick one sprite by weighted random using a stable seed.
  // Prefers more specific matches (more tags = higher specificity).
  pick(required: ReadonlySet<string>, seed: number): SpriteDefinition | null {
    const candidates = this.query(required);
    if (candidates.length === 0) return null;

    // Sort by specificity (number of tags), then by weight
    const sorted = candidates.sort((a, b) => {
      const specificity = b.tags.size - a.tags.size;
      return specificity !== 0 ? specificity : b.weight - a.weight;
    });

    // Weighted random selection from sorted candidates
    const total = sorted.reduce((acc, s) => acc + s.weight, 0);
    let r = (seed % 1000) / 1000 * total;
    for (const s of sorted) {
      r -= s.weight;
      if (r <= 0) return s;
    }
    return sorted[sorted.length - 1];
  }
}

// Singleton — the whole app uses one registry.
export const SPRITE_REGISTRY = new SpriteRegistry();
