# Sleeve count panel: visible button on phone tool bar and desktop top bar, totals by size/layer, Find sleeves shortcut, CSV
import sys
from playwright.sync_api import sync_playwright
URL=sys.argv[1]; ok=True
def chk(n,c):
    global ok; ok&=bool(c); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    # desktop
    pg=b.new_page(viewport={'width':1600,'height':950}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); chk('desktop: Sleeve count button visible in top bar', pg.is_visible('#slvCountBtn') and not pg.is_visible('#slvCountTool'))
    pg.set_input_files('#file','test/sample-sleeves.dxf'); pg.wait_for_function('window.PM.proj && PM.doc.cad'); pg.wait_for_timeout(300)
    pg.click('#slvCountBtn'); pg.wait_for_timeout(200)
    chk('empty: total 0 and Find sleeves offered', pg.inner_text('#slvTotal')=='0' and pg.is_visible('#slvFind') and 'primary' in pg.get_attribute('#slvFind','class') and pg.is_disabled('#slvCsv'))
    pg.click('#slvFind'); pg.wait_for_timeout(300); chk('Find sleeves opens review from the panel', pg.evaluate('PM.FS && PM.FS.cands.length')==12)
    pg.click('#findAdd'); pg.wait_for_timeout(500); pg.click('#slvCountBtn'); pg.wait_for_timeout(200)
    c=pg.evaluate('PM.sleeveCounts()'); print(c)
    sz=dict(c['bySize'])
    chk(f"total {pg.inner_text('#slvTotal')} = 12", pg.inner_text('#slvTotal')=='12' and c['total']==12)
    chk('per size counts', sz=={'2"':1,'3"':1,'4"':2,'6"':3,'8"':1,'12"':2,'100mm':1,'DN100':1})
    chk('per layer counts', dict(c['byLayer'])=={'MISC':4,'P-SLEEVE':3,'PEN':1,'WALLS':4})
    with pg.expect_download() as d: pg.click('#slvCsv')
    chk('Export sleeves CSV from the panel: '+d.value.suggested_filename, d.value.suggested_filename.endswith('-sleeves.csv'))
    pg.screenshot(path='shots/desktop-sleeve-count.png'); pg.click('#slvDlg button[value=cancel]')
    chk('no page errors '+str(errs), not errs)
    # phone
    ctx=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2); pg=ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); pg.set_input_files('#file','test/sample-sleeves.dxf'); pg.wait_for_function('window.PM.proj && PM.doc.cad'); pg.wait_for_timeout(300)
    idx=pg.evaluate("[...document.querySelectorAll('#tools > *')].filter(e=>getComputedStyle(e).display!=='none').findIndex(e=>e.id==='slvCountTool')")
    bb=pg.locator('#slvCountTool').bounding_box()
    chk(f'phone: Sleeves button in bottom tool bar position {idx+1}, on screen', 0<=idx<=2 and bb and bb['x']+bb['width']<=390 and bb['y']>700 and not pg.is_visible('#slvCountBtn'))
    pg.tap('#slvCountTool'); pg.wait_for_timeout(200); pg.tap('#slvFind'); pg.wait_for_timeout(300); pg.tap('#findAdd'); pg.wait_for_timeout(400)
    pg.tap('#slvCountTool'); pg.wait_for_timeout(300); chk('phone: total 12 after Find + Add', pg.inner_text('#slvTotal')=='12')
    pg.screenshot(path='shots/phone-sleeve-count.png')
    chk('no page errors '+str(errs), not errs)
print('COUNT PASS' if ok else 'COUNT FAIL'); sys.exit(0 if ok else 1)
