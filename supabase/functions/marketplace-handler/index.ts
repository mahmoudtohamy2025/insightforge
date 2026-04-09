import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { requireWorkspaceMember } from "../_shared/validation.ts";

/**
 * Marketplace Handler
 * POST /marketplace-handler
 * Payload:
 * {
 *   "action": "publish" | "import",
 *   "segment_id": "uuid",
 *   "target_workspace_id": "uuid", // needed for import
 *   "industry": "Healthcare", // optional for publish
 *   "price_credits": 0 // optional for publish
 * }
 */

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const { action, segment_id, target_workspace_id, industry, price_credits } = await req.json();

    if (!action || !segment_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { 
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { 
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    if (action === "publish") {
      const { error: updateError } = await supabaseClient
        .from("segment_profiles")
        .update({ 
          is_published: true, 
          industry: industry || null,
          price_credits: price_credits || 0 
        })
        .eq("id", segment_id);

      if (updateError) throw updateError;

      // Log publish action
      const { data: segmentData } = await supabaseClient
        .from("segment_profiles")
        .select("workspace_id")
        .eq("id", segment_id)
        .single();

      if (segmentData) {
        await supabaseClient.from("audit_logs").insert({
          workspace_id: segmentData.workspace_id,
          user_id: user.id,
          action: 'marketplace_publish',
          resource_type: 'segment_profile',
          resource_id: segment_id,
          details: { industry, price_credits }
        });
      }

      return new Response(JSON.stringify({ message: "Segment published successfully" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } 
    
    else if (action === "import") {
      if (!target_workspace_id) {
        return new Response(JSON.stringify({ error: "Missing target_workspace_id" }), { 
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      // 1. Fetch the segment definition from view
      const { data: originalSegment, error: fetchError } = await supabaseClient
        .from("marketplace_segments")
        .select("*")
        .eq("id", segment_id)
        .single();
        
      if (fetchError || !originalSegment) {
        return new Response(JSON.stringify({ error: "Segment not found or not public" }), { 
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      // 2. Fetch the full JSON profiles from segment_profiles
      const { data: fullSegmentData, error: profileFetchError } = await supabaseClient
        .from("segment_profiles")
        .select("*")
        .eq("id", segment_id)
        .single();
        
      if (profileFetchError || !fullSegmentData) {
         return new Response(JSON.stringify({ error: "Segment profile data missing" }), { 
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      // 3. Clone it for the user
      const newSegment = {
        workspace_id: target_workspace_id,
        name: `${originalSegment.name} (Imported)`,
        description: originalSegment.description,
        avatar_url: originalSegment.avatar_url,
        demographics: fullSegmentData.demographics,
        psychographics: fullSegmentData.psychographics,
        behavioral_data: fullSegmentData.behavioral_data,
        cultural_context: fullSegmentData.cultural_context,
        calibration_score: originalSegment.calibration_score,
        model_version: fullSegmentData.model_version,
        is_preset: false,
        is_published: false,
        created_by: user.id
      };

      const { data: insertedSegment, error: insertError } = await supabaseClient
        .from("segment_profiles")
        .insert(newSegment)
        .select()
        .single();

      if (insertError) throw insertError;

      // 4. Increment downloads on the original segment (simple + 1)
      await supabaseClient
        .from("segment_profiles")
        .update({ downloads: (originalSegment.downloads || 0) + 1 })
        .eq("id", segment_id);

      // 5. Log the import action in current workspace
      await supabaseClient.from("audit_logs").insert({
        workspace_id: target_workspace_id,
        user_id: user.id,
        action: 'marketplace_import',
        resource_type: 'segment_profile',
        resource_id: insertedSegment.id,
        details: { original_id: segment_id }
      });

      return new Response(JSON.stringify({ message: "Segment imported successfully", new_segment_id: insertedSegment.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action type" }), { 
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
