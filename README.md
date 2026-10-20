# Plan Measure
Free, browser-only PDF/image plan viewer and takeoff tool. Files never leave the browser.
Libraries: pdf.js 3.11.174, pdf-lib 1.17.1 (vendored in lib/). Static site; deploy: `npx wrangler pages deploy . --project-name plan-measure`.
Tests: `python3 test/make_sample.py && python3 test/e2e.py [url]` (Playwright + Chrome).
