import { World } from './sim/World';
import { Camera } from './render/Camera';
import { CanvasRenderer } from './render/CanvasRenderer';
import { localizeHTML, t, tArray } from './i18n';
import type { FailReason } from './commands/Command';

localizeHTML();

import { CommandHistory } from './commands/CommandHistory';
import { Scheduler } from './sim/Scheduler';
import { createSystems } from './sim/createSystems';
import { computeServiceCoverage } from './sim/systems/ServiceSystem';
import type { TransitSystem } from './sim/systems/TransitSystem';
import { VibeSystem } from './sim/systems/VibeSystem';
import { InputController } from './input/InputController';
import type { Tool } from './input/InputController';
import { LocalStore } from './persistence/LocalStore';
import { SaveManager } from './persistence/SaveManager';
import { Autosave, AUTOSAVE_SLOT } from './persistence/Autosave';
import { MusicManager } from './audio/MusicManager';
import { NewGameDialog } from './ui/NewGameDialog';
import { SaveLoadPanel } from './ui/SaveLoadPanel';
import { MusicPanel } from './ui/MusicPanel';
import { TileInfoPanel } from './ui/TileInfoPanel';
import { EconPanel } from './ui/EconPanel';
import { ToastPanel } from './ui/ToastPanel';
import { DemandChart } from './ui/DemandChart';
import { TrafficOverlay } from './render/TrafficOverlay';
import { TrafficTuningPanel } from './ui/TrafficTuningPanel';
import { DEBUG } from './debug';
import { BALANCE } from './data/balance';
import {
  BUILDING_POWER_PLANT, BUILDING_WATER_TOWER, BUILDING_SEWAGE_PLANT,
  BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL, BUILDING_PARK,
  ROAD_STREET, ROAD_AVENUE, ROAD_HIGHWAY,
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
const econPanel = new EconPanel(() => state.world);
const toastPanel = new ToastPanel();
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
  state.scheduler = new Scheduler(world, sim.systems);
  syncSpeedButtons();
  autosave.reset();
  toastPanel.setWorld(world);
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

new InputController(
  canvas,
  camera,
  () => state.world,
  () => state.history,
  () => currentTool,
  (tile) => { hoverTile = tile; },
  (reason) => notifyRejected(reason),
);

// ── Event Listeners ───────────────────────────────────────────────────────────

document.getElementById('btn-new')!.addEventListener('click',  () => newGameDialog.show());
document.getElementById('btn-save')!.addEventListener('click', () => saveLoadPanel.showSave());
document.getElementById('btn-load')!.addEventListener('click', () => saveLoadPanel.showLoad());
document.getElementById('btn-econ')!.addEventListener('click', () => econPanel.toggle());

const overlayButtons: Record<Exclude<Overlay, 'none'>, HTMLElement | null> = {
  traffic: document.getElementById('btn-traffic'),
  crime:   document.getElementById('btn-crime'),
  fire:    document.getElementById('btn-fire'),
  vibe:    document.getElementById('btn-vibe'),
};

/** Toggle one overlay; turning one on turns the others off. */
function toggleOverlay(which: Exclude<Overlay, 'none'>): void {
  overlay = overlay === which ? 'none' : which;
  for (const [name, btn] of Object.entries(overlayButtons)) {
    btn?.classList.toggle('active', name === overlay);
  }
}
for (const [name, btn] of Object.entries(overlayButtons)) {
  btn?.addEventListener('click', () => toggleOverlay(name as Exclude<Overlay, 'none'>));
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

function setTool(tool: Tool): void {
  currentTool = tool;
  tileInfoPanel.setVisible(tool === 'inspect');
  document.querySelectorAll('.tool[data-tool]').forEach(b =>
    b.classList.toggle('active', (b as HTMLButtonElement).dataset.tool === tool));
  document.getElementById('hint')?.classList.add('hidden');
}

document.querySelectorAll<HTMLButtonElement>('.tool[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => {
    const tool = btn.dataset.tool as Tool | 'undo' | 'redo';
    if (tool === 'undo') { state.history.undo(); return; }
    if (tool === 'redo') { state.history.redo(); return; }
    setTool(tool);
  });
});

// ── Toolbar costs ─────────────────────────────────────────────────────────────
// Tooltip cost/upkeep come from BALANCE so they can't drift from the sim.

function fmtCost(n: number): string {
  return '$' + n.toLocaleString('en-US');
}
function fmtUpkeep(n: number, perTile: boolean): string {
  const digits = Number.isInteger(n) ? 0 : 2;
  return '$' + n.toFixed(digits) + (perTile ? '/tile/tick' : '/tick');
}

const TOOL_ROAD_CLASS: Partial<Record<Tool, number>> = {
  road: ROAD_STREET, avenue: ROAD_AVENUE, highway: ROAD_HIGHWAY,
};
const TOOL_BUILDING_KIND: Partial<Record<Tool, number>> = {
  power: BUILDING_POWER_PLANT, water: BUILDING_WATER_TOWER, sewage: BUILDING_SEWAGE_PLANT,
  ...SERVICE_TOOL_KIND,
};
const TOOL_FLAT_COST: Partial<Record<Tool, number>> = {
  zoneR: BALANCE.costs.zoneR, zoneC: BALANCE.costs.zoneC, zoneI: BALANCE.costs.zoneI,
  bulldoze: BALANCE.costs.bulldoze,
};

