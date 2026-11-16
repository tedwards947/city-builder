import { World } from './sim/World';
import { Camera } from './render/Camera';
import { CanvasRenderer } from './render/CanvasRenderer';
import type { RoadPreview, ZonePreview } from './render/CanvasRenderer';
import { localizeHTML, t, tArray } from './i18n';
import type { FailReason } from './commands/Command';

localizeHTML();

import { CommandHistory } from './commands/CommandHistory';
import { Scheduler } from './sim/Scheduler';
import { createSystems } from './sim/createSystems';
import { computeServiceCoverage } from './sim/systems/ServiceSystem';
import type { TransitSystem } from './sim/systems/TransitSystem';
import { VibeSystem } from './sim/systems/VibeSystem';
import { InputController, roadClassForTool, zoneForTool } from './input/InputController';
import type { Tool, RoadMode } from './input/InputController';
import { autoRoadPath, planAutoRoad } from './input/autoRoad';
import { planZoneFill } from './input/zoneFill';
import type { ZoneMode } from './input/zoneFill';
import { loadZoneMode, saveZoneMode } from './ui/zoneMode';
import { loadRoadMode, saveRoadMode } from './ui/RoadModeMenu';
import { Toolbar, toolbarItems } from './ui/Toolbar';
import { LocalStore } from './persistence/LocalStore';
import { SaveManager } from './persistence/SaveManager';
import { Autosave, AUTOSAVE_SLOT } from './persistence/Autosave';
import { MusicManager } from './audio/MusicManager';
import { NewGameDialog } from './ui/NewGameDialog';
import { SaveLoadPanel } from './ui/SaveLoadPanel';
import { MusicPanel } from './ui/MusicPanel';
import { TileInfoPanel } from './ui/TileInfoPanel';
import { BadgeTooltip } from './ui/BadgeTooltip';
import { PcFloat } from './ui/PcFloat';
import { pcOfCap, pcRate } from './ui/pcFormat';
import { pcCap } from './sim/politics';
import { hoverPcPreview, nuisanceTints, pcLabel } from './ui/pcPreview';
import type { PcPreview } from './ui/pcPreview';
import type { PcQuote } from './sim/politics';
import { toolPrice, buildingKindForTool } from './ui/Toolbar';
import { EconPanel } from './ui/EconPanel';
import { ToastPanel } from './ui/ToastPanel';
import { DemandChart } from './ui/DemandChart';
import { TrafficOverlay } from './render/TrafficOverlay';
import { TrafficTuningPanel } from './ui/TrafficTuningPanel';
import { DEBUG } from './debug';
import { BALANCE } from './data/balance';
import {
  BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL, BUILDING_PARK,
  ZONE_R, ZONE_C, ZONE_I,
} from './sim/constants';

// Initialize the sprite registry

const SERVICE_TOOL_KIND: Partial<Record<Tool, number>> = {
  police: BUILDING_POLICE,
  fire:   BUILDING_FIRE,
  school: BUILDING_SCHOOL,
  hospital: BUILDING_HOSPITAL,
  park:   BUILDING_PARK,
};

// ── Canvas / Camera / Renderer ────────────────────────────────────────────────
// Must come first — startGame() uses camera.

const canvas       = document.getElementById('canvas') as HTMLCanvasElement;
const camera       = new Camera(window.innerWidth, window.innerHeight);
const renderer     = new CanvasRenderer(canvas);
const trafficOverlay = new TrafficOverlay();

