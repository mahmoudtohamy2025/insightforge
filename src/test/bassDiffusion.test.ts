import { describe, it, expect } from "vitest";
import {
  bassDiffusion,
  deriveBassParams,
  findPeakMonth,
  findSaturationMonth,
  networkMultiplier,
} from "@/lib/bassDiffusion";

describe("bassDiffusion", () => {
  it("returns empty array when months <= 0", () => {
    expect(bassDiffusion({ months: 0, marketSize: 100000, p: 0.03, q: 0.4 })).toEqual([]);
    expect(bassDiffusion({ months: -5, marketSize: 100000, p: 0.03, q: 0.4 })).toEqual([]);
  });

  it("returns empty array when marketSize <= 0", () => {
    expect(bassDiffusion({ months: 12, marketSize: 0, p: 0.03, q: 0.4 })).toEqual([]);
    expect(bassDiffusion({ months: 12, marketSize: -100, p: 0.03, q: 0.4 })).toEqual([]);
  });

  it("returns empty array when p or q is negative", () => {
    expect(bassDiffusion({ months: 12, marketSize: 100000, p: -0.01, q: 0.4 })).toEqual([]);
    expect(bassDiffusion({ months: 12, marketSize: 100000, p: 0.03, q: -0.1 })).toEqual([]);
  });

  it("produces correct number of data points", () => {
    const result = bassDiffusion({ months: 24, marketSize: 100000, p: 0.03, q: 0.4 });
    expect(result).toHaveLength(24);
    expect(result[0].month).toBe(1);
    expect(result[23].month).toBe(24);
  });

  it("cumulative adopters never exceeds market size", () => {
    const result = bassDiffusion({ months: 120, marketSize: 10000, p: 0.05, q: 0.5 });
    for (const point of result) {
      expect(point.cumulative_adopters).toBeLessThanOrEqual(10000);
    }
  });

  it("new adopters are always >= 0", () => {
    const result = bassDiffusion({ months: 60, marketSize: 100000, p: 0.01, q: 0.3 });
    for (const point of result) {
      expect(point.new_adopters).toBeGreaterThanOrEqual(0);
    }
  });

  it("penetration is always between 0 and 1", () => {
    const result = bassDiffusion({ months: 60, marketSize: 100000, p: 0.03, q: 0.4 });
    for (const point of result) {
      expect(point.penetration).toBeGreaterThanOrEqual(0);
      expect(point.penetration).toBeLessThanOrEqual(1);
    }
  });

  it("cumulative adopters monotonically increases", () => {
    const result = bassDiffusion({ months: 36, marketSize: 100000, p: 0.03, q: 0.4 });
    for (let i = 1; i < result.length; i++) {
      expect(result[i].cumulative_adopters).toBeGreaterThanOrEqual(result[i - 1].cumulative_adopters);
    }
  });

  it("generates S-curve shape: slow start, acceleration, then plateau", () => {
    const result = bassDiffusion({ months: 60, marketSize: 100000, p: 0.02, q: 0.4 });
    // Early months should have few adopters
    expect(result[0].penetration).toBeLessThan(0.05);
    // Later months should approach saturation
    expect(result[59].penetration).toBeGreaterThan(0.7);
  });

  it("higher p means faster initial adoption", () => {
    const slow = bassDiffusion({ months: 12, marketSize: 100000, p: 0.01, q: 0.3 });
    const fast = bassDiffusion({ months: 12, marketSize: 100000, p: 0.05, q: 0.3 });
    expect(fast[2].cumulative_adopters).toBeGreaterThan(slow[2].cumulative_adopters);
  });

  it("higher q means stronger network effects and steeper S-curve", () => {
    const weak = bassDiffusion({ months: 24, marketSize: 100000, p: 0.03, q: 0.1 });
    const strong = bassDiffusion({ months: 24, marketSize: 100000, p: 0.03, q: 0.5 });
    expect(strong[23].cumulative_adopters).toBeGreaterThan(weak[23].cumulative_adopters);
  });

  it("with very high p and q, market saturates quickly", () => {
    const result = bassDiffusion({ months: 24, marketSize: 10000, p: 0.08, q: 0.6 });
    expect(result[23].penetration).toBeGreaterThan(0.95);
  });
});

describe("deriveBassParams", () => {
  it("clamps p between 0.005 and 0.08", () => {
    const { p: pLow } = deriveBassParams(0, 0.5);
    expect(pLow).toBe(0.005);

    const { p: pHigh } = deriveBassParams(5, 0.5);
    expect(pHigh).toBe(0.08);
  });

  it("clamps q between 0.1 and 0.6", () => {
    const { q: qLow } = deriveBassParams(0.5, 0);
    expect(qLow).toBe(0.1);

    const { q: qHigh } = deriveBassParams(0.5, 5);
    expect(qHigh).toBe(0.6);
  });

  it("maps mid-range values correctly", () => {
    const { p, q } = deriveBassParams(0.5, 0.5);
    expect(p).toBeCloseTo(0.015, 3);
    expect(q).toBeCloseTo(0.2, 3);
  });
});

describe("findPeakMonth", () => {
  it("returns null for empty curve", () => {
    expect(findPeakMonth([])).toBeNull();
  });

  it("finds the month with highest new adopters", () => {
    const curve = bassDiffusion({ months: 36, marketSize: 100000, p: 0.03, q: 0.4 });
    const peak = findPeakMonth(curve);
    expect(peak).not.toBeNull();
    expect(peak!.month).toBeGreaterThan(1);
    // Peak should have the max new_adopters
    const maxNew = Math.max(...curve.map((d) => d.new_adopters));
    expect(peak!.new_adopters).toBe(maxNew);
  });
});

describe("findSaturationMonth", () => {
  it("returns null if saturation not reached", () => {
    const curve = bassDiffusion({ months: 6, marketSize: 100000, p: 0.01, q: 0.1 });
    expect(findSaturationMonth(curve, 0.9)).toBeNull();
  });

  it("finds first month at 90% penetration", () => {
    const curve = bassDiffusion({ months: 60, marketSize: 10000, p: 0.05, q: 0.5 });
    const month = findSaturationMonth(curve, 0.9);
    expect(month).not.toBeNull();
    expect(month!).toBeGreaterThan(0);
    // The month before should be below threshold
    if (month! > 1) {
      expect(curve[month! - 2].penetration).toBeLessThan(0.9);
    }
  });
});

describe("networkMultiplier", () => {
  it("returns 0 when p is 0", () => {
    expect(networkMultiplier(0, 0.4)).toBe(0);
  });

  it("correctly computes q/p", () => {
    expect(networkMultiplier(0.02, 0.4)).toBeCloseTo(20, 1);
    expect(networkMultiplier(0.05, 0.5)).toBeCloseTo(10, 1);
  });
});
