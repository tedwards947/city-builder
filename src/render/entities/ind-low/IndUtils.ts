import type { ColorPalette } from '../../CharacterPalette';
import type { VibeState } from '../../SpriteTypes';

export interface IndOptions {
  hasSmokestack?: boolean;
  smokestackCount?: number;
  hasLoadingDock?: boolean;
  hasTanks?: boolean;
  tankCount?: number;
  hasParking?: boolean;
  hasChimney?: boolean;
  windowCount?: number;
  roofStyle?: 'flat' | 'peaked' | 'sawtooth';
  accentColor?: string;
  buildingStyle?: 'warehouse' | 'factory' | 'plant' | 'storage';
}

export function drawSmoke(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const smokeCount = 4;
  for (let i = 0; i < smokeCount; i++) {
    const pt = (t * 0.3 + i / smokeCount) % 1.0;
    const alpha = 0.5 - pt * 0.5;
    const drift = Math.sin(t * 1.5 + i) * 4;
    ctx.beginPath();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(100, 100, 100, 1.0)';
    ctx.arc(x + drift, y - pt * 20, Math.max(0.1, 2 + pt * 5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;
}

/**
 * Draws a flickering flame for industrial flare stacks.
 */
export function drawRefineryFlame(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const pulse = Math.sin(t * 10) * 2;
  const flicker = Math.sin(t * 20) * 0.2 + 0.8;
  
  // Outer Glow
  const grad = ctx.createRadialGradient(x, y, 1, x, y, 8 + pulse);
  grad.addColorStop(0, 'rgba(255, 150, 0, 0.6)');
  grad.addColorStop(1, 'rgba(255, 50, 0, 0)');
  
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, 8 + pulse, 0, Math.PI * 2);
  ctx.fill();

  // Core Flame
  ctx.fillStyle = '#ffcc00';
  ctx.beginPath();
  ctx.moveTo(x - 2, y);
  ctx.quadraticCurveTo(x, y - 10 - pulse, x + 2, y);
  ctx.fill();
}

export function drawIndustrialBuilding(
  ctx: CanvasRenderingContext2D,
  ts: number,
  t: number,
  _p: ColorPalette,
  _vibe: VibeState,
  bodyColor: string,
  roofColor: string,
  opts: IndOptions = {}
): void {
  const s = ts * 0.1;
  const inset = Math.max(1, Math.floor(ts * 0.08));

  if (opts.buildingStyle === 'warehouse') {
    drawWarehouse(ctx, ts, t, bodyColor, roofColor, opts);
  } else if (opts.buildingStyle === 'plant') {
    drawPlant(ctx, ts, t, bodyColor, roofColor, opts);
  } else if (opts.buildingStyle === 'storage') {
    drawStorage(ctx, ts, t, bodyColor, roofColor, opts);
  } else {
    drawFactory(ctx, ts, t, bodyColor, roofColor, opts);
  }
}

function drawFactory(
  ctx: CanvasRenderingContext2D,
  ts: number,
  t: number,
  bodyColor: string,
  roofColor: string,
  opts: IndOptions
): void {
  const s = ts * 0.1;
  const inset = Math.max(1, Math.floor(ts * 0.08));
  const bx = inset, by = inset + s * 2;
  const bw = ts - inset * 2, bh = ts - by - inset;

  // Parking lot / concrete pad
  if (opts.hasParking) {
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, ts * 0.75, ts, ts * 0.25);
    ctx.fillStyle = '#555';
    for (let x = 2; x < ts; x += 10) ctx.fillRect(x, ts * 0.8, 1, ts * 0.15);
  }

  // Main building body
  ctx.fillStyle = bodyColor;
  ctx.fillRect(bx, by, bw, bh);

  // Roof
  ctx.fillStyle = roofColor;
  if (opts.roofStyle === 'sawtooth') {
    for (let i = 0; i < 3; i++) {
      const rx = bx + (i * bw / 3);
      ctx.beginPath();
      ctx.moveTo(rx, by);
      ctx.lineTo(rx + bw / 6, by - s);
      ctx.lineTo(rx + bw / 3, by);
      ctx.fill();
    }
  } else if (opts.roofStyle === 'peaked') {
    ctx.beginPath();
    ctx.moveTo(bx - 1, by);
    ctx.lineTo(bx + bw / 2, by - s * 1.5);
    ctx.lineTo(bx + bw + 1, by);
    ctx.fill();
  } else {
    ctx.fillRect(bx - 1, by - 2, bw + 2, 3);
  }

  // Smokestacks
  if (opts.hasSmokestack) {
    const stackCount = opts.smokestackCount || 2;
    ctx.fillStyle = '#2a2a2a';
    for (let i = 0; i < stackCount; i++) {
      const sx = bx + bw * (0.2 + i * 0.4);
      ctx.fillRect(sx, inset, s * 1.2, by - inset + s);
      drawSmoke(ctx, sx + s * 0.6, inset, t + i * 0.3);
    }
  }

  // Large industrial windows / vents
  if (ts > 8 && opts.windowCount) {
    ctx.fillStyle = 'rgba(50, 50, 50, 0.8)';
    const winW = bw / (opts.windowCount + 1);
    for (let i = 0; i < opts.windowCount; i++) {
      ctx.fillRect(bx + s + i * winW, by + s * 2, winW * 0.7, bh * 0.4);
    }
  }

  // Loading dock
  if (opts.hasLoadingDock) {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(bx + bw * 0.6, by + bh * 0.5, bw * 0.35, bh * 0.5);
    ctx.fillStyle = opts.accentColor || '#ffa500';
    ctx.fillRect(bx + bw * 0.62, by + bh * 0.52, bw * 0.3, 2);
  }
}

function drawWarehouse(
  ctx: CanvasRenderingContext2D,
  ts: number,
  t: number,
  bodyColor: string,
  roofColor: string,
  opts: IndOptions
): void {
  const s = ts * 0.1;
  const inset = Math.max(1, Math.floor(ts * 0.05));
  const bx = inset, by = inset + s * 1.5;
  const bw = ts - inset * 2, bh = ts - by - inset;

  // Large flat building
  ctx.fillStyle = bodyColor;
  ctx.fillRect(bx, by, bw, bh);

  // Flat roof with AC units
  ctx.fillStyle = roofColor;
  ctx.fillRect(bx - 1, by - 2, bw + 2, 3);

  // Multiple loading bays
  ctx.fillStyle = '#1a1a1a';
  const bayCount = 3;
  const bayW = bw / bayCount - 2;
  for (let i = 0; i < bayCount; i++) {
    const bxPos = bx + i * (bw / bayCount) + 1;
    ctx.fillRect(bxPos, by + bh * 0.4, bayW, bh * 0.6);

    // Yellow safety stripe
    ctx.fillStyle = opts.accentColor || '#ffd700';
    ctx.fillRect(bxPos, by + bh * 0.4, bayW, 2);
    ctx.fillStyle = '#1a1a1a';
  }

  // Small office section
  ctx.fillStyle = '#505050';
  ctx.fillRect(bx, by, bw * 0.2, bh * 0.3);

  // Office windows
  if (ts > 10) {
    ctx.fillStyle = 'rgba(200, 200, 150, 0.6)';
    ctx.fillRect(bx + s * 0.3, by + s * 0.5, s * 1, s * 1);
  }

  // Parking lot
  if (opts.hasParking) {
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, ts * 0.8, ts * 0.3, ts * 0.2);
  }
}

