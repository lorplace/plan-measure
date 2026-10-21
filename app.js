'use strict';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
const $ = s => document.querySelector(s);
const SVGNS = 'http://www.w3.org/2000/svg';
const vpEl = $('#viewport'), stage = $('#stage'), canvas = $('#canvas'), svg = $('#svg');
const TYPE_NAMES = {line:'Length', poly:'Pipe run', area:'Area', count:'Count', text:'Note', sleeve:'Sleeve'};

let doc = null;          // {type,name,bytes,pdf,img,numPages,sizes:[{w,h}],vps:[]}
let proj = null;         // {id,name,units,scales:{},items:[]}
let page = 1, zoom = 1, tool = 'select', draft = null, hover = null, selId = null;
let renderTask = null, renderTimer = null, shiftDown = false;

// ---------- helpers ----------
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
function toast(msg, ms = 2500) { const t = $('#toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(() => t.style.display = 'none', ms); }
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function polyLen(pts, closed) { let s = 0; for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]); if (closed && pts.length > 2) s += dist(pts[pts.length - 1], pts[0]); return s; }
function polyArea(pts) { let s = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; s += x1 * y2 - x2 * y1; } return Math.abs(s) / 2; }
function centroid(pts) { let x = 0, y = 0; pts.forEach(p => { x += p[0]; y += p[1]; }); return [x / pts.length, y / pts.length]; }
const scaleOf = pg => proj && proj.scales[pg];
function measure(it) {
  const s = scaleOf(it.page);
  if (it.type === 'line' || it.type === 'poly') return s ? polyLen(it.pts) * s + (it.extra || 0) : NaN;
  if (it.type === 'area') return s ? polyArea(it.pts) * s * s : NaN;
  if (it.type === 'count' || it.type === 'sleeve') return 1;
  return NaN;
}
function fmtItem(it) {
  const u = proj.units, v = measure(it);
  if (it.type === 'count' || it.type === 'text') return '';
  if (it.type === 'sleeve') return sleeveText(it);
  if (!isFinite(v)) return 'no scale';
  if (it.type === 'area') return Units.fmtArea(v, u) + ' (perim ' + Units.fmtLen(polyLen(it.pts, true) * scaleOf(it.page), u) + ')';
  return Units.fmtLen(v, u);
}
function snapOrtho(prev, p) { if (!prev) return p; const dx = Math.abs(p[0] - prev[0]), dy = Math.abs(p[1] - prev[1]); return dx >= dy ? [p[0], prev[1]] : [prev[0], p[1]]; }

// ---------- loading ----------
function fileMime(f) { const n = f.name.toLowerCase(); if (n.endsWith('.dxf')) return 'application/dxf'; if (n.endsWith('.dwg')) return 'application/dwg'; return f.type || (n.endsWith('.pdf') ? 'application/pdf' : 'image/png'); }
async function onFile(e) { const f = e.target.files[0]; if (!f) return; e.target.value = '';
  const bytes = new Uint8Array(await f.arrayBuffer());
  if (fileMime(f) === 'application/dwg') toast('Reading DWG (first time loads a 10 MB converter)...', 8000);
  try { await loadDoc(bytes, fileMime(f), f.name); } catch (err) { console.error(err); doc = null; layout();
    return toast(fileMime(f) === 'application/dwg' ? 'Could not read this DWG (' + err.message + '). Save it as DXF from your CAD program, or convert it free with ODA File Converter, then open the DXF.' : 'Could not open file: ' + err.message, 10000); }
  proj = { id: uid(), name: f.name.replace(/\.[^.]+$/, ''), fileName: f.name, fileType: doc.mime, units: $('#units').value, scales: {}, items: [], origins: {}, hidden: {} };
  let msg = 'Opened ' + f.name + '. Set the scale before measuring.';
  if (doc.type === 'cad') { if (doc.cad.unitM) { proj.scales[1] = doc.cad.unitM / doc.cad.k; proj.scaleNames = { 1: 'CAD units: ' + doc.cad.unitName }; msg = 'Opened ' + f.name + ' (' + doc.cad.unitName + '). True scale set from the drawing.'; } else msg = 'Opened ' + f.name + '. Drawing has no units: choose them in Set scale.'; }
  page = 1; resetHist(); fitPage(); renderLayers(); await persist(); toast(msg, 5000);
}
$('#file').addEventListener('change', onFile);

async function loadDoc(bytes, mime, name) {
  doc = { name, mime, bytes, sizes: [], vps: [] };
  if (mime === 'application/pdf') {
    doc.type = 'pdf';
    doc.pdf = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
    doc.numPages = doc.pdf.numPages;
    for (let i = 1; i <= doc.numPages; i++) { const p = await doc.pdf.getPage(i); const vp = p.getViewport({ scale: 1 }); doc.vps[i] = vp; doc.sizes[i] = { w: vp.width, h: vp.height }; }
  } else if (mime === 'application/dxf' || mime === 'application/dwg') {
    doc.type = 'cad'; doc.cad = await CAD.parse(bytes, mime === 'application/dxf' ? 'dxf' : 'dwg'); doc.numPages = 1; doc.sizes[1] = { w: doc.cad.w, h: doc.cad.h };
  } else {
    doc.type = 'image';
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    doc.img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
    doc.numPages = 1; doc.sizes[1] = { w: doc.img.naturalWidth, h: doc.img.naturalHeight };
  }
}

