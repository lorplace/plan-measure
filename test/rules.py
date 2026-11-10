#!/usr/bin/env python3
"""Mission rules on a synthetic sleeving sheet (no client data), phone size, touch.
   python3 test/rules.py http://127.0.0.1:8766/
   Fixture: test/sample-site.pdf (+ .json with the true coordinates), made by test/make_site.py.
   Covers: marks of every colour found; a near miss on a mark locks to its centre; an arrow tip beside a wall does not
   take the lock; cloud and red markup never lock; Set scale lands on the tick crossing; to-wall picks the wall beside
   the sleeve; lens never under the fingertip; a sheet with a blank corner keeps a full-size page bitmap; dragging stays
   quick with 1,000 placed sleeves; typed lengths and printed sleeve lengths are read correctly."""
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; META = json.load(open('test/sample-site.json')); ok = True
def chk(n, c, extra=''):
    global ok; ok = ok and bool(c); print(('PASS ' if c else 'FAIL ') + n + (f' -- {extra}' if extra and not c else ''))
READY = "window._iv=setInterval(()=>{ if (PMsnap.geom[1] && PMsnap.geom[1].ready) { clearInterval(window._iv); PMsnap.ensureSleeveSnap(1) } else PMsnap.buildGeom(1) }, 250)"
PROBE = r"""(M) => { const G = PMsnap.geom[1], out = {};
  const found = []; for (let i = 0; i < G.sleeve.n; i++) found.push([G.sleeve.xy[2*i], G.sleeve.xy[2*i+1]]);
  const det = {orange:[0,0], black:[0,0], brown:[0,0]};
  for (const m of M.marks) { det[m.col][1]++; if (found.some(f => Math.hypot(f[0]-m.x, f[1]-m.y) < 3)) det[m.col][0]++; }
  out.detected = det;
  const CELL = 24, pts = M.marks.concat([M.towall, M.short]), xy = new Float64Array(2*pts.length), grid = new Map();
  pts.forEach((m,i) => { xy[2*i]=m.x; xy[2*i+1]=m.y; const k = Math.floor(m.x/CELL)+','+Math.floor(m.y/CELL); (grid.get(k) || grid.set(k,[]).get(k)).push(i); });
  G.sleeve = {gen: G.sleeve.gen, page: 1, n: pts.length, xy, grid, kinds: pts.map(()=> 'anchor'), complete: true};
  const dirs = [...Array(12)].map((_,k) => [Math.cos(k*Math.PI/6), Math.sin(k*Math.PI/6)]), rows = [];
  for (const z of [0.15, 0.3, 0.6, 1, 2]) { PM.setZoom(z); const r = PMsnap.geomSnapRadius(true), sr = PMsnap.sleeveSnapRadius(true), row = { zoom: z, radius_px: r*z };
    for (const px of [6, 10]) { let hit = 0, n = 0;
      for (const m of M.marks) for (const d of dirs) { const p = [m.x + d[0]*px/z, m.y + d[1]*px/z];
        if (M.marks.some(o => o !== m && Math.hypot(o.x-p[0], o.y-p[1]) < Math.hypot(m.x-p[0], m.y-p[1]))) continue; n++;
        const h = PMsnap.findSnap(p, r, null, {sleeveR: sr, mode: 'measure'}); if (h && h.kind === 'sleeve' && Math.hypot(h.p[0]-m.x, h.p[1]-m.y) < 0.01) hit++; }
      row['mark' + px] = n ? hit / n : 1; }
    { let hit = 0, n = 0; for (const a of M.wall_arrows) for (const dy of [-2, 0, 2]) { n++; const p = [2300, a[1] + dy/z]; const h = PMsnap.findSnap(p, r, null, {sleeveR: sr, mode: 'measure'}); if (h && Math.abs(h.p[0]-2300) < 0.01 && Math.abs(h.p[1]-p[1]) < 0.01) hit++; } row.wall = hit / n; }
    { let bad = 0; for (const q of M.cloud.concat(M.red)) if (PMsnap.findSnap(q, Math.min(r, 6/z), null, {sleeveR: 0, noSleeve: true, mode: 'measure'})) bad++; row.markup = bad; }
    for (const px of [4, 8]) { let hit = 0, n = 0; for (const t of M.ticks) for (const d of dirs) { n++; const p = [t[0] + d[0]*px/z, t[1] + d[1]*px/z]; const h = PMsnap.findSnap(p, r, null, {sleeveR: 0, noSleeve: true, mode: 'calibrate'}); if (h && Math.hypot(h.p[0]-t[0], h.p[1]-t[1]) < 0.01) hit++; } row['tick' + px] = hit / n; }
    rows.push(row); }
  out.rows = rows;
  const tw = PMsnap.nearestPerpWall([M.towall.x, M.towall.y], null, 2592); out.towall = tw && { foot: tw.foot, onSeg: tw.onSeg };
  const sh = PMsnap.nearestPerpWall([M.short.x, M.short.y], [M.short.x, M.short.y + 100], 2592); out.short = sh && { foot: sh.foot, onSeg: sh.onSeg, ext: !!sh.ext };
  return out; }"""
