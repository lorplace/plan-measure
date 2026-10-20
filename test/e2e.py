import sys, http.server, threading, functools, os
from playwright.sync_api import sync_playwright
os.chdir(os.path.dirname(os.path.abspath(__file__))+'/..')
URL=sys.argv[1] if len(sys.argv)>1 else None
if not URL:
    srv=http.server.ThreadingHTTPServer(('127.0.0.1',8765),functools.partial(http.server.SimpleHTTPRequestHandler,directory='.'))
    threading.Thread(target=srv.serve_forever,daemon=True).start(); URL='http://127.0.0.1:8765/'
H=792; IN=72; MM=72/25.4
ok=True
def check(name,got,exp):
    global ok; err=abs(got-exp)/exp*100; good=err<1; ok&=good
    print(f"{'PASS' if good else 'FAIL'} {name}: got {got:.4f} expected {exp:.4f} err {err:.3f}%")
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1400,'height':900}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: m.type=='error' and errs.append(m.text))
    pg.goto(URL); pg.set_input_files('#file','test/sample-plan.pdf'); pg.wait_for_function('window.PM.doc && window.PM.proj')
    pg.wait_for_timeout(500)
    def scr(x,y):
        r=pg.evaluate("(()=>{const r=document.querySelector('#svg').getBoundingClientRect();return [r.left,r.top]})()"); z=pg.evaluate('PM.zoom')
        return r[0]+x*z, r[1]+(H-y)*z
    def click(x,y,**k): pg.mouse.click(*scr(x,y),**k); pg.wait_for_timeout(80)
    # page 1: standard scale 1/4"=1'-0"
    pg.click('#scaleBtn'); pg.select_option('#stdScale',label='1/4" = 1\'-0"'); pg.click('#stdOk')
    pg.click('[data-tool=line]'); click(144,200); click(144+5*IN,200)
    pg.click('[data-tool=area]')
    for x,y in [(144,260),(144+5*IN,260),(144+5*IN,260+2.5*IN),(144,260+2.5*IN)]: click(x,y)
    pg.click('#finishBtn')
    # polyline with shift-ortho: L shaped run 20' + 10' with a slightly off click snapped by Shift
    pg.click('[data-tool=poly]'); click(144,260); click(144+5*IN,260)
    pg.keyboard.down('Shift'); click(144+5*IN+4,260+2.5*IN); pg.keyboard.up('Shift'); pg.click('#finishBtn')
    pg.click('[data-tool=count]'); pg.fill('#label','WC'); click(500,500); click(520,500); click(540,500)
    items=pg.evaluate('PM.proj.items.map(i=>({t:i.type,v:PM.measure(i),p:i.pts}))'); print(items, pg.evaluate('[PM.proj.scales,PM.zoom]'))
    FT=0.3048
    check('p1 line 20ft (ft)',items[0]['v']/FT,20); check('p1 area 200 sf',items[1]['v']/FT/FT,200); check('p1 pipe run 30ft (shift snap)',items[2]['v']/FT,30)
    print('counts',sum(1 for i in items if i['t']=='count'))
    # page 2: calibrate on the 5 m line, then measure the 4x3 m rectangle
    pg.click('#next'); pg.wait_for_timeout(400); pg.select_option('#units','met')
    pg.click('[data-tool=calibrate]'); click(144,300); click(144+50*MM,300); pg.click('#calSetBtn'); pg.fill('#calVal','5000mm'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    pg.click('[data-tool=line]'); click(144,400); click(144+40*MM,400)
    pg.click('[data-tool=area]')
    for x,y in [(144,400),(144+40*MM,400),(144+40*MM,400+30*MM),(144,400+30*MM)]: click(x,y)
    pg.click('#finishBtn')
    it=pg.evaluate('PM.proj.items.filter(i=>i.page===2).map(i=>PM.measure(i))')
    check('p2 calibrated line 4 m',it[0],4); check('p2 area 12 m2',it[1],12)
    sc=pg.evaluate('PM.proj.scales[2]'); check('p2 scale vs 1:100 theoretical',sc,0.0254/72*100)
    csv=pg.evaluate('PM.buildCSV()'); open('test/out-takeoff.csv','w').write(csv)
    pdf=pg.evaluate('PM.buildPDF().then(b=>Array.from(b))'); open('test/out-marked.pdf','wb').write(bytes(pdf))
    pg.screenshot(path='test/screen.png')
    # persistence: reload, project should restore from IndexedDB
    pg.wait_for_timeout(1200); pg.reload(); pg.wait_for_function('window.PM.proj && PM.proj.items.length>0',timeout=10000)
    n=pg.evaluate('PM.proj.items.length'); print('after reload items:',n); ok&= n==len(items)+2
    # tablet emulation smoke
    ctx=b.new_context(viewport={'width':1024,'height':768},has_touch=True,is_mobile=True); tp=ctx.new_page(); tp.goto(URL)
    tp.set_input_files('#file','test/sample-plan.pdf'); tp.wait_for_function('window.PM.proj'); tp.wait_for_timeout(300); tp.click('[data-tool=count]'); tp.tap('#viewport',position={'x':300,'y':300}); tp.wait_for_timeout(200)
    print('tablet tap count items:',tp.evaluate('PM.proj.items.length')); tp.screenshot(path='test/tablet.png')
    print('errors:',errs); b.close()
print('ALL PASS' if ok and not errs else 'SOME FAIL')
