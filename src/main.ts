import { isLargeBuilding } from './sim/buildingShapes';
import { placementAnchor } from './input/InputController';
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
import { SoundEffects } from './audio/SoundEffects';
import { NewGameDialog } from './ui/NewGameDialog';
import { SaveLoadPanel } from './ui/SaveLoadPanel';
import { DebtUi } from './ui/DebtUi';
import { hasCapacity, seatsIfOpened } from './sim/serviceCapacity';
import { seatWords } from './ui/capacityFormat';
import { MusicPanel } from './ui/MusicPanel';
import { TileInfoPanel } from './ui/TileInfoPanel';
import { BadgeTooltip } from './ui/BadgeTooltip';
import { PcFloat } from './ui/PcFloat';
import { pcOfCap, pcHudRate } from './ui/pcFormat';
import { DOCK_CHANGED } from './ui/debugDock';
import { pcCap, overCapFadePerDay } from './sim/politics';
import { hoverPcPreview, nuisanceTints, pcLabel, pcNote, isQuietNuisance } from './ui/pcPreview';
import { MilestoneBanner } from './ui/MilestoneBanner';
import { OrdinancePanel, ordinancesShown } from './ui/OrdinancePanel';
import { RequestFeedback, requestText } from './ui/RequestFeedback';
import { RequestLog, requestLogState } from './ui/RequestLog';
import { progressView } from './ui/requestInfo';
import type { AreaHighlight } from './render/CanvasRenderer';
import { clusterTiles, type ClusterFields, type TilePoint } from './render/clay/tileOutline';
import { REQUEST_COLOUR } from './render/clay/requestBadges';
import type { PcPreview } from './ui/pcPreview';
import type { PcQuote } from './sim/politics';
import { toolPrice, buildingKindForTool } from './ui/Toolbar';
import { EconPanel } from './ui/EconPanel';
import { ToastPanel } from './ui/ToastPanel';
import { DemandChart } from './ui/DemandChart';
import { TrafficOverlay } from './render/TrafficOverlay';
import { TrafficTuningPanel } from './ui/TrafficTuningPanel';
import { PoliticsTuningPanel } from './ui/PoliticsTuningPanel';
import { EconomyTuningPanel } from './ui/EconomyTuningPanel';
import { PoliticsSystem } from './sim/systems/PoliticsSystem';
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
  politics:  undefined as PoliticsSystem | undefined,
};

// Developer tools, only with ?debug=true.
const trafficTuning = DEBUG
  ? new TrafficTuningPanel(() => state.world, () => state.transit.recompute(state.world))
  : null;
const politicsTuning = DEBUG
  ? new PoliticsTuningPanel(() => state.world, () => state.politics, (n) => { for (let k = 0; k < n; k++) state.scheduler.tick(); })
  : null;
const economyTuning = DEBUG ? new EconomyTuningPanel(() => state.world) : null;
// For agents driving the page in a headless browser (?debug=true only):
// `__city.world`, `__city.camera.centerOnTile(x, y)`, `__city.tick(n)`.
if (DEBUG) {
  (window as unknown as { __city: unknown }).__city = {
    get world() { return state.world; },
    camera,
    tick: (n = 1) => { for (let k = 0; k < n; k++) state.scheduler.tick(); },
  };
}

