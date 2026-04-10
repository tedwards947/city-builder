import type { VectorEntity } from '../../SpriteTypes';

/**
 * OldBrickFactory_01: A Level 2 Industrial building.
 * A classic early-20th century brick factory with multi-pane windows
 * and exposed vertical piping on the facade.
 */
export const OldBrickFactory_01: VectorEntity = {
  id: 'OldBrickFactory_01',
  type: 'ZONE_3_2', // Industrial Level 2
  tags: ['industrial', 'organic', 'brick'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.max(1, Math.floor(ts * 0.08));
    
    // Dimensions
    const bx = inset;
    const by = inset + s * 1.5;
    const bw = ts - inset * 2;
    const bh = ts - by - inset;

    // Colors
    const brickColor = '#a0522d'; // Sienna/Brick red
    const mortarColor = '#8b4513'; // Darker brown for mortar/shading
    const windowColor = 'rgba(40, 50, 60, 0.9)';
    const pipeColor = '#707070';
    const pipeShadow = '#404040';

    // 1. Foundation
    ctx.fillStyle = '#444';
    ctx.fillRect(0, ts * 0.9, ts, ts * 0.1);

    // 2. Main Brick Body
    ctx.fillStyle = brickColor;
    ctx.fillRect(bx, by, bw, bh);

    // 3. Brick Texture (Subtle)
    ctx.strokeStyle = mortarColor;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let y = by + 2; y < by + bh; y += 4) {
      ctx.moveTo(bx, y);
      ctx.lineTo(bx + bw, y);
      // Small vertical "mortar" ticks
      const offset = (Math.floor(y) % 8 === 0) ? 4 : 0;
      for (let x = bx + offset; x < bx + bw; x += 8) {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 4);
      }
    }
    ctx.stroke();

    // 4. Windows (Multi-pane Industrial style)
    const winRows = 2;
    const winCols = 3;
    const winW = (bw - (winCols + 1) * s) / winCols;
    const winH = (bh - (winRows + 1) * s) / winRows;

    ctx.fillStyle = windowColor;
    for (let r = 0; r < winRows; r++) {
      for (let c = 0; c < winCols; c++) {
        const wx = bx + s + c * (winW + s);
        const wy = by + s + r * (winH + s);
        
        ctx.fillRect(wx, wy, winW, winH);
        
        // Window Panes (grid)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(wx, wy, winW, winH);
        ctx.beginPath();
        ctx.moveTo(wx + winW / 2, wy);
        ctx.lineTo(wx + winW / 2, wy + winH);
        ctx.moveTo(wx, wy + winH / 2);
        ctx.lineTo(wx + winW, wy + winH / 2);
        ctx.stroke();
      }
    }

    // 5. Cornice / Decorative Top
    ctx.fillStyle = mortarColor;
    ctx.fillRect(bx - 1, by, bw + 2, 2);
    ctx.fillRect(bx - 1, by - 2, bw + 2, 1);

    // 6. Vertical Pipes Wrapping Front (DRAWN LAST for foreground effect)
    const pipePositions = [bx + bw * 0.15, bx + bw * 0.85];
    pipePositions.forEach(px => {
      // Pipe Shadow
      ctx.fillStyle = pipeShadow;
      ctx.fillRect(px + 1, by - s, 2, bh + s);
      
      // Pipe Body
      ctx.fillStyle = pipeColor;
      ctx.fillRect(px, by - s, 2, bh + s);
      
      // Pipe Brackets/Joints
      ctx.fillStyle = '#333';
      for (let y = by + s; y < by + bh; y += bh / 3) {
        ctx.fillRect(px - 1, y, 4, 2);
      }
    });
  }
};
