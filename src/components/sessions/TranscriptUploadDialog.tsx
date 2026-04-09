import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Upload, Loader2, Globe } from "lucide-react";

interface TranscriptUploadDialogProps {
  sessionId: string;
  workspaceId: string;
  hasTranscript: boolean;
  children: React.ReactNode;
}

export const TranscriptUploadDialog = ({
  sessionId,
  workspaceId,
  hasTranscript,
  children,
}: TranscriptUploadDialogProps) => {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState("");
  const [language, setLanguage] = useState("en");
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async ({ text, source }: { text: string; source: string }) => {
      const { error } = await supabase.from("session_transcripts").insert({
        session_id: sessionId,
        workspace_id: workspaceId,
        raw_text: text,
        source,
        language,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-transcript", sessionId] });
      setOpen(false);
      setRawText("");
      setFileName("");
      setLanguage("en");
      toast({ title: t("sessions.transcript.uploaded") });
    },
    onError: (e) =>
      toast({ title: t("sessions.transcript.error"), description: e.message, variant: "destructive" }),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: t("sessions.transcript.fileTooLarge"), variant: "destructive" });
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRawText((ev.target?.result as string) || "");
    };
    reader.readAsText(file);
  };

  const handleSubmit = () => {
    const trimmed = rawText.trim();
    if (!trimmed) return;
    uploadMutation.mutate({
      text: trimmed,
      source: fileName ? "file_upload" : "manual",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("sessions.transcript.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            {t("sessions.transcript.language")}
          </Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{t("sessions.transcript.langEn")}</SelectItem>
              <SelectItem value="ar">{t("sessions.transcript.langAr")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Tabs defaultValue="paste">
          <TabsList className="w-full">
            <TabsTrigger value="paste" className="flex-1">
              <FileText className="h-3.5 w-3.5 me-1.5" />
              {t("sessions.transcript.paste")}
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex-1">
              <Upload className="h-3.5 w-3.5 me-1.5" />
              {t("sessions.transcript.upload")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="paste" className="space-y-3 mt-3">
            <div className="space-y-2">
              <Label>{t("sessions.transcript.pasteLabel")}</Label>
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={t("sessions.transcript.pastePlaceholder")}
                rows={10}
                className="font-mono text-xs"
              />
            </div>
          </TabsContent>
          <TabsContent value="upload" className="space-y-3 mt-3">
            <div className="space-y-2">
              <Label>{t("sessions.transcript.uploadLabel")}</Label>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.srt,.vtt"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4 me-2" />
                {fileName || t("sessions.transcript.chooseFile")}
              </Button>
              {rawText && (
                <Textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={8}
                  className="font-mono text-xs"
                />
              )}
            </div>
          </TabsContent>
        </Tabs>
        <Button
          onClick={handleSubmit}
          disabled={!rawText.trim() || uploadMutation.isPending}
          className="w-full"
        >
          {uploadMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
          {hasTranscript ? t("sessions.transcript.replace") : t("sessions.transcript.save")}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
