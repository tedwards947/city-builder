// The column the ?debug=true tuning panels sit in: just left of the
// right-hand HUD column (stats box and toolbar), so they never cover the
// toolbar, and away from the tile inspector on the left. It follows that
// column's width when the window is resized. Panels stack top to bottom and
// the dock scrolls if they are taller than the window.

let dock: HTMLElement | null = null;

export function debugDock(): HTMLElement {
  if (dock) return dock;
  const el = document.createElement('div');
  // The graphics session's Budget and Ordinances panels open left of this id when it exists.
  el.id = 'debug-dock';
  el.style.cssText = 'position:absolute;top:10px;width:270px;max-height:calc(100vh - 20px);overflow:auto;'
    + 'display:flex;flex-direction:column;gap:8px;z-index:40;';
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
  dock = el;
  return el;
}
