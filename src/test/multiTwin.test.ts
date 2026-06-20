import { describe, it, expect } from "vitest";
import {
  twinsForTier,
  samplingModeForTier,
  effectiveTwinCount,
  parseAgeRange,
  variedPersonaSuffix,
  arrayResponseToolSchema,
  parseArrayReactions,
  mean,
  stdev,
  aggregateDistribution,
  mapWithConcurrency,
  MAX_TWINS_PER_RUN,
} from "../../supabase/functions/_shared/multiTwin.ts";

describe("twinsForTier", () => {
  it("maps the locked tier table 2/5/8/10", () => {
    expect(twinsForTier("free")).toBe(2);
    expect(twinsForTier("starter")).toBe(5);
    expect(twinsForTier("professional")).toBe(8);
    expect(twinsForTier("enterprise")).toBe(10);
  });
  it("falls back to free for unknown tiers", () => {
    expect(twinsForTier("nonsense")).toBe(2);
    expect(twinsForTier("")).toBe(2);
  });
});

describe("samplingModeForTier", () => {
  it("free uses the cheap single-call array, paid uses varied", () => {
    expect(samplingModeForTier("free")).toBe("array");
    expect(samplingModeForTier("starter")).toBe("varied");
    expect(samplingModeForTier("professional")).toBe("varied");
    expect(samplingModeForTier("enterprise")).toBe("varied");
  });
});

describe("effectiveTwinCount", () => {
  it("returns the tier N when within the per-run cap", () => {
    expect(effectiveTwinCount("starter", 3)).toBe(5);
    expect(effectiveTwinCount("free", 2)).toBe(2);
  });
  it("clamps so total twins never exceed MAX_TWINS_PER_RUN", () => {
    // enterprise wants 10; 5 segments × 10 = 50 > 40 → clamp to floor(40/5)=8
    expect(effectiveTwinCount("enterprise", 5)).toBe(8);
    expect(effectiveTwinCount("enterprise", 5) * 5).toBeLessThanOrEqual(MAX_TWINS_PER_RUN);
  });
  it("never returns less than 1", () => {
    expect(effectiveTwinCount("enterprise", 100)).toBe(1);
  });
});

describe("parseAgeRange", () => {
  it("parses ranges with various dashes", () => {
    expect(parseAgeRange("25-35")).toEqual([25, 35]);
    expect(parseAgeRange("25 – 35")).toEqual([25, 35]);
    expect(parseAgeRange("41—55")).toEqual([41, 55]);
  });
  it("handles a single number", () => {
    expect(parseAgeRange("30")).toEqual([30, 30]);
  });
  it("defaults on garbage/empty", () => {
    expect(parseAgeRange("")).toEqual([25, 45]);
    expect(parseAgeRange(undefined)).toEqual([25, 45]);
    expect(parseAgeRange("old")).toEqual([25, 45]);
  });
  it("ignores an inverted range and falls back to the single-number path", () => {
    // "35-25" fails the lo<=hi guard, then the single-number regex grabs 35.
    expect(parseAgeRange("35-25")).toEqual([35, 35]);
  });
});

describe("variedPersonaSuffix", () => {
  it("spreads ages across the range deterministically", () => {
    const first = variedPersonaSuffix(0, 3, "20-40");
    const last = variedPersonaSuffix(2, 3, "20-40");
    expect(first).toContain("age is 20");
    expect(last).toContain("age is 40");
  });
  it("is deterministic — same inputs, same output", () => {
    expect(variedPersonaSuffix(1, 5, "25-35")).toBe(variedPersonaSuffix(1, 5, "25-35"));
  });
  it("labels the individual as k of N and never the segment average", () => {
    const s = variedPersonaSuffix(2, 4, "30-50");
    expect(s).toContain("person 3 of 4");
    expect(s.toLowerCase()).toContain("not as the segment");
  });
  it("uses the range midpoint when N=1", () => {
    expect(variedPersonaSuffix(0, 1, "20-40")).toContain("age is 30");
  });
});

