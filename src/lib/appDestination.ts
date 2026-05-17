import { supabase } from "@/integrations/supabase/client";

export async function isPlatformSuperAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("super_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(data) && !error;
}

export async function getDefaultAppPathForUser(userId: string): Promise<string> {
  return (await isPlatformSuperAdmin(userId)) ? "/admin" : "/dashboard";
}
