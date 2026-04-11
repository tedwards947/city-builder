import type { VectorEntity } from '../../SpriteTypes';

/**
 * FinancialCenterL3: A Level 3 Commercial building.
 * A post-modern commercial complex with sharp angular glass sections,
 * metallic finishes, and a heavy dark base.
 */
export const FinancialCenterL3: VectorEntity = {
  id: 'FinancialCenterL3',
  type: 'ZONE_2_3',
  tags: ['corporate', 'planned', 'office', 'finance'],
  draw: (ctx, ts, t, p, vibe) => {
    const s = ts * 0.1;
    const inset = Math.floor(ts * 0.05);
    
    // 1. Heavy Metallic Base
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(0, Math.floor(ts * 0.7), ts, Math.floor(ts * 0.3));

    // 2. Twin Angular Towers
    const bw = Math.floor(ts * 0.35);
    const bh = Math.floor(ts * 0.8);
    
    // Left Tower (Slanted top)
    ctx.fillStyle = '#718096';
    const lx = Math.floor(ts * 0.1);
    const ly = Math.floor(ts * 0.15);
    ctx.beginPath();
    ctx.moveTo(lx, ts * 0.7);
    ctx.lineTo(lx, ly);
    ctx.lineTo(lx + bw, ly + Math.floor(s * 2));
    ctx.lineTo(lx + bw, ts * 0.7);
    ctx.fill();

    // Right Tower (Taller, sharp angle)
    ctx.fillStyle = '#4a5568';
    const rx = Math.floor(ts * 0.55);
    const ry = Math.floor(ts * 0.05);
    ctx.beginPath();
    ctx.moveTo(rx, ts * 0.7);
    ctx.lineTo(rx, ry + Math.floor(s * 3));
    ctx.lineTo(rx + bw, ry);
    ctx.lineTo(rx + bw, ts * 0.7);
    ctx.fill();

    // 3. Glass Paneling (Angular)
    ctx.fillStyle = 'rgba(49, 130, 206, 0.5)';
    // Left Tower Glass
    ctx.beginPath();
    ctx.moveTo(lx + 4, ts * 0.65);
    ctx.lineTo(lx + 4, ly + 6);
    ctx.lineTo(lx + bw - 4, ly + Math.floor(s * 2) + 4);
    ctx.lineTo(lx + bw - 4, ts * 0.65);
    ctx.fill();

    // Right Tower Glass
    ctx.beginPath();
    ctx.moveTo(rx + 4, ts * 0.65);
    ctx.lineTo(rx + 4, ry + Math.floor(s * 3) + 4);
    ctx.lineTo(rx + bw - 4, ry + 6);
    ctx.lineTo(rx + bw - 4, ts * 0.65);
    ctx.fill();

    // 4. Connecting Skybridge
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(lx + bw, Math.floor(ts * 0.4), rx - (lx + bw), Math.floor(s));
  }
};
