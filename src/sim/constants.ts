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

// Rail track levels: bits of world.layers.rail, so a tile can hold more than one (sim/rail.ts).
export const RAIL_NONE     = 0;
export const RAIL_GROUND   = 1;
export const RAIL_ELEVATED = 2;
export const RAIL_SUBWAY   = 4;
/** The levels that take up the surface of a tile (elevated stands on pillars); subway does not. */
export const RAIL_SURFACE  = RAIL_GROUND | RAIL_ELEVATED;

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
// Large utilities: several tiles each (shapes in sim/buildingShapes.ts).
// Not offered by the toolbar outside ?debug=true until their numbers are set.
export const BUILDING_LARGE_POWER_PLANT  = 9;   // 3×3
export const BUILDING_LARGE_WATER_PLANT  = 10;  // 2×2
export const BUILDING_LARGE_SEWAGE_PLANT = 11;  // 2×2
export const BUILDING_SEAPORT            = 12;  // a 4×3 yard on land with a row of docks over open water
export const BUILDING_STATION            = 14;  // train station, straight: three platform tiles in a row (sim/buildingShapes.ts)
export const BUILDING_STATION_L          = 15;  // train station, curved: 2×2, the platform round the corner, a house on the fourth tile
export const BUILDING_RAMP_ELEVATED      = 16;  // 2×1 ramp: ground track at the anchor end, elevated at the other
export const BUILDING_RAMP_SUBWAY        = 17;  // 2×1 ramp: ground track at the anchor end, subway at the other
export const BUILDING_STATION_ELEVATED   = 33;  // elevated train station: three platform tiles in a row that carry ELEVATED track (owner 2026-11-21)
export const BUILDING_SUBWAY_STATION     = 18;  // 1×1 entrance over a 3-tile subway platform (sim/buildingShapes.ts subwayPlatform)
export const BUILDING_AIRPORT            = 13;  // 12×5, one per city, never turned (shape and rules in sim/buildingShapes.ts)
// Leisure (LEISURE_DESIGN.md; shapes in sim/buildingShapes.ts, rules and numbers in sim/leisure.ts and BALANCE.leisure).
export const BUILDING_BIG_PARK   = 19;  // 3×3, repeatable
export const BUILDING_BEACH_PARK = 20;  // 3×2 on land at the water's edge, repeatable
export const BUILDING_PLAZA      = 21;  // 2×2 plaza with a monument, repeatable
export const BUILDING_MUSEUM     = 22;  // 2×2, one per city
export const BUILDING_STADIUM    = 23;  // 4×4 bowl plus a 2-tile entrance plaza, one per city
export const BUILDING_LIDO       = 25;  // 3×2 seaside lido at the water's edge, repeatable (owner 2026-11-20: a second beach park type)
// Capstones (CAPSTONE_DESIGN.md; sizes, unlocks and numbers in BALANCE.capstones, rules in sim/capstones.ts):
// one of each per city, numbered in the order they unlock.
export const BUILDING_SEWAGE_WORKS     = 26;
export const BUILDING_WATERWORKS       = 27;  // a pump station: beside water
export const BUILDING_FIRE_HQ          = 28;  // with a runway
export const BUILDING_POLICE_HQ        = 29;
export const BUILDING_GENERAL_HOSPITAL = 30;
export const BUILDING_NUCLEAR_PLANT    = 31;
export const BUILDING_UNIVERSITY       = 32;
export const BUILDING_MID_PARK   = 24;  // 2×2 park, repeatable (owner 2026-11-20: a size between the 1×1 park and the 3×3)


// Vegetation layer
export const VEG_NONE   = 0;
export const VEG_TREE_1 = 1;
export const VEG_TREE_2 = 2;
export const VEG_TREE_3 = 3;
export const VEG_TREE_4 = 4;
export const VEG_TREE_5 = 5;
export const VEG_TREE_6 = 6;
