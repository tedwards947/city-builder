// The ordinance panel: a list of city-wide ordinances the player can enact
// with political capital. Each row shows what it does, what it costs to enact
// and to keep, and a switch. Enacting and repealing cannot be undone, so the
// switch asks first. Opened from its own toolbar tile, beside the stats column.

import type { World } from '../sim/World';
import {
  ORDINANCES, ordinanceState, enactOrdinance, repealOrdinance, ordinancesEnabled, enactBlocker, dailyUpkeepOf, dailyMoneyOf,
} from '../sim/ordinances';
import type { OrdinanceDef, OrdinanceId, OrdinanceState } from '../sim/ordinances';
import { t } from '../i18n';
import { PC_SYMBOL, pcAmount } from './pcFormat';

/**
 * Whether ordinances are offered to the player at all: the engine's switch
 * (BALANCE.politicalCapital.ordinancesEnabled, off until the numbers are set;
 * the ?debug=true PC panel can tick it). While off, the toolbar tile is hidden.
 */
export function ordinancesShown(): boolean {
  return ordinancesEnabled();
}

/** PC per day the city is paying to keep its ordinances (suspended ones cost nothing). */
export function ordinanceUpkeep(world: World): number {
  const { active, suspended } = world.politics.ordinances;
  return ORDINANCES.filter(o => active.includes(o.id) && !suspended.includes(o.id))
    .reduce((sum, o) => sum + dailyUpkeepOf(world, o.id), 0);
}

/**
 * "◆ 20", then what it costs to keep: "◆ 0.3 / day" and any money. The PC
 * upkeep is what this city is actually charged (it scales with the cap), so
 * it comes from the engine, not the table.
 */
