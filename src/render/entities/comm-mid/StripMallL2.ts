import type { VectorEntity } from '../../SpriteTypes';
import { t } from '../../../i18n';

/**
 * StripMallL2: A Level 2 Commercial building.
 * A wide single-story shopping center with three distinct storefronts,
 * shared parking, and integrated signage.
 */
export const StripMallL2: VectorEntity = {
  id: 'StripMallL2',
  type: 'ZONE_2_2', // Commercial Level 2
  tags: ['corporate', 'planned', 'retail'],
  draw: (ctx, ts, t, p, vibe) => {
    const s = ts * 0.1;
    const inset = Math.floor(ts * 0.05);
    
    // 1. Foundation / Large Parking Lot
    ctx.fillStyle = '#333';
    ctx.fillRect(0, Math.floor(ts * 0.7), ts, Math.floor(ts * 0.3));
    // Parking spaces
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    for (let x = 6; x < ts; x += 10) {
        ctx.fillRect(x, Math.floor(ts * 0.75), 1, Math.floor(ts * 0.2));
    }

    // 2. Main Building Structure (Wide)
    const bw = ts - inset * 2;
    const bh = Math.floor(ts * 0.45);
    const bx = inset;
    const by = Math.floor(ts * 0.7 - bh);

    ctx.fillStyle = '#e2e8f0'; // Light grey concrete
    ctx.fillRect(bx, by, bw, bh);

    // 3. Three Distinct Storefront Sections
    const sectionW = Math.floor(bw / 3);
    const storeColors = ['#f7fafc', '#edf2f7', '#f7fafc'];
    
    for (let i = 0; i < 3; i++) {
        const sx = bx + i * sectionW;
        ctx.fillStyle = storeColors[i];
        ctx.fillRect(sx + 1, by + 2, sectionW - 2, bh - 2);
        
        // Windows
        ctx.fillStyle = 'rgba(129, 212, 250, 0.5)';
        ctx.fillRect(sx + 4, by + Math.floor(bh * 0.3), sectionW - 8, Math.floor(bh * 0.4));
        
        // Doors
        ctx.fillStyle = '#2d3748';
        ctx.fillRect(sx + Math.floor(sectionW * 0.4), by + Math.floor(bh * 0.7), Math.floor(sectionW * 0.2), Math.floor(bh * 0.3));
    }

    // 4. Common Roof Ledge / Signage Area
    ctx.fillStyle = '#4a5568';
    ctx.fillRect(bx - 2, by - 2, bw + 4, Math.floor(s * 1.5));
    
    // 5. Multiple Small Brand Signs
    const brands = ['B-Mart', 'Pizza', 'Byte'];
    for (let i = 0; i < 3; i++) {
        const sx = bx + i * sectionW + Math.floor(sectionW * 0.1);
        const sy = by - Math.floor(s * 2.5);
        const sw = Math.floor(sectionW * 0.8);
        const sh = Math.floor(s * 2);
        
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx, sy, sw, sh);
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(sx, sy, sw, sh);
        
        // Brand Text (Small)
        ctx.fillStyle = '#000';
        ctx.font = `bold ${Math.floor(s * 0.8)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(brands[i], sx + sw / 2, sy + sh / 2 + 1);
    }

    // 6. Sidewalk Detail
    ctx.fillStyle = '#a0aec0';
    ctx.fillRect(bx - 2, by + bh, bw + 4, 4);
  }
};
