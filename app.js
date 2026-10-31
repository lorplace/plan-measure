'use strict';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
const $ = s => document.querySelector(s);
const SVGNS = 'http://www.w3.org/2000/svg';
const vpEl = $('#viewport'), stage = $('#stage'), canvas = $('#canvas'), svg = $('#svg');
const TYPE_NAMES = {line:'Length', poly:'Pipe run', area:'Area', count:'Count', text:'Note', sleeve:'Sleeve'};
// ---- icons (inline SVG, no external assets; 24px grid, 1.8 stroke) ----
const ICONS = {
 open:'<path d="M3 19V6a1 1 0 011-1h5l2 2h8a1 1 0 011 1v3"/><path d="M3 19l2.6-7.2A1.2 1.2 0 016.7 11H21l-2.7 7.3a1.2 1.2 0 01-1.1.7z"/>',
 save:'<path d="M5 4h11l4 4v11a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z"/><path d="M8 4v5h7V4M7.5 20v-6h9v6"/>',
 folder:'<path d="M3 6.5a1 1 0 011-1h5l2 2h9a1 1 0 011 1V18a1 1 0 01-1 1H4a1 1 0 01-1-1z"/><path d="M3 10.5h18"/>',
 file:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12.5h6M9 16h4"/>',
 left:'<path d="M14.5 6l-6 6 6 6"/>', right:'<path d="M9.5 6l6 6-6 6"/>', up:'<path d="M6 14.5l6-6 6 6"/>', down:'<path d="M6 9.5l6 6 6-6"/>',
 minus:'<path d="M5 12h14"/>', plus:'<path d="M5 12h14M12 5v14"/>',
 fit:'<path d="M4 9V5a1 1 0 011-1h4M20 9V5a1 1 0 00-1-1h-4M4 15v4a1 1 0 001 1h4M20 15v4a1 1 0 01-1 1h-4"/>',
 ruler:'<path d="M3.5 15.5l12-12 5 5-12 12z"/><path d="M7.5 11.5l2 2M10.5 8.5l2 2M13.5 5.5l2 2"/>',
 table:'<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9.5h18M3 14.5h18M9 4v16"/>',
 download:'<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14"/>',
 export:'<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M5 13v6a1 1 0 001 1h12a1 1 0 001-1v-6"/>',
 print:'<path d="M7 9V4h10v5"/><rect x="3" y="9" width="18" height="8" rx="1.5"/><path d="M7 14h10v6H7z"/>',
 panel:'<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M15 4v16"/>', close:'<path d="M6 6l12 12M18 6L6 18"/>', check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
 undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>', redo:'<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 000 11H13"/>',
 snap:'<rect x="8" y="8" width="8" height="8" rx="1"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/>', sleeve:'<circle cx="12" cy="12" r="7"/><path d="M4 12h16M12 4v16"/>',
 origin:'<path d="M5 19V4M5 19h15"/><path d="M2.5 6.5L5 4l2.5 2.5M17.5 16.5L20 19l-2.5 2.5"/>', layers:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
 find:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20"/><circle cx="10.5" cy="10.5" r="2.2"/>', select:'<path d="M6 3.5l12.5 7.6-5.4 1.5-2.5 5.9z"/>',
 loupe:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20M10.5 7.5v6M7.5 10.5h6"/>',
 more:'<circle cx="5.5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="18.5" cy="12" r="1.5" fill="currentColor"/>',
 hand:'<path d="M8 13V5a1.5 1.5 0 013 0v6M11 11V4a1.5 1.5 0 013 0v7M14 11V6a1.5 1.5 0 013 0v8c0 4-3 7-7 7s-6-3-7-6l-1-3a1.5 1.5 0 012.5-1.5L8 13"/>',
 cal:'<path d="M5 19L19 5"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/><path d="M9.5 9.5l-2-2M14.5 14.5l2 2"/>',
 line:'<path d="M4 12h16M4 8v8M20 8v8"/><path d="M2.5 13.5l3-3M18.5 13.5l3-3"/>',
 poly:'<path d="M3.5 19h5.5V9h6v6h5.5"/><circle cx="3.5" cy="19" r="1.5"/><circle cx="20.5" cy="15" r="1.5"/>',
 area:'<path d="M4 7.5l11-3.5 5 9-7 7-9-4z" fill="currentColor" fill-opacity=".18"/>',
 zone:'<path d="M4 7.5l11-3.5 5 9-7 7-9-4z"/><path d="M5.5 12.5l6.5-6.5M7.5 16l8.5-8.5M11 18l6.5-6.5" stroke-width="1.3"/>',
 count:'<circle cx="7" cy="8" r="2.6"/><circle cx="17" cy="8" r="2.6"/><circle cx="12" cy="16.5" r="2.6"/>', text:'<path d="M5 6.5V4.5h14v2M12 4.5v15M9 19.5h6"/>',
 keys:'<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9"/>',
 edit:'<path d="M4 20h4L19 9a2.8 2.8 0 00-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
 trash:'<path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13M10 11v5.5M14 11v5.5"/>',
 warn:'<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.5h.01"/>', clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'
};
const svgIc = (n, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

let doc = null;          // {type,name,bytes,pdf,img,numPages,sizes:[{w,h}],vps:[]}
let proj = null;         // {id,name,units,scales:{},items:[]}
let page = 1, zoom = 1, tool = 'select', draft = null, hover = null, selId = null;
let renderTimer = null, shiftDown = false, guide = null, straightOn = localStorage.getItem('pm-straight') !== '0';

// ---------- helpers ----------
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
function toast(msg, ms = 2500) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms); }
let openBusy = false; // true while a plan is still opening — snap indexing must not run
function setSleeveStatus(msg) {
  const el = $('#saveState');
  if (!el) { if (msg) toast(msg, 8000); return; }
  if (msg) {
    if (!el.dataset.sleeve) { el.dataset.prev = el.textContent; el.dataset.prevClass = el.className; }
    el.dataset.sleeve = '1'; el.textContent = msg; el.className = 'saving'; return;
  }
  if (el.dataset.sleeve) {
    delete el.dataset.sleeve;
    el.textContent = el.dataset.prev || ''; el.className = el.dataset.prevClass || '';
    delete el.dataset.prev; delete el.dataset.prevClass;
  }
}
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
  if (/\.pmproj$/i.test(f.name)) return openPmproj(f);
  if (/\.dwg$/i.test(f.name) && isPhoneDev && f.size > 2e6 && !(await ask({ title: 'Open a large DWG?', message: 'This DWG is ' + (f.size / 1e6).toFixed(1) + ' MB. Reading DWG files needs a lot of memory and can close the browser tab on a phone. Tip: open it once on a computer, then More > Save project file, and open that .pmproj file here.', ok: 'Open anyway' }))) return;
  const bytes = new Uint8Array(await f.arrayBuffer());
  if (fileMime(f) === 'application/dwg') toast('Reading DWG (first time loads a 10 MB converter)...', 8000); else toast('Opening...', 8000);
  await new Promise(r => setTimeout(r, 50)); // let the message paint before heavy parsing
  openBusy = true;
  try { await loadDoc(bytes, fileMime(f), f.name); } catch (err) { console.error(err); doc = null; layout(); openBusy = false;
    return toast(fileMime(f) === 'application/dwg' ? 'Could not read this DWG (' + err.message + '). Save it as DXF from your CAD program, or convert it free with ODA File Converter, then open the DXF.' : 'Could not open file: ' + err.message, 10000); }
  proj = { id: uid(), name: f.name.replace(/\.[^.]+$/, ''), fileName: f.name, fileType: doc.mime, units: $('#units').value || Units.DEFAULT_UNITS, unitsMigratedMm: true, scales: {}, items: [], origins: {}, hidden: {} };
  let msg = 'Opened ' + f.name + '. Set the scale before measuring.';
  if (doc.type === 'cad') { if (doc.cad.unitM) { proj.scales[1] = doc.cad.unitM / doc.cad.k; proj.scaleNames = { 1: 'CAD units: ' + doc.cad.unitName }; msg = 'Opened ' + f.name + ' (' + doc.cad.unitName + '). True scale set from the drawing.'; { const cu = [1, 2, 10].includes(doc.cad.units) ? 'imp' : 'mm'; setProjectUnits(cu); } } else msg = 'Opened ' + f.name + '. Drawing has no units: choose them in Set scale.';  if (doc.cad.xrefs && doc.cad.xrefs.length) msg += ' Missing external references (not in this file): ' + doc.cad.xrefs.slice(0, 3).join(', ') + (doc.cad.xrefs.length > 3 ? ' and ' + (doc.cad.xrefs.length - 3) + ' more' : '') + '. Bind them in your CAD program to see them.'; }
  openBusy = true;
  try {
    page = 1; resetHist(); fitPage(); renderLayers();
    const painted = await waitFirstPaint(isPhoneDev ? 15000 : 6000);
    if (!painted) toast('Opened ' + f.name + ' — still drawing the plan…', 4000);
    else toast(msg, 5000);
    try { await persist(); } catch (e) { console.warn('persist', e); }
  } finally {
    openBusy = false;
    // Sleeve/anchor scan only after a successful base paint — never cancel or race the first draw.
    if (base && base._ok) scheduleWarmGeom(800, true);
    else scheduleRender(200); // keep trying to paint; renderCanvas will warm geom once base is up
  }
}
$('#file').addEventListener('change', onFile);

// Plan bytes as a compact Uint8Array. IndexedDB already returns one, so a saved project no longer copies its whole file
// again on open; a view into a bigger buffer (a .pmproj file) is still copied so only the plan is kept and saved.
const ownBytes = b => b instanceof Uint8Array && b.byteOffset === 0 && b.byteLength === b.buffer.byteLength ? b : new Uint8Array(b);
async function loadDoc(bytes, mime, name) {
  dropRenders();
  // Each PDF gets its own pdf.js worker thread holding the whole parsed file. Without this, every plan opened in a session stayed in memory.
  if (doc && doc.pdf) doc.pdf.destroy().catch(() => { });
  doc = { name, mime, bytes, sizes: [], vps: [], uid: ++docSeq };
  if (mime === 'application/pdf') {
    doc.type = 'pdf';
    doc.pdf = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
    doc.numPages = doc.pdf.numPages;
    // page sizes for the whole set in one round of requests instead of one page after another
    const pgs = await Promise.all(Array.from({ length: doc.numPages }, (_, i) => doc.pdf.getPage(i + 1)));
    pgs.forEach((p, i) => { const vp = p.getViewport({ scale: 1 }); doc.vps[i + 1] = vp; doc.sizes[i + 1] = { w: vp.width, h: vp.height }; });
  } else if (mime === 'application/dxf' || mime === 'application/dwg') {
    doc.type = 'cad'; doc.cad = bytes && bytes.cadPack ? CAD.revive(bytes.cadPack) : await CAD.parseInWorker(bytes, mime === 'application/dxf' ? 'dxf' : 'dwg'); doc.bytes = null; /* raw CAD bytes are not kept */ doc.numPages = 1; doc.sizes[1] = { w: doc.cad.w, h: doc.cad.h };
  } else {
    doc.type = 'image';
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    doc.img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
    doc.numPages = 1; doc.sizes[1] = { w: doc.img.naturalWidth, h: doc.img.naturalHeight };
  }
}

// ---------- rendering ----------
function layout() {
  document.body.classList.toggle('hasdoc', !!doc); document.body.classList.toggle('iscad', !!doc && doc.type === 'cad'); syncProjName(); if (!doc) return; const { w, h } = doc.sizes[page];
  stage.style.width = w * zoom + 'px'; stage.style.height = h * zoom + 'px';
  placeCanvas();
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  $('#zoomInfo').textContent = Math.round(zoom * 100) + '%';
  $('#pageInfo').textContent = page + ' / ' + doc.numPages;
  const s = scaleOf(page), si = $('#scaleInfo'), nm = s ? String(proj.scaleNames && proj.scaleNames[page] || 'calibrated') : 'Set scale';
  $('#scaleVal').textContent = nm.charAt(0).toUpperCase() + nm.slice(1); si.classList.toggle('set', !!s); si.classList.toggle('unset', !s);
  si.title = s ? 'Scale for this page. Click to change it' : 'This page has no scale yet. Click to set it'; const ic = si.querySelector('svg'), want = s ? 'check' : 'ruler'; if (ic.dataset.n !== want) { ic.innerHTML = ICONS[want]; ic.dataset.n = want; }
  if (!layout.light) draw(); scheduleRender();
}
// Two bitmaps sit under the markup:
//   base   (#canvasBase) the whole page at a modest resolution, drawn once per page. It is always there, so moving and
//          zooming never shows white, and near the fit zoom it is the only thing drawn.
//   detail (#canvas)     the part on screen plus a margin, at the current zoom. Drawn only when the base is not sharp
//          enough, and redrawn only when the view leaves it or the zoom changes by more than about 25%.
// Both reuse their buffers. Creating a fresh canvas for every render made iOS close the tab: it frees canvases lazily, so
// they piled up while panning. Canvas memory for the plan is now fixed (at most about 9 MP, 36 MB, on a phone).
// During pinch / wheel / scroll the bitmaps are only moved and scaled with CSS; drawing happens ~150 ms after the gesture ends.
const isPhoneDev = matchMedia('(pointer:coarse)').matches || /iPhone|iPad|iPod/.test(navigator.userAgent);
const renderDpr = () => Math.min(window.devicePixelRatio || 1, isPhoneDev ? 2 : 3); // 2x keeps plan lines crisp with 2.25x fewer pixels than 3x
// iOS Safari blanks (or zeros) canvases past ~4096 px on a side or ~16.7 Mpx total; stay well under both.
const CANVAS_MAX_DIM = 4096, CANVAS_MAX_AREA = isPhoneDev ? 4e6 : 16e6;
const BASE_MAX_PX = isPhoneDev ? 2.5e6 : 8e6, SHARP = 1.25;
const base = document.createElement('canvas'); base.id = 'canvasBase'; base.width = base.height = 0; base.setAttribute('aria-hidden', 'true');
base.style.cssText = 'display:block;position:absolute;left:0;top:0;will-change:transform;pointer-events:none;visibility:hidden';
canvas.before(base);
const back = document.createElement('canvas'); back.width = back.height = 0; // the detail is drawn here, then copied to #canvas in one step
let docSeq = 0, contentGen = 0, baseJob = null, detailJob = null, renderSeq = 0;
const viewKey = () => doc ? doc.uid + ':' + page + ':' + contentGen : '';
function fitZoomOf(pg) { const { w, h } = doc.sizes[pg]; return Math.max(0.05, Math.min((vpEl.clientWidth - 40) / w, (vpEl.clientHeight - 40) / h)); }
// Clamp a scale so cw×ch stays inside iOS canvas limits (area + per-side).
function clampScale(w, h, s) {
  if (!(s > 0) || !(w > 0) || !(h > 0)) return 0.05;
  let cw = w * s, ch = h * s;
  if (cw > CANVAS_MAX_DIM) s *= CANVAS_MAX_DIM / cw;
  cw = w * s; ch = h * s;
  if (ch > CANVAS_MAX_DIM) s *= CANVAS_MAX_DIM / ch;
  cw = w * s; ch = h * s;
  const area = cw * ch;
  if (area > CANVAS_MAX_AREA) s *= Math.sqrt(CANVAS_MAX_AREA / area);
  return Math.max(0.05, s);
}
// Base resolution: sharp up to about 1.5x the fit zoom, within the pixel budget (on a phone that is 1:1 with the screen at
// fit, so the first full draw costs what it did before). Past that the detail layer takes over. Images are never drawn above their own size.
function baseScale() { const { w, h } = doc.sizes[page]; let s = Math.min(Math.sqrt(BASE_MAX_PX / (w * h)), fitZoomOf(page) * renderDpr() * 1.5); if (doc.type === 'image') s = Math.min(s, 1); return clampScale(w, h, s); }
function detailCap() { const d = renderDpr(); return isPhoneDev ? Math.max(2e6, Math.min(4e6, vpEl.clientWidth * vpEl.clientHeight * d * d * 1.5)) : 16e6; }
const wantedScale = () => doc.type === 'image' ? Math.min(zoom * renderDpr(), 1) : zoom * renderDpr();
// Visible part of the page in page units (null when the page is scrolled out of view)
function visRect() { const { w, h } = doc.sizes[page], vr = vpEl.getBoundingClientRect(), sr = stage.getBoundingClientRect();
  const x0 = Math.max(0, (vr.left - sr.left) / zoom), y0 = Math.max(0, (vr.top - sr.top) / zoom), x1 = Math.min(w, (vr.right - sr.left) / zoom), y1 = Math.min(h, (vr.bottom - sr.top) / zoom);
  return x1 > x0 && y1 > y0 ? { x0, y0, w: x1 - x0, h: y1 - y0 } : null; }
// Detail region and resolution: sharp first, then as much margin (up to 35% a side) as fits under the pixel cap
function planDetail(vis) { const { w, h } = doc.sizes[page], cap = detailCap(); let r = wantedScale(), m = 0.35, reg;
  const grow = m => { const x0 = Math.max(0, vis.x0 - vis.w * m), y0 = Math.max(0, vis.y0 - vis.h * m), x1 = Math.min(w, vis.x0 + vis.w * (1 + m)), y1 = Math.min(h, vis.y0 + vis.h * (1 + m)); return { x0, y0, w: x1 - x0, h: y1 - y0 }; };
  for (;;) { reg = grow(m); if (reg.w * reg.h * r * r <= cap || m <= 0.05) break; m = Math.max(0.05, m - 0.1); }
  if (reg.w * reg.h * r * r > cap) r = Math.sqrt(cap / (reg.w * reg.h));
  r = clampScale(reg.w, reg.h, r);
  return { reg, r }; }
const covers = (g, v) => { const e = 1 / zoom; return g.x0 <= v.x0 + e && g.y0 <= v.y0 + e && g.x0 + g.w >= v.x0 + v.w - e && g.y0 + g.h >= v.y0 + v.h - e; };
const fits = (st, vis, want) => !!(st && st.reg) && st.key === viewKey() && covers(st.reg, vis) && st.r >= want.r / SHARP && st.r <= want.r * 1.6;
function placeCanvas() { if (!doc || !doc.sizes[page]) return; const { w, h } = doc.sizes[page], key = viewKey();
  // Hide base until a successful paint — a sized-but-empty canvas looks like a blank dark-grey plan on iPhone.
  base.style.width = w * zoom + 'px'; base.style.height = h * zoom + 'px'; base.style.visibility = (base._key === key && base._ok) ? '' : 'hidden';
  const g = canvas._reg; canvas.style.visibility = g && canvas._on && canvas._key === key ? '' : 'hidden'; if (!g) return;
  canvas.style.left = g.x0 * zoom + 'px'; canvas.style.top = g.y0 * zoom + 'px'; canvas.style.width = g.w * zoom + 'px'; canvas.style.height = g.h * zoom + 'px'; }
function cancelJob(j) { if (!j) return; j.dead = true; if (j.task) { try { j.task.cancel(); } catch (e) { } j.task = null; } }
function dropRenders() { cancelJob(baseJob); cancelJob(detailJob); baseJob = detailJob = null; base._key = canvas._key = ''; base._ok = canvas._on = false; canvas._reg = null; canvas.width = canvas.height = base.width = base.height = back.width = back.height = 0; }
function canvasLooksPainted(c) {
  // Safari can "succeed" a render then leave a zeroed/transparent buffer under memory pressure.
  // A white pre-fill alone must NOT count — require some non-white ink (plan lines).
  try {
    if (!c || !c.width || !c.height) return false;
    const ctx = c.getContext('2d'); if (!ctx) return false;
    const sample = (x, y, tw, th) => {
      const d = ctx.getImageData(x, y, tw, th).data;
      let ink = 0, lit = 0;
      for (let i = 0; i < d.length; i += 4) {
        const s = d[i] + d[i + 1] + d[i + 2];
        if (s < 20) continue; // transparent/black void
        if (s < 720) ink++; // not near-white
        else lit++;
      }
      return { ink, lit };
    };
    const a = sample(0, 0, Math.min(c.width, 64), Math.min(c.height, 64));
    if (a.ink >= 8) return true;
    const cx = Math.max(0, Math.floor(c.width / 2) - 32), cy = Math.max(0, Math.floor(c.height / 2) - 32);
    const b = sample(cx, cy, Math.min(64, c.width - cx), Math.min(64, c.height - cy));
    if (b.ink >= 8) return true;
    // Cad-ish near-empty corner: accept any non-zero variance with some lit pixels from pdf white bg + lines
    return (a.ink + b.ink) >= 3;
  } catch (e) { return false; }
}
function allocCanvasSize(c, cw, ch) {
  // Setting an over-limit size on iOS yields a blank/zero canvas — refuse and let caller shrink.
  if (cw > CANVAS_MAX_DIM || ch > CANVAS_MAX_DIM || cw * ch > CANVAS_MAX_AREA) return false;
  try { c.width = cw; c.height = ch; } catch (e) { return false; }
  return c.width === cw && c.height === ch;
}
// Draws page region reg at r device px per page unit into ctx (cw x ch). Throws if the job is cancelled.
async function paintRegion(ctx, cw, ch, reg, r, job) {
  if (doc.type === 'pdf') { const p = await doc.pdf.getPage(page); if (job.dead) throw new Error('cancelled');
    job.task = p.render({ canvasContext: ctx, viewport: p.getViewport({ scale: r }), transform: [1, 0, 0, 1, -reg.x0 * r, -reg.y0 * r] }); await job.task.promise; job.task = null; return; }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch);
  if (doc.type === 'cad') CAD.draw(ctx, doc.cad, r, -reg.x0 * r, -reg.y0 * r, (proj && proj.hidden) || {}, reg);
  else ctx.drawImage(doc.img, reg.x0, reg.y0, reg.w, reg.h, 0, 0, cw, ch);
  ctx.restore(); }
