// Developer-only economy panel (?debug=true), for the money play-test. Simple
// by default: a read-out (treasury, net per day, income and expenses by group,
// runway) and a preset picker (src/ui/econPresets.ts); every money number is
// under "Advanced". Edits BALANCE live; nothing is saved. ?econPreset=<id>
// opens a preset directly.

import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { isServiceKind } from '../sim/serviceValue';
import { ECON_PRESETS, type EconPreset } from './econPresets';
import { applyValues } from './pcPresets';
import { debugDock } from './debugDock';
import { balanceInputs, fold } from './tuningWidgets';

type Tree = Record<string, unknown>;
const B = BALANCE as unknown as Tree;
/** The parts of BALANCE this panel edits. */
const SECTIONS = ['tax', 'maintenance', 'buildings', 'roadClasses'] as const;

const LABELS: Record<string, string> = {
  zoneR: 'Homes, per level / tick', zoneC: 'Shops, per level / tick', zoneI: 'Industry, per level / tick',
  industryLandValueMult: 'Industry land-value mult', landValueFloor: 'Land-value tax floor',
  serviceMult: 'Service upkeep ×', maintenance: 'Upkeep / tick', cost: 'Cost',
};
const BUILDINGS: Record<string, string> = {
  1: 'Power plant', 2: 'Water tower', 3: 'Sewage plant', 4: 'Police', 5: 'Fire', 6: 'School', 7: 'Hospital', 8: 'Park',
};
const ROADS: Record<string, string> = { 1: 'Street', 2: 'Avenue', 3: 'Highway' };
const money = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;

export class EconomyTuningPanel {
  private readonly getWorld: () => World;
  private readonly readoutEl: HTMLElement;
  private readonly settingsEl: HTMLElement;
  private readonly desc: HTMLElement;
  private readonly buttons: { p: EconPreset; b: HTMLButtonElement }[] = [];
  private readonly defaults: Tree = Object.fromEntries(SECTIONS.map((k) => [k, structuredClone(B[k])]));
  private dirty = true;
  private lastSig = '';

  constructor(getWorld: () => World) {
    this.getWorld = getWorld;
    const panel = document.createElement('div');
    panel.style.cssText = 'flex:none;background:rgba(0,0,0,0.8);border:1px solid rgba(255,255,255,0.15);border-radius:8px;'
      + 'padding:10px 12px;font-size:11px;color:#ccd;line-height:1.5;backdrop-filter:blur(8px);';
    for (const type of ['mousedown', 'pointerdown', 'wheel', 'click', 'touchstart', 'keydown']) {
      panel.addEventListener(type, (e) => e.stopPropagation());
    }
    const title = document.createElement('div');
    title.style.cssText = 'font-weight:bold;color:#9ad;margin-bottom:4px;cursor:pointer;';
    panel.appendChild(title);
    this.readoutEl = document.createElement('div');
    this.readoutEl.style.cssText = 'margin-bottom:6px;color:#dde;';
    panel.appendChild(this.readoutEl);

    const body = document.createElement('div');
    panel.appendChild(body);
    const setTitle = () => { title.textContent = `Economy (debug) ${body.style.display === 'none' ? '▸' : '▾'}`; };
    title.addEventListener('click', () => { body.style.display = body.style.display === 'none' ? '' : 'none'; setTitle(); });
    setTitle();

    const picker = document.createElement('div');
    picker.style.cssText = `display:grid;grid-template-columns:repeat(${ECON_PRESETS.length},1fr);gap:3px;`;
    for (const p of ECON_PRESETS) {
      const b = document.createElement('button');
      b.textContent = p.name;
      b.title = p.desc;
      b.style.cssText = 'font-size:11px;padding:2px 0;cursor:pointer;border-radius:4px;border:1px solid #556;background:#223;color:#dde;';
      b.addEventListener('click', () => this.choose(p));
      picker.appendChild(b);
      this.buttons.push({ p, b });
    }
    body.appendChild(picker);
    this.desc = document.createElement('div');
    this.desc.style.cssText = 'margin:3px 0 4px;color:#aab;min-height:1.5em;';
    body.appendChild(this.desc);

    this.settingsEl = document.createElement('div');
    body.appendChild(fold('Advanced', this.settingsEl));
    debugDock().appendChild(panel);

    const fromUrl = new URLSearchParams(location.search).get('econPreset');
    this.choose(ECON_PRESETS.find((p) => p.id === fromUrl) ?? ECON_PRESETS[0]);
  }

