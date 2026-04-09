import type { VectorEntity, VibeState } from '../SpriteTypes';
import type { ColorPalette } from '../CharacterPalette';

/**
 * A simple modern house used to test the new Vector Sprite system.
 */
export const TestHouse: VectorEntity = {
  id: 'res-low-test-house',
  type: 'ZONE_1_1', // ZONE_R level 1
  tags: ['green', 'residential'],
  draw(ctx: CanvasRenderingContext2D, ts: number, t: number, p: ColorPalette, vibe: VibeState): void {
    const inset = Math.max(1, Math.floor(ts * 0.25));
    const bx = 0 + inset, by = 0 + inset;
    const bw = ts - inset * 2, bh = ts - inset * 2;

    // Body
    ctx.fillStyle = p.buildingR[0];
    ctx.fillRect(bx, by, bw, bh);

    if (ts < 8) return;

    // Roof (slightly animated by 't' for fun, e.g. a slight shimmer)
    const shimmer = Math.sin(t * 5) * 5;
    ctx.fillStyle = vibe.green > 0 ? '#4a5a4a' : '#5a3a2a'; // Green roofs if city is green!
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh * 0.4);

    // Door
    ctx.fillStyle = '#3d2b1f';
    const doorW = bw * 0.25;
    const doorH = bh * 0.4;
    ctx.fillRect(bx + (bw - doorW) / 2, by + bh - doorH, doorW, doorH);

    // Smoke from chimney (if t is provided and it's a "classic" vibe)
    if (vibe.green < 0.5) {
      const chimneyX = bx + bw * 0.7;
      const chimneyY = by - 2;
      ctx.fillStyle = '#444';
      ctx.fillRect(chimneyX, chimneyY, 2, 4);

      // Procedural smoke "particles"
      const smokeCount = 3;
      for (let i = 0; i < smokeCount; i++) {
        const pt = (t + i / smokeCount) % 1.0;
        const alpha = 1.0 - pt;
        const drift = Math.sin(t * 10 + i) * 2;
        ctx.fillStyle = `rgba(150, 150, 150, ${alpha * 0.5})`;
        ctx.beginPath();
        ctx.arc(chimneyX + drift, chimneyY - pt * 10, 2 + pt * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
};
