import { describe, expect, it } from 'vitest';
import { lineTotalMinor } from './index.js';

describe('lineTotalMinor', () => {
  it('prices whole units exactly', () => {
    // 2,450,000 kurus per ton x 50,000 kg (50 t) = 122,500,000
    expect(lineTotalMinor(2_450_000n, 50_000n, 1000n)).toBe(122_500_000n);
    expect(lineTotalMinor(1_250n, 7n, 1n)).toBe(8_750n);
  });

  it('rounds half up, not to even', () => {
    expect(lineTotalMinor(1n, 500n, 1000n)).toBe(1n); // 0.5 -> 1
    expect(lineTotalMinor(3n, 500n, 1000n)).toBe(2n); // 1.5 -> 2
    expect(lineTotalMinor(5n, 100n, 1000n)).toBe(1n); // 0.5 -> 1
    expect(lineTotalMinor(1n, 499n, 1000n)).toBe(0n);
    expect(lineTotalMinor(1n, 1501n, 1000n)).toBe(2n); // 1.501 -> 2
  });

  it('does not lose precision beyond 2^53', () => {
    expect(lineTotalMinor(9_007_199_254_740_993n, 1000n, 1000n)).toBe(9_007_199_254_740_993n);
  });

  it('rejects invalid inputs', () => {
    expect(() => lineTotalMinor(-1n, 1n, 1n)).toThrow(RangeError);
    expect(() => lineTotalMinor(1n, -1n, 1n)).toThrow(RangeError);
    expect(() => lineTotalMinor(1n, 1n, 0n)).toThrow(RangeError);
  });
});
