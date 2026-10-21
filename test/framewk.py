# Zoom/pan smoothness in WebKit iPhone emulation: frame intervals while wheel-zooming and panning, and time until the sharp re-render.
# usage: framewk.py URL FILE [pages...]   (prints JSON summary)
import sys, json, time
from playwright.sync_api import sync_playwright
URL, F = sys.argv[1], sys.argv[2]
JS_START = "window.__fr=[];window.__on=true;(function loop(t0){requestAnimationFrame(t=>{if(window.__last)window.__fr.push(t-window.__last);window.__last=t;if(window.__on)loop()})})()"
def summ(a):
    a = sorted(a); n = len(a)
    return {'frames': n, 'avg_ms': round(sum(a)/n, 1) if n else None, 'p95_ms': round(a[int(n*0.95)-1], 1) if n else None, 'max_ms': round(a[-1], 1) if n else None, 'janky_over_50ms': sum(1 for x in a if x > 50)}
with sync_playwright() as pw:
    b = pw.webkit.launch(); ctx = b.new_context(**pw.devices['iPhone 13']); pg = ctx.new_page(); pg.on('dialog', lambda d: d.accept()); pg.set_default_timeout(300000); pg.add_init_script('const _spc=Element.prototype.setPointerCapture;Element.prototype.setPointerCapture=function(i){try{_spc.call(this,i)}catch(e){}};const _rpc=Element.prototype.releasePointerCapture;Element.prototype.releasePointerCapture=function(i){try{_rpc.call(this,i)}catch(e){}}')
    pg.goto(URL); pg.set_input_files('#file', F); pg.wait_for_function('window.PM && PM.doc && (PM.doc.cad || PM.doc.pdf)'); pg.wait_for_timeout(4000)
    out = {}
    box = pg.locator('#viewport').bounding_box(); cx, cy = box['x'] + box['width']/2, box['y'] + box['height']/2
    pg.mouse.move(cx, cy)
    GEST = """async ([kind, n, dir]) => { const vp = document.querySelector('#viewport'), r = vp.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const ev = (type, id, x, y) => vp.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: id === 1, buttons: type === 'pointerup' ? 0 : 1 }));
      const fr = []; let last = performance.now(); const raf = () => new Promise(res => requestAnimationFrame(res));
      if (kind === 'pinch') { let d = dir > 0 ? 40 : 160; ev('pointerdown', 1, cx - d, cy); ev('pointerdown', 2, cx + d, cy);
        for (let i = 0; i < n; i++) { d *= dir > 0 ? 1.04 : 1 / 1.04; ev('pointermove', 1, cx - d, cy); ev('pointermove', 2, cx + d, cy); await raf(); const t = performance.now(); fr.push(t - last); last = t; }
        ev('pointerup', 1, cx - d, cy); ev('pointerup', 2, cx + d, cy); }
      else { for (let i = 0; i < n; i++) { vp.scrollBy(12, 8); await raf(); const t = performance.now(); fr.push(t - last); last = t; } }
      return fr; }"""
    z0 = pg.evaluate('PM.zoom'); out['zoom_in'] = summ(pg.evaluate(GEST, ['pinch', 40, 1])); out['zoom_from_to'] = [z0, pg.evaluate('PM.zoom')]; pg.wait_for_timeout(1500)
    out['pan'] = summ(pg.evaluate(GEST, ['pan', 40, 1])); pg.wait_for_timeout(1500)
    out['zoom_out'] = summ(pg.evaluate(GEST, ['pinch', 30, -1]))
    t = time.time(); pg.wait_for_function("document.querySelector('#canvas').dataset.rendered && document.querySelector('#canvas').dataset.rendered.endsWith(':'+PM.zoom)"); out['sharp_after_s'] = round(time.time() - t, 2)
    out['canvas_px'] = pg.evaluate("canvas.width*canvas.height")
    print(json.dumps(out))