describe("arrayResponseToolSchema", () => {
  it("requires exactly N items", () => {
    const schema = arrayResponseToolSchema(4) as any;
    const arr = schema.function.parameters.properties.responses;
    expect(arr.minItems).toBe(4);
    expect(arr.maxItems).toBe(4);
    expect(arr.items.required).toContain("sentiment");
    expect(arr.items.required).toContain("purchase_intent");
  });
});

describe("parseArrayReactions", () => {
  it("extracts and normalizes a well-formed array", () => {
    const out = parseArrayReactions(
      { responses: [
        { response: "love it", sentiment: 0.8, confidence: 0.9, key_themes: ["price"], purchase_intent: "probably_yes", emotional_reaction: "excited" },
        { response: "meh", sentiment: -0.3, confidence: 0.6, key_themes: ["trust"], purchase_intent: "probably_no", emotional_reaction: "skeptical" },
      ] },
      2,
    );
    expect(out).toHaveLength(2);
    expect(out[0].sentiment).toBe(0.8);
    expect(out[1].purchase_intent).toBe("probably_no");
  });
  it("clamps out-of-range numbers and fills missing fields", () => {
    const out = parseArrayReactions({ responses: [{ sentiment: 5, confidence: -2 }] }, 1);
    expect(out[0].sentiment).toBe(1);
    expect(out[0].confidence).toBe(0);
    expect(out[0].response).toBe("");
    expect(out[0].purchase_intent).toBe("neutral");
    expect(out[0].key_themes).toEqual([]);
  });
  it("truncates if the model returns more than N", () => {
    const many = { responses: Array.from({ length: 5 }, () => ({ response: "x", sentiment: 0, confidence: 0.5 })) };
    expect(parseArrayReactions(many, 2)).toHaveLength(2);
  });
  it("returns fewer than N without padding when the model under-delivers (honest n)", () => {
    const few = { responses: [{ response: "only one", sentiment: 0.2, confidence: 0.6 }] };
    expect(parseArrayReactions(few, 3)).toHaveLength(1);
  });
  it("tolerates a bare object or a bare array", () => {
    expect(parseArrayReactions({ response: "solo", sentiment: 0.1, confidence: 0.5 }, 3)).toHaveLength(1);
    expect(parseArrayReactions([{ response: "a", sentiment: 0, confidence: 0.5 }], 3)).toHaveLength(1);
  });
});

describe("mean / stdev", () => {
  it("computes mean", () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(mean([])).toBe(0);
  });
  it("computes population stdev, 0 for <2 points", () => {
    expect(stdev([5])).toBe(0);
    expect(stdev([2, 2, 2])).toBe(0);
    expect(stdev([0, 2])).toBe(1); // mean 1, deviations ±1
  });
});

