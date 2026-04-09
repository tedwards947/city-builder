import type { SpriteDefinition, SpriteFrame } from './SpriteDefinition';
import type { ColorPalette } from '../CharacterPalette';
import { ASSET_MANAGER } from './AssetManager';

export class SpriteRenderer {
  private _animationStates: Map<string, number>; // tileKey -> frame index

  constructor() {
    this._animationStates = new Map();
  }

  drawSprite(
    ctx: CanvasRenderingContext2D,
    sprite: SpriteDefinition,
    x: number,
    y: number,
    ts: number,
    palette: ColorPalette,
    variant: number,
    tileKey: string,  // unique tile identifier for animation state
    now: number,      // current time in ms (for animation)
  ): void {
    // Try to draw from sprite sheet first
    if (sprite.animation) {
      const success = this._drawAnimated(ctx, sprite, x, y, ts, tileKey, now);
      if (success) return;
    }

    if (sprite.frame) {
      const success = this._drawStatic(ctx, sprite.frame, x, y, ts);
      if (success) return;
    }

    // Fall back to procedural drawing
    if (sprite.drawFallback) {
      sprite.drawFallback(ctx, x, y, ts, palette, variant);
      return;
    }

    // Last resort: draw a colored rectangle
    ctx.fillStyle = '#ff00ff'; // magenta for missing sprite
    ctx.fillRect(x, y, ts, ts);
  }

  private _drawStatic(
    ctx: CanvasRenderingContext2D,
    frame: SpriteFrame,
    x: number,
    y: number,
    ts: number,
  ): boolean {
    const sheet = ASSET_MANAGER.getSheet(frame.sheetId);
    if (!sheet) {
      // Sheet not loaded yet - will fall back to drawFallback in caller
      return false;
    }

    const anchorX = frame.anchorX ?? 0;
    const anchorY = frame.anchorY ?? 0;

    ctx.drawImage(
      sheet,
      frame.x, frame.y, frame.w, frame.h,  // source
      x + anchorX, y + anchorY, ts, ts,    // destination
    );

    return true;
  }

  private _drawAnimated(
    ctx: CanvasRenderingContext2D,
    sprite: SpriteDefinition,
    x: number,
    y: number,
    ts: number,
    tileKey: string,
    now: number,
  ): boolean {
    if (!sprite.animation) return false;

    const { frames, frameDuration, loop } = sprite.animation;
    const totalDuration = frames.length * frameDuration;

    // Calculate current frame index
    let elapsed = now % totalDuration;
    if (!loop && now >= totalDuration) {
      elapsed = totalDuration - frameDuration; // stick on last frame
    }

    const frameIndex = Math.floor(elapsed / frameDuration);
    const frame = frames[frameIndex];

    return this._drawStatic(ctx, frame, x, y, ts);
  }
}
