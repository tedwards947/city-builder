// Arrow keys pan the map: a tap nudges a few tiles, holding pans smoothly (pure logic; main.ts feeds it).

export type PanKey = 'left' | 'right' | 'up' | 'down';

/** A tap (released within this long) nudges; holding longer pans smoothly instead. */
export const TAP_MS = 180;
/** How far a tap moves the view, in tiles. */
export const TAP_TILES = 3;
/** Smooth panning speed, in screen pixels a second (the same on screen at any zoom). */
export const PAN_SPEED = 720;

const NAME: Record<string, PanKey> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
export const panKeyOf = (key: string): PanKey | undefined => NAME[key];

/**
 * The direction the view moves, a unit vector (x right, y down), from the arrows held: opposite arrows cancel,
 * two at right angles give a diagonal at the same speed. (0, 0) when none.
 */
export function panDirection(held: ReadonlySet<PanKey>): { x: number; y: number } {
  const x = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
  const y = (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0);
  const n = Math.hypot(x, y);
  return n === 0 ? { x: 0, y: 0 } : { x: x / n, y: y / n };
}

/** Screen pixels the view moves in `dtSec` while panning smoothly, per axis (steady on screen whatever the zoom). */
export function panStep(dir: { x: number; y: number }, dtSec: number): { x: number; y: number } {
  const d = Math.min(Math.max(dtSec, 0), 0.1);   // a stalled frame must not throw the view
  return { x: dir.x * PAN_SPEED * d, y: dir.y * PAN_SPEED * d };
}

/** Keys down and since when: a tap is a nudge on release; a hold pans once it is past TAP_MS. */
export class KeyPan {
  private down = new Map<PanKey, number>();

  press(k: PanKey, now: number): void { if (!this.down.has(k)) this.down.set(k, now); }

  /** Release; the nudge direction (a unit vector, in tiles × TAP_TILES by the caller) if it was a tap, else null. */
  release(k: PanKey, now: number): { x: number; y: number } | null {
    const at = this.down.get(k);
    this.down.delete(k);
    if (at === undefined || now - at > TAP_MS) return null;
    return { x: k === 'right' ? 1 : k === 'left' ? -1 : 0, y: k === 'down' ? 1 : k === 'up' ? -1 : 0 };
  }

  clear(): void { this.down.clear(); }

  /** Direction of the smooth pan now: only keys held past the tap time count. */
  direction(now: number): { x: number; y: number } {
    const held = new Set<PanKey>();
    for (const [k, at] of this.down) if (now - at > TAP_MS) held.add(k);
    return panDirection(held);
  }
}
