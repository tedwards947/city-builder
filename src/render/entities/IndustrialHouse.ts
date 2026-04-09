import type { VectorEntity, VibeState } from '../SpriteTypes';
import type { ColorPalette } from '../CharacterPalette';

/**
 * A gritty industrial-looking house for high-pollution or laissez-faire cities.
 */
export const IndustrialHouse: VectorEntity = {
  id: 'res-low-industrial-house',
  type: 'ZONE_1_1', // ZONE_R level 1
  tags: ['industrial', 'residential', 'corporate'],
  draw(ctx: CanvasRenderingContext2D, ts: number, t: number, p: ColorPalette, vibe: VibeState): void {
    const inset = Math.max(1, Math.floor(ts * 0.2));
    const bx = 0 + inset, by = 0 + inset;
    const bw = ts - inset * 2, bh = ts - inset * 2;

    // Body (darker, grittier)
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(bx, by, bw, bh);

    if (ts < 8) return;

    // Flat roof with some AC units or pipes
    ctx.fillStyle = '#333';
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh * 0.2);
    
    // AC unit on roof (animated slightly)
    const acSize = bw * 0.3;
    ctx.fillStyle = '#555';
    ctx.fillRect(bx + bw * 0.1, by - bh * 0.1, acSize, acSize * 0.6);
    
    // Spinning fan detail
    if (ts > 16) {
      const fanX = bx + bw * 0.1 + acSize / 2;
      const fanY = by - bh * 0.1 + acSize * 0.3;
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const angle = t * 20;
      ctx.moveTo(fanX + Math.cos(angle) * 3, fanY + Math.sin(angle) * 3);
      ctx.lineTo(fanX - Math.cos(angle) * 3, fanY - Math.sin(angle) * 3);
      ctx.stroke();
    }

    // Door (metallic)
    ctx.fillStyle = '#222';
    const doorW = bw * 0.2;
    const doorH = bh * 0.5;
    ctx.fillRect(bx + (bw - doorW) / 2, by + bh - doorH, doorW, doorH);

    // Grimy windows
    if (ts > 12) {
      ctx.fillStyle = vibe.isNight ? '#ffcc00' : '#334455';
      const winSize = ts * 0.1;
      ctx.fillRect(bx + bw * 0.2, by + bh * 0.3, winSize, winSize);
      ctx.fillRect(bx + bw * 0.7, by + bh * 0.3, winSize, winSize);
    }
  }
};