// ---------- rendering ----------
function layout() {
  document.body.classList.toggle('hasdoc', !!doc); if (!doc) return; const { w, h } = doc.sizes[page];
  stage.style.width = w * zoom + 'px'; stage.style.height = h * zoom + 'px';
  canvas.style.width = w * zoom + 'px'; canvas.style.height = h * zoom + 'px';
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  $('#zoomInfo').textContent = Math.round(zoom * 100) + '%';
  $('#pageInfo').textContent = page + ' / ' + doc.numPages;
  const s = scaleOf(page);
  $('#scaleInfo').textContent = 'Scale: ' + (s ? (proj.scaleNames && proj.scaleNames[page] || 'calibrated') : 'not set');
  $('#scaleInfo').style.color = s ? '#a5d6a7' : '#ffab91';
  draw(); clearTimeout(renderTimer); renderTimer = setTimeout(renderCanvas, 120);
}
async function renderCanvas() {
  if (!doc) return; const { w, h } = doc.sizes[page];
  let r = zoom * (window.devicePixelRatio || 1);
  const maxPx = 16e6; if (w * h * r * r > maxPx) r = Math.sqrt(maxPx / (w * h));
  const ctx = canvas.getContext('2d');
  if (doc.type === 'pdf') {
    if (renderTask) { renderTask.cancel(); renderTask = null; }
    const p = await doc.pdf.getPage(page); const vp = p.getViewport({ scale: r });
    const off = document.createElement('canvas'); off.width = Math.floor(vp.width); off.height = Math.floor(vp.height);
    renderTask = p.render({ canvasContext: off.getContext('2d'), viewport: vp });
    try { await renderTask.promise; } catch (e) { return; }
    renderTask = null; canvas.width = off.width; canvas.height = off.height; ctx.drawImage(off, 0, 0);
  } else if (doc.type === 'cad') {
    canvas.width = Math.floor(w * r); canvas.height = Math.floor(h * r); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); CAD.draw(ctx, doc.cad, r, 0, 0, (proj && proj.hidden) || {});
  } else {
    canvas.width = Math.floor(w * r); canvas.height = Math.floor(h * r); ctx.drawImage(doc.img, 0, 0, canvas.width, canvas.height);
  }
  canvas.dataset.rendered = page + ':' + zoom;
}
function el(tag, attrs, parent) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
function label(g, x, y, text, color) {
  const fs = 13 / zoom; const t = el('text', { x, y, 'font-size': fs, fill: color, 'font-weight': 700, 'text-anchor': 'middle', 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': 3 / zoom, 'pointer-events': 'none' }, g); t.textContent = text; return t;
}
function drawItem(it, g, isDraft) {
  const sw = 2.5 / zoom, c = it.color, sel = it.id === selId;
  const grp = el('g', { 'data-id': it.id || '' }, g);
  const ptsStr = it.pts.map(p => p.join(',')).join(' ');
  if (it.type === 'line' || it.type === 'poly' || it.type === 'calibrate') {
    el('polyline', { points: ptsStr, fill: 'none', stroke: c, 'stroke-width': sw, 'stroke-dasharray': it.type === 'calibrate' ? `${6 / zoom}` : '' }, grp);
    el('polyline', { points: ptsStr, fill: 'none', stroke: 'transparent', 'stroke-width': 14 / zoom, class: 'hit' }, grp);
    it.pts.forEach(p => el('circle', { cx: p[0], cy: p[1], r: 3 / zoom, fill: c }, grp));
    if (it.pts.length > 1 && it.type !== 'calibrate') { const a = it.pts[it.pts.length - 2], b = it.pts[it.pts.length - 1]; const txt = [it.label, fmtItem(it)].filter(Boolean).join(' '); label(grp, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 6 / zoom, txt, c); }
  } else if (it.type === 'area') {
    el(isDraft ? 'polyline' : 'polygon', { points: ptsStr, fill: c, 'fill-opacity': 0.2, stroke: c, 'stroke-width': sw }, grp);
    if (it.pts.length > 2) { const [x, y] = centroid(it.pts); label(grp, x, y, [it.label, fmtItem(it)].filter(Boolean).join(' '), c); }
  } else if (it.type === 'count') {
    const [x, y] = it.pts[0]; el('circle', { cx: x, cy: y, r: 9 / zoom, fill: c, 'fill-opacity': 0.85, stroke: '#fff', 'stroke-width': 1.5 / zoom }, grp);
    const n = proj.items.filter(o => o.type === 'count' && o.label === it.label && o.color === it.color && o.page === it.page);
    const t = el('text', { x, y: y + 4 / zoom, 'font-size': 11 / zoom, fill: '#fff', 'text-anchor': 'middle', 'font-weight': 700, 'pointer-events': 'none' }, grp); t.textContent = n.indexOf(it) + 1;
    if (it.label) { const l = label(grp, x, y - 12 / zoom, it.label, c); }
  } else if (it.type === 'text') {
    const [x, y] = it.pts[0]; const lines = (it.text || '').split('\n'); const fs = 14 / zoom;
    const t = el('text', { x, y, 'font-size': fs, fill: c, 'font-weight': 600, 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': 3 / zoom }, grp);
    lines.forEach((ln, i) => { const s = el('tspan', { x, dy: i ? fs * 1.2 : 0 }, t); s.textContent = ln; });
  }
  if (sel) it.pts.forEach((p, i) => el('rect', { x: p[0] - 6 / zoom, y: p[1] - 6 / zoom, width: 12 / zoom, height: 12 / zoom, fill: '#fff', stroke: '#1976d2', 'stroke-width': 2 / zoom, 'data-v': i, class: 'handle' }, grp));
}
function draw() {
  svg.innerHTML = ''; if (!proj) return;
  const g = el('g', {}, svg);
  proj.items.filter(i => i.page === page).forEach(i => drawItem(i, g));
  if (draft) { const full = draft.type === 'calibrate' && draft.pts.length === 2; const pts = hover && !full ? draft.pts.concat([hover]) : draft.pts; if (pts.length) drawItem({ ...draft, pts, page, label: draft.label }, g, true);
    const q = draft.pts[calSel]; if (q) el('circle', { cx: q[0], cy: q[1], r: 7 / zoom, fill: 'none', stroke: '#ffb300', 'stroke-width': 2.5 / zoom }, g); }
  renderList();
}

// ---------- side panel ----------
function groups() {
  const m = new Map();
  for (const it of proj.items) { if (it.type === 'text') continue;
    const lab = it.type === 'sleeve' ? [it.size, it.label].filter(Boolean).join(' ') : (it.label || ''); const k = it.type + '|' + lab + '|' + it.color; if (!m.has(k)) m.set(k, { type: it.type, label: lab, color: it.color, n: 0, sum: 0, noscale: 0 });
    const gr = m.get(k), v = measure(it); gr.n++; if (isFinite(v)) gr.sum += v; else gr.noscale++; }
  return [...m.values()];
}
function fmtGroup(g) { const u = proj.units; if (g.type === 'count' || g.type === 'sleeve') return g.n + ' ea'; if (g.type === 'area') return Units.fmtArea(g.sum, u); return Units.fmtLen(g.sum, u); }
function renderList() {
  if (!proj) return;
  $('#totals').innerHTML = '<table class="tot">' + groups().map(g => `<tr><td><span class="sw" style="display:inline-block;background:${g.color}"></span></td><td>${TYPE_NAMES[g.type]}${g.label ? ' - ' + esc(g.label) : ''}</td><td><b>${fmtGroup(g)}</b>${g.noscale ? ' *' : ''}</td></tr>`).join('') + '</table>' + (groups().some(g => g.noscale) ? '<small>* some items on pages without scale</small>' : '');
  const only = $('#pageOnly').checked;
  $('#list').innerHTML = proj.items.filter(i => !only || i.page === page).map(i => `<div class="row ${i.id === selId ? 'sel' : ''}" data-id="${i.id}"><span class="sw" style="background:${i.color}"></span>p${i.page} ${TYPE_NAMES[i.type]} ${esc(i.type === 'text' ? (i.text || '').slice(0, 20) : i.label || '')}<span class="v">${fmtItem(i)}</span></div>`).join('') || '<small>No items yet.</small>';
  const it = proj.items.find(i => i.id === selId); $('#edit').hidden = !it;
  if (it) { $('#eLabel').value = it.label || ''; $('#eColor').value = it.color; $('#eTextRow').hidden = it.type !== 'text'; $('#eText').value = it.text || '';
    $('#eDropRow').hidden = !(it.type === 'line' || it.type === 'poly'); if (document.activeElement !== $('#eExtra')) $('#eExtra').value = it.extra ? Units.fmtLen(it.extra, proj.units) : ''; }
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
$('#list').addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; const it = proj.items.find(i => i.id === r.dataset.id); selId = it.id; if (it.page !== page) gotoPage(it.page); else draw(); });
$('#pageOnly').addEventListener('change', renderList);
const selItem = () => proj && proj.items.find(i => i.id === selId);
$('#eLabel').addEventListener('input', e => { const it = selItem(); if (it) { it.label = e.target.value; changed(); } });
$('#eColor').addEventListener('input', e => { const it = selItem(); if (it) { it.color = e.target.value; changed(); } });
$('#eText').addEventListener('input', e => { const it = selItem(); if (it) { it.text = e.target.value; changed(); } });
$('#eExtra').addEventListener('change', e => { const it = selItem(); if (!it) return; const v = e.target.value.trim() ? Units.parseLength(e.target.value, proj.units) : 0; if (isNaN(v)) return toast('Could not read that length'); it.extra = v; changed(); });
$('#eDel').addEventListener('click', deleteSel);
function deleteSel() { if (!selId) return; proj.items = proj.items.filter(i => i.id !== selId); selId = null; changed(); }
function changed() { draw(); persistSoon(); commitSoon(); }

// ---------- navigation & zoom ----------
function gotoPage(n) { if (!doc) return; n = Math.max(1, Math.min(doc.numPages, n)); if (n !== page) { page = n; draft = null; } fitPage(); }
function fitPage() { if (!doc) return; const { w, h } = doc.sizes[page]; zoom = Math.max(0.05, Math.min((vpEl.clientWidth - 40) / w, (vpEl.clientHeight - 40) / h)); layout(); }
function setZoom(z, cx, cy) {
  if (!doc) return; z = Math.max(0.05, Math.min(20, z)); const r = vpEl.getBoundingClientRect();
  if (cx == null) { cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
  const px = (vpEl.scrollLeft + cx - r.left - stage.offsetLeft) / zoom, py = (vpEl.scrollTop + cy - r.top - stage.offsetTop) / zoom;
  zoom = z; layout();
  vpEl.scrollLeft = px * zoom + stage.offsetLeft - (cx - r.left); vpEl.scrollTop = py * zoom + stage.offsetTop - (cy - r.top);
}
$('#prev').onclick = () => gotoPage(page - 1); $('#next').onclick = () => gotoPage(page + 1);
$('#zoomIn').onclick = () => setZoom(zoom * 1.25); $('#zoomOut').onclick = () => setZoom(zoom / 1.25); $('#fit').onclick = fitPage;
vpEl.addEventListener('wheel', e => { if (!doc) return; e.preventDefault(); setZoom(zoom * Math.pow(1.0015, -e.deltaY), e.clientX, e.clientY); }, { passive: false });
window.addEventListener('resize', () => doc && layout());

// ---------- tools ----------
const HINTS = {
  select: 'Click an item to select. Drag handles to edit, drag item to move. Delete key removes. Drag empty space to pan.',
  pan: 'Drag to move around. Mouse wheel or pinch to zoom.',
  calibrate: 'Click two points of a known distance (hold Shift for straight). Then enter the real length.',
  line: 'Click start and end. Hold Shift to snap straight (horizontal/vertical).',
  poly: 'Click each point of the pipe run. Double-click, Enter or Finish to end. Shift = straight.',
  area: 'Click each corner. Double-click, Enter or Finish to close. Shift = straight.',
  count: 'Click each fixture. Set a label and colour first (e.g. WC red, Lav blue).',
  text: 'Click where the note goes, then type it.',
  sleeve: 'Click to place a sleeve. Choose the size first. Offsets to the nearest lines and X/Y from the origin are shown.',
  origin: 'Click a gridline intersection or corner to set the 0,0 origin for sleeve coordinates.'
};
function setTool(t) { tool = t; draft = null; hover = null; document.querySelectorAll('.tool').forEach(b => b.classList.toggle('active', b.dataset.tool === t)); $('#hint').textContent = HINTS[t]; vpEl.style.cursor = t === 'pan' ? 'grab' : t === 'select' ? 'default' : 'crosshair'; draw(); }
document.querySelectorAll('.tool').forEach(b => b.onclick = () => setTool(b.dataset.tool));
function pagePt(e) { const r = svg.getBoundingClientRect(); return [(e.clientX - r.left) / zoom, (e.clientY - r.top) / zoom]; }

function finishDraft() {
  if (!draft) return;
  if (draft.type === 'calibrate') { if (draft.pts.length === 2) openCalibrate(); return; }
  const need = { line: 2, poly: 2, area: 3 }[draft.type];
  if (draft.pts.length >= need) { const it = { id: uid(), type: draft.type, page, pts: draft.pts, color: draft.color, label: draft.label }; proj.items.push(it); selId = null; }
  draft = null; hover = null; changed();
}
$('#finishBtn').onclick = finishDraft;
$('#undoPt').onclick = () => { if (draft) { draft.pts.pop(); if (!draft.pts.length) draft = null; draw(); } };

function clickAt(p, e) {
  if (!doc || !proj) return;
  const color = $('#color').value, lab = $('#label').value.trim();
  if (['line', 'poly', 'area', 'calibrate'].includes(tool)) {
    if (!draft) draft = { type: tool, pts: [], color: tool === 'calibrate' ? '#1976d2' : color, label: lab };
    const prev = draft.pts[draft.pts.length - 1]; p = aim(p, e, prev);
    if (prev && dist(prev, p) < 1e-6) return;
    if (tool === 'calibrate' && draft.pts.length >= 2) return;
    draft.pts.push(p); calSel = draft.pts.length - 1;
    if ((tool === 'line' || tool === 'calibrate') && draft.pts.length === 2) {
      if (tool === 'line') finishDraft(); else { calSel = 1; toast('Adjust points if needed (drag, arrows), then Set distance.', 4000); }
    }
    draw();
  } else if (tool === 'count') { p = aim(p, e, null); proj.items.push({ id: uid(), type: 'count', page, pts: [p], color, label: lab }); changed(); }
  else if (tool === 'sleeve') { p = aim(p, e, null); proj.items.push({ id: uid(), type: 'sleeve', page, pts: [p], color, label: lab, size: $('#sleeveSize').value, text: '' }); changed(); }
  else if (tool === 'origin') { p = aim(p, e, null); proj.origins = proj.origins || {}; proj.origins[page] = p; changed(); toast('Origin set. Sleeve X/Y are measured from here (Y up).'); }
  else if (tool === 'text') { const t = prompt('Note text:'); if (t) { proj.items.push({ id: uid(), type: 'text', page, pts: [p], color, label: '', text: t }); changed(); } }
}

// pointer handling: click / drag / pan / pinch
const pointers = new Map(); let gesture = null;
vpEl.addEventListener('pointerdown', e => {
  if (!doc) return; vpEl.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; gesture = { kind: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; hideLoupe(); return; }
  const p = pagePt(e);
  gesture = { kind: 'maybe', sx: e.clientX, sy: e.clientY, sl: vpEl.scrollLeft, st: vpEl.scrollTop, p, moved: false };
  if (e.button === 1 || tool === 'pan') { gesture.kind = 'pan'; return; }
  if (draft && PLACE.includes(tool)) { const k = draft.pts.findIndex(q => dist(q, p) * zoom < (e.pointerType === 'touch' ? 22 : 10)); if (k >= 0 && (draft.type === 'calibrate' ? draft.pts.length === 2 : true)) { gesture.kind = 'dpt'; gesture.v = k; calSel = k; gesture.off = [draft.pts[k][0] - p[0], draft.pts[k][1] - p[1]]; showLoupe(draft.pts[k], e); draw(); return; } }
  if (e.pointerType !== 'mouse' && PLACE.includes(tool) && !(tool === 'calibrate' && draft && draft.pts.length === 2)) { gesture.kind = 'place'; hover = placeSnap(p, e); showLoupe(hover, e); draw(); return; }
  if (tool === 'select') {
    const h = e.target.closest('.handle'), g = e.target.closest('g[data-id]');
    if (h && selId) { gesture.kind = 'vertex'; gesture.v = +h.dataset.v; return; }
    if (g && g.dataset.id) { selId = g.dataset.id; const it = selItem(); gesture.kind = 'move'; gesture.orig = it.pts.map(q => q.slice()); draw(); return; }
    gesture.kind = 'pan'; gesture.desel = true;
  }
});
vpEl.addEventListener('pointermove', e => {
  if (!doc) return;
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (gesture && gesture.kind === 'pinch' && pointers.size === 2) { const [a, b] = [...pointers.values()]; const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; setZoom(gesture.z * Math.hypot(a.x - b.x, a.y - b.y) / gesture.d, mx, my); vpEl.scrollLeft -= mx - gesture.mx; vpEl.scrollTop -= my - gesture.my; gesture.mx = mx; gesture.my = my; return; }
  const p = pagePt(e);
  if (gesture) {
    const mv = Math.hypot(e.clientX - gesture.sx, e.clientY - gesture.sy) > 5; if (mv) gesture.moved = true;
    if (gesture.kind === 'pan' || (gesture.kind === 'maybe' && gesture.moved && e.pointerType === 'touch')) { gesture.kind = 'pan'; vpEl.scrollLeft = gesture.sl - (e.clientX - gesture.sx); vpEl.scrollTop = gesture.st - (e.clientY - gesture.sy); return; }
    if (gesture.kind === 'place') { hover = placeSnap(p, e); draw(); showLoupe(hover, e); return; }
    if (gesture.kind === 'dpt') { const o = draft.pts[gesture.v]; draft.pts[gesture.v] = aim([p[0] + gesture.off[0], p[1] + gesture.off[1]], e, null, o); draw(); showLoupe(draft.pts[gesture.v], e); return; }
    if (gesture.kind === 'vertex') { const it = selItem(); let q = p; const prev = it.pts[gesture.v - 1] || it.pts[gesture.v + 1]; q = aim(q, e, prev, it.pts[gesture.v]); it.pts[gesture.v] = q; draw(); return; }
    if (gesture.kind === 'move' && gesture.moved) { const it = selItem(); const dx = p[0] - gesture.p[0], dy = p[1] - gesture.p[1]; it.pts = gesture.orig.map(q => [q[0] + dx, q[1] + dy]); draw(); return; }
  }
  if (draft) { const prev = draft.pts[draft.pts.length - 1]; hover = aim(p, e, prev); draw(); }
  else if (['count', 'sleeve', 'origin'].includes(tool) && !gesture) { aim(p, e, null); }
  if (PLACE.includes(tool) && !(draft && draft.type === 'calibrate' && draft.pts.length === 2)) showLoupe(placeSnap(p, e), e); else if (!gesture) hideLoupe();
});
function endPointer(e) {
  pointers.delete(e.pointerId);
  if (!gesture) return; const g = gesture;
  if (g.kind === 'pinch') { if (pointers.size === 0) gesture = null; return; }
  gesture = null;
  if (g.kind === 'place') { hideLoupe(); hover = null; if (e.type === 'pointerup') clickAt(pagePt(e), e); else draw(); return; }
  if (g.kind === 'dpt') { if (e.pointerType !== 'mouse') hideLoupe(); draw(); return; }
  if (g.kind === 'vertex' || g.kind === 'move') { changed(); return; }
  if (g.kind === 'pan') { if (g.desel && !g.moved) { selId = null; draw(); } return; }
  if (g.kind === 'maybe' && !g.moved && e.type === 'pointerup') clickAt(pagePt(e), e);
}
vpEl.addEventListener('pointerup', endPointer); vpEl.addEventListener('pointercancel', endPointer);
vpEl.addEventListener('dblclick', e => { if (draft && (draft.type === 'poly' || draft.type === 'area')) { // remove the duplicate point added by the 2nd click
  if (draft.pts.length > 1 && dist(draft.pts[draft.pts.length - 1], draft.pts[draft.pts.length - 2]) < 4 / zoom) draft.pts.pop(); finishDraft(); } });
document.addEventListener('keydown', e => {
  if (e.key === 'Shift') shiftDown = true;
  if (e.target.matches('input:not([type=checkbox]),textarea,select')) return;
  if (e.key.startsWith('Arrow') && draft && draft.pts.length) { e.preventDefault(); const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; nudge(d[0], d[1]); return; }
  if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey) { toggleLoupe(); return; }
  if (e.key === 'Tab' && draft && draft.pts.length > 1) { e.preventDefault(); calSel = (calSel + 1) % draft.pts.length; draw(); return; }
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
  if (e.key === 'Enter') { e.preventDefault(); finishDraft(); }
  else if (e.key === 'Escape') { draft = null; hover = null; selId = null; draw(); }
  else if (e.key === 'Delete' || (e.key === 'Backspace' && !draft)) deleteSel();
  else if (e.key === 'Backspace' && draft) { draft.pts.pop(); if (!draft.pts.length) draft = null; draw(); }
  else { const m = { v: 'select', h: 'pan', k: 'calibrate', l: 'line', p: 'poly', a: 'area', c: 'count', t: 'text', e: 'sleeve', o: 'origin' }[e.key.toLowerCase()]; if (m && !e.ctrlKey && !e.metaKey) setTool(m); }
});
document.addEventListener('keyup', e => { if (e.key === 'Shift') shiftDown = false; });

// ---------- scale ----------
Units.STD.forEach((s, i) => { const o = document.createElement('option'); o.value = i; o.textContent = s.name; $('#stdScale').appendChild(o); });
$('#stdScale').value = Units.STD.findIndex(s => s.ratio === 48);
function applyScale(mPerUnit, name, all) { const pgs = all ? Array.from({ length: doc.numPages }, (_, i) => i + 1) : [page]; proj.scaleNames = proj.scaleNames || {}; pgs.forEach(p => { proj.scales[p] = mPerUnit; proj.scaleNames[p] = name; }); layout(); persistSoon(); commitHist(); toast('Scale set: ' + name); }
$('#scaleBtn').onclick = () => { if (!doc) return toast('Open a plan first'); $('#imgDpiRow').hidden = doc.type !== 'image'; $('#cadUnitRow').hidden = doc.type !== 'cad'; $('#stdScale').hidden = doc.type === 'cad'; $('#scaleDlg').showModal(); };
$('#scaleDlg').addEventListener('close', () => { if ($('#scaleDlg').returnValue !== 'ok') return; if (doc.type === 'cad') { const u = +$('#cadUnit').value; return applyScale(CAD.UNIT_M[u] / doc.cad.k, 'CAD units: ' + CAD.UNIT_NAME[u], false); }
  const s = Units.STD[$('#stdScale').value];
  let m = s.mPerPt; if (doc.type === 'image') m = s.ratio * Units.IN / (+$('#imgDpi').value || 150); applyScale(m, s.name, $('#allPages').checked); });
function openCalibrate() { $('#calVal').value = ''; $('#calDlg').showModal(); }
$('#calDlg').addEventListener('close', () => {
  const pts = draft && draft.pts;
  if ($('#calDlg').returnValue === 'ok' && pts && pts.length === 2) {
    draft = null; hover = null;
    const real = Units.parseLength($('#calVal').value, proj.units);
    if (!(real > 0)) { toast('Could not read that length. Try again.'); draw(); return; }
    applyScale(real / dist(pts[0], pts[1]), 'calibrated ' + Units.fmtLen(real, proj.units), $('#calAll').checked);
    setTool('line');
  } else draw();
});
$('#units').addEventListener('change', e => { if (proj) { proj.units = e.target.value; changed(); } });

// ---------- CSV export ----------
function csvCell(v) { v = String(v ?? ''); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
function buildCSV() {
  const u = proj.units, lu = u === 'met' ? 'm' : 'ft', au = u === 'met' ? 'm2' : 'sq ft', lf = u === 'met' ? 1 : 1 / Units.FT, af = lf * lf;
  const rows = [['Project', proj.name], [], ['Page', 'Type', 'Label', 'Colour', 'Quantity', 'Unit', 'Display', 'Added length', 'Note']];
  proj.items.forEach(it => { const v = measure(it); let q = '', un = '';
    if (it.type === 'line' || it.type === 'poly') { q = isFinite(v) ? (v * lf).toFixed(3) : ''; un = lu; }
    else if (it.type === 'area') { q = isFinite(v) ? (v * af).toFixed(3) : ''; un = au; }
    else if (it.type === 'count') { q = 1; un = 'ea'; }
    rows.push([it.page, TYPE_NAMES[it.type], it.label || '', it.color, q, un, fmtItem(it), it.extra ? Units.fmtLen(it.extra, u) : '', it.text || '']); });
  rows.push([], ['TOTALS'], ['Type', 'Label', 'Colour', 'Quantity', 'Unit', 'Display', 'Items']);
  groups().forEach(g => rows.push([TYPE_NAMES[g.type], g.label, g.color, g.type === 'count' ? g.n : g.type === 'area' ? (g.sum * af).toFixed(3) : (g.sum * lf).toFixed(3), g.type === 'count' ? 'ea' : g.type === 'area' ? au : lu, fmtGroup(g), g.n]));
  return rows.map(r => r.map(csvCell).join(',')).join('\r\n');
}
function download(data, name, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
$('#csvBtn').onclick = () => { if (!proj) return; download('\ufeff' + buildCSV(), proj.name + '-takeoff.csv', 'text/csv'); };

// ---------- PDF export ----------
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return PDFLib.rgb((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); }
const winAnsi = s => String(s).replace(/²/g, '2').replace(/[^\x20-\x7e\xa0-\xff]/g, '?');
async function buildPDF() {
  const { PDFDocument, StandardFonts } = PDFLib; let out, conv;
  if (doc.type === 'pdf') { out = await PDFDocument.load(doc.bytes.slice(), { ignoreEncryption: true }); conv = (pg, p) => doc.vps[pg].convertToPdfPoint(p[0], p[1]); }
  else if (doc.type === 'cad') {
    out = await PDFDocument.create(); const { w, h } = doc.sizes[1], M = doc.cad, hid = proj.hidden || {}, pg = out.addPage([w, h]); const f0 = await out.embedFont(StandardFonts.Helvetica);
    for (const s of M.segs) if (!hid[M.layerNames[s[5]]]) pg.drawLine({ start: { x: s[0], y: h - s[1] }, end: { x: s[2], y: h - s[3] }, thickness: 0.4, color: hexRgb(s[6]) });
    for (const t of M.texts) if (!hid[M.layerNames[t.L]] && t.text && t.h > 1) t.text.split('\n').forEach((ln, i) => { try { pg.drawText(winAnsi(ln), { x: t.x, y: h - t.y - (t.top ? t.h : 0) - i * t.h * 1.4, size: t.h, font: f0, color: hexRgb(t.col), rotate: PDFLib.degrees(t.rot * 180 / Math.PI) }); } catch (e) { } });
    conv = (n, p) => [p[0], h - p[1]];
  }
  else {
    out = await PDFDocument.create(); let img;
    if (doc.mime === 'image/jpeg') img = await out.embedJpg(doc.bytes);
    else if (doc.mime === 'image/png') img = await out.embedPng(doc.bytes);
    else { const c = document.createElement('canvas'); c.width = doc.sizes[1].w; c.height = doc.sizes[1].h; c.getContext('2d').drawImage(doc.img, 0, 0); img = await out.embedPng(await (await fetch(c.toDataURL('image/png'))).arrayBuffer()); }
    const pg = out.addPage([doc.sizes[1].w, doc.sizes[1].h]); pg.drawImage(img, { x: 0, y: 0, width: doc.sizes[1].w, height: doc.sizes[1].h });
    conv = (n, p) => [p[0], doc.sizes[1].h - p[1]];
  }
  const font = await out.embedFont(StandardFonts.HelveticaBold), pages = out.getPages();
  for (const it of proj.items) {
    const pg = pages[it.page - 1]; if (!pg) continue; const c = hexRgb(it.color); const P = it.pts.map(p => conv(it.page, p));
    const size = Math.max(6, Math.min(doc.sizes[it.page].w, doc.sizes[it.page].h) / 90);
    const txt = (s, x, y, sz = size) => { s = winAnsi(s); if (!s) return; const w = font.widthOfTextAtSize(s, sz); pg.drawRectangle({ x: x - w / 2 - 1, y: y - 2, width: w + 2, height: sz + 2, color: PDFLib.rgb(1, 1, 1), opacity: 0.8 }); pg.drawText(s, { x: x - w / 2, y, size: sz, font, color: c }); };
    if (it.type === 'line' || it.type === 'poly') { for (let i = 1; i < P.length; i++) pg.drawLine({ start: { x: P[i - 1][0], y: P[i - 1][1] }, end: { x: P[i][0], y: P[i][1] }, thickness: size / 6, color: c });
      const a = P[P.length - 2], b = P[P.length - 1]; txt([it.label, fmtItem(it)].filter(Boolean).join(' '), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + size / 3); }
    else if (it.type === 'area') { const path = P.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + (-p[1])).join(' ') + ' Z';
      pg.drawSvgPath(path, { x: 0, y: 0, color: c, opacity: 0.2, borderColor: c, borderWidth: size / 6 }); const [x, y] = centroid(P); txt([it.label, fmtItem(it)].filter(Boolean).join(' '), x, y); }
    else if (it.type === 'count') { const [x, y] = P[0]; pg.drawCircle({ x, y, size: size * 0.8, color: c, opacity: 0.85 });
      const n = proj.items.filter(o => o.type === 'count' && o.label === it.label && o.color === it.color && o.page === it.page).indexOf(it) + 1; const s = String(n), w = font.widthOfTextAtSize(s, size * 0.8);
      pg.drawText(s, { x: x - w / 2, y: y - size * 0.28, size: size * 0.8, font, color: PDFLib.rgb(1, 1, 1) }); if (it.label) txt(it.label, x, y + size); }
    else if (it.type === 'sleeve') { const [x, y] = P[0], inf = sleeveInfo(it), dc = PDFLib.rgb(0.1, 0.1, 0.1);
      if (inf.rx) { const q = conv(it.page, [inf.rx.x, it.pts[0][1]]); pg.drawLine({ start: { x, y }, end: { x: q[0], y: q[1] }, thickness: size / 10, color: c, dashArray: [size / 3, size / 4] }); txt(Units.fmtLen(inf.dx, proj.units), (x + q[0]) / 2, (y + q[1]) / 2 + size / 4, size * 0.8); }
      if (inf.ry) { const q = conv(it.page, [it.pts[0][0], inf.ry.y]); pg.drawLine({ start: { x, y }, end: { x: q[0], y: q[1] }, thickness: size / 10, color: c, dashArray: [size / 3, size / 4] }); txt(Units.fmtLen(inf.dy, proj.units), (x + q[0]) / 2 + size * 2, (y + q[1]) / 2, size * 0.8); }
      pg.drawCircle({ x, y, size: size * 0.9, borderColor: c, borderWidth: size / 6, color: PDFLib.rgb(1, 1, 1), opacity: 0.9 }); pg.drawLine({ start: { x: x - size * 0.9, y }, end: { x: x + size * 0.9, y }, thickness: size / 10, color: c }); pg.drawLine({ start: { x, y: y - size * 0.9 }, end: { x, y: y + size * 0.9 }, thickness: size / 10, color: c });
      txt(sleeveName(it) + ' ' + (it.size || ''), x, y + size * 1.3); }
    else if (it.type === 'text') { (it.text || '').split('\n').forEach((ln, i) => { const s = winAnsi(ln); pg.drawText(s, { x: P[0][0], y: P[0][1] - size * 1.2 * i, size: size * 1.1, font, color: c }); }); }
  }
  for (const pgn in (proj.origins || {})) { const pg = pages[pgn - 1], o = proj.origins[pgn]; if (!pg || !o) continue; const [x, y] = conv(+pgn, o), s = Math.max(6, Math.min(doc.sizes[pgn].w, doc.sizes[pgn].h) / 90), oc = PDFLib.rgb(0.8, 0.1, 0.5);
    pg.drawLine({ start: { x: x - 2 * s, y }, end: { x: x + 2 * s, y }, thickness: s / 6, color: oc }); pg.drawLine({ start: { x, y: y - 2 * s }, end: { x, y: y + 2 * s }, thickness: s / 6, color: oc }); pg.drawText('0,0', { x: x + s / 2, y: y + s / 2, size: s, font, color: oc }); }
  // takeoff summary page
  const sp = out.addPage([612, 792]); let y = 750; sp.drawText(winAnsi('Takeoff summary - ' + proj.name), { x: 40, y, size: 16, font }); y -= 30;
  for (const g of groups()) { if (y < 40) break; sp.drawCircle({ x: 46, y: y + 4, size: 5, color: hexRgb(g.color) }); sp.drawText(winAnsi(`${TYPE_NAMES[g.type]}${g.label ? ' - ' + g.label : ''}:  ${fmtGroup(g)}  (${g.n} item${g.n > 1 ? 's' : ''})`), { x: 58, y, size: 11, font }); y -= 18; }
  return out.save();
}
$('#pdfBtn').onclick = async () => { if (!proj) return; toast('Building PDF...'); try { download(await buildPDF(), proj.name + '-marked.pdf', 'application/pdf'); } catch (e) { console.error(e); toast('PDF export failed: ' + e.message, 5000); } };

// ---------- storage (IndexedDB) ----------
let dbp = null;
function db() { return dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open('plan-measure', 1); r.onupgradeneeded = () => r.result.createObjectStore('projects', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })); }
async function idb(mode, fn) { const d = await db(); return new Promise((res, rej) => { const tx = d.transaction('projects', mode); const r = fn(tx.objectStore('projects')); tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error); }); }
let saveTimer; function persistSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 800); }
async function persist() { if (!proj || !doc) return; try { await idb('readwrite', s => s.put({ ...JSON.parse(JSON.stringify(proj)), bytes: doc.bytes, updated: Date.now() })); localStorage.setItem('pm-last', proj.id); } catch (e) { toast('Could not save: ' + e.message); } }
$('#saveBtn').onclick = async () => { if (!proj) return; const n = prompt('Project name:', proj.name); if (n) { proj.name = n; await persist(); toast('Saved in this browser'); } };
async function openProject(id) { const r = await idb('readonly', s => s.get(id)); if (!r) return; const { bytes, updated, ...p } = r; await loadDoc(new Uint8Array(bytes), p.fileType, p.fileName); proj = p; resetHist(); $('#units').value = p.units; page = 1; selId = null; draft = null; fitPage(); localStorage.setItem('pm-last', id); }
$('#projBtn').onclick = async () => { const all = await idb('readonly', s => s.getAll()); all.sort((a, b) => b.updated - a.updated);
  $('#projList').innerHTML = all.map(p => `<div class="proj"><span>${esc(p.name)}<br><small>${new Date(p.updated).toLocaleString()} - ${p.items.length} items</small></span><button type="button" class="btn" data-open="${p.id}">Open</button><button type="button" class="btn danger" data-del="${p.id}">Delete</button></div>`).join('') || 'No saved projects.';
  $('#projDlg').showModal(); };
