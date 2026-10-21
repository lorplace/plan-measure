# Peak memory of the WebKit web-content process while opening a CAD file in iPhone emulation, then Continue after reload.
# usage: memwk.py URL FILE [limit_mb]
import sys, time, threading, psutil
from playwright.sync_api import sync_playwright
URL, F = sys.argv[1], sys.argv[2]; LIM = float(sys.argv[3]) if len(sys.argv) > 3 else 0
def webprocs(): return [p for p in psutil.process_iter(['name', 'cmdline']) if any(k in (p.info['name'] or '') for k in ('WPEWebProcess','WebKitWebProces'))]
peak = {'v': 0, 'phase': ''}; marks = {}; stop = False
def sampler():
    while not stop:
        s = 0
        for p in webprocs():
            try: s = max(s, p.memory_info().rss)
            except Exception: pass
        if s > peak['v']: peak['v'] = s
        marks[peak['phase']] = max(marks.get(peak['phase'], 0), s); time.sleep(0.05)
ok = True
with sync_playwright() as pw:
    b = pw.webkit.launch(); ctx = b.new_context(**pw.devices['iPhone 13']); pg = ctx.new_page(); pg.on('dialog', lambda d: d.accept()); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    threading.Thread(target=sampler, daemon=True).start()
    peak['phase'] = 'start'; pg.goto(URL); pg.wait_for_timeout(1000)
    peak['phase'] = 'open'; t = time.time(); pg.set_input_files('#file', F); pg.wait_for_function('window.PM.doc && PM.doc.cad', timeout=300000); pg.wait_for_timeout(3000); t1 = time.time() - t
    n = pg.evaluate('PM.doc.cad.nSegs || (PM.doc.cad.segs && PM.doc.cad.segs.length)')
    if F.endswith('.pmproj'): stop = True; time.sleep(0.1); print({k: round(v / 2**20) for k, v in marks.items()}, 'peak MB', round(peak['v'] / 2**20), 'open s', round(t1, 1)); sys.exit(0)
    peak['phase'] = 'reload'; pg.wait_for_timeout(1500); pg.reload(); pg.wait_for_timeout(1500)
    peak['phase'] = 'continue'; t = time.time(); pg.tap('#resumeBtn'); pg.wait_for_function('window.PM.doc && PM.doc.cad', timeout=300000); pg.wait_for_timeout(3000); t2 = time.time() - t
    stop = True; time.sleep(0.1)
    print({k: round(v / 2**20) for k, v in marks.items()}, 'peak MB', round(peak['v'] / 2**20), 'open s', round(t1, 1), 'continue s', round(t2, 1), 'segs', n, 'errors', errs)
    if LIM and peak['v'] / 2**20 > LIM: ok = False
    if errs: ok = False
print('MEM PASS' if ok else 'MEM FAIL'); sys.exit(0 if ok else 1)
