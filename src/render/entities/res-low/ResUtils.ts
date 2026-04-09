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
  const sway = Math.sin(t * 3) * 1.5;
  if (type === 'bush') {
    ctx.fillStyle = '#2e7d32';
    ctx.beginPath();
    ctx.arc(x + sway, y, ts * 0.15, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'tree') {
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(x - 1, y - ts * 0.2, 2, ts * 0.2);
    ctx.fillStyle = '#1b5e20';
    ctx.beginPath();
    ctx.arc(x + sway, y - ts * 0.2, ts * 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#e91e63';
    ctx.beginPath();
    ctx.arc(x + sway, y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffeb3b';
    ctx.fillRect(x + sway - 0.5, y - 0.5, 1, 1);
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
