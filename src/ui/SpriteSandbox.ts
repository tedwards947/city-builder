import { SpriteRegistry } from '../render/SpriteRegistry';
import { resolvePalette } from '../render/CharacterPalette';
import { BALANCE } from '../data/balance';
import type { World } from '../sim/World';

/**
 * A UI component for reviewing all registered vector sprites.
 */
export class SpriteSandbox {
  private el: HTMLElement;
  private visible = false;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'sprite-sandbox';
    this.el.style.display = 'none'; // Start hidden
    this.el.style.position = 'fixed';
    this.el.style.top = '0';
    this.el.style.left = '0';
    this.el.style.width = '100vw';
    this.el.style.height = '100vh';
    this.el.style.backgroundColor = 'rgba(13, 27, 42, 0.95)';
    this.el.style.zIndex = '10000';
    this.el.style.color = '#fff';
    this.el.style.overflowY = 'auto';
    this.el.style.padding = '20px';
    // Removed display: flex from here so it doesn't override the hidden state

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.marginBottom = '20px';
    header.innerHTML = `
      <h2 style="margin:0">Vector Sprite Sandbox</h2>
      <button id="close-sandbox" style="padding:5px 15px; cursor:pointer; background:#444; color:#fff; border:none; border-radius:3px">Close</button>
    `;
    this.el.appendChild(header);

    const grid = document.createElement('div');
    grid.id = 'sandbox-grid';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
    grid.style.gap = '20px';
    this.el.appendChild(grid);

    document.body.appendChild(this.el);

    header.querySelector('#close-sandbox')!.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setVisible(false);
    });
  }

  setVisible(v: boolean): void {
    this.visible = v;
    if (v) {
      this.el.style.display = 'flex';
      this.el.style.flexDirection = 'column';
      this.render();
    } else {
      this.el.style.display = 'none';
    }
  }

  toggle(): void {
    this.setVisible(!this.visible);
  }

  render(): void {
    const grid = this.el.querySelector('#sandbox-grid')!;
    grid.innerHTML = '';

    const entities = SpriteRegistry.instance.getAllEntities();
    const p = resolvePalette({ egalitarian: 0, green: 0, planned: 0 }, BALANCE.character.axisMax);
    const vibe = { egalitarian: 0, green: 0, planned: 0, isNight: false };

    entities.forEach(entity => {
      const card = document.createElement('div');
      card.style.border = '1px solid #333';
      card.style.padding = '10px';
      card.style.backgroundColor = '#1a1a1a';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'center';

      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      canvas.style.border = '1px solid #444';
      canvas.style.marginBottom = '10px';
      canvas.style.backgroundColor = '#000';
      
      const ctx = canvas.getContext('2d')!;
      // Draw a checkerboard background for transparency testing
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#222';
      for(let y=0; y<8; y++) for(let x=0; x<8; x++) if((x+y)%2===0) ctx.fillRect(x*8, y*8, 8, 8);

      ctx.save();
      ctx.scale(2, 2); // Zoom in
      entity.draw(ctx, 32, 0, p, vibe);
      ctx.restore();

      const label = document.createElement('div');
      label.style.fontSize = '12px';
      label.style.textAlign = 'center';
      label.innerHTML = `
        <strong>${entity.id}</strong><br>
        <span style="color:#888">${entity.type}</span>
      `;

      card.appendChild(canvas);
      card.appendChild(label);
      grid.appendChild(card);

      // Start an animation loop for this canvas
      let startTime = Date.now();
      const animate = () => {
        if (!this.visible) return;
        const now = (Date.now() - startTime) * 0.001;
        ctx.clearRect(0, 0, 64, 64);
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = '#222';
        for(let y=0; y<8; y++) for(let x=0; x<8; x++) if((x+y)%2===0) ctx.fillRect(x*8, y*8, 8, 8);
        
        ctx.save();
        ctx.scale(2, 2);
        entity.draw(ctx, 32, now, p, vibe);
        ctx.restore();
        requestAnimationFrame(animate);
      };
      animate();
    });
  }
}
