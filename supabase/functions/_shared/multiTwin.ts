// Multi-twin sampling — N distinct twins per segment instead of one.
// (PRD #17 / docs/MULTI_TWIN_SCOPING.md.)
//
// PURE module — no Deno or browser APIs — so src/test/multiTwin.test.ts can
// import it directly and the edge functions can import it with a .ts extension.
// Everything here is data-in / data-out; the actual Gemini calls and DB writes
// stay in the edge functions.
//
// Decisions locked 2026-06-12 (Mahmoud):
//   - N per tier: free 2 / starter 5 / professional 8 / enterprise 10
//   - Sampling: free → single-call array (cheap); paid → varied sub-personas
//   - Scope: simulate-focus-group + simulate-ab-test

export type SamplingMode = "varied" | "array";

const TWINS_PER_TIER: Record<string, number> = {
  free: 2,
  starter: 5,
  professional: 8,
  enterprise: 10,
};

// Bounds ONE sampling pass (all segments in a round): segments × twins ≤ 40.
// A multi-round run issues up to 40 × rounds calls total; in-flight calls are
// separately capped at MAX_CONCURRENCY so Gemini's RPM isn't blown regardless.
export const MAX_TWINS_PER_RUN = 40;
export const MAX_CONCURRENCY = 8;

export function twinsForTier(tier: string): number {
  return TWINS_PER_TIER[tier] ?? TWINS_PER_TIER.free;
}

// Free uses the cheap single-call array (1 call returns N); paid uses varied
// sub-personas (N independent calls → genuinely independent draws).
export function samplingModeForTier(tier: string): SamplingMode {
  return tier === "free" ? "array" : "varied";
}

// Clamp the tier's desired N so total twins across all segments ≤ MAX_TWINS_PER_RUN.
export function effectiveTwinCount(tier: string, segmentCount: number): number {
  const desired = twinsForTier(tier);
  if (segmentCount <= 0) return desired;
  const capPerSegment = Math.floor(MAX_TWINS_PER_RUN / segmentCount);
  return Math.max(1, Math.min(desired, capPerSegment));
}

// "25-35" / "25 – 35" → [25, 35]; missing/garbage → a sane default.
export function parseAgeRange(range?: string): [number, number] {
  const m = (range || "").match(/(\d+)\s*[-–—]\s*(\d+)/);
  if (m) {
    const lo = parseInt(m[1], 10);
    const hi = parseInt(m[2], 10);
    if (hi >= lo) return [lo, hi];
  }
  const single = (range || "").match(/(\d+)/);
  if (single) {
    const v = parseInt(single[1], 10);
    return [v, v];
  }
  return [25, 45];
}

const TWIN_LEANINGS = [
  "more price-sensitive than most in your segment",
  "an early adopter who likes trying new things",
  "skeptical of new products until proven",
  "highly brand-loyal once you trust a brand",
  "driven mainly by convenience",
  "focused on value-for-money above all",
  "risk-averse and cautious with money",
  "trend-conscious and influenced by peers",
  "practical and no-nonsense",
  "quality-obsessed and willing to pay for it",
];

// Deterministic perturbation that turns a base segment persona into the k-th of
// N distinct individuals: a specific age spread across the range + a leaning.
// Deterministic (no RNG) so runs are reproducible and tests are stable.
export function variedPersonaSuffix(twinIndex: number, n: number, ageRange?: string): string {
  const [lo, hi] = parseAgeRange(ageRange);
  const age = n > 1 ? Math.round(lo + ((hi - lo) * twinIndex) / (n - 1)) : Math.round((lo + hi) / 2);
  const lean = TWIN_LEANINGS[twinIndex % TWIN_LEANINGS.length];
  return `

INDIVIDUAL VARIATION — You are person ${twinIndex + 1} of ${n} sampled from this segment. Your specific age is ${age}. Compared to others in your segment you are ${lean}. Answer as this one specific individual, not as the segment's average.`;
}

// JSON-schema tool for the free-tier single-call path: one Gemini call returns
// an array of N independent persona reactions from the segment.
export function arrayResponseToolSchema(n: number) {
  return {
    type: "function",
    function: {
      name: "structured_responses",
      description: `Return ${n} DISTINCT individual reactions sampled from this one consumer segment — vary age, attitude, and emphasis so they read as ${n} different real people, not ${n} copies.`,
      parameters: {
        type: "object",
        properties: {
          responses: {
            type: "array",
            minItems: n,
            maxItems: n,
            items: {
              type: "object",
              properties: {
                response: { type: "string", description: "This individual's natural-language reaction (2-4 sentences)" },
                sentiment: { type: "number", description: "Sentiment from -1.0 to 1.0" },
                confidence: { type: "number", description: "Confidence from 0.0 to 1.0" },
                key_themes: { type: "array", items: { type: "string" }, description: "2-4 key themes" },
                purchase_intent: { type: "string", enum: ["definitely_yes", "probably_yes", "neutral", "probably_no", "definitely_no"] },
                emotional_reaction: { type: "string", enum: ["excited", "interested", "neutral", "skeptical", "concerned", "opposed"] },
              },
              required: ["response", "sentiment", "confidence", "key_themes", "purchase_intent", "emotional_reaction"],
            },
          },
        },
        required: ["responses"],
      },
    },
  };
}

