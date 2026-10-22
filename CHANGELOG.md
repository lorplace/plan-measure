# Changelog

## 1.0.0 - 2026-10-22

First stable release of Plan Measure, a browser-only takeoff tool for the trades.

- Open PDF, PNG/JPG, DXF and DWG plans on the device. Nothing is uploaded
- Zoom, pan, pinch, fit, multi-page PDFs, and a CAD layer list
- Revit-style drawings: link blocks, mirrored families, hatch outlines, and a fit that ignores stray geometry
- Scale from a known distance or from a standard architectural, engineering or metric scale. CAD files take their scale from `$INSUNITS`
- Millimetres are the default unit. Lengths display in mm and areas in m². Metres and feet-inches are available, and each project keeps its own choice
- Measure length, pipe runs (with extra for drops and fittings), area and perimeter, fixture counts and notes
- Sleeves with size, label, origin X/Y, distance to the nearest wall or gridline, and a grid callout such as `4y +1250 mm / C −380 mm`
- Sleeve heights from a level default, a slab zone, elevation text on the plan, or an override. Top, bottom and length export in the sleeve CSV and PDF
- Find sleeves already drawn in DXF/DWG. Size comes from attributes, the block name, nearby text or the diameter. Nuco/MC bucket, Hilti and drain are labelled when the drawing text or block name says so
- Sleeve totals by size, layer and level
- Snapping (end, mid, centre, intersection, on a line), a magnifier, and auto straight for level, plumb and 45 degree lines
- Undo and redo, autosave, a `.pmproj` project file, takeoff CSV, sleeve CSV and a marked-up PDF
- Desktop tool rail (View, Scale, Measure, Sleeves) and a quantities panel. On a phone, a compact top bar, large bottom tools, a drawing bar and a takeoff sheet
