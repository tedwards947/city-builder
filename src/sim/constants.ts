// Tile layer enums — one byte per tile per layer.

// Terrain layer
export const TERRAIN_GRASS = 0;
export const TERRAIN_WATER = 1;
export const TERRAIN_SAND  = 2;

// Zone layer
export const ZONE_NONE = 0;
export const ZONE_R    = 1;
export const ZONE_C    = 2;
export const ZONE_I    = 3;

// Road class layer
export const ROAD_NONE    = 0;
export const ROAD_STREET  = 1;
export const ROAD_AVENUE  = 2;
export const ROAD_HIGHWAY = 3;

// Building layer
export const BUILDING_NONE         = 0;
export const BUILDING_POWER_PLANT  = 1;
export const BUILDING_WATER_TOWER  = 2;
export const BUILDING_SEWAGE_PLANT = 3;
// Service buildings (coverage system)
export const BUILDING_POLICE   = 4;
export const BUILDING_FIRE     = 5;
export const BUILDING_SCHOOL   = 6;
export const BUILDING_HOSPITAL = 7;
export const BUILDING_PARK     = 8;

export const SERVICE_BUILDING_KINDS = [4, 5, 6, 7, 8] as const;
