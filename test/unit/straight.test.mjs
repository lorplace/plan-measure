import { createRequire } from 'node:module';
import { describe, expect, test } from 'vitest';
const require = createRequire(import.meta.url);
const Straight = require('../../straight.js');

const deg = d => d * Math.PI / 180;
function lock(p, prev, align, tol) {
  return Straight.straighten(p, prev, tol == null ? 8 : tol, Straight.DIRS, align || []);
}

describe('straight lock', () => {
  test('level, plumb and 45 degrees, including the opposite direction', () => {
    const level = lock([403, 213.5], [300, 210]);
    expect(level.straight).toBe(true);
    expect(level.q[1]).toBeCloseTo(210, 9);
    expect(level.q[0]).toBeCloseTo(403, 9);

    const back = lock([200, 212], [300, 210]);
    expect(back.q[1]).toBeCloseTo(210, 9);
    expect(back.q[0]).toBeCloseTo(200, 9);

    const plumb = lock([304, 300], [300, 210]);
    expect(plumb.straight).toBe(true);
    expect(plumb.q[0]).toBeCloseTo(300, 9);
    expect(plumb.q[1]).toBeCloseTo(300, 9);

    const diag = lock([352, 258], [300, 210]);
    expect(diag.straight).toBe(true);
    expect(diag.q[0] - 300).toBeCloseTo(diag.q[1] - 210, 9);
    expect(diag.q).toEqual([350, 260]);

    const other = lock([-10, 9], [0, 0]);
    expect(other.straight).toBe(true);
    expect(other.q[0]).toBeCloseTo(-other.q[1], 9);
  });

  test('a 5 degree miss is outside the lock, and a shallower one is inside', () => {
    const inside = Math.tan(deg(4.9)) * 100;
    const hit = lock([100, inside], [0, 0]);
    expect(hit && hit.straight).toBe(true);
    expect(hit.q[1]).toBeCloseTo(0, 9);

    const outside = Math.tan(deg(5.1)) * 100;
    expect(lock([100, outside], [0, 0])).toBeNull();

    // The lock uses a strict less-than against 5 degrees. Float error makes tan(5°) land just inside, so the outside case is a hair past the tolerance.
    const over = Math.tan(Straight.ST_TOL + 1e-4) * 100;
    expect(lock([100, over], [0, 0])).toBeNull();

    expect(lock([380, 260], [300, 210])).toBeNull();
    expect(lock([300, 210], [300, 210])).toBeNull();
  });

  test('lines up with an existing point when the angle is not straight', () => {
    const aligned = lock([521.5, 300], [420, 330], [[520, 600]]);
    expect(aligned.straight).toBe(false);
    expect(aligned.q[0]).toBeCloseTo(520, 9);
    expect(aligned.q[1]).toBeCloseTo(300, 9);
    expect(aligned.ax[0]).toBe(520);

    const with45 = lock([10.2, 9.5], [0, 0], [[10, 0]]);
    expect(with45.straight).toBe(true);
    expect(with45.q[0]).toBeCloseTo(10, 9);
    expect(with45.q[1]).toBeCloseTo(10, 9);
  });

  test('shift ortho keeps the longer component', () => {
    expect(Straight.snapOrtho([0, 0], [5, 1])).toEqual([5, 0]);
    expect(Straight.snapOrtho([0, 0], [1, 4])).toEqual([0, 4]);
    expect(Straight.snapOrtho(null, [1, 2])).toEqual([1, 2]);
  });
});
