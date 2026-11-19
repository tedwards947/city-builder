// When the title screen is shown: on the first launch of each day. Any later
// launch that day opens straight into the player's city, as before.

const STORAGE_KEY = 'city-builder:titleSeenDay';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** The local calendar day of `now`, e.g. "2026-11-19". */
export function dayStamp(now: Date): string {
  const two = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

/** Whether the title has not been shown yet today. True when the browser keeps no storage (it cannot tell). */
export function titleDue(store: Store | null, now: Date): boolean {
  try {
    return store?.getItem(STORAGE_KEY) !== dayStamp(now);
  } catch {
    return true;
  }
}

/** Remember that the title was shown today. */
export function markTitleSeen(store: Store | null, now: Date): void {
  try { store?.setItem(STORAGE_KEY, dayStamp(now)); } catch { /* private window: not remembered */ }
}

export interface TitleChoice {
  /** The page's `?title=` value: "on" forces the title, "off" skips it. */
  param: string | null;
  /** Developer tools are on (?debug=true), or the browser is driven by a script: no title unless forced, so test runs land in the city. */
  tooling: boolean;
  /** `titleDue`. */
  due: boolean;
}

/** Whether this launch opens on the title screen. */
export function wantTitle({ param, tooling, due }: TitleChoice): boolean {
  if (param === 'on') return true;
  if (param === 'off' || tooling) return false;
  return due;
}

/** Where the showcase city's save file lives, under the site's base address (a file from the Save panel's "save to file"). */
export const SHOWCASE_PATH = 'showcase/showcase.citysave.json';
