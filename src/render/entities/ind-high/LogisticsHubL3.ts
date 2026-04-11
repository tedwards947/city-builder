import type { VectorEntity } from '../../SpriteTypes';

/**
 * LogisticsHubL3_01: A Level 3 Industrial building.
 * A massive modern logistics hub with numerous loading docks,
 * solar panel roof, and integrated office tower.
 */
export const LogisticsHubL3_01: VectorEntity = {
  id: 'LogisticsHubL3_01',
  type: 'ZONE_3_3', // Industrial Level 3
  tags: ['industrial', 'utilitarian', 'corporate', 'grand'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.max(1, Math.floor(ts * 0.05));
    
    const concreteColor = '#aaaaaa';
    const glassColor = 'rgba(150, 200, 255, 0.6)';

    // 1. Foundation
    ctx.fillStyle = '#333';
    ctx.fillRect(0, ts * 0.8, ts, ts * 0.2);

    // 2. Main Hub Body
    ctx.fillStyle = concreteColor;
    ctx.fillRect(inset, ts * 0.5, ts - inset * 2, ts * 0.3);

    // 3. Loading Docks (Dense)
    ctx.fillStyle = '#1a1a1a';
    for (let i = 0; i < 8; i++) {
        ctx.fillRect(inset + 2 + i * (ts / 9), ts * 0.65, ts / 12, ts * 0.15);
    }

    // 4. Integrated Office Tower
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(ts * 0.6, ts * 0.1, ts * 0.3, ts * 0.4);
    ctx.fillStyle = glassColor;
    ctx.fillRect(ts * 0.65, ts * 0.15, ts * 0.2, ts * 0.3);

    // 5. Solar Panels (Roof)
    ctx.fillStyle = '#223344';
    for (let i = 0; i < 3; i++) {
        ctx.fillRect(inset + 5 + i * (ts * 0.15), ts * 0.45, ts * 0.1, 4);
    }
  }
};