// Base: drawn straight into the visible canvas, so the first view of a heavy plan fills in as it draws.
// On phone: retry at lower resolution if paint throws or Safari leaves a blank buffer. Never leave a sized empty canvas visible.
function renderBase(key) {
  if (baseJob && baseJob.key === key) return baseJob.promise; // already drawing this page
  cancelJob(baseJob);
  const { w, h } = doc.sizes[page], job = baseJob = { key };
  job.promise = (async () => {
    let r = baseScale();
    for (let attempt = 0; attempt < 5; attempt++) {
      if (job.dead || viewKey() !== key) return false;
      r = clampScale(w, h, r);
      const cw = Math.max(1, Math.ceil(w * r)), ch = Math.max(1, Math.ceil(h * r));
      base._key = key; base._r = r; base._ok = false; placeCanvas();
      if (!allocCanvasSize(base, cw, ch)) { r *= 0.55; continue; }
      placeCanvas();
      try {
        const ctx = base.getContext('2d', { alpha: false });
        if (!ctx) throw new Error('no 2d context');
        // White fill first so a failed/partial paint is never a transparent hole over the grey viewport
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch);
        await paintRegion(ctx, cw, ch, { x0: 0, y0: 0, w, h }, r, job);
      } catch (e) {
        if (job.dead) return false;
        console.warn('renderBase attempt', attempt, cw, 'x', ch, e && e.message || e);
        r *= 0.55; continue;
      }
      if (job.dead || viewKey() !== key) return false;
      if (!canvasLooksPainted(base)) { console.warn('renderBase blank buffer', cw, 'x', ch); r *= 0.55; continue; }
      base._ok = true; placeCanvas();
      if (baseJob === job) baseJob = null;
      return true;
    }
    if (baseJob === job) baseJob = null;
    // Give up: free the buffer so we do not flash a blank slab
    try { base.width = base.height = 0; } catch (e) { }
    base._ok = false; placeCanvas();
    return false;
  })();
  return job.promise;
}
// Detail: drawn into the back buffer, then copied to #canvas, so the current view stays up until the new one is ready.
function renderDetail(key, vis, want) {
  if (detailJob && fits(detailJob, vis, want)) return detailJob.promise; // the render in flight already covers this view
  cancelJob(detailJob);
  let { reg, r } = want;
  r = clampScale(reg.w, reg.h, r);
  const cw = Math.max(1, Math.ceil(reg.w * r)), ch = Math.max(1, Math.ceil(reg.h * r)), job = detailJob = { key, reg, r };
  job.promise = (async () => {
    if (!allocCanvasSize(back, cw, ch)) { if (detailJob === job) detailJob = null; return false; }
    try { await paintRegion(back.getContext('2d'), cw, ch, reg, r, job); }
    catch (e) { if (!job.dead) console.warn('renderDetail', e && e.message || e); if (detailJob === job) detailJob = null; return false; }
    if (job.dead) { if (detailJob === job) detailJob = null; return false; }
    if (!allocCanvasSize(canvas, cw, ch)) { back.width = back.height = 0; if (detailJob === job) detailJob = null; return false; }
    canvas.getContext('2d').drawImage(back, 0, 0); back.width = back.height = 0;
    canvas._reg = reg; canvas._r = r; canvas._key = key; canvas._on = true; placeCanvas();
    if (detailJob === job) detailJob = null; return true; })();
  return job.promise;
}
async function renderCanvas() {
  if (!doc || !doc.sizes[page]) return; const seq = ++renderSeq, key = viewKey();
  if (!(base._key === key && base._ok)) { await renderBase(key); if (seq !== renderSeq || viewKey() !== key || !base._ok) return; }
  const vis = visRect();
  if (!vis || wantedScale() <= base._r * SHARP) { cancelJob(detailJob); detailJob = null; if (canvas._reg) { canvas._on = false; canvas._reg = null; canvas.width = canvas.height = 0; placeCanvas(); } } // the base is sharp enough here: drop the detail
  else { const want = planDetail(vis);
    if (!(canvas._on && fits({ key: canvas._key, reg: canvas._reg, r: canvas._r }, vis, want))) { const ok = await renderDetail(key, vis, want); if (!ok || seq !== renderSeq) return; } }
  canvas.dataset.rendered = page + ':' + zoom;
}
window.PMrender = { get base() { return { key: base._key, ok: !!base._ok, r: base._r, w: base.width, h: base.height }; }, get detail() { return { on: !!canvas._on, key: canvas._key, r: canvas._r, reg: canvas._reg, w: canvas.width, h: canvas.height }; }, get key() { return viewKey(); }, get busy() { return !!(renderQueued || baseJob || detailJob); } };
let gestureUntil = 0; const gestureBusy = () => performance.now() < gestureUntil || (typeof pointers !== 'undefined' && pointers.size > 1);
let renderQueued = false;
function scheduleRender(ms = 150) { clearTimeout(renderTimer); renderQueued = true; renderTimer = setTimeout(() => { if (gestureBusy()) return scheduleRender(ms); renderQueued = false; renderCanvas(); }, ms); }
function el(tag, attrs, parent) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
function label(g, x, y, text, color) {
  const fs = 13 / zoom; const t = el('text', { x, y, 'font-size': fs, fill: color, 'font-weight': 700, 'text-anchor': 'middle', 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': 3 / zoom, 'pointer-events': 'none' }, g); t.textContent = text; return t;
}
function drawItem(it, g, isDraft) {
  const sw = 2.5 / zoom, c = it.color, sel = it.id === selId;
  const grp = el('g', { 'data-id': it.id || '' }, g);
  const ptsStr = it.pts.map(p => p.join(',')).join(' ');
  if (it.type === 'line' || it.type === 'poly' || it.type === 'calibrate') {
    if (it.ext && it.ext.length === 2) el('path', { d: `M${it.ext[0][0]} ${it.ext[0][1]}L${it.ext[1][0]} ${it.ext[1][1]}`, fill: 'none', stroke: '#90a4ae', 'stroke-width': 1.4 / zoom, 'stroke-dasharray': `${5 / zoom} ${4 / zoom}`, 'stroke-opacity': '0.85', 'pointer-events': 'none' }, grp);
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
  if (sel) it.pts.forEach((p, i) => el('rect', { x: p[0] - 6 / zoom, y: p[1] - 6 / zoom, width: 12 / zoom, height: 12 / zoom, fill: '#fff', stroke: '#1d5fb4', 'stroke-width': 2 / zoom, 'data-v': i, class: 'handle' }, grp));
}
function draw() {
  svg.innerHTML = ''; if (!proj) return;
  const g = el('g', {}, svg);
  proj.items.filter(i => i.page === page).forEach(i => drawItem(i, g));
  drawSleeveTargets(g);
  if (draft) { const full = draft.type === 'calibrate' && draft.pts.length === 2; const pts = hover && !full ? draft.pts.concat([hover]) : draft.pts; if (pts.length) { const ext = wallExt ? [wallExt.a, wallExt.b] : draft.ext; drawItem({ ...draft, pts, page, label: draft.label, ext }, g, true); }
    const q = draft.pts[calSel]; if (q) el('circle', { cx: q[0], cy: q[1], r: 7 / zoom, fill: 'none', stroke: '#ffb300', 'stroke-width': 2.5 / zoom }, g); }
  renderList();
}
function drawSleeveTargets(g) {
  // Viewport-only centre dots (hide when zoomed far out) so 1000+ anchors stay smooth on phone
  if (!doc || !(PLACE.includes(tool) || tool === 'count' || tool === 'sleeve' || tool === 'origin')) return;
  const G = geomCache[page]; if (!G || !G.sleeve || !G.sleeve.n) return;
  // Hide dots when the whole sheet fits too small — symbols would be noise
  if (zoom < 0.22) return;
  const vis = (typeof visRect === 'function' ? visRect() : null) || { x0: 0, y0: 0, w: doc.sizes[page].w, h: doc.sizes[page].h };
  const pad = 48 / zoom, x0 = vis.x0 - pad, y0 = vis.y0 - pad, x1 = vis.x0 + vis.w + pad, y1 = vis.y0 + vis.h + pad;
  const { xy, grid } = G.sleeve, r = 5.5 / zoom, sw = 1.6 / zoom;
  const tg = el('g', { id: 'sleeveTargets', 'pointer-events': 'none' }, g);
  const c1x = Math.floor(x0 / CELL), c2x = Math.floor(x1 / CELL), c1y = Math.floor(y0 / CELL), c2y = Math.floor(y1 / CELL);
  const seen = new Set();
  let drawn = 0;
  const maxDraw = 250; // viewport-capped; never dump all 1000+ into the DOM
  for (let cx = c1x; cx <= c2x && drawn < maxDraw; cx++) for (let cy = c1y; cy <= c2y && drawn < maxDraw; cy++) {
    const cell = grid.get(cx + ',' + cy); if (!cell) continue;
    for (const i of cell) {
      if (seen.has(i) || drawn >= maxDraw) continue; seen.add(i);
      const x = xy[2 * i], y = xy[2 * i + 1];
      if (x < x0 || y < y0 || x > x1 || y > y1) continue;
      el('circle', { cx: x, cy: y, r: r * 1.7, fill: '#ff6f00', 'fill-opacity': '0.18', stroke: 'none' }, tg);
      el('circle', { cx: x, cy: y, r, fill: '#fff', stroke: '#ff6f00', 'stroke-width': sw }, tg);
      el('circle', { cx: x, cy: y, r: r * 0.35, fill: '#ff6f00', stroke: 'none' }, tg);
      drawn++;
    }
  }
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
const setHTML = (el, html) => { if (el._html !== html) { el.innerHTML = html; el._html = html; } };
function renderList() {
  if (!proj) return;
  const gs = groups();
  setHTML($('#totals'), gs.length ? '<table class="tot">' + gs.map(g => `<tr><td class="swc"><span class="sw" style="background:${esc(g.color)}"></span></td><td class="nm">${TYPE_NAMES[g.type]}${g.label ? '<small>' + esc(g.label) + '</small>' : ''}</td><td class="n">${fmtGroup(g)}${g.noscale ? '<sup>*</sup>' : ''}</td></tr>`).join('') + '</table>' + (gs.some(g => g.noscale) ? '<small class="totnote">* Some items are on pages without a scale.</small>' : '') : '<p class="empty">Nothing measured yet. Pick a tool and click on the plan.</p>');
  const only = $('#pageOnly').checked, sN = new Map(), u = proj.units; let k = 0; for (const o of proj.items) if (o.type === 'sleeve') sN.set(o, ++k);
  const val = i => { const v = measure(i); if (i.type === 'count' || i.type === 'text') return ''; if (i.type === 'sleeve') return i.size || ''; if (!isFinite(v)) return 'no scale'; return i.type === 'area' ? Units.fmtArea(v, u) : Units.fmtLen(v, u); };
  const det = i => { const d = [], sc = scaleOf(i.page); if (!only) d.push('Page ' + i.page); if (i.type === 'area' && sc) d.push('perimeter ' + Units.fmtLen(polyLen(i.pts, true) * sc, u)); if (i.type === 'sleeve') d.push(sleeveText(i)); if ((i.type === 'line' || i.type === 'poly') && i.extra) d.push('includes ' + Units.fmtLen(i.extra, u) + ' added'); if (i.type === 'text') d.push((i.text || '').replace(/\s+/g, ' ')); const t = d.filter(Boolean).join(', '); return t.charAt(0).toUpperCase() + t.slice(1); };
  setHTML($('#list'), proj.items.filter(i => !only || i.page === page).map(i => { const nm = i.type === 'sleeve' ? ['S' + sN.get(i), i.label].filter(Boolean).join(' ') : i.type === 'text' ? '' : i.label || '', v = val(i), d = det(i);
    return `<div class="row ${i.id === selId ? 'sel' : ''}" data-id="${i.id}"><span class="sw" style="background:${esc(i.color)}"></span><span class="nm"><span class="l1">${TYPE_NAMES[i.type]}${nm ? '<small>' + esc(nm) + '</small>' : ''}</span>${d ? '<span class="l2">' + esc(d) + '</span>' : ''}</span><span class="v${v === 'no scale' ? ' ns' : ''}">${esc(v)}</span><button type="button" class="rdel" title="Delete" aria-label="Delete">${svgIc('trash')}</button></div>`; }).join('') || `<p class="empty">${only && proj.items.length ? 'Nothing on this page yet.' : 'No items yet.'}</p>`);
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
function deleteSel() { if (!selId) return; const it = selItem(); deleteItems([selId], (it ? TYPE_NAMES[it.type] : 'Item') + ' deleted'); }
function changed() { for (const k in geomCache) if (geomCache[k]) geomCache[k].sleeve = null; draw(); persistSoon(); commitSoon(); }

// ---------- navigation & zoom ----------
function gotoPage(n) { if (!doc) return; n = Math.max(1, Math.min(doc.numPages, n)); if (n !== page) { const old = page; page = n; draft = null; const it = proj && proj.items.find(i => i.id === selId); if (it && it.page !== n) selId = null; if (isPhoneDev) releasePage(old); } fitPage(); }
// Phones: free the page you left (its parsed drawing and decoded images). It is parsed again if you come back.
function releasePage(pg) { if (doc && doc.type === 'pdf') doc.pdf.getPage(pg).then(p => p.cleanup()).catch(() => { }); }
function fitPage() { if (!doc) return; document.body.classList.toggle('hasdoc', true); const { w, h } = doc.sizes[page]; zoom = Math.max(0.05, Math.min((vpEl.clientWidth - 40) / w, (vpEl.clientHeight - 40) / h)); layout(); }
function setZoom(z, cx, cy) {
  if (!doc) return; z = Math.max(0.05, Math.min(20, z)); const r = vpEl.getBoundingClientRect();
  if (cx == null) { cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
  const px = (vpEl.scrollLeft + cx - r.left - stage.offsetLeft) / zoom, py = (vpEl.scrollTop + cy - r.top - stage.offsetTop) / zoom;
  zoom = z; layout.light = gestureBusy(); layout(); layout.light = false; if (gestureBusy()) { clearTimeout(setZoom.t); setZoom.t = setTimeout(() => draw(), 160); }
  vpEl.scrollLeft = px * zoom + stage.offsetLeft - (cx - r.left); vpEl.scrollTop = py * zoom + stage.offsetTop - (cy - r.top);
}
$('#prev').onclick = () => gotoPage(page - 1); $('#next').onclick = () => gotoPage(page + 1);
$('#zoomIn').onclick = () => setZoom(zoom * 1.25); $('#zoomOut').onclick = () => setZoom(zoom / 1.25); $('#fit').onclick = fitPage;
vpEl.addEventListener('wheel', e => { if (!doc) return; e.preventDefault(); gestureUntil = performance.now() + 150; setZoom(zoom * Math.pow(1.0015, -e.deltaY), e.clientX, e.clientY); }, { passive: false });
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
function syncToolUI() { const a = document.querySelector('.tool.active'); document.querySelectorAll('#tools [data-tool],#zoneTool').forEach(b => b.setAttribute('aria-pressed', String(b.classList.contains('active'))));
  if (a) { const ic = a.querySelector('svg'), t = a.querySelector('.t'), o = $('#optTool'); if (o._for !== a) { o.querySelector('svg').innerHTML = ic ? ic.innerHTML : ''; o.querySelector('span').textContent = t ? t.textContent : ''; o._for = a; } } }
function setTool(t) { tool = t; draft = null; hover = null; document.querySelectorAll('.tool').forEach(b => b.classList.toggle('active', b.dataset.tool === t)); $('#hint').textContent = HINTS[t]; vpEl.style.cursor = t === 'pan' ? 'grab' : t === 'select' ? 'default' : 'crosshair'; draw(); }
document.querySelectorAll('.tool').forEach(b => b.onclick = () => setTool(b.dataset.tool));
const TOUCH_AIM_UP = 72; // CSS px — while dragging, aim sits above the fingertip so it stays visible
function pagePtRaw(clientX, clientY) { const r = svg.getBoundingClientRect(); return [(clientX - r.left) / zoom, (clientY - r.top) / zoom]; }
function touchAiming(e) {
  // Lift only while dragging a measuring point (not on a plain tap), so taps still land under the finger
  if (!(e && e.pointerType && e.pointerType !== 'mouse')) return false;
  if (!(PLACE.includes(tool) || tool === 'count' || tool === 'sleeve' || tool === 'origin')) return false;
  if (gesture && (gesture.kind === 'place' || gesture.kind === 'dpt') && gesture.moved) return true;
  return false;
}
function pagePt(e, forceLift) {
  let cx = e.clientX, cy = e.clientY;
  if (forceLift === true || (forceLift !== false && touchAiming(e))) cy -= TOUCH_AIM_UP;
  return pagePtRaw(cx, cy);
}
function aimScreenPt(e, forceLift) {
  let cx = e.clientX, cy = e.clientY;
  const lift = forceLift === true || (forceLift !== false && touchAiming(e));
  if (lift) cy -= TOUCH_AIM_UP;
  return { x: cx, y: cy, fingerY: e.clientY, lift };
}

function finishDraft() {
  if (!draft) return;
  if (draft.type === 'calibrate') { if (draft.pts.length === 2) openCalibrate(); return; }
  const need = { line: 2, poly: 2, area: 3 }[draft.type];
  if (draft.pts.length >= need) { const it = { id: uid(), type: draft.type, page, pts: draft.pts, color: draft.color, label: draft.label }; if (draft.ext) it.ext = draft.ext; proj.items.push(it); selId = null; }
  draft = null; hover = null; changed();
}
$('#finishBtn').onclick = finishDraft;
$('#undoPt').onclick = () => { if (draft) { draft.pts.pop(); if (!draft.pts.length) draft = null; draw(); } };

function clickAt(p, e) {
  if (!doc || !proj) return;
  const color = $('#color').value, lab = $('#label').value.trim();
  if (['line', 'poly', 'area', 'calibrate'].includes(tool)) {
    if (!draft) draft = { type: tool, pts: [], color: tool === 'calibrate' ? '#1976d2' : color, label: lab };
    // From a sleeve centre: second tap finishes a locked perpendicular-to-wall measure (never empty space)
    if (tool === 'line' && draft.pts.length === 1 && isSleeveCentrePt(draft.pts[0], Math.max(4 / zoom, 1))) {
      applyToWall(p); return;
    }
    const prev = draft.pts[draft.pts.length - 1]; p = aim(p, e, prev);
    if (prev && dist(prev, p) < 1e-6) return;
    if (tool === 'calibrate' && draft.pts.length >= 2) return;
    draft.pts.push(p); calSel = draft.pts.length - 1;
    if (tool === 'line' && draft.pts.length === 2 && wallExt) draft.ext = [wallExt.a.slice(), wallExt.b.slice()];
    if ((tool === 'line' || tool === 'calibrate') && draft.pts.length === 2) {
      if (tool === 'line') finishDraft(); else { calSel = 1; toast('Adjust points if needed (drag, arrows), then Set distance.', 4000); }
    }
    // After placing first Length point on a sleeve, tip the user about To wall
    if (tool === 'line' && draft && draft.pts.length === 1 && isSleeveCentrePt(draft.pts[0], Math.max(4 / zoom, 1))) {
      syncToWallUi(); toast('Tap To wall, or tap toward a wall — measures perpendicular.', 3500);
    }
    draw();
  } else if (tool === 'count') { p = aim(p, e, null); proj.items.push({ id: uid(), type: 'count', page, pts: [p], color, label: lab }); changed(); }
  else if (tool === 'sleeve') { p = aim(p, e, null); proj.items.push({ id: uid(), type: 'sleeve', page, pts: [p], color, label: lab, size: $('#sleeveSize').value, text: '' }); changed(); }
  else if (tool === 'origin') { p = aim(p, e, null); proj.origins = proj.origins || {}; proj.origins[page] = p; changed(); toast('Origin set. Sleeve X/Y are measured from here (Y up).'); }
  else if (tool === 'text') { const pg = page; ask({ title: 'Add a note', kind: 'note', placeholder: 'e.g. Verify invert with site', ok: 'Add note' }).then(t => { t = (t || '').trim(); if (t && proj) { proj.items.push({ id: uid(), type: 'text', page: pg, pts: [p], color, label: '', text: t }); changed(); } }); }
}

// pointer handling: click / drag / pan / pinch
const pointers = new Map(); let gesture = null, lastUp = null;
vpEl.addEventListener('pointerdown', e => {
  if (!doc) return; try { vpEl.setPointerCapture(e.pointerId); } catch (err) { } pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; gesture = { kind: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; hideLoupe(); return; }
  const p = pagePt(e);
  gesture = { kind: 'maybe', sx: e.clientX, sy: e.clientY, sl: vpEl.scrollLeft, st: vpEl.scrollTop, p, moved: false };
  // Print mode: pan/pinch the view only (the blue frame handles its own drag/resize)
  if (document.body.classList.contains('printmode')) { gesture.kind = 'pan'; return; }
  if (e.button === 0 && draft && (draft.type === 'poly' || draft.type === 'area') && lastUp && performance.now() - lastUp.t < 450 && Math.hypot(e.clientX - lastUp.x, e.clientY - lastUp.y) < 8) { lastUp = null; gesture = null; finishDraft(); return; }
  if (e.button === 1 || tool === 'pan') { gesture.kind = 'pan'; return; }
  if (draft && PLACE.includes(tool)) { const k = draft.pts.findIndex(q => dist(q, p) * zoom < (e.pointerType === 'touch' ? 22 : 10)); if (k >= 0 && (draft.type === 'calibrate' ? draft.pts.length === 2 : true)) { gesture.kind = 'dpt'; gesture.v = k; calSel = k; gesture.off = [draft.pts[k][0] - p[0], draft.pts[k][1] - p[1]]; showLoupe(draft.pts[k], e); draw(); return; } }
  if (e.pointerType !== 'mouse' && PLACE.includes(tool) && !(tool === 'calibrate' && draft && draft.pts.length === 2)) { gesture.kind = 'place'; hover = placeSnap(p, e); showLoupe(hover, e); draw(); return; }
  if (tool === 'select') {
    const h = e.target.closest('.handle'), g = e.target.closest('g[data-id]');
    if (h && selId) { gesture.kind = 'vertex'; gesture.v = +h.dataset.v; return; }
    const gid = g && g.dataset.id ? g.dataset.id : nearHit(p, (e.pointerType === 'mouse' ? 8 : 24) / zoom);
    if (gid) { selId = gid; const it = selItem(); gesture.kind = 'move'; gesture.orig = it.pts.map(q => q.slice()); draw(); return; }
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
  if (g.kind === 'place') { hideLoupe(); hover = null; if (e.type === 'pointerup') clickAt(pagePt(e, !!g.moved), e); else draw(); return; }
  if (g.kind === 'dpt') { if (e.pointerType !== 'mouse') hideLoupe(); draw(); return; }
  if (g.kind === 'vertex' || g.kind === 'move') { changed(); return; }
  if (g.kind === 'pan') { if (g.desel && !g.moved) { selId = null; draw(); } return; }
  if (g.kind === 'maybe' && !g.moved && e.type === 'pointerup') { clickAt(pagePt(e), e); lastUp = { t: performance.now(), x: e.clientX, y: e.clientY }; }
}
vpEl.addEventListener('pointerup', endPointer); vpEl.addEventListener('pointercancel', endPointer);
vpEl.addEventListener('dblclick', e => { if (draft && (draft.type === 'poly' || draft.type === 'area')) { // remove the duplicate point added by the 2nd click
  if (draft.pts.length > 1 && dist(draft.pts[draft.pts.length - 1], draft.pts[draft.pts.length - 2]) < 4 / zoom) draft.pts.pop(); finishDraft(); } });
document.addEventListener('keydown', e => {
  if (e.key === 'Shift') shiftDown = true;
  if (e.target.matches('input:not([type=checkbox]),textarea,select') || document.querySelector('dialog[open]')) return;
  if (e.key === '?') { $('#keysDlg').showModal(); return; }
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
$('#scaleBtn').onclick = () => { if (!doc) return toast('Open a plan first'); $('#imgDpiRow').hidden = doc.type !== 'image'; $('#cadUnitRow').hidden = doc.type !== 'cad'; $('#stdScaleRow').hidden = doc.type === 'cad'; $('#calInstead').hidden = doc.type === 'cad'; $('#scaleDlg').showModal(); };
$('#calInstead').onclick = () => { $('#scaleDlg').close('cancel'); setTool('calibrate'); toast('Click two points of a known distance on the plan.', 4000); };
$('#scaleDlg').addEventListener('close', () => { if ($('#scaleDlg').returnValue !== 'ok') return; if (doc.type === 'cad') { const u = +$('#cadUnit').value; return applyScale(CAD.UNIT_M[u] / doc.cad.k, 'CAD units: ' + CAD.UNIT_NAME[u], false); }
  const s = Units.STD[$('#stdScale').value];
  let m = s.mPerPt; if (doc.type === 'image') m = s.ratio * Units.IN / (+$('#imgDpi').value || 150); applyScale(m, s.name, $('#allPages').checked); });
function openCalibrate() { $('#calVal').value = ''; $('#calDlg').showModal(); setTimeout(() => $('#calVal').focus(), 50); }
$('#calDlg').addEventListener('close', () => {
  const pts = draft && draft.pts;
  if ($('#calDlg').returnValue === 'ok' && pts && pts.length === 2) {
    draft = null; hover = null;
    // Bare numbers are millimetres; explicit units (m, ft, in) still work.
    const real = Units.parseLength($('#calVal').value, Units.DEFAULT_UNITS);
    if (!(real > 0)) { toast('Could not read that length. Try again (e.g. 5000 for 5000 mm).'); draw(); return; }
    // Calibrating puts the project into mm so lengths, labels and offsets show in mm.
    setProjectUnits(Units.DEFAULT_UNITS);
    applyScale(real / dist(pts[0], pts[1]), 'calibrated ' + Units.fmtLen(real, Units.DEFAULT_UNITS), $('#calAll').checked);
    setTool('line');
  } else draw();
});
function setProjectUnits(u) {
  if (!proj) return;
  proj.units = u; proj.unitsMigratedMm = true;
  $('#units').value = u; if ($('#units2')) $('#units2').value = u;
}
$('#units').addEventListener('change', e => { if (proj) { setProjectUnits(e.target.value); changed(); } });

// ---------- CSV export ----------
function csvCell(v) { v = String(v ?? ''); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
function buildCSV() {
  const u = proj.units, lu = u === 'mm' ? 'mm' : Units.isMet(u) ? 'm' : 'ft', au = Units.isMet(u) ? 'm2' : 'sq ft', lf = u === 'mm' ? 1000 : Units.isMet(u) ? 1 : 1 / Units.FT, af = Units.isMet(u) ? 1 : lf * lf;
  const rows = [['Project', proj.name], [], ['Page', 'Type', 'Label', 'Colour', 'Quantity', 'Unit', 'Display', 'Added length', 'Note']];
  proj.items.forEach(it => { const v = measure(it); let q = '', un = '';
    if (it.type === 'line' || it.type === 'poly') { q = isFinite(v) ? (v * lf).toFixed(3) : ''; un = lu; }
    else if (it.type === 'area') { q = isFinite(v) ? (v * af).toFixed(3) : ''; un = au; }
    else if (it.type === 'count' || it.type === 'sleeve') { q = 1; un = 'ea'; }
    rows.push([it.page, TYPE_NAMES[it.type], it.label || '', it.color, q, un, fmtItem(it), it.extra ? Units.fmtLen(it.extra, u) : '', it.text || '']); });
  rows.push([], ['TOTALS'], ['Type', 'Label', 'Colour', 'Quantity', 'Unit', 'Display', 'Items']);
  groups().forEach(g => { const ea = g.type === 'count' || g.type === 'sleeve'; rows.push([TYPE_NAMES[g.type], g.label, g.color, ea ? g.n : g.type === 'area' ? (g.sum * af).toFixed(3) : (g.sum * lf).toFixed(3), ea ? 'ea' : g.type === 'area' ? au : lu, fmtGroup(g), g.n]); });
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
    { const hidL = M.layerNames.map(n => !!hid[n]), cols = M.colors.map(hexRgb), sx = M.sx; for (let i = 0; i < M.nSegs; i++) if (!hidL[M.sL[i]]) pg.drawLine({ start: { x: sx[4 * i], y: h - sx[4 * i + 1] }, end: { x: sx[4 * i + 2], y: h - sx[4 * i + 3] }, thickness: 0.4, color: cols[M.sC[i]] }); }
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
      txt(sleeveName(it) + ' ' + (it.size || '') + sleeveHtLabel(it), x, y + size * 1.3); }
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
let saveTimer; function persistSoon() { clearTimeout(saveTimer); setSaveState('pending'); saveTimer = setTimeout(persist, 800); }
function packForSave(M) { const o = {}; for (const k in M) if (k[0] !== '_' && typeof M[k] !== 'function') o[k] = M[k]; return o; }
async function persist() { if (!proj || !doc) return; try { const t = Date.now(); await idb('readwrite', s => s.put({ ...JSON.parse(JSON.stringify(proj)), ...(doc.type === 'cad' ? { bytes: null, cadPack: packForSave(doc.cad) } : { bytes: doc.bytes }), updated: t })); localStorage.setItem('pm-last', proj.id); rememberRecent(proj, t); setSaveState('ok', '', t); } catch (e) { setSaveState('err', e.message); toast('Could not save: ' + e.message); } }
$('#saveBtn').onclick = async () => { if (!proj) return; const n = await ask({ title: 'Save project', message: 'Projects are saved in this browser automatically. Give this one a name you will recognise.', kind: 'text', value: proj.name, ok: 'Save' }); if (n != null && n.trim()) { proj.name = n.trim(); layout(); await persist(); toast('Saved in this browser'); } };
// One-shot: older projects defaulted to feet/metres; move them to mm unless already migrated.
// After this, Units picker choices stick via unitsMigratedMm.
function migrateProjectUnits(p) {
  if (!p) return;
  if (p.units !== 'mm' && p.units !== 'met' && p.units !== 'imp') p.units = Units.DEFAULT_UNITS;
  if (!p.unitsMigratedMm) { p.units = Units.DEFAULT_UNITS; p.unitsMigratedMm = true; }
}
async function openProject(id) { const r = await idb('readonly', s => s.get(id)); if (!r) { forgetRecent(id); renderRecent(); throw new Error('it is no longer saved in this browser'); } const { bytes, cadPack, updated, ...p } = r; setSaveState('ok', '', updated); await loadDoc(cadPack ? { cadPack } : ownBytes(bytes), p.fileType, p.fileName); proj = p; migrateProjectUnits(proj); resetHist(); $('#units').value = proj.units; if ($('#units2')) $('#units2').value = proj.units; page = 1; selId = null; draft = null; fitPage(); localStorage.setItem('pm-last', id); }
$('#projBtn').onclick = async () => { closeMoreMenu(); const all = await idb('readonly', s => s.getAll()); all.sort((a, b) => b.updated - a.updated); syncRecentFrom(all);
  $('#projList').innerHTML = all.map(p => `<div class="proj"><div class="pinfo"><b>${esc(p.name)}</b><small>${esc(fmtWhen(p.updated))}, ${p.items.length} item${p.items.length === 1 ? '' : 's'}${p.fileName ? ', ' + esc(p.fileName) : ''}</small></div><button type="button" class="btn small" data-open="${esc(p.id)}">Open</button><button type="button" class="btn danger small" data-del="${esc(p.id)}" title="Delete project" aria-label="Delete ${esc(p.name)}">${svgIc('trash')}</button></div>`).join('') || '<p class="proj-empty">No saved projects yet. Open a plan and it is saved here automatically.</p>';
  if (!$('#projDlg').open) $('#projDlg').showModal(); };
$('#projList').addEventListener('click', async e => { const ob = e.target.closest('[data-open]'), delB = e.target.closest('[data-del]');
  if (ob) { $('#projDlg').close(); await openGuarded(ob.dataset.open); }
  if (delB) { const id = delB.dataset.del, name = delB.closest('.proj').querySelector('b').textContent;
    if (await ask({ title: 'Delete this project?', message: '"' + name + '" and its markups will be removed from this browser. This cannot be undone.', ok: 'Delete project', danger: true })) { await idb('readwrite', s => s.delete(id)); forgetRecent(id); renderRecent(); $('#projBtn').click(); } } });

setTool('select');
// Start-up: never auto-open big or CAD projects (parsing a large DWG blocks the page on phones for a long time and looked like a frozen app).
// Small projects reopen automatically unless the previous attempt did not finish (crash guard); otherwise offer a Continue button.
(async () => { const last = localStorage.getItem('pm-last'); renderRecent(); if (!last) return; let r = null; try { r = await idb('readonly', s => s.get(last)); } catch (e) { } if (!r) { forgetRecent(last); renderRecent(); return; }
  if (!recentList().some(x => x.id === r.id)) rememberRecent(r, r.updated);
  const size = r.bytes ? (r.bytes.byteLength || r.bytes.length || 0) : 0, heavy = r.fileType === 'cad' || /\.(dwg|dxf)$/i.test(r.fileName || '') || size > 8e6, crashed = localStorage.getItem('pm-opening') === last;
  const btn = $('#resumeBtn'); if (btn) { btn.hidden = false; const lab = 'Continue ' + (r.name || r.fileName || 'last project'), t = btn.querySelector('.t'); if (t) t.textContent = lab; else btn.textContent = lab; btn.title = lab; btn.onclick = () => openGuarded(last); }
  renderRecent(); void heavy; void crashed; /* never auto-reopen: the user taps Continue */ })();
async function waitFirstPaint(ms) {
  // Prefer awaiting the in-flight base paint; never declare open done on a blank canvas.
  // Phone heavy PDFs can take well over 2.5s — keep waiting (up to ms) and kick renderBase if idle.
  const budget = Math.max(ms || 2500, isPhoneDev ? 12000 : 5000);
  const t0 = performance.now();
  while (performance.now() - t0 < budget) {
    if (!doc) return false;
    const key = viewKey();
    if (base && base._ok && base._key === key) return true;
    if (!baseJob || baseJob.key !== key) {
      try { await renderBase(key); } catch (e) { console.warn('waitFirstPaint render', e); }
      if (base && base._ok && base._key === key) return true;
    } else {
      try { await baseJob.promise; } catch (e) { }
      if (base && base._ok && base._key === key) return true;
    }
    await new Promise(r => setTimeout(r, 80));
  }
  return !!(doc && base && base._ok && base._key === viewKey());
}
async function openGuarded(id) {
  localStorage.setItem('pm-opening', id); toast('Opening...', 60000); await new Promise(r => setTimeout(r, 50));
  openBusy = true;
  try {
    await openProject(id);
    const painted = await waitFirstPaint(isPhoneDev ? 15000 : 6000);
    toast(painted ? ('Opened ' + (proj && proj.name || 'project')) : ('Opened — still drawing the plan…'));
  } catch (e) { toast('Could not open the project: ' + e.message, 5000); }
  finally {
    openBusy = false; localStorage.removeItem('pm-opening');
    if (base && base._ok) scheduleWarmGeom(800, true);
    else scheduleRender(200);
  }
}
// test hook
window.PM = { undo: () => undo(), redo: () => redo(), get hist() { return { u: H.u.length, r: H.r.length }; }, get draft() { return draft; }, get proj() { return proj; }, get doc() { return doc; }, measure, buildCSV, buildPDF, setTool, gotoPage, applyScale, get zoom() { return zoom; } };
$('#calVal').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#calDlg').close('ok'); } });
// ---- icons: inject the inline SVG named by data-icon, wrap the label in .t ----
document.querySelectorAll('[data-icon]').forEach(b => { const txt = [...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
  [...b.childNodes].filter(n => n.nodeType === 3).forEach(n => n.remove());
  b.insertAdjacentHTML('afterbegin', svgIc(b.dataset.icon) + (txt ? `<span class="t">${esc(txt)}</span>` : '')); });
// icon-only buttons get their accessible name from the tooltip
document.querySelectorAll('button[title]').forEach(b => { if (!b.querySelector('.t') && !b.textContent.trim() && !b.hasAttribute('aria-label')) b.setAttribute('aria-label', b.title.replace(/\s*\(.*\)$/, '')); });
function togglePanel(force) { document.body.classList.toggle('noside', force); localStorage.setItem('pm-noside', document.body.classList.contains('noside') ? 1 : ''); $('#panelBtn').setAttribute('aria-pressed', String(!document.body.classList.contains('noside'))); if (doc) fitPage(); }
$('#panelBtn').onclick = () => togglePanel(); $('#panelClose').onclick = () => togglePanel(true);
if (localStorage.getItem('pm-noside')) document.body.classList.add('noside'); $('#panelBtn').setAttribute('aria-pressed', String(!document.body.classList.contains('noside')));
// ---- phone layout ----
$('#file2').addEventListener('change', onFile);
const phoneMQ = matchMedia('(max-width: 700px)');
const drawEls = ['.opt:nth-of-type(1)', '.opt:nth-of-type(2)'];
// Phone: tool options sit in the bar above the tools, sheet/scale controls in the top bar.
// Desktop: options in the bar above the plan, sheet/zoom/scale/units in the status strip below it.
function placeDrawControls() {
  const opts = [...document.querySelectorAll('.opt')], fin = $('#finishBtn'), und = $('#undoPt'), view = $('#viewCtl');
  if (phoneMQ.matches) { opts.forEach(n => $('#drawSlot').appendChild(n)); [und, fin, $('#calSetBtn')].forEach(n => $('#drawEnd').appendChild(n)); $('#bar').insertBefore(view, $('#moreBtn')); }
  else { opts.forEach(n => $('#optOpts').appendChild(n)); [und, fin].forEach(n => $('#optEnd').appendChild(n)); $('.opt.calbar').appendChild($('#calSetBtn')); $('#status').insertBefore(view, $('#status').firstChild); }
  updateDrawBar(); if (doc) fitPage();
}
function updateDrawBar() {
  const drawing = ['line', 'poly', 'area', 'count', 'text', 'calibrate', 'sleeve', 'origin'].includes(tool);
  document.body.classList.toggle('drawing', drawing);
  document.body.classList.toggle('multi', tool === 'poly' || tool === 'area');
  document.body.classList.toggle('hasdraft', !!draft);
  document.body.classList.toggle('cal', tool === 'calibrate');
  document.body.dataset.tool = tool; syncToolUI();
}
phoneMQ.addEventListener('change', placeDrawControls);
const _draw = draw; draw = function () { _draw(); updateDrawBar(); updateSheet(); };
$('#cancelBtn').onclick = () => { if (draft) { draft = null; hover = null; draw(); } else setTool('select'); };
function closeMoreMenu() { $('#moreMenu').hidden = true; $('#moreBackdrop').hidden = true; document.body.classList.remove('menuopen'); $('#moreBtn').setAttribute('aria-expanded', 'false'); }
function openMoreMenu() { closeExportMenu(); $('#redoMenu').disabled = $('#redoBtn').disabled; $('#units2').value = $('#units').value; $('#moreMenu').hidden = false; $('#moreBackdrop').hidden = false; document.body.classList.add('menuopen'); $('#moreMenu .mscroll').scrollTop = 0; $('#moreBtn').setAttribute('aria-expanded', 'true'); }
$('#moreBtn').onclick = e => { e.stopPropagation(); if ($('#moreMenu').hidden) openMoreMenu(); else closeMoreMenu(); };
$('#moreBackdrop').onclick = () => closeMoreMenu();
document.addEventListener('click', e => { if (!$('#moreMenu').hidden && !e.target.closest('#moreMenu,#moreBtn,#moreBackdrop')) closeMoreMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#moreMenu').hidden) { e.preventDefault(); closeMoreMenu(); } });
$('#moreMenu').addEventListener('click', e => { const b = e.target.closest('[data-proxy]'); if (!b) return; closeMoreMenu(); $(b.dataset.proxy).click(); });
$('#moreMenu').addEventListener('touchmove', e => { if (!e.target.closest('.mscroll')) e.preventDefault(); }, { passive: false });
$('#units2').addEventListener('change', e => { $('#units').value = e.target.value; $('#units').dispatchEvent(new Event('change')); });
$('#scaleInfo').onclick = () => $('#scaleBtn').click();
$('#sheetHandle').onclick = () => { document.body.classList.toggle('sheetopen'); updateSheet(); placeSelBar(); };
function updateSheet() { if (!proj) return; const g = groups(); $('#units2').value = proj.units;
  $('#sheetSum').textContent = g.length ? g.slice(0, 3).map(x => (x.label || TYPE_NAMES[x.type]) + ' ' + fmtGroup(x)).join(', ') + (g.length > 3 ? ' and ' + (g.length - 3) + ' more' : '') : 'Takeoff: nothing measured yet';
  $('.chev').textContent = document.body.classList.contains('sheetopen') ? 'Hide' : 'Show'; }
document.addEventListener('gesturestart', e => e.preventDefault());
placeDrawControls(); layout();
// ---- magnifier loupe + nudge ----
const PLACE = ['calibrate', 'line', 'poly', 'area'];
let calSel = 0, loupeOn = localStorage.getItem('pm-loupe') !== '0', loupeTask = null, loupeBusy = false, loupeWant = null;
const LSZ = 140, lc = $('#loupe');
function placeSnap(p, e) { return aim(p, e, draft && draft.pts.length ? draft.pts[draft.pts.length - 1] : null); }
function toggleLoupe() { loupeOn = !loupeOn; localStorage.setItem('pm-loupe', loupeOn ? '1' : '0'); $('#loupeBtn').classList.toggle('on', loupeOn); $('#loupeBtn').setAttribute('aria-pressed', String(loupeOn)); if (!loupeOn) hideLoupe(); toast('Magnifier ' + (loupeOn ? 'on' : 'off')); }
$('#loupeBtn').classList.toggle('on', loupeOn); $('#loupeBtn').setAttribute('aria-pressed', String(loupeOn)); $('#loupeBtn').onclick = toggleLoupe;
function hideLoupe() { lc.style.display = 'none'; loupeWant = null; }
function showLoupe(p, e) {
  if (!loupeOn || !doc || !p) return hideLoupe();
  const dpr = window.devicePixelRatio || 1, L = Math.round(LSZ * dpr);
  if (lc.width !== L) { lc.width = L; lc.height = L; }
  const touch = e.pointerType && e.pointerType !== 'mouse';
  const lifting = touch && (gesture && gesture.moved || e._aimLift);
  const aim = touch ? aimScreenPt(e, !!lifting) : { x: e.clientX, y: e.clientY, fingerY: e.clientY, lift: false };
  // Loupe sits above the aim (or finger); when lifting, stay clear of the fingertip
  let x = touch ? aim.x - LSZ / 2 : e.clientX + 24, y = touch ? aim.y - LSZ - (aim.lift ? 16 : 60) : e.clientY - LSZ - 24;
  if (y < 4) y = Math.min(innerHeight - LSZ - 4, (touch ? aim.fingerY : e.clientY) + 24);
  if (touch && aim.lift && y + LSZ > aim.fingerY - 8) y = Math.max(4, aim.fingerY - LSZ - 12);
  x = Math.max(4, Math.min(innerWidth - LSZ - 4, x));
  if (!touch && x < e.clientX && x + LSZ > e.clientX && y < e.clientY && y + LSZ > e.clientY) x = e.clientX - LSZ - 24;
  lc.style.left = x + 'px'; lc.style.top = y + 'px'; lc.style.display = 'block';
  const mag = +$('#loupeMag').value, S = zoom * mag * dpr; // device px per page unit inside loupe
  const ctx = lc.getContext('2d');
  // instant preview from what is already drawn: the detail layer where it covers the loupe, otherwise the base
  const half = L / 2 / S, key = viewKey(), useDetail = !!(canvas._on && canvas._key === key && canvas._reg && covers(canvas._reg, { x0: p[0] - half, y0: p[1] - half, w: 2 * half, h: 2 * half }));
  const src = useDetail ? canvas : base, g0 = useDetail ? canvas._reg : { x0: 0, y0: 0, w: doc.sizes[page].w }, k = src.width / g0.w;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, L, L);
  if (src.width && (useDetail || base._key === key)) ctx.drawImage(src, (p[0] - g0.x0 - half) * k, (p[1] - g0.y0 - half) * k, 2 * half * k, 2 * half * k, 0, 0, L, L);
  loupeOverlay(ctx, p, S, L);
  // the sharp version waits until the finger rests: on a heavy plan each one redraws the whole page
  loupeWant = { p: p.slice(), S, L, pg: page }; lc.dataset.sharp = ''; clearTimeout(sharpLoupe.t); sharpLoupe.t = setTimeout(sharpLoupe, 120);
}
const loupeBuf = document.createElement('canvas'); loupeBuf.width = loupeBuf.height = 0;
async function sharpLoupe() {
  if (loupeBusy || !loupeWant) return; const w = loupeWant; loupeBusy = true;
  try {
    const off = loupeBuf; if (off.width !== w.L || off.height !== w.L) { off.width = w.L; off.height = w.L; } const oc = off.getContext('2d'); oc.fillStyle = '#fff'; oc.fillRect(0, 0, w.L, w.L);
    if (doc.type === 'pdf') { const pg = await doc.pdf.getPage(w.pg); const vp = pg.getViewport({ scale: w.S, offsetX: -(w.p[0] * w.S - w.L / 2), offsetY: -(w.p[1] * w.S - w.L / 2) });
      await pg.render({ canvasContext: oc, viewport: vp }).promise; }
    else if (doc.type === 'cad') { CAD.draw(oc, doc.cad, w.S, -(w.p[0] * w.S - w.L / 2), -(w.p[1] * w.S - w.L / 2), proj.hidden || {}); }
    else { const h = w.L / 2 / w.S; oc.imageSmoothingEnabled = false; oc.drawImage(doc.img, w.p[0] - h, w.p[1] - h, 2 * h, 2 * h, 0, 0, w.L, w.L); }
    if (loupeWant && lc.style.display !== 'none' && loupeWant.pg === w.pg) { const cur = loupeWant, ctx = lc.getContext('2d');
      if (cur.p[0] === w.p[0] && cur.p[1] === w.p[1] && cur.S === w.S) { ctx.drawImage(off, 0, 0); loupeOverlay(ctx, w.p, w.S, w.L); lc.dataset.sharp = '1'; } }
  } catch (err) { }
  loupeBusy = false; if (loupeWant && (loupeWant.p[0] !== w.p[0] || loupeWant.p[1] !== w.p[1] || loupeWant.S !== w.S)) { lc.dataset.sharp = ''; clearTimeout(sharpLoupe.t); sharpLoupe.t = setTimeout(sharpLoupe, 120); }
}
function loupeOverlay(ctx, p, S, L) {
  const T = q => [(q[0] - p[0]) * S + L / 2, (q[1] - p[1]) * S + L / 2], dpr = window.devicePixelRatio || 1;
  if (draft && draft.pts.length) { ctx.strokeStyle = draft.color; ctx.lineWidth = 1.5 * dpr; ctx.beginPath(); draft.pts.forEach((q, i) => { const [x, y] = T(q); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); if (!(draft.type === 'calibrate' && draft.pts.length === 2) && hover) { const [x, y] = T(hover); ctx.lineTo(x, y); } ctx.stroke();
    draft.pts.forEach((q, i) => { const [x, y] = T(q); ctx.beginPath(); ctx.arc(x, y, (i === calSel ? 5 : 3) * dpr, 0, 7); ctx.strokeStyle = i === calSel ? '#ffb300' : draft.color; ctx.stroke(); }); }
  if (guide) { ctx.save(); ctx.setLineDash([5 * dpr, 4 * dpr]); ctx.strokeStyle = '#2962ff'; ctx.lineWidth = 1.2 * dpr; for (const [a, b] of guideLines(guide, L / S)) { const A = T(a), B = T(b); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); } ctx.restore(); }
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
vpEl.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !gesture) hideLoupe(); });
const _udb = updateDrawBar; updateDrawBar = function () { _udb(); const adj = !!draft && draft.pts.length > 0 && PLACE.includes(tool);
  document.body.classList.toggle('adj', adj); document.body.classList.toggle('caladj', !!draft && draft.type === 'calibrate' && draft.pts.length === 2);
  document.body.classList.toggle('placing', PLACE.includes(tool)); document.body.classList.toggle('aimtool', PLACE.includes(tool) || ['count', 'sleeve', 'origin'].includes(tool)); document.body.classList.toggle('sleevetool', tool === 'sleeve'); $('#ptSel').textContent = 'Point ' + (Math.min(calSel, draft ? draft.pts.length - 1 : 0) + 1); try { syncToWallUi(); } catch (e) { } };
const _setTool = setTool; setTool = function (t) { hideLoupe(); snapHit = null; _setTool(t); };
document.querySelectorAll('.tool').forEach(b => b.onclick = () => setTool(b.dataset.tool));

// ---- undo / redo history (snapshots of items + scales, max 100) ----
const H = { u: [], r: [], cur: null, t: null };
const snap = () => JSON.stringify({ items: proj.items, scales: proj.scales, scaleNames: proj.scaleNames || {}, origins: proj.origins || {}, hidden: proj.hidden || {}, slab: proj.slab || {} });
function resetHist() { H.u = []; H.r = []; H.cur = proj ? snap() : null; clearTimeout(H.t); H.t = null; updHistBtns(); }
function commitHist() { clearTimeout(H.t); H.t = null; if (!proj) return; const s = snap(); if (H.cur !== null && s !== H.cur) { H.u.push(H.cur); if (H.u.length > 100) H.u.shift(); H.r = []; } H.cur = s; updHistBtns(); }
function commitSoon() { clearTimeout(H.t); H.t = setTimeout(commitHist, 400); updHistBtns(); }
function restore(s) { const o = JSON.parse(s); proj.items = o.items; proj.scales = o.scales; proj.scaleNames = o.scaleNames; proj.origins = o.origins || {}; proj.slab = o.slab || {}; const hidChanged = JSON.stringify(proj.hidden || {}) !== JSON.stringify(o.hidden || {}); proj.hidden = o.hidden || {}; if (hidChanged) { layersChanged(); renderLayers(); } H.cur = s;
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
$('#snapBtn').classList.toggle('on', snapOn); $('#snapBtn').setAttribute('aria-pressed', String(snapOn));
function toggleSnap() { snapOn = !snapOn; localStorage.setItem('pm-snap', snapOn ? '1' : '0'); $('#snapBtn').classList.toggle('on', snapOn); $('#snapBtn').setAttribute('aria-pressed', String(snapOn)); snapHit = null; showSnapMark(); toast('Snap ' + (snapOn ? 'on' : 'off')); }
$('#snapBtn').onclick = toggleSnap;
document.addEventListener('keydown', e => { if (e.target.matches('input,textarea,select') || document.querySelector('dialog[open]')) return; if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey && !e.altKey) toggleSnap(); });
const CELL = 24;
function gridAdd(grid, i, x1, y1, x2, y2) {
  const cx1 = Math.floor(Math.min(x1, x2) / CELL), cx2 = Math.floor(Math.max(x1, x2) / CELL), cy1 = Math.floor(Math.min(y1, y2) / CELL), cy2 = Math.floor(Math.max(y1, y2) / CELL);
  const len = Math.hypot(x2 - x1, y2 - y1), steps = Math.max(1, Math.ceil(len / (CELL / 2)));
  if ((cx2 - cx1 + 1) * (cy2 - cy1 + 1) <= 4) { for (let cx = cx1; cx <= cx2; cx++) for (let cy = cy1; cy <= cy2; cy++) { const k = cx + ',' + cy; let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(i); } return; }
  const seen = new Set(); for (let s = 0; s <= steps; s++) { const t = s / steps, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const k = (Math.floor(x / CELL) + dx) + ',' + (Math.floor(y / CELL) + dy); if (seen.has(k)) continue; seen.add(k); let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(i); } }
}
function extractAxisSegs(pix) {
  // Scan axis-aligned dark runs, allowing small gaps so dashed/broken walls become one segment.
  const { width: W, height: Hh, data } = pix, dark = (x, y) => x >= 0 && y >= 0 && x < W && y < Hh && (data[(y * W + x) * 4] * .3 + data[(y * W + x) * 4 + 1] * .59 + data[(y * W + x) * 4 + 2] * .11) < 110;
  const gap = Math.max(20, Math.round(0.025 * Math.min(W, Hh))); // allow typical dashed-line gaps
  const minL = Math.max(18, 0.02 * Math.min(W, Hh)), segs = [], step = 2;
  for (let y = 0; y < Hh; y += step) {
    let x = 0; while (x < W) {
      while (x < W && !dark(x, y)) x++; if (x >= W) break; const x0 = x; let last = x;
      while (x < W) { if (dark(x, y)) { last = x; x++; continue; } let g = 0; while (x + g < W && g < gap && !dark(x + g, y)) g++; if (g >= gap || x + g >= W) break; x += g; }
      x = last + 1; if (last - x0 + 1 >= minL) segs.push([x0 + 0.5, y + 0.5, last + 0.5, y + 0.5]); } }
  for (let x = 0; x < W; x += step) {
    let y = 0; while (y < Hh) {
      while (y < Hh && !dark(x, y)) y++; if (y >= Hh) break; const y0 = y; let last = y;
      while (y < Hh) { if (dark(x, y)) { last = y; y++; continue; } let g = 0; while (y + g < Hh && g < gap && !dark(x, y + g)) g++; if (g >= gap || y + g >= Hh) break; y += g; }
      y = last + 1; if (last - y0 + 1 >= minL) segs.push([x + 0.5, y0 + 0.5, x + 0.5, last + 0.5]); } }
  return mergeCollinearSegs(segs, Math.max(gap * 2, 12), 2);
}
function mergeCollinearSegs(segs, gapTol, axisTol) {
  // Merge nearly-collinear axis-aligned pieces across gaps into longer virtual walls.
  const H = [], V = [];
  for (const s of segs) {
    const dx = Math.abs(s[2] - s[0]), dy = Math.abs(s[3] - s[1]);
    if (dx >= dy) H.push([Math.min(s[0], s[2]), (s[1] + s[3]) / 2, Math.max(s[0], s[2]), (s[1] + s[3]) / 2]);
    else V.push([(s[0] + s[2]) / 2, Math.min(s[1], s[3]), (s[0] + s[2]) / 2, Math.max(s[1], s[3])]);
  }
  const merge = (arr, horiz) => {
    arr.sort((a, b) => horiz ? (a[1] - b[1] || a[0] - b[0]) : (a[0] - b[0] || a[1] - b[1]));
    const out = [];
    for (const s of arr) {
      const last = out[out.length - 1];
      if (last && Math.abs((horiz ? last[1] - s[1] : last[0] - s[0])) <= axisTol) {
        const a0 = horiz ? last[0] : last[1], a1 = horiz ? last[2] : last[3];
        const b0 = horiz ? s[0] : s[1], b1 = horiz ? s[2] : s[3];
        if (b0 <= a1 + gapTol && b1 >= a0 - gapTol) {
          if (horiz) { last[0] = Math.min(a0, b0); last[2] = Math.max(a1, b1); last[1] = last[3] = (last[1] + s[1]) / 2; }
          else { last[1] = Math.min(a0, b0); last[3] = Math.max(a1, b1); last[0] = last[2] = (last[0] + s[0]) / 2; }
          continue;
        }
      }
      out.push(s.slice());
    }
    return out;
  };
  return merge(H, true).concat(merge(V, false));
}
function installWallIndex(G, segs) {
  const merged = mergeCollinearSegs(segs.map(s => s.slice(0, 4)), Math.max(28, 0.03 * Math.min(doc.sizes[page].w, doc.sizes[page].h)), Math.max(3, 0.003 * Math.min(doc.sizes[page].w, doc.sizes[page].h)));
  G.wallPx = new Float64Array(merged.length * 4); G.wallN = merged.length; G.wallGrid = new Map();
  for (let i = 0; i < merged.length; i++) { const o = 4 * i, s = merged[i]; G.wallPx[o] = s[0]; G.wallPx[o + 1] = s[1]; G.wallPx[o + 2] = s[2]; G.wallPx[o + 3] = s[3]; gridAdd(G.wallGrid, i, s[0], s[1], s[2], s[3]); }
}
async function buildGeom(pg) {
  if (geomCache[pg]) return geomCache[pg];
  const G = { segs: [], grid: new Map(), ready: false }, d = doc;
  // A plan that is still loading has no pages yet: return without caching so the next call builds it. Caching here left
  // snapping off for the whole plan when a file was opened while the previous plan's index was still being built.
  if (!d || !d.sizes[pg] || (d.type === 'pdf' && !(d.pdf && d.vps[pg]))) return G;
  geomCache[pg] = G;
  if (d.type === 'cad') { const M = d.cad, hid = (proj && proj.hidden) || {}; G.pts = []; G.pgrid = new Map();
    // typed-array view: G.segs is a small accessor, not a copy of every segment
    const hidL = M.layerNames.map(n => !!hid[n]), ids = []; for (let i = 0; i < M.nSegs; i++) if (!hidL[M.sL[i]]) ids.push(i);
    const sx = M.sx, idx = Uint32Array.from(ids); G.cad = { sx, idx, sK: M.sK, sL: M.sL }; G.segs = new Proxy({ length: idx.length }, { get: (o, k) => k === 'length' ? idx.length : (typeof k === 'string' && /^\d+$/.test(k)) ? (j => [sx[4 * j], sx[4 * j + 1], sx[4 * j + 2], sx[4 * j + 3], M.sK[j], M.sL[j]])(idx[+k]) : undefined });
    const KN = ['end', 'mid', 'center']; G.pts = { get: i => [M.px[2 * i], M.px[2 * i + 1], KN[M.pK[i]]] };
    for (let i = 0; i < M.nPts; i++) if (!hidL[M.pL[i]]) { const k = Math.floor(M.px[2 * i] / CELL) + ',' + Math.floor(M.px[2 * i + 1] / CELL); let c = G.pgrid.get(k); if (!c) G.pgrid.set(k, c = []); c.push(i); }
    for (let i = 0; i < idx.length; i++) { const j = idx[i]; gridAdd(G.grid, i, sx[4 * j], sx[4 * j + 1], sx[4 * j + 2], sx[4 * j + 3]); }
    const raw = []; for (let i = 0; i < idx.length; i++) { const j = idx[i]; if (!M.sK[j]) raw.push([sx[4 * j], sx[4 * j + 1], sx[4 * j + 2], sx[4 * j + 3]]); }
    installWallIndex(G, raw);
    G.ready = true; return G; }
  if (d.type === 'image') { const c = document.createElement('canvas'); c.width = d.sizes[1].w; c.height = d.sizes[1].h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(d.img, 0, 0); G.pix = x.getImageData(0, 0, c.width, c.height); c.width = c.height = 0;
    // Axis-aligned dark runs for perpendicular-to-wall only (keep on-line snap on dark pixels, as before).
    installWallIndex(G, extractAxisSegs(G.pix));
    G.ready = true; return G; }
  // Reuse the operator list pdf.js already holds from drawing the page; asking for it again made the worker parse the
  // whole page a second time and kept a second copy in memory.
  let page, ops;
  try {
    page = await d.pdf.getPage(pg);
    ops = cachedOps(page);
    // On phone, wait for the first paint to populate the operator cache instead of forcing a second full parse
    if (!ops && isPhoneDev) {
      for (let w = 0; w < 50 && !ops; w++) {
        await new Promise(r => setTimeout(r, 100));
        if (doc !== d || openBusy) { if (geomCache[pg] === G) delete geomCache[pg]; return G; }
        ops = cachedOps(page);
      }
    }
    // Phone: never force a second full parse (Safari OOM on big CAD PDFs)
    if (!ops) {
      if (isPhoneDev) { installWallIndex(G, []); G.ready = true; return G; }
      ops = await page.getOperatorList();
    }
  } catch (e) { if (geomCache[pg] === G) delete geomCache[pg]; return G; }
  if (doc !== d) { if (geomCache[pg] === G) delete geomCache[pg]; return G; }
  if (openBusy) { if (geomCache[pg] === G) delete geomCache[pg]; return G; } // open still in progress: retry later
  // iPhone: multi-million-op CAD sheets OOM Safari if we walk the operator list here.
  // Mark ready with empty walls; sleeve anchors come from the already-drawn base bitmap.
  if (isPhoneDev && ops && ops.fnArray.length > 350000) {
    installWallIndex(G, []);
    G.ready = true; return G;
  }
  const vp = d.vps[pg], OPS = pdfjsLib.OPS, U = pdfjsLib.Util;
  // Segments go into one Float64Array (x1 y1 x2 y2 each) rather than an array per segment, and points are transformed
  // without allocating: the old version created two arrays per path point.
  const MAXS = 200000; let sx = new Float64Array(4 * 4096), n = 0, ctm = [1, 0, 0, 1, 0, 0], M = U.transform(vp.transform, ctm); const stack = [];
  const setCtm = m => { ctm = m; M = U.transform(vp.transform, m); };
  const add = (x1, y1, x2, y2) => { if (n >= MAXS || Math.abs(x1 - x2) + Math.abs(y1 - y2) <= 0.05) return;
    if (4 * n + 4 > sx.length) { const b = new Float64Array(Math.min(4 * MAXS, sx.length * 2)); b.set(sx); sx = b; }
    const o = 4 * n++; sx[o] = x1; sx[o + 1] = y1; sx[o + 2] = x2; sx[o + 3] = y2; };
  const GEOM_CHUNK = isPhoneDev ? 8000 : 80000;
  for (let i = 0; i < ops.fnArray.length && n < MAXS; i++) {
    if (i && (i % GEOM_CHUNK) === 0) {
      if (doc !== d || openBusy) { if (geomCache[pg] === G) delete geomCache[pg]; return G; }
      await new Promise(r => setTimeout(r, 0));
    }
    const fn = ops.fnArray[i], args = ops.argsArray[i];
    if (fn === OPS.save) stack.push(ctm); else if (fn === OPS.restore) { if (stack.length) setCtm(stack.pop()); }
    else if (fn === OPS.transform) setCtm(U.transform(ctm, args));
    else if (fn === OPS.paintFormXObjectBegin) { stack.push(ctm); if (args[0]) setCtm(U.transform(ctm, args[0])); }
    else if (fn === OPS.paintFormXObjectEnd) { if (stack.length) setCtm(stack.pop()); }
    else if (fn === OPS.constructPath) { const sub = args[0], co = args[1], [a, b, c, d, e, f] = M; let j = 0, cur = false, cx = 0, cy = 0, st = false, s0x = 0, s0y = 0;
      for (const op of sub) {
        if (op === OPS.moveTo) { const x = co[j], y = co[j + 1]; j += 2; cx = s0x = a * x + c * y + e; cy = s0y = b * x + d * y + f; cur = st = true; }
        else if (op === OPS.lineTo || op === OPS.curveTo || op === OPS.curveTo2 || op === OPS.curveTo3) { // curves snap along their chord, as before
          const k = op === OPS.lineTo ? 0 : op === OPS.curveTo ? 4 : 2, x = co[j + k], y = co[j + k + 1]; j += k + 2;
          const nx = a * x + c * y + e, ny = b * x + d * y + f; if (cur) add(cx, cy, nx, ny); cx = nx; cy = ny; cur = true; }
        else if (op === OPS.rectangle) { const x = co[j], y = co[j + 1], w = co[j + 2], h = co[j + 3]; j += 4;
          const X = (u, v) => a * u + c * v + e, Y = (u, v) => b * u + d * v + f, x1 = X(x, y), y1 = Y(x, y), x2 = X(x + w, y), y2 = Y(x + w, y), x3 = X(x + w, y + h), y3 = Y(x + w, y + h), x4 = X(x, y + h), y4 = Y(x, y + h);
          add(x1, y1, x2, y2); add(x2, y2, x3, y3); add(x3, y3, x4, y4); add(x4, y4, x1, y1); cx = s0x = x1; cy = s0y = y1; cur = st = true; }
        else if (op === OPS.closePath) { if (cur && st) add(cx, cy, s0x, s0y); cur = st; cx = s0x; cy = s0y; }
      } } }
  sx = sx.slice(0, 4 * n); G.px = sx;
  G.segs = new Proxy({ length: n }, { get: (o, k) => k === 'length' ? n : (typeof k === 'string' && /^\d+$/.test(k)) ? [sx[4 * k], sx[4 * k + 1], sx[4 * k + 2], sx[4 * k + 3]] : undefined });
  for (let i = 0; i < n; i++) gridAdd(G.grid, i, sx[4 * i], sx[4 * i + 1], sx[4 * i + 2], sx[4 * i + 3]);
  // Merged axis walls for sleeve→perp (dashed/broken lines become continuous)
  const raw = []; for (let i = 0; i < n; i++) raw.push([sx[4 * i], sx[4 * i + 1], sx[4 * i + 2], sx[4 * i + 3]]);
  installWallIndex(G, raw);
  G.ready = true; return G;
}
function cachedOps(page) { try { for (const st of page._intentStates.values()) { const o = st.operatorList; if (o && o.lastChunk && o.fnArray.length) return o; } } catch (e) { } return null; }
function nearSegs(G, p, r) { const out = new Set(); const c1x = Math.floor((p[0] - r) / CELL), c2x = Math.floor((p[0] + r) / CELL), c1y = Math.floor((p[1] - r) / CELL), c2y = Math.floor((p[1] + r) / CELL);
  for (let cx = c1x; cx <= c2x; cx++) for (let cy = c1y; cy <= c2y; cy++) { const c = G.grid.get(cx + ',' + cy); if (c) c.forEach(i => out.add(i)); } return [...out]; }
function projSeg(p, s) { const dx = s[2] - s[0], dy = s[3] - s[1], L2 = dx * dx + dy * dy; let t = L2 ? ((p[0] - s[0]) * dx + (p[1] - s[1]) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); return [s[0] + t * dx, s[1] + t * dy]; }
function segX(a, b) { const d = (a[2] - a[0]) * (b[3] - b[1]) - (a[3] - a[1]) * (b[2] - b[0]); if (Math.abs(d) < 1e-9) return null;
  const t = ((b[0] - a[0]) * (b[3] - b[1]) - (b[1] - a[1]) * (b[2] - b[0])) / d, u = ((b[0] - a[0]) * (a[3] - a[1]) - (b[1] - a[1]) * (a[2] - a[0])) / d;
  if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) return null; return [a[0] + t * (a[2] - a[0]), a[1] + t * (a[3] - a[1])]; }
function isOrangeCore(r, g, b) {
  // Strong orange / amber seed (Hilti 6", CAD firestop diamond, bow-tie flags)
  return r > 185 && g > 55 && g < 230 && b < 145 && r > g + 25 && (r - b) > 50 && g >= b - 10;
}
function isOrangePx(r, g, b) {
  // Broad orange-ish: cores + anti-aliased fringes (fill or stroke, vector or raster)
  if (r < 150 || b > 170) return false;
  if (r <= g - 5) return false;
  const mn = g < b ? g : b, sat = r - mn;
  return sat > 28 && g > 30 && g < 245 && (r - b) > 30;
}
function dedupePts(pts, tol) {
  // Spatial-hash dedupe — O(n) for the 1000+ orange path centres on a full sleeving sheet
  if (!pts.length) return [];
  const cell = Math.max(tol, 1e-6), grid = new Map(), out = [];
  for (const p of pts) {
    const ix = Math.floor(p[0] / cell), iy = Math.floor(p[1] / cell);
    let hit = false;
    for (let dx = -1; dx <= 1 && !hit; dx++) for (let dy = -1; dy <= 1 && !hit; dy++) {
      const arr = grid.get((ix + dx) + ',' + (iy + dy)); if (!arr) continue;
      for (const q of arr) if (Math.hypot(q[0] - p[0], q[1] - p[1]) < tol) { hit = true; break; }
    }
    if (hit) continue;
    out.push(p);
    const k = ix + ',' + iy; let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(p);
  }
  return out;
}
function isOrangePdfColor(c) {
  // pdf.js setFill/StrokeRGBColor is 0..255; some paths may still be 0..1
  if (!c || c.length < 3) return false;
  let r = +c[0], g = +c[1], b = +c[2];
  if (r <= 1 && g <= 1 && b <= 1) { r *= 255; g *= 255; b *= 255; }
  // Exclude magenta slab hatch (173,20,87) — dense floor fill, not firestop markers
  if (Math.abs(r - 173) < 8 && g < 40 && Math.abs(b - 87) < 20) return false;
  if (Math.abs(r - 204) < 8 && g < 40 && Math.abs(b - 128) < 20) return false;
  // Red-orange CAD markers (229,57,53), amber/gold Hilti (184,160,0), broad orange
  if (r >= 150 && b <= 170 && r > g - 5) {
    const mn = g < b ? g : b, sat = r - mn;
    if (sat > 28 && g > 30 && g < 245 && (r - b) > 30) return true;
  }
  if (r > 160 && g > 120 && g < 200 && b < 60 && r >= g - 5) return true;
  return false;
}
function sleeveGridAdd(grid, i, x, y) { const k = Math.floor(x / CELL) + ',' + Math.floor(y / CELL); let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(i); }
function buildSleeveIndex(G, pts) {
  const pg = (G && G.sleeve && G.sleeve.page) || page;
  const tol = 1e-4 * Math.max(doc.sizes[pg].w, doc.sizes[pg].h);
  const srcKinds = (pts && pts._kinds) || null;
  const uniq = dedupePts(pts, Math.max(tol, 0.5));
  let kinds = null;
  if (srcKinds && srcKinds.length === pts.length) {
    // Map each uniq point to the kind of the first matching source (dedupe keeps first)
    const cell = Math.max(tol, 0.5), g = new Map();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], k = Math.floor(p[0] / cell) + ',' + Math.floor(p[1] / cell);
      let a = g.get(k); if (!a) g.set(k, a = []); a.push(i);
    }
    kinds = [];
    for (const u of uniq) {
      let best = 'anchor', bd = 1e9;
      const ix = Math.floor(u[0] / cell), iy = Math.floor(u[1] / cell);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const a = g.get((ix + dx) + ',' + (iy + dy)); if (!a) continue;
        for (const i of a) {
          const d = Math.hypot(pts[i][0] - u[0], pts[i][1] - u[1]);
          if (d < bd) { bd = d; best = srcKinds[i] || 'anchor'; }
        }
      }
      kinds.push(best);
    }
  } else if (uniq._kinds) kinds = uniq._kinds;
  const n = uniq.length, xy = new Float64Array(n * 2), grid = new Map();
  for (let i = 0; i < n; i++) { xy[2 * i] = uniq[i][0]; xy[2 * i + 1] = uniq[i][1]; sleeveGridAdd(grid, i, uniq[i][0], uniq[i][1]); }
  G.sleeve = { gen: contentGen, page: pg, n, xy, grid, kinds }; return G.sleeve;
}
function collectCadSleevePts() {
  const M = doc.cad, hid = (proj && proj.hidden) || {}, sfx = commonSuffix(M), out = [];
  const vis = L => !hid[M.layerNames[L]];
  for (const s of M.inserts) { if (!vis(s.L)) continue; if (slvMatch(shortName(s.name, sfx)) || slvMatch(M.layerNames[s.L])) out.push([s.x, s.y]); }
  for (const c of M.circles) { if (!vis(c.L)) continue; if (slvMatch(M.layerNames[c.L])) out.push([c.x, c.y]); }
  return out;
}
function clusterOrange(data, W, H, scale, minN, maxN) {
  // Two-threshold flood (core seed → broad expand) so AA gaps don't split a symbol.
  // Then merge nearby blobs (flags + diamond + tiny label) into one anchor whose
  // centre is the largest blob's centroid (the diamond / marker body).
  const seen = new Uint8Array(W * H), raw = [];
  const at = i => { const o = i * 4; return [data[o], data[o + 1], data[o + 2]]; };
  const core = i => { const [r, g, b] = at(i); return isOrangeCore(r, g, b); };
  const soft = i => { const [r, g, b] = at(i); return isOrangePx(r, g, b); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i0 = y * W + x; if (seen[i0] || !core(i0)) continue;
    let q = [i0], qi = 0, n = 0, sx = 0, sy = 0, x0 = x, y0 = y, x1 = x, y1 = y;
    seen[i0] = 1;
    const rowN = new Map(), rowSx = new Map();
    while (qi < q.length && n < maxN * 8) {
      const i = q[qi++], px = i % W, py = (i - px) / W; n++; sx += px; sy += py;
      rowN.set(py, (rowN.get(py) || 0) + 1); rowSx.set(py, (rowSx.get(py) || 0) + px);
      if (px < x0) x0 = px; if (py < y0) y0 = py; if (px > x1) x1 = px; if (py > y1) y1 = py;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; const nx = px + dx, ny = py + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx; if (seen[j] || !soft(j)) continue; seen[j] = 1; q.push(j); } }
    if (n < minN || n > maxN * 8) continue;
    // Densest horizontal band ≈ diamond / square body (flags & labels are thinner)
    const band = Math.max(1, Math.round((y1 - y0 + 1) * 0.18));
    let bestC = -1, cx = sx / n + 0.5, cy = sy / n + 0.5;
    for (let yy = y0; yy <= y1; yy++) {
      let c = 0, sxx = 0;
      for (let dy = -band; dy <= band; dy++) {
        const y2 = yy + dy; if (!rowN.has(y2)) continue;
        c += rowN.get(y2); sxx += rowSx.get(y2);
      }
      if (c > bestC) { bestC = c; cy = yy + 0.5; cx = c ? sxx / c + 0.5 : cx; }
    }
    raw.push({ n, cx, cy, x0, y0, x1, y1 });
  }
  // Merge parts of one symbol (bow-tie flags above diamond, size label beside it)
  const mergePx = Math.max(14, Math.round(22 * Math.min(1, Math.sqrt((W * H) / 1e6))));
  const used = new Uint8Array(raw.length), pts = [];
  for (let i = 0; i < raw.length; i++) {
    if (used[i]) continue;
    const group = [raw[i]]; used[i] = 1;
    let changed = true;
    while (changed) {
      changed = false;
      for (let j = 0; j < raw.length; j++) if (!used[j]) {
        const b = raw[j];
        for (const a of group) {
          const gapX = Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1));
          const gapY = Math.max(0, Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1));
          const near = (gapX <= mergePx && gapY <= mergePx) || Math.hypot(a.cx - b.cx, a.cy - b.cy) <= mergePx * 1.4;
          if (near) { group.push(b); used[j] = 1; changed = true; break; }
        }
      }
    }
    let tot = 0, bx0 = 1e9, by0 = 1e9, bx1 = 0, by1 = 0, best = group[0];
    for (const g of group) {
      tot += g.n; if (g.n > best.n) best = g;
      if (g.x0 < bx0) bx0 = g.x0; if (g.y0 < by0) by0 = g.y0;
      if (g.x1 > bx1) bx1 = g.x1; if (g.y1 > by1) by1 = g.y1;
    }
    const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;
    // Reject long thin orange lines / title-block rules; keep compact markers
    if (tot < minN) continue;
    if (bw > 90 && bh < 8) continue;
    if (bh > 90 && bw < 8) continue;
    if (bw * bh > 12000 && tot < bw * bh * 0.08) continue;
    // Centre on the largest body (diamond / square fill), not the label or flags alone
    pts.push([best.cx * scale, best.cy * scale]);
  }
  return pts;
}
function scanOrangeFromPix(G) {
  if (!G.pix) return [];
  const { width: W, height: Hh, data } = G.pix;
  return clusterOrange(data, W, Hh, 1, 4, 2500);
}
async function scanOrangeFromPdfOps(pg, opsIn) {
  // Colour-independent sleeve/anchor centres from the pdf.js operator list:
  //  - crosshair intersections (short H∩V arms — purple circles, black targets, any colour)
  //  - compact bezier circles / small squares (Hilti) / compact closed diamonds
  //  - repeated Form XObject insert origins (block instances, any colour)
  //  - orange/amber filled markers (CAD firestop diamonds)
  // Runs in idle chunks; never forces a second getOperatorList on phone.
  let page, ops = opsIn;
  try {
    page = await doc.pdf.getPage(pg);
    if (!ops) ops = cachedOps(page);
    if (!ops && !isPhoneDev) ops = await page.getOperatorList();
  } catch (e) { return []; }
  if (!ops || !ops.fnArray || !ops.fnArray.length) return [];
  const vp = doc.vps[pg], OPS = pdfjsLib.OPS, U = pdfjsLib.Util;
  let fill = null, stroke = null, ctm = [1, 0, 0, 1, 0, 0], M = U.transform(vp.transform, ctm);
  const stack = [];
  const setCtm = m => { ctm = m; M = U.transform(vp.transform, m); };
  const xform = (x, y) => { const [a, b, c, d, e, f] = M; return [a * x + c * y + e, b * x + d * y + f]; };
  let pathPts = [], pathCurves = 0, pathLines = 0, pathRects = 0, pathPrev = null, pathClosed = false;
  const raw = []; // coloured compact path centres [x,y,'orange']
  const shortH = [], shortV = []; // [mx,my,L] for crosshair detect
  const geomPts = []; // [x,y,kind]
  const formOrigins = []; // [x,y,sc] Form XObject inserts
  const flushColored = () => {
    if (pathPts.length < 1) { pathPts = []; pathCurves = pathLines = pathRects = 0; pathPrev = null; pathClosed = false; return; }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, sx = 0, sy = 0;
    for (let i = 0; i < pathPts.length; i++) {
      const x = pathPts[i][0], y = pathPts[i][1];
      if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
      sx += x; sy += y;
    }
    const n = pathPts.length, bw = x1 - x0, bh = y1 - y0, span = bw > bh ? bw : bh;
    pathPts = []; pathCurves = pathLines = pathRects = 0; pathPrev = null; pathClosed = false;
    if (span < 0.25 || span > 48) return;
    if ((bw > 28 && bh < 0.8) || (bh > 28 && bw < 0.8)) return;
    raw.push([sx / n, sy / n, 'orange']);
  };
  const flushGeom = () => {
    if (pathPts.length < 1) { pathPts = []; pathCurves = pathLines = pathRects = 0; pathPrev = null; pathClosed = false; return; }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < pathPts.length; i++) {
      const x = pathPts[i][0], y = pathPts[i][1];
      if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
    }
    const bw = x1 - x0, bh = y1 - y0, span = bw > bh ? bw : bh;
    const aspect = Math.max(bw, bh) / Math.max(Math.min(bw, bh), 1e-6);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    // Bezier circle / oval (any colour)
    if (pathCurves >= 3 && pathCurves <= 8 && pathLines <= 2 && span >= 2 && span <= 55 && aspect <= 1.55)
      geomPts.push([cx, cy, 'circle']);
    // Small square / Hilti (rectangle op or closed quad)
    if (pathRects >= 1 && span >= 2 && span <= 40 && aspect <= 1.35)
      geomPts.push([cx, cy, 'square']);
    // Compact closed polygon (diamond / bow-tie / small marker body) — any colour
    else if (pathClosed && pathLines >= 3 && pathLines <= 8 && pathCurves === 0 && pathRects === 0 && span >= 2 && span <= 36 && aspect <= 1.7)
      geomPts.push([cx, cy, 'symbol']);
    pathPts = []; pathCurves = pathLines = pathRects = 0; pathPrev = null; pathClosed = false;
  };
  const noteSeg = (a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    if (L < 3.5 || L > 32) return;
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (ay < 0.28 * L && ax > 0.75 * L) shortH.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, L]);
    else if (ax < 0.28 * L && ay > 0.75 * L) shortV.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, L]);
  };
  const CHUNK = isPhoneDev ? 4000 : 40000;
  for (let i = 0; i < ops.fnArray.length; i++) {
    if (i && (i % CHUNK) === 0) {
      if (openBusy || !doc) return [];
      await new Promise(r => setTimeout(r, 0));
    }
    const fn = ops.fnArray[i], args = ops.argsArray[i];
    if (fn === OPS.save) stack.push({ ctm, fill, stroke });
    else if (fn === OPS.restore) { const s = stack.pop(); if (s) { setCtm(s.ctm); fill = s.fill; stroke = s.stroke; } }
    else if (fn === OPS.transform) setCtm(U.transform(ctm, args));
    else if (fn === OPS.paintFormXObjectBegin) {
      stack.push({ ctm, fill, stroke });
      if (args && args[0]) setCtm(U.transform(ctm, args[0]));
      // Insert origin of a Form XObject = block-instance centre (colour-independent)
      const sc = Math.hypot(M[0], M[1]) + Math.hypot(M[2], M[3]);
      if (sc > 0.08 && sc < 90) formOrigins.push([M[4], M[5], sc]);
    }
    else if (fn === OPS.paintFormXObjectEnd) { const s = stack.pop(); if (s) { setCtm(s.ctm); fill = s.fill; stroke = s.stroke; } }
    else if (fn === OPS.setFillRGBColor) fill = args;
    else if (fn === OPS.setStrokeRGBColor) stroke = args;
    else if (fn === OPS.constructPath) {
      pathPts = []; pathCurves = pathLines = pathRects = 0; pathPrev = null; pathClosed = false;
      const sub = args[0], co = args[1]; let j = 0;
      for (const op of sub) {
        if (op === OPS.moveTo) { pathPrev = xform(co[j], co[j + 1]); pathPts.push(pathPrev); j += 2; }
        else if (op === OPS.lineTo) {
          const q = xform(co[j], co[j + 1]); j += 2; pathPts.push(q); pathLines++;
          if (pathPrev) noteSeg(pathPrev, q); pathPrev = q;
        }
        else if (op === OPS.curveTo) { pathPrev = xform(co[j + 4], co[j + 5]); pathPts.push(pathPrev); j += 6; pathCurves++; }
        else if (op === OPS.curveTo2 || op === OPS.curveTo3) { pathPrev = xform(co[j + 2], co[j + 3]); pathPts.push(pathPrev); j += 4; pathCurves++; }
        else if (op === OPS.rectangle) {
          const x = co[j], y = co[j + 1], w = co[j + 2], h = co[j + 3]; j += 4;
          const p0 = xform(x, y), p1 = xform(x + w, y), p2 = xform(x + w, y + h), p3 = xform(x, y + h);
          pathPts.push(p0, p1, p2, p3); pathRects++; pathPrev = p0; pathClosed = true;
          noteSeg(p0, p1); noteSeg(p1, p2); noteSeg(p2, p3); noteSeg(p3, p0);
        }
        else if (op === OPS.closePath) { pathClosed = true; }
      }
    } else if (fn === OPS.fill || fn === OPS.eoFill) {
      const keep = pathPts.slice(); const pc = pathCurves, pl = pathLines, pr = pathRects, pcl = pathClosed;
      flushGeom();
      pathPts = keep; pathCurves = pc; pathLines = pl; pathRects = pr; pathClosed = pcl;
      if (isOrangePdfColor(fill)) flushColored(); else { pathPts = []; pathCurves = pathLines = pathRects = 0; pathPrev = null; pathClosed = false; }
    } else if (fn === OPS.stroke || fn === OPS.closeStroke) {
      if (fn === OPS.closeStroke) pathClosed = true;
      const keep = pathPts.slice(); const pc = pathCurves, pl = pathLines, pr = pathRects, pcl = pathClosed;
      flushGeom();
      pathPts = keep; pathCurves = pc; pathLines = pl; pathRects = pr; pathClosed = pcl;
      if (isOrangePdfColor(stroke)) flushColored(); else { pathPts = []; pathCurves = pathLines = pathRects = 0; pathPrev = null; pathClosed = false; }
    } else if (fn === OPS.fillStroke || fn === OPS.eoFillStroke || fn === OPS.closeFillStroke || fn === OPS.closeEOFillStroke) {
      if (fn === OPS.closeFillStroke || fn === OPS.closeEOFillStroke) pathClosed = true;
      const keep = pathPts.slice(); const pc = pathCurves, pl = pathLines, pr = pathRects, pcl = pathClosed;
      flushGeom();
      pathPts = keep; pathCurves = pc; pathLines = pl; pathRects = pr; pathClosed = pcl;
      if (isOrangePdfColor(fill) || isOrangePdfColor(stroke)) flushColored();
      else { pathPts = []; pathCurves = pathLines = pathRects = 0; pathPrev = null; pathClosed = false; }
    } else if (fn === OPS.endPath) { pathPts = []; pathCurves = pathLines = pathRects = 0; pathPrev = null; pathClosed = false; }
  }
  // Crosshair centres: short H∩V with similar arm lengths (colour-independent)
  const cell = 5, vgrid = new Map();
  for (const v of shortV) {
    const k = Math.floor(v[0] / cell) + ',' + Math.floor(v[1] / cell);
    let a = vgrid.get(k); if (!a) vgrid.set(k, a = []); a.push(v);
  }
  const cross = [];
  for (const h of shortH) {
    const ix = Math.floor(h[0] / cell), iy = Math.floor(h[1] / cell);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const a = vgrid.get((ix + dx) + ',' + (iy + dy)); if (!a) continue;
      for (const v of a) {
        const tol = 0.4 * Math.min(h[2], v[2]);
        if (Math.abs(h[0] - v[0]) > tol || Math.abs(h[1] - v[1]) > tol) continue;
        const ratio = h[2] > v[2] ? h[2] / v[2] : v[2] / h[2];
        if (ratio > 2.4) continue;
        cross.push([v[0], h[1], 'crosshair']);
      }
    }
  }
  // Repeated Form XObject inserts: keep when ≥5 similar-scale paints (block instances)
  const formPts = [];
  if (formOrigins.length >= 5) {
    const bySc = new Map();
    for (const f of formOrigins) {
      const sk = Math.round(f[2] * 4) / 4;
      let a = bySc.get(sk); if (!a) bySc.set(sk, a = []); a.push(f);
    }
    for (const arr of bySc.values()) {
      if (arr.length < 5) continue;
      for (const f of arr) formPts.push([f[0], f[1], 'form']);
    }
  }
  const { w, h } = doc.sizes[pg];
  const tol = Math.max(1.2, 5e-4 * Math.max(w, h));
  // Prefer crosshair > circle/square/symbol > form > orange when deduping (first wins)
  const tagged = cross.concat(geomPts, formPts, raw);
  const uniq = dedupePts(tagged.map(p => [p[0], p[1]]), tol);
  // Recover kinds by nearest tagged source
  const kinds = [];
  const tcell = Math.max(tol, 1), tgrid = new Map();
  for (const p of tagged) {
    const k = Math.floor(p[0] / tcell) + ',' + Math.floor(p[1] / tcell);
    let a = tgrid.get(k); if (!a) tgrid.set(k, a = []); a.push(p);
  }
  for (const u of uniq) {
    let best = 'anchor', bd = 1e9;
    const ix = Math.floor(u[0] / tcell), iy = Math.floor(u[1] / tcell);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const a = tgrid.get((ix + dx) + ',' + (iy + dy)); if (!a) continue;
      for (const p of a) {
        const d = Math.hypot(p[0] - u[0], p[1] - u[1]);
        if (d < bd) { bd = d; best = p[2] || 'anchor'; }
      }
    }
    kinds.push(best);
  }
  uniq._kinds = kinds;
  return uniq;
}
async function scanOrangeFromPdfRasterTiled(pg) {
  // Fallback for image-only plans: tile at high res, cluster per tile, release canvases.
  // Never run while the base paint is still in flight — allocating more canvases blanks Safari.
  if (baseJob && !baseJob.dead) return [];
  if (!base._ok) return [];
  const { w, h } = doc.sizes[pg];
  const maxPx = isPhoneDev ? 1.2e6 : 5e6;
  // Target ~2.5–4 CSS px per diamond edge on a dense sheet
  let r = Math.min(2.5, Math.sqrt(maxPx / Math.max(1, (w * h) / 16))); // tile budget ≈ maxPx; 4×4 tiles
  const tilesX = w * r > 1800 ? 4 : (w * r > 900 ? 2 : 1);
  const tilesY = h * r > 1800 ? 4 : (h * r > 900 ? 2 : 1);
  const pts = [];
  for (let ty = 0; ty < tilesY; ty++) for (let tx = 0; tx < tilesX; tx++) {
    await new Promise(res => setTimeout(res, 0));
    const x0 = (w * tx) / tilesX, y0 = (h * ty) / tilesY;
    const tw = w / tilesX, th = h / tilesY;
    const cw = Math.max(1, Math.ceil(tw * r)), ch = Math.max(1, Math.ceil(th * r));
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const job = { dead: false };
    try { await paintRegion(ctx, cw, ch, { x0, y0, w: tw, h: th }, r, job); }
    catch (e) { c.width = c.height = 0; continue; }
    let data;
    try { data = ctx.getImageData(0, 0, cw, ch).data; } catch (e) { c.width = c.height = 0; continue; }
    const local = clusterOrange(data, cw, ch, 1 / r, 3, 2500);
    for (const p of local) pts.push([p[0] + x0, p[1] + y0]);
    c.width = c.height = 0; // release
  }
  return dedupePts(pts, Math.max(2, 8e-4 * Math.max(w, h)));
}
async function scanOrangeFromPdf(pg) {
  // Opening stays free (caller runs after openBusy). Prefer cached operator-list geometry
  // (colour-independent); merge with base orange raster; never skip the vector walk when
  // ops are already cached — chunked yields keep the UI alive on phone.
  try {
    let basePts = [];
    // Reading the full base bitmap can OOM Safari and blank the plan canvas — skip on phone
    // when the buffer is large; vector ops (already cached from the paint) are preferred.
    if (base._ok && base._key === viewKey() && base._r > 0.2) {
      const { width: W, height: Hh } = base;
      const tooBig = isPhoneDev && W * Hh > 1.2e6;
      if (!tooBig) {
        try {
          const ctx = base.getContext('2d');
          const data = ctx.getImageData(0, 0, W, Hh).data;
          basePts = clusterOrange(data, W, Hh, 1 / base._r, 3, 2500);
        } catch (e) { basePts = []; }
      }
    }
    if (openBusy) return basePts;
    let page; try { page = await doc.pdf.getPage(pg); } catch (e) { return basePts; }
    const cached = cachedOps(page);
    let vec = [];
    if (cached) vec = await scanOrangeFromPdfOps(pg, cached);
    else if (!isPhoneDev) vec = await scanOrangeFromPdfOps(pg, null);
    if (vec.length >= 10) {
      if (basePts.length) {
        const merged = vec.concat(basePts);
        const mk = (vec._kinds || vec.map(() => 'anchor')).concat(basePts.map(() => 'raster'));
        const out = dedupePts(merged, Math.max(1.2, 5e-4 * Math.max(doc.sizes[pg].w, doc.sizes[pg].h)));
        // approximate kinds: prefer vector
        out._kinds = out.map(() => 'anchor');
        if (vec._kinds) {
          const cell = 2, g = new Map();
          for (let i = 0; i < vec.length; i++) {
            const p = vec[i], k = Math.floor(p[0] / cell) + ',' + Math.floor(p[1] / cell);
            let a = g.get(k); if (!a) g.set(k, a = []); a.push(i);
          }
          out._kinds = out.map(u => {
            const ix = Math.floor(u[0] / cell), iy = Math.floor(u[1] / cell);
            for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
              const a = g.get((ix + dx) + ',' + (iy + dy)); if (!a) continue;
              for (const i of a) if (Math.hypot(vec[i][0] - u[0], vec[i][1] - u[1]) < 2) return vec._kinds[i];
            }
            return 'raster';
          });
        }
        return out;
      }
      return vec;
    }
    if (basePts.length >= 5) { basePts._kinds = basePts.map(() => 'raster'); return basePts; }
    if (openBusy) return basePts;
    const tiled = await scanOrangeFromPdfRasterTiled(pg);
    const best = tiled.length >= basePts.length ? tiled : basePts;
    best._kinds = best.map(() => 'raster');
    return best;
  } catch (e) { console.warn('scanOrangeFromPdf', e); return []; }
}
async function ensureSleeveSnap(pg) {
  try {
    if (openBusy) return geomCache[pg] || { ready: false };
    const G = await buildGeom(pg); if (!G || !G.ready || openBusy) return G || { ready: false };
    if (G.sleeve && G.sleeve.gen === contentGen && G.sleeve.page === pg && G.sleeve.n >= 0) return G;
    const pts = [];
    const kinds = [];
    if (proj) for (const it of proj.items) if (it.type === 'sleeve' && it.page === pg && it.pts && it.pts[0]) { pts.push(it.pts[0]); kinds.push('markup'); }
    if (doc.type === 'cad') { const c = collectCadSleevePts(); for (const p of c) { pts.push(p); kinds.push('cad'); } }
    else if (doc.type === 'image') { const c = scanOrangeFromPix(G); for (const p of c) { pts.push(p); kinds.push('raster'); } }
    else if (doc.type === 'pdf') {
      const c = await scanOrangeFromPdf(pg);
      const ck = c._kinds || null;
      for (let i = 0; i < c.length; i++) { pts.push(c[i]); kinds.push(ck ? ck[i] : 'anchor'); }
    }
    if (openBusy) return G;
    pts._kinds = kinds;
    buildSleeveIndex(G, pts); return G;
  } catch (e) { console.warn('ensureSleeveSnap', e); return geomCache[pg] || { ready: false }; }
}
function nearSleevePts(G, p, r) {
  if (!G || !G.sleeve || !G.sleeve.n) return [];
  const { xy, grid, n } = G.sleeve, out = [], c1x = Math.floor((p[0] - r) / CELL), c2x = Math.floor((p[0] + r) / CELL), c1y = Math.floor((p[1] - r) / CELL), c2y = Math.floor((p[1] + r) / CELL);
  const seen = new Set();
  for (let cx = c1x; cx <= c2x; cx++) for (let cy = c1y; cy <= c2y; cy++) {
    const cell = grid.get(cx + ',' + cy); if (!cell) continue;
    for (const i of cell) { if (seen.has(i)) continue; seen.add(i); const x = xy[2 * i], y = xy[2 * i + 1]; if (Math.hypot(x - p[0], y - p[1]) <= r) out.push([x, y]); } }
  return out;
}
function isSleeveCentrePt(p, tol) {
  const G = geomCache[page]; if (!G || !G.sleeve) return false; const t = tol != null ? tol : 1.5 / zoom;
  return nearSleevePts(G, p, t).some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < t);
}
function infinitePerp(p, s) {
  const dx = s[2] - s[0], dy = s[3] - s[1], L2 = dx * dx + dy * dy;
  if (!L2) return { foot: [s[0], s[1]], t: 0, onSeg: true, seg: s };
  const t = ((p[0] - s[0]) * dx + (p[1] - s[1]) * dy) / L2;
  const foot = [s[0] + t * dx, s[1] + t * dy];
  return { foot, t, onSeg: t >= -1e-6 && t <= 1 + 1e-6, seg: s };
}
function wallExtPts(s, t) {
  if (t >= 0 && t <= 1) return null;
  const end = t < 0 ? [s[0], s[1]] : [s[2], s[3]];
  const foot = [s[0] + t * (s[2] - s[0]), s[1] + t * (s[3] - s[1])];
  return [end, foot];
}
function minWallLen() { const { w, h } = doc.sizes[page]; return 0.012 * Math.min(w, h); }
function nearWallIds(G, p, r) {
  if (G.wallGrid && G.wallN) {
    const out = new Set(); const c1x = Math.floor((p[0] - r) / CELL), c2x = Math.floor((p[0] + r) / CELL), c1y = Math.floor((p[1] - r) / CELL), c2y = Math.floor((p[1] + r) / CELL);
    for (let cx = c1x; cx <= c2x; cx++) for (let cy = c1y; cy <= c2y; cy++) { const c = G.wallGrid.get(cx + ',' + cy); if (c) c.forEach(i => out.add(i)); }
    return [...out];
  }
  return nearSegs(G, p, r);
}
function wallSegAt(G, i) {
  if (G.wallPx && G.wallN) return [G.wallPx[4 * i], G.wallPx[4 * i + 1], G.wallPx[4 * i + 2], G.wallPx[4 * i + 3]];
  return G.segs[i];
}
function nearestPerpWall(from, toward, searchR) {
  // Closest wall by perpendicular distance from `from`. If `toward` is set, only consider
  // feet in that half-plane (direction of the finger) so the user can choose which wall.
  // Segment is treated as an infinite line: if the foot falls past an end (or in a dash gap
  // of a merged wall), we still return the foot and a faint extension.
  const G = geomCache[page]; if (!G || !G.ready) return null;
  const hasWall = (G.wallN && G.wallN > 0) || (G.segs && G.segs.length); if (!hasWall) return null;
  const R = searchR != null ? searchR : Math.max(doc.sizes[page].w, doc.sizes[page].h);
  // Always gather candidates around the sleeve first; also around the finger for far walls
  const ids = nearWallIds(G, from, R).slice(0, 800);
  if (toward) for (const i of nearWallIds(G, toward, R).slice(0, 400)) if (!ids.includes(i)) ids.push(i);
  const minL = Math.min(minWallLen(), 0.006 * Math.min(doc.sizes[page].w, doc.sizes[page].h));
  const dir = toward ? [toward[0] - from[0], toward[1] - from[1]] : null;
  const dirL = dir ? Math.hypot(dir[0], dir[1]) : 0;
  let best = null, bestAny = null;
  for (const i of ids) {
    const s = wallSegAt(G, i); if (!s || s[4]) continue;
    const len = Math.hypot(s[2] - s[0], s[3] - s[1]); if (len < minL) continue;
    const hit = infinitePerp(from, s); const dLen = dist(from, hit.foot); if (dLen < 1e-6) continue;
    // Prefer walls in the finger's direction cone (~70°): foot must lie mostly along toward
    let along = dLen;
    if (dirL > 1e-6) {
      along = ((hit.foot[0] - from[0]) * dir[0] + (hit.foot[1] - from[1]) * dir[1]) / dirL;
      const cand = { foot: hit.foot, onSeg: hit.onSeg, t: hit.t, seg: s.slice(0, 4), dLen, along, ext: hit.onSeg ? null : wallExtPts(s, hit.t) };
      if (!bestAny || dLen < bestAny.dLen) bestAny = cand;
      // Skip walls whose foot is sideways/backwards relative to the finger
      if (along < dLen * 0.35) continue;
      if (!best || dLen < best.dLen - 1e-6 || (Math.abs(dLen - best.dLen) < 1e-6 && along > best.along)) best = cand;
      continue;
    }
    const cand = { foot: hit.foot, onSeg: hit.onSeg, t: hit.t, seg: s.slice(0, 4), dLen, along, ext: hit.onSeg ? null : wallExtPts(s, hit.t) };
    if (!best || dLen < best.dLen - 1e-6) best = cand;
    if (!bestAny || dLen < bestAny.dLen) bestAny = cand;
  }
  return best || bestAny;
}
let wallExt = null; // { a:[x,y], b:[x,y] } fictional wall continuation while aiming / on item
function findSnap(p, r, exclude, opts) {
  const G = geomCache[page]; let best = null; const consider = (q, kind, pri) => { const d = dist(p, q); if (d <= r && (!best || pri < best.pri || (pri === best.pri && d < best.d))) best = { p: q, kind, pri, d }; };
  opts = opts || {};
  // 1) Sleeve / anchor centres — STRICT priority: if any are in range, they win over
  // every line endpoint / arrowhead / markup, even when those are closer to the aim point.
  if (G && G.sleeve) {
    const near = nearSleevePts(G, p, r);
    if (near.length) {
      // Closest sleeve/anchor centre wins. Only average sub-pixel duplicates of the
      // SAME symbol (tol ~2.5 CSS units) — never blend neighbouring distinct anchors.
      let bq = near[0], bd = dist(p, near[0]);
      for (let i = 1; i < near.length; i++) { const d = dist(p, near[i]); if (d < bd) { bd = d; bq = near[i]; } }
      const mergeTol = 2.5; let sx = 0, sy = 0, n = 0;
      for (const q of near) if (Math.hypot(q[0] - bq[0], q[1] - bq[1]) <= mergeTol) { sx += q[0]; sy += q[1]; n++; }
      const centre = n >= 2 ? [sx / n, sy / n] : bq;
      return { p: centre, kind: 'sleeve', pri: -1, d: dist(p, centre) };
    }
  }
  // 2) Perpendicular foot when measuring from a sleeve centre — always lock (never free in empty space)
  if (opts.perpFrom) {
    const hit = nearestPerpWall(opts.perpFrom, p, Math.max(r * 20, Math.max(doc.sizes[page].w, doc.sizes[page].h)));
    if (hit) {
      consider(hit.foot, hit.onSeg ? 'perp' : 'perp-ext', -2);
      if (best && (best.kind === 'perp' || best.kind === 'perp-ext')) wallExt = hit.ext ? { a: hit.ext[0], b: hit.ext[1] } : null;
    }
  }
  // 3) Markup points
  for (const it of proj.items) if (it.page === page) for (const q of it.pts) if (q !== exclude) consider(q, 'end', 0);
  if (draft) for (const q of draft.pts) if (q !== exclude) consider(q, 'end', 0);
  // 4) Plan geometry: ends / mids / centres / intersections, then lines.
  // Ends/x share pri 0 with markup so the closest target wins; sleeves (pri -1) still beat both.
  if (G && G.ready && G.segs.length) { const ids = nearSegs(G, p, r).slice(0, 400), S = ids.map(i => G.segs[i]);
    for (const s of S) if (!s[4]) { consider([s[0], s[1]], 'end', 0); consider([s[2], s[3]], 'end', 0); }
    if (G.pgrid) { const c1x = Math.floor((p[0] - r) / CELL), c2x = Math.floor((p[0] + r) / CELL), c1y = Math.floor((p[1] - r) / CELL), c2y = Math.floor((p[1] + r) / CELL);
      for (let cx = c1x; cx <= c2x; cx++) for (let cy = c1y; cy <= c2y; cy++) for (const i of (G.pgrid.get(cx + ',' + cy) || [])) { const q = G.pts.get ? G.pts.get(i) : G.pts[i]; consider([q[0], q[1]], q[2], 0); } }
    { const near = S.filter(s => dist(projSeg(p, s), p) <= r).slice(0, 80);
      for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) { const x = segX(near[i], near[j]); if (x) consider(x, 'x', 0); }
      if (!best || best.pri > 0) for (const s of near) consider(projSeg(p, s), 'line', 2); } }
  if (!best && G && G.pix) { // image: nearest dark pixel, refined to centre of the dark stroke
    const { width: W, height: Hh, data } = G.pix, R = Math.ceil(r), x0 = Math.round(p[0]), y0 = Math.round(p[1]); let bd = 1e9, bq = null;
    const dark = (x, y) => x >= 0 && y >= 0 && x < W && y < Hh && (data[(y * W + x) * 4] * .3 + data[(y * W + x) * 4 + 1] * .59 + data[(y * W + x) * 4 + 2] * .11) < 110;
    for (let y = y0 - R; y <= y0 + R; y++) for (let x = x0 - R; x <= x0 + R; x++) if (dark(x, y)) { const d = (x - p[0]) ** 2 + (y - p[1]) ** 2; if (d < bd) { bd = d; bq = [x, y]; } }
    if (bq && Math.sqrt(bd) <= r) {
      const run = (dx, dy) => { let a = 0, b = 0; while (a < 12 && dark(bq[0] - dx * (a + 1), bq[1] - dy * (a + 1))) a++; while (b < 12 && dark(bq[0] + dx * (b + 1), bq[1] + dy * (b + 1))) b++; return [a, b]; };
      const [ha, hb] = run(1, 0), [va, vb] = run(0, 1); let q;
      if (ha + hb <= va + vb) q = [bq[0] + (hb - ha) / 2 + 0.5, p[1]]; else q = [p[0], bq[1] + (vb - va) / 2 + 0.5];
      consider(q, 'line', 2); } }
  return best;
}
function aim(p, e, prev, exclude) {
  let q = p; const ortho = prev && (e.shiftKey || shiftDown);
  if (ortho) q = snapOrtho(prev, q);
  snapHit = null; guide = null; wallExt = null;
  const touchR = e.pointerType && e.pointerType !== 'mouse';
  const st = !ortho && prev && straightOn && !e.altKey && PLACE.includes(tool) && proj ? straighten(p, prev, (touchR ? 14 : 8) / zoom, exclude) : null;
  if (st) q = st.q;
  if (snapOn && !e.altKey && doc && proj) {
    if (!geomCache[page]) buildGeom(page);
    // Generous radius so sleeve centre dots are easy to hit on a phone (dots are ~11 CSS px across)
    const r = (touchR ? 30 : 14) / zoom;
    const fromSleeve = !!(prev && tool === 'line' && isSleeveCentrePt(prev, Math.max(4 / zoom, 1)));
    if (fromSleeve) {
      // Hard lock: second point is always the perpendicular foot in the finger's direction (never empty space)
      const hit = nearestPerpWall(prev, p, Math.max(doc.sizes[page].w, doc.sizes[page].h));
      if (hit) {
        q = hit.foot.slice();
        snapHit = { p: q.slice(), kind: hit.onSeg ? 'perp' : 'perp-ext' };
        wallExt = hit.ext ? { a: hit.ext[0].slice(), b: hit.ext[1].slice() } : null;
      }
    } else {
      const h = findSnap(ortho ? q : p, r, exclude, null);
      if (h) { snapHit = { p: h.p.slice(), kind: h.kind === 'sleeve' ? 'center' : h.kind }; q = h.p.slice();
        wallExt = null;
        if (ortho) { const hz = Math.abs(p[0] - prev[0]) >= Math.abs(p[1] - prev[1]); q = hz ? [h.p[0], prev[1]] : [prev[0], h.p[1]]; snapHit.p = q; }
        else if (st) {
          const k = keepStraight(h, st, prev, r); if (k) { q = k; snapHit.p = k; guide = Object.assign({}, st, { q: k }); } else guide = straightInfo(q, prev, exclude); } }
      else if (st) guide = st;
    }
  } else if (st) guide = st;
  showSnapMark(); syncToWallUi(); return q;
}
function drawSnapMark(ctx, x, y, kind, s, lw) { ctx.save(); ctx.strokeStyle = '#00c853'; ctx.lineWidth = lw; ctx.beginPath();
  if (kind === 'end') ctx.rect(x - s, y - s, 2 * s, 2 * s); else if (kind === 'x') { ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); }
  else if (kind === 'mid') { ctx.moveTo(x, y - s); ctx.lineTo(x + s, y + s); ctx.lineTo(x - s, y + s); ctx.closePath(); } else if (kind === 'center' || kind === 'sleeve') { ctx.arc(x, y, s, 0, 7); }
  else if (kind === 'perp' || kind === 'perp-ext') { ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, s * 0.55, 0, 7); }
  else { ctx.moveTo(x - s, y); ctx.lineTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.closePath(); } ctx.stroke(); ctx.restore(); }
