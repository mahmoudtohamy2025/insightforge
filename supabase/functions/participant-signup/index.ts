import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PARTICIPANT-SIGNUP] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    logStep("Function started");
    const body = await req.json();
    const { email, password, display_name, date_of_birth, gender, country, city } = body;

    // Validation
    if (!email || !password || !display_name) {
      return new Response(JSON.stringify({ error: "email, password, and display_name are required" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Create auth user with participant role metadata
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "participant", display_name },
    });

    if (authError) {
      logStep("Auth error", { message: authError.message });
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;
    logStep("User created", { userId });

    // Create participant profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("participant_profiles")
      .insert({
        user_id: userId,
        display_name,
        date_of_birth: date_of_birth || null,
        gender: gender || null,
        country: country || null,
        city: city || null,
      })
      .select()
      .single();

    if (profileError) {
      logStep("Profile creation error", { message: profileError.message });
      // Rollback: delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: "Failed to create profile" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Create reputation record
    const { error: repError } = await supabaseAdmin
      .from("participant_reputation")
      .insert({ participant_id: profile.id });

    if (repError) {
      logStep("Reputation creation error (non-fatal)", { message: repError.message });
    }

    logStep("Signup complete", { userId, profileId: profile.id });

    return new Response(JSON.stringify({
      user: { id: userId, email },
      profile,
    }), {
      status: 201,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
