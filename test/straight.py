# Auto straight (level / plumb / 45 degree lock, alignment guides, snap precedence, Alt, toggle) + iOS long-press (no selection)
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; ok = True
def chk(n, c):
    global ok; ok &= bool(c); print(('PASS ' if c else 'FAIL ') + n)
def run(pg, label):
    pg.goto(URL); pg.set_input_files('#file', 'test/sample-sleeves.dxf'); pg.wait_for_function('window.PM.doc && PM.doc.cad'); pg.wait_for_timeout(800)
    pg.evaluate("PM.setTool('line'); PMsnap.buildGeom(1)"); pg.wait_for_timeout(300)
    chk(label + 'Auto straight button visible and on', pg.locator('#straightBtn').count() == 1 and 'on' in pg.get_attribute('#straightBtn', 'class'))
    a = pg.evaluate("PM.aim([403, 213.5], [300, 210])")  # ~2 degrees off level, away from drawing lines
    g = pg.evaluate("PM.guide && PM.guide.straight")
    chk(label + f'near level locked exactly {a}', abs(a[1] - 210) < 1e-9 and g)
    a = pg.evaluate("PM.aim([304, 300], [300, 210])"); h = pg.evaluate('PMsnap.hit'); chk(label + f'drawing intersection snap wins over straighten {h}', h and h['kind'] in ('x', 'end') and a == h['p'])
    a = pg.evaluate("PM.aim([303, 250], [300, 210])"); h = pg.evaluate('PMsnap.hit'); chk(label + f'near plumb locked {a} snap={h}', abs(a[0] - 300) < 1e-9 or (h and h['kind'] in ('x', 'end')))
    a = pg.evaluate("PM.aim([352, 258], [300, 210])"); chk(label + f'near 45 degrees locked {a}', abs((a[0] - 300) - (a[1] - 210)) < 1e-9)
    a = pg.evaluate("PM.aim([380, 260], [300, 210])"); chk(label + f'32 degrees left alone {a}', a == [380, 260] or pg.evaluate('PM.guide') is None)
    a = pg.evaluate("PM.aim([403, 213.5], [300, 210], true)"); chk(label + 'Alt turns it off', a == [403, 213.5])
    pg.click('#straightBtn') if label == 'desktop: ' else pg.evaluate("document.querySelector('#straightBtn').click()")
    a = pg.evaluate("PM.aim([403, 213.5], [300, 210])"); chk(label + 'toggle off works', a == [403, 213.5])
    pg.evaluate("document.querySelector('#straightBtn').click()")
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']); pg = b.new_page(viewport={'width': 1500, 'height': 900}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    run(pg, 'desktop: ')
    # alignment with an existing point: draw a line, then aim the next one near its end X
    pg.evaluate("PM.proj.items.push({id:'t1',type:'line',page:1,pts:[[500,400],[520,600]],color:'#e53935',label:''})")
    a = pg.evaluate("PM.aim([521.5, 300], [420, 330])"); chk(f'desktop: aligned to existing X (and not snapped elsewhere) {a}', abs(a[0] - 520) < 1e-9 and pg.evaluate('!!(PM.guide && PM.guide.ax)'))
    # real mouse drawing with the guide visible
    r = pg.evaluate("(()=>{const r=document.querySelector('#svg').getBoundingClientRect();return [r.left,r.top,PM.zoom]})()")
    sc = lambda x, y: (r[0] + x * r[2], r[1] + y * r[2])
    pg.mouse.click(*sc(300, 210)); pg.mouse.move(*sc(420, 214)); pg.wait_for_timeout(200)
    chk('desktop: dashed guide and straight badge drawn', pg.evaluate("document.querySelector('#snapG') && document.querySelector('#snapG').dataset.guide") in ('straight', 'aligned'))
    pg.mouse.click(*sc(420, 214)); pg.wait_for_timeout(200)
    ln = pg.evaluate("PM.proj.items.filter(i=>i.type==='line').pop().pts")
    chk(f'desktop: placed line is exactly level {ln}', abs(ln[0][1] - ln[1][1]) < 1e-9 or (pg.evaluate('PMsnap.hit') is not None))
    chk('desktop: no errors ' + str(errs), not errs)
    w = p.webkit.launch(); ctx = w.new_context(**p.devices['iPhone 13']); pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script('const _spc=Element.prototype.setPointerCapture;Element.prototype.setPointerCapture=function(i){try{_spc.call(this,i)}catch(e){}}')
    run(pg, 'iPhone: ')
    chk('iPhone: Auto straight is in the drawing bar', pg.evaluate("!!document.querySelector('#drawSlot #straightBtn')"))
    # 2 s long press while placing a point: no text selection, callout blocked, point still placed
    pg.evaluate("PM.setTool('line')")
    res = pg.evaluate("""(async()=>{const v=document.querySelector('#viewport'),r=v.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,el=document.elementFromPoint(x,y);
      const TE=(k,n)=>{const e=new Event(k,{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:{length:n}});return e}; const ts=TE('touchstart',1); el.dispatchEvent(ts);
      const pe=(k)=>el.dispatchEvent(new PointerEvent(k,{bubbles:true,cancelable:true,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,pointerId:3}));
      pe('pointerdown'); const cm=new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:x,clientY:y}); await new Promise(r=>setTimeout(r,1000)); el.dispatchEvent(cm);
      const ss=new Event('selectstart',{bubbles:true,cancelable:true}); el.dispatchEvent(ss); await new Promise(r=>setTimeout(r,1000));
      pe('pointerup'); getSelection().selectAllChildren(document.querySelector('#hint')||document.body); el.dispatchEvent(TE('touchend',0));
      const cs=getComputedStyle(document.body);
      return {ts:ts.defaultPrevented, cm:cm.defaultPrevented, ss:ss.defaultPrevented, sel:String(getSelection()), us:cs.webkitUserSelect||cs.userSelect, call:cs.webkitTouchCallout||'', pts:PM.draft?PM.draft.pts.length:0}})()""")
    print(res)
    chk('iPhone long press: touchstart/contextmenu/selectstart blocked', res['ts'] and res['cm'] and res['ss'])
    chk('iPhone long press: no selection, user-select none', res['sel'] == '' and res['us'] == 'none')
    chk('iPhone long press: point still placed', res['pts'] >= 1)
    chk('iPhone: inputs still selectable', pg.evaluate("getComputedStyle(document.querySelector('#label')).webkitUserSelect||getComputedStyle(document.querySelector('#label')).userSelect") in ('text', 'auto'))
    chk('iPhone: no errors ' + str(errs), not errs)
print('STRAIGHT PASS' if ok else 'STRAIGHT FAIL'); sys.exit(0 if ok else 1)
