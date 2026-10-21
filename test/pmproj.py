# Project file round trip: desktop Chrome saves .pmproj (CAD geometry + sleeves), iPhone WebKit opens it without the DWG/DXF converter
# usage: pmproj.py URL [cadfile] [out.pmproj]
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; F = sys.argv[2] if len(sys.argv) > 2 else 'test/sample-sleeves.dxf'; OUT = sys.argv[3] if len(sys.argv) > 3 else 'test/out-project.pmproj'; ok = True
def chk(n, c):
    global ok; ok &= bool(c); print(('PASS ' if c else 'FAIL ') + n)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']); pg = b.new_page(viewport={'width': 1400, 'height': 900}); pg.set_default_timeout(180000)
    pg.goto(URL); pg.set_input_files('#file', F); pg.wait_for_function('window.PM.doc && PM.doc.cad')
    pg.click('#findBtn'); pg.wait_for_timeout(300); pg.click('#findAdd'); pg.wait_for_timeout(300)
    n0 = pg.evaluate('[PM.doc.cad.nSegs, PM.proj.items.length]')
    with pg.expect_download() as d: pg.evaluate("document.querySelector('#pmprojBtn').click()")
    d.value.save_as(OUT); print('saved', OUT, n0); b.close()
    w = p.webkit.launch(); ctx = w.new_context(**p.devices['iPhone 13']); pg = ctx.new_page(); pg.set_default_timeout(180000); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.evaluate("(()=>{window.__noparse=0; const P=CAD.parseInWorker; CAD.parseInWorker=(...a)=>{window.__noparse++; return P(...a)}})()")
    pg.set_input_files('#file', OUT); pg.wait_for_function('window.PM.doc && PM.doc.cad && PM.proj')
    n1 = pg.evaluate('[PM.doc.cad.nSegs, PM.proj.items.length]')
    chk(f'phone opens project file: segments and items {n1} == {n0}', n1 == n0)
    chk('no DWG/DXF parsing on the phone', pg.evaluate('window.__noparse') == 0)
    pg.tap('#slvCountTool'); pg.wait_for_timeout(300); chk('sleeve count works after opening', pg.inner_text('#slvTotal') == str(n0[1]))
    chk('no errors ' + str(errs), not errs)
print('PMPROJ PASS' if ok else 'PMPROJ FAIL'); sys.exit(0 if ok else 1)
