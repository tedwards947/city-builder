// The tutorial (TUTORIAL_DESIGN.md): each step's `done`, the tutorial-only
// rules, the save field, the shipped map, and one scripted run through all
// twelve steps with the ordinary commands.

import { describe, it, expect } from 'vitest';
import text from '../../public/tutorial/tutorial.citysave.json?raw';
import { decodeSaveFile } from '../persistence/SaveFile';
import { SAVE_VERSION } from '../persistence/SaveFormat';
import { deserialize, serialize } from '../persistence/Serializer';
import { World } from '../sim/World';
import { VibeSystem } from '../sim/systems/VibeSystem';
import {
  BUILDING_FIRE, BUILDING_HOSPITAL, BUILDING_PARK, BUILDING_POLICE, BUILDING_POWER_PLANT, BUILDING_SCHOOL, BUILDING_SEWAGE_PLANT, BUILDING_WATER_TOWER,
  ROAD_HIGHWAY, ROAD_STREET, TERRAIN_WATER, ZONE_C, ZONE_I, ZONE_R,
} from '../sim/constants';
import { BALANCE } from '../data/balance';
import { pcCap } from '../sim/politics';
import { startSim } from '../balance/world';
import { BuildRoadCommand } from '../commands/BuildRoadCommand';
import { PaintZoneCommand } from '../commands/PaintZoneCommand';
import { PlaceBuildingCommand } from '../commands/PlaceBuildingCommand';
import { CLEAR, blankWorld, buildTutorialMap } from '../gen/tutorialMap';
import { GOALS, SERVICES, TUTORIAL_STEPS, budgetInTheRed, chooseService, homesBesideRoad, newTutorialUi, nextStep, roadTilesOffHighway, streetPath } from '../tutorial/steps';
import { TUTORIAL, beginTutorial, endTutorial } from '../tutorial/rules';
import { toolbarItems } from '../ui/Toolbar';
import { t } from '../i18n';
import type { TutorialUi } from '../tutorial/types';

const step = (id: string) => {
  const s = TUTORIAL_STEPS.find((k) => k.id === id);
  if (!s) throw new Error(`no step ${id}`);
  return s;
};
const indexOf = (id: string): number => TUTORIAL_STEPS.findIndex((k) => k.id === id);
const ui = (over: Partial<TutorialUi> = {}): TutorialUi => ({ ...newTutorialUi(), ...over });
const loadMap = (): World => deserialize(decodeSaveFile(text).snapshot, { bootstrapVibes: (x) => new VibeSystem().bootstrapVibes(x) });

/** Bare land with a highway stub along row 10, x 0..4. */
function stubWorld(): World {
  const w = blankWorld(32, 32);
  for (let x = 0; x <= 4; x++) w.setRoad(x, 10, ROAD_HIGHWAY);
  return w;
}
function street(w: World, x0: number, x1: number, y: number): void {
  for (let x = x0; x <= x1; x++) w.setRoad(x, y, ROAD_STREET);
}
function zone(w: World, z: number, x0: number, x1: number, y: number): void {
  for (let x = x0; x <= x1; x++) w.setZone(x, y, z);
}

