// CharacterPalette — resolves the rendering color palette from the city-character
// profile. This is the "sprite variant lookup keyed on character profile" hook
// described in the architecture docs.
//
// When real sprites land (Phase 9+), this module becomes the sprite-sheet/frame
// selector instead of returning color strings. The call sites in CanvasRenderer
// stay identical.
//
// Extensibility: add new color keys to ColorPalette + BASE_PALETTE, add variant
// values in GREEN_PALETTE / INDUSTRIAL_PALETTE / etc., then reference them in
// resolve(). The renderer gets the change for free.

export interface ColorPalette {
  // Terrain
  grass: string;
  water: string;
  sand:  string;
  // Zones
  zoneR: string;
  zoneC: string;
  zoneI: string;
  // Developed buildings (per dev level 1–3)
  buildingR: [string, string, string];
  buildingC: [string, string, string];
  buildingI: [string, string, string];
  // Roads
  road: string;
  roadEdge: string;
  roadAvenue: string;
  roadAvenueEdge: string;
  roadHighway: string;
  roadHighwayLine: string;
  // Infrastructure buildings
  powerPlant: string;
  powerPlantRoof: string;
  waterTower: string;
  waterTowerTop: string;
  sewagePlant: string;
  sewagePlantRoof: string;
  // Service buildings
  police: string;
  policeBadge: string;
  fire: string;
  fireAccent: string;
  school: string;
  schoolAccent: string;
  hospital: string;
  hospitalCross: string;
  park: string;
  parkTree: string;
  // Coverage-deficit tints
  noPowerTint: string;
  noWaterTint: string;
  noSewageTint: string;
  noServicesTint: string;
}

// ── Palette definitions ───────────────────────────────────────────────────────
// Only the colors that differ between variants are listed here; resolve() lerps
// between BASE and the appropriate variant, so base values are used for the rest.

const BASE_PALETTE: ColorPalette = {
  grass:            '#3a5a3a',
  water:            '#1e4a6e',
  sand:             '#b8a878',
  zoneR:            '#6fd86f',
  zoneC:            '#4a6ea0',
  zoneI:            '#a07a3a',
  buildingR:        ['#9fe89f', '#c0f0c0', '#dff8df'],
  buildingC:        ['#5f8fd0', '#8faee0', '#b8ceff'],
  buildingI:        ['#c89850', '#e0b060', '#f0c870'],
  road:             '#555555',
  roadEdge:         '#333333',
  roadAvenue:       '#5a5a6a',
  roadAvenueEdge:   '#8888aa',
  roadHighway:      '#6a6050',
  roadHighwayLine:  '#ffe060',
  powerPlant:       '#d04040',
  powerPlantRoof:   '#702020',
  waterTower:       '#2a9ad0',
  waterTowerTop:    '#1a6a90',
  sewagePlant:      '#8a6a20',
  sewagePlantRoof:  '#5a4010',
  police:           '#2040a0',
  policeBadge:      '#8090e0',
  fire:             '#c03010',
  fireAccent:       '#ff6030',
  school:           '#b09010',
  schoolAccent:     '#ffe060',
  hospital:         '#c0c0c0',
  hospitalCross:    '#e04040',
  park:             '#2a6a2a',
  parkTree:         '#50b050',
  noPowerTint:      'rgba(20, 10, 40, 0.45)',
  noWaterTint:      'rgba(10, 60, 80, 0.35)',
  noSewageTint:     'rgba(80, 60, 0, 0.35)',
  noServicesTint:   'rgba(60, 0, 80, 0.30)',
};

// Green city: vivid grass, muted industry, lush parks
const GREEN_PALETTE: Partial<ColorPalette> = {
  grass:     '#2d5228',
  zoneI:     '#7a6a50',
  buildingI: ['#a88040', '#b89048', '#c8a050'],
  park:      '#1a5a1a',
  parkTree:  '#3aa03a',
};

// Industrial city: yellowed grass, vivid industrial zones
const INDUSTRIAL_PALETTE: Partial<ColorPalette> = {
  grass:     '#4a5030',
  zoneI:     '#b07820',
  buildingI: ['#d8a840', '#f0b840', '#ffd050'],
  park:      '#386838',
  parkTree:  '#60b860',
};