function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width  = Math.floor(window.innerWidth  * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width  = window.innerWidth  + 'px';
  canvas.style.height = window.innerHeight + 'px';
  renderer.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  camera.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();

// ── Mutable game state ────────────────────────────────────────────────────────
// Single object so closures always see the current world/history/scheduler.

const state = {
  world:     null as unknown as World,
  history:   null as unknown as CommandHistory,
  scheduler: null as unknown as Scheduler,
  transit:   null as unknown as TransitSystem,
};

// Developer tools, only with ?debug=true.
const trafficTuning = DEBUG
  ? new TrafficTuningPanel(() => state.world, () => state.transit.recompute(state.world))
  : null;

// UI Panels (must be initialized before first startGame call)
const tileInfoPanel = new TileInfoPanel();
const badgeTooltip = new BadgeTooltip(canvas, (x, y) => renderer.badgeAt(x, y));
const econPanel = new EconPanel(() => state.world);
const toastPanel = new ToastPanel();
const pcFloat = new PcFloat(document.getElementById('game')!, camera);
const demandChart = new DemandChart();

const store   = new LocalStore();
// Old saves without vibe layers get them seeded on load. bootstrapVibes keeps
// no state, so a throwaway VibeSystem is enough.
const manager = new SaveManager(store, 'local', {
  bootstrapVibes: (world) => new VibeSystem().bootstrapVibes(world),
});
const autosave = new Autosave(manager, () => state.world);

function syncSpeedButtons(): void {
  const speed = state.scheduler.speed;
  document.querySelectorAll<HTMLButtonElement>('.speed').forEach(b =>
    b.classList.toggle('active', parseInt(b.dataset.speed ?? '0', 10) === speed));
}

function startGame(world: World): void {
  state.world     = world;
  state.history   = new CommandHistory(world);
  // Systems carry per-game state, so every new or loaded world gets a fresh set.
  const sim = createSystems();
  state.transit = sim.transit;
  // Settle traffic now, while the city is loading, rather than on the first
  // traffic tick: that pass is the costliest of the game (~20 ms on a big
  // city), and roads show their traffic from the first frame.
  sim.transit.recompute(world);
  state.scheduler = new Scheduler(world, sim.systems);
  syncSpeedButtons();
  autosave.reset();
  toastPanel.setWorld(world);
  pcFloat.setWorld(world);
  camera.centerOnTile(world.grid.width / 2, world.grid.height / 2);
  document.getElementById('hint')?.classList.remove('hidden');
}

const saveLoadPanel = new SaveLoadPanel(
  manager,
  () => state.world,
  (world) => startGame(world),
);

const newGameDialog = new NewGameDialog((opts) => {
  startGame(new World(opts.width, opts.height, opts.seed, { waterAmount: opts.waterAmount, vegAmount: opts.vegAmount }));
});

// Start with the default world so everything below has a world to point at.
// If an autosave exists it replaces this as soon as it has loaded (see the
// bottom of this file); the frame loop does not start until then.
startGame(new World(256, 256, 42, { vegAmount: 'low' }));

// ── Input ─────────────────────────────────────────────────────────────────────

let currentTool: Tool = 'none';
let hoverTile: { tx: number; ty: number } | null = null;
// At most one overlay is shown at a time.
type Overlay = 'none' | 'traffic' | 'crime' | 'fire' | 'vibe';
let overlay: Overlay = 'none';

// A refused click or drag says why, at most once every few seconds per reason
// (a drag stroke can be refused on every tile it crosses).
const REJECT_TOAST_MS = 4000;
const lastRejectToast: Record<string, number> = {};
function notifyRejected(reason: FailReason): void {
  const now = performance.now();
  if (now - (lastRejectToast[reason] ?? -Infinity) < REJECT_TOAST_MS) return;
  lastRejectToast[reason] = now;
  toastPanel.showToast(
    t('ui.toast.cantBuildTitle'),
    t(reason === 'funds' ? 'ui.toast.noFunds' : 'ui.toast.noPoliticalCapital'),
    'warning',
  );
}

// Road tools: 'manual' = drag to draw, 'auto' = click a start, click an end.
// Set by the switch in the toolbar's Roads fly-out (wired up below).
let roadMode: RoadMode = loadRoadMode();
// Zone tools: 'drag' = paint tile by tile, 'fill' = click beside a road to zone
// the lots along it. Set by the switch in the toolbar's Zones fly-out.
let zoneMode: ZoneMode = loadZoneMode();

const input = new InputController(
  canvas,
  camera,
  () => state.world,
  () => state.history,
  () => currentTool,
  (tile) => { hoverTile = tile; },
  (reason) => notifyRejected(reason),
  () => roadMode,
  () => zoneMode,
);

// ── Event Listeners ───────────────────────────────────────────────────────────

const toolbar = new Toolbar(document.getElementById('toolbar')!, roadMode, zoneMode, {
  onTool: (tool) => setTool(tool),
  onOverlay: (which) => toggleOverlay(which),
  onAction: (action) => {
    switch (action) {
      case 'new':    newGameDialog.show(); break;
      case 'save':   saveLoadPanel.showSave(); break;
      case 'load':   saveLoadPanel.showLoad(); break;
      case 'undo':   state.history.undo(); break;
      case 'redo':   state.history.redo(); break;
      case 'budget': {
        // The budget panel opens beside the stats and toolbar column, however wide that is.
        const panel = document.getElementById('econ-panel')!;
        const column = document.getElementById('hud-right')!.getBoundingClientRect();
        panel.style.right = (window.innerWidth - column.left + 8) + 'px';
        econPanel.toggle();
        break;
      }
    }
  },
  onRoadMode: (mode) => {
    roadMode = mode;
    saveRoadMode(mode);
    input.cancelAutoRoad();   // a half-laid road does not carry over
  },
  onZoneMode: (mode) => {
    zoneMode = mode;
    saveZoneMode(mode);
  },
});

/** The PC part of a plan's price tag: nothing if PC does not come into it. */
function pcTag(q: PcQuote): { text: string; ok: boolean; note?: string } | undefined {
  const text = pcLabel(q);
  if (!text) return undefined;
  return { text, ok: q.affordable, note: q.affordable ? undefined : t('ui.hud.pcShort') };
}

/** The homes a plan would upset, tinted; the plan's own tag carries the price. */
function planPcPreview(at: { tx: number; ty: number }, q: PcQuote): PcPreview | null {
  const tints = nuisanceTints(q);
  return tints.length ? { at, rings: [], tints, label: '', ok: q.affordable } : null;
}

/** Toggle one overlay; turning one on turns the others off. */
function toggleOverlay(which: Exclude<Overlay, 'none'>): void {
  overlay = overlay === which ? 'none' : which;
  toolbar.setOverlay(overlay);
}

function setTool(tool: Tool): void {
  currentTool = tool;
  tileInfoPanel.setVisible(tool === 'inspect');
  toolbar.setTool(tool);
  document.getElementById('hint')?.classList.add('hidden');
}

// ── Speed buttons ─────────────────────────────────────────────────────────────

document.querySelectorAll<HTMLButtonElement>('.speed').forEach(btn => {
  btn.addEventListener('click', () => {
    setSpeed(parseInt(btn.dataset.speed ?? '1', 10));
  });
});

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
      || target.tagName === 'SELECT' || target.isContentEditable;
}

