import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Save, Image as ImageIcon, Link2 } from "lucide-react";

export function WhiteLabelTab() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  const [form, setForm] = useState({
    brand_name: "InsightForge",
    primary_color: "#4A9E8E",
    accent_color: "#E8D5B7",
    custom_domain: "",
    hide_insightforge_branding: false,
    logo_url: "",
  });

  const { data: branding, isLoading } = useQuery({
    queryKey: ["workspace_branding", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_branding")
        .select("*")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });

  useEffect(() => {
    if (branding) {
      setForm({
        brand_name: branding.brand_name || "InsightForge",
        primary_color: branding.primary_color || "#4A9E8E",
        accent_color: branding.accent_color || "#E8D5B7",
        custom_domain: branding.custom_domain || "",
        hide_insightforge_branding: branding.hide_insightforge_branding || false,
        logo_url: branding.logo_url || "",
      });
    }
  }, [branding]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("workspace_branding")
        .upsert({
          workspace_id: workspaceId!,
          ...form,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: "workspace_id" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace_branding", workspaceId] });
      toast({ title: "Branding updated successfully" });
    },
    onError: (err) => {
      toast({ title: "Failed to update branding", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">White-Label Settings</h3>
        <p className="text-sm text-muted-foreground">
          Customize the look and feel of your InsightForge environment for your clients.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                 <ImageIcon className="h-4 w-4 text-primary" />
                 Brand Identity
              </CardTitle>
              <CardDescription>Configure your primary brand elements.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="brandName">Brand Name</Label>
                <Input 
                  id="brandName" 
                  value={form.brand_name} 
                  onChange={e => setForm(f => ({ ...f, brand_name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input 
                  id="logoUrl" 
                  placeholder="https://example.com/logo.png"
                  value={form.logo_url} 
                  onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="color" 
                      value={form.primary_color} 
                      onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                      className="w-12 h-10 p-1"
                    />
                    <Input 
                      type="text" 
                      value={form.primary_color} 
                      onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                      className="font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Accent Color</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="color" 
                      value={form.accent_color} 
                      onChange={e => setForm(f => ({ ...f, accent_color: e.target.value }))}
                      className="w-12 h-10 p-1"
                    />
                    <Input 
                      type="text" 
                      value={form.accent_color} 
                      onChange={e => setForm(f => ({ ...f, accent_color: e.target.value }))}
                      className="font-mono"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                 <Link2 className="h-4 w-4 text-primary" />
                 Custom Domain
              </CardTitle>
              <CardDescription>Host the platform on your own domain.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customDomain">Domain Name</Label>
                <Input 
                  id="customDomain" 
                  placeholder="e.g. research.mycompany.com"
                  value={form.custom_domain} 
                  onChange={e => setForm(f => ({ ...f, custom_domain: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  You will need to configure a CNAME record pointing to <code className="bg-muted px-1 rounded">cname.insightforge.io</code>.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Hide InsightForge Branding</Label>
                  <p className="text-xs text-muted-foreground">Remove "Powered by InsightForge" from footers and emails.</p>
                </div>
                <Switch 
                  checked={form.hide_insightforge_branding} 
                  onCheckedChange={c => setForm(f => ({ ...f, hide_insightforge_branding: c }))} 
                />
              </div>
            </CardContent>
          </Card>

          <Button 
            className="w-full" 
            onClick={() => updateMutation.mutate()} 
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Branding Settings
          </Button>
        </div>

        <div>
          {/* Live Preview */}
          <Card className="sticky top-6">
            <CardHeader className="border-b" style={{ backgroundColor: form.primary_color, color: "#ffffff" }}>
              <div className="flex items-center gap-3">
                {form.logo_url ? (
                  <img src={form.logo_url} alt="Logo preview" className="h-8 max-w-[120px] object-contain bg-white/10 rounded px-1" />
                ) : (
                  <div className="w-8 h-8 rounded bg-white/20 flex items-center justify-center font-bold">
                    {form.brand_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <CardTitle className="text-lg font-bold">{form.brand_name}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm">This is a live preview of how your brand settings will appear to your clients.</p>
              
              <div className="p-4 rounded-md border text-sm" style={{ borderLeftColor: form.accent_color, borderLeftWidth: "4px" }}>
                Primary buttons and active states will use your primary color. Accents and highlights will use your accent color.
              </div>

              <Button className="w-full" style={{ backgroundColor: form.primary_color, color: "#ffffff" }}>
                Sample Primary Action
              </Button>

              <div className="pt-6 flex justify-center border-t mt-4">
                {!form.hide_insightforge_branding && (
                  <span className="text-xs text-muted-foreground">Powered by InsightForge</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