describe('the tutorial step list', () => {
  it('has the thirteen steps of the design, in order', () => {
    expect(TUTORIAL_STEPS.map((s) => s.id)).toEqual(
      ['camera', 'street', 'homes', 'roads', 'power', 'water', 'grow', 'jobs', 'inspect', 'services', 'budget', 'views', 'done']);
  });

  it('camera: the view has been both panned and zoomed', () => {
    const w = stubWorld();
    expect(step('camera').done(w, ui())).toBe(false);
    expect(step('camera').done(w, ui({ panned: true }))).toBe(false);
    expect(step('camera').done(w, ui({ panned: true, zoomed: true }))).toBe(true);
  });

  it('street: ten street tiles joined to the highway', () => {
    const w = stubWorld();
    street(w, 5, 13, 10);                                   // nine
    expect(step('street').done(w, ui())).toBe(false);
    street(w, 20, 30, 20);                                  // eleven more, but not joined
    expect(roadTilesOffHighway(w)).toBe(9);
    expect(step('street').done(w, ui())).toBe(false);
    street(w, 14, 14, 10);
    expect(step('street').done(w, ui())).toBe(true);
  });

  it('street: on a map with no highway, any ten street tiles count', () => {
    const w = blankWorld(32, 32);
    street(w, 3, 11, 5);
    expect(step('street').done(w, ui())).toBe(false);
    street(w, 12, 12, 5);
    expect(step('street').done(w, ui())).toBe(true);
  });

  it('street: points straight on from the end of the highway stub', () => {
    const w = stubWorld();
    const path = streetPath(w)?.path;
    expect(path).toHaveLength(GOALS.streetTiles);
    expect(path?.[0]).toEqual([5, 10]);
    expect(path?.[9]).toEqual([14, 10]);
    expect(step('street').target?.(w)).toEqual({ path });
    expect(streetPath(blankWorld(16, 16))).toBeNull();
  });

  it('homes: twelve home tiles beside a street (a highway does not count)', () => {
    const w = stubWorld();
    zone(w, ZONE_R, 0, 4, 9);                               // beside the highway only
    street(w, 5, 16, 10);
    zone(w, ZONE_R, 5, 15, 9);                              // eleven
    expect(step('homes').done(w, ui())).toBe(false);
    zone(w, ZONE_R, 20, 30, 25);                            // nowhere near a road
    expect(homesBesideRoad(w)).toBe(11);
    zone(w, ZONE_R, 5, 5, 11);
    expect(step('homes').done(w, ui())).toBe(true);
  });

  it('roads: ten more street tiles, twenty joined to the highway in all', () => {
    const w = stubWorld();
    street(w, 5, 14, 10);                                   // the first ten
    expect(step('roads').done(w, ui())).toBe(false);
    for (let y = 11; y <= 19; y++) w.setRoad(9, y, ROAD_STREET);   // nine more, off the first street
    expect(step('roads').done(w, ui())).toBe(false);
    street(w, 20, 30, 25);                                  // not joined: does not count
    expect(step('roads').done(w, ui())).toBe(false);
    w.setRoad(9, 20, ROAD_STREET);
    expect(step('roads').done(w, ui())).toBe(true);
    expect(step('roads').point).toEqual(['street']);
  });

  it('power, then water and sewage: twelve of those homes are covered', () => {
    const w = stubWorld();
    street(w, 5, 16, 10);
    zone(w, ZONE_R, 5, 16, 9);
    const sim = startSim(w);
    sim.tick();
    expect(step('power').done(w, ui())).toBe(false);
    expect(w.placeBuilding(17, 10, BUILDING_POWER_PLANT)).toBe(true);
    sim.tick();
    expect(step('power').done(w, ui())).toBe(true);
    expect(step('water').done(w, ui())).toBe(false);
    expect(w.placeBuilding(16, 11, BUILDING_WATER_TOWER)).toBe(true);
    sim.tick();
    expect(step('water').done(w, ui())).toBe(false);        // water, but nowhere for it to go
    expect(w.placeBuilding(15, 11, BUILDING_SEWAGE_PLANT)).toBe(true);
    sim.tick();
    expect(step('water').done(w, ui())).toBe(true);
    expect(step('power').point).toEqual(['plant']);
    expect(step('water').point).toEqual(['water', 'sewage']);
  });

  it('power: points at the Focus marker labelled "power", if the map has one', () => {
    const w = stubWorld();
    expect(step('power').target?.(w)).toBeNull();
    w.markers.push({ x: 7, y: 8, kind: 'focus', label: ' Power ' });
    expect(step('power').target?.(w)).toEqual({ area: { x: 7, y: 8, w: 1, h: 1 } });
  });

  it('grow: forty residents', () => {
    const w = stubWorld();
    w.stats.population = 39;
    expect(step('grow').done(w, ui())).toBe(false);
    w.stats.population = 40;
    expect(step('grow').done(w, ui())).toBe(true);
  });

  it('jobs: eight shop tiles and eight industry tiles', () => {
    const w = stubWorld();
    zone(w, ZONE_C, 5, 12, 12);
    expect(step('jobs').done(w, ui())).toBe(false);
    zone(w, ZONE_I, 5, 11, 14);
    expect(step('jobs').done(w, ui())).toBe(false);
    zone(w, ZONE_I, 12, 12, 14);
    expect(step('jobs').done(w, ui())).toBe(true);
  });

  it('jobs: shops or industry alone are not enough, and it does not matter where they are or whether they have grown', () => {
    const w = stubWorld();
    const jobs = step('jobs');
    for (let x = 5; x <= 12; x++) expect(w.setZone(x, 20, ZONE_C)).toBe(true);   // no road anywhere near, nothing built
    expect(jobs.progress?.(w)).toEqual([{ key: 'shops', n: 8, of: 8 }, { key: 'industry', n: 0, of: 8 }]);
    expect(jobs.done(w, ui())).toBe(false);
    for (let x = 5; x <= 11; x++) w.setZone(x, 25, ZONE_I);
    expect(jobs.progress?.(w)?.[1]).toEqual({ key: 'industry', n: 7, of: 8 });
    expect(jobs.done(w, ui())).toBe(false);
    w.setZone(12, 25, ZONE_I);
    expect(jobs.done(w, ui())).toBe(true);
    for (let x = 13; x <= 30; x++) w.setZone(x, 25, ZONE_I);
    expect(jobs.progress?.(w)?.[1]).toEqual({ key: 'industry', n: 8, of: 8 });   // capped at the target
  });

  it('every counted step says how far along it is, and is done exactly when every count is reached', () => {
    const counted = TUTORIAL_STEPS.filter((s) => s.progress).map((s) => s.id);
    expect(counted).toEqual(['street', 'homes', 'roads', 'power', 'water', 'grow', 'jobs']);
    const w = stubWorld();
    for (const id of counted) {
      const goals = step(id).progress!(w);
      expect(goals.length).toBeGreaterThan(0);
      expect(step(id).done(w, ui())).toBe(goals.every((g) => g.n >= g.of));
    }
    street(w, 5, 11, 10);
    expect(step('street').progress?.(w)).toEqual([{ key: 'streets', n: 7, of: 10 }]);
    expect(step('roads').progress?.(w)).toEqual([{ key: 'streets', n: 7, of: 20 }]);
    w.stats.population = 12;
    expect(step('grow').progress?.(w)).toEqual([{ key: 'residents', n: 12, of: 40 }]);
  });

  it('budget: the card says what the daily total means, and warns about debt either way', () => {
    const w = stubWorld();
    const budget = step('budget');
    w.budget.income = 10; w.budget.expenses = 30;
    expect(budgetInTheRed(w)).toBe(true);
    expect(budget.notes?.(w)).toEqual(['budgetRed', 'budgetDebt']);
    w.budget.income = 30; w.budget.expenses = 30;
    expect(budget.notes?.(w)).toEqual(['budgetBlack', 'budgetDebt']);
    w.budget.income = 45;
    expect(budget.notes?.(w)).toEqual(['budgetBlack', 'budgetDebt']);
    // Every note a step can show has copy.
    for (const key of ['budgetRed', 'budgetBlack', 'budgetDebt']) expect(t('ui.tutorial.note.' + key)).not.toContain('ui.tutorial');
  });

  it('inspect, budget, views and the last card are met in the UI', () => {
    const w = stubWorld();
    for (const [id, flag] of [['inspect', 'inspectedHome'], ['budget', 'budgetOpened'], ['views', 'overlayOn'], ['done', 'cardClosed']] as const) {
      expect(step(id).done(w, ui())).toBe(false);
      expect(step(id).done(w, ui({ [flag]: true }))).toBe(true);
    }
  });

  /** A tutorial city with a row of homes along a street (x 5..12, y 9), at the services step. */
  function servicesWorld(): World {
    const w = stubWorld();
    street(w, 5, 16, 10);
    zone(w, ZONE_R, 5, 12, 9);
    beginTutorial(w);
    w.tutorial!.step = indexOf('services');
    return w;
  }
  const services = step('services');
  const pointOf = (w: World): string[] => (typeof services.point === 'function' ? services.point(w) : services.point ?? []);

  it('services: any of the five services that reaches a home meets it, wherever it stands', () => {
    for (const kind of [BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL, BUILDING_PARK]) {
      const w = servicesWorld();
      expect(services.done(w, ui())).toBe(false);
      expect(w.placeBuilding(25, 25, kind)).toBe(true);     // off any road: it reaches nobody
      expect(services.done(w, ui())).toBe(false);
      expect(w.placeBuilding(14, 11, kind)).toBe(true);     // beside the street, on open land
      expect(services.done(w, ui())).toBe(true);
    }
  });

  it('services: no home has to go, even when every lot along the street is zoned', () => {
    const w = servicesWorld();
    zone(w, ZONE_R, 5, 16, 11);
    zone(w, ZONE_R, 13, 16, 9);                             // both sides of the whole street are homes now
    const homes = homesBesideRoad(w);
    for (let y = 11; y <= 14; y++) w.setRoad(17, y, ROAD_STREET);   // "draw a short new street"
    expect(w.placeBuilding(18, 13, BUILDING_SCHOOL)).toBe(true);
    expect(homesBesideRoad(w)).toBeGreaterThanOrEqual(homes);
    expect(services.done(w, ui())).toBe(true);
  });

  it('services: asks for what the inspected home is without, and says "this home"', () => {
    const w = servicesWorld();
    expect(chooseService(w, w.grid.idx(8, 9))).toEqual({ service: SERVICES[0], forHome: true });   // lacks everything: police first
    services.enter?.(w, ui({ inspectedHome: true, inspectedTile: w.grid.idx(8, 9) }));
    expect(w.tutorial).toEqual({ step: indexOf('services'), service: 'police', forHome: true });
    expect(services.copy?.(w)).toBe('servicesHome');
    expect(services.vars?.(w)).toEqual({ service: 'police station' });
    expect(pointOf(w)).toEqual(['police']);
    // Fixed once chosen: entering again (after a load, say) changes nothing.
    services.enter?.(w, ui());
    expect(w.tutorial!.service).toBe('police');
  });

  it('services: a home that already has police and fire cover is told about the next thing it lacks', () => {
    const w = stubWorld();
    street(w, 5, 16, 10);
    zone(w, ZONE_R, 5, 12, 9);
    expect(w.placeBuilding(14, 11, BUILDING_POLICE)).toBe(true);
    expect(w.placeBuilding(15, 11, BUILDING_FIRE)).toBe(true);
    const picked = chooseService(w, w.grid.idx(8, 9));
    expect(picked).toEqual({ service: SERVICES[2], forHome: true });
    expect(picked.service.id).toBe('school');
    expect(picked.service.key).toBe('school');
  });

  it('services: with no home inspected (the step was skipped) it falls back to what the town lacks: police', () => {
    const w = servicesWorld();
    services.enter?.(w, ui());
    expect(w.tutorial).toEqual({ step: indexOf('services'), service: 'police' });
    expect(services.copy?.(w)).toBe('services');
    expect(pointOf(w)).toEqual(['police']);
    // Clicking a tile that is not a home is the same as not inspecting.
    expect(chooseService(w, w.grid.idx(20, 20))).toEqual({ service: SERVICES[0], forHome: false });
  });

  it('services: the toolbar keys are real toolbar items', () => {
    const keys = toolbarItems().map((i) => i.key);
    for (const sv of SERVICES) expect(keys).toContain(sv.key);
    for (const st of TUTORIAL_STEPS) {
      if (Array.isArray(st.point)) for (const k of st.point) if (k !== 'speed' && k !== 'demand') expect(keys).toContain(k);
    }
  });

  it('steps already met are passed straight away, but never the last card', () => {
    const w = stubWorld();
    const all = ui({ panned: true, zoomed: true, inspectedHome: true, budgetOpened: true, overlayOn: true });
    expect(nextStep(w, all, 0)).toBe(indexOf('street'));
    street(w, 5, 16, 10);
    zone(w, ZONE_R, 5, 16, 9);
    expect(nextStep(w, all, 0)).toBe(indexOf('roads'));
    street(w, 17, 24, 10);
    expect(nextStep(w, all, 0)).toBe(indexOf('power'));
    expect(nextStep(w, all, indexOf('budget'))).toBe(indexOf('done'));
    expect(nextStep(w, { ...all, cardClosed: true }, indexOf('budget'))).toBe(TUTORIAL_STEPS.length);
  });
});