// UI Panels (must be initialized before first startGame call)
const tileInfoPanel = new TileInfoPanel();
const badgeTooltip = new BadgeTooltip(canvas, (x, y) => renderer.badgeAt(x, y), (x, y) => {
  // A resident request: what they want, how long is left, what is at stake.
  const b = renderer.requestAt(x, y);
  if (!b) return null;
  const text = requestText(b.request, state.world.tick);
  const view = progressView(state.world, b.request), pct = view.bar;
  const progress = `<div style="color:#7dd8c0;margin-top:3px">${view.text}</div>` + (pct
    ? `<div style="position:relative;height:5px;border-radius:3px;background:rgba(255,255,255,0.14);margin:3px 0 1px"><i style="position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:#7dd8c0;width:${Math.min(100, pct.covered)}%"></i><u style="position:absolute;top:-3px;bottom:-3px;width:2px;background:#fff;left:${Math.min(100, pct.needed)}%"></u></div>`
    : '');
  const more = b.count > 1 ? ` <span style="color:#98a2b0;font-weight:400">· ${t('ui.requests.more', { n: b.count - 1 })}</span>` : '';
  return {
    key: `request:${b.request.id}:${b.count}:${text.stakes}:${view.text}`,
    html: `<div style="font-weight:700;color:#fff;margin-bottom:2px"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;background:${REQUEST_COLOUR}"></span>${text.title}${more}</div>${text.body}${progress}<div style="color:#7dd8c0;margin-top:3px">${text.stakes}</div>`,
  };
});
const econPanel = new EconPanel(() => state.world);
const toastPanel = new ToastPanel();
// Sound effects only listen (world events, toolbar and toast DOM); see src/audio/SoundEffects.ts.
const sfx = new SoundEffects({ camera, getWorld: () => state.world, getSpeed: () => state.scheduler.speed });
const pcFloat = new PcFloat(document.getElementById('game')!, camera);
const requestFeedback = new RequestFeedback((title, message, type, place) => toastPanel.showToast(title, message, type, place));
const milestoneBanner = new MilestoneBanner(document.getElementById('game')!, (title, message) => toastPanel.showToast(title, message, 'info'));
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
  state.politics = sim.systems.find((s): s is PoliticsSystem => s instanceof PoliticsSystem);
  // Settle traffic now, while the city is loading, rather than on the first
  // traffic tick: that pass is the costliest of the game (~20 ms on a big
  // city), and roads show their traffic from the first frame.
  sim.transit.recompute(world);
  state.scheduler = new Scheduler(world, sim.systems);
  syncSpeedButtons();
  autosave.reset();
  toastPanel.setWorld(world);
  pcFloat.setWorld(world);
  milestoneBanner.setWorld(world);
  requestFeedback.setWorld(world);
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
  sfx.refused();
  const now = performance.now();
  if (now - (lastRejectToast[reason] ?? -Infinity) < REJECT_TOAST_MS) return;
  lastRejectToast[reason] = now;
  toastPanel.showToast(
    t('ui.toast.cantBuildTitle'),
    t(reason === 'funds' ? 'ui.toast.noFunds' : reason === 'noWater' ? 'ui.toast.needsWater' : 'ui.toast.noPoliticalCapital'),
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

const ordinancePanel = new OrdinancePanel(document.getElementById('game')!, () => state.world);

// Jumping to a place: a toast about somewhere, or a quest-log row, moves the
// camera there, and the place is outlined and blinks for a moment.
const ARRIVAL_MS = 2600;
let arrival: { x0: number; y0: number; x1: number; y1: number; at: number; tiles?: TilePoint[] } | null = null;
function focusArea(place: { x0: number; y0: number; x1: number; y1: number } & ClusterFields): void {
  camera.focusOn(place.x0, place.y0, place.x1, place.y1);
  arrival = { x0: place.x0, y0: place.y0, x1: place.x1, y1: place.y1, at: performance.now(), tiles: clusterTiles(place, state.world.grid.width) ?? undefined };
}
toastPanel.onGo = focusArea;
const requestLog = new RequestLog(document.getElementById('game')!, () => state.world, (req) => focusArea(req));

// Where the pointer is over the map, for outlining the request whose badge it is on.
const pointer = { x: 0, y: 0, inside: false };
canvas.addEventListener('pointermove', (e) => {
  const r = canvas.getBoundingClientRect();
  pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.inside = true;
});
canvas.addEventListener('pointerleave', () => { pointer.inside = false; });

/** The areas to outline this frame: where the camera just jumped (three blinks), and the request under the pointer. */
function areaHighlights(now: number): AreaHighlight[] {
  const out: AreaHighlight[] = [];
  if (arrival) {
    const age = (now - arrival.at) / ARRIVAL_MS;
    if (age >= 1) arrival = null;
    else out.push({ ...arrival, alpha: 0.25 + 0.75 * Math.abs(Math.sin(age * Math.PI * 3)) * (age > 0.85 ? (1 - age) / 0.15 : 1) });
  }
  if (currentTool === 'inspect' && pointer.inside) {
    const b = renderer.requestAt(pointer.x, pointer.y);
    if (b) out.push({ x0: b.request.x0, y0: b.request.y0, x1: b.request.x1, y1: b.request.y1, alpha: 1, tiles: clusterTiles(b.request, state.world.grid.width) ?? undefined });
  }
  return out;
}

/** The Budget, Ordinances and Requests panels open in the same spot: opening one closes the others. */
function togglePanel(which: 'budget' | 'ordinances' | 'requests'): void {
  if (which !== 'budget' && econPanel.isOpen) econPanel.toggle();
  if (which !== 'ordinances') ordinancePanel.close();
  if (which !== 'requests') requestLog.close();
  if (which === 'budget') { document.getElementById('econ-panel')!.style.right = besideHud() + 'px'; econPanel.toggle(); }
  else if (which === 'ordinances') ordinancePanel.toggle(besideHud());
  else requestLog.toggle(besideHud());
}
/** Where a panel opened from the toolbar sits: just left of the stats and toolbar column. */
function besideHud(): number {
  // With ?debug=true a dock of tuning panels sits beside the column; open left of that.
  const edge = document.getElementById('debug-dock') ?? document.getElementById('hud-right')!;
  return window.innerWidth - edge.getBoundingClientRect().left + 8;
}

// The debug dock changes width when it folds: keep an open panel beside it, not under it.
window.addEventListener(DOCK_CHANGED, () => {
  const right = besideHud() + 'px';
  for (const id of ['econ-panel', 'ordinance-panel', 'request-log']) { const el = document.getElementById(id); if (el) el.style.right = right; }
  toastsMovedFor = '';
});

const toolbar = new Toolbar(document.getElementById('toolbar')!, roadMode, zoneMode, {
  onTool: (tool) => setTool(tool),
  onOverlay: (which) => toggleOverlay(which),
  onAction: (action) => {
    if (action !== 'undo' && action !== 'redo') sfx.menuClicked();
    switch (action) {
      case 'new':    newGameDialog.show(); break;
      case 'save':   saveLoadPanel.showSave(); break;
      case 'load':   saveLoadPanel.showLoad(); break;
      case 'undo':   sfx.undo(state.history.canUndo); state.history.undo(); break;
      case 'redo':   sfx.redo(state.history.canRedo); state.history.redo(); break;
      case 'budget':     togglePanel('budget'); break;
      case 'ordinances': togglePanel('ordinances'); break;
      case 'requests':   togglePanel('requests'); break;
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
  if (!text || isQuietNuisance(q)) return undefined;   // neighbours objecting to a zone: the tint says it
  return { text, ok: q.affordable, note: pcNote(q, state.world) };
}

/** The homes a plan would upset, tinted; the plan's own tag carries the price. */
function planPcPreview(at: { tx: number; ty: number }, q: PcQuote): PcPreview | null {
  const tints = nuisanceTints(q);
  return tints.length ? { at, rings: [], tints, label: '', ok: q.affordable } : null;
}

/**
 * Toasts appear top centre. When the Budget or Ordinances panel is open and
 * would sit under them, the toasts move left so they do not cover its rows.
 */
let toastsMovedFor = '';
function keepToastsClear(): void {
  const open = requestLog.isOpen ? document.getElementById('request-log') : ordinancePanel.isOpen ? document.getElementById('ordinance-panel') : econPanel.isOpen ? document.getElementById('econ-panel') : null;
  const key = (open ? open.id : '') + ':' + window.innerWidth;
  if (key === toastsMovedFor) return;
  toastsMovedFor = key;
  const toasts = document.getElementById('toast-container');
  if (!toasts) return;
  const half = toasts.offsetWidth / 2 || 140;
  const centre = window.innerWidth / 2;
  const panelLeft = open ? open.getBoundingClientRect().left : Infinity;
  // Keep the toasts' right edge 12px clear of the panel, but never push them off the left edge.
  toasts.style.left = centre + half + 12 > panelLeft ? Math.max(half + 8, panelLeft - 12 - half) + 'px' : '';
}

/** Toggle one overlay; turning one on turns the others off. */
function toggleOverlay(which: Exclude<Overlay, 'none'>): void {
  overlay = overlay === which ? 'none' : which;
  toolbar.setOverlay(overlay);
  sfx.menuClicked();
}

function setTool(tool: Tool): void {
  currentTool = tool;
  sfx.toolPicked(tool);
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
  // Game over: the card takes the pointer; hotkeys do nothing either.
  if (debtUi.blocking) return;

  const key = e.key.toLowerCase();

  // Escape backs out one step at a time: an open fly-out closes, then a road
  // started in auto mode is abandoned, and with nothing left to cancel the
  // tool goes back to View.
  if (key === 'escape') {
    if (toolbar.closeFlyout()) return;
    if (ordinancePanel.close()) return;
    if (requestLog.close()) return;
    if (input.autoRoadStart) { input.cancelAutoRoad(); return; }
    setTool('none');
    return;
  }

  // Undo / redo are the only shortcuts that use Ctrl/Cmd.
  if (e.ctrlKey || e.metaKey) {
    if (key === 'z' && !e.altKey) {
      e.preventDefault();
      if (e.shiftKey) { sfx.redo(state.history.canRedo); state.history.redo(); }
      else { sfx.undo(state.history.canUndo); state.history.undo(); }
    } else if (key === 'y' && e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      sfx.redo(state.history.canRedo);
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
  if (item?.action === 'ordinances') { if (ordinancesShown()) togglePanel('ordinances'); }
  else if (item?.action === 'requests') { if (!item.shown || item.shown()) togglePanel('requests'); }
  else if (item?.tool !== undefined) setTool(item.tool);
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
if (DEBUG) {
  // Play-test helper: a little money on demand, next to the money figure.
  const more = document.createElement('button');
  more.id = 'debug-money';
  more.type = 'button';
  more.textContent = '+$10k';
  more.addEventListener('click', () => { state.world.budget.money += 10000; });
  statMoney.after(more);
}
const debtUi = new DebtUi({
  getWorld: () => state.world, formatMoney,
  onLoad: () => saveLoadPanel.showLoad(), onNew: () => newGameDialog.show(),
});
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
      label: plan.cost > 0 ? '$' + plan.cost.toLocaleString('en-US') : t('ui.toolbar.free'),
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
    } else {
      // A building on several tiles always shows its price at the pointer, where it can go.
      const kind = buildingKindForTool(currentTool);
      if (kind !== undefined && isLargeBuilding(kind)) {
        const a = placementAnchor(kind, hoverTile.tx, hoverTile.ty);
        const blocker = state.world.placeBlocker(a.tx, a.ty, kind);
        if (blocker === null) pcPreview = { at: hoverTile, building: { kind, tx: a.tx, ty: a.ty }, rings: [], tints: [], label: '', ok: true, money: toolPrice(currentTool).cost };
        // The land is free but there is no water beside it (a water pump): say so at the pointer.
        else if (blocker === 'noWater') pcPreview = { at: hoverTile, building: { kind, tx: a.tx, ty: a.ty }, rings: [], tints: [], label: '', ok: false, money: toolPrice(currentTool).cost, note: t('ui.hud.needsWater') };
      }
    }
  }
  // Seats and beds on the map while placing a school or hospital, or looking at one.
  let seatView: { kind: number; gained: readonly number[] } | null = null;
  if (serviceKind !== undefined && hasCapacity(serviceKind)) {
    const can = hoverTile !== null && state.world.isBuildable(hoverTile.tx, hoverTile.ty, false);
    const change = can ? seatsIfOpened(state.world, hoverTile!.tx, hoverTile!.ty, serviceKind) : null;
    seatView = { kind: serviceKind, gained: change ? change.gained : [] };
    // What the new building would do, under the price, unless the tag already has something to say.
    if (change && change.gainedResidents > 0 && !pcPreview?.note) {
      // With no political cost there is no tag yet: show the price so the note has somewhere to go.
      pcPreview ??= { at: hoverTile!, rings: [], tints: [], label: '', ok: true, money: toolPrice(currentTool).cost };
      pcPreview.note = t(seatWords(serviceKind) + '.gain', { n: Math.round(change.gainedResidents).toLocaleString('en-US') });
      pcPreview.good = true;
    }
  } else if (currentTool === 'inspect' && hoverTile) {
    const kind = state.world.layers.building[state.world.grid.idx(hoverTile.tx, hoverTile.ty)];
    if (kind !== 0 && hasCapacity(kind)) seatView = { kind, gained: [] };
  }
  renderer.render(state.world, camera, {
    seatView,
    pcPreview,
    requestOutcomes: requestFeedback.outcomes(performance.now()),
    areaHighlights: areaHighlights(performance.now()),
    hoverTile, tool: currentTool, coveragePreview, now, roadPreview, zonePreview,
    overlay: overlay === 'traffic' ? 'none' : overlay,   // the traffic overlay is drawn separately, below
  });
  if (overlay === 'traffic') trafficOverlay.render(renderer.ctx, state.world, camera, hoverTile);
  trafficTuning?.update();
  politicsTuning?.update();
  economyTuning?.update();
  tileInfoPanel.update(state.world, hoverTile);
  badgeTooltip.update(currentTool === 'inspect');
  requestLogState.open = state.world.politics.requests.length;
  toolbar.syncShown();
  requestLog.update();
  keepToastsClear();
  if (ordinancePanel.isOpen && !ordinancesShown()) ordinancePanel.close();   // switched off while open
  ordinancePanel.update();
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
  // Political debt (below 0, from closing services): everything that costs PC is refused until it is paid off.
  const inDebt = pc < 0;
  // Over the cap the banked extra slowly fades: "−0.4/day" beside the brightened figure.
  const rateText = pcHudRate(pcPerDay, overCapFadePerDay(state.world), pcOver, Math.floor(pc) >= pcMax,
    { bonus: t('ui.hud.pcBonus'), full: t('ui.hud.pcFull') });
  statPCRate.textContent = inDebt ? (t('ui.hud.pcDebt') + ' ' + rateText).trim() : rateText;
  statPC.classList.toggle('debt', inDebt);
  statPCRate.classList.toggle('debt', inDebt);
  pcBar.parentElement!.classList.toggle('debt', inDebt);
  statPCRate.classList.toggle('draining', draining);
  statPC.classList.toggle('draining', draining);
  pcBar.classList.toggle('draining', draining);
  (pcBar as HTMLElement).style.width = Math.max(0, Math.min(100, (pc / pcMax) * 100)).toFixed(1) + '%';
  (pcBar as HTMLElement).style.background = pcOver ? '#c9fff1' : pc < pcMax * 0.2 ? '#e07070' : pc < pcMax * 0.5 ? '#e0b050' : '#7dd8c0';
  statMoney.textContent = formatMoney(state.world.budget.money);
  statMoney.classList.toggle('negative', state.world.budget.money < 0);
  debtUi.update();
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
const musicPanel = new MusicPanel(musicManager, sfx);
sfx.setMusic(musicManager);

// Auto-play on first interaction, except under browser automation
// (Playwright / Puppeteer / headless Chrome set navigator.webdriver) or with
// ?music=off, so agents driving the game don't fill the room with music.
// The music panel's play button still works either way.
const musicAutoplayOff =
  navigator.webdriver === true ||
  new URLSearchParams(location.search).get('music') === 'off';
const startMusic = () => {
  musicManager.start();
  musicPanel.updateUI();
  window.removeEventListener('mousedown', startMusic);
  window.removeEventListener('touchstart', startMusic);
  window.removeEventListener('keydown', startMusic);
};
if (!musicAutoplayOff) {
  window.addEventListener('mousedown', startMusic);
  window.addEventListener('touchstart', startMusic);
  window.addEventListener('keydown', startMusic);
}
