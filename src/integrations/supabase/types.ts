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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_proposals: {
        Row: {
          activity_title: string
          category: string | null
          created_at: string
          description: string
          id: string
          location: string
          max_participants: number | null
          proposer_id: string | null
          proposer_name: string
          status: string
          suggested_date: string | null
          suggested_time: string | null
          updated_at: string
        }
        Insert: {
          activity_title: string
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          location?: string
          max_participants?: number | null
          proposer_id?: string | null
          proposer_name?: string
          status?: string
          suggested_date?: string | null
          suggested_time?: string | null
          updated_at?: string
        }
        Update: {
          activity_title?: string
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          location?: string
          max_participants?: number | null
          proposer_id?: string | null
          proposer_name?: string
          status?: string
          suggested_date?: string | null
          suggested_time?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      admin_action_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          user_id: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      badges: {
        Row: {
          category: string | null
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          required_events: number
          requirement_type: string | null
          requirement_value: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name: string
          required_events?: number
          requirement_type?: string | null
          requirement_value?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          required_events?: number
          requirement_type?: string | null
          requirement_value?: number
        }
        Relationships: []
      }
      community_levels: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          level_number: number
          min_points: number
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          level_number: number
          min_points?: number
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          level_number?: number
          min_points?: number
          name?: string
        }
        Relationships: []
      }
      content_pages: {
        Row: {
          content_html: string
          created_at: string
          id: string
          is_published: boolean
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          content_html?: string
          created_at?: string
          id?: string
          is_published?: boolean
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          content_html?: string
          created_at?: string
          id?: string
          is_published?: boolean
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      discount_code_usage: {
        Row: {
          created_at: string
          discount_code_id: string
          discounted_price: number
          event_id: string
          id: string
          original_price: number
          user_id: string
        }
        Insert: {
          created_at?: string
          discount_code_id: string
          discounted_price: number
          event_id: string
          id?: string
          original_price: number
          user_id: string
        }
        Update: {
          created_at?: string
          discount_code_id?: string
          discounted_price?: number
          event_id?: string
          id?: string
          original_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_code_usage_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_code_usage_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          applies_to_all: boolean
          assigned_user_id: string | null
          code: string
          created_at: string
          created_by: string | null
          description: string
          discount_type: string
          discount_value: number
          event_ids: string[] | null
          expires_at: string | null
          id: string
          is_active: boolean
          is_single_use: boolean
          max_uses: number | null
          starts_at: string | null
          times_used: number
          updated_at: string
        }
        Insert: {
          applies_to_all?: boolean
          assigned_user_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          description?: string
          discount_type: string
          discount_value: number
          event_ids?: string[] | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_single_use?: boolean
          max_uses?: number | null
          starts_at?: string | null
          times_used?: number
          updated_at?: string
        }
        Update: {
          applies_to_all?: boolean
          assigned_user_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string
          discount_type?: string
          discount_value?: number
          event_ids?: string[] | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_single_use?: boolean
          max_uses?: number | null
          starts_at?: string | null
          times_used?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string | null
          email_type: string
          id: string
          provider_response: string | null
          recipient_email: string
          retry_count: number | null
          sent_at: string | null
          status: string | null
          template_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_type: string
          id?: string
          provider_response?: string | null
          recipient_email: string
          retry_count?: number | null
          sent_at?: string | null
          status?: string | null
          template_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_type?: string
          id?: string
          provider_response?: string | null
          recipient_email?: string
          retry_count?: number | null
          sent_at?: string | null
          status?: string | null
          template_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_send_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string
          created_at: string | null
          cta_label: string | null
          cta_url: string | null
          id: string
          is_active: boolean | null
          name: string
          preview_text: string | null
          reply_to: string | null
          sender_name: string | null
          subject: string
          template_key: string
          updated_at: string | null
        }
        Insert: {
          body_html?: string
          created_at?: string | null
          cta_label?: string | null
          cta_url?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          preview_text?: string | null
          reply_to?: string | null
          sender_name?: string | null
          subject?: string
          template_key: string
          updated_at?: string | null
        }
        Update: {
          body_html?: string
          created_at?: string | null
          cta_label?: string | null
          cta_url?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          preview_text?: string | null
          reply_to?: string | null
          sender_name?: string | null
          subject?: string
          template_key?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      equipment_template_items: {
        Row: {
          id: string
          is_mandatory: boolean
          name: string
          notes: string | null
          sort_order: number
          template_id: string
        }
        Insert: {
          id?: string
          is_mandatory?: boolean
          name: string
          notes?: string | null
          sort_order?: number
          template_id: string
        }
        Update: {
          id?: string
          is_mandatory?: boolean
          name?: string
          notes?: string | null
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "equipment_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_templates: {
        Row: {
          category_id: string | null
          created_at: string
          description: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "event_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      event_broadcasts: {
        Row: {
          channel: string
          created_at: string
          event_id: string
          id: string
          message: string
          recipients_count: number
          sender_id: string | null
        }
        Insert: {
          channel?: string
          created_at?: string
          event_id: string
          id?: string
          message: string
          recipients_count?: number
          sender_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          event_id?: string
          id?: string
          message?: string
          recipients_count?: number
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_broadcasts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_categories: {
        Row: {
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      event_meeting_points: {
        Row: {
          event_id: string
          id: string
          location: string
          name: string
          notes: string | null
          sort_order: number
          time: string
        }
        Insert: {
          event_id: string
          id?: string
          location: string
          name: string
          notes?: string | null
          sort_order?: number
          time: string
        }
        Update: {
          event_id?: string
          id?: string
          location?: string
          name?: string
          notes?: string | null
          sort_order?: number
          time?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_meeting_points_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_price_options: {
        Row: {
          created_at: string
          eligible_group: string
          event_id: string
          id: string
          is_promotional: boolean
          name: string
          original_price: number | null
          price: number
          promo_end: string | null
          promo_start: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          eligible_group?: string
          event_id: string
          id?: string
          is_promotional?: boolean
          name: string
          original_price?: number | null
          price?: number
          promo_end?: string | null
          promo_start?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          eligible_group?: string
          event_id?: string
          id?: string
          is_promotional?: boolean
          name?: string
          original_price?: number | null
          price?: number
          promo_end?: string | null
          promo_start?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_price_options_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          checked_in: boolean
          created_at: string
          event_id: string
          id: string
          meeting_point_id: string | null
          payment_status: string | null
          price_option_id: string | null
          sport_level: string | null
          status: Database["public"]["Enums"]["registration_status"]
          stripe_payment_intent_id: string | null
          user_id: string
        }
        Insert: {
          checked_in?: boolean
          created_at?: string
          event_id: string
          id?: string
          meeting_point_id?: string | null
          payment_status?: string | null
          price_option_id?: string | null
          sport_level?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          stripe_payment_intent_id?: string | null
          user_id: string
        }
        Update: {
          checked_in?: boolean
          created_at?: string
          event_id?: string
          id?: string
          meeting_point_id?: string | null
          payment_status?: string | null
          price_option_id?: string | null
          sport_level?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          stripe_payment_intent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_meeting_point_id_fkey"
            columns: ["meeting_point_id"]
            isOneToOne: false
            referencedRelation: "event_meeting_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_price_option_id_fkey"
            columns: ["price_option_id"]
            isOneToOne: false
            referencedRelation: "event_price_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          access_rules: Json | null
          additional_fields: Json | null
          cancellation_policy: string | null
          category_id: string | null
          created_at: string
          date: string
          deposit: number | null
          description: string
          difficulty: string | null
          distance: string | null
          duration: string | null
          elevation: string | null
          equipment_list: Json | null
          event_badges: Json | null
          featured: boolean
          gallery_images: Json | null
          id: string
          image_url: string | null
          location: string
          location_label: string | null
          organizer_id: string | null
          organizer_name: string
          payment_type: Database["public"]["Enums"]["payment_type"]
          price: number
          reserved_spots: number
          spots_taken: number
          spots_total: number
          status: Database["public"]["Enums"]["event_status"]
          time: string
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["event_visibility"]
        }
        Insert: {
          access_rules?: Json | null
          additional_fields?: Json | null
          cancellation_policy?: string | null
          category_id?: string | null
          created_at?: string
          date: string
          deposit?: number | null
          description?: string
          difficulty?: string | null
          distance?: string | null
          duration?: string | null
          elevation?: string | null
          equipment_list?: Json | null
          event_badges?: Json | null
          featured?: boolean
          gallery_images?: Json | null
          id?: string
          image_url?: string | null
          location: string
          location_label?: string | null
          organizer_id?: string | null
          organizer_name?: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          price?: number
          reserved_spots?: number
          spots_taken?: number
          spots_total?: number
          status?: Database["public"]["Enums"]["event_status"]
          time: string
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["event_visibility"]
        }
        Update: {
          access_rules?: Json | null
          additional_fields?: Json | null
          cancellation_policy?: string | null
          category_id?: string | null
          created_at?: string
          date?: string
          deposit?: number | null
          description?: string
          difficulty?: string | null
          distance?: string | null
          duration?: string | null
          elevation?: string | null
          equipment_list?: Json | null
          event_badges?: Json | null
          featured?: boolean
          gallery_images?: Json | null
          id?: string
          image_url?: string | null
          location?: string
          location_label?: string | null
          organizer_id?: string | null
          organizer_name?: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          price?: number
          reserved_spots?: number
          spots_taken?: number
          spots_total?: number
          status?: Database["public"]["Enums"]["event_status"]
          time?: string
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["event_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "event_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          created_at: string
          description: string
          event_id: string | null
          id: string
          priority: string
          reporter_id: string | null
          reporter_name: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          event_id?: string | null
          id?: string
          priority?: string
          reporter_id?: string | null
          reporter_name?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          event_id?: string | null
          id?: string
          priority?: string
          reporter_id?: string | null
          reporter_name?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      merch_products: {
        Row: {
          badge: string | null
          badge_it: string | null
          created_at: string
          description: string
          description_it: string | null
          gallery_images: Json | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          name_it: string | null
          price: number
          sort_order: number
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          badge?: string | null
          badge_it?: string | null
          created_at?: string
          description?: string
          description_it?: string | null
          gallery_images?: Json | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          name_it?: string | null
          price?: number
          sort_order?: number
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          badge?: string | null
          badge_it?: string | null
          created_at?: string
          description?: string
          description_it?: string | null
          gallery_images?: Json | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          name_it?: string | null
          price?: number
          sort_order?: number
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      missions: {
        Row: {
          auto_generate_coupon: boolean
          category: string | null
          category_filter: string[] | null
          created_at: string
          description: string
          expires_at: string | null
          icon: string
          id: string
          is_active: boolean
          max_completions_per_user: number | null
          notify_on_progress: boolean
          reset_on_failure: boolean
          reward_badge_id: string | null
          reward_points: number
          reward_type: string
          reward_value: string | null
          starts_at: string | null
          streak_count: number | null
          target_action: string
          target_value: number
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          auto_generate_coupon?: boolean
          category?: string | null
          category_filter?: string[] | null
          created_at?: string
          description?: string
          expires_at?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          max_completions_per_user?: number | null
          notify_on_progress?: boolean
          reset_on_failure?: boolean
          reward_badge_id?: string | null
          reward_points?: number
          reward_type?: string
          reward_value?: string | null
          starts_at?: string | null
          streak_count?: number | null
          target_action?: string
          target_value?: number
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          auto_generate_coupon?: boolean
          category?: string | null
          category_filter?: string[] | null
          created_at?: string
          description?: string
          expires_at?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          max_completions_per_user?: number | null
          notify_on_progress?: boolean
          reset_on_failure?: boolean
          reward_badge_id?: string | null
          reward_points?: number
          reward_type?: string
          reward_value?: string | null
          starts_at?: string | null
          streak_count?: number | null
          target_action?: string
          target_value?: number
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "missions_reward_badge_id_fkey"
            columns: ["reward_badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          event_id: string | null
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          id?: string
          message?: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      onesignal_players: {
        Row: {
          created_at: string
          device_type: string | null
          id: string
          player_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_type?: string | null
          id?: string
          player_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_type?: string | null
          id?: string
          player_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      phone_otps: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          expires_at: string
          id: string
          max_attempts: number
          otp_hash: string
          phone_number: string
          user_id: string
          verified: boolean
        }
        Insert: {
          attempts?: number
          channel?: string
          created_at?: string
          expires_at: string
          id?: string
          max_attempts?: number
          otp_hash: string
          phone_number: string
          user_id: string
          verified?: boolean
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          expires_at?: string
          id?: string
          max_attempts?: number
          otp_hash?: string
          phone_number?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          description: string
          id: string
          key: string
          label: string
          updated_at: string
          value: string
        }
        Insert: {
          description?: string
          id?: string
          key: string
          label?: string
          updated_at?: string
          value?: string
        }
        Update: {
          description?: string
          id?: string
          key?: string
          label?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      points_config: {
        Row: {
          action_type: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          points: number
          updated_at: string
        }
        Insert: {
          action_type: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          points?: number
          updated_at?: string
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          points?: number
          updated_at?: string
        }
        Relationships: []
      }
      points_history: {
        Row: {
          admin_id: string | null
          created_at: string
          description: string
          id: string
          reference_id: string | null
          type: string
          user_id: string
          value: number
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          description?: string
          id?: string
          reference_id?: string | null
          type: string
          user_id: string
          value: number
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          description?: string
          id?: string
          reference_id?: string | null
          type?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"] | null
          activity_frequency: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          event_motivation: string | null
          experience_grade: number | null
          first_name: string
          has_car: string | null
          id: string
          interests: string[] | null
          is_founding_member: boolean
          last_name: string
          membership_id: number | null
          membership_registration_date: string | null
          membership_status: string | null
          membership_year: number | null
          onboarding_completed: boolean | null
          phone: string
          phone_verification_method: string | null
          phone_verified: boolean | null
          phone_verified_at: string | null
          preferences: Json | null
          self_level: string | null
          total_points: number
          trekking_experience: string | null
          updated_at: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"] | null
          activity_frequency?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          event_motivation?: string | null
          experience_grade?: number | null
          first_name?: string
          has_car?: string | null
          id: string
          interests?: string[] | null
          is_founding_member?: boolean
          last_name?: string
          membership_id?: number | null
          membership_registration_date?: string | null
          membership_status?: string | null
          membership_year?: number | null
          onboarding_completed?: boolean | null
          phone?: string
          phone_verification_method?: string | null
          phone_verified?: boolean | null
          phone_verified_at?: string | null
          preferences?: Json | null
          self_level?: string | null
          total_points?: number
          trekking_experience?: string | null
          updated_at?: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"] | null
          activity_frequency?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          event_motivation?: string | null
          experience_grade?: number | null
          first_name?: string
          has_car?: string | null
          id?: string
          interests?: string[] | null
          is_founding_member?: boolean
          last_name?: string
          membership_id?: number | null
          membership_registration_date?: string | null
          membership_status?: string | null
          membership_year?: number | null
          onboarding_completed?: boolean | null
          phone?: string
          phone_verification_method?: string | null
          phone_verified?: boolean | null
          phone_verified_at?: string | null
          preferences?: Json | null
          self_level?: string | null
          total_points?: number
          trekking_experience?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_events: {
        Row: {
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      trekking_difficulty_levels: {
        Row: {
          color_background: string
          color_border: string
          color_icon: string
          color_primary: string
          created_at: string
          icon: string
          id: string
          label: string
          level_number: number
          updated_at: string
        }
        Insert: {
          color_background?: string
          color_border?: string
          color_icon?: string
          color_primary?: string
          created_at?: string
          icon?: string
          id?: string
          label: string
          level_number: number
          updated_at?: string
        }
        Update: {
          color_background?: string
          color_border?: string
          color_icon?: string
          color_primary?: string
          created_at?: string
          icon?: string
          id?: string
          label?: string
          level_number?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          completed: boolean
          completed_at: string | null
          earned_at: string
          id: string
          progress: number
          user_id: string
        }
        Insert: {
          badge_id: string
          completed?: boolean
          completed_at?: string | null
          earned_at?: string
          id?: string
          progress?: number
          user_id: string
        }
        Update: {
          badge_id?: string
          completed?: boolean
          completed_at?: string | null
          earned_at?: string
          id?: string
          progress?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_missions: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          mission_id: string
          progress: number
          reward_details: Json | null
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          mission_id: string
          progress?: number
          reward_details?: Json | null
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          mission_id?: string
          progress?: number
          reward_details?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_missions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_rewards: {
        Row: {
          created_at: string
          expiry_date: string | null
          id: string
          mission_id: string | null
          redeemed_at: string | null
          status: string
          title: string
          type: string
          user_id: string
          value: string | null
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          mission_id?: string | null
          redeemed_at?: string | null
          status?: string
          title?: string
          type?: string
          user_id: string
          value?: string | null
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          mission_id?: string | null
          redeemed_at?: string | null
          status?: string
          title?: string
          type?: string
          user_id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_rewards_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
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
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_membership: {
        Args: { user_id_param: string }
        Returns: undefined
      }
      add_user_points: {
        Args: {
          p_admin_id?: string
          p_description?: string
          p_reference_id?: string
          p_type: string
          p_user_id: string
          p_value: number
        }
        Returns: undefined
      }
      get_event_participant_avatars: {
        Args: { p_event_id: string }
        Returns: {
          avatar_url: string
          first_name: string
          user_id: string
        }[]
      }
      get_public_profile: {
        Args: { profile_id: string }
        Returns: {
          avatar_url: string
          first_name: string
          id: string
          last_name_initial: string
        }[]
      }
      get_public_profiles: {
        Args: { profile_ids: string[] }
        Returns: {
          avatar_url: string
          first_name: string
          id: string
          last_name_initial: string
        }[]
      }
      get_user_community_level: {
        Args: { p_points: number }
        Returns: {
          color: string
          icon: string
          level_number: number
          min_points: number
          name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      validate_discount_code: {
        Args: { p_code: string; p_event_id: string; p_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      account_status: "Active" | "Suspended" | "Banned"
      app_role: "admin" | "organizer" | "user"
      event_status:
        | "available"
        | "full"
        | "closed"
        | "draft"
        | "published"
        | "cancelled"
        | "past"
      event_visibility: "public" | "private" | "hidden"
      payment_type: "free" | "paid" | "deposit" | "location"
      registration_status:
        | "registered"
        | "paid"
        | "waitlist"
        | "cancelled"
        | "pending_approval"
        | "attended"
        | "no_show"
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
      account_status: ["Active", "Suspended", "Banned"],
      app_role: ["admin", "organizer", "user"],
      event_status: [
        "available",
        "full",
        "closed",
        "draft",
        "published",
        "cancelled",
        "past",
      ],
      event_visibility: ["public", "private", "hidden"],
      payment_type: ["free", "paid", "deposit", "location"],
      registration_status: [
        "registered",
        "paid",
        "waitlist",
        "cancelled",
        "pending_approval",
        "attended",
        "no_show",
      ],
    },
  },
} as const
