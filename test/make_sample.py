from reportlab.pdfgen import canvas
from reportlab.lib.units import inch, mm
c=canvas.Canvas('test/sample-plan.pdf',pagesize=(17*inch,11*inch))
c.setFont('Helvetica-Bold',18);c.drawString(72,740,'SAMPLE PLUMBING PLAN - SCALE 1/4" = 1\'-0"')
x0,y0=144,200
c.setLineWidth(2);c.line(x0,y0,x0+5*inch,y0)  # 20'-0"
c.drawString(x0+150,y0+10,"20'-0\"")
c.rect(x0,y0+60,5*inch,2.5*inch)  # 20' x 10' = 200 sf
c.drawString(x0+120,y0+150,"ROOM 20' x 10' = 200 SF")
c.showPage()
c.setFont('Helvetica-Bold',18);c.drawString(72,740,'PAGE 2 - SCALE 1:100 (metric)')
c.setLineWidth(2);c.line(144,300,144+50*mm,300)  # 5.000 m
c.drawString(170,310,'5000 mm')
c.rect(144,400,40*mm,30*mm)  # 4m x 3m = 12 m2
c.showPage();c.save()