function showSnapMark() { let g = svg.querySelector('#snapG'); if (!g) { g = el('g', { id: 'snapG', 'pointer-events': 'none' }, svg); } g.innerHTML = '';
  drawGuideSvg(g); drawWallExtSvg(g); if (!snapHit) return; const [x, y] = snapHit.p, s = 7 / zoom, w = 2 / zoom, A = { fill: 'none', stroke: '#00c853', 'stroke-width': w };
  const kind = snapHit.kind;
  if (kind === 'end') el('rect', { ...A, x: x - s, y: y - s, width: 2 * s, height: 2 * s }, g);
  else if (kind === 'x') el('path', { ...A, d: `M${x - s} ${y - s}L${x + s} ${y + s}M${x + s} ${y - s}L${x - s} ${y + s}` }, g);
  else if (kind === 'mid') el('path', { ...A, d: `M${x} ${y - s}L${x + s} ${y + s}L${x - s} ${y + s}Z` }, g);
  else if (kind === 'center' || kind === 'sleeve') el('circle', { ...A, cx: x, cy: y, r: s }, g);
  else if (kind === 'perp' || kind === 'perp-ext') { el('path', { ...A, d: `M${x - s} ${y}L${x + s} ${y}M${x} ${y - s}L${x} ${y + s}` }, g); el('circle', { ...A, cx: x, cy: y, r: s * 0.55 }, g); }
  else el('path', { ...A, d: `M${x - s} ${y}L${x} ${y - s}L${x + s} ${y}L${x} ${y + s}Z` }, g);
  g.dataset.kind = kind === 'sleeve' ? 'center' : kind; }
