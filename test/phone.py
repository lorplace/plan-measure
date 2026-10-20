import sys
from playwright.sync_api import sync_playwright
URL=sys.argv[1]; H=792; IN=72; ok=True
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=3,is_mobile=True,has_touch=True)
    pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(400); pg.screenshot(path='shots/phone-empty.png')
    pg.set_input_files('#file2','test/sample-plan.pdf'); pg.wait_for_function('window.PM.proj'); pg.wait_for_timeout(600)
    def tap(x,y):
        r=pg.evaluate("(()=>{const r=document.querySelector('#svg').getBoundingClientRect();return [r.left,r.top]})()"); z=pg.evaluate('PM.zoom')
        pg.touchscreen.tap(r[0]+x*z,r[1]+(H-y)*z); pg.wait_for_timeout(80)
    pg.tap('#scaleInfo'); pg.select_option('#stdScale',label='1/4" = 1\'-0"'); pg.tap('#stdOk')
    pg.tap('[data-tool=line]'); tap(144,200); tap(144+5*IN,200)
    v=pg.evaluate('PM.measure(PM.proj.items[0])')/0.3048; print('phone line ft',v); ok&=abs(v-20)<0.2
    pg.tap('[data-tool=area]'); pg.fill('#label','Bath'); pg.fill('#color','#1e88e5')
    for x,y in [(144,260),(504,260),(504,440)]: tap(x,y)
    pg.screenshot(path='shots/phone-drawing.png'); tap(144,440); pg.tap('#finishBtn')
    a=pg.evaluate('PM.measure(PM.proj.items[1])')/0.3048**2; print('phone area sf',a); ok&=abs(a-200)<2
    pg.evaluate("document.querySelector('[data-tool=count]').scrollIntoView()"); pg.tap('[data-tool=count]'); pg.fill('#label','WC'); pg.fill('#color','#e53935')
    for x in (200,260,320): tap(x,400)
    pg.evaluate("document.querySelector('[data-tool=select]').scrollIntoView()"); pg.tap('[data-tool=select]'); pg.wait_for_timeout(300)
    pg.screenshot(path='shots/phone-markups.png')
    pg.tap('#moreBtn'); pg.wait_for_timeout(200); pg.screenshot(path='shots/phone-menu.png'); pg.tap('#moreBtn')
    pg.tap('#sheetHandle'); pg.wait_for_timeout(400); pg.screenshot(path='shots/phone-sheet.png')
    print('errors',errs); ok&=not errs; b.close()
print('PHONE PASS' if ok else 'PHONE FAIL')
