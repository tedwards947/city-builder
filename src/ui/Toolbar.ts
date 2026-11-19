// The toolbar: a palette of icon tiles under the stats panel.
//
// A tile is either one thing (View, Clear, Undo) or a family (Roads, Zones,
// Services…). A family tile shows the member last picked; clicking it arms
// that member and opens a fly-out with the rest, so the common case is one
// click. Everything is built from TOOLBAR below: to add a tool, add an item to
// a family; to add a family, add an entry.

import { BUILDING_LARGE_POWER_PLANT, BUILDING_LARGE_WATER_PLANT, BUILDING_LARGE_SEWAGE_PLANT, BUILDING_SEAPORT, BUILDING_AIRPORT, BUILDING_STATION, BUILDING_STATION_L, BUILDING_RAMP_ELEVATED, BUILDING_RAMP_SUBWAY, BUILDING_SUBWAY_STATION } from '../sim/constants';
import { BRUSH_RADII, landscapeBrush, setLandscapeBrush, treeChoice, setTreeChoice } from '../input/landscape';
import { TREE_SPECIES_MAX } from '../sim/landscaping';
import { WILD_SPECIES, drawTreeIcon, loadWildTrees } from '../render/clay/wildTrees';
import type { Tool, RoadMode } from '../input/InputController';
import { roadClassForTool, zoneForTool, trackLevelForTool } from '../input/InputController';
import type { ZoneMode } from '../input/zoneFill';
import { BALANCE } from '../data/balance';
import { buildingUpkeep } from '../sim/serviceValue';
import {
  BUILDING_POWER_PLANT, BUILDING_WATER_TOWER, BUILDING_SEWAGE_PLANT,
  BUILDING_POLICE, BUILDING_FIRE, BUILDING_SCHOOL, BUILDING_HOSPITAL, BUILDING_PARK,
} from '../sim/constants';
import { nuisanceRings } from '../sim/politics';
import type { NuisanceConfig } from '../sim/politics';
import { PC_SYMBOL } from './pcFormat';
import { ordinancesShown } from './OrdinancePanel';
import { requestLogShown, requestLogState } from './RequestLog';
import { t } from '../i18n';
import { iconSvg } from './toolbarIcons';
import type { IconName } from './toolbarIcons';

export type ToolbarOverlay = 'traffic' | 'crime' | 'fire' | 'vibe' | 'school' | 'health';
export type ToolbarAction = 'new' | 'save' | 'load' | 'budget' | 'ordinances' | 'requests' | 'undo' | 'redo' | 'underground';

/** One pickable thing. `key` names its strings: ui.toolbar.<key> and ui.toolbarDesc.<key>. */
export interface ToolbarItem {
  key: string;
  icon: IconName;
  tool?: Tool;
  overlay?: ToolbarOverlay;
  action?: ToolbarAction;
  /**
   * Keyboard shortcut, lower case. A single key is acted on by main.ts (it
   * picks the tool or toggles the overlay); one with 'mod+' is handled there by
   * hand and is listed here only so the tooltip can show it.
   */
  hotkey?: string;
  /** If given and it returns false, the item is left out (a feature not switched on yet). */
  shown?: () => boolean;
  /** If given and above 0, a small number on the tile (things waiting). */
  count?: () => number;
  /** Extra class for the icon (the zone colours). */
  cls?: string;
  /** In a fly-out, draw a thin line above this item (it starts a new group). */
  sepBefore?: boolean;
}
export interface ToolbarFamily {
  /** Names the family: ui.toolbar.<family>. */
  family: string;
  icon: IconName;
  items: ToolbarItem[];
}
export type ToolbarEntry = ToolbarItem | ToolbarFamily | 'sep';

