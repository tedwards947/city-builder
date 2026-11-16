// What the player hears and sees when resident requests open, are met or are
// missed: a toast each time, and for a moment a tick or a cross on the map
// where the request was (drawn by the renderer from `outcomes`).

import type { World } from '../sim/World';
import type { CityEvents } from '../sim/EventBus';
import type { OpenRequest } from '../sim/requests';
import { requestConfig } from '../sim/requests';
import { BALANCE } from '../data/balance';
import { t } from '../i18n';
import { pcDelta } from './pcFormat';
import type { RequestOutcome } from '../render/clay/requestBadges';

const OUTCOME_MS = 2600;

/** Whole game days until the deadline, never below 0. */
export function daysLeft(deadlineTick: number, tick: number): number {
  return Math.max(0, Math.ceil((deadlineTick - tick) / BALANCE.ticksPerDay));
}

/** A kind's name for use mid-sentence: "A park" → "a park". */
function what(kind: string): string {
  const name = t(`requests.${kind}.name`);
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/** "Residents want: a park", the description, the days left and what is at stake. */
export function requestText(req: Pick<OpenRequest, 'kind' | 'deadlineTick'>, tick: number): { title: string; body: string; stakes: string } {
  const numbers = requestConfig().kinds[req.kind];
  const stakes: string[] = [t('ui.requests.daysLeft', { n: daysLeft(req.deadlineTick, tick) })];
  if (numbers && numbers.reward > 0) stakes.push(t('ui.requests.ifMet', { pc: pcDelta(numbers.reward) }));
  if (numbers && numbers.penalty > 0) stakes.push(t('ui.requests.ifMissed', { pc: pcDelta(-numbers.penalty) }));
  return {
    title: t('ui.requests.want', { what: what(req.kind) }),
    body: t(`requests.${req.kind}.desc`),
    stakes: stakes.join(' · '),
  };
}

type Toast = (title: string, message: string, type: 'info' | 'warning') => void;

export class RequestFeedback {
  private world: World | null = null;
  private readonly toast: Toast;
  private readonly ended: { tx: number; ty: number; met: boolean; at: number }[] = [];
  // The event bus hands listeners an untyped payload (as ToastPanel's handlers take it).
  /* eslint-disable @typescript-eslint/no-explicit-any */
  private readonly onOpened = (e: any) => this.opened(e as CityEvents['requestOpened']);
  private readonly onMet = (e: any) => this.end(e as CityEvents['requestMet'], true);
  private readonly onFailed = (e: any) => this.end(e as CityEvents['requestFailed'], false);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  constructor(toast: Toast) { this.toast = toast; }

  /** Listen to this world's requests (call again after New Game or Load). */
  setWorld(world: World): void {
    if (this.world) {
      this.world.events.off('requestOpened', this.onOpened);
      this.world.events.off('requestMet', this.onMet);
      this.world.events.off('requestFailed', this.onFailed);
    }
    this.world = world;
    world.events.on('requestOpened', this.onOpened);
    world.events.on('requestMet', this.onMet);
    world.events.on('requestFailed', this.onFailed);
    this.ended.length = 0;
  }

  /** Requests that ended a moment ago, for the renderer. `now` is the frame time in ms. */
  outcomes(now: number): RequestOutcome[] {
    while (this.ended.length && now - this.ended[0].at > OUTCOME_MS) this.ended.shift();
    return this.ended.map(e => ({ tx: e.tx, ty: e.ty, met: e.met, age: Math.max(0, (now - e.at) / OUTCOME_MS) }));
  }

  private opened(e: CityEvents['requestOpened']): void {
    const text = requestText(e, this.world?.tick ?? 0);
    this.toast(text.title, text.stakes, 'info');
  }

  private end(e: CityEvents['requestMet'], met: boolean): void {
    this.ended.push({ tx: (e.x0 + e.x1 + 1) / 2, ty: (e.y0 + e.y1 + 1) / 2, met, at: performance.now() });
    const numbers = requestConfig().kinds[e.kind];
    const asked = what(e.kind);
    if (met) {
      this.toast(t('ui.requests.met'), t('ui.requests.metBody', { what: asked }) + (numbers?.reward > 0 ? ' ' + pcDelta(numbers.reward) : ''), 'info');
    } else {
      this.toast(t('ui.requests.missed'), t('ui.requests.missedBody', { what: asked }) + (numbers?.penalty > 0 ? ' ' + pcDelta(-numbers.penalty) : ''), 'warning');
    }
  }
}
