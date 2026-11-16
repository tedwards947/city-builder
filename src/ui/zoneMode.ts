// The drag / fill setting for the zone tools. The switch itself lives in the
// toolbar's Zones fly-out (see Toolbar.ts). One setting shared by all three
// zones, remembered between visits; drag until the player chooses.

import type { ZoneMode } from '../input/zoneFill';

const STORAGE_KEY = 'city-builder:zoneMode';

export function loadZoneMode(): ZoneMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'fill' ? 'fill' : 'drag';
  } catch {
    return 'drag';
  }
}

export function saveZoneMode(mode: ZoneMode): void {
  try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* private window: not remembered */ }
}
