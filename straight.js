// Auto straight: lock a segment to level, plumb or 45 degrees, and line up with existing points.
// Angle tolerance is 5 degrees, and an exact 5 degree miss does not lock.
(function (g) {
  const ST_TOL = 5 * Math.PI / 180;
  const DIRS = [0, Math.PI / 2, Math.PI / 4, 3 * Math.PI / 4];
  function snapOrtho(prev, p) {
    if (!prev) return p;
    const dx = Math.abs(p[0] - prev[0]), dy = Math.abs(p[1] - prev[1]);
    return dx >= dy ? [p[0], prev[1]] : [prev[0], p[1]];
  }
  function straighten(p, prev, tol, dirs, align) {
    const dx = p[0] - prev[0], dy = p[1] - prev[1], L = Math.hypot(dx, dy);
    if (L < 1e-9) return null;
    const ang = Math.atan2(dy, dx);
    let best = null, bd = ST_TOL;
    for (const d of (dirs || DIRS)) {
      const df = Math.abs(((ang - d) % Math.PI + Math.PI * 1.5) % Math.PI - Math.PI / 2);
      if (df < bd) { bd = df; best = d; }
    }
    const A = align || [];
    let ax = null, ay = null, bx = tol, by = tol;
    for (const q of A) {
      if (Math.abs(q[0] - p[0]) < bx) { bx = Math.abs(q[0] - p[0]); ax = q; }
      if (Math.abs(q[1] - p[1]) < by) { by = Math.abs(q[1] - p[1]); ay = q; }
    }
    if (best === null && !ax && !ay) return null;
    let q = p.slice(), dir = null;
    if (best !== null) {
      dir = [Math.cos(best), Math.sin(best)];
      const t = dx * dir[0] + dy * dir[1];
      q = [prev[0] + t * dir[0], prev[1] + t * dir[1]];
      const hz = Math.abs(dir[1]) < 1e-6, vt = Math.abs(dir[0]) < 1e-6;
      if (hz) { ay = null; if (ax) q = [ax[0], prev[1]]; }
      else if (vt) { ax = null; if (ay) q = [prev[0], ay[1]]; }
      else if (ax) { q = [ax[0], prev[1] + (ax[0] - prev[0]) / dir[0] * dir[1]]; ay = null; }
      else if (ay) { q = [prev[0] + (ay[1] - prev[1]) / dir[1] * dir[0], ay[1]]; }
    } else {
      if (ax) q[0] = ax[0];
      if (ay) q[1] = ay[1];
    }
    if (ax && Math.abs(q[0] - ax[0]) > 1e-9) ax = null;
    if (ay && Math.abs(q[1] - ay[1]) > 1e-9) ay = null;
    return { q, prev: prev.slice(), dir, ax, ay, straight: best !== null };
  }
  const api = { ST_TOL, DIRS, snapOrtho, straighten };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  g.Straight = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
