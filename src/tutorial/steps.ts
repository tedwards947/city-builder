// The tutorial's steps (TUTORIAL_DESIGN.md). Each is met by the STATE of the
// city (or of the UI), never by one exact click, so any way of getting there
// counts and a step the player has already met is passed at once. `done` is
// cheap enough to ask a few times a second and changes nothing.
//
// The numbers are in GOALS. The spots a step points at come from the map: the
// end of the highway stub, and a Focus marker labelled "power" (placed with
// ?debug=true; a map without it simply shows no spot).
//
// No step ever needs something knocked down: the services step asks for a
// building "beside a road" anywhere, and a short new street always makes room.

import type { World } from '../sim/World';
import {
  ROAD_NONE, ROAD_HIGHWAY, ZONE_R, ZONE_C, ZONE_I, TERRAIN_WATER, BUILDING_NONE,
  BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL, BUILDING_PARK,
} from '../sim/constants';
import { coveredBy, touchesAccessRoad } from '../sim/serviceValue';
import { t } from '../i18n';
import type { TutorialProgress, TutorialStep, TutorialTarget, TutorialUi } from './types';

export const GOALS = {
  /** Street tiles joined to the highway. */
  streetTiles: 10,
  /** The "more roads" step: the street network joined to the highway has grown to this many tiles. */
  moreStreetTiles: 20,
  /** Home tiles zoned beside a street; the same number must then have power, water and sewage. */
  homeTiles: 12,
  population: 40,
  shopTiles: 8,
  industryTiles: 8,
};

const isAccessRoad = (rc: number): boolean => rc !== ROAD_NONE && rc !== ROAD_HIGHWAY;

/**
 * Street and avenue tiles that can be reached by road from a highway. On a
 * map with no highway at all, every street and avenue tile counts. (Worked
 * out here, not read from the sim's road networks, so it is right while the
 * game is paused.)
 */
export function roadTilesOffHighway(world: World): number {
  const { width, height } = world.grid;
  const road = world.layers.roadClass;
  const { roads, roadCount } = world.index;
  const queue: number[] = [];
  let streets = 0;
  for (let k = 0; k < roadCount; k++) {
    const i = roads[k];
    if (road[i] === ROAD_HIGHWAY) queue.push(i);
    else if (isAccessRoad(road[i])) streets++;
  }
  if (queue.length === 0) return streets;
  const seen = new Set<number>(queue);
  let reached = 0;
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const x = i % width, y = (i - x) / width;
    const visit = (j: number): void => {
      if (road[j] === ROAD_NONE || seen.has(j)) return;
      seen.add(j);
      queue.push(j);
      if (road[j] !== ROAD_HIGHWAY) reached++;
    };
    if (x > 0) visit(i - 1);
    if (x < width - 1) visit(i + 1);
    if (y > 0) visit(i - width);
    if (y < height - 1) visit(i + width);
  }
  return reached;
}

/** Tiles of `zone` on the map; with `where`, only those it accepts. */
function countZone(world: World, zone: number, where?: (i: number, x: number, y: number) => boolean): number {
  const z = world.layers.zone;
  const { width } = world.grid;
  const { zoned, zonedCount } = world.index;
  let n = 0;
  for (let k = 0; k < zonedCount; k++) {
    const i = zoned[k];
    if (z[i] !== zone) continue;
    if (!where) { n++; continue; }
    const x = i % width;
    if (where(i, x, (i - x) / width)) n++;
  }
  return n;
}

/** Home tiles zoned beside a street or avenue; with `layers`, only those every one of the layers covers. */
export function homesBesideRoad(world: World, ...layers: Uint8Array[]): number {
  return countZone(world, ZONE_R, (i, x, y) => touchesAccessRoad(world, x, y) && layers.every((l) => l[i] !== 0));
}

/** The first Focus marker labelled `label` (any case), as a one-tile area. */
function markerArea(world: World, label: string): TutorialTarget | null {
  const m = world.markers.find((k) => k.label?.trim().toLowerCase() === label);
  return m ? { area: { x: m.x, y: m.y, w: 1, h: 1 } } : null;
}

