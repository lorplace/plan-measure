import sys, csv, io
from playwright.sync_api import sync_playwright
URL=sys.argv[1]; ok=True
def chk(n,c):
    global ok; ok&=bool(c); print(('PASS ' if c else 'FAIL ')+n)
EXP={(5,5):'4"',(10,5):'6"',(15,5):'100mm',(20,5):'4"',(5,15):'2"',(10,15):'3"',(15,15):'DN100',(20,15):'8"',(29,21):'6"',(29,23):'6"',(32,32):'12"',(36,32):'12"'}
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1600,'height':950}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); pg.set_input_files('#file','test/sample-sleeves.dxf'); pg.wait_for_function('window.PM.proj && PM.doc.cad'); pg.wait_for_timeout(500)
    def scr(wx,wy):
        q=pg.evaluate(f'(()=>{{const c=PM.doc.cad;return [({wx}-c.ox)*c.k,(c.oy-{wy})*c.k]}})()')
        r=pg.evaluate("(()=>{const r=document.querySelector('#svg').getBoundingClientRect();return [r.left,r.top]})()"); z=pg.evaluate('PM.zoom'); return r[0]+q[0]*z, r[1]+q[1]*z
    pg.click('[data-tool=origin]'); x,y=scr(0,0); pg.mouse.click(x+3,y+3); pg.click('[data-tool=select]')
    pg.click('#findBtn'); pg.wait_for_timeout(300)
    C=pg.evaluate('PM.FS.cands.map(c=>({w:PM.doc.cad.toWorld(c.x,c.y),size:c.size,src:c.src,layer:c.layer,name:c.name,raw:c.raw}))')
    chk(f'auto-detect count {len(C)} (expect 12; decoy circle, WC block, FIX-X, DRAIN not included)', len(C)==12)
    got={}
    for c in C:
        k=(round(c['w'][0],6),round(c['w'][1],6)); got[k]=c
    allpos=all(any(abs(k[0]-e[0])<1e-6 and abs(k[1]-e[1])<1e-6 for k in got) for e in EXP)
    chk('every expected position found exactly (incl. nested + rotated/scaled inserts)', allpos)
    for e,sz in EXP.items():
        c=[v for k,v in got.items() if abs(k[0]-e[0])<1e-6 and abs(k[1]-e[1])<1e-6]
        chk(f'  {e}: size {c[0]["size"] if c else None} via {c[0]["src"] if c else ""} {c[0]["raw"] if c else ""} (expect {sz})', c and c[0]['size']==sz)
    grp=pg.evaluate("[...document.querySelectorAll('.fhead')].map(h=>h.innerText.replace(/\\n/g,' '))"); print('groups:',grp)
    pg.screenshot(path='shots/desktop-find-sleeves.png')
    # exclude one via group checkbox toggle then reselect
    pg.uncheck('.fhead input >> nth=0'); n1=pg.evaluate('PM.FS.cands.filter(c=>c.on).length'); pg.check('.fhead input >> nth=0'); chk(f'group checkbox toggles ({n1} -> 12)', n1<12 and pg.evaluate('PM.FS.cands.filter(c=>c.on).length')==12)
    pg.click('#findAdd'); pg.wait_for_timeout(700)
    S=pg.evaluate("PM.proj.items.filter(i=>i.type==='sleeve').map(i=>({w:PM.doc.cad.toWorld(i.pts[0][0],i.pts[0][1]),size:i.size,info:PM.sleeveInfo(i)}))")
    chk(f'added {len(S)} sleeves', len(S)==12)
    s0=[s for s in S if abs(s['w'][0]-29)<1e-6 and abs(s['w'][1]-23)<1e-6][0]
    chk(f"nested sleeve X/Y {s0['info']['X']/0.3048:.6f}, {s0['info']['Y']/0.3048:.6f} ft", abs(s0['info']['X']-29*0.3048)<1e-9 and abs(s0['info']['Y']-23*0.3048)<1e-9)
    rows=list(csv.reader(io.StringIO(pg.evaluate('PM.buildSleeveCSV()').lstrip('\ufeff')))); chk(f'sleeve CSV has {len(rows)-4} rows', len(rows)-4==12)
    pg.click('#findBtn'); pg.wait_for_timeout(300); d=pg.evaluate('[PM.FS.cands.length, PM.FS.cands.filter(c=>c.dup).length, PM.FS.cands.filter(c=>c.on).length]')
    chk(f'second run: {d[0]} found, {d[1]} already added, {d[2]} selectable', d==[12,12,0] and pg.is_disabled('#findAdd')); pg.click('#findCancel')
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(200); chk('one undo removes all added sleeves', pg.evaluate("PM.proj.items.filter(i=>i.type==='sleeve').length")==0)
    # pick one: FIX-X block
    pg.click('#findBtn'); pg.click('#findPick'); x,y=scr(10,35); pg.mouse.click(x+2,y+1); pg.wait_for_timeout(300)
    C=pg.evaluate('PM.FS.cands.map(c=>[c.name,c.size])'); chk(f'pick one block FIX-X -> {len(C)} {C[:1]}', len(C)==3 and all(c[0]=='FIX-X' for c in C))
    pg.click('#findCancel'); pg.click('#findBtn'); pg.click('#findPick'); x,y=scr(22,35.1); pg.mouse.click(x,y); pg.wait_for_timeout(300)
    C=pg.evaluate('PM.FS.cands.map(c=>[c.layer,PM.doc.cad.toWorld(c.x,c.y)])'); chk(f'pick one circle DRAIN r=0.1 -> {len(C)}', len(C)==2 and all(c[0]=='DRAIN' for c in C))
    pg.click('#findCancel')
    pdf=pg.evaluate('PM.buildPDF().then(b=>b.length)'); chk(f'PDF export ok {pdf}', pdf>2000)
    chk(f'no errors {errs}', not errs); pg.close()
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=3,is_mobile=True,has_touch=True); pg=ctx.new_page(); pg.goto(URL)
    pg.set_input_files('#file2','test/sample-sleeves.dxf'); pg.wait_for_function('window.PM.proj && PM.doc.cad'); pg.wait_for_timeout(500)
    pg.tap('#moreBtn'); pg.tap('#moreMenu [data-proxy="#findBtn"]'); pg.wait_for_timeout(5500)
    chk('phone: review list open in sheet', pg.is_visible('#findPanel') and pg.evaluate('PM.FS.cands.length')==12)
    pg.screenshot(path='shots/phone-find-sleeves.png'); pg.tap('#findAdd'); pg.wait_for_timeout(300); chk('phone: add', pg.evaluate("PM.proj.items.filter(i=>i.type==='sleeve').length")==12)
    b.close()
print('FIND PASS' if ok else 'FIND FAIL')
