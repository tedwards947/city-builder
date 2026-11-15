// Drives InputController with synthetic pointer events against a fake canvas.
// Covers the gesture logic; real browser pointer capture / touch behaviour is
// not exercised here.
import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../sim/World';
import { Camera } from '../render/Camera';
import { TILE_SIZE } from '../render/Projection';
import { CommandHistory } from '../commands/CommandHistory';
import { InputController, isPaintTool } from '../input/InputController';
import type { Tool } from '../input/InputController';
import { ROAD_NONE, ROAD_STREET, ROAD_AVENUE, ZONE_NONE, ZONE_R, BUILDING_PARK, BUILDING_NONE, TERRAIN_WATER } from '../sim/constants';
import { autoRoadPath, planAutoRoad } from '../input/autoRoad';
import { BALANCE } from '../data/balance';

const STREET_COST = BALANCE.roadClasses[ROAD_STREET].cost;

type Handler = (e: unknown) => void;

class FakeCanvas {
  handlers = new Map<string, Handler>();
  addEventListener(type: string, h: Handler): void { this.handlers.set(type, h); }
  getBoundingClientRect() { return { left: 0, top: 0 }; }
  setPointerCapture(): void {}
  fire(type: string, props: Record<string, unknown>): { defaultPrevented: boolean } {
    const e = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, button: 0, pointerId: 1, ...props };
    this.handlers.get(type)?.(e);
    return e;
  }
}

/** Top-left of a w×h block of dry, empty tiles. */
function dryBlock(world: World, w: number, h: number): { tx: number; ty: number } {
  for (let ty = 1; ty + h < world.grid.height; ty++) {
    for (let tx = 1; tx + w < world.grid.width; tx++) {
      let ok = true;
      for (let dy = 0; dy < h && ok; dy++) for (let dx = 0; dx < w; dx++) {
        if (world.getTerrain(tx + dx, ty + dy) === TERRAIN_WATER) { ok = false; break; }
      }
      if (ok) return { tx, ty };
    }
  }
  throw new Error('no dry block');
}

