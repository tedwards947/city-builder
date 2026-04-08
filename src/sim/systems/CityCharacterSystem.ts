// CityCharacterSystem — updates the three city-character axes based on player
// actions (via EventBus) and applies a very slow per-tick decay toward neutral.
//
// Design constraints:
//   • NO character meter is shown to the player — character is ambient.
//   • Values are used only for visual palette shifts in CharacterPalette.
//   • Adding a new nudge: add the event key to BALANCE.character.nudges and
//     call _nudge() in the appropriate event handler below.
//   • Area-based character (good/bad neighborhoods) is a Phase 9 extension —
//     world.character stays city-wide for now; the per-tile hook will be a new
//     layer added at that point without restructuring this system.

import type { World } from '../World';
import {
  ZONE_R, ZONE_C, ZONE_I,
  BUILDING_POWER_PLANT,
  BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL, BUILDING_PARK,
} from '../constants';
import { BALANCE } from '../../data/balance';

export class CityCharacterSystem {
  private registeredWorld: World | null = null;

  update(world: World): void {
    if (world !== this.registeredWorld) {
      this._register(world);
    }
    this._decay(world);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _register(world: World): void {
    this.registeredWorld = world;
    const ev = world.events;
    const n = BALANCE.character.nudges;

    // Zone painted — drives green and egalitarian from zone type choice.
    ev.on('zonePainted', (p) => {
      const zone = p.zone as number;
      const displaced = (p.displacedPopulation as number) ?? 0;
      if (zone === ZONE_R) {
        this._nudge(world, 'egalitarian', n.egalitarian.residentialZone);
        this._nudge(world, 'green',       n.green.residentialZone);
        this._nudge(world, 'planned',     n.planned.residentialZone);
      } else if (zone === ZONE_C) {
        this._nudge(world, 'green',       n.green.commercialZone);
      } else if (zone === ZONE_I) {
        this._nudge(world, 'egalitarian', n.egalitarian.industrialZone);
        this._nudge(world, 'green',       n.green.industrialZone);
      }
      if (displaced > 0) {
        this._nudge(world, 'egalitarian', n.egalitarian.populationDisplaced * displaced);
        this._nudge(world, 'planned',     n.planned.populationDisplaced * displaced);
      }
    });

    // Tile cleared via bulldoze — displacement nudges already carry the impact.
    ev.on('tileCleared', (p) => {
      const displaced = (p.displacedPopulation as number) ?? 0;
      if (displaced > 0) {
        this._nudge(world, 'egalitarian', n.egalitarian.populationDisplaced * displaced);
        this._nudge(world, 'planned',     n.planned.populationDisplaced * displaced);
      }
    });

    // Road built — drives planned axis.
    ev.on('roadBuilt', () => {
      this._nudge(world, 'planned', n.planned.roadBuilt);
    });

    // Any building placed — nudge character based on kind.
    ev.on('buildingPlaced', (p) => {
      const kind = p.kind as number;
      if (kind === BUILDING_PARK) {
        this._nudge(world, 'egalitarian', n.egalitarian.parkBuilt);
        this._nudge(world, 'green',       n.green.parkBuilt);
        this._nudge(world, 'planned',     n.planned.serviceBuilt);
      } else if ([BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL].includes(kind)) {
        this._nudge(world, 'egalitarian', n.egalitarian.serviceBuilt);
        this._nudge(world, 'planned',     n.planned.serviceBuilt);
      } else if (kind === BUILDING_POWER_PLANT) {
        this._nudge(world, 'green', n.green.powerPlantBuilt);
      }
    });
  }

  private _nudge(world: World, axis: 'egalitarian' | 'green' | 'planned', delta: number): void {
    const max = BALANCE.character.axisMax;
    world.character[axis] = Math.max(-max, Math.min(max, world.character[axis] + delta));
  }

  private _decay(world: World): void {
    const rate = BALANCE.character.decayRate;
    const c = world.character;
    // Decay toward 0: move each axis by rate toward 0, stopping at 0.
    c.egalitarian = _decayAxis(c.egalitarian, rate);
    c.green       = _decayAxis(c.green,       rate);
    c.planned     = _decayAxis(c.planned,     rate);
  }
}

function _decayAxis(v: number, rate: number): number {
  if (v > 0) return Math.max(0, v - rate);
  if (v < 0) return Math.min(0, v + rate);
  return 0;
}
