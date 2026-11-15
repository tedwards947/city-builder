// The manual / auto setting for the road tools. The switch itself lives in the
// toolbar's Roads fly-out (see Toolbar.ts). The choice is one setting shared by
// street, avenue and highway, and is remembered between visits. Until the
// player chooses, it is auto on desktop and manual on touch screens.

import type { RoadMode } from '../input/InputController';

const STORAGE_KEY = 'city-builder:roadMode';

/**
 * The mode to start in when the player has not chosen one: auto with a mouse
 * or trackpad, manual on a touch screen (tablets and phones), where dragging a
 * finger is the natural way to draw.
 */
export function defaultRoadMode(): RoadMode {
  try {
    return window.matchMedia('(pointer: coarse)').matches ? 'manual' : 'auto';
  } catch {
    return 'manual';
  }
}

/** The player's saved choice, or the default for this kind of device. */
export function loadRoadMode(): RoadMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'auto' || saved === 'manual') return saved;
  } catch { /* storage blocked: fall through to the default */ }
  return defaultRoadMode();
}

export function saveRoadMode(mode: RoadMode): void {
  try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* private window: not remembered */ }
}
