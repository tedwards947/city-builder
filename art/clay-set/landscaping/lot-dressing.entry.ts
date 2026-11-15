// Entry for bundle.mjs: the game's lot-dressing code, bundled so the mock page (opened from
// disk, no module loader) and build.mjs (node) can run exactly what the game runs.
export { analyseLot, PLAN_SPACE } from '../../../src/render/clay/lotGround';
export { planLot, dressingSeed, TREE_NAMES, TREE_SPECS, DRESSING_TONES } from '../../../src/render/clay/lotDressing';
export { drawDressingGround, drawDressingProps } from '../../../src/render/clay/lotDressingDraw';
export { GROUND_TONES } from '../../../src/render/clay/groundTones';
