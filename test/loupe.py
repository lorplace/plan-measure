# Loupe + nudge + touch press-drag-release placement test, also saves screenshots.
import sys
from playwright.sync_api import sync_playwright
URL=sys.argv[1]; H=792; MM=72/25.4; ok=True
def chk(n,c):
    global ok; ok&=bool(c); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    # ---- desktop ----
    pg=b.new_page(viewport={'width':1600,'height':950}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); pg.set_input_files('#file','test/sample-plan.pdf'); pg.wait_for_function('window.PM.proj'); pg.wait_for_timeout(400)
    pg.click('#next'); pg.wait_for_timeout(500)
    def scr(x,y):
        r=pg.evaluate("(()=>{const r=document.querySelector('#svg').getBoundingClientRect();return [r.left,r.top]})()"); z=pg.evaluate('PM.zoom'); return r[0]+x*z, r[1]+(H-y)*z
    pg.click('[data-tool=calibrate]'); x,y=scr(144,300); pg.mouse.move(x,y); pg.wait_for_timeout(300)
    chk('desktop loupe visible on hover', pg.is_visible('#loupe')); pg.mouse.click(x,y)
    x2,y2=scr(144+50*MM,300); pg.keyboard.down('Alt'); pg.mouse.click(x2+3,y2); pg.keyboard.up('Alt')   # 3 px off with snap held off
    for _ in range(3): pg.keyboard.press('ArrowLeft')
    pg.wait_for_function("document.querySelector('#loupe').dataset.sharp==='1'",timeout=5000)
    pg.screenshot(path='shots/desktop-loupe-calibrate.png')
    pg.click('#calSetBtn'); pg.fill('#calVal','5m'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    sc=pg.evaluate('PM.proj.scales[2]'); exp=0.0254/72*100; e=abs(sc-exp)/exp*100; chk(f'desktop nudge-corrected calibration err {e:.3f}%', e<0.5)
    # drag a calibration point before confirming
    pg.click('[data-tool=calibrate]'); a=scr(144,300); bb=scr(144+50*MM,300); pg.mouse.click(*a); pg.mouse.click(bb[0]+15,bb[1])
    pg.mouse.move(bb[0]+15,bb[1]); pg.mouse.down(); pg.mouse.move(bb[0]+5,bb[1],steps=5); pg.mouse.move(bb[0],bb[1],steps=5); pg.mouse.up()
    pg.keyboard.press('Enter'); pg.fill('#calVal','5000mm',timeout=3000); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    sc=pg.evaluate('PM.proj.scales[2]'); e=abs(sc-exp)/exp*100; chk(f'desktop drag-corrected calibration err {e:.3f}%', e<0.5)
    pg.keyboard.press('m'); chk('M toggles loupe off', not pg.evaluate("document.querySelector('#loupeBtn').classList.contains('on')")); pg.keyboard.press('m')
    chk('desktop no errors '+str(errs), not errs); pg.close()
    # ---- phone: press-drag-release ----
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=3,is_mobile=True,has_touch=True)
    pg=ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e))); pg.goto(URL)
    pg.set_input_files('#file2','test/sample-plan.pdf'); pg.wait_for_function('window.PM.proj'); pg.wait_for_timeout(400)
    pg.tap('#next'); pg.wait_for_timeout(500); pg.tap('[data-tool=calibrate]')
    cdp=ctx.new_cdp_session(pg)
    def T(t,x,y): cdp.send('Input.dispatchTouchEvent',{'type':t,'touchPoints':[] if t=='touchEnd' else [{'x':x,'y':y}]})
    def press_drag(target, start_off, shot=None):
        tx,ty=scr(*target); T('touchStart',tx+start_off[0],ty+start_off[1])
        for i in range(1,11): T('touchMove',tx+start_off[0]*(1-i/10),ty+start_off[1]*(1-i/10)); pg.wait_for_timeout(20)
        pg.wait_for_timeout(300)
        if shot:
            pg.wait_for_function("document.querySelector('#loupe').dataset.sharp==='1'",timeout=5000); chk('phone loupe visible during drag', pg.is_visible('#loupe')); pg.screenshot(path=shot)
        T('touchEnd',0,0); pg.wait_for_timeout(150)
    press_drag((144,300),(30,25)); press_drag((144+50*MM,300),(-20,30),'shots/phone-loupe-calibrate.png')
    pts=pg.evaluate('PM.proj && document.body.classList.contains("caladj")'); chk('phone calibration has 2 points (adjust mode)', pts)
    pg.tap('.nud[data-n="1,0"]'); pg.tap('.nud[data-n="-1,0"]'); pg.wait_for_timeout(300)
    pg.screenshot(path='shots/phone-calibrate-adjust.png')
    pg.tap('#calSetBtn'); pg.fill('#calVal','5m'); pg.tap('#calDlg button[value=ok]'); pg.wait_for_timeout(200)
    sc=pg.evaluate('PM.proj.scales[2]'); e=abs(sc-exp)/exp*100; chk(f'phone drag-placed calibration err {e:.3f}%', e<1)
    chk('phone no errors '+str(errs), not errs); b.close()
print('LOUPE PASS' if ok else 'LOUPE FAIL')
