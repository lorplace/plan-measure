// Length, area and count math. Lengths are metres; a scale is metres per page unit.
// Areas stay in square metres for both millimetre and metre display.
(function (g) {
  const Units = (typeof module !== 'undefined' && module.exports) ? require('./units.js') : g.Units;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  function polyLen(pts, closed) {
    let s = 0;
    for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]);
    if (closed && pts.length > 2) s += dist(pts[pts.length - 1], pts[0]);
    return s;
  }
  function polyArea(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
      s += x1 * y2 - x2 * y1;
    }
    return Math.abs(s) / 2;
  }
  function centroid(pts) {
    let x = 0, y = 0;
    pts.forEach(p => { x += p[0]; y += p[1]; });
    return [x / pts.length, y / pts.length];
  }
  // scale: metres per page unit, or a falsy value when the page is not calibrated.
  function measure(it, scale) {
    const s = scale;
    if (it.type === 'line' || it.type === 'poly') return s ? polyLen(it.pts) * s + (it.extra || 0) : NaN;
    if (it.type === 'area') return s ? polyArea(it.pts) * s * s : NaN;
    if (it.type === 'count' || it.type === 'sleeve') return 1;
    return NaN;
  }
  // Metres of real world per page unit, from a known distance between two clicks.
  function scaleFromDistance(pageDist, metres) { return metres / pageDist; }
  // Standard scale: PDF points use mPerPt; an image uses the printed ratio at the given DPI.
  function scaleFromStandard(std, kind, dpi) {
    if (kind === 'image') return std.ratio * Units.IN / (dpi || 150);
    return std.mPerPt;
  }
  function groupTakeoff(items, scaleOf) {
    const m = new Map();
    for (const it of items) {
      if (it.type === 'text') continue;
      const lab = it.type === 'sleeve' ? [it.size, it.label].filter(Boolean).join(' ') : (it.label || '');
      const k = it.type + '|' + lab + '|' + it.color;
      if (!m.has(k)) m.set(k, { type: it.type, label: lab, color: it.color, n: 0, sum: 0, noscale: 0 });
      const gr = m.get(k), v = measure(it, scaleOf(it.page));
      gr.n++;
      if (isFinite(v)) gr.sum += v; else gr.noscale++;
    }
    return [...m.values()];
  }
  const api = { dist, polyLen, polyArea, centroid, measure, scaleFromDistance, scaleFromStandard, groupTakeoff };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  g.Measure = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