export const TOOLBAR: ToolbarEntry[] = [
  { key: 'view', icon: 'view', tool: 'none', hotkey: '1' },
  { key: 'inspect', icon: 'inspect', tool: 'inspect', hotkey: 'i' },
  { key: 'clear', icon: 'bulldoze', tool: 'bulldoze', hotkey: '9' },
  { family: 'roads', icon: 'street', items: [
    { key: 'street', icon: 'street', tool: 'road', hotkey: '2' },
    { key: 'avenue', icon: 'avenue', tool: 'avenue', hotkey: 'a' },
    { key: 'highway', icon: 'highway', tool: 'highway', hotkey: 'h' },
  ] },
  // Rail (RAIL_DESIGN.md), by level: ground track and its two stations, then
  // elevated, then subway. Each level after the first starts a new group.
  { family: 'rail', icon: 'track', items: [
    { key: 'track', icon: 'track', tool: 'rail' },
    { key: 'station', icon: 'station', tool: 'station' },
    { key: 'stationL', icon: 'stationL', tool: 'stationL' },
    { key: 'trackElevated', icon: 'trackElevated', tool: 'railElevated', sepBefore: true },
    { key: 'rampElevated', icon: 'rampUp', tool: 'rampElevated' },
    { key: 'trackSubway', icon: 'trackSubway', tool: 'railSubway', sepBefore: true },
    { key: 'rampSubway', icon: 'portal', tool: 'rampSubway' },
    { key: 'subwayStation', icon: 'subway', tool: 'subwayStation' },
  ] },
  // Trade (SEAPORT_DESIGN.md): a yard on land with docks over open water;
  // the airport (art/clay-set/airport3.html): one per city, 12×5, never turned.
  { family: 'ports', icon: 'port', items: [
    { key: 'seaport', icon: 'port', tool: 'seaport' },
    { key: 'airport', icon: 'plane', tool: 'airport' },
  ] },
  { family: 'zones', icon: 'res', items: [
    { key: 'res', icon: 'res', tool: 'zoneR', cls: 'tb-r', hotkey: '3' },
    { key: 'com', icon: 'com', tool: 'zoneC', cls: 'tb-c', hotkey: '4' },
    { key: 'ind', icon: 'ind', tool: 'zoneI', cls: 'tb-i', hotkey: '5' },
  ] },
  { family: 'utilities', icon: 'power', items: [
    { key: 'plant', icon: 'power', tool: 'power', hotkey: '6' },
    { key: 'water', icon: 'water', tool: 'water', hotkey: '7' },
    { key: 'sewage', icon: 'sewage', tool: 'sewage', hotkey: '8' },
    // Buildings on several tiles (BIG_BUILDINGS_DESIGN.md): ?debug=true only until they are balanced.
    { key: 'largePlant', icon: 'power', tool: 'largePower' },
    { key: 'largeWater', icon: 'water', tool: 'largeWater' },
    { key: 'largeSewage', icon: 'sewage', tool: 'largeSewage' },
  ] },
  { family: 'services', icon: 'police', items: [
    { key: 'police', icon: 'police', tool: 'police', hotkey: '0' },
    { key: 'fireStation', icon: 'fire', tool: 'fire', hotkey: 'q' },
    { key: 'school', icon: 'school', tool: 'school', hotkey: 'w' },
    { key: 'hospital', icon: 'hospital', tool: 'hospital', hotkey: 'e' },
    { key: 'park', icon: 'park', tool: 'park', hotkey: 'r' },
  ] },
  // Landscape (art/clay-set/landscape-tools.html, owner's pick A1): a brush for trees and water.
  { family: 'landscape', icon: 'tree', items: [
    { key: 'trees', icon: 'tree', tool: 'trees', hotkey: 'k' },
    { key: 'addWater', icon: 'addWater', tool: 'addWater' },
    { key: 'removeWater', icon: 'removeWater', tool: 'removeWater' },
  ] },
  'sep',
  // Ways of looking at the city: the data maps, then the underground view.
  { family: 'views', icon: 'layers', items: [
    { key: 'traffic', icon: 'traffic', overlay: 'traffic', hotkey: 't' },
    { key: 'crime', icon: 'crime', overlay: 'crime', hotkey: 'c' },
    { key: 'fire', icon: 'fire', overlay: 'fire', hotkey: 'f' },
    { key: 'vibe', icon: 'vibe', overlay: 'vibe', hotkey: 'v' },
    { key: 'schoolMap', icon: 'school', overlay: 'school', hotkey: 'g' },
    { key: 'healthMap', icon: 'hospital', overlay: 'health', hotkey: 'b' },
    // U also switches it (main.ts); no hotkey here, so the key is not handled twice.
    { key: 'undergroundView', icon: 'underground', action: 'underground', sepBefore: true },
  ] },
  { key: 'econ', icon: 'budget', action: 'budget' },
  { key: 'ordinances', icon: 'ordinances', action: 'ordinances', hotkey: 'o', shown: ordinancesShown },
  { key: 'requests', icon: 'requests', action: 'requests', hotkey: 'l', shown: requestLogShown, count: () => requestLogState.open },
  { key: 'undo', icon: 'undo', action: 'undo', hotkey: 'mod+z' },
  { key: 'redo', icon: 'redo', action: 'redo', hotkey: 'mod+shift+z' },
  { family: 'menu', icon: 'menu', items: [
    { key: 'new', icon: 'newCity', action: 'new' },
    { key: 'save', icon: 'save', action: 'save' },
    { key: 'load', icon: 'load', action: 'load' },
  ] },
];

