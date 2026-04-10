import type { ColorPalette } from '../../CharacterPalette';
import type { VibeState } from '../../SpriteTypes';
import { t } from '../../../i18n';

export interface CommOptions {
  hasAwning?: boolean;
  awningColor?: string;
  hasSign?: boolean;
  signKey?: string; // Localization key like 'commercialBrands.bmart'
  signColor?: string;
  windowCount?: number;
  hasParking?: boolean;
  isGasStation?: boolean;
  accentColor?: string;
}

export function drawStorefront(
  ctx: CanvasRenderingContext2D,
  ts: number,
  _t: number,
  _p: ColorPalette,
  _vibe: VibeState,
  bodyColor: string,
  roofColor: string,
  opts: CommOptions = {}
): void {
  const s = ts * 0.1;
  const inset = Math.max(1, Math.floor(ts * 0.1));
  const bx = inset, by = inset + s * 2;
  const bw = ts - inset * 2, bh = ts - by - inset;

  if (opts.isGasStation) {
    drawGasStation(ctx, ts, bodyColor, roofColor, opts);
    return;
  }

  // Foundations / Parking
  if (opts.hasParking) {
    ctx.fillStyle = '#444';
    ctx.fillRect(0, ts * 0.8, ts, ts * 0.2);
    ctx.fillStyle = '#666';
    for (let x = 2; x < ts; x += 8) ctx.fillRect(x, ts * 0.85, 1, ts * 0.1);
  }

  // Building Body
  ctx.fillStyle = bodyColor;
  ctx.fillRect(bx, by, bw, bh);

  // Roof
  ctx.fillStyle = roofColor;
  ctx.fillRect(bx - 1, by - 2, bw + 2, 3);

  // Windows / Display
  if (ts > 8) {
    const winCount = opts.windowCount || 2;
    ctx.fillStyle = 'rgba(129, 212, 250, 0.6)';
    const winW = (bw - s * 2) / winCount - 2;
    for (let i = 0; i < winCount; i++) {
      ctx.fillRect(bx + s + i * (winW + 2), by + s, winW, bh * 0.5);
    }
  }

  // Awning
  if (opts.hasAwning) {
    ctx.fillStyle = opts.awningColor || '#e91e63';
    ctx.beginPath();
    ctx.moveTo(bx, by + s);
    ctx.lineTo(bx + bw, by + s);
    ctx.lineTo(bx + bw + 2, by + s * 2.5);
    ctx.lineTo(bx - 2, by + s * 2.5);
    ctx.fill();
  }

  // Signage
  if (opts.hasSign && opts.signKey) {
    ctx.fillStyle = opts.signColor || '#fff';
    ctx.fillRect(bx + bw * 0.05, by - s * 2.5, bw * 0.9, s * 2.2); // Taller and wider box
    if (ts > 12) {
      const text = t(opts.signKey);
      ctx.fillStyle = '#000';
      ctx.font = `bold ${Math.floor(s * 1.4)}px sans-serif`; // Larger font
      ctx.textAlign = 'center';
      ctx.fillText(text, bx + bw / 2, by - s * 0.9);
    }
  }

  // Door
  ctx.fillStyle = '#3d2b1f';
  ctx.fillRect(bx + bw * 0.4, by + bh * 0.6, bw * 0.2, bh * 0.4);
}

function drawGasStation(
  ctx: CanvasRenderingContext2D,
  ts: number,
  bodyColor: string,
  roofColor: string,
  opts: CommOptions
): void {
  const s = ts * 0.1;
  const accent = opts.accentColor || '#ffeb3b';

  // Concrete lot
  ctx.fillStyle = '#555';
  ctx.fillRect(0, ts * 0.2, ts, ts * 0.8);

  // Convenience Store (Back)
  ctx.fillStyle = bodyColor;
  ctx.fillRect(s * 1, s * 2, s * 5, s * 4);
  ctx.fillStyle = roofColor;
  ctx.fillRect(s * 0.5, s * 1.5, s * 6, s * 0.5);
  // Store window
  ctx.fillStyle = 'rgba(129, 212, 250, 0.6)';
  ctx.fillRect(s * 1.5, s * 3, s * 2, s * 1.5);

  // Large Canopy (Front)
  ctx.fillStyle = accent;
  ctx.fillRect(s * 1, s * 6, s * 8, s * 0.8);
  ctx.fillStyle = '#ddd';
  ctx.fillRect(s * 2, s * 6.8, s * 0.5, s * 3);
  ctx.fillRect(s * 7.5, s * 6.8, s * 0.5, s * 3);

  // Pumps
  ctx.fillStyle = '#333';
  ctx.fillRect(s * 3.5, ts * 0.8, s * 0.8, s * 1.5);
  ctx.fillRect(s * 5.5, ts * 0.8, s * 0.8, s * 1.5);

  // Price Sign on Pole
  ctx.fillStyle = '#333';
  ctx.fillRect(ts - s * 2, s * 1, s * 0.3, s * 8);
  ctx.fillStyle = accent;
  ctx.fillRect(ts - s * 3.5, s * 1, s * 3.5, s * 3); // Larger sign board
  
  if (ts > 15 && opts.signKey) {
    const text = t(opts.signKey);
    ctx.fillStyle = '#000';
    ctx.font = `bold ${Math.floor(s * 1.1)}px sans-serif`; // Larger font
    ctx.textAlign = 'center';
    ctx.fillText(text, ts - s * 1.75, s * 3.0);
  }
}
