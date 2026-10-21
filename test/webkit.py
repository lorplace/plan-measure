# WebKit (iOS Safari engine) phone smoke test: taps work at start-up, after opening a CAD file, and after reload with a saved CAD project
import sys
from playwright.sync_api import sync_playwright
URL=sys.argv[1]; ok=True
def chk(n,c):
    global ok; ok&=bool(c); print(('PASS ' if c else 'FAIL ')+n)
def opens(pg,t=4000):
    try:
        with pg.expect_file_chooser(timeout=t): pg.tap('#bar label.btn')
        return True
    except Exception: return False
with sync_playwright() as p:
    b=p.webkit.launch(); ctx=b.new_context(**p.devices['iPhone 13']); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(800)
    chk('start-up: no JS errors '+str(errs), not errs)
    chk('tap Open shows the file picker', opens(pg))
    pg.tap('[data-tool=line]'); chk('tap a tool makes it active', 'active' in pg.get_attribute('[data-tool=line]','class'))
    pg.tap('[data-tool=select]')
    pg.set_input_files('#file','test/sample-sleeves.dxf'); pg.wait_for_function('window.PM.doc && PM.doc.cad',timeout=60000)
    pg.tap('#slvCountTool'); pg.wait_for_timeout(300); chk('sleeve count panel opens', pg.evaluate('slvDlg.open'))
    pg.tap('#slvDlg button[value=cancel]'); pg.wait_for_timeout(200); chk('panel closes', not pg.evaluate('slvDlg.open'))
    pg.tap('#moreBtn'); pg.wait_for_timeout(200); pg.tap('#moreMenu [data-proxy="#saveBtn"]'); pg.wait_for_timeout(800)
    pg.reload(); pg.wait_for_timeout(1000)
    chk('after reload with a saved CAD project: Open still responds (no auto re-parse)', opens(pg,3000))
    chk('Continue button offered', pg.is_visible('#resumeBtn'))
    pg.tap('#resumeBtn'); pg.wait_for_function('window.PM.doc && PM.doc.cad',timeout=60000); chk('Continue reopens the project', pg.evaluate('PM.proj.items.length')>=0)
    chk('no JS errors '+str(errs), not errs)
print('WEBKIT PASS' if ok else 'WEBKIT FAIL'); sys.exit(0 if ok else 1)
