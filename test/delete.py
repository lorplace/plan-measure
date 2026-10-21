# Delete: phone (WebKit iPhone) tap-select with generous hit area, floating Delete bar, Undo toast, list trash + swipe,
# sleeve panel delete-by-size, Clear page / Delete all of a type; desktop Delete key + top bar trash
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; ok = True
def chk(n, c):
    global ok; ok &= bool(c); print(('PASS ' if c else 'FAIL ') + n)
N = 'PM.proj.items.length'
def scr(pg, i):  # screen point of item i, offset by 14 css px (not exactly on it)
    return pg.evaluate(f"(()=>{{const r=document.querySelector('#svg').getBoundingClientRect(),q=PM.proj.items[{i}].pts[0];return [r.left+q[0]*PM.zoom+14,r.top+q[1]*PM.zoom+10]}})()")
def ttap(pg, x, y):  # mobile WebKit emulation does not turn touchscreen taps into pointer events, so send them
    pg.evaluate(f"(()=>{{const el=document.elementFromPoint({x},{y});for(const t of ['pointerdown','pointerup'])el.dispatchEvent(new PointerEvent(t,{{bubbles:true,pointerType:'touch',isPrimary:true,clientX:{x},clientY:{y},pointerId:7}}))}})()")
with sync_playwright() as p:
    w = p.webkit.launch(); ctx = w.new_context(**p.devices['iPhone 13']); pg = ctx.new_page(); errs = []; pg.add_init_script('const _spc=Element.prototype.setPointerCapture;Element.prototype.setPointerCapture=function(i){try{_spc.call(this,i)}catch(e){}}')
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto(URL); pg.set_input_files('#file', 'test/sample-sleeves.dxf'); pg.wait_for_function('window.PM.doc && PM.doc.cad'); pg.wait_for_timeout(400)
    pg.tap('#slvCountTool'); pg.wait_for_timeout(200); pg.tap('#slvFind'); pg.wait_for_timeout(300); pg.tap('#findAdd'); pg.wait_for_timeout(600)
    chk('12 sleeves', pg.evaluate(N) == 12)
    pg.evaluate("PM.setTool('select'); document.body.classList.remove('sheetopen')"); pg.wait_for_timeout(300)
    # zoom in so items are apart, then tap near a sleeve
    vid = pg.evaluate("PM.proj.items[3].id"); pg.evaluate(f"document.querySelector('#svg') && 0")
    x, y = scr(pg, 3); ttap(pg, x, y); pg.wait_for_timeout(300)
    sel = pg.evaluate('PM.selId'); chk(f'tap near a sleeve selects it (generous hit) {sel is not None}', sel is not None)
    chk('floating bar with Delete and Edit shows', pg.is_visible('#selBar') and pg.is_visible('#selDel') and pg.is_visible('#selEdit'))
    bb = pg.locator('#selDel').bounding_box(); chk(f'Delete button is big ({bb["height"]:.0f}px)', bb['height'] >= 40)
    pg.tap('#selDel'); pg.wait_for_timeout(300)
    chk('deleted one', pg.evaluate(N) == 11 and not pg.evaluate(f"PM.proj.items.some(i=>i.id==='{sel}')"))
    chk('Undo toast shows', pg.is_visible('#undoToast') and 'deleted' in pg.inner_text('#undoToast'))
    pg.tap('#undoToastBtn'); pg.wait_for_timeout(300); chk('Undo brings it back', pg.evaluate(N) == 12 and pg.evaluate(f"PM.proj.items.some(i=>i.id==='{sel}')"))
    # Edit opens the sheet with the edit form
    x, y = scr(pg, 3); ttap(pg, x, y); pg.wait_for_timeout(300); pg.tap('#selEdit'); pg.wait_for_timeout(400)
    chk('Edit opens the panel with Edit selected', pg.evaluate("document.body.classList.contains('sheetopen')") and pg.is_visible('#eLabel'))
    pg.screenshot(path='test/out-delete-phone.png')
    # list trash
    pg.locator('#list .row .rdel').first.tap(); pg.wait_for_timeout(300); chk('list trash deletes', pg.evaluate(N) == 11)
    # swipe left on a row
    r = pg.locator('#list .row').first.bounding_box(); cx, cy = r['x'] + r['width'] - 30, r['y'] + r['height'] / 2
    pg.evaluate(f"""(()=>{{const el=document.elementFromPoint({cx},{cy});const f=(t,x)=>el.dispatchEvent(new PointerEvent(t,{{bubbles:true,pointerType:'touch',clientX:x,clientY:{cy},pointerId:5}}));f('pointerdown',{cx});f('pointermove',{cx-50});f('pointermove',{cx-110});f('pointerup',{cx-110});}})()""")
    pg.wait_for_timeout(300); chk('swipe left deletes', pg.evaluate(N) == 10)
    pg.evaluate("document.body.classList.remove('sheetopen')")
    # sleeve panel delete by size
    pg.tap('#slvCountTool'); pg.wait_for_timeout(300); n0 = pg.evaluate(N)
    pg.locator('#slvBody .rdel').first.tap(); pg.wait_for_timeout(300); n1 = pg.evaluate(N)
    chk(f'sleeve panel deletes a size group ({n0} -> {n1})', n1 < n0); pg.evaluate("document.querySelector('#slvDlg').close()")
    # Clear page and delete all of a type from the menu
    pg.evaluate("document.querySelector('#clearPageBtn').click()"); pg.wait_for_timeout(300); chk('Clear page', pg.evaluate(N) == 0)
    pg.tap('#undoToastBtn'); pg.wait_for_timeout(300); chk('undo clear page', pg.evaluate(N) == n1)
    pg.evaluate("document.querySelector('#delTypeBtn').click()"); pg.wait_for_timeout(300); pg.locator('#delTypeDlg [data-t=sleeve]').tap(); pg.wait_for_timeout(300)
    chk('Delete all of a type', pg.evaluate(N) == 0); pg.evaluate('PM.undo()'); pg.wait_for_timeout(200); chk('undo again', pg.evaluate(N) == n1)
    chk('no errors ' + str(errs), not errs); w.close()
    # desktop
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']); pg = b.new_page(viewport={'width': 1500, 'height': 900}); pg.on('dialog', lambda d: d.accept())
    pg.goto(URL); pg.set_input_files('#file', 'test/sample-sleeves.dxf'); pg.wait_for_function('window.PM.doc && PM.doc.cad'); pg.wait_for_timeout(300)
    pg.click('#findBtn'); pg.wait_for_timeout(300); pg.click('#findAdd'); pg.wait_for_timeout(500)
    chk('desktop: trash hidden with nothing selected', not pg.is_visible('#delBtn'))
    pg.locator('#list .row').nth(1).click(); pg.wait_for_timeout(200); chk('desktop: trash in top bar when selected', pg.is_visible('#delBtn'))
    pg.click('#delBtn'); pg.wait_for_timeout(300); chk('desktop: top bar trash deletes', pg.evaluate(N) == 11)
    pg.locator('#list .row').nth(1).click(); pg.mouse.move(5, 300); pg.keyboard.press('Delete'); pg.wait_for_timeout(300); chk('desktop: Delete key', pg.evaluate(N) == 10)
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(300); chk('desktop: Ctrl+Z undoes', pg.evaluate(N) == 11)
    pg.locator('#list .row').nth(1).click(); pg.wait_for_timeout(200); pg.screenshot(path='test/out-delete-desktop.png')
print('DELETE PASS' if ok else 'DELETE FAIL'); sys.exit(0 if ok else 1)
