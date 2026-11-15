// Unified pointer input (mouse + touch).
//
//   View / Inspect tool      drag → pan camera
//   Road / zone / bulldoze   primary drag → paint along the path (one undo step
//                            per stroke); right/middle drag or two fingers → pan
//   Building tools           tap → place one; drag → pan
//   Wheel / pinch            zoom
//
// Produces Commands via CommandHistory. Never mutates world directly.

import type { Camera } from '../render/Camera';
import type { World } from '../sim/World';
import type { Command, FailReason } from '../commands/Command';
import type { CommandHistory } from '../commands/CommandHistory';
import { BuildRoadCommand } from '../commands/BuildRoadCommand';
import { PaintZoneCommand } from '../commands/PaintZoneCommand';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { ZONE_R, ZONE_C, ZONE_I, ROAD_NONE, ROAD_STREET, ROAD_AVENUE, ROAD_HIGHWAY, BUILDING_POWER_PLANT, BUILDING_WATER_TOWER, BUILDING_SEWAGE_PLANT, BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL, BUILDING_PARK } from '../sim/constants';
import { tilesBetween, dominantAxis, axisLockedLine } from './dragPath';
import type { Axis, TilePos } from './dragPath';
import { wheelZoomFactor } from './wheelZoom';

export type Tool = 'none' | 'inspect' | 'road' | 'avenue' | 'highway' | 'zoneR' | 'zoneC' | 'zoneI' | 'power' | 'water' | 'sewage' | 'police' | 'fire' | 'school' | 'hospital' | 'park' | 'bulldoze';

const ROAD_TOOL_CLASS: Partial<Record<Tool, number>> = {
  road: ROAD_STREET, avenue: ROAD_AVENUE, highway: ROAD_HIGHWAY,
};
const ZONE_TOOL_ZONE: Partial<Record<Tool, number>> = {
  zoneR: ZONE_R, zoneC: ZONE_C, zoneI: ZONE_I,
};
const BUILDING_TOOL_KIND: Partial<Record<Tool, number>> = {
  power: BUILDING_POWER_PLANT, water: BUILDING_WATER_TOWER, sewage: BUILDING_SEWAGE_PLANT,
  police: BUILDING_POLICE, fire: BUILDING_FIRE, school: BUILDING_SCHOOL,
  hospital: BUILDING_HOSPITAL, park: BUILDING_PARK,
};

/** Tools that paint along a drag instead of panning. */
export function isPaintTool(tool: Tool): boolean {
  return tool in ROAD_TOOL_CLASS || tool in ZONE_TOOL_ZONE || tool === 'bulldoze';
}

/** Build the Command a tool issues for one tile, or null if the tool issues none. */
export function commandForTool(tool: Tool, tx: number, ty: number): Command | null {
  const roadClass = ROAD_TOOL_CLASS[tool];
  if (roadClass !== undefined) return new BuildRoadCommand(tx, ty, roadClass);
  const zone = ZONE_TOOL_ZONE[tool];
  if (zone !== undefined) return new PaintZoneCommand(tx, ty, zone);
  const kind = BUILDING_TOOL_KIND[tool];
  if (kind !== undefined) return new PlaceBuildingCommand(tx, ty, kind);
  if (tool === 'bulldoze') return new BulldozeCommand(tx, ty);
  return null;
}

// What the current single-pointer gesture is doing.
//   tap   — may become a tap (apply tool on release) or turn into a pan
//   pan   — panning only; never applies a tool
//   paint — drag-painting a stroke
type Gesture = 'tap' | 'pan' | 'paint';

interface Stroke {
  tool: Tool;
  history: CommandHistory;
  world: World;
  start: TilePos;
  last: TilePos;
  axis: Axis | null;        // roads only: locked once the pointer leaves the start tile
  visited: Set<number>;     // tile indices already handled in this stroke
}

export class InputController {
  private readonly canvas: HTMLCanvasElement;
  private readonly camera: Camera;
  private readonly getWorld: () => World;
  private readonly getHistory: () => CommandHistory;
  private readonly getTool: () => Tool;
  private readonly onHover: (tile: { tx: number; ty: number }) => void;
  private readonly onRejected: ((reason: FailReason) => void) | undefined;

