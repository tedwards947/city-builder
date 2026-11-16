// Developer-only Political Capital tuning panel (?debug=true), for the PC
// balance play-test. Every number under BALANCE.politicalCapital gets an
// input, built from the balance object itself, so a new setting shows up
// here without touching this file. The sim reads these numbers live, so a
// change takes effect on the next tick or hover. Nothing here is saved: use
// "Copy values" and paste the block into src/data/balance.ts to keep it.
// "Load proposed" switches on the numbers in pcPresets.ts; "Reset" goes
// back to the ones the page loaded with.

import type { World } from '../sim/World';
import type { PoliticsSystem } from '../sim/systems/PoliticsSystem';
import { BALANCE } from '../data/balance';
import { pcCap, regenRate } from '../sim/politics';
import * as C from '../sim/constants';
import { PROPOSED_PC, applyValues } from './pcPresets';
import { debugDock } from './debugDock';

// BALANCE is declared `as const`; the debug panels are the one place that edit it.
type Tree = Record<string, unknown>;
const PC = BALANCE.politicalCapital as unknown as Tree;

const TICK_SECONDS_AT_1X = 0.5; // Scheduler's base tick

const LABELS: Record<string, string> = {
  max: 'Cap at start',
  capPerResident: 'Cap per resident (peak)',
  baseRegen: 'Base regen / tick',
  satisfactionRegenBonus: 'Regen per satisfaction',
  neutralSatisfaction: 'Neutral satisfaction',
  satisfactionWeights: 'Satisfaction weights',
  disruptionCosts: 'Disruption',
  bulldozePerPop: 'Bulldoze, per resident',
  abandonedBuildingReward: 'Clear blight, per level',
  nuisance: 'Nuisance near homes',
  bands: 'Fall-off bands',
  industrialPerResident: 'Industry, per resident',
  buildingPerResident: 'Building, per resident',
  milestones: 'Milestones',
  ordinancesEnabled: 'Ordinances switched on',
  ordinances: 'Ordinances',
  service: 'Services',
  perResident: 'Opening, per resident',
  repeatFactor: 'Repeat factor',
  closureMultiplier: 'Closure multiplier',
};

// Records keyed by building kind (buildingPerResident, perResident).
const BUILDING_NAMES: Record<string, string> = {};
for (const [name, value] of Object.entries(C)) {
  if (name.startsWith('BUILDING_') && typeof value === 'number') {
    BUILDING_NAMES[String(value)] = name.slice(9).toLowerCase().replace(/_/g, ' ');
  }
}

// What a new row looks like in a list that may start empty.
const ROW_TEMPLATES: Record<string, Tree> = {
  bands: { within: 0, weight: 0 },
  milestones: { population: 0, reward: 0 },
};

const label = (key: string): string => LABELS[key] ?? BUILDING_NAMES[key] ?? key;
const isTree = (v: unknown): v is Tree => typeof v === 'object' && v !== null;

export class PoliticsTuningPanel {
  private readonly getWorld: () => World;
  private readonly getPolitics: () => PoliticsSystem | undefined;
  private readonly readoutEl: HTMLElement;
  private readonly settingsEl: HTMLElement;
  private readonly defaults: Tree = structuredClone(PC);
  private lastWorld: World | null = null;
  private lastTick = -1;

