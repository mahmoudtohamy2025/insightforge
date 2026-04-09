import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

type ActivityAction =
  | "created"
  | "updated"
  | "deleted"
  | "duplicated"
  | "invited_member"
  | "removed_member"
  | "changed_role"
  | "launched"
  | "completed"
  | "paused";

type EntityType =
  | "session"
  | "survey"
  | "project"
  | "participant"
  | "member"
  | "workspace";

export async function logActivity(
  workspaceId: string,
  userId: string,
  action: ActivityAction,
  entityType: EntityType,
  entityId?: string,
  metadata?: Record<string, Json | undefined>
) {
  try {
    await supabase.from("workspace_activity").insert({
      workspace_id: workspaceId,
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      metadata: metadata || {},
    });
  } catch (e) {
    // Silent fail — audit logging should never block the user
    console.warn("Activity log failed:", e);
  }
}
