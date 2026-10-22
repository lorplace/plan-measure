import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';
const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');
const Sleeves = require('../../sleeves.js');

function cad() {
  const cadMod = require('../../cad.js');
  const Parser = require('../../lib/dxf-parser.js');
  cadMod.DxfParser = Parser.default || Parser;
  return cadMod.CAD;
}

function load(name) {
  const bytes = fs.readFileSync(path.join(__dirname, '..', name));
  return cad().parse(bytes, 'dxf');
}

function worldKey(M, c) {
  const w = M.toWorld(c.x, c.y);
  return [Math.round(w[0] * 1e6) / 1e6, Math.round(w[1] * 1e6) / 1e6];
}

describe('size text and type', () => {
  test('reads size from drawing text and classifies Nuco, Hilti and drain', () => {
    expect(Sleeves.parseSize('4"', 'mm')).toBe('4"');
    expect(Sleeves.parseSize('sleeve 1-1/2"', 'mm')).toBe('1-1/2"');
    expect(Sleeves.parseSize('DN100 next to core', 'mm')).toBe('DN100');
    expect(Sleeves.parseSize('100mm', 'mm')).toBe('100mm');
    expect(Sleeves.parseSize('Ø110', 'mm')).toBe('110mm');
    expect(Sleeves.parseSize('Ø4', 'imp')).toBe('4"');
    expect(Sleeves.sizeFromName('SLV_Round_FLR_4', 'mm')).toBe('4"');
    expect(Sleeves.sizeFromName('PEN-100mm', 'mm')).toBe('100mm');

    expect(Sleeves.classifySleeve({ notes: ['NUCO MC BUCKET', '4"'], layer: 'P-SLEEVE' })).toBe('Nuco/MC bucket');
    expect(Sleeves.classifySleeve({ notes: ['MC-BUCKET'], layer: 'P-SLEEVE' })).toBe('Nuco/MC bucket');
    expect(Sleeves.classifySleeve({ name: 'MfrX_SLV_Round_FLR_Hilti - SLV_Round_FLR_4', layer: 'P-PIPE' })).toBe('Hilti');
    expect(Sleeves.classifySleeve({ notes: ['HILTI CFS-CID', '6"'] })).toBe('Hilti');
    expect(Sleeves.classifySleeve({ name: 'CP 680', layer: 'P-SLEEVE' })).toBe('Hilti');
    expect(Sleeves.classifySleeve({ notes: ['FLOOR DRAIN', '3"'], layer: 'P-SLEEVE' })).toBe('drain');
    expect(Sleeves.classifySleeve({ name: 'SLV_Round_FLR_Drain - SLV_Round_FLR_3' })).toBe('drain');
    expect(Sleeves.classifySleeve({ name: 'HILTI FLOOR DRAIN' })).toBe('drain');
    expect(Sleeves.classifySleeve({ notes: ['4"'], layer: 'P-SLEEVE' })).toBe('');
  });

  test('keywords match sleeve blocks and skip ordinary symbols', () => {
    expect(Sleeves.slvMatch('P-SLEEVE')).toBe(true);
    expect(Sleeves.slvMatch('CORE-6')).toBe(true);
    expect(Sleeves.slvMatch('PEN2')).toBe(true);
    expect(Sleeves.slvMatch('MANCHON')).toBe(true);
    expect(Sleeves.slvMatch('FOURREAU')).toBe(true);
    expect(Sleeves.slvMatch('WC')).toBe(false);
    expect(Sleeves.slvMatch('FIX-X')).toBe(false);
    expect(Sleeves.slvMatch('DRAIN')).toBe(false);
    expect(Sleeves.slvMatch('COLUMNS')).toBe(false);
  });
});

describe('synthetic CAD', () => {
  test('sample sleeve drawing: 12 symbols, sizes from attributes, names and nearby text', async () => {
    const M = await load('sample-sleeves.dxf');
    const exp = {
      '5,5': '4"', '10,5': '6"', '15,5': '100mm', '20,5': '4"',
      '5,15': '2"', '10,15': '3"', '15,15': 'DN100', '20,15': '8"',
      '29,21': '6"', '29,23': '6"', '32,32': '12"', '36,32': '12"'
    };
    const cands = Sleeves.findCandidates(M, { hidden: {}, sleeves: [], scale: M.unitM / M.k, units: 'imp', mode: 'auto' });
    expect(cands).toHaveLength(12);
    const got = {};
    for (const c of cands) {
      const [x, y] = worldKey(M, c);
      got[Math.round(x) + ',' + Math.round(y)] = c;
    }
    for (const [k, size] of Object.entries(exp)) {
      expect(got[k], k).toBeTruthy();
      expect(got[k].size).toBe(size);
    }
    const text = cands.find(c => c.src === 'nearby text' && c.size === 'DN100');
    expect(text).toBeTruthy();
    expect(text.notes.join(' ')).toMatch(/DN100/);
    const picked = Sleeves.findCandidates(M, { hidden: {}, sleeves: [], scale: M.unitM / M.k, units: 'imp', mode: 'pick', pick: { kind: 'insert', name: 'FIX-X' } });
    expect(picked).toHaveLength(3);
    expect(picked.every(c => c.name === 'FIX-X')).toBe(true);
  });

  test('Revit-style export: Hilti and drain from the block name, view suffix ignored', async () => {
    const M = await load('sample-revit.dxf');
    const cands = Sleeves.findCandidates(M, { hidden: {}, sleeves: [], scale: M.unitM / M.k, units: 'mm', mode: 'auto' });
    expect(cands).toHaveLength(5);
    const hilti = cands.filter(c => c.sleeveType === 'Hilti');
    const drain = cands.filter(c => c.sleeveType === 'drain');
    expect(hilti).toHaveLength(3);
    expect(drain).toHaveLength(2);
    expect(hilti.every(c => c.size === '4"' && c.src === 'block name')).toBe(true);
    expect(drain.every(c => c.size === '3"' && c.src === 'block name')).toBe(true);
    expect(cands.some(c => /SLEEVING/.test(c.name))).toBe(false);
  });

  test('grid sample: type from the note beside the symbol, duplicates left unchecked', async () => {
    const M = await load('sample-grid.dxf');
    const ctx = { hidden: {}, sleeves: [], scale: M.unitM / M.k, units: 'mm', mode: 'auto' };
    const cands = Sleeves.findCandidates(M, ctx);
    expect(cands).toHaveLength(3);
    const byType = Object.fromEntries(cands.map(c => [c.sleeveType, c]));
    expect(byType['Nuco/MC bucket'].size).toBe('4"');
    expect(byType['Nuco/MC bucket'].src).toBe('nearby text');
    expect(byType['Hilti'].size).toBe('6"');
    expect(byType['Hilti'].src).toBe('nearby text');
    expect(byType['drain'].size).toBe('3"');
    expect(byType['drain'].src).toBe('nearby text');
    const again = Sleeves.findCandidates(M, Object.assign({}, ctx, { sleeves: [{ pts: [[byType['Hilti'].x, byType['Hilti'].y]] }] }));
    expect(again.find(c => c.sleeveType === 'Hilti').dup).toBe(true);
    expect(again.find(c => c.sleeveType === 'Hilti').on).toBe(false);
    expect(Sleeves.findCandidates(M, Object.assign({}, ctx, { hidden: { 'P-SLEEVE': true } }))).toHaveLength(0);
  });
});