  constructor(getWorld: () => World, getPolitics: () => PoliticsSystem | undefined) {
    this.getWorld = getWorld;
    this.getPolitics = getPolitics;

    const panel = document.createElement('div');
    // In the debug dock, left of the stats box and toolbar.
    panel.style.cssText = 'flex:none;'
      + 'background:rgba(0,0,0,0.8);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:10px 12px;'
      + 'font-size:11px;color:#ccd;line-height:1.5;backdrop-filter:blur(8px);';
    for (const type of ['mousedown', 'pointerdown', 'wheel', 'click', 'touchstart', 'keydown']) {
      panel.addEventListener(type, (e) => e.stopPropagation());
    }

    const title = document.createElement('div');
    title.style.cssText = 'font-weight:bold;color:#9ad;margin-bottom:4px;cursor:pointer;';
    panel.appendChild(title);
    this.readoutEl = document.createElement('div');
    this.readoutEl.style.cssText = 'margin-bottom:6px;color:#dde;';
    panel.appendChild(this.readoutEl);

    // Settings start folded: the read-outs are what you watch while playing.
    const body = document.createElement('div');
    body.style.display = 'none';
    panel.appendChild(body);
    const setTitle = () => { title.textContent = `Political capital (debug) ${body.style.display === 'none' ? '▸' : '▾'}`; };
    title.addEventListener('click', () => { body.style.display = body.style.display === 'none' ? '' : 'none'; setTitle(); });
    setTitle();

    this.settingsEl = document.createElement('div');
    body.appendChild(this.settingsEl);
    this.buildSettings();

    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;gap:6px;margin-top:8px;';
    const mkButton = (text: string, onClick: (b: HTMLButtonElement) => void) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.style.cssText = 'flex:1;font-size:11px;padding:3px 6px;cursor:pointer;';
      b.addEventListener('click', () => onClick(b));
      buttons.appendChild(b);
    };
    const load = (values: Tree) => { applyValues(PC, structuredClone(values)); this.buildSettings(); this.renderReadout(); };
    mkButton('Load proposed', () => load(PROPOSED_PC as unknown as Tree));
    mkButton('Reset', () => load(this.defaults));
    mkButton('Copy values', (b) => {
      const text = this.valuesText();
      const done = () => { b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy values'; }, 1200); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => console.log(text));
      else console.log(text);
    });
    body.appendChild(buttons);

    const note = document.createElement('div');
    note.textContent = 'Not saved. Changes apply from the next tick or hover.';
    note.style.cssText = 'margin-top:6px;color:#888;';
    body.appendChild(note);

    debugDock().appendChild(panel);
  }

  /** Call every frame: refreshes the read-outs once per sim tick. */
  update(): void {
    const world = this.getWorld();
    if (world === this.lastWorld && world.tick === this.lastTick) return;
    this.lastWorld = world;
    this.lastTick = world.tick;
    this.renderReadout();
  }

