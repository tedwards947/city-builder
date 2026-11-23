import { isLargeBuilding } from './sim/buildingShapes';
import { placementFor, cyclePlacementTurn, resetPlacementTurn } from './input/placement';
import { hasDocks } from './sim/buildingShapes';
import { World } from './sim/World';
import { dayOfWeek } from './sim/calendar';
import { Camera } from './render/Camera';
import { CanvasRenderer } from './render/CanvasRenderer';
import type { RoadPreview, ZonePreview } from './render/CanvasRenderer';
import { localizeHTML, t, tArray } from './i18n';
import { trackBlocker, trackBuildCost } from './sim/rail';
import type { FailReason } from './commands/Command';

localizeHTML();

import { CommandHistory } from './commands/CommandHistory';
import { Scheduler } from './sim/Scheduler';
import { createSystems, refreshCoverage, type SimSystems } from './sim/createSystems';
import { computeServiceCoverage } from './sim/systems/ServiceSystem';
import type { TransitSystem } from './sim/systems/TransitSystem';
import { VibeSystem } from './sim/systems/VibeSystem';
import { InputController, roadClassForTool, zoneForTool, isLandscapeTool, trackLevelForTool } from './input/InputController';
import type { Tool, RoadMode } from './input/InputController';
import { autoRoadPath, planAutoRoad } from './input/autoRoad';
import { autoRailPathCached, planAutoRail } from './input/autoRail';
import { planZoneFill } from './input/zoneFill';
import type { ZoneMode } from './input/zoneFill';
import { loadZoneMode, saveZoneMode } from './ui/zoneMode';
import { loadRoadMode, saveRoadMode } from './ui/RoadModeMenu';
import { Toolbar, toolbarItems } from './ui/Toolbar';
import { LocalStore } from './persistence/LocalStore';
import { SaveManager } from './persistence/SaveManager';
import { Autosave, AUTOSAVE_SLOT, AUTOSAVE_BACKUP_SLOT } from './persistence/Autosave';
import { NewerSaveError } from './persistence/SaveFormat';
import { MusicManager } from './audio/MusicManager';
import { SoundEffects } from './audio/SoundEffects';
import { NewGameDialog } from './ui/NewGameDialog';
import { SaveLoadPanel } from './ui/SaveLoadPanel';
import { DebtUi } from './ui/DebtUi';
import { debtPauseDue, newDebtWatch } from './sim/debtPause';
import { localTrustEnabled, lastLocalBlock, cellMiddle } from './sim/localTrust';
import { hasCapacity, seatsIfOpened } from './sim/serviceCapacity';
import { seatWords } from './ui/capacityFormat';
import { MusicPanel } from './ui/MusicPanel';
import { TileInfoPanel } from './ui/TileInfoPanel';
import { BadgeTooltip } from './ui/BadgeTooltip';
import { PcFloat } from './ui/PcFloat';
import { pcOfCap, pcHudRate } from './ui/pcFormat';
import { moneyTrend, TREND_GLYPH } from './ui/moneyTrend';
import { DOCK_CHANGED } from './ui/debugDock';
import { pcCap, overCapFadePerDay, pcQuote } from './sim/politics';
import { landscapePreview } from './ui/landscapePreview';
import { brushTiles, landscapeBrush, stepLandscapeBrush } from './input/landscape';
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
import { toolPrice, buildingKindForTool, capstoneLocks, onePerCity, builtOnce } from './ui/Toolbar';
import { buildingUnlocked, unlockPopulation } from './sim/leisure';
import { EconPanel } from './ui/EconPanel';
import { ToastPanel } from './ui/ToastPanel';
import { DemandChart } from './ui/DemandChart';
import { TrafficOverlay } from './render/TrafficOverlay';
import { TrafficTuningPanel } from './ui/TrafficTuningPanel';
import { PoliticsTuningPanel } from './ui/PoliticsTuningPanel';
import { EconomyTuningPanel } from './ui/EconomyTuningPanel';
import { PoliticsSystem } from './sim/systems/PoliticsSystem';
import { DEBUG } from './debug';
import { mergeLot, mergeReport, nearestMergeable, type LotShape } from './sim/lots';
import { MarkerPanel, markerZoomOf } from './ui/MarkerPanel';
import { drawMarkerPins } from './render/markerPins';
import { TitleScreen } from './ui/TitleScreen';
import { CameraTour } from './title/CameraTour';
import { findTourSpots } from './title/tourSpots';
import { SHOWCASE_PATH, markTitleSeen, titleDue, wantTitle } from './title/launch';
import { Tutorial, tutorialDone } from './ui/TutorialCard';
import { TUTORIAL_PATH, beginTutorial } from './tutorial/rules';
import { ShowcaseKeeper } from './title/showcaseKeeper';
import { BALANCE } from './data/balance';
import { blankWorld } from './gen/tutorialMap';
import {
  BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL, BUILDING_PARK,
  ZONE_R, ZONE_C, ZONE_I, ROAD_HIGHWAY,
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
  sim:       null as unknown as SimSystems,
  seenChanges: 0,
  politics:  undefined as PoliticsSystem | undefined,
};

