// Developer-only traffic tuning panel (?debug=true). Sliders write straight
// into BALANCE and the traffic pass is recomputed at once, so the overlay
// shows the effect while the game is paused. Nothing here is saved: use
// "Copy values" and paste the numbers into src/data/balance.ts to keep them.

import type { World } from '../sim/World';
import { BALANCE } from '../data/balance';
import { trafficTotals } from './trafficDebug';

interface Knob {
  label: string;
  min: number; max: number; step: number;
  get(): number;
  set(v: number): void;
}

// BALANCE is declared `as const`; the panel is the one place that edits it.
const transit = BALANCE.transit as unknown as Record<string, number>;
const roadClasses = BALANCE.roadClasses;

function transitKnob(key: string, label: string, min: number, max: number, step: number): Knob {
  return { label, min, max, step, get: () => transit[key], set: (v) => { transit[key] = v; } };
}
function roadKnob(cls: number, field: 'capacity' | 'speedMult', label: string, min: number, max: number, step: number): Knob {
  return { label, min, max, step, get: () => roadClasses[cls][field], set: (v) => { roadClasses[cls][field] = v; } };
}

const GROUPS: [string, Knob[]][] = [
  ['Trips per building level', [
    transitKnob('tripsRtoC', 'Homes → commerce', 0, 1, 0.01),
    transitKnob('tripsRtoI', 'Homes → industry', 0, 1, 0.01),
    transitKnob('tripsItoC', 'Industry → commerce', 0, 1, 0.01),
  ]],
  ['Road capacity (trips)', [
    roadKnob(1, 'capacity', 'Street', 5, 200, 1),
    roadKnob(2, 'capacity', 'Avenue', 5, 400, 1),
    roadKnob(3, 'capacity', 'Highway', 5, 800, 5),
  ]],
  ['Road speed (× street)', [
    roadKnob(1, 'speedMult', 'Street', 0.5, 4, 0.1),
    roadKnob(2, 'speedMult', 'Avenue', 0.5, 4, 0.1),
    roadKnob(3, 'speedMult', 'Highway', 0.5, 6, 0.1),
  ]],
  ['Destinations and jams', [
    transitKnob('shopCapacity', 'Trips per shop level', 0.25, 10, 0.25),
    transitKnob('jobCapacity', 'Trips per job level', 0.25, 10, 0.25),
    transitKnob('congestionDelay', 'Slowdown when full', 0, 4, 0.1),
  ]],
  ['Effect on growth', [
    transitKnob('commuteMax', 'Commute limit (tiles)', 8, 200, 1),
    transitKnob('accessFloor', 'Growth at zero access', 0, 1, 0.01),
    transitKnob('congestionGrowthPenalty', 'Congestion penalty', 0, 1, 0.01),
  ]],
];

export class TrafficTuningPanel {
  private readonly getWorld: () => World;
  private readonly recompute: () => void;
  private readonly totalsEl: HTMLElement;
  private readonly inputs: { knob: Knob; input: HTMLInputElement; value: HTMLElement }[] = [];
  private readonly defaults: number[];
  private lastVersion = -1;
  private lastWorld: World | null = null;

  constructor(getWorld: () => World, recompute: () => void) {
    this.getWorld = getWorld;
    this.recompute = recompute;

    const el = document.createElement('div');
    // Sits under the stats box in the top-right corner.
    el.style.cssText = 'position:absolute;top:296px;right:12px;width:270px;max-height:calc(100vh - 400px);overflow:auto;'
      + 'background:rgba(0,0,0,0.8);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:10px 12px;'
      + 'font-size:11px;color:#ccd;line-height:1.5;backdrop-filter:blur(8px);z-index:40;';
    // Keep clicks and scrolls on the panel from reaching the map.
    for (const type of ['mousedown', 'pointerdown', 'wheel', 'click', 'touchstart']) {
      el.addEventListener(type, (e) => e.stopPropagation());
    }

    const title = document.createElement('div');
    title.textContent = 'Traffic tuning (debug) ▾';
    title.style.cssText = 'font-weight:bold;color:#9ad;margin-bottom:4px;cursor:pointer;';
    el.appendChild(title);

    this.totalsEl = document.createElement('div');
    this.totalsEl.style.cssText = 'margin-bottom:6px;color:#dde;';
    el.appendChild(this.totalsEl);

    // Everything below the totals folds away when the title is clicked.
    const outer = el;
    const body = document.createElement('div');
    outer.appendChild(body);
    title.addEventListener('click', () => {
      const open = body.style.display === 'none';
      body.style.display = open ? '' : 'none';
      title.textContent = `Traffic tuning (debug) ${open ? '▾' : '▸'}`;
    });
    {
      const el = body; // the controls below go into the folding part

    for (const [groupName, knobs] of GROUPS) {
      const h = document.createElement('div');
      h.textContent = groupName;
      h.style.cssText = 'margin-top:6px;color:#999;text-transform:uppercase;font-size:10px;letter-spacing:0.04em;';
      el.appendChild(h);
      for (const knob of knobs) {
        const line = document.createElement('label');
        line.style.cssText = 'display:grid;grid-template-columns:108px 1fr 38px;align-items:center;gap:6px;';
        const name = document.createElement('span');
        name.textContent = knob.label;
        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(knob.min); input.max = String(knob.max); input.step = String(knob.step);
        input.style.cssText = 'width:100%;margin:0;';
        const value = document.createElement('span');
        value.style.cssText = 'text-align:right;font-variant-numeric:tabular-nums;color:#fff;';
        input.addEventListener('input', () => {
          knob.set(parseFloat(input.value));
          this.sync();
          this.recompute();
          this.renderTotals();
        });
        line.append(name, input, value);
        el.appendChild(line);
        this.inputs.push({ knob, input, value });
      }
    }
    this.defaults = this.inputs.map(({ knob }) => knob.get());

    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;gap:6px;margin-top:8px;';
    const mkButton = (text: string, onClick: (b: HTMLButtonElement) => void) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.style.cssText = 'flex:1;font-size:11px;padding:3px 6px;cursor:pointer;';
      b.addEventListener('click', () => onClick(b));
      buttons.appendChild(b);
    };
    mkButton('Reset', () => {
      this.inputs.forEach(({ knob }, k) => knob.set(this.defaults[k]));
      this.sync();
      this.recompute();
      this.renderTotals();
    });
    mkButton('Copy values', (b) => {
      const text = this.valuesText();
      const done = () => { b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy values'; }, 1200); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => console.log(text));
      else console.log(text);
    });
    el.appendChild(buttons);

    const note = document.createElement('div');
    note.textContent = 'Not saved. Turn on the traffic overlay (T) to see the effect.';
    note.style.cssText = 'margin-top:6px;color:#888;';
    el.appendChild(note);
    }

    document.body.appendChild(outer);
    this.sync();
  }

