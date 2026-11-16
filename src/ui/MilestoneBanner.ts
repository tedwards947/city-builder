// A banner across the top of the map when the city passes a population
// milestone, with the political capital it earned. It fades after a few
// seconds; a toast carries the same news for anyone who looked away.

import type { World } from '../sim/World';
import type { CityEvents } from '../sim/EventBus';
import { t } from '../i18n';
import { pcDelta } from './pcFormat';

const SHOW_MS = 4500;

export class MilestoneBanner {
  private readonly el: HTMLElement;
  private readonly toast: (title: string, message: string) => void;
  private world: World | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  // The event bus hands listeners an untyped payload (as ToastPanel's handlers take it).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly onMilestone = (e: any) => this.show(e as CityEvents['populationMilestone']);

  constructor(parent: HTMLElement, toast: (title: string, message: string) => void) {
    this.toast = toast;
    this.el = document.createElement('div');
    this.el.id = 'milestone-banner';
    this.el.hidden = true;
    parent.append(this.el);
  }

  /** Listen to this world's milestones (call again after New Game or Load). */
  setWorld(world: World): void {
    this.world?.events.off('populationMilestone', this.onMilestone);
    this.world = world;
    world.events.on('populationMilestone', this.onMilestone);
    this.el.hidden = true;
  }

  private show(e: CityEvents['populationMilestone']): void {
    const { title, body } = milestoneText(e.population, e.reward);
    this.el.textContent = '';
    this.el.append(title);
    const small = document.createElement('small');
    small.textContent = body;
    this.el.append(small);
    this.el.hidden = false;
    // Restart the fade if a second milestone lands while one is showing.
    this.el.style.animation = 'none';
    void this.el.offsetWidth;
    this.el.style.animation = '';
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.el.hidden = true; this.timer = null; }, SHOW_MS);
    this.toast(title, body);
  }
}

/** The banner's two lines: "5,000 residents" and "The city is growing up · +◆ 25". */
export function milestoneText(population: number, reward: number): { title: string; body: string } {
  const title = t('ui.milestone.title', { n: population.toLocaleString('en-US') });
  const body = t('ui.milestone.body') + (reward > 0 ? ' · ' + pcDelta(reward) : '');
  return { title, body };
}
