// Inspect pane redesign, step 1: a verdict line per tile type, only the exceptions shown, the rest folded into Details.
import { describe, it, expect } from 'vitest';
import { ROAD_STREET, BUILDING_POLICE, BUILDING_POWER_PLANT, BUILDING_STATION } from '../sim/constants';
import { landWorld, home } from './pcTestWorld';
import { tileInfoHtml, tileVerdict } from '../ui/TileInfoPanel';

const visibleLines = (html: string) => (html.replace(/<details[\s\S]*<\/details>/, '').match(/<div/g) ?? []).length;
const text = (html: string) => html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');

function town() {
  const w = landWorld(32);
  for (let x = 2; x < 20; x++) w.setRoad(x, 10, ROAD_STREET);
  home(w, 8, 9, 2);
  return w;
}

describe('verdict per type', () => {
  it('a home: stuck on its first missing need; growing once all are met; abandoned with no road', () => {
    const w = town();
    expect(tileVerdict(w, 8, 9)).toMatchObject({ key: 'stuck', tone: 'warn' });
    const i = w.grid.idx(8, 9), L = w.layers;
    L.power[i] = 1; L.water[i] = 1; L.sewage[i] = 1; L.services[i] = 1; L.education[i] = 255;
    w.stats.powerSupply = w.stats.waterSupply = w.stats.sewageSupply = 10;
    expect(tileVerdict(w, 8, 9)).toMatchObject({ key: 'growing', tone: 'ok' });
    L.abandoned[i] = 1;
    expect(tileVerdict(w, 8, 9)!.key).toMatch(/^abandoned/);
    const lone = landWorld(32); home(lone, 8, 9, 2);
    lone.layers.abandoned[lone.grid.idx(8, 9)] = 1;
    expect(tileVerdict(lone, 8, 9)).toMatchObject({ key: 'abandonedNoRoad', tone: 'bad' });
  });
  it('a road: clear, busy, jammed by congestion', () => {
    const w = town(), i = w.grid.idx(5, 10);
    expect(tileVerdict(w, 5, 10)!.key).toBe('clear');
    w.layers.congestion[i] = 100;
    expect(tileVerdict(w, 5, 10)!.key).toBe('busy');
    w.layers.congestion[i] = 200;
    expect(tileVerdict(w, 5, 10)).toMatchObject({ key: 'jammed', tone: 'bad' });
  });
  it('a service building is OK; a plant is short when the city demands more than it supplies', () => {
    const w = town();
    expect(w.placeBuilding(12, 11, BUILDING_POLICE)).toBe(true);
    expect(tileVerdict(w, 12, 11)).toMatchObject({ key: 'ok' });
    expect(w.placeBuilding(15, 11, BUILDING_POWER_PLANT)).toBe(true);
    w.stats.powerDemand = 120; w.stats.powerSupply = 90;
    expect(tileVerdict(w, 15, 11)).toMatchObject({ key: 'plantShort', params: { supply: '90', demand: '120' }, tone: 'bad' });
    w.stats.powerSupply = 200;
    expect(tileVerdict(w, 15, 11)!.key).toBe('ok');
  });
  it('a station with no road is flagged', () => {
    const w = landWorld(32);
    expect(w.placeBuilding(10, 10, BUILDING_STATION)).toBe(true);
    expect(tileVerdict(w, 10, 10)).toMatchObject({ key: 'stationNoRoad', tone: 'bad' });
  });
  it('an empty tile has none', () => {
    expect(tileVerdict(town(), 25, 25)).toBeNull();
  });
});

describe('the pane', () => {
  it('shows the verdict, the unmet needs with a count, and the rest under a collapsed Details', () => {
    const w = town();
    const html = tileInfoHtml(w, 8, 9, false, false);
    const lines = visibleLines(html);
    expect(lines).toBeLessThanOrEqual(10);   // a home with nothing served: the worst case (was 26)
    expect(html).toContain('ti-verdict');
    expect(text(html)).toMatch(/left for Lv 3:/);
    expect(html).toMatch(/<details class="ti-details">/);   // collapsed
    expect(text(html)).toContain('Land value');
    expect(html.indexOf('Land value')).toBeGreaterThan(html.indexOf('<details'));
  });
  it('?debug=true opens Details and adds the raw numbers', () => {
    const w = town();
    const html = tileInfoHtml(w, 8, 9, false, true);
    expect(html).toMatch(/<details class="ti-details" open>/);
  });
  it('a healthy home is a heading, a verdict and the Details toggle', () => {
    const w = town(), i = w.grid.idx(8, 9), L = w.layers;
    L.power[i] = 1; L.water[i] = 1; L.sewage[i] = 1; L.services[i] = 1; L.education[i] = 255;
    w.stats.powerSupply = w.stats.waterSupply = w.stats.sewageSupply = 10;
    const html = tileInfoHtml(w, 8, 9, false, false);
    expect(text(html)).toContain('Growing');
    expect(visibleLines(html)).toBeLessThanOrEqual(8);
  });
});
