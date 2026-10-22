# Synthetic millimetre plan for sleeve type and gridline offsets. No survey or client geometry.
import ezdxf

d = ezdxf.new('R2010')
d.header['$INSUNITS'] = 4
m = d.modelspace()
for name, color in [('S-GRID', 1), ('WALLS', 7), ('P-SLEEVE', 4), ('COLUMNS', 5), ('DRAIN', 3), ('TEXT', 7)]:
    d.layers.add(name, color=color)

def vgrid(x, label):
    m.add_line((x, -500), (x, 6000), dxfattribs={'layer': 'S-GRID'})
    m.add_text(label, dxfattribs={'layer': 'S-GRID', 'height': 250}).set_placement((x - 40, 6100))

def hgrid(y, label):
    m.add_line((-500, y), (12000, y), dxfattribs={'layer': 'S-GRID'})
    m.add_text(label, dxfattribs={'layer': 'S-GRID', 'height': 250}).set_placement((-600, y - 40))

vgrid(0, '4')
vgrid(10000, '4y')
hgrid(0, 'B')
hgrid(5000, 'C')
m.add_lwpolyline([(500, 500), (11000, 500), (11000, 4500), (500, 4500)], close=True, dxfattribs={'layer': 'WALLS'})

def sleeve(x, y, notes):
    m.add_circle((x, y), 80, dxfattribs={'layer': 'P-SLEEVE'})
    for i, text in enumerate(notes):
        m.add_text(text, dxfattribs={'layer': 'TEXT', 'height': 120}).set_placement((x + 150, y + 40 - i * 180))

sleeve(11250, 4620, ['NUCO MC BUCKET', '4"'])
sleeve(2500, 1500, ['HILTI', '6"'])
sleeve(2500, 3000, ['FLOOR DRAIN', '3"'])
m.add_circle((8000, 2500), 200, dxfattribs={'layer': 'COLUMNS'})
m.add_circle((8000, 1000), 100, dxfattribs={'layer': 'DRAIN'})
wc = d.blocks.new('WC')
wc.add_circle((0, 0), 150)
m.add_blockref('WC', (6000, 1000), dxfattribs={'layer': 'COLUMNS'})
m.add_text('SYNTHETIC SLEEVE PLAN', dxfattribs={'layer': 'TEXT', 'height': 300}).set_placement((500, 6800))
d.saveas('test/sample-grid.dxf')
print('ok')
