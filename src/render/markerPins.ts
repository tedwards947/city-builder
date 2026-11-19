// Markers (sim/markers.ts) drawn as numbered pins. Called by main only with
// ?debug=true: players never see a marker.

import type { World } from '../sim/World';
import type { Camera } from './Camera';
import { TILE_SIZE } from './Projection';

const PIN = '#ff4fa3';

export function drawMarkerPins(ctx: CanvasRenderingContext2D, world: World, camera: Camera): void {
  if (world.markers.length === 0) return;
  const ts = TILE_SIZE * camera.zoom;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  world.markers.forEach((m, k) => {
    const x = camera.worldToScreenX((m.x + 0.5) * TILE_SIZE), y = camera.worldToScreenY((m.y + 0.5) * TILE_SIZE);
    if (x < -60 || y < -60 || x > camera.viewportW + 60 || y > camera.viewportH + 60) return;
    // The tile it stands on.
    ctx.strokeStyle = PIN;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - ts / 2 + 1, y - ts / 2 + 1, ts - 2, ts - 2);
    // The pin: a stem up from the tile's middle and a numbered head.
    const r = 10, top = y - 26;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, top);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, top, r, 0, Math.PI * 2);
    ctx.fillStyle = PIN;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText(String(k + 1), x, top + 0.5);
    if (m.label) {
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(m.label, x + r + 4, top + 0.5);
      ctx.fillStyle = '#fff';
      ctx.fillText(m.label, x + r + 4, top + 0.5);
      ctx.textAlign = 'center';
    }
  });
  ctx.restore();
}
