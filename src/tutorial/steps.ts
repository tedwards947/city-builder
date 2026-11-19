// PLACEHOLDER (GRAPHICS), so the card can be played before the real steps land.
// ENGINE owns this file: overwrite it with the real checks, targets and the
// scripted request (TUTORIAL_DESIGN.md, Steps).

import type { World } from '../sim/World';
import type { TutorialStep } from './types';
import { ZONE_R, ZONE_C, ZONE_I, BUILDING_POWER_PLANT, BUILDING_LARGE_POWER_PLANT, BUILDING_PARK } from '../sim/constants';

function count(world: World, test: (i: number) => boolean): number {
  let n = 0;
  for (let i = 0; i < world.layers.zone.length; i++) if (test(i)) n++;
  return n;
}
const L = (w: World) => w.layers;
const mid = (w: World) => ({ x: Math.floor(w.grid.width / 2), y: Math.floor(w.grid.height / 2) });

export const TUTORIAL_STEPS: TutorialStep[] = [
  { id: 'camera', done: (_w, ui) => ui.panned && ui.zoomed },
  { id: 'street', point: ['street'],
    target: w => { const { x, y } = mid(w); return { path: Array.from({ length: 10 }, (_, k) => [x - 5 + k, y] as [number, number]) }; },
    done: w => count(w, i => L(w).roadClass[i] === 1) >= 10 },
  { id: 'homes', point: ['res'], done: w => count(w, i => L(w).zone[i] === ZONE_R) >= 12 },
  { id: 'power', point: ['plant'],
    target: w => { const { x, y } = mid(w); return { area: { x: x + 7, y: y - 4, w: 2, h: 2 } }; },
    done: w => count(w, i => L(w).building[i] === BUILDING_POWER_PLANT || L(w).building[i] === BUILDING_LARGE_POWER_PLANT) > 0
      && count(w, i => L(w).zone[i] === ZONE_R && L(w).power[i] === 1) > 0 },
  { id: 'water', point: ['water', 'sewage'], done: w => count(w, i => L(w).zone[i] === ZONE_R && L(w).water[i] === 1 && L(w).sewage[i] === 1) > 0 },
  { id: 'grow', point: ['speed', 'demand'], done: w => w.stats.population >= 40 },
  { id: 'jobs', point: ['com', 'ind'], done: w => count(w, i => L(w).zone[i] === ZONE_C) >= 8 && count(w, i => L(w).zone[i] === ZONE_I) >= 8 },
  { id: 'inspect', point: ['inspect'], done: (_w, ui) => ui.inspectedHome },
  { id: 'park', point: ['park'], done: w => count(w, i => L(w).building[i] === BUILDING_PARK) > 0 },
  { id: 'budget', point: ['econ'], done: (_w, ui) => ui.budgetOpened },
  { id: 'views', point: ['traffic'], done: (_w, ui) => ui.overlayOn },
  { id: 'done', done: (_w, ui) => ui.cardClosed },
];
