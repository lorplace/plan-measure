import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';
const require = createRequire(import.meta.url);
const Units = require('../../units.js');
const Measure = require('../../measure.js');

describe('length, area and count', () => {
  test('a calibrated length, a closed area and a count', () => {
    const scale = Measure.scaleFromDistance(100, Units.parseLength('3500mm', 'mm'));
    expect(scale).toBeCloseTo(0.035, 12);
    const line = { type: 'line', page: 1, pts: [[0, 0], [200, 0]] };
    expect(Measure.measure(line, scale)).toBeCloseTo(7, 9);
    expect(Units.fmtLen(Measure.measure(line, scale), 'mm')).toBe('7000 mm');

    const rect = { type: 'area', page: 1, pts: [[0, 0], [4000, 0], [4000, 3000], [0, 3000]] };
    expect(Measure.measure(rect, 0.001)).toBeCloseTo(12, 9);
    expect(Units.fmtArea(Measure.measure(rect, 0.001), 'mm')).toBe('12.00 m²');
    const reversed = { type: 'area', page: 1, pts: [[0, 0], [0, 3000], [4000, 3000], [4000, 0]] };
    expect(Measure.measure(reversed, 0.001)).toBeCloseTo(12, 9);

    const run = { type: 'poly', page: 1, pts: [[0, 0], [3000, 0], [3000, 4000]], extra: 0.6 };
    expect(Measure.polyLen(run.pts, false)).toBe(7000);
    expect(Measure.measure(run, 0.001)).toBeCloseTo(7.6, 9);
    expect(Measure.polyLen([[0, 0], [3, 0], [3, 4]], true)).toBeCloseTo(12, 9);

    expect(Measure.measure({ type: 'count', page: 1, pts: [[1, 1]] }, null)).toBe(1);
    expect(Measure.measure({ type: 'sleeve', page: 1, pts: [[1, 1]] }, null)).toBe(1);
    expect(Measure.measure(line, 0)).toBeNaN();
    expect(Measure.measure({ type: 'text', page: 1, pts: [[0, 0]] }, 1)).toBeNaN();
  });

  test('architectural scale matches a known-distance calibration', () => {
    const arch = Units.STD.find(s => s.ratio === 48);
    const metric = Units.STD.find(s => s.name === '1:100');
    // 5 inches by 2.5 inches of paper at 1/4" = 1'-0" is 20 ft by 10 ft.
    const w = 5 * 72, h = 2.5 * 72;
    const area = Measure.measure({ type: 'area', pts: [[0, 0], [w, 0], [w, h], [0, h]] }, arch.mPerPt);
    expect(area).toBeCloseTo(200 * Units.FT * Units.FT, 9);
    expect(Units.fmtArea(area, 'mm')).toBe(area.toFixed(2) + ' m²');
    // 50 mm of paper equals 5 m at 1:100, which is the calibration used on a metric sheet.
    const paperPts = 50 * (72 / 25.4);
    expect(Measure.scaleFromDistance(paperPts, 5)).toBeCloseTo(metric.mPerPt, 12);
    expect(Measure.scaleFromStandard(metric, 'pdf')).toBe(metric.mPerPt);
    expect(Measure.scaleFromStandard(metric, 'image', 150)).toBeCloseTo(metric.ratio * Units.IN / 150, 12);
    expect(Measure.scaleFromStandard(metric, 'image', 0)).toBeCloseTo(metric.ratio * Units.IN / 150, 12);
  });

  test('takeoff groups sum lengths and count fixtures, and skip notes', () => {
    const items = [
      { type: 'line', page: 1, pts: [[0, 0], [2, 0]], color: '#e53935', label: 'PEX' },
      { type: 'line', page: 1, pts: [[0, 0], [1, 0]], color: '#e53935', label: 'PEX', extra: 0.5 },
      { type: 'count', page: 1, pts: [[0, 0]], color: '#1565c0', label: 'WC' },
      { type: 'count', page: 1, pts: [[1, 0]], color: '#1565c0', label: 'WC' },
      { type: 'count', page: 1, pts: [[2, 0]], color: '#1565c0', label: 'WC' },
      { type: 'area', page: 2, pts: [[0, 0], [2, 0], [2, 2]], color: '#2e7d32', label: '' },
      { type: 'text', page: 1, pts: [[0, 0]], color: '#111', label: '', text: 'note' },
      { type: 'sleeve', page: 1, pts: [[0, 0]], color: '#ff6d00', size: '4"', label: '' }
    ];
    const scaleOf = pg => (pg === 2 ? null : 1);
    const groups = Measure.groupTakeoff(items, scaleOf);
    const pex = groups.find(g => g.label === 'PEX');
    const wc = groups.find(g => g.type === 'count');
    const area = groups.find(g => g.type === 'area');
    const sleeve = groups.find(g => g.type === 'sleeve');
    expect(groups.some(g => g.type === 'text')).toBe(false);
    expect(pex.n).toBe(2);
    expect(pex.sum).toBeCloseTo(3.5, 9);
    expect(wc.n).toBe(3);
    expect(wc.sum).toBe(3);
    expect(area.noscale).toBe(1);
    expect(area.sum).toBe(0);
    expect(sleeve.n).toBe(1);
    expect(sleeve.label).toBe('4"');
  });
});