function setSpeed(speed: number): void {
  state.scheduler.setSpeed(speed);
  syncSpeedButtons();
}

window.addEventListener('keydown', (e) => {
  // Never steal keys from text fields (seed input, etc.).
  if (isTypingTarget(e.target)) return;

  const key = e.key.toLowerCase();

  // Escape backs out one step at a time: an open fly-out closes, then a road
  // started in auto mode is abandoned, and with nothing left to cancel the
  // tool goes back to View.
  if (key === 'escape') {
    if (toolbar.closeFlyout()) return;
    if (input.autoRoadStart) { input.cancelAutoRoad(); return; }
    setTool('none');
    return;
  }

  // Undo / redo are the only shortcuts that use Ctrl/Cmd.
  if (e.ctrlKey || e.metaKey) {
    if (key === 'z' && !e.altKey) {
      e.preventDefault();
      if (e.shiftKey) state.history.redo(); else state.history.undo();
    } else if (key === 'y' && e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      state.history.redo();
    }
    return; // leave every other Ctrl/Cmd combo (reload, copy, …) to the browser
  }
  if (e.altKey) return;


  if (key === ' ') {
    e.preventDefault();
    setSpeed(state.scheduler.speed === 0 ? 1 : 0);
    return;
  }
  // Tool and overlay keys come from the toolbar list, so the tooltips cannot lie.
  const item = toolbarItems().find(i => i.hotkey === key);
  if (item?.tool !== undefined) setTool(item.tool);
  else if (item?.overlay !== undefined) toggleOverlay(item.overlay);
});

// ── HUD ───────────────────────────────────────────────────────────────────────