// Egalitarian city: warm residential, slightly muted commerce
const EGALITARIAN_PALETTE: Partial<ColorPalette> = {
  zoneR:     '#88e088',
  buildingR: ['#b0f0b0', '#d0f8d0', '#f0fff0'],
  zoneC:     '#3a5e90',
  buildingC: ['#507abe', '#7099d0', '#98b8e8'],
  park:      '#206020',
  parkTree:  '#48aa48',
};

// Laissez-faire city: vivid commerce, muted residential
const LAISSEZ_FAIRE_PALETTE: Partial<ColorPalette> = {
  zoneC:     '#5a80b8',
  buildingC: ['#6898d8', '#90b8f0', '#c0d8ff'],
  zoneR:     '#58c858',
  buildingR: ['#88d888', '#a8e8a8', '#c8f0c8'],
};

// Planned city: crisper roads
const PLANNED_PALETTE: Partial<ColorPalette> = {
  road:           '#636363',
  roadEdge:       '#444444',
  roadAvenue:     '#686878',
  roadAvenueEdge: '#9898b8',
};

// Organic city: rougher, earthier roads
const ORGANIC_PALETTE: Partial<ColorPalette> = {
  road:           '#484640',
  roadEdge:       '#282620',
  roadAvenue:     '#504e48',
  roadAvenueEdge: '#707068',
};

// ── Resolve ───────────────────────────────────────────────────────────────────

/**
 * Resolve the rendering palette from the current city character.
 * Each axis independently lerps from BASE toward its positive or negative variant.
 * Called once per render frame — pure, no side effects.
 */
export function resolvePalette(
  character: { egalitarian: number; green: number; planned: number },
  axisMax: number,
): ColorPalette {
  const greenT      = character.green      / axisMax; // −1 to +1
  const egalT       = character.egalitarian / axisMax;
  const plannedT    = character.planned    / axisMax;

  let palette = { ...BASE_PALETTE } as ColorPalette;

  // Green ↔ Industrial
  if (greenT > 0) {
    palette = _applyVariant(palette, GREEN_PALETTE,      greenT);
  } else if (greenT < 0) {
    palette = _applyVariant(palette, INDUSTRIAL_PALETTE, -greenT);
  }

  // Egalitarian ↔ Laissez-faire
  if (egalT > 0) {
    palette = _applyVariant(palette, EGALITARIAN_PALETTE,  egalT);
  } else if (egalT < 0) {
    palette = _applyVariant(palette, LAISSEZ_FAIRE_PALETTE, -egalT);
  }

  // Planned ↔ Organic
  if (plannedT > 0) {
    palette = _applyVariant(palette, PLANNED_PALETTE,  plannedT);
  } else if (plannedT < 0) {
    palette = _applyVariant(palette, ORGANIC_PALETTE, -plannedT);
  }

  return palette;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Lerp all fields present in `variant` by weight `t` (0–1) from current palette. */
function _applyVariant(base: ColorPalette, variant: Partial<ColorPalette>, t: number): ColorPalette {
  const out = { ...base };
  for (const key of Object.keys(variant) as (keyof ColorPalette)[]) {
    const bv = base[key];
    const vv = variant[key];
    if (typeof bv === 'string' && typeof vv === 'string') {
      (out as Record<string, unknown>)[key] = _lerpHex(bv, vv, t);
    } else if (Array.isArray(bv) && Array.isArray(vv)) {
      (out as Record<string, unknown>)[key] = bv.map((b, i) => _lerpHex(b, (vv as string[])[i] ?? b, t));
    }
  }
  return out;
}

/** Linear interpolate between two CSS hex color strings. */
function _lerpHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = _parseHex(a);
  const [br, bg, bb] = _parseHex(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return '#' + _hex2(r) + _hex2(g) + _hex2(bl);
}

function _parseHex(h: string): [number, number, number] {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function _hex2(n: number): string {
  return n.toString(16).padStart(2, '0');
}
