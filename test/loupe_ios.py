# iPhone (WebKit) magnifier test: the lens must show plan ink, also when Safari drops a plan bitmap or a lens render
# comes back blank (iOS canvas memory limit). Usage: python3 test/loupe_ios.py URL [plan.pdf]
import sys
from playwright.sync_api import sync_playwright
URL=sys.argv[1]; PDF=sys.argv[2] if len(sys.argv)>2 else 'test/sample-plan.pdf'; ok=True
def chk(n,c):
    global ok; ok&=bool(c); print(('PASS ' if c else 'FAIL ')+n)
INK="""(()=>{const c=document.querySelector('#loupe');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;const L=c.width;let ink=0;
 for(let y=0;y<L;y++)for(let x=0;x<L;x++){const dx=x-L/2,dy=y-L/2; if(Math.abs(dx)<8||Math.abs(dy)<8) continue; if(y>L-L/7) continue; if(dx*dx+dy*dy>(L/2-6)**2) continue; // skip crosshair, 4x pill, rim
  const i=4*(y*L+x),s=d[i]+d[i+1]+d[i+2]; if(s<600 && !(d[i]>200&&d[i+1]<120&&d[i+2]<120) && !(d[i+1]>150&&d[i]<80)) ink++;} return ink})()"""
with sync_playwright() as p:
    b=p.webkit.launch(); ctx=b.new_context(**p.devices['iPhone 13']); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(500)
    pg.set_input_files('#file',PDF); pg.wait_for_function('window.PM.doc && PMrender.base.ok',timeout=120000); pg.wait_for_timeout(600)
    pg.tap('[data-tool=line]')
    # zoom onto real linework (sample plan: the ROOM label and room outline around page point TX,TY; or the middle of another plan)
    TX,TY=(330,444) if PDF.endswith('sample-plan.pdf') else pg.evaluate('''(()=>{const b=document.querySelector('#canvasBase'),r=b.width/PM.doc.sizes[1].w,d=b.getContext('2d').getImageData(0,0,b.width,b.height).data;
      let best=[b.width/2,b.height/2],bd=1e18; for(let y=0;y<b.height;y++)for(let x=0;x<b.width;x++){const i=4*(y*b.width+x); if(d[i]+d[i+1]+d[i+2]>200) continue; const dd=(x-b.width/2)**2+(y-b.height/2)**2; if(dd<bd){bd=dd;best=[x,y]}}
      return [best[0]/r,best[1]/r]})()''')  # nearest dark linework to the page middle
    scr=lambda x,y: pg.evaluate(f"(()=>{{const r=document.querySelector('#svg').getBoundingClientRect();return [r.left+{x}*PM.zoom,r.top+{y}*PM.zoom]}})()")
    c=scr(TX,TY); pg.evaluate(f'PM.setZoom(PM.zoom*2.5,{c[0]},{c[1]})'); pg.wait_for_timeout(300)
    pg.wait_for_function('!PMrender.busy',timeout=30000); pg.wait_for_timeout(400)
    # probe once to learn where the lens aims relative to the finger, then put the aim on the target
    v=pg.evaluate("(()=>{const r=document.querySelector('#viewport').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height*0.5]})()")
    pg.evaluate("""([x,y])=>{const v=document.querySelector('#viewport');const mk=(t)=>new PointerEvent(t,{bubbles:true,cancelable:true,pointerId:7,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,buttons:1});v.dispatchEvent(mk('pointerdown'));for(let i=1;i<6;i++)v.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,pointerId:7,pointerType:'touch',isPrimary:true,clientX:x+i*3,clientY:y-i*2,buttons:1}));window._probe=loupeWant&&loupeWant.p.slice();v.dispatchEvent(mk('pointercancel'))}""",v)
    pr=pg.evaluate('window._probe'); chk('probe touch opens the lens', bool(pr))
    a=scr(*pr); t=scr(TX,TY); print('  probe aim',pr,'finger',v,'aim scr',a,'target scr',t); v=[v[0]+t[0]-a[0], v[1]+t[1]-a[1]]
    def touch(x,y,name):
        pg.evaluate("""([x,y])=>{const v=document.querySelector('#viewport');const mk=(t,x,y)=>new PointerEvent(t,{bubbles:true,cancelable:true,pointerId:7,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,buttons:1});
          v.dispatchEvent(mk('pointerdown',x,y)); for(let i=1;i<6;i++) v.dispatchEvent(mk('pointermove',x+i*3,y-i*2));}""",[x,y])
        pg.wait_for_timeout(30); pre=pg.evaluate(INK)
        pg.wait_for_timeout(2500); post=pg.evaluate(INK); sharp=pg.evaluate("document.querySelector('#loupe').dataset.sharp")
        lr=pg.evaluate("(()=>{const r=document.querySelector('#loupe').getBoundingClientRect();return [r.top,r.bottom]})()")
        print(f'  {name}: preview ink {pre}, after rest ink {post}, sharp={sharp!r}, lens bottom {lr[1]:.0f} vs finger {y-10:.0f}')
        pg.screenshot(path=f'shots/loupe-ios-{name}.png')
        pg.evaluate("()=>document.querySelector('#viewport').dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:7,pointerType:'touch'}))"); pg.wait_for_timeout(200)
        return pre,post,sharp,lr
    pre,post,sharp,lr=touch(*v,'normal')
    chk('lens shows plan ink right away (preview)', pre>200); chk('lens shows plan ink after rest (sharp render)', post>200 and sharp=='1')
    chk('lens sits above the fingertip', lr[1] < v[1])
    if not PDF.endswith('.pdf'):
        chk('no JS errors '+str(errs), not errs); print('LOUPE-IOS PASS' if ok else 'LOUPE-IOS FAIL'); sys.exit(0 if ok else 1)
    # Safari dropped the detail bitmap (it keeps its size but draws as nothing): the base must show through
    pg.evaluate("(()=>{const c=document.querySelector('#canvas');c.getContext('2d').clearRect(0,0,c.width,c.height)})()")
    # and the sharp lens render comes back blank (render resolves but paints nothing)
    pg.evaluate("""(()=>{const pdf=PM.doc.pdf,g=pdf.getPage.bind(pdf);window._origGetPage=g;pdf.getPage=async n=>{const pp=await g(n);return new Proxy(pp,{get(t,k){if(k==='render')return ()=>({promise:Promise.resolve(),cancel(){}});const v=t[k];return typeof v==='function'?v.bind(t):v}})}})()""")
    pre,post,sharp,lr=touch(*v,'dropped-bitmaps')
    chk('dropped detail bitmap: lens still shows plan ink from the base', pre>100)
    chk('blank lens render does not wipe the lens to white', post>100)
    chk('no JS errors '+str(errs), not errs)
print('LOUPE-IOS PASS' if ok else 'LOUPE-IOS FAIL'); sys.exit(0 if ok else 1)