const BUILDING_KIND: Partial<Record<Tool, number>> = {
  power: BUILDING_POWER_PLANT, water: BUILDING_WATER_TOWER, sewage: BUILDING_SEWAGE_PLANT,
  largePower: BUILDING_LARGE_POWER_PLANT, largeWater: BUILDING_LARGE_WATER_PLANT, largeSewage: BUILDING_LARGE_SEWAGE_PLANT, seaport: BUILDING_SEAPORT, airport: BUILDING_AIRPORT, station: BUILDING_STATION, stationL: BUILDING_STATION_L,
  rampElevated: BUILDING_RAMP_ELEVATED, rampSubway: BUILDING_RAMP_SUBWAY, subwayStation: BUILDING_SUBWAY_STATION,
  police: BUILDING_POLICE, fire: BUILDING_FIRE, school: BUILDING_SCHOOL,
  hospital: BUILDING_HOSPITAL, park: BUILDING_PARK,
};
/** Flat per-tile prices, read when asked so a change to BALANCE shows at once. */
function flatCost(tool: Tool): number | undefined {
  const c = BALANCE.costs;
  return tool === 'zoneR' ? c.zoneR : tool === 'zoneC' ? c.zoneC : tool === 'zoneI' ? c.zoneI : tool === 'bulldoze' ? c.bulldoze
    : tool === 'trees' ? c.tree : tool === 'addWater' || tool === 'removeWater' ? c.water : trackLevelForTool(tool) !== undefined ? BALANCE.rail.track[trackLevelForTool(tool)!]?.cost : undefined;
}

/** The building a tool places, if it places one. */
export function buildingKindForTool(tool: Tool): number | undefined {
  return BUILDING_KIND[tool];
}

/**
 * How far (in tiles) homes object to what this tool places, or 0 if it upsets
 * nobody. Political capital has no fixed prices, so the toolbar only says
 * which tools can cost it and when; the amount shows at the pointer.
 */
export function toolNuisanceRadius(tool: Tool, cfg?: NuisanceConfig): number {
  const zone = zoneForTool(tool), kind = BUILDING_KIND[tool];
  const source = zone !== undefined ? { zone } : kind !== undefined ? { kind } : null;
  if (!source) return 0;
  const rings = nuisanceRings(source, cfg);
  return rings.length ? rings[rings.length - 1].within : 0;
}

function money(n: number): string {
  return '$' + (Number.isInteger(n) ? n.toLocaleString('en-US') : n.toFixed(2));
}

