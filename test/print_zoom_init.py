# Enter print while zoomed: box = visible area, all grips on-screen, view unchanged
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
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(300)
    pg.set_input_files('#file2', SAMPLE)
    pg.wait_for_function('window.PM && PM.proj'); pg.wait_for_timeout(500)

    # Zoom into a detail (top-left quadrant) — leave view there
    before = pg.evaluate("""() => {
      const s = PM.doc.sizes[1];
      // Zoom to ~3x fit and pan to top-left content
      const fitZ = Math.min((document.querySelector('#viewport').clientWidth - 40) / s.w,
                            (document.querySelector('#viewport').clientHeight - 40) / s.h);
      setZoom(Math.max(fitZ * 3.5, 0.8));
      const vp = document.querySelector('#viewport');
      vp.scrollLeft = 40; vp.scrollTop = 40;
      return { zoom: PM.zoom, sl: vp.scrollLeft, st: vp.scrollTop, pw: s.w, ph: s.h };
    }""")
    print('before', before)
    chk('zoomed in before print', before['zoom'] > 0.5)

    # Enter print via menu
    pg.tap('#moreBtn'); pg.wait_for_timeout(250)
    pg.evaluate("document.querySelector('#moreMenu .mscroll').scrollTop = 9999")
    pg.get_by_role('button', name='Print', exact=True).tap()
    pg.wait_for_timeout(700)  # allow double-rAF settle

    after = pg.evaluate("""() => {
      const vp = document.querySelector('#viewport');
      const r = PM.printRect;
      const vis = PM.visiblePageRect();
      const box = document.querySelector('#printBox').getBoundingClientRect();
      const vpr = vp.getBoundingClientRect();
      const grips = [...document.querySelectorAll('#printBox .ph')].map(el => {
        const b = el.getBoundingClientRect();
        return { x: b.x + b.width/2, y: b.y + b.height/2, w: b.width, h: b.height };
      });
      const pad = 2;
      const allOnScreen = grips.every(g =>
        g.x >= vpr.left - pad && g.x <= vpr.right + pad &&
        g.y >= vpr.top - pad && g.y <= vpr.bottom + pad);
      // Box should closely match inset visible region
      const overlapW = Math.max(0, Math.min(r.x+r.w, vis.x+vis.w) - Math.max(r.x, vis.x));
      const overlapH = Math.max(0, Math.min(r.y+r.h, vis.y+vis.h) - Math.max(r.y, vis.y));
      const overlap = (overlapW * overlapH) / Math.max(1, r.w * r.h);
      return {
        zoom: PM.zoom, sl: vp.scrollLeft, st: vp.scrollTop,
        r, vis, overlap, allOnScreen, nGrips: grips.length,
        boxInVp: box.left >= vpr.left - 4 && box.right <= vpr.right + 4 &&
                 box.top >= vpr.top - 4 && box.bottom <= vpr.bottom + 4,
        boxW: box.width, boxH: box.height, vpW: vpr.width, vpH: vpr.height,
        printmode: document.body.classList.contains('printmode')
      };
    }""")
    print('after', {k: after[k] for k in after if k not in ('r','vis')}, 'r', after['r'], 'vis', after['vis'])

    chk('print mode on', after['printmode'])
    chk(f'zoom unchanged ({before["zoom"]:.4f} → {after["zoom"]:.4f})', abs(after['zoom'] - before['zoom']) < 0.001)
    chk(f'scroll roughly kept (sl {before["sl"]}→{after["sl"]}, st {before["st"]}→{after["st"]})',
        abs(after['sl'] - before['sl']) < 30 and abs(after['st'] - before['st']) < 80)
    chk(f'selection overlaps visible ≥85% ({after["overlap"]:.2f})', after['overlap'] >= 0.85)
    chk('selection smaller than full page (zoomed detail)', after['r']['w'] < before['pw'] * 0.9 or after['r']['h'] < before['ph'] * 0.9)
    chk(f'all 8 grips on-screen ({after["nGrips"]}, on={after["allOnScreen"]})', after['nGrips'] == 8 and after['allOnScreen'])
    chk(f'box within viewport ({after["boxW"]:.0f}x{after["boxH"]:.0f} in {after["vpW"]:.0f}x{after["vpH"]:.0f})', after['boxInVp'])

    pg.screenshot(path=str(OUT / 'print-mode-zoomed-mobile.png'), full_page=False)

    # Fit to page → whole page in view + full-page selection
    pg.tap('#printRecenterBtn'); pg.wait_for_timeout(400)
    fit = pg.evaluate("""() => {
      const s = PM.doc.sizes[1], r = PM.printRect;
      const box = document.querySelector('#printBox').getBoundingClientRect();
      const vp = document.querySelector('#viewport').getBoundingClientRect();
      return { rw: r.w / s.w, rh: r.h / s.h, fill: Math.max(box.width/vp.width, box.height/vp.height), zoom: PM.zoom };
    }""")
    print('fit', fit)
    chk(f'Fit to page selects ~full page ({fit["rw"]:.2f}x{fit["rh"]:.2f})', fit['rw'] > 0.9 and fit['rh'] > 0.9)
    chk(f'Fit to page shows whole page in view ({fit["fill"]:.2f})', fit['fill'] > 0.7)

    # Not-zoomed enter: full page selection
    pg.tap('#printCancel'); pg.wait_for_timeout(200)
    pg.evaluate("""() => { fitPage(); const vp=document.querySelector('#viewport'); vp.scrollLeft=0; vp.scrollTop=0; }""")
    pg.wait_for_timeout(200)
    pg.evaluate('PM.enterPrintMode()')
    pg.wait_for_timeout(500)
    full = pg.evaluate("""() => {
      const s = PM.doc.sizes[1], r = PM.printRect;
      return { rw: r.w/s.w, rh: r.h/s.h };
    }""")
    print('unzoomed enter', full)
    chk(f'unzoomed enter ≈ full page ({full["rw"]:.2f}x{full["rh"]:.2f})', full['rw'] > 0.9 and full['rh'] > 0.9)

    chk('no page errors ' + str(errs), not errs)
    ctx.close(); b.close()

print('PRINT_ZOOM_INIT PASS' if ok else 'PRINT_ZOOM_INIT FAIL')
sys.exit(0 if ok else 1)
