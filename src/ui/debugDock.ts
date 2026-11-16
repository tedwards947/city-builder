// The column the ?debug=true tuning panels sit in: just left of the
// right-hand HUD column (stats box and toolbar), so they never cover the
// toolbar, and away from the tile inspector on the left. It follows that
// column's width when the window is resized. Panels stack top to bottom and
// the dock scrolls if they are taller than the window.
//
// The whole dock folds down to a small "Debug" tab, and each panel folds to
// its title; both are remembered in localStorage.

const STORE = 'city-builder:debug:';
/** Fired on `window` when the dock folds or unfolds. */
export const DOCK_CHANGED = 'debug-dock-changed';

/** A remembered open/closed choice; `fallback` when nothing is stored or storage is unavailable. */
export function foldOpen(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(STORE + key);
    return v === null ? fallback : v === '1';
  } catch { return fallback; }
}
export function rememberFold(key: string, open: boolean): void {
  try { localStorage.setItem(STORE + key, open ? '1' : '0'); } catch { /* private window: just not remembered */ }
}

/**
 * Makes a panel's title fold the panel down to that title alone: a click
 * shows or hides every element in `parts`, and the choice is remembered
 * under `key`.
 */
export function panelFold(title: HTMLElement, label: string, key: string, parts: readonly HTMLElement[], openByDefault: boolean): void {
  let open = foldOpen(key, openByDefault);
  const apply = () => {
    for (const p of parts) p.style.display = open ? '' : 'none';
    title.textContent = `${label} ${open ? '▾' : '▸'}`;
    title.style.marginBottom = open ? '4px' : '0';
  };
  title.style.cursor = 'pointer';
  title.addEventListener('click', () => { open = !open; rememberFold(key, open); apply(); });
  apply();
}

let panels: HTMLElement | null = null;

/** Where a debug panel goes: append (or prepend) to this. */
export function debugDock(): HTMLElement {
  if (panels) return panels;
  const el = document.createElement('div');
  // The graphics session's Budget, Ordinances and Requests panels open left of this id when it exists.
  el.id = 'debug-dock';
  el.style.cssText = 'position:absolute;top:10px;max-height:calc(100vh - 20px);overflow:auto;'
    + 'display:flex;flex-direction:column;align-items:flex-end;gap:6px;z-index:40;';

  // The tab that folds the whole dock away.
  const tab = document.createElement('button');
  tab.type = 'button';
  tab.style.cssText = 'flex:none;font:bold 11px system-ui,sans-serif;color:#9ad;background:rgba(0,0,0,0.8);'
    + 'border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:4px 9px;cursor:pointer;';
  const list = document.createElement('div');
  list.style.cssText = 'display:flex;flex-direction:column;gap:8px;width:270px;';
  let open = foldOpen('dock', true);
  const apply = () => {
    list.style.display = open ? 'flex' : 'none';
    tab.textContent = open ? 'Debug ▾' : 'Debug ▸';
    tab.title = open ? 'Hide the debug panels' : 'Show the debug panels';
    tab.setAttribute('aria-expanded', String(open));
  };
  // The dock changes width when it folds; panels opened beside it listen for this and move.
  tab.addEventListener('click', () => { open = !open; rememberFold('dock', open); apply(); window.dispatchEvent(new Event(DOCK_CHANGED)); });
  apply();
  el.append(tab, list);

  const place = () => {
    const column = document.getElementById('hud-right');
    const width = column ? column.getBoundingClientRect().width : 200;
    el.style.right = `${Math.round(10 + width + 10)}px`;
  };
  place();
  window.addEventListener('resize', place);
  // The toolbar can change width after load (fonts, a tile shown later).
  const column = document.getElementById('hud-right');
  if (column && typeof ResizeObserver !== 'undefined') new ResizeObserver(place).observe(column);
  document.body.appendChild(el);
  panels = list;
  return list;
}
