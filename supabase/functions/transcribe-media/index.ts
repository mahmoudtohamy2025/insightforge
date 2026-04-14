import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";
import { requireWorkspaceMember } from "../_shared/validation.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { media_id } = await req.json();
    if (!media_id) {
      return new Response(JSON.stringify({ error: "media_id is required" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Fetch media record
    const { data: media, error: mediaErr } = await supabase
      .from("session_media")
      .select("*")
      .eq("id", media_id)
      .single();

    if (mediaErr || !media) {
      return new Response(JSON.stringify({ error: "Media not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Mark as processing
    await supabase
      .from("session_media")
      .update({ transcription_status: "processing" })
      .eq("id", media_id);

    // Download file from storage
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from("session-media")
      .download(media.storage_path);

    if (downloadErr || !fileData) {
      await supabase
        .from("session_media")
        .update({
          transcription_status: "failed",
          transcription_error: "Failed to download file from storage",
        })
        .eq("id", media_id);

      return new Response(
        JSON.stringify({ error: "Failed to download media file" }),
        {
          status: 500,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        },
      );
    }

    // Transcribe using Deepgram (or OpenAI Whisper as fallback)
    const deepgramKey = Deno.env.get("DEEPGRAM_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    let transcriptText = "";
    let detectedLanguage = "en";

    if (deepgramKey) {
      // Deepgram transcription
      const dgResponse = await fetch(
        "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&diarize=true&paragraphs=true&detect_language=true",
        {
          method: "POST",
          headers: {
            Authorization: `Token ${deepgramKey}`,
            "Content-Type": media.mime_type,
          },
          body: fileData,
        },
      );

      if (!dgResponse.ok) {
        throw new Error(`Deepgram error: ${dgResponse.status} ${await dgResponse.text()}`);
      }

      const dgResult = await dgResponse.json();
      transcriptText =
        dgResult.results?.channels?.[0]?.alternatives?.[0]?.paragraphs?.transcript ||
        dgResult.results?.channels?.[0]?.alternatives?.[0]?.transcript ||
        "";
      
      // Detect language from Deepgram response
      detectedLanguage =
        dgResult.results?.channels?.[0]?.detected_language ||
        dgResult.results?.channels?.[0]?.alternatives?.[0]?.languages?.[0] ||
        "en";
    } else if (openaiKey) {
      // Fallback: OpenAI Whisper
      const formData = new FormData();
      formData.append("file", fileData, media.file_name);
      formData.append("model", "whisper-1");
      formData.append("response_format", "text");

      const whisperResponse = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${openaiKey}` },
          body: formData,
        },
      );

      if (!whisperResponse.ok) {
        throw new Error(`Whisper error: ${whisperResponse.status} ${await whisperResponse.text()}`);
      }

      transcriptText = await whisperResponse.text();
    } else {
      throw new Error("No transcription API key configured. Set DEEPGRAM_API_KEY or OPENAI_API_KEY.");
    }

    if (!transcriptText.trim()) {
      throw new Error("Transcription returned empty text");
    }

    // Save transcript to session_transcripts
    const { error: insertErr } = await supabase
      .from("session_transcripts")
      .insert({
        session_id: media.session_id,
        workspace_id: media.workspace_id,
        raw_text: transcriptText,
        source: "auto_transcription",
        language: detectedLanguage,
      });

    if (insertErr) {
      throw new Error(`Failed to save transcript: ${insertErr.message}`);
    }

    // Mark as completed
    await supabase
      .from("session_media")
      .update({ transcription_status: "completed" })
      .eq("id", media_id);

    return new Response(
      JSON.stringify({
        success: true,
        transcript_length: transcriptText.length,
      }),
      {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      },
    );
  } catch (err: unknown) {
    // Mark as failed if media_id is available
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    try {
      const { media_id } = await req.clone().json();
      if (media_id) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        await supabase
          .from("session_media")
          .update({
            transcription_status: "failed",
            transcription_error: errorMessage,
          })
          .eq("id", media_id);
      }
    } catch {
      // Ignore cleanup errors
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
