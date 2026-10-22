import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';
const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');
const Units = require('../../units.js');

const FT = 0.3048, IN = 0.0254;

describe('default units', () => {
  test('millimetres are the default, and metric areas are square metres', () => {
    expect(Units.DEFAULT_UNITS).toBe('mm');
    expect(Units.isMet('mm')).toBe(true);
    expect(Units.isMet('met')).toBe(true);
    expect(Units.isMet('imp')).toBe(false);
    expect(Units.fmtArea(12, 'mm')).toBe('12.00 m²');
    expect(Units.fmtArea(12, 'met')).toBe('12.00 m²');
    expect(Units.fmtArea(12, 'imp')).toBe((12 / (FT * FT)).toFixed(1) + ' sq ft');
  });

  test('the page opens with millimetres selected', () => {
    const html = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
    expect(html).toMatch(/<option value="mm" selected>Millimetres \(mm\)<\/option>/);
    expect(html).toContain('<script src="measure.js"></script>');
    expect(html).toContain('<script src="straight.js"></script>');
    expect(html).toContain('<script src="sleeves.js"></script>');
    expect(html).toContain('<script src="grid.js"></script>');
  });
});

describe('parseLength', () => {
  test('reads metric, feet-inches and a bare number in the default unit', () => {
    expect(Units.parseLength('3500mm', 'mm')).toBeCloseTo(3.5, 9);
    expect(Units.parseLength('3.5m', 'mm')).toBeCloseTo(3.5, 9);
    expect(Units.parseLength('35cm', 'mm')).toBeCloseTo(0.35, 9);
    expect(Units.parseLength('3,5m', 'mm')).toBeCloseTo(3.5, 9);
    expect(Units.parseLength('20ft', 'mm')).toBeCloseTo(20 * FT, 9);
    expect(Units.parseLength('18in', 'mm')).toBeCloseTo(18 * IN, 9);
    expect(Units.parseLength('12\'6"', 'mm')).toBeCloseTo(12 * FT + 6 * IN, 9);
    expect(Units.parseLength('12\' 6 1/2"', 'mm')).toBeCloseTo(12 * FT + 6.5 * IN, 9);
    expect(Units.parseLength("12'-6", 'imp')).toBeCloseTo(12 * FT + 6 * IN, 9);
    expect(Units.parseLength('3500', 'mm')).toBeCloseTo(3.5, 9);
    expect(Units.parseLength('10', 'met')).toBe(10);
    expect(Units.parseLength('10', 'imp')).toBeCloseTo(10 * FT, 9);
    expect(Units.parseLength('', 'mm')).toBeNaN();
    expect(Units.parseLength('abc', 'mm')).toBeNaN();
  });
});

describe('format', () => {
  test('lengths in millimetres are rounded, small metric lengths stay in millimetres', () => {
    expect(Units.fmtLen(1.25, 'mm')).toBe('1250 mm');
    expect(Units.fmtLen(0.38, 'mm')).toBe('380 mm');
    expect(Units.fmtLen(1.2344, 'mm')).toBe('1234 mm');
    expect(Units.fmtLen(1.2346, 'mm')).toBe('1235 mm');
    expect(Units.fmtLen(0.38, 'met')).toBe('380 mm');
    expect(Units.fmtLen(1.25, 'met')).toBe('1.25 m');
    expect(Units.fmtLen(12.5 * FT, 'imp')).toBe('12\'-6"');
    expect(Units.fmtLen(NaN, 'mm')).toBe('-');
  });
});

describe('standard scales', () => {
  test('1/4 inch = 1 foot and 1:100 are metres per PDF point', () => {
    const q = Units.STD.find(s => s.name === '1/4" = 1\'-0"');
    const m100 = Units.STD.find(s => s.name === '1:100');
    expect(q.ratio).toBe(48);
    expect(q.mPerPt).toBeCloseTo(Units.PT * 48, 12);
    expect(m100.mPerPt).toBeCloseTo(Units.PT * 100, 12);
    // 1/4" on paper is 18 points and one foot of building.
    expect(18 * q.mPerPt).toBeCloseTo(FT, 12);
  });
});
