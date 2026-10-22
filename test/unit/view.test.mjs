import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const View = require('../../view.js');
const html = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../index.html'), 'utf8');

describe('fullscreen strategy', () => {
  test('desktop and Android use the Fullscreen API when the browser has it', () => {
    expect(View.fullscreenStrategy({ requestFullscreen: true, iphone: false })).toBe('api');
    expect(View.fullscreenStrategy({ webkitRequestFullscreen: true, iphone: false })).toBe('api');
    expect(View.isIphone('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0 Mobile')).toBe(false);
  });

  test('iPhone Safari falls back to immersive mode, and so does a browser with no API', () => {
    expect(View.isIphone('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1')).toBe(true);
    expect(View.isIphone('Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15')).toBe(true);
    expect(View.isIphone('Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15')).toBe(false);
    expect(View.fullscreenStrategy({ requestFullscreen: true, iphone: true })).toBe('immersive');
    expect(View.fullscreenStrategy({ iphone: true })).toBe('immersive');
    expect(View.fullscreenStrategy({ iphone: false })).toBe('immersive');
    expect(View.fullscreenStrategy(null)).toBe('immersive');
  });
});

describe('print fit', () => {
  test('a wide sheet is landscape and a tall sheet is portrait, both centred inside the margin', () => {
    const wide = View.fitSheet(1440, 1080);
    expect(wide.orientation).toBe('landscape');
    expect(wide.pageW).toBe(792);
    expect(wide.pageH).toBe(612);
    expect(wide.scale).toBeCloseTo(0.5, 9);
    expect(wide.drawW).toBeCloseTo(720, 6);
    expect(wide.drawH).toBeCloseTo(540, 6);
    expect(wide.x).toBeCloseTo(36, 6);
    expect(wide.y).toBeCloseTo(36, 6);

    const tall = View.fitSheet(1000, 2000);
    expect(tall.orientation).toBe('portrait');
    expect(tall.pageW).toBe(612);
    expect(tall.pageH).toBe(792);
    expect(tall.scale).toBeCloseTo(0.36, 9);
    expect(tall.drawH).toBeCloseTo(720, 6);
    expect(tall.y).toBeCloseTo(36, 6);
    expect(tall.x).toBeGreaterThan(tall.margin);
  });

  test('a square sheet uses landscape, and the drawing stays inside the paper', () => {
    const sq = View.fitSheet(800, 800, { margin: 36 });
    expect(sq.orientation).toBe('landscape');
    expect(sq.x).toBeGreaterThanOrEqual(sq.margin - 1e-6);
    expect(sq.y).toBeGreaterThanOrEqual(sq.margin - 1e-6);
    expect(sq.x + sq.drawW).toBeLessThanOrEqual(sq.pageW - sq.margin + 1e-6);
    expect(sq.y + sq.drawH).toBeLessThanOrEqual(sq.pageH - sq.margin + 1e-6);
  });

  test('raster size follows the fitted drawing and stays under the pixel cap', () => {
    const fit = View.fitSheet(1440, 1080);
    const px = View.rasterSize(fit.drawW, fit.drawH, { dpi: 192 });
    expect(px).toEqual({ w: 1920, h: 1440 });
    const capped = View.rasterSize(5000, 5000, { dpi: 300, maxPixels: 1e6, maxEdge: 2000 });
    expect(capped.w * capped.h).toBeLessThanOrEqual(1e6);
    expect(Math.max(capped.w, capped.h)).toBeLessThanOrEqual(2000);
    expect(capped.w).toBeGreaterThan(0);
    expect(capped.h).toBeGreaterThan(0);
  });

  test('the print plan keeps the orientation and the quantities choice', () => {
    const plan = View.printPlan(1224, 792, { quantities: true, dpi: 192 });
    expect(plan.orientation).toBe('landscape');
    expect(plan.quantities).toBe(true);
    expect(plan.pixels.w).toBeGreaterThan(plan.pixels.h);
    expect(View.printPlan(792, 1224, { quantities: false }).quantities).toBe(false);
  });

  test('the page offers full screen, print, and the view module', () => {
    expect(html).toContain('<script src="view.js"></script>');
    expect(html).toContain('id="fullBtn"');
    expect(html).toContain('id="printBtn"');
    expect(html).toContain('id="fsExit"');
    expect(html).toContain('id="printQtyOpt"');
  });
});