  /** Reset the money numbers to shipped, then apply the preset. */
  private choose(p: EconPreset): void {
    applyValues(B, structuredClone(this.defaults));
    applyValues(B, structuredClone(p.values));
    for (const { p: bp, b } of this.buttons) {
      const on = bp === p;
      b.style.background = on ? '#4a7a9a' : '#223';     // the game's "selected" look
      b.style.borderColor = on ? '#8cc0e0' : '#556';
      b.style.color = on ? '#fff' : '#dde';
    }
    this.desc.textContent = `${p.name}: ${p.desc}`;
    this.buildSettings();
    this.dirty = true;
  }

  private buildSettings(): void {
    const el = this.settingsEl;
    el.replaceChildren();
    const onChange = () => { this.dirty = true; };
    const plain = (k: string) => LABELS[k] ?? k;
    balanceInputs(el, { tax: B.tax, maintenance: B.maintenance } as Tree, {
      label: (k) => (k === 'maintenance' ? 'Upkeep' : k === 'tax' ? 'Tax' : plain(k)), onChange,
      skip: (k) => k === 'road',   // roads are charged from roadClasses below; maintenance.road is unused
    });
    balanceInputs(el, { Buildings: B.buildings } as Tree, { label: (k) => BUILDINGS[k] ?? plain(k), onChange });
    balanceInputs(el, { Roads: B.roadClasses } as Tree, {
      label: (k) => ROADS[k] ?? plain(k), onChange,
      skip: (k) => k === 'capacity' || k === 'speedMult',   // traffic numbers live on the traffic panel
    });
  }

  /** Call every frame: refreshes the read-out on a new tick, when money changes, or after an edit. */
  update(): void {
    const world = this.getWorld();
    if (!world) return;
    const sig = `${world.tick}|${world.budget.money}`;
    if (!this.dirty && sig === this.lastSig) return;
    this.dirty = false;
    this.lastSig = sig;
    this.render(world);
  }

  private render(world: World): void {
    const perDay = BALANCE.ticksPerDay;
    // Expenses by group, the same sums EconomySystem charges per tick.
    let roads = 0, utilities = 0, services = 0;
    const { roads: list, roadCount } = world.index;
    for (let k = 0; k < roadCount; k++) roads += BALANCE.roadClasses[world.layers.roadClass[list[k]]]?.maintenance ?? 0;
    for (const b of world.buildings) {
      const m = BALANCE.buildings[b.kind]?.maintenance ?? 0;
      if (isServiceKind(b.kind)) services += m * BALANCE.maintenance.serviceMult; else utilities += m;
    }
    const income = world.budget.income * perDay;
    const expenses = (roads + utilities + services) * perDay;
    const net = income - expenses;
    const cash = world.budget.money;
    const line = (name: string, value: string, warn = false) =>
      `<div style="display:flex;justify-content:space-between;gap:8px"><span>${name}</span><span style="color:${warn ? '#f88' : '#fff'};text-align:right">${value}</span></div>`;
    let outlook: string;
    let warn = false;
    if (cash < 0 && net < 0) { outlook = 'stuck: in debt and losing money'; warn = true; }
    else if (net < 0) { outlook = `${Math.floor(cash / -net)} days to $0`; warn = cash / -net < 30; }
    else if (cash < 0) outlook = `out of debt in ${Math.ceil(-cash / Math.max(net, 1e-9))} days`;
    else outlook = 'growing';
    this.readoutEl.innerHTML =
        line('Money', money(cash), cash < 0)
      + line('Net / day', `${net >= 0 ? '+' : ''}${money(net)}`, net < 0)
      + line('Income / day', money(income))
      + line('Upkeep / day', money(expenses))
      + line('&nbsp;&nbsp;roads', money(roads * perDay))
      + line('&nbsp;&nbsp;utilities', money(utilities * perDay))
      + line('&nbsp;&nbsp;services', money(services * perDay))
      + line('Outlook', outlook, warn)
      + line('Upkeep banked', expenses > 0 ? `${Math.floor(cash / expenses)} days` : '—');
  }
}
