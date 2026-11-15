// What the static chunk layer looks like: terrain, roads, the flat buildings
// under the clay sprites, status tints and pollution. ChunkCache decides WHEN a
// chunk is redrawn; this file decides WHAT is drawn, and `chunkSignature` says
// which changes in the world change that picture.

import type { World } from '../sim/World';
import { CHUNK_SIZE } from '../sim/Grid';
import { resolveTilePalette } from './CharacterPalette';
import { drawClayRoad } from './clay/roads';
import { drawnRoadAt, drawnRoadsAround } from './drawnRoads';
import { drawFlatTree, drawFlatZoneBuilding, drawFlatBuilding } from './flatTiles';
import { BALANCE } from '../data/balance';
import {
  TERRAIN_GRASS, TERRAIN_WATER,
  ZONE_NONE, ROAD_NONE, VEG_NONE, BUILDING_NONE,
} from '../sim/constants';
import type { ChunkPainter } from './ChunkCache';

/** Tile size (px) from which trees are clay sprites drawn per frame; below it they are flat marks in the chunk layer. */
export const CLAY_TREE_MIN_TILE = 8;

// Pollution haze colour by layer value (0–255).
const _pollutionColors: string[] = Array.from({ length: 256 }, (_, v) => {
  const alpha = Math.min(0.65, (v / 255) * 0.85);
  return `rgba(160,80,0,${alpha.toFixed(3)})`;
});

/**
 * Hash of everything `paintChunk` reads for one chunk. Values are reduced
 * to what is actually drawn (palette buckets, marker thresholds), so sim
 * noise that does not change the picture does not change the signature.
 * KEEP IN SYNC with `paintChunk`: a layer read there must be mixed in here
 * (chunkPainter.test.ts fails if one is missing).
 */
export function chunkSignature(world: World, cx: number, cy: number): number {
  const L = world.layers;
  const { width, height } = world.grid;
  const x0 = cx * CHUNK_SIZE, y0 = cy * CHUNK_SIZE;
  const x1 = Math.min(x0 + CHUNK_SIZE, width), y1 = Math.min(y0 + CHUNK_SIZE, height);
  let h = 0x811c9dc5 | 0;

  for (let ty = y0; ty < y1; ty++) {
    for (let i = ty * width + x0, end = ty * width + x1; i < end; i++) {
      const terrain = L.terrain[i], zone = L.zone[i], dev = L.devLevel[i];
      const a = terrain | (zone << 4) | (L.roadClass[i] << 8) | (L.building[i] << 12)
              | (L.vegetation[i] << 20) | (dev << 24);
      // Same bucketing as resolveTilePalette.
      const b = Math.round(L.vibeEgalitarian[i] / 12) | (Math.round(L.vibeGreen[i] / 12) << 5)
              | (Math.round(L.vibePlanned[i] / 12) << 10)
              | (L.power[i] !== 0 ? 1 << 15 : 0) | (L.water[i] !== 0 ? 1 << 16 : 0)
              | (L.sewage[i] !== 0 ? 1 << 17 : 0) | (L.services[i] !== 0 ? 1 << 18 : 0)
              | (L.abandoned[i] !== 0 ? 1 << 19 : 0) | (L.visualVariant[i] << 20);
      const pollution = L.pollution[i] > 8 && terrain !== TERRAIN_WATER ? L.pollution[i] : 0;
      // Crime, sickness and deaths are not drawn into chunks any more (they
      // are per-frame badges and pins), so they are not part of the signature.
      const c = pollution;
      h = Math.imul(h ^ a, 0x9e3779b1); h ^= h >>> 15;
      h = Math.imul(h ^ b, 0x85ebca6b); h ^= h >>> 13;
      h = Math.imul(h ^ c, 0xc2b2ae35); h ^= h >>> 16;
    }
  }

  // A road tile is drawn from its neighbours' classes, and a neighbour's
  // drawn class depends on its own neighbours (see drawnRoadClass), so the
  // two rings of tiles just outside the chunk matter too.
  const R = L.roadClass;
  const at = (tx: number, ty: number): number => (tx >= 0 && ty >= 0 && tx < width && ty < height ? R[ty * width + tx] : 0);
  let ring = 0;
  for (let d = 1; d <= 2; d++) {
    for (let tx = x0 - 1; tx <= x1; tx++) ring = (Math.imul(ring, 31) + (at(tx, y0 - d) | at(tx, y1 + d - 1) << 2)) | 0;
    for (let ty = y0; ty < y1; ty++) ring = (Math.imul(ring, 31) + (at(x0 - d, ty) | at(x1 + d - 1, ty) << 2)) | 0;
  }
  h = Math.imul(h ^ ring, 0x9e3779b1);
  return h ^ (h >>> 15);
}

