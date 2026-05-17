type FallbackPersona = {
  name?: string;
  demographics?: Record<string, unknown> | null;
  psychographics?: Record<string, unknown> | null;
  behavioral_data?: Record<string, unknown> | null;
};

type DecisionTrack = "pricing" | "messaging" | "onboarding" | "general";

export type FallbackSimulationResult = {
  response: string;
  sentiment: number;
  confidence: number;
  key_themes: string[];
  purchase_intent: "definitely_yes" | "probably_yes" | "neutral" | "probably_no" | "definitely_no";
  emotional_reaction: "excited" | "interested" | "neutral" | "skeptical" | "concerned" | "opposed";
  generation_mode: "heuristic_fallback";
  provider_status: "missing_gemini_api_key";
  notice: string;
};

function inferDecisionTrack(stimulus: string): DecisionTrack {
  const text = stimulus.toLowerCase();

  if (/(price|pricing|package|plan|upgrade|premium|cheapest|pay|paid|seat|tier)/.test(text)) {
    return "pricing";
  }
  if (/(message|messaging|homepage|positioning|landing|headline|trust|brand|copy)/.test(text)) {
    return "messaging";
  }
  if (/(onboarding|activation|first session|first value|signup|five minutes|flow|drop-?off)/.test(text)) {
    return "onboarding";
  }

  return "general";
}

function buildPersonaLead(persona: FallbackPersona): string {
  const name = persona.name || "this founder persona";
  const location = String(persona.demographics?.location || "").trim();
  const values = String(persona.psychographics?.values || "").trim();

  if (location && values) {
    return `From the perspective of ${name} in ${location}, the strongest reaction is shaped by ${values.toLowerCase()}.`;
  }
  if (location) {
    return `From the perspective of ${name} in ${location}, the reaction is mostly about speed, trust, and practical value.`;
  }

  return `From the perspective of ${name}, the reaction is mostly about speed, trust, and practical value.`;
}

function pricingFallback(persona: FallbackPersona): FallbackSimulationResult {
  return {
    response: `${buildPersonaLead(persona)} I would only choose the higher-priced plan if the upgrade feels tied to a real founder outcome: faster answers, clearer next steps, and proof that I will avoid wasting weeks on the wrong bet. A premium tier becomes believable when it shows stronger decision support, visible confidence rails, and concrete examples of what gets easier or faster. I hesitate when pricing feels like feature gating without a business result, especially if the cheaper plan already sounds "good enough."`,
    sentiment: 0.41,
    confidence: 0.68,
    key_themes: [
      "Outcome-based pricing",
      "Trust through proof and clarity",
      "Fear of overpaying for generic AI",
      "Upgrade only when time-to-value is obvious",
    ],
    purchase_intent: "probably_yes",
    emotional_reaction: "interested",
    generation_mode: "heuristic_fallback",
    provider_status: "missing_gemini_api_key",
    notice: "Sample founder signal generated from platform heuristics because no Gemini API key is configured yet.",
  };
}

function messagingFallback(persona: FallbackPersona): FallbackSimulationResult {
  return {
    response: `${buildPersonaLead(persona)} "Founder Decision OS" is more likely to earn trust quickly because it tells me what the product helps me do, not just what technology it uses. "Hybrid AI-Human Research Platform" sounds capable, but it still feels like a tool category I have to interpret for myself. If you want me to convert faster, lead with the decision outcome, then explain the AI-plus-human method as the reason the signal is trustworthy.`,
    sentiment: 0.52,
    confidence: 0.72,
    key_themes: [
      "Outcome-first positioning",
      "Founder language beats research language",
      "Trust comes from clarity, not jargon",
      "Methodology should support the promise",
    ],
    purchase_intent: "probably_yes",
    emotional_reaction: "interested",
    generation_mode: "heuristic_fallback",
    provider_status: "missing_gemini_api_key",
    notice: "Sample founder signal generated from platform heuristics because no Gemini API key is configured yet.",
  };
}

function onboardingFallback(persona: FallbackPersona): FallbackSimulationResult {
  return {
    response: `${buildPersonaLead(persona)} The fastest path to value is not a long setup wizard. I want one guided decision prompt, one recommended founder template, and one visible result that tells me whether to ship, validate cheaply, or gather more evidence. The wording should reassure me that I do not need a research background to get something useful. If the first run feels abstract or asks me for too much setup, I will assume the product is powerful but slow.`,
    sentiment: 0.48,
    confidence: 0.7,
    key_themes: [
      "Reduce setup to one concrete decision",
      "Show value before methodology",
      "Use plain founder language",
      "Guide the next action immediately",
    ],
    purchase_intent: "probably_yes",
    emotional_reaction: "interested",
    generation_mode: "heuristic_fallback",
    provider_status: "missing_gemini_api_key",
    notice: "Sample founder signal generated from platform heuristics because no Gemini API key is configured yet.",
  };
}

function generalFallback(persona: FallbackPersona): FallbackSimulationResult {
  return {
    response: `${buildPersonaLead(persona)} The idea is directionally promising when it reduces uncertainty quickly and makes the next move feel obvious. The strongest positive reaction usually comes when the product frames itself around a concrete founder decision, names the risk it removes, and gives a believable path from question to action. The weakest part is usually vague positioning or too much setup before the first useful signal appears.`,
    sentiment: 0.34,
    confidence: 0.61,
    key_themes: [
      "Decision clarity",
      "Fast time-to-value",
      "Trust through concrete outcomes",
      "Avoid vague positioning",
    ],
    purchase_intent: "neutral",
    emotional_reaction: "neutral",
    generation_mode: "heuristic_fallback",
    provider_status: "missing_gemini_api_key",
    notice: "Sample founder signal generated from platform heuristics because no Gemini API key is configured yet.",
  };
}

export function buildFallbackSimulation(persona: FallbackPersona, stimulus: string): FallbackSimulationResult {
  switch (inferDecisionTrack(stimulus)) {
    case "pricing":
      return pricingFallback(persona);
    case "messaging":
      return messagingFallback(persona);
    case "onboarding":
      return onboardingFallback(persona);
    default:
      return generalFallback(persona);
  }
}
