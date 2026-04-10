import type { VectorEntity } from '../../SpriteTypes';
import { drawSmoke } from '../ind-low/IndUtils';

/**
 * ArtDecoL3_01: A Level 3 Industrial building.
 * A grand "Skyscraper" factory in the Art Deco style.
 * Features a central tall spire flanked by stepped towers and 
 * three stylized smokestacks.
 */
export const ArtDecoL3_01: VectorEntity = {
  id: 'ArtDecoL3_01',
  type: 'ZONE_3_3', // Industrial Level 3
  tags: ['industrial', 'planned', 'art-deco', 'grand'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.max(1, Math.floor(ts * 0.05));
    
    // Palette Colors
    const bodyColor = p.buildingI[2]; // Level 3 color
    const darkAccent = '#4a251a';
    const brassColor = '#ffcc66';
    const windowColor = 'rgba(20, 30, 40, 0.9)';

    // 1. Foundation (Massive stepped base)
    ctx.fillStyle = '#222';
    ctx.fillRect(0, ts * 0.8, ts, ts * 0.2);

    // 2. Smokestacks (Drawn behind)
    const bx = inset, bw = ts - inset * 2;
    const stackX = [bx + bw * 0.2, bx + bw * 0.5, bx + bw * 0.8];
    stackX.forEach((sx, i) => {
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(sx - s, inset, s * 1.5, ts * 0.5);
      // Brass rings on stacks
      ctx.fillStyle = brassColor;
      ctx.fillRect(sx - s, inset + s * 2, s * 1.5, 1);
      drawSmoke(ctx, sx - s/2, inset, t + i * 0.5);
    });

    // 3. Main Body - Grand Ziggurat
    ctx.fillStyle = bodyColor;
    
    // Base tier
    ctx.fillRect(bx, ts * 0.5, bw, ts * 0.35);
    // Middle tier
    ctx.fillRect(bx + s * 1.5, ts * 0.3, bw - s * 3, ts * 0.2);
    // Central spire
    ctx.fillRect(bx + bw / 2 - s * 1.5, ts * 0.1, s * 3, ts * 0.2);

    // 4. Vertical Ribbing & Windows
    ctx.fillStyle = windowColor;
    const winW = Math.max(1, Math.floor(s * 0.6));
    const winGap = 2;
    const spireCenterX = bx + bw / 2;
    
    // Central spire windows (Two tall vertical strips)
    for (let i = 0; i < 2; i++) {
        const wx = spireCenterX - (winW + winGap / 2) + i * (winW + winGap);
        ctx.fillRect(Math.floor(wx), Math.floor(ts * 0.15), winW, Math.floor(ts * 0.3));
    }
    // Base windows (ribbon style)
    for (let i = 0; i < 6; i++) {
        ctx.fillRect(bx + s + i * (bw / 7), ts * 0.55, bw / 10, ts * 0.25);
    }

    // 5. Grand Brass Accents
    ctx.fillStyle = brassColor;
    // Spire tip
    ctx.beginPath();
    ctx.moveTo(bx + bw / 2 - s * 1.5, ts * 0.1);
    ctx.lineTo(bx + bw / 2, ts * 0.05);
    ctx.lineTo(bx + bw / 2 + s * 1.5, ts * 0.1);
    ctx.fill();

    // Horizontal bands
    ctx.fillRect(bx, ts * 0.5, bw, 2);
    ctx.fillRect(bx + s * 1.5, ts * 0.3, bw - s * 3, 2);
    
    // Vertical brass "fins"
    for (let i = 0; i < 4; i++) {
        ctx.fillRect(bx + bw * (0.2 + i * 0.2), ts * 0.3, 1, ts * 0.5);
    }
  }
};
