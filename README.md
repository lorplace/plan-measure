# Plan Measure
Free, browser-only plan viewer and takeoff tool for PDF, images and CAD (DXF, DWG). Files never leave the browser.
Libraries (vendored in lib/): pdf.js 3.11.174 (Apache-2.0), pdf-lib 1.17.1 (MIT), dxf-parser 1.1.2 (MIT), libredwg-web 0.8.1 (GPL-3.0, lazy-loaded for DWG only, see lib/dwg/NOTICE.txt).
Deploy: copy site files (index.html, style.css, app.js, units.js, cad.js, lib/) and `wrangler pages deploy <dir> --project-name plan-measure`.
Tests (Playwright + Chrome): `python3 test/make_sample.py && python3 test/make_dxf.py`, then `python3 test/e2e.py [url]` and `python3 test/{phone,loupe,undo,snap,cad}.py <url>`.
