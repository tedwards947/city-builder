import type { VectorEntity } from '../../SpriteTypes';

/**
 * OilRefinery_01: A Level 2 Industrial building.
 * A utilitarian facility featuring a tall flare stack with an animated flame,
 * storage tanks, and a complex network of pipes and machinery.
 */
export const OilRefinery_01: VectorEntity = {
  id: 'OilRefinery_01',
  type: 'ZONE_3_2', // Industrial Level 2
  tags: ['industrial', 'organic', 'utilitarian'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.max(1, Math.floor(ts * 0.08));
    
    // Palette Colors
    const metalColor = '#707070';
    const darkMetal = '#404040';
    const pipeColor = '#909090';
    const cautionColor = '#d0b030';
    const tankColor = p.buildingI[1];

    // 1. Foundation (Concrete/Metal Pad)
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, ts * 0.8, ts, ts * 0.2);

    // 2. Storage Tanks
    // Two cylindrical tanks on the left
    ctx.fillStyle = tankColor;
    const tankR = Math.max(0.1, s * 1.5);
    for (let i = 0; i < 2; i++) {
      const tx = inset + tankR + i * (tankR * 2.5);
      const ty = ts * 0.65;
      
      // Tank Body
      ctx.fillRect(tx - tankR, ty - tankR, tankR * 2, tankR * 2 + ts * 0.15);
      
      // Tank Top (slightly rounded)
      ctx.beginPath();
      ctx.ellipse(tx, ty - tankR, tankR, Math.max(0.1, s * 0.5), 0, 0, Math.PI * 2);
      ctx.fill();

      // Tank detail lines
      ctx.strokeStyle = darkMetal;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx - tankR, ty);
      ctx.lineTo(tx + tankR, ty);
      ctx.stroke();
    }

    // 3. Flare Stack (Tall) - DRAWN BEHIND PIPES
    const fx = ts * 0.7;
    const fy = inset + s * 2;
    const fw = s * 1.2;
    const fh = ts - fy; // Extend all the way to the bottom

    // Stack structure
    ctx.fillStyle = darkMetal;
    ctx.fillRect(fx, fy, fw, fh);
    
    // Support lattice/bands
    ctx.fillStyle = cautionColor;
    for (let i = 1; i < 4; i++) {
      ctx.fillRect(fx - 1, fy + (ts * 0.8 - fy) * (i / 4), fw + 2, 1);
    }

    // Flare Tip
    ctx.fillStyle = '#222';
    ctx.fillRect(fx - 1, fy - 2, fw + 2, 4);

    // 4. Pipes and Machinery (Lower Part)
    ctx.strokeStyle = pipeColor;
    ctx.lineWidth = Math.max(1, s * 0.4);
    
    // Horizontal pipes running across
    ctx.beginPath();
    ctx.moveTo(inset, ts * 0.75);
    ctx.lineTo(ts - inset, ts * 0.75);
    ctx.moveTo(inset, ts * 0.68);
    ctx.lineTo(ts - inset, ts * 0.68);
    ctx.stroke();

    // Vertical pipe segments and small machinery boxes
    ctx.fillStyle = metalColor;
    for (let i = 0; i < 4; i++) {
      const mx = inset + i * (ts / 4.5) + s;
      ctx.fillRect(mx, ts * 0.6, s * 1.5, ts * 0.2);
      
      // Vertical connectors
      ctx.beginPath();
      ctx.moveTo(mx + s * 0.75, ts * 0.6);
      ctx.lineTo(mx + s * 0.75, ts * 0.5);
      ctx.stroke();
    }

    // 5. Animated Flame
    drawRefineryFlame(ctx, fx + fw / 2, fy - 2, t);
  }
};

/**
 * Draws a flickering, pulsing flame for the refinery flare stack.
 */
function drawRefineryFlame(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const flicker = Math.sin(t * 15) * 0.2 + 0.8;
  const pulse = Math.sin(t * 8) * 2;
  
  // Outer Glow
  const grad = ctx.createRadialGradient(x, y, 1, x, y, Math.max(0.1, 10 + pulse));
  grad.addColorStop(0, 'rgba(255, 150, 0, 0.6)');
  grad.addColorStop(1, 'rgba(255, 50, 0, 0)');
  
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, 8 + pulse), 0, Math.PI * 2);
  ctx.fill();

  // Core Flame
  ctx.fillStyle = '#ffcc00';
  ctx.beginPath();
  ctx.moveTo(x - 2, y);
  ctx.quadraticCurveTo(x, y - Math.max(0.1, 8 + pulse * 2), x + 2, y);
  ctx.fill();

  // Flicker sparks/bits
  ctx.fillStyle = '#ff6600';
  const sparkY = y - 5 - (t * 20 % 10);
  const sparkX = x + Math.sin(t * 10) * 3;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(sparkX, sparkY, Math.max(0.1, 1.5), 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;
}
