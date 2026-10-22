import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';
const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');
const Grid = require('../../grid.js');
const Sleeves = require('../../sleeves.js');

const MINUS = '\u2212';

describe('format', () => {
  test('the worked example is 4y plus 1250 mm and C minus 380 mm', () => {
    const lines = [
      { axis: 'x', at: 0, label: '4' },
      { axis: 'x', at: 10000, label: '4y' },
      { axis: 'y', at: 0, label: 'B' },
      { axis: 'y', at: 5000, label: 'C' }
    ];
    const nearest = Grid.nearestGrids([11250, 4620], lines);
    expect(nearest.x.label).toBe('4y');
    expect(nearest.x.delta).toBe(1250);
    expect(nearest.y.label).toBe('C');
    expect(nearest.y.delta).toBe(-380);
    const text = Grid.formatGridOffset('4y', 1.25, 'C', -0.38, 'mm');
    expect(text).toBe('4y +1250 mm / C ' + MINUS + '380 mm');
    expect(text).toBe('4y +1250 mm / C −380 mm');
  });

  test('a tie uses the lower grid, and a rounded zero keeps a plus', () => {
    const lines = [
      { axis: 'x', at: 0, label: '1' },
      { axis: 'x', at: 2000, label: '2' },
      { axis: 'y', at: 0, label: 'A' },
      { axis: 'y', at: 2000, label: 'B' }
    ];
    expect(Grid.nearestGrids([1000, 1000], lines).x.label).toBe('1');
    expect(Grid.formatGridOffset('4y', 0.0004, 'C', -0.0004, 'mm')).toBe('4y +0 mm / C +0 mm');
    expect(Grid.formatGridOffset('4y', 1.25, 'C', -0.38, 'imp')).toBe('4y +4\'-1 1/4" / C ' + MINUS + '1\'-3"');
    expect(Grid.formatGridOffset('', 1, 'C', 1, 'mm')).toBe('');
  });
});

describe('from a drawing', () => {
  test('the synthetic plan produces the worked callout for the Nuco sleeve', async () => {
    const cadMod = require('../../cad.js');
    const Parser = require('../../lib/dxf-parser.js');
    cadMod.DxfParser = Parser.default || Parser;
    const bytes = fs.readFileSync(path.join(__dirname, '../sample-grid.dxf'));
    const M = await cadMod.CAD.parse(bytes, 'dxf');
    const cands = Sleeves.findCandidates(M, { hidden: {}, sleeves: [], scale: M.unitM / M.k, units: 'mm', mode: 'auto' });
    const nuco = cands.find(c => c.sleeveType === 'Nuco/MC bucket');
    expect(Grid.callout(M, [nuco.x, nuco.y], {}, M.unitM, 'mm')).toBe('4y +1250 mm / C −380 mm');
    const hilti = cands.find(c => c.sleeveType === 'Hilti');
    expect(Grid.callout(M, [hilti.x, hilti.y], {}, M.unitM, 'mm')).toBe('4 +2500 mm / B +1500 mm');
    const drain = cands.find(c => c.sleeveType === 'drain');
    expect(Grid.callout(M, [drain.x, drain.y], {}, M.unitM, 'mm')).toBe('4 +2500 mm / C −2000 mm');
    expect(Grid.callout(M, [nuco.x, nuco.y], { 'S-GRID': true }, M.unitM, 'mm')).toBe('');
    const packed = cadMod.CAD.revive(cadMod.CAD.pack(M));
    delete packed._gridKey;
    delete packed._gridLines;
    expect(Grid.callout(packed, [nuco.x, nuco.y], {}, packed.unitM, 'mm')).toBe('4y +1250 mm / C −380 mm');
  });

  test('a plan with grid lines but no grid bubbles has no callout', async () => {
    const cadMod = require('../../cad.js');
    const Parser = require('../../lib/dxf-parser.js');
    cadMod.DxfParser = Parser.default || Parser;
    const bytes = fs.readFileSync(path.join(__dirname, '../sample-feet.dxf'));
    const M = await cadMod.CAD.parse(bytes, 'dxf');
    expect(M.unitName).toBe('feet');
    expect(M.unitM).toBeCloseTo(0.3048, 9);
    expect(Grid.gridlinesFromCad(M, {})).toEqual([]);
    expect(Grid.callout(M, [M.w / 2, M.h / 2], {}, M.unitM, 'imp')).toBe('');
  });
});