document.querySelectorAll<HTMLButtonElement>('.tool[data-tool]').forEach(btn => {
  const tool = btn.dataset.tool as Tool;
  const roadClass = TOOL_ROAD_CLASS[tool];
  const kind = TOOL_BUILDING_KIND[tool];
  if (roadClass !== undefined) {
    const rc = BALANCE.roadClasses[roadClass];
    btn.dataset.cost   = fmtCost(rc.cost);
    btn.dataset.upkeep = fmtUpkeep(rc.maintenance, true);
  } else if (kind !== undefined) {
    const b = BALANCE.buildings[kind];
    btn.dataset.cost   = fmtCost(b.cost);
    btn.dataset.upkeep = fmtUpkeep(b.maintenance, false);
  } else if (TOOL_FLAT_COST[tool] !== undefined) {
    btn.dataset.cost = fmtCost(TOOL_FLAT_COST[tool]!);
  }
});

// ── Toolbar tooltips ──────────────────────────────────────────────────────────

const tip        = document.getElementById('toolbar-tip')!;
const tipDesc    = tip.querySelector('.tip-desc')!;
const tipCost    = tip.querySelector('.tip-cost')!;
const tipUpkeep  = tip.querySelector('.tip-upkeep')!;

function isBuildingTool(btn: HTMLButtonElement): boolean {
  return TOOL_BUILDING_KIND[btn.dataset.tool as Tool] !== undefined;
}

document.querySelectorAll<HTMLButtonElement>('#toolbar button').forEach(btn => {
  const desc = btn.dataset.desc;
  if (!desc) return;
  btn.addEventListener('mouseenter', () => {
    tipDesc.textContent = desc;
    const cost = btn.dataset.cost;
    tipCost.textContent = cost ? cost + (isBuildingTool(btn) ? '' : ' / tile') : '';
    (tipCost as HTMLElement).style.display = cost ? '' : 'none';
    const upkeep = btn.dataset.upkeep;
    tipUpkeep.textContent = upkeep ? 'Upkeep: ' + upkeep : '';
    (tipUpkeep as HTMLElement).style.display = upkeep ? '' : 'none';
    const rect = btn.getBoundingClientRect();
    tip.style.left = Math.min(rect.left + rect.width / 2, window.innerWidth - 160) + 'px';
    tip.style.transform = 'translateX(-50%)';
    tip.classList.add('visible');
  });
  btn.addEventListener('mouseleave', () => tip.classList.remove('visible'));
});

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


  switch (key) {
    case '1': setTool('none'); break;
    case '2': setTool('road'); break;
    case 'a': setTool('avenue'); break;
    case 'h': setTool('highway'); break;
    case '3': setTool('zoneR'); break;
    case '4': setTool('zoneC'); break;
    case '5': setTool('zoneI'); break;
    case '6': setTool('power'); break;
    case '7': setTool('water'); break;
    case '8': setTool('sewage'); break;
    case '9': setTool('bulldoze'); break;
    case '0': setTool('police'); break;
    case 'q': setTool('fire'); break;
    case 'w': setTool('school'); break;
    case 'e': setTool('hospital'); break;
    case 'r': setTool('park'); break;
    case 'i': setTool('inspect'); break;
    case 't': toggleOverlay('traffic'); break;
    case 'c': toggleOverlay('crime'); break;
    case 'f': toggleOverlay('fire'); break;
    case 'v': toggleOverlay('vibe'); break;
    case ' ':
      e.preventDefault();
      setSpeed(state.scheduler.speed === 0 ? 1 : 0);
      break;
  }
});

// ── HUD ───────────────────────────────────────────────────────────────────────

const statTile  = document.getElementById('stat-tile')!;
const statCam   = document.getElementById('stat-cam')!;
const statZoom  = document.getElementById('stat-zoom')!;
const statPC    = document.getElementById('stat-pc')!;
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
  renderer.render(state.world, camera, hoverTile, currentTool, overlay === 'crime', overlay === 'fire', overlay === 'vibe', coveragePreview, now);
  if (overlay === 'traffic') trafficOverlay.render(renderer.ctx, state.world, camera, hoverTile);
  trafficTuning?.update();
  tileInfoPanel.update(state.world, hoverTile);
  econPanel.update();
  const { rDemand, cDemand, iDemand } = state.world.stats;
  demandChart.update(state.world.tick, rDemand, cDemand, iDemand);
  if (hoverTile) statTile.textContent = `${hoverTile.tx}, ${hoverTile.ty}`;
  statCam.textContent   = `${Math.round(camera.x)}, ${Math.round(camera.y)}`;
  statZoom.textContent  = camera.zoom.toFixed(2) + '×';
  const pc = state.world.budget.politicalCapital;
  const pcMax = BALANCE.politicalCapital.max;
  statPC.textContent = Math.floor(pc).toString();
  statPC.classList.toggle('critical', pc < pcMax * 0.2);
  statPC.classList.toggle('low',      pc >= pcMax * 0.2 && pc < pcMax * 0.5);
  (pcBar as HTMLElement).style.width = Math.max(0, Math.min(100, (pc / pcMax) * 100)).toFixed(1) + '%';
  (pcBar as HTMLElement).style.background = pc < pcMax * 0.2 ? '#e07070' : pc < pcMax * 0.5 ? '#e0b050' : '#7dd8c0';
  statMoney.textContent = formatMoney(state.world.budget.money);
  statMoney.classList.toggle('negative', state.world.budget.money < 0);
  statDebt.hidden = state.world.budget.money >= 0;
  statPop.textContent   = state.world.stats.population.toLocaleString();
  statPower.textContent = `${state.world.stats.powerDemand} / ${state.world.stats.powerSupply}`;
  statWater.textContent  = `${state.world.stats.waterDemand} / ${state.world.stats.waterSupply}`;
  statSewage.textContent   = `${state.world.stats.sewageDemand} / ${state.world.stats.sewageSupply}`;
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
