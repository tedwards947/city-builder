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
  
  // Cache for pre-rendered sprites: Map<"entityId:ts:paletteKey", HTMLCanvasElement>
  private _renderCache: Map<string, HTMLCanvasElement> = new Map();
  private readonly MAX_CACHE_SIZE = 1200;

  // Cache for findBest results: Map<"type:vibeHash:lotId", VectorEntity>
  private _bestCache: Map<string, VectorEntity> = new Map();

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
    this._bestCache.clear();
  }

  /**
   * Clears the render cache (call on window resize or zoom change if needed, 
   * though ts is part of the key).
   */
  clearCache(): void {
    this._renderCache.clear();
    this._bestCache.clear();
  }

  /**
   * Draws a sprite, using a cached off-screen canvas if available.
   */
  drawCached(
    entity: VectorEntity,
    ctx: CanvasRenderingContext2D,
    ts: number,
    t: number,
    p: ColorPalette,
    vibe: VibeState
  ): void {
    // Only cache static or semi-static sprites. 
    // If it has complex animations (t-dependence), we might skip caching or accept stutter.
    // For now, let's cache based on discrete TS and a simplified t (e.g. rounded to 0.1s for some animation).
    
    const cacheKey = `${entity.id}:${Math.floor(ts)}:${p.grass}`; // Simplified key
    let cachedCanvas = this._renderCache.get(cacheKey);

    if (!cachedCanvas) {
      if (typeof document === 'undefined') return;
      cachedCanvas = document.createElement('canvas');
      cachedCanvas.width = Math.ceil(ts) + 2;
      cachedCanvas.height = Math.ceil(ts) + 2;
      const cctx = cachedCanvas.getContext('2d')!;
      
      // Draw into the off-screen canvas
      entity.draw(cctx, ts, t, p, vibe);

      if (this._renderCache.size >= this.MAX_CACHE_SIZE) {
        // Enforce LRU-ish behavior: clear the oldest entry
        const firstKey = this._renderCache.keys().next().value;
        if (firstKey !== undefined) this._renderCache.delete(firstKey);
      }
      this._renderCache.set(cacheKey, cachedCanvas);
    }

    ctx.drawImage(cachedCanvas, 0, 0);
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
    if (!type) return undefined;

    // Use a hash for vibe to avoid excessive scoring runs.
    // egalitarian, green, planned are roughly [-1, 1], so round to one decimal for stability.
    const vibeHash = `${vibe.egalitarian.toFixed(1)}:${vibe.green.toFixed(1)}:${vibe.planned.toFixed(1)}:${vibe.isNight ? 'N' : 'D'}`;
    const cacheKey = `${type}:${vibeHash}:${lotId}`;
    const cached = this._bestCache.get(cacheKey);
    if (cached) return cached;

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
    const result = bestOptions[lotId % bestOptions.length];
    if (result) {
      this._bestCache.set(cacheKey, result);
    }
    return result;
  }
}
