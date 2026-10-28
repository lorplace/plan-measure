# Menu (phone bottom sheet) + Print mode selection / preview
import sys, os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = sys.argv[1]
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else '/workspace/plan-measure-ui-test')
OUT.mkdir(parents=True, exist_ok=True)
ok = True
def chk(n, c):
    global ok; ok &= bool(c); print(('PASS ' if c else 'FAIL ') + n + ('' if c else f' ({c!r})'))

SAMPLE = 'test/sample-plan.pdf'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    # ---- phone ----
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(300)
    pg.set_input_files('#file2', SAMPLE)
    pg.wait_for_function('window.PM && PM.proj'); pg.wait_for_timeout(500)
    # open overflow menu
    pg.tap('#moreBtn'); pg.wait_for_timeout(350)
    chk('menu open', pg.evaluate("!document.querySelector('#moreMenu').hidden"))
    chk('backdrop open', pg.evaluate("!document.querySelector('#moreBackdrop').hidden"))
    chk('body.menuopen', pg.evaluate("document.body.classList.contains('menuopen')"))
    # menu fits in viewport and can scroll
    dims = pg.evaluate("""() => {
      const m = document.querySelector('#moreMenu'), r = m.getBoundingClientRect(), sc = m.querySelector('.mscroll');
      return { top: r.top, bottom: r.bottom, height: r.height, vh: window.innerHeight,
        scrollH: sc.scrollHeight, clientH: sc.clientHeight, canScroll: sc.scrollHeight > sc.clientHeight + 2 };
    }""")
    chk(f'menu bottom within viewport ({dims["bottom"]:.0f} <= {dims["vh"]})', dims['bottom'] <= dims['vh'] + 1)
    chk('menu not taller than ~78% vh', dims['height'] <= dims['vh'] * 0.85)
    # all expected items present and reachable via scroll
    items = ['Redo','Set scale','Fit page','Save','Projects','Save project file','Export CSV','Find sleeves','Sleeves CSV','Export PDF','Print','Clear page','Delete all of a type']
    for label in items:
        loc = pg.get_by_role('button', name=label, exact=True)
        chk(f'item exists: {label}', loc.count() >= 1)
    # scroll to bottom item and verify visible
    pg.evaluate("document.querySelector('#moreMenu .mscroll').scrollTop = 9999")
    pg.wait_for_timeout(200)
    bb = pg.locator('#delTypeBtn').bounding_box()
    chk('Delete all of a type reachable', bb is not None and bb['y'] + bb['height'] <= dims['vh'] + 2)
    # units default mm
    chk('units default mm', pg.evaluate("document.querySelector('#units2').value") == 'mm')
    # sections present
    chk('grouped sections', pg.evaluate("document.querySelectorAll('#moreMenu .msec').length") >= 5)
    # destructive styling
    chk('clear is danger', pg.evaluate("document.querySelector('#clearPageBtn').classList.contains('danger')"))
    pg.screenshot(path=str(OUT / 'menu-mobile.png'), full_page=False)
    # close on backdrop
    pg.locator('#moreBackdrop').click(position={'x': 10, 'y': 10}, force=True)
    pg.wait_for_timeout(200)
    chk('backdrop closes menu', pg.evaluate("document.querySelector('#moreMenu').hidden"))
    # reopen and open Print
    pg.tap('#moreBtn'); pg.wait_for_timeout(200)
    pg.evaluate("document.querySelector('#moreMenu .mscroll').scrollTop = 9999")
    pg.get_by_role('button', name='Print', exact=True).tap()
    pg.wait_for_timeout(400)
    chk('print mode on', pg.evaluate("document.body.classList.contains('printmode')"))
    chk('print overlay visible', pg.evaluate("!document.querySelector('#printOverlay').hidden"))
    chk('print bar visible', pg.evaluate("!document.querySelector('#printBar').hidden"))
    # default rect is full page
    rect = pg.evaluate('({...PM.printRect})')
    size = pg.evaluate('({...PM.doc.sizes[1]})')
    print('rect', rect, 'size', size)
    chk('default print rect full page', rect and abs(rect['w'] - size['w']) < 1 and abs(rect['h'] - size['h']) < 1 and abs(rect['x']) < 1)
    # shrink selection (API + verify overlay updates)
    ok_set = pg.evaluate("""() => {
      const s = PM.doc.sizes[1];
      PM.setPrintRect({ x: s.w * 0.1, y: s.h * 0.1, w: s.w * 0.5, h: s.h * 0.5 });
      const pr = PM.printRect;
      const box = document.querySelector('#printBox').getBoundingClientRect();
      return !!(pr && Math.abs(pr.w - s.w * 0.5) < 1 && box.width > 20 && box.height > 20);
    }""")
    chk('resized print selection', ok_set)
    pg.screenshot(path=str(OUT / 'print-mode-mobile.png'), full_page=False)
    # build print preview (do not actually open system print dialog)
    preview = pg.evaluate("""async () => {
      const r = await PM.buildPrintPreview();
      return { w: r.cnv.width, h: r.cnv.height, strip: document.querySelector('#printStrip').textContent, img: !!document.querySelector('#printImg').src };
    }""")
    # wait for async
    preview = pg.wait_for_function("""() => window.__pmPrev || null""", timeout=1000) if False else None
    preview = pg.evaluate("""async () => {
      const r = await PM.buildPrintPreview();
      window.__pmPrev = { w: r.cnv.width, h: r.cnv.height, strip: document.querySelector('#printStrip').textContent, hasImg: document.querySelector('#printImg').naturalWidth > 0 };
      return window.__pmPrev;
    }""")
    chk(f'print canvas size ok ({preview["w"]}x{preview["h"]})', preview['w'] > 200 and preview['h'] > 100)
    chk('print strip has title', bool(preview['strip']))
    chk('print img loaded', preview['hasImg'])
    # screenshot the print root by temporarily revealing it
    pg.evaluate("""() => {
      const r = document.querySelector('#printRoot');
      r.style.left='0'; r.style.top='0'; r.style.width='auto'; r.style.height='auto';
      r.style.opacity='1'; r.style.zIndex='9999'; r.style.pointerEvents='none';
      r.style.background='#666'; r.style.padding='8px';
      document.body.classList.add('printpreview');
    }""")
    pg.wait_for_timeout(100)
    # clip to print sheet
    sheet = pg.locator('#printSheet')
    sheet.screenshot(path=str(OUT / 'print-output.png'))
    pg.evaluate("""() => {
      const r = document.querySelector('#printRoot');
      r.removeAttribute('style'); document.body.classList.remove('printpreview');
    }""")
    chk('no page errors phone ' + str(errs), not errs)
    ctx.close()

    # ---- desktop ----
    pg = b.new_page(viewport={'width': 1280, 'height': 800})
    errs2 = []; pg.on('pageerror', lambda e: errs2.append(str(e)))
    pg.goto(URL); pg.set_input_files('#file', SAMPLE); pg.wait_for_function('window.PM && PM.proj'); pg.wait_for_timeout(400)
    chk('desktop print button visible', pg.is_visible('#printBtn'))
    pg.click('#printBtn'); pg.wait_for_timeout(300)
    chk('desktop print mode', pg.evaluate("document.body.classList.contains('printmode')"))
    # defaults
    chk('default landscape', pg.input_value('#printOrient') == 'landscape')
    chk('default letter', pg.input_value('#printPaper') == 'letter')
    chk('fit checked', pg.is_checked('#printFit'))
    prev = pg.evaluate("""async () => { const r = await PM.buildPrintPreview(); return { w:r.cnv.width, h:r.cnv.height }; }""")
    chk(f'desktop print render {prev["w"]}x{prev["h"]}', prev['w'] > 400)
    pg.screenshot(path=str(OUT / 'print-mode-desktop.png'))
    pg.click('#printCancel')
    chk('exit print mode', pg.evaluate("!document.body.classList.contains('printmode')"))
    chk('no page errors desktop ' + str(errs2), not errs2)
    b.close()

print('MENU_PRINT PASS' if ok else 'MENU_PRINT FAIL')
sys.exit(0 if ok else 1)
