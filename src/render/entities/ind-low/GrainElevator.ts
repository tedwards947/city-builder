import type { VectorEntity } from '../../SpriteTypes';

/**
 * GrainElevator_01: A Level 2 Industrial building.
 * A large agricultural industrial facility featuring tall storage silos,
 * a central elevator tower, and a sheltered loading bay.
 */
export const GrainElevator_01: VectorEntity = {
  id: 'GrainElevator_01',
  type: 'ZONE_3_2', // Industrial Level 2
  tags: ['industrial', 'agricultural', 'organic'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.max(1, Math.floor(ts * 0.08));
    
    // Colors
    const concreteColor = '#dcdcdc'; // Weathered concrete
    const darkerConcrete = '#b0b0b0';
    const metalColor = '#707070';
    const roofColor = '#505050';
    const accentColor = '#8b4513'; // Earthy/Rust accent

    // 1. Foundation / Dirt Apron
    ctx.fillStyle = '#5a4a3a';
    ctx.fillRect(0, ts * 0.85, ts, ts * 0.15);

    // 2. Silos (Three tall cylinders on the left)
    const siloCount = 3;
    const siloW = (ts * 0.5) / siloCount;
    const siloH = ts * 0.7;
    const siloY = ts * 0.85 - siloH;
    
    ctx.fillStyle = concreteColor;
    for (let i = 0; i < siloCount; i++) {
      const sx = inset + i * (siloW + 1);
      
      // Silo Body
      ctx.fillRect(sx, siloY, siloW, siloH);
      
      // Rounded Silo Top (Domed)
      ctx.beginPath();
      ctx.ellipse(sx + siloW / 2, siloY, Math.max(0.1, siloW / 2), Math.max(0.1, s * 0.6), 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Vertical shading/lines for cylindrical look
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx + siloW * 0.7, siloY);
      ctx.lineTo(sx + siloW * 0.7, siloY + siloH);
      ctx.stroke();
    }

    // 3. Central Elevator Tower (Tallest structure)
    const tx = inset + ts * 0.5;
    const tw = ts * 0.2;
    const th = ts * 0.8;
    const ty = ts * 0.85 - th;

    ctx.fillStyle = darkerConcrete;
    ctx.fillRect(tx, ty, tw, th);
    
    // Tower Windows (Small vertical strips)
    ctx.fillStyle = '#222';
    ctx.fillRect(tx + tw / 2 - 1, ty + s, 2, s * 3);
    
    // Tower Roof (Sloped metal)
    ctx.fillStyle = roofColor;
    ctx.beginPath();
    ctx.moveTo(tx - 1, ty);
    ctx.lineTo(tx + tw / 2, ty - s);
    ctx.lineTo(tx + tw + 1, ty);
    ctx.fill();

    // 4. Loading Bay (Low shed on the right)
    const bx = tx + tw;
    const bw = ts - bx - inset;
    const bh = ts * 0.3;
    const by = ts * 0.85 - bh;

    ctx.fillStyle = concreteColor;
    ctx.fillRect(bx, by, bw, bh);
    
    // Loading Entrance
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(bx + 2, by + bh * 0.3, bw - 4, bh * 0.7);
    
    // Shed Roof
    ctx.fillStyle = roofColor;
    ctx.fillRect(bx - 1, by - 1, bw + 2, 2);

    // 5. Conveyor Pipes (Connecting tower to silos)
    ctx.strokeStyle = metalColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, ty + s * 4);
    ctx.lineTo(inset + siloW * 1.5, siloY);
    ctx.stroke();
    
    // Rust details
    ctx.fillStyle = accentColor;
    ctx.fillRect(tx - 1, ty + s * 4, 3, 2);
  }
};
