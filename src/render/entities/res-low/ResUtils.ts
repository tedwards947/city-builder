import type { ColorPalette } from '../../CharacterPalette';
import type { VibeState } from '../../SpriteTypes';

export interface HouseOptions {
  doorSide?: 'left'|'right'|'center';
  hasPorch?: boolean;
  hasDormer?: boolean;
  hasChimney?: boolean;
  chimneySide?: 'left'|'right';
  windowColor?: string;
  hasVegetation?: boolean;
  vegType?: 'bush'|'tree'|'flowers';
  roofStyle?: 'pitched'|'flat'|'pagoda'|'gambrel'|'mansard';
  accentColor?: string;
}

export function drawSmoke(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const smokeCount = 3;
  ctx.fillStyle = 'rgba(150, 150, 150, 0.4)';
  for (let i = 0; i < smokeCount; i++) {
    const pt = (t * 0.5 + i / smokeCount) % 1.0;
    const alpha = 1.0 - pt;
    const drift = Math.sin(t * 2 + i) * 3;
    ctx.beginPath();
    ctx.globalAlpha = alpha;
    ctx.arc(x + drift, y - pt * 15, 2 + pt * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;
}

export function drawVeg(ctx: CanvasRenderingContext2D, x: number, y: number, ts: number, t: number, type: 'bush'|'tree'|'flowers'): void {
  const treeSway = Math.sin(t * 1.5) * 0.5; // Toned down tree sway
  if (type === 'bush') {
    ctx.fillStyle = '#2e7d32';
    ctx.beginPath();
    ctx.arc(x, y, ts * 0.15, 0, Math.PI * 2); // No animation for bushes
    ctx.fill();
  } else if (type === 'tree') {
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(x - 1, y - ts * 0.2, 2, ts * 0.2);
    ctx.fillStyle = '#1b5e20';
    ctx.beginPath();
    ctx.arc(x + treeSway, y - ts * 0.2, ts * 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#e91e63';
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2); // No animation for flowers
    ctx.fill();
    ctx.fillStyle = '#ffeb3b';
    ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
  }
}

export function drawBaseHouse(
  ctx: CanvasRenderingContext2D,
  ts: number,
  t: number,
  _p: ColorPalette,
  _vibe: VibeState,
  bodyColor: string,
  roofColor: string,
  opts: HouseOptions = {}
): void {
  const s = ts * 0.1;
  const inset = Math.max(1, Math.floor(ts * 0.15));
  const bx = inset, by = inset + (ts * 0.25);
  const bw = ts - inset * 2, bh = ts - by - inset;

  // Vegetation Background
  if (opts.hasVegetation && opts.vegType === 'tree') {
    drawVeg(ctx, bx + bw * 0.8, by + bh, ts, t, 'tree');
  }

  // Chimney
  if (opts.hasChimney) {
    const cx = opts.chimneySide === 'left' ? bx + bw * 0.15 : bx + bw * 0.75;
    ctx.fillStyle = bodyColor;
    ctx.fillRect(cx, inset, s * 1.5, by - inset);
    drawSmoke(ctx, cx + s * 0.75, inset, t);
  }

  // Body
  ctx.fillStyle = bodyColor;
  ctx.fillRect(bx, by, bw, bh);

  // Roof
  ctx.fillStyle = roofColor;
  if (opts.roofStyle === 'pagoda') {
    ctx.beginPath();
    ctx.moveTo(bx - 3, by);
    ctx.quadraticCurveTo(bx + bw / 2, inset - 5, bx + bw + 3, by);
    ctx.lineTo(bx + bw + 1, by - 2);
    ctx.quadraticCurveTo(bx + bw / 2, inset, bx - 1, by - 2);
    ctx.fill();
  } else if (opts.roofStyle === 'flat') {
    ctx.fillRect(bx - 1, by - 2, bw + 2, 3);
  } else if (opts.roofStyle === 'a-frame') {
    ctx.beginPath();
    ctx.moveTo(bx, ts - inset);
    ctx.lineTo(ts / 2, inset);
    ctx.lineTo(bx + bw, ts - inset);
    ctx.fill();
  } else if (opts.roofStyle === 'slanted') {
    ctx.beginPath();
    ctx.moveTo(bx - 1, by);
    ctx.lineTo(bx + bw + 1, by - s * 2);
    ctx.lineTo(bx + bw + 1, by);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(bx - 2, by);
    ctx.lineTo(bx + bw / 2, inset);
    ctx.lineTo(bx + bw + 2, by);
    ctx.fill();
  }

  // Windows & Door
  if (ts > 8) {
    const winColor = opts.windowColor || '#add8e6';
    ctx.fillStyle = winColor;
    ctx.fillRect(bx + s * 1.5, by + s * 1.5, s * 2, s * 2);
    ctx.fillRect(bx + bw - s * 3.5, by + s * 1.5, s * 2, s * 2);
    
    ctx.fillStyle = '#3d2b1f';
    const dx = opts.doorSide === 'left' ? bx + s : opts.doorSide === 'right' ? bx + bw - s * 2.5 : bx + (bw - s * 2) / 2;
    ctx.fillRect(dx, by + bh - s * 4, s * 2, s * 4);
  }

  // Vegetation Foreground
  if (opts.hasVegetation && opts.vegType !== 'tree') {
    drawVeg(ctx, bx + s, by + bh - 1, ts, t, opts.vegType || 'bush');
    drawVeg(ctx, bx + bw - s, by + bh - 1, ts, t, 'flowers');
  }
}

export function drawL2House(
  ctx: CanvasRenderingContext2D,
  ts: number,
  t: number,
  _p: ColorPalette,
  _vibe: VibeState,
  bodyColor: string,
  roofColor: string,
  opts: HouseOptions = {}
): void {
  const s = ts * 0.1;
  const stories = (opts as any).stories || 2;
  const isWider = (opts as any).isWider || false;
  const inset = Math.max(1, Math.floor(ts * 0.1));
  const bw = isWider ? ts - inset : ts - inset * 2;
  const bx = (ts - bw) / 2;
  const storyH = (ts - inset * 2) / (stories + 0.5);
  const totalBh = storyH * stories;
  const by = ts - inset - totalBh;

  // Vegetation Background
  if (opts.hasVegetation && opts.vegType === 'tree') {
    drawVeg(ctx, bx + bw * 0.9, ts - inset, ts, t, 'tree');
  }

  // Chimney
  if (opts.hasChimney) {
    const cx = opts.chimneySide === 'left' ? bx + s : bx + bw - s * 2;
    ctx.fillStyle = bodyColor;
    ctx.fillRect(cx, inset, s * 1.5, by - inset + s);
    drawSmoke(ctx, cx + s * 0.75, inset, t);
  }

  // Body (Stories)
  ctx.fillStyle = bodyColor;
  for (let i = 0; i < stories; i++) {
    const sy = by + i * storyH;
    ctx.fillRect(bx, sy, bw, storyH + 1);
    
    // Windows per story
    if (ts > 8) {
      ctx.fillStyle = opts.windowColor || '#add8e6';
      const winSize = storyH * 0.4;
      ctx.fillRect(bx + s * 1.5, sy + storyH * 0.2, winSize, winSize);
      ctx.fillRect(bx + bw - s * 1.5 - winSize, sy + storyH * 0.2, winSize, winSize);
      
      // Balcony detail for upper stories
      if (i < stories - 1 && i > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(bx - 2, sy + storyH - 2, bw + 4, 2);
      }
    }
  }

  // Main Door (Bottom story)
  if (ts > 8) {
    ctx.fillStyle = '#3d2b1f';
    const dx = opts.doorSide === 'left' ? bx + s : opts.doorSide === 'right' ? bx + bw - s * 3 : bx + (bw - s * 2) / 2;
    ctx.fillRect(dx, ts - inset - storyH * 0.6, s * 2, storyH * 0.6);
  }

  // Roof
  ctx.fillStyle = roofColor;
  if (opts.roofStyle === 'flat') {
    ctx.fillRect(bx - 2, by - 2, bw + 4, 4);
  } else if (opts.roofStyle === 'mansard') {
    ctx.beginPath();
    ctx.moveTo(bx - 2, by);
    ctx.lineTo(bx + s, by - s * 2);
    ctx.lineTo(bx + bw - s, by - s * 2);
    ctx.lineTo(bx + bw + 2, by);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(bx - 4, by);
    ctx.lineTo(bx + bw / 2, by - storyH * 0.6);
    ctx.lineTo(bx + bw + 4, by);
    ctx.fill();
  }

  // Vegetation Foreground
  if (opts.hasVegetation && opts.vegType !== 'tree') {
    drawVeg(ctx, bx - s * 0.5, ts - inset, ts, t, opts.vegType || 'bush');
    drawVeg(ctx, bx + bw + s * 0.5, ts - inset, ts, t, 'flowers');
  }
}

export function drawL3House(
  ctx: CanvasRenderingContext2D,
  ts: number,
  t: number,
  _p: ColorPalette,
  _vibe: VibeState,
  bodyColor: string,
  roofColor: string,
  opts: HouseOptions = {}
): void {
  const s = ts * 0.1;
  const stories = (opts as any).stories || 4;
  const isWider = (opts as any).isWider || true;
  const inset = Math.max(1, Math.floor(ts * 0.05));
  const bw = isWider ? ts - inset * 2 : ts - inset * 4;
  const bx = (ts - bw) / 2;
  const storyH = (ts - inset * 2) / (stories + 1);
  const totalBh = storyH * stories;
  const by = ts - inset - totalBh;

  // Foundations/Grand Entrance
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(bx - 2, ts - inset - 2, bw + 4, 4);

  // Vegetation Background
  if (opts.hasVegetation && opts.vegType === 'tree') {
    drawVeg(ctx, bx + bw * 0.1, ts - inset, ts, t, 'tree');
    drawVeg(ctx, bx + bw * 0.9, ts - inset, ts, t, 'tree');
  }

  // Double Chimneys for grander look
  if (opts.hasChimney) {
    ctx.fillStyle = bodyColor;
    ctx.fillRect(bx + s, inset, s * 1.2, by - inset + s);
    ctx.fillRect(bx + bw - s * 2.2, inset, s * 1.2, by - inset + s);
    drawSmoke(ctx, bx + s + s * 0.6, inset, t);
    drawSmoke(ctx, bx + bw - s * 2.2 + s * 0.6, inset, t + 0.5);
  }

  // Body (Stories)
  for (let i = 0; i < stories; i++) {
    const sy = by + i * storyH;
    ctx.fillStyle = bodyColor;
    ctx.fillRect(bx, sy, bw, storyH + 1);
    
    // Grid of windows (High density)
    if (ts > 8) {
      ctx.fillStyle = opts.windowColor || '#add8e6';
      const winW = bw * 0.2;
      const winH = storyH * 0.5;
      const spacing = bw * 0.25;
      for (let x = 0; x < 3; x++) {
        ctx.fillRect(bx + s + x * spacing, sy + storyH * 0.2, winW, winH);
      }
      
      // Balconies on every 2nd story
      if (i > 0 && i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(bx - 3, sy + storyH - 3, bw + 6, 3);
      }
    }
  }

  // Grand Entrance (Bottom story)
  if (ts > 8) {
    ctx.fillStyle = '#2c3e50';
    const dx = bx + (bw - s * 4) / 2;
    ctx.fillRect(dx, ts - inset - storyH * 0.8, s * 4, storyH * 0.8);
    ctx.fillStyle = '#ffeb3b'; // Golden door handle/light
    ctx.fillRect(dx + s * 3, ts - inset - storyH * 0.4, 1, 1);
  }

  // Elaborate Roof
  ctx.fillStyle = roofColor;
  if (opts.roofStyle === 'flat') {
    ctx.fillRect(bx - 4, by - 3, bw + 8, 5);
    // Helipad or roof garden detail
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(bx + bw * 0.2, by - 3, bw * 0.6, 1);
  } else if (opts.roofStyle === 'mansard') {
    ctx.beginPath();
    ctx.moveTo(bx - 4, by);
    ctx.lineTo(bx + s * 2, by - s * 3);
    ctx.lineTo(bx + bw - s * 2, by - s * 3);
    ctx.lineTo(bx + bw + 4, by);
    ctx.fill();
  } else {
    // Grand pitched roof with trim
    ctx.beginPath();
    ctx.moveTo(bx - 6, by);
    ctx.lineTo(bx + bw / 2, by - storyH);
    ctx.lineTo(bx + bw + 6, by);
    ctx.fill();
  }

  // Lush Vegetation Foreground
  if (opts.hasVegetation && opts.vegType !== 'tree') {
    for (let x = 0; x < 3; x++) {
      drawVeg(ctx, bx + (x * bw * 0.4), ts - inset, ts, t, opts.vegType || 'bush');
    }
  }
}