$('#projList').addEventListener('click', async e => { const o = e.target.dataset.open, d = e.target.dataset.del;
  if (o) { $('#projDlg').close(); await openProject(o); } if (d && confirm('Delete this project?')) { await idb('readwrite', s => s.delete(d)); $('#projDlg').close(); $('#projBtn').click(); } });

setTool('select'); $('#hint').textContent = 'Open a PDF or image plan to start. Your work is saved automatically in this browser.';
(async () => { const last = localStorage.getItem('pm-last'); if (last) try { await openProject(last); } catch (e) { } })();
// test hook
window.PM = { undo: () => undo(), redo: () => redo(), get hist() { return { u: H.u.length, r: H.r.length }; }, get draft() { return draft; }, get proj() { return proj; }, get doc() { return doc; }, measure, buildCSV, buildPDF, setTool, gotoPage, applyScale, get zoom() { return zoom; } };
$('#calVal').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#calDlg').close('ok'); } });
// ---- icons (inline SVG, no external assets) ----
const ICONS = {
 open:'<path d="M3 7h6l2 2h10v10H3z"/>', save:'<path d="M5 3h12l3 3v15H4V3z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>', folder:'<path d="M3 6h6l2 2h10v11H3z"/><path d="M3 11h18"/>',
 left:'<path d="M15 5l-7 7 7 7"/>', right:'<path d="M9 5l7 7-7 7"/>', minus:'<path d="M5 12h14"/>', plus:'<path d="M5 12h14M12 5v14"/>',
 fit:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', ruler:'<path d="M3 16L16 3l5 5L8 21z"/><path d="M7 12l2 2M10 9l2 2M13 6l2 2"/>',
 table:'<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 10h18M3 15h18M9 4v16"/>', download:'<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
 panel:'<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M15 4v16"/>', close:'<path d="M6 6l12 12M18 6L6 18"/>',
 undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-4"/>', redo:'<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 000 12h4"/>', snap:'<rect x="8" y="8" width="8" height="8"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>', sleeve:'<circle cx="12" cy="12" r="7"/><path d="M5 12h14M12 5v14"/>', origin:'<path d="M4 20V4M4 20h16"/><circle cx="4" cy="20" r="2"/>', layers:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>', find:'<circle cx="10" cy="10" r="6"/><path d="M14.5 14.5L20 20"/><circle cx="10" cy="10" r="2"/>', select:'<path d="M5 3l14 8-6 2-2 6z"/>', loupe:'<circle cx="10" cy="10" r="6"/><path d="M14.5 14.5L20 20M10 7v6M7 10h6"/>', up:'<path d="M5 15l7-7 7 7"/>', down:'<path d="M5 9l7 7 7-7"/>', more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>', hand:'<path d="M8 13V5a1.5 1.5 0 013 0v6M11 11V4a1.5 1.5 0 013 0v7M14 11V6a1.5 1.5 0 013 0v8c0 4-3 7-7 7s-6-3-7-6l-1-3a1.5 1.5 0 012.5-1.5L8 13"/>',
 cal:'<path d="M4 20L20 4"/><circle cx="4" cy="20" r="2"/><circle cx="20" cy="4" r="2"/><path d="M9 9l-2-2M15 15l2 2"/>', line:'<path d="M4 18L20 6"/><path d="M4 14v8M20 2v8"/>',
 poly:'<path d="M3 19h6V9h6v6h6"/><circle cx="3" cy="19" r="1.5"/><circle cx="21" cy="15" r="1.5"/>', area:'<path d="M4 6l12-2 4 10-8 6-8-4z" fill="currentColor" fill-opacity=".25"/>',
 count:'<circle cx="7" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><circle cx="12" cy="17" r="3"/>', text:'<path d="M5 5h14M12 5v14M9 19h6"/>'
};
document.querySelectorAll('[data-icon]').forEach(b => { const txt = [...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
  [...b.childNodes].filter(n => n.nodeType === 3).forEach(n => n.remove());
  b.insertAdjacentHTML('afterbegin', `<svg class="ic" viewBox="0 0 24 24">${ICONS[b.dataset.icon]}</svg>` + (txt ? `<span class="t">${txt}</span>` : '')); });
function togglePanel(force) { document.body.classList.toggle('noside', force); localStorage.setItem('pm-noside', document.body.classList.contains('noside') ? 1 : ''); if (doc) fitPage(); }
$('#panelBtn').onclick = () => togglePanel(); $('#panelClose').onclick = () => togglePanel(true);
if (localStorage.getItem('pm-noside')) document.body.classList.add('noside');
// ---- phone layout ----
ICONS.more = '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'; $('#moreBtn svg').innerHTML = ICONS.more;
document.querySelectorAll('#moreBtn,#moreMenu [data-icon],#cancelBtn').forEach(b => { if (b.querySelector('svg')) return; const txt = b.textContent.trim(); b.textContent = '';
  b.insertAdjacentHTML('afterbegin', `<svg class="ic" viewBox="0 0 24 24">${ICONS[b.dataset.icon]}</svg><span class="t">${txt}</span>`); });
$('#file2').addEventListener('change', onFile);
const phoneMQ = matchMedia('(max-width: 700px)');
const drawEls = ['.opt:nth-of-type(1)', '.opt:nth-of-type(2)'];
function placeDrawControls() {
  const opts = [...document.querySelectorAll('.opt')], fin = $('#finishBtn'), und = $('#undoPt');
  if (phoneMQ.matches) { [...opts, und, fin].forEach(n => $('#drawSlot').appendChild(n)); }
  else { const hint = $('#hint'); [...opts, fin, und].forEach(n => $('#tools').insertBefore(n, hint)); }
  updateDrawBar(); if (doc) fitPage();
}
function updateDrawBar() {
  const drawing = ['line', 'poly', 'area', 'count', 'text', 'calibrate', 'sleeve', 'origin'].includes(tool);
  document.body.classList.toggle('drawing', drawing);
  document.body.classList.toggle('multi', tool === 'poly' || tool === 'area');
  document.body.classList.toggle('hasdraft', !!draft);
  document.body.classList.toggle('cal', tool === 'calibrate');
}
phoneMQ.addEventListener('change', placeDrawControls);
const _draw = draw; draw = function () { _draw(); updateDrawBar(); updateSheet(); };
$('#cancelBtn').onclick = () => { if (draft) { draft = null; hover = null; draw(); } else setTool('select'); };
$('#moreBtn').onclick = e => { e.stopPropagation(); $('#moreMenu').hidden = !$('#moreMenu').hidden; };
document.addEventListener('click', e => { if (!e.target.closest('#moreMenu,#moreBtn')) $('#moreMenu').hidden = true; });
$('#moreMenu').addEventListener('click', e => { const b = e.target.closest('[data-proxy]'); if (!b) return; $('#moreMenu').hidden = true; $(b.dataset.proxy).click(); });
$('#units2').addEventListener('change', e => { $('#units').value = e.target.value; $('#units').dispatchEvent(new Event('change')); });
$('#scaleInfo').onclick = () => $('#scaleBtn').click();
$('#sheetHandle').onclick = () => { document.body.classList.toggle('sheetopen'); updateSheet(); };
function updateSheet() { if (!proj) return; const g = groups(); $('#units2').value = proj.units;
  $('#sheetSum').textContent = g.length ? g.slice(0, 3).map(x => (x.label || TYPE_NAMES[x.type]) + ' ' + fmtGroup(x)).join('  |  ') + (g.length > 3 ? '  ...' : '') : 'Takeoff: no items yet';
  $('.chev').textContent = document.body.classList.contains('sheetopen') ? 'Hide' : 'Show'; }
document.addEventListener('gesturestart', e => e.preventDefault());
placeDrawControls(); layout();
// ---- magnifier loupe + nudge ----
ICONS.loupe = '<circle cx="10" cy="10" r="6"/><path d="M14.5 14.5L20 20M10 7v6M7 10h6"/>';
ICONS.up = '<path d="M5 15l7-7 7 7"/>'; ICONS.down = '<path d="M5 9l7 7 7-7"/>';
document.querySelectorAll('#loupeBtn,.nud').forEach(b => { if (b.querySelector('svg')) return; const txt = b.textContent.trim(); b.textContent = ''; b.insertAdjacentHTML('afterbegin', `<svg class="ic" viewBox="0 0 24 24">${ICONS[b.dataset.icon]}</svg>` + (txt ? `<span class="t">${txt}</span>` : '')); });
const PLACE = ['calibrate', 'line', 'poly', 'area'];
let calSel = 0, loupeOn = localStorage.getItem('pm-loupe') !== '0', loupeTask = null, loupeBusy = false, loupeWant = null;
const LSZ = 140, lc = $('#loupe');
function placeSnap(p, e) { return aim(p, e, draft && draft.pts.length ? draft.pts[draft.pts.length - 1] : null); }
function toggleLoupe() { loupeOn = !loupeOn; localStorage.setItem('pm-loupe', loupeOn ? '1' : '0'); $('#loupeBtn').classList.toggle('on', loupeOn); if (!loupeOn) hideLoupe(); toast('Magnifier ' + (loupeOn ? 'on' : 'off')); }
$('#loupeBtn').classList.toggle('on', loupeOn); $('#loupeBtn').onclick = toggleLoupe;
function hideLoupe() { lc.style.display = 'none'; loupeWant = null; }
function showLoupe(p, e) {
  if (!loupeOn || !doc || !p) return hideLoupe();
  const dpr = window.devicePixelRatio || 1, L = Math.round(LSZ * dpr);
  if (lc.width !== L) { lc.width = L; lc.height = L; }
  const touch = e.pointerType && e.pointerType !== 'mouse';
  let x = touch ? e.clientX - LSZ / 2 : e.clientX + 24, y = touch ? e.clientY - LSZ - 60 : e.clientY - LSZ - 24;
  if (y < 4) y = touch ? e.clientY + 60 : e.clientY + 24; x = Math.max(4, Math.min(innerWidth - LSZ - 4, x));
  if (!touch && x < e.clientX && x + LSZ > e.clientX && y < e.clientY && y + LSZ > e.clientY) x = e.clientX - LSZ - 24;
  lc.style.left = x + 'px'; lc.style.top = y + 'px'; lc.style.display = 'block';
  const mag = +$('#loupeMag').value, S = zoom * mag * dpr; // device px per page unit inside loupe
  const ctx = lc.getContext('2d');
  // instant preview from the main canvas
  const k = canvas.width / doc.sizes[page].w, half = L / 2 / S;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, L, L);
  if (canvas.width) ctx.drawImage(canvas, (p[0] - half) * k, (p[1] - half) * k, 2 * half * k, 2 * half * k, 0, 0, L, L);
  loupeOverlay(ctx, p, S, L);
  loupeWant = { p: p.slice(), S, L, pg: page }; sharpLoupe();
}
async function sharpLoupe() {
  if (loupeBusy || !loupeWant) return; const w = loupeWant; loupeBusy = true;
  try {
    const off = document.createElement('canvas'); off.width = w.L; off.height = w.L; const oc = off.getContext('2d'); oc.fillStyle = '#fff'; oc.fillRect(0, 0, w.L, w.L);
    if (doc.type === 'pdf') { const pg = await doc.pdf.getPage(w.pg); const vp = pg.getViewport({ scale: w.S, offsetX: -(w.p[0] * w.S - w.L / 2), offsetY: -(w.p[1] * w.S - w.L / 2) });
      await pg.render({ canvasContext: oc, viewport: vp }).promise; }
    else if (doc.type === 'cad') { CAD.draw(oc, doc.cad, w.S, -(w.p[0] * w.S - w.L / 2), -(w.p[1] * w.S - w.L / 2), proj.hidden || {}); }
    else { const h = w.L / 2 / w.S; oc.imageSmoothingEnabled = false; oc.drawImage(doc.img, w.p[0] - h, w.p[1] - h, 2 * h, 2 * h, 0, 0, w.L, w.L); }
    if (loupeWant && lc.style.display !== 'none' && loupeWant.pg === w.pg) { const cur = loupeWant, ctx = lc.getContext('2d');
      if (cur.p[0] === w.p[0] && cur.p[1] === w.p[1] && cur.S === w.S) { ctx.drawImage(off, 0, 0); loupeOverlay(ctx, w.p, w.S, w.L); lc.dataset.sharp = '1'; } }
  } catch (err) { }
  loupeBusy = false; if (loupeWant && (loupeWant.p[0] !== w.p[0] || loupeWant.p[1] !== w.p[1] || loupeWant.S !== w.S)) { lc.dataset.sharp = ''; setTimeout(sharpLoupe, 30); }
}
function loupeOverlay(ctx, p, S, L) {
  const T = q => [(q[0] - p[0]) * S + L / 2, (q[1] - p[1]) * S + L / 2], dpr = window.devicePixelRatio || 1;
  if (draft && draft.pts.length) { ctx.strokeStyle = draft.color; ctx.lineWidth = 1.5 * dpr; ctx.beginPath(); draft.pts.forEach((q, i) => { const [x, y] = T(q); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); if (!(draft.type === 'calibrate' && draft.pts.length === 2) && hover) { const [x, y] = T(hover); ctx.lineTo(x, y); } ctx.stroke();
    draft.pts.forEach((q, i) => { const [x, y] = T(q); ctx.beginPath(); ctx.arc(x, y, (i === calSel ? 5 : 3) * dpr, 0, 7); ctx.strokeStyle = i === calSel ? '#ffb300' : draft.color; ctx.stroke(); }); }
  if (snapHit) { const [sx, sy] = T(snapHit.p); drawSnapMark(ctx, sx, sy, snapHit.kind, 7 * dpr, 2 * dpr); }
  ctx.strokeStyle = '#e53935'; ctx.lineWidth = 1 * dpr; const c = L / 2, g = 6 * dpr; ctx.beginPath();
  ctx.moveTo(0, c); ctx.lineTo(c - g, c); ctx.moveTo(c + g, c); ctx.lineTo(L, c); ctx.moveTo(c, 0); ctx.lineTo(c, c - g); ctx.moveTo(c, c + g); ctx.lineTo(c, L); ctx.stroke();
  ctx.fillStyle = '#e53935'; ctx.fillRect(c - dpr / 2, c - dpr / 2, dpr, dpr);
  ctx.fillStyle = '#263238cc'; ctx.fillRect(L / 2 - 16 * dpr, L - 18 * dpr, 32 * dpr, 14 * dpr); ctx.fillStyle = '#fff'; ctx.font = `${10 * dpr}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText($('#loupeMag').value + 'x', L / 2, L - 7 * dpr);
}
function nudge(dx, dy) { if (!draft || !draft.pts.length) return; const i = Math.min(calSel, draft.pts.length - 1), q = draft.pts[i]; draft.pts[i] = [q[0] + dx / zoom, q[1] + dy / zoom]; draw();
  const r = svg.getBoundingClientRect(); showLoupe(draft.pts[i], { clientX: r.left + draft.pts[i][0] * zoom, clientY: r.top + draft.pts[i][1] * zoom, pointerType: phoneMQ.matches ? 'touch' : 'mouse' }); clearTimeout(nudge.t); nudge.t = setTimeout(hideLoupe, 1500); }
document.querySelectorAll('.nud').forEach(b => b.onclick = () => { const [x, y] = b.dataset.n.split(',').map(Number); nudge(x, y); });
$('#ptSel').onclick = () => { if (draft && draft.pts.length > 1) { calSel = (calSel + 1) % draft.pts.length; draw(); } };
$('#calSetBtn').onclick = () => finishDraft();
$('#loupeMag').addEventListener('change', () => { if (loupeWant) { const r = svg.getBoundingClientRect(); } });
vpEl.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !gesture) hideLoupe(); });
const _udb = updateDrawBar; updateDrawBar = function () { _udb(); const adj = !!draft && draft.pts.length > 0 && PLACE.includes(tool);
  document.body.classList.toggle('adj', adj); document.body.classList.toggle('caladj', !!draft && draft.type === 'calibrate' && draft.pts.length === 2);
  document.body.classList.toggle('placing', PLACE.includes(tool)); document.body.classList.toggle('aimtool', PLACE.includes(tool) || ['count', 'sleeve', 'origin'].includes(tool)); document.body.classList.toggle('sleevetool', tool === 'sleeve'); $('#ptSel').textContent = 'Point ' + (Math.min(calSel, draft ? draft.pts.length - 1 : 0) + 1); };
const _setTool = setTool; setTool = function (t) { hideLoupe(); snapHit = null; _setTool(t); };
document.querySelectorAll('.tool').forEach(b => b.onclick = () => setTool(b.dataset.tool));

// ---- undo / redo history (snapshots of items + scales, max 100) ----
const H = { u: [], r: [], cur: null, t: null };
const snap = () => JSON.stringify({ items: proj.items, scales: proj.scales, scaleNames: proj.scaleNames || {}, origins: proj.origins || {}, hidden: proj.hidden || {} });
function resetHist() { H.u = []; H.r = []; H.cur = proj ? snap() : null; clearTimeout(H.t); H.t = null; updHistBtns(); }
function commitHist() { clearTimeout(H.t); H.t = null; if (!proj) return; const s = snap(); if (H.cur !== null && s !== H.cur) { H.u.push(H.cur); if (H.u.length > 100) H.u.shift(); H.r = []; } H.cur = s; updHistBtns(); }
function commitSoon() { clearTimeout(H.t); H.t = setTimeout(commitHist, 400); updHistBtns(); }
function restore(s) { const o = JSON.parse(s); proj.items = o.items; proj.scales = o.scales; proj.scaleNames = o.scaleNames; proj.origins = o.origins || {}; const hidChanged = JSON.stringify(proj.hidden || {}) !== JSON.stringify(o.hidden || {}); proj.hidden = o.hidden || {}; if (hidChanged) { layersChanged(); renderLayers(); } H.cur = s;
  if (selId && !proj.items.some(i => i.id === selId)) selId = null; layout(); persistSoon(); updHistBtns(); }
function undo() {
  if (draft && draft.pts.length) { draft.pts.pop(); if (!draft.pts.length) draft = null; draw(); updHistBtns(); return; }
  commitHist(); if (!H.u.length) return; H.r.push(H.cur); restore(H.u.pop()); toast('Undone');
}
function redo() { commitHist(); if (!H.r.length) return; H.u.push(H.cur); restore(H.r.pop()); toast('Redone'); }
function updHistBtns() { const pending = !!H.t; const canU = !!(draft && draft.pts.length) || H.u.length > 0 || !!pending, canR = H.r.length > 0 && !pending;
  $('#undoBtn').disabled = !canU; $('#redoBtn').disabled = !canR; $('#redoMenu').disabled = !canR; }
$('#undoBtn').onclick = undo; $('#redoBtn').onclick = redo;
const _draw2 = draw; draw = function () { _draw2(); updHistBtns(); };
if (proj) resetHist();

// ---- snapping ("auto aim") ----
let snapOn = localStorage.getItem('pm-snap') !== '0', snapHit = null;
const geomCache = {};   // page -> {segs: Float64Array-like arrays, grid: Map, cell, pts: [] } or image pixel data
$('#snapBtn').classList.toggle('on', snapOn);
function toggleSnap() { snapOn = !snapOn; localStorage.setItem('pm-snap', snapOn ? '1' : '0'); $('#snapBtn').classList.toggle('on', snapOn); snapHit = null; showSnapMark(); toast('Snap ' + (snapOn ? 'on' : 'off')); }
$('#snapBtn').onclick = toggleSnap;
document.addEventListener('keydown', e => { if (e.target.matches('input,textarea,select')) return; if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey && !e.altKey) toggleSnap(); });
const CELL = 24;
function gridAdd(grid, i, x1, y1, x2, y2) {
  const cx1 = Math.floor(Math.min(x1, x2) / CELL), cx2 = Math.floor(Math.max(x1, x2) / CELL), cy1 = Math.floor(Math.min(y1, y2) / CELL), cy2 = Math.floor(Math.max(y1, y2) / CELL);
  const len = Math.hypot(x2 - x1, y2 - y1), steps = Math.max(1, Math.ceil(len / (CELL / 2)));
  if ((cx2 - cx1 + 1) * (cy2 - cy1 + 1) <= 4) { for (let cx = cx1; cx <= cx2; cx++) for (let cy = cy1; cy <= cy2; cy++) { const k = cx + ',' + cy; let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(i); } return; }
  const seen = new Set(); for (let s = 0; s <= steps; s++) { const t = s / steps, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const k = (Math.floor(x / CELL) + dx) + ',' + (Math.floor(y / CELL) + dy); if (seen.has(k)) continue; seen.add(k); let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(i); } }
}
async function buildGeom(pg) {
  if (geomCache[pg]) return geomCache[pg];
  const G = geomCache[pg] = { segs: [], grid: new Map(), ready: false };
  if (!doc) return G;
  if (doc.type === 'cad') { const M = doc.cad, hid = proj.hidden || {}; G.pts = []; G.pgrid = new Map();
    for (const s of M.segs) if (!hid[M.layerNames[s[5]]]) G.segs.push([s[0], s[1], s[2], s[3], s[4], s[5]]);
    for (const p of M.pts) if (!hid[M.layerNames[p[3]]]) { const i = G.pts.push(p) - 1, k = Math.floor(p[0] / CELL) + ',' + Math.floor(p[1] / CELL); let c = G.pgrid.get(k); if (!c) G.pgrid.set(k, c = []); c.push(i); }
    G.segs.forEach((s, i) => gridAdd(G.grid, i, s[0], s[1], s[2], s[3])); G.ready = true; return G; }
  if (doc.type === 'image') { const c = document.createElement('canvas'); c.width = doc.sizes[1].w; c.height = doc.sizes[1].h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(doc.img, 0, 0); G.pix = x.getImageData(0, 0, c.width, c.height); G.ready = true; return G; }
  const page = await doc.pdf.getPage(pg), ops = await page.getOperatorList(), vp = doc.vps[pg], OPS = pdfjsLib.OPS, U = pdfjsLib.Util;
  let ctm = [1, 0, 0, 1, 0, 0]; const stack = [];
  const T = (x, y) => { const q = U.applyTransform([x, y], ctm); return U.applyTransform(q, vp.transform); };
  const add = (a, b) => { if (G.segs.length < 200000 && (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) > 0.05)) G.segs.push([a[0], a[1], b[0], b[1]]); };
  for (let i = 0; i < ops.fnArray.length; i++) { const fn = ops.fnArray[i], args = ops.argsArray[i];
    if (fn === OPS.save) stack.push(ctm.slice()); else if (fn === OPS.restore) { if (stack.length) ctm = stack.pop(); }
    else if (fn === OPS.transform) ctm = U.transform(ctm, args);
    else if (fn === OPS.paintFormXObjectBegin) { stack.push(ctm.slice()); if (args[0]) ctm = U.transform(ctm, args[0]); }
    else if (fn === OPS.paintFormXObjectEnd) { if (stack.length) ctm = stack.pop(); }
    else if (fn === OPS.constructPath) { const sub = args[0], co = args[1]; let j = 0, cur = null, start = null;
      for (const op of sub) {
        if (op === OPS.moveTo) { cur = start = T(co[j], co[j + 1]); j += 2; }
        else if (op === OPS.lineTo) { const n = T(co[j], co[j + 1]); j += 2; if (cur) add(cur, n); cur = n; }
        else if (op === OPS.curveTo) { const n = T(co[j + 4], co[j + 5]); j += 6; if (cur) add(cur, n); cur = n; }
        else if (op === OPS.curveTo2 || op === OPS.curveTo3) { const n = T(co[j + 2], co[j + 3]); j += 4; if (cur) add(cur, n); cur = n; }
        else if (op === OPS.rectangle) { const [x, y, w, h] = co.slice(j, j + 4); j += 4; const p1 = T(x, y), p2 = T(x + w, y), p3 = T(x + w, y + h), p4 = T(x, y + h); add(p1, p2); add(p2, p3); add(p3, p4); add(p4, p1); cur = start = p1; }
        else if (op === OPS.closePath) { if (cur && start) add(cur, start); cur = start; }
      } } }
  G.segs.forEach((s, i) => gridAdd(G.grid, i, s[0], s[1], s[2], s[3])); G.ready = true; return G;
}
function nearSegs(G, p, r) { const out = new Set(); const c1x = Math.floor((p[0] - r) / CELL), c2x = Math.floor((p[0] + r) / CELL), c1y = Math.floor((p[1] - r) / CELL), c2y = Math.floor((p[1] + r) / CELL);
  for (let cx = c1x; cx <= c2x; cx++) for (let cy = c1y; cy <= c2y; cy++) { const c = G.grid.get(cx + ',' + cy); if (c) c.forEach(i => out.add(i)); } return [...out]; }
function projSeg(p, s) { const dx = s[2] - s[0], dy = s[3] - s[1], L2 = dx * dx + dy * dy; let t = L2 ? ((p[0] - s[0]) * dx + (p[1] - s[1]) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); return [s[0] + t * dx, s[1] + t * dy]; }
function segX(a, b) { const d = (a[2] - a[0]) * (b[3] - b[1]) - (a[3] - a[1]) * (b[2] - b[0]); if (Math.abs(d) < 1e-9) return null;
  const t = ((b[0] - a[0]) * (b[3] - b[1]) - (b[1] - a[1]) * (b[2] - b[0])) / d, u = ((b[0] - a[0]) * (a[3] - a[1]) - (b[1] - a[1]) * (a[2] - a[0])) / d;
  if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) return null; return [a[0] + t * (a[2] - a[0]), a[1] + t * (a[3] - a[1])]; }
function findSnap(p, r, exclude) {
  const G = geomCache[page]; let best = null; const consider = (q, kind, pri) => { const d = dist(p, q); if (d <= r && (!best || pri < best.pri || (pri === best.pri && d < best.d))) best = { p: q, kind, pri, d }; };
  // markup points (existing items and current draft)
  for (const it of proj.items) if (it.page === page) for (const q of it.pts) if (q !== exclude) consider(q, 'end', 0);
  if (draft) for (const q of draft.pts) if (q !== exclude) consider(q, 'end', 0);
  if (G && G.ready && G.segs.length) { const ids = nearSegs(G, p, r).slice(0, 400), S = ids.map(i => G.segs[i]);
    for (const s of S) if (!s[4]) { consider([s[0], s[1]], 'end', 0); consider([s[2], s[3]], 'end', 0); }
    if (G.pgrid) { const c1x = Math.floor((p[0] - r) / CELL), c2x = Math.floor((p[0] + r) / CELL), c1y = Math.floor((p[1] - r) / CELL), c2y = Math.floor((p[1] + r) / CELL);
      for (let cx = c1x; cx <= c2x; cx++) for (let cy = c1y; cy <= c2y; cy++) for (const i of (G.pgrid.get(cx + ',' + cy) || [])) consider([G.pts[i][0], G.pts[i][1]], G.pts[i][2], 0); }
    { const near = S.filter(s => dist(projSeg(p, s), p) <= r).slice(0, 80);
      for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) { const x = segX(near[i], near[j]); if (x) consider(x, 'x', 0); }
      if (!best) for (const s of near) consider(projSeg(p, s), 'line', 2); } }
  if (!best && G && G.pix) { // image: nearest dark pixel, refined to centre of the dark stroke
    const { width: W, height: Hh, data } = G.pix, R = Math.ceil(r), x0 = Math.round(p[0]), y0 = Math.round(p[1]); let bd = 1e9, bq = null;
    const dark = (x, y) => x >= 0 && y >= 0 && x < W && y < Hh && (data[(y * W + x) * 4] * .3 + data[(y * W + x) * 4 + 1] * .59 + data[(y * W + x) * 4 + 2] * .11) < 110;
    for (let y = y0 - R; y <= y0 + R; y++) for (let x = x0 - R; x <= x0 + R; x++) if (dark(x, y)) { const d = (x - p[0]) ** 2 + (y - p[1]) ** 2; if (d < bd) { bd = d; bq = [x, y]; } }
    if (bq && Math.sqrt(bd) <= r) { // centre across stroke: average dark run horizontally and vertically, take the shorter run's centre
      const run = (dx, dy) => { let a = 0, b = 0; while (a < 12 && dark(bq[0] - dx * (a + 1), bq[1] - dy * (a + 1))) a++; while (b < 12 && dark(bq[0] + dx * (b + 1), bq[1] + dy * (b + 1))) b++; return [a, b]; };
      const [ha, hb] = run(1, 0), [va, vb] = run(0, 1); let q;
      if (ha + hb <= va + vb) q = [bq[0] + (hb - ha) / 2 + 0.5, p[1]]; else q = [p[0], bq[1] + (vb - va) / 2 + 0.5];
      best = { p: q, kind: 'line', pri: 2, d: 0 }; } }
  return best;
}
function aim(p, e, prev, exclude) {
  let q = p; const ortho = prev && (e.shiftKey || shiftDown);
  if (ortho) q = snapOrtho(prev, q);
  snapHit = null;
  if (snapOn && !e.altKey && doc && proj) {
    if (!geomCache[page]) buildGeom(page);
    const r = (e.pointerType && e.pointerType !== 'mouse' ? 22 : 12) / zoom, h = findSnap(q, r, exclude);
    if (h) { snapHit = { p: h.p.slice(), kind: h.kind }; q = h.p.slice(); if (ortho) { const hz = Math.abs(p[0] - prev[0]) >= Math.abs(p[1] - prev[1]); q = hz ? [h.p[0], prev[1]] : [prev[0], h.p[1]]; snapHit.p = q; } }
  }
  showSnapMark(); return q;
}
function drawSnapMark(ctx, x, y, kind, s, lw) { ctx.save(); ctx.strokeStyle = '#00c853'; ctx.lineWidth = lw; ctx.beginPath();
  if (kind === 'end') ctx.rect(x - s, y - s, 2 * s, 2 * s); else if (kind === 'x') { ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); }
  else if (kind === 'mid') { ctx.moveTo(x, y - s); ctx.lineTo(x + s, y + s); ctx.lineTo(x - s, y + s); ctx.closePath(); } else if (kind === 'center') { ctx.arc(x, y, s, 0, 7); }
  else { ctx.moveTo(x - s, y); ctx.lineTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.closePath(); } ctx.stroke(); ctx.restore(); }
function showSnapMark() { let g = svg.querySelector('#snapG'); if (!g) { g = el('g', { id: 'snapG', 'pointer-events': 'none' }, svg); } g.innerHTML = '';
  if (!snapHit) return; const [x, y] = snapHit.p, s = 7 / zoom, w = 2 / zoom, A = { fill: 'none', stroke: '#00c853', 'stroke-width': w };
  if (snapHit.kind === 'end') el('rect', { ...A, x: x - s, y: y - s, width: 2 * s, height: 2 * s }, g);
  else if (snapHit.kind === 'x') el('path', { ...A, d: `M${x - s} ${y - s}L${x + s} ${y + s}M${x + s} ${y - s}L${x - s} ${y + s}` }, g);
  else if (snapHit.kind === 'mid') el('path', { ...A, d: `M${x} ${y - s}L${x + s} ${y + s}L${x - s} ${y + s}Z` }, g);
  else if (snapHit.kind === 'center') el('circle', { ...A, cx: x, cy: y, r: s }, g);
  else el('path', { ...A, d: `M${x - s} ${y}L${x} ${y - s}L${x + s} ${y}L${x} ${y + s}Z` }, g);
  g.dataset.kind = snapHit.kind; }
const _draw3 = draw; draw = function () { _draw3(); if (snapHit && (PLACE.includes(tool) || ['count', 'sleeve', 'origin'].includes(tool) || gesture)) showSnapMark(); };
const _loadDoc = loadDoc; loadDoc = async function (...a) { for (const k in geomCache) delete geomCache[k]; const r = await _loadDoc(...a); return r; };
vpEl.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !gesture) { snapHit = null; showSnapMark(); } });
window.PMsnap = { buildGeom: pg => buildGeom(pg), get hit() { return snapHit; }, geom: geomCache };
const _rc = renderCanvas; renderCanvas = async function () { await _rc(); if (doc && !geomCache[page]) buildGeom(page).then(() => draw()); };

// ---- CAD layers panel ----
function layersChanged() { if (!doc || doc.type !== 'cad') return; for (const k in geomCache) delete geomCache[k]; sleeveCache.clear(); renderCanvas(); draw(); }
function renderLayers() {
  const box = $('#layers'); if (!doc || doc.type !== 'cad') { box.hidden = true; return; } box.hidden = false; const hid = proj.hidden || {};
  $('#layerList').innerHTML = doc.cad.layers.map(l => `<label class="lyr"><input type="checkbox" data-layer="${esc(l.name)}" ${hid[l.name] ? '' : 'checked'}><span class="sw" style="background:${l.color}"></span>${esc(l.name)}</label>`).join('');
  $('#cadInfo').textContent = 'Units: ' + doc.cad.unitName + (doc.cad.unitM ? '' : ' (set in Set scale)');
}
$('#layerList').addEventListener('change', e => { const n = e.target.dataset.layer; if (n == null) return; proj.hidden = proj.hidden || {}; if (e.target.checked) delete proj.hidden[n]; else proj.hidden[n] = true; layersChanged(); persistSoon(); commitHist(); });
$('#layersAll').onclick = () => { proj.hidden = {}; renderLayers(); layersChanged(); persistSoon(); commitHist(); };
const _openProject = openProject; openProject = async function (id) { await _openProject(id); proj.origins = proj.origins || {}; proj.hidden = proj.hidden || {}; resetHist(); renderLayers(); };
// ---- sleeves ----
const sleeveCache = new Map();
function sleeveName(it) { const n = proj.items.filter(o => o.type === 'sleeve').indexOf(it) + 1; return 'S' + n; }
function sleeveInfo(it) {
  const p = it.pts[0], G = geomCache[it.page], key = it.page + ':' + p[0] + ',' + p[1] + ':' + (G && G.ready ? G.segs.length : -1);
  let r = sleeveCache.get(it.id); if (!r || r.key !== key) {
    r = { key }; const minLen = 0.015 * Math.min(doc.sizes[it.page].w, doc.sizes[it.page].h);
    if (G && G.ready && G.segs.length) { let bx = Infinity, by = Infinity;
      for (const s of G.segs) { if (s[4]) continue; const dx = s[2] - s[0], dy = s[3] - s[1], len = Math.hypot(dx, dy); if (len < minLen) continue;
        if (Math.abs(dx) <= len * 0.01 && Math.min(s[1], s[3]) <= p[1] + 1e-6 && Math.max(s[1], s[3]) >= p[1] - 1e-6) { const x = (s[0] + s[2]) / 2, d = Math.abs(x - p[0]); if (d > 1e-6 && d < bx) { bx = d; r.rx = { x, L: s[5] }; } }
        if (Math.abs(dy) <= len * 0.01 && Math.min(s[0], s[2]) <= p[0] + 1e-6 && Math.max(s[0], s[2]) >= p[0] - 1e-6) { const y = (s[1] + s[3]) / 2, d = Math.abs(y - p[1]); if (d > 1e-6 && d < by) { by = d; r.ry = { y, L: s[5] }; } } } }
    sleeveCache.set(it.id, r); }
  const s = scaleOf(it.page), o = proj.origins && proj.origins[it.page], out = { rx: r.rx, ry: r.ry };
  if (s) { if (r.rx) out.dx = Math.abs(r.rx.x - p[0]) * s; if (r.ry) out.dy = Math.abs(r.ry.y - p[1]) * s; if (o) { out.X = (p[0] - o[0]) * s; out.Y = (o[1] - p[1]) * s; } }
  const ln = L => doc.type === 'cad' && L != null ? doc.cad.layerNames[L] : ''; out.rxLayer = r.rx ? ln(r.rx.L) : ''; out.ryLayer = r.ry ? ln(r.ry.L) : '';
  return out;
}
function sleeveText(it) { const i = sleeveInfo(it), u = proj.units; if (!scaleOf(it.page)) return 'no scale';
  return (i.X != null ? 'X ' + Units.fmtLen(i.X, u) + ', Y ' + Units.fmtLen(i.Y, u) : 'no origin'); }
const _drawItem = drawItem; drawItem = function (it, g, isDraft) {
  if (it.type !== 'sleeve') return _drawItem(it, g, isDraft);
  const grp = el('g', { 'data-id': it.id }, g), [x, y] = it.pts[0], c = it.color, inf = sleeveInfo(it), u = proj.units, R = 9 / zoom;
  const dim = (x2, y2, txt, horiz) => { el('line', { x1: x, y1: y, x2, y2, stroke: c, 'stroke-width': 1.2 / zoom, 'stroke-dasharray': `${5 / zoom} ${3 / zoom}`, 'pointer-events': 'none' }, grp);
    el('line', horiz ? { x1: x2, y1: y2 - 5 / zoom, x2, y2: y2 + 5 / zoom, stroke: c, 'stroke-width': 1.5 / zoom } : { x1: x2 - 5 / zoom, y1: y2, x2: x2 + 5 / zoom, y2, stroke: c, 'stroke-width': 1.5 / zoom }, grp);
    if (txt) label(grp, horiz ? (x + x2) / 2 : x + 4 / zoom, horiz ? y - 4 / zoom : (y + y2) / 2, txt, c).setAttribute('text-anchor', horiz ? 'middle' : 'start'); };
  if (inf.rx) dim(inf.rx.x, y, inf.dx != null ? Units.fmtLen(inf.dx, u) : '', true);
  if (inf.ry) dim(x, inf.ry.y, inf.dy != null ? Units.fmtLen(inf.dy, u) : '', false);
  el('circle', { cx: x, cy: y, r: R, fill: '#fff', 'fill-opacity': 0.85, stroke: c, 'stroke-width': 2.5 / zoom }, grp);
  el('path', { d: `M${x - R} ${y}H${x + R}M${x} ${y - R}V${y + R}`, stroke: c, 'stroke-width': 1.2 / zoom }, grp);
  label(grp, x, y - R - 4 / zoom, sleeveName(it) + ' ' + (it.size || '') + (it.label ? ' ' + it.label : ''), c);
  if (it.id === selId) el('rect', { x: x - 6 / zoom, y: y - 6 / zoom, width: 12 / zoom, height: 12 / zoom, fill: 'none', stroke: '#1976d2', 'stroke-width': 2 / zoom, 'data-v': 0, class: 'handle' }, grp);
};
const _draw4 = draw; draw = function () { _draw4(); const o = proj && proj.origins && proj.origins[page]; if (!o) return; const g = el('g', { 'pointer-events': 'none' }, svg), s = 14 / zoom, w = 2 / zoom;
  el('path', { d: `M${o[0] - s} ${o[1]}H${o[0] + s}M${o[0]} ${o[1] - s}V${o[1] + s}`, stroke: '#c2185b', 'stroke-width': w }, g); el('circle', { cx: o[0], cy: o[1], r: s / 2, fill: 'none', stroke: '#c2185b', 'stroke-width': w }, g);
  const t = label(g, o[0] + s, o[1] - s / 2, '0,0', '#c2185b'); t.setAttribute('text-anchor', 'start'); };
// sleeve edit: size + note
const _renderList = renderList; renderList = function () { _renderList(); const it = proj && proj.items.find(i => i.id === selId); $('#eSizeRow').hidden = !(it && it.type === 'sleeve'); if (it && it.type === 'sleeve') { $('#eSize').value = it.size || ''; $('#eTextRow').hidden = false; if (document.activeElement !== $('#eText')) $('#eText').value = it.text || ''; } };
$('#eSize').addEventListener('change', e => { const it = selItem(); if (it) { it.size = e.target.value; changed(); } });
// sleeve schedule CSV
function buildSleeveCSV() {
  const u = proj.units, f = v => v == null ? '' : Units.fmtLen(v, u), dec = v => v == null ? '' : (u === 'met' ? v : v / Units.FT).toFixed(4), lu = u === 'met' ? 'm' : 'ft';
  const rows = [['Sleeve schedule', proj.name], ['Origin', Object.keys(proj.origins || {}).length ? 'set (Y up)' : 'not set'], [],
    ['ID', 'Size', 'Label', 'X from origin', 'Y from origin', `X (${lu})`, `Y (${lu})`, 'Offset to nearest vertical line', 'Offset to nearest horizontal line', `Offset X (${lu})`, `Offset Y (${lu})`, 'Ref X layer', 'Ref Y layer', 'Level / page', 'Note']];
  proj.items.filter(i => i.type === 'sleeve').forEach(it => { const i = sleeveInfo(it);
    rows.push([sleeveName(it), it.size || '', it.label || '', f(i.X), f(i.Y), dec(i.X), dec(i.Y), f(i.dx), f(i.dy), dec(i.dx), dec(i.dy), i.rxLayer, i.ryLayer, doc.type === 'cad' ? proj.name : 'Page ' + it.page, it.text || '']); });
  return rows.map(r => r.map(csvCell).join(',')).join('\r\n');
}
$('#sleeveCsvBtn').onclick = () => { if (!proj) return; if (!proj.items.some(i => i.type === 'sleeve')) return toast('No sleeves yet. Use the Sleeve tool.'); download('\ufeff' + buildSleeveCSV(), proj.name + '-sleeves.csv', 'text/csv'); };
Object.assign(window.PM, { buildSleeveCSV, sleeveInfo }); Object.defineProperty(window.PM, 'origins', { get: () => proj.origins });
// ---- Find sleeves (CAD auto-detection) ----
const SLV_KEYS = ['SLEEVE', 'SLV', 'MANCHON', 'PEN', 'PENETRATION', 'CORE', 'CORING', 'FOURREAU'];
function slvMatch(s) { s = String(s || '').toUpperCase(); if (/SLEEVE|MANCHON|PENETRATION|FOURREAU|CORING/.test(s)) return true; return s.split(/[^A-Z0-9]+/).some(t => SLV_KEYS.some(k => t.startsWith(k) && /^\d*$/.test(t.slice(k.length)))); }
const NOMINAL_IN = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 14, 16];
const inStr = v => { const w = Math.floor(v + 1e-9), f = v - w; const fr = { 0.25: '1/4', 0.5: '1/2', 0.75: '3/4' }[Math.round(f * 4) / 4] || ''; return (w ? w + (fr ? '-' + fr : '') : fr) + '"'; };
function parseSize(s) { // returns size label or null
  s = String(s || '').replace(/\\[A-Za-z][^;]*;/g, '').trim(); let m;
  if ((m = s.match(/\bDN\s*(\d{2,4})\b/i))) return 'DN' + m[1];
  if ((m = s.match(/(\d+(?:\.\d+)?)\s*mm\b/i))) return m[1] + 'mm';
  if ((m = s.match(/(?:^|[^\d\/.])(\d+)[- ](\d)\/(\d)\s*(?:"|''|in\b|po\b)/i))) return m[1] + '-' + m[2] + '/' + m[3] + '"';
  if ((m = s.match(/(?:^|[^\d\/.])(\d)\/(\d)\s*(?:"|''|in\b|po\b)/i))) return m[1] + '/' + m[2] + '"';
  if ((m = s.match(/(?:^|[^\d\/.])(\d+(?:\.\d+)?)\s*(?:"|''|in\b|inch|po\b)/i))) return m[1] + '"';
  if ((m = s.match(/[ØøΦ⌀]\s*(\d+(?:\.\d+)?)/))) return m[1] + (proj && proj.units === 'met' ? 'mm' : '"');
  return null; }
function sizeFromDia(rPage) { const s = scaleOf(page); if (!s || !rPage) return { size: '', raw: '' }; const dm = 2 * rPage * s, din = dm / Units.IN;
  const raw = proj.units === 'met' ? 'Ø ' + (dm * 1000).toFixed(0) + ' mm' : 'Ø ' + din.toFixed(2) + '"'; let best = NOMINAL_IN[0]; for (const n of NOMINAL_IN) if (Math.abs(n - din) < Math.abs(best - din)) best = n; return { size: inStr(best), raw }; }
function nearText(x, y, R) { let best = null, bd = R; for (const t of doc.cad.texts) { if ((proj.hidden || {})[doc.cad.layerNames[t.L]]) continue; const d = Math.hypot(t.x - x, t.y - y); if (d <= bd) { const sz = parseSize(t.text); if (sz) { bd = d; best = sz; } } } return best; }
function candSize(c) { // attributes > nearby text > diameter
  const dia = sizeFromDia(c.r); let size = null, src = '';
  if (c.attrs) { const pref = c.attrs.slice().sort((a, b) => (/SIZE|DIA|TAILLE|DIAM/i.test(b.tag) ? 1 : 0) - (/SIZE|DIA|TAILLE|DIAM/i.test(a.tag) ? 1 : 0) || (a.def ? 1 : 0) - (b.def ? 1 : 0));
    for (const a of pref) { const s = parseSize(a.value); if (s) { size = s; src = a.def ? 'block default' : 'attribute'; break; } } }
  if (!size) { const R = Math.max(4 * (c.r || 0), 0.015 * Math.min(doc.cad.w, doc.cad.h)); const t = nearText(c.x, c.y, R); if (t) { size = t; src = 'nearby text'; } }
  if (!size && dia.size) { size = dia.size; src = 'diameter'; }
  return { size: size || '?', src: src || 'unknown', raw: dia.raw }; }
function findCandidates(mode, pick) {
  const M = doc.cad, hid = proj.hidden || {}, out = [], vis = L => !hid[M.layerNames[L]];
  const insOK = new Set();
  M.inserts.forEach((s, i) => { if (!vis(s.L)) return; const ok = mode === 'pick' ? (pick.kind === 'insert' && s.name === pick.name) : (slvMatch(s.name) || slvMatch(M.layerNames[s.L]));
    if (ok && !s.parents.some(p => insOK.has(p))) { insOK.add(i); out.push({ kind: 'insert', x: s.x, y: s.y, r: s.r, name: s.name, L: s.L, attrs: s.attrs }); } });
  M.circles.forEach(c => { if (!vis(c.L) || c.parents.some(p => insOK.has(p))) return;
    const ok = mode === 'pick' ? (pick.kind === 'circle' && c.L === pick.L && Math.abs(c.r - pick.r) <= pick.r * 0.01) : slvMatch(M.layerNames[c.L]);
    if (ok) out.push({ kind: 'circle', x: c.x, y: c.y, r: c.r, name: '', L: c.L }); });
  // de-duplicate coincident candidates and mark ones already added as sleeves
  const tol = 1e-4 * Math.max(M.w, M.h), res = [];
  for (const c of out) { if (res.some(o => Math.hypot(o.x - c.x, o.y - c.y) < tol)) continue; res.push(c); }
  const sleeves = proj.items.filter(i => i.type === 'sleeve' && i.page === page);
  res.forEach((c, i) => { Object.assign(c, candSize(c)); c.id = 'c' + i; c.layer = M.layerNames[c.L]; c.dup = sleeves.some(s => Math.hypot(s.pts[0][0] - c.x, s.pts[0][1] - c.y) < tol); c.on = !c.dup; });
  return res;
}
let FS = null; // review state {cands, mode}
function startFind(mode, pick) {
  if (!doc || doc.type !== 'cad') return toast('Find sleeves works on CAD drawings (DXF or DWG). On PDFs use the Sleeve tool.', 5000);
  const cands = findCandidates(mode, pick); FS = { cands, mode }; document.body.classList.add('findmode'); if (phoneMQ.matches) document.body.classList.add('sheetopen');
  renderFind(); draw(); toast(cands.length ? `Found ${cands.length} candidate${cands.length > 1 ? 's' : ''}. Review, then Add as sleeves.` : (mode === 'pick' ? 'No matching symbols found.' : 'No sleeves found by keyword. Try Pick one: click a sleeve symbol on the plan.'), 5000);
}
function endFind() { FS = null; document.body.classList.remove('findmode', 'pickmode'); renderFind(); draw(); }
function findGroups() { const g = new Map(); for (const c of FS.cands) { const k = c.size + '|' + c.layer + '|' + (c.name || 'circle'); if (!g.has(k)) g.set(k, { key: k, size: c.size, layer: c.layer, name: c.name, items: [] }); g.get(k).items.push(c); } return [...g.values()].sort((a, b) => a.size.localeCompare(b.size, undefined, { numeric: true })); }
function renderFind() {
  const box = $('#findPanel'); box.hidden = !FS; if (!FS) return; const u = proj.units, o = proj.origins && proj.origins[page], s = scaleOf(page);
  const xy = c => o && s ? `X ${Units.fmtLen((c.x - o[0]) * s, u)}, Y ${Units.fmtLen((o[1] - c.y) * s, u)}` : '';
  const sel = FS.cands.filter(c => c.on).length;
  $('#findSum').textContent = `${FS.cands.length} found, ${sel} selected` + (FS.cands.some(c => c.dup) ? `, ${FS.cands.filter(c => c.dup).length} already added` : '');
  $('#findList').innerHTML = findGroups().map(g => { const n = g.items.filter(c => c.on).length, all = g.items.filter(c => !c.dup);
    return `<div class="fgrp"><label class="fhead"><input type="checkbox" data-grp="${esc(g.key)}" ${all.length && n === all.length ? 'checked' : ''} ${all.length ? '' : 'disabled'}><b>${esc(g.size)}</b><span>${g.items.length} ea</span><small>${esc(g.layer)}${g.name ? ' / ' + esc(g.name) : ' / circle'}</small></label>` +
      g.items.map(c => `<label class="fitem ${c.dup ? 'dup' : ''}" data-cid="${c.id}"><input type="checkbox" data-cid="${c.id}" ${c.on ? 'checked' : ''} ${c.dup ? 'disabled' : ''}><span>${esc(c.size)}</span><small>${c.dup ? 'already added' : esc(c.src)}${c.raw && c.kind === 'circle' ? ' - ' + esc(c.raw) : ''}${xy(c) ? ' - ' + xy(c) : ''}</small></label>`).join('') + '</div>'; }).join('') || '<small>Nothing found.</small>';
  $('#findAdd').disabled = !sel; $('#findAdd').textContent = `Add ${sel} as sleeves`;
}
$('#findList').addEventListener('change', e => { const t = e.target; if (t.dataset.grp != null) { const g = findGroups().find(x => x.key === t.dataset.grp); g.items.forEach(c => { if (!c.dup) c.on = t.checked; }); }
  else if (t.dataset.cid) { const c = FS.cands.find(x => x.id === t.dataset.cid); c.on = t.checked; } renderFind(); draw(); });
$('#findList').addEventListener('mouseover', e => { const r = e.target.closest('[data-cid]'); FS && (FS.hot = r ? r.dataset.cid : null); draw(); });
$('#findAll').onclick = () => { FS.cands.forEach(c => { if (!c.dup) c.on = true; }); renderFind(); draw(); };
$('#findNone').onclick = () => { FS.cands.forEach(c => c.on = false); renderFind(); draw(); };
$('#findCancel').onclick = endFind;
$('#findPick').onclick = () => { document.body.classList.add('pickmode'); setTool('select'); toast('Click one sleeve symbol (block or circle) on the plan.', 5000); };
$('#findAdd').onclick = () => { const add = FS.cands.filter(c => c.on && !c.dup); if (!add.length) return;
  for (const c of add) proj.items.push({ id: uid(), type: 'sleeve', page, pts: [[c.x, c.y]], color: $('#color').value, label: '', size: c.size === '?' ? '' : c.size, text: [c.name ? 'Block ' + c.name : 'Circle', 'layer ' + c.layer, c.raw].filter(Boolean).join(', '), src: 'auto' });
  changed(); toast(`Added ${add.length} sleeve${add.length > 1 ? 's' : ''}. Undo removes them in one step.`, 5000); endFind(); };
$('#findBtn').onclick = () => startFind('auto');
// pick-one: next click on the plan selects nearest insert or circle
vpEl.addEventListener('pointerdown', e => { if (!document.body.classList.contains('pickmode') || !doc || doc.type !== 'cad') return; e.stopImmediatePropagation(); e.preventDefault();
  const p = pagePt(e), M = doc.cad, hid = proj.hidden || {}, R = (e.pointerType === 'mouse' ? 14 : 26) / zoom; let best = null, bd = Infinity;
  M.inserts.forEach(s => { if (hid[M.layerNames[s.L]]) return; const d = Math.hypot(s.x - p[0], s.y - p[1]) - Math.max(s.r, 0); if (d < bd) { bd = d; best = { kind: 'insert', name: s.name, top: s }; } });
  M.circles.forEach(c => { if (hid[M.layerNames[c.L]]) return; const dc = Math.hypot(c.x - p[0], c.y - p[1]), d = Math.min(Math.abs(dc - c.r), dc); if (d < bd) { bd = d; best = { kind: 'circle', L: c.L, r: c.r }; } });
  document.body.classList.remove('pickmode');
  if (!best || bd > R) return toast('No block or circle there. Try again with Pick one.', 4000);
  if (best.kind === 'insert') { let s = best.top; while (s.parents.length && !slvMatch(s.name)) { const par = M.inserts[s.parents[s.parents.length - 1]]; if (slvMatch(par.name)) s = par; else break; } best.name = s.name; }
  startFind('pick', best); }, true);
const _draw5 = draw; draw = function () { _draw5(); if (!FS) return; const g = el('g', { 'pointer-events': 'none' }, svg);
  for (const c of FS.cands) { const r = Math.max(c.r || 0, 7 / zoom) + 4 / zoom, hot = FS.hot === c.id;
    el('circle', { cx: c.x, cy: c.y, r: hot ? r * 1.6 : r, fill: c.on ? '#ff6d00' : 'none', 'fill-opacity': 0.25, stroke: c.dup ? '#9e9e9e' : c.on ? '#ff6d00' : '#607d8b', 'stroke-width': (hot ? 3.5 : 2.5) / zoom, 'stroke-dasharray': c.on ? '' : `${4 / zoom} ${3 / zoom}` }, g); } };
const _renderList2 = renderList; renderList = function () { _renderList2(); const it = proj && proj.items.find(i => i.id === selId); if (it && it.type === 'sleeve' && it.size && ![...$('#eSize').options].some(o => o.value === it.size)) { const o = document.createElement('option'); o.textContent = it.size; $('#eSize').appendChild(o); $('#eSize').value = it.size; } };
Object.assign(window.PM, { findCandidates, startFind, get FS() { return FS; } }); Object.defineProperty(window.PM, 'FS', { get: () => FS });
