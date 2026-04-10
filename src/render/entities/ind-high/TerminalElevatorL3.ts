import type { VectorEntity } from '../../SpriteTypes';

/**
 * TerminalElevatorL3_01: A Level 3 Industrial building.
 * A massive terminal grain facility (Simplified).
 * Features a long row of 8 silos and one dominant headhouse tower.
 */
export const TerminalElevatorL3_01: VectorEntity = {
  id: 'TerminalElevatorL3_01',
  type: 'ZONE_3_3', // Industrial Level 3
  tags: ['industrial', 'agricultural', 'organic', 'grand'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.max(1, Math.floor(ts * 0.05));
    
    // Colors
    const concreteColor = '#dcdcdc';
    const darkerConcrete = '#b0b0b0';
    const metalColor = '#5a5a5a';

    // 1. Foundation
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(0, ts * 0.85, ts, ts * 0.15);

    // 2. Large Silo Row (Simplified to 8 silos)
    const siloW = (ts - inset * 2) / 9;
    const siloH = ts * 0.6;
    const siloY = ts * 0.85 - siloH;
    
    ctx.fillStyle = concreteColor;
    for (let i = 0; i < 8; i++) {
        const x = inset + i * (siloW + 0.5);
        ctx.fillRect(x, siloY, siloW, siloH);
        // Rounded tops
        ctx.beginPath();
        ctx.ellipse(x + siloW/2, siloY, siloW/2, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Subtle shading
        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        ctx.fillRect(x + siloW * 0.6, siloY, siloW * 0.4, siloH);
        ctx.fillStyle = concreteColor;
    }

    // 3. Single Dominant Headhouse Tower
    const tw = ts * 0.25;
    const th = ts * 0.8;
    const tx = ts - inset - tw;
    const ty = ts * 0.85 - th;

    ctx.fillStyle = concreteColor;
    ctx.fillRect(tx, ty, tw, th);
    
    // Tower Details
    ctx.fillStyle = '#222';
    ctx.fillRect(tx + tw/2 - 1, ty + s, 2, s * 4);
    
    // Tower Roof
    ctx.fillStyle = metalColor;
    ctx.beginPath();
    ctx.moveTo(tx - 1, ty);
    ctx.lineTo(tx + tw/2, ty - s);
    ctx.lineTo(tx + tw + 1, ty);
    ctx.fill();

    // 4. Simplified Overhead Conveyor
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(inset, siloY + s);
    ctx.lineTo(tx, siloY + s);
    ctx.stroke();
  }
};