  /** Call every frame: refreshes the totals when a new traffic pass has run. */
  update(): void {
    const world = this.getWorld();
    const version = world.traffic ? world.traffic.version : -1;
    if (world === this.lastWorld && version === this.lastVersion) return;
    this.lastWorld = world;
    this.lastVersion = version;
    this.renderTotals();
  }

  /** The current values, laid out like the entries in balance.ts. */
  valuesText(): string {
    const T = transit;
    const rc = roadClasses;
    return [
      `transit: tripsRtoC: ${T.tripsRtoC}, tripsRtoI: ${T.tripsRtoI}, tripsItoC: ${T.tripsItoC}, `
        + `shopCapacity: ${T.shopCapacity}, jobCapacity: ${T.jobCapacity}, congestionDelay: ${T.congestionDelay}, `
        + `commuteMax: ${T.commuteMax}, accessFloor: ${T.accessFloor}, congestionGrowthPenalty: ${T.congestionGrowthPenalty}`,
      `roadClasses: street { capacity: ${rc[1].capacity}, speedMult: ${rc[1].speedMult} }, `
        + `avenue { capacity: ${rc[2].capacity}, speedMult: ${rc[2].speedMult} }, `
        + `highway { capacity: ${rc[3].capacity}, speedMult: ${rc[3].speedMult} }`,
    ].join('\n');
  }

  private sync(): void {
    for (const { knob, input, value } of this.inputs) {
      const v = knob.get();
      input.value = String(v);
      value.textContent = knob.step < 1 ? v.toFixed(knob.step < 0.1 ? 2 : 1) : String(v);
    }
  }

  private renderTotals(): void {
    const tot = trafficTotals(this.getWorld());
    if (!tot) { this.totalsEl.textContent = 'No traffic pass yet — unpause for a moment.'; return; }
    const line = (label: string, value: string, warn = false) =>
      `<div style="display:flex;justify-content:space-between"><span>${label}</span><span style="color:${warn ? '#f88' : '#fff'}">${value}</span></div>`;
    this.totalsEl.innerHTML =
        line('Roads carrying traffic', `${tot.usedPct.toFixed(0)}% of ${tot.roads}`)
      + line('Roads over capacity', `${tot.overPct.toFixed(1)}%`, tot.overPct > 10)
      + line('Worst road', `${Math.round(tot.worstRatio * 100)}% of capacity`, tot.worstRatio > 2)
      + line('Trips on the network', tot.trips.toFixed(0))
      + line('Average commute', `${tot.avgCommute.toFixed(1)} tiles`)
      + line('Homes past commute limit', `${tot.overLimitPct.toFixed(1)}%`, tot.overLimitPct > 5)
      + line('Homes cut off', `${tot.cutOffPct.toFixed(1)}% of ${tot.homes}`, tot.cutOffPct > 5)
      + line('Shop trips vs capacity', `${Math.round(tot.shopDemand * 100)}%`, tot.shopDemand > 1)
      + line('Job trips vs capacity', `${Math.round(tot.jobDemand * 100)}%`, tot.jobDemand > 1)
      + (tot.settled ? '' : line('Traffic', 'still settling…'));
  }
}
