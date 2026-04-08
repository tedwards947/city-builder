// All world→screen coordinate conversion goes through here.
// Top-down now; swapping to isometric means changing these two functions
// and adding a depth sort — nothing else changes.

export const TILE_SIZE = 16; // base pixels per tile before zoom

export const Projection = {
  tileToWorld(tx: number, ty: number): { x: number; y: number } {
    return { x: tx * TILE_SIZE, y: ty * TILE_SIZE };
  },
  // Primitive variants — no allocation, use in hot render loops.
  tileToWorldX(tx: number): number { return tx * TILE_SIZE; },
  tileToWorldY(ty: number): number { return ty * TILE_SIZE; },
  worldToTile(wx: number, wy: number): { tx: number; ty: number } {
    return { tx: Math.floor(wx / TILE_SIZE), ty: Math.floor(wy / TILE_SIZE) };
  },
  worldToTileX(wx: number): number { return Math.floor(wx / TILE_SIZE); },
  worldToTileY(wy: number): number { return Math.floor(wy / TILE_SIZE); },
  // Depth key — 0 for top-down; (tx+ty) for iso. Call site is already in place.
  depth(_tx: number, _ty: number): number { return 0; },
};
