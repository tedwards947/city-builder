import type { VectorEntity } from '../../SpriteTypes';

/**
 * GenericWarehouse_01: A Level 2 Industrial building.
 * A simple, boxy concrete warehouse with multiple loading bays.
 * Designed to look generic, utilitarian, and corporate.
 */
export const GenericWarehouse_01: VectorEntity = {
  id: 'GenericWarehouse_01',
  type: 'ZONE_3_2', // Industrial Level 2
  tags: ['industrial', 'utilitarian', 'corporate'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.max(1, Math.floor(ts * 0.05));
    
    // Dimensions
    const bx = inset;
    const by = inset + s * 1.5;
    const bw = ts - inset * 2;
    const bh = ts - by - inset;

    // Colors
    const concreteColor = '#9a9a9a';
    const darkerConcrete = '#7a7a7a';
    const doorColor = '#2a2a2a';
    const accentColor = '#ffd700'; // Yellow safety stripes

    // 1. Foundation
    ctx.fillStyle = '#444';
    ctx.fillRect(0, ts * 0.85, ts, ts * 0.15);

    // 2. Main Building Body
    ctx.fillStyle = concreteColor;
    ctx.fillRect(bx, by, bw, bh);

    // 3. Panel Seams (Concrete Grid)
    ctx.strokeStyle = darkerConcrete;
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Vertical seams
    for (let x = bx + bw / 3; x < bx + bw; x += bw / 3) {
      ctx.moveTo(Math.floor(x), by);
      ctx.lineTo(Math.floor(x), by + bh);
    }
    // Horizontal seam
    ctx.moveTo(bx, by + bh * 0.4);
    ctx.lineTo(bx + bw, by + bh * 0.4);
    ctx.stroke();

    // 4. Loading Bays (Multiple roll-up doors)
    const bayCount = 3;
    const bayW = Math.floor(bw / bayCount - s * 0.8);
    const bayH = Math.floor(bh * 0.55);
    
    for (let i = 0; i < bayCount; i++) {
      const dx = Math.floor(bx + s * 0.4 + i * (bw / bayCount));
      const dy = Math.floor(by + bh - bayH);
      
      // Door
      ctx.fillStyle = doorColor;
      ctx.fillRect(dx, dy, bayW, bayH);
      
      // Horizontal slats
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let ly = dy + 2; ly < dy + bayH; ly += 3) {
        ctx.moveTo(dx, ly);
        ctx.lineTo(dx + bayW, ly);
      }
      ctx.stroke();

      // Yellow safety stripe above door
      ctx.fillStyle = accentColor;
      ctx.fillRect(dx, dy, bayW, 1.5);
    }

    // 5. Flat Roof Details (HVAC Units)
    ctx.fillStyle = darkerConcrete;
    // Main roof cap
    ctx.fillRect(bx - 1, by - 2, bw + 2, 3);
    
    // AC Units
    ctx.fillStyle = '#666';
    const acSize = s * 1.2;
    ctx.fillRect(bx + s, by - acSize, acSize, acSize);
    ctx.fillRect(bx + bw - acSize - s, by - acSize, acSize, acSize);
    
    // Tiny fan details on AC units
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(bx + s + acSize / 2, by - acSize / 2, Math.max(0.1, acSize / 4), 0, Math.PI * 2);
    ctx.arc(bx + bw - acSize / 2 - s, by - acSize / 2, Math.max(0.1, acSize / 4), 0, Math.PI * 2);
    ctx.fill();

    // 6. Small Personnel Door
    const pDoorW = Math.floor(s * 1.2);
    const pDoorH = Math.floor(s * 2.2);
    ctx.fillStyle = '#222';
    ctx.fillRect(bx + bw - pDoorW - 2, by + bh - pDoorH, pDoorW, pDoorH);
  }
};
