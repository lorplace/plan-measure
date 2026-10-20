import sys, subprocess
from playwright.sync_api import sync_playwright
URL=sys.argv[1]; H=792; ok=True
def chk(n,c):
    global ok; ok&=bool(c); print(('PASS ' if c else 'FAIL ')+n)
subprocess.run(['pdftoppm','-r','72','-png','-singlefile','-f','1','-l','1','test/sample-plan.pdf','test/sample-scan'],check=True)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    for kind,file in [('pdf','test/sample-plan.pdf'),('image','test/sample-scan.png')]:
        pg=b.new_page(viewport={'width':1600,'height':950}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto(URL); pg.set_input_files('#file',file); pg.wait_for_function('window.PM.proj'); pg.wait_for_timeout(800)
        pg.evaluate('PMsnap.buildGeom(1)'); pg.wait_for_timeout(300)
        if kind=='pdf': print('segments extracted:', pg.evaluate('PMsnap.geom[1].segs.length'))
        def scr(x,y):
            r=pg.evaluate("(()=>{const r=document.querySelector('#svg').getBoundingClientRect();return [r.left,r.top]})()"); z=pg.evaluate('PM.zoom'); return r[0]+x*z, r[1]+(H-y)*z
        def last(): return pg.evaluate('PM.proj.items[PM.proj.items.length-1].pts[0]')
        pg.click('[data-tool=count]')
        tol=0.01 if kind=='pdf' else 1.0
        if kind=='pdf':
            x,y=scr(144,200); pg.mouse.move(x+6,y-5); pg.wait_for_timeout(100); hk=pg.evaluate("document.querySelector('#snapG')?.dataset.kind")
            pg.mouse.click(x+6,y-5); q=last(); chk(f'pdf endpoint snap {q} indicator={hk}', abs(q[0]-144)<tol and abs(q[1]-(H-200))<tol and hk=='end')
            x,y=scr(900,450); pg.mouse.move(x+5,y+4); pg.wait_for_timeout(100); hk=pg.evaluate("document.querySelector('#snapG')?.dataset.kind")
            pg.screenshot(path='shots/desktop-snap.png'); pg.mouse.click(x+5,y+4); q=last(); chk(f'pdf intersection snap {q} indicator={hk}', abs(q[0]-900)<tol and abs(q[1]-(H-450))<tol and hk=='x')
        x,y=scr(300,200); pg.mouse.click(x,y-6); q=last(); chk(f'{kind} on-line snap y={q[1]:.3f}', abs(q[1]-(H-200))<tol)
        pg.keyboard.down('Alt'); pg.mouse.click(x,y-6); pg.keyboard.up('Alt'); q=last(); chk(f'{kind} Alt disables snap', abs(q[1]-(H-200))>3)
        # Shift ortho + snap: line from (144,200) going right, end near rect corner x=504 above
        if kind=='pdf':
            pg.click('[data-tool=line]'); a=scr(600,480); pg.mouse.click(*a); pg.keyboard.down('Shift'); b2=scr(903,485); pg.mouse.click(*b2); pg.keyboard.up('Shift')
            q=pg.evaluate('PM.proj.items[PM.proj.items.length-1].pts'); chk(f'shift ortho kept with snap {q}', abs(q[1][1]-q[0][1])<1e-6 and abs(q[1][0]-900)<tol)
            pg.click('#snapBtn'); pg.click('[data-tool=count]'); pg.mouse.click(x,y-6); q=last(); chk('toggle off', abs(q[1]-(H-200))>3); pg.click('#snapBtn')
        chk(kind+' no errors '+str(errs), not errs); pg.close()
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=3,is_mobile=True,has_touch=True); pg=ctx.new_page(); pg.goto(URL)
    pg.set_input_files('#file2','test/sample-plan.pdf'); pg.wait_for_function('window.PM.proj'); pg.wait_for_timeout(800); pg.evaluate('PMsnap.buildGeom(1)')
    pg.tap('[data-tool=line]'); cdp=ctx.new_cdp_session(pg)
    def scr(x,y):
        r=pg.evaluate("(()=>{const r=document.querySelector('#svg').getBoundingClientRect();return [r.left,r.top]})()"); z=pg.evaluate('PM.zoom'); return r[0]+x*z, r[1]+(H-y)*z
    tx,ty=scr(900,450); T=lambda t,x,y: cdp.send('Input.dispatchTouchEvent',{'type':t,'touchPoints':[] if t=='touchEnd' else [{'x':x,'y':y}]})
    T('touchStart',tx+30,ty+30)
    for i in range(1,11): T('touchMove',tx+30-2.8*i,ty+30-2.6*i); pg.wait_for_timeout(20)
    pg.wait_for_timeout(400); pg.wait_for_function("document.querySelector('#loupe').dataset.sharp==='1'",timeout=5000); pg.wait_for_timeout(200)
    pg.screenshot(path='shots/phone-snap.png'); T('touchEnd',0,0); pg.wait_for_timeout(150)
    q=pg.evaluate('PM.draft.pts[0]'); chk(f'phone touch snap to intersection {q}', abs(q[0]-900)<0.01 and abs(q[1]-(H-450))<0.01)
    b.close()
print('SNAP PASS' if ok else 'SNAP FAIL')
