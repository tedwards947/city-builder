// Small DOM helpers shared by the ?debug=true tuning panels (PC, economy):
// headings, folding sections, buttons, number inputs, and inputs generated
// from a BALANCE subtree so new settings appear without touching the panel.

type Tree = Record<string, unknown>;
const isTree = (v: unknown): v is Tree => typeof v === 'object' && v !== null;

export function heading(text: string, depth = 0): HTMLElement {
  const h = document.createElement('div');
  h.textContent = text;
  h.style.cssText = depth === 0
    ? 'margin-top:6px;color:#999;text-transform:uppercase;font-size:10px;letter-spacing:0.04em;'
    : 'margin-top:3px;color:#aab;';
  return h;
}

/** A section with a clickable heading that starts folded. */
export function fold(text: string, content: HTMLElement): HTMLElement {
  const box = document.createElement('div');
  const h = heading('', 0);
  h.style.cursor = 'pointer';
  content.style.display = 'none';
  const set = () => { h.textContent = `${text} ${content.style.display === 'none' ? '▸' : '▾'}`; };
  h.addEventListener('click', () => { content.style.display = content.style.display === 'none' ? '' : 'none'; set(); });
  set();
  box.append(h, content);
  return box;
}

export function smallButton(text: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = text;
  b.style.cssText = 'font-size:10px;padding:0 5px;cursor:pointer;';
  b.addEventListener('click', onClick);
  return b;
}

export function numberInput(get: () => number, set: (v: number) => void, width: number, onChange: () => void): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'number';
  input.value = String(get());
  // Arrow keys and the wheel move by a step that fits the number's size.
  const v0 = Math.abs(get());
  input.step = v0 === 0 ? '0.1' : String(10 ** Math.floor(Math.log10(v0) - 1));
  input.style.cssText = `width:${width}px;font-size:11px;background:#111;color:#fff;border:1px solid #444;border-radius:3px;padding:0 3px;`;
  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    if (Number.isFinite(v)) { set(v); onChange(); }
  });
  return input;
}

function numberRow(text: string, get: () => number, set: (v: number) => void, onChange: () => void): HTMLElement {
  const line = document.createElement('label');
  line.style.cssText = 'display:grid;grid-template-columns:1fr 70px;align-items:center;gap:6px;';
  const name = document.createElement('span');
  name.textContent = text;
  line.append(name, numberInput(get, set, 70, onChange));
  return line;
}

function checkboxRow(text: string, get: () => boolean, set: (v: boolean) => void, onChange: () => void): HTMLElement {
  const line = document.createElement('label');
  line.style.cssText = 'display:grid;grid-template-columns:1fr 70px;align-items:center;gap:6px;cursor:pointer;';
  const name = document.createElement('span');
  name.textContent = text;
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = get();
  box.style.justifySelf = 'start';
  box.addEventListener('change', () => { set(box.checked); onChange(); });
  line.append(name, box);
  return line;
}

export interface BalanceInputOptions {
  label: (key: string) => string;
  /** What a new row looks like in a list that may start empty, by the list's key. */
  rowTemplates?: Record<string, Tree>;
  /** Leave out keys for which this returns true (e.g. a building's cost). */
  skip?: (key: string) => boolean;
  /** Called after any value changes. */
  onChange: () => void;
}

/**
 * Inputs for every number, true/false and list of rows in `tree`, nested
 * objects as indented groups. Values are written straight into the tree.
 */
export function balanceInputs(parent: HTMLElement, tree: Tree, opts: BalanceInputOptions, depth = 0): void {
  for (const key of Object.keys(tree)) {
    if (opts.skip?.(key)) continue;
    const value = tree[key];
    if (typeof value === 'number') {
      parent.appendChild(numberRow(opts.label(key), () => tree[key] as number, (v) => { tree[key] = v; }, opts.onChange));
    } else if (typeof value === 'boolean') {
      parent.appendChild(checkboxRow(opts.label(key), () => tree[key] as boolean, (v) => { tree[key] = v; }, opts.onChange));
    } else if (Array.isArray(value)) {
      parent.appendChild(heading(opts.label(key), depth));
      parent.appendChild(listSection(key, value as Tree[], opts));
    } else if (isTree(value)) {
      parent.appendChild(heading(opts.label(key), depth));
      const box = document.createElement('div');
      box.style.paddingLeft = '6px';
      balanceInputs(box, value, opts, depth + 1);
      parent.appendChild(box);
    }
  }
}

/** A list of rows (fall-off bands, milestones) that can grow and shrink. */
function listSection(key: string, list: Tree[], opts: BalanceInputOptions): HTMLElement {
  const box = document.createElement('div');
  box.style.paddingLeft = '6px';
  const render = () => {
    box.replaceChildren();
    list.forEach((row, k) => {
      const line = document.createElement('div');
      line.style.cssText = 'display:flex;gap:4px;align-items:center;margin:1px 0;';
      for (const field of Object.keys(row)) {
        if (typeof row[field] !== 'number') continue;
        const name = document.createElement('span');
        name.textContent = field;
        name.style.color = '#999';
        line.append(name, numberInput(() => row[field] as number, (v) => { row[field] = v; }, 54, opts.onChange));
      }
      line.appendChild(smallButton('×', () => { list.splice(k, 1); render(); opts.onChange(); }));
      box.appendChild(line);
    });
    box.appendChild(smallButton('+ add', () => {
      const last = list[list.length - 1];
      list.push(last ? { ...last } : { ...(opts.rowTemplates?.[key] ?? {}) });
      render();
      opts.onChange();
    }));
  };
  render();
  return box;
}
