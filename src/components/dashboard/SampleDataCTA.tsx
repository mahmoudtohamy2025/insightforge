import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function SampleDataCTA() {
  const { t } = useI18n();
  const { session } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if (!currentWorkspace?.id || !session?.access_token) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("seed-sample-project", {
        body: { workspace_id: currentWorkspace.id },
      });

      if (error) throw error;

      if (data?.session_id) {
        queryClient.invalidateQueries({ queryKey: ["onboarding-counts"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
        toast({
          title: t("onboarding.sampleCreated"),
          description: t("onboarding.sampleCreatedDesc"),
        });
        navigate(`/sessions/${data.session_id}`);
      }
    } catch (err: any) {
      const msg = err?.message || err?.context?.body?.error || "Failed to create sample data";
      if (msg.includes("already exists")) {
        toast({ title: t("onboarding.sampleExists"), variant: "default" });
      } else {
        toast({ title: msg, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-dashed border-2 border-primary/30 bg-gradient-to-br from-primary/[0.04] to-accent/[0.02]">
      <CardContent className="flex flex-col sm:flex-row items-center gap-4 p-6">
        <div className="rounded-xl bg-primary/10 p-3">
          <Zap className="h-7 w-7 text-primary" />
        </div>
        <div className="flex-1 text-center sm:text-start">
          <h3 className="text-base font-semibold text-foreground">{t("onboarding.sampleTitle")}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{t("onboarding.sampleDesc")}</p>
        </div>
        <Button onClick={handleSeed} disabled={loading} className="gap-2 shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {t("onboarding.trySample")}
        </Button>
      </CardContent>
    </Card>
  );
}
