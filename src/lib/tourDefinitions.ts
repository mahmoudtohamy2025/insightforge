import type { TourStep } from "@/components/onboarding/ProductTour";

// ═══════════════════════════════════════════
// 1. Customer Profiles Page
// ═══════════════════════════════════════════
export const TOUR_TWINS: TourStep[] = [
  {
    target: "#twins-header",
    icon: "🧬",
    title: "Meet Your Customer Profiles",
    description:
      "Customer profiles are AI-powered stand-ins for the people you want to learn from. Define who they are, what they care about, and their context, then ask how they would react to your product or message.",
    position: "bottom",
  },
  {
    target: "#create-segment-btn",
    icon: "➕",
    title: "Create Your First Profile",
    description:
      "Click here to define a founder or buyer profile. Add details like age, location, income, values, and lifestyle so the AI has a clear point of view.",
    position: "bottom",
  },
  {
    target: "#twin-builder-btn",
    icon: "🪄",
    title: "AI Profile Builder",
    description:
      "Use the Profile Builder for a guided setup. Describe your audience in plain English and the AI will draft the profile for you.",
    position: "bottom",
  },
];

// ═══════════════════════════════════════════
// 2. AI Test
// ═══════════════════════════════════════════
export const TOUR_SIMULATION: TourStep[] = [
  {
    target: "#simulation-header",
    icon: "🎯",
    title: "Run an AI Test",
    description:
      "Ask one customer profile a question and get a fast structured response with sentiment, confidence, key themes, emotional reaction, and likely intent.",
    position: "bottom",
  },
  {
    target: "#segment-selector",
    icon: "👤",
    title: "Pick a Customer Profile",
    description:
      "Choose the founder or buyer profile you want feedback from. Each profile responds differently based on the details you gave it.",
    position: "bottom",
  },
  {
    target: "#stimulus-input",
    icon: "✏️",
    title: "Describe the Decision",
    description:
      "Describe the product, pricing, onboarding, or message decision you need help with. The clearer you are, the more useful the AI response will be.",
    position: "top",
  },
  {
    target: "#run-simulation-btn",
    icon: "⚡",
    title: "Run the AI Test",
    description:
      "Run the test to get a response in a few seconds. You will see the profile's answer, confidence, main themes, likely reaction, and emotional tone.",
    position: "top",
  },
  {
    target: "#recent-simulations",
    icon: "📜",
    title: "Review Past AI Tests",
    description:
      "All past AI tests are saved here. Open any one to review it again, compare results, or export a summary.",
    position: "left",
  },
];

// ═══════════════════════════════════════════
// 3. Panel Discussion
// ═══════════════════════════════════════════
export const TOUR_FOCUS_GROUP: TourStep[] = [
  {
    target: "#fg-header",
    icon: "💬",
    title: "Panel Discussion",
    description:
      "Run a moderated discussion between multiple customer profiles. They agree, disagree, and challenge each other, giving you a richer read than a single AI test.",
    position: "bottom",
  },
  {
    target: "#fg-segment-select",
    icon: "👥",
    title: "Select 2-5 Profiles",
    description:
      "Choose the customer profiles you want in the discussion. Mix different viewpoints when you want a broader read on the decision.",
    position: "bottom",
  },
  {
    target: "#fg-topic-input",
    icon: "💡",
    title: "Set the Discussion Topic",
    description:
      "Write the idea, decision, or message you want the profiles to react to.",
    position: "top",
  },
  {
    target: "#fg-rounds-select",
    icon: "🔄",
    title: "Choose the Number of Rounds",
    description:
      "More rounds create a deeper conversation. The first round shows initial reactions, and later rounds show how the profiles respond to one another.",
    position: "bottom",
  },
  {
    target: "#fg-run-btn",
    icon: "🚀",
    title: "Start the Panel Discussion",
    description:
      "The AI generates the full discussion, including sentiment, common ground, and areas where the profiles disagree.",
    position: "top",
  },
];

// ═══════════════════════════════════════════
// 4. A/B Test Studio
// ═══════════════════════════════════════════
export const TOUR_AB_TEST: TourStep[] = [
  {
    target: "#ab-header",
    icon: "⚡",
    title: "Compare Options",
    description:
      "Compare two product ideas, offers, or messages side-by-side. Each customer profile reviews both options separately so you can see which one wins and why.",
    position: "bottom",
  },
  {
    target: "#ab-variant-a",
    icon: "🅰️",
    title: "Describe Variant A",
    description:
      "Enter your first concept. Include product features, pricing, and positioning for the most accurate comparison.",
    position: "bottom",
  },
  {
    target: "#ab-variant-b",
    icon: "🅱️",
    title: "Describe Variant B",
    description:
      "Enter the alternative. The AI reviews both options independently for each customer profile.",
    position: "bottom",
  },
  {
    target: "#ab-run-btn",
    icon: "🏁",
    title: "Run the A/B Test",
    description:
      "Get a head-to-head comparison with sentiment, purchase intent, and key themes per variant. Results show which variant performs better and why.",
    position: "top",
  },
];

