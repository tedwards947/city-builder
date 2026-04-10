import type { VectorEntity } from '../../SpriteTypes';

/**
 * SteelDepotL3_01: A Level 3 Industrial building.
 * A massive heavy steel industrial depot with large gantry cranes,
 * stacked steel beams, and a high-clearance corrugated structure.
 */
export const SteelDepotL3_01: VectorEntity = {
  id: 'SteelDepotL3_01',
  type: 'ZONE_3_3', // Industrial Level 3
  tags: ['industrial', 'utilitarian', 'steel', 'grand'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.max(1, Math.floor(ts * 0.05));
    
    const steelColor = '#7a8a8a';
    const lightSteel = '#9aabab';
    const craneColor = '#d0b030'; // Construction yellow

    // 1. Foundation
    ctx.fillStyle = '#333';
    ctx.fillRect(0, ts * 0.85, ts, ts * 0.15);

    // 2. Main High-Clearance Structure
    ctx.fillStyle = steelColor;
    ctx.fillRect(inset, ts * 0.2, ts * 0.7, ts * 0.65);
    // Vertical Corrugation
    ctx.strokeStyle = lightSteel;
    ctx.lineWidth = 1;
    for (let x = inset + 2; x < inset + ts * 0.7; x += 4) {
        ctx.beginPath(); ctx.moveTo(x, ts * 0.2); ctx.lineTo(x, ts * 0.85); ctx.stroke();
    }

    // 3. Heavy Gantry Crane (Outer)
    ctx.fillStyle = craneColor;
    // Horizontal beam
    ctx.fillRect(ts * 0.1, ts * 0.1, ts * 0.8, 4);
    // Vertical legs
    ctx.fillRect(ts * 0.1, ts * 0.1, 4, ts * 0.75);
    ctx.fillRect(ts * 0.8, ts * 0.1, 4, ts * 0.75);
    // Trolley
    const tx = ts * (0.3 + Math.sin(t) * 0.2);
    ctx.fillStyle = '#333';
    ctx.fillRect(tx, ts * 0.1 - 2, 8, 8);

    // 4. Stacked Materials (Lower)
    ctx.fillStyle = '#555';
    for (let i = 0; i < 3; i++) {
        ctx.fillRect(ts * 0.5 + i * 8, ts * 0.75, 6, 8);
    }
  }
};
