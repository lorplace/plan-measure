import sys
from playwright.sync_api import sync_playwright
URL=sys.argv[1]; H=792; IN=72
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    for w,h in [(1920,1080),(1280,800)]:
        pg=b.new_page(viewport={'width':w,'height':h}); pg.goto(URL)
        pg.set_input_files('#file','test/sample-plan.pdf'); pg.wait_for_function('window.PM.proj'); pg.wait_for_timeout(400)
        def click(x,y):
            r=pg.evaluate("(()=>{const r=document.querySelector('#svg').getBoundingClientRect();return [r.left,r.top]})()"); z=pg.evaluate('PM.zoom')
            pg.mouse.click(r[0]+x*z,r[1]+(H-y)*z); pg.wait_for_timeout(60)
        pg.click('#scaleBtn'); pg.select_option('#stdScale',label='1/4" = 1\'-0"'); pg.click('#stdOk')
        pg.click('[data-tool=line]'); click(144,200); click(144+5*IN,200)
        pg.fill('#color','#1e88e5'); pg.fill('#label','Bathroom'); pg.click('[data-tool=area]')
        for x,y in [(144,260),(504,260),(504,440),(144,440)]: click(x,y)
        pg.click('#finishBtn')
        pg.fill('#color','#2e7d32'); pg.fill('#label','3/4 PEX'); pg.click('[data-tool=poly]')
        for x,y in [(600,200),(800,200),(800,400),(950,400)]: click(x,y)
        pg.click('#finishBtn'); pg.fill('#color','#e53935'); pg.fill('#label','WC'); pg.click('[data-tool=count]')
        for x in (200,260,320): click(x,400)
        pg.click('[data-tool=select]'); pg.wait_for_timeout(500)
        pg.screenshot(path=f'shots/desktop-{w}.png')
        pg.click('#panelClose'); pg.wait_for_timeout(400); pg.screenshot(path=f'shots/desktop-{w}-panel-hidden.png'); pg.close()
    b.close()
