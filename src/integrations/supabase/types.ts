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
      badges: {
        Row: {
          category: string | null
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          required_events: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name: string
          required_events?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          required_events?: number
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
          max_uses: number | null
          times_used: number
          updated_at: string
        }
        Insert: {
          applies_to_all?: boolean
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
          max_uses?: number | null
          times_used?: number
          updated_at?: string
        }
        Update: {
          applies_to_all?: boolean
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
          max_uses?: number | null
          times_used?: number
          updated_at?: string
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
          featured: boolean
          gallery_images: Json | null
          id: string
          image_url: string | null
          location: string
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
          featured?: boolean
          gallery_images?: Json | null
          id?: string
          image_url?: string | null
          location: string
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
          featured?: boolean
          gallery_images?: Json | null
          id?: string
          image_url?: string | null
          location?: string
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
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"] | null
          activity_frequency: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          experience_grade: number | null
          first_name: string
          id: string
          last_name: string
          membership_id: number | null
          membership_registration_date: string | null
          membership_status: string | null
          membership_year: number | null
          phone: string
          preferences: Json | null
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
          experience_grade?: number | null
          first_name?: string
          id: string
          last_name?: string
          membership_id?: number | null
          membership_registration_date?: string | null
          membership_status?: string | null
          membership_year?: number | null
          phone?: string
          preferences?: Json | null
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
          experience_grade?: number | null
          first_name?: string
          id?: string
          last_name?: string
          membership_id?: number | null
          membership_registration_date?: string | null
          membership_status?: string | null
          membership_year?: number | null
          phone?: string
          preferences?: Json | null
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
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
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