// ?debug=true plays the local trust prototype (PC_DESIGN.md redesign; sim/localTrust.ts, docs/PC_OUTCOMES.md,
// play-feel tuning after the owner's playtest): trust per neighbourhood cell, no city gate; a neighbourhood lets
// you clear about a quarter of its homes, refills in about 30 days, and a clearance spills 0.15 onto each
// neighbour. Only demolition is refused; projects are charged but go ahead. Text only: a row in Inspect and the
// refusal toast. Without ?debug=true shipped play is unchanged.
if (DEBUG) Object.assign((BALANCE.politicalCapital as unknown as { localTrust: object }).localTrust,
  { enabled: true, cityGate: false, homeShare: 0.25, refillDays: 30, spill: 0.15 });

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
    /** `shape`: 'square' (2×2, any zone), or for shops 'wide' (two side by side, east–west) or 'tall' (north–south). (tx, ty) is the NW tile. */
    mergeLot: (tx: number, ty: number, shape: LotShape = 'square') => mergeLot(state.world, tx, ty, true, shape),
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
const autosave = new Autosave(manager, () => state.world, undefined, () =>
  toastPanel.showToast(t('ui.toast.autosaveFailedTitle'), t('ui.toast.autosaveFailed'), 'alert'));

function syncSpeedButtons(): void {
  const speed = state.scheduler.speed;
  document.querySelectorAll<HTMLButtonElement>('.speed').forEach(b =>
    b.classList.toggle('active', parseInt(b.dataset.speed ?? '0', 10) === speed));
  // Hard-to-miss paused state: a chip under the speed buttons.
  const chip = document.getElementById('paused-chip');
  if (chip) { chip.textContent = t('ui.paused.chip'); chip.classList.toggle('hidden', speed !== 0); }
}

// ── Title screen ──────────────────────────────────────────────────────────────
// Shown on the first launch of each day (title/launch.ts): the game's name and
// Continue / New city / Load over a live showcase city, the camera touring its
// busy spots (title/tourSpots.ts, title/CameraTour.ts). The city behind is NOT
// the player's: nothing autosaves while the title is up.

const titleStore = ((): Storage | null => { try { return window.localStorage; } catch { return null; } })();
/** The zoom a game opens at (the camera's own default). */
const PLAY_ZOOM = camera.zoom;
/**
 * The stored autosave is from a NEWER build than this one and could not be
 * opened: nothing autosaves (it would replace that city with the empty one on
 * screen) until the player starts or loads a city themselves.
 */
let autosaveHeld = false;
/** How loud the sound effects are while the title is up, as a share of the player's own FX level (owner, 2026-11-19). */
const TITLE_FX = 0.4;
/** Whether the title screen is up. */
let titleUp = wantTitle({
  param: new URLSearchParams(location.search).get('title'),
  tooling: DEBUG || navigator.webdriver === true,
  due: titleDue(titleStore, new Date()),
});
/** The player's own city, loaded and held while the title shows (null: there is none). */
let savedWorld: World | null = null;
const tour = new CameraTour(camera, () => findTourSpots(state.world));
const titleScreen = new TitleScreen({
  onContinue: () => {
    if (!savedWorld) return;
    // With no showcase the title sits over the player's own city, paused: just carry on in it.
    if (state.world === savedWorld) { closeTitle(); setSpeed(1); showLoadNotes(savedWorld); for (const notice of afterTitle.splice(0)) notice(); }
    else startGame(savedWorld);
  },
  onNew: () => newGameDialog.show(),
  onLoad: () => saveLoadPanel.showLoad(),
  onTutorial: () => void startTutorial(),
  onTouch: () => tour.stop(),
});
/** The showcase behind the title: its save file, and what keeps it from failing (title/showcaseKeeper.ts). */
let showcase: { text: string; keeper: ShowcaseKeeper } | null = null;
/** Notices raised while the title was up (about the player's own save): shown when it closes. */
const afterTitle: Array<() => void> = [];
if (titleUp) {
  titleScreen.show();           // at once: the city loads behind it
  toastPanel.quiet = true;      // nothing but the title's own panes shows
  sfx.setScale(TITLE_FX);       // the showcase city's sounds, quieter (the player's FX slider is not touched)
  markTitleSeen(titleStore, new Date());
}
/** ?debug=true only: the tour is running over the city in play, as a preview (ui/MarkerPanel.ts). */
let tourPreview = false;
function closeTitle(): void {
  titleUp = false;
  showcase = null;
  tour.stop();
  titleScreen.hide();
  camera.zoom = PLAY_ZOOM;      // the tour leaves the zoom wherever it was
  toastPanel.quiet = false;
  sfx.setScale(1);
}

/** Start playing `world`. `behindTitle`: it is only the backdrop of the title screen, which stays up. */
function startGame(world: World, behindTitle = false): void {
  if (titleUp && !behindTitle) closeTitle();
  if (!behindTitle) autosaveHeld = false;       // the player started or loaded a city: it is theirs to save
  if (tourPreview) { tourPreview = false; tour.stop(); }
  state.world     = world;
  state.history   = new CommandHistory(world);
  // Systems carry per-game state, so every new or loaded world gets a fresh set.
  const sim = createSystems();
  state.transit = sim.transit;
  state.sim = sim;
  state.seenChanges = 0;
  state.politics = sim.systems.find((s): s is PoliticsSystem => s instanceof PoliticsSystem);
  // Settle traffic now, while the city is loading, rather than on the first
  // traffic tick: that pass is the costliest of the game (~20 ms on a big
  // city), and roads show their traffic from the first frame.
  sim.transit.recompute(world);
  // A city saved while paused may hold coverage from before its last edits.
  refreshCoverage(world, sim);
  state.scheduler = new Scheduler(world, sim.systems);
  syncSpeedButtons();
  autosave.reset();
  toastPanel.setWorld(world);
  pcFloat.setWorld(world);
  milestoneBanner.setWorld(world);
  requestFeedback.setWorld(world);
  camera.centerOnTile(world.grid.width / 2, world.grid.height / 2);
  tutorial.attach(world, camera);
  document.getElementById('hint')?.classList.remove('hidden');
  if (!behindTitle) {
    showLoadNotes(world);
    for (const notice of afterTitle.splice(0)) notice();
  }
}

