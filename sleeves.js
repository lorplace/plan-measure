// Sleeve detection, nominal size and type (Nuco/MC bucket, Hilti, drain).
// Detection follows block names, layers and circles. Size prefers drawing text over the circle diameter.
(function (g) {
  const Units = (typeof module !== 'undefined' && module.exports) ? require('./units.js') : g.Units;
  const SLV_KEYS = ['SLEEVE', 'SLV', 'MANCHON', 'PEN', 'PENETRATION', 'CORE', 'CORING', 'FOURREAU'];
  const NOMINAL_IN = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 14, 16];
  function slvMatch(s) {
    s = String(s || '').toUpperCase();
    if (/SLEEVE|MANCHON|PENETRATION|FOURREAU|CORING/.test(s)) return true;
    return s.split(/[^A-Z0-9]+/).some(t => SLV_KEYS.some(k => t.startsWith(k) && /^\d*$/.test(t.slice(k.length))));
  }
  const inStr = v => {
    const w = Math.floor(v + 1e-9), f = v - w;
    const fr = { 0.25: '1/4', 0.5: '1/2', 0.75: '3/4' }[Math.round(f * 4) / 4] || '';
    return (w ? w + (fr ? '-' + fr : '') : fr) + '"';
  };
  function parseSize(s, units) {
    s = String(s || '').replace(/\\[A-Za-z][^;]*;/g, '').trim();
    let m;
    if ((m = s.match(/\bDN\s*(\d{2,4})\b/i))) return 'DN' + m[1];
    if ((m = s.match(/(\d+(?:\.\d+)?)\s*mm\b/i))) return m[1] + 'mm';
    if ((m = s.match(/(?:^|[^\d\/.])(\d+)[- ](\d)\/(\d)\s*(?:"|''|in\b|po\b)/i))) return m[1] + '-' + m[2] + '/' + m[3] + '"';
    if ((m = s.match(/(?:^|[^\d\/.])(\d)\/(\d)\s*(?:"|''|in\b|po\b)/i))) return m[1] + '/' + m[2] + '"';
    if ((m = s.match(/(?:^|[^\d\/.])(\d+(?:\.\d+)?)\s*(?:"|''|in\b|inch|po\b)/i))) return m[1] + '"';
    if ((m = s.match(/[ØøΦ⌀]\s*(\d+(?:\.\d+)?)/))) return m[1] + (Units.isMet(units) ? 'mm' : '"');
    return null;
  }
  function sizeFromDia(rPage, scale, units) {
    if (!scale || !rPage) return { size: '', raw: '' };
    const dm = 2 * rPage * scale, din = dm / Units.IN;
    const raw = Units.isMet(units) ? 'Ø ' + (dm * 1000).toFixed(0) + ' mm' : 'Ø ' + din.toFixed(2) + '"';
    let best = NOMINAL_IN[0];
    for (const n of NOMINAL_IN) if (Math.abs(n - din) < Math.abs(best - din)) best = n;
    return { size: inStr(best), raw };
  }
  function sizeFromName(n, units) {
    n = String(n || '');
    const p = parseSize(n, units);
    if (p) return p;
    const t = n.split(/[^0-9.\/-]+/).filter(Boolean).pop();
    if (!t || !/^\d+(?:\.\d+)?$/.test(t)) return null;
    const v = +t;
    return NOMINAL_IN.includes(v) && /[_\s-]\d+(?:\.\d+)?[_\s-]*$/.test(n) ? inStr(v) : null;
  }
  function searchRadius(c, w, h) { return Math.max(4 * (c.r || 0), 0.015 * Math.min(w, h)); }
  function nearbyTexts(M, x, y, R, hidden) {
    const out = [];
    for (const t of M.texts || []) {
      if ((hidden || {})[M.layerNames[t.L]]) continue;
      if (Math.hypot(t.x - x, t.y - y) <= R) out.push(String(t.text || ''));
    }
    return out;
  }
  function nearSize(M, x, y, R, hidden, units) {
    let best = null, bd = R;
    for (const t of M.texts || []) {
      if ((hidden || {})[M.layerNames[t.L]]) continue;
      const d = Math.hypot(t.x - x, t.y - y);
      if (d <= bd) { const sz = parseSize(t.text, units); if (sz) { bd = d; best = sz; } }
    }
    return best;
  }
  function candSize(c, ctx) {
    const dia = sizeFromDia(c.r, ctx.scale, ctx.units);
    let size = null, src = '';
    if (c.attrs) {
      const pref = c.attrs.slice().sort((a, b) => (/SIZE|DIA|TAILLE|DIAM/i.test(b.tag) ? 1 : 0) - (/SIZE|DIA|TAILLE|DIAM/i.test(a.tag) ? 1 : 0) || (a.def ? 1 : 0) - (b.def ? 1 : 0));
      for (const a of pref) { const s = parseSize(a.value, ctx.units); if (s) { size = s; src = a.def ? 'block default' : 'attribute'; break; } }
    }
    if (!size && c.kind === 'insert' && Math.abs((c.sc ?? 1) - 1) < 0.01) {
      const s = sizeFromName(c.name, ctx.units);
      if (s) { size = s; src = 'block name'; }
    }
    if (!size) {
      const t = nearSize(ctx.model, c.x, c.y, searchRadius(c, ctx.model.w, ctx.model.h), ctx.hidden, ctx.units);
      if (t) { size = t; src = 'nearby text'; }
    }
    if (!size && dia.size) { size = dia.size; src = 'diameter'; }
    return { size: size || '?', src: src || 'unknown', raw: dia.raw };
  }
  // Drain is the fitting, then the cast-in bucket, then a Hilti firestop sleeve.
  // Block names use underscores (FLR_Hilti), so tokens are split on every separator, not on \b.
  function classifySleeve(c) {
    const bits = [c.name, c.full, c.layer];
    if (c.attrs) for (const a of c.attrs) bits.push(a.tag, a.value);
    if (c.notes) bits.push.apply(bits, c.notes);
    const u = bits.filter(Boolean).join(' ').toUpperCase();
    const tokens = u.split(/[^A-Z0-9]+/).filter(Boolean);
    const has = w => tokens.includes(w);
    const pair = (a, b) => tokens.some((t, i) => t === a && tokens[i + 1] === b);
    if (has('DRAIN') || has('DRAINS') || pair('FLOOR', 'DRAIN')) return 'drain';
    if (has('NUCO') || pair('MC', 'BUCKET')) return 'Nuco/MC bucket';
    if (has('HILTI') || pair('CFS', 'CID') || pair('CP', '680')) return 'Hilti';
    return '';
  }
  function commonSuffix(M) {
    if (M._sfx != null) return M._sfx;
    const names = [...new Set(M.inserts.map(s => s.name))];
    let best = '';
    if (names.length >= 5) for (const seed of names.slice(0, 20)) for (let L = Math.max(6, best.length + 1); L <= seed.length - 1; L++) {
      const sx = seed.slice(-L);
      let n = 0;
      for (const x of names) if (x.endsWith(sx)) n++;
      if (n >= 0.6 * names.length) best = sx; else break;
    }
    return (M._sfx = best);
  }
  function shortName(n, sfx, tidy) {
    n = String(n || '');
    if (sfx && n.endsWith(sfx) && n.length > sfx.length) n = n.slice(0, -sfx.length);
    if (tidy) n = n.replace(/[-_ ]+V?\d{3,}[-_ ]*$/, '').replace(/[-_ ]+$/, '');
    return n;
  }
  function findCandidates(M, ctx) {
    const hidden = ctx.hidden || {}, out = [], vis = L => !hidden[M.layerNames[L]];
    const insOK = new Set();
    const sfx = commonSuffix(M);
    M._sfx = sfx;
    const mode = ctx.mode, pick = ctx.pick;
    M.inserts.forEach((s, i) => {
      if (!vis(s.L)) return;
      const ok = mode === 'pick' ? (pick.kind === 'insert' && s.name === pick.name) : (slvMatch(shortName(s.name, sfx)) || slvMatch(M.layerNames[s.L]));
      if (ok && !s.parents.some(p => insOK.has(p))) {
        insOK.add(i);
        out.push({ kind: 'insert', x: s.x, y: s.y, r: s.r, sc: s.sc, name: shortName(s.name, sfx, true), full: s.name, L: s.L, attrs: s.attrs });
      }
    });
    M.circles.forEach(c => {
      if (!vis(c.L) || c.parents.some(p => insOK.has(p))) return;
      const ok = mode === 'pick' ? (pick.kind === 'circle' && c.L === pick.L && Math.abs(c.r - pick.r) <= pick.r * 0.01) : slvMatch(M.layerNames[c.L]);
      if (ok) out.push({ kind: 'circle', x: c.x, y: c.y, r: c.r, name: '', L: c.L });
    });
    const tol = 1e-4 * Math.max(M.w, M.h), res = [];
    for (const c of out) { if (res.some(o => Math.hypot(o.x - c.x, o.y - c.y) < tol)) continue; res.push(c); }
    const sleeves = ctx.sleeves || [];
    const sizeCtx = { model: M, hidden, scale: ctx.scale, units: ctx.units };
    res.forEach((c, i) => {
      Object.assign(c, candSize(c, sizeCtx));
      c.notes = nearbyTexts(M, c.x, c.y, searchRadius(c, M.w, M.h), hidden);
      c.sleeveType = classifySleeve(Object.assign({ layer: M.layerNames[c.L] }, c));
      c.id = 'c' + i;
      c.layer = M.layerNames[c.L];
      c.dup = sleeves.some(s => Math.hypot(s.pts[0][0] - c.x, s.pts[0][1] - c.y) < tol);
      c.on = !c.dup;
    });
    return res;
  }
  const api = {
    SLV_KEYS, NOMINAL_IN, slvMatch, inStr, parseSize, sizeFromDia, sizeFromName, candSize,
    classifySleeve, commonSuffix, shortName, findCandidates, nearbyTexts
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  g.Sleeves = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
