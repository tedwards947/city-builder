// Landscaping mock engine for landscaping.html. Exploration only, not game code.
// Everything is planned in *sprite pixels* of the 256px review sprites, from the precomputed
// free-ground grid in data.js (see build.mjs), so a plan is resolution independent.
//
//   Landscape.plan(id, approach, seed) → { ground: [fn(ctx)], props: [{ y, draw(ctx) }] }
//     ground: flat things on the soil (decals, edging, prop shadows). The page clips them to the
//             lot's ground mask and darkens them with the building's shadow.
//     props:  things that stand up. Sorted by y so lower ones overlap higher ones.
(function () {
  const LOTS = window.LOTS, PROPS = window.PROPS;
  const TAU = Math.PI * 2;

  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  // Weighted pick: [[value, weight], ...]
  const wpick = (r, arr) => { let t = 0; for (const [, w] of arr) t += w; let x = r() * t; for (const [v, w] of arr) { if ((x -= w) < 0) return v; } return arr[0][0]; };

  // ── Free-ground field per lot (cached) ─────────────────────────────────────
  const fields = {};
  function field(id) {
    if (fields[id]) return fields[id];
    const L = LOTS[id], { cols, rows, cell, grid } = L, n = cols * rows;
    const free = new Uint8Array(n), clear = new Float32Array(n), corr = new Uint8Array(n);
    for (let i = 0; i < n; i++) free[i] = grid[i] !== '0' ? 1 : 0;
    // Chamfer distance (in cells) to the nearest blocked cell or to the plot's edge.
    for (let i = 0; i < n; i++) clear[i] = free[i] ? 99 : 0;
    const at = (x, y) => (x < 0 || y < 0 || x >= cols || y >= rows ? 0 : clear[y * cols + x]);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const i = y * cols + x; if (free[i]) clear[i] = Math.min(clear[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.4, at(x + 1, y - 1) + 1.4); }
    for (let y = rows - 1; y >= 0; y--) for (let x = cols - 1; x >= 0; x--) { const i = y * cols + x; if (free[i]) clear[i] = Math.min(clear[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.4, at(x - 1, y + 1) + 1.4); }
    // Door corridor: from the front step straight down to the plot's front edge. Kept clear of props.
    let door = null;
    if (L.door && L.door.b - L.door.a <= 18 && L.door.y < rows - 4) {
      const c = (L.door.a + L.door.b + 1) / 2, half = L.zone === 'res' ? 3 : Math.min(8, (L.door.b - L.door.a + 1) / 2 + 1);
      for (let y = L.door.y; y < rows; y++) for (let x = Math.max(0, Math.floor(c - half)); x < Math.min(cols, Math.ceil(c + half)); x++) corr[y * cols + x] = 1;
      door = { x: L.left + c * cell, y: L.top + (L.door.y + 1) * cell, half: half * cell };
    }
    let nFree = 0; for (let i = 0; i < n; i++) if (free[i] && !corr[i]) nFree++;
    return (fields[id] = { L, cols, rows, cell, free, clear, corr, door, nFree });
  }

  // A placer hands out non-overlapping spots on free ground.
  function placer(F, r, placed = []) {
    const { L, cols, rows, cell, free, clear, corr } = F;
    const cellFree = (px, py) => { // is this sprite pixel on free ground? Above the plot counts as free (sky).
      const cx = Math.floor((px - L.left) / cell), cy = Math.floor((py - L.top) / cell);
      if (cx < 0 || cx >= cols) return false; if (cy < 0) return true; if (cy >= rows) return false;
      return !!free[cy * cols + cx];
    };
    // R: footprint radius. opts.tall/width: box above the base that must not cover the building.
    // opts.score(cx, cy, clearance, u, v) → higher is better; best of a handful of candidates wins.
    return function place(R, opts = {}) {
      let best = null;
      const want = opts.score ? 10 : 1;
      for (let t = 0, found = 0; t < 90 && found < want; t++) {
        const cx = Math.floor(r() * cols), cy = Math.floor(r() * rows), i = cy * cols + cx;
        if (!free[i] || corr[i] || clear[i] * cell < R + 1) continue;
        if (opts.lit && L.grid[i] === '2') continue;
        const x = L.left + cx * cell + cell / 2 + (r() - 0.5) * 3, y = L.top + cy * cell + cell / 2 + (r() - 0.5) * 3;
        if (placed.some((p) => Math.hypot(p.x - x, (p.y - y) * 1.25) < (p.R + R) * (opts.tight || 1))) continue;
        if (opts.tall) {
          let ok = true; const hw = (opts.width || R * 2) / 2;
          for (let yy = y - opts.tall; yy < y - R * 0.5 && ok; yy += cell) for (let xx = x - hw; xx <= x + hw; xx += cell) if (!cellFree(xx, yy)) { ok = false; break; }
          if (!ok) continue;
        }
        if (opts.box) { // axis-aligned footprint w x h centred on the spot
          let ok = true;
          for (let yy = y - opts.box[1] / 2; yy <= y + opts.box[1] / 2 && ok; yy += cell / 2) for (let xx = x - opts.box[0] / 2; xx <= x + opts.box[0] / 2; xx += cell / 2) {
            const gx = Math.floor((xx - L.left) / cell), gy = Math.floor((yy - L.top) / cell);
            if (gx < 0 || gy < 0 || gx >= cols || gy >= rows || !free[gy * cols + gx] || corr[gy * cols + gx]) { ok = false; break; }
          }
          if (!ok) continue;
        }
        const s = opts.score ? opts.score(cx, cy, clear[i], cx / cols, cy / rows) + r() * 0.15 : 0;
        if (!best || s > best.s) best = { x, y, R, s };
        found++;
      }
      if (best) placed.push(best);
      return best;
    };
  }
  // Placement tastes.
  const nearEdge = (cx, cy, c, u, v) => -Math.min(u, 1 - u, v, 1 - v) * 3;          // hug the plot's rim
  const nearWall = (cx, cy, c) => -c * 0.12;                                          // snug against something
  const corners = (cx, cy, c, u, v) => -(Math.min(u, 1 - u) + Math.min(v, 1 - v)) * 2; // sit in a corner
  const open = (cx, cy, c) => c * 0.1;                                                // middle of open ground
  const back = (cx, cy, c, u, v) => -v;                                               // towards the back

  // ── Drawing helpers ────────────────────────────────────────────────────────
  const circle = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
  const ell = (c, x, y, rx, ry) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); };
  const rrect = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); c.fill(); };
  // The house style for code-drawn things: a darker shape with a lighter one pressed on top, up-left.
  const blob = (c, x, y, r, dark, light) => { c.fillStyle = dark; circle(c, x, y, r); c.fillStyle = light; circle(c, x - r * 0.2, y - r * 0.24, r * 0.68); };
  // Soft shadow falling to the right, like the buildings'. Drawn in the ground layer.
  const shadow = (x, y, R, h = 1) => (c) => {
    const sx = x + R * (0.55 + 0.35 * h), sy = y + R * 0.05, rx = R * (1.05 + 0.3 * h), ry = R * 0.62;
    const g = c.createRadialGradient(sx, sy, 0, sx, sy, rx);
    g.addColorStop(0, 'rgba(25,35,45,0.34)'); g.addColorStop(0.6, 'rgba(25,35,45,0.26)'); g.addColorStop(1, 'rgba(25,35,45,0)');
    c.save(); c.translate(0, sy); c.scale(1, ry / rx); c.translate(0, -sy); c.fillStyle = g; circle(c, sx, sy, rx); c.restore();
  };

  const GREENS = [['#2f7d3a', '#4b9d47'], ['#2a7046', '#45935a'], ['#3d8532', '#62a744']];
  const CANOPY = [['#2f7d3a', '#4b9d47'], ['#2a7046', '#45935a'], ['#3d8532', '#62a744'], ['#c9702a', '#e7953d'], ['#d98aa5', '#f4bccb']];
  const FLOWERS = ['#e9483f', '#f5c93a', '#f7f3ea', '#e87fb0', '#8f6fd6'];

  // ── A: flat pressed-clay props, drawn by code ──────────────────────────────
  const A = {
    bush(x, y, R, col) { return { y, draw(c) { blob(c, x, y - R * 0.45, R, col[0], col[1]); } }; },
    tree(x, y, R, col) {
      return { y, draw(c) {
        c.fillStyle = '#5f3f28'; rrect(c, x - R * 0.16, y - R * 0.9, R * 0.32, R * 0.9 + 1, 1.5); c.fillStyle = '#84593a'; rrect(c, x - R * 0.16, y - R * 0.9, R * 0.18, R * 0.9, 1.5);
        const cy = y - R * 1.45;
        c.fillStyle = col[0]; circle(c, x - R * 0.5, cy + R * 0.25, R * 0.66); circle(c, x + R * 0.5, cy + R * 0.25, R * 0.66); circle(c, x, cy - R * 0.2, R * 0.8);
        c.fillStyle = col[1]; circle(c, x - R * 0.2, cy - R * 0.38, R * 0.52); circle(c, x - R * 0.62, cy + R * 0.12, R * 0.34); circle(c, x + R * 0.36, cy + R * 0.1, R * 0.32);
      } };
    },
    bed(x, y, w, h, r, veg) {
      const dots = []; for (let i = 0; i < Math.round(w * h / 22); i++) dots.push([x - w / 2 + 2 + r() * (w - 4), y - h / 2 + 1.5 + r() * (h - 3.5), pick(r, FLOWERS)]);
      return { y: y + h / 2, draw(c) {
        c.fillStyle = '#5d3d28'; rrect(c, x - w / 2, y - h / 2, w, h, 3);
        c.fillStyle = '#7d5638'; rrect(c, x - w / 2 + 1.2, y - h / 2 + 1, w - 2.4, h - 3.4, 2.2);
        if (veg) { c.fillStyle = '#4b9d47'; for (let yy = y - h / 2 + 4; yy < y + h / 2 - 3; yy += 5.2) { c.fillStyle = '#6a4830'; c.fillRect(x - w / 2 + 2, yy + 1.2, w - 4, 1.2); c.fillStyle = '#4b9d47'; for (let xx = x - w / 2 + 4; xx < x + w / 2 - 3; xx += 4.6) circle(c, xx, yy, 1.7); } }
        else for (const [dx, dy, col] of dots) { c.fillStyle = '#3d8532'; circle(c, dx + 0.6, dy + 0.8, 1.9); c.fillStyle = col; circle(c, dx, dy, 1.7); }
      } };
    },
    stones(F, r) { // stepping stones from the door to the front edge (ground layer)
      const d = F.door; if (!d) return null;
      const y1 = F.L.front - 3; if (y1 - d.y < 9) return null;
      const st = []; for (let y = d.y + 3, k = 0; y < y1; y += 8, k++) st.push([d.x + (k % 2 ? 2 : -2) + (r() - 0.5), y, 4.8 + r() * 0.8]);
      return (c) => { for (const [x, y, w] of st) { c.fillStyle = '#9a9a94'; ell(c, x + 0.4, y + 0.5, w, w * 0.62); c.fillStyle = '#c9c7bd'; ell(c, x, y, w * 0.9, w * 0.52); } };
    },
    planter(x, y, R, col) { return { y, draw(c) { c.fillStyle = '#8a4f33'; ell(c, x, y - R * 0.25, R, R * 0.72); c.fillStyle = '#b86d45'; ell(c, x, y - R * 0.5, R, R * 0.66); blob(c, x, y - R * 0.95, R * 0.82, col[0], col[1]); } }; },
    bench(x, y) { return { y, draw(c) { c.translate(x, y); c.scale(1.5, 1.5); c.translate(-x, -y); c.fillStyle = '#6b4226'; rrect(c, x - 8, y - 5, 16, 5.5, 1.2); c.fillStyle = '#a56c3e'; rrect(c, x - 8, y - 7, 16, 4.6, 1.2); c.fillStyle = '#c08650'; c.fillRect(x - 7, y - 6.2, 14, 1.2); } }; },
    bikes(x, y, r) { const col = pick(r, ['#d9463c', '#3f7fd0', '#e3b02f']); return { y, draw(c) { c.translate(x, y); c.scale(1.5, 1.5); c.translate(-x, -y); c.strokeStyle = '#7d848e'; c.lineWidth = 1.3; for (let i = -1; i <= 1; i++) { c.beginPath(); c.arc(x + i * 5, y - 2, 2.6, Math.PI, 0); c.stroke(); } c.strokeStyle = '#2c2f35'; c.lineWidth = 1.1; c.beginPath(); c.arc(x - 3.2, y - 2.4, 2.2, 0, TAU); c.stroke(); c.beginPath(); c.arc(x + 3.2, y - 2.4, 2.2, 0, TAU); c.stroke(); c.strokeStyle = col; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x - 3.2, y - 2.4); c.lineTo(x - 0.5, y - 5.6); c.lineTo(x + 3.2, y - 2.4); c.stroke(); } }; },
    crate(x, y, s) { return { y, draw(c) { c.fillStyle = '#8a5f33'; rrect(c, x - s / 2, y - s * 0.75, s, s * 0.8, 1); c.fillStyle = '#c1905a'; rrect(c, x - s / 2, y - s * 1.1, s, s * 0.72, 1); c.strokeStyle = '#8a5f33'; c.lineWidth = 0.9; c.strokeRect(x - s / 2 + 1.3, y - s * 1.1 + 1.3, s - 2.6, s * 0.72 - 2.6); } }; },
    barrel(x, y, R, col) { return { y, draw(c) { c.fillStyle = col[0]; rrect(c, x - R, y - R * 1.7, R * 2, R * 1.9, R * 0.5); ell(c, x, y - R * 0.1, R, R * 0.55); c.fillStyle = col[1]; ell(c, x, y - R * 1.7, R, R * 0.6); c.fillStyle = col[0]; ell(c, x, y - R * 1.7, R * 0.55, R * 0.3); } }; },
    tyres(x, y, R) { return { y, draw(c) { for (let k = 0; k < 3; k++) { const yy = y - R * 0.3 - k * R * 0.55; c.fillStyle = '#1e2126'; ell(c, x, yy, R, R * 0.62); c.fillStyle = '#3a3e45'; ell(c, x, yy - R * 0.14, R * 0.86, R * 0.5); } c.fillStyle = '#16181c'; ell(c, x, y - R * 1.55, R * 0.42, R * 0.24); } }; },
    scrub(x, y, R, r) { const b = []; for (let i = 0; i < 5; i++) b.push([x + (r() - 0.5) * R * 1.8, y - r() * R * 0.5, R * (0.3 + r() * 0.25)]); return { y, draw(c) { for (const [bx, by, br] of b) blob(c, bx, by - br * 0.6, br, '#7f8a3a', '#a3aa55'); } }; },
    puddle(x, y, R, r) { const b = []; for (let i = 0; i < 4; i++) b.push([x + (r() - 0.5) * R, y + (r() - 0.5) * R * 0.5, R * (0.45 + r() * 0.3)]); return (c) => { c.fillStyle = '#6f7f8c'; for (const [bx, by, br] of b) ell(c, bx, by, br, br * 0.55); c.fillStyle = '#93a7b5'; for (const [bx, by, br] of b) ell(c, bx - br * 0.15, by - br * 0.1, br * 0.6, br * 0.3); }; },
    bays(F, r) { // painted parking bays along a free strip at the front (ground layer)
      const L = F.L, y1 = L.front - 3, y0 = y1 - 20; const xs = []; for (let x = L.left + 8; x < L.right - 6; x += 15) xs.push(x);
      return (c) => { c.fillStyle = 'rgba(250,250,250,0.9)'; for (const x of xs) c.fillRect(x, y0, 1.6, y1 - y0); c.fillRect(xs[0], y0, xs[xs.length - 1] - xs[0] + 1.6, 1.6); };
    },
  };

  function planA(F, r) {
    const { L } = F, place = placer(F, r), ground = [], props = [];
    const budget = F.nFree / 190, add = (p, R, h) => { if (!p) return; ground.push(shadow(p.x, p.y, R, h)); };
    if (L.zone === 'res') {
      const theme = wpick(r, [['trees', 3], ['flowers', 3], ['veg', 2], ['bushes', 2], ['mixed', 3], ['bare', 1]]);
      if (theme !== 'bare' && r() < 0.75) { const s = A.stones(F, r); if (s) ground.push(s); }
      const nT = theme === 'trees' ? 2 + (budget > 5) : theme === 'mixed' ? 1 : theme === 'bushes' ? 0 : r() < 0.4 ? 1 : 0;
      for (let i = 0; i < Math.min(nT, Math.ceil(budget / 2)); i++) { const R = 13 + r() * 4, p = place(R * 0.6, { tall: R * 2.3, width: R * 2, score: corners }); if (p) { add(p, R * 0.8, 1.3); props.push(A.tree(p.x, p.y, R, wpick(r, [[CANOPY[0], 3], [CANOPY[1], 2], [CANOPY[2], 2], [CANOPY[3], 1], [CANOPY[4], 1]]))); } }
      if (theme === 'flowers' || theme === 'mixed' || theme === 'veg') {
        const nb = theme === 'mixed' ? 1 : Math.min(2, Math.ceil(budget / 3));
        for (let i = 0; i < nb; i++) { const w = 28 + Math.floor(r() * 3) * 8, h = theme === 'veg' ? 22 : 13, p = place(Math.max(w, h) / 2 * 0.8, { box: [w + 2, h + 2], score: theme === 'veg' ? back : nearWall, lit: true }); if (p) props.push(A.bed(p.x, p.y, w, h, r, theme === 'veg')); }
      }
      const nB = theme === 'bare' ? 0 : theme === 'bushes' ? Math.min(7, Math.round(budget)) : Math.min(4, Math.round(budget / 2));
      for (let i = 0; i < nB; i++) { const R = 6.5 + r() * 3.5, p = place(R, { score: theme === 'bushes' ? nearEdge : nearWall, tight: 0.8 }); if (p) { add(p, R, 0.4); props.push(A.bush(p.x, p.y, R, pick(r, GREENS))); } }
    } else if (L.zone === 'com') {
      const theme = wpick(r, [['planters', 3], ['seating', 3], ['bikes', 2], ['bays', L.level === 1 ? 2 : 0], ['bare', 1]]);
      if (theme === 'bays' && F.door == null) ground.push(A.bays(F, r));
      const nP = theme === 'bare' ? 0 : theme === 'planters' ? Math.min(5, Math.round(budget)) : Math.min(2, Math.round(budget / 2));
      for (let i = 0; i < nP; i++) { const R = 6.5, p = place(R + 1, { score: theme === 'planters' ? nearEdge : nearWall }); if (p) { add(p, R, 0.6); props.push(A.planter(p.x, p.y, R, pick(r, GREENS))); } }
      if (theme === 'seating') for (let i = 0; i < Math.min(2, Math.ceil(budget / 3)); i++) { const p = place(12, { box: [26, 12], score: nearWall }); if (p) { add(p, 10, 0.3); props.push(A.bench(p.x, p.y + 5)); } }
      if (theme === 'bikes') for (let i = 0; i < Math.min(2, Math.ceil(budget / 3)); i++) { const p = place(12, { box: [26, 12], score: nearWall }); if (p) props.push(A.bikes(p.x, p.y + 4, r)); }
      if (theme !== 'bare' && r() < 0.5) { const R = 12 + r() * 3, p = place(R * 0.6, { tall: R * 2.3, width: R * 2, score: corners }); if (p) { add(p, R * 0.8, 1.3); props.push(A.tree(p.x, p.y, R, pick(r, GREENS))); } }
    } else {
      const theme = wpick(r, [['crates', 3], ['barrels', 3], ['tyres', 2], ['scrub', 3], ['bare', 1]]);
      if (theme !== 'bare' && r() < 0.6) for (let i = 0; i < 1 + (r() < 0.4); i++) { const R = 11 + r() * 6, p = place(R, { score: open }); if (p) ground.push(A.puddle(p.x, p.y, R, r)); }
      const n = theme === 'bare' ? 0 : Math.min(5, Math.max(1, Math.round(budget * 0.9)));
      for (let i = 0; i < n; i++) {
        const kind = r() < 0.7 ? theme : pick(r, ['crates', 'barrels', 'tyres', 'scrub']);
        if (kind === 'crates') { const s = 12 + r() * 4, p = place(s * 0.7, { score: nearWall, tight: 0.75 }); if (p) { add(p, s * 0.7, 0.6); props.push(A.crate(p.x, p.y + 2, s)); } }
        if (kind === 'barrels') { const R = 5, p = place(R + 1.5, { score: nearWall, tight: 0.7 }); if (p) { add(p, R * 1.3, 0.8); props.push(A.barrel(p.x, p.y + 1, R, pick(r, [['#2f5f9e', '#5b8fd0'], ['#9c4a2f', '#c9704c'], ['#3d7a4a', '#62a56e']]))); } }
        if (kind === 'tyres') { const R = 7, p = place(R + 1, { score: nearEdge }); if (p) { add(p, R, 0.7); props.push(A.tyres(p.x, p.y + 1, R)); } }
        if (kind === 'scrub') { const R = 10 + r() * 4, p = place(R, { score: nearEdge, tight: 0.8 }); if (p) { add(p, R * 0.6, 0.2); props.push(A.scrub(p.x, p.y + 2, R, r)); } }
      }
    }
    return { ground, props };
  }

  // ── B: whole-edge treatments ───────────────────────────────────────────────
  // Runs are flat bands just inside the plot rim, drawn in the ground layer, so the building and
  // its shadow sit over them for free.
  function planB(F, r, o = {}) {
    const { L } = F, ground = [];
    const x0 = L.left + 2, x1 = L.right - 1, y0 = L.top + 2, y1 = L.front - 1;
    const styles = { res: [['hedge', 3], ['picket', 3], ['wall', 2], ['border', 2], ['none', 1]], com: [['planters', 3], ['bollards', 2], ['brick', 3], ['verge', 2], ['none', 1]], ind: [['chainlink', 3], ['hazard', 2], ['wall', 3], ['scrubline', 2], ['none', 1]] }[L.zone];
    const style = o.style || wpick(r, styles);
    const sides = wpick(r, [['all', 3], ['front', 2], ['frontsides', 2], ['backsides', 2]]);
    const has = (s) => o.sides ? o.sides.includes(s) : sides === 'all' || (s === 'front' && sides !== 'backsides') || (s === 'back' && sides === 'backsides') || ((s === 'left' || s === 'right') && sides !== 'front');
    // Gap in the front run for the door / driveway.
    const gapC = F.door ? F.door.x : (x0 + x1) / 2, gapH = o.gapH || (L.zone === 'res' ? 9 : Math.max(16, F.door ? F.door.half + 4 : 16));
    const gap = style === 'brick' || style === 'verge' || (o.sides && !o.gate) ? null : [gapC - gapH, gapC + gapH];
    const hruns = (y, th, fn) => { if (!gap || y < y1 - 30) fn(x0, x1 - x0, y); else { if (gap[0] - x0 > 6) fn(x0, gap[0] - x0, y); if (x1 - gap[1] > 6) fn(gap[1], x1 - gap[1], y); } };
    const tex = []; for (let i = 0; i < 60; i++) tex.push(r());
    const P = {
      hedge: { th: 8, h(c, x, len, y) { c.fillStyle = '#2b7436'; rrect(c, x, y, len, 8, 3); c.fillStyle = '#4c9c47'; rrect(c, x + 0.8, y, len - 1.6, 5, 2.5); c.fillStyle = '#63b058'; if (!o.plain) for (let i = 0; i * 9 < len - 6; i++) circle(c, x + 4 + i * 9 + tex[i % 60] * 3, y + 1.8 + tex[(i + 7) % 60], 1.1); },
        v(c, x, y, len) { c.fillStyle = '#2b7436'; rrect(c, x, y, 7, len, 3); c.fillStyle = '#4c9c47'; rrect(c, x + 0.8, y, 5, len - 3, 2.5); c.fillStyle = '#63b058'; if (!o.plain) for (let i = 0; i * 9 < len - 8; i++) circle(c, x + 2.5 + tex[i % 60], y + 5 + i * 9 + tex[(i + 9) % 60] * 3, 1.1); } },
      picket: { th: 8, h(c, x, len, y) { c.fillStyle = 'rgba(30,40,50,0.22)'; c.fillRect(x + 1.5, y + 7.4, len, 1.6); c.fillStyle = '#d9d3c3'; c.fillRect(x, y + 3, len, 1.6); for (let px = x; px < x + len - 2; px += 6) { c.fillStyle = '#d9d3c3'; rrect(c, px, y + 0.6, 3.2, 7.2, 1.2); c.fillStyle = '#f7f3ea'; rrect(c, px, y, 2.6, 6.8, 1.2); } },
        v(c, x, y, len) { c.fillStyle = 'rgba(30,40,50,0.2)'; c.fillRect(x + 3, y + 2, 2, len - 2); c.fillStyle = '#d9d3c3'; c.fillRect(x + 0.6, y, 1.6, len); for (let py = y; py < y + len - 4; py += 7) { c.fillStyle = '#d9d3c3'; rrect(c, x, py + 0.6, 3, 5, 1.1); c.fillStyle = '#f7f3ea'; rrect(c, x, py, 2.5, 4.4, 1.1); } } },
      wall: { th: 7, col: L.zone === 'ind' ? ['#7b7f86', '#a9adb3'] : pick(r, [['#8d5140', '#bd7a62'], ['#84888f', '#b4b8be']]),
        h(c, x, len, y) { c.fillStyle = this.col[0]; rrect(c, x, y, len, 7, 1.5); c.fillStyle = this.col[1]; rrect(c, x, y, len, 3.6, 1.5); c.fillStyle = this.col[0]; for (let px = x + 7; px < x + len - 2; px += 8) c.fillRect(px, y, 0.8, 3.6); },
        v(c, x, y, len) { c.fillStyle = this.col[0]; rrect(c, x, y, 5, len, 1.5); c.fillStyle = this.col[1]; rrect(c, x, y, 5, len - 3.2, 1.5); c.fillStyle = this.col[0]; for (let py = y + 7; py < y + len - 5; py += 8) c.fillRect(x, py, 5, 0.8); } },
      border: { th: 7, h(c, x, len, y) { c.fillStyle = '#5d3d28'; rrect(c, x, y, len, 7, 2.5); c.fillStyle = '#7d5638'; rrect(c, x + 0.8, y + 0.6, len - 1.6, 5, 2); for (let i = 0; i * 4.5 < len - 5; i++) { const fx = x + 3 + i * 4.5, fy = y + 2 + tex[i % 60] * 2.4; c.fillStyle = '#3d8532'; circle(c, fx + 0.5, fy + 0.6, 1.3); c.fillStyle = FLOWERS[Math.floor(tex[(i + 13) % 60] * 5)]; circle(c, fx, fy, 1.25); } },
        v(c, x, y, len) { c.fillStyle = '#5d3d28'; rrect(c, x, y, 7, len, 2.5); c.fillStyle = '#7d5638'; rrect(c, x + 0.8, y + 0.6, 5.4, len - 2, 2); for (let i = 0; i * 4.5 < len - 5; i++) { const fy = y + 3 + i * 4.5, fx = x + 2.2 + tex[i % 60] * 2.4; c.fillStyle = '#3d8532'; circle(c, fx + 0.5, fy + 0.6, 1.3); c.fillStyle = FLOWERS[Math.floor(tex[(i + 13) % 60] * 5)]; circle(c, fx, fy, 1.25); } } },
      planters: { th: 9, h(c, x, len, y) { for (let px = x + 2; px + 18 < x + len; px += 24) { c.fillStyle = 'rgba(30,40,50,0.2)'; rrect(c, px + 2, y + 2.5, 19, 7.5, 2); c.fillStyle = '#7a4a30'; rrect(c, px, y + 1, 18, 8, 2); c.fillStyle = '#a8663f'; rrect(c, px, y, 18, 6, 2); for (let k = 0; k < 4; k++) blob(c, px + 3 + k * 4, y + 2.6, 2.6, '#2f7d3a', '#55a74c'); } },
        v(c, x, y, len) { for (let py = y + 4; py + 18 < y + len; py += 26) { c.fillStyle = 'rgba(30,40,50,0.2)'; rrect(c, x + 2, py + 2, 8, 18, 2); c.fillStyle = '#7a4a30'; rrect(c, x, py, 8, 18, 2); c.fillStyle = '#a8663f'; rrect(c, x, py, 8, 15.5, 2); for (let k = 0; k < 4; k++) blob(c, x + 4, py + 3 + k * 3.6, 2.6, '#2f7d3a', '#55a74c'); } } },
      bollards: { th: 6, h(c, x, len, y) { for (let px = x + 4; px < x + len - 2; px += 11) { c.fillStyle = 'rgba(30,40,50,0.25)'; ell(c, px + 2.4, y + 4.6, 3, 1.6); c.fillStyle = '#3c4149'; rrect(c, px - 1.8, y, 3.6, 5.6, 1.6); c.fillStyle = '#f0c232'; ell(c, px, y + 0.6, 1.8, 1.1); } },
        v(c, x, y, len) { for (let py = y + 6; py < y + len - 4; py += 12) { c.fillStyle = 'rgba(30,40,50,0.25)'; ell(c, x + 4.6, py + 4.4, 3, 1.6); c.fillStyle = '#3c4149'; rrect(c, x + 0.4, py, 3.6, 5.6, 1.6); c.fillStyle = '#f0c232'; ell(c, x + 2.2, py + 0.6, 1.8, 1.1); } } },
      brick: { th: 11, h(c, x, len, y) { c.fillStyle = '#b06e58'; c.fillRect(x - 2, y - 2, len + 4, 11); c.fillStyle = 'rgba(90,40,30,0.35)'; for (let px = x - 2; px < x + len + 2; px += 5.5) c.fillRect(px, y - 2, 0.8, 11); c.fillRect(x - 2, y + 3.2, len + 4, 0.8); },
        v(c, x, y, len) { c.fillStyle = '#b06e58'; c.fillRect(x - 2, y - 2, 11, len + 4); c.fillStyle = 'rgba(90,40,30,0.35)'; for (let py = y - 2; py < y + len + 2; py += 5.5) c.fillRect(x - 2, py, 11, 0.8); c.fillRect(x + 3.2, y - 2, 0.8, len + 4); } },
      verge: { th: 9, h(c, x, len, y) { c.fillStyle = '#9aa0a8'; rrect(c, x - 0.5, y - 0.5, len + 1, 9.5, 2.5); c.fillStyle = '#5c9f4c'; rrect(c, x + 0.8, y + 0.8, len - 1.6, 7, 2); c.fillStyle = '#74b85e'; rrect(c, x + 1.6, y + 1.2, len - 3.2, 3.4, 1.6); },
        v(c, x, y, len) { c.fillStyle = '#9aa0a8'; rrect(c, x - 0.5, y - 0.5, 9.5, len + 1, 2.5); c.fillStyle = '#5c9f4c'; rrect(c, x + 0.8, y + 0.8, 7, len - 1.6, 2); c.fillStyle = '#74b85e'; rrect(c, x + 1.4, y + 1.4, 3.4, len - 3.2, 1.6); } },
      chainlink: { th: 9, h(c, x, len, y) { c.fillStyle = 'rgba(30,40,50,0.2)'; c.fillRect(x + 1.5, y + 8.2, len, 1.4); c.fillStyle = 'rgba(120,128,138,0.38)'; c.fillRect(x, y + 1, len, 6.4); c.fillStyle = '#8b929c'; c.fillRect(x, y + 0.6, len, 1.1); c.fillRect(x, y + 6.8, len, 0.9); for (let px = x; px < x + len; px += 13) { c.fillStyle = '#5e646d'; rrect(c, px, y - 0.4, 2.2, 9, 1); } rrect(c, x + len - 2.2, y - 0.4, 2.2, 9, 1); },
        v(c, x, y, len) { c.fillStyle = 'rgba(30,40,50,0.2)'; c.fillRect(x + 2.4, y + 2, 1.6, len - 2); c.fillStyle = '#8b929c'; c.fillRect(x + 0.5, y, 1.1, len); for (let py = y; py < y + len - 4; py += 13) { c.fillStyle = '#5e646d'; rrect(c, x, py, 2.2, 6, 1); } } },
      hazard: { th: 5, h(c, x, len, y) { c.fillStyle = '#2b2d31'; rrect(c, x, y + 0.8, len, 5, 1.2); c.save(); c.beginPath(); c.roundRect(x, y, len, 4.4, 1.2); c.clip(); c.fillStyle = '#f0c232'; c.fillRect(x, y, len, 4.4); c.fillStyle = '#2b2d31'; for (let px = x - 4; px < x + len; px += 8) { c.beginPath(); c.moveTo(px, y + 4.4); c.lineTo(px + 4, y); c.lineTo(px + 8, y); c.lineTo(px + 4, y + 4.4); c.fill(); } c.restore(); },
        v(c, x, y, len) { c.save(); c.beginPath(); c.roundRect(x, y, 4.4, len, 1.2); c.clip(); c.fillStyle = '#f0c232'; c.fillRect(x, y, 4.4, len); c.fillStyle = '#2b2d31'; for (let py = y - 4; py < y + len; py += 8) { c.beginPath(); c.moveTo(x, py); c.lineTo(x + 4.4, py + 4); c.lineTo(x + 4.4, py + 8); c.lineTo(x, py + 4); c.fill(); } c.restore(); } },
      scrubline: { th: 8, h(c, x, len, y) { for (let i = 0; i * 5 < len - 4; i++) { const t = tex[i % 60]; if (t < 0.25) continue; blob(c, x + 3 + i * 5 + t * 2, y + 3 + tex[(i + 5) % 60] * 2.5, 2 + t * 2, '#7f8a3a', '#a3aa55'); } },
        v(c, x, y, len) { for (let i = 0; i * 5 < len - 4; i++) { const t = tex[(i + 20) % 60]; if (t < 0.25) continue; blob(c, x + 3 + tex[(i + 5) % 60] * 2.5, y + 3 + i * 5 + t * 2, 2 + t * 2, '#7f8a3a', '#a3aa55'); } } },
    }[style];
    if (P) {
      ground.push((c) => {
        if (has('back')) P.h(c, x0, x1 - x0, y0);
        if (has('left')) P.v(c, x0, y0, y1 - y0);
        if (has('right')) P.v(c, x1 - (style === 'hedge' || style === 'border' ? 7 : style === 'planters' ? 8 : style === 'brick' || style === 'verge' ? 9 : 5), y0, y1 - y0);
        if (has('front')) hruns(y1 - P.th, P.th, (x, len, y) => P.h(c, x, len, y));
      });
    }
    return { ground, props: [], label: style === 'none' ? 'none' : style + ' · ' + sides };
  }

  // ── C: generated clay props (cut-outs from the prop sheets) ────────────────
  // w: drawn width in sprite px; R: footprint radius; base: where the prop meets the ground, as a
  // fraction of image height; tall: needs clear space above so it never covers the building.
  const SPEC = {
    tree: { w: 40, R: 7, base: 0.93, tall: 1 }, pine: { w: 34, R: 7, base: 0.93, tall: 1 }, 'tree-autumn': { w: 36, R: 6, base: 0.95, tall: 1 }, 'tree-blossom': { w: 40, R: 7, base: 0.95, tall: 1 },
    bush: { w: 22, R: 8, base: 0.8 }, 'berry-bush': { w: 28, R: 10, base: 0.8 }, flowerbed2: { w: 38, R: 13, base: 0.7 }, vegpatch2: { w: 40, R: 14, base: 0.7 }, flowerbed: { w: 36, R: 13, base: 0.7 }, pond: { w: 34, R: 13, base: 0.6, flat: 1 }, boulders: { w: 24, R: 9, base: 0.85 },
    planter: { w: 17, R: 6.5, base: 0.85 }, planterbox: { w: 32, R: 12, base: 0.75 }, bench: { w: 26, R: 10, base: 0.85 }, bench2: { w: 26, R: 10, base: 0.85 }, parasol: { w: 28, R: 10, base: 0.9, tall: 0.6 }, bikerack: { w: 28, R: 11, base: 0.85 }, bin: { w: 12, R: 5, base: 0.92 }, cone: { w: 9, R: 4, base: 0.85 },
    crates: { w: 26, R: 10, base: 0.85 }, barrels: { w: 24, R: 9, base: 0.9 }, tyres: { w: 22, R: 8.5, base: 0.88 }, pallets: { w: 26, R: 10, base: 0.8 }, barrier: { w: 30, R: 11, base: 0.8 }, scrub: { w: 22, R: 8, base: 0.85 },
  };
  function planC(F, r, images, density = 1) {
    const { L } = F, place = placer(F, r), ground = [], props = [];
    const budget = (F.nFree / 190) * density;
    const put = (name, score, scale = 1) => {
      const s = SPEC[name], im = images && images['prop:' + name], meta = PROPS[name]; if (!s || !meta) return false;
      const w = s.w * scale, h = w * meta.h / meta.w, R = s.R * scale;
      const p = place(R, { tall: s.tall ? h * s.tall * 0.9 : 0, width: w * 0.9, score, tight: 0.85, lit: !s.tall && r() < 0.7 }); if (!p) return false;
      if (!s.flat) ground.push(shadow(p.x, p.y - R * 0.15, R * (s.tall ? 1.25 : 0.9), s.tall ? 1.2 : 0.5));
      props.push({ y: p.y, draw(c) { if (im) c.drawImage(im, p.x - w / 2, p.y + R * 0.35 - h * s.base, w, h); } });
      return true;
    };
    const many = (n, list, score, lo = 0.9, hi = 1.1) => { for (let i = 0; i < n; i++) put(Array.isArray(list) ? pick(r, list) : list, score, lo + r() * (hi - lo)); };
    if (L.zone === 'res') {
      const theme = wpick(r, [['orchard', 2], ['woodland', 2], ['flowers', 3], ['veg', 2], ['pond', 1.5], ['shrubs', 2], ['bare', 1]]);
      const big = Math.min(3, Math.round(budget / 2));
      if (theme === 'orchard') many(big, ['tree', 'tree-blossom', 'tree-autumn'], corners);
      if (theme === 'woodland') many(big, ['pine', 'pine', 'tree'], corners);
      if (theme === 'flowers') { many(Math.min(2, Math.ceil(budget / 3)), ['flowerbed2', 'flowerbed'], nearWall, 0.85, 1); many(1, ['tree-blossom', 'tree'], corners); }
      if (theme === 'veg') { many(Math.min(2, Math.ceil(budget / 3)), ['vegpatch2'], back, 0.85, 1); many(1, 'tree', corners); }
      if (theme === 'pond') { many(1, 'pond', open); many(2, 'boulders', nearWall, 0.6, 0.9); many(1, ['tree', 'pine'], corners); }
      if (theme === 'shrubs') many(Math.min(5, Math.round(budget)), ['bush', 'bush', 'berry-bush'], nearEdge, 0.75, 1.05);
      if (theme !== 'bare' && theme !== 'shrubs') many(Math.min(2, Math.round(budget / 3)), ['bush', 'berry-bush'], nearWall, 0.7, 0.95);
    } else if (L.zone === 'com') {
      const theme = wpick(r, [['cafe', 2], ['green', 3], ['street', 3], ['bare', 1.5]]);
      if (theme === 'cafe') { many(Math.min(2, Math.ceil(budget / 3)), 'parasol', nearWall); many(1, 'planter', nearEdge); }
      if (theme === 'green') { many(Math.min(4, Math.round(budget * 0.8)), ['planter', 'planter', 'planterbox'], nearEdge, 0.85, 1.05); many(1, 'tree', corners, 0.85, 0.95); }
      if (theme === 'street') { many(1, ['bench', 'bench2'], nearWall); many(1, 'bikerack', nearWall); many(1, 'bin', nearWall); many(1, 'planter', nearEdge); }
    } else {
      const theme = wpick(r, [['yard', 3], ['drums', 3], ['scrap', 2], ['overgrown', 2], ['bare', 1]]);
      const n = Math.min(4, Math.max(1, Math.round(budget * 0.7)));
      if (theme === 'yard') { many(n, ['crates', 'pallets', 'crates'], nearWall, 0.8, 1); many(1, 'cone', open); }
      if (theme === 'drums') { many(n, ['barrels', 'barrels', 'crates'], nearWall, 0.8, 1); many(1, 'barrier', nearEdge, 0.85, 0.95); }
      if (theme === 'scrap') { many(n, ['tyres', 'tyres', 'pallets'], nearEdge, 0.8, 1); many(1, 'scrub', nearEdge); }
      if (theme === 'overgrown') { many(n + 1, ['scrub', 'scrub', 'boulders'], nearEdge, 0.75, 1.1); }
    }
    return { ground, props };
  }

  // ── D: ground character (decals under the building's shadow, nothing standing up) ─────────
  function planD(F, r, calm) {
    const { L } = F, ground = [];
    const x0 = L.left, x1 = L.right + 1, y0 = L.top, y1 = L.front + 1, W = x1 - x0, H = y1 - y0;
    const fill = (col) => (c) => { c.fillStyle = col; c.fillRect(x0, y0, W, H); };
    const spots = (n, R0, R1) => { const a = []; for (let i = 0; i < n; i++) a.push([x0 + r() * W, y0 + r() * H, R0 + r() * (R1 - R0), r()]); return a; };
    let label;
    if (L.zone === 'res') {
      label = wpick(r, calm ? [['stripes', 3], ['lush', 2], ['dry', 1.5], ['meadow', 2], ['clover', 2], ['plain', 2]] : [['stripes', 3], ['lush', 2], ['dry', 2], ['meadow', 3], ['clover', 2], ['path', 2], ['plain', 1]]);
      if (label === 'stripes') { const vert = r() < 0.5, w = 11; ground.push((c) => { c.fillStyle = 'rgba(255,255,220,0.13)'; for (let k = 0; k * w * 2 < Math.max(W, H); k++) vert ? c.fillRect(x0 + k * w * 2, y0, w, H) : c.fillRect(x0, y0 + k * w * 2, W, w); c.fillStyle = 'rgba(0,60,20,0.08)'; for (let k = 0; k * w * 2 < Math.max(W, H); k++) vert ? c.fillRect(x0 + k * w * 2 + w, y0, w, H) : c.fillRect(x0, y0 + k * w * 2 + w, W, w); }); }
      if (label === 'lush') ground.push(fill('rgba(20,105,45,0.26)'));
      if (label === 'dry') { ground.push(fill('rgba(214,190,70,0.3)')); const s = spots(7, 8, 18); ground.push((c) => { c.fillStyle = 'rgba(190,150,80,0.28)'; for (const [x, y, R] of s) ell(c, x, y, R, R * 0.6); }); }
      if (label === 'meadow') { const s = spots(110, 0.9, 1.5); ground.push(fill('rgba(60,140,50,0.14)')); ground.push((c) => { for (const [x, y, R, t] of s) { c.fillStyle = FLOWERS[Math.floor(t * 4)]; circle(c, x, y, R); } }); }
      if (label === 'clover') { const s = spots(9, 9, 20); ground.push((c) => { for (const [x, y, R, t] of s) { c.fillStyle = t < 0.5 ? 'rgba(25,100,45,0.3)' : 'rgba(170,215,110,0.3)'; ell(c, x, y, R, R * 0.62); } }); }
      if (label === 'path' || (!calm && label !== 'plain' && r() < 0.35)) { const d = F.door; if (d) ground.push((c) => { c.fillStyle = '#a98a5c'; rrect(c, d.x - 6, d.y - 2, 12, y1 - d.y + 4, 4); c.fillStyle = '#c9ab7a'; rrect(c, d.x - 4.6, d.y - 2, 9.2, y1 - d.y + 2, 3.5); }); if (label === 'path') ground.push(fill('rgba(20,105,45,0.1)')); }
    } else if (L.zone === 'com') {
      label = wpick(r, calm ? [['warm', 3], ['checker', 2], ['sandstone', 2], ['plain', 3]] : [['warm', 3], ['asphalt', 1.5], ['checker', 2], ['brick', 2], ['sandstone', 3], ['plain', 2]]);
      if (label === 'warm') ground.push(fill(calm ? 'rgba(214,170,120,0.26)' : 'rgba(214,170,120,0.34)'));
      if (label === 'asphalt') ground.push(fill('rgba(52,58,70,0.42)'));
      if (label === 'sandstone') ground.push(fill(calm ? 'rgba(232,210,150,0.3)' : 'rgba(232,210,150,0.42)'));
      if (label === 'checker') { const s = W / 8; ground.push((c) => { for (let j = 0; j * s < H; j++) for (let i = 0; i < 8; i++) { c.fillStyle = (i + j) % 2 ? 'rgba(60,70,90,0.11)' : 'rgba(255,255,255,0.1)'; c.fillRect(x0 + i * s, y0 + j * s, s + 0.3, s + 0.3); } }); }
      if (label === 'brick') ground.push((c) => { c.fillStyle = 'rgba(176,96,74,0.46)'; c.fillRect(x0, y0, W, H); c.fillStyle = 'rgba(90,40,30,0.22)'; for (let j = 0; j * 5 < H; j++) { c.fillRect(x0, y0 + j * 5, W, 0.8); for (let i = 0; i * 10 < W; i++) c.fillRect(x0 + i * 10 + (j % 2) * 5, y0 + j * 5, 0.8, 5); } });
    } else {
      label = wpick(r, calm ? [['tracks', 2], ['gravel', 2], ['mud', 2], ['concrete', 1.5], ['plain', 2.5]] : [['tracks', 3], ['oil', 2], ['gravel', 3], ['mud', 2], ['concrete', 2], ['plain', 1]]);
      if (label === 'tracks') { const d = F.door, cx = d ? d.x : (x0 + x1) / 2, bend = (r() < 0.5 ? -1 : 1) * (20 + r() * 30); ground.push((c) => { c.strokeStyle = 'rgba(110,70,40,0.42)'; c.lineWidth = 3.2; c.lineCap = 'round'; for (const o of [-7, 7]) { c.beginPath(); c.moveTo(cx + o, (d ? d.y : y0 + H * 0.6)); c.bezierCurveTo(cx + o, y1 - 14, cx + o + bend * 0.4, y1 - 6, cx + o + bend, y1 + 2); c.stroke(); } }); const s = spots(5, 6, 14); ground.push((c) => { c.fillStyle = 'rgba(110,70,40,0.2)'; for (const [x, y, R] of s) ell(c, x, y, R, R * 0.6); }); }
      if (label === 'oil') { const s = spots(8, 4, 12); ground.push((c) => { for (const [x, y, R] of s) { c.fillStyle = 'rgba(40,30,30,0.34)'; ell(c, x, y, R, R * 0.6); c.fillStyle = 'rgba(40,30,30,0.3)'; ell(c, x + R * 0.3, y + R * 0.1, R * 0.5, R * 0.3); } }); }
      if (label === 'gravel') { const s = spots(170, 0.8, 1.5); ground.push(fill(calm ? 'rgba(150,150,150,0.26)' : 'rgba(150,150,150,0.42)')); ground.push((c) => { for (const [x, y, R, t] of s) { c.fillStyle = t < 0.5 ? 'rgba(90,90,95,0.55)' : 'rgba(225,225,225,0.6)'; circle(c, x, y, R); } }); }
      if (label === 'mud') { ground.push(fill('rgba(96,62,36,0.3)')); const s = spots(6, 8, 18); ground.push((c) => { c.fillStyle = 'rgba(70,45,28,0.26)'; for (const [x, y, R] of s) ell(c, x, y, R, R * 0.6); }); }
      if (label === 'concrete') ground.push((c) => { c.fillStyle = calm ? 'rgba(186,186,182,0.45)' : 'rgba(186,186,182,0.8)'; c.fillRect(x0, y0, W, H); c.fillStyle = calm ? 'rgba(110,110,110,0.2)' : 'rgba(110,110,110,0.35)'; for (let i = 1; i < 4; i++) { c.fillRect(x0 + i * W / 4, y0, 1, H); c.fillRect(x0, y0 + i * H / 4, W, 1); } });
    }
    return { ground, props: [], label };
  }

  // ── E: a mix. Ground character, sometimes an edge, and a lighter scatter of generated props ─
  function planE(F, r, images) {
    const d = planD(F, r), b = r() < 0.55 ? planB(F, r) : { ground: [] }, c = planC(F, r, images, 0.7);
    return { ground: [...d.ground, ...b.ground, ...c.ground], props: c.props };
  }

  // ── F: calm blend. Planned and drawn by the game's own code (src/render/clay/lotDressing*.ts,
  // bundled into lot-dressing.js) from the game's analysis of its 128px sprites (LOTS[id].game).
  const gameFields = {};
  function planF(id, seed, images) {
    const LD = window.LotDressing, L = LOTS[id];
    if (!LD || !L.game) return { ground: [], props: [] };
    const field = gameFields[id] || (gameFields[id] = { ...L.game, grid: Uint8Array.from(L.game.grid, Number) });
    const p = LD.planLot(field, (seed * 2654435761) >>> 0);
    const trees = {};
    for (const n of LD.TREE_NAMES) if (images && images['prop:' + n]) trees[n] = images['prop:' + n];
    // The game recolours ground pixels by the tone; from disk the page cannot read pixels, so
    // approximate it with a translucent wash of the toned ground colour.
    const t = LD.GROUND_TONES[L.zone][p.tone % LD.GROUND_TONES[L.zone].length], a = 0.45;
    const wash = L.ground.map((g, i) => Math.max(0, Math.min(255, Math.round(g * (1 + (t[i] - 1) / a)))));
    const ground = [];
    if (t.some((v) => v !== 1)) ground.push((c) => { c.fillStyle = 'rgba(' + wash.join(',') + ',' + a + ')'; c.fillRect(L.left, L.top, L.right - L.left + 1, L.front - L.top + 2); });
    ground.push((c) => LD.drawDressingGround(c, field, p.ground));
    return { ground, props: p.props.map((q) => ({ y: q.y, draw: (c) => LD.drawDressingProps(c, [q], trees) })), label: p.tags.join(', ') };
  }

  const cache = new Map();
  function plan(id, approach, seed, images) {
    const key = id + '|' + approach + '|' + seed;
    if (cache.has(key)) return cache.get(key);
    const F = field(id), r = rng(seed * 2654435761 + approach.charCodeAt(0) * 97);
    r(); r();
    const p = approach === 'A' ? planA(F, r) : approach === 'B' ? planB(F, r) : approach === 'C' ? planC(F, r, images) : approach === 'D' ? planD(F, r) : approach === 'E' ? planE(F, r, images) : approach === 'F' ? planF(id, seed, images) : { ground: [], props: [] };
    p.props.sort((a, b) => a.y - b.y);
    cache.set(key, p);
    return p;
  }

  window.Landscape = { plan, field, propNames: Object.keys(SPEC) };
})();
