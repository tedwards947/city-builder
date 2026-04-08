import { World } from '../sim/World';
import type { CityEvents } from '../sim/EventBus';
import { t } from '../i18n';

export type ToastType = 'info' | 'warning' | 'alert';

export class ToastPanel {
  private container: HTMLDivElement;
  private world: World | null = null;
  private readonly handlers: Record<string, (payload: any) => void> = {};
  private readonly maxToasts: number = 3;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'toast-container';
    document.body.appendChild(this.container);

    this.setupHandlers();
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
      this.showToast(t('ui.toast.crimeWaveTitle'), t('ui.toast.crimeWaveMsg', { affectedTiles: p.affectedTiles }), 'warning');
    };
    this.handlers['fireIgnition'] = (p: CityEvents['fireIgnition']) => {
      this.showToast(t('ui.toast.fireAlertTitle'), t('ui.toast.fireAlertMsg', { tx: p.tx, ty: p.ty }), 'alert');
    };
    this.handlers['healthcareCrisis'] = (p: CityEvents['healthcareCrisis']) => {
      this.showToast(t('ui.toast.healthcareCrisisTitle'), t('ui.toast.healthcareCrisisMsg', { affectedTiles: p.affectedTiles }), 'alert');
    };
    this.handlers['tileAbandoned'] = (p: CityEvents['tileAbandoned']) => {
      // Only notify for higher level buildings to avoid spam
      if (p.level >= 2) {
        this.showToast(t('ui.toast.buildingAbandonedTitle'), t('ui.toast.buildingAbandonedMsg', { level: p.level, tx: p.tx, ty: p.ty }), 'warning');
      }
    };
  }

  public showToast(title: string, message: string, type: ToastType = 'info'): void {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
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