describe('the tutorial-only rules', () => {
  it('a city is not a tutorial city unless told so', () => {
    expect(new World(16, 16, 1).tutorial).toBeUndefined();
    expect(serialize(new World(16, 16, 1))).not.toHaveProperty('tutorial');
  });

  it('beginTutorial starts at the first step with generous money', () => {
    const w = stubWorld();
    w.budget.money = 300;
    beginTutorial(w);
    expect(w.tutorial).toEqual({ step: 0 });
    expect(w.budget.money).toBe(TUTORIAL.startMoney);
  });

  it('money has a floor, political capital stays full and no debt builds up', () => {
    const w = stubWorld();
    beginTutorial(w);
    const sim = startSim(w);
    w.budget.money = -90_000;
    w.budget.politicalCapital = -20;
    w.budget.debtOverTicks = 500;
    sim.tick();
    expect(w.budget.money).toBe(TUTORIAL.minMoney);
    expect(w.budget.politicalCapital).toBeGreaterThanOrEqual(pcCap(w));
    expect(w.budget.debtOverTicks).toBe(0);
    expect(w.budget.gameOver).toBe(false);
  });

  /** A town of lived-in homes with no services at all: residents would ask for plenty, and fires would start. */
  function needyTown(): World {
    const w = stubWorld();
    for (const y of [10, 14, 18]) {
      street(w, 5, 28, y);
      zone(w, ZONE_R, 5, 28, y - 1);
      for (let x = 5; x <= 28; x++) { w.layers.devLevel[w.grid.idx(x, y - 1)] = 3; w.layers.fireRisk[w.grid.idx(x, y - 1)] = 255; }
    }
    return w;
  }
  const DAYS = 40;

  it('no request opens by itself and no fire starts, however long the tutorial takes', () => {
    const w = needyTown();
    beginTutorial(w);
    let fires = 0;
    w.events.on('fireIgnition', () => { fires++; });
    const sim = startSim(w);
    sim.tick(DAYS * BALANCE.ticksPerDay);
    expect(w.politics.requests).toHaveLength(0);
    expect(fires).toBe(0);
  });

  it('the same town outside the tutorial does get requests and fires (the rules are what stop them)', () => {
    const w = needyTown();
    let fires = 0, opened = 0;
    w.events.on('fireIgnition', () => { fires++; });
    w.events.on('requestOpened', () => { opened++; });
    const sim = startSim(w);
    sim.tick(DAYS * BALANCE.ticksPerDay);
    expect(opened).toBeGreaterThan(0);
    expect(fires).toBeGreaterThan(0);
  });

  it('endTutorial ends every rule', () => {
    const w = needyTown();
    beginTutorial(w);
    endTutorial(w);
    expect(w.tutorial).toBeUndefined();
    w.budget.money = 10;
    startSim(w).tick();
    expect(w.budget.money).toBeLessThan(TUTORIAL.minMoney);  // no floor any more
  });

  it('the step and the chosen service survive a save and a load', () => {
    const w = needyTown();
    beginTutorial(w);
    w.tutorial!.step = indexOf('services');
    step('services').enter?.(w, ui({ inspectedTile: w.grid.idx(8, 9) }));
    const back = deserialize(serialize(w));
    expect(back.tutorial).toEqual({ step: indexOf('services'), service: 'police', forHome: true });
    endTutorial(w);
    expect(deserialize(serialize(w)).tutorial).toBeUndefined();
  });

  it('a tutorial save from before the services step (with a scripted request id) still loads', () => {
    const snap = serialize(needyTown());
    (snap as unknown as { tutorial: unknown }).tutorial = { step: 4, request: 7 };
    expect(deserialize(snap).tutorial).toEqual({ step: 4 });
  });
});