describe('InputController drag-to-paint', () => {
  let world: World;
  let history: CommandHistory;
  let camera: Camera;
  let canvas: FakeCanvas;
  let tool: Tool;
  let o: { tx: number; ty: number };

  // Screen position of the centre of tile (o.tx + dx, o.ty + dy).
  let at: (dx: number, dy: number) => { clientX: number; clientY: number };

  beforeEach(() => {
    world = new World(64, 64, 1);
    history = new CommandHistory(world);
    camera = new Camera(800, 600);
    camera.zoom = 1;
    canvas = new FakeCanvas();
    tool = 'none';
    o = dryBlock(world, 12, 12);
    camera.centerOnTile(o.tx + 6, o.ty + 6);
    // Fixed screen positions, computed against the starting camera, so that
    // panning during a test does not move where the "finger" is.
    const camX0 = camera.x, camY0 = camera.y, zoom0 = camera.zoom;
    at = (dx, dy) => ({
      clientX: ((o.tx + dx + 0.5) * TILE_SIZE - camX0) * zoom0,
      clientY: ((o.ty + dy + 0.5) * TILE_SIZE - camY0) * zoom0,
    });
    new InputController(
      canvas as unknown as HTMLCanvasElement, camera,
      () => world, () => history, () => tool, () => {},
    );
  });

  it('classifies paint tools', () => {
    expect(isPaintTool('road')).toBe(true);
    expect(isPaintTool('zoneC')).toBe(true);
    expect(isPaintTool('bulldoze')).toBe(true);
    expect(isPaintTool('park')).toBe(false);
    expect(isPaintTool('none')).toBe(false);
    expect(isPaintTool('inspect')).toBe(false);
  });

  it('maps screen positions to the expected tiles (test harness sanity)', () => {
    const p = at(3, 2);
    expect(camera.screenToTile(p.clientX, p.clientY)).toEqual({ tx: o.tx + 3, ty: o.ty + 2 });
  });

  it('road drag paints an axis-locked straight line, with no gaps on a fast drag, and does not pan', () => {
    tool = 'road';
    const camX = camera.x, camY = camera.y;
    canvas.fire('pointerdown', at(0, 0));
    canvas.fire('pointermove', at(1, 0));          // locks to x
    canvas.fire('pointermove', at(8, 3));          // one big jump, drifting off-axis
    canvas.fire('pointerup',   at(8, 3));
    for (let dx = 0; dx <= 8; dx++) expect(world.getRoad(o.tx + dx, o.ty)).toBe(ROAD_STREET);
    for (let dy = 1; dy <= 3; dy++) expect(world.getRoad(o.tx + 8, o.ty + dy)).toBe(ROAD_NONE);
    expect(camera.x).toBe(camX);
    expect(camera.y).toBe(camY);
  });

  it('a whole stroke undoes and redoes as one step', () => {
    tool = 'road';
    const before = world.budget.money;
    canvas.fire('pointerdown', at(0, 0));
    canvas.fire('pointermove', at(0, 5));
    canvas.fire('pointerup',   at(0, 5));
    for (let dy = 0; dy <= 5; dy++) expect(world.getRoad(o.tx, o.ty + dy)).toBe(ROAD_STREET);
    history.undo();
    for (let dy = 0; dy <= 5; dy++) expect(world.getRoad(o.tx, o.ty + dy)).toBe(ROAD_NONE);
    expect(world.budget.money).toBe(before);
    expect(history.canUndo).toBe(false);
    history.redo();
    for (let dy = 0; dy <= 5; dy++) expect(world.getRoad(o.tx, o.ty + dy)).toBe(ROAD_STREET);
  });

  it('zone drag paints every tile crossed, pays once per tile, and leaves roads alone', () => {
    tool = 'road';
    canvas.fire('pointerdown', at(3, 0));
    canvas.fire('pointerup',   at(3, 0));
    tool = 'zoneR';
    const before = world.budget.money;
    canvas.fire('pointerdown', at(0, 0));
    canvas.fire('pointermove', at(6, 0));
    canvas.fire('pointermove', at(0, 0));          // sweep back over the same tiles
    canvas.fire('pointerup',   at(0, 0));
    for (let dx = 0; dx <= 6; dx++) {
      if (dx === 3) {
        expect(world.getRoad(o.tx + 3, o.ty)).toBe(ROAD_STREET);
        expect(world.getZone(o.tx + 3, o.ty)).toBe(ZONE_NONE);
      } else {
        expect(world.getZone(o.tx + dx, o.ty)).toBe(ZONE_R);
      }
    }
    const perTile = (before - world.budget.money) / 6;
    expect(perTile).toBeGreaterThan(0);
    // Dragging over already-zoned tiles in a second stroke costs nothing.
    const mid = world.budget.money;
    canvas.fire('pointerdown', at(0, 0));
    canvas.fire('pointermove', at(6, 0));
    canvas.fire('pointerup',   at(6, 0));
    expect(world.budget.money).toBe(mid);
  });

  it('a diagonal zone drag leaves a connected path', () => {
    tool = 'zoneR';
    canvas.fire('pointerdown', at(0, 0));
    canvas.fire('pointermove', at(5, 5));
    canvas.fire('pointerup',   at(5, 5));
    let count = 0;
    for (let dy = 0; dy <= 5; dy++) for (let dx = 0; dx <= 5; dx++) {
      if (world.getZone(o.tx + dx, o.ty + dy) === ZONE_R) count++;
    }
    expect(count).toBe(11); // 4-connected staircase from (0,0) to (5,5)
  });

  it('bulldoze drag clears a run in one undo step', () => {
    tool = 'road';
    canvas.fire('pointerdown', at(0, 2));
    canvas.fire('pointermove', at(5, 2));
    canvas.fire('pointerup',   at(5, 2));
    tool = 'bulldoze';
    canvas.fire('pointerdown', at(0, 2));
    canvas.fire('pointermove', at(5, 2));
    canvas.fire('pointerup',   at(5, 2));
    for (let dx = 0; dx <= 5; dx++) expect(world.getRoad(o.tx + dx, o.ty + 2)).toBe(ROAD_NONE);
    history.undo();
    for (let dx = 0; dx <= 5; dx++) expect(world.getRoad(o.tx + dx, o.ty + 2)).toBe(ROAD_STREET);
  });

  it('View tool drag pans and paints nothing', () => {
    tool = 'none';
    const camX = camera.x;
    canvas.fire('pointerdown', at(0, 0));
    canvas.fire('pointermove', at(4, 0));
    canvas.fire('pointerup',   at(4, 0));
    expect(camera.x).not.toBe(camX);
    expect(history.canUndo).toBe(false);
  });

  it('right-button drag pans even with a paint tool, and a right click never applies the tool', () => {
    tool = 'road';
    const camX = camera.x;
    canvas.fire('pointerdown', { ...at(0, 0), button: 2 });
    canvas.fire('pointermove', { ...at(4, 0), button: 2 });
    canvas.fire('pointerup',   { ...at(4, 0), button: 2 });
    expect(camera.x).not.toBe(camX);
    canvas.fire('pointerdown', { ...at(1, 1), button: 2 });
    canvas.fire('pointerup',   { ...at(1, 1), button: 2 });
    expect(history.canUndo).toBe(false);
    expect(canvas.fire('contextmenu', {}).defaultPrevented).toBe(true);
  });

  it('building tools stay tap-only: tap places one, drag pans and places none', () => {
    tool = 'park';
    canvas.fire('pointerdown', at(2, 2));
    canvas.fire('pointerup',   at(2, 2));
    expect(world.getBuilding(o.tx + 2, o.ty + 2)).toBe(BUILDING_PARK);
    const camX = camera.x;
    canvas.fire('pointerdown', at(4, 4));
    canvas.fire('pointermove', at(8, 4));
    canvas.fire('pointerup',   at(8, 4));
    expect(camera.x).not.toBe(camX);
    expect(world.buildings.length).toBe(1);
    expect(world.getBuilding(o.tx + 4, o.ty + 4)).toBe(BUILDING_NONE);
  });

  it('a second finger cancels the stroke the first finger started, then pans without painting', () => {
    tool = 'road';
    const before = world.budget.money;
    const camX = camera.x;
    canvas.fire('pointerdown', { ...at(0, 0), pointerId: 1 });
    expect(world.getRoad(o.tx, o.ty)).toBe(ROAD_STREET);
    canvas.fire('pointerdown', { ...at(2, 0), pointerId: 2 });
    expect(world.getRoad(o.tx, o.ty)).toBe(ROAD_NONE);
    expect(world.budget.money).toBe(before);
    // Both fingers move right together: pan, no zoom change, no paint.
    const zoom = camera.zoom;
    canvas.fire('pointermove', { ...at(3, 0), pointerId: 1 });
    canvas.fire('pointermove', { ...at(5, 0), pointerId: 2 });
    expect(camera.x).not.toBe(camX);
    expect(camera.zoom).toBeCloseTo(zoom, 5);
    canvas.fire('pointerup', { ...at(5, 0), pointerId: 2 });
    canvas.fire('pointermove', { ...at(4, 0), pointerId: 1 });
    canvas.fire('pointerup', { ...at(4, 0), pointerId: 1 });
    expect(history.canUndo).toBe(false);
    for (let dx = 0; dx <= 6; dx++) expect(world.getRoad(o.tx + dx, o.ty)).toBe(ROAD_NONE);
  });

  it('pinch still zooms', () => {
    const zoom = camera.zoom;
    canvas.fire('pointerdown', { ...at(2, 0), pointerId: 1 });
    canvas.fire('pointerdown', { ...at(4, 0), pointerId: 2 });
    canvas.fire('pointermove', { ...at(0, 0), pointerId: 1 });
    canvas.fire('pointermove', { ...at(6, 0), pointerId: 2 });
    expect(camera.zoom).toBeGreaterThan(zoom);
  });
});

