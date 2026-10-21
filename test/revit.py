# Regression test for Revit-style CAD exports (synthetic file, see make_revit_dxf.py)
import sys
from playwright.sync_api import sync_playwright
URL=sys.argv[1]; ok=True
def chk(n,c):
    global ok; ok&=bool(c); print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1600,'height':950}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); pg.set_input_files('#file','test/sample-revit.dxf'); pg.wait_for_function('window.PM.proj && PM.doc && PM.doc.cad'); pg.wait_for_timeout(500)
    toast=pg.evaluate("(document.querySelector('#toast')||{}).innerText||''")
    M=pg.evaluate("(()=>{const c=PM.doc.cad;const a=c.toWorld(0,0),z=c.toWorld(c.w,c.h);return {w:c.w,h:c.h,x0:a[0],y1:a[1],x1:z[0],y0:z[1],out:c.outliers,xrefs:c.xrefs}})()")
    print(M)
    chk(f"fit ignores stray far entity and mirrored blocks land inside: extents x {M['x0']:.0f}..{M['x1']:.0f}", -104000<M['x0']<-100000 and -40000<M['x1']<-35000 and -34000<M['y0']<-31000 and 1000<M['y1']<5000)
    chk(f"aspect about 60x34 m (h {M['h']:.0f})", 850<M['h']<950)
    gl=pg.evaluate("(()=>{const c=PM.doc.cad,L=c.layerNames.indexOf('A-GLAZ');let n=0,inn=0;for(let i=0;i<c.nSegs;i++)if(c.sL[i]===L){n++;const w=c.toWorld(c.sx[4*i],c.sx[4*i+1]);if(w[0]>-69500&&w[0]<-59500)inn++}return [n,inn]})()")
    chk(f"mirrored (extrusion -Z) mullions drawn at WCS x -60 m: {gl[1]}/{gl[0]} segments", gl[0]>0 and gl[0]==gl[1])
    chk(f"unresolved external reference reported: {M['xrefs']}", M['xrefs']==['SITE_XREF'] and 'external references' in toast)
    pg.click('#findBtn'); pg.wait_for_timeout(300)
    C=pg.evaluate('PM.FS.cands.map(c=>({w:PM.doc.cad.toWorld(c.x,c.y),size:c.size,src:c.src,name:c.name}))')
    chk(f"Find sleeves: {len(C)} found (expect 5; walls, mullions, grid heads with SLEEVING view name in block name ignored)", len(C)==5)
    s4=[c for c in C if c['size']=='4"']; s3=[c for c in C if c['size']=='3"']
    chk(f"sizes from block name: {len(s4)} x 4\", {len(s3)} x 3\" (drain flange not used)", len(s4)==3 and len(s3)==2 and all(c['src']=='block name' for c in C))
    chk('group names drop the shared view name and instance id', all(not c['name'].endswith('LAYOUT') and not c['name'].endswith('4255577') for c in C))
    # DWG converter path: libredwg puts block contents in BLOCK_RECORD.entities (not in db.entities)
    n=pg.evaluate("""(()=>{const db={header:{INSUNITS:4,EXTMIN:{x:0,y:0},EXTMAX:{x:1000,y:1000}},tables:{LAYER:{entries:[{name:'0',colorIndex:7}]},BLOCK_RECORD:{entries:[
      {name:'*Model_Space',handle:'1F',entities:[]},{name:'LINK',handle:'A0',basePoint:{x:0,y:0},entities:[
       {type:'LINE',layer:'0',colorIndex:256,startPoint:{x:0,y:0},endPoint:{x:1000,y:0}},{type:'ARC',layer:'0',colorIndex:256,center:{x:500,y:500},radius:100,startAngle:0,endAngle:Math.PI}]}]}},
      entities:[{type:'INSERT',name:'LINK',layer:'0',ownerBlockRecordSoftId:'1F',insertionPoint:{x:0,y:0},xScale:1,yScale:1,rotation:0}]};
      const m=CAD._build(CAD._fromDwg(db));return m.segs.length})()""")
    chk(f'DWG block contents from block records are drawn ({n} segments)', n>2)
    pg.screenshot(path='test/out-revit.png')
    chk('no page errors '+str(errs), not errs)
print('REVIT PASS' if ok else 'REVIT FAIL'); sys.exit(0 if ok else 1)