function drawWallExtSvg(g) {
  const ext = (draft && draft.ext) || wallExt; if (!ext) return;
  const a = ext.a || ext[0], b = ext.b || ext[1]; if (!a || !b) return;
  const w = 1.4 / zoom;
  el('path', { fill: 'none', stroke: '#90a4ae', 'stroke-width': w, 'stroke-dasharray': `${5 / zoom} ${4 / zoom}`, 'stroke-opacity': '0.85', d: `M${a[0]} ${a[1]}L${b[0]} ${b[1]}` }, g);
}
function syncToWallUi() {
  const show = !!(tool === 'line' && draft && draft.type === 'line' && draft.pts.length === 1 && isSleeveCentrePt(draft.pts[0], Math.max(4 / zoom, 1)));
  document.body.classList.toggle('towall', show);
  const b = $('#toWallBtn'); if (b) { b.hidden = !show; if (show) b.textContent = 'To wall'; }
}
function applyToWall(toward) {
  if (!(tool === 'line' && draft && draft.pts.length === 1)) return false;
  if (!geomCache[page] || !geomCache[page].ready) { toast('Still preparing the drawing…'); return false; }
  const hit = nearestPerpWall(draft.pts[0], toward || null, Math.max(doc.sizes[page].w, doc.sizes[page].h));
  if (!hit) { toast('No wall or line nearby to measure to.'); return false; }
  draft.pts.push(hit.foot.slice());
  if (hit.ext) draft.ext = [hit.ext[0].slice(), hit.ext[1].slice()];
  wallExt = hit.ext ? { a: hit.ext[0], b: hit.ext[1] } : null;
  finishDraft(); toast('Measured perpendicular to wall' + (hit.onSeg ? '' : ' (extended)'));
  return true;
}
$('#toWallBtn').onclick = () => applyToWall(null);
const _draw3 = draw; draw = function () { _draw3(); if (snapHit && (PLACE.includes(tool) || ['count', 'sleeve', 'origin'].includes(tool) || gesture)) showSnapMark(); };
const _loadDoc = loadDoc; loadDoc = async function (...a) { for (const k in geomCache) delete geomCache[k]; const r = await _loadDoc(...a); return r; };
vpEl.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !gesture) { snapHit = null; showSnapMark(); } });
window.PMsnap = { buildGeom: pg => buildGeom(pg), ensureSleeveSnap: pg => ensureSleeveSnap(pg), findSnap, nearestPerpWall, isSleeveCentrePt, applyToWall, mergeCollinearSegs, get hit() { return snapHit; }, get wallExt() { return wallExt; }, geom: geomCache };
// Snap geometry is built when something uses it: CAD drawings, a page with sleeves, or a measuring tool in hand.
// Building it on every open made heavy PDFs slower to open and is wasted when you only look at the plan.
const snapTool = t => PLACE.includes(t) || ['count', 'sleeve', 'origin'].includes(t);
const geomWanted = () => !!doc && (doc.type === 'cad' || snapTool(tool) || !!(proj && proj.items.some(i => i.page === page && i.type === 'sleeve')));
let warmTimer = null, warmGen = 0;
function scheduleWarmGeom(delay, force) {
  // Never index during open; always defer so the plan paints first.
  // force=true after open so sleeve detection runs even on select tool.
  if (openBusy || !doc) return;
  if (!force && !geomWanted()) return;
  const gen = ++warmGen; clearTimeout(warmTimer);
  warmTimer = setTimeout(() => { idleWarmGeom(gen); }, delay == null ? 400 : delay);
}
function idleWarmGeom(gen) {
  if (gen !== warmGen || openBusy || !doc) return;
  const kick = () => { if (gen !== warmGen || openBusy || !doc) return; warmGeomNow(gen); };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => kick(), { timeout: 1200 });
  else setTimeout(kick, 0);
}
function warmGeomNow(gen) {
  if (gen !== warmGen || openBusy || !doc) return;
  const pg = page, d = doc;
  setSleeveStatus('Finding sleeves…');
  const done = () => { if (gen === warmGen) setSleeveStatus(''); };
  const go = () => ensureSleeveSnap(pg).then(() => { if (gen !== warmGen || doc !== d) return; done(); draw(); }).catch(e => { console.warn('sleeve snap', e); done(); });
  const start = () => { if (gen !== warmGen || doc !== d || openBusy) { done(); return; } if (!geomCache[pg]) buildGeom(pg).then(go).catch(e => { console.warn('buildGeom', e); done(); }); else go(); };
  // One more idle slice so first interaction after open stays smooth
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => start(), { timeout: 2000 });
  else setTimeout(start, 0);
}
const warmGeom = () => scheduleWarmGeom(0);
const _rc = renderCanvas; renderCanvas = async function () { await _rc(); if (!openBusy && geomWanted()) scheduleWarmGeom(500); };
const _setToolG = setTool; setTool = function (t) { _setToolG(t); if (snapTool(t)) scheduleWarmGeom(200); };