export function ordinancePrice(world: World, o: OrdinanceDef): { enact: string; keep: string } {
  const { enactCost } = o.numbers;
  const dailyMoney = Math.round(dailyMoneyOf(world, o.id));
  const dailyUpkeep = dailyUpkeepOf(world, o.id);
  const keep: string[] = [];
  if (dailyUpkeep > 0) keep.push(PC_SYMBOL + ' ' + pcAmount(dailyUpkeep));
  if (dailyMoney > 0) keep.push('$' + dailyMoney.toLocaleString('en-US'));
  return {
    enact: PC_SYMBOL + ' ' + pcAmount(enactCost),
    keep: keep.length ? keep.join(' + ') + ' ' + t('ui.ordinances.perDay') : '',
  };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export class OrdinancePanel {
  private readonly root: HTMLElement;
  private readonly getWorld: () => World;
  private visible = false;
  /** The ordinance whose "are you sure?" box is open. */
  private asking: OrdinanceId | null = null;
  /** What the panel last drew, so it is rebuilt only when something changed. */
  private drawn = '';

  constructor(parent: HTMLElement, getWorld: () => World) {
    this.getWorld = getWorld;
    this.root = el('div', 'hidden');
    this.root.id = 'ordinance-panel';
    parent.append(this.root);
  }

  get isOpen(): boolean { return this.visible; }

  /** Show or hide the panel, `right` px in from the window's right edge. */
  toggle(right: number): void {
    this.visible = !this.visible;
    this.asking = null;
    this.root.style.right = right + 'px';
    this.root.classList.toggle('hidden', !this.visible);
    this.drawn = '';
    this.update();
  }

  close(): boolean {
    if (!this.visible) return false;
    this.visible = false;
    this.root.classList.add('hidden');
    return true;
  }

  /** Call every frame: keeps the rows in step with the world (PC moves, suspensions). */
  update(): void {
    if (!this.visible) return;
    const world = this.getWorld();
    const states = ORDINANCES.map(o => ordinanceState(world, o.id));
    const sig = states.join(',') + '|' + this.asking + '|' + ORDINANCES.map(o => enactBlocker(world, o.id) ?? '-').join(',') + '|' + ordinanceUpkeep(world).toFixed(2);
    if (sig === this.drawn) return;
    this.drawn = sig;
    this.render(world, states);
  }

  private render(world: World, states: OrdinanceState[]): void {
    const scroll = this.root.querySelector('.ord-list')?.scrollTop ?? 0;
    this.root.textContent = '';
    const head = el('div', 'ord-head', t('ui.ordinances.title'));
    const upkeep = ordinanceUpkeep(world);
    if (upkeep > 0) head.append(el('span', 'ord-upkeep', t('ui.ordinances.upkeep') + ' ' + PC_SYMBOL + ' ' + pcAmount(upkeep) + ' ' + t('ui.ordinances.perDay')));
    this.root.append(head);

    const list = el('div', 'ord-list');
    ORDINANCES.forEach((o, n) => {
      const state = states[n];
      const row = el('div', 'ord-row ' + state);
      const text = el('div', 'ord-text');
      const name = el('b', '', t(o.nameKey));
      if (state === 'suspended') name.append(el('span', 'ord-flag', ' · ' + t('ui.ordinances.suspended')));
      text.append(name, el('small', '', t(o.descKey)));
      if (state === 'cantAfford') {
        text.append(el('small', 'ord-why', t(enactBlocker(world, o.id) === 'inDebt' ? 'ui.hud.pcInDebt' : 'ui.hud.pcShort')));
      } else if (state === 'suspended') {
        text.append(el('small', 'ord-why', t('ui.ordinances.suspendedNote')));
      }
      const price = ordinancePrice(world, o);
      const cost = el('div', 'ord-cost');
      cost.append(el('span', 'ord-pc', price.enact));
      if (price.keep) cost.append(el('small', '', t('ui.ordinances.then') + ' ' + price.keep));
      const on = state === 'on' || state === 'suspended';
      const sw = el('button', 'ord-switch' + (on ? ' on' : ''));
      sw.type = 'button';
      sw.setAttribute('role', 'switch');
      sw.setAttribute('aria-checked', String(on));
      sw.setAttribute('aria-label', t(o.nameKey));
      sw.disabled = state === 'cantAfford';
      sw.addEventListener('click', () => { this.asking = this.asking === o.id ? null : o.id; this.update(); });
      row.append(text, cost, sw);
      list.append(row);
      if (this.asking === o.id && state !== 'cantAfford') list.append(this.confirmBox(world, o, on));
    });
    this.root.append(list);
    list.scrollTop = scroll;
  }

  /** The "are you sure?" box under a row. Enacting and repealing cannot be undone. */
  private confirmBox(world: World, o: OrdinanceDef, on: boolean): HTMLElement {
    const box = el('div', 'ord-confirm');
    const price = ordinancePrice(world, o);
    const name = t(o.nameKey);
    box.append(el('b', '', t(on ? 'ui.ordinances.askRepeal' : 'ui.ordinances.askEnact', { name })));
    box.append(el('div', '', on
      ? t('ui.ordinances.nothingBack')
      : t('ui.ordinances.costsNow', { pc: price.enact }) + (price.keep ? ' ' + t('ui.ordinances.costsThen', { keep: price.keep }) : '')));
    if (!on) box.append(el('small', '', t('ui.ordinances.cantUndo')));
    const actions = el('div', 'ord-actions');
    const cancel = el('button', '', t('ui.ordinances.cancel'));
    cancel.type = 'button';
    cancel.addEventListener('click', () => { this.asking = null; this.update(); });
    const go = el('button', 'go' + (on ? ' repeal' : ''), t(on ? 'ui.ordinances.repeal' : 'ui.ordinances.enact'));
    go.type = 'button';
    go.addEventListener('click', () => {
      if (on) repealOrdinance(world, o.id); else enactOrdinance(world, o.id);
      this.asking = null;
      this.drawn = '';
      this.update();
    });
    actions.append(cancel, go);
    box.append(actions);
    return box;
  }
}
