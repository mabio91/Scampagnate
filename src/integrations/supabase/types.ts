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
  public: {
    Tables: {
      activity_proposals: {
        Row: {
          activity_title: string
          category: string | null
          category_id: string | null
          created_at: string
          description: string
          id: string
          location: string
          location_label: string | null
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
          category_id?: string | null
          created_at?: string
          description?: string
          id?: string
          location?: string
          location_label?: string | null
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
          category_id?: string | null
          created_at?: string
          description?: string
          id?: string
          location?: string
          location_label?: string | null
          max_participants?: number | null
          proposer_id?: string | null
          proposer_name?: string
          status?: string
          suggested_date?: string | null
          suggested_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_proposals_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "event_categories"
            referencedColumns: ["id"]
          },
        ]
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
      admin_organizer_activity_log: {
        Row: {
          action_type: string
          actor_app_role: string
          actor_id: string
          changed_columns: string[]
          created_at: string
          event_id: string | null
          id: string
          metadata: Json
          new_row: Json | null
          occurred_at: string
          old_row: Json | null
          operation: string
          payment_status_after: string | null
          payment_status_before: string | null
          registration_id: string | null
          source_record_id: string | null
          source_schema: string
          source_table: string
          status_after: string | null
          status_before: string | null
          target_user_id: string | null
        }
        Insert: {
          action_type: string
          actor_app_role: string
          actor_id: string
          changed_columns?: string[]
          created_at?: string
          event_id?: string | null
          id?: string
          metadata?: Json
          new_row?: Json | null
          occurred_at?: string
          old_row?: Json | null
          operation: string
          payment_status_after?: string | null
          payment_status_before?: string | null
          registration_id?: string | null
          source_record_id?: string | null
          source_schema?: string
          source_table: string
          status_after?: string | null
          status_before?: string | null
          target_user_id?: string | null
        }
        Update: {
          action_type?: string
          actor_app_role?: string
          actor_id?: string
          changed_columns?: string[]
          created_at?: string
          event_id?: string | null
          id?: string
          metadata?: Json
          new_row?: Json | null
          occurred_at?: string
          old_row?: Json | null
          operation?: string
          payment_status_after?: string | null
          payment_status_before?: string | null
          registration_id?: string | null
          source_record_id?: string | null
          source_schema?: string
          source_table?: string
          status_after?: string | null
          status_before?: string | null
          target_user_id?: string | null
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
      broadcast_message_templates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          sort_order?: number
          title?: string
          updated_at?: string
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
          waives_service_fee: boolean
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
          waives_service_fee?: boolean
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
          waives_service_fee?: boolean
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
          type: string | null
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
          type?: string | null
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
          type?: string | null
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
      event_closing_sentences: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          sentence: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          sentence: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          sentence?: string
          sort_order?: number
          updated_at?: string
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
      event_opening_reminders: {
        Row: {
          cancelled_at: string | null
          created_at: string
          event_id: string
          id: string
          notified_at: string | null
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          notified_at?: string | null
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          notified_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_opening_reminders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_price_options: {
        Row: {
          balance_amount: number | null
          balance_payment_mode:
            | Database["public"]["Enums"]["balance_payment_mode"]
            | null
          created_at: string
          dedicated_spots: number | null
          deposit_amount: number | null
          eligible_group: string
          event_id: string
          has_dedicated_spots: boolean
          id: string
          is_promotional: boolean
          name: string
          original_price: number | null
          payment_type: Database["public"]["Enums"]["payment_type"]
          price: number
          promo_end: string | null
          promo_start: string | null
          sort_order: number
          spots_taken: number
          waitlist_enabled: boolean
        }
        Insert: {
          balance_amount?: number | null
          balance_payment_mode?:
            | Database["public"]["Enums"]["balance_payment_mode"]
            | null
          created_at?: string
          dedicated_spots?: number | null
          deposit_amount?: number | null
          eligible_group?: string
          event_id: string
          has_dedicated_spots?: boolean
          id?: string
          is_promotional?: boolean
          name: string
          original_price?: number | null
          payment_type?: Database["public"]["Enums"]["payment_type"]
          price?: number
          promo_end?: string | null
          promo_start?: string | null
          sort_order?: number
          spots_taken?: number
          waitlist_enabled?: boolean
        }
        Update: {
          balance_amount?: number | null
          balance_payment_mode?:
            | Database["public"]["Enums"]["balance_payment_mode"]
            | null
          created_at?: string
          dedicated_spots?: number | null
          deposit_amount?: number | null
          eligible_group?: string
          event_id?: string
          has_dedicated_spots?: boolean
          id?: string
          is_promotional?: boolean
          name?: string
          original_price?: number | null
          payment_type?: Database["public"]["Enums"]["payment_type"]
          price?: number
          promo_end?: string | null
          promo_start?: string | null
          sort_order?: number
          spots_taken?: number
          waitlist_enabled?: boolean
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
          added_by: string | null
          additional_responses: Json | null
          amount_paid: number | null
          balance_due_amount: number | null
          balance_payment_mode:
            | Database["public"]["Enums"]["balance_payment_mode"]
            | null
          cancellation_policy: string | null
          cancelled_at: string | null
          car_availability: string | null
          checked_in: boolean
          created_at: string
          deposit_amount: number | null
          event_id: string
          id: string
          last_balance_reminder_sent_at: string | null
          meeting_point_id: string | null
          payment_status: string | null
          price_option_id: string | null
          refund_amount: number | null
          refund_percentage: number | null
          refund_status: string | null
          service_fee_amount: number
          sport_level: string | null
          status: Database["public"]["Enums"]["registration_status"]
          stripe_payment_intent_id: string | null
          total_price_amount: number | null
          user_id: string | null
        }
        Insert: {
          added_by?: string | null
          additional_responses?: Json | null
          amount_paid?: number | null
          balance_due_amount?: number | null
          balance_payment_mode?:
            | Database["public"]["Enums"]["balance_payment_mode"]
            | null
          cancellation_policy?: string | null
          cancelled_at?: string | null
          car_availability?: string | null
          checked_in?: boolean
          created_at?: string
          deposit_amount?: number | null
          event_id: string
          id?: string
          last_balance_reminder_sent_at?: string | null
          meeting_point_id?: string | null
          payment_status?: string | null
          price_option_id?: string | null
          refund_amount?: number | null
          refund_percentage?: number | null
          refund_status?: string | null
          service_fee_amount?: number
          sport_level?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          stripe_payment_intent_id?: string | null
          total_price_amount?: number | null
          user_id?: string | null
        }
        Update: {
          added_by?: string | null
          additional_responses?: Json | null
          amount_paid?: number | null
          balance_due_amount?: number | null
          balance_payment_mode?:
            | Database["public"]["Enums"]["balance_payment_mode"]
            | null
          cancellation_policy?: string | null
          cancelled_at?: string | null
          car_availability?: string | null
          checked_in?: boolean
          created_at?: string
          deposit_amount?: number | null
          event_id?: string
          id?: string
          last_balance_reminder_sent_at?: string | null
          meeting_point_id?: string | null
          payment_status?: string | null
          price_option_id?: string | null
          refund_amount?: number | null
          refund_percentage?: number | null
          refund_status?: string | null
          service_fee_amount?: number
          sport_level?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          stripe_payment_intent_id?: string | null
          total_price_amount?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
      event_special_badges: {
        Row: {
          badge_id: string
          created_at: string
          event_id: string
          id: string
        }
        Insert: {
          badge_id: string
          created_at?: string
          event_id: string
          id?: string
        }
        Update: {
          badge_id?: string
          created_at?: string
          event_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_special_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_special_badges_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_staff: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          event_id: string
          id: string
          is_public: boolean
          profile_id: string | null
          role_label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          event_id: string
          id?: string
          is_public?: boolean
          profile_id?: string | null
          role_label?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          event_id?: string
          id?: string
          is_public?: boolean
          profile_id?: string | null
          role_label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_staff_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_staff_profile_id_fkey"
            columns: ["profile_id"]
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
          balance_payment_mode:
            | Database["public"]["Enums"]["balance_payment_mode"]
            | null
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
          balance_payment_mode?:
            | Database["public"]["Enums"]["balance_payment_mode"]
            | null
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
          balance_payment_mode?:
            | Database["public"]["Enums"]["balance_payment_mode"]
            | null
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
      ios_device_tokens: {
        Row: {
          app_version: string | null
          bundle_id: string
          created_at: string
          device_model: string | null
          device_token: string
          enabled: boolean
          environment: string
          id: string
          installation_id: string
          last_registered_at: string
          last_seen_at: string
          locale: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          bundle_id?: string
          created_at?: string
          device_model?: string | null
          device_token: string
          enabled?: boolean
          environment?: string
          id?: string
          installation_id: string
          last_registered_at?: string
          last_seen_at?: string
          locale?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          bundle_id?: string
          created_at?: string
          device_model?: string | null
          device_token?: string
          enabled?: boolean
          environment?: string
          id?: string
          installation_id?: string
          last_registered_at?: string
          last_seen_at?: string
          locale?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ios_push_broadcasts: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          environment: string
          error_message: string | null
          expired_count: number
          failed_count: number
          id: string
          message: string
          sent_count: number
          status: string
          target_count: number
          title: string
          unique_user_count: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          environment?: string
          error_message?: string | null
          expired_count?: number
          failed_count?: number
          id?: string
          message: string
          sent_count?: number
          status?: string
          target_count?: number
          title: string
          unique_user_count?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          environment?: string
          error_message?: string | null
          expired_count?: number
          failed_count?: number
          id?: string
          message?: string
          sent_count?: number
          status?: string
          target_count?: number
          title?: string
          unique_user_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      issues: {
        Row: {
          created_at: string
          description: string
          event_id: string | null
          id: string
          media_attachments: Json
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
          media_attachments?: Json
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
          media_attachments?: Json
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
      mission_campaigns: {
        Row: {
          banner_url: string | null
          color: string | null
          created_at: string
          description: string
          ends_at: string | null
          icon: string
          id: string
          is_active: boolean
          name: string
          reward_multiplier: number
          slug: string
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          color?: string | null
          created_at?: string
          description?: string
          ends_at?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          reward_multiplier?: number
          slug: string
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          color?: string | null
          created_at?: string
          description?: string
          ends_at?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          reward_multiplier?: number
          slug?: string
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mission_conditions: {
        Row: {
          allow_repeat_same_event: boolean
          behavior_filters: Json
          created_at: string
          event_filters: Json
          failure_condition: Json
          goal_metric: string
          goal_operator: string
          goal_value: number
          id: string
          metadata: Json
          mission_id: string
          period_unit: string | null
          period_value: number | null
          push_notifications: boolean
          reset_policy: string
          sort_order: number
          target_action: string
          title: string
          unique_by: string
          updated_at: string
          user_filters: Json
        }
        Insert: {
          allow_repeat_same_event?: boolean
          behavior_filters?: Json
          created_at?: string
          event_filters?: Json
          failure_condition?: Json
          goal_metric?: string
          goal_operator?: string
          goal_value?: number
          id?: string
          metadata?: Json
          mission_id: string
          period_unit?: string | null
          period_value?: number | null
          push_notifications?: boolean
          reset_policy?: string
          sort_order?: number
          target_action?: string
          title?: string
          unique_by?: string
          updated_at?: string
          user_filters?: Json
        }
        Update: {
          allow_repeat_same_event?: boolean
          behavior_filters?: Json
          created_at?: string
          event_filters?: Json
          failure_condition?: Json
          goal_metric?: string
          goal_operator?: string
          goal_value?: number
          id?: string
          metadata?: Json
          mission_id?: string
          period_unit?: string | null
          period_value?: number | null
          push_notifications?: boolean
          reset_policy?: string
          sort_order?: number
          target_action?: string
          title?: string
          unique_by?: string
          updated_at?: string
          user_filters?: Json
        }
        Relationships: [
          {
            foreignKeyName: "mission_conditions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_prerequisites: {
        Row: {
          auto_archive_previous: boolean
          created_at: string
          id: string
          mission_id: string
          prerequisite_mission_id: string
          requirement_type: string
          sort_order: number
        }
        Insert: {
          auto_archive_previous?: boolean
          created_at?: string
          id?: string
          mission_id: string
          prerequisite_mission_id: string
          requirement_type?: string
          sort_order?: number
        }
        Update: {
          auto_archive_previous?: boolean
          created_at?: string
          id?: string
          mission_id?: string
          prerequisite_mission_id?: string
          requirement_type?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "mission_prerequisites_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_prerequisites_prerequisite_mission_id_fkey"
            columns: ["prerequisite_mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_rewards: {
        Row: {
          approval_required: boolean
          badge_config: Json
          badge_id: string | null
          coupon_config: Json
          created_at: string
          id: string
          metadata: Json
          mission_id: string
          physical_config: Json
          points_value: number | null
          reward_kind: string
          sort_order: number
          source_discount_code_id: string | null
          title: string
          updated_at: string
          visible_on_profile: boolean
        }
        Insert: {
          approval_required?: boolean
          badge_config?: Json
          badge_id?: string | null
          coupon_config?: Json
          created_at?: string
          id?: string
          metadata?: Json
          mission_id: string
          physical_config?: Json
          points_value?: number | null
          reward_kind?: string
          sort_order?: number
          source_discount_code_id?: string | null
          title?: string
          updated_at?: string
          visible_on_profile?: boolean
        }
        Update: {
          approval_required?: boolean
          badge_config?: Json
          badge_id?: string | null
          coupon_config?: Json
          created_at?: string
          id?: string
          metadata?: Json
          mission_id?: string
          physical_config?: Json
          points_value?: number | null
          reward_kind?: string
          sort_order?: number
          source_discount_code_id?: string | null
          title?: string
          updated_at?: string
          visible_on_profile?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "mission_rewards_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_rewards_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_rewards_source_discount_code_id_fkey"
            columns: ["source_discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          auto_generate_coupon: boolean
          banner_url: string | null
          campaign_id: string | null
          campaign_tag: string | null
          category: string | null
          category_filter: string[] | null
          conditions_logic: string
          created_at: string
          definition_version: number
          description: string
          ends_at: string | null
          expires_at: string | null
          featured: boolean
          icon: string
          icon_background: string | null
          icon_color: string | null
          id: string
          internal_name: string | null
          is_active: boolean
          is_archived: boolean
          legacy_config: Json
          level: number | null
          max_completions_per_user: number | null
          mission_group: string | null
          notify_on_progress: boolean
          prerequisite_summary: Json
          priority: number
          repeatable: boolean
          reset_on_failure: boolean
          reward_badge_id: string | null
          reward_points: number
          reward_type: string
          reward_value: string | null
          sort_order: number
          starts_at: string | null
          status: string
          streak_count: number | null
          target_action: string
          target_value: number
          timezone: string
          title: string
          type: string
          updated_at: string
          visibility: string
        }
        Insert: {
          auto_generate_coupon?: boolean
          banner_url?: string | null
          campaign_id?: string | null
          campaign_tag?: string | null
          category?: string | null
          category_filter?: string[] | null
          conditions_logic?: string
          created_at?: string
          definition_version?: number
          description?: string
          ends_at?: string | null
          expires_at?: string | null
          featured?: boolean
          icon?: string
          icon_background?: string | null
          icon_color?: string | null
          id?: string
          internal_name?: string | null
          is_active?: boolean
          is_archived?: boolean
          legacy_config?: Json
          level?: number | null
          max_completions_per_user?: number | null
          mission_group?: string | null
          notify_on_progress?: boolean
          prerequisite_summary?: Json
          priority?: number
          repeatable?: boolean
          reset_on_failure?: boolean
          reward_badge_id?: string | null
          reward_points?: number
          reward_type?: string
          reward_value?: string | null
          sort_order?: number
          starts_at?: string | null
          status?: string
          streak_count?: number | null
          target_action?: string
          target_value?: number
          timezone?: string
          title: string
          type?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          auto_generate_coupon?: boolean
          banner_url?: string | null
          campaign_id?: string | null
          campaign_tag?: string | null
          category?: string | null
          category_filter?: string[] | null
          conditions_logic?: string
          created_at?: string
          definition_version?: number
          description?: string
          ends_at?: string | null
          expires_at?: string | null
          featured?: boolean
          icon?: string
          icon_background?: string | null
          icon_color?: string | null
          id?: string
          internal_name?: string | null
          is_active?: boolean
          is_archived?: boolean
          legacy_config?: Json
          level?: number | null
          max_completions_per_user?: number | null
          mission_group?: string | null
          notify_on_progress?: boolean
          prerequisite_summary?: Json
          priority?: number
          repeatable?: boolean
          reset_on_failure?: boolean
          reward_badge_id?: string | null
          reward_points?: number
          reward_type?: string
          reward_value?: string | null
          sort_order?: number
          starts_at?: string | null
          status?: string
          streak_count?: number | null
          target_action?: string
          target_value?: number
          timezone?: string
          title?: string
          type?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "missions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "mission_campaigns"
            referencedColumns: ["id"]
          },
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
      prepaid_memberships: {
        Row: {
          activated_at: string | null
          birth_date: string | null
          birth_place: string | null
          city_of_residence: string | null
          created_at: string
          email: string | null
          error_message: string | null
          first_name: string
          id: string
          identity_match_key: string | null
          import_batch_id: string
          import_batch_label: string | null
          imported_by: string | null
          last_name: string
          manually_assigned_at: string | null
          matched_user_id: string | null
          membership_year: number
          payment_date: string | null
          phone: string | null
          province_of_birth: string | null
          province_of_residence: string | null
          residential_address: string | null
          review_note: string | null
          sex: string | null
          source_row: Json
          status: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          birth_date?: string | null
          birth_place?: string | null
          city_of_residence?: string | null
          created_at?: string
          email?: string | null
          error_message?: string | null
          first_name?: string
          id?: string
          identity_match_key?: string | null
          import_batch_id?: string
          import_batch_label?: string | null
          imported_by?: string | null
          last_name?: string
          manually_assigned_at?: string | null
          matched_user_id?: string | null
          membership_year?: number
          payment_date?: string | null
          phone?: string | null
          province_of_birth?: string | null
          province_of_residence?: string | null
          residential_address?: string | null
          review_note?: string | null
          sex?: string | null
          source_row?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          birth_date?: string | null
          birth_place?: string | null
          city_of_residence?: string | null
          created_at?: string
          email?: string | null
          error_message?: string | null
          first_name?: string
          id?: string
          identity_match_key?: string | null
          import_batch_id?: string
          import_batch_label?: string | null
          imported_by?: string | null
          last_name?: string
          manually_assigned_at?: string | null
          matched_user_id?: string | null
          membership_year?: number
          payment_date?: string | null
          phone?: string | null
          province_of_birth?: string | null
          province_of_residence?: string | null
          residential_address?: string | null
          review_note?: string | null
          sex?: string | null
          source_row?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prepaid_memberships_matched_user_id_fkey"
            columns: ["matched_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"] | null
          activity_frequency: string | null
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          birth_place: string | null
          city_of_residence: string | null
          created_at: string
          email: string | null
          emergency_medication_has: boolean | null
          emergency_medication_notes: string | null
          event_motivation: string | null
          experience_grade: number | null
          first_name: string
          has_car: string | null
          health_safety_help_notes: string | null
          health_safety_notes: string | null
          health_safety_status: string | null
          health_safety_updated_at: string | null
          id: string
          instagram_handle: string | null
          interests: string[] | null
          is_founding_member: boolean
          last_name: string
          membership_id: number | null
          membership_registration_date: string | null
          membership_status: string | null
          membership_subscription_order: number | null
          membership_year: number | null
          onboarding_completed: boolean | null
          phone: string
          phone_verification_method: string | null
          phone_verified: boolean | null
          phone_verified_at: string | null
          preferences: Json | null
          province_of_birth: string | null
          province_of_residence: string | null
          residential_address: string | null
          self_level: string | null
          sex: string | null
          total_points: number
          trekking_experience: string | null
          updated_at: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"] | null
          activity_frequency?: string | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          birth_place?: string | null
          city_of_residence?: string | null
          created_at?: string
          email?: string | null
          emergency_medication_has?: boolean | null
          emergency_medication_notes?: string | null
          event_motivation?: string | null
          experience_grade?: number | null
          first_name?: string
          has_car?: string | null
          health_safety_help_notes?: string | null
          health_safety_notes?: string | null
          health_safety_status?: string | null
          health_safety_updated_at?: string | null
          id: string
          instagram_handle?: string | null
          interests?: string[] | null
          is_founding_member?: boolean
          last_name?: string
          membership_id?: number | null
          membership_registration_date?: string | null
          membership_status?: string | null
          membership_subscription_order?: number | null
          membership_year?: number | null
          onboarding_completed?: boolean | null
          phone?: string
          phone_verification_method?: string | null
          phone_verified?: boolean | null
          phone_verified_at?: string | null
          preferences?: Json | null
          province_of_birth?: string | null
          province_of_residence?: string | null
          residential_address?: string | null
          self_level?: string | null
          sex?: string | null
          total_points?: number
          trekking_experience?: string | null
          updated_at?: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"] | null
          activity_frequency?: string | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          birth_place?: string | null
          city_of_residence?: string | null
          created_at?: string
          email?: string | null
          emergency_medication_has?: boolean | null
          emergency_medication_notes?: string | null
          event_motivation?: string | null
          experience_grade?: number | null
          first_name?: string
          has_car?: string | null
          health_safety_help_notes?: string | null
          health_safety_notes?: string | null
          health_safety_status?: string | null
          health_safety_updated_at?: string | null
          id?: string
          instagram_handle?: string | null
          interests?: string[] | null
          is_founding_member?: boolean
          last_name?: string
          membership_id?: number | null
          membership_registration_date?: string | null
          membership_status?: string | null
          membership_subscription_order?: number | null
          membership_year?: number | null
          onboarding_completed?: boolean | null
          phone?: string
          phone_verification_method?: string | null
          phone_verified?: boolean | null
          phone_verified_at?: string | null
          preferences?: Json | null
          province_of_birth?: string | null
          province_of_residence?: string | null
          residential_address?: string | null
          self_level?: string | null
          sex?: string | null
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
      registration_change_requests: {
        Row: {
          additional_payment_amount: number
          amount_paid_before: number
          created_at: string
          error_message: string | null
          event_id: string
          event_paid_before: number
          id: string
          metadata: Json
          new_amount_paid: number
          new_balance_due_amount: number
          new_balance_payment_mode:
            | Database["public"]["Enums"]["balance_payment_mode"]
            | null
          new_deposit_amount: number | null
          new_payment_status: string
          new_payment_type: string
          new_price_option_id: string
          new_registration_status: Database["public"]["Enums"]["registration_status"]
          new_total_amount: number
          old_payment_type: string | null
          old_price_option_id: string | null
          old_total_amount: number
          refund_amount: number
          registration_id: string
          service_fee_amount: number
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          stripe_refund_id: string | null
          target_event_paid_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_payment_amount?: number
          amount_paid_before?: number
          created_at?: string
          error_message?: string | null
          event_id: string
          event_paid_before?: number
          id?: string
          metadata?: Json
          new_amount_paid?: number
          new_balance_due_amount?: number
          new_balance_payment_mode?:
            | Database["public"]["Enums"]["balance_payment_mode"]
            | null
          new_deposit_amount?: number | null
          new_payment_status: string
          new_payment_type: string
          new_price_option_id: string
          new_registration_status: Database["public"]["Enums"]["registration_status"]
          new_total_amount?: number
          old_payment_type?: string | null
          old_price_option_id?: string | null
          old_total_amount?: number
          refund_amount?: number
          registration_id: string
          service_fee_amount?: number
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          target_event_paid_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_payment_amount?: number
          amount_paid_before?: number
          created_at?: string
          error_message?: string | null
          event_id?: string
          event_paid_before?: number
          id?: string
          metadata?: Json
          new_amount_paid?: number
          new_balance_due_amount?: number
          new_balance_payment_mode?:
            | Database["public"]["Enums"]["balance_payment_mode"]
            | null
          new_deposit_amount?: number | null
          new_payment_status?: string
          new_payment_type?: string
          new_price_option_id?: string
          new_registration_status?: Database["public"]["Enums"]["registration_status"]
          new_total_amount?: number
          old_payment_type?: string | null
          old_price_option_id?: string | null
          old_total_amount?: number
          refund_amount?: number
          registration_id?: string
          service_fee_amount?: number
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          target_event_paid_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_change_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_change_requests_new_price_option_id_fkey"
            columns: ["new_price_option_id"]
            isOneToOne: false
            referencedRelation: "event_price_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_change_requests_old_price_option_id_fkey"
            columns: ["old_price_option_id"]
            isOneToOne: false
            referencedRelation: "event_price_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_change_requests_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_change_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_payment_transactions: {
        Row: {
          amount: number
          change_request_id: string | null
          created_at: string
          currency: string
          event_id: string
          id: string
          kind: string
          metadata: Json
          registration_id: string
          source: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          stripe_refund_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          change_request_id?: string | null
          created_at?: string
          currency?: string
          event_id: string
          id?: string
          kind: string
          metadata?: Json
          registration_id: string
          source?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          change_request_id?: string | null
          created_at?: string
          currency?: string
          event_id?: string
          id?: string
          kind?: string
          metadata?: Json
          registration_id?: string
          source?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_payment_transactions_change_request_id_fkey"
            columns: ["change_request_id"]
            isOneToOne: false
            referencedRelation: "registration_change_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_payment_transactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_payment_transactions_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_payment_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      user_activity_log: {
        Row: {
          activity_group: string
          activity_type: string
          actor_id: string | null
          actor_role: string | null
          amount: number | null
          audit_log_id: string | null
          badge_id: string | null
          created_at: string
          description: string | null
          event_id: string | null
          id: string
          issue_id: string | null
          metadata: Json
          mission_id: string | null
          notification_id: string | null
          occurred_at: string
          payment_status_after: string | null
          payment_status_before: string | null
          registration_id: string | null
          reward_id: string | null
          source_record_id: string | null
          source_table: string | null
          status_after: string | null
          status_before: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          activity_group?: string
          activity_type: string
          actor_id?: string | null
          actor_role?: string | null
          amount?: number | null
          audit_log_id?: string | null
          badge_id?: string | null
          created_at?: string
          description?: string | null
          event_id?: string | null
          id?: string
          issue_id?: string | null
          metadata?: Json
          mission_id?: string | null
          notification_id?: string | null
          occurred_at?: string
          payment_status_after?: string | null
          payment_status_before?: string | null
          registration_id?: string | null
          reward_id?: string | null
          source_record_id?: string | null
          source_table?: string | null
          status_after?: string | null
          status_before?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          activity_group?: string
          activity_type?: string
          actor_id?: string | null
          actor_role?: string | null
          amount?: number | null
          audit_log_id?: string | null
          badge_id?: string | null
          created_at?: string
          description?: string | null
          event_id?: string | null
          id?: string
          issue_id?: string | null
          metadata?: Json
          mission_id?: string | null
          notification_id?: string | null
          occurred_at?: string
          payment_status_after?: string | null
          payment_status_before?: string | null
          registration_id?: string | null
          reward_id?: string | null
          source_record_id?: string | null
          source_table?: string | null
          status_after?: string | null
          status_before?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_log_audit_log_id_fkey"
            columns: ["audit_log_id"]
            isOneToOne: false
            referencedRelation: "user_audit_log"
            referencedColumns: ["id"]
          },
        ]
      }
      user_audit_log: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          changed_columns: string[]
          created_at: string
          id: string
          metadata: Json
          new_row: Json | null
          occurred_at: string
          old_row: Json | null
          operation: string
          record_id: string | null
          schema_name: string
          source: string
          table_name: string
          transaction_id: number
          user_id: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          changed_columns?: string[]
          created_at?: string
          id?: string
          metadata?: Json
          new_row?: Json | null
          occurred_at?: string
          old_row?: Json | null
          operation: string
          record_id?: string | null
          schema_name?: string
          source?: string
          table_name: string
          transaction_id?: number
          user_id?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          changed_columns?: string[]
          created_at?: string
          id?: string
          metadata?: Json
          new_row?: Json | null
          occurred_at?: string
          old_row?: Json | null
          operation?: string
          record_id?: string | null
          schema_name?: string
          source?: string
          table_name?: string
          transaction_id?: number
          user_id?: string | null
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
      user_consents: {
        Row: {
          consent_type: string
          created_at: string | null
          granted: boolean
          granted_at: string | null
          id: string
          revoked_at: string | null
          updated_at: string | null
          user_id: string
          version: string | null
        }
        Insert: {
          consent_type: string
          created_at?: string | null
          granted?: boolean
          granted_at?: string | null
          id?: string
          revoked_at?: string | null
          updated_at?: string | null
          user_id: string
          version?: string | null
        }
        Update: {
          consent_type?: string
          created_at?: string | null
          granted?: boolean
          granted_at?: string | null
          id?: string
          revoked_at?: string | null
          updated_at?: string | null
          user_id?: string
          version?: string | null
        }
        Relationships: []
      }
      user_mission_history: {
        Row: {
          admin_id: string | null
          created_at: string
          delta: number
          details: Json
          event_type: string
          id: string
          mission_id: string
          progress_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          delta?: number
          details?: Json
          event_type?: string
          id?: string
          mission_id: string
          progress_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          delta?: number
          details?: Json
          event_type?: string
          id?: string
          mission_id?: string
          progress_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_mission_history_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_mission_history_progress_id_fkey"
            columns: ["progress_id"]
            isOneToOne: false
            referencedRelation: "user_mission_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      user_mission_progress: {
        Row: {
          completed_at: string | null
          completion_count: number
          created_at: string
          current_value: number
          cycle_ends_at: string | null
          cycle_key: string
          cycle_started_at: string | null
          id: string
          is_completed: boolean
          is_expired: boolean
          is_locked: boolean
          last_progress_at: string | null
          legacy_user_mission_id: string | null
          mission_id: string
          reward_details: Json | null
          started_at: string
          state: Json
          target_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completion_count?: number
          created_at?: string
          current_value?: number
          cycle_ends_at?: string | null
          cycle_key?: string
          cycle_started_at?: string | null
          id?: string
          is_completed?: boolean
          is_expired?: boolean
          is_locked?: boolean
          last_progress_at?: string | null
          legacy_user_mission_id?: string | null
          mission_id: string
          reward_details?: Json | null
          started_at?: string
          state?: Json
          target_value?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completion_count?: number
          created_at?: string
          current_value?: number
          cycle_ends_at?: string | null
          cycle_key?: string
          cycle_started_at?: string | null
          id?: string
          is_completed?: boolean
          is_expired?: boolean
          is_locked?: boolean
          last_progress_at?: string | null
          legacy_user_mission_id?: string | null
          mission_id?: string
          reward_details?: Json | null
          started_at?: string
          state?: Json
          target_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_mission_progress_legacy_user_mission_id_fkey"
            columns: ["legacy_user_mission_id"]
            isOneToOne: false
            referencedRelation: "user_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_mission_progress_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
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
      user_payment_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          event_amount: number
          event_id: string | null
          id: string
          kind: string
          membership_fee_amount: number
          metadata: Json
          registration_id: string | null
          service_fee_amount: number
          source: string
          stripe_balance_transaction_id: string | null
          stripe_checkout_session_id: string | null
          stripe_fee_amount: number
          stripe_net_amount: number | null
          stripe_payment_intent_id: string | null
          stripe_refund_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          event_amount?: number
          event_id?: string | null
          id?: string
          kind: string
          membership_fee_amount?: number
          metadata?: Json
          registration_id?: string | null
          service_fee_amount?: number
          source: string
          stripe_balance_transaction_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_fee_amount?: number
          stripe_net_amount?: number | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          event_amount?: number
          event_id?: string | null
          id?: string
          kind?: string
          membership_fee_amount?: number
          metadata?: Json
          registration_id?: string | null
          service_fee_amount?: number
          source?: string
          stripe_balance_transaction_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_fee_amount?: number
          stripe_net_amount?: number | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_payment_transactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_payment_transactions_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_payment_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          source_mission_reward_id: string | null
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
          source_mission_reward_id?: string | null
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
          source_mission_reward_id?: string | null
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
          {
            foreignKeyName: "user_rewards_source_mission_reward_id_fkey"
            columns: ["source_mission_reward_id"]
            isOneToOne: false
            referencedRelation: "mission_rewards"
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
      admin_user_activity_timeline: {
        Row: {
          activity_group: string | null
          activity_type: string | null
          amount: number | null
          badge_id: string | null
          badge_name: string | null
          description: string | null
          email: string | null
          event_date: string | null
          event_id: string | null
          event_title: string | null
          id: string | null
          metadata: Json | null
          mission_id: string | null
          mission_title: string | null
          notification_id: string | null
          occurred_at: string | null
          payment_status_after: string | null
          payment_status_before: string | null
          registration_id: string | null
          reward_id: string | null
          source_record_id: string | null
          source_table: string | null
          status_after: string | null
          status_before: string | null
          title: string | null
          user_id: string | null
          user_name: string | null
        }
        Relationships: []
      }
      admin_user_payment_summary: {
        Row: {
          event_amount: number | null
          gross_amount: number | null
          last_payment_at: string | null
          last_transaction_at: string | null
          membership_fee_amount: number | null
          net_amount: number | null
          payment_count: number | null
          refund_count: number | null
          refunded_amount: number | null
          service_fee_amount: number | null
          stripe_fee_amount: number | null
          stripe_net_amount: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_payment_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _apply_prepaid_membership_to_user: {
        Args: {
          p_manually_assigned_by?: string
          p_prepaid_id: string
          p_user_id: string
        }
        Returns: Json
      }
      _scamp_activity_group: {
        Args: { activity_type: string }
        Returns: string
      }
      _scamp_activity_title: {
        Args: { activity_type: string }
        Returns: string
      }
      _scamp_activity_type: {
        Args: {
          new_row: Json
          old_row: Json
          operation: string
          table_name: string
        }
        Returns: string
      }
      _scamp_changed_columns: {
        Args: { new_row: Json; old_row: Json }
        Returns: string[]
      }
      _scamp_extract_log_user_id: {
        Args: { row_data: Json; table_name: string }
        Returns: string
      }
      _scamp_identity_part: { Args: { value: string }; Returns: string }
      _scamp_normalize_email: { Args: { value: string }; Returns: string }
      _scamp_prepaid_identity_key: {
        Args: {
          p_birth_date: string
          p_first_name: string
          p_last_name: string
        }
        Returns: string
      }
      _scamp_safe_date: { Args: { value: string }; Returns: string }
      _scamp_safe_numeric: { Args: { value: string }; Returns: number }
      _scamp_safe_uuid: { Args: { value: string }; Returns: string }
      _scamp_sanitize_audit_row: { Args: { row_data: Json }; Returns: Json }
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
      admin_activate_prepaid_membership: {
        Args: { p_prepaid_id: string; p_user_id: string }
        Returns: Json
      }
      admin_apply_prepaid_membership_to_user: {
        Args: {
          p_manually_assigned_by?: string
          p_prepaid_id: string
          p_user_id: string
        }
        Returns: Json
      }
      admin_assign_badge: {
        Args: { p_badge_id: string; p_user_id: string }
        Returns: undefined
      }
      admin_import_prepaid_memberships: {
        Args: { p_batch_label?: string; p_rows: Json }
        Returns: Json
      }
      award_configured_user_points: {
        Args: {
          p_action_type: string
          p_admin_id?: string
          p_description?: string
          p_reference_id?: string
          p_user_id: string
        }
        Returns: string
      }
      award_event_attendance_badges: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: undefined
      }
      award_mission_rewards: {
        Args: { p_mission_id: string; p_notify?: boolean; p_user_id: string }
        Returns: Json
      }
      compute_mission_cycle_key: {
        Args: { p_mission_type: string; p_timezone?: string }
        Returns: string
      }
      count_event_active_participants: {
        Args: { p_event_id: string }
        Returns: number
      }
      count_event_option_active_participants: {
        Args: { p_option_id: string }
        Returns: number
      }
      count_user_attended_events: {
        Args: { p_user_id: string }
        Returns: number
      }
      count_user_attended_events_in_category: {
        Args: { p_category: string; p_user_id: string }
        Returns: number
      }
      event_registration_start_at: {
        Args: { p_date: string; p_time: string }
        Returns: string
      }
      get_event_option_availability: {
        Args: { p_event_id: string }
        Returns: {
          event_id: string
          event_remaining: number
          is_bookable: boolean
          option_id: string
          option_remaining: number
          option_spots_taken: number
          option_spots_total: number
          real_remaining: number
          waitlist_enabled: boolean
        }[]
      }
      get_event_participant_avatars: {
        Args: { p_event_id: string }
        Returns: {
          avatar_url: string
          first_name: string
          user_id: string
        }[]
      }
      get_event_people_public: {
        Args: { p_event_id: string }
        Returns: {
          age: number
          attended_events_count: number
          avatar_url: string
          badges: Json
          bio: string
          first_name: string
          id: string
          last_name: string
          last_name_initial: string
          role: string
          sort_order: number
          total_points: number
          user_id: string
        }[]
      }
      get_public_profile: {
        Args: { profile_id: string }
        Returns: {
          avatar_url: string
          bio: string
          first_name: string
          id: string
          instagram_handle: string | null
          last_name_initial: string
          phone: string
          total_points: number
        }[]
      }
      get_public_profiles: {
        Args: { profile_ids: string[] }
        Returns: {
          avatar_url: string
          bio: string
          first_name: string
          id: string
          instagram_handle: string | null
          last_name_initial: string
          phone: string
          total_points: number
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
      invoke_scampagnate_edge_function: {
        Args: { p_body?: Json; p_function_name: string }
        Returns: number
      }
      is_active_event_participant_status: {
        Args: { p_payment_status?: string; p_status: string }
        Returns: boolean
      }
      is_event_closed_for_registration_status: {
        Args: { p_status: string }
        Returns: boolean
      }
      is_event_option_bookable: {
        Args: { p_event_id: string; p_price_option_id?: string }
        Returns: boolean
      }
      is_event_registration_open_at: {
        Args: { p_event_id: string; p_reference?: string }
        Returns: boolean
      }
      is_event_registration_open_status: {
        Args: { p_status: string }
        Returns: boolean
      }
      next_available_membership_id: { Args: never; Returns: number }
      recalculate_user_total_points: {
        Args: { p_user_id: string }
        Returns: number
      }
      reconcile_prepaid_membership_for_user: {
        Args: { p_user_id: string }
        Returns: Json
      }
      refresh_event_spots: { Args: { p_event_id: string }; Returns: undefined }
      scamp_changed_columns: {
        Args: { new_data: Json; old_data: Json }
        Returns: string[]
      }
      scamp_install_admin_organizer_activity_triggers: {
        Args: never
        Returns: undefined
      }
      sync_current_periodic_user_missions: { Args: never; Returns: number }
      sync_user_missions_for_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      validate_discount_code: {
        Args: { p_code: string; p_event_id: string; p_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      account_status: "Active" | "Suspended" | "Banned"
      app_role: "admin" | "organizer" | "user"
      balance_payment_mode: "online" | "on_site"
      event_status:
        | "available"
        | "full"
        | "closed"
        | "draft"
        | "published"
        | "cancelled"
        | "past"
        | "unpublished"
        | "upcoming"
        | "open"
        | "rescheduled"
        | "completed"
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
        | "pending_payment"
        | "deposit_paid"
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
      balance_payment_mode: ["online", "on_site"],
      event_status: [
        "available",
        "full",
        "closed",
        "draft",
        "published",
        "cancelled",
        "past",
        "unpublished",
        "upcoming",
        "open",
        "rescheduled",
        "completed",
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
        "pending_payment",
        "deposit_paid",
      ],
    },
  },
} as const