function drawPlant(
  ctx: CanvasRenderingContext2D,
  ts: number,
  t: number,
  bodyColor: string,
  roofColor: string,
  opts: IndOptions
): void {
  const s = ts * 0.1;
  const inset = Math.max(1, Math.floor(ts * 0.08));

  // Multiple connected structures
  const sections = 2;
  for (let i = 0; i < sections; i++) {
    const bx = inset + i * (ts - inset * 2) / sections;
    const by = inset + s * (2 + i * 0.5);
    const bw = (ts - inset * 2) / sections - 2;
    const bh = ts - by - inset;

    ctx.fillStyle = bodyColor;
    ctx.fillRect(bx, by, bw, bh);

    ctx.fillStyle = roofColor;
    ctx.fillRect(bx - 1, by - 2, bw + 2, 3);
  }

  // Storage tanks
  if (opts.hasTanks) {
    const tankCount = opts.tankCount || 2;
    ctx.fillStyle = '#606060';
    for (let i = 0; i < tankCount; i++) {
      const tx = ts * 0.7 + i * s * 1.5;
      const ty = ts * 0.5;
      ctx.beginPath();
      ctx.arc(tx, ty, s * 1.2, 0, Math.PI * 2);
      ctx.fill();

      // Tank details
      ctx.strokeStyle = '#404040';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(tx, ty, s * 0.9, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Tall chimney
  if (opts.hasChimney) {
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(ts * 0.3, inset, s * 1.5, ts * 0.4);
    drawSmoke(ctx, ts * 0.3 + s * 0.75, inset, t);
  }

  // Pipes and infrastructure
  ctx.strokeStyle = '#505050';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ts * 0.2, ts * 0.5);
  ctx.lineTo(ts * 0.6, ts * 0.5);
  ctx.stroke();
}

function drawStorage(
  ctx: CanvasRenderingContext2D,
  ts: number,
  t: number,
  bodyColor: string,
  roofColor: string,
  opts: IndOptions
): void {
  const s = ts * 0.1;
  const inset = Math.max(1, Math.floor(ts * 0.1));

  // Large cylindrical or rectangular storage units
  const tankCount = opts.tankCount || 3;
  const tankW = (ts - inset * 2) / tankCount - 2;

  for (let i = 0; i < tankCount; i++) {
    const tx = inset + i * (tankW + 2);
    const ty = inset + s * 2;
    const th = ts - ty - inset;

    // Tank body
    ctx.fillStyle = bodyColor;
    ctx.fillRect(tx, ty, tankW, th);

    // Tank top
    ctx.fillStyle = roofColor;
    ctx.beginPath();
    ctx.ellipse(tx + tankW / 2, ty, Math.max(0.1, tankW / 2), Math.max(0.1, s * 0.8), 0, 0, Math.PI * 2);
    ctx.fill();

    // Tank details
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 1;
    for (let j = 1; j < 3; j++) {
      ctx.beginPath();
      ctx.moveTo(tx, ty + th * j / 3);
      ctx.lineTo(tx + tankW, ty + th * j / 3);
      ctx.stroke();
    }

    // Ladder
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tx + tankW * 0.1, ty);
    ctx.lineTo(tx + tankW * 0.1, ty + th);
    ctx.stroke();
  }

  // Access platform
  ctx.fillStyle = '#404040';
  ctx.fillRect(inset, ts * 0.85, ts - inset * 2, 2);
}