/** Price and upkeep of a tool, read from BALANCE so they cannot drift from the sim. */
export function toolPrice(tool: Tool): { cost?: string; upkeep?: string } {
  const roadClass = roadClassForTool(tool);
  if (roadClass !== undefined) {
    const rc = BALANCE.roadClasses[roadClass];
    return { cost: money(rc.cost) + ' / tile', upkeep: money(rc.maintenance) + '/tile/tick' };
  }
  const kind = BUILDING_KIND[tool];
  if (kind !== undefined) {
    const b = BALANCE.buildings[kind];
    return { cost: money(b.cost), upkeep: money(buildingUpkeep(kind)) + '/tick' };
  }
  const flat = flatCost(tool);
  // A tool whose price is set to 0 (zoning, since it became free) is free, not "$0 / tile".
  if (flat === 0) return { cost: t('ui.toolbar.free') };
  return flat !== undefined ? { cost: money(flat) + (tool === 'trees' ? ' / tree' : ' / tile') } : {};
}

/** Every pickable item, families flattened. */
export function toolbarItems(): ToolbarItem[] {
  return TOOLBAR.flatMap(e => e === 'sep' ? [] : 'family' in e ? e.items : [e]);
}

/** A hotkey as shown to the player: "H", "⌘Z" on a Mac, "Ctrl+Shift+Z" elsewhere. */
export function hotkeyLabel(hotkey: string, mac: boolean): string {
  return hotkey.split('+').map(part =>
    part === 'mod' ? (mac ? '⌘' : 'Ctrl')
    : part === 'shift' ? (mac ? '⇧' : 'Shift')
    : part.toUpperCase()).join(mac ? '' : '+');
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '');

export interface ToolbarHooks {
  onTool(tool: Tool): void;
  onOverlay(overlay: ToolbarOverlay): void;
  onAction(action: ToolbarAction): void;
  onRoadMode(mode: RoadMode): void;
  onZoneMode(mode: ZoneMode): void;
}

const isFamily = (e: ToolbarEntry): e is ToolbarFamily => e !== 'sep' && 'family' in e;

