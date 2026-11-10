# Usage: python3 test/make_site.py test/sample-site.pdf test/sample-site.json
# Synthetic sleeving sheet (no client data): gray walls, marks in three colours, leaders with filled arrowheads,
# a magenta revision cloud, red markup, and a dimension string with slash ticks.
import sys, json, math
from reportlab.pdfgen import canvas
W, H = 2592, 1728  # 36 x 24 in
out, meta_path = sys.argv[1], sys.argv[2]
c = canvas.Canvas(out, pagesize=(W, H))
meta = {'W': W, 'H': H, 'marks': [], 'arrows': [], 'ticks': [], 'walls': []}
def wall(x1, y1, x2, y2):
    c.setStrokeColorRGB(0.45, 0.45, 0.45); c.setLineWidth(1.2); c.line(x1, y1, x2, y2); meta['walls'].append([x1, H - y1, x2, H - y2])
# building outline + interior walls
wall(300, 300, 2300, 300); wall(300, 1400, 2300, 1400); wall(300, 300, 300, 1400); wall(2300, 300, 2300, 1400)
wall(900, 300, 900, 1000); wall(1500, 700, 1500, 1400); wall(300, 800, 700, 800)   # this one stops short at x=700
wall(1900, 912, 2300, 912)                                                           # far wall, collinear trap for to-wall
def diamond(x, y, r, fill, stroke):
    p = c.beginPath(); p.moveTo(x, y + r); p.lineTo(x + r, y); p.lineTo(x, y - r); p.lineTo(x - r, y); p.close()
    c.setFillColorRGB(*fill); c.setStrokeColorRGB(*stroke); c.setLineWidth(0.6); c.drawPath(p, stroke=1, fill=1)
def arrow(x1, y1, x2, y2):  # leader with a filled black arrowhead at (x2,y2)
    c.setStrokeColorRGB(0, 0, 0); c.setLineWidth(0.5); c.line(x1, y1, x2, y2)
    a = math.atan2(y2 - y1, x2 - x1); L = 7; p = c.beginPath(); p.moveTo(x2, y2)
    p.lineTo(x2 - L * math.cos(a - 0.3), y2 - L * math.sin(a - 0.3)); p.lineTo(x2 - L * math.cos(a + 0.3), y2 - L * math.sin(a + 0.3)); p.close()
    c.setFillColorRGB(0, 0, 0); c.drawPath(p, stroke=0, fill=1); meta['arrows'].append([x2, H - y2])
cols = {'orange': ((1, 0.55, 0), (0.8, 0.4, 0)), 'black': ((0, 0, 0), (0, 0, 0)), 'brown': ((0.55, 0.27, 0.07), (0.4, 0.2, 0.05))}
i = 0
for gy in range(6):
    for gx in range(10):
        x, y = 420 + gx * 44 + (gy % 2) * 9, 1250 - gy * 52
        name = ['orange', 'black', 'brown'][i % 3]; i += 1
        if name == 'black':
            c.setFillColorRGB(0, 0, 0); c.circle(x, y, 3.2, stroke=0, fill=1)
        else:
            diamond(x, y, 4.5, *cols[name])
        meta['marks'].append({'x': x, 'y': H - y, 'col': name})
        c.setFillColorRGB(0, 0, 0); c.setFont('Helvetica', 4.5); c.drawString(x + 7, y + 5, '4" VENT 900L')
        if i % 4 == 0: arrow(x + 22, y - 16, x + 6, y - 5)      # arrow tip 7.8 pt from the centre
# a lone mark for to-wall: 60 pt left of wall x=900, and 12 pt off the line of the far wall y=1150
diamond(840, 900, 4.5, *cols["orange"]); meta["towall"] = {"x": 840, "y": H - 900, "near_wall_x": 900, "far_line_y": H - 912}
# and one beside the wall that stops short (wall y=800 ends at x=700; mark at x=730, 40 pt above it)
diamond(730, 840, 4.5, *cols['orange']); meta['short'] = {'x': 730, 'y': H - 840, 'wall_y': H - 800}
# arrows pointing at a wall: tip 5 pt off the wall line x=2300
for k, yy in enumerate((500, 600, 700)):
    arrow(2240, yy + 25, 2295, yy); meta.setdefault('wall_arrows', []).append([2295, H - yy])
# dimension string under the plan with 45 degree slash ticks
c.setStrokeColorRGB(0.2, 0.2, 0.2); c.setLineWidth(0.5); c.line(280, 220, 2320, 220)
for x in (300, 900, 1500, 2300):
    c.line(x, 205, x, 290); c.setLineWidth(1.0); c.line(x - 5, 215, x + 5, 225); c.setLineWidth(0.5); meta['ticks'].append([x, H - 220])
# magenta revision cloud (arcs) and red markup crossing the plan
c.setStrokeColorRGB(1, 0, 1); c.setLineWidth(1.5)
for k in range(12): c.arc(1000 + k * 30, 880, 1030 + k * 30, 910, 0, 180)
meta['cloud'] = [[1015 + k * 30, H - 910] for k in range(12)]
c.setStrokeColorRGB(0.9, 0.05, 0.05); c.setLineWidth(1.5); c.line(1100, 500, 1400, 620); meta['red'] = [[1100, H - 500], [1400, H - 620], [1250, H - 560]]
c.showPage(); c.save(); json.dump(meta, open(meta_path, 'w'))
print('marks', len(meta['marks']))
