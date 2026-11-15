import { describe, it, expect } from 'vitest';
import { TOOLBAR, toolPrice } from '../ui/Toolbar';
import type { ToolbarItem } from '../ui/Toolbar';
import type { Tool } from '../input/InputController';
import { t } from '../i18n';
import { BALANCE } from '../data/balance';

const items: ToolbarItem[] = TOOLBAR.flatMap(e => e === 'sep' ? [] : 'family' in e ? e.items : [e]);
const families = TOOLBAR.flatMap(e => e !== 'sep' && 'family' in e ? [e.family] : []);

describe('toolbar list', () => {
  it('offers every tool exactly once', () => {
    const all: Tool[] = ['none', 'inspect', 'road', 'avenue', 'highway', 'zoneR', 'zoneC', 'zoneI',
      'power', 'water', 'sewage', 'police', 'fire', 'school', 'hospital', 'park', 'bulldoze'];
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

  it('reads prices from BALANCE', () => {
    expect(toolPrice('hospital').cost).toBe('$' + BALANCE.buildings[7].cost.toLocaleString('en-US'));
    expect(toolPrice('road').cost).toBe('$' + BALANCE.roadClasses[1].cost + ' / tile');
    expect(toolPrice('none')).toEqual({});
  });
});
