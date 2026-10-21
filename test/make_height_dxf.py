# Synthetic slab-height test plan (mm): 3 sleeve blocks, one with an elevation label next to it
import ezdxf
d = ezdxf.new('R2010'); d.header['$INSUNITS'] = 4; m = d.modelspace()
for n in ['A-WALL', 'P-SLEEVE', 'P-ANNO']: d.layers.add(n)
m.add_lwpolyline([(0, 0), (20000, 0), (20000, 10000), (0, 10000)], close=True, dxfattribs={'layer': 'A-WALL'})
m.add_line((10000, 0), (10000, 10000), dxfattribs={'layer': 'A-WALL'})
b = d.blocks.new('SLEEVE-100'); b.add_circle((0, 0), 57)
for p in [(5000, 5000), (15000, 5000), (15000, 8000)]: m.add_blockref('SLEEVE-100', p, dxfattribs={'layer': 'P-SLEEVE'})
m.add_text('T/O SLAB 64,650', dxfattribs={'layer': 'P-ANNO', 'height': 150}).set_placement((15150, 8150))
d.saveas('test/sample-heights.dxf'); print('ok')