const statTile  = document.getElementById('stat-tile')!;
const statCam   = document.getElementById('stat-cam')!;
const statZoom  = document.getElementById('stat-zoom')!;
const statPC    = document.getElementById('stat-pc')!;
const statPCRate = document.getElementById('stat-pc-rate')!;
const pcBar     = document.getElementById('pc-bar')!;
const statMoney = document.getElementById('stat-money')!;
const statDebt  = document.getElementById('stat-debt')!;
const statPop   = document.getElementById('stat-pop')!;
const statPower = document.getElementById('stat-power')!;
const statWater  = document.getElementById('stat-water')!;
const statSewage = document.getElementById('stat-sewage')!;
const statServices   = document.getElementById('stat-services')!;
const statCongestion = document.getElementById('stat-congestion')!;
const statDate   = document.getElementById('stat-date')!;

function formatMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(Math.floor(n));
  if (abs >= 1_000_000) return sign + '$' + (abs / 1_000_000).toFixed(1) + 'M';
  if (abs >= 10_000)    return sign + '$' + (abs / 1_000).toFixed(1) + 'k';
  return sign + '$' + abs;
}

function formatDate(tick: number): string {
  const totalDays = Math.floor(tick / BALANCE.ticksPerDay);
  const year      = 1900 + Math.floor(totalDays / 360);
  const dayOfYear = totalDays % 360;
  const month     = Math.floor(dayOfYear / 30) + 1;
  const day       = (dayOfYear % 30) + 1;
  const months    = tArray('common.months');
  return (months[month - 1] ?? '???') + ' ' + day + ', ' + year;
}

const ZONE_PREVIEW_COLOR: Record<number, string> = {
  [ZONE_R]: '#6fd86f', [ZONE_C]: '#8faee0', [ZONE_I]: '#e0b060',
};

// ── Main loop ─────────────────────────────────────────────────────────────────

