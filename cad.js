// CAD (DXF / DWG) loader -> flat 2D model in "page" coordinates (y down), used for rendering, snapping and export.
(function (g) {
const UNIT_M = { 1: 0.0254, 2: 0.3048, 3: 1609.344, 4: 0.001, 5: 0.01, 6: 1, 8: 0.0000254, 9: 0.0000254, 10: 0.9144, 14: 0.1 };
const UNIT_NAME = { 1: 'inches', 2: 'feet', 4: 'mm', 5: 'cm', 6: 'metres', 10: 'yards', 14: 'dm' };
const ACI = { 1: '#e53935', 2: '#b8a000', 3: '#2e7d32', 4: '#00838f', 5: '#1565c0', 6: '#ad1457', 7: '#111111', 8: '#808080', 9: '#a0a0a0' };
const hex = n => '#' + (n >>> 0 & 0xffffff).toString(16).padStart(6, '0');
function fixColor(c) { if (!c) return '#111111'; const n = parseInt(c.slice(1), 16), r = n >> 16, gg = n >> 8 & 255, b = n & 255; return (r * .3 + gg * .59 + b * .11) > 200 ? '#111111' : c; }
const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
const ap = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
function stripMText(t) { return String(t || '').replace(/\\P/g, '\n').replace(/\\[A-Za-z][^;\\{}]*;/g, '').replace(/\\[A-Za-z]/g, '').replace(/[{}]/g, '').replace(/%%c/gi, 'Ø').replace(/%%d/gi, '°').replace(/%%p/gi, '±'); }

// Normalise dxf-parser or libredwg-web output into {units, layers:{name:{color,on}}, blocks:{name:{base, ents}}, ents}
function fromDxfParser(d) {
  const layers = {}; const L = (d.tables && d.tables.layer && d.tables.layer.layers) || {};
  for (const n in L) layers[n] = { color: L[n].color != null ? hex(L[n].color) : ACI[L[n].colorIndex] || '#111111', on: L[n].visible !== false && !L[n].frozen };
  const blocks = {}; for (const n in (d.blocks || {})) { const b = d.blocks[n]; blocks[n] = { base: b.position || { x: 0, y: 0 }, ents: b.entities || [] }; }
  return { units: d.header && d.header.$INSUNITS, layers, blocks, ents: d.entities || [], deg: true };
}
function fromDwg(db) {
  const layers = {}; for (const l of (db.tables.LAYER && db.tables.LAYER.entries) || []) layers[l.name] = { color: ACI[Math.abs(l.colorIndex)] || (l.color ? hex(l.color) : '#111111'), on: !l.off && !l.frozen && l.colorIndex >= 0 };
  const recs = (db.tables.BLOCK_RECORD && db.tables.BLOCK_RECORD.entries) || [], byOwner = {};
  for (const e of db.entities) (byOwner[e.ownerBlockRecordSoftId] = byOwner[e.ownerBlockRecordSoftId] || []).push(e);
  const blocks = {}; let model = null;
  for (const r of recs) { const ents = byOwner[r.handle] || []; if (/^\*model_space$/i.test(r.name)) model = ents; blocks[r.name] = { base: r.basePoint || { x: 0, y: 0 }, ents }; }
  if (!model) model = byOwner['1F'] || db.entities.filter(e => !/^\*paper/i.test(e.ownerBlockRecordSoftId));
  return { units: db.header && (db.header.INSUNITS ?? db.header.$INSUNITS), layers, blocks, ents: model, deg: false };
}

function build(src) {
  const segs = [], pts = [], texts = [], layerIdx = {}, layerNames = [];
  const li = n => { n = n || '0'; if (!(n in layerIdx)) { layerIdx[n] = layerNames.length; layerNames.push(n); if (!src.layers[n]) src.layers[n] = { color: '#111111', on: true }; } return layerIdx[n]; };
  const ang = a => (a || 0) * (src.deg ? Math.PI / 180 : 1);
  function colorOf(e, layer) { const ci = e.colorIndex; if (e.color != null && e.color !== 0 && src.deg) return fixColor(hex(e.color)); if (ci && ci !== 256 && ci !== 0 && ACI[ci]) return fixColor(ACI[ci]); return fixColor(src.layers[layer] ? src.layers[layer].color : '#111111'); }
  function emit(m, ent, depth, parentLayer) {
    let layer = ent.layer || '0'; if (layer === '0' && parentLayer) layer = parentLayer;
    const L = li(layer), col = colorOf(ent, layer);
    const seg = (a, b, curve) => { const p = ap(m, a[0], a[1]), q = ap(m, b[0], b[1]); segs.push([p[0], p[1], q[0], q[1], curve ? 1 : 0, L, col]); };
    const pt = (x, y, kind) => { const p = ap(m, x, y); pts.push([p[0], p[1], kind, L]); };
    const arcPts = (cx, cy, r, a0, a1) => { while (a1 <= a0) a1 += 2 * Math.PI; const n = Math.max(8, Math.ceil((a1 - a0) / (Math.PI / 36))); const out = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return out; };
    const poly = (P, curve) => { for (let i = 1; i < P.length; i++) seg(P[i - 1], P[i], curve); };
    const t = ent.type;
    if (t === 'LINE') { const a = ent.vertices ? ent.vertices[0] : ent.startPoint, b = ent.vertices ? ent.vertices[1] : ent.endPoint; seg([a.x, a.y], [b.x, b.y]); pt(a.x, a.y, 'end'); pt(b.x, b.y, 'end'); pt((a.x + b.x) / 2, (a.y + b.y) / 2, 'mid'); }
    else if (t === 'LWPOLYLINE' || t === 'POLYLINE' || t === 'POLYLINE2D' || t === 'POLYLINE3D') {
      const V = (ent.vertices || []).map(v => ({ x: v.x, y: v.y, b: v.bulge || 0 })); if (!V.length) return;
      const closed = ent.shape || ((ent.flag || 0) & 1) || ((ent.flags || 0) & 1); const n = closed ? V.length : V.length - 1;
      for (let i = 0; i < n; i++) { const a = V[i], b = V[(i + 1) % V.length];
        if (Math.abs(a.b) > 1e-9) { const th = 4 * Math.atan(a.b), c = Math.hypot(b.x - a.x, b.y - a.y), r = c / (2 * Math.sin(th / 2)), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, h = Math.sqrt(Math.max(0, r * r - c * c / 4)) * Math.sign(a.b) * (Math.abs(th) > Math.PI ? -1 : 1);
          const ux = -(b.y - a.y) / c, uy = (b.x - a.x) / c, cx = mx + ux * h, cy = my + uy * h, a0 = Math.atan2(a.y - cy, a.x - cx), a1 = Math.atan2(b.y - cy, b.x - cx), R = Math.abs(r);
          const P = a.b > 0 ? arcPts(cx, cy, R, a0, a1) : arcPts(cx, cy, R, a1, a0).reverse(); poly(P, true); pt(cx, cy, 'center'); }
        else { seg([a.x, a.y], [b.x, b.y]); pt((a.x + b.x) / 2, (a.y + b.y) / 2, 'mid'); } }
      V.forEach(v => pt(v.x, v.y, 'end'));
    }
    else if (t === 'CIRCLE') { const c = ent.center; poly(arcPts(c.x, c.y, ent.radius, 0, 2 * Math.PI), true); pt(c.x, c.y, 'center'); [0, 1, 2, 3].forEach(i => pt(c.x + ent.radius * Math.cos(i * Math.PI / 2), c.y + ent.radius * Math.sin(i * Math.PI / 2), 'end')); }
    else if (t === 'ARC') { const c = ent.center, a0 = src.deg ? ent.startAngle : ent.startAngle, a1 = ent.endAngle; // both libraries give radians for arcs
      const P = arcPts(c.x, c.y, ent.radius, a0, a1); poly(P, true); pt(c.x, c.y, 'center'); pt(P[0][0], P[0][1], 'end'); pt(P[P.length - 1][0], P[P.length - 1][1], 'end'); }
    else if (t === 'ELLIPSE') { const c = ent.center, M = ent.majorAxisEndPoint, ra = ent.axisRatio, rot = Math.atan2(M.y, M.x), R = Math.hypot(M.x, M.y); let a0 = ent.startAngle || 0, a1 = ent.endAngle || 2 * Math.PI; while (a1 <= a0) a1 += 2 * Math.PI;
      const P = []; for (let i = 0; i <= 72; i++) { const a = a0 + (a1 - a0) * i / 72, x = R * Math.cos(a), y = R * ra * Math.sin(a); P.push([c.x + x * Math.cos(rot) - y * Math.sin(rot), c.y + x * Math.sin(rot) + y * Math.cos(rot)]); } poly(P, true); pt(c.x, c.y, 'center'); }
    else if (t === 'SPLINE') { const P = (ent.fitPoints && ent.fitPoints.length ? ent.fitPoints : ent.controlPoints || []).map(v => [v.x, v.y]); poly(P, true); if (P.length) { pt(P[0][0], P[0][1], 'end'); pt(P[P.length - 1][0], P[P.length - 1][1], 'end'); } }
    else if (t === 'POINT') { const p = ent.position; if (p) pt(p.x, p.y, 'end'); }
    else if (t === 'TEXT' || t === 'MTEXT' || t === 'ATTRIB') {
      const tx = typeof ent.text === 'object' ? ent.text : ent; const p = tx.startPoint || ent.position || ent.insertionPoint || tx.insertionPoint; if (!p) return;
      const h = tx.textHeight || ent.height || ent.textHeight || 1, s = Math.hypot(m[0], m[1]); const q = ap(m, p.x, p.y);
      let rot = t === 'MTEXT' ? (ent.direction ? Math.atan2(ent.direction.y, ent.direction.x) : ang(ent.rotation)) : ang(tx.rotation); rot += Math.atan2(m[1], m[0]);
      texts.push({ x: q[0], y: q[1], h: h * s, rot, text: stripMText(tx.text != null && typeof tx.text === 'string' ? tx.text : ent.text), L, col, top: t === 'MTEXT' });
    }
    else if (t === 'INSERT' || t === 'DIMENSION') {
      if (depth > 12) return; const name = ent.name || ent.block; const B = src.blocks[name]; if (!B) { if (t === 'DIMENSION' && ent.middleOfText) { const q = ap(m, ent.middleOfText.x, ent.middleOfText.y); texts.push({ x: q[0], y: q[1], h: 1, rot: 0, text: ent.text || '', L, col }); } return; }
      let M = m;
      if (t === 'INSERT') { const p = ent.position || ent.insertionPoint || { x: 0, y: 0 }, sx = ent.xScale ?? 1, sy = ent.yScale ?? 1, r = ang(ent.rotation), c = Math.cos(r), s = Math.sin(r);
        M = mul(m, [c * sx, s * sx, -s * sy, c * sy, p.x, p.y]); M = mul(M, [1, 0, 0, 1, -(B.base.x || 0), -(B.base.y || 0)]); }
      for (const e of B.ents) emit(M, e, depth + 1, layer);
    }
  }
  for (const e of src.ents) if (!/^(XLINE|RAY|VIEWPORT|HATCH|WIPEOUT|3DSOLID)$/.test(e.type)) emit([1, 0, 0, 1, 0, 0], e, 0, null);
  // extents and page mapping
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const ext = (x, y) => { if (!isFinite(x) || !isFinite(y)) return; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  segs.forEach(s => { ext(s[0], s[1]); ext(s[2], s[3]); }); texts.forEach(t => ext(t.x, t.y));
  if (!isFinite(x0)) { x0 = y0 = 0; x1 = y1 = 100; }
  const W = Math.max(x1 - x0, 1e-6), H = Math.max(y1 - y0, 1e-6), pad = 0.04 * Math.max(W, H), k = 1600 / (Math.max(W, H) + 2 * pad);
  const ox = x0 - pad, oy = y1 + pad, P = (x, y) => [(x - ox) * k, (oy - y) * k];
  for (const s of segs) { const a = P(s[0], s[1]), b = P(s[2], s[3]); s[0] = a[0]; s[1] = a[1]; s[2] = b[0]; s[3] = b[1]; }
  for (const p of pts) { const a = P(p[0], p[1]); p[0] = a[0]; p[1] = a[1]; }
  for (const t of texts) { const a = P(t.x, t.y); t.x = a[0]; t.y = a[1]; t.h *= k; }
  const u = src.units | 0;
  return { segs, pts, texts, layerNames, layers: layerNames.map(n => ({ name: n, color: fixColor(src.layers[n].color), on: src.layers[n].on })),
    w: (W + 2 * pad) * k, h: (H + 2 * pad) * k, k, ox, oy, units: u, unitM: UNIT_M[u] || null, unitName: UNIT_NAME[u] || 'unitless',
    toWorld: (x, y) => [x / k + ox, oy - y / k] };
}
async function parse(bytes, kind) {
  if (kind === 'dxf') { const text = new TextDecoder('utf-8').decode(bytes); const P = g.DxfParser.default || g.DxfParser; const d = new P().parseSync(text); return build(fromDxfParser(d)); }
  const mod = await import('./lib/dwg/dist/libredwg-web.js'); const lib = await mod.LibreDwg.create(new URL('lib/dwg/wasm', location.href).href.replace(/\/$/, ''));
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); const dwg = lib.dwg_read_data(ab, mod.Dwg_File_Type.DWG);
  if (!dwg) throw new Error('Could not read this DWG'); const db = lib.convert(dwg); try { lib.dwg_free(dwg); } catch (e) { } return build(fromDwg(db));
}
// draw model onto a 2D context; page point (x,y) -> (x*S+ox, y*S+oy)
function draw(ctx, M, S, ox, oy, hidden) {
  ctx.save(); ctx.setTransform(S, 0, 0, S, ox, oy); ctx.lineWidth = Math.max(1, S * 0.6) / S; ctx.lineCap = 'round';
  if (!M._paths || M._hidKey !== JSON.stringify(hidden)) { M._hidKey = JSON.stringify(hidden); const by = {};
    for (const s of M.segs) { if (hidden[M.layerNames[s[5]]]) continue; const p = by[s[6]] || (by[s[6]] = new Path2D()); p.moveTo(s[0], s[1]); p.lineTo(s[2], s[3]); } M._paths = by; }
  for (const c in M._paths) { ctx.strokeStyle = c; ctx.stroke(M._paths[c]); }
  for (const t of M.texts) { if (hidden[M.layerNames[t.L]] || !t.text || t.h * S < 2) continue; ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(-t.rot); ctx.fillStyle = t.col; ctx.font = `${t.h}px sans-serif`; ctx.textBaseline = t.top ? 'top' : 'alphabetic';
    t.text.split('\n').forEach((ln, i) => ctx.fillText(ln, 0, i * t.h * 1.4)); ctx.restore(); }
  ctx.restore();
}
g.CAD = { parse, draw, UNIT_M, UNIT_NAME };
})(this);
