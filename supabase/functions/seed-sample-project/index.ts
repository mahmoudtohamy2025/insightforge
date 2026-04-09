import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";
import { requireWorkspaceMember } from "../_shared/validation.ts";

const SAMPLE_TRANSCRIPT = `Interviewer: Thank you for joining us today. Can you tell me about your experience with research tools?

Participant: Sure. I've been using several tools over the past two years. The biggest challenge is always organizing the data. You collect interviews, surveys, and observations, but making sense of it all is really hard.

Interviewer: What specifically makes it hard?

Participant: First, the transcripts are long and unstructured. I spend hours reading through them just to find key quotes. Second, there's no easy way to see patterns across multiple sessions. I end up using spreadsheets which is painful.

المحاور: هل يمكنك أن تخبرنا عن تجربتك مع أدوات البحث؟

المشارك: بالتأكيد. أكبر تحدي هو تنظيم البيانات. عندما تجمع مقابلات واستبيانات وملاحظات، من الصعب جداً فهم كل شيء معاً. أقضي ساعات في قراءة النصوص المطولة فقط للعثور على اقتباسات مهمة.

Interviewer: If you could wave a magic wand, what would the ideal research tool look like?

Participant: It would automatically analyze my transcripts and pull out themes. It would show me patterns across sessions. And it would let me search through everything with natural language queries instead of keyword matching.

Interviewer: How important is collaboration for you?

Participant: Very important. Research is a team sport. I need to share findings with designers, product managers, and executives. Each audience needs different levels of detail. Right now I'm creating separate presentations for each group, which doubles my work.

Interviewer: What about data privacy? Is that a concern?

Participant: Absolutely. We work with sensitive participant data. GDPR compliance is mandatory for us. We need to be able to delete participant data on request and know exactly where their information is stored.

Interviewer: Thank you so much for your insights today.

Participant: Happy to help. I'm really looking for a tool that solves these problems.`;

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const { workspace_id } = await req.json();

    if (!workspace_id) {
      return new Response(JSON.stringify({ error: "Missing workspace_id" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Check if sample already seeded (avoid duplicates)
    const { data: existing } = await supabase
      .from("sessions")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("title", "Sample: User Research Interview")
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ error: "Sample data already exists", session_id: existing[0].id }), {
        status: 409,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Create sample session
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .insert({
        workspace_id,
        title: "Sample: User Research Interview",
        type: "idi",
        status: "completed",
        created_by: userId,
        duration_minutes: 30,
        scheduled_date: new Date().toISOString().split("T")[0],
      })
      .select("id")
      .single();

    if (sessionError || !session) {
      console.error("Session creation error:", sessionError);
      return new Response(JSON.stringify({ error: "Failed to create sample session" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Insert sample transcript
    const { error: txError } = await supabase
      .from("session_transcripts")
      .insert({
        session_id: session.id,
        workspace_id,
        raw_text: SAMPLE_TRANSCRIPT,
        language: "en",
        source: "sample",
      });

    if (txError) {
      console.error("Transcript insert error:", txError);
      return new Response(JSON.stringify({ error: "Failed to insert sample transcript" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Trigger analysis via the analyze-transcript function
    const analyzeResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/analyze-transcript`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
        },
        body: JSON.stringify({ session_id: session.id, workspace_id }),
      }
    );

    const analyzeResult = await analyzeResponse.json();

    return new Response(
      JSON.stringify({
        session_id: session.id,
        analysis: analyzeResult,
      }),
      {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("seed-sample-project error:", err);
    return new Response(JSON.stringify({ error: (err instanceof Error ? err.message : "Unknown error") }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