/** Tell the player, once, what upgrading their old save changed (never for the title's showcase). */
function showLoadNotes(world: World): void {
  if (world.loadNotes.stationsRebuilt) {
    toastPanel.showToast(t('ui.toast.stationsRebuiltTitle'), t('ui.toast.stationsRebuilt', { n: world.loadNotes.stationsRebuilt }), 'info');
  }
  world.loadNotes = {};
}

const saveLoadPanel = new SaveLoadPanel(
  manager,
  () => state.world,
  (world) => startGame(world),
);

// ── Tutorial (TUTORIAL_DESIGN.md) ─────────────────────────────────────────────
// A guided first city: one goal at a time on a card, the toolbar button for it
// pulsing, and a ghost on the map where the step has a spot.
const tutorial = new Tutorial({
  onPoint: (keys) => {
    toolbar.setPulse(keys);
    document.querySelectorAll('#speedbar .speed[data-speed="2"], #speedbar .speed[data-speed="3"]').forEach(b => b.classList.toggle('tut-pulse', keys.includes('speed')));
    document.getElementById('demand-chart-wrap')?.classList.toggle('tut-pulse', keys.includes('demand'));
  },
});
/** Start the tutorial city (its own map; a small default one until that map exists). */
async function startTutorial(): Promise<void> {
  let world: World;
  try {
    const res = await fetch(import.meta.env.BASE_URL + TUTORIAL_PATH);
    if (!res.ok) throw new Error(String(res.status));
    world = manager.importGame(await res.text());
  } catch {
    // The map would not load (offline?): a small plain map still teaches the basics.
    world = new World(64, 64, 7, { vegAmount: 'low' });
  }
  if (!world.tutorial) beginTutorial(world);
  startGame(world);
  setSpeed(1);
}

/** Whether the player has built anything in `world` (a highway the map came with does not count). */
function hasBuilt(world: World): boolean {
  if (world.index.zonedCount > 0) return true;
  const { roadClass, building, rail } = world.layers;
  for (let i = 0; i < building.length; i++) {
    if (building[i] !== 0 || rail[i] !== 0 || (roadClass[i] !== 0 && roadClass[i] !== ROAD_HIGHWAY)) return true;
  }
  return false;
}
// From the Menu, the tutorial replaces the city in play (and the autosave then
// saves over it), so ask first if the player has built anything.
const tutorialModal = document.getElementById('tutorial-modal')!;
function askTutorial(): void {
  if (!hasBuilt(state.world)) { void startTutorial(); return; }
  tutorialModal.classList.remove('hidden');
  (document.getElementById('tutorial-cancel') as HTMLButtonElement).focus();
}
document.getElementById('tutorial-cancel')!.addEventListener('click', () => tutorialModal.classList.add('hidden'));
document.getElementById('tutorial-start')!.addEventListener('click', () => { tutorialModal.classList.add('hidden'); void startTutorial(); });
tutorialModal.addEventListener('click', (e) => { if (e.target === tutorialModal) tutorialModal.classList.add('hidden'); });

const newGameDialog = new NewGameDialog((opts) => {
  startGame(opts.blank
    ? blankWorld(opts.width, opts.height, opts.seed)
    : new World(opts.width, opts.height, opts.seed, { waterAmount: opts.waterAmount, vegAmount: opts.vegAmount, mapType: opts.mapType }));
});

// Start with the default world so everything below has a world to point at.
// If an autosave exists it replaces this as soon as it has loaded (see the
// bottom of this file); the frame loop does not start until then.
// (`true`: if the title screen is up, it stays up.)
startGame(new World(256, 256, 42, { vegAmount: 'low' }), true);

// ── Input ─────────────────────────────────────────────────────────────────────

