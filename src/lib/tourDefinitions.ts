import type { TourStep } from "@/components/onboarding/ProductTour";

// ═══════════════════════════════════════════
// 1. Digital Twins Page
// ═══════════════════════════════════════════
export const TOUR_TWINS: TourStep[] = [
  {
    target: "#twins-header",
    icon: "🧬",
    title: "Meet Your Digital Twins",
    description:
      "Digital twins are AI-powered consumer personas. Define their demographics, psychographics, and cultural context — then ask them anything about your products, campaigns, or policies.",
    position: "bottom",
  },
  {
    target: "#create-segment-btn",
    icon: "➕",
    title: "Create Your First Twin",
    description:
      "Click here to define a consumer segment. Fill in age, gender, location, income, values, and lifestyle to build a realistic persona that the AI embodies.",
    position: "bottom",
  },
  {
    target: "#twin-builder-btn",
    icon: "🪄",
    title: "AI Twin Builder",
    description:
      "Use the Twin Builder for a guided experience — describe your target audience in plain English and AI generates the full persona profile for you.",
    position: "bottom",
  },
];

// ═══════════════════════════════════════════
// 2. Simulation Studio
// ═══════════════════════════════════════════
export const TOUR_SIMULATION: TourStep[] = [
  {
    target: "#simulation-header",
    icon: "🎯",
    title: "Solo Simulation Studio",
    description:
      "Ask a single digital twin a question and get an instant, structured response — including sentiment score, confidence level, key themes, emotional reaction, and purchase intent.",
    position: "bottom",
  },
  {
    target: "#segment-selector",
    icon: "👤",
    title: "Pick a Target Segment",
    description:
      "Select the consumer segment you want to query. Each twin has unique demographics and psychographic traits that shape how they respond.",
    position: "bottom",
  },
  {
    target: "#stimulus-input",
    icon: "✏️",
    title: "Write Your Stimulus",
    description:
      "Describe a product idea, ad concept, pricing change, or policy. Be specific — the more context you give, the richer and more realistic the simulated response.",
    position: "top",
  },
  {
    target: "#run-simulation-btn",
    icon: "⚡",
    title: "Run the Simulation",
    description:
      "Hit this to get your twin's AI-generated response in 5-10 seconds. You'll see sentiment, confidence, key themes, purchase intent, and emotional reaction.",
    position: "top",
  },
  {
    target: "#recent-simulations",
    icon: "📜",
    title: "Review Past Simulations",
    description:
      "All past simulations are saved here. Click any result to review, compare across segments, or export as a PDF report.",
    position: "left",
  },
];

// ═══════════════════════════════════════════
// 3. Focus Group Studio
// ═══════════════════════════════════════════
export const TOUR_FOCUS_GROUP: TourStep[] = [
  {
    target: "#fg-header",
    icon: "💬",
    title: "AI Focus Group",
    description:
      "Run a moderated discussion between multiple digital twins. They debate, agree, disagree — just like real focus groups, but completed in seconds instead of weeks.",
    position: "bottom",
  },
  {
    target: "#fg-segment-select",
    icon: "👥",
    title: "Select 2-6 Participants",
    description:
      "Check the twins you want in the discussion. Mix segments for diverse perspectives — e.g., Gen-Z health-conscious + Boomer traditionalists.",
    position: "bottom",
  },
  {
    target: "#fg-topic-input",
    icon: "💡",
    title: "Set the Discussion Topic",
    description:
      'Write what you want them to discuss. Example: "What do you think about a $50/month meal kit delivery service targeting working parents?"',
    position: "top",
  },
  {
    target: "#fg-rounds-select",
    icon: "🔄",
    title: "Choose Discussion Rounds",
    description:
      "More rounds = deeper conversation. Round 1 gives initial reactions. Round 2+ lets twins respond to each other's points, creating realistic group dynamics.",
    position: "bottom",
  },
  {
    target: "#fg-run-btn",
    icon: "🚀",
    title: "Start the Focus Group",
    description:
      "The AI generates a full multi-round discussion with per-participant sentiment tracking, consensus points, and areas of disagreement.",
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
    title: "A/B Test Studio",
    description:
      "Compare two product concepts, ads, or messages side-by-side. Each twin evaluates both variants independently — you see which wins and exactly why.",
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
      "Enter the alternative. The AI evaluates both independently for each segment — no cross-contamination between variants.",
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
    title: "Market Simulation",
    description:
      "Predict market reception for a product. Get purchase probability, price sensitivity, adoption timing (innovator→laggard), and word-of-mouth likelihood.",
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
    title: "Policy Impact Simulation",
    description:
      "Test how populations react to policies, regulations, or societal changes — from urban planning to healthcare mandates to environmental rules.",
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
  twins: { id: "twins", label: "Digital Twins", steps: TOUR_TWINS },
  simulation: { id: "simulation", label: "Simulation Studio", steps: TOUR_SIMULATION },
  focusGroup: { id: "focus-group", label: "Focus Group Studio", steps: TOUR_FOCUS_GROUP },
  abTest: { id: "ab-test", label: "A/B Test Studio", steps: TOUR_AB_TEST },
  marketSim: { id: "market-sim", label: "Market Simulation", steps: TOUR_MARKET_SIM },
  policySim: { id: "policy-sim", label: "Policy Simulation", steps: TOUR_POLICY_SIM },
  sessions: { id: "sessions", label: "Sessions", steps: TOUR_SESSIONS },
  surveys: { id: "surveys", label: "Surveys", steps: TOUR_SURVEYS },
  requirements: { id: "requirements", label: "Requirements", steps: TOUR_REQUIREMENTS },
  insights: { id: "insights", label: "Insights", steps: TOUR_INSIGHTS },
} as const;
