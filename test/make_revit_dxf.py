# Synthetic "Revit export" DXF reproducing a real-world rendering bug report (no client data):
# - all geometry lives inside link blocks inserted at 0,0, far from the origin (x -100 m .. -40 m)
# - mirrored family instances use extrusion (0,0,-1) (OCS), which must be mirrored in X
# - every block name ends with the same view name, which contains "SLEEVING"
# - sleeve size is in the block name; drain sleeves have a larger flange circle
# - one stray entity very far away; one unresolved external reference
import ezdxf
d = ezdxf.new('R2010'); d.header['$INSUNITS'] = 4; m = d.modelspace(); SFX = '-LEVEL 1 WEST - SLAB SLEEVING LAYOUT'
for n in ['A-WALL', 'A-GLAZ', 'P-PIPE', 'S-GRID', 'P-PIPE-IDEN']: d.layers.add(n)
X0, X1, Y0, Y1 = -100000, -40000, -30000, 0
mul = d.blocks.new('Rectangular Mullion - 64mm x 190mm-2242' + SFX); mul.add_lwpolyline([(0, 0), (64, 0), (64, 190), (0, 190)], close=True, dxfattribs={'layer': 'A-GLAZ'})
bld = d.blocks.new('Proj_Building_rvt-1' + SFX)
bld.add_lwpolyline([(X0, Y0), (X1, Y0), (X1, Y1), (X0, Y1)], close=True, dxfattribs={'layer': 'A-WALL'})
for i in range(40): bld.add_line((X0 + 1500 * i, Y0), (X0 + 1500 * i, Y0 + 500), dxfattribs={'layer': 'A-WALL'})
# mirrored mullions: OCS x = +60000 means WCS x = -60000 (inside the building)
for i in range(30): bld.add_blockref(mul.name, (60000 + 300 * i, -15000), dxfattribs={'layer': 'A-GLAZ', 'extrusion': (0, 0, -1)})
m.add_blockref(bld.name, (0, 0))
def sleeve(name, r, flange=None):
    b = d.blocks.new(name)
    b.add_arc((0, 0), r, 0, 180, dxfattribs={'layer': 'P-PIPE'}); b.add_arc((0, 0), r, 180, 360, dxfattribs={'layer': 'P-PIPE'})
    b.add_arc((0, 0), r + 3, 0, 180, dxfattribs={'layer': 'P-PIPE'}); b.add_arc((0, 0), r + 3, 180, 360, dxfattribs={'layer': 'P-PIPE'})
    b.add_line((0, r + 3), (0, r + 28), dxfattribs={'layer': 'P-PIPE'})
    if flange: b.add_circle((0, 0), flange, dxfattribs={'layer': 'P-PIPE'})
    return name
s4 = sleeve('MfrX_SLV_Round_FLR_Hilti - SLV_Round_FLR_4_-4255577' + SFX, 50.8)
s3 = sleeve('MfrX_SLV_Round_FLR_Drain - SLV_Round_FLR_3_-4257679' + SFX, 38.1, flange=75.6)
for x in (-90000, -80000, -70000): m.add_blockref(s4, (x, -10000), dxfattribs={'layer': 'P-PIPE'})
for x in (-60000, -50000): m.add_blockref(s3, (x, -20000), dxfattribs={'layer': 'P-PIPE'})
gh = d.blocks.new('Grid - GridHead_Circle_5mm-361182' + SFX); gh.add_circle((0, 0), 300)
for x in range(X0, X1 + 1, 10000): m.add_line((x, Y0 - 1000), (x, Y1 + 1000), dxfattribs={'layer': 'S-GRID'}); m.add_blockref(gh.name, (x, Y1 + 1300), dxfattribs={'layer': 'S-GRID'})
m.add_line((5e6, 5e6), (5e6 + 10, 5e6), dxfattribs={'layer': 'A-WALL'})  # stray far-away entity
x = d.blocks.new('SITE_XREF', dxfattribs={'flags': 4, 'xref_path': 'site.dwg'}); m.add_blockref('SITE_XREF', (0, 0))
d.saveas('test/sample-revit.dxf'); print('ok')