  /** The current values as JSON, to paste over the politicalCapital block in balance.ts. */
  valuesText(): string {
    return 'politicalCapital: ' + JSON.stringify(PC, null, 2);
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  private buildSettings(): void {
    this.settingsEl.replaceChildren();
    this.addTree(this.settingsEl, PC, 0);
  }

  private addTree(parent: HTMLElement, tree: Tree, depth: number): void {
    for (const key of Object.keys(tree)) {
      const value = tree[key];
      if (typeof value === 'number') {
        parent.appendChild(this.numberRow(label(key), () => tree[key] as number, (v) => { tree[key] = v; }));
      } else if (typeof value === 'boolean') {
        parent.appendChild(this.checkboxRow(label(key), () => tree[key] as boolean, (v) => { tree[key] = v; }));
      } else if (Array.isArray(value)) {
        parent.appendChild(this.heading(label(key), depth));
        parent.appendChild(this.listSection(key, value as Tree[]));
      } else if (isTree(value)) {
        parent.appendChild(this.heading(label(key), depth));
        const box = document.createElement('div');
        box.style.paddingLeft = '6px';
        this.addTree(box, value, depth + 1);
        parent.appendChild(box);
      }
    }
  }

  /** A list of rows (fall-off bands, milestones) that can grow and shrink. */
  private listSection(key: string, list: Tree[]): HTMLElement {
    const box = document.createElement('div');
    box.style.paddingLeft = '6px';
    const render = () => {
      box.replaceChildren();
      list.forEach((row, k) => {
        const line = document.createElement('div');
        line.style.cssText = 'display:flex;gap:4px;align-items:center;margin:1px 0;';
        for (const field of Object.keys(row)) {
          if (typeof row[field] !== 'number') continue;
          const name = document.createElement('span');
          name.textContent = field;
          name.style.color = '#999';
          line.append(name, this.numberInput(() => row[field] as number, (v) => { row[field] = v; }, 54));
        }
        const remove = this.smallButton('×', () => { list.splice(k, 1); render(); this.renderReadout(); });
        line.appendChild(remove);
        box.appendChild(line);
      });
      box.appendChild(this.smallButton('+ add', () => {
        const last = list[list.length - 1];
        list.push(last ? { ...last } : { ...(ROW_TEMPLATES[key] ?? {}) });
        render();
        this.renderReadout();
      }));
    };
    render();
    return box;
  }

  private heading(text: string, depth: number): HTMLElement {
    const h = document.createElement('div');
    h.textContent = text;
    h.style.cssText = depth === 0
      ? 'margin-top:6px;color:#999;text-transform:uppercase;font-size:10px;letter-spacing:0.04em;'
      : 'margin-top:3px;color:#aab;';
    return h;
  }

  private numberRow(text: string, get: () => number, set: (v: number) => void): HTMLElement {
    const line = document.createElement('label');
    line.style.cssText = 'display:grid;grid-template-columns:1fr 70px;align-items:center;gap:6px;';
    const name = document.createElement('span');
    name.textContent = text;
    line.append(name, this.numberInput(get, set, 70));
    return line;
  }

  private checkboxRow(text: string, get: () => boolean, set: (v: boolean) => void): HTMLElement {
    const line = document.createElement('label');
    line.style.cssText = 'display:grid;grid-template-columns:1fr 70px;align-items:center;gap:6px;cursor:pointer;';
    const name = document.createElement('span');
    name.textContent = text;
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = get();
    box.style.justifySelf = 'start';
    box.addEventListener('change', () => { set(box.checked); this.renderReadout(); });
    line.append(name, box);
    return line;
  }

  private numberInput(get: () => number, set: (v: number) => void, width: number): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'number';
    input.value = String(get());
    // Arrow keys and the wheel move by a step that fits the number's size.
    const v0 = Math.abs(get());
    input.step = v0 === 0 ? '0.1' : String(10 ** Math.floor(Math.log10(v0) - 1));
    input.style.cssText = `width:${width}px;font-size:11px;background:#111;color:#fff;border:1px solid #444;border-radius:3px;padding:0 3px;`;
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      if (Number.isFinite(v)) { set(v); this.renderReadout(); }
    });
    return input;
  }

  private smallButton(text: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = text;
    b.style.cssText = 'font-size:10px;padding:0 5px;cursor:pointer;';
    b.addEventListener('click', onClick);
    return b;
  }

  // ── Read-outs ─────────────────────────────────────────────────────────────

  private renderReadout(): void {
    const world = this.getWorld();
    if (!world) return;
    const pc = world.budget.politicalCapital;
    const cap = pcCap(world);
    const sat = world.stats.satisfaction;
    const rate = regenRate(sat);
    const applied = world.politics.regen;
    const perDay = BALANCE.ticksPerDay;
    const fmt = (n: number, d = 2) => (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(d));
    const pct = (n: number) => `${Math.round(n * 100)}%`;
    const line = (name: string, value: string, warn = false) =>
      `<div style="display:flex;justify-content:space-between;gap:8px"><span>${name}</span><span style="color:${warn ? '#f88' : '#fff'};text-align:right">${value}</span></div>`;

    let refill = 'never (rate ≤ 0)';
    if (rate > 0) {
      const ticks = cap / rate;
      const secs = Math.round(ticks * TICK_SECONDS_AT_1X);
      refill = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} at 1× (${Math.round(ticks / perDay)} days)`;
    }

    const peak = world.politics.peakPopulation;
    const milestones = (PC.milestones as { population: number; reward: number }[]);
    const next = milestones.filter((m) => m.population > peak).sort((a, b) => a.population - b.population)[0];

    let html =
        line('PC', `${fmt(pc, 1)} / ${fmt(cap, 1)}${pc < 0 ? ' (debt)' : ''}`, pc <= 0)
      + line('Regen applied last tick', `${fmt(applied, 3)} (${fmt(applied * perDay)}/day)`, applied < 0)
      + line('Rate at this satisfaction', `${fmt(rate, 3)} (${fmt(rate * perDay)}/day)`, rate < 0)
      + line('Refill 0 → cap', refill)
      + line('Satisfaction', `${pct(sat)} (neutral ${pct(PC.neutralSatisfaction as number)})`, sat < (PC.neutralSatisfaction as number))
      + line('Population (peak)', `${world.stats.population} (${peak})`)
      + line('Next milestone', next ? `${next.population} pop → +${next.reward}` : 'none');

    const factors = this.getPolitics()?.lastFactors ?? [];
    if (factors.length) {
      html += '<div style="margin-top:4px;color:#999">Satisfaction factors (value × weight)</div>';
      for (const f of factors) html += line(f.name, `${pct(f.value)} × ${f.weight}`, f.value < 0.5);
    }
    this.readoutEl.innerHTML = html;
  }
}
