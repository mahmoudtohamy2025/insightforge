import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";

const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return json(req, { error: "Method not allowed" }, 405);
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const workspaceName = typeof body.workspace_name === "string" ? body.workspace_name.trim() : "";

    if (!fullName || !email || !password || !workspaceName) {
      return json(req, { error: "full_name, email, password, and workspace_name are required" }, 400);
    }

    if (password.length < 8) {
      return json(req, { error: "Password must be at least 8 characters" }, 400);
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        workspace_name: workspaceName,
      },
    });

    if (error) {
      return json(req, { error: error.message }, 400);
    }

    return json(
      req,
      {
        user: {
          id: data.user.id,
          email: data.user.email,
        },
      },
      201,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return json(req, { error: message }, 500);
  }
});