describe("aggregateDistribution", () => {
  const responses = [
    { segment_id: "s1", segment_name: "A", sentiment: 0.8, confidence: 0.9, purchase_intent: "probably_yes", key_themes: ["price", "trust"] },
    { segment_id: "s1", segment_name: "A", sentiment: 0.4, confidence: 0.7, purchase_intent: "neutral", key_themes: ["price"] },
    { segment_id: "s2", segment_name: "B", sentiment: -0.6, confidence: 0.8, purchase_intent: "definitely_no", key_themes: ["trust"] },
  ];

  it("keeps the legacy keys the frontend reads", () => {
    const agg = aggregateDistribution(responses, 2);
    expect(agg).toHaveProperty("avg_sentiment");
    expect(agg).toHaveProperty("avg_confidence");
    expect(agg).toHaveProperty("consensus_score");
    expect(agg).toHaveProperty("top_themes");
    expect(agg.participant_count).toBe(2);
  });

  it("adds the new distribution fields", () => {
    const agg = aggregateDistribution(responses, 2);
    expect(agg.sample_size).toBe(3);
    expect(agg.sentiment_stdev).toBeGreaterThan(0);
    expect(agg.per_segment).toHaveLength(2);
    const s1 = agg.per_segment.find((p) => p.segment_id === "s1")!;
    expect(s1.sample_size).toBe(2);
    expect(s1.avg_sentiment).toBeCloseTo(0.6, 5);
  });

  it("computes a real objection rate (negative intent OR sentiment < -0.2)", () => {
    const agg = aggregateDistribution(responses, 2);
    // only s2's definitely_no / -0.6 qualifies → 1 of 3
    expect(agg.objection_rate).toBeCloseTo(1 / 3, 5);
  });

  it("counts an objector on negative INTENT even with neutral sentiment", () => {
    const agg = aggregateDistribution(
      [{ segment_id: "s1", sentiment: 0.05, confidence: 0.5, purchase_intent: "probably_no", key_themes: [] }],
      1,
    );
    expect(agg.objection_rate).toBe(1);
  });

  it("counts an objector on negative SENTIMENT even with neutral intent", () => {
    const agg = aggregateDistribution(
      [{ segment_id: "s1", sentiment: -0.5, confidence: 0.5, purchase_intent: "neutral", key_themes: [] }],
      1,
    );
    expect(agg.objection_rate).toBe(1);
  });

  it("consensus reflects cross-SEGMENT agreement, not within-segment twin spread", () => {
    // Two segments, each with wide internal spread but the SAME mean (~0).
    // Basing consensus on per-segment means reports HIGH agreement (the old
    // all-responses stdev would have wrongly reported low).
    const wideButAligned = [
      { segment_id: "s1", sentiment: 0.9, confidence: 0.7, purchase_intent: "probably_yes", key_themes: [] },
      { segment_id: "s1", sentiment: -0.9, confidence: 0.7, purchase_intent: "probably_no", key_themes: [] },
      { segment_id: "s2", sentiment: 0.9, confidence: 0.7, purchase_intent: "probably_yes", key_themes: [] },
      { segment_id: "s2", sentiment: -0.9, confidence: 0.7, purchase_intent: "probably_no", key_themes: [] },
    ];
    const agg = aggregateDistribution(wideButAligned, 2);
    expect(agg.consensus_score).toBeGreaterThan(0.95); // segment means both ~0 → agree
    expect(agg.sentiment_stdev).toBeGreaterThan(0.5);  // but the raw sample is wide
  });

  it("consensus drops when segment MEANS diverge", () => {
    const divergent = [
      { segment_id: "s1", sentiment: 0.8, confidence: 0.7, purchase_intent: "probably_yes", key_themes: [] },
      { segment_id: "s2", sentiment: -0.8, confidence: 0.7, purchase_intent: "probably_no", key_themes: [] },
    ];
    const agg = aggregateDistribution(divergent, 2);
    expect(agg.consensus_score).toBeLessThan(0.3);
  });

  it("counts themes case-insensitively", () => {
    const agg = aggregateDistribution(responses, 2);
    const price = agg.top_themes.find((t) => t.theme === "price")!;
    expect(price.count).toBe(2);
  });

  it("handles the empty case without dividing by zero", () => {
    const agg = aggregateDistribution([], 0);
    expect(agg.avg_sentiment).toBe(0);
    expect(agg.objection_rate).toBe(0);
    expect(agg.sample_size).toBe(0);
  });
});

describe("mapWithConcurrency", () => {
  it("preserves order and processes every item", async () => {
    const out = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => n * 10);
    expect(out).toEqual([10, 20, 30, 40, 50]);
  });

  it("never exceeds the concurrency limit", async () => {
    let active = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 12 }, (_, i) => i), 3, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return n;
    });
    expect(peak).toBeLessThanOrEqual(3);
  });

  it("handles an empty list", async () => {
    expect(await mapWithConcurrency([], 4, async (x) => x)).toEqual([]);
  });
});
