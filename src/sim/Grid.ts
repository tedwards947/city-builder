// Coordinate math and chunk dirty tracking.
// Tiles are addressed in tile-space (tx, ty). Only the renderer converts to screen pixels.
// Chunks are 16×16 groups of tiles used for dirty tracking.

export const CHUNK_SIZE = 16;

export class Grid {
  readonly width: number;
  readonly height: number;
  readonly chunkCols: number;
  readonly chunkRows: number;
  readonly dirtyChunks: Set<number>;
  private _fireCount: number = 0;
  public get fireCount(): number { return this._fireCount; }
  public set fireCount(value: number) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError('fireCount must be a non-negative finite number');
    }
    this._fireCount = value;
  }
  public get hasFires(): boolean { return this.fireCount > 0; }

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.chunkCols = Math.ceil(width / CHUNK_SIZE);
    this.chunkRows = Math.ceil(height / CHUNK_SIZE);
    this.dirtyChunks = new Set();
  }

  inBounds(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.width && ty < this.height;
  }

  idx(tx: number, ty: number): number {
    return ty * this.width + tx;
  }

  chunkIdOf(tx: number, ty: number): number {
    const cx = (tx / CHUNK_SIZE) | 0;
    const cy = (ty / CHUNK_SIZE) | 0;
    return cy * this.chunkCols + cx;
  }

  markDirty(tx: number, ty: number): void {
    this.dirtyChunks.add(this.chunkIdOf(tx, ty));
  }

  markAllDirty(): void {
    for (let i = 0; i < this.chunkCols * this.chunkRows; i++) {
      this.dirtyChunks.add(i);
    }
  }

  clearDirty(): void {
    this.dirtyChunks.clear();
  }
}
