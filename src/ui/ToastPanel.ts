import { BALANCE } from '../data/balance';
import { World } from '../sim/World';
import type { CityEvents } from '../sim/EventBus';
import { t } from '../i18n';
import { BUILDING_NAME } from './TileInfoPanel';
import { pcAmount } from './pcFormat';
import { buildingSeats, hasCapacity } from '../sim/serviceCapacity';
import { drawsTourists, hasGateway } from '../sim/leisureTraffic';

export type ToastType = 'info' | 'warning' | 'alert';

/** Where a toast is about, in tiles (inclusive corners). A single tile has x0 = x1, y0 = y1. */
export interface ToastPlace { x0: number; y0: number; x1: number; y1: number }
const tile = (tx: number, ty: number): ToastPlace => ({ x0: tx, y0: ty, x1: tx, y1: ty });

/** "3 fires burning with no fire station in reach · 2 buildings damaged". Empty when there is nothing to say. */
export function fireReportText(burning: number, damaged: number): string {
  const hurt = damaged === 1 ? t('ui.toast.fireDamagedOne') : damaged > 1 ? t('ui.toast.fireDamagedMany', { n: damaged }) : '';
  if (burning <= 0) {
    return damaged === 1 ? t('ui.toast.fireDamagedOnlyOne') : damaged > 1 ? t('ui.toast.fireDamagedOnlyMany', { n: damaged }) : '';
  }
  const fires = burning === 1 ? t('ui.toast.fireBurningOne') : t('ui.toast.fireBurningMany', { n: burning });
  return hurt ? `${fires} · ${hurt}` : fires;
}

/** True when a just-placed building draws tourists but the city has no airport to bring them. */
export function residentsOnlyWarning(world: World, kind: number): boolean {
  return drawsTourists(kind) && !hasGateway(world);
}

/** The game-day toast for an `eventDayEnded` result, or null when nobody wanted to come. */
export function eventDayToast(p: { wanted: number; arrived: number; stuckResidents: number; pc: number; declined: number }): { title: string; text: string; type: ToastType } | null {
  if (p.wanted <= 0) return null;
  let text = t('ui.toast.eventDayFans', { arrived: Math.round(p.arrived), wanted: Math.round(p.wanted) });
  if (p.stuckResidents > 0) text += t('ui.toast.eventDayStuck', { n: Math.round(p.stuckResidents).toLocaleString('en-US'), pc: pcAmount(p.pc) });
  if (p.declined > 0) text += t('ui.toast.eventDayDeclined', { n: p.declined });
  return { title: t('ui.toast.eventDayTitle'), text, type: p.stuckResidents > 0 ? 'warning' : 'info' };
}

/** Anchors of buildings already announced as full, per world (one toast per building). */
const announcedFull = new WeakMap<World, Set<number>>();
const lastCheckDay = new WeakMap<World, number>();

/** Capacity-limited service buildings that have started turning residents away since the last call: their anchor tile and how many are left out. */
export function newlyFullBuildings(world: World): { tx: number; ty: number; kind: number; n: number }[] {
  let seen = announcedFull.get(world);
  if (!seen) { seen = new Set(); announcedFull.set(world, seen); }
  const out: { tx: number; ty: number; kind: number; n: number }[] = [];
  for (const b of world.buildings) {
    if (!hasCapacity(b.kind)) continue;
    const key = b.ty * world.grid.width + b.tx;
    if (seen.has(key)) continue;
    const s = buildingSeats(world, b.tx, b.ty);
    if (s && s.inReachUnseated > 0) { seen.add(key); out.push({ tx: b.tx, ty: b.ty, kind: b.kind, n: Math.round(s.inReachUnseated) }); }
  }
  return out;
}

export class ToastPanel {
  private container: HTMLDivElement;
  private world: World | null = null;
  private readonly handlers: Record<string, (payload: any) => void> = {};
  private readonly maxToasts: number = 3;
  /** Called when the player clicks a toast that is about a place. Set by main.ts (moves the camera). */
  public onGo: ((place: ToastPlace) => void) | null = null;
  /** While true no toast is shown, and what is asked for is dropped (the title screen: the city behind is not the player's). */
  public quiet = false;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'toast-container';
    document.body.appendChild(this.container);