LENS = """async ([fx, fy]) => { const vp = document.querySelector('#viewport'); const ev = (type, x, y) => vp.dispatchEvent(new PointerEvent(type, {pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, button: 0, buttons: 1}));
  ev('pointerdown', fx - 30, fy + 20); for (let i = 1; i <= 6; i++) ev('pointermove', fx - 30 + 5 * i, fy + 20 - 20 * i / 6);
  await new Promise(r => setTimeout(r, 400));
  const c = document.querySelector('#loupe'), l = c.getBoundingClientRect(), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let ink = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i+1] + d[i+2] < 600) ink++;
  const bad = getComputedStyle(c).display === 'none' || (fx > l.left - 14 && fx < l.right + 14 && fy > l.top - 14 && fy < l.bottom + 14) || l.top > fy || l.left < 0 || l.top < 0 || l.right > innerWidth || l.bottom > innerHeight || ink < 20;
  ev('pointercancel', fx, fy); return bad ? [fx, fy, Math.round(l.left), Math.round(l.top)] : null; }"""
MOVE = """async (N) => { PM.setTool('line'); PM.setZoom(0.3);
  for (let i = 0; i < N; i++) PM.proj.items.push({ id: 's' + i, type: 'sleeve', page: 1, pts: [[300 + (i % 50) * 40, 320 + Math.floor(i / 50) * 50]], color: '#e53935', label: '4" VENT 900L', size: '4"', text: '' });
  const vp = document.querySelector('#viewport'), r = vp.getBoundingClientRect(), ev = (type, x, y) => vp.dispatchEvent(new PointerEvent(type, {pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, button: 0, buttons: 1}));
  ev('pointerdown', r.left + 150, r.top + 300); const t0 = performance.now();
  for (let i = 1; i <= 30; i++) ev('pointermove', r.left + 150 + i * 2, r.top + 300 + i);
  const per = (performance.now() - t0) / 30; ev('pointercancel', 0, 0); await new Promise(r => setTimeout(r, 50));
  return { per, drawn: document.querySelectorAll('#svg g[data-id]').length }; }"""
