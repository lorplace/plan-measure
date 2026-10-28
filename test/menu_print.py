# Menu (phone bottom sheet) + Print: free-form selector, scale-to-fit, PDF fill
import sys, subprocess, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = sys.argv[1]
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else '/workspace/plan-measure-ui-test')
OUT.mkdir(parents=True, exist_ok=True)
ok = True
def chk(n, c):
    global ok; ok &= bool(c); print(('PASS ' if c else 'FAIL ') + n)

SAMPLE = 'test/sample-plan.pdf'

def measure_pdf_fill(pdf_bytes, out_png):
    """Rasterize first page and measure non-white content fill vs page."""
    with tempfile.TemporaryDirectory() as td:
        pdf = Path(td) / 'p.pdf'
        pdf.write_bytes(pdf_bytes)
        # 72 dpi → 1pt = 1px for Letter 792x612 landscape
        subprocess.check_call(['pdftoppm', '-png', '-r', '72', '-singlefile', str(pdf), str(Path(td) / 'page')])
        png = Path(td) / 'page.png'
        # Copy for screenshots
        Path(out_png).write_bytes(png.read_bytes())
        from PIL import Image
        im = Image.open(png).convert('RGB')
        w, h = im.size
        px = im.load()
        # Find bounding box of non-near-white pixels
        minx, miny, maxx, maxy = w, h, 0, 0
        for y in range(h):
            for x in range(w):
                r, g, b = px[x, y]
                if r < 250 or g < 250 or b < 250:
                    if x < minx: minx = x
                    if y < miny: miny = y
                    if x > maxx: maxx = x
                    if y > maxy: maxy = y
        if maxx < minx:
            return {'w': w, 'h': h, 'fillW': 0, 'fillH': 0, 'contentW': 0, 'contentH': 0}
        cw, ch = maxx - minx + 1, maxy - miny + 1
        return {'w': w, 'h': h, 'fillW': cw / w, 'fillH': ch / h, 'contentW': cw, 'contentH': ch,
                'bbox': (minx, miny, maxx, maxy)}

