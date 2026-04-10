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
  private currentTab = 'ZONE_1_1'; // Default to R1

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'sprite-sandbox';
    this.el.style.display = 'none';
    this.el.style.position = 'fixed';
    this.el.style.top = '0';
    this.el.style.left = '0';
    this.el.style.width = '100vw';
    this.el.style.height = '100vh';
    this.el.style.backgroundColor = 'rgba(13, 27, 42, 0.98)';
    this.el.style.zIndex = '10000';
    this.el.style.color = '#fff';
    this.el.style.overflowY = 'auto';
    this.el.style.padding = '20px';
    this.el.style.fontFamily = 'monospace';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.flexDirection = 'column';
    header.style.gap = '15px';
    header.style.marginBottom = '20px';
    header.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center">
        <h2 style="margin:0">Vector Sprite Sandbox</h2>
        <button id="close-sandbox" style="padding:8px 20px; cursor:pointer; background:#e74c3c; color:#fff; border:none; border-radius:4px; font-weight:bold">CLOSE</button>
      </div>
      <div id="sandbox-tabs" style="display:flex; flex-wrap:wrap; gap:5px"></div>
    `;
    this.el.appendChild(header);

    const tabs = header.querySelector('#sandbox-tabs')!;
    const tabList = [
      { id: 'ZONE_1_1', label: 'R1' },
      { id: 'ZONE_1_2', label: 'R2' },
      { id: 'ZONE_1_3', label: 'R3' },
      { id: 'ZONE_2_1', label: 'C1' },
      { id: 'ZONE_2_2', label: 'C2' },
      { id: 'ZONE_2_3', label: 'C3' },
      { id: 'ZONE_3_1', label: 'I1' },
      { id: 'ZONE_3_2', label: 'I2' },
      { id: 'ZONE_3_3', label: 'I3' },
      { id: 'BUILDINGS', label: 'Services/Ploppables' },
      { id: 'ALL', label: 'Show All' }
    ];

    tabList.forEach(t => {
      const btn = document.createElement('button');
      btn.textContent = t.label;
      btn.style.padding = '6px 12px';
      btn.style.cursor = 'pointer';
      btn.style.background = this.currentTab === t.id ? '#3498db' : '#2c3e50';
      btn.style.color = '#fff';
      btn.style.border = 'none';
      btn.style.borderRadius = '3px';
      btn.addEventListener('click', () => {
        this.currentTab = t.id;
        Array.from(tabs.querySelectorAll('button')).forEach(b => {
          b.style.background = '#2c3e50';
        });
        btn.style.background = '#3498db';
        this.render();
      });
      tabs.appendChild(btn);
    });

    const grid = document.createElement('div');
    grid.id = 'sandbox-grid';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
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
      this.el.style.display = 'block';
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

    let entities = SpriteRegistry.instance.getAllEntities();
    
    if (this.currentTab === 'BUILDINGS') {
      entities = entities.filter(e => e.type.startsWith('BUILDING_'));
    } else if (this.currentTab !== 'ALL') {
      entities = entities.filter(e => e.type === this.currentTab);
    }

    if (entities.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:40px; color:#888">No sprites found for this category.</div>';
      return;
    }

    const p = resolvePalette({ egalitarian: 0, green: 0, planned: 0 }, BALANCE.character.axisMax);
    const vibe = { egalitarian: 0, green: 0, planned: 0, isNight: false };

    entities.forEach(entity => {
      const card = document.createElement('div');
      card.style.border = '1px solid #333';
      card.style.padding = '15px';
      card.style.backgroundColor = '#1a1a1a';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'center';
      card.style.borderRadius = '5px';

      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      canvas.style.border = '1px solid #444';
      canvas.style.marginBottom = '10px';
      canvas.style.backgroundColor = '#000';
      
      const ctx = canvas.getContext('2d')!;
      
      const label = document.createElement('div');
      label.style.fontSize = '11px';
      label.style.textAlign = 'center';
      label.style.width = '100%';
      label.innerHTML = `
        <div style="font-weight:bold; color:#fff; margin-bottom:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${entity.id}</div>
        <div style="color:#3498db; margin-bottom:4px">${entity.type}</div>
        <div style="color:#888; font-style:italic">${entity.tags.join(', ')}</div>
      `;

      card.appendChild(canvas);
      card.appendChild(label);
      grid.appendChild(card);

      let startTime = Date.now();
      const animate = () => {
        if (!this.visible || grid.parentElement !== this.el) return;
        if (!document.body.contains(card)) return; // Stop if card was removed

        const now = (Date.now() - startTime) * 0.001;
        
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#1a1a1a';
        for(let y=0; y<16; y++) for(let x=0; x<16; x++) if((x+y)%2===0) ctx.fillRect(x*8, y*8, 8, 8);
        
        ctx.save();
        ctx.scale(4, 4); // Scale up more for better visibility
        entity.draw(ctx, 32, now, p, vibe);
        ctx.restore();
        requestAnimationFrame(animate);
      };
      animate();
    });
  }
}
