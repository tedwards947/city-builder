import type { VectorEntity } from '../../SpriteTypes';

/**
 * SteelShed_01: A Level 2 Industrial building.
 * A simple utilitarian corrugated steel shed or warehouse.
 * Features vertical texture lines, a large bay door, and a small personnel door.
 */
export const SteelShed_01: VectorEntity = {
  id: 'SteelShed_01',
  type: 'ZONE_3_2', // Industrial Level 2
  tags: ['industrial', 'utilitarian', 'steel'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.max(1, Math.floor(ts * 0.08));
    
    // Dimensions
    const bx = inset;
    const by = inset + s * 2;
    const bw = ts - inset * 2;
    const bh = ts - by - inset;

    // Colors
    const steelColor = '#8a9a9a'; // Blueish gray steel
    const darkSteel = '#5a6a6a';
    const lightSteel = '#aababa';
    const doorColor = '#333';
    const windowColor = 'rgba(100, 150, 200, 0.6)';

    // 1. Foundation / Apron
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(0, ts * 0.8, ts, ts * 0.2);

    // 2. Main Body
    ctx.fillStyle = steelColor;
    ctx.fillRect(bx, by, bw, bh);

    // 3. Corrugated Texture (Vertical Lines)
    ctx.lineWidth = 1;
    for (let x = bx + 2; x < bx + bw; x += 3) {
      // Alternating light/dark for ridge effect
      ctx.strokeStyle = (Math.floor(x) % 6 === 0) ? darkSteel : lightSteel;
      ctx.beginPath();
      ctx.moveTo(x, by);
      ctx.lineTo(x, by + bh);
      ctx.stroke();
    }

    // 4. Large Bay Door (Sliding/Roll-up)
    const doorW = bw * 0.45;
    const doorH = bh * 0.65;
    const dx = bx + s;
    const dy = by + bh - doorH;

    ctx.fillStyle = doorColor;
    ctx.fillRect(dx, dy, doorW, doorH);
    
    // Roll-up door slats (horizontal lines)
    ctx.strokeStyle = '#222';
    ctx.beginPath();
    for (let lx = dy + 2; lx < dy + doorH; lx += 3) {
      ctx.moveTo(dx, lx);
      ctx.lineTo(dx + doorW, lx);
    }
    ctx.stroke();

    // 5. Personnel Door
    const pDoorW = s * 1.5;
    const pDoorH = s * 2.5;
    const px = bx + bw - pDoorW - s;
    const py = by + bh - pDoorH;

    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(px, py, pDoorW, pDoorH);
    // Door frame
    ctx.strokeStyle = lightSteel;
    ctx.strokeRect(px, py, pDoorW, pDoorH);

    // 6. Single High Window
    const winS = s * 2;
    const wx = bx + bw - winS - s;
    const wy = by + s;

    ctx.fillStyle = windowColor;
    ctx.fillRect(wx, wy, winS, winS * 0.6);
    ctx.strokeStyle = lightSteel;
    ctx.strokeRect(wx, wy, winS, winS * 0.6);

    // 7. Roof Edge / Cap
    ctx.fillStyle = darkSteel;
    ctx.fillRect(bx - 1, by, bw + 2, 2);
  }
};