describe('the tutorial map', () => {
  it('loads at the current save version, empty, and is not yet marked as a tutorial city', () => {
    const file = decodeSaveFile(text);
    expect(file.version).toBe(SAVE_VERSION);
    const w = loadMap();
    expect(w.stats.population).toBe(0);
    expect(w.tutorial).toBeUndefined();
    expect(w.grid.width).toBeLessThanOrEqual(64);
    expect(text.length).toBeLessThan(400_000);
  });

  it('has a highway stub with room for the first street', () => {
    const w = loadMap();
    expect(streetPath(w)?.path).toHaveLength(GOALS.streetTiles);
  });

  it('is wooded, with the land for the first steps left open', () => {
    const w = loadMap();
    const N = w.grid.width, row = N / 2;
    let trees = 0, inClear = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (w.layers.vegetation[y * N + x] === 0) continue;
      trees++;
      if (x >= CLEAR.x0 && x <= CLEAR.x1 && Math.abs(y - row) <= CLEAR.half) inClear++;
    }
    expect(trees).toBeGreaterThan(400);
    expect(inClear).toBe(0);
    // No tree stands in water, and the stream reaches the south edge.
    for (let i = 0; i < N * N; i++) if (w.layers.terrain[i] === TERRAIN_WATER) expect(w.layers.vegetation[i]).toBe(0);
    expect(Array.from(w.layers.terrain.subarray((N - 1) * N)).includes(TERRAIN_WATER)).toBe(true);
  });

  it('the placeholder file is what the generator builds', () => {
    const made = buildTutorialMap(), w = loadMap();
    expect(Array.from(w.layers.terrain)).toEqual(Array.from(made.layers.terrain));
    expect(Array.from(w.layers.roadClass)).toEqual(Array.from(made.layers.roadClass));
    expect(Array.from(w.layers.vegetation)).toEqual(Array.from(made.layers.vegetation));
    expect(w.markers).toEqual(made.markers);
  });

  it('can be played from the first step to the last with the ordinary commands', () => {
    const t0 = performance.now();
    const w = loadMap();
    beginTutorial(w);
    const sim = startSim(w);
    const seen = newTutorialUi();
    const run = (cmd: BuildRoadCommand | PaintZoneCommand | PlaceBuildingCommand): void => { expect(sim.history.run(cmd)).toBe(true); };
    /** What the runner does a few times a second: move to the first step not yet met. */
    const advance = (): string | undefined => {
      const k = nextStep(w, seen, w.tutorial!.step);
      if (k !== w.tutorial!.step && k < TUTORIAL_STEPS.length) { w.tutorial!.step = k; TUTORIAL_STEPS[k].enter?.(w, seen); }
      else w.tutorial!.step = k;
      return TUTORIAL_STEPS[k]?.id;
    };
    const tickUntil = (id: string, maxTicks: number): void => {
      for (let k = 0; k < maxTicks && advance() === id; k++) sim.tick();
    };

    expect(advance()).toBe('camera');
    seen.panned = true; seen.zoomed = true;
    expect(advance()).toBe('street');

    const path = streetPath(w)!.path!;
    const [x0, y] = path[0];
    for (const [x, py] of path) run(new BuildRoadCommand(x, py, ROAD_STREET));
    expect(advance()).toBe('homes');

    for (let x = x0; x < x0 + 6; x++) { run(new PaintZoneCommand(x, y - 1, ZONE_R)); run(new PaintZoneCommand(x, y + 1, ZONE_R)); }
    expect(advance()).toBe('roads');

    // More road: a second street, south off the first (shops and industry go along it later).
    for (let s = 1; s <= 12; s++) run(new BuildRoadCommand(x0 + 7, y + s, ROAD_STREET));
    expect(advance()).toBe('power');

    const spot = step('power').target!(w)!.area!;
    run(new PlaceBuildingCommand(spot.x, spot.y, BUILDING_POWER_PLANT));
    tickUntil('power', 4);
    expect(advance()).toBe('water');

    run(new PlaceBuildingCommand(x0 + 9, y - 1, BUILDING_WATER_TOWER));
    run(new PlaceBuildingCommand(x0 + 9, y + 1, BUILDING_SEWAGE_PLANT));
    tickUntil('water', 4);
    expect(advance()).toBe('grow');

    tickUntil('grow', 2000);
    expect(advance()).toBe('jobs');

    // Shops and industry along the second street.
    for (let s = 2; s <= 9; s++) { run(new PaintZoneCommand(x0 + 6, y + s, ZONE_C)); }
    for (let s = 5; s <= 12; s++) { run(new PaintZoneCommand(x0 + 8, y + s, ZONE_I)); }
    expect(advance()).toBe('inspect');

    seen.inspectedHome = true;
    seen.inspectedTile = w.grid.idx(x0, y - 1);
    expect(advance()).toBe('services');
    expect(w.tutorial!.service).toBe('police');
    expect(w.tutorial!.forHome).toBe(true);

    // Every lot along the first street is free or a home; the station goes on open land by the second street.
    const zonedBefore = w.layers.zone.reduce((n, z) => n + (z !== 0 ? 1 : 0), 0);
    run(new PlaceBuildingCommand(x0 + 8, y + 2, BUILDING_POLICE));
    expect(w.layers.zone.reduce((n, z) => n + (z !== 0 ? 1 : 0), 0)).toBe(zonedBefore);   // nothing was knocked down
    expect(advance()).toBe('budget');
    seen.budgetOpened = true;
    expect(advance()).toBe('views');
    seen.overlayOn = true;
    expect(advance()).toBe('done');
    seen.cardClosed = true;
    expect(advance()).toBeUndefined();
    expect(w.tutorial!.step).toBe(TUTORIAL_STEPS.length);

    endTutorial(w);
    expect(w.tutorial).toBeUndefined();
    sim.tick(BALANCE.ticksPerDay);
    expect(w.politics.requests).toHaveLength(0);            // no request was ever opened
    expect(w.stats.population).toBeGreaterThanOrEqual(GOALS.population);
    expect(performance.now() - t0).toBeLessThan(10_000);
  }, 30_000);
});
