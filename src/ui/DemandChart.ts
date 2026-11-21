// Demand sparkline chart.
// Draws three small history lines (R/C/I demand) onto a canvas element.
// Sampling happens once per world tick; the chart stores the last 60 samples.

const MAX_SAMPLES = 60;
const Y_MIN = 0.25;
const Y_MAX = 2.0;

// Zone colours match CanvasRenderer
const COLOR_R = '#6fd86f';
const COLOR_C = '#8faee0';
const COLOR_I  = '#e0b060';

interface Sample { r: number; c: number; i: number }

export class DemandChart {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly buf: Sample[] = [];
  private lastTick = -1;
  // The canvas size, read when it changes (not every frame), and whether a redraw is due.
  private cssW = 0;
  private cssH = 0;
  private dirty = true;

  constructor() {
    this.canvas = document.getElementById('demand-chart') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this._measure();
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this._measure()).observe(this.canvas);
    window.addEventListener('resize', () => this._measure()); // also catches a zoom (devicePixelRatio) change
  }

  private _measure(): void {
    this.cssW = this.canvas.offsetWidth;
    this.cssH = this.canvas.offsetHeight;
    this.dirty = true;
  }

  /** Call every render frame; only records a new sample when the tick advances. */
  update(tick: number, r: number, c: number, i: number): void {
    if (tick !== this.lastTick) {
      this.lastTick = tick;
      this.buf.push({ r, c, i });
      if (this.buf.length > MAX_SAMPLES) this.buf.shift();
      this.dirty = true;
    }
    if (!this.dirty) return;
    this.dirty = false;
    this._draw();
  }

  private _draw(): void {
    const canvas = this.canvas;
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const W = this.cssW * dpr;
    const H = this.cssH * dpr;

    // Sync backing store size if needed
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width  = W;
      canvas.height = H;
    }

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.0)';
    ctx.fillRect(0, 0, W, H);

    const n = this.buf.length;
    if (n === 0) return;

    const toY = (v: number) => H - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * H;

    // Neutral line at demand = 1.0
    const neutralY = toY(1.0);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = dpr;
    ctx.setLineDash([3 * dpr, 3 * dpr]);
    ctx.beginPath();
    ctx.moveTo(0, neutralY);
    ctx.lineTo(W, neutralY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw a line for each zone type
    const lines: [keyof Sample, string][] = [
      ['r', COLOR_R],
      ['c', COLOR_C],
      ['i', COLOR_I],
    ];

    for (const [key, color] of lines) {
      ctx.strokeStyle = color;
      ctx.lineWidth = dpr * 1.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let idx = 0; idx < n; idx++) {
        const x = (idx / (MAX_SAMPLES - 1)) * W;
        const y = toY(this.buf[idx][key]);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
}