// ---- CAD layers panel ----
function layersChanged() { if (!doc || doc.type !== 'cad') return; for (const k in geomCache) delete geomCache[k]; sleeveCache.clear(); contentGen++; renderCanvas(); draw(); }
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
      const NS = G.segs.length, C = G.cad, tmp = [0, 0, 0, 0, 0, 0]; for (let si = 0; si < NS; si++) { let s; if (C) { const j = C.idx[si]; if (C.sK[j]) continue; tmp[0] = C.sx[4 * j]; tmp[1] = C.sx[4 * j + 1]; tmp[2] = C.sx[4 * j + 2]; tmp[3] = C.sx[4 * j + 3]; tmp[4] = 0; tmp[5] = C.sL[j]; s = tmp; } else if (G.px) { const o = 4 * si; tmp[0] = G.px[o]; tmp[1] = G.px[o + 1]; tmp[2] = G.px[o + 2]; tmp[3] = G.px[o + 3]; tmp[4] = 0; tmp[5] = undefined; s = tmp; } else s = G.segs[si]; if (s[4]) continue; const dx = s[2] - s[0], dy = s[3] - s[1], len = Math.hypot(dx, dy); if (len < minLen) continue;
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
  label(grp, x, y - R - 4 / zoom, sleeveName(it) + ' ' + (it.size || '') + (it.label ? ' ' + it.label : '') + sleeveHtLabel(it), c);
  if (it.id === selId) el('rect', { x: x - 6 / zoom, y: y - 6 / zoom, width: 12 / zoom, height: 12 / zoom, fill: 'none', stroke: '#1d5fb4', 'stroke-width': 2 / zoom, 'data-v': 0, class: 'handle' }, grp);
};
const _draw4 = draw; draw = function () { _draw4(); const o = proj && proj.origins && proj.origins[page]; if (!o) return; const g = el('g', { 'pointer-events': 'none' }, svg), s = 14 / zoom, w = 2 / zoom;
  el('path', { d: `M${o[0] - s} ${o[1]}H${o[0] + s}M${o[0]} ${o[1] - s}V${o[1] + s}`, stroke: '#c2185b', 'stroke-width': w }, g); el('circle', { cx: o[0], cy: o[1], r: s / 2, fill: 'none', stroke: '#c2185b', 'stroke-width': w }, g);
  const t = label(g, o[0] + s, o[1] - s / 2, '0,0', '#c2185b'); t.setAttribute('text-anchor', 'start'); };