/**
 * Where the first street could go: straight on from the end of the highway
 * stub, over open land. Null if the map has no stub end, or no room there.
 */
export function streetPath(world: World): TutorialTarget | null {
  const { width, height } = world.grid;
  const { roadClass: road, terrain, building, zone } = world.layers;
  const { roads, roadCount } = world.index;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  const free = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    const i = y * width + x;
    return terrain[i] !== TERRAIN_WATER && building[i] === BUILDING_NONE && road[i] === ROAD_NONE && zone[i] === 0;
  };
  let best: [number, number][] | null = null;
  for (let k = 0; k < roadCount; k++) {
    const i = roads[k];
    if (road[i] !== ROAD_HIGHWAY) continue;
    const x = i % width, y = (i - x) / width;
    // The end of a stub: exactly one highway neighbour; the street carries straight on, away from it.
    const next = DIRS.filter(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < width && ny < height && road[ny * width + nx] === ROAD_HIGHWAY;
    });
    if (next.length !== 1) continue;
    const [dx, dy] = [-next[0][0], -next[0][1]];
    const path: [number, number][] = [];
    for (let s = 1; s <= GOALS.streetTiles && free(x + dx * s, y + dy * s); s++) path.push([x + dx * s, y + dy * s]);
    if (!best || path.length > best.length) best = path;
  }
  return best && best.length > 0 ? { path: best } : null;
}

/**
 * The services the services step can ask for, in the order it prefers them
 * when several are equally missing. `id` names the building in the card's
 * copy (ui.tutorial.service.<id>); `key` is its toolbar item.
 */
export const SERVICES = [
  { id: 'police', kind: BUILDING_POLICE, key: 'police' },
  { id: 'fire', kind: BUILDING_FIRE, key: 'fireStation' },
  { id: 'school', kind: BUILDING_SCHOOL, key: 'school' },
  { id: 'hospital', kind: BUILDING_HOSPITAL, key: 'hospital' },
  { id: 'park', kind: BUILDING_PARK, key: 'park' },
] as const;
type Service = typeof SERVICES[number];

/** Home tiles (zoned, lived in or not) that a building of `kind` reaches. */
function homesReached(world: World, kind: number): number {
  const covered = coveredBy(world, kind);
  if (covered.size === 0) return 0;
  return countZone(world, ZONE_R, (i) => covered.has(i));
}

/**
 * The service to ask for. If the player has just inspected a home that lacks
 * something, it is one of the services THAT home lacks (`forHome`); otherwise
 * one the town's homes lack. Among those, the one the most homes are without,
 * the earlier in SERVICES on a tie. With nothing missing anywhere: police.
 */
export function chooseService(world: World, inspectedTile: number): { service: Service; forHome: boolean } {
  const homes = countZone(world, ZONE_R);
  const missing = (s: Service): number => homes - homesReached(world, s.kind);
  const pick = (from: readonly Service[]): Service | null => {
    let best: Service | null = null, most = 0;
    for (const s of from) { const n = missing(s); if (n > most) { most = n; best = s; } }
    return best;
  };
  if (inspectedTile >= 0 && world.layers.zone[inspectedTile] === ZONE_R) {
    const lacked = SERVICES.filter((s) => !coveredBy(world, s.kind).has(inspectedTile));
    if (lacked.length > 0) return { service: pick(lacked) ?? lacked[0], forHome: true };
  }
  return { service: pick(SERVICES) ?? SERVICES[0], forHome: false };
}

/** The service the services step asks for: the one fixed when the step was reached, else what it would be now. */
function askedService(world: World): { service: Service; forHome: boolean } {
  const state = world.tutorial;
  const fixed = SERVICES.find((s) => s.id === state?.service);
  return fixed ? { service: fixed, forHome: state?.forHome === true } : chooseService(world, -1);
}

/** Whether the city spends more than it earns (the budget panel's daily total is negative). */
export function budgetInTheRed(world: World): boolean {
  return world.budget.income - world.budget.expenses < 0;
}

/** The services step: some police station, fire station, school, hospital or park reaches at least one home. Any of the five counts. */
function servicesDone(world: World): boolean {
  return SERVICES.some((s) => homesReached(world, s.kind) > 0);
}

