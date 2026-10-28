# Menu + Print preview modal: free-form selector, in-app preview, no forced download
import sys, subprocess, tempfile, base64
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
    with tempfile.TemporaryDirectory() as td:
        pdf = Path(td) / 'p.pdf'
        pdf.write_bytes(pdf_bytes)
        subprocess.check_call(['pdftoppm', '-png', '-r', '72', '-singlefile', str(pdf), str(Path(td) / 'page')])
        png = Path(td) / 'page.png'
        Path(out_png).write_bytes(png.read_bytes())
        from PIL import Image
        im = Image.open(png).convert('RGB')
        w, h = im.size
        px = im.load()
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
            return {'w': w, 'h': h, 'fillW': 0, 'fillH': 0}
        cw, ch = maxx - minx + 1, maxy - miny + 1
        return {'w': w, 'h': h, 'fillW': cw / w, 'fillH': ch / h, 'contentW': cw, 'contentH': ch}

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])

    # ---- phone 390x844 ----
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    # Capture downloads — none should fire until Save
    downloads = []
    pg.on('download', lambda d: downloads.append(d.suggested_filename))
    pg.goto(URL); pg.wait_for_timeout(300)
    pg.set_input_files('#file2', SAMPLE)
    pg.wait_for_function('window.PM && PM.proj'); pg.wait_for_timeout(500)
    pg.tap('#moreBtn'); pg.wait_for_timeout(300)
    chk('menu open', pg.evaluate("!document.querySelector('#moreMenu').hidden"))
    pg.evaluate("document.querySelector('#moreMenu .mscroll').scrollTop = 9999")
    pg.get_by_role('button', name='Print', exact=True).tap()
    pg.wait_for_timeout(400)
    chk('print mode on', pg.evaluate("document.body.classList.contains('printmode')"))
    chk('Preview button in bar', pg.is_visible('#printGo'))
    chk('Preview label', pg.evaluate("document.querySelector('#printGo .t')?.textContent || document.querySelector('#printGo').textContent").strip() == 'Preview' or 'Preview' in pg.inner_text('#printGo'))
    chk('no Save PDF in selection bar', pg.evaluate("!document.querySelector('#printPdfBtn')"))
    chk('8 grips', pg.evaluate("document.querySelectorAll('#printBox .ph').length") == 8)

    # Shrink selection a bit
    pg.evaluate("""() => {
      const s = PM.doc.sizes[1];
      PM.setPrintRect({ x: s.w*0.1, y: s.h*0.1, w: s.w*0.55, h: s.h*0.45 });
    }""")

    # Tap Preview — must open modal, NOT download
    pg.tap('#printGo')
    pg.wait_for_function('PM.previewOpen === true', timeout=20000)
    pg.wait_for_timeout(400)
    chk('preview modal open', pg.evaluate('PM.previewOpen'))
    chk('preview img loaded', pg.evaluate("document.querySelector('#ppImg').naturalWidth") > 100)
    chk('preview shows paper info', 'Letter' in pg.inner_text('#ppInfo'))
    chk('Back / Print / Save visible', pg.is_visible('#ppBack') and pg.is_visible('#ppPrint') and pg.is_visible('#ppSave'))
    chk('no download on Preview', downloads == [])
    cache = pg.evaluate('() => PM.previewCache')
    print('cache', cache)
    chk('preview cache has PDF', cache and cache.get('hasPdf'))

    pg.screenshot(path=str(OUT / 'print-preview-mobile.png'), full_page=False)

    # Back returns to selection
    pg.tap('#ppBack'); pg.wait_for_timeout(200)
    chk('Back closes preview', pg.evaluate('PM.previewOpen === false'))
    chk('still in print mode', pg.evaluate("document.body.classList.contains('printmode')"))

    # Open again and verify PDF fill via buildPrintPdfBytes
    pg.tap('#printGo')
    pg.wait_for_function('PM.previewOpen === true', timeout=20000)
    pdf_b64 = pg.evaluate("""async () => {
      const bytes = await PM.buildPrintPdfBytes();
      let bin=''; const u8=bytes; const c=0x8000;
      for(let i=0;i<u8.length;i+=c) bin+=String.fromCharCode.apply(null,u8.subarray(i,i+c));
      return btoa(bin);
    }""")
    fill = measure_pdf_fill(base64.b64decode(pdf_b64), OUT / 'print-output.png')
    print('pdf fill', fill)
    chk(f'PDF fills >90% w or h ({fill["fillW"]:.2f}/{fill["fillH"]:.2f})',
        fill['fillW'] > 0.90 or fill['fillH'] > 0.90)

    # Desktop Print path from preview should call window.print (hook it)
    printed = pg.evaluate("""() => {
      let hit = false;
      const orig = window.print;
      window.print = () => { hit = true; };
      // Force non-iOS path
      PM.doPreviewPrint();
      window.print = orig;
      // On Chromium mobile UA may be iOS-like? Check what happened
      return { hit, isPreview: PM.previewOpen };
    }""")
    print('print hook', printed)
    # On mobile Chromium isIOS is false (unless UA spoofed), so window.print should fire
    # Either share path or print — either way no download
    chk('no download after Print tap path', downloads == [])

    # Save PDF — in headless will download (no share)
    with pg.expect_download(timeout=10000) as di:
        pg.tap('#ppSave')
    dl = di.value
    chk('Save PDF triggers download when share unavailable', dl.suggested_filename.endswith('.pdf'))
    path = OUT / 'saved-from-preview.pdf'
    dl.save_as(str(path))
    chk('saved pdf non-empty', path.stat().st_size > 1000)

    chk('no page errors phone ' + str(errs), not errs)
    ctx.close()

    # ---- desktop ----
    pg = b.new_page(viewport={'width': 1280, 'height': 800})
    errs2 = []; pg.on('pageerror', lambda e: errs2.append(str(e)))
    downloads2 = []; pg.on('download', lambda d: downloads2.append(d.suggested_filename))
    pg.goto(URL); pg.set_input_files('#file', SAMPLE); pg.wait_for_function('window.PM && PM.proj'); pg.wait_for_timeout(400)
    pg.click('#printBtn'); pg.wait_for_timeout(300)
    pg.evaluate("""() => { const s = PM.doc.sizes[1]; PM.setPrintRect({x:s.w*0.2,y:s.h*0.15,w:s.w*0.5,h:s.h*0.4}); }""")
    pg.click('#printGo')
    pg.wait_for_function('PM.previewOpen === true', timeout=20000)
    chk('desktop preview open', pg.evaluate('PM.previewOpen'))
    chk('desktop no download on preview', downloads2 == [])
    # Print uses window.print
    hit = pg.evaluate("""() => {
      let hit = false; const o = window.print; window.print = () => { hit = true; };
      PM.doPreviewPrint(); window.print = o; return hit;
    }""")
    chk('desktop Print calls window.print', hit)
    pg.screenshot(path=str(OUT / 'print-preview-desktop.png'))
    pg.click('#ppBack')
    chk('desktop Back', pg.evaluate('!PM.previewOpen'))
    pg.click('#printCancel')
    chk('exit print mode', pg.evaluate("!document.body.classList.contains('printmode')"))
    chk('no page errors desktop ' + str(errs2), not errs2)
    b.close()

print('MENU_PRINT PASS' if ok else 'MENU_PRINT FAIL')
sys.exit(0 if ok else 1)
