import type { VectorEntity } from '../../SpriteTypes';

/**
 * MiniFlareL1: A Level 1 Industrial building.
 * A basic refinery element featuring a single flare stack
 * and one horizontal storage tank with supports.
 */
export const MiniFlareL1: VectorEntity = {
  id: 'MiniFlareL1',
  type: 'ZONE_3_1', // Industrial Level 1
  tags: ['industrial', 'organic', 'utilitarian'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.floor(ts * 0.05);
    
    // 1. Foundation
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, Math.floor(ts * 0.85), ts, Math.floor(ts * 0.15));

    // 2. Flare Stack
    const fx = Math.floor(ts * 0.3);
    const fy = Math.floor(inset + s);
    const fw = Math.floor(s);
    const fh = Math.floor(ts * 0.85 - fy);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(fx, fy, fw, fh);
    
    // Symmetrical bands
    ctx.fillStyle = '#ccaa00';
    ctx.fillRect(fx - 1, fy + Math.floor(fh * 0.3), fw + 2, 1);
    
    // Flame (Wavy)
    drawWavyMiniFlame(ctx, fx + fw / 2, fy - 2, t);

    // 3. Horizontal Tank with Supports
    const tx = Math.floor(ts * 0.5);
    const ty = Math.floor(ts * 0.65);
    const tw = Math.floor(ts * 0.4);
    const th = Math.floor(s * 1.5);

    // Tank Supports
    ctx.fillStyle = '#444';
    ctx.fillRect(tx + 4, ty + th, 2, Math.floor(ts * 0.85 - (ty + th)));
    ctx.fillRect(tx + tw - 6, ty + th, 2, Math.floor(ts * 0.85 - (ty + th)));

    ctx.fillStyle = p.buildingI[0];
    ctx.fillRect(tx, ty, tw, th);
    // Rounded ends
    ctx.beginPath();
    ctx.ellipse(tx, ty + th/2, Math.max(0.1, s), Math.max(0.1, th/2), 0, 0, Math.PI * 2);
    ctx.ellipse(tx + tw, ty + th/2, Math.max(0.1, s), Math.max(0.1, th/2), 0, 0, Math.PI * 2);
    ctx.fill();

    // 4. Connecting Pipe
    ctx.strokeStyle = '#718096';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(fx + fw, ty + th/2);
    ctx.lineTo(tx, ty + th/2);
    ctx.stroke();
  }
};

function drawWavyMiniFlame(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const wave = Math.sin(t * 15) * 2;
  const flicker = Math.sin(t * 30) * 0.5 + 0.5;
  
  ctx.fillStyle = `rgba(255, 100, 0, ${0.6 + flicker * 0.4})`;
  ctx.beginPath();
  ctx.moveTo(x - 3, y);
  ctx.bezierCurveTo(x - 3, y - 5, x + wave, y - 8, x + wave * 0.5, y - 12);
  ctx.bezierCurveTo(x + 3 + wave, y - 8, x + 3, y - 5, x + 3, y);
  ctx.fill();

  ctx.fillStyle = '#ffcc00';
  ctx.beginPath();
  ctx.arc(x, y - 1, 1.5, 0, Math.PI * 2);
  ctx.fill();
}
