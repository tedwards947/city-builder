import type { ColorPalette } from './CharacterPalette';

/**
 * Represents the current "vibe" or character of the city.
 * Values typically range from -1.0 to 1.0 (or as defined in BALANCE).
 */
export interface VibeState {
  egalitarian: number; // vs Laissez-faire
  green: number;       // vs Industrial
  planned: number;     // vs Organic
  isNight: boolean;    // For future night mode support
}

/**
 * A procedurally drawn vector entity.
 */
export interface VectorEntity {
  /** Unique identifier (e.g., 'res-low-01') */
  readonly id: string;
  
  /** Category for filtering (e.g., 'ZONE_R', 'BUILDING_POWER_PLANT') */
  readonly type: string;
  
  /** Searchable/filterable tags for vibe matching */
  readonly tags: string[];

  /**
   * Main drawing function.   * @param ctx - The canvas context to draw into.
   * @param ts - Current tile size in pixels (scaled by zoom).
   * @param t - Animation time (0.0 to 1.0 or monotonically increasing).
   * @param p - Current color palette.
   * @param vibe - Current city character/vibe.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    ts: number,
    t: number,
    p: ColorPalette,
    vibe: VibeState
  ): void;
}
