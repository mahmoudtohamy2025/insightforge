/**
 * Shared Input Validation for Edge Functions (Deno)
 * 
 * Every edge function must validate its inputs before processing.
 * This module provides validators and workspace membership checks.
 *
 * Usage:
 *   const error = validateRequired(body, ["workspace_id", "segment_id", "stimulus"]);
 *   if (error) return jsonResponse(req, error, 400);
 */

import { jsonResponse } from "./cors.ts";

// ── Primitive Validators ──────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check required fields exist and are non-empty.
 * Returns an error object or null if all valid.
 */
export function validateRequired(
  body: Record<string, unknown>,
  fields: string[],
): { error: string; fields: string[] } | null {
  const missing: string[] = [];
  for (const field of fields) {
    const val = body[field];
    if (val === undefined || val === null || val === "") {
      missing.push(field);
    }
  }
  if (missing.length > 0) {
    return {
      error: `Missing required fields: ${missing.join(", ")}`,
      fields: missing,
    };
  }
  return null;
}

/**
 * Validate a UUID string.
 */
export function isValidUUID(value: unknown): boolean {
  return typeof value === "string" && UUID_REGEX.test(value);
}

/**
 * Validate UUIDs in array. Returns invalid indices.
 */
export function validateUUIDs(
  values: unknown[],
  fieldName: string,
): { error: string } | null {
  for (let i = 0; i < values.length; i++) {
    if (!isValidUUID(values[i])) {
      return { error: `${fieldName}[${i}] is not a valid UUID` };
    }
  }
  return null;
}

/**
 * Sanitize a string: trim, strip HTML, cap length.
 */
export function sanitize(input: unknown, maxLength = 10000): string {
  if (typeof input !== "string") return "";
  let clean = input
    .replace(/<[^>]*>/g, "")   // strip HTML
    .replace(/\0/g, "")        // strip null bytes
    .trim();
  if (clean.length > maxLength) {
    clean = clean.slice(0, maxLength);
  }
  return clean;
}

/**
 * Validate a number is within bounds.
 */
export function validateNumberRange(
  value: unknown,
  fieldName: string,
  min: number,
  max: number,
): { error: string } | null {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (typeof num !== "number" || isNaN(num as number)) {
    return { error: `${fieldName} must be a number` };
  }
  if ((num as number) < min || (num as number) > max) {
    return { error: `${fieldName} must be between ${min} and ${max}` };
  }
  return null;
}

/**
 * Validate enum membership.
 */
export function validateEnumValue(
  value: unknown,
  fieldName: string,
  allowed: string[],
): { error: string } | null {
  if (typeof value !== "string" || !allowed.includes(value)) {
    return { error: `${fieldName} must be one of: ${allowed.join(", ")}` };
  }
  return null;
}

// ── Workspace Membership ──────────────────────────────

/**
 * Verify the authenticated user is a member of the given workspace.
 * Returns a 403 Response if not a member, or null if OK.
 */
export async function validateWorkspaceMembership(
  supabase: any,
  req: Request,
  userId: string,
  workspaceId: string,
): Promise<Response | null> {
  if (!isValidUUID(workspaceId)) {
    return jsonResponse(req, { error: "workspace_id must be a valid UUID" }, 400);
  }

  const { data, error } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return jsonResponse(req, {
      error: "You do not have access to this workspace",
      code: "WORKSPACE_ACCESS_DENIED",
    }, 403);
  }

  return null;
}

// ── Safe Body Parser ──────────────────────────────────

/**
 * Parse the request body safely. Returns parsed body or a 400 Response.
 */
export async function parseBody(req: Request): Promise<{ body?: Record<string, unknown>; error?: Response }> {
  try {
    const body = await req.json();
    if (typeof body !== "object" || body === null) {
      return { error: jsonResponse(req, { error: "Request body must be a JSON object" }, 400) };
    }
    return { body: body as Record<string, unknown> };
  } catch (_) {
    return { error: jsonResponse(req, { error: "Invalid JSON in request body" }, 400) };
  }
}
