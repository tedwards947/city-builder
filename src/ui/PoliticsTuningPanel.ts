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
import { pcCap, regenPerTick } from '../sim/politics';
import * as C from '../sim/constants';
import { PC_VARIANTS, applyValues, type PcVariant } from './pcPresets';
import { debugDock } from './debugDock';
import { REQUEST_KINDS, requestConfig, openRequest, meetRequest, failRequest, neediestFor } from '../sim/requests';

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
  private readonly advanceTicks: (n: number) => void;
  private readonly requestsEl: HTMLElement;
  private readonly detailEl: HTMLElement;
  private readonly variantButtons: { v: PcVariant | null; b: HTMLButtonElement }[] = [];
  private readonly variantDesc: HTMLElement;
  private requestIds = '';
  private requestLeft: { el: HTMLElement; deadline: number }[] = [];
  private readonly readoutEl: HTMLElement;
  private readonly settingsEl: HTMLElement;
  private readonly defaults: Tree = structuredClone(PC);
  private lastWorld: World | null = null;
  private lastTick = -1;

  constructor(getWorld: () => World, getPolitics: () => PoliticsSystem | undefined, advanceTicks: (n: number) => void = () => {}) {
    this.getWorld = getWorld;
    this.getPolitics = getPolitics;
    this.advanceTicks = advanceTicks;

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

    // Simple mode (the default view): the read-out above, a variant picker,
    // then Shortcuts and Advanced folded away. The title folds it all.
    const body = document.createElement('div');
    panel.appendChild(body);
    const setTitle = () => { title.textContent = `Political capital (debug) ${body.style.display === 'none' ? '▸' : '▾'}`; };
    title.addEventListener('click', () => { body.style.display = body.style.display === 'none' ? '' : 'none'; setTitle(); });
    setTitle();

    const picker = document.createElement('div');
    picker.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:3px;';
    for (const v of [...PC_VARIANTS, null]) {
      const b = document.createElement('button');
      b.textContent = v ? v.id : 'Off';
      b.title = v ? `${v.id} ${v.name}: ${v.desc}` : 'The shipped numbers (Political Capital effects switched off)';
      b.style.cssText = 'font-size:11px;padding:2px 0;cursor:pointer;border-radius:4px;border:1px solid #556;background:#223;color:#dde;';
      b.addEventListener('click', () => this.chooseVariant(v));
      picker.appendChild(b);
      this.variantButtons.push({ v, b });
    }
    body.appendChild(picker);
    this.variantDesc = document.createElement('div');
    this.variantDesc.style.cssText = 'margin:3px 0 4px;color:#aab;min-height:1.5em;';
    body.appendChild(this.variantDesc);

    this.requestsEl = document.createElement('div');
    body.appendChild(this.fold('Shortcuts', this.playTestTools()));

    const advanced = document.createElement('div');
    this.detailEl = document.createElement('div');
    this.detailEl.style.cssText = 'margin:4px 0;color:#dde;';
    advanced.appendChild(this.detailEl);
    this.settingsEl = document.createElement('div');
    advanced.appendChild(this.settingsEl);
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
    mkButton('Copy values', (b) => {
      const text = this.valuesText();
      const done = () => { b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy values'; }, 1200); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => console.log(text));
      else console.log(text);
    });
    advanced.appendChild(buttons);
    const note = document.createElement('div');
    note.textContent = 'Not saved. Changes apply from the next tick or hover. Open a variant directly with ?pcPreset=A…D.';
    note.style.cssText = 'margin-top:6px;color:#888;';
    advanced.appendChild(note);
    body.appendChild(this.fold('Advanced', advanced));

    debugDock().prepend(panel); // first in the dock: it is what the PC play-test watches

    const fromUrl = new URLSearchParams(location.search).get('pcPreset')?.toUpperCase();
    this.chooseVariant(PC_VARIANTS.find((v) => v.id === fromUrl) ?? null, false);
  }

  /** Reset to the shipped numbers, then apply the variant (null = shipped). */
  private chooseVariant(v: PcVariant | null, apply = true): void {
    if (apply || v) {
      applyValues(PC, structuredClone(this.defaults));
      if (v) applyValues(PC, structuredClone(v.values));
      this.buildSettings();
      this.renderReadout();
    }
    for (const { v: bv, b } of this.variantButtons) {
      const on = bv === v;
      // The game's "selected" look (toolbar tiles, speed buttons).
      b.style.background = on ? '#4a7a9a' : '#223';
      b.style.borderColor = on ? '#8cc0e0' : '#556';
      b.style.color = on ? '#fff' : '#dde';
    }
    this.variantDesc.textContent = v ? `${v.id} ${v.name}: ${v.desc}` : 'Off: the shipped numbers.';
  }

  /** A section with a clickable heading that starts folded. */
  private fold(text: string, content: HTMLElement): HTMLElement {
    const box = document.createElement('div');
    const h = this.heading('', 0);
    h.style.cursor = 'pointer';
    content.style.display = 'none';
    const set = () => { h.textContent = `${text} ${content.style.display === 'none' ? '▸' : '▾'}`; };
    h.addEventListener('click', () => { content.style.display = content.style.display === 'none' ? '' : 'none'; set(); });
    set();
    box.append(h, content);
    return box;
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

  // ── Play-test tools: reach tricky states quickly ─────────────────────────────

  private playTestTools(): HTMLElement {
    const box = document.createElement('div');
    const row = (...els: HTMLElement[]) => {
      const r = document.createElement('div');
      r.style.cssText = 'display:flex;gap:4px;align-items:center;margin:2px 0;';
      r.append(...els);
      box.appendChild(r);
    };
    const button = (text: string, onClick: () => void) => {
      const b = this.smallButton(text, () => { onClick(); this.renderReadout(); });
      b.style.fontSize = '11px';
      return b;
    };
    const numberBox = (value: number, width = 54) => {
      const input = document.createElement('input');
      input.type = 'number';
      input.value = String(value);
      input.style.cssText = `width:${width}px;font-size:11px;background:#111;color:#fff;border:1px solid #444;border-radius:3px;padding:0 3px;`;
      return input;
    };

    const pc = numberBox(-20);
    row(pc,
      button('Set PC', () => { const v = parseFloat(pc.value); if (Number.isFinite(v)) this.getWorld().budget.politicalCapital = v; }),
      button('Fill to cap', () => { const w = this.getWorld(); w.budget.politicalCapital = pcCap(w); }));

    const kind = document.createElement('select');
    kind.style.cssText = 'font-size:11px;max-width:130px;';
    for (const k of REQUEST_KINDS) kind.add(new Option(k.id, k.id));
    row(kind, button('Spawn request', () => {
      const w = this.getWorld();
      const area = neediestFor(w, kind.value);
      if (!area) { console.log('No neighbourhood with enough homes yet.'); return; }
      openRequest(w, kind.value, area, requestConfig().kinds[kind.value]?.days || 20);
    }));

    const days = numberBox(1, 40);
    row(days, button('Advance days', () => {
      const n = Math.max(0, Math.round(parseFloat(days.value) || 0));
      this.advanceTicks(n * BALANCE.ticksPerDay);
    }));

    box.appendChild(this.requestsEl);
    return box;
  }

  /** Open requests with Meet / Fail buttons; rebuilt only when the set changes, so a click is never lost. */
  private renderRequests(): void {
    const world = this.getWorld();
    const open = world.politics.requests;
    const ids = open.map((r) => r.id).join(',');
    if (ids !== this.requestIds) {
      this.requestIds = ids;
      this.requestsEl.replaceChildren();
      this.requestLeft = [];
      for (const r of open) {
        const line = document.createElement('div');
        line.style.cssText = 'display:flex;gap:4px;align-items:center;margin:1px 0;';
        const name = document.createElement('span');
        name.style.flex = '1';
        name.textContent = `#${r.id} ${r.kind} @${r.x0},${r.y0}`;
        const left = document.createElement('span');
        left.style.color = '#999';
        line.append(name, left,
          this.smallButton('Meet', () => { meetRequest(this.getWorld(), r); this.renderReadout(); }),
          this.smallButton('Fail', () => { failRequest(this.getWorld(), r); this.renderReadout(); }));
        this.requestsEl.appendChild(line);
        this.requestLeft.push({ el: left, deadline: r.deadlineTick });
      }
    }
    for (const { el, deadline } of this.requestLeft) {
      el.textContent = `${Math.max(0, Math.ceil((deadline - world.tick) / BALANCE.ticksPerDay))}d`;
    }
  }

  private renderReadout(): void {
    const world = this.getWorld();
    if (!world) return;
    const pc = world.budget.politicalCapital;
    const cap = pcCap(world);
    const sat = world.stats.satisfaction;
    const rate = regenPerTick(world, sat); // what the sim applies: scales with the cap
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
    this.detailEl.innerHTML = html;
    this.readoutEl.innerHTML =
        line('PC', `${fmt(pc, 1)} / ${fmt(cap, 1)}${pc < 0 ? ' (debt)' : ''}`, pc <= 0)
      + line('Rate', `${fmt(rate * perDay)}/day`, rate < 0)
      + line('Refill 0 → cap', refill);
    this.renderRequests();
  }
}