let currentTool: Tool = 'none';
let hoverTile: { tx: number; ty: number } | null = null;
/** The last tile the pointer was over on the map (it stays when the pointer leaves for a button). */
let lastMapTile: { tx: number; ty: number } | null = null;
// At most one overlay is shown at a time.
type Overlay = 'none' | 'traffic' | 'crime' | 'fire' | 'vibe' | 'school' | 'health' | 'police' | 'fireCover';
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
  // The local trust prototype (?debug=true): say which neighbourhood refused, and why.
  const block = reason === 'politicalCapital' && localTrustEnabled() ? lastLocalBlock(state.world) : null;
  if (block && state.world.tick - block.tick <= 1) {
    const at = cellMiddle(state.world, block.cell);
    toastPanel.showToast(t('ui.toast.trustRefusedTitle'),
      t('ui.toast.trustRefused', { x: at.tx, y: at.ty, have: Math.max(0, Math.round(block.have)), need: Math.round(block.need) }), 'warning');
    return;
  }
  toastPanel.showToast(
    t('ui.toast.cantBuildTitle'),
    t(reason === 'funds' ? 'ui.toast.noFunds' : reason === 'noWater' ? 'ui.toast.needsWater' : reason === 'notOpenWater' ? 'ui.toast.needsOpenWater' : reason === 'alreadyBuilt' ? 'ui.toast.onePerCity' : reason === 'locked' ? 'ui.toast.lockedBuilding' : 'ui.toast.noPoliticalCapital'),
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
  (tile) => { hoverTile = tile; if (tile) lastMapTile = tile; },
  (reason) => notifyRejected(reason),
  () => roadMode,
  () => zoneMode,
);
// Focus markers (sim/markers.ts), ?debug=true only: the Focus tool and the bulldozer edit them,
// a panel lists them, and the tour can be previewed. A press or a scroll on the map stops the preview.
const markerPanel = DEBUG ? new MarkerPanel({
  getWorld: () => state.world,
  getHistory: () => state.history,
  camera,
  placing: () => currentTool === 'focus',
  setPlacing: (on) => setTool(on ? 'focus' : 'none'),
  touring: () => tourPreview,
  setTouring: (on) => {
    tourPreview = on;
    if (on) tour.start(performance.now()); else tour.stop();
  },
}) : null;
if (DEBUG) {
  input.markerZoom = () => markerZoomOf(camera);
  const stopPreview = (): void => { if (tourPreview) { tourPreview = false; tour.stop(); } };
  canvas.addEventListener('pointerdown', stopPreview, true);
  canvas.addEventListener('wheel', stopPreview, { capture: true, passive: true });
}

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
// The tutorial's budget step: when the budget panel was opened (null: not open since it last counted).
let budgetOpenAt: number | null = null;
const BUDGET_LOOK_MS = 6000;
// The tutorial's "click a home" step: a click (not a drag) with Inspect on a home tile.
let pressAt: { x: number; y: number } | null = null;
canvas.addEventListener('pointerdown', (e) => { pressAt = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', (e) => {
  if (!tutorial.active || !pressAt || currentTool !== 'inspect' || !hoverTile) return;
  if (Math.hypot(e.clientX - pressAt.x, e.clientY - pressAt.y) > 6) return;
  const w = state.world;
  if (w.grid.inBounds(hoverTile.tx, hoverTile.ty) && w.layers.zone[w.grid.idx(hoverTile.tx, hoverTile.ty)] === ZONE_R) { tutorial.ui.inspectedHome = true; tutorial.ui.inspectedTile = w.grid.idx(hoverTile.tx, hoverTile.ty); }
});

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
  out.push(...tutorial.highlights(now));
  // A bulldoze or highway drag that is cutting buildings off from their road: outline them in red before release.
  const pulse = 0.65 + 0.35 * Math.abs(Math.sin(now / 260));
  for (const b of state.history?.cuttingOff ?? []) out.push({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, tiles: b.tiles, alpha: pulse, warn: true });
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

