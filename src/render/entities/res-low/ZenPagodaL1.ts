import type { VectorEntity } from '../../SpriteTypes';
import { drawVeg } from './ResUtils';

/**
 * ZenPagodaL1: A Level 1 Residential building.
 * A traditional multi-tiered pagoda-style home.
 * Features curved eaves, decorative brackets, and a serene garden.
 */
export const ZenPagodaL1: VectorEntity = {
  id: 'ZenPagodaL1',
  type: 'ZONE_1_1', // Residential Level 1
  tags: ['green', 'organic', 'zen', 'traditional'],
  draw: (ctx, ts, t, p, vibe) => {
    const s = ts * 0.1;
    const inset = Math.floor(ts * 0.15);
    
    // Colors
    const woodColor = '#8d6e63'; // Warm wood
    const roofColor = '#2e7d32'; // Forest green tiles
    const paperColor = '#fff9c4'; // Cream/Paper walls
    const accentColor = '#d32f2f'; // Traditional red

    // 1. Foundation / Stone Plinth
    ctx.fillStyle = '#757575';
    ctx.fillRect(inset, Math.floor(ts * 0.8), Math.floor(ts - inset * 2), Math.floor(ts * 0.1));

    // 2. Main Body (Lower Tier)
    const bw = Math.floor(ts * 0.5);
    const bh = Math.floor(ts * 0.3);
    const bx = Math.floor(ts * 0.5 - bw / 2);
    const by = Math.floor(ts * 0.8 - bh);

    ctx.fillStyle = paperColor;
    ctx.fillRect(bx, by, bw, bh);
    
    // Decorative Wood Posts
    ctx.fillStyle = woodColor;
    ctx.fillRect(bx, by, 2, bh);
    ctx.fillRect(bx + bw - 2, by, 2, bh);
    ctx.fillRect(bx + bw / 2 - 1, by, 2, bh);

    // 3. Lower Tiered Roof (Curved Eaves)
    ctx.fillStyle = roofColor;
    drawPagodaRoof(ctx, bx - s, by, bw + s * 2, s * 1.5);

    // 4. Upper Tier
    const ubw = Math.floor(bw * 0.7);
    const ubh = Math.floor(bh * 0.8);
    const ubx = Math.floor(ts * 0.5 - ubw / 2);
    const uby = Math.floor(by - s * 1.5 - ubh);

    ctx.fillStyle = paperColor;
    ctx.fillRect(ubx, uby, ubw, ubh);
    
    ctx.fillStyle = woodColor;
    ctx.fillRect(ubx, uby, 2, ubh);
    ctx.fillRect(ubx + ubw - 2, uby, 2, ubh);

    // 5. Upper Tiered Roof
    ctx.fillStyle = roofColor;
    drawPagodaRoof(ctx, ubx - s, uby, ubw + s * 2, s * 1.5);

    // 6. Finial (Top Spire)
    ctx.fillStyle = woodColor;
    ctx.fillRect(Math.floor(ts * 0.5 - 1), uby - s * 2.5, 2, s * 1.5);
    ctx.fillStyle = '#ffd700'; // Gold tip
    ctx.beginPath();
    ctx.arc(ts * 0.5, uby - s * 2.5, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 7. Garden Elements
    drawVeg(ctx, inset + s, ts * 0.8, ts, t, 'bush');
    drawVeg(ctx, ts - inset - s, ts * 0.8, ts, t, 'flowers');
  }
};

/**
 * Helper to draw a curved pagoda roof tier.
 */
function drawPagodaRoof(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    ctx.beginPath();
    ctx.moveTo(x, y);
    // Left curve up
    ctx.quadraticCurveTo(x + w * 0.1, y - h, x + w * 0.5, y - h);
    // Right curve down
    ctx.quadraticCurveTo(x + w * 0.9, y - h, x + w, y);
    // Bottom edge (slight curve)
    ctx.quadraticCurveTo(x + w * 0.5, y - 2, x, y);
    ctx.fill();
    
    // Top ridge accent
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
}
