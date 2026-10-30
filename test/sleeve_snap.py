"""Sleeve-centre snap priority + perpendicular-to-wall Length measure."""
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8877/'
ok = True
def chk(n, c):
    global ok; ok &= bool(c); print(('PASS ' if c else 'FAIL ') + n)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])

    # --- CAD: sleeve centres beat nearby geometry ---
    errs = []
    pg = b.new_page(viewport={'width': 1400, 'height': 900})
    pg.on('pageerror', lambda e: errs.append('cad ' + str(e)))
    pg.on('console', lambda m: (m.type == 'error') and errs.append('cad ' + m.text))
    pg.goto(URL)
    pg.set_input_files('#file', 'test/sample-sleeves.dxf')
    pg.wait_for_function('window.PM && PM.doc && PM.proj', timeout=60000)
    pg.evaluate("""() => { const d=document.querySelector('#askDlg'); if(d&&d.open) document.querySelector('#askOk')?.click(); }""")
    pg.wait_for_timeout(800)
    pg.evaluate('PMsnap.buildGeom(1).then(()=>PMsnap.ensureSleeveSnap(1))')
    pg.wait_for_function('PMsnap.geom[1] && PMsnap.geom[1].sleeve && PMsnap.geom[1].sleeve.n > 0', timeout=15000)
    info = pg.evaluate("""() => {
      const cands = PM.findCandidates('auto');
      const G = PMsnap.geom[1];
      const c = cands[0];
      // Place a markup point near the sleeve; probe closer to markup than sleeve — sleeve pri must still win
      const markup = [c.x + 12, c.y];
      PM.proj.items.push({ id:'mk1', type:'count', page:1, pts:[markup], color:'#000', label:'' });
      const p = [c.x + 9, c.y]; // d(sleeve)=9, d(markup)=3
      const dSleeve = Math.hypot(p[0]-c.x,p[1]-c.y), dMk = Math.hypot(p[0]-markup[0],p[1]-markup[1]);
      const hit = PMsnap.findSnap(p, 20, null);
      return {nSleeve:G.sleeve.n, dSleeve, dMk, closerToMarkup:dMk<dSleeve, hit:hit&&{kind:hit.kind,pri:hit.pri,p:hit.p}};
    }""")
    print('cad sleeve info', info)
    chk('cad sleeve index non-empty', info['nSleeve'] > 0)
    chk('cad probe closer to markup than sleeve', info.get('closerToMarkup'))
    chk('cad sleeve still wins snap', info.get('hit') and info['hit']['kind'] == 'sleeve' and info['hit']['pri'] == -1)
    perp = pg.evaluate("""() => {
      const c = PM.findCandidates('auto')[0];
      const hit = PMsnap.nearestPerpWall([c.x,c.y], null, 400);
      if (!hit) return null;
      const s=hit.seg, dx=s[2]-s[0], dy=s[3]-s[1], fx=hit.foot[0]-c.x, fy=hit.foot[1]-c.y;
      const dot = Math.abs((dx*fx+dy*fy) / (Math.hypot(dx,dy)*Math.hypot(fx,fy)+1e-12));
      return {onSeg:hit.onSeg, dLen:hit.dLen, hasExt:!!hit.ext, dot, foot:hit.foot};
    }""")
    print('cad perp', perp)
    chk('cad perp foot found', perp and perp['dLen'] > 0)
    chk('cad perp is perpendicular', perp and perp['dot'] < 0.05)
    tw = pg.evaluate("""() => {
      const c = PM.findCandidates('auto')[0];
      const hit = PMsnap.nearestPerpWall([c.x,c.y], null, 2000);
      if (!hit) return {ok:false};
      const n0 = PM.proj.items.length;
      const it = { id:'t'+Date.now(), type:'line', page:1, pts:[[c.x,c.y], hit.foot.slice()], color:'#e53935', label:'' };
      if (hit.ext) it.ext = [hit.ext[0].slice(), hit.ext[1].slice()];
      PM.proj.items.push(it);
      return {ok:true, n:PM.proj.items.length-n0, onSeg:hit.onSeg, hasExt:!!it.ext, len:Math.hypot(hit.foot[0]-c.x, hit.foot[1]-c.y)};
    }""")
    print('to-wall measure', tw)
    chk('cad sleeve-to-wall measure created', tw and tw.get('ok'))
    chk('cad no console errors ' + str(errs), not errs)
    pg.close()

    # --- Image: orange anchors + perp with extension ---
    errs2 = []
    pg = b.new_page(viewport={'width': 1200, 'height': 800})
    pg.on('pageerror', lambda e: errs2.append(str(e)))
    pg.goto(URL)
    pg.set_input_files('#file', 'test/sample-orange-anchors.png')
    pg.wait_for_function('window.PM && PM.doc && PM.proj', timeout=30000)
    pg.wait_for_timeout(400)
    pg.evaluate('PMsnap.buildGeom(1).then(()=>PMsnap.ensureSleeveSnap(1))')
    pg.wait_for_function('PMsnap.geom[1] && PMsnap.geom[1].ready && PMsnap.geom[1].sleeve', timeout=20000)
    pg.wait_for_timeout(500)
    orange = pg.evaluate("""() => {
      const G = PMsnap.geom[1];
      const n = G.sleeve ? G.sleeve.n : 0;
      const wallN = G.wallN||G.segs.length;
      const hit = PMsnap.findSnap([203, 252], 20, null);
      // Perp from (200,250) toward wall at y=100 (segment starts at x=300) → foot (200,100) needs extension
      // Prefer the short horizontal wall above (toward [200,100]) so the foot falls past the segment end
      const perp = PMsnap.nearestPerpWall([200,250], [200,90], 400);
      return {n, wallN, hit: hit&&{kind:hit.kind,pri:hit.pri,p:hit.p},
        perp: perp&&{foot:perp.foot,onSeg:perp.onSeg,hasExt:!!perp.ext,dLen:perp.dLen}};
    }""")
    print('orange', orange)
    chk('orange anchors detected', orange['n'] >= 1)
    chk('orange snap is sleeve priority', orange['hit'] and orange['hit']['kind'] == 'sleeve')
    chk('image axis segs extracted', orange.get('wallN', orange.get('wallN')) >= 1)
    chk('orange perp needs extension', orange['perp'] and orange['perp']['hasExt'] and abs(orange['perp']['foot'][1] - 100) < 3)
    chk('image no errors ' + str(errs2), not errs2)
    pg.close()

    # --- Phone viewport smoke ---
    errs3 = []
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs3.append(str(e)))
    pg.goto(URL)
    pg.set_input_files('#file2', 'test/sample-sleeves.dxf')
    pg.wait_for_function('window.PM && PM.doc', timeout=60000)
    pg.evaluate("""() => { const d=document.querySelector('#askDlg'); if(d&&d.open) document.querySelector('#askOk')?.click(); }""")
    pg.wait_for_timeout(1000)
    pg.evaluate('PMsnap.ensureSleeveSnap(1)')
    pg.wait_for_function('PMsnap.geom[1] && PMsnap.geom[1].sleeve && PMsnap.geom[1].sleeve.n > 0', timeout=20000)
    pg.tap('[data-tool=line]')
    n = pg.evaluate('PMsnap.geom[1].sleeve.n')
    chk('phone sleeve index ready', n > 0)
    chk('phone no errors ' + str(errs3), not errs3)
    chk('toWallBtn in DOM', pg.evaluate('!!document.querySelector("#toWallBtn")'))
    b.close()

print('SLEEVE_SNAP PASS' if ok else 'SLEEVE_SNAP FAIL')
sys.exit(0 if ok else 1)
