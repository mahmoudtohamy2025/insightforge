/**
 * Shared CORS helper for all InsightForge edge functions.
 * Validates the Origin header against an allowlist and returns
 * origin-specific CORS headers instead of wildcard "*".
 */

const ALLOWED_ORIGINS: string[] = [
  // Production
  "https://insightforge.io",
  "https://www.insightforge.io",
  // Staging / preview (Lovable & Vercel)
  "https://pjscposcnznrabswauuw.lovableproject.com",
  "https://ai-hybrid-focus-group-main.vercel.app",
  // Local development
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:3000",
];

// Allow override via environment variable (comma-separated)
const envOrigins = Deno.env.get("ALLOWED_ORIGINS");
if (envOrigins) {
  envOrigins.split(",").map((o) => o.trim()).filter(Boolean).forEach((o) => {
    if (!ALLOWED_ORIGINS.includes(o)) ALLOWED_ORIGINS.push(o);
  });
}

const ALLOWED_HEADERS = [
  "authorization",
  "x-client-info",
  "apikey",
  "content-type",
  "x-supabase-client-platform",
  "x-supabase-client-platform-version",
  "x-supabase-client-runtime",
  "x-supabase-client-runtime-version",
].join(", ");

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
}

/** Standard preflight response */
export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }
  return null;
}

/** JSON response helper with CORS headers */
export function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}