function frame(now: number): void {
  state.scheduler.update(now);
  // A road edit shows in the traffic straight away, even while paused.
  state.transit.refreshIfRoadsChanged(state.world);
  autosave.tick(now, state.scheduler.speed === 0);
  const serviceKind = SERVICE_TOOL_KIND[currentTool];
  const coveragePreview = (serviceKind !== undefined && hoverTile)
    ? computeServiceCoverage(state.world, hoverTile.tx, hoverTile.ty, serviceKind)
    : null;
  // Auto road mode: the road that a click would build now, and its price.
  // Zone fill mode: the lots a click would zone now, and their price.
  // Political capital at the pointer. A plan (zone fill, auto road) carries its
  // own merged quote; otherwise it is quoted for the one tile under the pointer.
  let pcPreview: PcPreview | null = null;
  let zonePreview: ZonePreview | null = null;
  const fillZone = zoneMode === 'fill' ? zoneForTool(currentTool) : undefined;
  if (fillZone !== undefined && hoverTile) {
    const plan = planZoneFill(state.world, hoverTile, fillZone);
    zonePreview = {
      tiles: plan.tiles, ok: plan.affordable, at: hoverTile,
      color: ZONE_PREVIEW_COLOR[fillZone] ?? '#fff',
      label: '$' + plan.cost.toLocaleString('en-US'),
      pc: pcTag(plan.pc),
    };
    pcPreview = planPcPreview(hoverTile, plan.pc);
  }
  let roadPreview: RoadPreview | null = null;
  const roadStart = input.autoRoadStart;
  const roadClass = roadClassForTool(currentTool);
  if (roadStart && hoverTile && roadClass !== undefined) {
    const plan = planAutoRoad(state.world, autoRoadPath(roadStart, hoverTile), roadClass);
    roadPreview = { tiles: plan.tiles, ok: plan.affordable, label: '$' + plan.cost.toLocaleString('en-US'), pc: pcTag(plan.pc) };
    pcPreview = planPcPreview(hoverTile, plan.pc);
  }
  if (!zonePreview && !roadPreview && hoverTile) {
    pcPreview = hoverPcPreview(state.world, currentTool, hoverTile);
    if (pcPreview) {
      if (buildingKindForTool(currentTool) !== undefined) pcPreview.money = toolPrice(currentTool).cost;
      if (!pcPreview.ok) pcPreview.note = t('ui.hud.pcShort');
    }
  }
  renderer.render(state.world, camera, {
    pcPreview,
    hoverTile, tool: currentTool, coveragePreview, now, roadPreview, zonePreview,
    overlay: overlay === 'traffic' ? 'none' : overlay,   // the traffic overlay is drawn separately, below
  });
  if (overlay === 'traffic') trafficOverlay.render(renderer.ctx, state.world, camera, hoverTile);
  trafficTuning?.update();
  tileInfoPanel.update(state.world, hoverTile);
  badgeTooltip.update(currentTool === 'inspect');
  econPanel.update();
  const { rDemand, cDemand, iDemand } = state.world.stats;
  demandChart.update(state.world.tick, rDemand, cDemand, iDemand);
  if (hoverTile) statTile.textContent = `${hoverTile.tx}, ${hoverTile.ty}`;
  statCam.textContent   = `${Math.round(camera.x)}, ${Math.round(camera.y)}`;
  statZoom.textContent  = camera.zoom.toFixed(2) + '×';
  const pc = state.world.budget.politicalCapital;
  // Shown as "pc / cap". One-off bonuses can lift it past the cap: the bar
  // stays full and the figure brightens.
  const pcMax = pcCap(state.world);
  const pcOver = Math.floor(pc) > pcMax;
  statPC.textContent = pcOfCap(pc, pcMax);
  statPC.classList.toggle('critical', pc < pcMax * 0.2);
  statPC.classList.toggle('low',      pc >= pcMax * 0.2 && pc < pcMax * 0.5);
  statPC.classList.toggle('over',     pcOver);
  pcBar.classList.toggle('over', pcOver);
  // The passive rate per game day. An unhappy city drains: red figure, striped bar.
  const pcPerDay = state.world.politics.regen * BALANCE.ticksPerDay;
  const draining = pcPerDay < -0.05;
  statPCRate.textContent = pcRate(pcPerDay) || (pcOver ? t('ui.hud.pcBonus') : Math.floor(pc) >= pcMax ? t('ui.hud.pcFull') : '');
  statPCRate.classList.toggle('draining', draining);
  statPC.classList.toggle('draining', draining);
  pcBar.classList.toggle('draining', draining);
  (pcBar as HTMLElement).style.width = Math.max(0, Math.min(100, (pc / pcMax) * 100)).toFixed(1) + '%';
  (pcBar as HTMLElement).style.background = pcOver ? '#c9fff1' : pc < pcMax * 0.2 ? '#e07070' : pc < pcMax * 0.5 ? '#e0b050' : '#7dd8c0';
  statMoney.textContent = formatMoney(state.world.budget.money);
  statMoney.classList.toggle('negative', state.world.budget.money < 0);
  statDebt.hidden = state.world.budget.money >= 0;
  statPop.textContent   = state.world.stats.population.toLocaleString();
  // Demand / supply; red while demand outruns supply.
  const utility = (el: HTMLElement, demand: number, supply: number) => {
    el.textContent = `${demand} / ${supply}`;
    el.classList.toggle('short', demand > supply);
  };
  const stats = state.world.stats;
  utility(statPower, stats.powerDemand, stats.powerSupply);
  utility(statWater, stats.waterDemand, stats.waterSupply);
  utility(statSewage, stats.sewageDemand, stats.sewageSupply);
  statServices.textContent   = `${state.world.stats.servicesCoveredZones}`;
  statCongestion.textContent = `${state.world.stats.avgCongestion}`;
  statDate.textContent       = formatDate(state.world.tick);
  requestAnimationFrame(frame);
}

// ── Autosave ──────────────────────────────────────────────────────────────────
// Saved every ~60s of unpaused play (autosave.tick in the frame loop) and
// whenever the tab is hidden or closed.

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void autosave.saveNow();
});
window.addEventListener('pagehide', () => { void autosave.saveNow(); });

// Resume the autosaved city if there is one, then start the frame loop.
manager.loadGame(AUTOSAVE_SLOT)
  .then(world => { if (world) startGame(world); })
  .catch(err => console.warn('Could not load autosave:', err))
  .finally(() => requestAnimationFrame(frame));

// ── Music ─────────────────────────────────────────────────────────────────────

const musicManager = new MusicManager((name) => musicPanel.onTrackChange(name));
const musicPanel = new MusicPanel(musicManager);

// Auto-play on first interaction
const startMusic = () => {
  musicManager.start();
  musicPanel.updateUI();
  window.removeEventListener('mousedown', startMusic);
  window.removeEventListener('touchstart', startMusic);
  window.removeEventListener('keydown', startMusic);
};
window.addEventListener('mousedown', startMusic);
window.addEventListener('touchstart', startMusic);
window.addEventListener('keydown', startMusic);
