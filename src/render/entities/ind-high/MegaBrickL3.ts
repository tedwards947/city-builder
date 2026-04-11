import type { VectorEntity } from '../../SpriteTypes';

/**
 * MegaBrickL3_01: A Level 3 Industrial building.
 * A massive multi-wing brick complex with central towers, 
 * decorative masonry, and extensive vertical piping.
 */
export const MegaBrickL3_01: VectorEntity = {
  id: 'MegaBrickL3_01',
  type: 'ZONE_3_3', // Industrial Level 3
  tags: ['industrial', 'organic', 'brick', 'grand'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.max(1, Math.floor(ts * 0.05));
    
    // Colors
    const brickColor = '#903020';
    const darkerBrick = '#602010';
    const windowColor = 'rgba(30, 40, 50, 0.9)';
    const pipeColor = '#606060';

    // 1. Foundation
    ctx.fillStyle = '#333';
    ctx.fillRect(0, ts * 0.85, ts, ts * 0.15);

    // 2. Main Complex Body
    ctx.fillStyle = brickColor;
    const bx = inset, bw = ts - inset * 2;
    // Central Main Block
    ctx.fillRect(bx + bw * 0.2, ts * 0.2, bw * 0.6, ts * 0.65);
    // Side Wings
    ctx.fillRect(bx, ts * 0.4, bw * 0.25, ts * 0.45);
    ctx.fillRect(bx + bw * 0.75, ts * 0.4, bw * 0.25, ts * 0.45);

    // 3. Decorative Masonry (Cornice/Arch)
    ctx.fillStyle = darkerBrick;
    ctx.fillRect(bx + bw * 0.2 - 2, ts * 0.2, bw * 0.6 + 4, 3);
    // Large Arch Window in Center
    ctx.fillStyle = windowColor;
    const archW = bw * 0.3;
    const archX = bx + bw * 0.5 - archW / 2;
    ctx.beginPath();
    ctx.moveTo(archX, ts * 0.5);
    ctx.arc(archX + archW / 2, ts * 0.5, archW / 2, Math.PI, 0);
    ctx.lineTo(archX + archW, ts * 0.7);
    ctx.lineTo(archX, ts * 0.7);
    ctx.fill();

    // 4. Window Grid (Side Wings)
    const rows = 3, cols = 2;
    for (let i = 0; i < 2; i++) { // For each wing
        const wx = (i === 0) ? bx + 2 : bx + bw * 0.75 + 2;
        const ww = bw * 0.25 - 4;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                ctx.fillRect(wx + c * (ww / 2.5), ts * 0.45 + r * (ts * 0.1), ww / 4, ts * 0.06);
            }
        }
    }

    // 5. Heavy Pipes (Foreground)
    ctx.fillStyle = pipeColor;
    const pipeX = [bx + bw * 0.1, bx + bw * 0.9];
    pipeX.forEach(px => {
        ctx.fillRect(px, ts * 0.1, 2, ts * 0.75);
        // Joints
        ctx.fillStyle = '#222';
        for (let y = ts * 0.2; y < ts * 0.8; y += ts * 0.15) {
            ctx.fillRect(px - 1, y, 4, 2);
        }
        ctx.fillStyle = pipeColor;
    });
  }
};
