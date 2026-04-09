export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          key_hash: string
          key_hint: string
          last_used_at: string | null
          name: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          key_hash: string
          key_hint: string
          last_used_at?: string | null
          name: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          key_hash?: string
          key_hint?: string
          last_used_at?: string | null
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      calibration_data: {
        Row: {
          accuracy_score: number | null
          created_at: string | null
          created_by: string | null
          id: string
          matched_twin_response_id: string | null
          real_response_text: string
          real_sentiment: number | null
          real_themes: string[] | null
          segment_id: string
          source_id: string | null
          source_type: string
        }
        Insert: {
          accuracy_score?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          matched_twin_response_id?: string | null
          real_response_text: string
          real_sentiment?: number | null
          real_themes?: string[] | null
          segment_id: string
          source_id?: string | null
          source_type: string
        }
        Update: {
          accuracy_score?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          matched_twin_response_id?: string | null
          real_response_text?: string
          real_sentiment?: number | null
          real_themes?: string[] | null
          segment_id?: string
          source_id?: string | null
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "calibration_data_matched_twin_response_id_fkey"
            columns: ["matched_twin_response_id"]
            isOneToOne: false
            referencedRelation: "twin_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calibration_data_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "marketplace_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calibration_data_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segment_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          body: string
          created_at: string | null
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
          mentions: string[] | null
          parent_id: string | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          mentions?: string[] | null
          parent_id?: string | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          mentions?: string[] | null
          parent_id?: string | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      insight_patterns: {
        Row: {
          created_at: string | null
          description: string | null
          evidence_quotes: Json | null
          first_seen_at: string | null
          fts: unknown
          id: string
          last_seen_at: string | null
          sentiment: string | null
          session_count: number
          synthesis_run_id: string | null
          theme_ids: string[] | null
          title: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          evidence_quotes?: Json | null
          first_seen_at?: string | null
          fts?: unknown
          id?: string
          last_seen_at?: string | null
          sentiment?: string | null
          session_count?: number
          synthesis_run_id?: string | null
          theme_ids?: string[] | null
          title: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          evidence_quotes?: Json | null
          first_seen_at?: string | null
          fts?: unknown
          id?: string
          last_seen_at?: string | null
          sentiment?: string | null
          session_count?: number
          synthesis_run_id?: string | null
          theme_ids?: string[] | null
          title?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insight_patterns_synthesis_run_id_fkey"
            columns: ["synthesis_run_id"]
            isOneToOne: false
            referencedRelation: "synthesis_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insight_patterns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          title: string
          type?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_earnings: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          description: string | null
          earning_type: string
          id: string
          paid_at: string | null
          participant_id: string
          participation_id: string | null
          status: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          description?: string | null
          earning_type?: string
          id?: string
          paid_at?: string | null
          participant_id: string
          participation_id?: string | null
          status?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          description?: string | null
          earning_type?: string
          id?: string
          paid_at?: string | null
          participant_id?: string
          participation_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_earnings_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_earnings_participation_id_fkey"
            columns: ["participation_id"]
            isOneToOne: false
            referencedRelation: "study_participations"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_profiles: {
        Row: {
          availability: Json | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string
          education: string | null
          employment_status: string | null
          ethnicity: string | null
          gender: string | null
          id: string
          income_bracket: string | null
          industry: string | null
          interests: string[] | null
          job_title: string | null
          languages: string[] | null
          onboarding_completed_at: string | null
          status: string
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          availability?: Json | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name: string
          education?: string | null
          employment_status?: string | null
          ethnicity?: string | null
          gender?: string | null
          id?: string
          income_bracket?: string | null
          industry?: string | null
          interests?: string[] | null
          job_title?: string | null
          languages?: string[] | null
          onboarding_completed_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          availability?: Json | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string
          education?: string | null
          employment_status?: string | null
          ethnicity?: string | null
          gender?: string | null
          id?: string
          income_bracket?: string | null
          industry?: string | null
          interests?: string[] | null
          job_title?: string | null
          languages?: string[] | null
          onboarding_completed_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      participant_reputation: {
        Row: {
          attention_score: number
          avg_rating: number
          badges: Json | null
          completion_rate: number
          id: string
          participant_id: string
          tier: string
          total_earned_cents: number
          total_studies: number
          twin_contributions: number
          updated_at: string
        }
        Insert: {
          attention_score?: number
          avg_rating?: number
          badges?: Json | null
          completion_rate?: number
          id?: string
          participant_id: string
          tier?: string
          total_earned_cents?: number
          total_studies?: number
          twin_contributions?: number
          updated_at?: string
        }
        Update: {
          attention_score?: number
          avg_rating?: number
          badges?: Json | null
          completion_rate?: number
          id?: string
          participant_id?: string
          tier?: string
          total_earned_cents?: number
          total_studies?: number
          twin_contributions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_reputation_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: true
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_tags: {
        Row: {
          created_at: string | null
          id: string
          participant_id: string
          tag_name: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          participant_id: string
          tag_name: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          participant_id?: string
          tag_name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_tags_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          age: number | null
          created_at: string | null
          created_by: string | null
          email: string | null
          gender: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          phone: string | null
          quality_score: number | null
          session_count: number | null
          source: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          age?: number | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          quality_score?: number | null
          session_count?: number | null
          source?: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          age?: number | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          quality_score?: number | null
          session_count?: number | null
          source?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participants_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      pattern_snapshots: {
        Row: {
          created_at: string | null
          id: string
          pattern_id: string
          project_id: string | null
          sentiment: string | null
          session_count: number
          snapshot_date: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          pattern_id: string
          project_id?: string | null
          sentiment?: string | null
          session_count: number
          snapshot_date?: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          pattern_id?: string
          project_id?: string | null
          sentiment?: string | null
          session_count?: number
          snapshot_date?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pattern_snapshots_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "insight_patterns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pattern_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pattern_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          last_visited_path: string | null
          onboarding_completed_at: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          last_visited_path?: string | null
          onboarding_completed_at?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          last_visited_path?: string | null
          onboarding_completed_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          ai_plan: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          discussion_guide: Json
          due_date: string | null
          id: string
          methodology: string
          name: string
          objective: string | null
          screener_criteria: Json
          status: string
          tags: string[]
          target_participants: number | null
          target_sessions: number | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          ai_plan?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discussion_guide?: Json
          due_date?: string | null
          id?: string
          methodology?: string
          name: string
          objective?: string | null
          screener_criteria?: Json
          status?: string
          tags?: string[]
          target_participants?: number | null
          target_sessions?: number | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          ai_plan?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discussion_guide?: Json
          due_date?: string | null
          id?: string
          methodology?: string
          name?: string
          objective?: string | null
          screener_criteria?: Json
          status?: string
          tags?: string[]
          target_participants?: number | null
          target_sessions?: number | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      segment_profiles: {
        Row: {
          avatar_url: string | null
          behavioral_data: Json | null
          calibration_score: number | null
          created_at: string | null
          created_by: string | null
          cultural_context: Json | null
          demographics: Json
          description: string | null
          downloads: number | null
          id: string
          industry: string | null
          is_preset: boolean | null
          is_published: boolean | null
          model_version: string | null
          name: string
          price_credits: number | null
          psychographics: Json | null
          training_data_refs: string[] | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          avatar_url?: string | null
          behavioral_data?: Json | null
          calibration_score?: number | null
          created_at?: string | null
          created_by?: string | null
          cultural_context?: Json | null
          demographics?: Json
          description?: string | null
          downloads?: number | null
          id?: string
          industry?: string | null
          is_preset?: boolean | null
          is_published?: boolean | null
          model_version?: string | null
          name: string
          price_credits?: number | null
          psychographics?: Json | null
          training_data_refs?: string[] | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          avatar_url?: string | null
          behavioral_data?: Json | null
          calibration_score?: number | null
          created_at?: string | null
          created_by?: string | null
          cultural_context?: Json | null
          demographics?: Json
          description?: string | null
          downloads?: number | null
          id?: string
          industry?: string | null
          is_preset?: boolean | null
          is_published?: boolean | null
          model_version?: string | null
          name?: string
          price_credits?: number | null
          psychographics?: Json | null
          training_data_refs?: string[] | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "segment_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      session_media: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          file_name: string
          file_size_bytes: number
          file_type: string
          id: string
          mime_type: string
          session_id: string
          storage_path: string
          transcription_error: string | null
          transcription_status: string
          uploaded_by: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          file_name: string
          file_size_bytes: number
          file_type: string
          id?: string
          mime_type: string
          session_id: string
          storage_path: string
          transcription_error?: string | null
          transcription_status?: string
          uploaded_by?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          file_name?: string
          file_size_bytes?: number
          file_type?: string
          id?: string
          mime_type?: string
          session_id?: string
          storage_path?: string
          transcription_error?: string | null
          transcription_status?: string
          uploaded_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_media_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_media_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      session_notes: {
        Row: {
          created_at: string | null
          created_by: string | null
          fts: unknown
          id: string
          note_text: string
          note_type: string | null
          session_id: string
          timestamp_ms: number | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          fts?: unknown
          id?: string
          note_text: string
          note_type?: string | null
          session_id: string
          timestamp_ms?: number | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          fts?: unknown
          id?: string
          note_text?: string
          note_type?: string | null
          session_id?: string
          timestamp_ms?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      session_participants: {
        Row: {
          created_at: string | null
          id: string
          participant_id: string
          session_id: string
          status: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          participant_id: string
          session_id: string
          status?: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          participant_id?: string
          session_id?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_participants_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      session_probes: {
        Row: {
          created_at: string | null
          created_by: string | null
          guide_question_text: string | null
          id: string
          session_id: string
          source: string
          status: string
          suggested_text: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          guide_question_text?: string | null
          id?: string
          session_id: string
          source?: string
          status?: string
          suggested_text: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          guide_question_text?: string | null
          id?: string
          session_id?: string
          source?: string
          status?: string
          suggested_text?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_probes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_probes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      session_themes: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          evidence: Json | null
          fts: unknown
          id: string
          session_id: string
          title: string
          workspace_id: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          evidence?: Json | null
          fts?: unknown
          id?: string
          session_id: string
          title: string
          workspace_id: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          evidence?: Json | null
          fts?: unknown
          id?: string
          session_id?: string
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_themes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_themes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      session_transcripts: {
        Row: {
          created_at: string | null
          fts: unknown
          id: string
          language: string | null
          raw_text: string
          session_id: string
          source: string | null
          speaker_segments: Json | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          fts?: unknown
          id?: string
          language?: string | null
          raw_text?: string
          session_id: string
          source?: string | null
          speaker_segments?: Json | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          fts?: unknown
          id?: string
          language?: string | null
          raw_text?: string
          session_id?: string
          source?: string | null
          speaker_segments?: Json | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_transcripts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_transcripts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string | null
          created_by: string | null
          duration_minutes: number | null
          id: string
          max_participants: number | null
          meeting_url: string | null
          project_id: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          sentiment_summary: Json | null
          share_token: string | null
          share_views: number
          status: string
          summary: string | null
          title: string
          type: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          duration_minutes?: number | null
          id?: string
          max_participants?: number | null
          meeting_url?: string | null
          project_id?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          sentiment_summary?: Json | null
          share_token?: string | null
          share_views?: number
          status?: string
          summary?: string | null
          title: string
          type?: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          duration_minutes?: number | null
          id?: string
          max_participants?: number | null
          meeting_url?: string | null
          project_id?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          sentiment_summary?: Json | null
          share_token?: string | null
          share_views?: number
          status?: string
          summary?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      simulations: {
        Row: {
          confidence_score: number | null
          config: Json | null
          created_at: string | null
          created_by: string | null
          duration_ms: number | null
          id: string
          results: Json | null
          segment_ids: string[]
          status: string
          stimulus: Json
          title: string
          tokens_used: number | null
          type: string
          workspace_id: string
        }
        Insert: {
          confidence_score?: number | null
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          duration_ms?: number | null
          id?: string
          results?: Json | null
          segment_ids?: string[]
          status?: string
          stimulus?: Json
          title: string
          tokens_used?: number | null
          type?: string
          workspace_id: string
        }
        Update: {
          confidence_score?: number | null
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          duration_ms?: number | null
          id?: string
          results?: Json | null
          segment_ids?: string[]
          status?: string
          stimulus?: Json
          title?: string
          tokens_used?: number | null
          type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      study_listings: {
        Row: {
          closes_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          current_participants: number
          description: string | null
          estimated_minutes: number
          id: string
          linked_session_id: string | null
          linked_survey_id: string | null
          max_participants: number
          requirements: Json | null
          reward_amount_cents: number
          screener_questions: Json | null
          status: string
          study_type: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          current_participants?: number
          description?: string | null
          estimated_minutes?: number
          id?: string
          linked_session_id?: string | null
          linked_survey_id?: string | null
          max_participants?: number
          requirements?: Json | null
          reward_amount_cents?: number
          screener_questions?: Json | null
          status?: string
          study_type?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          current_participants?: number
          description?: string | null
          estimated_minutes?: number
          id?: string
          linked_session_id?: string | null
          linked_survey_id?: string | null
          max_participants?: number
          requirements?: Json | null
          reward_amount_cents?: number
          screener_questions?: Json | null
          status?: string
          study_type?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_listings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      study_participations: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          participant_id: string
          researcher_notes: string | null
          researcher_rating: number | null
          started_at: string | null
          status: string
          study_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          participant_id: string
          researcher_notes?: string | null
          researcher_rating?: number | null
          started_at?: string | null
          status?: string
          study_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          participant_id?: string
          researcher_notes?: string | null
          researcher_rating?: number | null
          started_at?: string | null
          status?: string
          study_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_participations_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participant_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_participations_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "study_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_questions: {
        Row: {
          created_at: string | null
          id: string
          logic: Json | null
          options: Json | null
          question_text: string
          question_type: string
          required: boolean
          sort_order: number
          survey_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          logic?: Json | null
          options?: Json | null
          question_text: string
          question_type?: string
          required?: boolean
          sort_order?: number
          survey_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          logic?: Json | null
          options?: Json | null
          question_text?: string
          question_type?: string
          required?: boolean
          sort_order?: number
          survey_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_questions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          answers: Json
          completed_at: string | null
          created_at: string | null
          id: string
          participant_id: string | null
          survey_id: string
          workspace_id: string
        }
        Insert: {
          answers?: Json
          completed_at?: string | null
          created_at?: string | null
          id?: string
          participant_id?: string | null
          survey_id: string
          workspace_id: string
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          created_at?: string | null
          id?: string
          participant_id?: string | null
          survey_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          launched_at: string | null
          paused_at: string | null
          project_id: string | null
          response_count: number
          status: string
          target_responses: number
          title: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          launched_at?: string | null
          paused_at?: string | null
          project_id?: string | null
          response_count?: number
          status?: string
          target_responses?: number
          title: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          launched_at?: string | null
          paused_at?: string | null
          project_id?: string | null
          response_count?: number
          status?: string
          target_responses?: number
          title?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "surveys_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      synthesis_runs: {
        Row: {
          created_at: string
          id: string
          patterns_count: number
          project_id: string | null
          sessions_analyzed: number
          themes_processed: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          patterns_count?: number
          project_id?: string | null
          sessions_analyzed?: number
          themes_processed?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          patterns_count?: number
          project_id?: string | null
          sessions_analyzed?: number
          themes_processed?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "synthesis_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "synthesis_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      twin_responses: {
        Row: {
          behavioral_tags: string[] | null
          confidence: number | null
          created_at: string | null
          id: string
          persona_snapshot: Json | null
          response_text: string
          segment_id: string
          sentiment: number | null
          simulation_id: string
          stimulus_variant: string | null
          twin_index: number
        }
        Insert: {
          behavioral_tags?: string[] | null
          confidence?: number | null
          created_at?: string | null
          id?: string
          persona_snapshot?: Json | null
          response_text: string
          segment_id: string
          sentiment?: number | null
          simulation_id: string
          stimulus_variant?: string | null
          twin_index?: number
        }
        Update: {
          behavioral_tags?: string[] | null
          confidence?: number | null
          created_at?: string | null
          id?: string
          persona_snapshot?: Json | null
          response_text?: string
          segment_id?: string
          sentiment?: number | null
          simulation_id?: string
          stimulus_variant?: string | null
          twin_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "twin_responses_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "marketplace_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twin_responses_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segment_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twin_responses_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          attempted_at: string | null
          event_type: string
          id: string
          payload: Json | null
          response_body: string | null
          response_status: number | null
          success: boolean | null
          webhook_id: string
        }
        Insert: {
          attempted_at?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          success?: boolean | null
          webhook_id: string
        }
        Update: {
          attempted_at?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          success?: boolean | null
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          created_at: string | null
          created_by: string | null
          events: string[]
          id: string
          secret_hash: string
          status: string
          updated_at: string | null
          url: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          events?: string[]
          id?: string
          secret_hash: string
          status?: string
          updated_at?: string | null
          url: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          events?: string[]
          id?: string
          secret_hash?: string
          status?: string
          updated_at?: string | null
          url?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_activity: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          user_id: string
          workspace_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_activity_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_api_keys: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          rate_limit: number
          requests_count: number
          scopes: string[]
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          rate_limit?: number
          requests_count?: number
          scopes?: string[]
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          rate_limit?: number
          requests_count?: number
          scopes?: string[]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_api_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_branding: {
        Row: {
          accent_color: string
          brand_name: string
          custom_domain: string | null
          font_family: string | null
          footer_text: string | null
          hide_insightforge_branding: boolean | null
          id: string
          logo_url: string | null
          primary_color: string
          updated_at: string | null
          updated_by: string | null
          workspace_id: string
        }
        Insert: {
          accent_color?: string
          brand_name?: string
          custom_domain?: string | null
          font_family?: string | null
          footer_text?: string | null
          hide_insightforge_branding?: boolean | null
          id?: string
          logo_url?: string | null
          primary_color?: string
          updated_at?: string | null
          updated_by?: string | null
          workspace_id: string
        }
        Update: {
          accent_color?: string
          brand_name?: string
          custom_domain?: string | null
          font_family?: string | null
          footer_text?: string | null
          hide_insightforge_branding?: boolean | null
          id?: string
          logo_url?: string | null
          primary_color?: string
          updated_at?: string | null
          updated_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_branding_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_integrations: {
        Row: {
          config: Json | null
          connected_at: string | null
          connected_by: string | null
          created_at: string | null
          id: string
          integration_type: string
          last_sync_at: string | null
          status: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          config?: Json | null
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string | null
          id?: string
          integration_type: string
          last_sync_at?: string | null
          status?: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          config?: Json | null
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string | null
          id?: string
          integration_type?: string
          last_sync_at?: string | null
          status?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_memberships: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_memberships_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_memberships_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_token_usage: {
        Row: {
          created_at: string
          id: string
          last_request_at: string | null
          period_start: string
          request_count: number
          tokens_used: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_request_at?: string | null
          period_start: string
          request_count?: number
          tokens_used?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_request_at?: string | null
          period_start?: string
          request_count?: number
          tokens_used?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_token_usage_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_token_usage_log: {
        Row: {
          created_at: string
          id: string
          tokens_used: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tokens_used?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tokens_used?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_token_usage_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          brand_accent_color: string | null
          brand_primary_color: string | null
          created_at: string | null
          created_by: string | null
          data_residency: string | null
          data_retention_days: number | null
          default_locale: string | null
          default_timezone: string | null
          deployment_type: string | null
          gdpr_enabled: boolean | null
          id: string
          logo_url: string | null
          name: string
          pdpl_enabled: boolean | null
          slug: string
          status: string | null
          stripe_customer_id: string | null
          subscription_status: string | null
          tier: string
          updated_at: string | null
        }
        Insert: {
          brand_accent_color?: string | null
          brand_primary_color?: string | null
          created_at?: string | null
          created_by?: string | null
          data_residency?: string | null
          data_retention_days?: number | null
          default_locale?: string | null
          default_timezone?: string | null
          deployment_type?: string | null
          gdpr_enabled?: boolean | null
          id?: string
          logo_url?: string | null
          name: string
          pdpl_enabled?: boolean | null
          slug: string
          status?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          tier?: string
          updated_at?: string | null
        }
        Update: {
          brand_accent_color?: string | null
          brand_primary_color?: string | null
          created_at?: string | null
          created_by?: string | null
          data_residency?: string | null
          data_retention_days?: number | null
          default_locale?: string | null
          default_timezone?: string | null
          deployment_type?: string | null
          gdpr_enabled?: boolean | null
          id?: string
          logo_url?: string | null
          name?: string
          pdpl_enabled?: boolean | null
          slug?: string
          status?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          tier?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      marketplace_segments: {
        Row: {
          age_range: string | null
          avatar_url: string | null
          calibration_score: number | null
          created_at: string | null
          creator_name: string | null
          creator_workspace_id: string | null
          description: string | null
          downloads: number | null
          id: string | null
          industry: string | null
          location: string | null
          name: string | null
          price_credits: number | null
        }
        Relationships: [
          {
            foreignKeyName: "segment_profiles_workspace_id_fkey"
            columns: ["creator_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_shared_snapshot: { Args: { token: string }; Returns: Json }
      global_search: {
        Args: {
          entity_types?: string[]
          result_limit?: number
          result_offset?: number
          search_query: string
          ws_id: string
        }
        Returns: {
          created_at: string
          entity_id: string
          entity_type: string
          relevance: number
          snippet: string
          title: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_workspace_role: {
        Args: {
          r: Database["public"]["Enums"]["app_role"]
          uid: string
          ws_id: string
        }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { uid: string; ws_id: string }
        Returns: boolean
      }
      search_transcripts: {
        Args: { search_query: string; ws_id: string }
        Returns: {
          created_at: string
          language: string
          session_id: string
          session_title: string
          snippet: string
          transcript_id: string
        }[]
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "researcher" | "observer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "researcher", "observer"],
    },
  },
} as const
