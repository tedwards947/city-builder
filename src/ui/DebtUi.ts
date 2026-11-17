// Debt on screen (owner's picks from art/clay-set/debt.html):
//   - a meter under Money in the HUD while the city is in debt (A1/A3),
//   - a banner with a clock for the whole countdown once past the limit (B2),
//     with the same countdown in the HUD (B1),
//   - the game-over card when the council removes the mayor (C1).
// The warnings at half the limit and at the limit are toasts (ToastPanel.ts).
// Game over is final; with ?debug=true the card also has a cheat that revives the city.

import type { World } from '../sim/World';
import { debtStatus, reviveFromDebt } from '../sim/debt';
import { BALANCE } from '../data/balance';
import { DEBUG } from '../debug';
import { t } from '../i18n';
import { debtHud, timeInOffice } from './debtFormat';

const REVIVE_AMOUNT = 500_000;
/** The debt limit in full ("$5,242"): the HUD's short money format drops too much of a small limit. */
const full = (n: number) => '$' + Math.round(n).toLocaleString();

export interface DebtUiHooks {
  getWorld: () => World;
  formatMoney: (n: number) => string;
  onLoad: () => void;
  onNew: () => void;
}

export class DebtUi {
  private readonly meter = document.getElementById('stat-debt')!;
  private readonly bar = document.getElementById('stat-debt-bar')!;
  private readonly label = document.getElementById('stat-debt-label')!;
  private readonly banner = document.getElementById('debt-countdown')!;
  private readonly over = document.getElementById('game-over')!;
  private readonly hooks: DebtUiHooks;
  private shownOver = false;
  private sig = '';

  constructor(hooks: DebtUiHooks) {
    this.hooks = hooks;
    document.getElementById('game-over-load')!.addEventListener('click', hooks.onLoad);
    document.getElementById('game-over-new')!.addEventListener('click', hooks.onNew);
    const revive = document.getElementById('game-over-revive')!;
    revive.hidden = !DEBUG;
    revive.addEventListener('click', () => reviveFromDebt(hooks.getWorld(), REVIVE_AMOUNT));
  }

  /** True while the game-over card is up: the rest of the game takes no input. */
  get blocking(): boolean { return this.shownOver; }

  /** Call every frame. */
  update(): void {
    const world = this.hooks.getWorld(), money = world.budget.money, s = debtStatus(world);
    const hud = debtHud(money, s, {
      ofLimit: t('ui.debt.ofLimit'), overLimit: t('ui.debt.overLimit'), voteIn: t('ui.debt.voteIn'), voteIn1: t('ui.debt.voteIn1'),
    });
    // Rewrite the DOM only when something it shows has changed.
    const sig = [hud.show, hud.tone, hud.countdown, hud.label, hud.fill.toFixed(3), s.daysLeft, s.gameOver, Math.round(s.limit)].join('|');
    if (sig !== this.sig) {
      this.sig = sig;
      this.meter.hidden = !hud.show;
      this.meter.className = hud.tone + (hud.countdown ? ' countdown' : '');
      this.bar.style.width = (hud.fill * 100).toFixed(1) + '%';
      this.label.textContent = hud.label;
      this.meter.title = t('ui.debt.meterTip', { limit: full(s.limit) });

      const counting = s.daysLeft !== null && !s.gameOver;
      this.banner.hidden = !counting;
      document.body.classList.toggle('debt-counting', counting);
      if (counting) {
        document.getElementById('debt-countdown-days')!.textContent = String(s.daysLeft);
        (document.getElementById('debt-countdown-ring') as HTMLElement).style.setProperty('--a', (hud.fill * 100).toFixed(1) + '%');
        document.getElementById('debt-countdown-title')!.textContent = hud.label;
        document.getElementById('debt-countdown-sub')!.textContent = t('ui.debt.payDown', { limit: full(s.limit) });
      }
    }

    if (s.gameOver !== this.shownOver) {
      this.shownOver = s.gameOver;
      this.over.classList.toggle('hidden', !s.gameOver);
      if (s.gameOver) {
        const time = timeInOffice(Math.floor(world.tick / BALANCE.ticksPerDay));
        document.getElementById('game-over-text')!.textContent = t('ui.debt.overText', { days: s.graceDays });
        document.getElementById('game-over-time')!.textContent = t(time.unit === 'years' ? 'ui.debt.years' : 'ui.debt.months', { n: time.n });
        document.getElementById('game-over-peak')!.textContent = Math.max(world.politics.peakPopulation, world.stats.population).toLocaleString();
        document.getElementById('game-over-balance')!.textContent = this.hooks.formatMoney(money);
      }
    }
  }
}
