import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, Loader2, FileAudio, FileVideo, CheckCircle2, XCircle } from "lucide-react";

const ACCEPTED_TYPES = [
  "audio/mp3",
  "audio/mpeg",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

const MAX_SIZE = 100 * 1024 * 1024; // 100MB

interface MediaUploadDialogProps {
  sessionId: string;
  workspaceId: string;
}

export function MediaUploadDialog({ sessionId, workspaceId }: MediaUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "transcribing" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const { user } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    if (!ACCEPTED_TYPES.includes(f.type)) {
      toast({ title: t("media.invalidType") || "Unsupported file type", variant: "destructive" });
      return;
    }
    if (f.size > MAX_SIZE) {
      toast({ title: t("media.tooLarge") || "File must be under 100MB", variant: "destructive" });
      return;
    }
    setFile(f);
    setStatus("idle");
    setErrorMsg("");
  }, [t]);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file || !user) throw new Error("No file or user");

      // 1. Upload to Supabase Storage
      setStatus("uploading");
      const storagePath = `${workspaceId}/${sessionId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("session-media")
        .upload(storagePath, file, { contentType: file.type });

      if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

      // 2. Create media record (using any cast for ungenerated types)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: mediaRecord, error: insertErr } = await (supabase as any)
        .from("session_media")
        .insert({
          session_id: sessionId,
          workspace_id: workspaceId,
          file_name: file.name,
          file_type: file.type.startsWith("video/") ? "video" : "audio",
          mime_type: file.type,
          file_size_bytes: file.size,
          storage_path: storagePath,
          uploaded_by: user.id,
        })
        .select("id")
        .single();

      if (insertErr) throw new Error(`Record creation failed: ${insertErr.message}`);

      // 3. Trigger transcription
      setStatus("transcribing");
      const { error: fnErr } = await supabase.functions.invoke("transcribe-media", {
        body: { media_id: mediaRecord.id },
      });

      if (fnErr) throw new Error(`Transcription failed: ${fnErr.message}`);

      setStatus("done");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-transcript", sessionId] });
      toast({ title: t("media.transcriptionComplete") || "Transcription complete!" });
      setTimeout(() => {
        setOpen(false);
        setFile(null);
        setStatus("idle");
      }, 1500);
    },
    onError: (e) => {
      setStatus("error");
      setErrorMsg(e.message);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const isProcessing = status === "uploading" || status === "transcribing";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isProcessing) setOpen(v); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-3.5 w-3.5 me-1.5" />
          {t("media.uploadMedia") || "Upload Media"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("media.uploadTitle") || "Upload Audio/Video"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {t("media.uploadDesc") || "Upload an audio or video recording. It will be automatically transcribed."}
          </p>

          {/* File picker */}
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            {file ? (
              <div className="flex items-center gap-3 justify-center">
                {file.type.startsWith("video/") ? (
                  <FileVideo className="h-8 w-8 text-primary" />
                ) : (
                  <FileAudio className="h-8 w-8 text-primary" />
                )}
                <div className="text-start">
                  <p className="text-sm font-medium truncate max-w-[200px]">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
              </div>
            ) : (
              <label className="cursor-pointer">
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {t("media.dropHint") || "Click to select audio or video file"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  MP3, WAV, M4A, MP4, WebM — max 100MB
                </p>
                <input
                  type="file"
                  className="hidden"
                  accept="audio/*,video/*"
                  onChange={handleFileChange}
                />
              </label>
            )}
          </div>

          {/* Status indicator */}
          {status === "uploading" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("media.uploading") || "Uploading file..."}
            </div>
          )}
          {status === "transcribing" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("media.transcribing") || "Transcribing with AI... This may take a few minutes."}
            </div>
          )}
          {status === "done" && (
            <div className="flex items-center gap-2 text-xs text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t("media.transcriptionComplete") || "Transcription complete!"}
            </div>
          )}
          {status === "error" && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <XCircle className="h-3.5 w-3.5" />
              {errorMsg}
            </div>
          )}

          <div className="flex justify-end gap-2">
            {file && status !== "done" && (
              <Button
                variant="ghost"
                size="sm"
                disabled={isProcessing}
                onClick={() => { setFile(null); setStatus("idle"); }}
              >
                {t("common.cancel")}
              </Button>
            )}
            <Button
              size="sm"
              disabled={!file || isProcessing || status === "done"}
              onClick={() => uploadMutation.mutate()}
            >
              {isProcessing ? (
                <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5 me-1.5" />
              )}
              {t("media.startTranscription") || "Transcribe"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
