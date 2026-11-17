import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastPanel, fireReportText } from '../ui/ToastPanel';
import { World } from '../sim/World';

describe('ToastPanel', () => {
  let toastPanel: ToastPanel;
  let world: World;
  const originalDocument = globalThis.document;

  beforeEach(() => {
    // Mock basic DOM environment
    globalThis.document = {
      createElement: vi.fn().mockImplementation((tag) => {
        if (tag === 'div') {
          return {
            appendChild: vi.fn(),
            classList: { 
              add: vi.fn(),
              toggle: vi.fn(),
              remove: vi.fn()
            },
            addEventListener: vi.fn(),
            parentNode: null,
            textContent: '',
            className: '',
            style: {},
            children: []
          };
        }
        return {};
      }),
      body: {
        appendChild: vi.fn()
      }
    } as any;

    toastPanel = new ToastPanel();
    
    // Inject mock container for testing removeChild and children.length
    const mockToasts: any[] = [];
    (toastPanel as any).container = {
      appendChild: vi.fn().mockImplementation((el) => {
        el.parentNode = (toastPanel as any).container;
        mockToasts.push(el);
      }),
      removeChild: vi.fn().mockImplementation((el) => {
        const idx = mockToasts.indexOf(el);
        if (idx !== -1) mockToasts.splice(idx, 1);
        el.parentNode = null;
      }),
      id: 'toast-container',
      get children() { return mockToasts; }
    };

    world = new World(10, 10, 0);
    toastPanel.setWorld(world);
  });

  afterEach(() => {
    globalThis.document = originalDocument;
    vi.restoreAllMocks();
  });

  it('subscribes to world events', () => {
    const onSpy = vi.spyOn(world.events, 'on');
    toastPanel.setWorld(world);
    expect(onSpy).toHaveBeenCalledWith('powerShortage', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('crimeSpike', expect.any(Function));
  });

  it('shows toast when powerShortage occurs', () => {
    const showToastSpy = vi.spyOn(toastPanel, 'showToast');
    world.events.emit('powerShortage', { supply: 0, demand: 100, deficit: 100 });
    expect(showToastSpy).toHaveBeenCalledWith('Resource Shortage', expect.stringContaining('100 MW'), 'alert');
  });

  it('enforces max toasts limit', () => {
    const container = (toastPanel as any).container;
    
    // Emit 5 events
    world.events.emit('powerShortage', { supply: 0, demand: 100, deficit: 100 });
    world.events.emit('waterShortage', { supply: 0, demand: 100, deficit: 100 });
    world.events.emit('sewageShortage', { supply: 0, demand: 100, deficit: 100 });
    world.events.emit('crimeSpike', { avgCrime: 80, threshold: 60, affectedTiles: 5 });
    world.events.emit('healthcareCrisis', { avgSickness: 100, threshold: 80, affectedTiles: 3 });

    // Should only have 3 toasts
    expect(container.children.length).toBe(3);
  });

  it('shows toast when building is abandoned', () => {
    const showToastSpy = vi.spyOn(toastPanel, 'showToast');
    world.events.emit('tileAbandoned', { tx: 1, ty: 1, zone: 1, level: 2 });
    expect(showToastSpy).toHaveBeenCalledWith('Building Abandoned', expect.stringContaining('level 2'), 'warning', { x0: 1, y0: 1, x1: 1, y1: 1 });
  });

  it('does NOT show toast when low-level building is abandoned', () => {
    const showToastSpy = vi.spyOn(toastPanel, 'showToast');
    world.events.emit('tileAbandoned', { tx: 1, ty: 1, zone: 1, level: 1 });
    expect(showToastSpy).not.toHaveBeenCalled();
  });

  it('shows no toast for a single ignition or a single damaged building', () => {
    const showToastSpy = vi.spyOn(toastPanel, 'showToast');
    world.events.emit('fireIgnition', { tx: 5, ty: 5, zone: 1, devLevel: 1 });
    world.events.emit('fireDamage', { tx: 5, ty: 5, zone: 1, level: 2 });
    expect(showToastSpy).not.toHaveBeenCalled();
  });

  it('shows one grouped toast for the fire report, pointing at the latest fire', () => {
    const showToastSpy = vi.spyOn(toastPanel, 'showToast');
    world.events.emit('fireReport', { burning: 3, started: 3, damaged: 2, tx: 5, ty: 6 });
    expect(showToastSpy).toHaveBeenCalledTimes(1);
    expect(showToastSpy).toHaveBeenCalledWith('Fire Alert', '3 fires burning with no fire station in reach · 2 buildings damaged', 'alert', { x0: 5, y0: 6, x1: 5, y1: 6 });
  });

  it('words the fire report for one fire, no damage, and damage alone', () => {
    expect(fireReportText(1, 0)).toBe('A fire is burning with no fire station in reach');
    expect(fireReportText(2, 1)).toBe('2 fires burning with no fire station in reach · 1 building damaged');
    expect(fireReportText(0, 1)).toBe('Fire damaged a building with no fire station in reach');
    expect(fireReportText(0, 4)).toBe('Fire damaged 4 buildings with no fire station in reach');
    expect(fireReportText(0, 0)).toBe('');
  });
});
