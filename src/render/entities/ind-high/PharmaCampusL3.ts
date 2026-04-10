import type { VectorEntity } from '../../SpriteTypes';

/**
 * PharmaCampusL3_01: A Level 3 Industrial building.
 * A grand pharmaceutical research and development campus.
 * Features interconnected modernist wings, sleek glass facades,
 * and professional lab-grade rooftop ventilation.
 */
export const PharmaCampusL3_01: VectorEntity = {
  id: 'PharmaCampusL3_01',
  type: 'ZONE_3_3', // Industrial Level 3
  tags: ['industrial', 'corporate', 'high-tech', 'pharma', 'grand'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.max(1, Math.floor(ts * 0.05));
    
    // Colors
    const wallColor = '#ffffff'; // Pristine white
    const glassColor = 'rgba(80, 160, 240, 0.8)'; // Corporate blue glass
    const metalColor = '#cbd5e0'; // Light aluminum
    const accentColor = '#2b6cb0'; // Deep professional blue

    // 1. Foundation / Modern Plinth
    ctx.fillStyle = '#4a5568';
    ctx.fillRect(0, ts * 0.85, ts, ts * 0.15);
    
    // 2. Three Interconnected Wings (Modernist Composition)
    
    // Wing A: Tall Research Tower (Center-Right)
    const towerW = ts * 0.35;
    const towerH = ts * 0.75;
    const towerX = ts * 0.55;
    const towerY = ts * 0.85 - towerH;
    
    // Wing B: Main Lab Block (Center-Left)
    const labW = ts * 0.45;
    const labH = ts * 0.5;
    const labX = ts * 0.15;
    const labY = ts * 0.85 - labH;
    
    // Wing C: Admin/Entrance (Far Left - Low)
    const adminW = ts * 0.25;
    const adminH = ts * 0.25;
    const adminX = inset;
    const adminY = ts * 0.85 - adminH;

    // Draw Buildings
    ctx.fillStyle = wallColor;
    ctx.fillRect(adminX, adminY, adminW, adminH);
    ctx.fillRect(labX, labY, labW, labH);
    ctx.fillRect(towerX, towerY, towerW, towerH);

    // 3. Ribbon Windows (Sleek professional look)
    ctx.fillStyle = glassColor;
    
    // Tower Ribbon Windows
    for (let i = 0; i < 4; i++) {
        ctx.fillRect(towerX + 4, towerY + s + i * (s * 1.5), towerW - 8, s * 0.8);
    }
    
    // Lab Windows (Larger, more technical)
    ctx.fillRect(labX + 4, labY + s, labW - 8, s * 2);
    ctx.fillRect(labX + 4, labY + s * 4, labW - 8, s * 0.5);

    // 4. Rooftop Lab Infrastructure (Technical, not sci-fi)
    ctx.fillStyle = metalColor;
    
    // HVAC units on Lab wing
    ctx.fillRect(labX + s, labY - s, s * 2, s);
    ctx.fillRect(labX + labW - s * 3, labY - s, s * 2, s);
    
    // Tapered exhaust stacks on Tower
    ctx.fillStyle = '#a0aec0';
    for (let i = 0; i < 2; i++) {
        const sx = towerX + s + i * (s * 2);
        const sy = towerY - s * 1.5;
        ctx.fillRect(sx, sy, 2, s * 1.5);
        ctx.fillRect(sx - 1, sy - 1, 4, 2); // Cap
    }

    // 5. Corporate Details
    ctx.fillStyle = accentColor;
    // Vertical accent on tower
    ctx.fillRect(towerX + towerW - 4, towerY, 2, towerH);
    // Subtle logo block near entrance
    ctx.fillRect(adminX + s, adminY + s, 4, 4);
    
    // 6. Connective Glass Corridor
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(labX + labW - 2, ts * 0.7, towerX - (labX + labW) + 4, s);
  }
};
