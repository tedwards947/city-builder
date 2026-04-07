import { World } from './sim/World';
import { Camera } from './render/Camera';
import { CanvasRenderer } from './render/CanvasRenderer';
import { CommandHistory } from './commands/CommandHistory';
import { Scheduler } from './sim/Scheduler';
import { NetworkSystem } from './sim/systems/NetworkSystem';
import { PowerSystem } from './sim/systems/PowerSystem';
import { WaterSystem } from './sim/systems/WaterSystem';
import { SewageSystem } from './sim/systems/SewageSystem';
import { ServiceSystem } from './sim/systems/ServiceSystem';
import { LandValueSystem } from './sim/systems/LandValueSystem';
import { PollutionSystem } from './sim/systems/PollutionSystem';
import { ZoneGrowthSystem } from './sim/systems/ZoneGrowthSystem';
import { EconomySystem } from './sim/systems/EconomySystem';
import { TransitSystem } from './sim/systems/TransitSystem';
import { InputController } from './input/InputController';
import type { Tool } from './input/InputController';
import { LocalStore } from './persistence/LocalStore';
import { SaveManager } from './persistence/SaveManager';
import { NewGameDialog } from './ui/NewGameDialog';
import { SaveLoadPanel } from './ui/SaveLoadPanel';
import { TileInfoPanel } from './ui/TileInfoPanel';
import { EconPanel } from './ui/EconPanel';
import { DemandChart } from './ui/DemandChart';
import { BALANCE } from './data/balance';

// ── Canvas / Camera / Renderer ────────────────────────────────────────────────
// Must come first — startGame() uses camera.

const canvas   = document.getElementById('canvas') as HTMLCanvasElement;
const camera   = new Camera(window.innerWidth, window.innerHeight);
const renderer = new CanvasRenderer(canvas);

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

const systems = [
  new NetworkSystem(),
  new PowerSystem(),
  new WaterSystem(),
  new SewageSystem(),
  new ServiceSystem(),
  new LandValueSystem(),
  new PollutionSystem(),
  new TransitSystem(),
  new ZoneGrowthSystem(),
  new EconomySystem(),
];

const state = {
  world:     null as unknown as World,
  history:   null as unknown as CommandHistory,
  scheduler: null as unknown as Scheduler,
};

function startGame(world: World): void {
  state.world     = world;
  state.history   = new CommandHistory(world);
  state.scheduler = new Scheduler(world, systems);
  camera.centerOnTile(world.grid.width / 2, world.grid.height / 2);
  document.getElementById('hint')?.classList.remove('hidden');
}

// Start with the default world.
startGame(new World(256, 256, 42));

// ── Input ─────────────────────────────────────────────────────────────────────

let currentTool: Tool = 'none';
let hoverTile: { tx: number; ty: number } | null = null;

new InputController(
  canvas,
  camera,
  () => state.world,
  () => state.history,
  () => currentTool,
  (tile) => { hoverTile = tile; },
);

// ── Persistence ───────────────────────────────────────────────────────────────

const store   = new LocalStore();
const manager = new SaveManager(store); // userId defaults to 'local'

// ── UI dialogs ────────────────────────────────────────────────────────────────

const newGameDialog = new NewGameDialog((opts) => {
  startGame(new World(opts.width, opts.height, opts.seed, { waterAmount: opts.waterAmount }));
});

const tileInfoPanel = new TileInfoPanel();
const econPanel = new EconPanel(() => state.world);
const demandChart = new DemandChart();

const saveLoadPanel = new SaveLoadPanel(
  manager,
  () => state.world,
  (world) => startGame(world),
);

document.getElementById('btn-new')!.addEventListener('click',  () => newGameDialog.show());
document.getElementById('btn-save')!.addEventListener('click', () => saveLoadPanel.showSave());
document.getElementById('btn-load')!.addEventListener('click', () => saveLoadPanel.showLoad());
document.getElementById('btn-econ')!.addEventListener('click', () => econPanel.toggle());

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
    const tool = btn.dataset.tool as Tool | 'undo';
    if (tool === 'undo') { state.history.undo(); return; }
    setTool(tool);
  });
});

