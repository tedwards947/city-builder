// Zone fill mode: which lots a click beside a road zones.
import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../sim/World';
import { Camera } from '../render/Camera';
import { TILE_SIZE } from '../render/Projection';
import { CommandHistory } from '../commands/CommandHistory';
import { InputController } from '../input/InputController';
import type { Tool } from '../input/InputController';
import { planZoneFill, zoneFillReach, ZONE_FILL_REACH } from '../input/zoneFill';
import {
  ROAD_STREET, ROAD_AVENUE, ROAD_HIGHWAY, ZONE_NONE, ZONE_R, ZONE_C, BUILDING_PARK, TERRAIN_WATER, RAIL_GROUND, RAIL_ELEVATED, RAIL_SUBWAY,
} from '../sim/constants';
import { BALANCE } from '../data/balance';

/** Top-left of a w×h block of dry tiles. */
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

describe('zone fill', () => {
  let world: World;
  let o: { tx: number; ty: number };
  const road = (dx: number, dy: number, cls = ROAD_STREET) => world.setRoad(o.tx + dx, o.ty + dy, cls);
  const at = (dx: number, dy: number) => ({ tx: o.tx + dx, ty: o.ty + dy });
  /** The plan's tiles as "dx,dy" strings relative to the block. */
  const filled = (dx: number, dy: number, zone = ZONE_R) =>
    new Set(planZoneFill(world, at(dx, dy), zone).tiles.map(p => `${p.tx - o.tx},${p.ty - o.ty}`));

  beforeEach(() => {
    world = new World(96, 96, 1);
    o = dryBlock(world, 40, 24);
  });

  it('fills one side of a straight road, 8 tiles each way from the pointer', () => {
    for (let dx = 0; dx < 40; dx++) road(dx, 10);
    const got = filled(20, 9);
    expect(got.size).toBe(2 * ZONE_FILL_REACH + 1);
    for (let dx = 12; dx <= 28; dx++) expect(got.has(`${dx},9`)).toBe(true);
    expect([...got].every(k => k.endsWith(',9'))).toBe(true);     // nothing on the far side
  });

  it('surface rail (ground or elevated track) ends the paint; a subway does not', () => {
    for (let dx = 0; dx < 40; dx++) road(dx, 10);
    expect(world.layTrack(o.tx + 24, o.ty + 9, RAIL_GROUND)).toBe(true);
    const got = filled(20, 9);
    expect(got.has('23,9')).toBe(true);
    expect(got.has('24,9')).toBe(false);                           // the track itself
    expect(got.has('25,9')).toBe(false);                           // nor anything past it
    expect(got.has('12,9')).toBe(true);                            // the other way is unaffected
    expect(filled(24, 9).size).toBe(0);                            // pointing at track fills nothing

    world = new World(96, 96, 1);
    o = dryBlock(world, 40, 24);
    for (let dx = 0; dx < 40; dx++) road(dx, 10);
    expect(world.layTrack(o.tx + 24, o.ty + 9, RAIL_ELEVATED)).toBe(true);
    expect(filled(20, 9).has('25,9')).toBe(false);                 // elevated track occupies the tile too

    world = new World(96, 96, 1);
    o = dryBlock(world, 40, 24);
    for (let dx = 0; dx < 40; dx++) road(dx, 10);
    expect(world.layTrack(o.tx + 24, o.ty + 9, RAIL_SUBWAY)).toBe(true);
    const under = filled(20, 9);
    expect(under.has('24,9')).toBe(true);                          // a lot above a subway is fine
    expect(under.has('25,9')).toBe(true);
  });

  it('pointing at the road fills nothing; pointing a tile or two away still finds the near side', () => {
    for (let dx = 0; dx < 40; dx++) road(dx, 10);
    expect(filled(20, 10).size).toBe(0);
    const near = filled(20, 12);                                   // two tiles below the road
    expect(near.size).toBe(2 * ZONE_FILL_REACH + 1);
    expect([...near].every(k => k.endsWith(',11'))).toBe(true);
    expect(filled(20, 15).size).toBe(0);                           // too far from any road
  });

  it('follows a bend on the inside and on the outside', () => {
    for (let dx = 0; dx <= 20; dx++) road(dx, 4);                  // east…
    for (let dy = 5; dy <= 23; dy++) road(20, dy);                 // …then south
    const inside = filled(17, 5);                                  // below the first leg, left of the second
    expect(inside.has('12,5')).toBe(true);
    expect(inside.has('19,5')).toBe(true);                         // the inner corner
    expect(inside.has('19,9')).toBe(true);                         // round the bend, down the second leg
    expect(inside.has('21,6')).toBe(false);                        // not the outer side
    const outside = filled(18, 3);                                 // above the first leg
    expect(outside.has('20,3')).toBe(true);
    expect(outside.has('21,4')).toBe(true);                        // round the outer corner…
    expect(outside.has('21,7')).toBe(true);                        // …and down the outside
    expect(outside.has('19,5')).toBe(false);
  });

  it('inside a ring fills the inner edge only; outside it, the outer edge only', () => {
    // A 7×7 ring of road; the inside is 5×5, so its edge is 16 tiles.
    for (let k = 0; k < 7; k++) { road(10 + k, 5); road(10 + k, 11); road(10, 5 + k); road(16, 5 + k); }
    const inner = filled(13, 6);
    expect(inner.size).toBe(16);
    for (const k of inner) {
      const [x, y] = k.split(',').map(Number);
      expect(x > 10 && x < 16 && y > 5 && y < 11).toBe(true);
    }
    expect(inner.has('13,8')).toBe(false);                         // the middle touches no road
    const outer = filled(13, 4);
    expect(outer.size).toBeGreaterThan(0);
    for (const k of outer) {
      const [x, y] = k.split(',').map(Number);
      expect(x < 10 || x > 16 || y < 5 || y > 11).toBe(true);
    }
  });

  it('stops at a dead end instead of going round it', () => {
    for (let dx = 10; dx <= 20; dx++) road(dx, 10);                // ends at x=20
    const north = filled(18, 9);
    expect(north.has('20,9')).toBe(true);                          // beside the last road tile
    expect(north.has('21,10')).toBe(false);                        // the lot facing the end
    expect([...north].every(k => k.endsWith(',9'))).toBe(true);    // nothing on the south side
    expect(filled(21, 10)).toEqual(new Set(['21,10']));            // pointed at: just that lot
  });

  it('follows one road and never jumps to the frontage of another nearby', () => {
    for (let dx = 0; dx <= 20; dx++) road(dx, 2);                  // a road across the top
    for (let dy = 3; dy <= 20; dy++) road(20, dy);                 // and down the right
    for (let dy = 4; dy <= 10; dy++) road(12, dy);                 // a stub ending one lot short of the top road…
    for (let dx = 5; dx <= 11; dx++) road(dx, 10);                 // …which turns west at the bottom
    const got = filled(13, 7);                                     // east of the stub
    expect(got).toEqual(new Set([
      '13,4', '13,5', '13,6', '13,7', '13,8', '13,9', '13,10',     // up to the stub's end, down to its corner
      '12,11', '11,11', '10,11', '9,11', '8,11',                   // round the outside of the corner
    ]));
    // In particular: not the top road's frontage, not round the stub's end, not the right road's.
    for (const k of ['13,3', '12,3', '11,3', '11,5', '19,5']) expect(got.has(k)).toBe(false);
  });

  it('turns into a side street that joins on the pointer\'s side, and goes straight past one on the other side', () => {
    for (let dx = 0; dx < 40; dx++) road(dx, 10);
    for (let dy = 11; dy <= 20; dy++) road(20, dy);                // a side street going south
    const south = filled(17, 11);
    expect(south.has('19,11') && south.has('19,14')).toBe(true);   // round the corner, down the side street
    expect(south.has('21,11')).toBe(false);                        // not across it
    const north = filled(17, 9);
    expect(north.size).toBe(2 * ZONE_FILL_REACH + 1);
    expect([...north].every(k => k.endsWith(',9'))).toBe(true);
  });

  it('between two roads, fills only the strip between them', () => {
    for (let dy = 0; dy <= 23; dy++) road(20, dy);                 // a long road…
    for (let dy = 8; dy <= 14; dy++) road(18, dy);                 // …and a shorter one beside it, one lot apart
    for (let dx = 10; dx <= 18; dx++) road(dx, 14);                // which turns away west at the bottom
    const got = filled(19, 10);
    // x=19, y 8…14 all have road on both sides; nothing above, below or round the corner.
    expect(got).toEqual(new Set([8, 9, 10, 11, 12, 13, 14].map(y => `19,${y}`)));
    // From outside the sandwich the fill still runs along the long road, through the strip.
    const along = filled(19, 4);
    expect(along.has('19,6') && along.has('19,9')).toBe(true);
  });

  it('ignores highways, and works along avenues', () => {
    for (let dx = 0; dx < 40; dx++) road(dx, 10, ROAD_HIGHWAY);
    expect(filled(20, 9).size).toBe(0);
    expect(filled(20, 10).size).toBe(0);
    for (let dx = 0; dx < 40; dx++) road(dx, 16, ROAD_AVENUE);
    expect(filled(20, 15).size).toBe(2 * ZONE_FILL_REACH + 1);
  });

  it('zones only empty land, but walks past what is in the way', () => {
    for (let dx = 0; dx < 40; dx++) road(dx, 10);
    world.setZone(o.tx + 18, o.ty + 9, ZONE_C);
    world.placeBuilding(o.tx + 22, o.ty + 9, BUILDING_PARK);
    const plan = planZoneFill(world, at(20, 9), ZONE_R);
    const got = new Set(plan.tiles.map(p => `${p.tx - o.tx},${p.ty - o.ty}`));
    expect(got.has('18,9')).toBe(false);
    expect(got.has('22,9')).toBe(false);
    expect(got.has('17,9')).toBe(true);                            // beyond the zoned lot
    expect(got.has('24,9')).toBe(true);                            // beyond the park
    expect(plan.cost).toBe(15 * BALANCE.costs.zoneR);
    expect(zoneFillReach(world, at(20, 9))).toHaveLength(17);
    world.budget.money = plan.cost - 1;
    expect(planZoneFill(world, at(20, 9), ZONE_R).affordable).toBe(false);
  });
});

