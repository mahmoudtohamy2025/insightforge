import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Archetypes based on interest/professional profile
const ARCHETYPES = [
  { id: "innovator",     label: "The Innovator",      emoji: "🚀", traits: ["tech_affinity", "curiosity", "early_adopter"],          description: "You're energized by new ideas and love exploring cutting-edge products before they go mainstream." },
  { id: "analyst",      label: "The Analyst",         emoji: "📊", traits: ["finance", "data_driven", "strategic"],                   description: "You approach decisions methodically, valuing facts over feelings." },
  { id: "connector",    label: "The Connector",        emoji: "🤝", traits: ["social", "community", "empathy"],                        description: "You thrive on relationships and use products that bring people together." },
  { id: "creator",      label: "The Creator",          emoji: "🎨", traits: ["design", "media", "expression"],                         description: "You find meaning through creative output and value aesthetics deeply." },
  { id: "pragmatist",   label: "The Pragmatist",       emoji: "⚡", traits: ["efficiency", "value", "reliability"],                   description: "You're no-nonsense — you want things that work, fast, reliably, and cheaply." },
  { id: "caregiver",    label: "The Caregiver",        emoji: "💚", traits: ["health", "family", "environment"],                      description: "You prioritize wellness, sustainability, and the wellbeing of the people around you." },
  { id: "explorer",     label: "The Explorer",         emoji: "🌍", traits: ["travel", "adventure", "diversity"],                     description: "You crave novelty and seek out experiences that broaden your worldview." },
  { id: "achiever",     label: "The Achiever",         emoji: "🏆", traits: ["career", "ambition", "status"],                         description: "You're driven by accomplishment and love products that signal your success." },
];

function deriveArchetype(profile: Record<string, unknown>, reputation: Record<string, unknown> | null): typeof ARCHETYPES[0] {
  const interests: string[] = (profile.interests as string[]) || [];
  const industry = String(profile.industry || "").toLowerCase();
  const employment = String(profile.employment_status || "").toLowerCase();

  // Score each archetype
  const scores: Record<string, number> = {};
  for (const a of ARCHETYPES) scores[a.id] = 0;

  if (interests.some((i) => ["Technology", "Gaming", "Finance"].includes(i))) scores.innovator += 3;
  if (interests.some((i) => ["Finance"].includes(i)) || industry.includes("finance")) scores.analyst += 3;
  if (interests.some((i) => ["Health & Fitness", "Environment", "Parenting"].includes(i))) scores.caregiver += 3;
  if (interests.some((i) => ["Travel"].includes(i))) scores.explorer += 3;
  if (interests.some((i) => ["Music", "Entertainment", "Fashion"].includes(i))) scores.creator += 3;
  if (industry.includes("tech") || industry.includes("software")) scores.innovator += 2;
  if (industry.includes("health") || industry.includes("med")) scores.caregiver += 2;
  if (industry.includes("finance") || industry.includes("banking")) scores.analyst += 2;
  if (employment === "student") scores.innovator += 1;
  if (reputation && Number(reputation.total_studies || 0) > 5) scores.achiever += 2;

  const top = Object.entries(scores).sort(([, a], [, b]) => b - a)[0];
  return ARCHETYPES.find((a) => a.id === top[0]) || ARCHETYPES[0];
}

function buildTraits(profile: Record<string, unknown>): Array<{ label: string; score: number; description: string }> {
  const interests: string[] = (profile.interests as string[]) || [];
  const traits = [
    { label: "Tech Affinity",         score: interests.includes("Technology") || interests.includes("Gaming") ? 80 + Math.floor(Math.random() * 15) : 30 + Math.floor(Math.random() * 30), description: "How likely to adopt new technology early" },
    { label: "Brand Loyalty",         score: 40 + Math.floor(Math.random() * 50), description: "Tendency to stick with familiar brands" },
    { label: "Price Sensitivity",     score: interests.includes("Finance") ? 60 + Math.floor(Math.random() * 20) : 30 + Math.floor(Math.random() * 40), description: "How much price influences purchase decisions" },
    { label: "Social Influence",      score: interests.some((i) => ["Entertainment", "Fashion", "Sports"].includes(i)) ? 70 + Math.floor(Math.random() * 20) : 25 + Math.floor(Math.random() * 40), description: "Susceptibility to peer and influencer recommendations" },
    { label: "Sustainability Focus",  score: interests.includes("Environment") ? 80 + Math.floor(Math.random() * 15) : 20 + Math.floor(Math.random() * 35), description: "Priority given to eco-friendly choices" },
  ];
  return traits;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

  const { data: profile } = await supabase
    .from("participant_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!profile) return new Response(JSON.stringify({ error: "Profile not found" }), { status: 404, headers: corsHeaders });

  const { data: reputation } = await supabase
    .from("participant_reputation")
    .select("tier, total_studies, avg_rating")
    .eq("participant_id", profile.id)
    .single();

  const { count: studiesUsed } = await supabase
    .from("study_participations")
    .select("*", { count: "exact", head: true })
    .eq("participant_id", profile.id);

  const archetype = deriveArchetype(profile, reputation);
  const traits = buildTraits(profile);

  // Calibration accuracy — based on profile completeness
  const fields = ["gender", "date_of_birth", "country", "education", "employment_status", "industry", "interests"];
  const filledFields = fields.filter((f) => {
    const v = profile[f];
    return v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
  }).length;
  const calibrationAccuracy = Math.round((filledFields / fields.length) * 100);

  return new Response(
    JSON.stringify({
      archetype,
      traits,
      calibration_accuracy: calibrationAccuracy,
      studies_contributed_to: studiesUsed ?? 0,
      display_name: profile.display_name,
      interests: (profile.interests as string[]) || [],
      reputation_tier: reputation?.tier || "newcomer",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