/**
 * A step with counted goals: it is done once every count has reached its
 * target, and the card shows the counts (each `n` is capped at its target).
 */
function counted(step: Omit<TutorialStep, 'done' | 'progress'>, goals: (world: World) => TutorialProgress[]): TutorialStep {
  return {
    ...step,
    progress: (w) => goals(w).map((g) => ({ ...g, n: Math.min(g.n, g.of) })),
    done: (w) => goals(w).every((g) => g.n >= g.of),
  };
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { id: 'camera', done: (_w, ui) => ui.panned && ui.zoomed },
  counted({ id: 'street', point: ['street'], target: streetPath },
    (w) => [{ key: 'streets', n: roadTilesOffHighway(w), of: GOALS.streetTiles }]),
  counted({ id: 'homes', point: ['res'] },
    (w) => [{ key: 'homes', n: homesBesideRoad(w), of: GOALS.homeTiles }]),
  // Nothing else says the town needs more road than its first street: ten more tiles of it.
  counted({ id: 'roads', point: ['street'] },
    (w) => [{ key: 'streets', n: roadTilesOffHighway(w), of: GOALS.moreStreetTiles }]),
  counted({ id: 'power', point: ['plant'], target: (w) => markerArea(w, 'power') },
    (w) => [{ key: 'powered', n: homesBesideRoad(w, w.layers.power), of: GOALS.homeTiles }]),
  counted({ id: 'water', point: ['water', 'sewage'] }, (w) => [
    { key: 'watered', n: homesBesideRoad(w, w.layers.water), of: GOALS.homeTiles },
    { key: 'sewered', n: homesBesideRoad(w, w.layers.sewage), of: GOALS.homeTiles },
  ]),
  counted({ id: 'grow', point: ['speed', 'demand'] },
    (w) => [{ key: 'residents', n: w.stats.population, of: GOALS.population }]),
  counted({ id: 'jobs', point: ['com', 'ind'] }, (w) => [
    { key: 'shops', n: countZone(w, ZONE_C), of: GOALS.shopTiles },
    { key: 'industry', n: countZone(w, ZONE_I), of: GOALS.industryTiles },
  ]),
  { id: 'inspect', point: ['inspect'], done: (_w, ui) => ui.inspectedHome },
  {
    // Follows on from Inspect: the card names a service the inspected home is without.
    id: 'services',
    enter: (w, ui) => {
      const state = w.tutorial;
      if (!state || state.service !== undefined) return;
      const { service, forHome } = chooseService(w, ui.inspectedTile);
      state.service = service.id;
      if (forHome) state.forHome = true;
    },
    copy: (w) => (askedService(w).forHome ? 'servicesHome' : 'services'),
    vars: (w) => ({ service: t('ui.tutorial.service.' + askedService(w).service.id) }),
    point: (w) => [askedService(w).service.key],
    done: servicesDone,
  },
  {
    // A young town spends more than it earns, which looks alarming: the card says so, either way.
    id: 'budget', point: ['econ'],
    notes: (w) => [budgetInTheRed(w) ? 'budgetRed' : 'budgetBlack', 'budgetDebt'],
    done: (_w, ui) => ui.budgetOpened,
  },
  { id: 'views', point: ['traffic'], done: (_w, ui) => ui.overlayOn },
  { id: 'done', done: (_w, ui) => ui.cardClosed },
];

/** A fresh record of what the player has done in the UI: nothing yet. */
export function newTutorialUi(): TutorialUi {
  return { panned: false, zoomed: false, inspectedHome: false, inspectedTile: -1, budgetOpened: false, overlayOn: false, cardClosed: false };
}

/**
 * The step to show from `from` on: the first one not yet met (steps already
 * met are passed straight away). The last step is never passed here: it ends
 * when its card is closed. Returns TUTORIAL_STEPS.length once that is done.
 */
export function nextStep(world: World, ui: TutorialUi, from: number): number {
  let k = Math.max(0, from);
  while (k < TUTORIAL_STEPS.length && TUTORIAL_STEPS[k].done(world, ui)) k++;
  return k;
}
