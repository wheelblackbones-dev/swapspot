// Generated from the SwapSpot database schema by the Supabase type generator. Do not edit by hand.
// Regenerate after a migration:
//   npx supabase gen types typescript --project-id <project-ref> --schema public > lib/database.types.ts

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      availability_snapshots: {
        Row: {
          available_spots: number
          id: number
          lot_id: number
          recorded_at: string
        }
        Insert: {
          available_spots: number
          id?: never
          lot_id: number
          recorded_at?: string
        }
        Update: {
          available_spots?: number
          id?: never
          lot_id?: number
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_snapshots_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "booking_details"
            referencedColumns: ["lot_id"]
          },
          {
            foreignKeyName: "availability_snapshots_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "dikw_information_lot_hourly"
            referencedColumns: ["lot_id"]
          },
          {
            foreignKeyName: "availability_snapshots_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "dikw_knowledge_lot_patterns"
            referencedColumns: ["lot_id"]
          },
          {
            foreignKeyName: "availability_snapshots_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "dikw_wisdom_lot_actions"
            referencedColumns: ["lot_id"]
          },
          {
            foreignKeyName: "availability_snapshots_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lot_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_snapshots_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "parking_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          amount: number
          created_at: string
          duration_hours: number
          ended_at: string | null
          ends_at: string | null
          hold_expires_at: string | null
          hourly_rate: number
          id: number
          spot_id: number
          starts_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          duration_hours: number
          ended_at?: string | null
          ends_at?: string | null
          hold_expires_at?: string | null
          hourly_rate: number
          id?: never
          spot_id: number
          starts_at?: string | null
          status: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          duration_hours?: number
          ended_at?: string | null
          ends_at?: string | null
          hold_expires_at?: string | null
          hourly_rate?: number
          id?: never
          spot_id?: number
          starts_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "booking_details"
            referencedColumns: ["spot_id"]
          },
          {
            foreignKeyName: "bookings_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "parking_spots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      operators: {
        Row: {
          created_at: string
          id: number
          name: string
        }
        Insert: {
          created_at?: string
          id?: never
          name: string
        }
        Update: {
          created_at?: string
          id?: never
          name?: string
        }
        Relationships: []
      }
      parking_lots: {
        Row: {
          accessible_spots: number
          address: string
          availability_updated_at: string
          available_spots: number
          close_time: string
          code: string
          created_at: string
          daily_max: number | null
          ev_chargers: number
          free_with_purchase: boolean
          has_security: boolean
          hourly_rate: number
          id: number
          is_active: boolean
          is_covered: boolean
          latitude: number
          longitude: number
          name: string
          open_time: string
          operator_id: number
          rating: number | null
          total_spots: number
        }
        Insert: {
          accessible_spots?: number
          address: string
          availability_updated_at?: string
          available_spots: number
          close_time?: string
          code: string
          created_at?: string
          daily_max?: number | null
          ev_chargers?: number
          free_with_purchase?: boolean
          has_security?: boolean
          hourly_rate: number
          id?: never
          is_active?: boolean
          is_covered?: boolean
          latitude: number
          longitude: number
          name: string
          open_time?: string
          operator_id: number
          rating?: number | null
          total_spots: number
        }
        Update: {
          accessible_spots?: number
          address?: string
          availability_updated_at?: string
          available_spots?: number
          close_time?: string
          code?: string
          created_at?: string
          daily_max?: number | null
          ev_chargers?: number
          free_with_purchase?: boolean
          has_security?: boolean
          hourly_rate?: number
          id?: never
          is_active?: boolean
          is_covered?: boolean
          latitude?: number
          longitude?: number
          name?: string
          open_time?: string
          operator_id?: number
          rating?: number | null
          total_spots?: number
        }
        Relationships: [
          {
            foreignKeyName: "parking_lots_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      parking_spots: {
        Row: {
          id: number
          label: string
          lot_id: number
          spot_type: string
          status: string
          updated_at: string
        }
        Insert: {
          id?: never
          label: string
          lot_id: number
          spot_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          id?: never
          label?: string
          lot_id?: number
          spot_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parking_spots_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "booking_details"
            referencedColumns: ["lot_id"]
          },
          {
            foreignKeyName: "parking_spots_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "dikw_information_lot_hourly"
            referencedColumns: ["lot_id"]
          },
          {
            foreignKeyName: "parking_spots_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "dikw_knowledge_lot_patterns"
            referencedColumns: ["lot_id"]
          },
          {
            foreignKeyName: "parking_spots_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "dikw_wisdom_lot_actions"
            referencedColumns: ["lot_id"]
          },
          {
            foreignKeyName: "parking_spots_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lot_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parking_spots_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "parking_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          booking_id: number
          created_at: string
          currency: string
          id: number
          method: string
          paid_at: string | null
          provider: string
          reference: string
          status: string
        }
        Insert: {
          amount: number
          booking_id: number
          created_at?: string
          currency?: string
          id?: never
          method: string
          paid_at?: string | null
          provider?: string
          reference: string
          status?: string
        }
        Update: {
          amount?: number
          booking_id?: number
          created_at?: string
          currency?: string
          id?: never
          method?: string
          paid_at?: string | null
          provider?: string
          reference?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          license_plate: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          license_plate?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          license_plate?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      search_events: {
        Row: {
          created_at: string
          id: number
          intent: string
          lot_id: number | null
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          intent: string
          lot_id?: number | null
          source: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: never
          intent?: string
          lot_id?: number | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_events_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "booking_details"
            referencedColumns: ["lot_id"]
          },
          {
            foreignKeyName: "search_events_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "dikw_information_lot_hourly"
            referencedColumns: ["lot_id"]
          },
          {
            foreignKeyName: "search_events_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "dikw_knowledge_lot_patterns"
            referencedColumns: ["lot_id"]
          },
          {
            foreignKeyName: "search_events_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "dikw_wisdom_lot_actions"
            referencedColumns: ["lot_id"]
          },
          {
            foreignKeyName: "search_events_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lot_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_events_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "parking_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      booking_details: {
        Row: {
          amount: number | null
          created_at: string | null
          duration_hours: number | null
          ended_at: string | null
          ends_at: string | null
          hold_expires_at: string | null
          hourly_rate: number | null
          id: number | null
          lot_code: string | null
          lot_id: number | null
          lot_name: string | null
          paid_at: string | null
          payment_id: number | null
          payment_method: string | null
          payment_reference: string | null
          payment_status: string | null
          spot_id: number | null
          spot_label: string | null
          spot_type: string | null
          starts_at: string | null
          status: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dikw_data_summary: {
        Row: {
          bays: number | null
          first_reading_at: string | null
          last_reading_at: string | null
          lots: number | null
          operators: number | null
          sensor_readings: number | null
        }
        Relationships: []
      }
      dikw_information_city_hourly: {
        Row: {
          avg_occupancy_pct: number | null
          hour_of_day: number | null
          readings: number | null
        }
        Relationships: []
      }
      dikw_information_lot_hourly: {
        Row: {
          avg_available_spots: number | null
          avg_occupancy_pct: number | null
          hour_of_day: number | null
          lot_code: string | null
          lot_id: number | null
          lot_name: string | null
          readings: number | null
        }
        Relationships: []
      }
      dikw_knowledge_lot_patterns: {
        Row: {
          avg_occupancy_pct: number | null
          demand_level: string | null
          hourly_rate: number | null
          lot_code: string | null
          lot_id: number | null
          lot_name: string | null
          peak_hour: number | null
          peak_occupancy_pct: number | null
          quiet_hour: number | null
          quiet_occupancy_pct: number | null
          readings: number | null
          weekday_occupancy_pct: number | null
          weekend_occupancy_pct: number | null
        }
        Relationships: []
      }
      dikw_wisdom_lot_actions: {
        Row: {
          demand_level: string | null
          driver_tip: string | null
          hourly_rate: number | null
          lot_code: string | null
          lot_id: number | null
          lot_name: string | null
          operator_action: string | null
          operator_tip: string | null
          suggested_rate: number | null
        }
        Relationships: []
      }
      lot_overview: {
        Row: {
          accessible_spots: number | null
          address: string | null
          availability_updated_at: string | null
          available_spots: number | null
          bookable_bays_free: number | null
          close_time: string | null
          code: string | null
          daily_max: number | null
          ev_chargers: number | null
          free_with_purchase: boolean | null
          has_security: boolean | null
          hourly_rate: number | null
          id: number | null
          is_covered: boolean | null
          latitude: number | null
          longitude: number | null
          name: string | null
          occupancy_pct: number | null
          open_time: string | null
          operator_name: string | null
          rating: number | null
          total_spots: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      cancel_booking: { Args: { p_booking_id: number }; Returns: Json }
      confirm_demo_payment: {
        Args: { p_outcome?: string; p_payment_id: number }
        Returns: Json
      }
      create_booking: {
        Args: { p_hours: number; p_spot_id: number }
        Returns: Json
      }
      end_booking: { Args: { p_booking_id: number }; Returns: Json }
      get_my_insights: { Args: never; Returns: Json }
      get_platform_insights: { Args: never; Returns: Json }
      start_payment: {
        Args: { p_booking_id: number; p_method: string }
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
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
