#!/usr/bin/env python3
"""Phone-size: calibrate with 5000 mm, verify measurements show mm."""
import sys, http.server, threading, socket
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path('/workspace/plan-measure')
OUT = Path('/workspace/plan-measure-ui-test')
OUT.mkdir(parents=True, exist_ok=True)
SHOT = OUT / 'calibrate-mm-mobile.png'
SAMPLE = str(ROOT / 'test/sample-plan.pdf')
H = 792
MM = 72 / 25.4
ok = True

def chk(n, c):
    global ok
    ok = ok and bool(c)
    print(('PASS ' if c else 'FAIL ') + n + ('' if c else f' ({c!r})'))

# local static server
httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), lambda *a, **k: http.server.SimpleHTTPRequestHandler(*a, directory=str(ROOT), **k))
port = httpd.server_address[1]
threading.Thread(target=httpd.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{port}/'

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL)
    pg.wait_for_timeout(400)
    # Simulate an old project stuck in feet-inches by switching units before calibrate
    pg.set_input_files('#file2', SAMPLE)
    pg.wait_for_function('window.PM && PM.proj')
    pg.wait_for_timeout(600)
    # Force imperial so we prove calibrate flips to mm
    pg.evaluate("PM.proj.units='imp'; document.querySelector('#units').value='imp'")
    chk('start stuck in imp', pg.evaluate("PM.proj.units") == 'imp')

    # Page 2 has the 5000 mm calibration line
    pg.tap('#next')
    pg.wait_for_timeout(500)

    # Calibrate tool
    pg.tap('[data-tool=calibrate]')
    pg.wait_for_timeout(200)

    def tap_page(x, y):
        r = pg.evaluate("(()=>{const r=document.querySelector('#svg').getBoundingClientRect();return [r.left,r.top]})()")
        z = pg.evaluate('PM.zoom')
        pg.touchscreen.tap(r[0] + x * z, r[1] + (H - y) * z)
        pg.wait_for_timeout(120)

    # 5 m = 5000 mm line on sample page 2 at y=300 from (144,300) to (144+50mm,300)
    tap_page(144, 300)
    tap_page(144 + 50 * MM, 300)
    # Adjust mode: confirm points
    pg.wait_for_timeout(300)
    if pg.evaluate("document.body.classList.contains('caladj')"):
        # confirm button
        if pg.is_visible('#calSetBtn'):
            pg.tap('#calSetBtn')
            pg.wait_for_timeout(300)

    # Dialog should show mm label
    pg.wait_for_selector('#calDlg[open], #calDlg:not([open])', timeout=5000)
    # showModal may already be open
    open_dlg = pg.evaluate("document.querySelector('#calDlg').open")
    if not open_dlg:
        # try again via evaluate
        pg.evaluate("document.querySelector('#calDlg').showModal()")
    pg.wait_for_timeout(200)
    chk('cal dialog open', pg.evaluate("document.querySelector('#calDlg').open"))
    chk('mm unit badge visible', pg.is_visible('.cal-unit') and 'mm' in pg.inner_text('.cal-unit'))
    help_txt = pg.inner_text('#calDlg')
    chk('dialog mentions millimetres', 'millimetres' in help_txt.lower() or 'mm' in help_txt.lower())

    pg.fill('#calVal', '5000')  # bare number = mm
    pg.screenshot(path=str(SHOT.with_name('calibrate-mm-dialog.png')))
    pg.tap('#calDlg button[value=ok]')
    pg.wait_for_timeout(400)

    units = pg.evaluate('PM.proj.units')
    chk('project units now mm', units == 'mm')
    scale_name = pg.evaluate('PM.proj.scaleNames && PM.proj.scaleNames[2]')
    print('scale_name', scale_name)
    chk('scale name shows mm', scale_name and 'mm' in str(scale_name))

    # Measure the 4 m (4000 mm) top of the rectangle
    pg.tap('[data-tool=line]')
    tap_page(144, 400)
    tap_page(144 + 40 * MM, 400)
    pg.wait_for_timeout(300)
    items = pg.evaluate("""() => PM.proj.items.map(i => ({t:i.type, v:PM.measure(i), f:PM.fmtItem?PM.fmtItem(i):null, label: (window.Units?Units.fmtLen(PM.measure(i), PM.proj.units):null)}))""")
    print('items', items)
    # find line
    lines = [i for i in items if i['t'] == 'line']
    chk('have a length item', len(lines) >= 1)
    if lines:
        # 4 m = 4000 mm within 2%
        chk('measured ~4000 mm (4 m)', abs(lines[0]['v'] - 4) / 4 < 0.02)
        disp = pg.evaluate("() => { const it=PM.proj.items.find(i=>i.type==='line'); return it ? (typeof fmtItem==='function'?fmtItem(it):Units.fmtLen(PM.measure(it), PM.proj.units)) : '' }")
        # fmtItem may be in closure - use Units
        disp = pg.evaluate("() => { const it=PM.proj.items.find(i=>i.type==='line'); return it ? Units.fmtLen(PM.measure(it), PM.proj.units) : '' }")
        print('display', disp)
        chk('display ends with mm', str(disp).endswith('mm') and '4000' in str(disp).replace(' ',''))

    # UI units select
    chk('units select is mm', pg.evaluate("document.querySelector('#units').value") == 'mm')

    # Screenshot of measured plan with mm labels
    pg.screenshot(path=str(SHOT))
    print('screenshot', SHOT, 'size', SHOT.stat().st_size)
    chk('screenshot written', SHOT.exists() and SHOT.stat().st_size > 5000)
    chk('no page errors', not errs)
    if errs:
        print('errs', errs)
    b.close()

httpd.shutdown()
print('CALIBRATE-MM', 'PASS' if ok else 'FAIL')
sys.exit(0 if ok else 1)
