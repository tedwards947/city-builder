import type { VectorEntity } from '../../SpriteTypes';

/**
 * OilRefineryL3_01: A Level 3 Industrial building.
 * A massive industrial complex with two tall flare stacks, 
 * large spherical tanks, and a dense network of pipes and cooling towers.
 */
export const OilRefineryL3_01: VectorEntity = {
  id: 'OilRefineryL3_01',
  type: 'ZONE_3_3', // Industrial Level 3
  tags: ['industrial', 'organic', 'utilitarian', 'grand'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.max(1, Math.floor(ts * 0.05));
    
    // Palette Colors
    const metalColor = '#707070';
    const darkMetal = '#3a3a3a';
    const pipeColor = '#909090';
    const flareColor = '#ff6600';
    const tankColor = p.buildingI[2];

    // 1. Foundation (Massive concrete pad)
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, ts * 0.8, ts, ts * 0.2);

    // 2. Flare Stacks (Drawn behind)
    for (let i = 0; i < 2; i++) {
        const fx = ts * (0.2 + i * 0.6);
        const fy = inset + s;
        const fw = s;
        const fh = ts - fy;
        
        ctx.fillStyle = darkMetal;
        ctx.fillRect(fx - fw/2, fy, fw, fh);
        // Flare bands
        ctx.fillStyle = '#ccaa00';
        for (let j = 1; j < 5; j++) {
            ctx.fillRect(fx - fw/2 - 1, fy + (ts * 0.7 - fy) * (j / 5), fw + 2, 1);
        }
        // Flame
        drawRefineryFlameL3(ctx, fx, fy - 2, t + i * 0.5);
    }

    // 3. Industrial Cooling Towers / Vents
    ctx.fillStyle = '#606060';
    const towerW = s * 2;
    const towerH = ts * 0.25;
    for (let i = 0; i < 2; i++) {
        const tx = ts * (0.3 + i * 0.4);
        const ty = ts * 0.8 - towerH;
        
        // Slightly tapered tower
        ctx.beginPath();
        ctx.moveTo(tx - towerW * 0.5, ty + towerH);
        ctx.lineTo(tx + towerW * 0.5, ty + towerH);
        ctx.lineTo(tx + towerW * 0.3, ty);
        ctx.lineTo(tx - towerW * 0.3, ty);
        ctx.closePath();
        ctx.fill();
        
        // Steam vent top
        ctx.fillStyle = '#444';
        ctx.fillRect(tx - towerW * 0.2, ty - 2, towerW * 0.4, 3);
        ctx.fillStyle = '#606060';
    }

    // 4. Dense Piping (Foreground)
    ctx.strokeStyle = pipeColor;
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
        const py = ts * (0.7 + i * 0.04);
        ctx.beginPath();
        ctx.moveTo(inset, py);
        ctx.lineTo(ts - inset, py);
        ctx.stroke();
    }
    
    // Vertical Pipe connectors
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ts * 0.5, ts * 0.7);
    ctx.lineTo(ts * 0.5, ts * 0.3);
    ctx.stroke();
  }
};

function drawRefineryFlameL3(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const flicker = Math.sin(t * 20) * 0.3 + 0.7;
  const pulse = Math.sin(t * 10) * 3;
  
  const grad = ctx.createRadialGradient(x, y, 1, x, y, 12 + pulse);
  grad.addColorStop(0, 'rgba(255, 200, 0, 0.8)');
  grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
  
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, 10 + pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffcc00';
  ctx.beginPath();
  ctx.moveTo(x - 3, y);
  ctx.quadraticCurveTo(x, y - 10 - pulse * 2, x + 3, y);
  ctx.fill();
}