// sleeve edit: size + note
const _renderList = renderList; renderList = function () { _renderList(); const it = proj && proj.items.find(i => i.id === selId); $('#eSizeRow').hidden = !(it && it.type === 'sleeve'); if (it && it.type === 'sleeve') { $('#eSize').value = it.size || ''; $('#eTextRow').hidden = false; if (document.activeElement !== $('#eText')) $('#eText').value = it.text || ''; } };
$('#eSize').addEventListener('change', e => { const it = selItem(); if (it) { it.size = e.target.value; changed(); } });
// sleeve schedule CSV
function buildSleeveCSV() {
  const u = proj.units, f = v => v == null ? '' : Units.fmtLen(v, u), dec = v => v == null ? '' : u === 'mm' ? (v * 1000).toFixed(1) : (Units.isMet(u) ? v : v / Units.FT).toFixed(4), lu = u === 'mm' ? 'mm' : Units.isMet(u) ? 'm' : 'ft';
  const rows = [['Sleeve schedule', proj.name], ['Origin', Object.keys(proj.origins || {}).length ? 'set (Y up)' : 'not set'], [],
    ['ID', 'Size', 'Label', 'X from origin', 'Y from origin', `X (${lu})`, `Y (${lu})`, 'Offset to nearest vertical line', 'Offset to nearest horizontal line', `Offset X (${lu})`, `Offset Y (${lu})`, 'Ref X layer', 'Ref Y layer', 'Level / page', 'Note', 'Top of slab', 'Slab thickness', 'Top of sleeve', 'Bottom of sleeve', 'Sleeve length', 'Height from']];
  proj.items.filter(i => i.type === 'sleeve').forEach(it => { const i = sleeveInfo(it);
    rows.push([sleeveName(it), it.size || '', it.label || '', f(i.X), f(i.Y), dec(i.X), dec(i.Y), f(i.dx), f(i.dy), dec(i.dx), dec(i.dy), i.rxLayer, i.ryLayer, doc.type === 'cad' ? proj.name : 'Page ' + it.page, it.text || '', ...(h => [fmtEl(h.tos), h.thk != null ? fmtThk(h.thk) : '', fmtEl(h.top), fmtEl(h.bot), h.len != null ? fmtThk(h.len) : '', h.src])(sleeveHeight(it))]); });
  return rows.map(r => r.map(csvCell).join(',')).join('\r\n');
}
$('#sleeveCsvBtn').onclick = () => { if (!proj) return; if (!proj.items.some(i => i.type === 'sleeve')) return toast('No sleeves yet. Use the Sleeve tool.'); download('\ufeff' + buildSleeveCSV(), proj.name + '-sleeves.csv', 'text/csv'); };
Object.assign(window.PM, { buildSleeveCSV, sleeveInfo }); Object.defineProperty(window.PM, 'origins', { get: () => proj.origins });
// ---- Find sleeves (CAD auto-detection) ----
const SLV_KEYS = ['SLEEVE', 'SLV', 'MANCHON', 'PEN', 'PENETRATION', 'CORE', 'CORING', 'FOURREAU', 'HILTI', 'ANCHOR'];
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
  if ((m = s.match(/[ØøΦ⌀]\s*(\d+(?:\.\d+)?)/))) return m[1] + (proj && Units.isMet(proj.units) ? 'mm' : '"');
  return null; }
function sizeFromDia(rPage) { const s = scaleOf(page); if (!s || !rPage) return { size: '', raw: '' }; const dm = 2 * rPage * s, din = dm / Units.IN;
  const raw = Units.isMet(proj.units) ? 'Ø ' + (dm * 1000).toFixed(0) + ' mm' : 'Ø ' + din.toFixed(2) + '"'; let best = NOMINAL_IN[0]; for (const n of NOMINAL_IN) if (Math.abs(n - din) < Math.abs(best - din)) best = n; return { size: inStr(best), raw }; }
function nearText(x, y, R) { let best = null, bd = R; for (const t of doc.cad.texts) { if ((proj.hidden || {})[doc.cad.layerNames[t.L]]) continue; const d = Math.hypot(t.x - x, t.y - y); if (d <= bd) { const sz = parseSize(t.text); if (sz) { bd = d; best = sz; } } } return best; }
// size written in a block name, e.g. "SLV_Round_FLR_4", "Sleeve 3in", "PEN-100mm" (only for unscaled inserts)
function sizeFromName(n) { n = String(n || ''); const p = parseSize(n); if (p) return p; const t = n.split(/[^0-9.\/-]+/).filter(Boolean).pop(); if (!t || !/^\d+(?:\.\d+)?$/.test(t)) return null; const v = +t; return NOMINAL_IN.includes(v) && /[_\s-]\d+(?:\.\d+)?[_\s-]*$/.test(n) ? inStr(v) : null; }
function candSize(c) { // attributes > size in block name > nearby text > diameter
  const dia = sizeFromDia(c.r); let size = null, src = '';
  if (c.attrs) { const pref = c.attrs.slice().sort((a, b) => (/SIZE|DIA|TAILLE|DIAM/i.test(b.tag) ? 1 : 0) - (/SIZE|DIA|TAILLE|DIAM/i.test(a.tag) ? 1 : 0) || (a.def ? 1 : 0) - (b.def ? 1 : 0));
    for (const a of pref) { const s = parseSize(a.value); if (s) { size = s; src = a.def ? 'block default' : 'attribute'; break; } } }
  if (!size && c.kind === 'insert' && Math.abs((c.sc ?? 1) - 1) < 0.01) { const s = sizeFromName(c.name); if (s) { size = s; src = 'block name'; } }
  if (!size) { const R = Math.max(4 * (c.r || 0), 0.015 * Math.min(doc.cad.w, doc.cad.h)); const t = nearText(c.x, c.y, R); if (t) { size = t; src = 'nearby text'; } }
  if (!size && dia.size) { size = dia.size; src = 'diameter'; }
  return { size: size || '?', src: src || 'unknown', raw: dia.raw }; }
// Revit and some exporters append the same view name to every block name (e.g. "... - SLAB SLEEVING LAYOUT"); strip it before keyword matching
function commonSuffix(M) { if (M._sfx != null) return M._sfx; const names = [...new Set(M.inserts.map(s => s.name))]; let best = '';
  if (names.length >= 5) for (const seed of names.slice(0, 20)) for (let L = Math.max(6, best.length + 1); L <= seed.length - 1; L++) { const sx = seed.slice(-L); let n = 0; for (const x of names) if (x.endsWith(sx)) n++; if (n >= 0.6 * names.length) best = sx; else break; }
  return (M._sfx = best); }
function shortName(n, sfx, tidy) { n = String(n || ''); if (sfx && n.endsWith(sfx) && n.length > sfx.length) n = n.slice(0, -sfx.length); if (tidy) n = n.replace(/[-_ ]+V?\d{3,}[-_ ]*$/, '').replace(/[-_ ]+$/, ''); return n; }
function findCandidates(mode, pick) {
  const M = doc.cad, hid = proj.hidden || {}, out = [], vis = L => !hid[M.layerNames[L]];
  const insOK = new Set();
  const sfx = commonSuffix(M); M._sfx = sfx;
  M.inserts.forEach((s, i) => { if (!vis(s.L)) return; const ok = mode === 'pick' ? (pick.kind === 'insert' && s.name === pick.name) : (slvMatch(shortName(s.name, sfx)) || slvMatch(M.layerNames[s.L]));
    if (ok && !s.parents.some(p => insOK.has(p))) { insOK.add(i); out.push({ kind: 'insert', x: s.x, y: s.y, r: s.r, sc: s.sc, name: shortName(s.name, sfx, true), full: s.name, L: s.L, attrs: s.attrs }); } });
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
  for (const c of add) proj.items.push({ id: uid(), type: 'sleeve', page, pts: [[c.x, c.y]], color: $('#color').value, label: '', size: c.size === '?' ? '' : c.size, layer: c.layer, text: [c.name ? 'Block ' + c.name : 'Circle', 'layer ' + c.layer, c.raw].filter(Boolean).join(', '), src: 'auto' });
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

// ---- Sleeve count panel ----
function sleeveCounts() {
  const S = proj ? proj.items.filter(i => i.type === 'sleeve') : [], tally = f => { const m = new Map(); for (const s of S) { const k = f(s); m.set(k, (m.get(k) || 0) + 1); } return [...m.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true })); };
  const layerOf = s => s.layer || ((/layer ([^,]+)/.exec(s.text || '') || [])[1]) || 'Placed by hand';
  const levelOf = s => doc && doc.type === 'cad' ? (proj.name || 'Drawing') : 'Page ' + s.page;
  return { total: S.length, bySize: tally(s => s.size || 'No size'), byLayer: tally(layerOf), byLevel: tally(levelOf) };
}
function renderSleeveCount() {
  const c = sleeveCounts(), isCad = doc && doc.type === 'cad', tbl = (title, head, rows) => `<h4>${title}</h4><table><tr><th>${head}</th><th class="n">Count</th></tr>` + rows.map(([k, n]) => `<tr><td>${esc(String(k))}</td><td class="n">${n}</td></tr>`).join('') + '</table>';
  $('#slvBody').innerHTML = c.total ? `<div class="total" id="slvTotal">${c.total}</div><small>sleeve${c.total > 1 ? 's' : ''} in total</small>` + tbl('By size', 'Size', c.bySize) + tbl('By layer', 'Layer', c.byLayer) + (c.byLevel.length > 1 || !isCad ? tbl('By level / page', 'Level', c.byLevel) : '')
    : `<div class="total" id="slvTotal">0</div><p class="empty">No sleeves placed yet. ${isCad ? 'Use Find sleeves to pick up sleeves drawn in this CAD file, or place them with the Sleeve tool.' : 'Place them with the Sleeve tool.'}</p>`;
  $('#slvFind').hidden = !isCad; $('#slvFind').classList.toggle('primary', isCad && !c.total); $('#slvCsv').disabled = !c.total;
}
function openSleeveCount() { if (!proj) return toast('Open a plan first.'); renderSleeveCount(); const d = $('#slvDlg'); if (!d.open) d.showModal(); }
$('#slvCountBtn').onclick = openSleeveCount; $('#slvCountTool').onclick = openSleeveCount;
$('#slvFind').onclick = () => { $('#slvDlg').close(); startFind('auto'); };
$('#slvCsv').onclick = () => $('#sleeveCsvBtn').click();
Object.assign(window.PM, { sleeveCounts });

// ---- Sleeve heights: slab zones, level default, per-sleeve override, elevations read from text near the sleeve ----
// all values in metres; nothing is computed at load time (only when a sleeve is drawn, listed or exported)
const fmtEl = v => v == null || !isFinite(v) ? '' : Units.isMet(proj.units) ? v.toFixed(3) + ' m' : Units.fmtLen(v, 'imp');
const fmtThk = v => v == null || !isFinite(v) ? '' : Units.isMet(proj.units) ? Math.round(v * 1000) + ' mm' : Units.fmtLen(v, 'imp');
function parseEl(s) { s = String(s == null ? '' : s).trim(); if (!s) return null; if (/^-?\d{1,3},\d{3}$/.test(s)) s = s.replace(',', '.'); // 64,800 = 64.800 m (geodetic, comma style)
  const neg = s.startsWith('-'); const v = Units.parseLength(neg ? s.slice(1) : s, proj.units === 'mm' ? 'met' : proj.units); return isFinite(v) ? (neg ? -v : v) : NaN; }
function parseThk(s) { s = String(s == null ? '' : s).trim(); if (!s) return null; if (Units.isMet(proj.units) && /^\d+(\.\d+)?$/.test(s) && +s >= 20) s += 'mm'; const v = Units.parseLength(s, proj.units); return isFinite(v) ? v : NaN; }
function slabDefault(pg) { proj.slab = proj.slab || {}; return proj.slab[pg] || {}; }
function inPoly(P, x, y) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
function zoneAt(pg, x, y) { let best = null, ba = Infinity; for (const z of proj.items) { if (z.type !== 'area' || !z.slab || z.page !== pg || z.pts.length < 3 || !inPoly(z.pts, x, y)) continue; const a = polyArea(z.pts); if (a < ba) { ba = a; best = z; } } return best; }
const EL_RE = /(?:T\/O\s*(?:SLAB|CONC(?:RETE)?)?|T\/SLAB|TOS|TOP OF SLAB|ELEV\.?|EL\.?)\s*[:=]?\s*([+-]?\d{1,3}(?:[.,]\d{3})|\d+'\s*-?\s*\d+(?:\s+\d\/\d)?"?)/i;
const htText = new Map();
function textElevation(it) { if (!doc || doc.type !== 'cad') return null; const [x, y] = it.pts[0], key = it.page + ':' + x + ',' + y; if (htText.has(key)) return htText.get(key);
  const R = 0.03 * Math.min(doc.cad.w, doc.cad.h), hid = proj.hidden || {}; let best = null, bd = R;
  for (const t of doc.cad.texts) { if (hid[doc.cad.layerNames[t.L]] || !t.text) continue; const d = Math.hypot(t.x - x, t.y - y); if (d > bd) continue; const m = EL_RE.exec(t.text); if (!m) continue; const v = parseEl(m[1]); if (v != null && isFinite(v)) { bd = d; best = v; } }
  htText.set(key, best); return best; }
function sleeveHeight(it) {
  const d = slabDefault(it.page), z = zoneAt(it.page, it.pts[0][0], it.pts[0][1]); let tos = null, src = '';
  if (it.tos != null) { tos = it.tos; src = 'override'; } else { const t = textElevation(it); if (t != null) { tos = t; src = 'text on plan'; } else if (z && z.slab.tos != null) { tos = z.slab.tos; src = 'zone ' + (z.label || 'slab'); } else if (d.tos != null) { tos = d.tos; src = 'level default'; } }
  const thk = it.thk != null ? it.thk : z && z.slab.thk != null ? z.slab.thk : d.thk != null ? d.thk : null, ext = it.ext != null ? it.ext : d.ext || 0;
  const top = tos != null ? tos + ext : null, bot = tos != null && thk != null ? tos - thk : null, len = thk != null ? thk + ext : null;
  return { tos, thk, ext, top, bot, len, src, zone: z }; }
function sleeveHtLabel(it) { if (!proj) return ''; const h = sleeveHeight(it); return h.tos == null ? '' : ' T ' + fmtEl(h.top) + (h.bot != null ? ' B ' + fmtEl(h.bot) : ''); }
// edit panel rows (area: slab zone; sleeve: height + overrides)
(function () {
  const ed = $('#eDel'), mk = html => { const d = document.createElement('div'); d.innerHTML = html; const n = d.firstElementChild; ed.parentNode.insertBefore(n, ed); return n; };
  mk(`<div id="eZoneRow" class="htbox" hidden><label class="chk"><input type="checkbox" id="eZone"> Slab zone (sleeves inside take these values)</label>
    <label>Top of slab <input id="eZTos" type="text" placeholder="e.g. 64.800 or 100'-0&quot;"></label><label>Slab thickness <input id="eZThk" type="text" placeholder="e.g. 250mm or 10&quot;"></label></div>`);
  mk(`<div id="eHtRow" class="htbox" hidden><small id="eHtInfo"></small>
    <label>Top of slab override <input id="eTos" type="text" placeholder="blank = zone or level"></label><label>Thickness override <input id="eThk" type="text" placeholder="blank = zone or level"></label>
    <label>Extension above slab <input id="eExt" type="text" placeholder="blank = level default (0)"></label></div>`);
})();
function fillHt() { const it = proj && proj.items.find(i => i.id === selId); const za = !!(it && it.type === 'area'), sl = !!(it && it.type === 'sleeve'); $('#eZoneRow').hidden = !za; $('#eHtRow').hidden = !sl; const keep = (id, v) => { if (document.activeElement !== $(id)) $(id).value = v; };
  if (za) { $('#eZone').checked = !!it.slab; keep('#eZTos', it.slab && it.slab.tos != null ? fmtEl(it.slab.tos) : ''); keep('#eZThk', it.slab && it.slab.thk != null ? fmtThk(it.slab.thk) : ''); $('#eZTos').disabled = $('#eZThk').disabled = !it.slab; }
  if (sl) { const h = sleeveHeight(it); $('#eHtInfo').textContent = h.tos == null ? 'No slab height yet: set a level default in Sleeve count, draw a slab zone, or type an override.' : `Top of slab ${fmtEl(h.tos)} (${h.src}). Sleeve top ${fmtEl(h.top)}, bottom ${h.bot != null ? fmtEl(h.bot) : '? (no thickness)'}${h.len != null ? ', length ' + fmtThk(h.len) : ''}.`;
    keep('#eTos', it.tos != null ? fmtEl(it.tos) : ''); keep('#eThk', it.thk != null ? fmtThk(it.thk) : ''); keep('#eExt', it.ext != null ? fmtThk(it.ext) : ''); } }
const _renderListH = renderList; renderList = function () { _renderListH(); fillHt(); };
const setNum = (inp, fn, apply) => inp.addEventListener('change', e => { const v = fn(e.target.value); if (Number.isNaN(v)) { toast('Could not read that value. Examples: 64.800, 64,800, 212\'-7", 250mm, 10"'); return; } apply(v); htText.clear(); changed(); });
$('#eZone').addEventListener('change', e => { const it = selItem(); if (!it) return; if (e.target.checked) it.slab = it.slab || { tos: slabDefault(it.page).tos ?? null, thk: slabDefault(it.page).thk ?? null }; else delete it.slab; changed(); });
setNum($('#eZTos'), parseEl, v => { const it = selItem(); if (it && it.slab) it.slab.tos = v; });
setNum($('#eZThk'), parseThk, v => { const it = selItem(); if (it && it.slab) it.slab.thk = v; });
setNum($('#eTos'), parseEl, v => { const it = selItem(); if (it) { if (v == null) delete it.tos; else it.tos = v; } });
setNum($('#eThk'), parseThk, v => { const it = selItem(); if (it) { if (v == null) delete it.thk; else it.thk = v; } });
setNum($('#eExt'), parseThk, v => { const it = selItem(); if (it) { if (v == null) delete it.ext; else it.ext = v; } });
// Slab zone tool: draws an area that is marked as a slab zone
(function () { const b = document.createElement('button'); b.id = 'zoneTool'; b.className = 'tool'; b.title = 'Slab zone: draw an area with its own top of slab and thickness'; b.dataset.icon = 'zone'; b.setAttribute('aria-pressed', 'false'); b.innerHTML = svgIc('zone') + '<span class="t">Slab zone</span>';
  document.querySelector('[data-tool=area]').after(b); })();
let zoneNext = false;
$('#zoneTool').onclick = () => { setTool('area'); zoneNext = true; document.querySelectorAll('.tool').forEach(x => x.classList.toggle('active', x.id === 'zoneTool')); syncToolUI(); toast('Draw the slab zone outline, then Finish. Then enter its top of slab and thickness.', 5000); };
const _setToolZ = setTool; setTool = function (t) { if (zoneNext && t !== 'area') zoneNext = false; _setToolZ(t); };
const _changedZ = changed; changed = function () { if (zoneNext && proj) { const it = proj.items[proj.items.length - 1]; if (it && it.type === 'area' && !it.slab && !it._zchk) { const d = slabDefault(it.page); it.slab = { tos: d.tos ?? null, thk: d.thk ?? null }; it.label = it.label || 'Slab zone'; zoneNext = false; selId = it.id; setTool('select'); renderList(); } } _changedZ(); };
// Sleeve count panel: level defaults + heights
const _renderSC = renderSleeveCount; renderSleeveCount = function () { _renderSC(); if (!proj) return; const d = slabDefault(page), S = proj.items.filter(i => i.type === 'sleeve');
  const box = document.createElement('div'); box.id = 'slabBox';
  const byTos = new Map(); let noH = 0; for (const s of S) { const h = sleeveHeight(s); if (h.tos == null) { noH++; continue; } const k = fmtEl(h.tos) + '|' + (h.bot != null ? fmtEl(h.bot) : '?'); byTos.set(k, (byTos.get(k) || 0) + 1); }
  box.innerHTML = `<h4>Slab (this level / page)</h4><div class="slabin"><label>Top of slab <input id="dTos" type="text" value="${esc(fmtEl(d.tos))}" placeholder="e.g. 64.800"></label><label>Thickness <input id="dThk" type="text" value="${esc(fmtThk(d.thk))}" placeholder="e.g. 250mm"></label><label>Extension above slab <input id="dExt" type="text" value="${esc(d.ext ? fmtThk(d.ext) : '')}" placeholder="0"></label></div>` +
    (S.length ? `<h4>By height</h4><table id="slvHt"><tr><th>Top of slab</th><th>Bottom of sleeve</th><th class="n">Count</th></tr>` + [...byTos.entries()].sort().map(([k, n]) => { const [a, b] = k.split('|'); return `<tr><td>${esc(a)}</td><td>${esc(b)}</td><td class="n">${n}</td></tr>`; }).join('') + (noH ? `<tr><td colspan="2">No height</td><td class="n">${noH}</td></tr>` : '') + '</table>' : '');
  $('#slvBody').appendChild(box);
  const upd = (id, fn, key) => setNum($(id), fn, v => { proj.slab = proj.slab || {}; const o = proj.slab[page] = Object.assign({}, proj.slab[page]); if (v == null) delete o[key]; else o[key] = v; setTimeout(renderSleeveCount, 0); });
  upd('#dTos', parseEl, 'tos'); upd('#dThk', parseThk, 'thk'); upd('#dExt', parseThk, 'ext'); };
Object.assign(window.PM, { sleeveHeight, parseEl, parseThk, setSlabDefault: (pg, o) => { proj.slab = proj.slab || {}; proj.slab[pg] = Object.assign({}, proj.slab[pg], o); htText.clear(); changed(); } });

// re-render the visible region after scrolling settles (bitmap stays in place meanwhile)
vpEl.addEventListener('scroll', () => { if (!doc) return; gestureUntil = Math.max(gestureUntil, performance.now() + 120); scheduleRender(150); }, { passive: true }); // cheap when the view is still covered

// ---- Project file (.pmproj): plan geometry + markups in one compact file. A DWG read on a computer can be opened on a phone without the DWG converter. ----
const TA = { Float64Array, Float32Array, Uint32Array, Uint16Array, Uint8Array };
async function buildPmproj() {
  const bufs = [], put = v => { const off = bufs.reduce((s, b) => s + b.byteLength, 0); const pad = (8 - off % 8) % 8; if (pad) bufs.push(new Uint8Array(pad)); const o = off + pad; bufs.push(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)); return { __ta: v.constructor.name, off: o, len: v.length }; };
  const enc = v => { if (v && ArrayBuffer.isView(v)) return put(v); if (Array.isArray(v)) return v.map(enc); if (v && typeof v === 'object') { const o = {}; for (const k in v) if (k[0] !== '_' && typeof v[k] !== 'function') o[k] = enc(v[k]); return o; } return v; };
  const head = { v: 1, proj: JSON.parse(JSON.stringify(proj)), mime: doc.mime, name: doc.name, cad: doc.type === 'cad' ? enc(doc.cad) : null, bytes: doc.type !== 'cad' && doc.bytes ? put(doc.bytes) : null };
  const hj = new TextEncoder().encode(JSON.stringify(head)), pre = new Uint8Array(12); pre.set(new TextEncoder().encode('PMPROJ1\n')); new DataView(pre.buffer).setUint32(8, hj.length, true);
  let body = new Blob([pre, hj, new Uint8Array((8 - (12 + hj.length) % 8) % 8), ...bufs]);
  if (typeof CompressionStream === 'function') body = await new Response(body.stream().pipeThrough(new CompressionStream('gzip'))).blob();
  return body; }
