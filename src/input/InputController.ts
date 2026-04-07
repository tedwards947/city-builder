// Unified pointer input (mouse + touch). Drag → pan camera. Tap → apply tool.
// Produces Commands via CommandHistory. Never mutates world directly.

import type { Camera } from '../render/Camera';
import type { World } from '../sim/World';
import type { CommandHistory } from '../commands/CommandHistory';
import { BuildRoadCommand } from '../commands/BuildRoadCommand';
import { PaintZoneCommand } from '../commands/PaintZoneCommand';
import { PlacePowerPlantCommand } from '../commands/PlacePowerPlantCommand';
import { PlaceWaterTowerCommand } from '../commands/PlaceWaterTowerCommand';
import { PlaceSewagePlantCommand } from '../commands/PlaceSewagePlantCommand';
import { PlaceServiceBuildingCommand } from '../commands/PlaceServiceBuildingCommand';
import { BulldozeCommand } from '../commands/BulldozeCommand';
import { ZONE_R, ZONE_C, ZONE_I, BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL, BUILDING_PARK } from '../sim/constants';

export type Tool = 'none' | 'inspect' | 'road' | 'zoneR' | 'zoneC' | 'zoneI' | 'power' | 'water' | 'sewage' | 'police' | 'fire' | 'school' | 'hospital' | 'park' | 'bulldoze';

export class InputController {
  private readonly canvas: HTMLCanvasElement;
  private readonly camera: Camera;
  private readonly getWorld: () => World;
  private readonly getHistory: () => CommandHistory;
  private readonly getTool: () => Tool;
  private readonly onHover: (tile: { tx: number; ty: number }) => void;

  private readonly pointers = new Map<number, { sx: number; sy: number }>();
  private lastSingle: { sx: number; sy: number } | null = null;
  private lastPinchDist = 0;
  private isDragging = false;
  private downPos: { sx: number; sy: number } | null = null;
  private readonly dragThreshold = 6;

  constructor(
    canvas: HTMLCanvasElement,
    camera: Camera,
    getWorld: () => World,
    getHistory: () => CommandHistory,
    getTool: () => Tool,
    onHover: (tile: { tx: number; ty: number }) => void,
  ) {
    this.canvas = canvas;
    this.camera = camera;
    this.getWorld = getWorld;
    this.getHistory = getHistory;
    this.getTool = getTool;
    this.onHover = onHover;
    canvas.addEventListener('pointerdown',   this._down.bind(this));
    canvas.addEventListener('pointermove',   this._move.bind(this));
    canvas.addEventListener('pointerup',     this._up.bind(this));
    canvas.addEventListener('pointercancel', this._up.bind(this));
    canvas.addEventListener('wheel',         this._wheel.bind(this), { passive: false });
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
    } else if (this.pointers.size === 2) {
      const pts = [...this.pointers.values()];
      this.lastPinchDist = Math.hypot(pts[0].sx - pts[1].sx, pts[0].sy - pts[1].sy);
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
      const dx = p.sx - this.lastSingle.sx;
      const dy = p.sy - this.lastSingle.sy;
      if (!this.isDragging && this.downPos) {
        if (Math.hypot(p.sx - this.downPos.sx, p.sy - this.downPos.sy) > this.dragThreshold) {
          this.isDragging = true;
        }
      }
      if (this.isDragging) this.camera.panBy(dx, dy);
      this.lastSingle = p;
      this.onHover(this.camera.screenToTile(p.sx, p.sy));
    } else if (this.pointers.size === 2) {
      const pts = [...this.pointers.values()];
      const dist = Math.hypot(pts[0].sx - pts[1].sx, pts[0].sy - pts[1].sy);
      if (this.lastPinchDist > 0) {
        const factor = dist / this.lastPinchDist;
        const midX = (pts[0].sx + pts[1].sx) / 2;
        const midY = (pts[0].sy + pts[1].sy) / 2;
        this.camera.zoomAt(midX, midY, factor);
      }
      this.lastPinchDist = dist;
    }
  }

  private _up(e: PointerEvent): void {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0 && p && !this.isDragging) {
      const tile = this.camera.screenToTile(p.sx, p.sy);
      if (this.getWorld().grid.inBounds(tile.tx, tile.ty)) {
        this._applyTool(tile.tx, tile.ty);
      }
    }
    if (this.pointers.size < 2) this.lastPinchDist = 0;
    if (this.pointers.size === 0) {
      this.lastSingle = null;
      this.isDragging = false;
      this.downPos = null;
    } else if (this.pointers.size === 1) {
      this.lastSingle = [...this.pointers.values()][0];
    }
  }

  private _wheel(e: WheelEvent): void {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    this.camera.zoomAt(sx, sy, factor);
  }

  private _applyTool(tx: number, ty: number): void {
    const tool = this.getTool();
    const history = this.getHistory();
    if (tool === 'road')          history.run(new BuildRoadCommand(tx, ty));
    else if (tool === 'zoneR')    history.run(new PaintZoneCommand(tx, ty, ZONE_R));
    else if (tool === 'zoneC')    history.run(new PaintZoneCommand(tx, ty, ZONE_C));
    else if (tool === 'zoneI')    history.run(new PaintZoneCommand(tx, ty, ZONE_I));
    else if (tool === 'power')    history.run(new PlacePowerPlantCommand(tx, ty));
    else if (tool === 'water')    history.run(new PlaceWaterTowerCommand(tx, ty));
    else if (tool === 'sewage')   history.run(new PlaceSewagePlantCommand(tx, ty));
    else if (tool === 'police')   history.run(new PlaceServiceBuildingCommand(tx, ty, BUILDING_POLICE));
    else if (tool === 'fire')     history.run(new PlaceServiceBuildingCommand(tx, ty, BUILDING_FIRE));
    else if (tool === 'school')   history.run(new PlaceServiceBuildingCommand(tx, ty, BUILDING_SCHOOL));
    else if (tool === 'hospital') history.run(new PlaceServiceBuildingCommand(tx, ty, BUILDING_HOSPITAL));
    else if (tool === 'park')     history.run(new PlaceServiceBuildingCommand(tx, ty, BUILDING_PARK));
    else if (tool === 'bulldoze') history.run(new BulldozeCommand(tx, ty));
  }
}
