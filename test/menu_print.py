# Menu (phone bottom sheet) + Print mode: aspect-locked Letter frame, auto-fit view
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = sys.argv[1]
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else '/workspace/plan-measure-ui-test')
OUT.mkdir(parents=True, exist_ok=True)
ok = True
def chk(n, c):
    global ok; ok &= bool(c); print(('PASS ' if c else 'FAIL ') + n)

SAMPLE = 'test/sample-plan.pdf'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    # ---- phone ----
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(300)
    pg.set_input_files('#file2', SAMPLE)
    pg.wait_for_function('window.PM && PM.proj'); pg.wait_for_timeout(500)
    pg.tap('#moreBtn'); pg.wait_for_timeout(300)
    chk('menu open', pg.evaluate("!document.querySelector('#moreMenu').hidden"))
    pg.evaluate("document.querySelector('#moreMenu .mscroll').scrollTop = 9999")
    pg.get_by_role('button', name='Print', exact=True).tap()
    pg.wait_for_timeout(600)
    chk('print mode on', pg.evaluate("document.body.classList.contains('printmode')"))
    chk('no stretch toggle', pg.evaluate("!document.querySelector('#printFit')"))
    chk('Fit to page button', pg.is_visible('#printRecenterBtn'))
    chk('corner handles only', pg.evaluate("document.querySelectorAll('#printBox .ph').length") == 4)

    info = pg.evaluate("""() => {
      const a = PM.printableArea(), r = PM.printRect, s = PM.doc.sizes[1];
      const ratio = r.w / r.h, ar = a.aspect;
      const box = document.querySelector('#printBox').getBoundingClientRect();
      const vp = document.querySelector('#viewport').getBoundingClientRect();
      // frame should nearly fill viewport (auto-zoom)
      const fillW = box.width / vp.width, fillH = box.height / vp.height;
      return { ratio, ar, availW: a.availW, availH: a.availH,
        pageW: s.w, pageH: s.h, rw: r.w, rh: r.h,
        fillW, fillH, zoom: PM.zoom,
        land: document.querySelector('#printOrient').value,
        paper: document.querySelector('#printPaper').value };
    }""")
    print('phone info', info)
    chk('default letter landscape', info['paper'] == 'letter' and info['land'] == 'landscape')
    chk(f'selection aspect matches printable ({info["ratio"]:.4f} ≈ {info["ar"]:.4f})', abs(info['ratio'] - info['ar']) < 0.01)
    chk('selection fits on page', info['rw'] <= info['pageW'] + 0.5 and info['rh'] <= info['pageH'] + 0.5)
    chk('auto-zoom fills most of viewport', max(info['fillW'], info['fillH']) > 0.75)

    # Switch to portrait — aspect should change and view re-fit
    pg.select_option('#printOrient', 'portrait'); pg.wait_for_timeout(400)
    port = pg.evaluate("""() => {
      const a = PM.printableArea(), r = PM.printRect;
      return { ratio: r.w / r.h, ar: a.aspect };
    }""")
    chk(f'portrait aspect locked ({port["ratio"]:.4f} ≈ {port["ar"]:.4f})', abs(port['ratio'] - port['ar']) < 0.01)
    pg.select_option('#printOrient', 'landscape'); pg.wait_for_timeout(300)

    # Resize via setPrintRect (aspect clamped)
    shrunk = pg.evaluate("""() => {
      const a = PM.printableArea(), s = PM.doc.sizes[1];
      PM.setPrintRect({ x: s.w * 0.15, y: s.h * 0.1, w: s.w * 0.4, h: s.h * 0.4 });
      const r = PM.printRect;
      return { ratio: r.w / r.h, ar: a.aspect, w: r.w };
    }""")
    chk('setPrintRect keeps aspect', abs(shrunk['ratio'] - shrunk['ar']) < 0.01)
    pg.click('#printRecenterBtn'); pg.wait_for_timeout(300)
    fill2 = pg.evaluate("""() => {
      const box = document.querySelector('#printBox').getBoundingClientRect();
      const vp = document.querySelector('#viewport').getBoundingClientRect();
      return Math.max(box.width / vp.width, box.height / vp.height);
    }""")
    chk(f'Fit to page recenters ({fill2:.2f})', fill2 > 0.75)

    pg.screenshot(path=str(OUT / 'print-mode-mobile.png'), full_page=False)

    preview = pg.evaluate("""async () => {
      const a = PM.printableArea();
      const r = await PM.buildPrintPreview();
      const img = document.querySelector('#printImg');
      return {
        cw: r.cnv.width, ch: r.cnv.height,
        ar: a.aspect, imgAr: r.cnv.width / r.cnv.height,
        availAr: a.availW / a.availH,
        natW: img.naturalWidth, natH: img.naturalHeight,
        strip: document.querySelector('#printStrip').textContent
      };
    }""")
    print('preview', preview)
    chk(f'output aspect = printable ({preview["imgAr"]:.4f} ≈ {preview["availAr"]:.4f})', abs(preview['imgAr'] - preview['availAr']) < 0.015)
    chk('print img loaded', preview['natW'] > 100)
    chk('strip has title', 'Letter landscape' in preview['strip'] or 'letter' in preview['strip'].lower())

    pg.evaluate("""() => {
      const r = document.querySelector('#printRoot');
      r.style.cssText = 'position:fixed;left:0;top:0;opacity:1;z-index:9999;width:auto;height:auto;background:#555;padding:8px';
    }""")
    pg.wait_for_timeout(100)
    pg.locator('#printSheet').screenshot(path=str(OUT / 'print-output.png'))
    pg.evaluate("() => document.querySelector('#printRoot').removeAttribute('style')")
    chk('no page errors phone ' + str(errs), not errs)
    ctx.close()

    # ---- desktop ----
    pg = b.new_page(viewport={'width': 1280, 'height': 800})
    errs2 = []; pg.on('pageerror', lambda e: errs2.append(str(e)))
    pg.goto(URL); pg.set_input_files('#file', SAMPLE); pg.wait_for_function('window.PM && PM.proj'); pg.wait_for_timeout(400)
    pg.click('#printBtn'); pg.wait_for_timeout(500)
    d = pg.evaluate("""() => {
      const a = PM.printableArea(), r = PM.printRect;
      const box = document.querySelector('#printBox').getBoundingClientRect();
      const vp = document.querySelector('#viewport').getBoundingClientRect();
      return { ratio: r.w/r.h, ar: a.aspect, fill: Math.max(box.width/vp.width, box.height/vp.height) };
    }""")
    chk(f'desktop aspect locked ({d["ratio"]:.4f})', abs(d['ratio'] - d['ar']) < 0.01)
    chk(f'desktop auto-zoom ({d["fill"]:.2f})', d['fill'] > 0.7)
    prev = pg.evaluate("""async () => { const a = PM.printableArea(); const r = await PM.buildPrintPreview(); return { ar: r.cnv.width/r.cnv.height, want: a.availW/a.availH }; }""")
    chk('desktop output aspect', abs(prev['ar'] - prev['want']) < 0.015)
    pg.screenshot(path=str(OUT / 'print-mode-desktop.png'))
    pg.click('#printCancel')
    chk('exit print mode', pg.evaluate("!document.body.classList.contains('printmode')"))
    chk('no page errors desktop ' + str(errs2), not errs2)
    b.close()

print('MENU_PRINT PASS' if ok else 'MENU_PRINT FAIL')
sys.exit(0 if ok else 1)