  private readonly pointers = new Map<number, { sx: number; sy: number }>();
  private lastSingle: { sx: number; sy: number } | null = null;
  private lastPinchDist = 0;
  private lastPinchMid: { sx: number; sy: number } | null = null;
  private isDragging = false;
  private downPos: { sx: number; sy: number } | null = null;
  private readonly dragThreshold = 6;
  private gesture: Gesture = 'tap';
  private stroke: Stroke | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    camera: Camera,
    getWorld: () => World,
    getHistory: () => CommandHistory,
    getTool: () => Tool,
    onHover: (tile: { tx: number; ty: number }) => void,
    onRejected?: (reason: FailReason) => void,
  ) {
    this.canvas = canvas;
    this.camera = camera;
    this.getWorld = getWorld;
    this.getHistory = getHistory;
    this.getTool = getTool;
    this.onHover = onHover;
    this.onRejected = onRejected;
    canvas.addEventListener('pointerdown',   this._down.bind(this));
    canvas.addEventListener('pointermove',   this._move.bind(this));
    canvas.addEventListener('pointerup',     this._up.bind(this));
    canvas.addEventListener('pointercancel', this._cancel.bind(this));
    canvas.addEventListener('wheel',         this._wheel.bind(this), { passive: false });
    // Right-drag pans, so the browser context menu must not open.
    canvas.addEventListener('contextmenu',   (e) => e.preventDefault());
  }

  private _getLocal(e: PointerEvent): { sx: number; sy: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  }

  private _down(e: PointerEvent): void {
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    const p = this._getLocal(e);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 1) {
      this.lastSingle = p;
      this.downPos = p;
      this.isDragging = false;
      const tool = this.getTool();
      // Mouse: only the primary button uses the tool; middle/right always pan.
      // Touch and pen report button 0.
      const primary = e.button === 0;
      if (!primary) {
        this.gesture = 'pan';
      } else if (isPaintTool(tool)) {
        this.gesture = 'paint';
        this._beginStroke(tool, this.camera.screenToTile(p.sx, p.sy));
      } else {
        this.gesture = 'tap';
      }
    } else if (this.pointers.size === 2) {
      // A second finger turns the gesture into pan/zoom. If the first finger
      // had started a paint stroke, revert it — it was not meant as paint.
      this._abortStroke();
      this.gesture = 'pan';
      const pts = [...this.pointers.values()];
      this.lastPinchDist = Math.hypot(pts[0].sx - pts[1].sx, pts[0].sy - pts[1].sy);
      this.lastPinchMid = { sx: (pts[0].sx + pts[1].sx) / 2, sy: (pts[0].sy + pts[1].sy) / 2 };
    }
  }

  private _move(e: PointerEvent): void {
    const p = this._getLocal(e);
    if (!this.pointers.has(e.pointerId)) {
      this.onHover(this.camera.screenToTile(p.sx, p.sy));
      return;
    }
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 1 && this.lastSingle) {
      const tile = this.camera.screenToTile(p.sx, p.sy);
      if (this.gesture === 'paint') {
        this._extendStroke(tile);
      } else {
        const dx = p.sx - this.lastSingle.sx;
        const dy = p.sy - this.lastSingle.sy;
        if (!this.isDragging && this.downPos) {
          if (Math.hypot(p.sx - this.downPos.sx, p.sy - this.downPos.sy) > this.dragThreshold) {
            this.isDragging = true;
          }
        }
        if (this.isDragging) this.camera.panBy(dx, dy);
      }
      this.lastSingle = p;
      this.onHover(tile);
    } else if (this.pointers.size === 2) {
      const pts = [...this.pointers.values()];
      const dist = Math.hypot(pts[0].sx - pts[1].sx, pts[0].sy - pts[1].sy);
      const midX = (pts[0].sx + pts[1].sx) / 2;
      const midY = (pts[0].sy + pts[1].sy) / 2;
      // Two-finger drag pans (so panning works while a paint tool is active)…
      if (this.lastPinchMid) {
        this.camera.panBy(midX - this.lastPinchMid.sx, midY - this.lastPinchMid.sy);
      }
      // …and pinch zooms about the midpoint.
      if (this.lastPinchDist > 0) {
        this.camera.zoomAt(midX, midY, dist / this.lastPinchDist);
      }
      this.lastPinchDist = dist;
      this.lastPinchMid = { sx: midX, sy: midY };
    }
  }

  private _up(e: PointerEvent): void {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0 && p) {
      if (this.gesture === 'paint') {
        this._extendStroke(this.camera.screenToTile(p.sx, p.sy));
        this._endStroke();
      } else if (this.gesture === 'tap' && !this.isDragging) {
        const tile = this.camera.screenToTile(p.sx, p.sy);
        if (this.getWorld().grid.inBounds(tile.tx, tile.ty)) {
          this._applyTool(tile.tx, tile.ty);
        }
      }
    }
    this._afterRelease();
  }

  private _cancel(e: PointerEvent): void {
    // Browser took the gesture away (e.g. system swipe): keep what was painted
    // as a normal undo step, but never apply a tap.
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) this._endStroke();
    this._afterRelease();
  }

  private _afterRelease(): void {
    if (this.pointers.size < 2) {
      this.lastPinchDist = 0;
      this.lastPinchMid = null;
    }
    if (this.pointers.size === 0) {
      this.lastSingle = null;
      this.isDragging = false;
      this.downPos = null;
      this.gesture = 'tap';
    } else if (this.pointers.size === 1) {
      // One finger left after a two-finger gesture: keep panning with it,
      // and make sure lifting it does not count as a tap.
      this.lastSingle = [...this.pointers.values()][0];
      this.gesture = 'pan';
      this.isDragging = true;
    }
  }

  private _wheel(e: WheelEvent): void {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    this.camera.zoomAt(sx, sy, wheelZoomFactor(e.deltaY, e.deltaMode, e.ctrlKey));
  }

  // ── Drag-paint strokes ──────────────────────────────────────────────────────

  private _beginStroke(tool: Tool, tile: TilePos): void {
    const history = this.getHistory();
    history.beginBatch();
    this.stroke = {
      tool, history,
      world: this.getWorld(),
      start: tile, last: tile,
      axis: null,
      visited: new Set(),
    };
    this._paintTiles([tile]);
  }

  private _extendStroke(tile: TilePos): void {
    const s = this.stroke;
    if (!s) return;
    if (tile.tx === s.last.tx && tile.ty === s.last.ty) return;
    if (s.tool in ROAD_TOOL_CLASS) {
      // Roads: a straight line from the drag start, locked to the axis the
      // pointer first moved along.
      if (s.axis === null) s.axis = dominantAxis(s.start, tile);
      if (s.axis !== null) this._paintTiles(axisLockedLine(s.start, tile, s.axis));
    } else {
      // Zones / bulldoze: every tile the pointer crossed since the last sample.
      this._paintTiles(tilesBetween(s.last, tile));
    }
    s.last = tile;
  }

  private _paintTiles(tiles: TilePos[]): void {
    const s = this.stroke;
    if (!s) return;
    const { world, history, tool, visited } = s;
    // A new game / load mid-stroke swaps the world; stop painting into the old one.
    if (world !== this.getWorld()) return;
    const zone = ZONE_TOOL_ZONE[tool];
    for (const { tx, ty } of tiles) {
      if (!world.grid.inBounds(tx, ty)) continue;
      const i = world.grid.idx(tx, ty);
      if (visited.has(i)) continue;
      visited.add(i);
      if (zone !== undefined) {
        // Sweeping a zone brush should fill around roads, not delete them,
        // and should not pay again for tiles that are already this zone.
        if (world.layers.roadClass[i] !== ROAD_NONE) continue;
        if (world.layers.zone[i] === zone) continue;
      }
      const cmd = commandForTool(tool, tx, ty);
      if (cmd) this._run(history, cmd);
    }
  }

  private _endStroke(): void {
    const s = this.stroke;
    if (!s) return;
    this.stroke = null;
    s.history.endBatch();
  }

  private _abortStroke(): void {
    const s = this.stroke;
    if (!s) return;
    this.stroke = null;
    s.history.cancelBatch();
  }

  private _applyTool(tx: number, ty: number): void {
    const cmd = commandForTool(this.getTool(), tx, ty);
    if (cmd) this._run(this.getHistory(), cmd);
  }

  /** Runs a command; if it was refused for funds / political capital, tells the UI. */
  private _run(history: CommandHistory, cmd: Command): void {
    if (!history.run(cmd) && cmd.failReason) this.onRejected?.(cmd.failReason);
  }
}