describe('InputController auto road mode', () => {
  let world: World;
  let history: CommandHistory;
  let camera: Camera;
  let canvas: FakeCanvas;
  let tool: Tool;
  let mode: 'manual' | 'auto';
  let input: InputController;
  let rejected: string[];
  let o: { tx: number; ty: number };
  let at: (dx: number, dy: number) => { clientX: number; clientY: number };
  const click = (dx: number, dy: number, button = 0) => {
    canvas.fire('pointerdown', { ...at(dx, dy), button });
    canvas.fire('pointerup',   { ...at(dx, dy), button });
  };

  beforeEach(() => {
    world = new World(64, 64, 1);
    history = new CommandHistory(world);
    camera = new Camera(800, 600);
    camera.zoom = 1;
    canvas = new FakeCanvas();
    tool = 'road';
    mode = 'auto';
    rejected = [];
    o = dryBlock(world, 12, 12);
    camera.centerOnTile(o.tx + 6, o.ty + 6);
    const camX0 = camera.x, camY0 = camera.y;
    at = (dx, dy) => ({
      clientX: (o.tx + dx + 0.5) * TILE_SIZE - camX0,
      clientY: (o.ty + dy + 0.5) * TILE_SIZE - camY0,
    });
    input = new InputController(
      canvas as unknown as HTMLCanvasElement, camera,
      () => world, () => history, () => tool, () => {},
      (reason) => rejected.push(reason), () => mode,
    );
  });

  it('first click only marks the start; second click builds a right-angled road as one undo step', () => {
    const before = world.budget.money;
    click(1, 1);
    expect(world.getRoad(o.tx + 1, o.ty + 1)).toBe(ROAD_NONE);
    expect(input.autoRoadStart).toEqual({ tx: o.tx + 1, ty: o.ty + 1 });
    canvas.fire('pointermove', at(5, 3));          // hovering builds nothing
    expect(world.budget.money).toBe(before);
    click(8, 4);
    // Longer leg (x) first, then down.
    for (let dx = 1; dx <= 8; dx++) expect(world.getRoad(o.tx + dx, o.ty + 1)).toBe(ROAD_STREET);
    for (let dy = 1; dy <= 4; dy++) expect(world.getRoad(o.tx + 8, o.ty + dy)).toBe(ROAD_STREET);
    expect(world.getRoad(o.tx + 1, o.ty + 4)).toBe(ROAD_NONE);
    expect(input.autoRoadStart).toBeNull();
    history.undo();
    expect(world.budget.money).toBe(before);
    expect(world.getRoad(o.tx + 8, o.ty + 4)).toBe(ROAD_NONE);
    expect(history.canUndo).toBe(false);
  });

  it('right-click abandons the road; a right-drag pans and keeps it', () => {
    click(1, 1);
    canvas.fire('pointerdown', { ...at(4, 4), button: 2 });
    canvas.fire('pointermove', { ...at(7, 7), button: 2 });
    canvas.fire('pointerup',   { ...at(7, 7), button: 2 });
    expect(input.autoRoadStart).not.toBeNull();
    click(4, 4, 2);
    expect(input.autoRoadStart).toBeNull();
    expect(history.canUndo).toBe(false);
  });

  it('builds nothing and keeps the start when the money does not cover the whole road', () => {
    click(1, 1);
    world.budget.money = STREET_COST * 3;           // enough for 3 of 6 tiles
    click(6, 1);
    for (let dx = 1; dx <= 6; dx++) expect(world.getRoad(o.tx + dx, o.ty + 1)).toBe(ROAD_NONE);
    expect(world.budget.money).toBe(STREET_COST * 3);
    expect(rejected).toEqual(['funds']);
    expect(input.autoRoadStart).toEqual({ tx: o.tx + 1, ty: o.ty + 1 });
    expect(history.canUndo).toBe(false);
  });

  it('skips a building in the way, and existing road costs nothing', () => {
    world.placeBuilding(o.tx + 3, o.ty + 1, BUILDING_PARK);
    world.setRoad(o.tx + 4, o.ty + 1, ROAD_STREET);
    const before = world.budget.money;
    click(1, 1);
    click(6, 1);
    expect(world.getBuilding(o.tx + 3, o.ty + 1)).toBe(BUILDING_PARK);
    expect(world.getRoad(o.tx + 6, o.ty + 1)).toBe(ROAD_STREET);
    expect(before - world.budget.money).toBe(STREET_COST * 4);
  });

  it('switching tool or mode drops the start; manual mode still drags', () => {
    click(1, 1);
    tool = 'avenue';
    expect(input.autoRoadStart).toBeNull();
    tool = 'road';
    click(1, 1);
    mode = 'manual';
    expect(input.autoRoadStart).toBeNull();
    canvas.fire('pointerdown', at(0, 6));
    canvas.fire('pointermove', at(3, 6));
    canvas.fire('pointerup',   at(3, 6));
    for (let dx = 0; dx <= 3; dx++) expect(world.getRoad(o.tx + dx, o.ty + 6)).toBe(ROAD_STREET);
  });

  it('a drag in auto mode pans instead of building', () => {
    const camX = camera.x;
    canvas.fire('pointerdown', at(1, 1));
    canvas.fire('pointermove', at(5, 1));
    canvas.fire('pointerup',   at(5, 1));
    expect(camera.x).not.toBe(camX);
    expect(input.autoRoadStart).toBeNull();
  });
});