def phone(b, mobile=True):
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=mobile, has_touch=True); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:120])); return ctx, pg, errs
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx, pg, errs = phone(b); pg.goto(URL); pg.set_input_files('#file2', 'test/sample-site.pdf'); pg.wait_for_function('window.PM && PM.proj', timeout=60000); pg.wait_for_timeout(800)
    pg.evaluate(READY); pg.wait_for_function('PMsnap.geom[1] && PMsnap.geom[1].sleeve && PMsnap.geom[1].sleeve.complete', timeout=120000)
    o = pg.evaluate(PROBE, META); print(json.dumps(o['rows']))
    for col, (f, n) in o['detected'].items(): chk(f'{col} marks found {f}/{n}', f == n)
    for r in o['rows']:
        z = r['zoom']
        chk(f'zoom {z}: catch radius is a fingertip on screen ({r["radius_px"]:.0f} px)', r['radius_px'] >= 20)
        chk(f'zoom {z}: 6 px miss on a mark locks to its centre ({r["mark6"]:.0%})', r['mark6'] >= 0.95)
        chk(f'zoom {z}: 10 px miss on a mark locks to its centre ({r["mark10"]:.0%})', r['mark10'] >= 0.88)
        chk(f'zoom {z}: aim on a wall stays on the wall, arrow tip 5 pt away ({r["wall"]:.0%})', r['wall'] == 1)
        chk(f'zoom {z}: revision cloud and red markup never lock', r['markup'] == 0)
        chk(f'zoom {z}: Set scale, 4 px miss lands on the tick crossing ({r["tick4"]:.0%})', r['tick4'] >= 0.85)
        if z >= 1: chk(f'zoom {z}: Set scale, 8 px miss lands on the tick crossing ({r["tick8"]:.0%})', r['tick8'] == 1)
    tw, sh = o['towall'], o['short']
    chk('to wall: the wall beside the sleeve, not the far wall whose line passes close', tw and tw['onSeg'] and abs(tw['foot'][0] - META['towall']['near_wall_x']) < 0.01, tw)
    chk('to wall: a wall that stops short is continued', sh and sh['ext'] and not sh['onSeg'] and abs(sh['foot'][1] - META['short']['wall_y']) < 0.01, sh)
    u = pg.evaluate("""() => ({ a: Units.parseLength('5,000','mm'), b: Units.parseLength('5 000','mm'), c: Units.parseLength('12,5','mm'), d: Units.parseLength('1.250.5','mm'), e: Units.parseLength('64,650','met'), f: Units.parseLength("16'-4\\"",'mm'),
      l: ['4" VENT 900L', '3" SAN 1200 LG', 'L=450', '4" VENT', 'LEVEL 2', '2" CW 600 LONG'].map(PM.labelLength) })""")
    chk('typed 5,000 and 5 000 are 5000 mm', abs(u['a'] - 5) < 1e-9 and abs(u['b'] - 5) < 1e-9, u)
    chk('typed 12,5 is 12.5 mm; 1.250.5 is refused; 64,650 m stays 64.650', abs(u['c'] - 0.0125) < 1e-12 and u['d'] != u['d'] and abs(u['e'] - 64.65) < 1e-9, u)
    chk('feet-inches still read', abs(u['f'] - 4.9784) < 1e-6, u)
    chk('printed sleeve lengths read from labels', u['l'] == [0.9, 1.2, 0.45, None, None, 0.6], u['l'])
    h = pg.evaluate("""() => { PM.setSlabDefault(1, { tos: 64.8, thk: 0.25, ext: 0 }); const mk = (id, label) => { const it = { id, type: 'sleeve', page: 1, pts: [[500, 500]], color: '#e53935', label, size: '4"', text: '' }; PM.proj.items.push(it); return PM.sleeveHeight(it); };
      const a = mk('L1', '4" VENT 900L'), b = mk('L2', '4" VENT 250L'), c = mk('L3', '4" VENT'); const csv = PM.buildSleeveCSV(); PM.proj.items.splice(-3, 3);
      return { a: [a.labelLen, a.len, a.lenFlag], b: [b.labelLen, b.lenFlag], c: [c.labelLen, c.lenFlag], csv: csv.split('\\r\\n').slice(3, 7) }; }""")
    chk('label 900L is the length (not the 250 mm slab) and the mismatch is flagged', h['a'][0] == 0.9 and abs(h['a'][1] - 0.25) < 1e-9 and '900' in h['a'][2] and '250' in h['a'][2], h)
    chk('label matching the structure has no flag; a label without a length stays blank and is flagged', h['b'] == [0.25, ''] and h['c'] == [None, 'no length on label'], h)
    chk('CSV has printed length, structure depth and check columns', 'Sleeve length (as printed)' in h['csv'][0] and '900 mm' in h['csv'][1] and 'no length on label' in h['csv'][3], h['csv'])
    pg.evaluate("PM.setZoom(1.2); PM.setTool('line')"); pg.evaluate("(()=>{const v=document.querySelector('#viewport'); v.scrollLeft=500; v.scrollTop=1500})()"); pg.wait_for_timeout(1200)
    top = pg.evaluate("Math.round(document.querySelector('#viewport').getBoundingClientRect().top)")
    bad = [r for r in (pg.evaluate(LENS, [fx, fy]) for fx in (40, 195, 350) for fy in (top + 20, top + 60, top + 110, top + 170, 400, 640)) if r]
    chk('lens shown, on screen, has plan in it and is never under or below the fingertip (18 positions)', not bad, bad)
    chk('no page errors', not errs, errs); ctx.close()
    ctx, pg, errs = phone(b); warns = []; pg.on('console', lambda m: warns.append(m.text) if 'blank buffer' in m.text else None)
    pg.goto(URL); pg.set_input_files('#file2', 'test/sample-blank-corner.pdf'); pg.wait_for_function('window.PM && PM.proj', timeout=60000); pg.wait_for_timeout(4000)
    bw = pg.evaluate("document.querySelector('#canvasBase').width")
    chk(f'sheet with a blank corner and centre keeps a full-size page bitmap ({bw} px wide, {len(warns)} retries)', bw >= 800 and not warns); ctx.close()
    ctx, pg, errs = phone(b); pg.goto(URL); pg.set_input_files('#file2', 'test/sample-site.pdf'); pg.wait_for_function('window.PM && PM.proj', timeout=60000); pg.wait_for_timeout(2500)
    ctx.new_cdp_session(pg).send('Emulation.setCPUThrottlingRate', {'rate': 4})
    m = pg.evaluate(MOVE, 1000)
    chk(f'1,000 placed sleeves: one finger move while dragging takes {m["per"]:.0f} ms at 4x CPU slowdown (was about 430)', m['per'] < 120)
    chk('all placed sleeves are drawn after the drag', m['drawn'] >= 1000, m)
    chk('no page errors (heavy)', not errs, errs); ctx.close(); b.close()
print('RULES PASS' if ok else 'RULES FAIL'); sys.exit(0 if ok else 1)