async function readPmproj(blob) {
  let ab = await blob.arrayBuffer(); let u = new Uint8Array(ab);
  if (u[0] === 0x1f && u[1] === 0x8b) { if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot read compressed project files. Update the browser.'); ab = await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(); u = new Uint8Array(ab); }
  if (new TextDecoder().decode(u.subarray(0, 8)) !== 'PMPROJ1\n') throw new Error('Not a Plan Measure project file');
  const hl = new DataView(ab).getUint32(8, true), head = JSON.parse(new TextDecoder().decode(u.subarray(12, 12 + hl))), base = 12 + hl + (8 - (12 + hl) % 8) % 8;
  const dec = v => { if (v && v.__ta) { const T = TA[v.__ta]; return new T(ab, base + v.off, v.len); } if (Array.isArray(v)) return v.map(dec); if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = dec(v[k]); return o; } return v; };
  return { head, cad: head.cad ? dec(head.cad) : null, bytes: head.bytes ? dec(head.bytes) : null }; }
async function openPmproj(f) {
  toast('Opening project file...', 30000); await new Promise(r => setTimeout(r, 30));
  openBusy = true;
  try { const { head, cad, bytes } = await readPmproj(f); await loadDoc(cad ? { cadPack: cad } : ownBytes(bytes), head.mime, head.name);
    proj = Object.assign({ origins: {}, hidden: {}, slab: {} }, head.proj); migrateProjectUnits(proj); resetHist(); $('#units').value = proj.units; if ($('#units2')) $('#units2').value = proj.units; page = 1; selId = null; draft = null; fitPage(); renderLayers();
    const painted = await waitFirstPaint(isPhoneDev ? 15000 : 6000); persistSoon();
    toast(painted ? ('Opened ' + f.name) : ('Opened ' + f.name + ' — still drawing the plan…')); }
  catch (err) { console.error(err); toast('Could not open the project file: ' + err.message, 8000); }
  finally {
    openBusy = false;
    if (base && base._ok) scheduleWarmGeom(800, true);
    else scheduleRender(200);
  } }
$('#pmprojBtn').onclick = async () => { if (!proj || !doc) return toast('Open a plan first.'); toast('Building project file...', 20000); const b = await buildPmproj(); download(b, (proj.name || 'project') + '.pmproj', 'application/octet-stream'); toast('Saved ' + (b.size / 1e6).toFixed(1) + ' MB project file'); };
Object.assign(window.PM, { buildPmproj });

// ---- Delete: hit test with a generous touch area, floating action bar, list trash/swipe, bulk delete, Undo toast ----
function segD(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy; let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); }
function nearHit(p, tol) { if (!proj) return null; let best = null, bd = tol;
  for (const it of proj.items) { if (it.page !== page || !it.pts || !it.pts.length) continue; const P = it.pts; let d = Infinity;
    if (P.length === 1 || it.type === 'count' || it.type === 'sleeve' || it.type === 'text' || it.type === 'origin') for (const q of P) d = Math.min(d, Math.hypot(q[0] - p[0], q[1] - p[1]));
    else { for (let i = 1; i < P.length; i++) d = Math.min(d, segD(p, P[i - 1], P[i])); if (it.type === 'area') { d = Math.min(d, segD(p, P[P.length - 1], P[0])); if (P.length > 2 && inPoly(P, p[0], p[1])) d = Math.min(d, tol * 0.99); } }
    if (d < bd) { bd = d; best = it.id; } }
  return best; }
function deleteItems(ids, msg) { if (!proj || !ids.length) return; commitHist(); const S = new Set(ids); proj.items = proj.items.filter(i => !S.has(i.id)); if (S.has(selId)) selId = null; commitHist(); draw(); persistSoon(); undoToast(msg || (ids.length + ' items deleted')); }
const undoT = document.createElement('div'); undoT.id = 'undoToast'; undoT.hidden = true; undoT.innerHTML = '<span></span><button type="button" class="btn small" id="undoToastBtn">Undo</button>'; document.body.appendChild(undoT);
function undoToast(msg) { undoT.querySelector('span').textContent = msg; undoT.hidden = false; clearTimeout(undoT._h); undoT._h = setTimeout(() => undoT.hidden = true, 6000); }
$('#undoToastBtn').onclick = () => { undoT.hidden = true; undo(); };
const TRASH = svgIc('trash');
// floating action bar near the selected markup
const selBar = document.createElement('div'); selBar.id = 'selBar'; selBar.hidden = true;
selBar.innerHTML = `<button type="button" class="btn" id="selEdit">${svgIc('edit')}Edit</button><button type="button" class="btn danger" id="selDel">${TRASH}Delete</button>`; document.body.appendChild(selBar);
function placeSelBar() { const it = selItem(); if (!it || (document.body.classList.contains('sheetopen') && matchMedia('(max-width: 800px)').matches) || tool !== 'select' || draft || it.page !== page || !it.pts || !it.pts.length) { selBar.hidden = true; return; }
  const r = svg.getBoundingClientRect(), xs = it.pts.map(q => r.left + q[0] * zoom), ys = it.pts.map(q => r.top + q[1] * zoom), v = vpEl.getBoundingClientRect();
  selBar.hidden = false; const w = selBar.offsetWidth || 190, h = selBar.offsetHeight || 48;
  let x = (Math.min(...xs) + Math.max(...xs)) / 2 - w / 2, y = Math.min(...ys) - h - 18; if (y < v.top + 4) y = Math.max(...ys) + 18;
  x = Math.max(v.left + 4, Math.min(x, v.right - w - 4)); y = Math.max(v.top + 4, Math.min(y, v.bottom - h - 4)); selBar.style.left = x + 'px'; selBar.style.top = y + 'px'; }
$('#selDel').onclick = deleteSel;
$('#selEdit').onclick = () => { if (matchMedia('(max-width: 800px)').matches) { document.body.classList.add('sheetopen'); try { updateSheet(); } catch (e) { } } $('#edit').scrollIntoView({ block: 'nearest' }); };
vpEl.addEventListener('scroll', () => { if (!selBar.hidden) placeSelBar(); }, { passive: true });
// top bar trash button (desktop)
const delBtn = document.createElement('button'); delBtn.id = 'delBtn'; delBtn.className = 'btn icon danger needdoc'; delBtn.title = 'Delete selected (Delete key)'; delBtn.setAttribute('aria-label', 'Delete selected'); delBtn.innerHTML = TRASH; delBtn.hidden = true; $('#redoBtn').after(delBtn); delBtn.onclick = deleteSel;
// list rows: trash button + swipe left on touch
const _renderListD = renderList; renderList = function () { _renderListD(); if (!proj) return; delBtn.hidden = !selItem(); placeSelBar(); };
$('#list').addEventListener('click', e => { const b = e.target.closest('.rdel'); if (!b) return; e.stopPropagation(); const r = b.closest('.row'), it = proj.items.find(i => i.id === r.dataset.id); if (it) deleteItems([it.id], TYPE_NAMES[it.type] + ' deleted'); }, true);
let sw = null;
$('#list').addEventListener('pointerdown', e => { const r = e.target.closest('.row'); if (r && e.pointerType !== 'mouse') sw = { r, x: e.clientX, y: e.clientY }; });
$('#list').addEventListener('pointermove', e => { if (!sw) return; const dx = e.clientX - sw.x; if (Math.abs(e.clientY - sw.y) > 30) { sw.r.style.transform = ''; sw = null; return; } if (dx < 0) sw.r.style.transform = `translateX(${Math.max(dx, -120)}px)`; });
const swEnd = e => { if (!sw) return; const r = sw.r, dx = e.clientX - sw.x; sw = null; r.style.transform = ''; if (dx < -70) { const it = proj.items.find(i => i.id === r.dataset.id); if (it) deleteItems([it.id], TYPE_NAMES[it.type] + ' deleted'); } };
$('#list').addEventListener('pointerup', swEnd); $('#list').addEventListener('pointercancel', () => { if (sw) sw.r.style.transform = ''; sw = null; });
// sleeve panel: delete all sleeves of one size
const _renderSCD = renderSleeveCount; renderSleeveCount = function () { _renderSCD(); const t = document.querySelector('#slvBody table'); if (!t) return;
  t.querySelectorAll('tr').forEach((tr, i) => { if (!i) { tr.appendChild(document.createElement('th')); return; } const k = tr.cells[0].textContent, td = tr.insertCell(); td.innerHTML = `<button type="button" class="rdel" data-size="${esc(k)}" title="Delete these sleeves" aria-label="Delete ${esc(k)} sleeves">${TRASH}</button>`; }); };
$('#slvBody').addEventListener('click', async e => { const b = e.target.closest('.rdel'); if (!b) return; e.preventDefault(); const k = b.dataset.size, ids = proj.items.filter(i => i.type === 'sleeve' && (i.size || 'No size') === k).map(i => i.id);
  if (!ids.length || !(await ask({ title: `Delete ${ids.length} sleeve${ids.length > 1 ? 's' : ''}?`, message: `All sleeves of size ${k} will be removed. You can undo this.`, ok: 'Delete sleeves', danger: true }))) return; deleteItems(ids, ids.length + ' sleeves deleted'); renderSleeveCount(); });
// menu: Clear page / Delete all of a type
(function () { const m = $('#moreDanger') || $('#moreMenu'), mk = (id, txt) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn danger'; b.id = id; b.innerHTML = TRASH + txt; m.appendChild(b); return b; };
  mk('clearPageBtn', 'Clear page').onclick = async () => { if (!proj) return; closeMoreMenu(); const ids = proj.items.filter(i => i.page === page).map(i => i.id); if (!ids.length) return toast('Nothing on this page.'); if (await ask({ title: 'Clear this page?', message: `All ${ids.length} items on page ${page} will be deleted. You can undo this.`, ok: 'Clear page', danger: true })) deleteItems(ids, ids.length + ' items deleted'); };
  mk('delTypeBtn', 'Delete all of a type').onclick = () => { if (!proj) return; closeMoreMenu(); const c = {}; proj.items.filter(i => i.page === page).forEach(i => c[i.type] = (c[i.type] || 0) + 1); const ks = Object.keys(c); if (!ks.length) return toast('Nothing on this page.');
    const d = $('#delTypeDlg'); d.querySelector('.list').innerHTML = ks.map(k => `<button type="button" class="btn danger" data-t="${k}">${TRASH}${TYPE_NAMES[k]} (${c[k]})</button>`).join(''); d.showModal(); }; })();
const dtd = document.createElement('dialog'); dtd.id = 'delTypeDlg'; dtd.setAttribute('aria-labelledby', 'delTypeTitle'); dtd.innerHTML = '<form method="dialog"><h3 id="delTypeTitle">Delete all of a type</h3><p>Only items on this page are deleted. You can undo this.</p><div class="list"></div><div class="frow"><button class="btn" value="cancel">Cancel</button></div></form>'; document.body.appendChild(dtd);
dtd.addEventListener('click', async e => { const b = e.target.closest('[data-t]'); if (!b) return; const t = b.dataset.t, ids = proj.items.filter(i => i.page === page && i.type === t).map(i => i.id); dtd.close();
  if (await ask({ title: `Delete ${ids.length} ${TYPE_NAMES[t]} item${ids.length === 1 ? '' : 's'}?`, message: `Every ${TYPE_NAMES[t]} item on page ${page} will be deleted. You can undo this.`, ok: 'Delete', danger: true })) deleteItems(ids, ids.length + ' ' + TYPE_NAMES[t] + ' deleted'); });
Object.assign(window.PM, { deleteItems, nearHit }); Object.defineProperty(window.PM, 'selId', { get: () => selId });

// ---- Auto straight: lock near-horizontal / vertical / 45 degree / drawing-angle segments, and align with existing points ----
const ST_TOL = 5 * Math.PI / 180;
let domAng = null; // dominant drawing angle (rotated CAD grids), radians in [0, 90deg)
function dominantAngle() { if (domAng !== null) return domAng; const G = geomCache[page]; if (!G || !G.ready) return 0; domAng = 0; if (!G.cad) return domAng;
  const { sx } = G.cad, n = sx.length / 4, bins = new Float64Array(90); for (let i = 0; i < n; i++) { const dx = sx[4 * i + 2] - sx[4 * i], dy = sx[4 * i + 3] - sx[4 * i + 1], L = Math.hypot(dx, dy); if (!L) continue; let a = Math.atan2(dy, dx) * 180 / Math.PI; a = ((a % 90) + 90) % 90; bins[Math.round(a) % 90] += L; }
  let b = 0; for (let i = 1; i < 90; i++) if (bins[i] > bins[b]) b = i; const tot = bins.reduce((x, y) => x + y, 0);
  if (b > 2 && b < 88 && b !== 45 && bins[b] > 0.25 * tot) domAng = b * Math.PI / 180; return domAng; }
function straightDirs() { const D = [0, Math.PI / 2, Math.PI / 4, 3 * Math.PI / 4], a = dominantAngle(); if (a) D.push(a, a + Math.PI / 2); return D; }
function alignPts(exclude, prev) { const out = []; if (!proj) return out; for (const it of proj.items) if (it.page === page) for (const q of it.pts) if (q !== exclude) out.push(q); if (draft) for (const q of draft.pts) if (q !== exclude && q !== prev) out.push(q); return out; }
function straighten(p, prev, tol, exclude) { const dx = p[0] - prev[0], dy = p[1] - prev[1], L = Math.hypot(dx, dy); if (L < 1e-9) return null;
  const ang = Math.atan2(dy, dx); let best = null, bd = ST_TOL;
  for (const d of straightDirs()) { let df = Math.abs(((ang - d) % Math.PI + Math.PI * 1.5) % Math.PI - Math.PI / 2); if (df < bd) { bd = df; best = d; } }
  const A = alignPts(exclude, prev); let ax = null, ay = null, bx = tol, by = tol;
  for (const q of A) { if (Math.abs(q[0] - p[0]) < bx) { bx = Math.abs(q[0] - p[0]); ax = q; } if (Math.abs(q[1] - p[1]) < by) { by = Math.abs(q[1] - p[1]); ay = q; } }
  if (best === null && !ax && !ay) return null;
  let q = p.slice(), dir = null;
  if (best !== null) { dir = [Math.cos(best), Math.sin(best)]; const t = dx * dir[0] + dy * dir[1]; q = [prev[0] + t * dir[0], prev[1] + t * dir[1]];
    const hz = Math.abs(dir[1]) < 1e-6, vt = Math.abs(dir[0]) < 1e-6;
    if (hz) { ay = null; if (ax) q = [ax[0], prev[1]]; } else if (vt) { ax = null; if (ay) q = [prev[0], ay[1]]; }
    else if (ax) { q = [ax[0], prev[1] + (ax[0] - prev[0]) / dir[0] * dir[1]]; ay = null; } else if (ay) { q = [prev[0] + (ay[1] - prev[1]) / dir[1] * dir[0], ay[1]]; } }
  else { if (ax) q[0] = ax[0]; if (ay) q[1] = ay[1]; }
  if (ax && Math.abs(q[0] - ax[0]) > 1e-9) ax = null; if (ay && Math.abs(q[1] - ay[1]) > 1e-9) ay = null;
  return { q, prev: prev.slice(), dir, ax, ay, straight: best !== null }; }
function straightInfo(q, prev, exclude) { const s = straighten(q, prev, 1e-6, exclude); return s && s.straight && Math.hypot(s.q[0] - q[0], s.q[1] - q[1]) < 1e-6 ? s : null; }
function keepStraight(h, st, prev, r) { // snapped point lies on a drawing line: slide along it to meet the straight ray
  if (!st.dir) return null; if (h.kind !== 'line') { return Math.hypot(h.p[0] - st.q[0], h.p[1] - st.q[1]) < 1e-6 ? h.p.slice() : null; }
  const G = geomCache[page]; if (!G || !G.ready) return null; const ray = [prev[0], prev[1], prev[0] + st.dir[0] * 1e7, prev[1] + st.dir[1] * 1e7], ray2 = [prev[0], prev[1], prev[0] - st.dir[0] * 1e7, prev[1] - st.dir[1] * 1e7];
  for (const i of nearSegs(G, h.p, r).slice(0, 200)) { const sg = G.segs[i]; if (dist(projSeg(h.p, sg), h.p) > 1e-6) continue; const x = segX(ray, sg) || segX(ray2, sg); if (x && dist(x, h.p) <= r) return x; }
  return null; }
function guideLines(g, span) { const out = [], q = g.q, R = Math.max(span, 4000 / zoom); if (g.dir) out.push([[q[0] - g.dir[0] * R, q[1] - g.dir[1] * R], [q[0] + g.dir[0] * R, q[1] + g.dir[1] * R]]);
  if (g.ax) out.push([[g.ax[0], g.ax[1]], [q[0], q[1]]]); if (g.ay) out.push([[g.ay[0], g.ay[1]], [q[0], q[1]]]); return out; }
function drawGuideSvg(g) { if (!guide || !draft) return; const w = 1.2 / zoom, A = { fill: 'none', stroke: '#2962ff', 'stroke-width': w, 'stroke-dasharray': `${6 / zoom} ${4 / zoom}` };
  for (const [a, b] of guideLines(guide, 1e5)) el('path', { ...A, d: `M${a[0]} ${a[1]}L${b[0]} ${b[1]}` }, g);
  const txt = guide.straight ? 'straight' : 'aligned', [x, y] = guide.q, fs = 11 / zoom, bw = (txt.length * 6.2 + 8) / zoom;
  el('rect', { x: x + 10 / zoom, y: y + 8 / zoom, width: bw, height: 15 / zoom, rx: 3 / zoom, fill: '#2962ff' }, g); const t = el('text', { x: x + 14 / zoom, y: y + 19 / zoom, 'font-size': fs, fill: '#fff', 'font-family': 'sans-serif' }, g); t.textContent = txt;
  g.dataset.guide = txt; }
(function () { const b = document.createElement('button'); b.id = 'straightBtn'; b.type = 'button'; b.className = 'btn small' + (straightOn ? ' on' : ''); b.setAttribute('aria-pressed', String(straightOn)); b.title = 'Auto straight: lock near level / plumb / 45 degree lines and line up with other points. Hold Alt to turn off for a moment';
  b.innerHTML = '<svg class="ic" viewBox="0 0 24 24"><path d="M3 20h18M4 20V4"/><path d="M8 16l10-10" stroke-dasharray="2 2"/></svg><span class="t">Auto straight</span>'; $('#snapBtn').before(b);
  b.onclick = () => { straightOn = !straightOn; localStorage.setItem('pm-straight', straightOn ? '1' : '0'); b.classList.toggle('on', straightOn); b.setAttribute('aria-pressed', String(straightOn)); guide = null; showSnapMark(); toast('Auto straight ' + (straightOn ? 'on' : 'off')); }; })();
const _ldS = loadDoc; loadDoc = async function (...a) { domAng = null; return _ldS(...a); };
const _gpS = gotoPage; gotoPage = function (...a) { domAng = null; return _gpS(...a); };
Object.defineProperty(window.PM, 'guide', { get: () => guide }); window.PM.aim = (p, prev, alt) => aim(p, { altKey: !!alt, pointerType: 'mouse' }, prev, null); window.PM.domAngle = () => dominantAngle();
// iOS: stop long-press selection / callout inside the plan area (pinch and pan are handled by pointer events)
(function () { const v = vpEl, plan = e => !e.target.closest('input,textarea,select,button,label,a,[contenteditable],#empty');
  v.addEventListener('touchstart', e => { if (plan(e) && e.touches.length === 1) e.preventDefault(); }, { passive: false });
  v.addEventListener('contextmenu', e => { if (plan(e)) e.preventDefault(); });
  v.addEventListener('selectstart', e => { if (plan(e)) e.preventDefault(); });
  const clr = () => { const s = window.getSelection && getSelection(); if (s && s.rangeCount && !(document.activeElement && document.activeElement.matches('input,textarea'))) s.removeAllRanges(); };
  document.addEventListener('touchend', clr, { passive: true }); document.addEventListener('touchcancel', clr, { passive: true }); })();

