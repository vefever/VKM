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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_advisor_threads: {
        Row: {
          created_at: string
          id: string
          prompt: string
          response: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          prompt: string
          response?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          prompt?: string
          response?: string | null
          user_id?: string
        }
        Relationships: []
      }
      batch_members: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_members_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          capacity: number | null
          created_at: string
          end_date: string | null
          id: string
          name: string
          program_id: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          program_id?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          program_id?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batches_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      business_brains: {
        Row: {
          ai_prompt: string | null
          avg_deal_inr: number | null
          business_model: string | null
          business_name: string | null
          closing_rate_pct: number | null
          created_at: string
          current_mrr_inr: number | null
          founded_year: number | null
          industry: string | null
          lead_sources: string | null
          legal_structure: string | null
          location: string | null
          logo_url: string | null
          main_competitors: string | null
          monthly_leads: number | null
          num_customers: number | null
          pricing_model: string | null
          social_handle: string | null
          success_definition: string | null
          target_customer: string | null
          target_mrr_inr: number | null
          team_size: number | null
          top_challenges: string | null
          top_products: string | null
          updated_at: string
          user_id: string
          usp: string | null
          website: string | null
          years_running: number | null
        }
        Insert: {
          ai_prompt?: string | null
          avg_deal_inr?: number | null
          business_model?: string | null
          business_name?: string | null
          closing_rate_pct?: number | null
          created_at?: string
          current_mrr_inr?: number | null
          founded_year?: number | null
          industry?: string | null
          lead_sources?: string | null
          legal_structure?: string | null
          location?: string | null
          logo_url?: string | null
          main_competitors?: string | null
          monthly_leads?: number | null
          num_customers?: number | null
          pricing_model?: string | null
          social_handle?: string | null
          success_definition?: string | null
          target_customer?: string | null
          target_mrr_inr?: number | null
          team_size?: number | null
          top_challenges?: string | null
          top_products?: string | null
          updated_at?: string
          user_id: string
          usp?: string | null
          website?: string | null
          years_running?: number | null
        }
        Update: {
          ai_prompt?: string | null
          avg_deal_inr?: number | null
          business_model?: string | null
          business_name?: string | null
          closing_rate_pct?: number | null
          created_at?: string
          current_mrr_inr?: number | null
          founded_year?: number | null
          industry?: string | null
          lead_sources?: string | null
          legal_structure?: string | null
          location?: string | null
          logo_url?: string | null
          main_competitors?: string | null
          monthly_leads?: number | null
          num_customers?: number | null
          pricing_model?: string | null
          social_handle?: string | null
          success_definition?: string | null
          target_customer?: string | null
          target_mrr_inr?: number | null
          team_size?: number | null
          top_challenges?: string | null
          top_products?: string | null
          updated_at?: string
          user_id?: string
          usp?: string | null
          website?: string | null
          years_running?: number | null
        }
        Relationships: []
      }
      business_snapshots: {
        Row: {
          avg_deal_inr: number | null
          closing_rate_pct: number | null
          coach_note: string | null
          created_at: string
          deals: number | null
          followup_pct: number | null
          id: string
          leads: number | null
          month: string
          mrr_inr: number | null
          note: string | null
          nps: number | null
          pipeline_inr: number | null
          reflection_blocker: string | null
          reflection_win: string | null
          revenue_inr: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_deal_inr?: number | null
          closing_rate_pct?: number | null
          coach_note?: string | null
          created_at?: string
          deals?: number | null
          followup_pct?: number | null
          id?: string
          leads?: number | null
          month: string
          mrr_inr?: number | null
          note?: string | null
          nps?: number | null
          pipeline_inr?: number | null
          reflection_blocker?: string | null
          reflection_win?: string | null
          revenue_inr?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_deal_inr?: number | null
          closing_rate_pct?: number | null
          coach_note?: string | null
          created_at?: string
          deals?: number | null
          followup_pct?: number | null
          id?: string
          leads?: number | null
          month?: string
          mrr_inr?: number | null
          note?: string | null
          nps?: number | null
          pipeline_inr?: number | null
          reflection_blocker?: string | null
          reflection_win?: string | null
          revenue_inr?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_read_state: {
        Row: {
          last_read_at: string
          thread_id: string
          thread_kind: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          thread_id: string
          thread_kind: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          thread_id?: string
          thread_kind?: string
          user_id?: string
        }
        Relationships: []
      }
      coach_activity: {
        Row: {
          activity_date: string
          coach_id: string
          hits: number
          last_seen_at: string
        }
        Insert: {
          activity_date?: string
          coach_id: string
          hits?: number
          last_seen_at?: string
        }
        Update: {
          activity_date?: string
          coach_id?: string
          hits?: number
          last_seen_at?: string
        }
        Relationships: []
      }
      coach_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          coach_id: string
          participant_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          coach_id: string
          participant_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          coach_id?: string
          participant_id?: string
        }
        Relationships: []
      }
      coach_tasks: {
        Row: {
          coach_id: string
          created_at: string
          done: boolean
          due_on: string | null
          id: string
          participant_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          done?: boolean
          due_on?: string | null
          id?: string
          participant_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          done?: boolean
          due_on?: string | null
          id?: string
          participant_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      coach_visits: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          notes: string | null
          participant_id: string
          visited_at: string | null
          week_no: number
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          notes?: string | null
          participant_id: string
          visited_at?: string | null
          week_no: number
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          participant_id?: string
          visited_at?: string | null
          week_no?: number
        }
        Relationships: []
      }
      coaching_notes: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          next_step: string | null
          occurred_at: string
          participant_id: string
          summary: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          next_step?: string | null
          occurred_at?: string
          participant_id: string
          summary: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          next_step?: string | null
          occurred_at?: string
          participant_id?: string
          summary?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          participant_id: string
          title: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          participant_id: string
          title?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          participant_id?: string
          title?: string | null
        }
        Relationships: []
      }
      daily_actions: {
        Row: {
          action_date: string
          created_at: string
          done: boolean
          id: string
          sort_order: number
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_date?: string
          created_at?: string
          done?: boolean
          id?: string
          sort_order?: number
          text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_date?: string
          created_at?: string
          done?: boolean
          id?: string
          sort_order?: number
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_steps: {
        Row: {
          day_no: number | null
          goal: number
          log_date: string
          steps: number
          updated_at: string
          user_id: string
        }
        Insert: {
          day_no?: number | null
          goal?: number
          log_date: string
          steps?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          day_no?: number | null
          goal?: number
          log_date?: string
          steps?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_water: {
        Row: {
          day_no: number | null
          goal_ml: number
          log_date: string
          ml: number
          updated_at: string
          user_id: string
        }
        Insert: {
          day_no?: number | null
          goal_ml?: number
          log_date: string
          ml?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          day_no?: number | null
          goal_ml?: number
          log_date?: string
          ml?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dm_messages: {
        Row: {
          attachments: Json
          body: string | null
          created_at: string
          id: string
          sender_id: string
          thread_id: string
        }
        Insert: {
          attachments?: Json
          body?: string | null
          created_at?: string
          id?: string
          sender_id: string
          thread_id: string
        }
        Update: {
          attachments?: Json
          body?: string | null
          created_at?: string
          id?: string
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "dm_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_threads: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          user_hi: string
          user_lo: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          user_hi: string
          user_lo: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          user_hi?: string
          user_lo?: string
        }
        Relationships: []
      }
      email_log: {
        Row: {
          created_at: string
          detail: string | null
          id: number
          kind: string
          provider: string | null
          status: string
          subject: string | null
          to_email: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: never
          kind: string
          provider?: string | null
          status: string
          subject?: string | null
          to_email: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: never
          kind?: string
          provider?: string | null
          status?: string
          subject?: string | null
          to_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      focus_sessions: {
        Row: {
          created_at: string
          id: string
          minutes: number
          note: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          minutes: number
          note?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          minutes?: number
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      habit_logs: {
        Row: {
          coach_id: string | null
          coach_note: string | null
          created_at: string
          day_no: number
          habit_id: string
          id: string
          log_date: string
          points: number
          proof_files: Json
          proof_status: string
          reviewed_at: string | null
          user_id: string
        }
        Insert: {
          coach_id?: string | null
          coach_note?: string | null
          created_at?: string
          day_no: number
          habit_id: string
          id?: string
          log_date: string
          points?: number
          proof_files?: Json
          proof_status?: string
          reviewed_at?: string | null
          user_id: string
        }
        Update: {
          coach_id?: string | null
          coach_note?: string | null
          created_at?: string
          day_no?: number
          habit_id?: string
          id?: string
          log_date?: string
          points?: number
          proof_files?: Json
          proof_status?: string
          reviewed_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      meeting_attendees: {
        Row: {
          created_at: string
          meeting_id: string
          role: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          meeting_id: string
          role?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          meeting_id?: string
          role?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendees_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          batch_id: string | null
          created_at: string
          duration_min: number
          host_id: string
          id: string
          join_url: string | null
          location: string | null
          meeting_type: string
          notes: string | null
          participant_id: string | null
          password: string | null
          start_time: string
          start_url: string | null
          status: string
          topic: string
          zoom_meeting_id: string | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          duration_min?: number
          host_id: string
          id?: string
          join_url?: string | null
          location?: string | null
          meeting_type?: string
          notes?: string | null
          participant_id?: string | null
          password?: string | null
          start_time: string
          start_url?: string | null
          status?: string
          topic: string
          zoom_meeting_id?: string | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          duration_min?: number
          host_id?: string
          id?: string
          join_url?: string | null
          location?: string | null
          meeting_type?: string
          notes?: string | null
          participant_id?: string | null
          password?: string | null
          start_time?: string
          start_url?: string | null
          status?: string
          topic?: string
          zoom_meeting_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      member_profiles: {
        Row: {
          allow_messages: boolean
          batch_label: string | null
          bio: string | null
          business_name: string | null
          headline: string | null
          industry: string | null
          is_public: boolean
          location: string | null
          skills: string[]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_messages?: boolean
          batch_label?: string | null
          bio?: string | null
          business_name?: string | null
          headline?: string | null
          industry?: string | null
          is_public?: boolean
          location?: string | null
          skills?: string[]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_messages?: boolean
          batch_label?: string | null
          bio?: string | null
          business_name?: string | null
          headline?: string | null
          industry?: string | null
          is_public?: boolean
          location?: string | null
          skills?: string[]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          body: string
          channel: string
          created_at: string
          enabled: boolean
          id: string
          key: string
          name: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          body?: string
          channel: string
          created_at?: string
          enabled?: boolean
          id?: string
          key: string
          name: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          enabled?: boolean
          id?: string
          key?: string
          name?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachments: Json
          body: string | null
          conversation_id: string
          created_at: string
          id: string
          sender_id: string | null
        }
        Insert: {
          attachments?: Json
          body?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          sender_id?: string | null
        }
        Update: {
          attachments?: Json
          body?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_settings: {
        Row: {
          config: Json
          enabled: boolean
          id: string
          provider: string | null
          updated_at: string
        }
        Insert: {
          config?: Json
          enabled?: boolean
          id: string
          provider?: string | null
          updated_at?: string
        }
        Update: {
          config?: Json
          enabled?: boolean
          id?: string
          provider?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mfa_email_challenges: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          expires_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          expires_at: string
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          expires_at?: string
          user_id?: string
        }
        Relationships: []
      }
      milestone_awards: {
        Row: {
          awarded_at: string
          awarded_by: string | null
          handover_mode: string | null
          id: string
          milestone_code: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          awarded_by?: string | null
          handover_mode?: string | null
          id?: string
          milestone_code: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          awarded_by?: string | null
          handover_mode?: string | null
          id?: string
          milestone_code?: string
          user_id?: string
        }
        Relationships: []
      }
      milestones: {
        Row: {
          code: string
          cost_inr: number
          created_at: string
          handover: string | null
          id: string
          name: string
          program_id: string | null
          reward_items: Json
          unlock_week: number
        }
        Insert: {
          code: string
          cost_inr?: number
          created_at?: string
          handover?: string | null
          id?: string
          name: string
          program_id?: string | null
          reward_items?: Json
          unlock_week: number
        }
        Update: {
          code?: string
          cost_inr?: number
          created_at?: string
          handover?: string | null
          id?: string
          name?: string
          program_id?: string | null
          reward_items?: Json
          unlock_week?: number
        }
        Relationships: [
          {
            foreignKeyName: "milestones_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_results: {
        Row: {
          batch_id: string | null
          bonus_points: number
          closing_up: boolean
          created_at: string
          id: string
          leads_up: boolean
          month_no: number
          notes: string | null
          revenue_up: boolean
          user_id: string
        }
        Insert: {
          batch_id?: string | null
          bonus_points?: number
          closing_up?: boolean
          created_at?: string
          id?: string
          leads_up?: boolean
          month_no: number
          notes?: string | null
          revenue_up?: boolean
          user_id: string
        }
        Update: {
          batch_id?: string | null
          bonus_points?: number
          closing_up?: boolean
          created_at?: string
          id?: string
          leads_up?: boolean
          month_no?: number
          notes?: string | null
          revenue_up?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_results_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string
          due_by: string | null
          id: string
          owner: string
          step_no: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description: string
          due_by?: string | null
          id?: string
          owner: string
          step_no: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string
          due_by?: string | null
          id?: string
          owner?: string
          step_no?: number
          user_id?: string
        }
        Relationships: []
      }
      otp_requests: {
        Row: {
          bucket: string
          created_at: string
          id: number
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: never
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: never
        }
        Relationships: []
      }
      points_ledger: {
        Row: {
          awarded_at: string
          awarded_by: string | null
          id: string
          points: number
          reference: string | null
          source: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          awarded_by?: string | null
          id?: string
          points: number
          reference?: string | null
          source: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          awarded_by?: string | null
          id?: string
          points?: number
          reference?: string | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          is_alumni: boolean
          mfa_email_otp_opt_in: boolean
          mfa_totp_opt_in: boolean
          must_reset_password: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          is_alumni?: boolean
          mfa_email_otp_opt_in?: boolean
          mfa_totp_opt_in?: boolean
          must_reset_password?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_alumni?: boolean
          mfa_email_otp_opt_in?: boolean
          mfa_totp_opt_in?: boolean
          must_reset_password?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      program_enrollments: {
        Row: {
          created_at: string
          started_at: string | null
          status: string
          total_weeks: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          started_at?: string | null
          status?: string
          total_weeks?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          started_at?: string | null
          status?: string
          total_weeks?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      program_settings: {
        Row: {
          habit_days_per_week: number
          habit_points_per_tick: number
          habit_weeks: number
          id: number
          step_goal: number
          updated_at: string
        }
        Insert: {
          habit_days_per_week?: number
          habit_points_per_tick?: number
          habit_weeks?: number
          id?: number
          step_goal?: number
          updated_at?: string
        }
        Update: {
          habit_days_per_week?: number
          habit_points_per_tick?: number
          habit_weeks?: number
          id?: number
          step_goal?: number
          updated_at?: string
        }
        Relationships: []
      }
      program_week_resources: {
        Row: {
          created_at: string
          created_by: string | null
          file_name: string | null
          id: string
          kind: string
          program_id: string
          size: number | null
          sort: number
          title: string
          url: string
          week_no: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          kind?: string
          program_id: string
          size?: number | null
          sort?: number
          title: string
          url: string
          week_no: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          kind?: string
          program_id?: string
          size?: number | null
          sort?: number
          title?: string
          url?: string
          week_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_week_resources_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_weeks: {
        Row: {
          class_video_provider: string | null
          class_video_thumbnail: string | null
          class_video_title: string | null
          class_video_url: string | null
          created_at: string
          id: string
          mode: string
          phase: string
          program_id: string | null
          proof: string
          task: string
          topic: string
          week_no: number
          why: string
        }
        Insert: {
          class_video_provider?: string | null
          class_video_thumbnail?: string | null
          class_video_title?: string | null
          class_video_url?: string | null
          created_at?: string
          id?: string
          mode: string
          phase: string
          program_id?: string | null
          proof: string
          task: string
          topic: string
          week_no: number
          why: string
        }
        Update: {
          class_video_provider?: string | null
          class_video_thumbnail?: string | null
          class_video_title?: string | null
          class_video_url?: string | null
          created_at?: string
          id?: string
          mode?: string
          phase?: string
          program_id?: string | null
          proof?: string
          task?: string
          topic?: string
          week_no?: number
          why?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_weeks_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          duration_weeks: number
          id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_weeks?: number
          id?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_weeks?: number
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      pwa_settings: {
        Row: {
          app_name: string
          apple_title: string
          background_color: string
          description: string
          icon_url: string
          id: boolean
          short_name: string
          theme_color: string
          updated_at: string
        }
        Insert: {
          app_name?: string
          apple_title?: string
          background_color?: string
          description?: string
          icon_url?: string
          id?: boolean
          short_name?: string
          theme_color?: string
          updated_at?: string
        }
        Update: {
          app_name?: string
          apple_title?: string
          background_color?: string
          description?: string
          icon_url?: string
          id?: boolean
          short_name?: string
          theme_color?: string
          updated_at?: string
        }
        Relationships: []
      }
      reminder_log: {
        Row: {
          channel: string
          created_at: string
          detail: string | null
          id: number
          status: string
          target_date: string
          user_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          detail?: string | null
          id?: never
          status: string
          target_date: string
          user_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          detail?: string | null
          id?: never
          status?: string
          target_date?: string
          user_id?: string | null
        }
        Relationships: []
      }
      security_settings: {
        Row: {
          email_otp_2fa_enabled: boolean
          id: boolean
          totp_enabled: boolean
          updated_at: string
        }
        Insert: {
          email_otp_2fa_enabled?: boolean
          id?: boolean
          totp_enabled?: boolean
          updated_at?: string
        }
        Update: {
          email_otp_2fa_enabled?: boolean
          id?: boolean
          totp_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      seo_settings: {
        Row: {
          canonical_url: string
          ga_enabled: boolean
          ga_measurement_id: string
          id: boolean
          keywords: string
          meta_description: string
          og_description: string
          og_image_url: string
          og_title: string
          robots_index: boolean
          site_title: string
          twitter_handle: string
          updated_at: string
        }
        Insert: {
          canonical_url?: string
          ga_enabled?: boolean
          ga_measurement_id?: string
          id?: boolean
          keywords?: string
          meta_description?: string
          og_description?: string
          og_image_url?: string
          og_title?: string
          robots_index?: boolean
          site_title?: string
          twitter_handle?: string
          updated_at?: string
        }
        Update: {
          canonical_url?: string
          ga_enabled?: boolean
          ga_measurement_id?: string
          id?: boolean
          keywords?: string
          meta_description?: string
          og_description?: string
          og_image_url?: string
          og_title?: string
          robots_index?: boolean
          site_title?: string
          twitter_handle?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_ticket_messages: {
        Row: {
          attachments: Json
          body: string | null
          created_at: string
          id: string
          sender_id: string
          ticket_id: string
        }
        Insert: {
          attachments?: Json
          body?: string | null
          created_at?: string
          id?: string
          sender_id: string
          ticket_id: string
        }
        Update: {
          attachments?: Json
          body?: string | null
          created_at?: string
          id?: string
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          id: string
          last_message_at: string
          priority: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          id?: string
          last_message_at?: string
          priority?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          id?: string
          last_message_at?: string
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          department: string | null
          email: string | null
          id: string
          joined_on: string | null
          monthly_salary_inr: number | null
          name: string
          notes: string | null
          phone: string | null
          role: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email?: string | null
          id?: string
          joined_on?: string | null
          monthly_salary_inr?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string | null
          id?: string
          joined_on?: string | null
          monthly_salary_inr?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          batch: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          name: string
          phone: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          temp_password: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          batch?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          name: string
          phone?: string | null
          revoked_at?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          temp_password: string
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          batch?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          name?: string
          phone?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          temp_password?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vision_goals: {
        Row: {
          category: string
          created_at: string
          current_value: number | null
          id: string
          sort_order: number
          status: string
          target_date: string | null
          target_value: number | null
          title: string
          unit: string | null
          updated_at: string
          user_id: string
          why: string | null
          year: number
        }
        Insert: {
          category?: string
          created_at?: string
          current_value?: number | null
          id?: string
          sort_order?: number
          status?: string
          target_date?: string | null
          target_value?: number | null
          title: string
          unit?: string | null
          updated_at?: string
          user_id: string
          why?: string | null
          year: number
        }
        Update: {
          category?: string
          created_at?: string
          current_value?: number | null
          id?: string
          sort_order?: number
          status?: string
          target_date?: string | null
          target_value?: number | null
          title?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
          why?: string | null
          year?: number
        }
        Relationships: []
      }
      vision_statements: {
        Row: {
          images: Json
          lifestyle_goal: string | null
          primary_goal: string | null
          statement: string | null
          statement_1yr: string | null
          target_revenue_inr: number | null
          target_team_size: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          images?: Json
          lifestyle_goal?: string | null
          primary_goal?: string | null
          statement?: string | null
          statement_1yr?: string | null
          target_revenue_inr?: number | null
          target_team_size?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          images?: Json
          lifestyle_goal?: string | null
          primary_goal?: string | null
          statement?: string | null
          statement_1yr?: string | null
          target_revenue_inr?: number | null
          target_team_size?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      water_events: {
        Row: {
          created_at: string
          day_no: number | null
          id: string
          log_date: string
          ml: number
          rapid: boolean
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          day_no?: number | null
          id?: string
          log_date: string
          ml: number
          rapid?: boolean
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          day_no?: number | null
          id?: string
          log_date?: string
          ml?: number
          rapid?: boolean
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      weekly_progress: {
        Row: {
          attended: boolean
          batch_id: string | null
          coach_id: string | null
          coach_note: string | null
          created_at: string
          id: string
          points: number
          proof_files: Json
          proof_note: string | null
          proof_status: string
          proof_url: string | null
          reviewed_at: string | null
          task_done: boolean
          updated_at: string
          user_id: string
          week_no: number
        }
        Insert: {
          attended?: boolean
          batch_id?: string | null
          coach_id?: string | null
          coach_note?: string | null
          created_at?: string
          id?: string
          points?: number
          proof_files?: Json
          proof_note?: string | null
          proof_status?: string
          proof_url?: string | null
          reviewed_at?: string | null
          task_done?: boolean
          updated_at?: string
          user_id: string
          week_no: number
        }
        Update: {
          attended?: boolean
          batch_id?: string | null
          coach_id?: string | null
          coach_note?: string | null
          created_at?: string
          id?: string
          points?: number
          proof_files?: Json
          proof_note?: string | null
          proof_status?: string
          proof_url?: string | null
          reviewed_at?: string | null
          task_done?: boolean
          updated_at?: string
          user_id?: string
          week_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_progress_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_logs: {
        Row: {
          created_at: string
          day_no: number | null
          id: string
          kind: string
          log_date: string
          minutes: number
          user_id: string
        }
        Insert: {
          created_at?: string
          day_no?: number | null
          id?: string
          kind?: string
          log_date: string
          minutes?: number
          user_id: string
        }
        Update: {
          created_at?: string
          day_no?: number | null
          id?: string
          kind?: string
          log_date?: string
          minutes?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _upsert_bonus: {
        Args: {
          _by: string
          _flag: boolean
          _pts: number
          _ref: string
          _source: string
          _uid: string
        }
        Returns: undefined
      }
      accept_invite_by_token: { Args: { _token: string }; Returns: Json }
      admin_analytics_batches: {
        Args: never
        Returns: {
          at_risk_count: number
          avg_completion_pct: number
          avg_week: number
          batch_id: string
          name: string
          participant_count: number
          status: string
        }[]
      }
      admin_analytics_coaches: {
        Args: never
        Returns: {
          at_risk_count: number
          avatar_url: string
          avg_completion_pct: number
          coach_id: string
          full_name: string
          last_active_at: string
          participant_count: number
          points_awarded_30d: number
        }[]
      }
      admin_analytics_mentors: {
        Args: never
        Returns: {
          avatar_url: string
          full_name: string
          last_active_at: string
          mentor_id: string
          proofs_reviewed_30d: number
          tickets_handled_30d: number
        }[]
      }
      admin_analytics_overview: { Args: never; Returns: Json }
      admin_batch_file_counts: {
        Args: { _batch_id: string }
        Returns: {
          avatar_url: string
          full_name: string
          habit_file_count: number
          total_file_count: number
          user_id: string
          vision_file_count: number
          weekly_file_count: number
        }[]
      }
      admin_bulk_add_coach: {
        Args: { _coach_id: string; _emails: string[] }
        Returns: number
      }
      admin_bulk_remove_coach: {
        Args: { _coach_id: string; _emails: string[] }
        Returns: number
      }
      admin_coach_map: {
        Args: never
        Returns: {
          coach_email: string
          coach_id: string
          coach_name: string
          participant_email: string
        }[]
      }
      admin_delete_program_week: {
        Args: { _program_id: string; _week_no: number }
        Returns: number
      }
      admin_generate_mfa_email_code: {
        Args: { _user_id: string }
        Returns: string
      }
      admin_list_coaches: {
        Args: never
        Returns: {
          email: string
          full_name: string
          id: string
          participant_count: number
        }[]
      }
      admin_live_participants: {
        Args: { _batch_id?: string }
        Returns: {
          actions_done: number
          actions_total: number
          at_risk: boolean
          avatar_url: string
          batch_id: string
          batch_name: string
          batch_status: string
          business_name: string
          current_week: number
          enroll_status: string
          focus_minutes_today: number
          full_name: string
          habit_active_3d: boolean
          habits_done_today: number
          is_online_15m: boolean
          last_active_at: string
          last_proof_at: string
          mrr_inr: number
          open_tickets: number
          pending_proofs: number
          points: number
          started_at: string
          total_weeks: number
          user_id: string
          water_pct_today: number
          weeks_approved: number
        }[]
      }
      admin_participant_files: { Args: { _user_id: string }; Returns: Json }
      admin_people_search: {
        Args: { _limit?: number; _q?: string }
        Returns: {
          avatar_url: string
          full_name: string
          roles: string[]
          user_id: string
        }[]
      }
      admin_report_batch: {
        Args: { _batch_id: string; _from: string; _to: string }
        Returns: Json
      }
      admin_report_coach: {
        Args: { _coach_id: string; _from: string; _to: string }
        Returns: Json
      }
      admin_report_individual: {
        Args: { _from: string; _to: string; _user_id: string }
        Returns: Json
      }
      admin_report_mentor: {
        Args: { _from: string; _mentor_id: string; _to: string }
        Returns: Json
      }
      admin_resolve_user_id: { Args: { _email: string }; Returns: string }
      admin_set_alumni: {
        Args: { _user_id: string; _value: boolean }
        Returns: undefined
      }
      admin_user_detail: { Args: { _email: string }; Returns: Json }
      automation_cron_status: {
        Args: never
        Returns: {
          active: boolean
          schedule: string
          scheduled: boolean
        }[]
      }
      clone_program: {
        Args: { _new_title: string; _source: string; _status?: string }
        Returns: string
      }
      coach_batch_breakdown: {
        Args: never
        Returns: {
          approval_rate: number
          at_risk_count: number
          avg_progress_pct: number
          batch_id: string
          batch_name: string
          coach_id: string
          coach_name: string
          participants: number
          reviews_total: number
        }[]
      }
      coach_cohort_overview: {
        Args: never
        Returns: {
          actions_done: number
          actions_total: number
          avatar_url: string
          batch_id: string
          batch_name: string
          business_name: string
          focus_minutes_today: number
          full_name: string
          habit_active_3d: boolean
          last_proof_at: string
          mrr_inr: number
          pending_proofs: number
          points: number
          started_at: string
          total_weeks: number
          user_id: string
          weeks_approved: number
        }[]
      }
      coach_daily_activity: {
        Args: { _coach_id: string; _days?: number }
        Returns: {
          day: string
          logins: number
          meetings: number
          messages: number
          notes: number
          reviews: number
        }[]
      }
      coach_performance_report: {
        Args: never
        Returns: {
          active_days_30: number
          approval_rate: number
          at_risk_count: number
          avg_progress_pct: number
          avg_turnaround_h: number
          caseload_active_3d_pct: number
          chat_messages: number
          coach_avatar: string
          coach_id: string
          coach_name: string
          contacted_7d: number
          last_login_at: string
          last_message_at: string
          last_note_at: string
          last_review_at: string
          login_days_30: number
          meetings_count: number
          notes_count: number
          notifs_sent: number
          participant_count: number
          reviews_30d: number
          reviews_7d: number
          reviews_approved: number
          reviews_rejected: number
          reviews_total: number
          visits_count: number
        }[]
      }
      coach_ping: { Args: never; Returns: undefined }
      coaches_participant: { Args: { _participant: string }; Returns: boolean }
      current_stage: { Args: { uid: string }; Returns: string }
      get_community_business: {
        Args: never
        Returns: {
          business_name: string
          industry: string
          location: string
          logo_url: string
          user_id: string
          usp: string
          website: string
        }[]
      }
      get_community_contact: {
        Args: never
        Returns: {
          email: string
          phone: string
          user_id: string
        }[]
      }
      get_invite_public: {
        Args: { _token: string }
        Returns: {
          batch: string
          email: string
          expires_at: string
          is_expired: boolean
          is_revoked: boolean
          is_usable: boolean
          name: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
        }[]
      }
      get_leaderboard: {
        Args: never
        Returns: {
          avatar_url: string
          batch_id: string
          batch_name: string
          business_name: string
          full_name: string
          points: number
          user_id: string
          weeks_approved: number
        }[]
      }
      get_leaderboard_activity: {
        Args: { _limit?: number }
        Returns: {
          avatar_url: string
          awarded_at: string
          batch_id: string
          full_name: string
          id: string
          points: number
          reference: string
          source: string
          user_id: string
        }[]
      }
      get_profiles_display: {
        Args: { _ids: string[] }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_chat_thread_participant: {
        Args: { _kind: string; _thread_id: string }
        Returns: boolean
      }
      is_meeting_attendee: { Args: { _meeting: string }; Returns: boolean }
      is_meeting_host: { Args: { _meeting: string }; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      is_support_staff: { Args: never; Returns: boolean }
      my_participants: {
        Args: never
        Returns: {
          user_id: string
        }[]
      }
      notify_participant: {
        Args: {
          _body: string
          _link?: string
          _title: string
          _user_id: string
        }
        Returns: undefined
      }
      notify_participants: {
        Args: { _body: string; _link: string; _title: string; _type: string }
        Returns: number
      }
      otp_login_enabled: { Args: never; Returns: boolean }
      owns_support_ticket: { Args: { _ticket: string }; Returns: boolean }
      participant_coach_interactions: {
        Args: never
        Returns: {
          batch_id: string
          batch_name: string
          coaching_notes: number
          last_meeting_at: string
          last_note_at: string
          last_review_at: string
          meetings_count: number
          participant_avatar: string
          participant_id: string
          participant_name: string
          primary_coach_id: string
          primary_coach_name: string
          reviews_received: number
          started_at: string
          total_points: number
          total_weeks: number
          weeks_approved: number
          weeks_pending: number
        }[]
      }
      points_total: { Args: { uid: string }; Returns: number }
      reminder_targets: {
        Args: { _target: string }
        Returns: {
          done: number
          email: string
          full_name: string
          phone: string
          user_id: string
        }[]
      }
      review_habit_proof: {
        Args: { _log_id: string; _note: string; _status: string }
        Returns: undefined
      }
      set_reminder_schedule: {
        Args: { _hour: number; _minute: number }
        Returns: {
          active: boolean
          schedule: string
          scheduled: boolean
        }[]
      }
      support_link_for: { Args: { _uid: string }; Returns: string }
      verify_mfa_email_otp: { Args: { _code: string }; Returns: boolean }
    }
    Enums: {
      app_role: "participant" | "coach" | "mentor" | "super_admin"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["participant", "coach", "mentor", "super_admin"],
    },
  },
} as const