// Capstones show greyed out with the residents they still need (read live, so a new city or a load is picked up).
capstoneLocks.need = (tool) => { const k = buildingKindForTool(tool); return k !== undefined && !buildingUnlocked(state.world, k) ? unlockPopulation(k) : 0; };
onePerCity.built = (tool) => builtOnce(state.world, tool);
const toolbar = new Toolbar(document.getElementById('toolbar')!, roadMode, zoneMode, {
  onTool: (tool) => setTool(tool),
  onOverlay: (which) => toggleOverlay(which),
  onAction: (action) => {
    if (action !== 'undo' && action !== 'redo') sfx.menuClicked();
    switch (action) {
      case 'new':    newGameDialog.show(); break;
      case 'save':   saveLoadPanel.showSave(); break;
      case 'load':   saveLoadPanel.showLoad(); break;
      case 'tutorial': askTutorial(); break;
      case 'undo':   sfx.undo(state.history.canUndo); state.history.undo(); break;
      case 'redo':   sfx.redo(state.history.canRedo); state.history.redo(); break;
      case 'budget':     togglePanel('budget'); break;
      case 'ordinances': togglePanel('ordinances'); break;
      case 'requests':   togglePanel('requests'); break;
      case 'underground': setUnderground(!underground); break;
      case 'lowBuildings': lowBuildings = !lowBuildings; break;
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

// The underground view: the surface fades and subway tunnels show (drawn by the renderer).
// While it is on, the bulldozer takes out subway track instead of clearing the surface.
let underground = false;
// Views › Low buildings: the towers on merged 2×2 lots drawn a few floors high (render/clay/bigLots.ts).
let lowBuildings = false;
function setUnderground(on: boolean): void {
  underground = on;
  input.underground = on;
}

function setTool(tool: Tool): void {
  if (tool !== currentTool) resetPlacementTurn();
  // The subway tools work underground: show it. (The player turns the view off again with U.)
  if (tool === 'railSubway' || tool === 'rampSubway' || tool === 'subwayStation') setUnderground(true);
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
  // The title screen is up: the city behind it is not for playing.
  if (titleUp) return;

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

  // [ and ] change the Landscape brush size.
  if ((key === '[' || key === ']') && !e.ctrlKey && !e.metaKey && isLandscapeTool(currentTool)) {
    stepLandscapeBrush(key === '[' ? -1 : 1);
    toolbar.refresh();
    return;
  }

  // X turns a building that can be turned (the seaport) while it is being placed.
  if (key === 'x' && !e.ctrlKey && !e.metaKey) {
    const kind = buildingKindForTool(currentTool);
    if (kind !== undefined && hasDocks(kind)) { cyclePlacementTurn(); return; }
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
  if (key === 'u') { setUnderground(!underground); return; }
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
const statMoneyTrend = document.getElementById('stat-money-trend')!;
if (DEBUG) {
  // Play-test helper: a little money on demand, next to the money figure.
  const more = document.createElement('button');
  more.id = 'debug-money';
  more.type = 'button';
  more.textContent = '+$10k';
  more.addEventListener('click', () => { state.world.budget.money += 10000; });
  statMoney.after(more);
  // Graphics check: every seaport sends a ship now, even with no trade yet.
  const ship = document.createElement('button');
  ship.id = 'debug-ship';
  ship.type = 'button';
  ship.textContent = 'Send ship';
  ship.addEventListener('click', () => renderer.sendShips());
  more.after(ship);
  // 2×2 lots (sim/lots.ts): merge the zoned block nearest where the pointer last was on the map, whatever its level.
  const merge = document.createElement('button');
  merge.id = 'debug-merge';
  merge.type = 'button';
  merge.textContent = 'Merge 2×2';
  merge.addEventListener('click', () => {
    // Nearest the last place the pointer was on the map; failing that, the middle of the view.
    const c = camera.screenToTile(camera.viewportW / 2, camera.viewportH / 2);
    // A 2×2 if there is one; failing that a pair of shops, side by side then one above the other.
    let done = false;
    for (const shape of ['square', 'wide', 'tall'] as const) {
      const at = (lastMapTile && nearestMergeable(state.world, lastMapTile.tx, lastMapTile.ty, true, 24, shape)) ?? nearestMergeable(state.world, c.tx, c.ty, true, 24, shape);
      // A merge shows its own toast (lotMerged); say so when there is nothing to merge.
      if (at && mergeLot(state.world, at.tx, at.ty, true, shape)) { done = true; break; }
    }
    if (!done) toastPanel.showToast('Merge 2×2 (debug)', 'Nothing to merge: no 2×2 square of one zone (two lots by two, no road or building in it), and no two shop lots side by side, within 24 tiles of where the pointer last was on the map, or of the middle of the view.', 'warning');
  });
  ship.after(merge);
  // Merging is rare at the shipped chances: try it with a quick one (homes, shops and industry alike).
  const auto = document.createElement('button');
  auto.id = 'debug-auto-merge';
  auto.type = 'button';
  const knobs = BALANCE.lots as { chancePerDay: number; industryChancePerDay: number };   // BALANCE is edited live by the debug tools, never saved
  const shippedChance = knobs.chancePerDay, shippedIndustry = knobs.industryChancePerDay;
  const label = () => { auto.textContent = knobs.chancePerDay === 0.25 ? 'Merging: fast' : knobs.chancePerDay > 0 ? 'Merging: on' : 'Merging: off'; };
  auto.addEventListener('click', () => {
    const fast = knobs.chancePerDay !== 0.25;
    knobs.chancePerDay = fast ? 0.25 : shippedChance;
    knobs.industryChancePerDay = fast ? 0.25 : shippedIndustry;
    label();
    if (knobs.chancePerDay <= 0 && knobs.industryChancePerDay <= 0) { toastPanel.showToast('Merging off (debug)', 'Lots no longer merge on their own.', 'info'); return; }
    const pct = (c: number): string => `${+(c * 100).toFixed(2)}%`;
    // Say where the city stands, so "nothing happened" can be told from "nothing qualifies".
    const w = state.world, r = mergeReport(w), need = BALANCE.lots.streakDays;
    const sat = Math.round(w.stats.satisfaction * 100), satNeed = Math.round(BALANCE.lots.minSatisfaction * 100);
    toastPanel.showToast(knobs.chancePerDay === 0.25 ? 'Merging fast (debug)' : 'Merging on (debug)', `A ready block has a ${pct(knobs.chancePerDay)} chance a day (industry ${pct(knobs.industryChancePerDay)}). Level-3 lots: ${r.topLots}; in a 2×2 square of one zone: ${r.squares} squares; shop pairs: ${r.pairs}. `
      + `Thriving today: ${r.happyToday} lots (needs no problems, a prime spot — downtown, or by a park or water — and city satisfaction ${satNeed}%; it is ${sat}%). `
      + `Longest streak: ${r.bestStreak} of ${need} days. Blocks ready now: ${r.ready}.`, 'info');
  });
  label();
  merge.after(auto);
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
// The HUD is checked every frame but a node is only touched when its text changed (a text write
// replaces the node and can cost a layout). Keyed on the value, so money after a build still shows at once.
const hudText = new WeakMap<Element, string>();
function setHud(el: Element, text: string): void {
  if (hudText.get(el) === text) return;
  hudText.set(el, text);
  el.textContent = text;
}

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
  const weekday   = tArray('common.weekdays')[dayOfWeek(totalDays)] ?? '???';
  return weekday + ' ' + day + ' ' + (months[month - 1] ?? '???') + ' ' + year;
}

const ZONE_PREVIEW_COLOR: Record<number, string> = {
  [ZONE_R]: '#6fd86f', [ZONE_C]: '#8faee0', [ZONE_I]: '#e0b060',
};

// ── Main loop ─────────────────────────────────────────────────────────────────

/**
 * The tiles a service building would cover where the pointer is. Worked out again only when the
 * tile, the kind or the map (grid.edits goes up on every tile change) is different, not every frame.
 */
let coverageCache: { world: World; tx: number; ty: number; kind: number; edits: number; covered: Set<number> } | null = null;
function cachedCoveragePreview(world: World, tx: number, ty: number, kind: number): Set<number> {
  const c = coverageCache;
  if (c && c.world === world && c.tx === tx && c.ty === ty && c.kind === kind && c.edits === world.grid.edits) return c.covered;
  const covered = computeServiceCoverage(world, tx, ty, kind);
  coverageCache = { world, tx, ty, kind, edits: world.grid.edits, covered };
  return covered;
}

/** Auto-pause when the city goes into debt (sim/debtPause.ts): not behind the title, not once the game is over. */
const debtWatch = newDebtWatch();

function frame(now: number): void {
  state.scheduler.update(now);
  if (!titleUp && !state.world.budget.gameOver && debtPauseDue(debtWatch, state.world, state.world.budget.money) && state.scheduler.speed !== 0) {
    setSpeed(0);
    toastPanel.showToast(t('ui.toast.debtPausedTitle'), t('ui.toast.debtPaused'), 'alert');
  }
  // A road edit shows in the traffic straight away, even while paused.
  state.transit.refreshIfRoadsChanged(state.world);
  // So does what it connects: power, water and services reach a road or zone built while the
  // clock is stopped (paused, or game over), instead of showing "No power" until it runs again.
  if (state.history.changes !== state.seenChanges) {
    state.seenChanges = state.history.changes;
    if (state.scheduler.stopped) refreshCoverage(state.world, state.sim);
  }
  if (titleUp || tourPreview) tour.update(now);
  if (titleUp && showcase) keepShowcase();
  if (tutorial.active && !titleUp) {
    // The budget counts as looked at once it is closed again, or has been open a few seconds:
    // the card's words about the daily total stay up while the player reads the panel.
    if (econPanel.isOpen) budgetOpenAt ??= now;
    if (budgetOpenAt !== null && (!econPanel.isOpen || now - budgetOpenAt >= BUDGET_LOOK_MS)) { tutorial.ui.budgetOpened = true; budgetOpenAt = null; }
    if (overlay !== 'none') tutorial.ui.overlayOn = true;
    tutorial.update(camera, now);
  }
  if (!titleUp && !autosaveHeld) autosave.tick(now, state.scheduler.speed === 0);
  const serviceKind = SERVICE_TOOL_KIND[currentTool];
  const coveragePreview = (serviceKind !== undefined && hoverTile)
    ? cachedCoveragePreview(state.world, hoverTile.tx, hoverTile.ty, serviceKind)
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
  // Track in auto mode, a start clicked: the line the game would lay to the pointer, and its price.
  const autoLevel = trackLevelForTool(currentTool);
  if (roadStart && hoverTile && autoLevel !== undefined) {
    const plan = planAutoRail(state.world, autoRailPathCached(state.world, roadStart, hoverTile, performance.now(), autoLevel));
    roadPreview = plan.found
      ? { tiles: plan.tiles, ok: plan.affordable, label: '$' + plan.cost.toLocaleString('en-US'), pc: pcTag(plan.pc) }
      : { tiles: [roadStart, hoverTile], ok: false, label: t('ui.rail.noRoute') };
    if (plan.found) pcPreview = planPcPreview(hoverTile, plan.pc);
  }
  // Track (clay/rail.ts): the tile under the pointer, with its price or why track can't go there.
  const trackLevel = trackLevelForTool(currentTool);
  if (!roadPreview && hoverTile && trackLevel !== undefined) {
    const why = trackBlocker(state.world, hoverTile.tx, hoverTile.ty, trackLevel), cost = trackBuildCost(state.world, hoverTile.tx, hoverTile.ty, trackLevel);
    roadPreview = why || cost === null
      ? { tiles: [hoverTile], ok: false, label: t(`ui.rail.${why ?? 'blocked'}`) }
      : { tiles: [hoverTile], ok: state.world.budget.money >= cost, label: '$' + cost.toLocaleString('en-US') };
    // Homes near ground or elevated track object: tint them, and show the price only if the city is short.
    if (!why && cost !== null) {
      const q = pcQuote(state.world, { type: 'track', tx: hoverTile.tx, ty: hoverTile.ty, level: trackLevel });
      roadPreview.pc = pcTag(q);
      pcPreview = planPcPreview(hoverTile, q);
    }
  }
  if (!zonePreview && !roadPreview && hoverTile) {
    pcPreview = hoverPcPreview(state.world, currentTool, hoverTile);
    if (pcPreview) {
      if (buildingKindForTool(currentTool) !== undefined) pcPreview.money = toolPrice(currentTool).cost;
    } else {
      // A building on several tiles always shows its price at the pointer, where it can go.
      const kind = buildingKindForTool(currentTool);
      if (kind !== undefined && isLargeBuilding(kind)) {
        const a = placementFor(state.world, kind, hoverTile.tx, hoverTile.ty);
        const blocker = state.world.placeBlocker(a.tx, a.ty, kind, a.rot);
        if (blocker === null) pcPreview = { at: hoverTile, building: { kind, tx: a.tx, ty: a.ty, rot: a.rot }, rings: [], tints: [], label: '', ok: true, money: toolPrice(currentTool).cost };
        // A seaport that does not fit: say what it needs. On a pond, that the water must reach the map edge.
        else if (hasDocks(kind) && blocker !== 'offMap') pcPreview = { at: hoverTile, building: { kind, tx: a.tx, ty: a.ty, rot: a.rot }, rings: [], tints: [], label: '', ok: false, money: toolPrice(currentTool).cost, note: t(blocker === 'notOpenWater' ? 'ui.hud.needsOpenWater' : 'ui.hud.needsDockSite') };
        // The land is free but there is no water beside it (a water pump): say so at the pointer.
        else if (blocker === 'noWater') pcPreview = { at: hoverTile, building: { kind, tx: a.tx, ty: a.ty }, rings: [], tints: [], label: '', ok: false, money: toolPrice(currentTool).cost, note: t('ui.hud.needsWater') };
      }
    }
  }
  // Landscape tools: the stroke under way, or the brush under the pointer, and what it would do.
  const strokeTiles = input.landscapeStroke;
  const landscape = isLandscapeTool(currentTool) && hoverTile && state.world.grid.inBounds(hoverTile.tx, hoverTile.ty)
    ? landscapePreview(state.world, currentTool, strokeTiles ?? brushTiles(state.world, hoverTile.tx, hoverTile.ty, landscapeBrush()), hoverTile)
    : null;
  if (landscape) pcPreview = null;
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
  // The school or health map: the same marks, without a tool selected.
  if (seatView === null && overlay === 'school') seatView = { kind: BUILDING_SCHOOL, gained: [] };
  else if (seatView === null && overlay === 'health') seatView = { kind: BUILDING_HOSPITAL, gained: [] };
  else if (seatView === null && overlay === 'police') seatView = { kind: BUILDING_POLICE, gained: [] };
  else if (seatView === null && overlay === 'fireCover') seatView = { kind: BUILDING_FIRE, gained: [] };
  // Behind the title: the city alone, with no pointer marks, badges or guides.
  if (titleUp) renderer.render(state.world, camera, { now, bare: true, smooth: tour.active });
  else renderer.render(state.world, camera, {
    smooth: tourPreview && tour.active,
    seatView,
    pcPreview,
    requestOutcomes: requestFeedback.outcomes(performance.now()),
    areaHighlights: areaHighlights(performance.now()),
    hoverTile, tool: currentTool, coveragePreview, now, roadPreview, zonePreview, landscape,
    overlay: overlay === 'traffic' ? 'none' : overlay,   // the traffic overlay is drawn separately, below
    underground,
    lowBuildings,
  });
  if (overlay === 'traffic' && !titleUp) trafficOverlay.render(renderer.ctx, state.world, camera, hoverTile);
  if (DEBUG && !titleUp) drawMarkerPins(renderer.ctx, state.world, camera);
  markerPanel?.update();
  trafficTuning?.update();
  politicsTuning?.update();
  economyTuning?.update();
  tileInfoPanel.update(state.world, hoverTile, state.scheduler.speed === 0);
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
  if (hoverTile) setHud(statTile, `${hoverTile.tx}, ${hoverTile.ty}`);
  setHud(statCam, `${Math.round(camera.x)}, ${Math.round(camera.y)}`);
  setHud(statZoom, camera.zoom.toFixed(2) + '×');
  const pc = state.world.budget.politicalCapital;
  // Shown as "pc / cap". One-off bonuses can lift it past the cap: the bar
  // stays full and the figure brightens.
  const pcMax = pcCap(state.world);
  const pcOver = Math.floor(pc) > pcMax;
  setHud(statPC, pcOfCap(pc, pcMax));
  statPC.classList.toggle('critical', pc < pcMax * 0.2);
  statPC.classList.toggle('low',      pc >= pcMax * 0.2 && pc < pcMax * 0.5);
  statPC.classList.toggle('over',     pcOver);
  pcBar.classList.toggle('over', pcOver);
  // The passive rate per game day. An unhappy city drains: red figure, striped bar.
  // The tutorial holds PC full (tutorial/rules.ts), so a drain there means nothing: show a calm, full bar.
  const pcPerDay = state.world.tutorial ? 0 : state.world.politics.regen * BALANCE.ticksPerDay;
  const draining = pcPerDay < -0.05;
  // Political debt (below 0, from closing services): everything that costs PC is refused until it is paid off.
  const inDebt = pc < 0;
  // Over the cap the banked extra slowly fades: "−0.4/day" beside the brightened figure.
  const rateText = pcHudRate(pcPerDay, overCapFadePerDay(state.world), pcOver, Math.floor(pc) >= pcMax,
    { bonus: t('ui.hud.pcBonus'), full: t('ui.hud.pcFull') });
  setHud(statPCRate, inDebt ? (t('ui.hud.pcDebt') + ' ' + rateText).trim() : rateText);
  statPC.classList.toggle('debt', inDebt);
  statPCRate.classList.toggle('debt', inDebt);
  pcBar.parentElement!.classList.toggle('debt', inDebt);
  statPCRate.classList.toggle('draining', draining);
  statPC.classList.toggle('draining', draining);
  pcBar.classList.toggle('draining', draining);
  (pcBar as HTMLElement).style.width = Math.max(0, Math.min(100, (pc / pcMax) * 100)).toFixed(1) + '%';
  (pcBar as HTMLElement).style.background = pcOver ? '#c9fff1' : pc < pcMax * 0.2 ? '#e07070' : pc < pcMax * 0.5 ? '#e0b050' : '#7dd8c0';
  setHud(statMoney, formatMoney(state.world.budget.money));
  statMoney.classList.toggle('negative', state.world.budget.money < 0);
  // Trend arrow: green up while earning, red down while spending; doubled when the gap is large.
  const { income, expenses } = state.world.budget;
  const trend = moneyTrend(income, expenses);
  setHud(statMoneyTrend, TREND_GLYPH[trend]);
  statMoneyTrend.classList.toggle('up', trend === 'up' || trend === 'up2');
  statMoneyTrend.classList.toggle('down', trend === 'down' || trend === 'down2');
  const net = income - expenses;
  statMoneyTrend.title = t('ui.hud.moneyTrend', { amount: (net > 0 ? '+' : '') + formatMoney(net) });
  debtUi.update();
  toastPanel.checkFull(state.world);
  setHud(statPop, state.world.stats.population.toLocaleString());
  // Demand / supply; red while demand outruns supply.
  const utility = (el: HTMLElement, demand: number, supply: number) => {
    setHud(el, `${demand} / ${supply}`);
    el.classList.toggle('short', demand > supply);
  };
  const stats = state.world.stats;
  utility(statPower, stats.powerDemand, stats.powerSupply);
  utility(statWater, stats.waterDemand, stats.waterSupply);
  utility(statSewage, stats.sewageDemand, stats.sewageSupply);
  setHud(statServices, `${state.world.stats.servicesCoveredZones}`);
  setHud(statCongestion, `${state.world.stats.avgCongestion}`);
  setHud(statDate, formatDate(state.world.tick));
  requestAnimationFrame(frame);
}

// ── Autosave ──────────────────────────────────────────────────────────────────
// Saved every ~60s of unpaused play (autosave.tick in the frame loop) and
// whenever the tab is hidden or closed.

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && !titleUp && !autosaveHeld) void autosave.saveNow();
});
window.addEventListener('pagehide', () => { if (!titleUp && !autosaveHeld) void autosave.saveNow(); });

/**
 * The showcase must never fail while it sits behind the title: its funds are
 * held every frame, and if the city still declines over a long idle it starts
 * again from its save file, the camera staying where it is.
 */
function keepShowcase(): void {
  if (!showcase) return;
  showcase.keeper.hold(state.world);
  if (!showcase.keeper.declined(state.world)) return;
  const { text } = showcase, { x, y, zoom } = camera;
  const world = manager.importGame(text);
  startGame(world, true);
  showcase = { text, keeper: new ShowcaseKeeper(world) };
  camera.zoom = zoom; camera.x = x; camera.y = y;
}

/** The showcase city for the title screen and its save file, or null if the site has none (or it will not load). */
async function loadShowcase(): Promise<{ world: World; text: string } | null> {
  try {
    const res = await fetch(import.meta.env.BASE_URL + SHOWCASE_PATH);
    if (!res.ok) return null;
    const text = await res.text();
    return { world: manager.importGame(text), text };
  } catch (err) {
    console.warn('No showcase city for the title screen:', err);
    return null;
  }
}

// Resume the autosaved city if there is one; or, on the first launch of the
// day, put the showcase city behind the title screen and hold the player's
// city for Continue. Then start the frame loop.
async function boot(): Promise<void> {
  let saved: World | null = null;
  try {
    saved = await manager.loadGame(AUTOSAVE_SLOT, AUTOSAVE_BACKUP_SLOT);
  } catch (err) {
    // The save stays where it is until the next autosave, and a copy is already in the backup slot.
    console.warn('Could not load autosave:', err);
    if (err instanceof NewerSaveError) autosaveHeld = true;
    const notice = err instanceof NewerSaveError
      ? () => toastPanel.showToast(t('ui.toast.newerSaveTitle'), t('ui.toast.newerSave'), 'alert')
      : () => toastPanel.showToast(t('ui.toast.savedCityUnreadableTitle'), t('ui.toast.savedCityUnreadable'), 'alert');
    // Under the title nothing else shows: the notice waits until the player starts or loads a city.
    if (titleUp) afterTitle.push(notice); else notice();
  }
  if (!titleUp) {
    if (saved) startGame(saved);
    return;
  }
  savedWorld = saved;
  const shown = await loadShowcase();
  if (shown) {
    startGame(shown.world, true);
    showcase = { text: shown.text, keeper: new ShowcaseKeeper(shown.world) };
  } else {
    // No showcase: tour the player's own city instead (or the empty default map), PAUSED,
    // so that nothing happens to it while nobody is playing.
    if (saved) startGame(saved, true);
    setSpeed(0);
  }
  tour.start(performance.now());
  titleScreen.ready(saved !== null, saved === null && !tutorialDone());
}
void boot().finally(() => requestAnimationFrame(frame));

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