describe('auto road route and price', () => {
  it('is an L with no repeated tile, longer leg first', () => {
    const path = autoRoadPath({ tx: 2, ty: 2 }, { tx: 4, ty: 7 });
    expect(path[0]).toEqual({ tx: 2, ty: 2 });
    expect(path[path.length - 1]).toEqual({ tx: 4, ty: 7 });
    expect(path).toHaveLength(8);
    expect(path[5]).toEqual({ tx: 2, ty: 7 });      // the corner: y leg first
    expect(new Set(path.map(p => p.tx + ',' + p.ty)).size).toBe(8);
    expect(autoRoadPath({ tx: 3, ty: 3 }, { tx: 3, ty: 3 })).toEqual([{ tx: 3, ty: 3 }]);
  });

  it('prices new road, upgrades and blocked tiles like the build does', () => {
    const world = new World(64, 64, 1);
    const o = dryBlock(world, 8, 2);
    world.setRoad(o.tx + 1, o.ty, ROAD_STREET);
    world.placeBuilding(o.tx + 2, o.ty, BUILDING_PARK);
    const tiles = autoRoadPath({ tx: o.tx, ty: o.ty }, { tx: o.tx + 4, ty: o.ty });
    const street = planAutoRoad(world, tiles, ROAD_STREET);
    expect(street).toMatchObject({ cost: STREET_COST * 3, buildCount: 3, blockedCount: 1, affordable: true });
    const avenue = planAutoRoad(world, tiles, ROAD_AVENUE);
    const av = BALANCE.roadClasses[ROAD_AVENUE].cost;
    expect(avenue.cost).toBe(av * 3 + (av - STREET_COST));
    world.budget.money = avenue.cost - 1;
    expect(planAutoRoad(world, tiles, ROAD_AVENUE).affordable).toBe(false);
  });
});