export interface TwinReaction {
  response: string;
  sentiment: number;
  confidence: number;
  key_themes: string[];
  purchase_intent: string;
  emotional_reaction: string;
}

// Pure parser: takes the already-JSON-parsed tool-call arguments for the array
// path and returns a normalized list of reactions. Truncates to n; does NOT pad
// — we never fabricate consumers, so an under-count is reported honestly as a
// smaller sample rather than cloned up to n. Tolerates a bare object/array.
export function parseArrayReactions(parsedArgs: any, n: number): TwinReaction[] {
  const raw = Array.isArray(parsedArgs?.responses)
    ? parsedArgs.responses
    : Array.isArray(parsedArgs)
      ? parsedArgs
      : [parsedArgs];
  const out: TwinReaction[] = [];
  for (const r of raw.slice(0, n)) {
    if (!r || typeof r !== "object") continue;
    out.push({
      response: typeof r.response === "string" ? r.response : "",
      sentiment: clampNum(r.sentiment, -1, 1, 0),
      confidence: clampNum(r.confidence, 0, 1, 0.5),
      key_themes: Array.isArray(r.key_themes) ? r.key_themes.filter((t: any) => typeof t === "string") : [],
      purchase_intent: typeof r.purchase_intent === "string" ? r.purchase_intent : "neutral",
      emotional_reaction: typeof r.emotional_reaction === "string" ? r.emotional_reaction : "neutral",
    });
  }
  return out;
}

function clampNum(v: any, lo: number, hi: number, fallback: number): number {
  const n = typeof v === "number" && isFinite(v) ? v : fallback;
  return Math.min(hi, Math.max(lo, n));
}

export function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
}

const NEGATIVE_INTENTS = new Set(["probably_no", "definitely_no"]);

export interface AggregateInput {
  segment_id: string;
  segment_name?: string;
  sentiment: number;
  confidence: number;
  purchase_intent?: string;
  key_themes?: string[];
}

// Distribution-aware aggregate. Keeps every key the frontend already reads
// (avg_sentiment, avg_confidence, consensus_score, top_themes, participant_count)
// and ADDS sample_size, sentiment_stdev, per-segment mean±stdev, and a real
// objection rate — the error-bar reporting that makes the result decision-grade.
export function aggregateDistribution(responses: AggregateInput[], segmentCount: number) {
  const sentiments = responses.map((r) => r.sentiment || 0);
  const confidences = responses.map((r) => r.confidence || 0);
  const avgSentiment = mean(sentiments);
  const sentimentStdev = stdev(sentiments); // within-sample spread across all N twins

  const bySegment: Record<string, { name: string; sentiments: number[] }> = {};
  for (const r of responses) {
    const k = r.segment_id;
    if (!bySegment[k]) bySegment[k] = { name: r.segment_name || "", sentiments: [] };
    bySegment[k].sentiments.push(r.sentiment || 0);
  }
  const perSegment = Object.entries(bySegment).map(([segment_id, v]) => ({
    segment_id,
    segment_name: v.name,
    avg_sentiment: mean(v.sentiments),
    sentiment_stdev: stdev(v.sentiments),
    sample_size: v.sentiments.length,
  }));

  // Consensus = agreement ACROSS segments (its original meaning). Computed from
  // per-segment MEANS so that within-segment twin spread — the whole point of
  // multi-twin — doesn't artificially deflate it. Single-segment → overall spread.
  const segMeans = perSegment.map((p) => p.avg_sentiment);
  const consensusScore = segMeans.length > 1
    ? Math.max(0, 1 - stdev(segMeans))
    : Math.max(0, 1 - sentimentStdev);

  const themeCounts: Record<string, number> = {};
  for (const r of responses) {
    for (const t of r.key_themes || []) {
      const n = String(t).toLowerCase().trim();
      if (n) themeCounts[n] = (themeCounts[n] || 0) + 1;
    }
  }
  const topThemes = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([theme, count]) => ({ theme, count }));

  // Objector = won't-buy intent OR clearly negative sentiment. The OR is
  // intentional: either signal alone counts as "this person raised an objection".
  const objectors = responses.filter(
    (r) => NEGATIVE_INTENTS.has(r.purchase_intent || "") || (r.sentiment || 0) < -0.2,
  ).length;

  return {
    avg_sentiment: avgSentiment,
    avg_confidence: mean(confidences),
    consensus_score: consensusScore,
    sentiment_stdev: sentimentStdev,
    sample_size: responses.length,
    objection_rate: responses.length ? objectors / responses.length : 0,
    per_segment: perSegment,
    top_themes: topThemes,
    participant_count: segmentCount,
  };
}

// Tiny concurrency-bounded map for the edge runtime (kept here so it's covered
// by the same module, though it's exercised via the functions, not unit tests).
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = new Array(Math.min(Math.max(1, limit), items.length || 1)).fill(0).map(async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) break;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
