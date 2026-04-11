import type { VectorEntity } from '../../SpriteTypes';

/**
 * TextileMill_01: A Level 2 Industrial building.
 * A classic 19th-century style multi-story brick textile mill.
 * Features a long facade with a dense grid of windows and a 
 * small rooftop water tower.
 */
export const TextileMill_01: VectorEntity = {
  id: 'TextileMill_01',
  type: 'ZONE_3_2', // Industrial Level 2
  tags: ['industrial', 'organic', 'brick', 'historic'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.max(1, Math.floor(ts * 0.08));
    
    // Dimensions - Long and relatively tall
    const bx = inset;
    const by = inset + s * 2;
    const bw = ts - inset * 2;
    const bh = ts - by - inset;

    // Colors
    const brickColor = '#b04030'; // Classic deep red brick
    const darkerBrick = '#803020';
    const windowColor = 'rgba(50, 60, 70, 0.85)';
    const towerColor = '#506070'; // Metallic water tower

    // 1. Foundation
    ctx.fillStyle = '#444';
    ctx.fillRect(0, ts * 0.9, ts, ts * 0.1);

    // 2. Main Building Body
    ctx.fillStyle = brickColor;
    ctx.fillRect(bx, by, bw, bh);

    // 3. Window Grid (Multi-story look)
    const rows = 3;
    const cols = 5;
    const winW = (bw - (cols + 1) * 2) / cols;
    const winH = (bh - (rows + 1) * 2) / rows;

    ctx.fillStyle = windowColor;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = bx + 2 + c * (winW + 2);
        const wy = by + 2 + r * (winH + 2);
        ctx.fillRect(wx, wy, winW, winH);
        
        // Window sills (small white/gray lines)
        ctx.fillStyle = '#ccc';
        ctx.fillRect(wx, wy + winH, winW, 1);
        ctx.fillStyle = windowColor;
      }
    }

    // 4. Rooftop Water Tower
    // Small cylindrical tank on 4 legs
    const tw = s * 2;
    const th = s * 2;
    const tx = bx + s;
    const ty = by - th - s * 2;

    // Legs
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tx, ty + th);
    ctx.lineTo(tx, by);
    ctx.moveTo(tx + tw, ty + th);
    ctx.lineTo(tx + tw, by);
    ctx.stroke();

    // Tank Body
    ctx.fillStyle = towerColor;
    ctx.fillRect(tx - 1, ty, tw + 2, th);
    // Conical top
    ctx.beginPath();
    ctx.moveTo(tx - 1, ty);
    ctx.lineTo(tx + tw / 2, ty - s);
    ctx.lineTo(tx + tw + 1, ty);
    ctx.fill();

    // 5. Decorative Brickwork (Cornice)
    ctx.fillStyle = darkerBrick;
    ctx.fillRect(bx - 1, by, bw + 2, 2);
    // Small chimney/vent on the other side
    ctx.fillRect(bx + bw - s * 2, by - s, s, s);

    // 6. Subtle Brick Texture (Horizontal lines)
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 0.5;
    for (let y = by + 4; y < by + bh; y += 4) {
      ctx.beginPath();
      ctx.moveTo(bx, y);
      ctx.lineTo(bx + bw, y);
      ctx.stroke();
    }
  }
};
