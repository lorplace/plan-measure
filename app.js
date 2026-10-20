'use strict';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
const $ = s => document.querySelector(s);
const SVGNS = 'http://www.w3.org/2000/svg';
const vpEl = $('#viewport'), stage = $('#stage'), canvas = $('#canvas'), svg = $('#svg');
const TYPE_NAMES = {line:'Length', poly:'Pipe run', area:'Area', count:'Count', text:'Note'};

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
  if (it.type === 'count') return 1;
  return NaN;
}
function fmtItem(it) {
  const u = proj.units, v = measure(it);
  if (it.type === 'count' || it.type === 'text') return '';
  if (!isFinite(v)) return 'no scale';
  if (it.type === 'area') return Units.fmtArea(v, u) + ' (perim ' + Units.fmtLen(polyLen(it.pts, true) * scaleOf(it.page), u) + ')';
  return Units.fmtLen(v, u);
}
function snapOrtho(prev, p) { if (!prev) return p; const dx = Math.abs(p[0] - prev[0]), dy = Math.abs(p[1] - prev[1]); return dx >= dy ? [p[0], prev[1]] : [prev[0], p[1]]; }

// ---------- loading ----------
async function onFile(e) { const f = e.target.files[0]; if (!f) return; e.target.value = '';
  const bytes = new Uint8Array(await f.arrayBuffer());
  await loadDoc(bytes, f.type || (f.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/png'), f.name);
  proj = { id: uid(), name: f.name.replace(/\.[^.]+$/, ''), fileName: f.name, fileType: doc.mime, units: $('#units').value, scales: {}, items: [] };
  page = 1; fitPage(); await persist(); toast('Opened ' + f.name + '. Set the scale before measuring.');
}
$('#file').addEventListener('change', onFile);

async function loadDoc(bytes, mime, name) {
  doc = { name, mime, bytes, sizes: [], vps: [] };
  if (mime === 'application/pdf') {
    doc.type = 'pdf';
    doc.pdf = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
    doc.numPages = doc.pdf.numPages;
    for (let i = 1; i <= doc.numPages; i++) { const p = await doc.pdf.getPage(i); const vp = p.getViewport({ scale: 1 }); doc.vps[i] = vp; doc.sizes[i] = { w: vp.width, h: vp.height }; }
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
  if (draft) { const pts = hover ? draft.pts.concat([hover]) : draft.pts; if (pts.length) drawItem({ ...draft, pts, page, label: draft.label }, g, true); }
  renderList();
}

// ---------- side panel ----------
function groups() {
  const m = new Map();
  for (const it of proj.items) { if (it.type === 'text') continue;
    const k = it.type + '|' + (it.label || '') + '|' + it.color; if (!m.has(k)) m.set(k, { type: it.type, label: it.label || '', color: it.color, n: 0, sum: 0, noscale: 0 });
    const gr = m.get(k), v = measure(it); gr.n++; if (isFinite(v)) gr.sum += v; else gr.noscale++; }
  return [...m.values()];
}
function fmtGroup(g) { const u = proj.units; if (g.type === 'count') return g.n + ' ea'; if (g.type === 'area') return Units.fmtArea(g.sum, u); return Units.fmtLen(g.sum, u); }
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
function changed() { draw(); persistSoon(); }

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
  text: 'Click where the note goes, then type it.'
};
function setTool(t) { tool = t; draft = null; hover = null; document.querySelectorAll('.tool').forEach(b => b.classList.toggle('active', b.dataset.tool === t)); $('#hint').textContent = HINTS[t]; vpEl.style.cursor = t === 'pan' ? 'grab' : t === 'select' ? 'default' : 'crosshair'; draw(); }
document.querySelectorAll('.tool').forEach(b => b.onclick = () => setTool(b.dataset.tool));
function pagePt(e) { const r = svg.getBoundingClientRect(); return [(e.clientX - r.left) / zoom, (e.clientY - r.top) / zoom]; }

function finishDraft() {
  if (!draft) return;
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
    const prev = draft.pts[draft.pts.length - 1]; if (e.shiftKey || shiftDown) p = snapOrtho(prev, p);
    if (prev && dist(prev, p) < 1e-6) return;
    draft.pts.push(p);
    if ((tool === 'line' || tool === 'calibrate') && draft.pts.length === 2) {
      if (tool === 'line') finishDraft(); else openCalibrate();
    }
    draw();
  } else if (tool === 'count') { proj.items.push({ id: uid(), type: 'count', page, pts: [p], color, label: lab }); changed(); }
  else if (tool === 'text') { const t = prompt('Note text:'); if (t) { proj.items.push({ id: uid(), type: 'text', page, pts: [p], color, label: '', text: t }); changed(); } }
}

// pointer handling: click / drag / pan / pinch
const pointers = new Map(); let gesture = null;
vpEl.addEventListener('pointerdown', e => {
  if (!doc) return; vpEl.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; gesture = { kind: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom }; return; }
  const p = pagePt(e);
  gesture = { kind: 'maybe', sx: e.clientX, sy: e.clientY, sl: vpEl.scrollLeft, st: vpEl.scrollTop, p, moved: false };
  if (e.button === 1 || tool === 'pan') { gesture.kind = 'pan'; return; }
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
  if (gesture && gesture.kind === 'pinch' && pointers.size === 2) { const [a, b] = [...pointers.values()]; setZoom(gesture.z * Math.hypot(a.x - b.x, a.y - b.y) / gesture.d, (a.x + b.x) / 2, (a.y + b.y) / 2); return; }
  const p = pagePt(e);
  if (gesture) {
    const mv = Math.hypot(e.clientX - gesture.sx, e.clientY - gesture.sy) > 5; if (mv) gesture.moved = true;
    if (gesture.kind === 'pan' || (gesture.kind === 'maybe' && gesture.moved && e.pointerType === 'touch')) { gesture.kind = 'pan'; vpEl.scrollLeft = gesture.sl - (e.clientX - gesture.sx); vpEl.scrollTop = gesture.st - (e.clientY - gesture.sy); return; }
    if (gesture.kind === 'vertex') { const it = selItem(); let q = p; const prev = it.pts[gesture.v - 1] || it.pts[gesture.v + 1]; if (e.shiftKey) q = snapOrtho(prev, q); it.pts[gesture.v] = q; draw(); return; }
    if (gesture.kind === 'move' && gesture.moved) { const it = selItem(); const dx = p[0] - gesture.p[0], dy = p[1] - gesture.p[1]; it.pts = gesture.orig.map(q => [q[0] + dx, q[1] + dy]); draw(); return; }
  }
  if (draft) { const prev = draft.pts[draft.pts.length - 1]; hover = (e.shiftKey || shiftDown) ? snapOrtho(prev, p) : p; draw(); }
});
function endPointer(e) {
  pointers.delete(e.pointerId);
  if (!gesture) return; const g = gesture;
  if (g.kind === 'pinch') { if (pointers.size === 0) gesture = null; return; }
  gesture = null;
  if (g.kind === 'vertex' || g.kind === 'move') { changed(); return; }
  if (g.kind === 'pan') { if (g.desel && !g.moved) { selId = null; draw(); } return; }
  if (g.kind === 'maybe' && !g.moved && e.type === 'pointerup') clickAt(pagePt(e), e);
}
vpEl.addEventListener('pointerup', endPointer); vpEl.addEventListener('pointercancel', endPointer);
vpEl.addEventListener('dblclick', e => { if (draft && (draft.type === 'poly' || draft.type === 'area')) { // remove the duplicate point added by the 2nd click
  if (draft.pts.length > 1 && dist(draft.pts[draft.pts.length - 1], draft.pts[draft.pts.length - 2]) < 4 / zoom) draft.pts.pop(); finishDraft(); } });