/** Draws chunk (cx, cy) into its own canvas at `ts` pixels per tile. */
export function paintChunk(chunkCtx: CanvasRenderingContext2D, world: World, cx: number, cy: number, ts: number): void {
  const tileX0 = cx * CHUNK_SIZE;
  const tileY0 = cy * CHUNK_SIZE;

  // Fill background with a localized grass color to avoid gaps between tiles/chunks
  const basePalette = resolveTilePalette(
      world.layers.vibeEgalitarian[world.grid.idx(tileX0, tileY0)],
      world.layers.vibeGreen[world.grid.idx(tileX0, tileY0)],
      world.layers.vibePlanned[world.grid.idx(tileX0, tileY0)],
      BALANCE.character.axisMax
  );
  chunkCtx.fillStyle = basePalette.grass;
  chunkCtx.fillRect(0, 0, chunkCtx.canvas.width, chunkCtx.canvas.height);

  chunkCtx.globalAlpha = 1.0;
  chunkCtx.imageSmoothingEnabled = false;

  for (let ty = tileY0; ty < tileY0 + CHUNK_SIZE && ty < world.grid.height; ty++) {
    for (let tx = tileX0; tx < tileX0 + CHUNK_SIZE && tx < world.grid.width; tx++) {
      const i = world.grid.idx(tx, ty);
      const terrain = world.layers.terrain[i];
      
      // Resolve localized palette for this tile
      const localP = resolveTilePalette(
          world.layers.vibeEgalitarian[i],
          world.layers.vibeGreen[i],
          world.layers.vibePlanned[i],
          BALANCE.character.axisMax
      );

      const sxi = Math.floor((tx - tileX0) * ts);
      const syi = Math.floor((ty - tileY0) * ts);
      const exi = Math.floor((tx + 1 - tileX0) * ts);
      const eyi = Math.floor((ty + 1 - tileY0) * ts);
      
      // Draw localized terrain
      if (terrain === TERRAIN_WATER) {
          chunkCtx.fillStyle = localP.water;
      } else if (terrain === TERRAIN_GRASS) {
          chunkCtx.fillStyle = localP.grass;
      } else {
          chunkCtx.fillStyle = localP.sand;
      }
      chunkCtx.fillRect(sxi, syi, exi - sxi, eyi - syi);
    }
  }

  for (let ty = tileY0; ty < tileY0 + CHUNK_SIZE && ty < world.grid.height; ty++) {
    for (let tx = tileX0; tx < tileX0 + CHUNK_SIZE && tx < world.grid.width; tx++) {
      const i = world.grid.idx(tx, ty);
      
      // Resolve localized palette again for building pass
      const localP = resolveTilePalette(
          world.layers.vibeEgalitarian[i],
          world.layers.vibeGreen[i],
          world.layers.vibePlanned[i],
          BALANCE.character.axisMax
      );

      const terrain    = world.layers.terrain[i];
      const zone       = world.layers.zone[i];
      const road       = world.layers.roadClass[i];
      const building   = world.layers.building[i];
      const vegetation = world.layers.vegetation[i];
      const dev        = world.layers.devLevel[i];
      const powered    = world.layers.power[i] !== 0;
      const watered    = world.layers.water[i] !== 0;
      const sewaged    = world.layers.sewage[i] !== 0;
      const serviced   = world.layers.services[i] !== 0;
      const pollutionV    = world.layers.pollution[i];
      const isAbandoned   = world.layers.abandoned[i] !== 0;
      const visualVariant = world.layers.visualVariant[i];

      const sxi = Math.floor((tx - tileX0) * ts);
      const syi = Math.floor((ty - tileY0) * ts);
      const tsi = Math.ceil(ts) + 1;

      // From CLAY_TREE_MIN_TILE up, trees are clay sprites drawn per frame (see CanvasRenderer).
      if (ts < CLAY_TREE_MIN_TILE && vegetation !== VEG_NONE && road === ROAD_NONE && building === BUILDING_NONE && zone === ZONE_NONE) {

        drawFlatTree(chunkCtx, vegetation, sxi, syi, tsi, ts, localP);
      }

      if (zone !== ZONE_NONE && road === ROAD_NONE && building === BUILDING_NONE) {
        drawFlatZoneBuilding(chunkCtx, zone, dev, sxi, syi, tsi, ts, localP, isAbandoned, visualVariant % 4);
      }

      if (road !== ROAD_NONE) {
        drawClayRoad(chunkCtx, drawnRoadAt(world, tx, ty), drawnRoadsAround(world, tx, ty), terrain === TERRAIN_WATER, sxi, syi, Math.ceil(ts));
      }

      if (building !== BUILDING_NONE) drawFlatBuilding(chunkCtx, building, sxi, syi, tsi, ts, localP, visualVariant);

      if (!isAbandoned && !powered && zone !== ZONE_NONE && road === ROAD_NONE && building === BUILDING_NONE) {
        chunkCtx.fillStyle = localP.noPowerTint;
        chunkCtx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2);
      }
      if (!isAbandoned && !watered && dev >= 1 && zone !== ZONE_NONE && road === ROAD_NONE && building === BUILDING_NONE) {
        chunkCtx.fillStyle = localP.noWaterTint;
        chunkCtx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2);
      }
      if (!isAbandoned && !sewaged && dev >= 2 && zone !== ZONE_NONE && road === ROAD_NONE && building === BUILDING_NONE) {
        chunkCtx.fillStyle = localP.noSewageTint;
        chunkCtx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2);
      }
      if (!isAbandoned && !serviced && dev >= 2 && zone !== ZONE_NONE && road === ROAD_NONE && building === BUILDING_NONE) {
        chunkCtx.fillStyle = localP.noServicesTint;
        chunkCtx.fillRect(sxi + 1, syi + 1, tsi - 2, tsi - 2);
      }

      if (pollutionV > 8 && terrain !== TERRAIN_WATER) {
        chunkCtx.fillStyle = _pollutionColors[pollutionV];
        chunkCtx.fillRect(sxi, syi, tsi, tsi);
      }
    }
  }
}

export const chunkPainter: ChunkPainter = { signature: chunkSignature, paint: paintChunk };
