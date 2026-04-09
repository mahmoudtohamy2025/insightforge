/**
 * Bass Diffusion Model — Pure math functions for market adoption simulation.
 * 
 * The Bass model predicts the adoption of new products based on two parameters:
 *   p = coefficient of innovation (external influence, e.g. advertising)
 *   q = coefficient of imitation (internal influence, e.g. word-of-mouth)
 * 
 * Standard formula for new adopters at time t:
 *   n(t) = (remaining_market) * (p + q * (cumulative / market_size))
 * 
 * Extracted from supabase/functions/simulate-market/index.ts into a shared,
 * testable module. The edge function version mirrors this exactly.
 */

export interface AdoptionDataPoint {
  month: number;
  cumulative_adopters: number;
  new_adopters: number;
  penetration: number;
}

export interface BassDiffusionParams {
  months: number;
  marketSize: number;
  p: number; // innovation coefficient (typically 0.01–0.05)
  q: number; // imitation coefficient (typically 0.3–0.5)
}

/**
 * Compute the Bass diffusion adoption curve.
 * Returns an array of monthly data points with cumulative and new adopters.
 */
export function bassDiffusion({
  months,
  marketSize,
  p,
  q,
}: BassDiffusionParams): AdoptionDataPoint[] {
  if (months <= 0 || marketSize <= 0) return [];
  if (p < 0 || q < 0) return [];

  const curve: AdoptionDataPoint[] = [];
  let cumulative = 0;

  for (let t = 1; t <= months; t++) {
    const remaining = marketSize - cumulative;
    const newAdopters = remaining * (p + q * (cumulative / marketSize));
    cumulative = Math.min(cumulative + Math.max(newAdopters, 0), marketSize);

    curve.push({
      month: t,
      cumulative_adopters: Math.round(cumulative),
      new_adopters: Math.round(Math.max(newAdopters, 0)),
      penetration: parseFloat((cumulative / marketSize).toFixed(4)),
    });
  }

  return curve;
}

/**
 * Derive Bass p/q parameters from AI evaluation averages.
 * Maps purchase probability and word-of-mouth likelihood to Bass parameters.
 * 
 * p (innovation) = avg purchase probability * 0.03 (scaled for realism)
 * q (imitation)  = avg WOM * 0.4 (network effect strength)
 */
export function deriveBassParams(
  avgPurchaseProbability: number,
  avgWordOfMouth: number,
): { p: number; q: number } {
  const p = Math.max(0.005, Math.min(avgPurchaseProbability * 0.03, 0.08));
  const q = Math.max(0.1, Math.min(avgWordOfMouth * 0.4, 0.6));
  return { p, q };
}

/**
 * Find the peak adoption month (month with highest new adopters).
 */
export function findPeakMonth(curve: AdoptionDataPoint[]): AdoptionDataPoint | null {
  if (curve.length === 0) return null;
  return curve.reduce((best, d) =>
    d.new_adopters > (best?.new_adopters || 0) ? d : best,
    curve[0],
  );
}

/**
 * Find the saturation month (first month where penetration >= threshold).
 */
export function findSaturationMonth(
  curve: AdoptionDataPoint[],
  threshold = 0.9,
): number | null {
  const point = curve.find((d) => d.penetration >= threshold);
  return point?.month ?? null;
}

/**
 * Compute the network effect multiplier (q/p ratio).
 * Higher values indicate stronger word-of-mouth driven adoption.
 */
export function networkMultiplier(p: number, q: number): number {
  if (p <= 0) return 0;
  return q / p;
}