function node<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export class Toolbar {
  private readonly root: HTMLElement;
  private readonly hooks: ToolbarHooks;
  private readonly tip: HTMLElement;
  private tool: Tool = 'none';
  private overlay: ToolbarOverlay | 'none' = 'none';
  private roadMode: RoadMode;
  private zoneMode: ZoneMode;
  /** The family whose fly-out is open, if any. */
  private open: string | null = null;
  /** The member each family last had picked (its tile shows that one). */
  private readonly last = new Map<string, string>();
  private shownSig = '';

  constructor(root: HTMLElement, roadMode: RoadMode, zoneMode: ZoneMode, hooks: ToolbarHooks) {
    this.root = root;
    this.roadMode = roadMode;
    this.zoneMode = zoneMode;
    this.hooks = hooks;
    this.tip = node('div', 'tb-tip');
    document.body.append(this.tip);

    document.addEventListener('pointerdown', (e) => {
      if (this.open && !this.root.contains(e.target as Node)) { this.open = null; this.render(); }
    });
    this.render();
  }

  /** Redraws now (a setting changed from the keyboard, e.g. the brush size). */
  refresh(): void { this.render(); }

  /**
   * Call every frame: redraws if an item's `shown` answer changed (a feature
   * switched on or off while the game runs), and otherwise does nothing.
   */
  syncShown(): void {
    const sig = TOOLBAR.map(e => e === 'sep' || isFamily(e) ? '' : (e.shown ? (e.shown() ? '1' : '0') : '') + (e.count ? e.count() : '')).join(',');
    if (sig === this.shownSig) return;
    this.shownSig = sig;
    this.render();
  }

  /** Show `tool` as the armed one (call from wherever the tool changes, keyboard included). */
  setTool(tool: Tool): void {
    this.tool = tool;
    for (const e of TOOLBAR) {
      if (!isFamily(e)) continue;
      const member = e.items.find(i => i.tool === tool);
      if (member) this.last.set(e.family, member.key);
    }
    this.render();
  }

  /** Close the open fly-out, if there is one. Returns whether there was. */
  closeFlyout(): boolean {
    if (!this.open) return false;
    this.open = null;
    this.render();
    return true;
  }

  setOverlay(overlay: ToolbarOverlay | 'none'): void {
    this.overlay = overlay;
    this.render();
  }

  private isOn(item: ToolbarItem): boolean {
    if (item.tool !== undefined) return item.tool === this.tool;
    if (item.overlay !== undefined) return item.overlay === this.overlay;
    return false;
  }

  private pick(item: ToolbarItem): void {
    if (item.tool !== undefined) this.hooks.onTool(item.tool);
    else if (item.overlay !== undefined) this.hooks.onOverlay(item.overlay);
    else if (item.action !== undefined) this.hooks.onAction(item.action);
  }

  /** The member a family tile stands for: the one in use, else the last picked, else the first. */
  private face(f: ToolbarFamily): ToolbarItem | null {
    if (f.items.every(i => i.tool === undefined)) return f.items.find(i => this.isOn(i)) ?? null;
    return f.items.find(i => this.isOn(i))
      ?? f.items.find(i => i.key === this.last.get(f.family))
      ?? f.items[0];
  }

  private render(): void {
    this.hideTip();
    this.root.textContent = '';
    for (const e of TOOLBAR) {
      if (e === 'sep') { this.root.append(node('div', 'tb-sep')); continue; }
      if (!isFamily(e)) {
        if (e.shown && !e.shown()) continue;
        const b = this.tile(e.icon, e.cls, this.isOn(e), false, t('ui.toolbar.' + e.key));
        const n = e.count ? e.count() : 0;
        if (n > 0) b.append(node('span', 'tb-count', String(n)));
        b.addEventListener('click', () => { this.open = null; this.pick(e); this.render(); });
        this.hover(b, () => this.itemTip(e));
        this.root.append(b);
        continue;
      }
      const face = this.face(e);
      const b = this.tile(face?.icon ?? e.icon, face?.cls, face !== null && this.isOn(face), true,
        t('ui.toolbar.' + (face?.key ?? e.family)));
      b.setAttribute('aria-expanded', String(this.open === e.family));
      b.addEventListener('click', () => {
        const opening = this.open !== e.family;
        this.open = opening ? e.family : null;
        if (opening && face?.tool !== undefined) this.pick(face);   // one click re-arms the last member
        this.render();
      });
      this.hover(b, () => this.open === e.family ? null : face ? this.itemTip(face) : { name: t('ui.toolbar.' + e.family) });
      this.root.append(b);
      if (this.open === e.family) this.root.append(this.flyout(e, b));
    }
  }

  private tile(icon: IconName, cls: string | undefined, on: boolean, more: boolean, label: string): HTMLButtonElement {
    const b = node('button', 'tb-tile' + (cls ? ' ' + cls : '') + (on ? ' on' : '') + (more ? ' more' : ''), iconSvg(icon));
    b.type = 'button';
    b.setAttribute('aria-label', label);
    return b;
  }

  private flyout(f: ToolbarFamily, anchor: HTMLElement): HTMLElement {
    const fly = node('div', 'tb-fly');
    fly.appendChild(node('div', 'tb-head', '')).textContent = t('ui.toolbar.' + f.family);
    for (const item of f.items) {
      if (item.shown && !item.shown()) continue;   // e.g. a debug-only tool
      if (item.sepBefore) fly.append(node('div', 'tb-fly-sep'));
      const row = node('button', 'tb-row' + (this.isOn(item) ? ' on' : ''),
        `<span class="tb-ico${item.cls ? ' ' + item.cls : ''}">${iconSvg(item.icon)}</span>`);
      row.type = 'button';
      row.appendChild(node('span', 'tb-name')).textContent = t('ui.toolbar.' + item.key);
      if (item.tool !== undefined && toolNuisanceRadius(item.tool) > 0) {
        row.appendChild(node('span', 'tb-pc')).textContent = PC_SYMBOL + ' ' + t('ui.toolbar.pcNearHomes');
      }
      const cost = item.tool !== undefined ? toolPrice(item.tool).cost : undefined;
      if (cost) row.appendChild(node('span', 'tb-cost')).textContent = cost.replace(' / tile', '').replace(' / tree', '');
      row.addEventListener('click', () => { this.open = null; this.pick(item); this.render(); });
      this.hover(row, () => this.itemTip(item), fly);
      fly.append(row);
    }
    if (f.family === 'roads' || f.family === 'rail') fly.append(this.roadModeSwitch());   // one setting for roads and track
    if (f.family === 'zones') fly.append(this.zoneModeSwitch());
    if (f.family === 'landscape') fly.append(this.landscapeOptions());

    // Line up with the tile, but stay on screen.
    requestAnimationFrame(() => {
      const rootTop = this.root.getBoundingClientRect().top;
      const max = window.innerHeight - 8 - rootTop - fly.offsetHeight;
      fly.style.top = Math.max(-rootTop + 8, Math.min(anchor.offsetTop, max)) + 'px';
    });
    return fly;
  }

  /** Manual / auto road laying, one setting for all three road tools. */
  private roadModeSwitch(): HTMLElement {
    const box = node('div', 'tb-mode');
    box.appendChild(node('div', 'tb-head')).textContent = t('ui.roadMode.title');
    const seg = box.appendChild(node('div', 'tb-seg'));
    const options: Array<[RoadMode, string, string]> = [
      ['auto', t('ui.roadMode.auto'), t('ui.roadMode.autoDesc')],
      ['manual', t('ui.roadMode.manual'), t('ui.roadMode.manualDesc')],
    ];
    for (const [mode, label, desc] of options) {
      const b = node('button', mode === this.roadMode ? 'on' : '');
      b.type = 'button';
      b.textContent = label;
      b.appendChild(node('small', '')).textContent = desc;
      b.addEventListener('click', () => {
        this.roadMode = mode;
        this.hooks.onRoadMode(mode);
        this.render();   // the fly-out stays open: the player still has a road to pick
      });
      seg.append(b);
    }
    return box;
  }

  /** The tree species (Mixed or one of six, shown while Trees is picked) and the brush size, for the Landscape tools. */
  private landscapeOptions(): HTMLElement {
    const box = node('div', 'tb-mode');
    if (this.tool === 'trees') {
      box.appendChild(node('div', 'tb-head')).textContent = t('ui.landscape.species');
      const grid = box.appendChild(node('div', 'tb-species'));
      for (let sp = 0; sp <= TREE_SPECIES_MAX; sp++) {
        const b = node('button', sp === treeChoice() ? 'on' : '');
        b.type = 'button';
        const name = sp === 0 ? t('ui.landscape.mixed') : t(('ui.landscape.' + WILD_SPECIES[sp - 1]) as 'ui.landscape.beech');
        b.setAttribute('aria-label', name);
        b.title = name;
        if (sp === 0) b.textContent = name;
        else {
          const c = document.createElement('canvas'); c.width = 28; c.height = 32;
          const ctx = c.getContext('2d');
          if (ctx && !drawTreeIcon(ctx, sp, 28, 32)) loadWildTrees(() => drawTreeIcon(ctx, sp, 28, 32));
          b.append(c);
        }
        b.addEventListener('click', () => { setTreeChoice(sp); this.render(); });
        grid.append(b);
      }
    }
    box.appendChild(node('div', 'tb-head')).textContent = t('ui.landscape.brush');
    const seg = box.appendChild(node('div', 'tb-seg'));
    for (const r of BRUSH_RADII) {
      const b = node('button', r === landscapeBrush() ? 'on' : '');
      b.type = 'button';
      b.textContent = String(2 * r + 1);
      b.style.textAlign = 'center';
      b.addEventListener('click', () => { setLandscapeBrush(r); this.render(); });
      seg.append(b);
    }
    box.appendChild(node('div', 'tb-hint')).textContent = t('ui.landscape.brushHint');
    return box;
  }

  /** Drag / fill zoning, one setting for all three zone tools. */
  private zoneModeSwitch(): HTMLElement {
    const box = node('div', 'tb-mode');
    box.appendChild(node('div', 'tb-head')).textContent = t('ui.zoneMode.title');
    const seg = box.appendChild(node('div', 'tb-seg'));
    const options: Array<[ZoneMode, string, string]> = [
      ['drag', t('ui.zoneMode.drag'), t('ui.zoneMode.dragDesc')],
      ['fill', t('ui.zoneMode.fill'), t('ui.zoneMode.fillDesc')],
    ];
    for (const [mode, label, desc] of options) {
      const b = node('button', mode === this.zoneMode ? 'on' : '');
      b.type = 'button';
      b.textContent = label;
      b.appendChild(node('small', '')).textContent = desc;
      b.addEventListener('click', () => {
        this.zoneMode = mode;
        this.hooks.onZoneMode(mode);
        this.render();   // the fly-out stays open: the player still has a zone to pick
      });
      seg.append(b);
    }
    return box;
  }

  private itemTip(item: ToolbarItem): TipText {
    const price = item.tool !== undefined ? toolPrice(item.tool) : {};
    const isRoad = item.tool !== undefined && (roadClassForTool(item.tool) !== undefined || trackLevelForTool(item.tool) !== undefined);   // track shares the roads' manual / auto setting
    const isZone = item.tool !== undefined && zoneForTool(item.tool) !== undefined;
    const radius = item.tool !== undefined ? toolNuisanceRadius(item.tool) : 0;
    const kind = item.tool !== undefined ? BUILDING_KIND[item.tool] : undefined;
    const earns = kind !== undefined && (BALANCE.politicalCapital.service.perResident[kind] ?? 0) > 0;
    return {
      pc: radius > 0 ? PC_SYMBOL + ' ' + t('ui.toolbar.pcWithin', { n: radius })
        : earns ? PC_SYMBOL + ' ' + t('ui.toolbar.pcEarns') : undefined,
      pcNote: radius > 0 ? t('ui.toolbar.pcAvoid') : undefined,
      name: t('ui.toolbar.' + item.key),
      desc: t('ui.toolbarDesc.' + item.key),
      cost: price.cost,
      upkeep: price.upkeep ? t('ui.toolbar.upkeep') + ' ' + price.upkeep : undefined,
      hotkey: item.hotkey ? t('ui.toolbar.shortcut') + ' ' + hotkeyLabel(item.hotkey, IS_MAC) : undefined,
      hint: isRoad
        ? (this.roadMode === 'auto' ? t('ui.roadMode.auto') + ': ' + t('ui.roadMode.autoDesc')
                                    : t('ui.roadMode.manual') + ': ' + t('ui.roadMode.manualDesc'))
        : isZone
        ? t('ui.zoneMode.' + this.zoneMode) + ': ' + t('ui.zoneMode.' + this.zoneMode + 'Desc')
        : undefined,
    };
  }

  /** Show a tooltip level with `el`, to the left of `beside` (the whole toolbar, or the open fly-out). */
  private hover(el: HTMLElement, text: () => TipText | null, beside: HTMLElement = this.root): void {
    el.addEventListener('mouseenter', () => {
      const tip = text();
      if (!tip) return;
      this.tip.textContent = '';
      const line = (cls: string, s: string | undefined) => { if (s) this.tip.appendChild(node('div', cls)).textContent = s; };
      line('tb-tip-name', tip.name);
      line('tb-tip-desc', tip.desc);
      line('tb-tip-cost', tip.cost);
      line('tb-tip-pc', tip.pc);
      line('tb-tip-hint', tip.pcNote);
      line('tb-tip-upkeep', tip.upkeep);
      line('tb-tip-hint', tip.hint);
      line('tb-tip-key', tip.hotkey);
      const r = el.getBoundingClientRect();
      this.tip.style.right = (window.innerWidth - beside.getBoundingClientRect().left + 8) + 'px';
      this.tip.style.top = Math.max(8, Math.min(r.top, window.innerHeight - this.tip.offsetHeight - 8)) + 'px';
      this.tip.classList.add('visible');
    });
    el.addEventListener('mouseleave', () => this.hideTip());
  }

  private hideTip(): void { this.tip.classList.remove('visible'); }
}

interface TipText { name: string; desc?: string; cost?: string; upkeep?: string; hint?: string; hotkey?: string; pc?: string; pcNote?: string }
