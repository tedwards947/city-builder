import type { VectorEntity } from '../../SpriteTypes';

/**
 * MultiTankDepotL1: A Level 1 Industrial building.
 * A storage facility with multiple cylindrical tanks and an access platform.
 */
export const MultiTankDepotL1: VectorEntity = {
  id: 'MultiTankDepotL1',
  type: 'ZONE_3_1', // Industrial Level 1
  tags: ['industrial', 'utilitarian', 'storage'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.max(1, Math.floor(ts * 0.1));
    const tankCount = 3;
    const tankW = Math.max(0.1, (ts - inset * 2) / tankCount - 2);

    const bodyColor = p.buildingI[0];
    const roofColor = '#555';

    for (let i = 0; i < tankCount; i++) {
      const tx = inset + i * (tankW + 2);
      const ty = inset + s * 2;
      const th = Math.max(0.1, ts - ty - inset);

      // Tank Body
      ctx.fillStyle = bodyColor;
      ctx.fillRect(tx, ty, tankW, th);

      // Tank Top
      ctx.fillStyle = roofColor;
      ctx.beginPath();
      ctx.ellipse(tx + tankW / 2, ty, Math.max(0.1, tankW / 2), Math.max(0.1, s * 0.8), 0, 0, Math.PI * 2);
      ctx.fill();

      // Horizontal bands
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx, ty + th * 0.4);
      ctx.lineTo(tx + tankW, ty + th * 0.4);
      ctx.stroke();
    }

    // Access Platform
    ctx.fillStyle = '#404040';
    ctx.fillRect(inset, ts * 0.85, ts - inset * 2, 2);
  }
};
