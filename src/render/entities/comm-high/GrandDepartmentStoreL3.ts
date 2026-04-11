import type { VectorEntity } from '../../SpriteTypes';

/**
 * GrandDepartmentStoreL3: A Level 3 Commercial building.
 * A massive historic-style department store featuring arched windows,
 * a corner clock tower, and ornate stone/brick facades.
 */
export const GrandDepartmentStoreL3: VectorEntity = {
  id: 'GrandDepartmentStoreL3',
  type: 'ZONE_2_3',
  tags: ['organic', 'planned', 'retail', 'historic'],
  draw: (ctx, ts, t, p, vibe) => {
    const s = ts * 0.1;
    const inset = Math.floor(ts * 0.05);
    
    // 1. Tower Dimensions (Define first so we know available facade space)
    const tw = Math.floor(ts * 0.28);
    const th = Math.floor(ts * 0.85);
    const tx = ts - inset - tw;
    const ty = Math.floor(ts * 0.9 - th);

    // 2. Main Building Block
    const bx = inset;
    const by = Math.floor(ts * 0.9 - Math.floor(ts * 0.75));
    const bw = ts - inset * 2;
    const bh = Math.floor(ts * 0.75);
    
    // Facade Width (Visible area to the left of the tower)
    const facadeW = tx - bx;

    // Foundation / Sidewalk
    ctx.fillStyle = '#4a5568';
    ctx.fillRect(0, Math.floor(ts * 0.9), ts, Math.floor(ts * 0.1));

    // Main Body
    ctx.fillStyle = '#a0522d'; 
    ctx.fillRect(bx, by, bw, bh);

    // 3. Upper Floor Window Grid (Centered in facadeW)
    ctx.fillStyle = 'rgba(40, 50, 60, 0.9)';
    const gridCols = 3;
    const winW = Math.floor(facadeW / (gridCols + 1));
    const winH = Math.floor(s * 1.5);
    const winGap = Math.floor((facadeW - (gridCols * winW)) / (gridCols + 1));

    for (let r = 0; r < 2; r++) {
        for (let c = 0; c < gridCols; c++) {
            const wx = bx + winGap + c * (winW + winGap);
            const wy = by + Math.floor(s * 1.5) + r * (winH + Math.floor(s * 0.8));
            ctx.fillRect(wx, wy, winW, winH);
        }
    }

    // 4. Grand Arched Windows (Ground floor, aligned 1-to-1 with grid above)
    const archH = Math.floor(bh * 0.4);
    for (let i = 0; i < gridCols; i++) {
        const ax = bx + winGap + i * (winW + winGap);
        const ay = Math.floor(ts * 0.9 - archH);
        
        // Lower rectangular part
        ctx.fillRect(ax, ay + Math.floor(archH * 0.3), winW, Math.floor(archH * 0.7));
        
        // Centered Arch (Matches winW exactly)
        ctx.beginPath();
        ctx.arc(ax + winW / 2, ay + Math.floor(archH * 0.3), winW / 2, Math.PI, 0);
        ctx.fill();
    }

    // 5. Decorative Cornice
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(bx - 1, by - 2, bw + 2, 3);

    // 6. Corner Clock Tower (Foreground)
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(tx, ty, tw, th);
    
    // Tower shading
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(tx + tw - 4, ty, 4, th);
    
    // Clock Face
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(tx + tw / 2, ty + Math.floor(s * 2.5), Math.floor(s * 0.9), 0, Math.PI * 2);
    ctx.fill();
    
    // Tower Roof (Copper green)
    ctx.fillStyle = '#4a7c59';
    ctx.beginPath();
    ctx.moveTo(tx - 2, ty);
    ctx.lineTo(tx + tw / 2, ty - Math.floor(s * 1.5));
    ctx.lineTo(tx + tw + 2, ty);
    ctx.fill();
  }
};
