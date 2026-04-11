import type { VectorEntity } from '../../SpriteTypes';

/**
 * SemiconductorFab_01: A Level 2 Industrial building.
 * A massive high-tech semiconductor fabrication plant (Fab).
 * Features a monolithic windowless cleanroom structure, 
 * extensive roof-mounted air filtration, and chemical handling pipes.
 */
export const SemiconductorFab_01: VectorEntity = {
  id: 'SemiconductorFab_01',
  type: 'ZONE_3_2', // Industrial Level 2
  tags: ['industrial', 'high-tech', 'cleanroom', 'semiconductor'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.max(1, Math.floor(ts * 0.05));
    
    // Dimensions - A large, wide building
    const bx = inset;
    const by = inset + s * 3;
    const bw = ts - inset * 2;
    const bh = ts - by - inset;

    // Colors
    const panelColor = '#d0d0e0'; // Cool metallic silver/blue
    const darkMetal = '#505060';
    const pipeColor = '#b0b0c0';
    const lightMetal = '#f0f0ff';
    const accentColor = '#00aaff'; // Tech blue

    // 1. Foundation (Massive concrete base for vibration isolation)
    ctx.fillStyle = '#444';
    ctx.fillRect(0, ts * 0.85, ts, ts * 0.15);

    // 2. Main Building Body (Monolithic)
    ctx.fillStyle = panelColor;
    ctx.fillRect(bx, by, bw, bh);

    // 3. Facade Panel Details
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 0.5;
    // Large vertical panel seams
    for (let x = bx + bw / 4; x < bx + bw; x += bw / 4) {
      ctx.beginPath();
      ctx.moveTo(Math.floor(x), by);
      ctx.lineTo(Math.floor(x), by + bh);
      ctx.stroke();
    }

    // 4. Massive Air Filtration Units (Roof)
    // Semiconductor fabs require insane amounts of air handling
    ctx.fillStyle = darkMetal;
    const unitW = bw / 3 - 2;
    const unitH = s * 2.5;
    for (let i = 0; i < 3; i++) {
      const ux = bx + 1 + i * (unitW + 2);
      const uy = by - unitH + 1;
      
      // Base unit
      ctx.fillRect(ux, uy, unitW, unitH);
      
      // Top fans/vents
      ctx.fillStyle = '#333';
      ctx.fillRect(ux + 2, uy - 1, unitW - 4, 1);
      ctx.fillStyle = darkMetal;
    }

    // 5. External Chemical/Gas Piping
    // Specialized pipes running along the side/top
    ctx.strokeStyle = pipeColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // High horizontal pipe
    ctx.moveTo(bx - 1, by + s);
    ctx.lineTo(bx + bw + 1, by + s);
    // Vertical drop
    ctx.moveTo(bx + bw * 0.8, by + s);
    ctx.lineTo(bx + bw * 0.8, by + bh);
    ctx.stroke();

    // Valve/Manifold details
    ctx.fillStyle = accentColor;
    ctx.fillRect(bx + bw * 0.78, by + s * 2, 4, 2);

    // 6. High-Tech Entryway (Small, sealed)
    const doorW = s * 2;
    const doorH = s * 3;
    const dx = bx + s;
    const dy = by + bh - doorH;
    
    // Glowing blue "airlock" door
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(dx, dy, doorW, doorH);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(dx, dy, doorW, doorH);
    
    // Digital sign / Status light
    ctx.fillStyle = accentColor;
    ctx.fillRect(dx + 2, dy + 2, doorW - 4, 1);
  }
};