document.addEventListener('keydown', e => {
  if (e.key === 'Shift') shiftDown = true;
  if (e.target.matches('input,textarea,select')) return;
  if (e.key === 'Enter') finishDraft();
  else if (e.key === 'Escape') { draft = null; hover = null; selId = null; draw(); }
  else if (e.key === 'Delete' || (e.key === 'Backspace' && !draft)) deleteSel();
  else if (e.key === 'Backspace' && draft) { draft.pts.pop(); if (!draft.pts.length) draft = null; draw(); }
  else { const m = { v: 'select', h: 'pan', k: 'calibrate', l: 'line', p: 'poly', a: 'area', c: 'count', t: 'text' }[e.key.toLowerCase()]; if (m && !e.ctrlKey && !e.metaKey) setTool(m); }
});
document.addEventListener('keyup', e => { if (e.key === 'Shift') shiftDown = false; });

// ---------- scale ----------
Units.STD.forEach((s, i) => { const o = document.createElement('option'); o.value = i; o.textContent = s.name; $('#stdScale').appendChild(o); });
$('#stdScale').value = Units.STD.findIndex(s => s.ratio === 48);
function applyScale(mPerUnit, name, all) { const pgs = all ? Array.from({ length: doc.numPages }, (_, i) => i + 1) : [page]; proj.scaleNames = proj.scaleNames || {}; pgs.forEach(p => { proj.scales[p] = mPerUnit; proj.scaleNames[p] = name; }); layout(); persistSoon(); toast('Scale set: ' + name); }
$('#scaleBtn').onclick = () => { if (!doc) return toast('Open a plan first'); $('#imgDpiRow').hidden = doc.type !== 'image'; $('#scaleDlg').showModal(); };
$('#scaleDlg').addEventListener('close', () => { if ($('#scaleDlg').returnValue !== 'ok') return; const s = Units.STD[$('#stdScale').value];
  let m = s.mPerPt; if (doc.type === 'image') m = s.ratio * Units.IN / (+$('#imgDpi').value || 150); applyScale(m, s.name, $('#allPages').checked); });
