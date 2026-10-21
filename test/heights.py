# Sleeve heights: level default, slab zone drawn with the Slab zone tool, elevation text near a sleeve, per-sleeve override,
# label, Sleeve count table, CSV columns, PDF export, feet-inches, undo, saved with the project
import sys, csv, io
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; ok = True
def chk(n, c):
    global ok; ok &= bool(c); print(('PASS ' if c else 'FAIL ') + n)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1600, 'height': 950}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.set_input_files('#file', 'test/sample-heights.dxf'); pg.wait_for_function('window.PM.proj && PM.doc.cad'); pg.wait_for_timeout(300)
    pg.evaluate("PM.proj.units='met'")
    pg.click('#slvCountBtn'); pg.wait_for_timeout(200); pg.click('#slvFind'); pg.wait_for_timeout(300); pg.click('#findAdd'); pg.wait_for_timeout(400)
    S = "PM.proj.items.filter(i=>i.type==='sleeve').sort((a,b)=>a.pts[0][0]-b.pts[0][0]||b.pts[0][1]-a.pts[0][1])"
    chk('3 sleeves found', pg.evaluate(S + '.length') == 3)
    H = lambda: pg.evaluate(S + '.map(s=>{const h=PM.sleeveHeight(s);return [h.tos,h.thk,h.top,h.bot,h.len,h.src]})')
    h = H(); print(h)
    # sleeves sorted by x then y desc: s0 (5000,5000), s1 (15000,8000, has text), s2 (15000,5000) -- y is flipped on screen
    chk('elevation text read automatically (T/O SLAB 64,650)', any(abs((r[0] or 0) - 64.65) < 1e-6 and r[5] == 'text on plan' for r in h))
    chk('others have no height yet', sum(r[0] is None for r in h) == 2)
    # level default through the panel
    pg.click('#slvCountBtn'); pg.wait_for_timeout(200)
    pg.fill('#dTos', '64,800'); pg.press('#dTos', 'Tab'); pg.wait_for_timeout(100)
    pg.fill('#dThk', '250'); pg.press('#dThk', 'Tab'); pg.wait_for_timeout(300)
    h = H(); print(h)
    dflt = [r for r in h if r[5] == 'level default']
    chk('level default 64.800 / 250 mm -> top 64.800 bottom 64.550 length 250', len(dflt) == 2 and all(abs(r[2] - 64.8) < 1e-9 and abs(r[3] - 64.55) < 1e-9 and abs(r[4] - 0.25) < 1e-9 for r in dflt))
    chk('text sleeve uses default thickness: bottom 64.400', any(r[5] == 'text on plan' and abs(r[3] - 64.4) < 1e-9 for r in h))
    tbl = pg.inner_text('#slabBox'); print(tbl.replace('\n', ' | '))
    chk('Sleeve count shows By height table', '64.800 m' in tbl and '64.550 m' in tbl and '64.650 m' in tbl)
    pg.click('#slvDlg button[value=cancel]')
    # draw a slab zone around the sleeve at (15000,5000) with the Slab zone tool
    info = pg.evaluate("(()=>{const s=" + S + ";const r=document.querySelector('#svg').getBoundingClientRect();return {l:r.left,t:r.top,z:PM.zoom,a:s[0].pts[0],c:s.filter(x=>PM.sleeveHeight(x).src!=='text on plan').pop().pts[0]}})()")
    d = (info['c'][0] - info['a'][0]) / 10000 * 1500  # 1.5 m in page units
    cx, cy = info['c']
    sc = lambda x, y: (info['l'] + x * info['z'], info['t'] + y * info['z'])
    pg.click('#zoneTool')
    for dx, dy in [(-d, -d), (d, -d), (d, d), (-d, d)]: pg.mouse.click(*sc(cx + dx, cy + dy)); pg.wait_for_timeout(80)
    pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    chk('Slab zone tool made a zone area and selected it', pg.evaluate("(()=>{const z=PM.proj.items.find(i=>i.type==='area');return !!(z&&z.slab)})()") and pg.is_visible('#eZoneRow'))
    pg.fill('#eZTos', '64.300'); pg.press('#eZTos', 'Tab'); pg.fill('#eZThk', '300mm'); pg.press('#eZThk', 'Tab'); pg.wait_for_timeout(300)
    h = H(); print(h)
    chk('zone sleeve: TOS 64.300, bottom 64.000, length 300 mm', any(r[5].startswith('zone') and abs(r[0] - 64.3) < 1e-9 and abs(r[3] - 64.0) < 1e-9 and abs(r[4] - 0.3) < 1e-9 for r in h))
    chk('other default sleeve unchanged', sum(r[5] == 'level default' for r in h) == 1)
    # override + extension on the first sleeve through the edit panel
    sid = pg.evaluate(S + '[0].id'); pg.evaluate(f"PM.setTool('select')")
    a = sc(*info['a']); pg.mouse.click(*a); pg.wait_for_timeout(300)
    chk('sleeve edit shows height info', pg.is_visible('#eHtRow') and 'Top of slab' in pg.inner_text('#eHtInfo'))
    pg.fill('#eTos', '64.775'); pg.press('#eTos', 'Tab'); pg.fill('#eExt', '50'); pg.press('#eExt', 'Tab'); pg.wait_for_timeout(300)
    r = pg.evaluate(f"(()=>{{const h=PM.sleeveHeight(PM.proj.items.find(i=>i.id=='{sid}'));return [h.src,h.top,h.bot,h.len]}})()"); print(r)
    chk('override 64.775 + 50 mm extension: top 64.825 bottom 64.525 length 300', r[0] == 'override' and abs(r[1] - 64.825) < 1e-9 and abs(r[2] - 64.525) < 1e-9 and abs(r[3] - 0.3) < 1e-9)
    pg.screenshot(path='test/out-heights.png')
    # CSV
    c = list(csv.reader(io.StringIO(pg.evaluate('PM.buildSleeveCSV()'))))
    hi = next(i for i, r in enumerate(c) if 'Height from' in r); hd = c[hi]; c = c[hi:]; print(hd[-6:])
    chk('CSV height columns', hd[-6:] == ['Top of slab', 'Slab thickness', 'Top of sleeve', 'Bottom of sleeve', 'Sleeve length', 'Height from'])
    chk('CSV values', any(row[-4] == '64.825 m' and row[-3] == '64.525 m' and row[-2] == '300 mm' and row[-1] == 'override' for row in c[1:]) and any(row[-1] == 'text on plan' and row[-6] == '64.650 m' for row in c[1:]))
    # PDF
    n = pg.evaluate('(async()=>{const b=await PM.buildPDF();return b.length||b.byteLength||b.size})()')
    chk('PDF export works', n and n > 1000)
    # feet-inches
    pg.evaluate("PM.proj.units='imp'"); r = pg.evaluate(S + ".map(s=>PM.sleeveHeight(s))"); csvi = pg.evaluate('PM.buildSleeveCSV()')
    print(csvi.split('Height from')[1][:160])
    chk('feet-inches output', "'" in csvi.split('Height from')[1])
    pg.evaluate("PM.proj.units='met'")
    # undo removes the extension, redo puts it back
    pg.evaluate('PM.undo()'); u = pg.evaluate(f"PM.sleeveHeight(PM.proj.items.find(i=>i.id=='{sid}')).ext"); pg.evaluate('PM.redo()')
    r2 = pg.evaluate(f"PM.sleeveHeight(PM.proj.items.find(i=>i.id=='{sid}')).ext")
    chk('undo/redo covers heights', abs(u) < 1e-9 and abs(r2 - 0.05) < 1e-9)
    # saved with the project
    pg.wait_for_timeout(1500); pg.reload(); pg.wait_for_timeout(500)
    if pg.is_visible('#resumeBtn'): pg.click('#resumeBtn')
    pg.wait_for_function('window.PM.proj && PM.doc && PM.doc.cad'); pg.wait_for_timeout(500)
    r = pg.evaluate(f"(()=>{{const h=PM.sleeveHeight(PM.proj.items.find(i=>i.id=='{sid}'));return [h.src,h.top]}})()")
    chk('heights kept after reload ' + str(r), r[0] == 'override' and abs(r[1] - 64.825) < 1e-9 and pg.evaluate('PM.proj.slab[1] && PM.proj.slab[1].tos') == 64.8)
    chk('no page errors ' + str(errs), not errs)
print('HEIGHTS PASS' if ok else 'HEIGHTS FAIL'); sys.exit(0 if ok else 1)