// ═══════════════════════════════════════════
// 5. Market Simulation
// ═══════════════════════════════════════════
export const TOUR_MARKET_SIM: TourStep[] = [
  {
    target: "#market-header",
    icon: "📈",
    title: "Market Forecast",
    description:
      "Estimate how the market may respond to a product. You will see likely demand, price sensitivity, adoption timing, and word of mouth potential.",
    position: "bottom",
  },
  {
    target: "#market-product-input",
    icon: "📦",
    title: "Describe Your Product",
    description:
      "Include product name, features, pricing, target market, and positioning. The richer your description, the more accurate the market forecast.",
    position: "top",
  },
  {
    target: "#market-run-btn",
    icon: "🎯",
    title: "Run Market Forecast",
    description:
      "Results include purchase probability (0-100%), adoption category, price sensitivity, key purchase barriers, and key purchase drivers.",
    position: "top",
  },
];

// ═══════════════════════════════════════════
// 6. Policy Simulation
// ═══════════════════════════════════════════
export const TOUR_POLICY_SIM: TourStep[] = [
  {
    target: "#policy-header",
    icon: "🏛️",
    title: "Policy Check",
    description:
      "Estimate how different groups may react to a policy, rule change, or public decision.",
    position: "bottom",
  },
  {
    target: "#policy-type-select",
    icon: "📋",
    title: "Select Policy Type",
    description:
      "Choose the policy category: economic, social, environmental, health, or technology. This calibrates the AI's evaluation framework.",
    position: "bottom",
  },
  {
    target: "#policy-desc-input",
    icon: "📝",
    title: "Describe the Policy",
    description:
      "Write a clear description of the proposed policy. Include who it affects, what it changes, and any costs or benefits involved.",
    position: "top",
  },
  {
    target: "#policy-run-btn",
    icon: "⚖️",
    title: "Run Impact Analysis",
    description:
      "Get compliance likelihood, support/opposition stance, personal impact, economic impact perception, key concerns, and willingness to advocate publicly.",
    position: "top",
  },
];

// ═══════════════════════════════════════════
// 7. Sessions
// ═══════════════════════════════════════════
export const TOUR_SESSIONS: TourStep[] = [
  {
    target: "#sessions-header",
    icon: "🎙️",
    title: "Research Sessions",
    description:
      "Upload audio/video recordings of real interviews and focus groups. InsightForge transcribes, analyzes, and extracts insights automatically using Deepgram AI.",
    position: "bottom",
  },
  {
    target: "#create-session-btn",
    icon: "➕",
    title: "Create a Session",
    description:
      "Start by naming your session and optionally linking it to a project. Then upload your media file for automatic transcription with speaker detection.",
    position: "bottom",
  },
];

// ═══════════════════════════════════════════
// 8. Surveys
// ═══════════════════════════════════════════
export const TOUR_SURVEYS: TourStep[] = [
  {
    target: "#surveys-header",
    icon: "📋",
    title: "AI-Powered Surveys",
    description:
      "Create and distribute surveys powered by AI. InsightForge can auto-generate contextually relevant questions based on your research requirements.",
    position: "bottom",
  },
  {
    target: "#create-survey-btn",
    icon: "➕",
    title: "Create a Survey",
    description:
      "Define your survey questions manually or let AI generate them from your research requirements. Then distribute via link to collect real responses.",
    position: "bottom",
  },
];

// ═══════════════════════════════════════════
// 9. Requirements
// ═══════════════════════════════════════════
export const TOUR_REQUIREMENTS: TourStep[] = [
  {
    target: "#requirements-header",
    icon: "📝",
    title: "Research Requirements",
    description:
      "Define what you want to learn. Requirements drive AI-generated survey questions, simulation parameters, and methodology recommendations across your workspace.",
    position: "bottom",
  },
  {
    target: "#create-requirement-btn",
    icon: "➕",
    title: "Add a Requirement",
    description:
      'Describe a business question — e.g., "Understand Gen-Z attitudes toward sustainable fashion in MENA." The AI uses this to shape all downstream research.',
    position: "bottom",
  },
];

// ═══════════════════════════════════════════
// 10. Insights
// ═══════════════════════════════════════════
export const TOUR_INSIGHTS: TourStep[] = [
  {
    target: "#insights-header",
    icon: "💡",
    title: "Synthesized Insights",
    description:
      "AI aggregates findings from all your sessions, simulations, and surveys into actionable strategic insights — ready for exec presentations.",
    position: "bottom",
  },
  {
    target: "#synthesize-btn",
    icon: "🧠",
    title: "Generate Insights",
    description:
      "Click to let AI analyze all your workspace data and produce executive-ready findings with confidence ratings, supporting evidence, and recommended actions.",
    position: "bottom",
  },
];

// ═══════════════════════════════════════════
// Registry for the help menu
// ═══════════════════════════════════════════
export const ALL_TOURS = {
  twins: { id: "twins", label: "Customer Profiles", steps: TOUR_TWINS },
  simulation: { id: "simulation", label: "Run an AI Test", steps: TOUR_SIMULATION },
  focusGroup: { id: "focus-group", label: "Panel Discussion", steps: TOUR_FOCUS_GROUP },
  abTest: { id: "ab-test", label: "Compare Options", steps: TOUR_AB_TEST },
  marketSim: { id: "market-sim", label: "Market Forecast", steps: TOUR_MARKET_SIM },
  policySim: { id: "policy-sim", label: "Policy Check", steps: TOUR_POLICY_SIM },
  sessions: { id: "sessions", label: "Interviews", steps: TOUR_SESSIONS },
  surveys: { id: "surveys", label: "Surveys", steps: TOUR_SURVEYS },
  requirements: { id: "requirements", label: "Decisions", steps: TOUR_REQUIREMENTS },
  insights: { id: "insights", label: "Insights", steps: TOUR_INSIGHTS },
} as const;
