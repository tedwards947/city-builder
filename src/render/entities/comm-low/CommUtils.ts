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
  fontStyle?: 'serif'|'sans'|'mono'|'display';
}

function getFontWithStyle(size: number, style?: string): string {
  switch (style) {
    case 'serif': return `bold ${size}px serif`;
    case 'mono': return `bold ${size}px monospace`;
    case 'display': return `900 ${size}px "Arial Black", sans-serif`;
    default: return `bold ${size}px sans-serif`;
  }
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
  const bx = inset, by = inset + s * 2.5;
  const bw = ts - inset * 2, bh = ts - by - inset;

  if (opts.isGasStation) {
    drawGasStation(ctx, ts, bodyColor, roofColor, opts);
    return;
  }

  // 1. Foundations / Parking
  if (opts.hasParking) {
    ctx.fillStyle = '#333';
    ctx.fillRect(0, ts * 0.8, ts, ts * 0.2);
    // Parking lines
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    for (let x = 4; x < ts; x += 12) ctx.fillRect(x, ts * 0.85, 1, ts * 0.1);
  }

  // 2. Building Body with Panel Detail
  ctx.fillStyle = bodyColor;
  ctx.fillRect(bx, by, bw, bh);
  
  // Subtle side shading for depth
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fillRect(bx, by, 2, bh);
  ctx.fillRect(bx + bw - 2, by, 2, bh);

  // 3. Roof / Cornice
  ctx.fillStyle = roofColor;
  ctx.fillRect(bx - 1, by - 2, bw + 2, 4);
  // Secondary ledge
  ctx.fillRect(bx - 2, by + s, bw + 4, 1.5);

  // 4. Windows / Display
  if (ts > 8) {
    const winCount = opts.windowCount || 2;
    const winW = (bw - s * 2) / winCount - 2;
    for (let i = 0; i < winCount; i++) {
      const wx = bx + s + i * (winW + 2);
      const wy = by + s * 1.5;
      const wh = bh * 0.45;
      
      // Window frame
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(wx - 1, wy - 1, winW + 2, wh + 2);
      
      // Glass
      ctx.fillStyle = 'rgba(129, 212, 250, 0.6)';
      ctx.fillRect(wx, wy, winW, wh);
      
      // Reflection highlight
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(wx + winW * 0.2, wy, 1, wh);
    }
  }

  // 5. Awning
  if (opts.hasAwning) {
    ctx.fillStyle = opts.awningColor || '#e91e63';
    ctx.beginPath();
    ctx.moveTo(bx - 2, by + s);
    ctx.lineTo(bx + bw + 2, by + s);
    ctx.lineTo(bx + bw + 4, by + s * 3);
    ctx.lineTo(bx - 4, by + s * 3);
    ctx.fill();
    // Awning stripes/depth
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    for (let x = bx; x < bx + bw; x += 6) {
        ctx.fillRect(x, by + s, 2, s * 2);
    }
  }

  // 6. Signage
  if (opts.hasSign && opts.signKey) {
    const signW = bw * 0.95;
    const signH = s * 2.5;
    const sx = bx + bw * 0.025;
    const sy = by - signH - 1;

    // Sign Box
    ctx.fillStyle = opts.signColor || '#fff';
    ctx.fillRect(sx, sy, signW, signH);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx, sy, signW, signH);

    if (ts > 12) {
      const text = t(opts.signKey);
      ctx.fillStyle = '#000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Maximum-fit Text Scaling (Force smaller overall look)
      let fontSize = Math.floor(s * 1.1); // Reduced starting size from 1.8s
      const maxWidth = signW * 0.5; // Strictly limit to 50% width for generous padding
      
      ctx.font = getFontWithStyle(fontSize, opts.fontStyle);
      let metrics = ctx.measureText(text);
      
      // Scale down until it fits the very restrictive maxWidth
      while (metrics.width > maxWidth && fontSize > 4) {
        fontSize--;
        ctx.font = getFontWithStyle(fontSize, opts.fontStyle);
        metrics = ctx.measureText(text);
      }
      
      ctx.fillText(text, bx + bw / 2, sy + signH / 2 + 1);
    }
  }

  // 7. Door with Frame
  ctx.fillStyle = '#222';
  ctx.fillRect(bx + bw * 0.4 - 1, by + bh * 0.55 - 1, bw * 0.2 + 2, bh * 0.45 + 2);
  ctx.fillStyle = '#3d2b1f';
  ctx.fillRect(bx + bw * 0.4, by + bh * 0.55, bw * 0.2, bh * 0.45);
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

  // 1. Concrete lot
  ctx.fillStyle = '#444';
  ctx.fillRect(0, ts * 0.25, ts, ts * 0.75);

  // 2. Convenience Store (Back)
  ctx.fillStyle = bodyColor;
  ctx.fillRect(s * 1, s * 2.5, s * 5, s * 4);
  ctx.fillStyle = roofColor;
  ctx.fillRect(s * 0.5, s * 2, s * 6, s * 0.6);
  
  // Window detail
  ctx.fillStyle = 'rgba(129, 212, 250, 0.6)';
  ctx.fillRect(s * 1.5, s * 3.5, s * 3, s * 1.5);

  // 3. Large Canopy (Front)
  ctx.fillStyle = accent;
  ctx.fillRect(s * 1, s * 6.5, s * 8, s * 1);
  // Canopy depth
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(s * 1, s * 7.3, s * 8, 2);
  
  // Pillars
  ctx.fillStyle = '#aaa';
  ctx.fillRect(s * 2, s * 7.5, s * 0.4, s * 2);
  ctx.fillRect(s * 7.6, s * 7.5, s * 0.4, s * 2);

  // 4. Pumps
  ctx.fillStyle = '#222';
  ctx.fillRect(s * 3.5, ts * 0.82, s * 1, s * 1.5);
  ctx.fillRect(s * 5.5, ts * 0.82, s * 1, s * 1.5);
  // Pump hose detail
  ctx.strokeStyle = '#000';
  ctx.beginPath();
  ctx.moveTo(s * 4.5, ts * 0.85); ctx.lineTo(s * 4.8, ts * 0.9);
  ctx.stroke();

  // 5. Price Sign on Pole (Fixed text scaling)
  ctx.fillStyle = '#222';
  ctx.fillRect(ts - s * 2, s * 1, s * 0.4, s * 8);
  ctx.fillStyle = accent;
  const signW = Math.floor(s * 5.5); // Increased from s * 4
  const signH = Math.floor(s * 3.5);
  const sx = ts - signW - 2;
  const sy = Math.floor(s * 1);
  ctx.fillRect(sx, sy, signW, signH);
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;
  ctx.strokeRect(sx, sy, signW, signH);
  
  if (ts > 15 && opts.signKey) {
    const text = t(opts.signKey);
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Dynamic scaling for gas station sign
    let fontSize = Math.floor(s * 1.0); // Reduced starting size
    const maxWidth = signW * 0.5; // Force 50% max width for small, centered look
    
    ctx.font = getFontWithStyle(fontSize, opts.fontStyle);
    let metrics = ctx.measureText(text);
    
    while (metrics.width > maxWidth && fontSize > 4) {
        fontSize--;
        ctx.font = getFontWithStyle(fontSize, opts.fontStyle);
        metrics = ctx.measureText(text);
    }
    
    ctx.fillText(text, sx + signW / 2, sy + signH / 2 + 1);

  }
}
