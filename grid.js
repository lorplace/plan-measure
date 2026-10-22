// Gridline offsets. A point is reported from the nearest labelled vertical grid, then the nearest labelled horizontal grid.
// Example, millimetres: "4y +1250 mm / C −380 mm" (minus is U+2212).
(function (g) {
  const Units = (typeof module !== 'undefined' && module.exports) ? require('./units.js') : g.Units;
  const GRID_LABEL = /^(?:[A-Za-z]{1,2}(?:\.\d+)?|\d{1,3}[A-Za-z]?)$/;
  const isGridLayer = name => /grid/i.test(name || '');
  function signedLen(metres, units) {
    const body = Units.fmtLen(Math.abs(metres), units);
    if (body === Units.fmtLen(0, units)) return '+' + body;
    return (metres < 0 ? '\u2212' : '+') + body;
  }
  function formatGridOffset(xLabel, xMetres, yLabel, yMetres, units) {
    if (!xLabel || !yLabel || !isFinite(xMetres) || !isFinite(yMetres)) return '';
    return xLabel + ' ' + signedLen(xMetres, units) + ' / ' + yLabel + ' ' + signedLen(yMetres, units);
  }
  // lines: { axis:'x'|'y', at, label } in the same coordinates as worldPt. axis x is a vertical grid.
  function nearestGrids(worldPt, lines) {
    let x = null, y = null;
    for (const line of lines || []) {
      const coord = line.axis === 'x' ? worldPt[0] : worldPt[1];
      const d = Math.abs(coord - line.at);
      const cur = line.axis === 'x' ? x : y;
      if (!cur || d < cur.d - 1e-9 || (Math.abs(d - cur.d) <= 1e-9 && line.at < cur.line.at)) {
        const hit = { line, d };
        if (line.axis === 'x') x = hit; else y = hit;
      }
    }
    return {
      x: x && { label: x.line.label, at: x.line.at, delta: worldPt[0] - x.line.at },
      y: y && { label: y.line.label, at: y.line.at, delta: worldPt[1] - y.line.at }
    };
  }
  function segmentsOf(M) {
    const out = [];
    if (M.sx) {
      const n = M.nSegs != null ? M.nSegs : M.sx.length / 4;
      for (let i = 0; i < n; i++) {
        if (M.sK && M.sK[i]) continue;
        out.push({ x1: M.sx[4 * i], y1: M.sx[4 * i + 1], x2: M.sx[4 * i + 2], y2: M.sx[4 * i + 3], L: M.sL[i] });
      }
      return out;
    }
    for (const s of M.segs || []) {
      if (s[4]) continue;
      out.push({ x1: s[0], y1: s[1], x2: s[2], y2: s[3], L: s[5] });
    }
    return out;
  }
  function gridlinesFromCad(M, hidden) {
    hidden = hidden || {};
    const key = JSON.stringify(hidden);
    if (M._gridKey === key && M._gridLines) return M._gridLines;
    const tol = Math.max(M.w, M.h) * 1e-4 || 1e-6;
    const minLen = 0.05 * Math.min(M.w, M.h);
    const margin = 0.04 * Math.max(M.w, M.h);
    const clusters = new Map();
    for (const s of segmentsOf(M)) {
      const layer = M.layerNames[s.L];
      if (!isGridLayer(layer) || hidden[layer]) continue;
      const dx = s.x2 - s.x1, dy = s.y2 - s.y1, len = Math.hypot(dx, dy);
      if (len < minLen) continue;
      let axis = null, pageAt, along0, along1;
      if (Math.abs(dx) <= len * 0.01) { axis = 'x'; pageAt = (s.x1 + s.x2) / 2; along0 = s.y1; along1 = s.y2; }
      else if (Math.abs(dy) <= len * 0.01) { axis = 'y'; pageAt = (s.y1 + s.y2) / 2; along0 = s.x1; along1 = s.x2; }
      else continue;
      const id = axis + ':' + Math.round(pageAt / tol);
      let c = clusters.get(id);
      if (!c) clusters.set(id, c = { axis, pageSum: 0, n: 0, lo: Infinity, hi: -Infinity, layer });
      c.pageSum += pageAt; c.n++;
      c.lo = Math.min(c.lo, along0, along1);
      c.hi = Math.max(c.hi, along0, along1);
    }
    const lines = [];
    for (const c of clusters.values()) {
      c.pageAt = c.pageSum / c.n;
      let best = null;
      for (const t of M.texts || []) {
        const layer = M.layerNames[t.L];
        if (!isGridLayer(layer) || hidden[layer] || !t.text) continue;
        const label = String(t.text).trim().split('\n')[0].trim();
        if (!GRID_LABEL.test(label)) continue;
        const perp = c.axis === 'x' ? Math.abs(t.x - c.pageAt) : Math.abs(t.y - c.pageAt);
        const along = c.axis === 'x' ? t.y : t.x;
        if (perp > margin || along < c.lo - margin || along > c.hi + margin) continue;
        const endD = Math.min(Math.abs(along - c.lo), Math.abs(along - c.hi));
        if (!best || perp < best.perp - 1e-6 || (Math.abs(perp - best.perp) <= 1e-6 && endD < best.endD)) best = { label, perp, endD };
      }
      if (!best || !M.toWorld) continue;
      const world = c.axis === 'x' ? M.toWorld(c.pageAt, (c.lo + c.hi) / 2)[0] : M.toWorld((c.lo + c.hi) / 2, c.pageAt)[1];
      lines.push({ axis: c.axis, at: world, label: best.label, pageAt: c.pageAt });
    }
    M._gridKey = key;
    M._gridLines = lines;
    return lines;
  }
  function callout(M, pagePt, hidden, metresPerWorld, units) {
    if (!M || !M.toWorld || !(metresPerWorld > 0)) return '';
    const lines = gridlinesFromCad(M, hidden);
    const w = M.toWorld(pagePt[0], pagePt[1]);
    const n = nearestGrids(w, lines);
    if (!n.x || !n.y) return '';
    return formatGridOffset(n.x.label, n.x.delta * metresPerWorld, n.y.label, n.y.delta * metresPerWorld, units);
  }
  const api = { GRID_LABEL, signedLen, formatGridOffset, nearestGrids, gridlinesFromCad, callout };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  g.Grid = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
