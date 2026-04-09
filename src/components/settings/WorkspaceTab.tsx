import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Building2, AlertTriangle, Loader2, Upload, Globe, Clock, MapPin, Palette, Database, Download } from "lucide-react";

const PRESET_COLORS = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

const TIMEZONES = [
  "Asia/Riyadh", "Asia/Dubai", "Asia/Kuwait", "Asia/Bahrain", "Asia/Qatar",
  "Africa/Cairo", "Europe/London", "Europe/Berlin", "America/New_York",
  "America/Chicago", "America/Los_Angeles", "Asia/Tokyo", "Asia/Singapore",
  "Australia/Sydney", "Pacific/Auckland",
];

export function WorkspaceTab() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { currentWorkspace, refetchWorkspaces } = useWorkspace();
  const queryClient = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [wsName, setWsName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [brandPrimary, setBrandPrimary] = useState("");
  const [brandAccent, setBrandAccent] = useState("");
  const [defaultLocale, setDefaultLocale] = useState("");
  const [defaultTimezone, setDefaultTimezone] = useState("");
  const [dataRetention, setDataRetention] = useState("730");

  const isOwner = currentWorkspace?.role === "owner";
  const isAdminOrOwner = currentWorkspace?.role === "owner" || currentWorkspace?.role === "admin";

  // Workspace branding query
  const { data: wsSettings } = useQuery({
    queryKey: ["workspace-settings", currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("logo_url, brand_primary_color, brand_accent_color, default_locale, default_timezone, data_residency, data_retention_days")
        .eq("id", currentWorkspace!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentWorkspace?.id,
  });

  // Sync workspace name (replaces setTimeout anti-pattern)
  useEffect(() => {
    if (currentWorkspace?.name && !wsName) {
      setWsName(currentWorkspace.name);
    }
  }, [currentWorkspace?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync branding state from query (replaces setTimeout anti-pattern)
  useEffect(() => {
    if (wsSettings && !brandPrimary) {
      setBrandPrimary(wsSettings.brand_primary_color || "#6366f1");
      setBrandAccent(wsSettings.brand_accent_color || "#f59e0b");
      setDefaultLocale(wsSettings.default_locale || "en");
      setDefaultTimezone(wsSettings.default_timezone || "Asia/Riyadh");
      setDataRetention(String(wsSettings?.data_retention_days || 730));
    }
  }, [wsSettings]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentLogoUrl = logoPreview || wsSettings?.logo_url || "";

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: t("branding.logoTooLarge"), variant: "destructive" });
      return;
    }
    if (!["image/png", "image/jpeg", "image/svg+xml"].includes(file.type)) {
      toast({ title: t("branding.logoInvalidType"), variant: "destructive" });
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const updateWsMutation = useMutation({
    mutationFn: async () => {
      if (!currentWorkspace || !user) throw new Error("No workspace");
      const hexRegex = /^#[0-9a-fA-F]{6}$/;
      if (brandPrimary && !hexRegex.test(brandPrimary)) throw new Error("Invalid primary color hex");
      if (brandAccent && !hexRegex.test(brandAccent)) throw new Error("Invalid accent color hex");

      let logoUrl = wsSettings?.logo_url || null;
      if (logoFile) {
        const ext = logoFile.name.split(".").pop();
        const path = `${currentWorkspace.id}/logo.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("workspace-logos")
          .upload(path, logoFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("workspace-logos").getPublicUrl(path);
        logoUrl = urlData.publicUrl;
      }

      const { error } = await supabase
        .from("workspaces")
        .update({
          name: wsName,
          logo_url: logoUrl,
          brand_primary_color: brandPrimary || "#6366f1",
          brand_accent_color: brandAccent || "#f59e0b",
          default_locale: defaultLocale || "en",
          default_timezone: defaultTimezone || "Asia/Riyadh",
          data_retention_days: parseInt(dataRetention) || 730,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentWorkspace.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchWorkspaces();
      queryClient.invalidateQueries({ queryKey: ["workspace-settings"] });
      setLogoFile(null);
      setLogoPreview(null);
      toast({ title: t("workspace.updated") });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteWsMutation = useMutation({
    mutationFn: async () => {
      if (!currentWorkspace) throw new Error("No workspace");
      const { error } = await supabase.from("workspaces").delete().eq("id", currentWorkspace.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchWorkspaces();
      toast({ title: t("workspace.deleted") });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      {/* Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {t("branding.workspaceIdentity")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("auth.workspaceName")}</Label>
            <Input value={wsName} onChange={(e) => setWsName(e.target.value)} disabled={!isAdminOrOwner} />
          </div>
          <div className="space-y-2">
            <Label>Workspace URL</Label>
            <Input value={currentWorkspace?.slug || ""} disabled className="bg-muted" />
          </div>
        </CardContent>
      </Card>

      {/* Logo & Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4" />
            {t("branding.title")}
          </CardTitle>
          <CardDescription>{t("branding.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>{t("branding.logo")}</Label>
            <div className="flex items-center gap-4">
              <div className="w-[200px] h-[60px] border border-dashed border-border rounded-md flex items-center justify-center bg-muted/30 overflow-hidden">
                {currentLogoUrl ? (
                  <img src={currentLogoUrl} alt="Workspace logo" className="max-w-full max-h-full object-contain" />
                ) : (
                  <span className="text-xs text-muted-foreground">{t("branding.noLogo")}</span>
                )}
              </div>
              <div>
                <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={!isAdminOrOwner}>
                  <Upload className="h-3.5 w-3.5 me-1.5" />
                  {t("branding.uploadLogo")}
                </Button>
                <p className="text-xs text-muted-foreground mt-1">{t("branding.logoHint")}</p>
                <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={handleLogoChange} />
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Primary Color */}
            <div className="space-y-2">
              <Label>{t("branding.primaryColor")}</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setBrandPrimary(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${brandPrimary === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    disabled={!isAdminOrOwner}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded border border-border shrink-0" style={{ backgroundColor: brandPrimary }} />
                <Input value={brandPrimary} onChange={(e) => setBrandPrimary(e.target.value)} placeholder="#6366f1" className="w-28 font-mono text-xs" maxLength={7} disabled={!isAdminOrOwner} />
              </div>
            </div>
            {/* Accent Color */}
            <div className="space-y-2">
              <Label>{t("branding.accentColor")}</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setBrandAccent(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${brandAccent === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    disabled={!isAdminOrOwner}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded border border-border shrink-0" style={{ backgroundColor: brandAccent }} />
                <Input value={brandAccent} onChange={(e) => setBrandAccent(e.target.value)} placeholder="#f59e0b" className="w-28 font-mono text-xs" maxLength={7} disabled={!isAdminOrOwner} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Locale & Timezone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" />
            {t("branding.localization")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("branding.defaultLanguage")}</Label>
              <Select value={defaultLocale} onValueChange={setDefaultLocale} disabled={!isAdminOrOwner}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">العربية (Arabic)</SelectItem>
                  <SelectItem value="fr">Français (French)</SelectItem>
                  <SelectItem value="es">Español (Spanish)</SelectItem>
                  <SelectItem value="de">Deutsch (German)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {t("branding.defaultTimezone")}
              </Label>
              <Select value={defaultTimezone} onValueChange={setDefaultTimezone} disabled={!isAdminOrOwner}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {t("branding.dataResidency")}
            </Label>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs capitalize">
                {wsSettings?.data_residency || "mena"}
              </Badge>
              <span className="text-xs text-muted-foreground">{t("branding.dataResidencyHint")}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Governance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            {t("governance.title")}
          </CardTitle>
          <CardDescription>{t("governance.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>{t("governance.retentionPeriod")}</Label>
            <Select value={dataRetention} onValueChange={setDataRetention} disabled={!isAdminOrOwner}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="90">{t("governance.90days")}</SelectItem>
                <SelectItem value="180">{t("governance.180days")}</SelectItem>
                <SelectItem value="365">{t("governance.365days")}</SelectItem>
                <SelectItem value="730">{t("governance.730days")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("governance.retentionHint")}</p>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label>{t("governance.exportTitle")}</Label>
            <p className="text-xs text-muted-foreground">{t("governance.exportDesc")}</p>
            <ExportWorkspaceDataButton workspaceId={currentWorkspace?.id} isAdminOrOwner={isAdminOrOwner} t={t} />
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <Button
        onClick={() => updateWsMutation.mutate()}
        disabled={updateWsMutation.isPending || !isAdminOrOwner}
      >
        {updateWsMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
        {t("common.save")}
      </Button>

      {isOwner && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {t("settings.dangerZone")}
            </CardTitle>
            <CardDescription>Irreversible and destructive actions</CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  {t("settings.deleteWorkspace")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("settings.deleteWorkspace")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("workspace.deleteConfirm")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteWsMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {t("common.delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// --- Export Workspace Data Button ---
function ExportWorkspaceDataButton({ workspaceId, isAdminOrOwner, t }: { workspaceId?: string; isAdminOrOwner: boolean; t: (k: string) => string }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!workspaceId) return;
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-workspace-data", {
        body: { workspace_id: workspaceId },
      });
      if (error) throw error;

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `workspace-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: t("governance.exportSuccess") });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={!isAdminOrOwner || exporting}>
      {exporting ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Download className="h-4 w-4 me-2" />}
      {t("governance.exportButton")}
    </Button>
  );
}
