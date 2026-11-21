import './pcOffBaseline';
import { describe, it, expect } from 'vitest';
import { TOOLBAR, toolPrice, toolbarItems, hotkeyLabel, toolNuisanceRadius } from '../ui/Toolbar';
import { TEST_NUISANCE } from './pcTestWorld';
import type { ToolbarItem } from '../ui/Toolbar';
import type { Tool } from '../input/InputController';
import { t } from '../i18n';
import { BALANCE } from '../data/balance';

const items: ToolbarItem[] = toolbarItems();
const families = TOOLBAR.flatMap(e => e !== 'sep' && 'family' in e ? [e.family] : []);

const LARGE: Tool[] = ['largePower', 'largeWater', 'largeSewage'];
// Tools with no hotkey of their own.
const NO_HOTKEY: Tool[] = [...LARGE, 'seaport', 'airport', 'rail', 'station', 'stationL', 'railElevated', 'rampElevated', 'railSubway', 'rampSubway', 'subwayStation', 'addWater', 'removeWater', 'midPark', 'bigPark', 'beachPark', 'lido', 'plaza', 'museum', 'stadium', 'sewageWorks', 'waterworks', 'fireHq', 'policeHq', 'generalHospital', 'nuclearPlant', 'university'];

describe('toolbar list', () => {
  it('offers the large plants in normal play', () => {
    const large = items.filter(i => LARGE.includes(i.tool as Tool));
    expect(large).toHaveLength(3);
    for (const i of large) expect(i.shown, i.key).toBeUndefined();
  });

  it('offers every tool exactly once', () => {
    const all: Tool[] = ['none', 'inspect', 'road', 'avenue', 'highway', 'zoneR', 'zoneC', 'zoneI',
      'power', 'water', 'sewage', 'largePower', 'largeWater', 'largeSewage', 'seaport', 'airport', 'rail', 'station', 'stationL', 'railElevated', 'rampElevated', 'railSubway', 'rampSubway', 'subwayStation', 'police', 'fire', 'school', 'hospital', 'park', 'midPark', 'bigPark', 'beachPark', 'lido', 'plaza', 'museum', 'stadium', 'sewageWorks', 'waterworks', 'fireHq', 'policeHq', 'generalHospital', 'nuclearPlant', 'university', 'bulldoze', 'trees', 'addWater', 'removeWater'];
    const offered = items.flatMap(i => i.tool !== undefined ? [i.tool] : []);
    expect([...offered].sort()).toEqual([...all].sort());
  });

  it('gives every item exactly one job', () => {
    for (const i of items) {
      const jobs = [i.tool, i.overlay, i.action].filter(x => x !== undefined);
      expect(jobs, i.key).toHaveLength(1);
    }
  });

  it('has a name and a description for every item, and a name for every family', () => {
    // t() returns the key itself when a string is missing.
    for (const i of items) {
      expect(t('ui.toolbar.' + i.key)).not.toBe('ui.toolbar.' + i.key);
      expect(t('ui.toolbarDesc.' + i.key)).not.toBe('ui.toolbarDesc.' + i.key);
    }
    for (const f of families) expect(t('ui.toolbar.' + f)).not.toBe('ui.toolbar.' + f);
  });

  it('gives every tool and overlay its own hotkey', () => {
    const keys = items.flatMap(i => i.hotkey ? [i.hotkey] : []);
    expect(new Set(keys).size).toBe(keys.length);
    // The large plants and the water tools have no hotkey of their own: they sit in fly-outs.
    for (const i of items) if ((i.tool !== undefined || i.overlay !== undefined) && !NO_HOTKEY.includes(i.tool as Tool)) expect(i.hotkey, i.key).toBeTruthy();
    expect(keys).not.toContain(' ');   // space is pause
  });

  it('writes hotkeys the way each platform does', () => {
    expect(hotkeyLabel('h', false)).toBe('H');
    expect(hotkeyLabel('mod+shift+z', false)).toBe('Ctrl+Shift+Z');
    expect(hotkeyLabel('mod+shift+z', true)).toBe('⌘⇧Z');
  });

  it('knows which tools can upset neighbours, and how far', () => {
    // Shipped rates are 0: nothing is marked until the costs are switched on.
    expect(toolNuisanceRadius('power')).toBe(0);
    expect(toolNuisanceRadius('zoneI')).toBe(0);
    expect(toolNuisanceRadius('power', TEST_NUISANCE)).toBe(6);
    expect(toolNuisanceRadius('zoneI', TEST_NUISANCE)).toBe(6);
    expect(toolNuisanceRadius('zoneR', TEST_NUISANCE)).toBe(0);
    expect(toolNuisanceRadius('park', TEST_NUISANCE)).toBe(0);
    expect(toolNuisanceRadius('road', TEST_NUISANCE)).toBe(0);
    expect(t('ui.toolbar.pcWithin', { n: 6 })).toContain('6 tiles');
  });

  it('calls a tool with a zero price free', () => {
    const costs = BALANCE.costs as { zoneR: number };
    const was = costs.zoneR;
    costs.zoneR = 0;
    try { expect(toolPrice('zoneR').cost).toBe('Free'); } finally { costs.zoneR = was; }
    if (was > 0) expect(toolPrice('zoneR').cost).toBe('$' + was + ' / tile');
  });

  it('reads prices from BALANCE', () => {
    expect(toolPrice('hospital').cost).toBe('$' + BALANCE.buildings[7].cost.toLocaleString('en-US'));
    expect(toolPrice('road').cost).toBe('$' + BALANCE.roadClasses[1].cost + ' / tile');
    expect(toolPrice('none')).toEqual({});
  });
});
