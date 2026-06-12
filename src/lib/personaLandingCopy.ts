// Copy for the three persona landing "doors" (/for-founders, /for-product-teams,
// /for-brands). Three doors into ONE engine — these pages may differ in words
// only; if a door needs schema or edge-function changes it is trying to become
// a second product (see docs/AUDIENCE_MAP.md decision rules).
//
// Honesty bar (enforced by src/test/personaLanding.test.ts): no certification
// badges, no "statistical", no "50 customers", no killed features, no
// benchmark/percentile promises. Simulated consumers are directional signal —
// every door says so explicitly.

export type DoorKey = "founders" | "product-teams" | "brands";

export interface PersonaLandingCopy {
  badge: string;
  headline: string;
  subheadline: string;
  pains: string[];
  steps: { title: string; desc: string }[];
  features: { title: string; desc: string }[];
  honestNote: string;
  cta: string;
}

export const DOOR_STORAGE_KEY = "insightforge-door";

export const PERSONA_LANDING: Record<DoorKey, PersonaLandingCopy> = {
  founders: {
    badge: "For solo founders",
    headline: "Test the idea before you build it",
    subheadline:
      "Describe what you want to test in one sentence. Get a simulated focus group, the dominant objection, and your three next tests — in minutes, free.",
    pains: [
      "Real research costs ~$5k and two weeks per question",
      "Guessing costs a month of building the wrong thing",
      "Generic advice isn't your customer talking",
    ],
    steps: [
      {
        title: "Type your idea",
        desc: "One sentence. We pick the right consumer segments, write the discussion stimulus, and set the group up for you.",
      },
      {
        title: "Watch the focus group",
        desc: "2–5 AI consumer twins react over multiple rounds — sentiment, confidence, and purchase intent for each.",
      },
      {
        title: "Get your next move",
        desc: "The dominant objection, the angles you've already covered, and three concrete follow-up tests — one click to run.",
      },
    ],
    features: [
      {
        title: "Runnable at signup",
        desc: "Three starter segments are created for you — your first focus group is one sentence away.",
      },
      {
        title: "Adoption forecast included",
        desc: "Every focus group ends with a market projection — and shows you exactly how it was derived.",
      },
      {
        title: "A/B your framing",
        desc: "Two pitches head-to-head: which one wins per segment, with sentiment and themes for each.",
      },
      {
        title: "Real humans when it matters",
        desc: "Built-in surveys, interviews, and transcription for the decisions worth validating with real customers.",
      },
    ],
    honestNote:
      "These are simulated consumers — fast directional signal, not certainty. For bets that matter, validate with the built-in real-human research tools.",
    cta: "Start free — about 3 simulations a month included",
  },

  "product-teams": {
    badge: "For product teams",
    headline: "Evidence for the roadmap, before engineering commits",
    subheadline:
      "Pressure-test feature concepts against simulated user segments, then hand stakeholders an artifact they'll actually read.",
    pains: [
      "Roadmap debates run on opinions because research takes weeks",
      "Stakeholders want evidence, not vibes",
      "Research requests pile up with no owner and no status",
    ],
    steps: [
      {
        title: "Frame the concept",
        desc: "Drop in a feature concept — or two competing options.",
      },
      {
        title: "Run it past your segments",
        desc: "Focus groups and A/B comparisons per user segment — sentiment, themes, and the objections you'd otherwise hear in month three.",
      },
      {
        title: "Circulate the evidence",
        desc: "PDF export, a searchable insights repository, and patterns that build up across studies.",
      },
    ],
    features: [
      {
        title: "Research request intake",
        desc: "A front door for stakeholder asks — categories, priorities, votes, statuses, and owners.",
      },
      {
        title: "AI-drafted research plans",
        desc: "Objective, methodology, discussion guide, and screener criteria generated per project.",
      },
      {
        title: "An insights repository",
        desc: "Cross-study patterns with evidence quotes, exportable as CSV or Markdown.",
      },
      {
        title: "Built for the squad",
        desc: "Seats, roles, and a shared workspace — ten seats on the Starter plan.",
      },
    ],
    honestNote:
      "Simulated segments give you fast qualitative signal per persona — not statistics. Pair the big bets with the built-in interview and survey tools.",
    cta: "Start free — bring the team when it sticks",
  },

  brands: {
    badge: "For brand & marketing teams",
    headline: "Pre-test the message before the media spend",
    subheadline:
      "Run ad copy, claims, and taglines past simulated consumer segments — including MENA-aware personas — before a single dirham of media goes out.",
    pains: [
      "Agency pre-tests take weeks and five figures",
      "Untested copy is a silent budget leak",
      "MENA consumers aren't a Western persona with a different name",
    ],
    steps: [
      {
        title: "Define the consumer",
        desc: "Demographics, values, lifestyle, and cultural context per segment — Ramadan-mode seasonal behavior included.",
      },
      {
        title: "Test the message",
        desc: "A/B two variants head-to-head: which one wins per segment, with sentiment and themes for each.",
      },
      {
        title: "Decide with eyes open",
        desc: "The dominant objection across segments, and what to test next.",
      },
    ],
    features: [
      {
        title: "Copy, claims, and taglines — today",
        desc: "Text messaging is fully supported. Visual-creative formats aren't yet — we'd rather tell you that here.",
      },
      {
        title: "Arabic stimulus supported",
        desc: "Test Arabic copy directly — the twins respond in character.",
      },
      {
        title: "Cultural context per segment",
        desc: "Region, language, and norms shape every persona — not one global average consumer.",
      },
      {
        title: "Calibrate against reality",
        desc: "Upload real customer responses and track how well each segment's twin matches them over time.",
      },
    ],
    honestNote:
      "Simulated consumers, not a survey panel: directional reads on message resonance, without percentile norms or category benchmarks. Where the spend is big, validate with real respondents.",
    cta: "Start free — test your first claim today",
  },
};
