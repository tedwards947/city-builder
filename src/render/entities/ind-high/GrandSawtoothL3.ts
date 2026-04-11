import type { VectorEntity } from '../../SpriteTypes';

/**
 * GrandSawtoothL3_01: A Level 3 Industrial building.
 * A grand multi-bay sawtooth factory with elaborate brickwork,
 * large arched windows, and a central power station.
 */
export const GrandSawtoothL3_01: VectorEntity = {
  id: 'GrandSawtoothL3_01',
  type: 'ZONE_3_3', // Industrial Level 3
  tags: ['industrial', 'organic', 'brick', 'grand'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.max(1, Math.floor(ts * 0.05));
    
    const brickColor = '#a24d3d';
    const glassColor = 'rgba(100, 140, 180, 0.7)';

    // 1. Foundation
    ctx.fillStyle = '#444';
    ctx.fillRect(0, ts * 0.9, ts, ts * 0.1);

    // 2. Multi-bay Sawtooth Roof
    ctx.fillStyle = '#333';
    const bays = 4;
    const bayW = (ts - inset * 2) / bays;
    for (let i = 0; i < bays; i++) {
        const x = inset + i * bayW;
        ctx.beginPath();
        ctx.moveTo(x, ts * 0.4);
        ctx.lineTo(x, ts * 0.2);
        ctx.lineTo(x + bayW, ts * 0.4);
        ctx.fill();
        // Glass
        ctx.fillStyle = glassColor;
        ctx.fillRect(x + 1, ts * 0.25, 2, ts * 0.1);
        ctx.fillStyle = '#333';
    }

    // 3. Main Body
    ctx.fillStyle = brickColor;
    ctx.fillRect(inset, ts * 0.4, ts - inset * 2, ts * 0.5);

    // 4. Grand Arched Windows
    ctx.fillStyle = glassColor;
    const archRadius = s * 1.2; // Reduced from 1.5s to prevent overlap
    for (let i = 0; i < 3; i++) {
        const ax = ts * (0.22 + i * 0.28);
        ctx.beginPath();
        ctx.arc(ax, ts * 0.6, Math.max(0.1, archRadius), Math.PI, 0);
        ctx.lineTo(ax + archRadius, ts * 0.8);
        ctx.lineTo(ax - archRadius, ts * 0.8);
        ctx.fill();
    }
  }
};
