import type { VectorEntity } from '../../SpriteTypes';

/**
 * MegaFabL3_01: A Level 3 Industrial building.
 * A massive, high-tech semiconductor "Giga-Fab".
 * Features a structured, tiered architecture with symmetrical air-handling 
 * systems and organized industrial infrastructure.
 */
export const MegaFabL3_01: VectorEntity = {
  id: 'MegaFabL3_01',
  type: 'ZONE_3_3', // Industrial Level 3
  tags: ['industrial', 'high-tech', 'cleanroom', 'semiconductor', 'grand'],
  draw: (ctx, ts, t, p, _vibe) => {
    const s = ts * 0.1;
    const inset = Math.max(1, Math.floor(ts * 0.05));
    
    // Colors
    const wallColor = '#f0f4f8'; // Pristine light grey/white
    const panelLineColor = 'rgba(0, 0, 0, 0.08)';
    const darkMetal = '#2d3748';
    const blueGlass = 'rgba(66, 153, 225, 0.6)';
    const accentColor = '#3182ce';

    // 1. Foundation / Heavy Base
    ctx.fillStyle = '#1a202c';
    ctx.fillRect(0, Math.floor(ts * 0.85), ts, Math.floor(ts * 0.15));

    // 2. Lower Fabrication Level (Massive Footprint)
    const lw = Math.floor(ts - inset * 2);
    const lh = Math.floor(ts * 0.4);
    const lx = inset;
    const ly = Math.floor(ts * 0.85 - lh);

    ctx.fillStyle = wallColor;
    ctx.fillRect(lx, ly, lw, lh);

    // Vertical Panel Lines
    ctx.strokeStyle = panelLineColor;
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
        const px = Math.floor(lx + i * (lw / 6));
        ctx.beginPath();
        ctx.moveTo(px, ly);
        ctx.lineTo(px, ly + lh);
        ctx.stroke();
    }

    // 3. Upper Mechanical Level (Recessed)
    const uw = Math.floor(lw * 0.8);
    const uh = Math.floor(ts * 0.2);
    const ux = Math.floor(ts * 0.5 - uw / 2);
    const uy = Math.floor(ly - uh);

    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(ux, uy, uw, uh);
    
    // 4. Rooftop Air Filtration Units (Symmetrical row)
    ctx.fillStyle = darkMetal;
    const unitCount = 4;
    const unitW = Math.floor(uw / (unitCount + 1));
    const unitH = Math.floor(s * 1.5);
    
    for (let i = 0; i < unitCount; i++) {
        const ax = Math.floor(ux + (i + 1) * (uw / (unitCount + 1)) - unitW / 2);
        const ay = Math.floor(uy - unitH);
        
        // Main Unit
        ctx.fillRect(ax, ay, unitW, unitH);
        
        // Top Exhaust Port
        ctx.fillStyle = '#4a5568';
        ctx.fillRect(ax + Math.floor(unitW * 0.2), ay - 2, Math.floor(unitW * 0.6), 3);
        ctx.fillStyle = darkMetal;
    }

    // 5. Organized Pipe Bundles (Running along levels)
    ctx.strokeStyle = '#a0aec0';
    ctx.lineWidth = 2;
    // Lower bundle
    ctx.beginPath();
    ctx.moveTo(lx, ly + Math.floor(lh * 0.3));
    ctx.lineTo(lx + lw, ly + Math.floor(lh * 0.3));
    ctx.stroke();
    // Connectors
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
        const cx = Math.floor(lx + (i + 1) * (lw / 4));
        ctx.beginPath();
        ctx.moveTo(cx, ly + Math.floor(lh * 0.3));
        ctx.lineTo(cx, ly);
        ctx.stroke();
    }

    // 6. Corporate High-Tech Entrance (Symmetrical center)
    const doorW = Math.floor(ts * 0.2);
    const doorH = Math.floor(s * 2.5);
    const dx = Math.floor(ts * 0.5 - doorW / 2);
    const dy = Math.floor(ts * 0.85 - doorH);

    ctx.fillStyle = darkMetal;
    ctx.fillRect(dx, dy, doorW, doorH);
    // Blue glow glass door
    ctx.fillStyle = blueGlass;
    ctx.fillRect(dx + 2, dy + 2, doorW - 4, doorH - 2);
    
    // Corporate vertical fin
    ctx.fillStyle = accentColor;
    ctx.fillRect(Math.floor(ts * 0.5 - 1), uy, 2, Math.floor(uh + lh));
  }
};
