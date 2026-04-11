import type { VectorEntity } from '../../SpriteTypes';

/**
 * BrickSawtoothFactory_01: A Level 2 Industrial building.
 * A classic industrial structure featuring the iconic sawtooth roofline
 * for natural lighting, circular upper windows, and a raised loading dock.
 */
export const BrickSawtoothFactory_01: VectorEntity = {
  id: 'BrickSawtoothFactory_01',
  type: 'ZONE_3_2', // Industrial Level 2
  tags: ['industrial', 'organic', 'brick', 'classic'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.max(1, Math.floor(ts * 0.08));
    
    // Dimensions
    const bx = inset;
    const by = inset + s * 2.5;
    const bw = ts - inset * 2;
    const bh = ts - by - inset;

    // Colors
    const brickColor = '#b24d3d'; // Warmer, slightly more red brick
    const darkerBrick = '#8b3a2b';
    const roofColor = '#4a4a4a';
    const glassColor = 'rgba(100, 130, 160, 0.7)';
    const concreteColor = '#888';

    // 1. Foundation / Loading Dock Area
    ctx.fillStyle = concreteColor;
    ctx.fillRect(0, ts * 0.8, ts, ts * 0.2);
    // Loading dock steps/details
    ctx.fillStyle = '#666';
    ctx.fillRect(bx + bw * 0.1, ts * 0.8, bw * 0.3, 2);

    // 2. Main Brick Body
    ctx.fillStyle = brickColor;
    ctx.fillRect(bx, by, bw, bh);

    // 3. Sawtooth Roof
    // Three jagged teeth pointing towards the "light" (left)
    ctx.fillStyle = roofColor;
    const teethCount = 3;
    const toothW = bw / teethCount;
    for (let i = 0; i < teethCount; i++) {
      const tx = bx + i * toothW;
      ctx.beginPath();
      ctx.moveTo(tx, by);
      ctx.lineTo(tx, by - s * 1.5); // Vertical part (usually glass)
      ctx.lineTo(tx + toothW, by); // Sloped part
      ctx.closePath();
      ctx.fill();

      // Glass on the vertical part of the sawtooth
      ctx.fillStyle = glassColor;
      ctx.fillRect(tx + 1, by - s * 1.2, 2, s * 0.8);
      ctx.fillStyle = roofColor;
    }

    // 4. Circular Window (Clerestory style)
    // Only one window on the left side to avoid collision with the arch
    ctx.fillStyle = glassColor;
    const circleR = Math.floor(s * 0.8);
    const cx = Math.floor(bx + bw * 0.25);
    const cy = Math.floor(by + bh * 0.3);
    ctx.beginPath();
    ctx.arc(cx, cy, circleR, 0, Math.PI * 2);
    ctx.fill();
    // Window frame
    ctx.strokeStyle = darkerBrick;
    ctx.lineWidth = 1;
    ctx.stroke();

    // 5. Arched Entryway / Loading Bay
    const bayW = Math.floor(bw * 0.45);
    const bayH = Math.floor(bh * 0.55);
    const bayX = Math.floor(bx + bw * 0.5);
    const bayY = Math.floor(by + bh - bayH);
    const radius = Math.floor(bayW / 2);
    const centerX = bayX + radius;

    // Entryway Path
    ctx.beginPath();
    ctx.moveTo(bayX, Math.floor(by + bh));
    ctx.lineTo(bayX, bayY);
    ctx.arc(centerX, bayY, radius, Math.PI, 0, false);
    ctx.lineTo(bayX + radius * 2, Math.floor(by + bh));
    
    // Fill the interior
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();

    // Arch brick detail / Outline
    ctx.strokeStyle = darkerBrick;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 6. Brick texture lines (Horizontal only for brevity, distinct from the other factory)
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 0.5;
    for (let y = by + 3; y < by + bh; y += 3) {
      ctx.beginPath();
      ctx.moveTo(bx, y);
      ctx.lineTo(bx + bw, y);
      ctx.stroke();
    }
  }
};