    this.setupHandlers();
  }

  /** Called every frame: once a game day, toasts each service building that has just turned residents away (once per building). */
  public checkFull(world: World): void {
    const day = Math.floor(world.tick / BALANCE.ticksPerDay);
    if (lastCheckDay.get(world) === day) return;
    const first = !lastCheckDay.has(world);
    lastCheckDay.set(world, day);
    // The first look at a world (a loaded save) only notes what is already full, so it does not toast all at once.
    if (this.quiet || first) { newlyFullBuildings(world); return; }
    for (const f of newlyFullBuildings(world)) {
      const name = BUILDING_NAME[f.kind] ? t(BUILDING_NAME[f.kind]) : t('buildings.building');
      this.showToast(t('ui.toast.buildingFullTitle', { name }), t('ui.toast.buildingFullMsg', { n: f.n.toLocaleString('en-US') }), 'warning', tile(f.tx, f.ty));
    }
  }

  public setWorld(world: World): void {
    if (this.world) {
      // Unsubscribe from old world
      for (const [type, handler] of Object.entries(this.handlers)) {
        this.world.events.off(type, handler);
      }
    }

    this.world = world;

    // Subscribe to new world
    for (const [type, handler] of Object.entries(this.handlers)) {
      this.world.events.on(type, handler);
    }
  }

  private setupHandlers(): void {
    this.handlers['buildingPlaced'] = (p: { tx: number; ty: number; kind: number }) => {
      if (this.world && residentsOnlyWarning(this.world, p.kind)) {
        this.showToast(t('ui.toast.residentsOnlyTitle'), t('ui.toast.residentsOnlyMsg'), 'warning', tile(p.tx, p.ty));
      }
    };
    this.handlers['eventStarted'] = (p: CityEvents['eventStarted']) => {
      this.showToast(t('ui.toast.eventStartedTitle'), t('ui.toast.eventStartedMsg'), 'info', tile(p.tx, p.ty));
    };
    this.handlers['eventDayEnded'] = (p: CityEvents['eventDayEnded']) => {
      const toast = eventDayToast(p);
      if (toast) this.showToast(toast.title, toast.text, toast.type, tile(p.tx, p.ty));
    };
    this.handlers['powerShortage'] = (p: CityEvents['powerShortage']) => {
      this.showToast(t('ui.toast.resourceShortage'), t('ui.toast.powerDemandExceeds', { deficit: p.deficit }), 'alert');
    };
    this.handlers['powerRestored'] = () => {
      this.showToast(t('ui.toast.resourceRestored'), t('ui.toast.powerStabilized'), 'info');
    };
    this.handlers['waterShortage'] = (p: CityEvents['waterShortage']) => {
      this.showToast(t('ui.toast.resourceShortage'), t('ui.toast.waterDemandExceeds', { deficit: p.deficit }), 'alert');
    };
    this.handlers['waterRestored'] = () => {
      this.showToast(t('ui.toast.resourceRestored'), t('ui.toast.waterStabilized'), 'info');
    };
    this.handlers['sewageShortage'] = (p: CityEvents['sewageShortage']) => {
      this.showToast(t('ui.toast.resourceShortage'), t('ui.toast.sewageCapacityExceeded', { deficit: p.deficit }), 'alert');
    };
    this.handlers['sewageRestored'] = () => {
      this.showToast(t('ui.toast.resourceRestored'), t('ui.toast.sewageStabilized'), 'info');
    };
    this.handlers['crimeSpike'] = (p: CityEvents['crimeSpike']) => {
      this.showToast(t('ui.toast.crimeWaveTitle'), t('ui.toast.crimeWaveMsg', { affectedTiles: p.affectedTiles }), 'warning', tile(p.tx, p.ty));
    };
    // Fires: one grouped toast from the sim's summary, and only for fires no
    // station can reach. A fire inside fire cover goes out by itself, so each
    // ignition no longer toasts (a big city had one every half second).
    this.handlers['fireReport'] = (p: CityEvents['fireReport']) => {
      const text = fireReportText(p.burning, p.damaged);
      if (text) this.showToast(t('ui.toast.fireAlertTitle'), text, 'alert', tile(p.tx, p.ty));
    };
    this.handlers['healthcareCrisis'] = (p: CityEvents['healthcareCrisis']) => {
      this.showToast(t('ui.toast.healthcareCrisisTitle'), t('ui.toast.healthcareCrisisMsg', { affectedTiles: p.affectedTiles }), 'alert', tile(p.tx, p.ty));
    };
    this.handlers['budgetWarning'] = (p: CityEvents['budgetWarning']) => {
      this.showToast(t('ui.toast.lowFundsTitle'), t('ui.toast.lowFundsMsg', { days: Math.max(1, Math.round(p.daysLeft)) }), 'warning');
    };
    this.handlers['debtWarning'] = (p: CityEvents['debtWarning']) => {
      const money = (n: number) => '$' + Math.round(Math.abs(n)).toLocaleString();
      if (p.level === 'half') this.showToast(t('ui.toast.debtHalfTitle'), t('ui.toast.debtHalfMsg', { money: money(p.money), limit: money(p.limit) }), 'warning');
      // With the countdown off (debtGraceDays 0) there is no vote to warn of.
      else this.showToast(t('ui.toast.debtLimitTitle'), t(BALANCE.budget.debtGraceDays > 0 ? 'ui.toast.debtLimitMsg' : 'ui.toast.debtLimitNoVoteMsg', { limit: money(p.limit) }), 'alert');
    };
    this.handlers['debtEntered'] = () => {
      this.showToast(t('ui.toast.debtTitle'), t('ui.toast.debtMsg'), 'alert');
    };
    this.handlers['debtCleared'] = () => {
      this.showToast(t('ui.toast.debtClearedTitle'), t('ui.toast.debtClearedMsg'), 'info');
    };
    // An action cut buildings off from their road: say which, and a click goes to the first.
    this.handlers['roadLost'] = (p: CityEvents['roadLost']) => {
      const list = p.buildings;
      if (list.length === 0) return;
      const name = (kind: number) => BUILDING_NAME[kind] ? t(BUILDING_NAME[kind]) : t('buildings.building');
      const first = list[0];
      const place = { x0: first.x0, y0: first.y0, x1: first.x1, y1: first.y1 };
      if (list.length === 1) {
        this.showToast(t('ui.toast.roadLostTitle', { name: name(first.kind) }), t('ui.toast.roadLostMsg'), 'alert', place);
      } else {
        const names = [...new Set(list.map((b) => name(b.kind)))].join(', ');
        this.showToast(t('ui.toast.roadLostManyTitle', { n: list.length }), t('ui.toast.roadLostManyMsg', { names }), 'alert', place);
      }
    };
    this.handlers['lotMerged'] = (p: CityEvents['lotMerged']) => {
      this.showToast(t('ui.toast.lotMergedTitle'), t(p.shape === 'square' ? 'ui.toast.lotMergedMsg' : 'ui.toast.lotMergedPairMsg'), 'info', tile(p.tx, p.ty));
    };
    this.handlers['tileAbandoned'] = (p: CityEvents['tileAbandoned']) => {
      // Only notify for higher level buildings to avoid spam
      if (p.level >= 2) {
        this.showToast(t('ui.toast.buildingAbandonedTitle'), t('ui.toast.buildingAbandonedMsg', { level: p.level, tx: p.tx, ty: p.ty }), 'warning', tile(p.tx, p.ty));
      }
    };
  }

  /** `place`: where the toast is about. Such a toast shows a chevron, and a click goes there instead of dismissing it. */
  public showToast(title: string, message: string, type: ToastType = 'info', place?: ToastPlace): void {
    if (this.quiet) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}` + (place ? ' go' : '');
    
    const titleEl = document.createElement('div');
    titleEl.className = 'toast-title';
    titleEl.textContent = title;
    toast.appendChild(titleEl);

    const messageEl = document.createElement('div');
    messageEl.textContent = message;
    toast.appendChild(messageEl);

    // Enforce max toasts limit
    while (this.container.children.length >= this.maxToasts) {
      const oldest = this.container.children[0];
      this.container.removeChild(oldest);
    }

    this.container.appendChild(toast);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      toast.classList.add('toast-out');
      setTimeout(() => {
        if (toast.parentNode === this.container) {
          this.container.removeChild(toast);
        }
      }, 300); // Wait for fade out animation
    }, 10000);

    // A toast about a place: a click goes there, and the toast stays.
    if (place) {
      toast.addEventListener('click', () => this.onGo?.(place));
      return;
    }

    // Allow clicking to dismiss early
    toast.addEventListener('click', () => {
      toast.classList.add('toast-out');
      setTimeout(() => {
        if (toast.parentNode === this.container) {
          this.container.removeChild(toast);
        }
      }, 300);
    });
  }
}