// ── Speed buttons ─────────────────────────────────────────────────────────────

document.querySelectorAll<HTMLButtonElement>('.speed').forEach(btn => {
  btn.addEventListener('click', () => {
    const s = parseInt(btn.dataset.speed ?? '1', 10);
    state.scheduler.setSpeed(s);
    document.querySelectorAll('.speed').forEach(b =>
      b.classList.toggle('active', b === btn));
  });
});

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); state.history.undo(); }
  if (e.key === '1') setTool('none');
  if (e.key === '2') setTool('road');
  if (e.key === '3') setTool('zoneR');
  if (e.key === '4') setTool('zoneC');
  if (e.key === '5') setTool('zoneI');
  if (e.key === '6') setTool('power');
  if (e.key === '7') setTool('water');
  if (e.key === '8') setTool('sewage');
  if (e.key === '9') setTool('bulldoze');
  if (e.key === '0') setTool('police');
  if (e.key === 'q' || e.key === 'Q') setTool('fire');
  if (e.key === 'w' || e.key === 'W') setTool('school');
  if (e.key === 'e' || e.key === 'E') setTool('hospital');
  if (e.key === 'r' || e.key === 'R') setTool('park');
  if (e.key === 'i' || e.key === 'I') setTool('inspect');
  if (e.key === ' ') {
    e.preventDefault();
    const newSpeed = state.scheduler.speed === 0 ? 1 : 0;
    state.scheduler.setSpeed(newSpeed);
    document.querySelectorAll('.speed').forEach(b =>
      b.classList.toggle('active',
        parseInt((b as HTMLButtonElement).dataset.speed ?? '0', 10) === newSpeed));
  }
});

// ── HUD ───────────────────────────────────────────────────────────────────────

const statTile  = document.getElementById('stat-tile')!;
const statCam   = document.getElementById('stat-cam')!;
const statZoom  = document.getElementById('stat-zoom')!;
const statMoney = document.getElementById('stat-money')!;
const statPop   = document.getElementById('stat-pop')!;
const statPower = document.getElementById('stat-power')!;
const statWater  = document.getElementById('stat-water')!;
const statSewage = document.getElementById('stat-sewage')!;
const statServices = document.getElementById('stat-services')!;
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
  const months    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[month - 1] + ' ' + day + ', ' + year;
}

// ── Main loop ─────────────────────────────────────────────────────────────────

function frame(now: number): void {
  state.scheduler.update(now);
  renderer.render(state.world, camera, hoverTile);
  tileInfoPanel.update(state.world, hoverTile);
  econPanel.update();
  const { rDemand, cDemand, iDemand } = state.world.stats;
  demandChart.update(state.world.tick, rDemand, cDemand, iDemand);
  if (hoverTile) statTile.textContent = `${hoverTile.tx}, ${hoverTile.ty}`;
  statCam.textContent   = `${Math.round(camera.x)}, ${Math.round(camera.y)}`;
  statZoom.textContent  = camera.zoom.toFixed(2) + '×';
  statMoney.textContent = formatMoney(state.world.budget.money);
  statMoney.classList.toggle('negative', state.world.budget.money < 0);
  statPop.textContent   = state.world.stats.population.toLocaleString();
  statPower.textContent = `${state.world.stats.powerDemand} / ${state.world.stats.powerSupply}`;
  statWater.textContent  = `${state.world.stats.waterDemand} / ${state.world.stats.waterSupply}`;
  statSewage.textContent   = `${state.world.stats.sewageDemand} / ${state.world.stats.sewageSupply}`;
  statServices.textContent = `${state.world.stats.servicesCoveredZones}`;
  statDate.textContent     = formatDate(state.world.tick);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