describe('InputController zone fill mode', () => {
  type Handler = (e: unknown) => void;
  class FakeCanvas {
    handlers = new Map<string, Handler>();
    addEventListener(type: string, h: Handler): void { this.handlers.set(type, h); }
    getBoundingClientRect() { return { left: 0, top: 0 }; }
    setPointerCapture(): void {}
    fire(type: string, props: Record<string, unknown>): void {
      this.handlers.get(type)?.({ preventDefault() {}, button: 0, pointerId: 1, ...props });
    }
  }

  let world: World;
  let history: CommandHistory;
  let camera: Camera;
  let canvas: FakeCanvas;
  let tool: Tool;
  let mode: 'drag' | 'fill';
  let rejected: string[];
  let o: { tx: number; ty: number };
  let at: (dx: number, dy: number) => { clientX: number; clientY: number };
  const click = (dx: number, dy: number) => {
    canvas.fire('pointerdown', at(dx, dy));
    canvas.fire('pointerup', at(dx, dy));
  };

  beforeEach(() => {
    world = new World(64, 64, 1);
    history = new CommandHistory(world);
    camera = new Camera(800, 600);
    camera.zoom = 1;
    canvas = new FakeCanvas();
    tool = 'zoneR';
    mode = 'fill';
    rejected = [];
    o = dryBlock(world, 12, 12);
    camera.centerOnTile(o.tx + 6, o.ty + 6);
    const camX0 = camera.x, camY0 = camera.y;
    at = (dx, dy) => ({
      clientX: (o.tx + dx + 0.5) * TILE_SIZE - camX0,
      clientY: (o.ty + dy + 0.5) * TILE_SIZE - camY0,
    });
    for (let dx = 0; dx < 12; dx++) world.setRoad(o.tx + dx, o.ty + 5, ROAD_STREET);
    new InputController(
      canvas as unknown as HTMLCanvasElement, camera,
      () => world, () => history, () => tool, () => {},
      (reason) => rejected.push(reason), () => 'manual', () => mode,
    );
  });

  it('one click zones the frontage, as one undo step', () => {
    const before = world.budget.money;
    click(6, 4);
    for (let dx = 0; dx < 12; dx++) expect(world.getZone(o.tx + dx, o.ty + 4)).toBe(ZONE_R);
    expect(world.getZone(o.tx + 6, o.ty + 6)).toBe(ZONE_NONE);
    expect(world.getZone(o.tx + 6, o.ty + 3)).toBe(ZONE_NONE);
    history.undo();
    for (let dx = 0; dx < 12; dx++) expect(world.getZone(o.tx + dx, o.ty + 4)).toBe(ZONE_NONE);
    expect(world.budget.money).toBe(before);
    expect(history.canUndo).toBe(false);
  });

  it('zones nothing when the money does not cover it all (when zoning has a price)', () => {
    const costs = BALANCE.costs as { zoneR: number };
    costs.zoneR = 20;                                  // zoning ships free; price it for this test
    try {
      world.budget.money = 60;
      click(6, 4);
      for (let dx = 0; dx < 12; dx++) expect(world.getZone(o.tx + dx, o.ty + 4)).toBe(ZONE_NONE);
      expect(world.budget.money).toBe(60);
      expect(rejected).toEqual(['funds']);
    } finally {
      costs.zoneR = 0;
    }
  });

  it('zoning is free: a fill with no money costs nothing, but a city in debt cannot zone', () => {
    expect(BALANCE.costs.zoneR).toBe(0);
    world.budget.money = 0;
    click(6, 4);
    for (let dx = 0; dx < 12; dx++) expect(world.getZone(o.tx + dx, o.ty + 4)).toBe(ZONE_R);
    expect(world.budget.money).toBe(0);
    expect(rejected).toEqual([]);
    world.budget.money = -500;
    click(6, 8);
    expect(world.getZone(o.tx + 6, o.ty + 8)).toBe(ZONE_NONE);
    expect(rejected).toEqual(['funds']);
  });

  it('a drag in fill mode pans; drag mode still paints tile by tile', () => {
    const camX = camera.x;
    canvas.fire('pointerdown', at(2, 2));
    canvas.fire('pointermove', at(6, 2));
    canvas.fire('pointerup', at(6, 2));
    expect(camera.x).not.toBe(camX);
    expect(history.canUndo).toBe(false);
    mode = 'drag';
    click(3, 9);
    expect(world.getZone(camera.screenToTile(at(3, 9).clientX, at(3, 9).clientY).tx, camera.screenToTile(at(3, 9).clientX, at(3, 9).clientY).ty)).toBe(ZONE_R);
  });
});
