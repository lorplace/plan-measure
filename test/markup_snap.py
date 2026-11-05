"""Markup colours (magenta clouds / red) ignored; gray lines + tight sleeve snap."""
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8877/'
ok = True
def chk(n, c, detail=''):
    global ok; ok &= bool(c)
    print(('PASS ' if c else 'FAIL ') + n + ((' -- ' + str(detail)) if detail and not c else ''))

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1200, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL)
    pg.set_input_files('#file', 'test/sample-markup-cloud.pdf')
    pg.wait_for_function('window.PM && PM.doc && PM.proj', timeout=60000)
    pg.wait_for_timeout(500)
    pg.evaluate('PMsnap.buildGeom(1)')
    pg.wait_for_function('PMsnap.geom[1] && PMsnap.geom[1].ready', timeout=30000)

    cols = pg.evaluate('''() => ({
      mag: PMsnap.isMarkupSnapColor([255,0,153]),
      red: PMsnap.isMarkupSnapColor([229,57,53]),
      gray: PMsnap.isMarkupSnapColor([90,90,90]),
      orange: PMsnap.isMarkupSnapColor([255,115,13]),
    })''')
    chk('magenta markup', cols['mag']); chk('red markup', cols['red'])
    chk('gray not markup', not cols['gray']); chk('orange not markup', not cols['orange'])

    r = pg.evaluate('''() => {
      const G = PMsnap.geom[1];
      let H=null,V=null;
      for (let i=0;i<G.segs.length;i++){
        const s=G.segs[i]; const dx=Math.abs(s[2]-s[0]), dy=Math.abs(s[3]-s[1]);
        if(dx>100&&dy<3) H=s; if(dy>100&&dx<3) V=s;
      }
      if(!H||!V) return {ok:false,n:G.segs.length};
      const cx=(V[0]+V[2])/2, cy=(H[1]+H[3])/2;
      const hit = PMsnap.findSnap([cx+1,cy+1], 8, null, {noSleeve:true, mode:'measure'});
      // inject sleeve 6 units away -- must not steal corner
      const CELL=24, sp=[cx+6,cy], xy=new Float64Array([sp[0],sp[1]]), grid=new Map();
      grid.set(Math.floor(sp[0]/CELL)+','+Math.floor(sp[1]/CELL),[0]);
      G.sleeve={gen:1,page:1,n:1,xy,grid,kinds:['anchor']};
      const steal=PMsnap.findSnap([cx+0.5,cy+0.5], 8, null, {sleeveR:8, mode:'measure'});
      const onSl=PMsnap.findSnap([sp[0],sp[1]], 8, null, {sleeveR:8, mode:'measure'});
      return {ok:true,n:G.segs.length,hit,steal,onSl,cx,cy};
    }''')
    print(r)
    chk('indexed walls, not cloud', r.get('ok') and r['n'] < 20, r)
    chk('corner snap', r.get('hit') and abs(r['hit']['p'][0]-r['cx'])<2 and abs(r['hit']['p'][1]-r['cy'])<2)
    chk('nearby sleeve does not steal gray corner', r.get('steal') and r['steal']['kind']!='sleeve', r.get('steal'))
    chk('sleeve wins when aimed', r.get('onSl') and r['onSl']['kind']=='sleeve')

    pg.evaluate('PM.setTool("line")')
    pg.evaluate('PM.clickAt([150,150], {pointerType:"mouse", altKey:true})')
    pg.wait_for_timeout(100)
    n = pg.evaluate('''() => {
      const before = PM.draft && PM.draft.pts[0] && PM.draft.pts[0].slice();
      document.querySelector('.nud[data-n="1,0"]').click();
      const after = PM.draft && PM.draft.pts[0];
      return { before, after, hit: PMsnap.hit };
    }''')
    print('nudge', n)
    chk('nudge moved without re-snap', n.get('before') and n.get('after') and n['after'][0] > n['before'][0] and n['hit'] is None, n)
    chk('no page errors', not errs, errs)
    pg.screenshot(path='shots/markup-snap.png')
    b.close()
print('MARKUP SNAP PASS' if ok else 'MARKUP SNAP FAIL')
sys.exit(0 if ok else 1)