// ---- Print: free-form selection, scale-to-fit output, PDF-first on iOS ----
(function () {
  const PAPERS = {
    letter: { w: 792, h: 612, name: 'Letter' }, // landscape pts (1/72"); swapped for portrait
    tabloid: { w: 1224, h: 792, name: 'Tabloid' },
    a4: { w: 841.89, h: 595.28, name: 'A4' },
    a3: { w: 1190.55, h: 841.89, name: 'A3' }
  };
  const PRINT_MARGIN = 18; // pts (~0.25in)
  const PRINT_STRIP = 16;  // pts for title/legend strip
  let printRect = null; // page units {x,y,w,h} — free-form
  let drag = null;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function orientChoice() {
    const v = ($('#printOrient') && $('#printOrient').value) || 'auto';
    if (v === 'landscape' || v === 'portrait') return v;
    // Auto: pick orientation that best fits the selection
    if (printRect && printRect.h > printRect.w * 1.05) return 'portrait';
    return 'landscape';
  }
  function paperPts() {
    const base = PAPERS[$('#printPaper').value] || PAPERS.letter;
    const land = orientChoice() !== 'portrait';
    return land
      ? { pw: base.w, ph: base.h, label: base.name + (land ? ' landscape' : ' portrait'), land: true }
      : { pw: base.h, ph: base.w, label: base.name + ' portrait', land: false };
  }
  function printableArea() {
    const { pw, ph, label, land } = paperPts();
    const availW = pw - 2 * PRINT_MARGIN, availH = ph - 2 * PRINT_MARGIN - PRINT_STRIP;
    return { pw, ph, label, land, margin: PRINT_MARGIN, stripH: PRINT_STRIP, availW, availH, aspect: availW / availH };
  }
  function syncPrintBox() {
    const box = $('#printBox'); if (!box || !printRect) return;
    box.style.left = printRect.x * zoom + 'px';
    box.style.top = printRect.y * zoom + 'px';
    box.style.width = Math.max(1, printRect.w) * zoom + 'px';
    box.style.height = Math.max(1, printRect.h) * zoom + 'px';
  }
  /** Clamp free-form rect onto the page (min 8pt). */
  function clampRect(r) {
    const { w: pw, h: ph } = doc.sizes[page];
    let w = Math.max(8, Math.min(r.w, pw));
    let h = Math.max(8, Math.min(r.h, ph));
    let x = Math.max(0, Math.min(r.x, pw - w));
    let y = Math.max(0, Math.min(r.y, ph - h));
    return { x, y, w, h };
  }
  /** Largest rect on the page (full page). */
  function maxPageRect() {
    const { w: pw, h: ph } = doc.sizes[page];
    return { x: 0, y: 0, w: pw, h: ph };
  }
  /** Visible plan region in page units = viewport ∩ page (after print bar layout). */
  function visiblePageRect() {
    const { w: pw, h: ph } = doc.sizes[page];
    const vr = vpEl.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    let x0 = (vr.left - sr.left) / zoom;
    let y0 = (vr.top - sr.top) / zoom;
    let x1 = (vr.right - sr.left) / zoom;
    let y1 = (vr.bottom - sr.top) / zoom;
    x0 = Math.max(0, Math.min(pw, x0));
    y0 = Math.max(0, Math.min(ph, y0));
    x1 = Math.max(0, Math.min(pw, x1));
    y1 = Math.max(0, Math.min(ph, y1));
    if (x1 - x0 < 8 || y1 - y0 < 8) return { x: 0, y: 0, w: pw, h: ph };
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  /** Inset a page-unit rect by cssPx on each side (keeps grips on-screen). */
  function insetRect(r, cssPx) {
    const m = cssPx / Math.max(zoom, 0.01);
    let x = r.x + m, y = r.y + m, w = r.w - 2 * m, h = r.h - 2 * m;
    if (w < 8) { x = r.x + r.w / 2 - 4; w = 8; }
    if (h < 8) { y = r.y + r.h / 2 - 4; h = 8; }
    return clampRect({ x, y, w, h });
  }
  /** Fit whole plan page in view and select (almost) the full page. */
  function fitViewToPrintRect() {
    if (!doc) return;
    fitPage();
    printRect = maxPageRect();
    syncPrintBox();
    scheduleRender(50);
  }
  /**
   * Init selection from the currently visible plan region.
   * Does NOT change zoom/pan. Inset ~16css px so all 8 grips stay grabbable.
   * If the whole page is already in view (not zoomed into a detail), use full page.
   */
  function initPrintRect() {
    const { w: pw, h: ph } = doc.sizes[page];
    const vis = visiblePageRect();
    const coversPage = vis.w >= pw * 0.92 && vis.h >= ph * 0.92;
    if (coversPage) {
      // Whole page in view (fitPage leaves ~40px margin) — select full page; grips stay on-screen.
      printRect = maxPageRect();
    } else {
      // Zoomed into a detail: match visible area, inset so all 8 grips are grabbable.
      printRect = insetRect(vis, 16);
    }
  }

  function enterPrintMode() {
    if (!doc || !proj) return toast('Open a plan first.');
    closeMoreMenu();
    // Capture view before print bar shrinks the viewport — we remeasure after layout.
    const prevZoom = zoom, prevSL = vpEl.scrollLeft, prevST = vpEl.scrollTop;
    document.body.classList.add('printmode');
    $('#printBar').hidden = false;
    $('#printOverlay').hidden = false;
    // Do NOT change zoom/pan. After print bar takes space, set box to visible area.
    const settle = () => {
      // Restore scroll if layout shifted it
      if (Math.abs(zoom - prevZoom) > 1e-9) { zoom = prevZoom; layout(); }
      vpEl.scrollLeft = prevSL; vpEl.scrollTop = prevST;
      initPrintRect();
      syncPrintBox();
    };
    requestAnimationFrame(() => requestAnimationFrame(settle));
    toast('The blue frame is what prints. Drag it or its edges to adjust.', 4500);
  }
  function exitPrintMode() {
    document.body.classList.remove('printmode');
    $('#printBar').hidden = true;
    $('#printOverlay').hidden = true;
    printRect = null; drag = null;
  }
  $('#printBtn').onclick = () => { if (document.body.classList.contains('printmode')) exitPrintMode(); else enterPrintMode(); };
  $('#printCancel').onclick = exitPrintMode;
  $('#printRecenterBtn').onclick = () => fitViewToPrintRect();
  $('#printPaper').onchange = $('#printOrient').onchange = () => {
    // Paper/orient only affect output; selection stays free-form. No auto-zoom.
    if (!document.body.classList.contains('printmode')) return;
    syncPrintBox();
  };

  const _layoutP = layout; layout = function () { _layoutP(); if (document.body.classList.contains('printmode')) syncPrintBox(); };

  const box = $('#printBox');
  box.addEventListener('pointerdown', e => {
    if (!printRect) return;
    e.preventDefault(); e.stopPropagation();
    try { box.setPointerCapture(e.pointerId); } catch (err) { }
    const h = e.target.dataset.h || 'move';
    const p = pagePt(e);
    drag = { h, ox: p[0], oy: p[1], r: { ...printRect } };
  });
  box.addEventListener('pointermove', e => {
    if (!drag) return;
    e.preventDefault();
    const p = pagePt(e), dx = p[0] - drag.ox, dy = p[1] - drag.oy, r0 = drag.r;
    const H = drag.h;
    let r;
    if (H === 'move') {
      r = { x: r0.x + dx, y: r0.y + dy, w: r0.w, h: r0.h };
    } else {
      let x = r0.x, y = r0.y, w = r0.w, h = r0.h;
      if (H.includes('w')) { const nx = Math.min(r0.x + r0.w - 8, r0.x + dx); w = r0.x + r0.w - nx; x = nx; }
      if (H.includes('e')) { w = Math.max(8, r0.w + dx); }
      if (H.includes('n')) { const ny = Math.min(r0.y + r0.h - 8, r0.y + dy); h = r0.y + r0.h - ny; y = ny; }
      if (H.includes('s')) { h = Math.max(8, r0.h + dy); }
      r = { x, y, w, h };
    }
    printRect = clampRect(r); syncPrintBox();
  });
  const endDrag = () => { drag = null; }; // no auto-zoom — it fights the gesture
  box.addEventListener('pointerup', endDrag); box.addEventListener('pointercancel', endDrag);

  async function renderRegionCanvas(rect, targetW) {
    const r = Math.max(0.5, targetW / rect.w);
    const maxPx = 16e6; let rr = r;
    if (rect.w * rect.h * r * r > maxPx) rr = Math.sqrt(maxPx / (rect.w * rect.h));
    const W = Math.max(1, Math.round(rect.w * rr)), H = Math.max(1, Math.round(rect.h * rr));
    const off = document.createElement('canvas'); off.width = W; off.height = H; const octx = off.getContext('2d');
    octx.fillStyle = '#fff'; octx.fillRect(0, 0, W, H);
    if (doc.type === 'pdf') {
      const pg = await doc.pdf.getPage(page); const vp = pg.getViewport({ scale: rr });
      await pg.render({ canvasContext: octx, viewport: vp, transform: [1, 0, 0, 1, -rect.x * rr, -rect.y * rr] }).promise;
    } else if (doc.type === 'cad') {
      CAD.draw(octx, doc.cad, rr, -rect.x * rr, -rect.y * rr, (proj && proj.hidden) || {}, { x0: rect.x, y0: rect.y, w: rect.w, h: rect.h });
    } else {
      octx.drawImage(doc.img, rect.x, rect.y, rect.w, rect.h, 0, 0, W, H);
    }
    const oldZ = zoom, prevSel = selId;
    zoom = rr / 2.5; selId = null;
    try {
      draw();
      const clone = svg.cloneNode(true);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('font-family', '"Barlow Semi Condensed", "Arial Narrow", Arial, Helvetica, sans-serif'); // web fonts do not load inside an SVG image
      clone.setAttribute('viewBox', `${rect.x} ${rect.y} ${rect.w} ${rect.h}`);
      clone.setAttribute('width', String(W)); clone.setAttribute('height', String(H));
      const xml = new XMLSerializer().serializeToString(clone);
      const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
      try {
        const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
        octx.drawImage(im, 0, 0, W, H);
      } finally { URL.revokeObjectURL(url); }
    } finally {
      zoom = oldZ; selId = prevSel; layout();
    }
    return off;
  }

  function stripText() {
    const g = groups();
    const counts = g.filter(x => x.type === 'sleeve' || x.type === 'count').map(x => (x.label || TYPE_NAMES[x.type]) + ' ' + x.n).slice(0, 8).join(' · ');
    const rest = g.filter(x => x.type !== 'sleeve' && x.type !== 'count').slice(0, 4).map(x => (x.label || TYPE_NAMES[x.type]) + ' ' + fmtGroup(x)).join(' · ');
    return [proj.name, 'p' + page, printableArea().label, counts, rest].filter(Boolean).join('  |  ');
  }

  /** Build a full-page canvas: white sheet, title strip, region scaled uniformly to fill availW or availH. */
  async function buildPageCanvas() {
    if (!doc || !printRect) throw new Error('Nothing to print');
    const { pw, ph, margin, stripH, availW, availH, land, label } = printableArea();
    const dpi = 200, pxPerPt = dpi / 72;
    const pageW = Math.round(pw * pxPerPt), pageH = Math.round(ph * pxPerPt);
    const m = Math.round(margin * pxPerPt), sh = Math.round(stripH * pxPerPt);
    const aw = Math.round(availW * pxPerPt), ah = Math.round(availH * pxPerPt);

    // Uniform scale-to-fit: selected region → largest size that fits avail area (no stretch)
    const sx = aw / printRect.w, sy = ah / printRect.h;
    const scale = Math.min(sx, sy);
    const dw = Math.max(1, Math.round(printRect.w * scale));
    const dh = Math.max(1, Math.round(printRect.h * scale));
    const region = await renderRegionCanvas(printRect, dw);

    const final = document.createElement('canvas');
    final.width = pageW; final.height = pageH;
    const ctx = final.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, pageW, pageH);
    // Title strip
    ctx.fillStyle = '#111';
    ctx.font = '700 ' + Math.max(10, Math.round(9 * pxPerPt)) + 'px system-ui,sans-serif';
    ctx.textBaseline = 'middle';
    const text = stripText();
    ctx.fillText(text, m, m + sh / 2, pageW - 2 * m);
    ctx.strokeStyle = '#bbb'; ctx.beginPath();
    ctx.moveTo(m, m + sh - 1); ctx.lineTo(pageW - m, m + sh - 1); ctx.stroke();
    // Center image in printable block under strip
    const ix = m + Math.floor((aw - dw) / 2);
    const iy = m + sh + Math.floor((ah - dh) / 2);
    ctx.drawImage(region, 0, 0, region.width, region.height, ix, iy, dw, dh);
    return { cnv: final, pw, ph, margin, stripH, availW, availH, land, label, pageW, pageH, dw, dh, fillRatio: Math.max(dw / aw, dh / ah) };
  }

  async function buildPrintPreview() {
    const built = await buildPageCanvas();
    const dataUrl = built.cnv.toDataURL('image/jpeg', 0.92);
    const img = $('#printImg');
    await new Promise((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = dataUrl; });
    try { if (img.decode) await img.decode(); } catch (e) { }
    $('#printStrip').textContent = ''; // strip is baked into the page image
    $('#printStrip').style.display = 'none';
    const { pw, ph } = built;
    // Physical CSS sizes so iOS Safari sizes the sheet correctly if CSS print is used
    const sheet = $('#printSheet');
    sheet.style.width = (pw / 72) + 'in';
    sheet.style.height = (ph / 72) + 'in';
    sheet.style.padding = '0';
    sheet.style.boxSizing = 'border-box';
    img.style.width = (pw / 72) + 'in';
    img.style.height = (ph / 72) + 'in';
    img.style.maxWidth = '100%';
    img.style.objectFit = 'contain';
    img.style.display = 'block';
    $('#printPageStyle').textContent =
      `@page{size:${pw / 72}in ${ph / 72}in;margin:0}` +
      `@media print{html,body{margin:0!important;width:100%!important}` +
      `#printSheet{width:${pw / 72}in!important;height:${ph / 72}in!important}` +
      `#printImg{width:${pw / 72}in!important;height:${ph / 72}in!important;max-width:100%!important}}`;
    return { ...built, dataUrl, aspect: built.availW / built.availH };
  }

  let previewCache = null; // { dataUrl, pdfBytes, label, land, name, pw, ph }
  let ppScale = 1, ppTX = 0, ppTY = 0;
  let ppPinch = null;

  function pdfFileName() { return (proj && proj.name ? proj.name : 'plan') + '-print.pdf'; }

  function applyPpTransform() {
    const page = $('#ppPage');
    if (!page) return;
    page.style.transform = `translate(${ppTX}px,${ppTY}px) scale(${ppScale})`;
  }
  function fitPpPage() {
    const stage = $('#ppStage'), img = $('#ppImg'), page = $('#ppPage');
    if (!stage || !img || !img.naturalWidth) return;
    const pad = 24;
    const sw = Math.max(40, stage.clientWidth - pad * 2);
    const sh = Math.max(40, stage.clientHeight - pad * 2);
    // Page aspect from natural image
    const ar = img.naturalWidth / img.naturalHeight;
    let w = sw, h = w / ar;
    if (h > sh) { h = sh; w = h * ar; }
    page.style.width = w + 'px';
    ppScale = 1; ppTX = 0; ppTY = 0; applyPpTransform();
  }

  function closePreview() {
    const modal = $('#printPreview');
    if (modal) modal.hidden = true;
    document.body.classList.remove('printpreview');
    previewCache = null;
    ppPinch = null;
  }

  async function openPreview() {
    if (!proj || !printRect) return;
    toast('Building preview...', 8000);
    try {
      const built = await buildPageCanvas();
      const dataUrl = built.cnv.toDataURL('image/jpeg', 0.92);
      // Pre-build PDF so Print/Save clicks can open/share synchronously (no popup block, no surprise download)
      const { PDFDocument } = PDFLib;
      const out = await PDFDocument.create();
      const pg = out.addPage([built.pw, built.ph]);
      const jpg = await (await fetch(dataUrl)).arrayBuffer();
      const embedded = await out.embedJpg(jpg);
      pg.drawImage(embedded, { x: 0, y: 0, width: built.pw, height: built.ph });
      const pdfBytes = await out.save();

      previewCache = {
        dataUrl, pdfBytes, label: built.label, land: built.land,
        name: pdfFileName(), pw: built.pw, ph: built.ph, fillRatio: built.fillRatio
      };

      // Also stage printRoot for desktop window.print
      const img = $('#printImg');
      await new Promise((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = dataUrl; });
      try { if (img.decode) await img.decode(); } catch (e) { }
      $('#printStrip').style.display = 'none';
      const sheet = $('#printSheet');
      sheet.style.width = (built.pw / 72) + 'in';
      sheet.style.height = (built.ph / 72) + 'in';
      img.style.width = (built.pw / 72) + 'in';
      img.style.height = (built.ph / 72) + 'in';
      $('#printPageStyle').textContent =
        `@page{size:${built.pw / 72}in ${built.ph / 72}in;margin:0}` +
        `@media print{html,body{margin:0!important}` +
        `#printSheet{width:${built.pw / 72}in!important;height:${built.ph / 72}in!important}` +
        `#printImg{width:${built.pw / 72}in!important;height:${built.ph / 72}in!important}}`;

      const ppImg = $('#ppImg');
      await new Promise((res, rej) => { ppImg.onload = () => res(); ppImg.onerror = rej; ppImg.src = dataUrl; });
      try { if (ppImg.decode) await ppImg.decode(); } catch (e) { }
      $('#ppInfo').textContent = built.label + (isPhoneDev ? '. Pinch to zoom.' : '. Scroll to zoom.');
      $('#ppTitle').textContent = 'Print preview';
      $('#printPreview').hidden = false;
      document.body.classList.add('printpreview');
      requestAnimationFrame(() => { fitPpPage(); requestAnimationFrame(fitPpPage); });
      toast('Preview ready — Print or Save PDF when it looks right', 3500);
    } catch (e) { console.error(e); toast('Preview failed: ' + e.message, 5000); }
  }

  async function shareOrOpenPdf(bytes, name, { preferShare } = { preferShare: true }) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const file = new File([blob], name, { type: 'application/pdf' });
    if (preferShare && navigator.share && navigator.canShare) {
      try {
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: name });
          return 'shared';
        }
      } catch (e) {
        if (e && e.name === 'AbortError') return 'aborted';
        // fall through
      }
    }
    // Open blob in a new tab (no download attribute) — sync-friendly when called from a click
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (!w) {
      // Last resort: download
      download(bytes, name, 'application/pdf');
      toast('PDF saved', 3000);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return 'download';
    }
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
    toast('PDF opened — use Share or Print', 4000);
    return 'opened';
  }

  function doPreviewPrint() {
    if (!previewCache) return;
    if (isIOS) {
      // Share sheet offers Print + Save to Files without forcing a download bar
      shareOrOpenPdf(previewCache.pdfBytes, previewCache.name, { preferShare: true });
      return;
    }
    // Desktop: CSS print of the staged full-page image
    window.print();
  }

  async function doPreviewSave() {
    if (!previewCache) return;
    const { pdfBytes, name } = previewCache;
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const file = new File([blob], name, { type: 'application/pdf' });
    if (navigator.share && navigator.canShare) {
      try {
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: name });
          return;
        }
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    download(pdfBytes, name, 'application/pdf');
    toast('Saved PDF', 3000);
  }

  // Pinch / pan on preview stage
  (function () {
    const stage = $('#ppStage');
    if (!stage) return;
    const pts = new Map();
    stage.addEventListener('pointerdown', e => {
      if ($('#printPreview').hidden) return;
      stage.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        ppPinch = {
          d: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          scale: ppScale, tx: ppTX, ty: ppTY,
          mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2
        };
      } else if (pts.size === 1) {
        ppPinch = { pan: true, x: e.clientX, y: e.clientY, tx: ppTX, ty: ppTY, scale: ppScale };
      }
    });
    stage.addEventListener('pointermove', e => {
      if (!ppPinch || !pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && ppPinch.d) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        ppScale = Math.max(0.5, Math.min(5, ppPinch.scale * d / ppPinch.d));
        ppTX = ppPinch.tx + (mx - ppPinch.mx);
        ppTY = ppPinch.ty + (my - ppPinch.my);
        applyPpTransform();
      } else if (ppPinch.pan && pts.size === 1 && ppScale > 1.01) {
        ppTX = ppPinch.tx + (e.clientX - ppPinch.x);
        ppTY = ppPinch.ty + (e.clientY - ppPinch.y);
        applyPpTransform();
      }
    });
    const end = e => {
      pts.delete(e.pointerId);
      if (pts.size < 2) ppPinch = pts.size === 1
        ? { pan: true, x: [...pts.values()][0].x, y: [...pts.values()][0].y, tx: ppTX, ty: ppTY, scale: ppScale }
        : null;
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    // Desktop wheel zoom
    stage.addEventListener('wheel', e => {
      if ($('#printPreview').hidden) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      ppScale = Math.max(0.5, Math.min(5, ppScale * factor));
      applyPpTransform();
    }, { passive: false });
    window.addEventListener('resize', () => { if (!$('#printPreview').hidden) fitPpPage(); });
  })();

  // Public wrappers used by tests / older callers
  async function buildPrintPdfBytes() {
    if (previewCache && previewCache.pdfBytes) return previewCache.pdfBytes;
    const built = await buildPageCanvas();
    const { PDFDocument } = PDFLib;
    const out = await PDFDocument.create();
    const pg = out.addPage([built.pw, built.ph]);
    const jpg = await (await fetch(built.cnv.toDataURL('image/jpeg', 0.92))).arrayBuffer();
    const embedded = await out.embedJpg(jpg);
    pg.drawImage(embedded, { x: 0, y: 0, width: built.pw, height: built.ph });
    return await out.save();
  }

  $('#printGo').onclick = openPreview;
  $('#ppBack').onclick = () => { closePreview(); };
  $('#ppPrint').onclick = doPreviewPrint;
  $('#ppSave').onclick = () => { doPreviewSave(); };

  const _exitPrintMode = exitPrintMode;
  exitPrintMode = function () { closePreview(); _exitPrintMode(); };
  $('#printCancel').onclick = exitPrintMode;
  $('#printBtn').onclick = () => { if (document.body.classList.contains('printmode')) exitPrintMode(); else enterPrintMode(); };

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#printPreview').hidden) { e.preventDefault(); closePreview(); return; }
    if (e.key === 'Escape' && document.body.classList.contains('printmode') && $('#moreMenu').hidden) { e.preventDefault(); exitPrintMode(); }
  });
  Object.assign(window.PM, {
    enterPrintMode, exitPrintMode, buildPrintPreview, buildPrintPdfBytes, syncPrintBox, fitViewToPrintRect, printableArea, orientChoice,
    openPreview, closePreview, doPreviewPrint, doPreviewSave, visiblePageRect, initPrintRect,
    setPrintRect: (r) => { if (!doc || !r) return; printRect = clampRect(r); syncPrintBox(); }
  });
  Object.defineProperty(window.PM, 'printRect', { get: () => printRect && { ...printRect } });
  Object.defineProperty(window.PM, 'previewOpen', { get: () => !$('#printPreview').hidden });
  Object.defineProperty(window.PM, 'previewCache', { get: () => previewCache && { label: previewCache.label, name: previewCache.name, land: previewCache.land, fillRatio: previewCache.fillRatio, hasPdf: !!previewCache.pdfBytes } });
})();

// ---- In-app dialogs (replace prompt / confirm, which look out of place and cannot take multi-line notes) ----
// kind: 'confirm' resolves true/false, 'text' (one line) and 'note' (multi-line) resolve the text or null.
function ask({ title, message = '', ok = 'OK', cancel = 'Cancel', danger = false, kind = 'confirm', value = '', placeholder = '' }) {
  const d = $('#askDlg'), inp = $('#askInput'), ta = $('#askText'), okB = $('#askOk');
  if (d.open) return Promise.resolve(kind === 'confirm' ? false : null);
  return new Promise(res => {
    d.dataset.kind = kind; $('#askTitle').textContent = title; $('#askMsg').textContent = message;
    okB.textContent = ok; okB.className = 'btn ' + (danger ? 'danger' : 'primary'); $('#askCancel').textContent = cancel;
    inp.value = kind === 'text' ? value : ''; ta.value = kind === 'note' ? value : ''; inp.placeholder = ta.placeholder = placeholder;
    const field = kind === 'text' ? inp : kind === 'note' ? ta : null;
    d.returnValue = '';
    d.addEventListener('close', () => { const yes = d.returnValue === 'ok'; res(kind === 'confirm' ? yes : yes ? field.value : null); }, { once: true });
    d.showModal(); setTimeout(() => { if (field) { field.focus(); if (field.select) field.select(); } else if (danger) $('#askCancel').focus(); else okB.focus(); }, 30);
  });
}
$('#askInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#askDlg').close('ok'); } });
$('#askText').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('#askDlg').close('ok'); } });

// ---- Project name in the top bar, page title ----
function syncProjName() {
  const b = $('#projName'), has = !!(proj && doc), name = has ? proj.name || 'Untitled' : '';
  if (b && b._n !== name) { b._n = name; b.hidden = !has; b.innerHTML = has ? `<span>${esc(name)}</span>${svgIc('edit')}` : ''; }
  document.title = has ? name + ' - Plan Measure' : 'Plan Measure - PDF plan viewer and takeoff';
}
$('#projName').onclick = () => $('#saveBtn').click();

// ---- Autosave indicator in the status strip ----
function setSaveState(st, msg, when) {
  const el = $('#saveState'); if (!el) return;
  el.className = st === 'ok' ? '' : st;
  el.textContent = st === 'pending' ? 'Saving…' : st === 'err' ? 'Not saved' : 'Saved ' + fmtWhen(when || Date.now()).replace(/^Today /, '').replace(/^Yesterday/, 'yesterday');
  el.title = st === 'err' ? 'Could not save in this browser: ' + (msg || 'unknown error') : 'Your work is saved in this browser automatically';
}

// ---- Recent projects on the start screen. Only names and dates live in localStorage, so the list never loads plan files. ----
function fmtWhen(t) {
  if (!t) return ''; const d = new Date(t), now = new Date(), day = (a) => new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime(), diff = Math.round((day(now) - day(d)) / 864e5);
  const time = d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
  if (diff === 0) return 'Today ' + time; if (diff === 1) return 'Yesterday ' + time;
  return d.toLocaleDateString('en-CA', d.getFullYear() === now.getFullYear() ? { month: 'short', day: 'numeric' } : { year: 'numeric', month: 'short', day: 'numeric' });
}
function recentList() { try { const a = JSON.parse(localStorage.getItem('pm-recent') || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function saveRecent(a) { try { localStorage.setItem('pm-recent', JSON.stringify(a.slice(0, 12))); } catch (e) { } }
function rememberRecent(p, when) { if (!p || !p.id) return; const a = recentList().filter(x => x.id !== p.id); a.unshift({ id: p.id, name: p.name, file: p.fileName || '', n: (p.items || []).length, t: when || Date.now() }); a.sort((x, y) => y.t - x.t); saveRecent(a); }
function forgetRecent(id) { saveRecent(recentList().filter(x => x.id !== id)); }
function syncRecentFrom(all) { saveRecent(all.map(p => ({ id: p.id, name: p.name, file: p.fileName || '', n: (p.items || []).length, t: p.updated }))); }
function renderRecent() {
  const box = $('#recent'), list = $('#recentList'); if (!box || !list) return;
  const last = localStorage.getItem('pm-last'), skipLast = !$('#resumeBtn').hidden, a = recentList().filter(x => !(skipLast && x.id === last)).slice(0, 5);
  box.hidden = !a.length;
  list.innerHTML = a.map(x => `<button type="button" class="rrow" data-id="${esc(x.id)}">${svgIc('file')}<b>${esc(x.name || x.file || 'Untitled')}</b><small>${x.n} item${x.n === 1 ? '' : 's'}</small><small>${esc(fmtWhen(x.t))}</small></button>`).join('');
}
$('#recentList').addEventListener('click', e => { const b = e.target.closest('.rrow'); if (b) openGuarded(b.dataset.id); });
$('#recentAll').onclick = () => $('#projBtn').click();

// ---- Export menu (desktop) ----
function closeExportMenu() { const m = $('#exportMenu'); if (!m || m.hidden) return; m.hidden = true; $('#exportBtn').setAttribute('aria-expanded', 'false'); }
function openExportMenu() {
  if (!proj) return; closeMoreMenu(); const m = $('#exportMenu'), b = $('#exportBtn'); m.hidden = false;
  const r = b.getBoundingClientRect(); m.style.top = (r.bottom + 6) + 'px'; m.style.left = Math.max(8, Math.min(innerWidth - m.offsetWidth - 8, r.right - m.offsetWidth)) + 'px';
  b.setAttribute('aria-expanded', 'true');
  const f = m.querySelector('button:not([disabled])'); if (f) f.focus({ preventScroll: true });
}
$('#exportBtn').onclick = e => { e.stopPropagation(); if ($('#exportMenu').hidden) openExportMenu(); else closeExportMenu(); };
$('#exportMenu').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; closeExportMenu(); if (b.dataset.proxy) $(b.dataset.proxy).click(); });
document.addEventListener('click', e => { if (!$('#exportMenu').hidden && !e.target.closest('#exportMenu,#exportBtn')) closeExportMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#exportMenu').hidden) { closeExportMenu(); $('#exportBtn').focus(); } });
window.addEventListener('resize', closeExportMenu);
// arrow keys move through menu items
['#exportMenu', '#moreMenu'].forEach(sel => $(sel).addEventListener('keydown', e => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return; e.preventDefault();
  const items = [...$(sel).querySelectorAll('button:not([disabled])')].filter(b => b.offsetParent), i = items.indexOf(document.activeElement);
  const n = items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]; if (n) n.focus();
}));
// items in the More menu that are not proxies close it too
$('#moreMenu').addEventListener('click', e => { const b = e.target.closest('button.btn'); if (b && !b.dataset.proxy) closeMoreMenu(); });

// ---- Appearance: Auto follows the system, or pin Light / Dark ----
function themePref() { const t = localStorage.getItem('pm-theme'); return t === 'light' || t === 'dark' ? t : 'system'; }
function applyTheme() {
  const p = themePref(), t = p === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : p;
  document.documentElement.dataset.theme = t; const m = $('#themeColor'); if (m) m.content = t === 'dark' ? '#171c21' : '#f3f4f6';
  document.querySelectorAll('#themeSeg [data-theme-set]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.themeSet === p)));
}
$('#themeSeg').addEventListener('click', e => { const b = e.target.closest('[data-theme-set]'); if (!b) return; if (b.dataset.themeSet === 'system') localStorage.removeItem('pm-theme'); else localStorage.setItem('pm-theme', b.dataset.themeSet); applyTheme(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
applyTheme();

// ---- Quick colours; colour and label changes apply to the run you are drawing ----
function syncSwatches() { const c = $('#color').value.toLowerCase(); document.querySelectorAll('.swb').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.c === c))); }
function draftStyle() { if (draft && draft.type !== 'calibrate') { draft.color = $('#color').value; draft.label = $('#label').value.trim(); draw(); } }
document.querySelectorAll('.swb').forEach(b => b.onclick = () => { $('#color').value = b.dataset.c; syncSwatches(); draftStyle(); });
$('#color').addEventListener('input', () => { syncSwatches(); draftStyle(); });
$('#label').addEventListener('input', () => { if (draft && draft.type !== 'calibrate') draft.label = $('#label').value.trim(); });
syncSwatches();

// ---- Drag a file onto the window to open it ----
(function () {
  let depth = 0; const ov = $('#dropOverlay'), zone = $('#dropZone'), hasFiles = e => !!e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
  const off = () => { depth = 0; ov.hidden = true; zone.classList.remove('over'); };
  window.addEventListener('dragenter', e => { if (!hasFiles(e)) return; e.preventDefault(); depth++; ov.hidden = false; zone.classList.add('over'); });
  window.addEventListener('dragover', e => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  window.addEventListener('dragleave', e => { if (!hasFiles(e)) return; if (--depth <= 0) off(); });
  window.addEventListener('drop', e => { if (!hasFiles(e)) return; e.preventDefault(); off(); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (!f) return;
    if (document.body.classList.contains('printmode') && window.PM.exitPrintMode) window.PM.exitPrintMode(); onFile({ target: { files: [f], value: '' } }); });
})();

// ---- Keyboard shortcut list ----
$('#keysBtn').onclick = () => { closeMoreMenu(); $('#keysDlg').showModal(); };

syncToolUI(); renderRecent();
Object.assign(window.PM, { ask, renderRecent, recentList, applyTheme });
