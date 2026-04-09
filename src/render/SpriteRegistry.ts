import type { VectorEntity, VibeState } from './SpriteTypes';
import type { ColorPalette } from './CharacterPalette';

/**
 * Registry of all vector-based entities in the game.
 * Used by the renderer to look up drawing instructions for tiles.
 */
export class SpriteRegistry {
  private static _instance: SpriteRegistry;
  private _entities: Map<string, VectorEntity> = new Map();
  private _byType: Map<string, string[]> = new Map();

  static get instance(): SpriteRegistry {
    if (!this._instance) this._instance = new SpriteRegistry();
    return this._instance;
  }

  /**
   * Registers a new entity.
   */
  register(entity: VectorEntity): void {
    this._entities.set(entity.id, entity);
    
    if (!this._byType.has(entity.type)) {
      this._byType.set(entity.type, []);
    }
    this._byType.get(entity.type)!.push(entity.id);
  }

  /**
   * Retrieves an entity by its ID.
   */
  get(id: string): VectorEntity | undefined {
    return this._entities.get(id);
  }

  /**
   * Returns all entities of a given type.
   */
  getEntitiesByType(type: string): VectorEntity[] {
    const ids = this._byType.get(type) || [];
    return ids.map(id => this._entities.get(id)!).filter(Boolean);
  }

  /**
   * Returns all registered entities.
   */
  getAllEntities(): VectorEntity[] {
    return Array.from(this._entities.values());
  }

  /**
   * Finds the best matching entity for a given type and vibe.
   * Uses a scoring system based on tags and current city character.
   * Uses the Lot ID (visualVariant) as a deterministic tie-breaker.
   */
  findBest(type: string, vibe: VibeState, lotId: number): VectorEntity | undefined {
    const options = this.getEntitiesByType(type);
    if (options.length === 0) return undefined;

    // Score each option based on vibe matching
    const scored = options.map(entity => {
      let score = 0;
      
      // Match Green vs Industrial
      if (vibe.green > 0.3 && entity.tags.includes('green')) score += 10;
      if (vibe.green < -0.3 && entity.tags.includes('industrial')) score += 10;
      
      // Match Egalitarian vs Laissez-faire
      if (vibe.egalitarian > 0.3 && entity.tags.includes('egalitarian')) score += 10;
      if (vibe.egalitarian < -0.3 && entity.tags.includes('corporate')) score += 10;
      
      // Match Planned vs Organic
      if (vibe.planned > 0.3 && entity.tags.includes('planned')) score += 10;
      if (vibe.planned < -0.3 && entity.tags.includes('organic')) score += 10;

      // Handle "Neutral" or generic sprites
      if (entity.tags.includes('neutral')) score += 1;

      return { entity, score };
    });

    // Find highest score
    let maxScore = -Infinity;
    scored.forEach(s => { if (s.score > maxScore) maxScore = s.score; });

    // Collect all entities with the max score
    const bestOptions = scored
      .filter(s => s.score === maxScore)
      .map(s => s.entity);

    // Use Lot ID to pick deterministically from the best matches
    return bestOptions[lotId % bestOptions.length];
  }
}
