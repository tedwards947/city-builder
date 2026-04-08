import { World } from '../sim/World';
import type { CityEvents } from '../sim/EventBus';

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
      this.showToast('Resource Shortage', `Power demand exceeds supply! Deficit: ${p.deficit} MW`, 'alert');
    };
    this.handlers['powerRestored'] = () => {
      this.showToast('Resource Restored', 'Power supply has been stabilized.', 'info');
    };
    this.handlers['waterShortage'] = (p: CityEvents['waterShortage']) => {
      this.showToast('Resource Shortage', `Water demand exceeds supply! Deficit: ${p.deficit} units`, 'alert');
    };
    this.handlers['waterRestored'] = () => {
      this.showToast('Resource Restored', 'Water supply has been stabilized.', 'info');
    };
    this.handlers['sewageShortage'] = (p: CityEvents['sewageShortage']) => {
      this.showToast('Resource Shortage', `Sewage treatment capacity exceeded! Deficit: ${p.deficit} units`, 'alert');
    };
    this.handlers['sewageRestored'] = () => {
      this.showToast('Resource Restored', 'Sewage treatment capacity stabilized.', 'info');
    };
    this.handlers['crimeSpike'] = (p: CityEvents['crimeSpike']) => {
      this.showToast('Crime Wave', `High crime reported in ${p.affectedTiles} areas!`, 'warning');
    };
    this.handlers['fireIgnition'] = (p: CityEvents['fireIgnition']) => {
      this.showToast('Fire Alert', `Fire started at ${p.tx}, ${p.ty}!`, 'alert');
    };
    this.handlers['healthcareCrisis'] = (p: CityEvents['healthcareCrisis']) => {
      this.showToast('Healthcare Crisis', `Widespread sickness reported in ${p.affectedTiles} areas!`, 'alert');
    };
    this.handlers['tileAbandoned'] = (p: CityEvents['tileAbandoned']) => {
      // Only notify for higher level buildings to avoid spam
      if (p.level >= 2) {
        this.showToast('Building Abandoned', `A level ${p.level} building was abandoned at ${p.tx}, ${p.ty}.`, 'warning');
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
