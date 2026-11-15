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
