import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { UserCircle2, ChevronRight, X } from "lucide-react";
import { useState } from "react";

const PROFILE_FIELDS = [
  "display_name", "gender", "date_of_birth", "country",
  "education", "employment_status", "industry", "interests",
];

export function ProfileCompletionBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const { data: profileData } = useQuery({
    queryKey: ["participant-completion-banner", user?.id],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("participant-profile");
      return data?.profile as Record<string, unknown> | null;
    },
    enabled: !!user,
  });

  if (!profileData || dismissed) return null;

  const filled = PROFILE_FIELDS.filter(
    (f) => profileData[f] !== null && profileData[f] !== undefined && profileData[f] !== ""
      && !(Array.isArray(profileData[f]) && (profileData[f] as unknown[]).length === 0)
  ).length;

  const pct = Math.round((filled / PROFILE_FIELDS.length) * 100);

  // Don't show if complete or nearly complete
  if (pct >= 80) return null;

  return (
    <div className="relative rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/[0.03] to-transparent p-4">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-4 pr-6">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <UserCircle2 className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold">
              Complete your profile — get better study matches
            </p>
            <span className="text-xs font-bold text-primary shrink-0 ml-2">{pct}%</span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-2">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            A complete profile helps researchers find you faster — and boosts your match score.
          </p>

          <Link to="/participate/profile" className="inline-flex mt-2">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
              Complete Profile <ChevronRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