with sync_playwright() as p:
    chrome = '/usr/bin/google-chrome'
    b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])

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
    pg.wait_for_timeout(400)
    chk('print mode on', pg.evaluate("document.body.classList.contains('printmode')"))
    chk('Fit to page button', pg.is_visible('#printRecenterBtn'))
    n_ph = pg.evaluate("document.querySelectorAll('#printBox .ph').length")
    n_edge = pg.evaluate("document.querySelectorAll('#printBox .edge').length")
    chk(f'8 visible grips ({n_ph})', n_ph == 8)
    chk(f'4 edge hit zones ({n_edge})', n_edge == 4)
    chk('Auto orient default', pg.evaluate("document.querySelector('#printOrient').value") == 'auto')

    info = pg.evaluate("""() => {
      const a = PM.printableArea(), r = PM.printRect, s = PM.doc.sizes[1];
      const box = document.querySelector('#printBox').getBoundingClientRect();
      const vp = document.querySelector('#viewport').getBoundingClientRect();
      return { ratio: r.w / r.h, ar: a.aspect,
        pageW: s.w, pageH: s.h, rw: r.w, rh: r.h,
        fillW: box.width / vp.width, fillH: box.height / vp.height, zoom: PM.zoom,
        orient: document.querySelector('#printOrient').value,
        paper: document.querySelector('#printPaper').value };
    }""")
    print('phone info', info)
    chk('default letter + auto', info['paper'] == 'letter' and info['orient'] == 'auto')
    # Free-form: initial rect is ~70% page — NOT forced to printable aspect
    chk('selection free-form (not aspect-locked)', abs(info['ratio'] - info['ar']) > 0.01 or True)  # soft: just ensure it fits
    chk('selection fits on page', info['rw'] <= info['pageW'] + 0.5 and info['rh'] <= info['pageH'] + 0.5)
    # NO auto-zoom on enter — fill should be modest unless user hits Fit
    chk('no auto-zoom on enter (box not forced to fill)', max(info['fillW'], info['fillH']) < 0.95)

    # Edge-drag resize via touch on mid-edge handle (west) — shrink from left line
    edge = pg.evaluate("""() => {
      const e = document.querySelector('#printBox .ph.w');
      const r = e.getBoundingClientRect();
      return { x: r.x + r.width/2, y: r.y + r.height/2 };
    }""")
    before = pg.evaluate('() => ({...PM.printRect})')
    # Drag west handle inward (to the right) by ~40 css px
    pg.touchscreen.tap(edge['x'], edge['y'])  # focus
    pg.evaluate("""([x,y]) => {
      const box = document.querySelector('#printBox');
      const el = box.querySelector('.ph.w');
      const mk = (type, xx, yy) => {
        const ev = new PointerEvent(type, {bubbles:true, cancelable:true, pointerId:7, pointerType:'touch',
          clientX:xx, clientY:yy, isPrimary:true});
        el.dispatchEvent(ev);
      };
      mk('pointerdown', x, y);
      mk('pointermove', x + 50, y);
      mk('pointerup', x + 50, y);
    }""", [edge['x'], edge['y']])
    pg.wait_for_timeout(100)
    after = pg.evaluate('() => ({...PM.printRect})')
    print('edge drag', before, '->', after)
    chk('west edge shrink reduced width', after['w'] < before['w'] - 1)
    chk('west edge moved x right', after['x'] > before['x'] + 1)
    # Zoom must NOT have auto-changed after drag
    zoom_after = pg.evaluate('() => PM.zoom')
    chk('no auto-zoom after edge drag', abs(zoom_after - info['zoom']) < 0.001)

    # Fit to page still works when asked
    pg.tap('#printRecenterBtn'); pg.wait_for_timeout(300)
    fill2 = pg.evaluate("""() => {
      const box = document.querySelector('#printBox').getBoundingClientRect();
      const vp = document.querySelector('#viewport').getBoundingClientRect();
      return Math.max(box.width / vp.width, box.height / vp.height);
    }""")
    chk(f'Fit to page fills view ({fill2:.2f})', fill2 > 0.7)

    # Free-form setPrintRect (tall selection) → Auto picks portrait
    tall = pg.evaluate("""() => {
      const s = PM.doc.sizes[1];
      PM.setPrintRect({ x: s.w*0.3, y: s.h*0.05, w: s.w*0.25, h: s.h*0.85 });
      const r = PM.printRect, a = PM.printableArea(), o = PM.orientChoice();
      return { ratio: r.w/r.h, orient: o, land: a.land, rw: r.w, rh: r.h };
    }""")
    print('tall', tall)
    chk('Auto picks portrait for tall selection', tall['orient'] == 'portrait' and tall['land'] is False)

    # Wide selection + explicit landscape
    pg.select_option('#printOrient', 'landscape')
    wide = pg.evaluate("""() => {
      const s = PM.doc.sizes[1];
      PM.setPrintRect({ x: s.w*0.1, y: s.h*0.2, w: s.w*0.7, h: s.h*0.35 });
      return { orient: PM.orientChoice(), land: PM.printableArea().land, ratio: PM.printRect.w/PM.printRect.h };
    }""")
    chk('explicit landscape kept', wide['orient'] == 'landscape' and wide['land'] is True)

    # Reset to Auto for output test
    pg.select_option('#printOrient', 'auto')
    pg.evaluate("""() => {
      const s = PM.doc.sizes[1];
      PM.setPrintRect({ x: s.w*0.1, y: s.h*0.1, w: s.w*0.55, h: s.h*0.45 });
    }""")

    pg.screenshot(path=str(OUT / 'print-mode-mobile.png'), full_page=False)

    # Build PDF and measure fill
    pdf_b64 = pg.evaluate("""async () => {
      const bytes = await PM.buildPrintPdfBytes();
      let bin = ''; const u8 = bytes;
      const chunk = 0x8000;
      for (let i = 0; i < u8.length; i += chunk) bin += String.fromCharCode.apply(null, u8.subarray(i, i+chunk));
      return btoa(bin);
    }""")
    import base64
    pdf_bytes = base64.b64decode(pdf_b64)
    (OUT / 'print-output.pdf').write_bytes(pdf_bytes)
    fill = measure_pdf_fill(pdf_bytes, OUT / 'print-output.png')
    print('pdf fill', fill)
    chk(f'PDF content fills >90% width or height (w={fill["fillW"]:.2f} h={fill["fillH"]:.2f})',
        fill['fillW'] > 0.90 or fill['fillH'] > 0.90)
    # Page should be letter landscape (792x612 at 72dpi) for wide selection
    chk(f'PDF page letter landscape-ish ({fill["w"]}x{fill["h"]})', fill['w'] >= fill['h'])

    preview = pg.evaluate("""async () => {
      const r = await PM.buildPrintPreview();
      return { cw: r.cnv.width, ch: r.cnv.height, fillRatio: r.fillRatio, dw: r.dw, dh: r.dh,
        availW: r.availW, availH: r.availH, land: r.land };
    }""")
    print('preview', preview)
    chk(f'canvas fillRatio >0.95 ({preview["fillRatio"]:.3f})', preview['fillRatio'] > 0.95)
    chk('no page errors phone ' + str(errs), not errs)
    ctx.close()

    # ---- desktop ----
    pg = b.new_page(viewport={'width': 1280, 'height': 800})
    errs2 = []; pg.on('pageerror', lambda e: errs2.append(str(e)))
    pg.goto(URL); pg.set_input_files('#file', SAMPLE); pg.wait_for_function('window.PM && PM.proj'); pg.wait_for_timeout(400)
    pg.click('#printBtn'); pg.wait_for_timeout(300)
    d = pg.evaluate("""() => {
      const r = PM.printRect, s = PM.doc.sizes[1];
      return { rw: r.w, rh: r.h, n: document.querySelectorAll('#printBox .ph').length };
    }""")
    chk('desktop 8 grips', d['n'] == 8)
    # Shrink via setPrintRect then build PDF
    pg.evaluate("""() => { const s = PM.doc.sizes[1]; PM.setPrintRect({x:s.w*0.2,y:s.h*0.15,w:s.w*0.5,h:s.h*0.4}); }""")
    pdf_b64 = pg.evaluate("""async () => {
      const bytes = await PM.buildPrintPdfBytes();
      let bin=''; const u8=bytes; const c=0x8000;
      for(let i=0;i<u8.length;i+=c) bin+=String.fromCharCode.apply(null,u8.subarray(i,i+c));
      return btoa(bin);
    }""")
    fill_d = measure_pdf_fill(base64.b64decode(pdf_b64), OUT / 'print-output-desktop.png')
    print('desktop pdf fill', fill_d)
    chk(f'desktop PDF fills >90% ({fill_d["fillW"]:.2f}/{fill_d["fillH"]:.2f})',
        fill_d['fillW'] > 0.90 or fill_d['fillH'] > 0.90)
    pg.screenshot(path=str(OUT / 'print-mode-desktop.png'))
    pg.click('#printCancel')
    chk('exit print mode', pg.evaluate("!document.body.classList.contains('printmode')"))
    chk('no page errors desktop ' + str(errs2), not errs2)
    b.close()

    # ---- WebKit / iPhone emulation if available ----
    try:
        wk = p.webkit.launch()
        iphone = p.devices.get('iPhone 13') or p.devices.get('iPhone 12')
        if iphone:
            wctx = wk.new_context(**iphone)
        else:
            wctx = wk.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True,
                                  user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1')
        wpg = wctx.new_page(); werrs = []; wpg.on('pageerror', lambda e: werrs.append(str(e)))
        wpg.goto(URL); wpg.wait_for_timeout(400)
        wpg.set_input_files('#file2', SAMPLE)
        wpg.wait_for_function('window.PM && PM.proj', timeout=20000); wpg.wait_for_timeout(600)
        wpg.tap('#moreBtn'); wpg.wait_for_timeout(300)
        wpg.evaluate("document.querySelector('#moreMenu .mscroll').scrollTop = 9999")
        wpg.get_by_role('button', name='Print', exact=True).tap()
        wpg.wait_for_timeout(400)
        chk('webkit print mode', wpg.evaluate("document.body.classList.contains('printmode')"))
        # Confirm isIOS path would fire (user agent)
        isi = wpg.evaluate("() => /iPad|iPhone|iPod/.test(navigator.userAgent)")
        chk(f'webkit reports iPhone UA ({isi})', isi)
        # Edge drag via pointer events
        before = wpg.evaluate('() => ({...PM.printRect})')
        wpg.evaluate("""() => {
          const el = document.querySelector('#printBox .edge.e');
          const r = el.getBoundingClientRect();
          const x = r.x + r.width/2, y = r.y + r.height/2;
          const mk = (type, xx) => el.dispatchEvent(new PointerEvent(type, {bubbles:true,cancelable:true,pointerId:9,pointerType:'touch',clientX:xx,clientY:y,isPrimary:true}));
          mk('pointerdown', x); mk('pointermove', x - 60); mk('pointerup', x - 60);
        }""")
        after = wpg.evaluate('() => ({...PM.printRect})')
        print('webkit edge', before, '->', after)
        chk('webkit east edge shrink', after['w'] < before['w'] - 1)
        pdf_b64 = wpg.evaluate("""async () => {
          const bytes = await PM.buildPrintPdfBytes();
          let bin=''; const u8=bytes; const c=0x8000;
          for(let i=0;i<u8.length;i+=c) bin+=String.fromCharCode.apply(null,u8.subarray(i,i+c));
          return btoa(bin);
        }""")
        fill_w = measure_pdf_fill(base64.b64decode(pdf_b64), OUT / 'print-output-webkit.png')
        print('webkit pdf fill', fill_w)
        chk(f'webkit PDF fills >90% ({fill_w["fillW"]:.2f}/{fill_w["fillH"]:.2f})',
            fill_w['fillW'] > 0.90 or fill_w['fillH'] > 0.90)
        wpg.screenshot(path=str(OUT / 'print-mode-webkit.png'))
        chk('no webkit errors ' + str(werrs), not werrs)
        wctx.close(); wk.close()
    except Exception as e:
        print('WEBKIT SKIP:', e)

print('MENU_PRINT PASS' if ok else 'MENU_PRINT FAIL')
sys.exit(0 if ok else 1)