function openCalibrate() { $('#calVal').value = ''; $('#calDlg').showModal(); }
$('#calDlg').addEventListener('close', () => {
  const pts = draft && draft.pts; draft = null; hover = null;
  if ($('#calDlg').returnValue === 'ok' && pts && pts.length === 2) {
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
    else if (it.type === 'text') { (it.text || '').split('\n').forEach((ln, i) => { const s = winAnsi(ln); pg.drawText(s, { x: P[0][0], y: P[0][1] - size * 1.2 * i, size: size * 1.1, font, color: c }); }); }
  }
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
async function openProject(id) { const r = await idb('readonly', s => s.get(id)); if (!r) return; const { bytes, updated, ...p } = r; await loadDoc(new Uint8Array(bytes), p.fileType, p.fileName); proj = p; $('#units').value = p.units; page = 1; selId = null; draft = null; fitPage(); localStorage.setItem('pm-last', id); }
$('#projBtn').onclick = async () => { const all = await idb('readonly', s => s.getAll()); all.sort((a, b) => b.updated - a.updated);
  $('#projList').innerHTML = all.map(p => `<div class="proj"><span>${esc(p.name)}<br><small>${new Date(p.updated).toLocaleString()} - ${p.items.length} items</small></span><button type="button" class="btn" data-open="${p.id}">Open</button><button type="button" class="btn danger" data-del="${p.id}">Delete</button></div>`).join('') || 'No saved projects.';
  $('#projDlg').showModal(); };
$('#projList').addEventListener('click', async e => { const o = e.target.dataset.open, d = e.target.dataset.del;
  if (o) { $('#projDlg').close(); await openProject(o); } if (d && confirm('Delete this project?')) { await idb('readwrite', s => s.delete(d)); $('#projDlg').close(); $('#projBtn').click(); } });

setTool('select'); $('#hint').textContent = 'Open a PDF or image plan to start. Your work is saved automatically in this browser.';
(async () => { const last = localStorage.getItem('pm-last'); if (last) try { await openProject(last); } catch (e) { } })();
// test hook
window.PM = { get proj() { return proj; }, get doc() { return doc; }, measure, buildCSV, buildPDF, setTool, gotoPage, applyScale, get zoom() { return zoom; } };
$('#calVal').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#calDlg').close('ok'); } });
// ---- icons (inline SVG, no external assets) ----
const ICONS = {
 open:'<path d="M3 7h6l2 2h10v10H3z"/>', save:'<path d="M5 3h12l3 3v15H4V3z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>', folder:'<path d="M3 6h6l2 2h10v11H3z"/><path d="M3 11h18"/>',
 left:'<path d="M15 5l-7 7 7 7"/>', right:'<path d="M9 5l7 7-7 7"/>', minus:'<path d="M5 12h14"/>', plus:'<path d="M5 12h14M12 5v14"/>',
 fit:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', ruler:'<path d="M3 16L16 3l5 5L8 21z"/><path d="M7 12l2 2M10 9l2 2M13 6l2 2"/>',
 table:'<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 10h18M3 15h18M9 4v16"/>', download:'<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
 panel:'<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M15 4v16"/>', close:'<path d="M6 6l12 12M18 6L6 18"/>',
 select:'<path d="M5 3l14 8-6 2-2 6z"/>', hand:'<path d="M8 13V5a1.5 1.5 0 013 0v6M11 11V4a1.5 1.5 0 013 0v7M14 11V6a1.5 1.5 0 013 0v8c0 4-3 7-7 7s-6-3-7-6l-1-3a1.5 1.5 0 012.5-1.5L8 13"/>',
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
  const drawing = ['line', 'poly', 'area', 'count', 'text', 'calibrate'].includes(tool);
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
