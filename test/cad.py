import sys, subprocess, csv, io
from playwright.sync_api import sync_playwright
URL=sys.argv[1]; ok=True
def chk(n,c):
    global ok; ok&=bool(c); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    for name,f,unit in [('feet','test/sample-feet.dxf',0.3048),('mm','test/sample-mm.dxf',0.001)]:
        pg=b.new_page(viewport={'width':1600,'height':950}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto(URL); pg.set_input_files('#file',f); pg.wait_for_function('window.PM.proj && PM.doc.cad'); pg.wait_for_timeout(600)
        if name=='mm': pg.select_option('#units','met')
        F=1 if name=='feet' else 304.8
        k=pg.evaluate('PM.doc.cad.k'); sc=pg.evaluate('PM.proj.scales[1]'); chk(f'{name}: auto scale from $INSUNITS ({pg.evaluate("PM.proj.scaleNames[1]")})', abs(sc-unit/k)/(unit/k)<1e-12)
        lay=pg.evaluate("[...document.querySelectorAll('#layerList input')].map(i=>i.dataset.layer)"); chk(f'{name}: layers listed {lay}', {'GRID','WALLS','PIPE','FIXTURES'}<=set(lay))
        pg.evaluate('PMsnap.buildGeom(1)'); pg.wait_for_timeout(200)
        def scr(wx,wy):
            q=pg.evaluate(f'(()=>{{const c=PM.doc.cad;return [({wx}*{F}-c.ox)*c.k,(c.oy-{wy}*{F})*c.k]}})()')
            r=pg.evaluate("(()=>{const r=document.querySelector('#svg').getBoundingClientRect();return [r.left,r.top]})()"); z=pg.evaluate('PM.zoom'); return r[0]+q[0]*z, r[1]+q[1]*z
        W=lambda q: pg.evaluate(f'PM.doc.cad.toWorld({q[0]},{q[1]})')
        def near(a,b2,t=1e-6): return abs(a[0]-b2[0])<t and abs(a[1]-b2[1])<t
        # origin at grid intersection 0,0
        pg.click('[data-tool=origin]'); x,y=scr(0,0); pg.mouse.move(x+6,y-5); pg.mouse.click(x+6,y-5)
        o=W(pg.evaluate('PM.origins[1]')); chk(f'{name}: origin snapped to grid intersection {o}', near(o,[0,0],1e-6*F))
        # sleeve on sleeve point (12.5, 8)
        pg.click('[data-tool=sleeve]'); pg.select_option('#sleeveSize','4"'); x,y=scr(12.5,8); pg.mouse.move(x+5,y+5); pg.mouse.click(x+5,y+5)
        s=W(pg.evaluate('PM.proj.items[0].pts[0]')); chk(f'{name}: sleeve snapped exactly {s}', near(s,[12.5*F,8*F],1e-6*F))
        inf=pg.evaluate('PM.sleeveInfo(PM.proj.items[0])')
        chk(f"{name}: sleeve X/Y from origin {inf['X']:.6f},{inf['Y']:.6f}", abs(inf['X']-12.5*0.3048)<1e-9 and abs(inf['Y']-8*0.3048)<1e-9)
        chk(f"{name}: offsets to nearest walls dx={inf['dx']:.6f} dy={inf['dy']:.6f} layers {inf['rxLayer']},{inf['ryLayer']}", abs(inf['dx']-7.5*0.3048)<1e-9 and abs(inf['dy']-6*0.3048)<1e-9 and inf['rxLayer']=='GRID' and inf['ryLayer']=='WALLS')
        # centre + midpoint snaps (count tool)
        pg.click('[data-tool=count]'); x,y=scr(20,15); pg.mouse.move(x+1,y+1); kd=pg.evaluate("document.querySelector('#snapG')?.dataset.kind"); pg.mouse.click(x+1,y+1)
        c=W(pg.evaluate('PM.proj.items.at(-1).pts[0]')); chk(f'{name}: circle centre snap kind={kd} {c}', kd=='center' and near(c,[20*F,15*F],1e-6*F))
        x,y=scr(30,5); pg.mouse.move(x+4,y-3); kd=pg.evaluate("document.querySelector('#snapG')?.dataset.kind"); pg.mouse.click(x+4,y-3)
        c=W(pg.evaluate('PM.proj.items.at(-1).pts[0]')); chk(f'{name}: midpoint snap kind={kd} {c}', kd=='mid' and near(c,[30*F,5*F],1e-6*F))
        # length grid 0,0 -> 20,0 via snapping
        pg.click('[data-tool=line]'); x,y=scr(0,0); pg.mouse.click(x+5,y+5); x,y=scr(20,0); pg.mouse.click(x-5,y+4)
        L=pg.evaluate('PM.measure(PM.proj.items.at(-1))'); chk(f'{name}: length grid A-B {L/0.3048:.9f} ft', abs(L-20*0.3048)<1e-9)
        if name=='feet': pg.screenshot(path='shots/desktop-cad-sleeve.png')
        csvt=pg.evaluate('PM.buildSleeveCSV()'); open(f'test/out-sleeves-{name}.csv','w').write(csvt)
        rows=list(csv.reader(io.StringIO(csvt.lstrip('\ufeff')))); hdr=rows[3]; r=dict(zip(hdr,rows[4]))
        exp=('12.5000','8.0000') if name=='feet' else ('3.8100','2.4384')
        xk=[h for h in hdr if h.startswith('X (')][0]; yk=[h for h in hdr if h.startswith('Y (')][0]
        chk(f"{name}: sleeve CSV {r['ID']} {r['Size']} X={r['X from origin']} ({r[xk]}) Y={r['Y from origin']} ({r[yk]})", r[xk]==exp[0] and r[yk]==exp[1] and r['Size']=='4"')
        # layer toggle off GRID -> no grid snap
        n0=pg.evaluate('PMsnap.geom[1].segs.length'); pg.uncheck('#layerList input[data-layer="GRID"]'); pg.wait_for_timeout(300); pg.evaluate('PMsnap.buildGeom(1)'); pg.wait_for_timeout(200)
        n1=pg.evaluate('PMsnap.geom[1].segs.length'); chk(f'{name}: hiding GRID layer removes geometry {n0}->{n1}', n1==n0-5)
        pg.keyboard.press('Control+z'); pg.wait_for_timeout(300); chk(f'{name}: undo restores layer', pg.is_checked('#layerList input[data-layer="GRID"]'))
        pdf=bytes(pg.evaluate('PM.buildPDF().then(b=>Array.from(b))')); open(f'test/out-{name}.pdf','wb').write(pdf); chk(f'{name}: marked PDF export {len(pdf)} bytes', len(pdf)>2000)
        chk(f'{name}: no errors {errs}', not errs); pg.close()
    # unitless
    pg=b.new_page(viewport={'width':1600,'height':950}); pg.goto(URL); pg.set_input_files('#file','test/sample-unitless.dxf'); pg.wait_for_function('window.PM.proj && PM.doc.cad'); pg.wait_for_timeout(300)
    chk('unitless: no auto scale', not pg.evaluate('PM.proj.scales[1]'))
    pg.click('#scaleBtn'); pg.select_option('#cadUnit','2'); pg.click('#stdOk'); pg.wait_for_timeout(200); k=pg.evaluate('PM.doc.cad.k'); chk('unitless: override to feet', abs(pg.evaluate('PM.proj.scales[1]')*k/0.3048-1)<1e-12); pg.close()
    # DWG
    for fn,expect in [('/tmp/ex_2018.dwg',True),('/tmp/ex_r14.dwg',False)]:
        pg=b.new_page(viewport={'width':1600,'height':950}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.goto(URL); pg.set_input_files('#file',fn)
        if expect:
            pg.wait_for_function('window.PM.doc && PM.doc.cad',timeout=60000); pg.wait_for_timeout(800); n=pg.evaluate('PM.doc.cad.segs.length')
            chk(f'DWG 2018 sample opened: {n} segments, {len(pg.evaluate("PM.doc.cad.layers"))} layers, units {pg.evaluate("PM.doc.cad.unitName")}', n>50); pg.screenshot(path='shots/desktop-dwg.png')
        else:
            pg.wait_for_timeout(8000); t=pg.inner_text('#toast'); chk(f'DWG unreadable file shows advice: {t[:90]}', 'DXF' in t or pg.evaluate('!!(PM.doc&&PM.doc.cad)'))
        pg.close()
    # phone screenshot
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=3,is_mobile=True,has_touch=True); pg=ctx.new_page(); pg.goto(URL)
    pg.set_input_files('#file2','test/sample-feet.dxf'); pg.wait_for_function('window.PM.proj && PM.doc.cad'); pg.wait_for_timeout(500)
    pg.evaluate("document.querySelector('[data-tool=sleeve]').scrollIntoView()"); pg.tap('[data-tool=sleeve]')
    r=pg.evaluate("(()=>{const r=document.querySelector('#svg').getBoundingClientRect();return [r.left,r.top]})()"); z=pg.evaluate('PM.zoom')
    q=pg.evaluate('(()=>{const c=PM.doc.cad;return [(12.5-c.ox)*c.k,(c.oy-8)*c.k]})()'); pg.touchscreen.tap(r[0]+q[0]*z, r[1]+q[1]*z); pg.wait_for_timeout(300)
    pg.wait_for_timeout(5500); pg.screenshot(path='shots/phone-cad-sleeve.png'); b.close()
print('CAD PASS' if ok else 'CAD FAIL')
